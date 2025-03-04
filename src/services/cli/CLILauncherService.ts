import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../AppGeniusEventBus';
import { ImplementationScope, ImplementationItem } from '../AppGeniusStateManager';

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
      if (this.status === CLIExecutionStatus.RUNNING) {
        Logger.warn('CLIは既に実行中です');
        vscode.window.showWarningMessage('CLIは既に実行中です');
        return false;
      }
      
      // プロジェクトパスの確認
      this.projectPath = scope.projectPath;
      if (!fs.existsSync(this.projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${this.projectPath}`);
      }
      
      // スコープIDを生成
      const scopeId = `scope-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      // 一時ディレクトリのパスを取得（ユーザーホームの.appgeniusディレクトリ）
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const appGeniusDir = path.join(homeDir, '.appgenius');
      
      // ディレクトリ構造を作成
      const tempDir = path.join(appGeniusDir, 'temp');
      const progressDir = path.join(appGeniusDir, 'progress');
      
      for (const dir of [appGeniusDir, tempDir, progressDir]) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      
      // スコープデータ作成
      const scopeData = {
        id: scopeId,
        name: `Implementation Scope ${scopeId.substring(0, 8)}`,
        description: `Scope with ${scope.items.length} items`,
        projectPath: this.projectPath,
        requirements: scope.items.map(item => item.description),
        selectedItems: scope.items.filter(item => scope.selectedIds.includes(item.id)),
        estimatedTime: scope.estimatedTime,
        startDate: scope.startDate,
        targetDate: scope.targetDate
      };
      
      // スコープ情報の保存
      this.scopeFilePath = path.join(tempDir, `${scopeId}.json`);
      fs.writeFileSync(this.scopeFilePath, JSON.stringify(scopeData, null, 2), 'utf8');
      
      // 進捗ファイルパスの設定
      this.progressFilePath = path.join(progressDir, `${scopeId}.json`);
      
      // APIキーの取得
      const config = vscode.workspace.getConfiguration('appgeniusAI');
      const apiKey = config.get<string>('apiKey') || '';
      
      // 拡張機能のパスを取得
      const extensionPath = vscode.extensions.getExtension('appgenius-ai.appgenius-ai')?.extensionPath || '';
      
      // シェルスクリプトのパス
      const scriptPath = path.join(extensionPath, 'appgenius-cli', 'launch-appgenius.sh');
      
      // シェルスクリプトが存在するか確認
      if (!fs.existsSync(scriptPath)) {
        // シェルスクリプトが存在しない場合は、別の場所を探す
        Logger.warn(`シェルスクリプトが見つかりません: ${scriptPath}`);
        
        // プロジェクトルートを基準に探す
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let altScriptPath = '';
        
        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspacePath = workspaceFolders[0].uri.fsPath;
          altScriptPath = path.join(workspacePath, 'appgenius-cli', 'launch-appgenius.sh');
          Logger.debug(`ワークスペースのスクリプトパスを試行: ${altScriptPath}`);
          
          if (fs.existsSync(altScriptPath)) {
            Logger.info(`ワークスペースのシェルスクリプトを使用します: ${altScriptPath}`);
            
            // 見つかったスクリプトを使用
            const terminal = vscode.window.createTerminal({
              name: 'AppGenius CLI',
              cwd: this.projectPath,
              iconPath: vscode.Uri.file(path.join(extensionPath, 'media', 'icon.svg'))
            });
            
            terminal.show();
            // 引数を減らしてシンプルな形式で実行
            terminal.sendText(`API_KEY="${apiKey}" bash "${altScriptPath}" --scope="${this.scopeFilePath}" --project="${this.projectPath}"`);
            
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
            
            return true;
          }
        }
        
        // 代わりにCLIコマンドを直接実行
        return this.launchCliDirect(scopeData, apiKey);
      }
      
      // 拡張機能のアイコンを取得
      const iconPath = vscode.Uri.file(path.join(extensionPath, 'media', 'icon.svg'));
      
      // ターミナルの作成
      const terminal = vscode.window.createTerminal({
        name: 'AppGenius CLI',
        cwd: this.projectPath,
        iconPath
      });
      
      // ターミナルの表示
      terminal.show();
      
      // launch-appgenius.shを実行
      terminal.sendText(`API_KEY="${apiKey}" bash "${scriptPath}" --scope="${this.scopeFilePath}" --project="${this.projectPath}"`);
      
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
      
      return true;
    } catch (error) {
      Logger.error('CLIの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`CLIの起動に失敗しました: ${(error as Error).message}`);
      this.status = CLIExecutionStatus.FAILED;
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