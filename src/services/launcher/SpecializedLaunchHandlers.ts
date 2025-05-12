import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../AppGeniusEventBus';
import { ScopeExporter } from '../../utils/ScopeExporter';
import { PlatformManager } from '../../utils/PlatformManager';
import { MessageBroker, MessageType } from '../../utils/MessageBroker';
import { ProjectManagementService } from '../ProjectManagementService';
import {
  ClaudeCodeExecutionStatus,
  MockupAnalysisProcess,
  ScopeExecutionOptions,
  PromptExecutionOptions,
  MockupAnalysisOptions
} from './LauncherTypes';
import { TerminalProvisionService } from './TerminalProvisionService';
import { AuthSyncManager } from './AuthSyncManager';
import { SimpleAuthService } from '../../core/auth/SimpleAuthService';

/**
 * 各種アシスタント固有の起動ロジックを扱うクラス
 */
export class SpecializedLaunchHandlers {
  private terminalService: TerminalProvisionService;
  private authManager: AuthSyncManager;
  private eventBus: AppGeniusEventBus;
  private platformManager: PlatformManager;
  private scopeExporter: ScopeExporter;

  constructor(
    terminalService: TerminalProvisionService,
    authManager: AuthSyncManager,
    eventBus: AppGeniusEventBus
  ) {
    this.terminalService = terminalService;
    this.authManager = authManager;
    this.eventBus = eventBus;
    this.platformManager = PlatformManager.getInstance();
    this.scopeExporter = ScopeExporter.getInstance();
  }

  /**
   * 現在のユーザーIDを安全に取得する共通メソッド
   * グローバル変数からSimpleAuthServiceを取得してユーザーIDを返す
   * エラーハンドリングを強化し、詳細なログを出力
   */
  private async _getUserId(): Promise<string | null> {
    let userId = null;

    try {
      // 複数の方法でSimpleAuthServiceを取得を試みる

      // 方法1: グローバル変数からSimpleAuthServiceインスタンスを取得
      let authService = global._appgenius_simple_auth_service as SimpleAuthService | undefined;

      // グローバル変数のSimpleAuthService存在確認をログに出力
      Logger.debug(`【認証情報確認】グローバル変数authServiceインスタンス: ${authService ? '存在します' : '存在しません'}`);

      // グローバル変数に存在しない場合は直接インポートを試みる
      if (!authService) {
        try {
          // 方法2: インポートしてシングルトンインスタンスを取得
          authService = SimpleAuthService.getInstance();
          Logger.debug('【認証情報確認】直接インポートからSimpleAuthServiceインスタンスを取得しました');
        } catch (importError) {
          Logger.warn(`【認証情報確認】SimpleAuthServiceインポートエラー: ${(importError as Error).message}`);

          // 方法3: requireを使用したバックアップ方法
          try {
            const SimpleAuthServiceClass = require('../../core/auth/SimpleAuthService').SimpleAuthService;
            authService = SimpleAuthServiceClass.getInstance();
            Logger.debug('【認証情報確認】require()を使用してSimpleAuthServiceインスタンスを取得しました');
          } catch (requireError) {
            Logger.warn(`【認証情報確認】require()を使用したSimpleAuthService取得エラー: ${(requireError as Error).message}`);
          }
        }
      }

      // 認証サービスが取得できた場合、ユーザー情報を取得
      if (authService) {
        try {
          // isAuthenticatedの確認を先に行う
          const isAuthenticated = authService.isAuthenticated();
          Logger.debug(`【認証情報確認】認証状態: ${isAuthenticated ? '認証済み' : '未認証'}`);

          if (isAuthenticated) {
            // 現在のユーザー情報を取得
            const currentUser = authService.getCurrentUser();

            // ユーザー情報の詳細をデバッグログに出力（センシティブ情報は除く）
            if (currentUser) {
              Logger.debug(`【認証情報確認】ユーザー: ${currentUser.name || 'unknown'}, ID: ${currentUser.id || 'unknown'}`);
              userId = currentUser.id || null;
            } else {
              Logger.warn('【認証情報確認】認証済みですがユーザー情報がnullです');
            }
          } else {
            Logger.warn('【認証情報確認】未認証状態のためユーザーIDを取得できません');
          }
        } catch (getUserError) {
          Logger.warn(`【認証情報確認】ユーザー情報取得エラー: ${(getUserError as Error).message}`);
        }
      } else {
        Logger.warn('【認証情報確認】SimpleAuthServiceインスタンスを取得できませんでした');
      }
    } catch (error) {
      // 最上位のエラーハンドリング
      Logger.error(`【認証情報確認】ユーザーID取得中に予期せぬエラー: ${(error as Error).message}`);
    }

    // 取得結果をログに出力
    Logger.info(`【ClaudeCode起動カウンター】ユーザーIDを取得しました: ${userId ? '成功' : '失敗'}`);

    return userId;
  }
  
