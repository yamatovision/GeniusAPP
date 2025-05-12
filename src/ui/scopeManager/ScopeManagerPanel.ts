
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
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';
import { PromptServiceClient } from '../../services/PromptServiceClient';
import { SharedFile, FileSaveOptions } from '../../types/SharingTypes';
import { IFileSystemService, FileSystemService } from './services/FileSystemService';
import { IProjectService, ProjectService } from './services/ProjectService';
import { ISharingService, SharingService } from './services/SharingService';
import { IAuthenticationHandler, AuthenticationHandler } from './services/AuthenticationHandler';
import { IUIStateService, UIStateService } from './services/UIStateService';
import { ServiceFactory } from './services/ServiceFactory';
import { ITabStateService, TabStateService } from './services/TabStateService';
import { IMessageDispatchService } from './services/interfaces/IMessageDispatchService';
import { IFileWatcherService, FileWatcherService } from './services/FileWatcherService';
import { IProjectInfo } from './types/ScopeManagerTypes';
import { ScopeManagerTemplate } from './templates/ScopeManagerTemplate';
import { HtmlTemplateGenerator } from './templates/HtmlTemplateGenerator';

/**
 * スコープマネージャーパネルクラス
 * SCOPE_PROGRESS.mdファイルと連携して実装スコープの管理を行う
 * 権限保護されたパネルの基底クラスを継承
 */
export class ScopeManagerPanel extends ProtectedPanel {
  public static currentPanel: ScopeManagerPanel | undefined;
  private static readonly viewType = 'scopeManager';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.SCOPE_MANAGER;


  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _extensionPath: string; // 拡張機能のファイルシステムパス（テンプレート読み込みに使用）
  private _disposables: vscode.Disposable[] = [];

