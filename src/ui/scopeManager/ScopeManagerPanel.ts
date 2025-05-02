import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '../../utils/logger';
import { FileOperationManager } from '../../utils/fileOperationManager';
import { ScopeItemStatus, IImplementationItem, IImplementationScope } from '../../types';
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';
import { ClaudeCodeIntegrationService } from '../../services/ClaudeCodeIntegrationService';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';
import { ProtectedPanel } from '../auth/ProtectedPanel';
import { Feature } from '../../core/auth/roles';
import { AuthenticationService } from '../../core/auth/AuthenticationService';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';
import { PromptServiceClient } from '../../services/PromptServiceClient';
import { SharedFile, FileSaveOptions } from '../../types/SharingTypes';
import { AuthGuard } from '../auth/AuthGuard';
import { SimpleAuthManager } from '../../core/auth/SimpleAuthManager';
import { IFileSystemService, FileSystemService } from './services/FileSystemService';
import { IProjectService, ProjectService } from './services/ProjectService';
import { ISharingService, SharingService } from './services/SharingService';

/**
 * スコープマネージャーパネルクラス
 * CURRENT_STATUS.mdファイルと連携して実装スコープの管理を行う
 * 権限保護されたパネルの基底クラスを継承
 */
export class ScopeManagerPanel extends ProtectedPanel {
  public static currentPanel: ScopeManagerPanel | undefined;
  private static readonly viewType = 'scopeManager';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.SCOPE_MANAGER;

  // 未使用メソッドを削除

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _extensionPath: string; // 拡張機能のファイルシステムパス（テンプレート読み込みに使用）
  private _disposables: vscode.Disposable[] = [];

  private _projectPath: string = '';
  private _fileManager: FileOperationManager;
  private _statusFilePath: string = '';
  private _directoryStructure: string = '';
  private _fileWatcher: vscode.Disposable | null = null;
  private _docsDirWatcher: fs.FSWatcher | null = null; // Node.jsのファイルシステムウォッチャー
  // 準備モードは廃止されました
  private _sharingService: ISharingService; // 共有サービス
  
  // 準備モード関連のメソッドは廃止されました
  
  // 一時ファイル保存ディレクトリの設定
  
