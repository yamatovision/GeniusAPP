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
      
      // ターミナルの作成（simpleChat.tsの成功例を参考に実装）
      const terminal = vscode.window.createTerminal({
        name: 'ClaudeCode',
        cwd: this.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナルの表示（true を渡してフォーカスする）
      terminal.show(true);
      
      // 最初にユーザーガイダンスを表示
      terminal.sendText('echo "\n\n*** AIが自動解析の許可を得ますのでyesを押し続けてください ***\n"');
      terminal.sendText('sleep 2'); // 2秒待機してメッセージを読む時間を確保
      
      // macOSの場合は環境変数のソースを確保（出力を非表示）
      if (process.platform === 'darwin') {
        terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
        terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
      }
      
      // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
      const escapedProjectPath = this.projectPath.replace(/"/g, '\\"');
      terminal.sendText(`cd "${escapedProjectPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedClaudeMdPath = claudeMdPath.replace(/ /g, '\\ ');
      
      // スコープIDが存在する場合はスコープを指定して起動
      if (scope.id) {
        // スコープIDをエスケープする必要はないが、念のため
        const escapedScopeId = scope.id.replace(/ /g, '\\ ');
        // Claude Codeをスコープ指定で起動
        terminal.sendText(`echo "\n" && claude --scope=${escapedScopeId} ${escapedClaudeMdPath}`);
        Logger.info(`ClaudeCode起動コマンド: claude --scope=${escapedScopeId} ${escapedClaudeMdPath}`);
      } else {
        // スコープ指定なしで起動
        terminal.sendText(`echo "\n" && claude ${escapedClaudeMdPath}`);
        Logger.info(`ClaudeCode起動コマンド: claude ${escapedClaudeMdPath}`);
      }
      
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
   * @param options 追加オプション（ソース情報など）
   */
  public async launchClaudeCodeWithMockup(mockupFilePath: string, projectPath: string, options?: { source?: string }): Promise<boolean> {
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
      
      // テンプレートファイルのパスを取得
      const templatePath = path.join(this.projectPath, 'docs/mockup_analysis_template.md');
      if (!fs.existsSync(templatePath)) {
        Logger.warn('モックアップ解析テンプレートが見つかりません。デフォルトテンプレートを使用します。');
      }
      
      // モックアップ名を取得
      const mockupName = path.basename(mockupFilePath, '.html');
      
      // テンポラリディレクトリを取得
      const platformManager = PlatformManager.getInstance();
      const tempDir = platformManager.getTempDirectory('mockup-analysis');
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // 一時的な解析用MDファイルを作成
      const analysisFileName = `${mockupName}-analysis-${Date.now()}.md`;
      const analysisFilePath = path.join(tempDir, analysisFileName);
      
      let analysisContent = '';
      
      // テンプレートが存在する場合はテンプレートを使用
      if (fs.existsSync(templatePath)) {
        analysisContent = fs.readFileSync(templatePath, 'utf8');
        
        // テンプレート内の変数を置換（確実に絶対パスを使用）
        const absoluteMockupPath = path.isAbsolute(mockupFilePath) ? mockupFilePath : path.join(this.projectPath, mockupFilePath);
        const absoluteProjectPath = this.projectPath; // 既にプロジェクトパスは絶対パスとして初期化されている
        
        // 絶対パスをログに記録
        Logger.info(`モックアップファイルの絶対パス: ${absoluteMockupPath}`);
        Logger.info(`プロジェクトの絶対パス: ${absoluteProjectPath}`);
        
        // ソース情報をログに記録
        const source = options?.source || 'unknown';
        Logger.info(`起動ソース: ${source}`);
        
        analysisContent = analysisContent
          .replace(/{{MOCKUP_PATH}}/g, absoluteMockupPath)
          .replace(/{{PROJECT_PATH}}/g, absoluteProjectPath)
          .replace(/{{MOCKUP_NAME}}/g, mockupName)
          .replace(/{{SOURCE}}/g, source);
      } else {
        // テンプレートが存在しない場合はデフォルトテンプレートを使用
        analysisContent = `# モックアップ解析と要件定義

あなたはUIモックアップの解析と要件定義の詳細化を行うエキスパートです。すべての応答は必ず日本語で行ってください。

モックアップHTML: ${path.isAbsolute(mockupFilePath) ? mockupFilePath : path.join(this.projectPath, mockupFilePath)}
プロジェクトパス: ${this.projectPath}

## 作業指示
このモックアップの解析にあたっては、ユーザーとの相談を最優先してください。以下の手順で進めてください:

1. **まず最初に、モックアップに関するユーザーの意図と考えを確認**
   - モックアップの目的についてユーザーに質問する
   - このUIで達成したいことを詳しく聞く
   - ユーザーがイメージしている利用シーンを把握する

2. **モックアップの分析と相談**
   - UI要素の特定と役割について確認する
   - 画面遷移とユーザーフローについて相談する
   - 改善案をユーザーに提示し、意見を求める

3. **要件定義の詳細化（ユーザーの承認を得てから進める）**
   - ユーザーと一緒に要件を具体化する
   - 各項目についてユーザーの確認を得る
   - 非機能要件についても相談する

4. **要件の最終承認を得てから文書化**
   - 要件定義のドラフトをユーザーに提示
   - フィードバックを反映して調整
   - 最終承認を得てから文書化を完了する

**必ずユーザーの最終承認を得てから**、完成した要件定義を以下の場所に保存してください:
保存先: ${this.projectPath}/docs/scopes/${mockupName}-requirements.md
ファイル名: ${mockupName}-requirements.md

要件定義には以下の項目を含めてください：
- 機能概要
- UI要素の詳細
- データ構造
- API・バックエンド連携
- エラー処理
- パフォーマンス要件
- セキュリティ要件

注意: ユーザーとの議論を経ずに要件定義を自動生成しないでください。
必ずユーザーの意図を正確に把握し、非技術者でも理解できる形で要件をまとめてください。`;
      }
      
      // 解析用MDファイルを作成
      fs.writeFileSync(analysisFilePath, analysisContent, 'utf8');
      Logger.info(`モックアップ解析用ファイルを作成しました: ${analysisFilePath}`);
      
      // アイコンURIを取得
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: `ClaudeCode - ${mockupName}の解析`,
        cwd: this.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナルの表示（true を渡してフォーカスする）
      terminal.show(true);
      
      // 最初にユーザーガイダンスを表示
      terminal.sendText('echo "\n\n*** AIが自動解析の許可を得ますのでyesを押し続けてください ***\n"');
      terminal.sendText('sleep 2'); // 2秒待機してメッセージを読む時間を確保
      
      // macOSの場合は環境変数のソースを確保
      if (process.platform === 'darwin') {
        terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
        terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
      }
      
      // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
      const escapedProjectPath = this.projectPath.replace(/"/g, '\\"');
      terminal.sendText(`cd "${escapedProjectPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedAnalysisFilePath = analysisFilePath.replace(/ /g, '\\ ');
      
      // 解析用ファイルを指定してClaude CLIを起動
      terminal.sendText(`echo "\n" && claude ${escapedAnalysisFilePath}`);
      Logger.info(`モックアップ解析用ClaudeCode起動コマンド: claude ${escapedAnalysisFilePath}`);
      
      // 状態更新
      this.status = ClaudeCodeExecutionStatus.RUNNING;
      this.scopeFilePath = '';
      
      // モックアップ解析情報をログに記録
      Logger.info(`モックアップ分析のためClaudeCodeを起動しました: ${mockupName}`);
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          mockupFilePath,
          projectPath: this.projectPath,
          analysisFilePath: analysisFilePath
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