  private _projectPath: string = '';
  private _fileManager: FileOperationManager;
  private _progressFilePath: string = '';
  private _fileWatcher: vscode.Disposable | null = null;
  private _tempShareDir: string = '';
  private _promptServiceClient: PromptServiceClient;
  private _sharingService: ISharingService; // 共有サービス
  private _activeProject: IProjectInfo | null = null; // 現在選択中のプロジェクト
  private _fileSystemService: IFileSystemService; // FileSystemServiceのインスタンス
  private _projectService: IProjectService; // ProjectServiceのインスタンス
  private _authHandler: IAuthenticationHandler; // AuthenticationHandlerのインスタンス
  private _uiStateService: IUIStateService; // UI状態管理サービス
  private _tabStateService: ITabStateService; // タブ状態管理サービス
  private _fileWatcherService: IFileWatcherService; // ファイル監視サービス

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string): ScopeManagerPanel | undefined {
    // プロジェクトパスの有効性をチェック - プロジェクト未選択状態の可能性があるため
    if (!projectPath || projectPath.trim() === '') {
      try {
        // 直接ProjectServiceImplを使用してプロジェクト確認 - 最もシンプルで信頼性の高い方法
        const { ProjectServiceImpl } = require('./services/implementations/ProjectServiceImpl');
        const { FileSystemServiceImpl } = require('./services/implementations/FileSystemServiceImpl');

        const fileSystemService = FileSystemServiceImpl.getInstance();
        const projectService = ProjectServiceImpl.getInstance(fileSystemService);

        // プロジェクト一覧を取得
        const allProjects = projectService.getAllProjects();
        const activeProject = projectService.getActiveProject();

        Logger.info(`ScopeManagerPanel.createOrShow: プロジェクト数=${allProjects.length}, アクティブプロジェクト=${activeProject ? activeProject.name : 'なし'}`);

        // プロジェクトが1件も存在しないか、アクティブプロジェクトがない場合はNoProjectViewを表示
        if (allProjects.length === 0 || !activeProject) {
          // プロジェクトが選択されていない場合はNoProjectViewを表示
          const { NoProjectViewPanel } = require('../../ui/noProjectView/NoProjectViewPanel');
          Logger.info('ScopeManagerPanel: プロジェクトが存在しないか選択されていないため、プロジェクト選択画面を表示します');
          NoProjectViewPanel.createOrShow(extensionUri);
          return undefined;
        }

        // プロジェクトがあればそのパスを使用
        projectPath = activeProject.path;
        Logger.info(`ScopeManagerPanel: アクティブプロジェクトを使用します: ${projectPath}`);
      } catch (error) {
        // エラーが発生した場合はログ出力のみ
        Logger.warn('ScopeManagerPanel: プロジェクト判定中にエラーが発生しました - 通常モードで続行します', error as Error);
      }
    }

    // 認証ハンドラーを取得
    const authHandler = AuthenticationHandler.getInstance();

    // 認証チェック：ログインしていない場合はログイン画面に直接遷移
    if (!authHandler.checkLoggedIn()) {
      Logger.info('スコープマネージャー: 未認証のためログイン画面に誘導します');
      // ログイン画面を表示
      authHandler.showLoginScreen(extensionUri);
      return undefined;
    }

    // 権限チェック：SCOPE_MANAGERの権限がない場合はアクセスを拒否
    if (!authHandler.checkPermission(ScopeManagerPanel._feature)) {
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
    // webview options にDebugReplのツリー入力初期化プロパティを追加
    const webviewOptions = {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'media'),
        vscode.Uri.joinPath(extensionUri, 'dist'),
        vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
      ],
      // @ts-ignore - VSCodeの内部プロパティにアクセス（DebugRepl対策）
      treeInput: {} // DebugReplのツリー入力を初期化（TreeErrorを防止）
    };
    
    // WebViewパネル作成
    const panel = vscode.window.createWebviewPanel(
      ScopeManagerPanel.viewType,
      'AppGenius スコープマネージャー',
      column || vscode.ViewColumn.One,
      webviewOptions
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
    
    // 認証ハンドラーを初期化
    this._authHandler = AuthenticationHandler.getInstance();
    
    // UI状態管理サービスを初期化
    this._uiStateService = UIStateService.getInstance(panel, extensionUri);
    
    // タブ状態管理サービスを初期化
    this._tabStateService = TabStateService.getInstance();

    // FileWatcherServiceを初期化
    this._fileWatcherService = FileWatcherService.getInstance();

    // ServiceFactoryを通じてサービスを初期化
    ServiceFactory.initialize(extensionUri, context);
    
    // すべての依存関係を設定
    ServiceFactory.setupDependencies();
    
    // 標準メッセージハンドラを登録
    ServiceFactory.registerStandardHandlers();
    
    // 一時ディレクトリはプロジェクトパス設定時に作成されるため、ここでは初期化のみ
    this._tempShareDir = '';
    
    // 認証状態の監視を設定 (1分ごとにチェック)
    this._setupTokenExpirationMonitor();
    
    // 認証状態変更イベントをAuthenticationHandlerから監視
    try {
      const authStateChangedDisposable = this._authHandler.onAuthStateChanged(state => {
        // 認証状態が未認証になった、または権限がなくなった場合
        if (!state.isAuthenticated || !this._authHandler.checkPermission(ScopeManagerPanel._feature)) {
          Logger.info('スコープマネージャー: 認証状態が変更されたため、パネルを閉じます');
          // パネルを閉じる
          this.dispose();
          
          if (!state.isAuthenticated) {
            // ログイン画面に誘導
            this._authHandler.showLoginScreen(this._extensionUri);
          }
        }
      });
      
      // Disposableリストに追加
      this._disposables.push(authStateChangedDisposable);
      Logger.info('スコープマネージャー: 認証状態変更イベントの監視を開始しました');
    } catch (error) {
      Logger.error('認証状態変更イベントの監視設定中にエラーが発生しました', error as Error);
    }
    
    // FileSystemServiceのイベントリスナー設定（ファイルブラウザ関連は削除）
    
    // アクティブプロジェクトを取得
    const activeProject = this._projectService.getActiveProject();
      
    // アクティブプロジェクトが指定されていない場合は、引数または現在のアクティブプロジェクトを使用
    if (!projectPath && activeProject && activeProject.path) {
      projectPath = activeProject.path;
      Logger.info(`アクティブプロジェクトパスを使用: ${projectPath}`);
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
    
    // MessageDispatchServiceのインスタンスをServiceFactory経由で取得
    const dispatchService = ServiceFactory.getMessageService();
    this._disposables.push(
      dispatchService.setupMessageReceiver(this._panel)
    );
    
    // 基本ハンドラーを登録
    this._registerBasicMessageHandlers();
    
    // タブ状態サービスのメッセージハンドラーを登録
    this._tabStateService.registerMessageHandlers(dispatchService);

    // 共有関連のメッセージは直接このクラスで処理するため、
    // MessageDispatchServiceへの登録は不要になりました
    
    // 残りのメッセージハンドラーは個別に登録（段階的に移行予定）
    this._panel.webview.onDidReceiveMessage(
      async message => {
        try {

          switch (message.command) {
            case 'initialize':
              await this._handleInitialize();
              break;
            case 'getMarkdownContent':
              await this._handleGetMarkdownContent(message.filePath);
              break;
            // タブ関連処理はTabStateServiceに移行済み
            // これらのケースはTabStateServiceがハンドリングするため、ここでは何もしない
            case 'saveTabState':
            case 'loadFileToTab':
            case 'loadRequirementsFile':
              // TabStateServiceが処理するため何もしない
              break;
            // ファイルブラウザ関連
            // 削除済み: refreshFileBrowser ケース
              break;
            // ファイル操作関連はすべてFileSystemServiceへ移行済み
            case 'openFile':
            case 'navigateDirectory':
            case 'listDirectory':
            case 'openFileInEditor':
              // MessageDispatchServiceが処理するため何もしない
              break;
            // 新しいコマンド
            case 'launchPromptFromURL':
              // splitTerminalパラメータを明示的に処理
              const splitTerminalValue = message.splitTerminal === true ? true : false;
              Logger.info(`【メッセージ変換】splitTerminal: ${message.splitTerminal} => ${splitTerminalValue}`);
              await this._handleLaunchPromptFromURL(message.url, message.index, message.name, splitTerminalValue);
              break;
            case 'saveSharedTextContent':
              await this._handleSaveSharedTextContent(message.content);
              break;
            case 'shareText':
              await this._handleShareText(message.text, message.suggestedFilename);
              break;
            case 'shareImage':
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

            case 'openMarkdownViewer':
              await this._handleOpenMarkdownViewer();
              break;
            
            // 共有関連処理
            case 'getHistory':
              await this._handleGetHistory();
              break;
            case 'deleteFromHistory':
              if (message.fileId) {
                await this._handleDeleteFromHistory(message.fileId);
              } else {
                Logger.warn('ScopeManagerPanel: deleteFromHistoryメッセージにfileId必須パラメータがありません');
                this._showError('履歴項目IDが指定されていません');
              }
              break;
            case 'copyCommand':
              if (message.fileId) {
                await this._handleCopyCommand(message.fileId);
              } else {
                Logger.warn('ScopeManagerPanel: copyCommandメッセージにfileId必須パラメータがありません');
                this._showError('コピー対象のファイルIDが指定されていません');
              }
              break;
            case 'copyToClipboard':
              if (message.text) {
                await this._handleCopyToClipboard(message.text);
              } else {
                Logger.warn('ScopeManagerPanel: copyToClipboardメッセージにtext必須パラメータがありません');
                this._showError('コピーするテキストが指定されていません');
              }
              break;
            case 'reuseHistoryItem':
              await this._handleReuseHistoryItem(message.fileId);
              break;
              
            // プロジェクト選択処理は直接ハンドリング（MessageDispatchServiceを使わない）
            case 'selectProject':
              if (message.projectName && message.projectPath) {
                await this._handleSelectProject(message.projectName, message.projectPath, message.activeTab);
              } else {
                Logger.warn('ScopeManagerPanel: selectProjectメッセージに必要なパラメータがありません');
                this._showError('プロジェクト選択に必要な情報が不足しています');
              }
              break;
              
            // その他のプロジェクト関連処理はMessageDispatchServiceに移行済み
            case 'createProject':
            case 'removeProject':
              // MessageDispatchServiceが処理するため何もしない
              break;
              
            case 'loadExistingProject':
              await this._handleLoadExistingProject();
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
   * @deprecated ServiceFactory.getMessageService().createProjectを使用してください。
   */
  private async _handleCreateProject(projectName: string, description: string): Promise<void> {
    Logger.warn('_handleCreateProjectは非推奨です。ServiceFactory経由でサービスにアクセスしてください。');
    
    // ServiceFactory経由でMessageServiceを取得
    const messageService = ServiceFactory.getMessageService();
    await messageService.createProject(this._panel, projectName, description);
  }
  
  /**
   * 既存プロジェクトの読み込み処理
   * ProjectServiceを使用して実装
   */
  private async _handleLoadExistingProject(): Promise<void> {
    try {
      Logger.info('既存プロジェクト読み込み処理を開始');
      
      // プロジェクトパスを選択するダイアログを表示
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'プロジェクトフォルダを選択',
        title: '既存プロジェクトの選択'
      });
      
      if (!folderUri || folderUri.length === 0) {
        Logger.info('プロジェクト読み込みがキャンセルされました: フォルダが選択されていません');
        return;
      }
      
      // 選択されたプロジェクトパスを使用
      const projectPath = folderUri[0].fsPath;
      
      // ProjectServiceを使用して既存プロジェクトを読み込む
      const projectInfo = await this._projectService.loadExistingProject(projectPath);
      
      // プロジェクトパスを更新
      if (projectInfo && projectInfo.path) {
        // プロジェクトパスを設定
        this.setProjectPath(projectInfo.path);
        
        // プロジェクトの最新情報を取得
        const activeProject = this._projectService.getActiveProject();
        const allProjects = this._projectService.getAllProjects();
        
        // アクティブプロジェクトを保存
        this._activeProject = activeProject;
        
        // WebViewにプロジェクト一覧を更新
        this._panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // 進捗ファイルの内容も読み込んで表示
        const progressFilePath = this._projectService.getProgressFilePath();
        if (progressFilePath && fs.existsSync(progressFilePath)) {
          await this._handleGetMarkdownContent(progressFilePath);
          
          // 進捗状況タブを選択状態にする
          this._panel.webview.postMessage({
            command: 'selectTab',
            tabId: 'scope-progress'
          });
          
          Logger.info('プロジェクト読み込み後に進捗状況タブを選択状態にしました');
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
   * プロジェクトパスを設定 - 各サービスに委譲
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    try {
      this._projectPath = projectPath;
      
      // ProjectServiceにプロジェクトパスを設定
      await this._projectService.setProjectPath(projectPath);
      
      // 進捗ファイルパスをProjectServiceから取得
      this._progressFilePath = this._projectService.getProgressFilePath();
      
      // 既存のファイルウォッチャーを破棄
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
        this._fileWatcher = null;
      }
      
      // 一時ディレクトリを設定
      this._tempShareDir = path.join(projectPath, '.appgenius_temp');
      await this._fileSystemService.ensureDirectoryExists(this._tempShareDir);
      
      // 関連サービスにプロジェクトパスを設定
      this._promptServiceClient.setProjectPath(projectPath);
      this._sharingService.setProjectBasePath(projectPath);
      
      // ファイルウォッチャーと進捗ファイルを設定
      this._setupFileWatcher();
      this._loadProgressFile();
      
      // WebViewにプロジェクト情報を送信
      this._panel.webview.postMessage({
        command: 'updateProjectPath',
        projectPath: this._projectPath,
        progressFilePath: this._progressFilePath,
        progressFileExists: fs.existsSync(this._progressFilePath)
      });
      
      // プロジェクト一覧を更新
      const allProjects = this._projectService.getAllProjects();
      const activeProject = this._projectService.getActiveProject();
      
      this._panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
    } catch (error) {
      Logger.error(`プロジェクトパスの設定に失敗しました: ${error}`);
      throw error;
    }
  }

  /**
   * 初期化処理 - アクティブタブに応じた適切な初期化を行う
   */
  private async _handleInitialize(): Promise<void> {
    try {
      Logger.info('ScopeManagerPanel: 初期化処理を開始（最適化版）');

      // 最新のプロジェクト一覧を取得して送信（これは必須）
      await this._refreshProjects();

      // ActiveProject情報を最新化
      const activeProject = this._projectService.getActiveProject();
      const activeTab = activeProject?.metadata?.activeTab || 'scope-progress';

      Logger.info(`ScopeManagerPanel: 初期化時のアクティブタブ=${activeTab}`);

      // 選択されたタブに応じた初期化のみを実行（タブ固有の処理）
      if (activeTab === 'scope-progress' && this._progressFilePath && fs.existsSync(this._progressFilePath)) {
        // 進捗ファイルのみ読み込み（その他のタブは選択時に読み込む）
        await this._handleGetMarkdownContent(this._progressFilePath);
        Logger.info('進捗ファイルを初期読み込みしました');
      } else if (activeTab === 'requirements') {
        // 要件定義タブが選択されている場合は、FileWatcherServiceを使って
        // 要件定義ファイルを明示的に読み込む
        await this._fileWatcherService.loadRequirementsFileNow(
          this._projectPath,
          async (filePath: string) => {
            await this._handleGetMarkdownContent(filePath, { forRequirements: true });
          },
          { fileSystemService: this._fileSystemService }
        );
      }

      // この時点で強制的なタブ選択は行わない（UIが自動的に処理）
    } catch (error) {
      Logger.error('ScopeManagerPanel: 初期化処理中にエラーが発生しました', error as Error);
      this._showError(`初期化に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 要件定義ファイルの読み込み
   * docsディレクトリ内のrequirements.mdファイルを読み込んで表示
   */
  /**
   * @deprecated TabStateServiceに移行済み
   */
  private async _handleLoadRequirementsFile(): Promise<void> {
    // TabStateServiceに移行済み
    await this._tabStateService.loadRequirementsFile(this._panel);
  }
  
  // _initializeFileBrowserメソッドはFileSystemServiceに完全移行されました
  
  
  // _handleListDirectoryメソッドはFileSystemServiceに完全移行されました
  
  // _handleOpenFileInEditorメソッドはFileSystemServiceに完全移行されました
  
  // _handleNavigateDirectoryメソッドはFileSystemServiceに完全移行されました
  
  // _handleOpenFileメソッドはFileSystemServiceに完全移行されました
  
  /**
   * プロジェクト一覧を更新
   * ProjectServiceを使用して実装
   */
  private async _refreshProjects(): Promise<void> {
    try {
      // ProjectServiceの新しいrefreshProjectsListメソッドを使用
      const allProjects = await this._projectService.refreshProjectsList();
      const activeProject = this._projectService.getActiveProject();
      
      Logger.info(`プロジェクト一覧を更新しました: ${allProjects.length}件`);
      
      // WebViewにプロジェクト一覧を送信
      this._panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject ? {
          id: activeProject.id,
          name: activeProject.name,
          path: activeProject.path
        } : null
      });
    } catch (error) {
      Logger.error(`プロジェクト一覧の更新に失敗しました`, error as Error);
      this._showError(`プロジェクト一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロンプトURLからClaudeCodeを起動する
   * @param url プロンプトのURL
   * @param index プロンプトのインデックス
   * @param name プロンプト名（ターミナルタイトルに使用）
   * @param splitTerminal ターミナル分割モードを使用するかどうか
   */
  private async _handleLaunchPromptFromURL(url: string, index: number, name?: string, splitTerminal?: boolean): Promise<void> {
    try {
      // フロントエンドから送信されたURLとインデックスをそのまま使用
      // プロンプトの内容を取得して一時ファイルに保存（プロジェクトパスを指定）
      const promptFilePath = await this._promptServiceClient.fetchAndSavePrompt(url, index, this._projectPath);
      
      // ClaudeCodeを起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      
      const useSplitTerminal = splitTerminal === true;
      
      // UIのダイアログで「分割ターミナルで表示」が選択された場合のみtrueになる
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        {
          deletePromptFile: true, // 使用後に一時ファイルを削除
          splitTerminal: useSplitTerminal, // UIから指定された分割モードを使用
          promptType: name // プロンプト名をターミナルタイトルに反映
        }
      );
      
      if (success) {
        Logger.info(`ClaudeCode起動成功, 分割モード: ${useSplitTerminal ? '有効' : '無効'}`);
        
        // 成功通知をUIに送信（デバッグ用）
        this._panel.webview.postMessage({
          command: 'launchResult',
          success: true,
          splitTerminal: useSplitTerminal,
          message: `ClaudeCodeを起動しました (${useSplitTerminal ? '分割ターミナル' : '新しいタブ'})`
        });
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
   * マークダウンビューワーを開く
   */
  private async _handleOpenMarkdownViewer(): Promise<void> {
    try {
      // 現在のプロジェクトパスをログ出力
      Logger.info(`ScopeManagerPanel: マークダウンビューワーを開くリクエストを受信 (projectPath=${this._projectPath})`);

      // マークダウンビューワーを開く前に、アクティブなプロジェクトのタブを進捗状況タブに戻す
      // (モックアップギャラリータブと同様の動作)
      const activeProject = this._projectService.getActiveProject();
      if (activeProject && activeProject.id) {
        await this._tabStateService.saveTabState(activeProject.id, 'scope-progress');

        // WebViewにもタブ選択を通知
        this._panel.webview.postMessage({
          command: 'selectTab',
          tabId: 'scope-progress'
        });

        Logger.info('マークダウンビューワーを開く前に、進捗状況タブに切り替えました');
      }

      // 重要：直接拡張機能のコマンドを実行する前に、ProjectServiceImplを使ってプロジェクトを選択する
      // これにより、全体のシステム状態でのプロジェクト選択を確実に同期する
      if (this._projectPath) {
        try {
          // ProjectServiceImplを取得
          const { ProjectServiceImpl } = require('../scopeManager/services/implementations/ProjectServiceImpl');
          const projectService = ProjectServiceImpl.getInstance();

          // プロジェクト名を取得
          const projectName = path.basename(this._projectPath);

          // プロジェクトを明示的に選択
          await projectService.selectProject(projectName, this._projectPath);
          Logger.info(`マークダウンビューワーを開く前に、プロジェクトを明示的に選択: ${projectName}, ${this._projectPath}`);

          // 少し待機してプロジェクト選択が確実に処理されるようにする
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          Logger.warn(`プロジェクト選択に失敗しました: ${error}`);
        }
      }

      // コマンドを実行する前にグローバル状態を更新するのが重要
      global.__lastSelectedProjectPath = this._projectPath;

      // vscode.commandsを使用してマークダウンビューワーを開く
      // プロジェクトパスを明示的に渡す - 現在のアクティブなパスを使用
      await vscode.commands.executeCommand('appgenius-ai.openMarkdownViewer', this._projectPath);

      Logger.info(`マークダウンビューワーを開きました: プロジェクト=${this._projectPath}`);
      this._showSuccess('マークダウンビューワーを開きました');
    } catch (error) {
      Logger.error('マークダウンビューワーを開けませんでした', error as Error);
      this._showError('マークダウンビューワーを開けませんでした');
    }
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
  /**
   * @deprecated ServiceFactory経由でサービスにアクセスしてください
   */
  private async _handleGetHistory(): Promise<void> {
    try {
      // 直接SharingServiceを使用する
      const sharingService = ServiceFactory.getSharingService();
      const history = sharingService.getHistory();
      
      // 履歴情報をWebViewに送信
      this._panel.webview.postMessage({
        command: 'updateSharingHistory',
        history: history
      });
      
      Logger.info('ScopeManagerPanel: 共有履歴を取得して送信しました');
    } catch (error) {
      Logger.error('共有履歴の取得に失敗しました', error as Error);
      this._showError(`履歴の取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * テキストを共有サービスで共有 - SharingServiceに委譲
   */
  private async _handleShareText(text: any, suggestedFilename?: string): Promise<void> {
    try {
      // nullチェックとstring型の保証
      if (!text) {
        throw new Error('共有するテキストが指定されていません');
      }
      
      // 文字列でない場合は文字列に変換
      const textString = typeof text === 'string' ? text : String(text);
      
      // 共有オプションを設定
      const options: FileSaveOptions = {
        type: 'text',
        expirationHours: 24  // デフォルト有効期限
      };
      
      // 提案されたファイル名があれば使用
      if (suggestedFilename) {
        options.title = suggestedFilename;
        options.metadata = { suggestedFilename };
      }
      
      // エラーのデバッグログ
      Logger.info(`_handleShareText: テキスト共有を開始します [type=${typeof textString}, length=${textString.length}]`);
      
      // SharingServiceを使ってテキストを共有
      const file = await this._sharingService.shareText(textString, options);
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // 履歴を取得
      await this._handleGetHistory();
      
      // 結果をUIに通知
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
        
        // 履歴更新
        setTimeout(() => this._handleGetHistory(), 500);
      }, 100);
      
    } catch (error) {
      Logger.error('テキスト共有エラー', error as Error);
      this._showError(`テキストの共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 画像を共有サービスで共有 - SharingServiceに委譲
   */
  private async _handleShareImage(imageData: any, fileName: string): Promise<void> {
    try {
      // nullチェックとstring型の保証
      if (!imageData) {
        throw new Error('共有する画像データが指定されていません');
      }
      
      // 文字列でない場合は文字列に変換
      const imageDataString = typeof imageData === 'string' ? imageData : String(imageData);
      
      // エラーのデバッグログ
      Logger.info(`_handleShareImage: 画像共有を開始します [type=${typeof imageDataString}, length=${imageDataString.length}]`);
      
      // SharingServiceを使って画像を共有
      const file = await this._sharingService.shareImage(imageDataString, fileName);
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // 履歴を更新
      await this._handleGetHistory();
      
      // UIをリセット
      this._panel.webview.postMessage({
        command: 'resetDropZone',
        force: true,
        timestamp: new Date().getTime()
      });
      
      // 念のため再度リセット
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: 'resetDropZone',
          force: true,
          timestamp: new Date().getTime() + 100
        });
      }, 100);
      
      // 結果をUIに通知
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: 'showShareResult',
          data: {
            filePath: file.path,
            command: command,
            type: 'image'
          }
        });
        
        // 履歴更新
        setTimeout(() => this._handleGetHistory(), 500);
      }, 100);
      
    } catch (error) {
      this._showError(`画像の共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 履歴からアイテムを削除
   */
  /**
   * @deprecated ServiceFactory経由でサービスにアクセスしてください
   */
  private async _handleDeleteFromHistory(fileId: string): Promise<void> {
    try {
      // 直接SharingServiceを使用する
      const sharingService = ServiceFactory.getSharingService();
      const result = sharingService.deleteFromHistory(fileId);
      
      if (result) {
        // 履歴を更新して送信
        const history = sharingService.getHistory();
        this._panel.webview.postMessage({
          command: 'updateSharingHistory',
          history: history
        });
        
        Logger.info(`ScopeManagerPanel: ファイルID=${fileId}を履歴から削除しました`);
      } else {
        Logger.warn(`ScopeManagerPanel: ファイルID=${fileId}の削除に失敗しました`);
        this._showError('履歴から項目を削除できませんでした');
      }
    } catch (error) {
      Logger.error(`履歴からの削除に失敗しました: ファイルID=${fileId}`, error as Error);
      this._showError(`履歴からの削除に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ファイルのコマンドをクリップボードにコピー
   */
  /**
   * @deprecated ServiceFactory経由でサービスにアクセスしてください
   */
  private async _handleCopyCommand(fileId: string): Promise<void> {
    try {
      // 直接SharingServiceを使用する
      const sharingService = ServiceFactory.getSharingService();
      const command = await sharingService.getCommandByFileId(fileId);
      
      if (command) {
        // クリップボードにコピー
        await vscode.env.clipboard.writeText(command);
        
        // コピー成功通知
        this._panel.webview.postMessage({
          command: 'commandCopied',
          fileId: fileId
        });
        
        Logger.info(`ScopeManagerPanel: ファイルID=${fileId}のコマンドをコピーしました`);
      } else {
        Logger.warn(`ScopeManagerPanel: ファイルID=${fileId}のコマンド生成に失敗しました`);
        this._showError('コマンドが見つかりませんでした');
      }
    } catch (error) {
      Logger.error(`コマンドのコピーに失敗しました: fileId=${fileId}`, error as Error);
      this._showError(`コマンドのコピーに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * テキストをクリップボードにコピー
   */
  /**
   * @deprecated ServiceFactory経由でサービスにアクセスしてください
   */
  private async _handleCopyToClipboard(text: string): Promise<void> {
    // MessageDispatchServiceに移行済み
    const messageService = ServiceFactory.getMessageService();
    await messageService.copyToClipboard(this._panel, text);
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
   * @param projectName プロジェクト名
   * @param projectPath プロジェクトパス
   * @param activeTab 現在のアクティブタブID（オプション）
   */
  private async _handleSelectProject(projectName: string, projectPath: string, activeTab?: string): Promise<void> {
    try {
      Logger.info(`ScopeManagerPanel: プロジェクト選択処理を開始: ${projectName}, パス: ${projectPath}`);
      
      // 直接ProjectServiceImplを使用してプロジェクトを選択
      await this._projectService.selectProject(projectName, projectPath, activeTab);
      
      // プロジェクト情報を取得
      const activeProject = this._projectService.getActiveProject();
      
      if (activeProject) {
        // プロジェクトパスを更新
        await this.setProjectPath(activeProject.path);
        
        // WebViewにプロジェクト選択状態を通知
        this._panel.webview.postMessage({
          command: 'syncProjectState',
          project: activeProject
        });
        
        // 成功メッセージをWebViewに通知
        this._panel.webview.postMessage({
          command: 'showSuccess',
          message: `プロジェクト「${projectName}」を開きました`
        });
        
        Logger.info(`ScopeManagerPanel: プロジェクト「${projectName}」の選択が完了しました`);
      } else {
        this._showError(`プロジェクト「${projectName}」の選択に失敗しました`);
      }
    } catch (error) {
      Logger.error(`ScopeManagerPanel: プロジェクト選択中にエラーが発生しました: ${projectName}`, error as Error);
      this._showError(`プロジェクト「${projectName}」の選択に失敗しました: ${(error as Error).message}`);
    }
  }

  
  /**
   * 特定のタブにファイルを読み込んで表示
   * @param tabId 表示対象のタブID
   * @param filePath 読み込むファイルパス
   */
  /**
   * @deprecated TabStateServiceに移行済み
   */
  private async _handleLoadFileToTab(tabId: string, filePath: string): Promise<void> {
    // TabStateServiceに移行済み
    await this._tabStateService.loadFileToTab(this._panel, tabId, filePath);
  }
  
  /**
   * ファイルブラウザを更新は別メソッドに統合
   */
  
  /**
   * ディレクトリを開いてファイル一覧を表示
   * @param dirPath ディレクトリパス
   */

  /**
   * @deprecated TabStateServiceに移行済み
   */
  private async _handleSaveTabState(tabId: string): Promise<void> {
    if (this._activeProject && this._activeProject.id) {
      // TabStateServiceに移行済み
      await this._tabStateService.saveTabState(this._activeProject.id, tabId);
      
      // アクティブプロジェクトを再取得して内部状態を更新
      this._activeProject = this._projectService.getActiveProject();
      
      // WebViewにプロジェクト状態同期メッセージを送信
      if (this._activeProject) {
        this._panel.webview.postMessage({
          command: 'syncProjectState',
          project: this._activeProject
        });
      }
    }
  }

  /**
   * マークダウンファイルの内容を取得して表示
   * @param filePath ファイルパス
   * @param options オプション（forceRefreshなど）
   */
  private async _handleGetMarkdownContent(filePath: string, options: { forceRefresh?: boolean, forRequirements?: boolean } = {}): Promise<void> {
    try {
      // FileSystemServiceを使用してマークダウンファイルを読み込む
      const content = await this._fileSystemService.readMarkdownFile(filePath);
      
      // 進捗ファイルかどうかを判定
      const isScopeProgressFile = filePath.endsWith('SCOPE_PROGRESS.md');
      const isRequirementsFile = filePath.endsWith('requirements.md');
      
      // WebViewにマークダウン内容を送信 - 優先度高で即時処理を要求
      this._panel.webview.postMessage({
        command: 'updateMarkdownContent',
        content: content,
        timestamp: Date.now(), // タイムスタンプを追加して新しい更新を識別できるように
        priority: 'high',      // 優先度の高い更新であることを示す
        forScopeProgress: isScopeProgressFile, // 進捗状況タブ用の更新であることを示す
        forRequirements: isRequirementsFile || options.forRequirements, // 要件定義タブ用の更新
        forceRefresh: options.forceRefresh // 強制更新フラグ
      });
      
      Logger.info(`FileSystemServiceを使用してマークダウンコンテンツを読み込みました: ${filePath}`);
    } catch (error) {
      Logger.error(`マークダウンコンテンツの読み込みに失敗しました: ${filePath}`, error as Error);
      this._showError(`マークダウンファイルの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  private _registerBasicMessageHandlers(): void {
    const messageService = ServiceFactory.getMessageService();
    const handlers = new Map<string, (message: any, panel: vscode.WebviewPanel) => Promise<void>>();

    // showErrorハンドラー
    handlers.set('showError', async (message, panel) => {
      this._uiStateService.showError(message.message);
    });

    // showSuccessハンドラー
    handlers.set('showSuccess', async (message, panel) => {
      this._uiStateService.showSuccess(message.message);
    });

    messageService.registerHandlers(handlers);
  }

  /**
   * 共有テキスト内容の保存処理
   * @param content テキスト内容
   */
  private async _handleSaveSharedTextContent(content: string): Promise<void> {
    try {
      // コンテキストのグローバル状態に保存
      const context = (global as any).extensionContext;
      if (!context) {
        Logger.error('拡張機能コンテキストが取得できません');
        return;
      }

      // グローバル状態に保存
      await context.globalState.update('sharedTextContent', content);
      Logger.info('共有テキスト内容を保存しました', { length: content.length });
    } catch (error) {
      Logger.error('共有テキスト内容の保存に失敗しました', error as Error);
    }
  }

  /**
   * 保存された共有テキスト内容の取得
   */
  private _getSharedTextContent(): string {
    try {
      // コンテキストのグローバル状態から取得
      const context = (global as any).extensionContext;
      if (!context) {
        Logger.error('拡張機能コンテキストが取得できません');
        return '';
      }

      // グローバル状態から取得
      const content = context.globalState.get('sharedTextContent') || '';
      return content;
    } catch (error) {
      Logger.error('共有テキスト内容の取得に失敗しました', error as Error);
      return '';
    }
  }

  private _showError(message: string): void {
    this._uiStateService.showError(message);
  }

  private _showSuccess(message: string): void {
    this._uiStateService.showSuccess(message);
  }
  
  /**
   * プロジェクト登録解除処理
   * @deprecated ServiceFactory.getMessageService().removeProjectを使用してください。
   */
  private async _handleRemoveProject(projectName: string, projectPath: string, projectId?: string): Promise<void> {
    Logger.warn('_handleRemoveProjectは非推奨です。ServiceFactory経由でサービスにアクセスしてください。');
    
    // ServiceFactory経由でMessageServiceを取得
    const messageService = ServiceFactory.getMessageService();
    await messageService.removeProject(this._panel, projectName, projectPath, projectId);
  }

  /**
   * WebViewを更新
   */
  private _update(): void {
    try {
      // 処理開始ログ
      Logger.info('ScopeManagerPanel: _update処理を開始します');
      
      // 最新のプロジェクト情報を取得
      const allProjects = this._projectService.getAllProjects();
      const activeProject = this._projectService.getActiveProject();
      
      // アクティブプロジェクト情報をクラスのプロパティに保存
      this._activeProject = activeProject;
      
      // アクティブタブ情報を取得（重要な部分）
      let activeTabId = 'scope-progress'; // デフォルト値
      
      if (activeProject && activeProject.metadata) {
        // 1. メタデータからタブ情報を正確に抽出
        if (activeProject.metadata.activeTab) {
          activeTabId = activeProject.metadata.activeTab;
          Logger.info(`ScopeManagerPanel: メタデータからアクティブタブを復元: ${activeTabId}`);
        } else {
          Logger.info('ScopeManagerPanel: メタデータにアクティブタブ情報がないためデフォルト(scope-progress)を使用');
        }
      } else {
        Logger.info('ScopeManagerPanel: プロジェクトメタデータがないためデフォルトタブ(scope-progress)を使用');
      }
      
      // 2. プロジェクトパスの更新（HTMLレンダリング前）
      if (activeProject && activeProject.path && this._projectPath !== activeProject.path) {
        this.setProjectPath(activeProject.path);
        Logger.info(`ScopeManagerPanel: パネル表示時にプロジェクトパスを更新: ${activeProject.path}`);
      }
      
      // 3. HTMLコンテンツを生成（アクティブタブ情報を明示的に渡す）
      const webview = this._panel.webview;
      this._panel.webview.html = this._getHtmlForWebview(webview, activeTabId);
      Logger.info(`ScopeManagerPanel: WebView HTMLを生成: アクティブタブID=${activeTabId}`);
      
      // 4. メッセージ送信の順序を最適化（先にタブ状態を同期）
      // WebViewの初期化完了を待ってからメッセージを送信
      // タイミングの問題を回避するため、2段階の遅延処理を使用
      setTimeout(() => {
        if (!activeProject) {
          Logger.warn('ScopeManagerPanel: アクティブプロジェクトがないため同期をスキップします');
          return;
        }
        
        // 第1段階: 基本同期（タブ選択コマンドを最初に送信）
        Logger.info(`ScopeManagerPanel: 基本同期メッセージを送信: タブID=${activeTabId}`);
        
        // a. まずタブ選択コマンドを送信
        this._panel.webview.postMessage({
          command: 'selectTab',
          tabId: activeTabId
        });
        
        // b. 次にプロジェクト状態を同期（上書きされないようにタブ選択後）
        this._panel.webview.postMessage({
          command: 'syncProjectState',
          project: activeProject
        });
        
        // c. プロジェクト一覧を更新
        this._panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // 第2段階: 遅延処理でタブ状態を確実に反映（UIの描画完了後）
        // DOMが完全に構築された後にタブ選択を再確認
        setTimeout(() => {
          // 最後にもう一度タブ選択コマンドを送信（確実な適用のため）
          this._panel.webview.postMessage({
            command: 'selectTab',
            tabId: activeTabId
          });

          // 保存されている共有テキスト内容があれば復元
          const savedContent = this._getSharedTextContent();
          if (savedContent) {
            Logger.info(`ScopeManagerPanel: 保存された共有テキスト内容を復元: ${savedContent.length}文字`);
            this._panel.webview.postMessage({
              command: 'restoreSharedTextContent',
              content: savedContent
            });
          }

          Logger.info(`ScopeManagerPanel: 最終確認のタブ選択メッセージを送信: アクティブタブ=${activeTabId}`);
        }, 200); // UIの描画完了を確実に待つ
        
        Logger.info(`ScopeManagerPanel: プロジェクト情報の同期が完了: ${activeProject.name}`);
      }, 100); // WebViewの初期化を待つ最小の遅延
    } catch (error) {
      Logger.warn(`ScopeManagerPanel: パネル表示時のプロジェクト情報更新に失敗: ${error}`);
    }
  }

  /**
   * WebViewのHTMLを生成
   * @param webview VSCodeのWebviewインスタンス
   * @param activeTabId アクティブなタブID（デフォルトは'scope-progress'）
   */
  private _getHtmlForWebview(webview: vscode.Webview, activeTabId: string = 'scope-progress'): string {
    // テンプレートジェネレータに処理を委譲
    return ScopeManagerTemplate.generateHtml({
      webview,
      extensionUri: this._extensionUri,
      activeTabId,
      activeProject: this._activeProject
    });
  }

  /**
   * 進捗ファイルを読み込む - FileSystemServiceに委譲
   */
  private async _loadProgressFile(): Promise<void> {
    try {
      if (!this._projectPath) {
        return;
      }

      // FileSystemServiceの新しいメソッドを呼び出す
      await this._fileSystemService.loadProgressFile(this._projectPath, async (content) => {
        // マークダウン表示を更新
        await this._handleGetMarkdownContent(this._progressFilePath);
      });
    } catch (error) {
      Logger.error('進捗ファイルの読み込み中にエラーが発生しました', error as Error);
      this._showError(`進捗ファイルの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }



  /**
   * ファイル監視を設定する - FileWatcherServiceに委譲
   */
  private async _setupFileWatcher(): Promise<void> {
    try {
      // アクティブタブ情報を取得
      const activeProject = this._projectService.getActiveProject();
      const activeTab = activeProject?.metadata?.activeTab || 'scope-progress';

      Logger.info(`ScopeManagerPanel: ファイル監視設定時のアクティブタブ=${activeTab}`);

      // ★★ 重要：FileWatcherServiceを使用してファイル監視を設定 ★★
      this._fileWatcher = this._fileWatcherService.setupProjectFileWatchers(
        this._projectPath,
        // 進捗ファイル変更時のコールバック
        async (filePath: string) => {
          await this._handleGetMarkdownContent(filePath);
        },
        // 要件定義ファイル変更時のコールバック
        async (filePath: string) => {
          await this._handleGetMarkdownContent(filePath, { forRequirements: true });
        },
        // オプション設定
        {
          fileSystemService: this._fileSystemService,
          eventBus: AppGeniusEventBus.getInstance(),
          activeTab: activeTab // アクティブタブ情報を明示的に渡す
        }
      );

      Logger.info('ScopeManagerPanel: ファイル監視を設定しました');
    } catch (error) {
      Logger.error('ScopeManagerPanel: ファイル監視の設定中にエラーが発生しました', error as Error);
    }
  }

  // FileSystemServiceに移動したメソッド
  
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
      
      // プロジェクトのUI状態更新イベント
      this._disposables.push(
        this._projectService.onProjectUIStateUpdated((uiState) => {
          Logger.info(`ProjectServiceからプロジェクトUI状態更新イベントを受信`);
          
          // WebViewにプロジェクトUI状態を通知
          this._panel.webview.postMessage({
            command: 'updateProjectUIState',
            uiState: uiState
          });
        })
      );
      
      Logger.info('ProjectServiceのイベントリスナー設定完了');
    } catch (error) {
      Logger.error('ProjectServiceのイベントリスナー設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * nonce値を生成（HtmlTemplateGeneratorに移動したため非推奨化）
   * @deprecated HtmlTemplateGenerator.generateNonce()を使用してください
   */
  private _getNonce(): string {
    return HtmlTemplateGenerator.generateNonce();
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
    
    // FileSystemServiceのリソースを解放
    if (this._fileSystemService) {
      this._fileSystemService.dispose();
    }
    
    // 共有サービスのリソースを解放
    this._sharingService.dispose();
    
    // 認証ハンドラーは使い回すので解放しない（シングルトンパターン）

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
   * ProjectServiceの新しいensureActiveProjectメソッドを使用して実装
   */
  private async _handleEnsureActiveProject(projectName: string, projectPath: string, activeTab?: string): Promise<void> {
    try {
      Logger.info(`プロジェクト同期確認: ${projectName}, パス: ${projectPath}${activeTab ? ', タブ: ' + activeTab : ''}`);
      
      // ProjectServiceの新しいensureActiveProjectメソッドを使用
      const success = await this._projectService.ensureActiveProject(projectName, projectPath, activeTab);
      
      if (success) {
        // 成功した場合は、最新のアクティブプロジェクト情報を取得して保存
        this._activeProject = this._projectService.getActiveProject();
        Logger.info(`プロジェクト同期が完了しました: ${projectName}`);
      } else {
        Logger.warn(`プロジェクト同期に失敗しました: ${projectName}`);
        this._showError(`プロジェクト「${projectName}」の同期に失敗しました`);
      }
    } catch (error) {
      Logger.error('プロジェクトの同期に失敗しました', error as Error);
      this._showError(`プロジェクトの同期中にエラーが発生しました: ${(error as Error).message}`);
    }
  }

  /**
   * 認証状態の監視を設定
   * AuthenticationHandlerを使って認証状態をチェック
   */
  private _setupTokenExpirationMonitor() {
    try {
      // AuthenticationHandlerを使って認証状態を監視
      const tokenMonitor = this._authHandler.setupTokenExpirationMonitor(
        // トークンの有効期限切れ時
        () => {
          Logger.info('スコープマネージャー: 認証状態が無効になったため、パネルを閉じます');
          // パネルを閉じる
          this.dispose();
          // ログイン画面に直接遷移
          this._authHandler.showLoginScreen(this._extensionUri);
        },
        // 権限喪失時
        () => {
          Logger.warn('スコープマネージャー: 権限が失効したため、パネルを閉じます');
          // パネルを閉じる
          this.dispose();
          vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がなくなりました。');
        }
      );
      
      // Disposableリストに追加
      this._disposables.push(tokenMonitor);
      
      Logger.info('スコープマネージャー: 認証状態監視を開始しました');
    } catch (error) {
      Logger.error('認証状態監視の設定中にエラーが発生しました', error as Error);
    }
  }
}