  // 一時ファイル保存ディレクトリ (隠しフォルダ方式)
  private _tempShareDir: string = '';
  private _promptServiceClient: PromptServiceClient;
  private _fileSystemService: IFileSystemService; // FileSystemServiceのインスタンス
  private _projectService: IProjectService; // ProjectServiceのインスタンス

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string): ScopeManagerPanel | undefined {
    // 認証チェックを追加：ログインしていない場合はログイン画面に直接遷移
    if (!AuthGuard.checkLoggedIn()) {
      Logger.info('スコープマネージャー: 未認証のためログイン画面に誘導します');
      // ログイン画面を表示（LoginWebviewPanelを使用）
      const { LoginWebviewPanel } = require('../auth/LoginWebviewPanel');
      LoginWebviewPanel.createOrShow(extensionUri);
      return undefined;
    }

    // 権限チェック：SCOPE_MANAGERの権限がない場合はアクセスを拒否
    if (!ProtectedPanel.checkPermissionForFeature(ScopeManagerPanel._feature, 'ScopeManagerPanel')) {
      Logger.warn('スコープマネージャー: 権限不足のためアクセスを拒否します');
      vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がありません。');
      return undefined;
    }

    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (ScopeManagerPanel.currentPanel) {
      ScopeManagerPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが指定されている場合は更新
      if (projectPath) {
        Logger.info(`既存のスコープマネージャーパネルを使用して、プロジェクトパスを更新: ${projectPath}`);
        ScopeManagerPanel.currentPanel.setProjectPath(projectPath);
      }
      
      return ScopeManagerPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      ScopeManagerPanel.viewType,
      'AppGenius スコープマネージャー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // カスタムCSP設定を削除し、VSCodeのデフォルト設定を使用
        // contentSecurityPolicy: "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src *;",
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
        ]
      }
    );
    
    Logger.info(`新しいスコープマネージャーパネルを作成: プロジェクトパス=${projectPath || '未指定'}`);
    ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, context, projectPath);
    return ScopeManagerPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string) {
    super();
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._extensionPath = context.extensionPath; // 拡張機能のファイルシステムパスを保存
    this._fileManager = FileOperationManager.getInstance();
    this._promptServiceClient = PromptServiceClient.getInstance();
    
    // FileSystemServiceのインスタンスを取得
    this._fileSystemService = FileSystemService.getInstance();
    
    // ProjectServiceのインスタンスを取得
    this._projectService = ProjectService.getInstance(this._fileSystemService);
    
    // ProjectServiceのイベントリスナーを設定
    this._setupProjectServiceEventListeners();
    
    // 共有サービスを初期化
    this._sharingService = SharingService.getInstance(context);
    
    // 一時ディレクトリはプロジェクトパス設定時に作成されるため、ここでは初期化のみ
    this._tempShareDir = '';
    
    // 認証状態の監視を設定 (1分ごとにチェック)
    this._setupTokenExpirationMonitor();
    
    // SimpleAuthServiceの認証状態変更イベントを直接監視
    try {
      const simpleAuthService = SimpleAuthManager.getInstance().getAuthService();
      const authStateChangedDisposable = simpleAuthService.onStateChanged(state => {
        // 認証状態が未認証になった、または権限がなくなった場合
        if (!state.isAuthenticated || !AuthGuard.checkAccess(ScopeManagerPanel._feature)) {
          Logger.info('スコープマネージャー: 認証状態が変更されたため、パネルを閉じます');
          // パネルを閉じる
          this.dispose();
          
          if (!state.isAuthenticated) {
            // ログイン画面に誘導
            const { LoginWebviewPanel } = require('../auth/LoginWebviewPanel');
            LoginWebviewPanel.createOrShow(this._extensionUri);
          }
        }
      });
      
      // Disposableリストに追加
      this._disposables.push(authStateChangedDisposable);
      Logger.info('スコープマネージャー: 認証状態変更イベントの監視を開始しました');
    } catch (error) {
      Logger.error('認証状態変更イベントの監視設定中にエラーが発生しました', error as Error);
    }
    
    // ProjectManagementServiceからプロジェクト一覧を取得
    try {
      const { ProjectManagementService } = require('../../services/ProjectManagementService');
      const projectService = ProjectManagementService.getInstance();
      this._currentProjects = projectService.getAllProjects();
      this._activeProject = projectService.getActiveProject();
      
      Logger.info(`プロジェクト一覧を取得しました: ${this._currentProjects.length}件`);
      
      // アクティブプロジェクトが指定されていない場合は、引数または現在のアクティブプロジェクトを使用
      if (!projectPath && this._activeProject && this._activeProject.path) {
        projectPath = this._activeProject.path;
        Logger.info(`アクティブプロジェクトパスを使用: ${projectPath}`);
      }
    } catch (error) {
      Logger.warn(`プロジェクト一覧の取得に失敗しました: ${error}`);
    }
    
    // プロジェクトパスが指定されている場合は設定
    if (projectPath) {
      this.setProjectPath(projectPath);
    }
    
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
        try {
          switch (message.command) {
            case 'initialize':
              await this._handleInitialize();
              break;
            case 'showDirectoryStructure':
              await this._handleShowDirectoryStructure();
              break;
            case 'getMarkdownContent':
              await this._handleGetMarkdownContent(message.filePath);
              break;
            case 'saveTabState':
              await this._handleSaveTabState(message.tabId);
              break;
            // 新しいコマンド
            case 'launchPromptFromURL':
              await this._handleLaunchPromptFromURL(message.url, message.index, message.name);
              break;
            case 'shareText':
              await this._handleShareText(message.text, message.suggestedFilename);
              break;
            case 'shareImage':
              // デバッグログを追加
              console.log('ScopeManagerPanel: shareImage命令を受信', { 
                hasImageData: !!message.imageData, 
                hasData: !!message.data,
                fileName: message.fileName
              });
              
              // message.imageDataまたはmessage.dataのどちらかを使用（互換性のため）
              const imageData = message.imageData || message.data;
              if (!imageData) {
                this._showError('画像データが見つかりません');
                return;
              }
              
              await this._handleShareImage(imageData, message.fileName);
              break;
            
            case 'openMockupGallery':
              await this._handleOpenMockupGallery();
              break;
            case 'openOriginalMockupGallery':
              await this._handleOpenOriginalMockupGallery(message.filePath);
              break;
            
            case 'getHistory':
              await this._handleGetHistory();
              break;
            case 'deleteFromHistory':
              await this._handleDeleteFromHistory(message.fileId);
              break;
            case 'copyCommand':
              await this._handleCopyCommand(message.fileId);
              break;
            case 'copyToClipboard':
              await this._handleCopyToClipboard(message.text);
              break;
            case 'reuseHistoryItem':
              await this._handleReuseHistoryItem(message.fileId);
              break;
            case 'selectProject':
              await this._handleSelectProject(message.projectName, message.projectPath);
              break;
            case 'loadExistingProject':
              await this._handleLoadExistingProject();
              break;
            case 'createProject':
              await this._handleCreateProject(message.name, message.description);
              break;
            case 'removeProject':
              await this._handleRemoveProject(message.projectName, message.projectPath, message.projectId);
              break;
            // モックアップビューア関連のコマンド
            case 'selectMockup':
              await this._handleSelectMockup(message.filePath);
              break;
            case 'openInBrowser':
              await this._handleOpenMockupInBrowser(message.filePath);
              break;
            // 状態同期関連のコマンドは削除されました
          }
        } catch (error) {
          Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
          this._showError(`操作に失敗しました: ${(error as Error).message}`);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * 新規プロジェクト作成処理
   * ProjectServiceを使用して実装
   */
  private async _handleCreateProject(projectName: string, description: string): Promise<void> {
    try {
      Logger.info(`新規プロジェクト作成: ${projectName}`);
      
      // ProjectServiceを使用してプロジェクトを作成
      const projectId = await this._projectService.createProject(projectName, description);
      
      Logger.info(`プロジェクト「${projectName}」の作成が完了しました: ID=${projectId}`);
      
      // プロジェクトの最新情報を取得
      const activeProject = this._projectService.getActiveProject();
      const allProjects = this._projectService.getAllProjects();
      
      // プロジェクトパスを更新
      if (activeProject && activeProject.path) {
        this.setProjectPath(activeProject.path);
        
        // ステータスファイルの内容も読み込んで表示
        const statusFilePath = this._projectService.getStatusFilePath();
        if (statusFilePath && fs.existsSync(statusFilePath)) {
          await this._handleGetMarkdownContent(statusFilePath);
        }
      }
      
      // WebViewにプロジェクト一覧を更新
      this._panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
      
      // 成功メッセージを表示
      this._panel.webview.postMessage({
        command: 'showSuccess',
        message: `プロジェクト「${projectName}」を作成しました`
      });
      
      // プロジェクト名を更新
      this._panel.webview.postMessage({
        command: 'updateProjectName',
        projectName: projectName
      });
    } catch (error) {
      Logger.error(`プロジェクト作成中にエラーが発生しました: ${projectName}`, error as Error);
      this._showError(`プロジェクトの作成に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 既存プロジェクトの読み込み処理
   * ProjectServiceを使用して実装
   */
  private async _handleLoadExistingProject(): Promise<void> {
    try {
      Logger.info('既存プロジェクト読み込み処理を開始');
      
      // ProjectServiceを使用して既存プロジェクトを読み込む
      const projectInfo = await this._projectService.loadExistingProject();
      
      // プロジェクトパスを更新
      if (projectInfo && projectInfo.path) {
        // プロジェクトパスを設定
        this.setProjectPath(projectInfo.path);
        
        // プロジェクトの最新情報を取得
        const activeProject = this._projectService.getActiveProject();
        const allProjects = this._projectService.getAllProjects();
        
        // WebViewにプロジェクト一覧を更新
        this._panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // ステータスファイルの内容も読み込んで表示
        const statusFilePath = this._projectService.getStatusFilePath();
        if (statusFilePath && fs.existsSync(statusFilePath)) {
          await this._handleGetMarkdownContent(statusFilePath);
        }
        
        // 成功メッセージを表示
        this._panel.webview.postMessage({
          command: 'showSuccess',
          message: `プロジェクト「${projectInfo.name}」を開きました`
        });
        
        // プロジェクト名を更新
        this._panel.webview.postMessage({
          command: 'updateProjectName',
          projectName: projectInfo.name
        });
        
        Logger.info(`プロジェクト「${projectInfo.name}」の読み込みが完了しました: ${projectInfo.path}`);
      }
    } catch (error) {
      Logger.error('プロジェクト読み込み中にエラーが発生しました', error as Error);
      this._showError(`プロジェクトの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトパスを設定
   * ProjectServiceに委譲
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    try {
      this._projectPath = projectPath;
      
      // ProjectServiceにプロジェクトパスを設定
      await this._projectService.setProjectPath(projectPath);
      
      // ステータスファイルパスをProjectServiceから取得
      this._statusFilePath = this._projectService.getStatusFilePath();
      
      Logger.info(`プロジェクトパスを設定しました: ${projectPath}`);
      Logger.info(`ステータスファイルパス: ${this._statusFilePath}, ファイル存在: ${fs.existsSync(this._statusFilePath) ? 'はい' : 'いいえ'}`);
      
      // 既存のファイルウォッチャーを破棄
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
        this._fileWatcher = null;
      }
      
      // Node.jsのファイルシステムウォッチャーも破棄
      if (this._docsDirWatcher) {
        this._docsDirWatcher.close();
        this._docsDirWatcher = null;
      }
      
      // プロジェクト直下に一時ディレクトリを作成
      this._tempShareDir = path.join(projectPath, '.appgenius_temp');
      await this._fileSystemService.ensureDirectoryExists(this._tempShareDir);
      
      // 関連サービスにプロジェクトパスを設定
      this._promptServiceClient.setProjectPath(projectPath);
      this._sharingService.setProjectBasePath(projectPath);
      
      // ファイルウォッチャーとステータスファイルを設定
      this._setupFileWatcher();
      this._loadStatusFile();
      
      // WebViewにプロジェクト情報を送信
      this._panel.webview.postMessage({
        command: 'updateProjectPath',
        projectPath: this._projectPath,
        statusFilePath: this._statusFilePath,
        statusFileExists: fs.existsSync(this._statusFilePath)
      });
      
      // WebViewにプロジェクト一覧を更新
      const allProjects = this._projectService.getAllProjects();
      const activeProject = this._projectService.getActiveProject();
      
      this._panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
      
      Logger.debug(`プロジェクト一覧を更新しました: ${allProjects.length}件, アクティブ: ${activeProject?.name || 'なし'}`);
    } catch (error) {
      Logger.error(`プロジェクトパスの設定に失敗しました: ${error}`);
      throw error;
    }
  }

  /**
   * 初期化処理
   */
  private async _handleInitialize(): Promise<void> {
    // 最新のプロジェクト一覧を取得して送信
    await this._refreshProjects();
    
    await this._loadStatusFile();

    // ディレクトリ構造を更新
    await this._updateDirectoryStructure();
    
    // 共有履歴を初期化
    await this._handleGetHistory();
    
    // CURRENT_STATUS.mdの内容を読み込む
    if (this._statusFilePath && fs.existsSync(this._statusFilePath)) {
      await this._handleGetMarkdownContent(this._statusFilePath);
    }
  }
  
  /**
   * プロジェクト一覧を更新
   * ProjectServiceを使用して実装
   */
  private async _refreshProjects(): Promise<void> {
    try {
      // ProjectServiceからプロジェクト一覧を取得
      this._currentProjects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      Logger.info(`プロジェクト一覧を更新しました: ${this._currentProjects.length}件`);
      
      // WebViewにプロジェクト一覧を送信
      this._panel.webview.postMessage({
        command: 'updateProjects',
        projects: this._currentProjects,
        activeProject: this._activeProject ? {
          id: this._activeProject.id,
          name: this._activeProject.name,
          path: this._activeProject.path
        } : null
      });
    } catch (error) {
      Logger.error(`プロジェクト一覧の更新に失敗しました`, error as Error);
      this._showError(`プロジェクト一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロンプトURLからClaudeCodeを起動する
   */
  private async _handleLaunchPromptFromURL(url: string, index: number, name?: string): Promise<void> {
    try {
      Logger.info(`プロンプトを取得中: ${url}`);
      
      // フロントエンドから送信されたURLとインデックスをそのまま使用
      // プロンプトの内容を取得して一時ファイルに保存（プロジェクトパスを指定）
      const promptFilePath = await this._promptServiceClient.fetchAndSavePrompt(url, index, this._projectPath);
      
      // ClaudeCodeを起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        {
          deletePromptFile: true, // 使用後に一時ファイルを削除
          splitView: true, // 分割ビューで表示
          promptType: name // プロンプト名をターミナルタイトルに反映
        }
      );
      
      if (success) {
        Logger.info(`ClaudeCode起動成功: ${promptFilePath}`);
      } else {
        this._showError('ClaudeCodeの起動に失敗しました');
      }
    } catch (error) {
      Logger.error('プロンプト起動中にエラーが発生しました', error as Error);
      this._showError(`プロンプトの取得または起動に失敗しました: ${(error as Error).message}`);
    }
  }

  // レガシー共有メソッドは削除されました



  /**
   * モックアップギャラリーを開く - 共通メソッドに統合
   * @param filePath 表示するモックアップファイルのパス（オプション）
   */
  private async _handleOpenMockupGallery(filePath?: string): Promise<void> {
    try {
      // 別ウィンドウでモックアップギャラリーを開く
      await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', this._projectPath);
      Logger.info(`モックアップギャラリーを開きました${filePath ? ': ' + filePath : ''}`);
      this._showSuccess('モックアップギャラリーを開きました');
    } catch (error) {
      Logger.error('モックアップギャラリーを開けませんでした', error as Error);
      this._showError('モックアップギャラリーを開けませんでした');
    }
  }
  
  /**
   * 旧メソッド名での互換性維持用
   */
  private async _handleOpenOriginalMockupGallery(filePath?: string): Promise<void> {
    // 統合したメソッドを呼び出す
    return this._handleOpenMockupGallery(filePath);
  }
  
  /**
   * モックアップファイルを選択 - 統合メソッドを呼び出す
   * @param filePath モックアップファイルのパス
   */
  private async _handleSelectMockup(filePath: string): Promise<void> {
    return this._handleOpenMockupGallery(filePath);
  }
  
  /**
   * モックアップをブラウザで開く
   * @param filePath モックアップファイルのパス
   */
  private async _handleOpenMockupInBrowser(filePath: string): Promise<void> {
    try {
      // 外部ブラウザでファイルを開く
      await vscode.env.openExternal(vscode.Uri.file(filePath));
      Logger.info(`モックアップをブラウザで開きました: ${filePath}`);
    } catch (error) {
      Logger.error('モックアップをブラウザで開けませんでした', error as Error);
      this._showError('モックアップをブラウザで開けませんでした');
    }
  }


  /**
   * 共有履歴を取得してWebViewに送信
   */
  private async _handleGetHistory(): Promise<void> {
    try {
      const history = this._sharingService.getHistory();
      Logger.debug('共有履歴を取得しました', { count: history.length });
      
      this._panel.webview.postMessage({
        command: 'updateSharingHistory',
        history: history || []
      });
    } catch (error) {
      Logger.error('履歴取得エラー', error as Error);
    }
  }

  /**
   * テキストを共有サービスで共有
   */
  private async _handleShareText(text: string, suggestedFilename?: string): Promise<void> {
    try {
      Logger.info('テキスト共有を開始します', { 
        textLength: text.length, 
        hasSuggestedFilename: !!suggestedFilename 
      });
      
      // ファイル名のヒントを設定
      const options: FileSaveOptions = {
        type: 'text',
        expirationHours: 24  // デフォルト有効期限
      };
      
      // 提案されたファイル名があれば使用
      if (suggestedFilename) {
        options.title = suggestedFilename;
        options.metadata = { suggestedFilename };
      }
      
      // 共有サービスを使ってテキストを共有
      const file = await this._sharingService.shareText(text, options);
      
      Logger.info('テキスト共有成功', { 
        fileName: file.fileName,
        originalName: file.originalName,
        title: file.title
      });
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // 履歴を確実に更新（先に実行）
      await this._handleGetHistory();
      
      // 短い遅延後、成功メッセージを送信
      // これにより、UIの更新がスムーズになります
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: 'showShareResult',
          data: {
            filePath: file.path,
            command: command,
            type: 'text',
            title: file.title || suggestedFilename,
            originalName: file.originalName
          }
        });
        
        // 保存後に確実に履歴が最新になっていることを確認するための二重チェック
        setTimeout(() => this._handleGetHistory(), 500);
      }, 100);
      
    } catch (error) {
      Logger.error('テキスト共有エラー', error as Error);
      this._showError(`テキストの共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 画像を共有サービスで共有
   */
  private async _handleShareImage(imageData: string, fileName: string): Promise<void> {
    try {
      // 共有サービスを使って画像を共有
      const file = await this._sharingService.shareImage(imageData, fileName);
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // 履歴を確実に更新（先に実行）
      await this._handleGetHistory();
      
      // 画像アップロードエリアをクリアするためのメッセージ
      // 確実に処理されるよう明示的に指定
      this._panel.webview.postMessage({
        command: 'resetDropZone',
        force: true,
        timestamp: new Date().getTime()
      });
      
      // 念のため少し遅延させて再度リセットコマンドを送信
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: 'resetDropZone',
          force: true,
          timestamp: new Date().getTime() + 100
        });
      }, 100);
      
      // 短い遅延後、成功メッセージを送信
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: 'showShareResult',
          data: {
            filePath: file.path,
            command: command,
            type: 'image'
          }
        });
        
        // 保存後に確実に履歴が最新になっていることを確認するための二重チェック
        setTimeout(() => this._handleGetHistory(), 500);
      }, 100);
      
    } catch (error) {
      this._showError(`画像の共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 履歴からアイテムを削除
   */
  private async _handleDeleteFromHistory(fileId: string): Promise<void> {
    const success = this._sharingService.deleteFromHistory(fileId);
    
    if (success) {
      Logger.info(`共有履歴から項目を削除しました: ${fileId}`);
      // 履歴を更新して送信
      await this._handleGetHistory();
    } else {
      Logger.warn(`共有履歴からの項目削除に失敗しました: ${fileId}`);
    }
  }

  /**
   * ファイルのコマンドをクリップボードにコピー
   */
  private async _handleCopyCommand(fileId: string): Promise<void> {
    try {
      // ファイルを履歴から検索
      const history = this._sharingService.getHistory();
      const file = history.find(item => item.id === fileId);
      
      if (file) {
        // コマンドを生成
        const command = this._sharingService.generateCommand(file);
        
        // VSCodeのクリップボード機能を使用
        await vscode.env.clipboard.writeText(command);
        
        // アクセスカウントを増やす
        this._sharingService.recordAccess(fileId);
        
        // 成功メッセージを送信 - 特定のファイルIDを明示
        this._panel.webview.postMessage({
          command: 'commandCopied',
          fileId: fileId,
          fileName: file.title || file.originalName || file.fileName
        });
        
        // VSCodeの通知も表示（オプション）
        vscode.window.showInformationMessage(`コマンド "${command}" をコピーしました！`);
        
        Logger.info(`コマンドをコピーしました: ${fileId}, ファイル: ${file.fileName}`);
      } else {
        Logger.warn(`コピー対象のファイルが見つかりません: ${fileId}`);
      }
    } catch (error) {
      Logger.error(`コピーコマンド実行中にエラーが発生しました: ${fileId}`, error as Error);
      this._showError(`コピーに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * テキストをクリップボードにコピー
   */
  private async _handleCopyToClipboard(text: string): Promise<void> {
    // VSCodeのクリップボード機能を使用
    vscode.env.clipboard.writeText(text);
  }

  /**
   * 履歴アイテムを再利用
   */
  private async _handleReuseHistoryItem(fileId: string): Promise<void> {
    try {
      // ファイルを履歴から検索
      const history = this._sharingService.getHistory();
      const file = history.find(item => item.id === fileId);
      
      if (file) {
        // コマンドを生成
        const command = this._sharingService.generateCommand(file);
        
        // アクセスカウントを増やす
        this._sharingService.recordAccess(fileId);
        
        // 結果を表示
        this._panel.webview.postMessage({
          command: 'showShareResult',
          data: {
            filePath: file.path,
            command: command,
            type: file.type
          }
        });
        
        Logger.info(`履歴アイテムを再利用しました: ${fileId}, ファイル: ${file.fileName}`);
      } else {
        Logger.warn(`再利用対象のファイルが見つかりません: ${fileId}`);
      }
    } catch (error) {
      Logger.error(`履歴アイテム再利用中にエラーが発生しました: ${fileId}`, error as Error);
      this._showError(`履歴アイテムの再利用に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクト選択処理
   * ProjectServiceを使用して実装
   * @param projectName プロジェクト名
   * @param projectPath プロジェクトパス
   * @param activeTab 現在のアクティブタブID（オプション）
   */
  private async _handleSelectProject(projectName: string, projectPath: string, activeTab?: string): Promise<void> {
    try {
      Logger.info(`プロジェクト選択: ${projectName}, パス: ${projectPath}`);
      
      // ProjectServiceを使用してプロジェクトを選択
      await this._projectService.selectProject(projectName, projectPath, activeTab);
      
      // プロジェクトパスを更新
      this.setProjectPath(projectPath);
      
      // プロジェクトの最新情報を取得
      const activeProject = this._projectService.getActiveProject();
      const allProjects = this._projectService.getAllProjects();
      
      // WebViewにプロジェクト状態同期メッセージを送信
      if (activeProject) {
        this._panel.webview.postMessage({
          command: 'syncProjectState',
          project: activeProject
        });
        Logger.info(`プロジェクト状態同期メッセージを送信: ${activeProject.name}`);
      }
      
      // WebViewにプロジェクト一覧を更新
      this._panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
      
      // ステータスファイルの内容も読み込んで表示
      const statusFilePath = this._projectService.getStatusFilePath();
      if (statusFilePath && fs.existsSync(statusFilePath)) {
        await this._handleGetMarkdownContent(statusFilePath);
      }
      
      // WebViewに成功メッセージを送信
      this._panel.webview.postMessage({
        command: 'showSuccess',
        message: `プロジェクト「${projectName}」を開きました`
      });
      
      // VSCodeの通知も表示
      vscode.window.showInformationMessage(`プロジェクト「${projectName}」を開きました`);
    } catch (error) {
      Logger.error(`プロジェクトを開く際にエラーが発生しました`, error as Error);
      this._showError(`プロジェクトを開けませんでした: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリ構造を表示
   */
  private async _handleShowDirectoryStructure(): Promise<void> {
    if (!this._directoryStructure) {
      await this._updateDirectoryStructure();
    }
    
    this._panel.webview.postMessage({
      command: 'showDirectoryStructure',
      structure: this._directoryStructure
    });
  }

  /**
   * タブ状態を保存する
   */
  private async _handleSaveTabState(tabId: string): Promise<void> {
    try {
      if (!tabId || !this._activeProject || !this._activeProject.id) {
        Logger.warn('タブ状態を保存できません: 有効なアクティブプロジェクトが存在しません');
        return;
      }
      
      Logger.info(`タブ状態を保存します: プロジェクト=${this._activeProject.name}, タブID=${tabId}`);
      
      // ProjectManagementServiceを取得
      const { ProjectManagementService } = require('../../services/ProjectManagementService');
      const projectService = ProjectManagementService.getInstance();
      
      // メタデータにタブ情報を追加
      const metadata = this._activeProject.metadata || {};
      metadata.activeTab = tabId;
      
      // プロジェクトを更新
      await projectService.updateProject(this._activeProject.id, {
        metadata: metadata
      });
      
      // アクティブプロジェクトを再取得
      this._activeProject = projectService.getProject(this._activeProject.id);
      
      // WebViewにプロジェクト状態同期メッセージを送信
      // 注意: 無限ループを避けるため、タブ状態保存時には同期メッセージを送信しない
      // syncProjectStateメッセージは状態変更の大きな変更時のみ送信する
      // if (this._activeProject) {
      //   this._panel.webview.postMessage({
      //     command: 'syncProjectState',
      //     project: this._activeProject
      //   });
      //   Logger.info(`プロジェクト状態同期メッセージを送信: ${this._activeProject.name}`);
      // }
      
      Logger.info(`タブ状態を保存しました: プロジェクト=${this._activeProject.name}, タブID=${tabId}`);
    } catch (error) {
      Logger.error(`タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
    }
  }

  /**
   * マークダウンファイルの内容を取得して表示
   */
  private async _handleGetMarkdownContent(filePath: string): Promise<void> {
    try {
      // FileSystemServiceを使用してマークダウンファイルを読み込む
      const content = await this._fileSystemService.readMarkdownFile(filePath);
      
      // WebViewにマークダウン内容を送信 - 優先度高で即時処理を要求
      this._panel.webview.postMessage({
        command: 'updateMarkdownContent',
        content: content,
        timestamp: Date.now(), // タイムスタンプを追加して新しい更新を識別できるように
        priority: 'high'       // 優先度の高い更新であることを示す
      });
      
      Logger.info(`FileSystemServiceを使用してマークダウンコンテンツを読み込みました: ${filePath}`);
    } catch (error) {
      Logger.error(`マークダウンコンテンツの読み込みに失敗しました: ${filePath}`, error as Error);
      this._showError(`マークダウンファイルの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラーメッセージを表示
   */
  private _showError(message: string): void {
    this._panel.webview.postMessage({
      command: 'showError',
      message: message
    });
  }
  
  /**
   * 成功メッセージを表示
   */
  private _showSuccess(message: string): void {
    this._panel.webview.postMessage({
      command: 'showSuccess',
      message: message
    });
  }
  
  /**
   * プロジェクト登録解除処理
   * ProjectServiceを使用して実装
   */
  private async _handleRemoveProject(projectName: string, projectPath: string, projectId?: string): Promise<void> {
    try {
      Logger.info(`プロジェクト登録解除: ${projectName}, パス: ${projectPath}, ID: ${projectId || 'なし'}`);
      
      if (!projectName && !projectPath && !projectId) {
        this._showError('プロジェクト情報が不足しています');
        return;
      }
      
      // ProjectServiceを使用してプロジェクトを登録解除
      const removed = await this._projectService.removeProject(projectName, projectPath, projectId);
      
      if (removed) {
        Logger.info(`プロジェクト「${projectName}」の登録解除に成功しました`);
        
        // プロジェクトの最新情報を取得
        const activeProject = this._projectService.getActiveProject();
        const allProjects = this._projectService.getAllProjects();
        
        // WebViewにプロジェクト一覧と現在のプロジェクトを送信
        this._panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // 現在のプロジェクトが削除されたプロジェクトと同じ場合、別のプロジェクトへ切り替え
        if (this._projectPath === projectPath) {
          if (activeProject && activeProject.path) {
            await this.setProjectPath(activeProject.path);
          } else if (allProjects.length > 0) {
            await this.setProjectPath(allProjects[0].path);
          }
        }
        
        this._showSuccess(`プロジェクト「${projectName}」の登録を解除しました`);
      } else {
        this._showError(`プロジェクト「${projectName}」の登録解除に失敗しました`);
      }
    } catch (error) {
      Logger.error('プロジェクト登録解除処理エラー', error as Error);
      this._showError(`プロジェクト登録解除に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * WebViewを更新
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
    
    // パネルが表示されたタイミングでプロジェクト情報も更新
    try {
      const { ProjectManagementService } = require('../../services/ProjectManagementService');
      const projectService = ProjectManagementService.getInstance();
      
      // 最新のプロジェクト一覧を取得
      this._currentProjects = projectService.getAllProjects();
      this._activeProject = projectService.getActiveProject();
      
      // パネルが表示されたら常にアクティブプロジェクト情報を更新
      // 他のパネルから戻った時にも適切に状態を復元するため、条件判定を削除
      if (this._activeProject && this._activeProject.path) {
        // UIが描画された後にプロジェクト情報を更新（タイミングの問題を避けるため少し遅延）
        setTimeout(() => {
          // プロジェクト一覧とアクティブプロジェクトをUIに通知（必ず最初に送信）
          this._panel.webview.postMessage({
            command: 'updateProjects',
            projects: this._currentProjects,
            activeProject: this._activeProject
          });
          
          // プロジェクトパスを更新（パスが異なる場合のみ）
          if (this._projectPath !== this._activeProject.path) {
            this.setProjectPath(this._activeProject.path);
            Logger.info(`パネル表示時にプロジェクトパスを更新: ${this._activeProject.path}`);
          }
          
          // 注: タブ情報の復元はsyncProjectStateメッセージで行うため、個別のselectTabは不要になりました
          
          // WebViewに最新のプロジェクト状態を同期
          this._panel.webview.postMessage({
            command: 'syncProjectState',
            project: this._activeProject
          });
          
          Logger.info(`パネル表示時にアクティブプロジェクトを更新: ${this._activeProject.name}`);
        }, 300);
      }
    } catch (error) {
      Logger.warn(`パネル表示時のプロジェクト情報更新に失敗: ${error}`);
    }
  }

  /**
   * WebViewのHTMLを生成
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // スタイルシートやスクリプトのURIを取得
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const designSystemStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.js')
    );
    const sharingPanelScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'sharingPanel.js')
    );
    
    // Material Iconsの読み込み
    const materialIconsUrl = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    
    // CSPを設定
    const nonce = this._getNonce();
    // インラインスクリプトはnonceを使用して制限
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com;
      font-src https://fonts.gstatic.com;
      script-src 'nonce-${nonce}';
      img-src ${webview.cspSource} data:;
      connect-src ${webview.cspSource};
    `;
    
    // HTMLを生成
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <link href="${styleResetUri}" rel="stylesheet">
      <link href="${designSystemStyleUri}" rel="stylesheet">
      <link href="${styleMainUri}" rel="stylesheet">
      <link href="${materialIconsUrl}" rel="stylesheet">
      <title>AppGenius スコープマネージャー</title>
      <style>
        /* VSCodeのネイティブドラッグ&ドロップメッセージを非表示にする */
        .monaco-editor .dnd-overlay, 
        .monaco-editor .dnd-overlay *,
        .monaco-dnd-overlay,
        .monaco-dnd-tree-overlay,
        [role="tooltip"][aria-label*="シフト"],
        [role="tooltip"][aria-label*="ドロップ"],
        [role="tooltip"][aria-label*="⌘"],
        [role="tooltip"][aria-label*="Cmd"] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        
        /* ドラッグ中のデフォルトポインタを変更 */
        body.dragging * {
          cursor: copy !important;
        }
        
        /* ドラッグ効果をより目立たせる */
        .drag-effect.active {
          background-color: rgba(74, 105, 189, 0.3) !important;
          z-index: 9999999 !important;
        }
        
        /* 選択中プロジェクトのスタイル */
        .project-item.active {
          background-color: rgba(74, 105, 189, 0.1);
          border-left: 3px solid var(--app-primary);
        }
        
        .file-input {
          opacity: 0;
          position: absolute;
          pointer-events: none;
        }
      </style>
      <script nonce="${nonce}">
        // 即時関数でVSCodeのドラッグ&ドロップメッセージを抑制
        (function() {
          // VSCodeのドラッグ&ドロップメッセージを検出して非表示にする
          function suppressVSCodeDragDropMessage() {
            // ドラッグ&ドロップ関連のオーバーレイを監視して非表示にする
            const observer = new MutationObserver(function(mutations) {
              document.querySelectorAll('.monaco-editor .dnd-overlay, .monaco-dnd-overlay, [aria-label*="ドロップする"], [aria-label*="⌘"]').forEach(function(el) {
                if (el) {
                  el.style.display = 'none';
                  el.style.opacity = '0';
                  el.style.visibility = 'hidden';
                  el.style.pointerEvents = 'none';
                }
              });
            });
            
            // document全体を監視
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class']
            });
            
            // ドラッグ&ドロップイベントをキャプチャ
            ['dragstart', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(function(eventName) {
              document.addEventListener(eventName, function(e) {
                // VSCodeのオーバーレイを強制的に非表示
                document.querySelectorAll('.monaco-editor .dnd-overlay, .monaco-dnd-overlay, [aria-label*="ドロップする"], [aria-label*="⌘"]').forEach(function(el) {
                  if (el) el.style.display = 'none';
                });
              }, true);
            });
          }
          
          // DOM読み込み完了時または既に読み込まれている場合に実行
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', suppressVSCodeDragDropMessage);
          } else {
            suppressVSCodeDragDropMessage();
          }
        })();
      </script>
    </head>
    <body>
      <div class="scope-manager-container">
        <div class="main-content">
          <!-- 左側: プロジェクトナビゲーション -->
          <div class="project-nav">
            <button class="toggle-nav-btn" id="toggle-nav-btn" title="パネルを開閉">
              <span class="material-icons">chevron_left</span>
            </button>
            <div class="project-label">PRJ</div>
            <div class="filter-bar">
              <input type="text" class="search-input" placeholder="プロジェクト検索...">
            </div>
            <h3 style="margin-top: 10px;">プロジェクト</h3>
            
            <div class="project-actions">
              <button class="button button-secondary" id="new-project-btn">
                <span class="material-icons">add</span>
                新規作成
              </button>
              <button class="button button-secondary" id="load-project-btn">
                <span class="material-icons">folder_open</span>
                読み込む
              </button>
            </div>
            
            <div id="project-list" class="project-list">
              <!-- プロジェクトリストはJSで動的に生成 -->
            </div>
          </div>
          
          <!-- 右側: コンテンツエリア -->
          <div class="content-area">
            <!-- タブ付きカード -->
            <div class="card">
              <div class="tabs">
                <div class="project-display">
                  <span class="project-name">AppGenius</span>
                  <span class="project-path-display">/path/to/project</span>
                </div>
                <div class="tabs-container">
                  <div class="tab active" data-tab="current-status">プロジェクト状況</div>
                  <div class="tab" data-tab="claude-code">ClaudeCode連携</div>
                  <div class="tab" data-tab="tools">モックアップギャラリー</div>
                </div>
              </div>
              
              <!-- プロジェクト状況タブコンテンツ -->
              <div id="current-status-tab" class="tab-content active">
                <div class="card-body">
                  <div class="markdown-content">
                    <!-- ここにCURRENT_STATUS.mdの内容がマークダウン表示される -->
                    <p>読み込み中...</p>
                  </div>
                </div>
              </div>

              <!-- ClaudeCode連携タブコンテンツ -->
              <div id="claude-code-tab" class="tab-content">
                <div class="claude-share-container">
                  <!-- 左側：テキスト入力エリア -->
                  <div class="text-input-area">
                    <textarea class="share-textarea" placeholder="ここにClaudeCodeと共有したいテキストを入力..."></textarea>
                    <!-- ボタンエリア -->
                    <div class="action-buttons">
                      <button class="button button-secondary" id="clear-button">クリア</button>
                      <button class="button" id="share-to-claude">保存</button>
                    </div>
                    
                    <!-- 保存結果通知（成功時のみ表示） -->
                    <div class="save-notification" id="save-notification" style="display: none;">
                      <span class="material-icons success-icon">check_circle</span>
                      <span class="notification-text">保存完了</span>
                    </div>
                  </div>
                  
                  <!-- 右側：画像アップロードエリアと履歴 -->
                  <div class="image-upload-area">
                    <!-- ドロップゾーン -->
                    <div class="drop-zone" id="drop-zone">
                      <span class="material-icons">add_photo_alternate</span>
                      <p>画像をアップロード<br><span style="font-size: 12px; color: var(--app-text-secondary);">（ファイルをドラッグ＆ドロップ）</span></p>
                      <button class="button-secondary" id="file-select-btn">ブラウズ...</button>
                      <input type="file" id="file-input" accept="image/*" style="display: none;">
                    </div>
                    
                    <!-- 履歴表示エリア -->
                    <div class="history-container">
                      <h4>共有履歴</h4>
                      <div class="shared-history-list">
                        <!-- 履歴アイテムはJSで動的に生成 -->
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 開発ツールタブコンテンツ (モックアップギャラリー表示用のプレースホルダ) -->
              <div id="tools-tab" class="tab-content">
                <!-- モックアップギャラリーを表示するための空のコンテナ -->
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 開発プロンプトモーダル -->
      <div class="toggle-share-btn" id="toggle-share-btn" style="display: flex;">
        <span class="material-icons">description</span>
        <span>開発プロンプト</span>
      </div>
      
      <div class="claude-code-share-area" id="claude-code-share">
        <div class="claude-code-share-header">
          <h3>開発プロンプト</h3>
          <div>
            <button class="button button-secondary" id="minimize-share-btn">
              <span class="material-icons">expand_more</span>
            </button>
          </div>
        </div>
        
        <!-- プロンプトグリッド - 初期表示要素なし、JSで動的に生成 -->
        <div class="prompt-grid">
          <!-- プロンプトカードはJSで動的に生成 -->
        </div>
      </div>
      
      <div id="error-container" style="display: none; position: fixed; bottom: 20px; right: 20px; background-color: var(--app-danger); color: white; padding: 10px; border-radius: 4px;"></div>
      
      <!-- メインスクリプト -->
      <script nonce="${nonce}" src="${scriptUri}"></script>
      
      <!-- 共有パネルコンポーネント専用スクリプト -->
      <script nonce="${nonce}" src="${sharingPanelScriptUri}"></script>
    </body>
    </html>`;
  }

  /**
   * ステータスファイルを読み込む
   * FileSystemServiceの機能を利用
   */
  private async _loadStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath || !this._projectPath) {
        return;
      }

      // FileSystemServiceを使用してdocsディレクトリの存在を確認・作成
      const docsDir = path.join(this._projectPath, 'docs');
      await this._fileSystemService.ensureDirectoryExists(docsDir);

      // FileSystemServiceを使用してステータスファイルの存在を確認
      const fileExists = await this._fileSystemService.fileExists(this._statusFilePath);

      // ステータスファイルが存在しない場合はテンプレートを作成
      if (!fileExists) {
        Logger.info('CURRENT_STATUS.mdファイルが存在しないため、テンプレートを作成します');
        
        // プロジェクト名をディレクトリ名から取得
        const projectName = path.basename(this._projectPath);
        
        // FileSystemServiceを使用してプロジェクトのデフォルトステータスファイルを作成
        await this._fileSystemService.createDefaultStatusFile(this._projectPath, projectName);
        Logger.info(`CURRENT_STATUS.mdファイルを作成しました: ${this._statusFilePath}`);
      }

      // マークダウン表示を更新するためにファイルを読み込み
      await this._handleGetMarkdownContent(this._statusFilePath);
    } catch (error) {
      Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
      this._showError(`ステータスファイルの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }


  /**
   * ディレクトリ構造を更新する
   */
  private async _updateDirectoryStructure(): Promise<void> {
    if (!this._projectPath) {
      return;
    }
    
    try {
      // FileSystemServiceを使用してディレクトリ構造を取得
      this._directoryStructure = await this._fileSystemService.getDirectoryStructure(this._projectPath);
      Logger.info(`FileSystemServiceを使用してディレクトリ構造を取得しました: ${this._projectPath}`);
    } catch (error) {
      Logger.error('ディレクトリ構造の取得中にエラーが発生しました', error as Error);
      this._directoryStructure = 'ディレクトリ構造の取得に失敗しました。';
    }
  }

  /**
   * ファイル監視を設定する
   * FileSystemServiceの拡張機能を利用
   */
  private async _setupFileWatcher(): Promise<void> {
    try {
      // 既存の監視があれば破棄
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
        this._fileWatcher = null;
      }
      
      if (this._docsDirWatcher) {
        this._docsDirWatcher.close();
        this._docsDirWatcher = null;
      }
      
      if (!this._projectPath || !this._statusFilePath) {
        return;
      }
      
      // docsディレクトリの存在確認
      const docsDir = path.join(this._projectPath, 'docs');
      await this._fileSystemService.ensureDirectoryExists(docsDir);
      
      // 拡張されたファイル監視機能を使用して監視を設定
      this._fileWatcher = this._fileSystemService.setupEnhancedFileWatcher(
        this._statusFilePath,
        async (filePath) => {
          // ファイル変更を検出したらマークダウンを更新
          Logger.info(`ScopeManagerPanel: ファイル変更を検出して内容を更新: ${filePath}`);
          await this._handleGetMarkdownContent(filePath);
        },
        { delayedReadTime: 100 } // 100ms後に2回目の読み込みを実行
      );
      
      // イベントリスナーも設定
      const eventListener = this._fileSystemService.setupStatusFileEventListener(
        this._projectPath,
        this._statusFilePath,
        async (filePath) => {
          // イベントバス経由の通知を受けた場合もマークダウンを更新
          Logger.info(`ScopeManagerPanel: イベントバス経由でファイル更新を検出: ${filePath}`);
          await this._handleGetMarkdownContent(filePath);
        }
      );
      
      // イベントリスナーをdisposablesに追加
      this._disposables.push(eventListener);
      
      Logger.info('ScopeManagerPanel: ファイル監視設定完了 - 拡張FileSystemServiceを使用');
    } catch (error) {
      Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * デフォルトテンプレートを取得
   */
  // _getDefaultTemplateメソッドはFileSystemServiceに移動したため削除
  
  /**
   * ProjectServiceのイベントリスナーを設定
   */
  private _setupProjectServiceEventListeners(): void {
    try {
      // ProjectServiceのイベントを購読
      // プロジェクト選択イベント
      this._disposables.push(
        this._projectService.onProjectSelected((projectInfo) => {
          Logger.info(`ProjectServiceからプロジェクト選択イベントを受信: ${projectInfo.name}`);
          
          // WebViewにプロジェクト選択状態を通知
          this._panel.webview.postMessage({
            command: 'updateProjectName',
            projectName: projectInfo.name
          });
          
          // プロジェクトパスを更新
          if (projectInfo.path !== this._projectPath) {
            this.setProjectPath(projectInfo.path);
          }
        })
      );
      
      // プロジェクト作成イベント
      this._disposables.push(
        this._projectService.onProjectCreated((projectInfo) => {
          Logger.info(`ProjectServiceからプロジェクト作成イベントを受信: ${projectInfo.name}`);
          
          // プロジェクト一覧を更新して表示
          const allProjects = this._projectService.getAllProjects();
          this._panel.webview.postMessage({
            command: 'updateProjects',
            projects: allProjects,
            activeProject: projectInfo
          });
        })
      );
      
      // プロジェクト削除イベント
      this._disposables.push(
        this._projectService.onProjectRemoved((projectInfo) => {
          Logger.info(`ProjectServiceからプロジェクト削除イベントを受信: ${projectInfo.name}`);
          
          // プロジェクト一覧を更新して表示
          const allProjects = this._projectService.getAllProjects();
          const activeProject = this._projectService.getActiveProject();
          
          this._panel.webview.postMessage({
            command: 'updateProjects',
            projects: allProjects,
            activeProject: activeProject
          });
          
          // 現在のプロジェクトが削除されたプロジェクトと同じ場合、別のプロジェクトへ切り替え
          if (this._projectPath === projectInfo.path) {
            if (activeProject && activeProject.path) {
              this.setProjectPath(activeProject.path);
            } else if (allProjects.length > 0) {
              this.setProjectPath(allProjects[0].path);
            }
          }
        })
      );
      
      // プロジェクト一覧更新イベント
      this._disposables.push(
        this._projectService.onProjectsUpdated((projects) => {
          Logger.info(`ProjectServiceからプロジェクト一覧更新イベントを受信: ${projects.length}件`);
          
          // WebViewにプロジェクト一覧を通知
          const activeProject = this._projectService.getActiveProject();
          this._panel.webview.postMessage({
            command: 'updateProjects',
            projects: projects,
            activeProject: activeProject
          });
        })
      );
      
      Logger.info('ProjectServiceのイベントリスナー設定完了');
    } catch (error) {
      Logger.error('ProjectServiceのイベントリスナー設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * nonce値を生成
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
  
  // 未使用のメソッドを削除しました

  /**
   * リソースを解放
   */
  public dispose(): void {
    if (ScopeManagerPanel.currentPanel === this) {
      ScopeManagerPanel.currentPanel = undefined;
    }

    // パネル自体を破棄
    this._panel.dispose();

    // ファイルウォッチャーを破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    // Node.jsのファイルシステムウォッチャーも破棄
    if (this._docsDirWatcher) {
      this._docsDirWatcher.close();
      this._docsDirWatcher = null;
    }
    
    // FileSystemServiceのリソースを解放
    if (this._fileSystemService) {
      this._fileSystemService.dispose();
    }
    
    // 共有サービスのリソースを解放
    this._sharingService.dispose();

    // disposable なオブジェクトを破棄
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * 指定されたプロジェクトがアクティブであることを確認し、必要に応じて選択状態を更新
   * WebViewとバックエンドの状態を同期する目的で使用
   * ProjectServiceを使用して実装
   */
  private async _handleEnsureActiveProject(projectName: string, projectPath: string, activeTab?: string): Promise<void> {
    try {
      // 現在のアクティブプロジェクトを取得
      const activeProject = this._projectService.getActiveProject();
      
      // 指定されたプロジェクトが現在のアクティブプロジェクトと一致するか確認
      if (activeProject && activeProject.path === projectPath) {
        Logger.info(`既にアクティブなプロジェクトです: ${projectName}`);
        
        // タブ状態を更新する場合は、ProjectServiceを介してsaveTabStateを呼び出す
        if (activeTab && activeProject.id) {
          await this._projectService.saveTabState(activeProject.id, activeTab);
          Logger.info(`タブ状態を更新しました: ${activeTab}`);
        }
      } else {
        // アクティブプロジェクトが一致しない場合は、指定されたプロジェクトをアクティブに設定
        await this._handleSelectProject(projectName, projectPath, activeTab);
        Logger.info(`プロジェクトをアクティブに設定しました: ${projectName}`);
      }
    } catch (error) {
      Logger.error('プロジェクトの同期に失敗しました', error as Error);
    }
  }

  /**
   * 認証状態の監視を設定
   * 1分ごとに認証状態をチェックし、無効になった場合はパネルを閉じてログイン画面に誘導
   */
  private _setupTokenExpirationMonitor() {
    try {
      // 1分ごとに認証状態をチェック
      const interval = setInterval(() => {
        try {
          // ログイン状態をチェック
          if (!AuthGuard.checkLoggedIn()) {
            Logger.info('スコープマネージャー: 認証状態が無効になったため、パネルを閉じます');
            // パネルを閉じる
            this.dispose();
            // ログイン画面に直接遷移
            const { LoginWebviewPanel } = require('../auth/LoginWebviewPanel');
            LoginWebviewPanel.createOrShow(this._extensionUri);
            return;
          }

          // 権限チェック
          if (!ProtectedPanel.checkPermissionForFeature(ScopeManagerPanel._feature, 'ScopeManagerPanel')) {
            Logger.warn('スコープマネージャー: 権限が失効したため、パネルを閉じます');
            // パネルを閉じる
            this.dispose();
            vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がなくなりました。');
            return;
          }
        } catch (checkError) {
          Logger.error('認証状態チェック中にエラーが発生しました', checkError as Error);
        }
      }, 60000); // 1分ごとにチェック
      
      // パネル破棄時にインターバルをクリア
      this._disposables.push({ dispose: () => clearInterval(interval) });
      
      Logger.info('スコープマネージャー: 認証状態監視を開始しました');
    } catch (error) {
      Logger.error('認証状態監視の設定中にエラーが発生しました', error as Error);
    }
  }
}