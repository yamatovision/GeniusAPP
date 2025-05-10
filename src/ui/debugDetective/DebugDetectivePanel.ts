import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';
import { ErrorSessionManager } from './ErrorSessionManager';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';
import { ProtectedPanel } from '../auth/ProtectedPanel';
import { Feature } from '../../core/auth/roles';

/**
 * デバッグ探偵パネル
 * エラー検出と解決を支援するシャーロックホームズ風デバッグアシスタント
 * 権限保護されたパネルの基底クラスを継承
 */
export class DebugDetectivePanel extends ProtectedPanel {
  public static currentPanel: DebugDetectivePanel | undefined;
  private static readonly viewType = 'debugDetective';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.DEBUG_DETECTIVE;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _eventBus: AppGeniusEventBus;
  private readonly _errorSessionManager: ErrorSessionManager;
  private readonly _knowledgeBaseManager: KnowledgeBaseManager;
  private readonly _claudeCodeLauncher: ClaudeCodeLauncherService;
  private _disposables: vscode.Disposable[] = [];

  // 作業状態
  private _projectPath: string = '';
  private _currentProjectId: string = '';  // プロジェクトID追加
  private _currentErrorSession: any = null;
  private _relatedFiles: string[] = [];
  private _detectedErrorType: string = '';

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  protected static _createOrShowPanel(extensionUri: vscode.Uri, projectPath: string, projectId?: string): DebugDetectivePanel {
    try {
      Logger.info(`デバッグ探偵パネル作成開始: projectPath=${projectPath}, projectId=${projectId || 'なし'}`);
      
      // プロジェクトパスのチェック
      if (!projectPath || projectPath.trim() === '') {
        Logger.error('プロジェクトパスが指定されていません');
        vscode.window.showErrorMessage('プロジェクトパスが指定されていません。プロジェクトを選択してください。');
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // 注意：中央サーバーのプロンプトURLを使用するため、ローカルファイルの存在チェックは警告のみ
      const debugPromptPath = path.join(projectPath, 'docs', 'prompts', 'debug_detective.md');
      if (!fs.existsSync(debugPromptPath)) {
        Logger.warn(`ローカルデバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
        // 警告メッセージは表示しない（中央サーバーのプロンプトを使用するため）
      }
      
      const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
  
      // すでにパネルが存在する場合は、それを表示
      if (DebugDetectivePanel.currentPanel) {
        Logger.info('既存のデバッグ探偵パネルを再表示します');
        DebugDetectivePanel.currentPanel._panel.reveal(column);
        
        // プロジェクトパスが変わっていれば更新
        if (projectPath && DebugDetectivePanel.currentPanel._projectPath !== projectPath) {
          Logger.info(`プロジェクトパスを更新します: ${projectPath}`);
          DebugDetectivePanel.currentPanel._projectPath = projectPath;
          DebugDetectivePanel.currentPanel._update();
        }
        
        return DebugDetectivePanel.currentPanel;
      }
  
      Logger.info('新しいデバッグ探偵パネルを作成します');
      
      // 新しいパネルを作成
      const panel = vscode.window.createWebviewPanel(
        DebugDetectivePanel.viewType,
        'デバッグ探偵 - シャーロックホームズ',
        column || vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'dist')
          ],
          enableFindWidget: true,
          enableCommandUris: true
        }
      );
  
      Logger.info('デバッグ探偵インスタンスを初期化します');
      try {
        // 親クラスのコンストラクタを呼び出しながらインスタンス化
        DebugDetectivePanel.currentPanel = new DebugDetectivePanel(panel, extensionUri, projectPath, projectId);
        Logger.info('デバッグ探偵パネル作成完了');
        return DebugDetectivePanel.currentPanel;
      } catch (error) {
        // パネルの初期化に失敗した場合、パネルを破棄
        panel.dispose();
        Logger.error('デバッグ探偵インスタンスの初期化に失敗しました', error as Error);
        throw error;
      }
    } catch (error) {
      Logger.error('デバッグ探偵パネル作成エラー', error as Error);
      Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
      vscode.window.showErrorMessage(`デバッグ探偵パネルの作成に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 外部向けのパネル作成・表示メソッド
   * 権限チェック付きで、パネルを表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, projectPath: string, projectId?: string): DebugDetectivePanel | undefined {
    // 権限チェック
    if (!this.checkPermissionForFeature(Feature.DEBUG_DETECTIVE, 'DebugDetectivePanel')) {
      return undefined;
    }
    
    // 権限があれば表示
    return this._createOrShowPanel(extensionUri, projectPath, projectId);
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, projectPath: string, projectId?: string) {
    super(); // 親クラスのコンストラクタを呼び出し
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._projectPath = projectPath;
    this._currentProjectId = projectId || '';
    
    // サービスの初期化
    this._eventBus = AppGeniusEventBus.getInstance();
    this._errorSessionManager = new ErrorSessionManager(projectPath);
    this._knowledgeBaseManager = new KnowledgeBaseManager(projectPath);
    this._claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
    
    // 初期化処理
    this._initializeDebugDetective();
    
    // WebViewの内容を設定
    this._update();

    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'investigateError':
            await this._handleInvestigateError(message.errorLog);
            break;
          case 'getErrorSessions':
            await this._handleGetErrorSessions();
            break;
          case 'saveTerminalOutput':
            await this._handleSaveTerminalOutput();
            break;
          case 'detectErrorType':
            await this._handleDetectErrorType(message.errorLog);
            break;
        }
      },
      null,
      this._disposables
    );
    
    // プロジェクトパス更新イベントをリッスン
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.PROJECT_PATH_UPDATED, async (event) => {
        if (event.data && this._currentProjectId && event.projectId === this._currentProjectId) {
          const newPath = event.data.projectPath;
          Logger.info(`プロジェクトパスが更新されました: ${newPath}`);
          
          // パスが実際に変更された場合のみ更新処理
          if (newPath && this._projectPath !== newPath) {
            Logger.debug(`デバッグ探偵パネルのプロジェクトパスを更新: ${this._projectPath} → ${newPath}`);
            this._projectPath = newPath;
            
            // 各マネージャーのパスも更新
            this._errorSessionManager.updateProjectPath(newPath);
            this._knowledgeBaseManager.updateProjectPath(newPath);
            
            // UIを更新
            this._update();
          }
        }
      })
    );
  }

  /**
   * デバッグ探偵初期化
   */
  private async _initializeDebugDetective(): Promise<void> {
    try {
      Logger.info(`デバッグ探偵の初期化を開始します。プロジェクトパス: ${this._projectPath}`);
      
      // プロジェクトパスの検証
      if (!this._projectPath || this._projectPath.trim() === '') {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      Logger.info('ログディレクトリの作成を開始します');
      // ログディレクトリの作成
      await this._ensureDebugDirectories();
      
      Logger.info('エラーセッションマネージャーの初期化を開始します');
      // エラーセッション初期化
      await this._errorSessionManager.initialize();
      
      Logger.info('知見ベースマネージャーの初期化を開始します');
      // 知見ベース初期化
      await this._knowledgeBaseManager.initialize();
      
      // デバッグプロンプトファイルの存在を確認（フォールバック用）
      const debugPromptPath = path.join(this._projectPath, 'docs', 'prompts', 'debug_detective.md');
      Logger.info(`ローカルデバッグプロンプトファイルをチェックします（フォールバック用）: ${debugPromptPath}`);
      if (!fs.existsSync(debugPromptPath)) {
        Logger.warn(`ローカルデバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
        // 警告メッセージは表示しない（中央サーバーのプロンプトを使用するため）
      } else {
        Logger.info(`ローカルデバッグプロンプトファイルを確認しました（フォールバック用）: ${debugPromptPath}`);
      }
      
      // 中央サーバーのデバッグ探偵プロンプトURLをチェック
      Logger.info(`中央サーバーのデバッグ探偵プロンプトURLを使用します: https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09`);
      
      
      Logger.info(`デバッグ探偵を初期化しました。プロジェクトパス: ${this._projectPath}`);
    } catch (error) {
      Logger.error('デバッグ探偵初期化エラー', error as Error);
      Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
      vscode.window.showErrorMessage(`デバッグ探偵の初期化に失敗しました: ${(error as Error).message}`);
      // エラーを再スローして呼び出し元でも検知できるようにする
      throw error;
    }
  }

  /**
   * デバッグディレクトリの作成
   */
  private async _ensureDebugDirectories(): Promise<void> {
    try {
      Logger.info(`デバッグディレクトリの作成を開始します: プロジェクトパス=${this._projectPath}`);
      
      // logs/debugディレクトリの作成
      const logsPath = path.join(this._projectPath, 'logs');
      const debugPath = path.join(logsPath, 'debug');
      const sessionsPath = path.join(debugPath, 'sessions');
      const archivedPath = path.join(debugPath, 'archived');
      const knowledgePath = path.join(debugPath, 'knowledge');
      
      Logger.info(`logsPathを作成します: ${logsPath}`);
      if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
        Logger.info(`logsPathを新規作成しました: ${logsPath}`);
      } else {
        Logger.info(`logsPathは既に存在します: ${logsPath}`);
      }
      
      Logger.info(`debugPathを作成します: ${debugPath}`);
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
        Logger.info(`debugPathを新規作成しました: ${debugPath}`);
      } else {
        Logger.info(`debugPathは既に存在します: ${debugPath}`);
      }
      
      Logger.info(`sessionsPathを作成します: ${sessionsPath}`);
      if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath, { recursive: true });
        Logger.info(`sessionsPathを新規作成しました: ${sessionsPath}`);
      } else {
        Logger.info(`sessionsPathは既に存在します: ${sessionsPath}`);
      }
      
      Logger.info(`archivedPathを作成します: ${archivedPath}`);
      if (!fs.existsSync(archivedPath)) {
        fs.mkdirSync(archivedPath, { recursive: true });
        Logger.info(`archivedPathを新規作成しました: ${archivedPath}`);
      } else {
        Logger.info(`archivedPathは既に存在します: ${archivedPath}`);
      }
      
      Logger.info(`knowledgePathを作成します: ${knowledgePath}`);
      if (!fs.existsSync(knowledgePath)) {
        fs.mkdirSync(knowledgePath, { recursive: true });
        Logger.info(`knowledgePathを新規作成しました: ${knowledgePath}`);
      } else {
        Logger.info(`knowledgePathは既に存在します: ${knowledgePath}`);
      }
      
      // ディレクトリが正しく作成されたか確認
      const dirs = [logsPath, debugPath, sessionsPath, archivedPath, knowledgePath];
      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          throw new Error(`ディレクトリの作成に失敗しました: ${dir}`);
        }
      }
      
      // .gitkeepファイルを作成して空ディレクトリをgitで追跡できるようにする
      fs.writeFileSync(path.join(sessionsPath, '.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(archivedPath, '.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(knowledgePath, '.gitkeep'), '', 'utf8');
      
      Logger.info(`デバッグディレクトリを作成しました: ${debugPath}`);
    } catch (error) {
      Logger.error('デバッグディレクトリ作成エラー', error as Error);
      throw error;
    }
  }

  /**
   * エラーの調査依頼処理
   */
  private async _handleInvestigateError(errorLog: string): Promise<void> {
    try {
      if (!errorLog || errorLog.trim() === '') {
        throw new Error('エラーログが空です');
      }
      
      // エラーセッションを作成
      const sessionId = await this._errorSessionManager.createSession(errorLog);
      
      // エラーの種類を検出
      const errorType = await this._detectErrorType(errorLog);
      
      // エラーセッション情報を更新
      await this._errorSessionManager.updateSession(sessionId, {
        errorType,
        status: 'investigating',
        investigationStartTime: new Date().toISOString()
      });
      
      // 現在のセッションを更新
      this._currentErrorSession = await this._errorSessionManager.getSession(sessionId);
      this._detectedErrorType = errorType;
      
      Logger.info(`エラーセッションを作成しました: ${sessionId}`);
      
      // エラー情報のみのプロンプトを作成
      const tempDir = path.join(this._projectPath, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const combinedPromptPath = path.join(
        tempDir, 
        `combined_debug_${Date.now()}.md`
      );
      
      // プロンプトURL
      const debugDetectivePromptUrl = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09';
      
      // ClaudeCodeIntegrationServiceを使用して公開URL経由で起動
      try {
        // エラー情報のみを一時ファイルに保存
        let analysisContent = '# エラー情報\n\n```\n';
        analysisContent += errorLog;
        analysisContent += '\n```\n\n';
        
        // 一時ファイルに保存（デバッグ用・参照用）
        const analysisFilePath = path.join(tempDir, `error_analysis_${Date.now()}.md`);
        fs.writeFileSync(analysisFilePath, analysisContent, 'utf8');
        Logger.info(`エラー分析ファイルを作成しました: ${analysisFilePath}`);
        
        // ClaudeCodeIntegrationServiceのインスタンスを取得
        const integrationService = await import('../../services/ClaudeCodeIntegrationService').then(
          module => module.ClaudeCodeIntegrationService.getInstance()
        );
        
        // 単一プロンプトで起動
        Logger.info(`デバッグ探偵プロンプトを直接使用してClaudeCodeを起動: ${debugDetectivePromptUrl}`);
        
        // 単一プロンプトでClaudeCodeを起動（分割表示を有効にして）
        await integrationService.launchWithPublicUrl(
          debugDetectivePromptUrl, 
          this._projectPath,
          analysisContent, // 重要：エラー分析内容を追加コンテンツとして渡す
          true // 分割表示を有効にする
        );
        
        // 解析データのファイルを作成するだけで開かず、通知も表示しない
        Logger.info(`エラー分析ファイルを作成しました: ${analysisFilePath}`);
        
      } catch (error) {
        // URL起動に失敗した場合、ローカルファイルにフォールバック
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // ローカルのプロンプトファイルをチェック
        const debugPromptPath = path.join(this._projectPath, 'docs', 'prompts', 'debug_detective.md');
        
        // プロンプトファイルの存在確認
        if (!fs.existsSync(debugPromptPath)) {
          Logger.error(`デバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
          throw new Error(`デバッグプロンプトファイル（debug_detective.md）が見つかりません。docs/prompts/debug_detective.mdを確認してください。`);
        }
        
        Logger.info(`デバッグプロンプトファイルを読み込みます: ${debugPromptPath}`);
        let combinedContent = fs.readFileSync(debugPromptPath, 'utf8');
        combinedContent += '\n\n# エラー情報\n\n```\n';
        combinedContent += errorLog;
        combinedContent += '\n```\n\n';
        
        Logger.info(`調査用プロンプトを作成します: ${combinedPromptPath}`);
        fs.writeFileSync(combinedPromptPath, combinedContent, 'utf8');
        
        // ClaudeCodeを起動（フォールバック・分割表示対応）
        Logger.info(`ClaudeCodeを起動します（フォールバック）: ${combinedPromptPath}`);
        await this._claudeCodeLauncher.launchClaudeCodeWithPrompt(
          this._projectPath,
          combinedPromptPath,
          { 
            title: `デバッグ探偵 - 調査中: ${errorType || '不明なエラー'}`,
            deletePromptFile: true, // セキュリティ対策として自動削除
            splitTerminal: true, // 分割表示を有効化
            location: vscode.ViewColumn.Beside // 表示位置を指定
          }
        );
      }
      
      // UI更新
      await this._updateWebview();
      
      // 作成済みセッションIDを通知
      await this._panel.webview.postMessage({
        command: 'errorSessionCreated',
        sessionId,
        errorType
      });
      
      Logger.info(`調査を開始しました: ${sessionId}`);
    } catch (error) {
      Logger.error('エラー調査依頼エラー', error as Error);
      await this._showError(`エラーの調査依頼に失敗しました: ${(error as Error).message}`);
    }
  }



  /**
   * エラーセッション一覧取得処理
   */
  private async _handleGetErrorSessions(): Promise<void> {
    try {
      // エラーセッション一覧を取得
      const sessions = await this._errorSessionManager.getAllSessions();
      
      // UI更新
      await this._panel.webview.postMessage({
        command: 'errorSessions',
        sessions
      });
      
      Logger.info(`エラーセッション一覧を取得しました: ${sessions.length}件`);
    } catch (error) {
      Logger.error('エラーセッション一覧取得エラー', error as Error);
      await this._showError(`エラーセッション一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ターミナル出力保存処理
   */
  private async _handleSaveTerminalOutput(): Promise<void> {
    try {
      // クリップボードからターミナル出力を取得するよう促す
      vscode.window.showInformationMessage(
        'ターミナル出力をクリップボードにコピーし、テキストエリアに貼り付けてください。'
      );
    } catch (error) {
      Logger.error('ターミナル出力保存エラー', error as Error);
      await this._showError(`ターミナル出力の保存に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラータイプ検出処理
   */
  private async _handleDetectErrorType(errorLog: string): Promise<void> {
    try {
      if (!errorLog || errorLog.trim() === '') {
        throw new Error('エラーログが空です');
      }
      
      // エラーの種類を検出
      const errorType = await this._detectErrorType(errorLog);
      
      // UI更新
      await this._panel.webview.postMessage({
        command: 'errorTypeDetected',
        errorType
      });
      
      Logger.info(`エラータイプを検出しました: ${errorType}`);
    } catch (error) {
      Logger.error('エラータイプ検出エラー', error as Error);
      await this._showError(`エラータイプの検出に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラーの種類を検出
   */
  private async _detectErrorType(errorLog: string): Promise<string> {
    // エラーパターンの定義
    const errorPatterns = [
      { pattern: /(TypeError|ReferenceError|SyntaxError|RangeError)/i, type: '構文エラー' },
      { pattern: /(ENOENT|EACCES|EPERM|EEXIST)/i, type: 'ファイルシステムエラー' },
      { pattern: /(Cannot find module|Module not found)/i, type: 'モジュールエラー' },
      { pattern: /(Connection refused|ECONNREFUSED|timeout|ETIMEDOUT)/i, type: '接続エラー' },
      { pattern: /(Uncaught|unhandled)/i, type: '未処理例外' },
      { pattern: /(undefined is not a function|is not a function)/i, type: '型エラー' },
      { pattern: /(DatabaseError|MongoError|SequelizeError|PrismaClientKnownRequestError)/i, type: 'データベースエラー' },
      { pattern: /(AUTH_|Authorization|Authentication|token|jwt)/i, type: '認証エラー' },
      { pattern: /(Cannot read property|Cannot access|is undefined)/i, type: 'プロパティアクセスエラー' },
      { pattern: /(Component|React|Vue|Angular|DOM)/i, type: 'UIコンポーネントエラー' },
      { pattern: /(404|500|403|401|422|400)/i, type: 'HTTPエラー' },
      { pattern: /(npm ERR|yarn error|package.json)/i, type: 'パッケージ管理エラー' },
      { pattern: /(webpack|babel|rollup|vite|esbuild)/i, type: 'ビルドエラー' },
      { pattern: /(test|expect|assert|describe|it\(|test\()/i, type: 'テストエラー' },
      { pattern: /(memory leak|Out of memory|heap)/i, type: 'メモリエラー' },
      { pattern: /(TypeScript|TS|type annotations|interface)/i, type: '型定義エラー' },
      { pattern: /(lint|eslint|tslint|prettier)/i, type: 'リントエラー' },
      { pattern: /(環境変数|env|process.env|Environment)/i, type: '環境変数エラー' },
    ];
    
    // エラーパターンを順に検査
    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(errorLog)) {
        return type;
      }
    }
    
    // デフォルト
    return '不明なエラー';
  }

  /**
   * 関連ファイル検出と読み込み機能は削除
   */

  /**
   * エラーメッセージの表示
   */
  private async _showError(message: string): Promise<void> {
    vscode.window.showErrorMessage(message);
    
    // WebViewにもエラーを表示
    await this._panel.webview.postMessage({ 
      command: 'showError', 
      message 
    });
  }

  /**
   * WebViewを更新
   */
  private async _update(): Promise<void> {
    if (!this._panel.visible) {
      return;
    }

    try {
      this._panel.webview.html = this._getHtmlForWebview();
      await this._updateWebview();
    } catch (error) {
      Logger.error(`WebView更新エラー`, error as Error);
      // エラーが発生しても最低限のUIは維持
      this._panel.webview.html = this._getHtmlForWebview();
    }
  }

  /**
   * WebViewの状態を更新
   */
  private async _updateWebview(): Promise<void> {
    try {
      // エラーセッション一覧を取得
      const sessions = await this._errorSessionManager.getAllSessions();
      
      // 知見ベース一覧を取得
      const knowledgeBase = await this._knowledgeBaseManager.getAllKnowledge();
      
      await this._panel.webview.postMessage({
        command: 'updateState',
        currentErrorSession: this._currentErrorSession,
        relatedFiles: this._relatedFiles,
        detectedErrorType: this._detectedErrorType,
        sessions,
        knowledgeBase,
        projectPath: this._projectPath
      });
    } catch (error) {
      Logger.error(`WebView状態更新エラー`, error as Error);
      // 最低限のメッセージを送信
      await this._panel.webview.postMessage({
        command: 'showError',
        message: 'デバッグデータの読み込み中にエラーが発生しました。'
      });
    }
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    try {
      // WebView内でのリソースへのパスを取得
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'debugDetective.js')
      );
      const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'debugDetective.css')
      );
      const resetCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
      );
      const vscodeCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
      );
      
      // シャーロックアイコンのパスを取得
      const sherlockIconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'assets', 'sherlock.svg');
      const sherlockIconExists = fs.existsSync(sherlockIconPath.fsPath);
      
      // アイコンが存在する場合のみURIを取得
      const sherlockIconUri = sherlockIconExists 
        ? webview.asWebviewUri(sherlockIconPath)
        : webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg')); // フォールバックアイコン

    // WebViewのHTMLを構築
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; frame-src https:;">
  <title>デバッグ探偵 - シャーロックホームズ</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${vscodeCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <!-- アクセシビリティ用スキップナビゲーション -->
  <a href="#main-content" class="skip-link">メインコンテンツにスキップ</a>

  <div class="detective-container">
    <!-- ヘッダー -->
    <header class="header" role="banner">
      <div class="header-title">
        <img src="${sherlockIconUri}" alt="シャーロックホームズ アイコン" class="sherlock-icon" aria-hidden="true">
        <h1>デバッグ探偵 - シャーロックホームズ</h1>
      </div>
    </header>
    
    <!-- メインコンテンツ -->
    <main id="main-content" class="content" role="main">
      <!-- シンプル化されたUI -->
      <div class="content">
        <section class="error-input-section">
          <h2 id="error-input-heading">エラーログ入力</h2>
          <div class="error-input">
            <label for="error-log" class="sr-only">エラーログを入力してください</label>
            <textarea 
              id="error-log" 
              placeholder="エラーログをここに貼り付けてください..." 
              aria-labelledby="error-input-heading"
              aria-describedby="error-log-description"
              style="width: 100%; min-height: 200px; border: 1px solid #aaa; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 14px; line-height: 1.5; resize: vertical; background-color: white; color: #333; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);"
            ></textarea>
            <p id="error-log-description" class="sr-only">エラーログをここに貼り付けて、デバッグ探偵に調査を依頼できます。</p>
            
            <button 
              id="investigate-error-btn" 
              style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 24px; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; background-color: #2c6fca; color: white;"
              aria-label="入力したエラーの調査を依頼する"
            >
              <span style="font-size: 20px;" aria-hidden="true">🕵️</span>
              <span>このエラーの調査を依頼する</span>
            </button>
          </div>
        </section>

        <section id="current-session-section" class="current-session-section" style="display: none;">
          <h2>現在の調査セッション</h2>
          <div id="current-session-container" class="current-session-container"></div>
        </section>
      </div>
    </main>
  </div>
  
  <!-- アクセシビリティ用通知領域 -->
  <div id="notification-area" class="sr-only" aria-live="assertive"></div>
  
  <!-- スクリプト -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
    } catch (error) {
      Logger.error(`WebView HTML生成エラー`, error as Error);
      // エラーが発生した場合のシンプルなフォールバックHTMLを返す
      return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>デバッグ探偵 - シャーロックホームズ</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      padding: 20px;
      line-height: 1.5;
    }
    .error { 
      color: #c25450; 
      margin: 20px 0; 
      padding: 10px; 
      border: 1px solid #c25450; 
      border-radius: 4px; 
    }
    .reload-button {
      background-color: #0e639c;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 14px;
    }
    .reload-button:hover {
      background-color: #1177bb;
    }
    .reload-button:focus {
      outline: 2px solid #0e639c;
      outline-offset: 2px;
    }
  </style>
</head>
<body>
  <header role="banner">
    <h1>デバッグ探偵 - シャーロックホームズ</h1>
  </header>
  <main role="main">
    <div class="error" role="alert" aria-live="assertive">
      <h2>エラーが発生しました</h2>
      <p>デバッグ探偵の初期化中にエラーが発生しました。開発ログを確認してください。</p>
      <button class="reload-button" onclick="window.location.reload()" aria-label="ページを再読み込みする">再読み込み</button>
    </div>
  </main>
</body>
</html>`;
    }
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    DebugDetectivePanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}