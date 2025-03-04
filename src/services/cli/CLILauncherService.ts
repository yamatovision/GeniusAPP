import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../AppGeniusEventBus';
import { ImplementationScope, ImplementationItem } from '../AppGeniusStateManager';
import { PlatformManager } from '../../utils/PlatformManager';
import { ScopeExporter } from '../../utils/ScopeExporter';
import { MessageBroker, MessageType } from '../../utils/MessageBroker';

/**
 * CLI実行状態
 */
export enum CLIExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

/**
 * CLIプロセス管理サービス
 * VSCode拡張からCLIツールを起動し、通信を管理する
 */
export class CLILauncherService {
  private static instance: CLILauncherService;
  private eventBus: AppGeniusEventBus;
  private cliProcess: childProcess.ChildProcess | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private progressWatcher: fs.FSWatcher | null = null;
  
  // CLI実行状態
  private status: CLIExecutionStatus = CLIExecutionStatus.IDLE;
  private projectPath: string = '';
  private scopeFilePath: string = '';
  private progressFilePath: string = '';
  
  private constructor() {
    this.eventBus = AppGeniusEventBus.getInstance();
    
    // 拡張機能が起動するたびに状態をリセット（前回のセッションでRUNNINGのままだった場合の対策）
    this.status = CLIExecutionStatus.IDLE;
    
    Logger.info('CLILauncherService initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): CLILauncherService {
    if (!CLILauncherService.instance) {
      CLILauncherService.instance = new CLILauncherService();
    }
    return CLILauncherService.instance;
  }
  
  /**
   * スコープ情報を基にCLIを起動
   */
  public async launchCLI(scope: ImplementationScope): Promise<boolean> {
    try {
      // 前回の状態がRUNNINGのまま残っている可能性があるため、再確認を提案
      if (this.status === CLIExecutionStatus.RUNNING) {
        const choice = await vscode.window.showWarningMessage(
          'CLIは既に実行中のようです。前回の実行が正常に終了していない可能性があります。',
          '状態をリセットして続行',
          'キャンセル'
        );
        
        if (choice === '状態をリセットして続行') {
          // 状態をリセットして続行
          this.resetStatus();
          Logger.info('CLI状態をリセットして続行します');
        } else {
          // キャンセルされた場合は処理を中断
          Logger.warn('CLIの起動がキャンセルされました');
          return false;
        }
      }
      
      // プロジェクトパスの確認
      this.projectPath = scope.projectPath;
      if (!fs.existsSync(this.projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${this.projectPath}`);
      }
      
      // PlatformManagerとScopeExporterを使用してスコープを標準化して保存
      const scopeExporter = ScopeExporter.getInstance();
      this.scopeFilePath = scopeExporter.exportScope(scope);
      
      // スコープIDを取得
      const scopeData = scopeExporter.importScope(this.scopeFilePath);
      if (!scopeData) {
        throw new Error('スコープ情報の保存に失敗しました');
      }
      
      const scopeId = scopeData.id;
      
      // 進捗ファイルパスの設定
      const platformManager = PlatformManager.getInstance();
      this.progressFilePath = path.join(platformManager.getTempDirectory('progress'), `${scopeId}.json`);
      
      Logger.info(`スコープ情報を保存しました: ${this.scopeFilePath}`);
      
      // APIキーの取得
      const config = vscode.workspace.getConfiguration('appgeniusAI');
      const apiKey = config.get<string>('apiKey') || '';
      
      // デバッグモードの取得
      const debugMode = config.get<boolean>('debug') || false;
      
      // モデルの取得
      const model = config.get<string>('model') || 'claude-3-7-sonnet-20250219';
      
      // 起動方法を決定（新しい方法を優先）
      try {
        // まず新しい起動方法を試みる
        const success = await this.launchCliWithNode(scopeData, apiKey, debugMode);
        if (success) {
          return true;
        }
      } catch (error) {
        Logger.warn('新しい起動方法に失敗しました。従来の方法を試みます', error as Error);
      }
      
      // 拡張機能のパスを取得（PlatformManagerから）
      const extensionPath = platformManager.getExtensionPath() || '';
      
      // シェルスクリプトのパス（優先度順に探す）
      const possibleScriptPaths = [
        // 拡張機能内のパス
        path.join(extensionPath, 'appgenius-cli', 'launch-appgenius.sh'),
        
        // ワークスペース内のパス
        ...((vscode.workspace.workspaceFolders || []).map(folder => 
          path.join(folder.uri.fsPath, 'appgenius-cli', 'launch-appgenius.sh')
        ))
      ];
      
      // 実際に存在するスクリプトパスを探す
      let scriptPath = '';
      for (const possiblePath of possibleScriptPaths) {
        if (fs.existsSync(possiblePath)) {
          scriptPath = possiblePath;
          Logger.info(`起動スクリプトを見つけました: ${scriptPath}`);
          break;
        }
      }
      
      if (!scriptPath) {
        Logger.warn('起動スクリプトが見つかりませんでした。CLIを直接実行します。');
        return await this.launchCliDirect(scopeData, apiKey);
      }
      
      // アイコンURIを取得（PlatformManagerから）
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: 'AppGenius CLI',
        cwd: this.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナルの表示
      terminal.show();
      
      // 起動コマンドの構築
      let launchCommand = `CLAUDE_API_KEY="${apiKey}" APPGENIUS_PROJECT_ID="${scopeId}" bash "${scriptPath}" --scope="${this.scopeFilePath}" --project="${this.projectPath}" --model="${model}"`;
      
      // デバッグモードが有効の場合はフラグを追加
      if (debugMode) {
        launchCommand += ' --debug';
      }
      
      // コマンド実行
      Logger.debug(`起動コマンド: ${launchCommand}`);
      terminal.sendText(launchCommand);
      
      // 状態更新
      this.status = CLIExecutionStatus.RUNNING;
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLI_STARTED,
        { 
          scopeId,
          projectPath: this.projectPath,
          scopeFilePath: this.scopeFilePath,
          progressFilePath: this.progressFilePath
        },
        'CLILauncherService'
      );
      
      // 進捗監視の開始
      this.startProgressMonitoring();
      
      // メッセージブローカーを通じて通知
      try {
        const messageBroker = MessageBroker.getInstance(scopeId);
        messageBroker.sendMessage(MessageType.SCOPE_UPDATE, {
          scopeId,
          action: 'cli_launched',
          timestamp: Date.now()
        });
      } catch (error) {
        Logger.warn('メッセージブローカーへの通知に失敗しました', error as Error);
      }
      
      return true;
    } catch (error) {
      Logger.error('CLIの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`CLIの起動に失敗しました: ${(error as Error).message}`);
      this.status = CLIExecutionStatus.FAILED;
      return false;
    }
  }
  
  /**
   * Node.jsを使用して直接CLIを起動する新しい方法
   */
  private async launchCliWithNode(
    scopeData: any, 
    apiKey: string, 
    debugMode: boolean
  ): Promise<boolean> {
    try {
      // CLI実行パスを取得
      const cliPath = await this.getCliPath();
      
      // CLIがインストールされていない場合はfalseを返す
      if (!cliPath) {
        return false;
      }
      
      // アイコンURIを取得
      const platformManager = PlatformManager.getInstance();
      const iconPath = platformManager.getResourceUri('media/icon.svg');
      
      // スコープ情報をJSON文字列に変換
      const scopeJson = JSON.stringify({
        id: scopeData.id,
        path: this.scopeFilePath
      });
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: 'AppGenius CLI',
        cwd: this.projectPath,
        iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
      });
      
      // ターミナルの表示
      terminal.show();
      
      // 環境変数を設定
      terminal.sendText(`export CLAUDE_API_KEY="${apiKey}"`);
      terminal.sendText(`export APPGENIUS_CLI="true"`);
      terminal.sendText(`export APPGENIUS_PROJECT_ID="${scopeData.id}"`);
      terminal.sendText(`export APPGENIUS_SCOPE_PATH="${this.scopeFilePath}"`);
      terminal.sendText(`export APPGENIUS_PROJECT_PATH="${this.projectPath}"`);
      
      // デバッグモードの設定
      if (debugMode) {
        terminal.sendText(`export APPGENIUS_DEBUG="true"`);
      }
      
      // CLIを実行
      terminal.sendText(`${cliPath} chat`);
      
      // 自動復旧用の手動コマンドも表示
      terminal.sendText(`if [ $? -ne 0 ]; then
        echo ""
        echo "※ CLIの起動に問題が発生しました。以下の手順を試してください:"
        echo "1. ターミナルで直接 'appgenius-cli chat' を実行"
        echo "2. 起動後、'/load-scope ${this.scopeFilePath}' と入力"
        echo "3. '/set-project ${this.projectPath}' と入力"
        echo ""
      fi`);
      
      // 状態更新
      this.status = CLIExecutionStatus.RUNNING;
      
      // 進捗監視の開始
      this.startProgressMonitoring();
      
      return true;
    } catch (error) {
      Logger.error('Nodeを使用したCLI起動に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * CLIを直接起動（launch-appgenius.shが利用できない場合のフォールバック）
   */
  private async launchCliDirect(_scopeData: any, apiKey: string): Promise<boolean> {
    try {
      // まずプロジェクト内のappgenius-cli/dist/index.jsを探す
      let cliPath = '';
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const localCliPath = path.join(workspacePath, 'appgenius-cli', 'dist', 'index.js');
        Logger.debug(`ローカルCLIパスを確認中: ${localCliPath}`);
        
        if (fs.existsSync(localCliPath)) {
          Logger.info(`ローカルのCLIが見つかりました: ${localCliPath}`);
          cliPath = `node "${localCliPath}"`;
        }
      }
      
      // ローカルに見つからない場合は高度なパス解決を使用
      if (!cliPath) {
        try {
          cliPath = await this.getCliPath();
        } catch (error) {
          Logger.error('CLIパスの取得に失敗しました', error as Error);
          throw new Error(`CLIが見つかりません: ${(error as Error).message}`);
        }
      }
      
      // 拡張機能のアイコンを取得
      const extensionPath = vscode.extensions.getExtension('appgenius-ai.appgenius-ai')?.extensionPath || '';
      const iconPath = vscode.Uri.file(path.join(extensionPath, 'media', 'icon.svg'));
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: 'AppGenius CLI',
        cwd: this.projectPath,
        iconPath
      });
      
      // ターミナルの表示
      terminal.show();
      
      // 環境変数でAPIキーを設定し、CLIを直接起動
      terminal.sendText(`export CLAUDE_API_KEY="${apiKey}"`);
      
      // CLIを同期モードで実行
      terminal.sendText(`VSCODE_CLI=true ${cliPath} chat`);
      
      // 代わりにシンプルなインストラクションを表示
      terminal.sendText(`if [ $? -ne 0 ]; then
        echo ""
        echo "※ CLIの起動に問題が発生しました。以下の手順を試してください:"
        echo "1. ターミナルで直接 'appgenius-cli chat' を実行"
        echo "2. 起動後、'/load-scope ${this.scopeFilePath}' と入力"
        echo "3. '/set-project ${this.projectPath}' と入力"
        echo ""
      fi`)
      
      // 状態更新
      this.status = CLIExecutionStatus.RUNNING;
      
      // 進捗監視の開始
      this.startProgressMonitoring();
      
      return true;
    } catch (error) {
      Logger.error('CLIの直接起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`CLIの直接起動に失敗しました: ${(error as Error).message}`);
      this.status = CLIExecutionStatus.FAILED;
      return false;
    }
  }
  
  /**
   * CLIが利用可能かチェック
   */
  private async isCliAvailable(cliPath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      childProcess.exec(`${cliPath} --version`, (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 現在のCLIの状態を取得
   */
  public getStatus(): CLIExecutionStatus {
    return this.status;
  }
  
  /**
   * CLIの状態を強制リセット
   */
  public resetStatus(): void {
    if (this.status === CLIExecutionStatus.RUNNING) {
      Logger.warn('CLIの状態を強制的にリセットします');
      this.status = CLIExecutionStatus.IDLE;
      
      // 進捗監視のクリーンアップも実行
      this.stopProgressMonitoring();
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLI_STOPPED,
        { projectPath: this.projectPath },
        'CLILauncherService'
      );
    }
  }
  
  /**
   * CLIプロセスを停止
   */
  public async stopCLI(): Promise<boolean> {
    try {
      if (this.status !== CLIExecutionStatus.RUNNING) {
        Logger.warn('停止するCLIプロセスがありません');
        return false;
      }
      
      // 進捗監視の停止
      this.stopProgressMonitoring();
      
      // 実行中のプロセスがある場合は終了
      if (this.cliProcess && !this.cliProcess.killed) {
        this.cliProcess.kill();
      }
      
      // 状態更新
      this.status = CLIExecutionStatus.IDLE;
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLI_STOPPED,
        { 
          projectPath: this.projectPath
        },
        'CLILauncherService'
      );
      
      vscode.window.showInformationMessage('CLIプロセスを停止しました');
      return true;
    } catch (error) {
      Logger.error('CLIの停止に失敗しました', error as Error);
      vscode.window.showErrorMessage(`CLIの停止に失敗しました: ${(error as Error).message}`);
      return false;
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
        if (this.status === CLIExecutionStatus.COMPLETED) {
          this.stopProgressMonitoring();
        }
        
        // イベント発火
        this.eventBus.emit(
          AppGeniusEventType.CLI_PROGRESS,
          progress,
          'CLILauncherService'
        );
        
        Logger.debug(`進捗更新: ${progress.totalProgress}%`);
      }
    } catch (error) {
      Logger.error('進捗ファイルの読み込みに失敗しました', error as Error);
    }
  }
  
  /**
   * CLI実行パスを取得
   */
  private async getCliPath(): Promise<string> {
    try {
      // 1. まず拡張機能に同梱されたCLIを探す
      const extensionPath = vscode.extensions.getExtension('appgenius-ai.appgenius-ai')?.extensionPath || '';
      const bundledCliPath = path.join(extensionPath, 'appgenius-cli', 'dist', 'index.js');
      
      if (fs.existsSync(bundledCliPath)) {
        Logger.info(`拡張機能に同梱されたCLIを使用します: ${bundledCliPath}`);
        return `node "${bundledCliPath}"`;
      }
      
      // 2. ワークスペースに同梱されたCLIを探す
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const workspaceCliPath = path.join(workspacePath, 'appgenius-cli', 'dist', 'index.js');
        
        if (fs.existsSync(workspaceCliPath)) {
          Logger.info(`ワークスペースのCLIを使用します: ${workspaceCliPath}`);
          return `node "${workspaceCliPath}"`;
        }
      }
      
      // 3. 設定から指定されたCLIパスを確認
      const config = vscode.workspace.getConfiguration('appgeniusAI');
      const configCliPath = config.get<string>('cliPath');
      
      if (configCliPath && fs.existsSync(configCliPath)) {
        return configCliPath;
      }
      
      // 4. グローバルにインストールされているか確認
      const platform = process.platform;
      const cliCommand = platform === 'win32' ? 'appgenius-cli.exe' : 'appgenius-cli';
      
      // CLIがインストールされているか確認
      const isCliInstalled = await this.isCliAvailable(cliCommand);
      
      if (isCliInstalled) {
        return cliCommand;
      }
      
      // 5. インストールされていない場合は、自動インストールを提案
      const installChoice = await vscode.window.showInformationMessage(
        'AppGenius CLIがインストールされていません。インストールしますか？',
        'インストール',
        'キャンセル'
      );
      
      if (installChoice === 'インストール') {
        await this.installCli();
        
        // インストール後、再度グローバルに利用可能か確認
        if (await this.isCliAvailable(cliCommand)) {
          return cliCommand;
        }
      }
      
      // それでも見つからない場合は、同梱されたバージョンに戻る
      if (fs.existsSync(bundledCliPath)) {
        return `node "${bundledCliPath}"`;
      }
      
      throw new Error('AppGenius CLIが見つかりませんでした。手動でnpm install -g appgenius-cliを実行してください。');
    } catch (error) {
      Logger.error('CLIパスの取得に失敗しました', error as Error);
      throw error;
    }
  }
  
  /**
   * CLIをインストール
   */
  private async installCli(): Promise<boolean> {
    try {
      // 拡張機能のパスを取得
      const extensionPath = vscode.extensions.getExtension('appgenius-ai.appgenius-ai')?.extensionPath || '';
      const cliPath = path.join(extensionPath, 'appgenius-cli');
      
      // ターミナルでインストールコマンドを実行
      const terminal = vscode.window.createTerminal({
        name: 'AppGenius CLI インストール'
      });
      
      terminal.show();
      
      // ローカルのCLIディレクトリからインストール
      terminal.sendText(`cd "${cliPath}" && npm install -g .`);
      terminal.sendText('echo "インストールが完了したらターミナルを閉じてください"');
      terminal.sendText('echo "* もしインストールに失敗した場合は、管理者権限が必要かもしれません *"');
      
      // インストール完了を待つ（ユーザーがターミナルを閉じるまで）
      return new Promise<boolean>((resolve) => {
        const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
          if (closedTerminal === terminal) {
            disposable.dispose();
            resolve(true);
          }
        });
      });
    } catch (error) {
      Logger.error('CLIのインストールに失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this.stopProgressMonitoring();
    
    if (this.cliProcess && !this.cliProcess.killed) {
      this.cliProcess.kill();
    }
  }
}