  /**
   * スコープベースでClaudeCodeを起動
   * @param options スコープ起動オプション
   */
  public async launchWithScope(
    options: ScopeExecutionOptions
  ): Promise<{ 
    success: boolean; 
    error?: string;
    scopeFilePath?: string;
    progressFilePath?: string;
  }> {
    try {
      const { scope } = options;
      
      // 元のプロジェクトパスを保存
      const requestedProjectPath = scope.projectPath;
      
      // ProjectServiceImplから最新のプロジェクトパスを取得
      try {
        // ProjectServiceImplの代わりにProjectManagementServiceを使用
        const projectManagementService = ProjectManagementService.getInstance();
        // アクティブプロジェクト情報を取得
        const activeProject = projectManagementService.getActiveProject();
        // プロジェクトサービスとして使用できる最小限のインターフェースを提供
        const projectService = {
          getActiveProjectPath: () => activeProject?.path || ''
        };
        // 最新のアクティブプロジェクトパスを取得
        const activeProjectPath = projectService.getActiveProjectPath();
        
        // activeProjectPathが有効な場合は優先して使用
        if (activeProjectPath) {
          Logger.info(`ProjectServiceImplからアクティブプロジェクトパスを取得: ${activeProjectPath}`);
          // 引数で渡されたパスよりも優先して使用
          scope.projectPath = activeProjectPath;
        }
      } catch (error) {
        // ProjectServiceImplからの取得に失敗した場合は警告を出して引数のパスを使用
        Logger.warn(`ProjectServiceImplからのパス取得に失敗したため、引数のパスを使用: ${requestedProjectPath}`, error as Error);
      }
      
      // プロジェクトパスの確認
      if (!fs.existsSync(scope.projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${scope.projectPath}`);
      }
      
      // CLAUDE.mdファイルパスを取得
      const claudeMdPath = path.join(scope.projectPath, 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        throw new Error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
      }
      
      // スコープID（CLAUDE.md内で使用）
      const scopeId = scope.id || `scope-${Date.now()}`;
      
      // スコープ情報もJSONとして保存（バックアップと既存システムとの互換性のため）
      const scopeFilePath = this.scopeExporter.exportScope(scope);
      
      // 進捗ファイルパスの設定
      const progressFilePath = path.join(this.platformManager.getTempDirectory('progress'), `${scopeId}.json`);
      
      Logger.info(`スコープ情報を保存しました: ${scopeFilePath}`);
      
      // 認証サービスの初期化（グローバルからExtensionContextを取得して渡す）
      const context = (global as any).__extensionContext;
      await this.authManager.initAuthServices(context);
      
      // APIキー検証をスキップ
      Logger.info('APIキーの検証をスキップします（開発モード）');
      
      // ターミナルの作成
      const terminal = await this.terminalService.createConfiguredTerminal({
        title: 'ClaudeCode',
        cwd: scope.projectPath
      });
      
      // AppGenius専用の認証情報を保存・同期
      try {
        await this.authManager.syncTokensToAppGeniusAuth();
      } catch (syncError) {
        // 同期エラーの情報を詳細に表示
        Logger.error('認証情報の同期に失敗しました', syncError as Error);
        
        // ターミナルを閉じる（nullチェック追加）
        if (terminal) {
          terminal.dispose();
        }
        
        // ユーザーに通知
        await vscode.window.showErrorMessage(
          `ClaudeCode起動エラー: 認証情報の同期に失敗しました`,
          { modal: true, detail: (syncError as Error).message }
        );
        
        throw new Error(`認証情報の同期に失敗しました: ${(syncError as Error).message}`);
      }
      
      // AppGenius専用の認証ファイルパスを取得
      const appGeniusAuthFilePath = this.authManager.getAppGeniusAuthFilePath();
      
      // AppGeniusの認証情報を使用するよう環境変数を設定（nullチェック追加）
      if (terminal) {
        this.terminalService.setupAuthEnvironment(terminal, appGeniusAuthFilePath);
      } else {
        Logger.warn('ターミナルオブジェクトがnullのため認証環境変数を設定できません');
      }
      
      // コマンド設定
      let baseCommand = 'claude';
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedClaudeMdPath = this.terminalService.escapeFilePath(claudeMdPath);
      
      // スコープIDが存在する場合はスコープを指定して起動
      let command: string;
      
      if (scope.id) {
        // スコープIDをエスケープする必要はないが、念のため
        const escapedScopeId = scope.id.replace(/ /g, '\\ ');
        // スコープIDを含むコマンドを生成
        command = this.terminalService.buildCommandWithAutoResponse(
          baseCommand,
          `--scope=${escapedScopeId} ${escapedClaudeMdPath}`
        );
      } else {
        // スコープIDなしのコマンドを生成
        command = this.terminalService.buildCommandWithAutoResponse(baseCommand, escapedClaudeMdPath);
      }
      
      // コマンド実行
      terminal.sendText(command);
      Logger.info(`ClaudeCode起動コマンド（AppGenius認証使用・自動応答と日本語指示付き）: ${command}`);
      
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
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          scopeId,
          projectPath: scope.projectPath,
          scopeFilePath: scopeFilePath,
          progressFilePath: progressFilePath
        },
        'SpecializedLaunchHandlers'
      );
      
      // カウンターイベントを発行
      try {
        Logger.info('【ClaudeCode起動カウンター】スコープ実行時のカウントイベントを発行します');

        // 共通関数を使ってユーザーIDを取得
        const userId = await this._getUserId();

        // ユーザーIDが取得できた場合のみイベントを発行（取得できなくてもエラーにはしない）
        if (userId) {
          this.eventBus.emit(
            AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
            {
              scopeId,
              userId: userId // 重要: ユーザーIDをイベントデータに含める
              // センシティブな情報は含めない
            },
            'SpecializedLaunchHandlers'
          );
          Logger.info(`【ClaudeCode起動カウンター】スコープ実行時のカウントイベントを発行しました`);
        } else {
          Logger.info('【ClaudeCode起動カウンター】有効なユーザーIDがないため、カウントをスキップします');
          // ここでreturnしないように修正（処理は続行）
        }
      } catch (error) {
        // エラーをログに記録するだけで、プロセス全体は中断しない
        Logger.error(`【ClaudeCode起動カウンター】スコープ実行時のイベント発行エラー: ${(error as Error).message}`, error as Error);
        // エラーが発生してもプロセスは続行
      }
      
      // 成功結果を返す
      return {
        success: true,
        scopeFilePath,
        progressFilePath
      };
    } catch (error) {
      Logger.error('スコープ起動に失敗しました', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * モックアップ解析用にClaudeCodeを起動
   */
  public async launchWithMockup(
    options: MockupAnalysisOptions
  ): Promise<{
    success: boolean;
    error?: string;
    processId?: string;
    processInfo?: MockupAnalysisProcess;
  }> {
    try {
      const { mockupFilePath, projectPath: requestedProjectPath, source } = options;
      
      // ProjectServiceImplから最新のプロジェクトパスを取得
      let projectPath = requestedProjectPath;
      try {
        // ProjectServiceImplの代わりにProjectManagementServiceを使用
        const projectManagementService = ProjectManagementService.getInstance();
        // アクティブプロジェクト情報を取得
        const activeProject = projectManagementService.getActiveProject();
        // プロジェクトサービスとして使用できる最小限のインターフェースを提供
        const projectService = {
          getActiveProjectPath: () => activeProject?.path || ''
        };
        // 最新のアクティブプロジェクトパスを取得
        const activeProjectPath = projectService.getActiveProjectPath();
        
        // activeProjectPathが有効な場合は優先して使用
        if (activeProjectPath) {
          Logger.info(`ProjectServiceImplからアクティブプロジェクトパスを取得: ${activeProjectPath}`);
          // 引数で渡されたパスよりも優先して使用
          projectPath = activeProjectPath;
        }
      } catch (error) {
        // ProjectServiceImplからの取得に失敗した場合は警告を出して引数のパスを使用
        Logger.warn(`ProjectServiceImplからのパス取得に失敗したため、引数のパスを使用: ${requestedProjectPath}`, error as Error);
      }
      
      // モックアップファイル情報を準備
      const absoluteMockupPath = path.isAbsolute(mockupFilePath) ? 
        mockupFilePath : path.join(projectPath, mockupFilePath);
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
      
      // 新しいプロセスを作成
      const analysisFilePath = await this._prepareAnalysisFile(mockupName, absoluteMockupPath, projectPath, source);
      
      // プロセス情報を作成
      const processInfo: MockupAnalysisProcess = {
        id: processId,
        mockupName,
        mockupPath: absoluteMockupPath,
        projectPath,
        analysisFilePath,
        terminal: null,
        status: ClaudeCodeExecutionStatus.IDLE,
        startTime: Date.now()
      };
      
      // ターミナル起動
      const result = await this._startMockupAnalysisTerminal(processInfo);
      
      if (result.success) {
        return {
          success: true,
          processId,
          processInfo: {
            ...processInfo,
            terminal: result.terminal || null,
            status: ClaudeCodeExecutionStatus.RUNNING
          }
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      Logger.error('モックアップ解析用ClaudeCodeの起動に失敗しました', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * プロンプトを使用してClaudeCodeを起動
   */
  public async launchWithPrompt(
    options: PromptExecutionOptions
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { 
        promptFilePath, 
        projectPath: requestedProjectPath, 
        additionalParams, 
        deletePromptFile,
        ...terminalOptions 
      } = options;
      
      // ProjectServiceImplから最新のプロジェクトパスを取得
      let projectPath = requestedProjectPath;
      try {
        // ProjectServiceImplの代わりにProjectManagementServiceを使用
        const projectManagementService = ProjectManagementService.getInstance();
        // アクティブプロジェクト情報を取得
        const activeProject = projectManagementService.getActiveProject();
        // プロジェクトサービスとして使用できる最小限のインターフェースを提供
        const projectService = {
          getActiveProjectPath: () => activeProject?.path || ''
        };
        // 最新のアクティブプロジェクトパスを取得
        const activeProjectPath = projectService.getActiveProjectPath();
        
        // activeProjectPathが有効な場合は優先して使用
        if (activeProjectPath) {
          Logger.info(`ProjectServiceImplからアクティブプロジェクトパスを取得: ${activeProjectPath}`);
          // 引数で渡されたパスよりも優先して使用
          projectPath = activeProjectPath;
        }
      } catch (error) {
        // ProjectServiceImplからの取得に失敗した場合は警告を出して引数のパスを使用
        Logger.warn(`ProjectServiceImplからのパス取得に失敗したため、引数のパスを使用: ${requestedProjectPath}`, error as Error);
      }
      
      // プロジェクトパスの確認
      if (!fs.existsSync(projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${projectPath}`);
      }
      
      // プロンプトファイルの確認
      if (!fs.existsSync(promptFilePath)) {
        throw new Error(`プロンプトファイルが見つかりません: ${promptFilePath}`);
      }
      
      // 認証サービスの初期化（グローバルからExtensionContextを取得して渡す）
      const context = (global as any).__extensionContext;
      await this.authManager.initAuthServices(context);
      
      // APIキー検証をスキップ
      Logger.info('APIキーの検証をスキップします（開発モード）');
      
      // デバッグ: 全オプションを出力
      Logger.debug(`launchWithPrompt全オプション: ${JSON.stringify(options)}`);
      
      // プロンプトタイプが指定されている場合はログに出力
      if (options.promptType) {
        Logger.info(`プロンプトタイプが指定されています: ${options.promptType}`);
      } else {
        Logger.warn('プロンプトタイプが指定されていません。デフォルトのタイトル「ClaudeCode」を使用します。');
      }

      // ターミナル分割オプションが指定されているかをログに出力
      if (options.splitTerminal) {
        Logger.info(`ターミナル分割オプションが有効です: ${options.splitTerminal}`);
      }
      
      // ターミナルの作成
      Logger.debug(`渡されたterminalOptions: ${JSON.stringify(terminalOptions)}`);
      
      // terminalOptionsはoptions内の...terminalOptionsスプレッド構文で渡されたプロパティのみを含む
      // titleとcwdはterminalOptionsとは別途明示的に指定する必要がある
      // terminalTitleはTerminalProvisionServiceで自動生成されるので、
      // title自体を渡す必要はない（promptTypeが正しく渡されていれば十分）
      const terminal = await this.terminalService.createConfiguredTerminal({
        cwd: projectPath,
        ...terminalOptions
      });
      
      // 作成後のターミナル情報を確認（nullチェック追加）
      Logger.debug(`作成されたターミナル: ${terminal && terminal.name ? terminal.name : 'name未設定'}`);
      
      // AppGenius専用の認証情報を保存・同期
      try {
        await this.authManager.syncTokensToAppGeniusAuth();
      } catch (syncError) {
        // 同期エラーの情報を詳細に表示
        Logger.error('認証情報の同期に失敗しました', syncError as Error);
        
        // ターミナルを閉じる（nullチェック追加）
        if (terminal) {
          terminal.dispose();
        }
        
        // ユーザーに通知
        await vscode.window.showErrorMessage(
          `プロンプト実行エラー: 認証情報の同期に失敗しました`,
          { modal: true, detail: (syncError as Error).message }
        );
        
        throw new Error(`認証情報の同期に失敗しました: ${(syncError as Error).message}`);
      }
      
      // AppGenius専用の認証ファイルパスを取得し、環境変数に設定
      const appGeniusAuthFilePath = this.authManager.getAppGeniusAuthFilePath();
      this.terminalService.setupAuthEnvironment(terminal, appGeniusAuthFilePath);
      
      // コマンド設定
      let baseCommand = 'claude';
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedPromptFilePath = this.terminalService.escapeFilePath(promptFilePath);
      
      // コマンドを生成して実行
      const command = this.terminalService.buildCommandWithAutoResponse(
        baseCommand, 
        escapedPromptFilePath, 
        additionalParams
      );
      // nullチェックを追加
      if (terminal) {
        terminal.sendText(command);
        Logger.info(`ClaudeCode起動コマンド（AppGenius認証使用・自動応答と日本語指示付き）: ${command}`);
      } else {
        Logger.error('ターミナルオブジェクトがnullのためコマンドを送信できません');
        throw new Error('ターミナルオブジェクトがnullです');
      }
      
      // コマンド実行時にも確実にカウンターイベントを発行
      try {
        Logger.info('【ClaudeCode起動カウンター】コマンド実行時のカウントイベントを発行します');

        // 共通関数を使ってユーザーIDを取得
        const userId = await this._getUserId();

        // ユーザーIDが取得できた場合のみイベントを発行（取得できなくてもエラーにはしない）
        if (userId) {
          this.eventBus.emit(
            AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
            {
              userId: userId, // 重要: ユーザーIDをイベントデータに含める
              // センシティブな情報は含めない
            },
            'SpecializedLaunchHandlers'
          );
          Logger.info(`【ClaudeCode起動カウンター】コマンド実行時のカウントイベントを発行しました`);
        } else {
          Logger.info('【ClaudeCode起動カウンター】有効なユーザーIDがないため、カウントをスキップします');
          // ユーザーIDが取得できなくても処理を続行します
        }
      } catch (error) {
        // エラーをログに記録するだけで、プロセス全体は中断しない
        Logger.error(`【ClaudeCode起動カウンター】コマンド実行時のイベント発行エラー: ${(error as Error).message}`, error as Error);
        // エラーが発生してもプロセスは続行
      }
      
      // プロンプトファイルを即時削除（セキュリティ対策）
      if (deletePromptFile && terminal) {
        this._schedulePromptFileDeletion(promptFilePath, terminal);
      } else if (deletePromptFile) {
        Logger.warn('ターミナルオブジェクトがnullのためプロンプトファイル削除スケジュールを設定できません');
        // ターミナルがなくてもファイルは削除する試み
        try {
          setTimeout(() => {
            if (fs.existsSync(promptFilePath)) {
              fs.unlinkSync(promptFilePath);
              Logger.info(`プロンプトファイルを削除しました: ${promptFilePath}`);
            }
          }, 30000);
        } catch (error) {
          Logger.error(`プロンプトファイルの削除に失敗しました: ${error}`);
        }
      }
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          projectPath: projectPath,
          promptFilePath: promptFilePath,
          additionalParams: additionalParams,
          splitTerminal: options.splitTerminal
        },
        'SpecializedLaunchHandlers'
      );
      
