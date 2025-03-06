import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Logger } from '../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from './AppGeniusEventBus';
import { ImplementationScope, ImplementationItem } from './AppGeniusStateManager';
import { PlatformManager } from '../utils/PlatformManager';
import { ScopeExporter } from '../utils/ScopeExporter';
import { MessageBroker, MessageType } from '../utils/MessageBroker';

/**
 * ClaudeCode実行状態
 */
export enum ClaudeCodeExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

/**
 * ClaudeCodeプロセス管理サービス
 * VSCode拡張からClaudeCodeを起動し、実装スコープに基づいて開発を進める
 */
export class ClaudeCodeLauncherService {
  private static instance: ClaudeCodeLauncherService;
  private eventBus: AppGeniusEventBus;
  private codeProcess: childProcess.ChildProcess | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private progressWatcher: fs.FSWatcher | null = null;
  
  // ClaudeCode実行状態
  private status: ClaudeCodeExecutionStatus = ClaudeCodeExecutionStatus.IDLE;
  private projectPath: string = '';
  private scopeFilePath: string = '';
  private progressFilePath: string = '';
  
  private constructor() {
    this.eventBus = AppGeniusEventBus.getInstance();
    
    // 拡張機能が起動するたびに状態をリセット（前回のセッションでRUNNINGのままだった場合の対策）
    this.status = ClaudeCodeExecutionStatus.IDLE;
    
    Logger.info('ClaudeCodeLauncherService initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeCodeLauncherService {
    if (!ClaudeCodeLauncherService.instance) {
      ClaudeCodeLauncherService.instance = new ClaudeCodeLauncherService();
    }
    return ClaudeCodeLauncherService.instance;
  }
  
  /**
   * スコープ情報を基にClaudeCodeを起動
   * @param scope スコープ情報（CLAUDE.md内のスコープIDでも対応可能）
   */
  public async launchClaudeCode(scope: ImplementationScope): Promise<boolean> {
    try {
      // 前回の状態がRUNNINGのまま残っている可能性があるため、再確認を提案
      if (this.status === ClaudeCodeExecutionStatus.RUNNING) {
        const choice = await vscode.window.showWarningMessage(
          'ClaudeCodeは既に実行中のようです。前回の実行が正常に終了していない可能性があります。',
          '状態をリセットして続行',
          'キャンセル'
        );
        
        if (choice === '状態をリセットして続行') {
          // 状態をリセットして続行
          this.resetStatus();
          Logger.info('ClaudeCode状態をリセットして続行します');
        } else {
          // キャンセルされた場合は処理を中断
          Logger.warn('ClaudeCodeの起動がキャンセルされました');
          return false;
        }
      }
      
      // プロジェクトパスの確認
      this.projectPath = scope.projectPath;
      if (!fs.existsSync(this.projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${this.projectPath}`);
      }
      
      // CLAUDE.mdファイルパスを取得
      const claudeMdPath = path.join(this.projectPath, 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        throw new Error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
      }
      
      // スコープID（CLAUDE.md内で使用）
      const scopeId = scope.id || `scope-${Date.now()}`;
      
      // スコープ情報もJSONとして保存（バックアップと既存システムとの互換性のため）
      const scopeExporter = ScopeExporter.getInstance();
      this.scopeFilePath = scopeExporter.exportScope(scope);
      
      // 進捗ファイルパスの設定
      const platformManager = PlatformManager.getInstance();
      this.progressFilePath = path.join(platformManager.getTempDirectory('progress'), `${scopeId}.json`);
      
      Logger.info(`スコープ情報を保存しました: ${this.scopeFilePath}`);
      
      // アイコンURIを取得
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: 'ClaudeCode',
        cwd: this.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナルの表示
      terminal.show(true);
      
      // プロジェクトディレクトリに移動
      terminal.sendText(`cd "${this.projectPath}"`);
      
      // スコープIDが存在する場合はスコープを指定して起動
      if (scope.id) {
        // Claude Codeをスコープ指定で起動
        terminal.sendText(`claude --scope="${scope.id}" "${claudeMdPath}"`);
        Logger.info(`ClaudeCode起動コマンド: claude --scope="${scope.id}" "${claudeMdPath}"`);
      } else {
        // スコープ指定なしで起動
        terminal.sendText(`claude "${claudeMdPath}"`);
        Logger.info(`ClaudeCode起動コマンド: claude "${claudeMdPath}"`);
      }
      
      // 自動復旧用の手動コマンドも表示
      terminal.sendText(`if [ $? -ne 0 ]; then
        echo ""
        echo "※ ClaudeCodeの起動に問題が発生しました。以下の手順を試してください:"
        echo "1. ターミナルで 'claude' をインストール (npm install -g claude-cli)"
        echo ""
      fi`);
      
      // 状態更新
      this.status = ClaudeCodeExecutionStatus.RUNNING;
      
      // 進捗監視の開始
      this.startProgressMonitoring();
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          scopeId,
          projectPath: this.projectPath,
          scopeFilePath: this.scopeFilePath,
          progressFilePath: this.progressFilePath
        },
        'ClaudeCodeLauncherService'
      );
      
      // メッセージブローカーを通じて通知
      try {
        const messageBroker = MessageBroker.getInstance(scopeId);
        messageBroker.sendMessage(MessageType.SCOPE_UPDATE, {
          scopeId,
          action: 'claude_code_launched',
          timestamp: Date.now()
        });
      } catch (error) {
        Logger.warn('メッセージブローカーへの通知に失敗しました', error as Error);
      }
      
      return true;
    } catch (error) {
      Logger.error('ClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      this.status = ClaudeCodeExecutionStatus.FAILED;
      return false;
    }
  }
  
  /**
   * モックアップを解析するためにClaudeCodeを起動
   * @param mockupFilePath モックアップHTMLファイルのパス
   * @param projectPath プロジェクトパス
   */
  public async launchClaudeCodeWithMockup(mockupFilePath: string, projectPath: string): Promise<boolean> {
    try {
      // 前回の状態が残っていれば初期化
      if (this.status === ClaudeCodeExecutionStatus.RUNNING) {
        this.resetStatus();
      }
      
      // プロジェクトパスの確認
      this.projectPath = projectPath;
      if (!fs.existsSync(this.projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${this.projectPath}`);
      }
      
      // モックアップファイルの存在確認
      if (!fs.existsSync(mockupFilePath)) {
        throw new Error(`モックアップファイルが見つかりません: ${mockupFilePath}`);
      }
      
      // CLAUDE.mdファイルパスを取得
      const claudeMdPath = path.join(this.projectPath, 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        throw new Error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
      }
      
      // アイコンURIを取得
      const platformManager = PlatformManager.getInstance();
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // ターミナルの作成（simpleChat.tsの成功例を参考に実装）
      const terminal = vscode.window.createTerminal({
        name: 'ClaudeCode - モックアップ解析',
        cwd: this.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナルの表示
      terminal.show();
      
      // システムメッセージを設定してClaudeCodeを起動
      const sysMsgContent = `あなたはUIモックアップの解析と要件定義の詳細化を行うエキスパートです。

モックアップHTML: ${mockupFilePath}
このモックアップを詳細に解析し、ユーザーと相談しながら以下を行ってください:

1. モックアップの詳細な分析と説明
2. モックアップを完璧に仕上げるための改善提案
3. ユーザーと相談しながら、実装に必要な詳細な要件定義を作成
4. 完成した要件定義を「docs/scopes/」ディレクトリにマークダウンファイルとして保存

保存するファイル名は「モックアップ名-requirements.md」としてください。
要件定義には必ず以下の項目を含めてください：
- 機能概要
- UI要素の詳細
- データ構造
- API・バックエンド連携
- エラー処理
- パフォーマンス要件
- セキュリティ要件

ユーザーの意図を正確に把握し、非技術者でも理解できる形で要件をまとめてください。`;
      
      // システムメッセージファイルを一時的に作成
      const sysMsgFileName = `mockup-analysis-${Date.now()}.txt`;
      const sysMsgPath = path.join(platformManager.getTempDirectory('messages'), sysMsgFileName);
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(path.dirname(sysMsgPath))) {
        fs.mkdirSync(path.dirname(sysMsgPath), { recursive: true });
      }
      
      // システムメッセージをファイルに書き込み
      fs.writeFileSync(sysMsgPath, sysMsgContent, 'utf8');
      
      // macOSの場合は環境変数のソースを確保（simpleChat.tsの成功例から移植）
      if (process.platform === 'darwin') {
        terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found"');
        terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
      }
      
      // エスケープ処理（simpleChat.tsの成功例から移植）
      const escapedClaudeMdPath = claudeMdPath.replace(/ /g, '\\ ');
      
      // 2つのアプローチを試す - 最初にシンプルなアプローチで起動を試みる
      terminal.sendText(`claude ${escapedClaudeMdPath}`);
      Logger.info(`モックアップ解析用ClaudeCode起動コマンド: claude ${escapedClaudeMdPath}`);
      
      // 1秒後に初期メッセージを送信
      const timerId = setTimeout(() => {
        terminal.sendText(sysMsgContent);
        terminal.sendText(`\nモックアップファイル ${mockupFilePath} について分析し、ユーザーと対話しながら要件定義を詳細化してください。`);
      }, 1000);
      
      // 状態更新
      this.status = ClaudeCodeExecutionStatus.RUNNING;
      this.scopeFilePath = '';
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          mockupFilePath,
          projectPath: this.projectPath
        },
        'ClaudeCodeLauncherService'
      );
      
      return true;
    } catch (error) {
      Logger.error('モックアップ解析用ClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`モックアップ解析用ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      this.status = ClaudeCodeExecutionStatus.FAILED;
      return false;
    }
  }
  
  /**
   * ClaudeCodeが利用可能かチェック
   */
  private async isClaudeCodeAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      childProcess.exec('claude --version', (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 現在の実行状態を取得
   */
  public getStatus(): ClaudeCodeExecutionStatus {
    return this.status;
  }
  
  /**
   * ClaudeCodeの状態を強制リセット
   */
  public resetStatus(): void {
    if (this.status === ClaudeCodeExecutionStatus.RUNNING) {
      Logger.warn('ClaudeCodeの状態を強制的にリセットします');
      this.status = ClaudeCodeExecutionStatus.IDLE;
      
      // 進捗監視のクリーンアップも実行
      this.stopProgressMonitoring();
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STOPPED,
        { projectPath: this.projectPath },
        'ClaudeCodeLauncherService'
      );
    }
  }
  
  /**
   * 進捗監視を開始
   */
  private startProgressMonitoring(): void {
    try {
      // 既存の監視がある場合は停止
      this.stopProgressMonitoring();
      
      // 進捗ファイルの監視を開始
      this.progressWatcher = fs.watch(path.dirname(this.progressFilePath), (eventType, filename) => {
        if (filename === path.basename(this.progressFilePath) && eventType === 'change') {
          this.readProgressFile();
        }
      });
      
      // 定期的に進捗を確認（ウォッチャーの補完）
      this.statusUpdateInterval = setInterval(() => {
        this.readProgressFile();
      }, 5000);  // 5秒ごとに確認
      
      Logger.debug('進捗監視を開始しました');
    } catch (error) {
      Logger.error('進捗監視の開始に失敗しました', error as Error);
    }
  }
  
  /**
   * 進捗監視を停止
   */
  private stopProgressMonitoring(): void {
    try {
      // ファイルウォッチャーの停止
      if (this.progressWatcher) {
        this.progressWatcher.close();
        this.progressWatcher = null;
      }
      
      // 定期確認タイマーの停止
      if (this.statusUpdateInterval) {
        clearInterval(this.statusUpdateInterval);
        this.statusUpdateInterval = null;
      }
      
      Logger.debug('進捗監視を停止しました');
    } catch (error) {
      Logger.error('進捗監視の停止に失敗しました', error as Error);
    }
  }
  
  /**
   * 進捗ファイルを読み込み、状態を更新
   */
  private readProgressFile(): void {
    try {
      // ファイルが存在しなければスキップ
      if (!fs.existsSync(this.progressFilePath)) {
        return;
      }
      
      // ファイルの読み込み
      const data = fs.readFileSync(this.progressFilePath, 'utf8');
      const progress = JSON.parse(data);
      
      // 進捗データの型チェック
      if (progress && typeof progress.totalProgress === 'number' && Array.isArray(progress.items)) {
        // 状態の更新
        if (progress.status) {
          this.status = progress.status;
        }
        
        // 完了したらモニタリングを停止
        if (this.status === ClaudeCodeExecutionStatus.COMPLETED) {
          this.stopProgressMonitoring();
        }
        
        // イベント発火
        this.eventBus.emit(
          AppGeniusEventType.CLAUDE_CODE_PROGRESS,
          progress,
          'ClaudeCodeLauncherService'
        );
        
        Logger.debug(`進捗更新: ${progress.totalProgress}%`);
      }
    } catch (error) {
      Logger.error('進捗ファイルの読み込みに失敗しました', error as Error);
    }
  }
  
  /**
   * ClaudeCodeをインストール
   */
  public async installClaudeCode(): Promise<boolean> {
    try {
      // ClaudeCodeがインストールされているか確認
      const isInstalled = await this.isClaudeCodeAvailable();
      
      if (isInstalled) {
        vscode.window.showInformationMessage('ClaudeCodeは既にインストールされています');
        return true;
      }
      
      // ターミナルでインストールコマンドを実行
      const terminal = vscode.window.createTerminal({
        name: 'ClaudeCode インストール'
      });
      
      terminal.show();
      
      // グローバルインストール
      terminal.sendText('npm install -g claude-cli');
      terminal.sendText('echo "インストールが完了したらターミナルを閉じてください"');
      terminal.sendText('echo "* もしインストールに失敗した場合は、管理者権限が必要かもしれません *"');
      
      // インストール完了を待つ（ユーザーがターミナルを閉じるまで）
      return new Promise<boolean>((resolve) => {
        const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
          if (closedTerminal === terminal) {
            disposable.dispose();
            
            // インストール後に再度確認
            this.isClaudeCodeAvailable().then(isNowAvailable => {
              if (isNowAvailable) {
                vscode.window.showInformationMessage('ClaudeCodeが正常にインストールされました');
                resolve(true);
              } else {
                vscode.window.showErrorMessage('ClaudeCodeのインストールに失敗しました。管理者権限で再試行してください。');
                resolve(false);
              }
            });
          }
        });
      });
    } catch (error) {
      Logger.error('ClaudeCodeのインストールに失敗しました', error as Error);
      vscode.window.showErrorMessage(`ClaudeCodeのインストールに失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this.stopProgressMonitoring();
    
    if (this.codeProcess && !this.codeProcess.killed) {
      this.codeProcess.kill();
    }
  }
}