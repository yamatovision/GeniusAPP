"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeManagerPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const fileOperationManager_1 = require("../../utils/fileOperationManager");
const ClaudeCodeLauncherService_1 = require("../../services/ClaudeCodeLauncherService");
const ProtectedPanel_1 = require("../auth/ProtectedPanel");
const roles_1 = require("../../core/auth/roles");
const PromptServiceClient_1 = require("../../services/PromptServiceClient");
const FileSystemService_1 = require("./services/FileSystemService");
const ProjectService_1 = require("./services/ProjectService");
const SharingService_1 = require("./services/SharingService");
const AuthenticationHandler_1 = require("./services/AuthenticationHandler");
/**
 * スコープマネージャーパネルクラス
 * SCOPE_PROGRESS.mdファイルと連携して実装スコープの管理を行う
 * 権限保護されたパネルの基底クラスを継承
 */
class ScopeManagerPanel extends ProtectedPanel_1.ProtectedPanel {
    /**
     * 実際のパネル作成・表示ロジック
     * ProtectedPanelから呼び出される
     */
    static createOrShow(extensionUri, context, projectPath) {
        // 認証ハンドラーを取得
        const authHandler = AuthenticationHandler_1.AuthenticationHandler.getInstance();
        // 認証チェック：ログインしていない場合はログイン画面に直接遷移
        if (!authHandler.checkLoggedIn()) {
            logger_1.Logger.info('スコープマネージャー: 未認証のためログイン画面に誘導します');
            // ログイン画面を表示
            authHandler.showLoginScreen(extensionUri);
            return undefined;
        }
        // 権限チェック：SCOPE_MANAGERの権限がない場合はアクセスを拒否
        if (!authHandler.checkPermission(ScopeManagerPanel._feature)) {
            logger_1.Logger.warn('スコープマネージャー: 権限不足のためアクセスを拒否します');
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
                logger_1.Logger.info(`既存のスコープマネージャーパネルを使用して、プロジェクトパスを更新: ${projectPath}`);
                ScopeManagerPanel.currentPanel.setProjectPath(projectPath);
            }
            return ScopeManagerPanel.currentPanel;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(ScopeManagerPanel.viewType, 'AppGenius スコープマネージャー', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            // カスタムCSP設定を削除し、VSCodeのデフォルト設定を使用
            // contentSecurityPolicy: "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src *;",
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'dist'),
                vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
            ]
        });
        logger_1.Logger.info(`新しいスコープマネージャーパネルを作成: プロジェクトパス=${projectPath || '未指定'}`);
        ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, context, projectPath);
        return ScopeManagerPanel.currentPanel;
    }
    /**
     * コンストラクタ
     */
    constructor(panel, extensionUri, context, projectPath) {
        super();
        this._disposables = [];
        this._projectPath = '';
        this._progressFilePath = '';
        this._directoryStructure = '';
        this._fileWatcher = null;
        this._tempShareDir = '';
        this._activeProject = null; // 現在選択中のプロジェクト
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._extensionPath = context.extensionPath; // 拡張機能のファイルシステムパスを保存
        this._fileManager = fileOperationManager_1.FileOperationManager.getInstance();
        this._promptServiceClient = PromptServiceClient_1.PromptServiceClient.getInstance();
        // FileSystemServiceのインスタンスを取得
        this._fileSystemService = FileSystemService_1.FileSystemService.getInstance();
        // ProjectServiceのインスタンスを取得
        this._projectService = ProjectService_1.ProjectService.getInstance(this._fileSystemService);
        // ProjectServiceのイベントリスナーを設定
        this._setupProjectServiceEventListeners();
        // 共有サービスを初期化
        this._sharingService = SharingService_1.SharingService.getInstance(context);
        // 認証ハンドラーを初期化
        this._authHandler = AuthenticationHandler_1.AuthenticationHandler.getInstance();
        // 一時ディレクトリはプロジェクトパス設定時に作成されるため、ここでは初期化のみ
        this._tempShareDir = '';
        // 認証状態の監視を設定 (1分ごとにチェック)
        this._setupTokenExpirationMonitor();
        // 認証状態変更イベントをAuthenticationHandlerから監視
        try {
            const authStateChangedDisposable = this._authHandler.onAuthStateChanged(state => {
                // 認証状態が未認証になった、または権限がなくなった場合
                if (!state.isAuthenticated || !this._authHandler.checkPermission(ScopeManagerPanel._feature)) {
                    logger_1.Logger.info('スコープマネージャー: 認証状態が変更されたため、パネルを閉じます');
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
            logger_1.Logger.info('スコープマネージャー: 認証状態変更イベントの監視を開始しました');
        }
        catch (error) {
            logger_1.Logger.error('認証状態変更イベントの監視設定中にエラーが発生しました', error);
        }
        // FileSystemServiceのイベントリスナーを設定
        this._disposables.push(this._fileSystemService.onDirectoryStructureUpdated((structure) => {
            this._directoryStructure = structure;
            // ディレクトリ構造が表示されている場合は更新
            this._panel.webview.postMessage({
                command: 'updateDirectoryStructure',
                structure: structure
            });
        }));
        // アクティブプロジェクトを取得
        const activeProject = this._projectService.getActiveProject();
        // アクティブプロジェクトが指定されていない場合は、引数または現在のアクティブプロジェクトを使用
        if (!projectPath && activeProject && activeProject.path) {
            projectPath = activeProject.path;
            logger_1.Logger.info(`アクティブプロジェクトパスを使用: ${projectPath}`);
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
        this._panel.onDidChangeViewState(_e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // WebViewからのメッセージを処理
        this._panel.webview.onDidReceiveMessage(async (message) => {
            try {
                // デバッグログ：受信したメッセージの内容を詳細に記録
                if (message.command === 'launchPromptFromURL') {
                    logger_1.Logger.info(`【WebViewメッセージ】コマンド=${message.command}, URL=${message.url}, index=${message.index}, name=${message.name}`);
                    logger_1.Logger.info(`【WebViewメッセージ詳細】splitTerminal=${message.splitTerminal} (型: ${typeof message.splitTerminal})`);
                    logger_1.Logger.info(`【WebViewメッセージJSON】${JSON.stringify(message)}`);
                }
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
                    // タブ関連
                    case 'loadFileToTab':
                        await this._handleLoadFileToTab(message.tabId, message.filePath);
                        break;
                    case 'loadRequirementsFile':
                        await this._handleLoadRequirementsFile();
                        break;
                    // ファイルブラウザ関連
                    case 'refreshFileBrowser':
                        await this._handleRefreshFileBrowser();
                        break;
                    case 'openFile':
                        await this._handleOpenFile(message.filePath);
                        break;
                    case 'navigateDirectory':
                        await this._handleNavigateDirectory(message.dirPath);
                        break;
                    case 'listDirectory':
                        await this._handleListDirectory(message.path);
                        break;
                    case 'openFileInEditor':
                        await this._handleOpenFileInEditor(message.filePath);
                        break;
                    // 新しいコマンド
                    case 'launchPromptFromURL':
                        // splitTerminalパラメータを明示的に処理
                        const splitTerminalValue = message.splitTerminal === true ? true : false;
                        logger_1.Logger.info(`【メッセージ変換】splitTerminal: ${message.splitTerminal} => ${splitTerminalValue}`);
                        await this._handleLaunchPromptFromURL(message.url, message.index, message.name, splitTerminalValue);
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
            }
            catch (error) {
                logger_1.Logger.error(`メッセージ処理エラー: ${message.command}`, error);
                this._showError(`操作に失敗しました: ${error.message}`);
            }
        }, null, this._disposables);
    }
    /**
     * 新規プロジェクト作成処理
     * ProjectServiceを使用して実装
     */
    async _handleCreateProject(projectName, description) {
        try {
            logger_1.Logger.info(`新規プロジェクト作成: ${projectName}`);
            // ProjectServiceを使用してプロジェクトを作成
            const projectId = await this._projectService.createProject(projectName, description);
            logger_1.Logger.info(`プロジェクト「${projectName}」の作成が完了しました: ID=${projectId}`);
            // プロジェクトの最新情報を取得
            const activeProject = this._projectService.getActiveProject();
            const allProjects = this._projectService.getAllProjects();
            // プロジェクトパスを更新
            if (activeProject && activeProject.path) {
                this.setProjectPath(activeProject.path);
                // 進捗ファイルの内容も読み込んで表示
                const progressFilePath = this._projectService.getProgressFilePath();
                if (progressFilePath && fs.existsSync(progressFilePath)) {
                    await this._handleGetMarkdownContent(progressFilePath);
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
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト作成中にエラーが発生しました: ${projectName}`, error);
            this._showError(`プロジェクトの作成に失敗しました: ${error.message}`);
        }
    }
    /**
     * 既存プロジェクトの読み込み処理
     * ProjectServiceを使用して実装
     */
    async _handleLoadExistingProject() {
        try {
            logger_1.Logger.info('既存プロジェクト読み込み処理を開始');
            // プロジェクトパスを選択するダイアログを表示
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'プロジェクトフォルダを選択',
                title: '既存プロジェクトの選択'
            });
            if (!folderUri || folderUri.length === 0) {
                logger_1.Logger.info('プロジェクト読み込みがキャンセルされました: フォルダが選択されていません');
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
                logger_1.Logger.info(`プロジェクト「${projectInfo.name}」の読み込みが完了しました: ${projectInfo.path}`);
            }
        }
        catch (error) {
            logger_1.Logger.error('プロジェクト読み込み中にエラーが発生しました', error);
            this._showError(`プロジェクトの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクトパスを設定 - 各サービスに委譲
     */
    async setProjectPath(projectPath) {
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
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトパスの設定に失敗しました: ${error}`);
            throw error;
        }
    }
    /**
     * 初期化処理
     */
    async _handleInitialize() {
        // 最新のプロジェクト一覧を取得して送信
        await this._refreshProjects();
        await this._loadProgressFile();
        // ディレクトリ構造を更新
        await this._updateDirectoryStructure();
        // 共有履歴を初期化
        await this._handleGetHistory();
        // 進捗ファイル(SCOPE_PROGRESS.md)の内容を読み込む
        if (this._progressFilePath && fs.existsSync(this._progressFilePath)) {
            await this._handleGetMarkdownContent(this._progressFilePath);
        }
        // 要件定義ファイル(requirements.md)がある場合は読み込む
        const requirementsFilePath = path.join(this._projectPath, 'docs', 'requirements.md');
        if (fs.existsSync(requirementsFilePath)) {
            await this._handleLoadRequirementsFile();
        }
        // ファイルブラウザの初期化
        await this._initializeFileBrowser();
    }
    /**
     * 要件定義ファイルの読み込み
     * docsディレクトリ内のrequirements.mdファイルを読み込んで表示
     */
    async _handleLoadRequirementsFile() {
        try {
            logger_1.Logger.info('要件定義ファイルの読み込みを開始します');
            // プロジェクトパスが設定されていない場合は処理しない
            if (!this._projectPath) {
                logger_1.Logger.warn('プロジェクトパスが設定されていません。要件定義ファイルの読み込みをスキップします。');
                return;
            }
            // 要件定義ファイルのパスを生成
            const requirementsFilePath = path.join(this._projectPath, 'docs', 'requirements.md');
            // ファイルの存在確認
            if (!fs.existsSync(requirementsFilePath)) {
                logger_1.Logger.info(`要件定義ファイルが見つかりません: ${requirementsFilePath}`);
                // 要件定義ファイルが存在しない場合は、空のメッセージを表示
                this._panel.webview.postMessage({
                    command: 'updateTabContent',
                    tabId: 'requirements',
                    content: '# 要件定義\n\n要件定義ファイルが見つかりません。プロジェクトの `docs/requirements.md` ファイルを作成してください。',
                    filePath: requirementsFilePath,
                    forRequirements: true // 要件定義タブ用の更新であることを示す
                });
                return;
            }
            // FileSystemServiceを使用してファイルを読み込む
            const content = await this._fileSystemService.readMarkdownFile(requirementsFilePath);
            // タブ内容を更新
            this._panel.webview.postMessage({
                command: 'updateTabContent',
                tabId: 'requirements',
                content: content,
                filePath: requirementsFilePath,
                forRequirements: true // 要件定義タブ用の更新であることを示す
            });
            logger_1.Logger.info(`要件定義ファイルを読み込みました: ${requirementsFilePath}`);
        }
        catch (error) {
            logger_1.Logger.error('要件定義ファイルの読み込み中にエラーが発生しました', error);
            this._showError(`要件定義ファイルの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルブラウザの初期化
     * docsディレクトリの内容をリストアップして表示
     */
    async _initializeFileBrowser() {
        try {
            logger_1.Logger.info('ファイルブラウザの初期化を開始します');
            // プロジェクトパスが設定されていない場合は処理しない
            if (!this._projectPath) {
                logger_1.Logger.warn('プロジェクトパスが設定されていません。ファイルブラウザの初期化をスキップします。');
                return;
            }
            // docsディレクトリのパスを生成
            const docsPath = path.join(this._projectPath, 'docs');
            // docsディレクトリの存在確認と作成
            await this._fileSystemService.ensureDirectoryExists(docsPath);
            // ファイルブラウザ用のディレクトリ構造を送信
            this._panel.webview.postMessage({
                command: 'updateFileBrowser',
                structure: this._directoryStructure
            });
            // ディレクトリの内容をリストアップ
            const files = await this._fileSystemService.listDirectory(docsPath);
            // ファイルリストを送信
            this._panel.webview.postMessage({
                command: 'updateFileList',
                files: files,
                currentPath: docsPath
            });
            logger_1.Logger.info(`ファイルブラウザを初期化しました: ${docsPath}`);
        }
        catch (error) {
            logger_1.Logger.error('ファイルブラウザの初期化中にエラーが発生しました', error);
            this._showError(`ファイルブラウザの初期化に失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルブラウザを更新する
     */
    async _handleRefreshFileBrowser() {
        try {
            logger_1.Logger.info('ファイルブラウザを更新します');
            // ディレクトリ構造を更新
            await this._updateDirectoryStructure();
            if (this._projectPath) {
                // docsディレクトリのパスを生成
                const docsPath = path.join(this._projectPath, 'docs');
                // ディレクトリの内容をリストアップ
                const files = await this._fileSystemService.listDirectory(docsPath);
                // ファイルリストを送信
                this._panel.webview.postMessage({
                    command: 'updateFileList',
                    files: files,
                    currentPath: docsPath
                });
            }
            logger_1.Logger.info('ファイルブラウザを更新しました');
        }
        catch (error) {
            logger_1.Logger.error('ファイルブラウザの更新に失敗しました', error);
            this._showError(`ファイルブラウザの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * 指定されたディレクトリの内容をリストアップする
     * @param dirPath ディレクトリパス（未指定の場合はプロジェクトのdocsディレクトリ）
     */
    async _handleListDirectory(dirPath) {
        try {
            logger_1.Logger.info(`ディレクトリ内容のリストアップ: ${dirPath || 'プロジェクトdocsディレクトリ'}`);
            // ディレクトリパスが指定されていない場合はプロジェクトのdocsディレクトリを使用
            const targetPath = dirPath || (this._projectPath ? path.join(this._projectPath, 'docs') : '');
            if (!targetPath) {
                logger_1.Logger.warn('ディレクトリパスが指定されていません。');
                return;
            }
            // ディレクトリの存在確認
            if (!fs.existsSync(targetPath)) {
                logger_1.Logger.warn(`指定されたディレクトリが存在しません: ${targetPath}`);
                return;
            }
            // ディレクトリの内容をリストアップ
            const files = await this._fileSystemService.listDirectory(targetPath);
            // ファイルリストを送信
            this._panel.webview.postMessage({
                command: 'updateFileList',
                files: files,
                currentPath: targetPath,
                parentPath: path.dirname(targetPath) !== targetPath ? path.dirname(targetPath) : null
            });
            logger_1.Logger.info(`ディレクトリ内容をリストアップしました: ${targetPath}, ${files.length}件`);
        }
        catch (error) {
            logger_1.Logger.error('ディレクトリ内容のリストアップに失敗しました', error);
            this._showError(`ディレクトリ内容の取得に失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルをVSCodeエディタで開く
     * @param filePath 開くファイルのパス
     */
    async _handleOpenFileInEditor(filePath) {
        try {
            logger_1.Logger.info(`ファイルをエディタで開きます: ${filePath}`);
            // ファイルの存在確認
            if (!fs.existsSync(filePath)) {
                this._showError(`ファイルが見つかりません: ${filePath}`);
                return;
            }
            // VSCodeのOpen APIを使用してファイルを開く
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document);
            logger_1.Logger.info(`ファイルをエディタで開きました: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`ファイルをエディタで開く際にエラーが発生しました: ${filePath}`, error);
            this._showError(`ファイルをエディタで開けませんでした: ${error.message}`);
        }
    }
    /**
     * 指定されたディレクトリに移動する
     * @param dirPath 移動先のディレクトリパス
     */
    async _handleNavigateDirectory(dirPath) {
        try {
            logger_1.Logger.info(`ディレクトリに移動します: ${dirPath}`);
            // ディレクトリの存在確認
            if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
                this._showError(`ディレクトリが見つかりません: ${dirPath}`);
                return;
            }
            // ディレクトリの内容をリストアップして送信
            await this._handleListDirectory(dirPath);
        }
        catch (error) {
            logger_1.Logger.error(`ディレクトリの移動に失敗しました: ${dirPath}`, error);
            this._showError(`ディレクトリの移動に失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルを開いてプレビュー表示する
     * @param filePath 開くファイルのパス
     */
    async _handleOpenFile(filePath) {
        try {
            logger_1.Logger.info(`ファイルを開きます: ${filePath}`);
            // ファイルの存在確認
            if (!fs.existsSync(filePath)) {
                this._showError(`ファイルが見つかりません: ${filePath}`);
                return;
            }
            // ファイルの種類を判定
            const fileExt = path.extname(filePath).toLowerCase();
            // テキストファイルかどうかを判断
            if (['.md', '.txt', '.js', '.ts', '.json', '.html', '.css', '.scss', '.yml', '.yaml', '.xml', '.svg'].includes(fileExt)) {
                // テキストファイルの場合は内容を読み込んで表示
                const content = await this._fileSystemService.readFile(filePath);
                this._panel.webview.postMessage({
                    command: 'updateFilePreview',
                    filePath: filePath,
                    content: content,
                    type: 'text',
                    extension: fileExt
                });
            }
            else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(fileExt)) {
                // 画像ファイルの場合は画像として表示
                // Base64エンコードなしでUriとして送信
                this._panel.webview.postMessage({
                    command: 'updateFilePreview',
                    filePath: filePath,
                    type: 'image',
                    extension: fileExt,
                    // ファイルURIをWebView用に変換
                    uri: this._panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString()
                });
            }
            else {
                // その他のファイルはVSCodeで開く
                await this._handleOpenFileInEditor(filePath);
                this._showSuccess(`ファイル「${path.basename(filePath)}」をVSCodeで開きました`);
            }
            logger_1.Logger.info(`ファイル「${path.basename(filePath)}」を開きました`);
        }
        catch (error) {
            logger_1.Logger.error(`ファイルを開く際にエラーが発生しました: ${filePath}`, error);
            this._showError(`ファイルを開けませんでした: ${error.message}`);
        }
    }
    /**
     * プロジェクト一覧を更新
     * ProjectServiceを使用して実装
     */
    async _refreshProjects() {
        try {
            // ProjectServiceの新しいrefreshProjectsListメソッドを使用
            const allProjects = await this._projectService.refreshProjectsList();
            const activeProject = this._projectService.getActiveProject();
            logger_1.Logger.info(`プロジェクト一覧を更新しました: ${allProjects.length}件`);
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
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト一覧の更新に失敗しました`, error);
            this._showError(`プロジェクト一覧の取得に失敗しました: ${error.message}`);
        }
    }
    /**
     * プロンプトURLからClaudeCodeを起動する
     * @param url プロンプトのURL
     * @param index プロンプトのインデックス
     * @param name プロンプト名（ターミナルタイトルに使用）
     * @param splitTerminal ターミナル分割モードを使用するかどうか
     */
    async _handleLaunchPromptFromURL(url, index, name, splitTerminal) {
        try {
            // 受信したメッセージ全体をログ出力（デバッグ用）
            logger_1.Logger.info(`プロンプト起動パラメータを受信: URL=${url}, index=${index}, name=${name}, splitTerminal=${splitTerminal}`);
            // フロントエンドから送信されたURLとインデックスをそのまま使用
            // プロンプトの内容を取得して一時ファイルに保存（プロジェクトパスを指定）
            const promptFilePath = await this._promptServiceClient.fetchAndSavePrompt(url, index, this._projectPath);
            // ClaudeCodeを起動
            const launcher = ClaudeCodeLauncherService_1.ClaudeCodeLauncherService.getInstance();
            // UIからsplitTerminalパラメータを受け取り、未指定の場合はfalseをデフォルト値とする
            // 明示的なブール値変換を行い、受け取ったsplitTerminalの型も出力
            const useSplitTerminal = splitTerminal === true;
            logger_1.Logger.info(`【詳細ログ】受け取ったsplitTerminalの値: ${splitTerminal} (型: ${typeof splitTerminal})`);
            logger_1.Logger.info(`【詳細ログ】変換後のsplitTerminal値: ${useSplitTerminal} (型: ${typeof useSplitTerminal})`);
            // 分割モードの最終状態をログ出力
            logger_1.Logger.info(`ターミナル分割モード: ${useSplitTerminal ? '有効' : '無効'}`);
            // UIのダイアログで「分割ターミナルで表示」が選択された場合のみtrueになる
            const success = await launcher.launchClaudeCodeWithPrompt(this._projectPath, promptFilePath, {
                deletePromptFile: true, // 使用後に一時ファイルを削除
                splitTerminal: useSplitTerminal, // UIから指定された分割モードを使用
                promptType: name // プロンプト名をターミナルタイトルに反映
            });
            if (success) {
                logger_1.Logger.info(`ClaudeCode起動成功: ${promptFilePath}, 分割モード: ${useSplitTerminal ? '有効' : '無効'}`);
                // 成功通知をUIに送信（デバッグ用）
                this._panel.webview.postMessage({
                    command: 'launchResult',
                    success: true,
                    splitTerminal: useSplitTerminal,
                    message: `ClaudeCodeを起動しました (${useSplitTerminal ? '分割ターミナル' : '新しいタブ'})`
                });
            }
            else {
                this._showError('ClaudeCodeの起動に失敗しました');
            }
        }
        catch (error) {
            logger_1.Logger.error('プロンプト起動中にエラーが発生しました', error);
            this._showError(`プロンプトの取得または起動に失敗しました: ${error.message}`);
        }
    }
    // レガシー共有メソッドは削除されました
    /**
     * モックアップギャラリーを開く - 共通メソッドに統合
     * @param filePath 表示するモックアップファイルのパス（オプション）
     */
    async _handleOpenMockupGallery(filePath) {
        try {
            // 別ウィンドウでモックアップギャラリーを開く
            await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', this._projectPath);
            logger_1.Logger.info(`モックアップギャラリーを開きました${filePath ? ': ' + filePath : ''}`);
            this._showSuccess('モックアップギャラリーを開きました');
        }
        catch (error) {
            logger_1.Logger.error('モックアップギャラリーを開けませんでした', error);
            this._showError('モックアップギャラリーを開けませんでした');
        }
    }
    /**
     * 旧メソッド名での互換性維持用
     */
    async _handleOpenOriginalMockupGallery(filePath) {
        // 統合したメソッドを呼び出す
        return this._handleOpenMockupGallery(filePath);
    }
    /**
     * モックアップファイルを選択 - 統合メソッドを呼び出す
     * @param filePath モックアップファイルのパス
     */
    async _handleSelectMockup(filePath) {
        return this._handleOpenMockupGallery(filePath);
    }
    /**
     * モックアップをブラウザで開く
     * @param filePath モックアップファイルのパス
     */
    async _handleOpenMockupInBrowser(filePath) {
        try {
            // 外部ブラウザでファイルを開く
            await vscode.env.openExternal(vscode.Uri.file(filePath));
            logger_1.Logger.info(`モックアップをブラウザで開きました: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error('モックアップをブラウザで開けませんでした', error);
            this._showError('モックアップをブラウザで開けませんでした');
        }
    }
    /**
     * 共有履歴を取得してWebViewに送信
     */
    async _handleGetHistory() {
        try {
            const history = this._sharingService.getHistory();
            logger_1.Logger.debug('共有履歴を取得しました', { count: history.length });
            this._panel.webview.postMessage({
                command: 'updateSharingHistory',
                history: history || []
            });
        }
        catch (error) {
            logger_1.Logger.error('履歴取得エラー', error);
        }
    }
    /**
     * テキストを共有サービスで共有 - SharingServiceに委譲
     */
    async _handleShareText(text, suggestedFilename) {
        try {
            // 共有オプションを設定
            const options = {
                type: 'text',
                expirationHours: 24 // デフォルト有効期限
            };
            // 提案されたファイル名があれば使用
            if (suggestedFilename) {
                options.title = suggestedFilename;
                options.metadata = { suggestedFilename };
            }
            // SharingServiceを使ってテキストを共有
            const file = await this._sharingService.shareText(text, options);
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
        }
        catch (error) {
            logger_1.Logger.error('テキスト共有エラー', error);
            this._showError(`テキストの共有に失敗しました: ${error.message}`);
        }
    }
    /**
     * 画像を共有サービスで共有 - SharingServiceに委譲
     */
    async _handleShareImage(imageData, fileName) {
        try {
            // SharingServiceを使って画像を共有
            const file = await this._sharingService.shareImage(imageData, fileName);
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
        }
        catch (error) {
            this._showError(`画像の共有に失敗しました: ${error.message}`);
        }
    }
    /**
     * 履歴からアイテムを削除
     */
    async _handleDeleteFromHistory(fileId) {
        const success = this._sharingService.deleteFromHistory(fileId);
        if (success) {
            logger_1.Logger.info(`共有履歴から項目を削除しました: ${fileId}`);
            // 履歴を更新して送信
            await this._handleGetHistory();
        }
        else {
            logger_1.Logger.warn(`共有履歴からの項目削除に失敗しました: ${fileId}`);
        }
    }
    /**
     * ファイルのコマンドをクリップボードにコピー
     */
    async _handleCopyCommand(fileId) {
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
                logger_1.Logger.info(`コマンドをコピーしました: ${fileId}, ファイル: ${file.fileName}`);
            }
            else {
                logger_1.Logger.warn(`コピー対象のファイルが見つかりません: ${fileId}`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`コピーコマンド実行中にエラーが発生しました: ${fileId}`, error);
            this._showError(`コピーに失敗しました: ${error.message}`);
        }
    }
    /**
     * テキストをクリップボードにコピー
     */
    async _handleCopyToClipboard(text) {
        // VSCodeのクリップボード機能を使用
        vscode.env.clipboard.writeText(text);
    }
    /**
     * 履歴アイテムを再利用
     */
    async _handleReuseHistoryItem(fileId) {
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
                logger_1.Logger.info(`履歴アイテムを再利用しました: ${fileId}, ファイル: ${file.fileName}`);
            }
            else {
                logger_1.Logger.warn(`再利用対象のファイルが見つかりません: ${fileId}`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`履歴アイテム再利用中にエラーが発生しました: ${fileId}`, error);
            this._showError(`履歴アイテムの再利用に失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクト選択処理
     * ProjectServiceを使用して実装
     * @param projectName プロジェクト名
     * @param projectPath プロジェクトパス
     * @param activeTab 現在のアクティブタブID（オプション）
     */
    async _handleSelectProject(projectName, projectPath, activeTab) {
        try {
            logger_1.Logger.info(`プロジェクト選択: ${projectName}, パス: ${projectPath}`);
            // ProjectServiceを使用してプロジェクトを選択
            await this._projectService.selectProject(projectName, projectPath, activeTab);
            // プロジェクトパスを更新
            this.setProjectPath(projectPath);
            // プロジェクトの最新情報を取得
            const activeProject = this._projectService.getActiveProject();
            this._activeProject = activeProject; // インスタンス変数にも保存
            const allProjects = this._projectService.getAllProjects();
            // WebViewにプロジェクト状態同期メッセージを送信
            if (activeProject) {
                this._panel.webview.postMessage({
                    command: 'syncProjectState',
                    project: activeProject
                });
                logger_1.Logger.info(`プロジェクト状態同期メッセージを送信: ${activeProject.name}`);
            }
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
            }
            // WebViewに成功メッセージを送信
            this._panel.webview.postMessage({
                command: 'showSuccess',
                message: `プロジェクト「${projectName}」を開きました`
            });
            // VSCodeの通知も表示
            vscode.window.showInformationMessage(`プロジェクト「${projectName}」を開きました`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトを開く際にエラーが発生しました`, error);
            this._showError(`プロジェクトを開けませんでした: ${error.message}`);
        }
    }
    /**
     * ディレクトリ構造を表示
     */
    async _handleShowDirectoryStructure() {
        if (!this._directoryStructure) {
            await this._updateDirectoryStructure();
        }
        this._panel.webview.postMessage({
            command: 'showDirectoryStructure',
            structure: this._directoryStructure
        });
    }
    /**
     * 特定のタブにファイルを読み込んで表示
     * @param tabId 表示対象のタブID
     * @param filePath 読み込むファイルパス
     */
    async _handleLoadFileToTab(tabId, filePath) {
        try {
            logger_1.Logger.info(`タブにファイルを読み込みます: タブID=${tabId}, ファイル=${filePath}`);
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                this._showError(`ファイルが見つかりません: ${filePath}`);
                return;
            }
            // ファイルの内容を読み込む
            const content = await this._fileSystemService.readMarkdownFile(filePath);
            // タブ内の.markdown-contentにコンテンツを表示
            this._panel.webview.postMessage({
                command: 'updateTabContent',
                tabId: tabId,
                content: content,
                filePath: filePath
            });
            logger_1.Logger.info(`タブ「${tabId}」にファイル内容を読み込みました: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`タブへのファイル読み込みに失敗しました: ${filePath}`, error);
            this._showError(`ファイルの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルブラウザを更新
     */
    async _handleRefreshFileBrowser() {
        try {
            logger_1.Logger.info('ファイルブラウザを更新します');
            // ディレクトリ構造を更新
            await this._updateDirectoryStructure();
            // ファイルブラウザを更新
            this._panel.webview.postMessage({
                command: 'updateFileBrowser',
                structure: this._directoryStructure
            });
            logger_1.Logger.info('ファイルブラウザを更新しました');
        }
        catch (error) {
            logger_1.Logger.error('ファイルブラウザの更新に失敗しました', error);
            this._showError(`ファイルブラウザの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルを開いてプレビュー表示
     * @param filePath 開くファイルのパス
     */
    async _handleOpenFile(filePath) {
        try {
            logger_1.Logger.info(`ファイルを開きます: ${filePath}`);
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                this._showError(`ファイルが見つかりません: ${filePath}`);
                return;
            }
            // ファイルの種類を判定
            const fileExt = path.extname(filePath).toLowerCase();
            // テキストファイルかどうかを判断
            if (['.md', '.txt', '.js', '.ts', '.json', '.html', '.css', '.scss', '.yml', '.yaml', '.xml', '.svg'].includes(fileExt)) {
                // テキストファイルの場合は内容を読み込んで表示
                const content = await this._fileSystemService.readFile(filePath);
                this._panel.webview.postMessage({
                    command: 'showFilePreview',
                    filePath: filePath,
                    content: content,
                    type: 'text',
                    extension: fileExt
                });
            }
            else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(fileExt)) {
                // 画像ファイルの場合は画像として表示
                // Base64エンコードなしでUriとして送信
                this._panel.webview.postMessage({
                    command: 'showFilePreview',
                    filePath: filePath,
                    type: 'image',
                    extension: fileExt,
                    // ファイルURIをWebView用に変換
                    uri: this._panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString()
                });
            }
            else {
                // その他のファイルはVSCodeで開く
                await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
                this._showSuccess(`ファイル「${path.basename(filePath)}」をVSCodeで開きました`);
            }
            logger_1.Logger.info(`ファイル「${path.basename(filePath)}」を開きました`);
        }
        catch (error) {
            logger_1.Logger.error(`ファイルを開く際にエラーが発生しました: ${filePath}`, error);
            this._showError(`ファイルを開けませんでした: ${error.message}`);
        }
    }
    /**
     * ディレクトリを開いてファイル一覧を表示
     * @param dirPath ディレクトリパス
     */
    async _handleNavigateDirectory(dirPath) {
        try {
            logger_1.Logger.info(`ディレクトリを開きます: ${dirPath}`);
            // ディレクトリが存在するか確認
            if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
                this._showError(`ディレクトリが見つかりません: ${dirPath}`);
                return;
            }
            // ディレクトリ内のファイル一覧を取得
            const files = await fs.promises.readdir(dirPath);
            // ファイル情報の配列を作成
            const fileEntries = await Promise.all(files.map(async (file) => {
                const fullPath = path.join(dirPath, file);
                const stats = await fs.promises.stat(fullPath);
                return {
                    name: file,
                    path: fullPath,
                    isDirectory: stats.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime.toISOString()
                };
            }));
            // ディレクトリとファイルを分けてソート
            const directories = fileEntries.filter(entry => entry.isDirectory)
                .sort((a, b) => a.name.localeCompare(b.name));
            const textFiles = fileEntries.filter(entry => !entry.isDirectory)
                .sort((a, b) => a.name.localeCompare(b.name));
            // 結合して先頭にディレクトリを配置
            const sortedEntries = [...directories, ...textFiles];
            // ファイルブラウザを更新
            this._panel.webview.postMessage({
                command: 'updateFileList',
                currentPath: dirPath,
                files: sortedEntries,
                parentPath: path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null
            });
            logger_1.Logger.info(`ディレクトリ「${dirPath}」のファイル一覧を表示しました: ${sortedEntries.length}件`);
        }
        catch (error) {
            logger_1.Logger.error(`ディレクトリ内容の取得に失敗しました: ${dirPath}`, error);
            this._showError(`ディレクトリの内容を表示できませんでした: ${error.message}`);
        }
    }
    /**
     * タブ状態を保存する
     */
    async _handleSaveTabState(tabId) {
        try {
            if (!tabId || !this._activeProject || !this._activeProject.id) {
                logger_1.Logger.warn('タブ状態を保存できません: 有効なアクティブプロジェクトが存在しません');
                return;
            }
            logger_1.Logger.info(`タブ状態を保存します: プロジェクト=${this._activeProject.name}, タブID=${tabId}`);
            // ProjectServiceのsaveTabStateメソッドを使用して保存
            await this._projectService.saveTabState(this._activeProject.id, tabId);
            // アクティブプロジェクトを再取得して内部状態を更新
            this._activeProject = this._projectService.getActiveProject();
            // WebViewにプロジェクト状態同期メッセージを送信（タブ状態も含める）
            if (this._activeProject) {
                this._panel.webview.postMessage({
                    command: 'syncProjectState',
                    project: this._activeProject
                });
                logger_1.Logger.info(`プロジェクト状態同期メッセージを送信: ${this._activeProject.name}, タブID=${tabId}`);
            }
            logger_1.Logger.info(`タブ状態を保存しました: プロジェクト=${this._activeProject.name}, タブID=${tabId}`);
        }
        catch (error) {
            logger_1.Logger.error(`タブ状態の保存に失敗しました: ${error.message}`, error);
        }
    }
    /**
     * マークダウンファイルの内容を取得して表示
     */
    async _handleGetMarkdownContent(filePath) {
        try {
            // FileSystemServiceを使用してマークダウンファイルを読み込む
            const content = await this._fileSystemService.readMarkdownFile(filePath);
            // WebViewにマークダウン内容を送信 - 優先度高で即時処理を要求
            this._panel.webview.postMessage({
                command: 'updateMarkdownContent',
                content: content,
                timestamp: Date.now(), // タイムスタンプを追加して新しい更新を識別できるように
                priority: 'high', // 優先度の高い更新であることを示す
                forScopeProgress: true // 進捗状況タブ用の更新であることを示す
            });
            logger_1.Logger.info(`FileSystemServiceを使用してマークダウンコンテンツを読み込みました: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`マークダウンコンテンツの読み込みに失敗しました: ${filePath}`, error);
            this._showError(`マークダウンファイルの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * エラーメッセージを表示
     */
    _showError(message) {
        this._panel.webview.postMessage({
            command: 'showError',
            message: message
        });
    }
    /**
     * 成功メッセージを表示
     */
    _showSuccess(message) {
        this._panel.webview.postMessage({
            command: 'showSuccess',
            message: message
        });
    }
    /**
     * プロジェクト登録解除処理
     * ProjectServiceを使用して実装
     */
    async _handleRemoveProject(projectName, projectPath, projectId) {
        try {
            logger_1.Logger.info(`プロジェクト登録解除: ${projectName}, パス: ${projectPath}, ID: ${projectId || 'なし'}`);
            if (!projectName && !projectPath && !projectId) {
                this._showError('プロジェクト情報が不足しています');
                return;
            }
            // ProjectServiceを使用してプロジェクトを登録解除
            const removed = await this._projectService.removeProject(projectName, projectPath, projectId);
            if (removed) {
                logger_1.Logger.info(`プロジェクト「${projectName}」の登録解除に成功しました`);
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
                    }
                    else if (allProjects.length > 0) {
                        await this.setProjectPath(allProjects[0].path);
                    }
                }
                this._showSuccess(`プロジェクト「${projectName}」の登録を解除しました`);
            }
            else {
                this._showError(`プロジェクト「${projectName}」の登録解除に失敗しました`);
            }
        }
        catch (error) {
            logger_1.Logger.error('プロジェクト登録解除処理エラー', error);
            this._showError(`プロジェクト登録解除に失敗しました: ${error.message}`);
        }
    }
    /**
     * WebViewを更新
     */
    _update() {
        try {
            // 処理開始ログ
            logger_1.Logger.info('ScopeManagerPanel: _update処理を開始します');
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
                    logger_1.Logger.info(`ScopeManagerPanel: メタデータからアクティブタブを復元: ${activeTabId}`);
                }
                else {
                    logger_1.Logger.info('ScopeManagerPanel: メタデータにアクティブタブ情報がないためデフォルトを使用');
                }
            }
            else {
                logger_1.Logger.info('ScopeManagerPanel: プロジェクトメタデータがないためデフォルトタブを使用');
            }
            // 2. プロジェクトパスの更新（HTMLレンダリング前）
            if (activeProject && activeProject.path && this._projectPath !== activeProject.path) {
                this.setProjectPath(activeProject.path);
                logger_1.Logger.info(`ScopeManagerPanel: パネル表示時にプロジェクトパスを更新: ${activeProject.path}`);
            }
            // 3. HTMLコンテンツを生成（アクティブタブ情報を明示的に渡す）
            const webview = this._panel.webview;
            this._panel.webview.html = this._getHtmlForWebview(webview, activeTabId);
            logger_1.Logger.info(`ScopeManagerPanel: WebView HTMLを生成: アクティブタブID=${activeTabId}`);
            // 4. メッセージ送信の順序を最適化（先にタブ状態を同期）
            // WebViewの初期化完了を待ってからメッセージを送信
            // タイミングの問題を回避するため、2段階の遅延処理を使用
            setTimeout(() => {
                if (!activeProject) {
                    logger_1.Logger.warn('ScopeManagerPanel: アクティブプロジェクトがないため同期をスキップします');
                    return;
                }
                // 第1段階: 基本同期（タブ選択コマンドを最初に送信）
                logger_1.Logger.info(`ScopeManagerPanel: 基本同期メッセージを送信: タブID=${activeTabId}`);
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
                    logger_1.Logger.info(`ScopeManagerPanel: 最終確認のタブ選択メッセージを送信: アクティブタブ=${activeTabId}`);
                }, 200); // UIの描画完了を確実に待つ
                logger_1.Logger.info(`ScopeManagerPanel: プロジェクト情報の同期が完了: ${activeProject.name}`);
            }, 100); // WebViewの初期化を待つ最小の遅延
        }
        catch (error) {
            logger_1.Logger.warn(`ScopeManagerPanel: パネル表示時のプロジェクト情報更新に失敗: ${error}`);
        }
    }
    /**
     * WebViewのHTMLを生成
     * @param webview VSCodeのWebviewインスタンス
     * @param activeTabId アクティブなタブID（デフォルトは'current-status'）
     */
    _getHtmlForWebview(webview, activeTabId = 'scope-progress') {
        // スタイルシートやスクリプトのURIを取得
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const designSystemStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.css'));
        // DialogManagerのスタイルシートを追加
        const dialogManagerStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'dialogManager', 'dialogManager.css'));
        // PromptCardsのスタイルシートを追加
        const promptCardsStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'promptCards', 'promptCards.css'));
        // ファイルブラウザのスタイルシートを追加
        const fileBrowserStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'fileBrowser', 'fileBrowser.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.js'));
        const sharingPanelScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'sharingPanel.js'));
        // ファイルブラウザのスクリプトを追加
        const fileBrowserScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'components', 'fileBrowser', 'fileBrowser.js'));
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
        // アクティブプロジェクト情報を取得（初期値はクラス変数から）
        const projectName = this._activeProject?.name || '選択なし';
        const projectPath = this._activeProject?.path || '';
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
      <link href="${dialogManagerStyleUri}" rel="stylesheet">
      <link href="${promptCardsStyleUri}" rel="stylesheet">
      <link href="${fileBrowserStyleUri}" rel="stylesheet">
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
                  <span class="project-name">${projectName}</span>
                  <span class="project-path-display">${projectPath}</span>
                </div>
                <div class="tabs-container">
                  <div class="tab ${activeTabId === 'scope-progress' ? 'active' : ''}" data-tab="scope-progress">進捗状況</div>
                  <div class="tab ${activeTabId === 'requirements' ? 'active' : ''}" data-tab="requirements">要件定義</div>
                  <div class="tab ${activeTabId === 'file-browser' ? 'active' : ''}" data-tab="file-browser">ファイル</div>
                  <div class="tab ${activeTabId === 'claude-code' ? 'active' : ''}" data-tab="claude-code">ClaudeCode連携</div>
                  <div class="tab ${activeTabId === 'tools' ? 'active' : ''}" data-tab="tools">モックアップギャラリー</div>
                </div>
              </div>
              
              <!-- 進捗状況タブコンテンツ -->
              <div id="scope-progress-tab" class="tab-content ${activeTabId === 'scope-progress' ? 'active' : ''}">
                <div class="card-body">
                  <div class="markdown-content">
                    <!-- ここにSCOPE_PROGRESS.mdの内容がマークダウン表示される -->
                    <p>読み込み中...</p>
                  </div>
                </div>
              </div>

              <!-- 要件定義タブコンテンツ -->
              <div id="requirements-tab" class="tab-content ${activeTabId === 'requirements' ? 'active' : ''}">
                <div class="card-body">
                  <div class="markdown-content">
                    <!-- ここにrequirements.mdの内容がマークダウン表示される -->
                    <p>読み込み中...</p>
                  </div>
                </div>
              </div>

              <!-- ファイルブラウザタブコンテンツ -->
              <div id="file-browser-tab" class="tab-content ${activeTabId === 'file-browser' ? 'active' : ''}">
                <div class="card-body">
                  <div class="file-browser-container">
                    <div class="file-explorer">
                      <div class="file-explorer-toolbar">
                        <button class="button button-secondary" id="refresh-files-btn">
                          <span class="material-icons">refresh</span>
                          更新
                        </button>
                        <div class="file-path-display">
                          <span id="current-file-path">プロジェクトルート</span>
                        </div>
                      </div>
                      <div class="breadcrumb-container" id="file-breadcrumb">
                        <!-- パンくずリストはJSで動的に生成 -->
                      </div>
                      <div class="file-list-container">
                        <div id="file-list" class="file-list">
                          <!-- ファイルリストはJSで動的に生成 -->
                          <p>読み込み中...</p>
                        </div>
                      </div>
                    </div>
                    <div class="file-preview">
                      <div id="file-preview-content">
                        <div class="file-preview-placeholder">
                          <span class="material-icons">description</span>
                          <p>ファイルを選択してください</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ClaudeCode連携タブコンテンツ -->
              <div id="claude-code-tab" class="tab-content ${activeTabId === 'claude-code' ? 'active' : ''}">
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
              <div id="tools-tab" class="tab-content ${activeTabId === 'tools' ? 'active' : ''}">
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
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      
      <!-- 共有パネルコンポーネント専用スクリプト -->
      <script type="module" nonce="${nonce}" src="${sharingPanelScriptUri}"></script>
      
      <!-- ファイルブラウザコンポーネント専用スクリプト -->
      <script type="module" nonce="${nonce}" src="${fileBrowserScriptUri}"></script>
    </body>
    </html>`;
    }
    /**
     * 進捗ファイルを読み込む - FileSystemServiceに委譲
     */
    async _loadProgressFile() {
        try {
            if (!this._projectPath) {
                return;
            }
            // FileSystemServiceの新しいメソッドを呼び出す
            await this._fileSystemService.loadProgressFile(this._projectPath, async (content) => {
                // マークダウン表示を更新
                await this._handleGetMarkdownContent(this._progressFilePath);
            });
        }
        catch (error) {
            logger_1.Logger.error('進捗ファイルの読み込み中にエラーが発生しました', error);
            this._showError(`進捗ファイルの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * ディレクトリ構造を更新する - FileSystemServiceに委譲
     */
    async _updateDirectoryStructure() {
        if (!this._projectPath) {
            return;
        }
        try {
            // FileSystemServiceの新しいメソッドを呼び出す
            this._directoryStructure = await this._fileSystemService.updateDirectoryStructure(this._projectPath);
        }
        catch (error) {
            logger_1.Logger.error('ディレクトリ構造の取得中にエラーが発生しました', error);
            this._directoryStructure = 'ディレクトリ構造の取得に失敗しました。';
        }
    }
    /**
     * ファイル監視を設定する
     * FileSystemServiceの拡張機能を利用
     */
    async _setupFileWatcher() {
        try {
            // 既存の監視があれば破棄
            if (this._fileWatcher) {
                this._fileWatcher.dispose();
                this._fileWatcher = null;
            }
            if (!this._projectPath) {
                return;
            }
            // FileSystemServiceの新しいメソッドを呼び出す
            this._fileWatcher = this._fileSystemService.setupProjectFileWatcher(this._projectPath, async (filePath) => {
                // ファイル変更を検出したらマークダウンを更新
                logger_1.Logger.info(`ScopeManagerPanel: ファイル変更を検出して内容を更新: ${filePath}`);
                await this._handleGetMarkdownContent(filePath);
            });
            logger_1.Logger.info('ScopeManagerPanel: ファイル監視設定完了');
        }
        catch (error) {
            logger_1.Logger.error('ファイル監視の設定中にエラーが発生しました', error);
        }
    }
    // FileSystemServiceに移動したメソッド
    /**
     * ProjectServiceのイベントリスナーを設定
     */
    _setupProjectServiceEventListeners() {
        try {
            // ProjectServiceのイベントを購読
            // プロジェクト選択イベント
            this._disposables.push(this._projectService.onProjectSelected((projectInfo) => {
                logger_1.Logger.info(`ProjectServiceからプロジェクト選択イベントを受信: ${projectInfo.name}`);
                // WebViewにプロジェクト選択状態を通知
                this._panel.webview.postMessage({
                    command: 'updateProjectName',
                    projectName: projectInfo.name
                });
                // プロジェクトパスを更新
                if (projectInfo.path !== this._projectPath) {
                    this.setProjectPath(projectInfo.path);
                }
            }));
            // プロジェクト作成イベント
            this._disposables.push(this._projectService.onProjectCreated((projectInfo) => {
                logger_1.Logger.info(`ProjectServiceからプロジェクト作成イベントを受信: ${projectInfo.name}`);
                // プロジェクト一覧を更新して表示
                const allProjects = this._projectService.getAllProjects();
                this._panel.webview.postMessage({
                    command: 'updateProjects',
                    projects: allProjects,
                    activeProject: projectInfo
                });
            }));
            // プロジェクト削除イベント
            this._disposables.push(this._projectService.onProjectRemoved((projectInfo) => {
                logger_1.Logger.info(`ProjectServiceからプロジェクト削除イベントを受信: ${projectInfo.name}`);
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
                    }
                    else if (allProjects.length > 0) {
                        this.setProjectPath(allProjects[0].path);
                    }
                }
            }));
            // プロジェクト一覧更新イベント
            this._disposables.push(this._projectService.onProjectsUpdated((projects) => {
                logger_1.Logger.info(`ProjectServiceからプロジェクト一覧更新イベントを受信: ${projects.length}件`);
                // WebViewにプロジェクト一覧を通知
                const activeProject = this._projectService.getActiveProject();
                this._panel.webview.postMessage({
                    command: 'updateProjects',
                    projects: projects,
                    activeProject: activeProject
                });
            }));
            // プロジェクトのUI状態更新イベント
            this._disposables.push(this._projectService.onProjectUIStateUpdated((uiState) => {
                logger_1.Logger.info(`ProjectServiceからプロジェクトUI状態更新イベントを受信`);
                // WebViewにプロジェクトUI状態を通知
                this._panel.webview.postMessage({
                    command: 'updateProjectUIState',
                    uiState: uiState
                });
            }));
            logger_1.Logger.info('ProjectServiceのイベントリスナー設定完了');
        }
        catch (error) {
            logger_1.Logger.error('ProjectServiceのイベントリスナー設定中にエラーが発生しました', error);
        }
    }
    /**
     * nonce値を生成
     */
    _getNonce() {
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
    dispose() {
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
    async _handleEnsureActiveProject(projectName, projectPath, activeTab) {
        try {
            logger_1.Logger.info(`プロジェクト同期確認: ${projectName}, パス: ${projectPath}${activeTab ? ', タブ: ' + activeTab : ''}`);
            // ProjectServiceの新しいensureActiveProjectメソッドを使用
            const success = await this._projectService.ensureActiveProject(projectName, projectPath, activeTab);
            if (success) {
                // 成功した場合は、最新のアクティブプロジェクト情報を取得して保存
                this._activeProject = this._projectService.getActiveProject();
                logger_1.Logger.info(`プロジェクト同期が完了しました: ${projectName}`);
            }
            else {
                logger_1.Logger.warn(`プロジェクト同期に失敗しました: ${projectName}`);
                this._showError(`プロジェクト「${projectName}」の同期に失敗しました`);
            }
        }
        catch (error) {
            logger_1.Logger.error('プロジェクトの同期に失敗しました', error);
            this._showError(`プロジェクトの同期中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * 認証状態の監視を設定
     * AuthenticationHandlerを使って認証状態をチェック
     */
    _setupTokenExpirationMonitor() {
        try {
            // AuthenticationHandlerを使って認証状態を監視
            const tokenMonitor = this._authHandler.setupTokenExpirationMonitor(
            // トークンの有効期限切れ時
            () => {
                logger_1.Logger.info('スコープマネージャー: 認証状態が無効になったため、パネルを閉じます');
                // パネルを閉じる
                this.dispose();
                // ログイン画面に直接遷移
                this._authHandler.showLoginScreen(this._extensionUri);
            }, 
            // 権限喪失時
            () => {
                logger_1.Logger.warn('スコープマネージャー: 権限が失効したため、パネルを閉じます');
                // パネルを閉じる
                this.dispose();
                vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がなくなりました。');
            });
            // Disposableリストに追加
            this._disposables.push(tokenMonitor);
            logger_1.Logger.info('スコープマネージャー: 認証状態監視を開始しました');
        }
        catch (error) {
            logger_1.Logger.error('認証状態監視の設定中にエラーが発生しました', error);
        }
    }
}
exports.ScopeManagerPanel = ScopeManagerPanel;
ScopeManagerPanel.viewType = 'scopeManager';
// 必要な権限を指定
ScopeManagerPanel._feature = roles_1.Feature.SCOPE_MANAGER;
//# sourceMappingURL=ScopeManagerPanel.js.map