      return { success: true };
    } catch (error) {
      Logger.error('プロンプトを使用したClaudeCodeの起動に失敗しました', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * モックアップ解析用のMDファイルを準備
   */
  private async _prepareAnalysisFile(
    mockupName: string, 
    mockupFilePath: string, 
    projectPath: string,
    source?: string
  ): Promise<string> {
    // テンプレートファイルのパスを取得
    const templatePath = path.join(projectPath, 'docs/mockup_analysis_template.md');
    if (!fs.existsSync(templatePath)) {
      Logger.warn('モックアップ解析テンプレートが見つかりません。デフォルトテンプレートを使用します。');
    }
    
    // テンポラリディレクトリを取得
    const tempDir = this.platformManager.getTempDirectory('mockup-analysis');
    
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
      const sourceInfo = source || 'unknown';
      Logger.info(`起動ソース: ${sourceInfo}`);
      
      analysisContent = analysisContent
        .replace(/{{MOCKUP_PATH}}/g, mockupFilePath)
        .replace(/{{PROJECT_PATH}}/g, projectPath)
        .replace(/{{MOCKUP_NAME}}/g, mockupName)
        .replace(/{{SOURCE}}/g, sourceInfo);
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
  private async _startMockupAnalysisTerminal(
    processInfo: MockupAnalysisProcess
  ): Promise<{
    success: boolean;
    terminal?: vscode.Terminal;
    error?: string;
  }> {
    try {
      // 認証サービスの初期化（グローバルからExtensionContextを取得して渡す）
      const context = (global as any).__extensionContext;
      await this.authManager.initAuthServices(context);
      
      // APIキー検証をスキップ
      Logger.info('APIキーの検証をスキップします（開発モード）');
      
      // ProjectServiceImplから最新のプロジェクトパスを取得
      let projectPath = processInfo.projectPath;
      try {
        // ProjectServiceImplの代わりにProjectManagementServiceを使用
        const projectManagementService = ProjectManagementService.getInstance();
        // アクティブプロジェクト情報を取得
        const activeProject = projectManagementService.getActiveProject();
        // プロジェクトサービスとして使用できる最小限のインターフェースを提供
        const projectService = {
          getActiveProjectPath: () => activeProject?.path || ''
        };
        // 最新のアクティブプロジェクトパスを取得
        const activeProjectPath = projectService.getActiveProjectPath();
        
        // activeProjectPathが有効な場合は優先して使用
        if (activeProjectPath) {
          Logger.info(`ProjectServiceImplからアクティブプロジェクトパスを取得: ${activeProjectPath}`);
          // processInfoのパスを更新
          processInfo.projectPath = activeProjectPath;
          projectPath = activeProjectPath;
        }
      } catch (error) {
        // ProjectServiceImplからの取得に失敗した場合は警告を出して元のパスを使用
        Logger.warn(`ProjectServiceImplからのパス取得に失敗したため、元のパスを使用: ${processInfo.projectPath}`, error as Error);
      }
      
      // ターミナルの作成
      const terminal = await this.terminalService.createConfiguredTerminal({
        title: `ClaudeCode - ${processInfo.mockupName}の解析`,
        cwd: projectPath
      });
      
      // AppGenius専用の認証情報を保存・同期
      try {
        await this.authManager.syncTokensToAppGeniusAuth();
      } catch (syncError) {
        // 同期エラーの情報を詳細に表示
        Logger.error('認証情報の同期に失敗しました', syncError as Error);
        
        // ターミナルを閉じる（nullチェック追加）
        if (terminal) {
          terminal.dispose();
        }
        
        // ユーザーに通知
        await vscode.window.showErrorMessage(
          `モックアップ解析エラー: 認証情報の同期に失敗しました`,
          { modal: true, detail: (syncError as Error).message }
        );
        
        throw new Error(`認証情報の同期に失敗しました: ${(syncError as Error).message}`);
      }
      
      // AppGenius専用の認証ファイルパスを取得し、環境変数に設定
      const appGeniusAuthFilePath = this.authManager.getAppGeniusAuthFilePath();
      this.terminalService.setupAuthEnvironment(terminal, appGeniusAuthFilePath);
      
      // コマンド設定
      const baseCommand = 'claude';
      
      // ファイルパスをエスケープ（スペースを含む場合）
      const escapedAnalysisFilePath = this.terminalService.escapeFilePath(processInfo.analysisFilePath);
      
      // コマンドを生成して実行
      const command = this.terminalService.buildCommandWithAutoResponse(baseCommand, escapedAnalysisFilePath);
      terminal.sendText(command);
      
      Logger.info(`モックアップ解析用ClaudeCode起動コマンド（分離認証モード）（自動応答と日本語指示付き）: ${command}`);
      
      // ターミナル終了イベントの監視を設定
      this._watchTerminalClose(terminal, processInfo.id);
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_STARTED,
        { 
          processId: processInfo.id,
          mockupName: processInfo.mockupName,
          mockupFilePath: processInfo.mockupPath,
          projectPath: processInfo.projectPath,
          analysisFilePath: processInfo.analysisFilePath
        },
        'SpecializedLaunchHandlers'
      );
      
      // カウンターイベントを発行
      try {
        Logger.info('【ClaudeCode起動カウンター】モックアップ解析時のカウントイベントを発行します');

        // 共通関数を使ってユーザーIDを取得
        const userId = await this._getUserId();

        // ユーザーIDが取得できた場合のみイベントを発行（取得できなくてもエラーにはしない）
        if (userId) {
          this.eventBus.emit(
            AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
            {
              processId: processInfo.id,
              userId: userId // 重要: ユーザーIDをイベントデータに含める
              // センシティブな情報は含めない
            },
            'SpecializedLaunchHandlers'
          );
          Logger.info(`【ClaudeCode起動カウンター】モックアップ解析時のカウントイベントを発行しました`);
        } else {
          Logger.info('【ClaudeCode起動カウンター】有効なユーザーIDがないため、カウントをスキップします');
          // ここでreturnしないように修正（処理は続行）
        }
      } catch (error) {
        // エラーをログに記録するだけで、プロセス全体は中断しない
        Logger.error(`【ClaudeCode起動カウンター】モックアップ解析時のイベント発行エラー: ${(error as Error).message}`, error as Error);
        // エラーが発生してもプロセスは続行
      }
      
      return {
        success: true,
        terminal
      };
    } catch (error) {
      Logger.error(`モックアップ解析ターミナルの起動に失敗しました: ${processInfo.id}`, error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * プロンプトファイルの削除をスケジュール
   */
  private _schedulePromptFileDeletion(promptFilePath: string, terminal: vscode.Terminal): void {
    try {
      // nullチェックを追加
      if (!terminal) {
        Logger.warn('ターミナルオブジェクトがnullのためプロンプトファイル削除スケジュールを設定できません');
        return;
      }

      // Windowsでは使用中のファイルは削除できないため、Linuxとmacのみ遅延削除
      if (process.platform !== 'win32') {
        setTimeout(() => {
          if (fs.existsSync(promptFilePath)) {
            fs.unlinkSync(promptFilePath);
            // プロンプトファイル削除完了（ログを記録）
            Logger.debug(`プロンプトファイルを30秒後に削除しました: ${promptFilePath}`);
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
                // プロンプトファイル削除完了（ターミナル終了時）（ログを記録）
                Logger.debug(`ターミナル終了後にプロンプトファイルを削除しました: ${promptFilePath}`);
              }
            } catch (unlinkError) {
              Logger.error(`ファイル削除エラー（ターミナル終了時）: ${unlinkError}`);
            }
          }, 500);
          disposable.dispose(); // リスナーの破棄
        }
      });
    } catch (error) {
      Logger.warn(`プロンプトファイルの即時削除のスケジュールに失敗しました: ${error}`);
    }
  }
  
  /**
   * ターミナル終了イベントを監視
   */
  private _watchTerminalClose(terminal: vscode.Terminal, processId: string): void {
    // ターミナルクローズ監視のdisposableを保持する必要はない（VSCodeの寿命内）
    vscode.window.onDidCloseTerminal(closedTerminal => {
      if (closedTerminal === terminal) {
        // プロセス完了イベントを発火
        this.eventBus.emit(
          AppGeniusEventType.CLAUDE_CODE_COMPLETED,
          { 
            processId,
            status: ClaudeCodeExecutionStatus.COMPLETED
          },
          'SpecializedLaunchHandlers'
        );
        
        Logger.info(`モックアップ解析プロセスのターミナルが閉じられました: ${processId}`);
      }
    });
  }
}