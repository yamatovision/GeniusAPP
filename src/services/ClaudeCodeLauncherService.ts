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
 * モックアップ解析プロセス情報
 */
interface MockupAnalysisProcess {
  id: string;
  mockupName: string;
  mockupPath: string;
  projectPath: string;
  analysisFilePath: string;
  terminal: vscode.Terminal | null;
  status: ClaudeCodeExecutionStatus;
  startTime: number;
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
  
  // 並列処理用の設定
  private readonly maxConcurrentProcesses: number = 3; // 最大同時実行数
  private mockupProcesses: Map<string, MockupAnalysisProcess> = new Map();
  private processingCount: number = 0;
  
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
      terminal.sendText('echo "\n\n*** AIが自動的に解析を開始します。自動対応と日本語指示を行います ***\n"');
      
      // macOSの場合は環境変数のソースを確保（出力を非表示）
      if (process.platform === 'darwin') {
        terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
        terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
      }
      
      // Raw mode問題を回避するための環境変数設定
      terminal.sendText('export NODE_NO_READLINE=1');
      terminal.sendText('export TERM=xterm-256color');
      
      // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
      const escapedProjectPath = this.projectPath.replace(/"/g, '\\"');
      terminal.sendText(`cd "${escapedProjectPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedClaudeMdPath = claudeMdPath.replace(/ /g, '\\ ');
      
      // インポートとインスタンス取得
      const authSync = await import('../services/ClaudeCodeAuthSync').then(module => module.ClaudeCodeAuthSync.getInstance());
      const authService = await import('../core/auth/AuthenticationService').then(module => module.AuthenticationService.getInstance());
      
      // CLIログイン状態を確認
      const isLoggedIn = authSync.isClaudeCliLoggedIn();
      Logger.info(`Claude CLI ログイン状態: ${isLoggedIn ? 'ログイン済み' : '未ログイン'}`);
      
      // 認証モードを確認 - AuthenticationServiceから最新状態を取得
      const authModeInfo = authService.getAuthModeInfo();
      const useIsolatedAuth = authModeInfo.isIsolatedAuthEnabled;
      
      Logger.info(`認証モード: ${useIsolatedAuth ? '分離認証モード' : '標準モード'} (検出方法: ${authModeInfo.detectionMethod})`);
      
      // 認証ファイルパスが取得できている場合はログに記録
      if (authModeInfo.authFilePath) {
        Logger.info(`認証ファイルパス: ${authModeInfo.authFilePath}`);
      }
      
      // AppGenius専用の認証情報を保存
      if (useIsolatedAuth) {
        await authSync.syncTokensToAppGeniusAuth();
        Logger.info('AppGenius専用の認証情報を同期しました（分離認証モード）');
      }
      
      // AppGenius専用の認証ファイルパス
      const appGeniusAuthFilePath = authSync.getAppGeniusAuthFilePath();
      
      // コマンド設定
      let baseCommand = 'claude';
      
      // 分離認証モードの場合、環境変数を設定してコマンドを構築
      if (useIsolatedAuth) {
        // 環境変数を設定する前に別々のコマンドとして実行（2行に分ける）
        terminal.sendText(`export CLAUDE_AUTH_FILE="${appGeniusAuthFilePath}"`);
        Logger.info(`分離認証モードで環境変数を設定: export CLAUDE_AUTH_FILE="${appGeniusAuthFilePath}"`);
      } else if (!isLoggedIn) {
        // 標準モードかつ未ログイン状態（--no-interactiveオプションはサポートされていないため削除）
        baseCommand = 'claude';
        Logger.info('未ログイン状態で起動します');
      }
      
      // スコープIDが存在する場合はスコープを指定して起動
      if (scope.id) {
        // スコープIDをエスケープする必要はないが、念のため
        const escapedScopeId = scope.id.replace(/ /g, '\\ ');
        // Claude Codeをスコープ指定で起動（echoとパイプを使用して自動応答）
        terminal.sendText(`echo "y\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | ${baseCommand} --scope=${escapedScopeId} ${escapedClaudeMdPath}`);
        const authMode = useIsolatedAuth ? '（分離認証モード）' : '';
        Logger.info(`ClaudeCode起動コマンド${authMode}（自動応答と日本語指示付き）: echo "y" | ${baseCommand} --scope=${escapedScopeId} ${escapedClaudeMdPath}`);
      } else {
        // スコープ指定なしで起動（echoとパイプを使用して自動応答）
        terminal.sendText(`echo "y\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | ${baseCommand} ${escapedClaudeMdPath}`);
        const authMode = useIsolatedAuth ? '（分離認証モード）' : '';
        Logger.info(`ClaudeCode起動コマンド${authMode}（自動応答と日本語指示付き）: echo "y" | ${baseCommand} ${escapedClaudeMdPath}`);
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
      // モックアップファイル情報を準備
      const absoluteMockupPath = path.isAbsolute(mockupFilePath) ? mockupFilePath : path.join(projectPath, mockupFilePath);
      const mockupName = path.basename(mockupFilePath, '.html');
      const processId = `mockup-${mockupName}-${Date.now()}`;
      
      // プロジェクトパスの確認
      if (!fs.existsSync(projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${projectPath}`);
      }
      
      // モックアップファイルの存在確認
      if (!fs.existsSync(absoluteMockupPath)) {
        throw new Error(`モックアップファイルが見つかりません: ${absoluteMockupPath}`);
      }
      
      // 現在実行中の同時プロセス数をチェック
      const runningProcesses = Array.from(this.mockupProcesses.values())
        .filter(p => p.status === ClaudeCodeExecutionStatus.RUNNING);
      
      // 同時実行数制限のチェック
      if (runningProcesses.length >= this.maxConcurrentProcesses) {
        const message = `現在${runningProcesses.length}個のモックアップ解析が実行中です。完了までお待ちください。`;
        vscode.window.showInformationMessage(message);
        return false;
      }
      
      // 新しいプロセスを作成
      const analysisFilePath = await this._prepareAnalysisFile(mockupName, absoluteMockupPath, projectPath, options);
      
      // プロセス情報を保存
      const process: MockupAnalysisProcess = {
        id: processId,
        mockupName,
        mockupPath: absoluteMockupPath,
        projectPath,
        analysisFilePath,
        terminal: null,
        status: ClaudeCodeExecutionStatus.IDLE,
        startTime: Date.now()
      };
      
      this.mockupProcesses.set(processId, process);
      
      // ターミナルを起動
      await this._startMockupAnalysisTerminal(processId);
      
      return true;
    } catch (error) {
      Logger.error('モックアップ解析用ClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`モックアップ解析用ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 指定したプロンプトファイルを使用してClaudeCodeを起動
   * @param projectPath プロジェクトパス
   * @param promptFilePath プロンプトファイルの絶対パス
   * @param options 追加オプション
   */
  public async launchClaudeCodeWithPrompt(
    projectPath: string,
    promptFilePath: string,
    options?: { 
      title?: string, 
      additionalParams?: string, 
      deletePromptFile?: boolean,
      splitView?: boolean, // 分割表示を使用するかどうか
      location?: vscode.ViewColumn // ターミナルの表示位置
    }
  ): Promise<boolean> {
    try {
      // プロジェクトパスの確認
      if (!fs.existsSync(projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${projectPath}`);
      }
      
      // プロンプトファイルの確認
      if (!fs.existsSync(promptFilePath)) {
        throw new Error(`プロンプトファイルが見つかりません: ${promptFilePath}`);
      }
      
      // アイコンURIを取得
      const platformManager = PlatformManager.getInstance();
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // ターミナルの作成（分割表示のオプションを指定）
      // VSCode APIの型定義に合わせて適切なターミナルオプションを設定
      const terminalOptions: vscode.TerminalOptions = {
        name: options?.title || 'ClaudeCode',
        cwd: projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      };
      
      // 分割表示の場合は、適切な位置を設定
      if (options?.splitView && options.location) {
        // terminalOptions.location = { viewColumn: options.location }; // VSCode 1.68以降の場合
        // 互換性のため代替方法を使用
      }
      
      const terminal = vscode.window.createTerminal(terminalOptions);
      
      // ターミナルの表示（true を渡してフォーカスする）
      terminal.show(true);
      
      // 最初にユーザーガイダンスを表示
      terminal.sendText('echo "\n\n*** AIが自動的に処理を開始します。自動対応と日本語指示を行います ***\n"');
      
      // macOSの場合は環境変数のソースを確保（出力を非表示）
      if (process.platform === 'darwin') {
        terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
        terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
      }
      
      // Raw mode問題を回避するための環境変数設定
      terminal.sendText('export NODE_NO_READLINE=1');
      terminal.sendText('export TERM=xterm-256color');
      
      // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
      const escapedProjectPath = projectPath.replace(/"/g, '\\"');
      terminal.sendText(`cd "${escapedProjectPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedPromptFilePath = promptFilePath.replace(/ /g, '\\ ');
      
      // 追加のコマンドラインパラメータがあれば追加
      // デバッグ探偵用にパラメータを設定
      let additionalParams = options?.additionalParams ? ` ${options.additionalParams}` : '';
      
      // オプションフラグは追加しない（Claude CLIでサポートされていないため）
      // additionalParams += ' -y --lang=ja';
      
      // インポートとインスタンス取得
      const authSync = await import('../services/ClaudeCodeAuthSync').then(module => module.ClaudeCodeAuthSync.getInstance());
      const authService = await import('../core/auth/AuthenticationService').then(module => module.AuthenticationService.getInstance());
      
      // CLIログイン状態を確認
      const isLoggedIn = authSync.isClaudeCliLoggedIn();
      Logger.info(`Claude CLI ログイン状態: ${isLoggedIn ? 'ログイン済み' : '未ログイン'}`);
      
      // 認証モードを確認 - AuthenticationServiceから最新状態を取得
      const authModeInfo = authService.getAuthModeInfo();
      const useIsolatedAuth = authModeInfo.isIsolatedAuthEnabled;
      
      Logger.info(`プロンプト実行用の認証モード: ${useIsolatedAuth ? '分離認証モード' : '標準モード'} (検出方法: ${authModeInfo.detectionMethod})`);
      
      // 認証ファイルパスが取得できている場合はログに記録
      if (authModeInfo.authFilePath) {
        Logger.info(`認証ファイルパス: ${authModeInfo.authFilePath}`);
      }
      
      // AppGenius専用の認証情報を保存
      if (useIsolatedAuth) {
        await authSync.syncTokensToAppGeniusAuth();
        Logger.info('AppGenius専用の認証情報を同期しました（分離認証モード）');
      }
      
      // AppGenius専用の認証ファイルパス
      const appGeniusAuthFilePath = authSync.getAppGeniusAuthFilePath();
      
      // コマンド設定
      let baseCommand = 'claude';
      
      // 分離認証モードの場合、環境変数を設定してコマンドを構築
      if (useIsolatedAuth) {
        // 環境変数を設定する前に別々のコマンドとして実行（2行に分ける）
        terminal.sendText(`export CLAUDE_AUTH_FILE="${appGeniusAuthFilePath}"`);
        Logger.info(`分離認証モードで環境変数を設定: export CLAUDE_AUTH_FILE="${appGeniusAuthFilePath}"`);
      } else if (!isLoggedIn) {
        // 標準モードかつ未ログイン状態（--no-interactiveオプションはサポートされていないため削除）
        baseCommand = 'claude';
        Logger.info('未ログイン状態で起動します');
      }
      
      // プロンプトファイルを指定してClaude CLIを起動（echoとパイプを使用して自動応答）
      terminal.sendText(`echo "y\\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | ${baseCommand} ${escapedPromptFilePath}${additionalParams}`);
      const authMode = useIsolatedAuth ? '（分離認証モード）' : '';
      Logger.info(`ClaudeCode起動コマンド${authMode}（自動応答と日本語指示付き）: echo "y" | ${baseCommand} ${escapedPromptFilePath}${additionalParams}`);
      
      // プロンプトファイルを即時削除（セキュリティ対策）
      if (options?.deletePromptFile) {
        try {
          // Windowsでは使用中のファイルは削除できないため、Linuxとmacのみ遅延削除
          if (process.platform !== 'win32') {
            setTimeout(() => {
              if (fs.existsSync(promptFilePath)) {
                fs.unlinkSync(promptFilePath);
                Logger.info(`プロンプトファイルを削除しました: ${promptFilePath}`);
              }
            }, 30000); // ファイルが読み込まれる時間を考慮して30秒後に削除
          }
          
          // ターミナル終了時のイベントリスナーを設定（全プラットフォーム対応）
          const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
              setTimeout(() => {
                try {
                  if (fs.existsSync(promptFilePath)) {
                    fs.unlinkSync(promptFilePath);
                    Logger.info(`プロンプトファイルを削除しました（ターミナル終了時）: ${promptFilePath}`);
                  }
                } catch (unlinkError) {
                  Logger.error(`ファイル削除エラー（ターミナル終了時）: ${unlinkError}`);
                }
              }, 500);
              disposable.dispose(); // リスナーの破棄
            }
          });
        } catch (deleteError) {
          Logger.warn(`プロンプトファイルの即時削除に失敗しました: ${deleteError}`);
        }
      }
      
      // 状態更新
      this.status = ClaudeCodeExecutionStatus.RUNNING;
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          projectPath: projectPath,
          promptFilePath: promptFilePath,
          additionalParams: options?.additionalParams,
          splitView: options?.splitView
        },
        'ClaudeCodeLauncherService'
      );
      
      return true;
    } catch (error) {
      Logger.error('プロンプトを使用したClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      this.status = ClaudeCodeExecutionStatus.FAILED;
      return false;
    }
  }

  /**
   * モックアップ解析用のMDファイルを準備
   */
  private async _prepareAnalysisFile(
    mockupName: string, 
    mockupFilePath: string, 
    projectPath: string,
    options?: { source?: string }
  ): Promise<string> {
    // テンプレートファイルのパスを取得
    const templatePath = path.join(projectPath, 'docs/mockup_analysis_template.md');
    if (!fs.existsSync(templatePath)) {
      Logger.warn('モックアップ解析テンプレートが見つかりません。デフォルトテンプレートを使用します。');
    }
    
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
      
      // 絶対パスをログに記録
      Logger.info(`モックアップファイルの絶対パス: ${mockupFilePath}`);
      Logger.info(`プロジェクトの絶対パス: ${projectPath}`);
      
      // ソース情報をログに記録
      const source = options?.source || 'unknown';
      Logger.info(`起動ソース: ${source}`);
      
      analysisContent = analysisContent
        .replace(/{{MOCKUP_PATH}}/g, mockupFilePath)
        .replace(/{{PROJECT_PATH}}/g, projectPath)
        .replace(/{{MOCKUP_NAME}}/g, mockupName)
        .replace(/{{SOURCE}}/g, source);
    } else {
      // テンプレートが存在しない場合はデフォルトテンプレートを使用
      analysisContent = `# モックアップ解析と要件定義

あなたはUIモックアップの解析と要件定義の詳細化を行うエキスパートです。すべての応答は必ず日本語で行ってください。

モックアップHTML: ${mockupFilePath}
プロジェクトパス: ${projectPath}

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
保存先: ${projectPath}/docs/scopes/${mockupName}-requirements.md
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
    
    return analysisFilePath;
  }
  
  /**
   * モックアップ解析ターミナルを起動
   */
  private async _startMockupAnalysisTerminal(processId: string): Promise<boolean> {
    try {
      const processInfo = this.mockupProcesses.get(processId);
      if (!processInfo) {
        throw new Error(`プロセス情報が見つかりません: ${processId}`);
      }
      
      // アイコンURIを取得
      const platformManager = PlatformManager.getInstance();
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: `ClaudeCode - ${processInfo.mockupName}の解析`,
        cwd: processInfo.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナル情報を保存
      processInfo.terminal = terminal;
      processInfo.status = ClaudeCodeExecutionStatus.RUNNING;
      this.mockupProcesses.set(processId, processInfo);
      
      // ターミナル終了イベントの監視を設定
      this._watchTerminalClose(terminal, processId);
      
      // ターミナルの表示（true を渡してフォーカスする）
      terminal.show(true);
      
      // 最初にユーザーガイダンスを表示
      terminal.sendText('echo "\n\n*** AIが自動的に処理を開始します。自動対応と日本語指示を行います ***\n"');
      terminal.sendText('sleep 0.5'); // 0.5秒待機してメッセージを読む時間を確保
      
      // macOSの場合は環境変数のソースを確保
      if (process.platform === 'darwin') {
        terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
        terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
      }
      
      // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
      const escapedProjectPath = processInfo.projectPath.replace(/"/g, '\\"');
      terminal.sendText(`cd "${escapedProjectPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedAnalysisFilePath = processInfo.analysisFilePath.replace(/ /g, '\\ ');
      
      // インポートとインスタンス取得
      const authSync = await import('../services/ClaudeCodeAuthSync').then(module => module.ClaudeCodeAuthSync.getInstance());
      const authService = await import('../core/auth/AuthenticationService').then(module => module.AuthenticationService.getInstance());
      
      // 認証モードを確認 - AuthenticationServiceから最新状態を取得
      const authModeInfo = authService.getAuthModeInfo();
      const useIsolatedAuth = authModeInfo.isIsolatedAuthEnabled;
      
      Logger.info(`モックアップ解析用の認証モード: ${useIsolatedAuth ? '分離認証モード' : '標準モード'} (検出方法: ${authModeInfo.detectionMethod})`);
      
      // AppGenius専用の認証情報を保存
      if (useIsolatedAuth) {
        await authSync.syncTokensToAppGeniusAuth();
        Logger.info('AppGenius専用の認証情報を同期しました（分離認証モード）');
      }
      
      // コマンド設定
      let baseCommand = 'claude';
      
      // 分離認証モードの場合、環境変数を設定してコマンドを構築
      if (useIsolatedAuth) {
        const appGeniusAuthFilePath = authSync.getAppGeniusAuthFilePath();
        // 環境変数を設定する前に別々のコマンドとして実行（2行に分ける）
        terminal.sendText(`export CLAUDE_AUTH_FILE="${appGeniusAuthFilePath}"`);
        Logger.info(`分離認証モードで環境変数を設定: export CLAUDE_AUTH_FILE="${appGeniusAuthFilePath}"`);
      }
      
      // 解析用ファイルを指定してClaude CLIを起動（echoとパイプを使用して自動応答）
      terminal.sendText(`echo "y\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | ${baseCommand} ${escapedAnalysisFilePath}`);
      const authMode = useIsolatedAuth ? '（分離認証モード）' : '';
      Logger.info(`モックアップ解析用ClaudeCode起動コマンド${authMode}（自動応答と日本語指示付き）: echo "y" | ${baseCommand} ${escapedAnalysisFilePath}`);
      
      // 状態は個別に管理するが、後方互換性のために全体のステータスも更新
      this.status = ClaudeCodeExecutionStatus.RUNNING;
      
      // 現在のプロセス状態をログ出力
      const runningCount = this.getRunningMockupProcesses().length;
      Logger.info(`現在実行中のモックアップ解析プロセス数: ${runningCount}/${this.maxConcurrentProcesses}`);
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          processId,
          mockupName: processInfo.mockupName,
          mockupFilePath: processInfo.mockupPath,
          projectPath: processInfo.projectPath,
          analysisFilePath: processInfo.analysisFilePath
        },
        'ClaudeCodeLauncherService'
      );
      
      return true;
    } catch (error) {
      Logger.error(`モックアップ解析ターミナルの起動に失敗しました: ${processId}`, error as Error);
      
      // プロセス情報を更新
      const processInfo = this.mockupProcesses.get(processId);
      if (processInfo) {
        processInfo.status = ClaudeCodeExecutionStatus.FAILED;
        this.mockupProcesses.set(processId, processInfo);
      }
      
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
   * 実行中のモックアップ解析プロセス一覧を取得
   */
  public getRunningMockupProcesses(): MockupAnalysisProcess[] {
    return Array.from(this.mockupProcesses.values())
      .filter(process => process.status === ClaudeCodeExecutionStatus.RUNNING)
      .sort((a, b) => a.startTime - b.startTime);
  }
  
  /**
   * モックアップ解析プロセスの状態を取得
   */
  public getMockupProcessInfo(processId: string): MockupAnalysisProcess | undefined {
    return this.mockupProcesses.get(processId);
  }
  
  /**
   * ターミナル終了イベントを監視
   * 新しいターミナルが作成されたときに自動的に監視を開始
   */
  private _watchTerminalClose(terminal: vscode.Terminal, processId: string): void {
    // ターミナルクローズ監視のdisposableを保持する必要はない（VSCodeの寿命内）
    vscode.window.onDidCloseTerminal(closedTerminal => {
      if (closedTerminal === terminal) {
        // プロセス情報を更新
        const processInfo = this.mockupProcesses.get(processId);
        if (processInfo) {
          processInfo.status = ClaudeCodeExecutionStatus.COMPLETED;
          processInfo.terminal = null;
          this.mockupProcesses.set(processId, processInfo);
          
          Logger.info(`モックアップ解析プロセスのターミナルが閉じられました: ${processId}`);
          
          // アクティブなプロセスがなくなった場合、全体の状態も更新
          const anyRunning = this.getRunningMockupProcesses().length > 0;
          if (!anyRunning) {
            this.status = ClaudeCodeExecutionStatus.IDLE;
          }
        }
      }
    });
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this.stopProgressMonitoring();
    
    if (this.codeProcess && !this.codeProcess.killed) {
      this.codeProcess.kill();
    }
    
    // すべての実行中プロセスも終了させる
    for (const processInfo of this.mockupProcesses.values()) {
      if (processInfo.terminal && processInfo.status === ClaudeCodeExecutionStatus.RUNNING) {
        try {
          processInfo.terminal.dispose();
        } catch (error) {
          Logger.error(`ターミナル終了中にエラーが発生しました: ${processInfo.id}`, error as Error);
        }
      }
    }
  }
}