import * as vscode from 'vscode';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../AppGeniusEventBus';
import { MessageBroker, MessageType } from '../../utils/MessageBroker';
import { 
  ClaudeCodeExecutionStatus, 
  MockupAnalysisProcess,
  ScopeExecutionOptions,
  PromptExecutionOptions,
  MockupAnalysisOptions 
} from './LauncherTypes';
import { TerminalProvisionService } from './TerminalProvisionService';
import { AuthSyncManager } from './AuthSyncManager';
import { SpecializedLaunchHandlers } from './SpecializedLaunchHandlers';

/**
 * ClaudeCodeプロセス管理サービス - コア機能
 * 基本的な起動管理機能を提供し、実装の詳細は他のクラスに委譲
 */
export class CoreLauncherService {
  private static instance: CoreLauncherService;
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
  
  // 依存サービスとハンドラ
  private terminalService: TerminalProvisionService;
  private authManager: AuthSyncManager;
  private specializedHandlers: SpecializedLaunchHandlers;
  
  private constructor() {
    this.eventBus = AppGeniusEventBus.getInstance();
    this.terminalService = new TerminalProvisionService();
    this.authManager = new AuthSyncManager();
    this.specializedHandlers = new SpecializedLaunchHandlers(
      this.terminalService, 
      this.authManager,
      this.eventBus
    );
    
    // 拡張機能が起動するたびに状態をリセット（前回のセッションでRUNNINGのままだった場合の対策）
    this.status = ClaudeCodeExecutionStatus.IDLE;
    
    Logger.info('CoreLauncherService initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): CoreLauncherService {
    if (!CoreLauncherService.instance) {
      CoreLauncherService.instance = new CoreLauncherService();
    }
    return CoreLauncherService.instance;
  }
  
  /**
   * スコープ情報を基にClaudeCodeを起動
   * @param options スコープ実行オプション
   */
  public async launchClaudeCode(options: ScopeExecutionOptions): Promise<boolean> {
    try {
      // 起動カウンターイベントを発行
      Logger.info('【ClaudeCode起動カウンター】スコープベース起動のカウントイベントを発行します');
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
        { scope: options.scope },
        'CoreLauncherService'
      );
      Logger.info('【ClaudeCode起動カウンター】スコープベース起動のカウントイベントを発行しました');
      
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
      
      // スコープを使用してClaudeCodeを起動
      const result = await this.specializedHandlers.launchWithScope(options);
      
      if (result.success) {
        // 実行状態の更新
        this.status = ClaudeCodeExecutionStatus.RUNNING;
        this.projectPath = options.scope.projectPath;
        this.scopeFilePath = result.scopeFilePath || '';
        this.progressFilePath = result.progressFilePath || '';
        
        // 進捗監視の開始
        if (this.progressFilePath) {
          this.startProgressMonitoring();
        }
        
        return true;
      } else {
        // 失敗した場合
        this.status = ClaudeCodeExecutionStatus.FAILED;
        Logger.error('スコープを使用したClaudeCodeの起動に失敗しました', new Error(result.error || 'Unknown error'));
        return false;
      }
    } catch (error) {
      Logger.error('ClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      this.status = ClaudeCodeExecutionStatus.FAILED;
      return false;
    }
  }
  
  /**
   * モックアップを解析するためにClaudeCodeを起動
   * @param options モックアップ解析オプション
   */
  public async launchClaudeCodeWithMockup(options: MockupAnalysisOptions): Promise<boolean> {
    try {
      // 起動カウンターイベントを発行
      Logger.info('【ClaudeCode起動カウンター】モックアップ解析起動のカウントイベントを発行します');
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
        { mockupFilePath: options.mockupFilePath, projectPath: options.projectPath },
        'CoreLauncherService'
      );
      Logger.info('【ClaudeCode起動カウンター】モックアップ解析起動のカウントイベントを発行しました');
      
      const { mockupFilePath, projectPath, source } = options;
      
      // モックアップ解析プロセスの準備と起動
      const result = await this.specializedHandlers.launchWithMockup(options);
      
      if (result.success) {
        // プロセス情報をMap に追加
        if (result.processId && result.processInfo) {
          this.mockupProcesses.set(result.processId, result.processInfo);
          
          // 全体状態もRunningに設定
          this.status = ClaudeCodeExecutionStatus.RUNNING;
          
          // 現在のプロセス状態をログ出力
          const runningCount = this.getRunningMockupProcesses().length;
          Logger.info(`現在実行中のモックアップ解析プロセス数: ${runningCount}/${this.maxConcurrentProcesses}`);
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      Logger.error('モックアップ解析用ClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`モックアップ解析用ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 指定したプロンプトファイルを使用してClaudeCodeを起動
   * @param options プロンプト実行オプション
   */
  public async launchClaudeCodeWithPrompt(options: PromptExecutionOptions): Promise<boolean> {
    try {
      // 起動カウンターイベントを発行
      Logger.info('【ClaudeCode起動カウンター】プロンプト使用起動のカウントイベントを発行します');
      try {
        this.eventBus.emit(
          AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
          {
            projectPath: options.projectPath,
            promptFilePath: options.promptFilePath
          },
          'CoreLauncherService'
        );
        Logger.info('【ClaudeCode起動カウンター】プロンプト使用起動のカウントイベントを発行しました');
      } catch (eventError) {
        // イベント発行エラーはログに記録するが、処理は継続
        Logger.warn('【ClaudeCode起動カウンター】イベント発行エラー（処理は継続）', eventError as Error);
      }

      // プロンプトファイルを使用してClaudeCodeを起動
      let result: { success: boolean; error?: string; } = { success: false };

      try {
        result = await this.specializedHandlers.launchWithPrompt(options);
      } catch (launchError) {
        // 起動エラーをキャッチして適切に処理
        Logger.error('専用ハンドラーでの起動中にエラーが発生しました', launchError as Error);
        result = {
          success: false,
          error: `起動処理エラー: ${(launchError as Error).message}`
        };
      }

      if (result.success) {
        // 状態更新
        this.status = ClaudeCodeExecutionStatus.RUNNING;
        return true;
      } else {
        this.status = ClaudeCodeExecutionStatus.FAILED;
        const errorMessage = result.error || 'Unknown error';
        Logger.error('プロンプトを使用したClaudeCodeの起動に失敗しました', new Error(errorMessage));

        // UIにエラーメッセージを表示
        const serviceName = 'UIStateService';
        try {
          // エラーメッセージを表示するためのサービスを使用
          const uiStateService = require('../AppGeniusStateManager').AppGeniusStateManager.getInstance().getService(serviceName);
          if (uiStateService && typeof uiStateService.showErrorMessage === 'function') {
            uiStateService.showErrorMessage('ClaudeCodeの起動に失敗しました');
          } else {
            // 直接VSCodeのAPIを使用
            vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${errorMessage}`);
          }
        } catch (uiError) {
          // UIサービスが利用できない場合は直接VSCodeのAPIを使用
          Logger.warn('UIStateServiceが利用できないためVSCodeのAPIを使用します', uiError as Error);
          vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${errorMessage}`);
        }

        return false;
      }
    } catch (error) {
      Logger.error('プロンプトを使用したClaudeCodeの起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${(error as Error).message}`);
      this.status = ClaudeCodeExecutionStatus.FAILED;
      return false;
    }
  }

  /**
   * ClaudeCodeが利用可能かチェック
   */
  public async isClaudeCodeAvailable(): Promise<boolean> {
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
        'CoreLauncherService'
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
      this.progressWatcher = fs.watch(fs.existsSync(this.progressFilePath) ? 
        fs.realpathSync(path.dirname(this.progressFilePath)) : 
        path.dirname(this.progressFilePath), 
        (eventType, filename) => {
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
          'CoreLauncherService'
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
   * モックアップ解析プロセスの状態を更新
   */
  public updateMockupProcessStatus(processId: string, status: ClaudeCodeExecutionStatus): void {
    const processInfo = this.mockupProcesses.get(processId);
    if (processInfo) {
      processInfo.status = status;
      processInfo.terminal = null; // ターミナル参照を解放
      this.mockupProcesses.set(processId, processInfo);
      
      // アクティブなプロセスがなくなった場合、全体の状態も更新
      const anyRunning = this.getRunningMockupProcesses().length > 0;
      if (!anyRunning && status === ClaudeCodeExecutionStatus.COMPLETED) {
        this.status = ClaudeCodeExecutionStatus.IDLE;
      }
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

// path モジュールをインポート
import * as path from 'path';