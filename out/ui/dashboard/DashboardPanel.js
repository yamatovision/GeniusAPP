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
exports.DashboardPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const ProjectManagementService_1 = require("../../services/ProjectManagementService");
const AppGeniusEventBus_1 = require("../../services/AppGeniusEventBus");
const AppGeniusStateManager_1 = require("../../services/AppGeniusStateManager");
const ProtectedPanel_1 = require("../auth/ProtectedPanel");
const roles_1 = require("../../core/auth/roles");
/**
 * ダッシュボードパネル
 * プロジェクト管理と機能選択のためのWebViewインターフェース
 * 権限保護されたパネルの基底クラスを継承
 */
class DashboardPanel extends ProtectedPanel_1.ProtectedPanel {
    /**
     * 実際のパネル作成・表示ロジック
     * ProtectedPanelから呼び出される
     */
    static _createOrShowPanel(extensionUri, aiService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // すでにパネルが存在する場合は、それを表示
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return DashboardPanel.currentPanel;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(DashboardPanel.viewType, 'AppGenius プロジェクト管理', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'dist')
            ],
            enableFindWidget: true,
            enableCommandUris: true
            // WebViewオプションでsandboxを指定していましたが、現在のVSCode APIではサポートされていないため削除しました
        });
        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, aiService);
        return DashboardPanel.currentPanel;
    }
    /**
     * 外部向けのパネル作成・表示メソッド
     * 権限チェック付きで、パネルを表示する
     */
    static createOrShow(extensionUri, aiService) {
        // 権限チェック
        if (!this.checkPermissionForFeature(roles_1.Feature.DASHBOARD, 'DashboardPanel')) {
            return undefined;
        }
        // 権限があれば表示
        return this._createOrShowPanel(extensionUri, aiService);
    }
    /**
     * コンストラクタ
     */
    constructor(panel, extensionUri, aiService) {
        super(); // 親クラスのコンストラクタを呼び出し
        this._disposables = [];
        // 現在の作業状態
        this._currentProjects = [];
        this._projectRequirements = {};
        this._projectMockups = {};
        this._projectScopes = {};
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._aiService = aiService;
        // サービスの初期化
        this._projectService = ProjectManagementService_1.ProjectManagementService.getInstance();
        this._stateManager = AppGeniusStateManager_1.AppGeniusStateManager.getInstance();
        this._eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        // データの初期化
        this._currentProjects = this._projectService.getAllProjects();
        this._activeProject = this._projectService.getActiveProject();
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
            logger_1.Logger.info(`ダッシュボードWebViewからメッセージを受信: ${message.command}`);
            switch (message.command) {
                case 'createProject':
                    await this._handleCreateProject(message.name, message.description);
                    break;
                case 'openProject':
                    await this._handleOpenProject(message.id);
                    // プロジェクトを開いたら、メモリ内のプロジェクト情報を更新
                    this._currentProjects = this._projectService.getAllProjects();
                    this._activeProject = this._projectService.getActiveProject();
                    // WebViewにも状態を通知して同期
                    await this._updateWebview();
                    break;
                case 'deleteProject':
                    await this._handleDeleteProject(message.id);
                    break;
                case 'confirmDeleteProject':
                    await this._handleConfirmDeleteProject(message.id, message.projectName);
                    break;
                case 'updateProject':
                    await this._handleUpdateProject(message.id, message.updates);
                    break;
                case 'executeCommand':
                    // VSCodeコマンドを実行
                    try {
                        logger_1.Logger.info(`WebViewからのコマンド実行リクエスト: ${message.commandId}, 引数=${JSON.stringify(message.args || [])}`);
                        await vscode.commands.executeCommand(message.commandId, ...(message.args || []));
                    }
                    catch (error) {
                        logger_1.Logger.error(`コマンド実行エラー: ${message.commandId}`, error);
                        await this._showError(`コマンド実行に失敗しました: ${error.message}`);
                    }
                    break;
                case 'openRequirementsEditor':
                    await this._handleOpenRequirementsEditor();
                    break;
                case 'openMockupEditor':
                    await this._handleOpenMockupEditor();
                    break;
                case 'openImplementationSelector': // 古いコマンドも互換性のために残す
                case 'openScopeManager':
                    await this._handleOpenScopeManager();
                    break;
                // 開発アシスタントは削除済み
                case 'openDebugDetective':
                    await this._handleOpenDebugDetective();
                    break;
                case 'openEnvironmentVariablesAssistant':
                    await this._handleOpenEnvironmentVariablesAssistant();
                    break;
                case 'openReferenceManager':
                    await this._handleOpenReferenceManager();
                    break;
                case 'analyzeProject':
                    await this._handleAnalyzeProject();
                    break;
                case 'loadExistingProject':
                    await this._handleLoadExistingProject();
                    break;
                case 'refreshProjects':
                    await this._refreshProjects();
                    break;
                case 'logout':
                    // ログアウト処理
                    await vscode.commands.executeCommand('appgenius.simpleAuth.logout');
                    break;
                case 'showVSCodeMessage':
                    await this._handleShowVSCodeMessage(message.type, message.message);
                    break;
            }
        }, null, this._disposables);
        // イベントリスナーの登録
        this._registerEventListeners();
        // 初期データをロード
        this._refreshProjects();
    }
    /**
     * イベントリスナーの登録
     */
    _registerEventListeners() {
        // 要件定義更新イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.REQUIREMENTS_UPDATED, async (event) => {
            if (event.projectId) {
                logger_1.Logger.debug(`Requirements updated for project: ${event.projectId}`);
                this._projectRequirements[event.projectId] = event.data;
                // 要件定義が更新されたら、モックアップギャラリーのロック解除を確認
                const project = this._projectService.getProject(event.projectId);
                if (project && project.path) {
                    // モックアップフォルダの確認（要件定義更新時に再確認する）
                    const hasMockupFiles = this._checkMockupFolderStatus(project.path, event.projectId);
                    if (hasMockupFiles) {
                        logger_1.Logger.info(`要件定義更新によりモックアップギャラリーが利用可能になりました: ${event.projectId}`);
                    }
                }
                // アクティブなプロジェクトの場合、UIを更新
                if (this._activeProject && this._activeProject.id === event.projectId) {
                    await this._updateWebview();
                }
            }
        }));
        // モックアップ作成イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.MOCKUP_CREATED, async (event) => {
            if (event.projectId) {
                logger_1.Logger.debug(`Mockup created for project: ${event.projectId}`);
                if (!this._projectMockups[event.projectId]) {
                    this._projectMockups[event.projectId] = [];
                }
                // 重複を避けるために既存のものを削除
                const mockupId = event.data.id;
                const existingIndex = this._projectMockups[event.projectId]
                    .findIndex((m) => m.id === mockupId);
                if (existingIndex >= 0) {
                    this._projectMockups[event.projectId][existingIndex] = event.data;
                }
                else {
                    this._projectMockups[event.projectId].push(event.data);
                }
                // モックアップ作成イベントが発生したら、HTMLファイルの有無を再確認
                const project = this._projectService.getProject(event.projectId);
                if (project && project.path) {
                    // モックアップHTMLファイルの有無を確認し、UI更新のフラグを立てる
                    this._checkMockupFolderStatus(project.path, event.projectId);
                    logger_1.Logger.info(`モックアップ作成イベントを検知: ${event.projectId}, ギャラリー表示を更新します`);
                }
                // アクティブなプロジェクトの場合、UIを更新
                if (this._activeProject && this._activeProject.id === event.projectId) {
                    await this._updateWebview();
                }
            }
        }));
        // スコープ更新イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.SCOPE_UPDATED, async (event) => {
            if (event.projectId) {
                logger_1.Logger.debug(`Scope updated for project: ${event.projectId}`);
                this._projectScopes[event.projectId] = event.data;
                // アクティブなプロジェクトの場合、UIを更新
                if (this._activeProject && this._activeProject.id === event.projectId) {
                    await this._updateWebview();
                }
            }
        }));
        // 実装進捗イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.IMPLEMENTATION_PROGRESS, async (event) => {
            if (event.projectId && this._projectScopes[event.projectId]) {
                logger_1.Logger.debug(`Implementation progress updated for project: ${event.projectId}`);
                // スコープの進捗を更新
                const scope = this._projectScopes[event.projectId];
                scope.items = event.data.items;
                scope.totalProgress = event.data.totalProgress;
                // アクティブなプロジェクトの場合、UIを更新
                if (this._activeProject && this._activeProject.id === event.projectId) {
                    await this._updateWebview();
                }
            }
        }));
        // プロジェクト作成イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_CREATED, async () => {
            await this._refreshProjects();
        }));
        // プロジェクト削除イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_DELETED, async (event) => {
            const projectId = event.data?.id;
            if (projectId) {
                // 削除されたプロジェクトのデータをクリーンアップ
                delete this._projectRequirements[projectId];
                delete this._projectMockups[projectId];
                delete this._projectScopes[projectId];
                await this._refreshProjects();
            }
        }));
        // フェーズ完了イベント
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PHASE_COMPLETED, async () => {
            await this._refreshProjects();
        }));
        // CURRENT_STATUS更新イベントの処理
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.CURRENT_STATUS_UPDATED, async (event) => {
            logger_1.Logger.info('CURRENT_STATUS更新イベントを受信しました - ダッシュボードの更新を開始');
            // プロジェクト一覧と詳細情報を最新化
            await this._refreshProjects();
            // アクティブなプロジェクトがあり、そのプロジェクトのファイルが更新された場合は、
            // 明示的にウェブビューをリフレッシュする
            if (this._activeProject && (!event.projectId || event.projectId === this._activeProject.id)) {
                logger_1.Logger.info('アクティブプロジェクトのCURRENT_STATUSが更新されたため、ウェブビューを強制更新します');
                await this._updateWebview();
            }
            logger_1.Logger.info('CURRENT_STATUS更新に伴うダッシュボード更新完了');
        }));
    }
    /**
     * プロジェクト一覧を更新（簡略化版）
     */
    async _refreshProjects() {
        try {
            // タイムアウト処理を追加
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('プロジェクト一覧の読み込みがタイムアウトしました'));
                }, 5000); // 5秒でタイムアウト
            });
            // プロジェクト情報取得処理
            const loadDataPromise = (async () => {
                // 基本プロジェクト情報のみ取得して画面を更新（重い処理は避ける）
                this._currentProjects = this._projectService.getAllProjects();
                this._activeProject = this._projectService.getActiveProject();
                // プロジェクトパスが変更されたら、ファイル監視を設定
                if (this._activeProject?.path) {
                    this._setupFileWatcher(this._activeProject.path);
                }
                // 最低限のデータだけすぐに画面に表示
                await this._updateWebview();
                // ローディング状態を終了
                await this._panel.webview.postMessage({
                    command: 'refreshComplete'
                });
                // 必要に応じて詳細データを別途バックグラウンドでロード（タイムアウトの影響を受けない）
                if (this._activeProject) {
                    // このメソッドは非同期だがawaitしない（UIをブロックしないため）
                    setTimeout(() => {
                        this._loadProjectDetails(this._activeProject.id).catch(err => {
                            logger_1.Logger.warn(`プロジェクト詳細のバックグラウンドロード中にエラー: ${err.message}`);
                        });
                    }, 100);
                }
            })();
            // タイムアウトと実際の処理を競合させる
            await Promise.race([timeoutPromise, loadDataPromise]);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト一覧更新エラー`, error);
            // エラー時にも必ずローディング状態を解除
            try {
                await this._panel.webview.postMessage({
                    command: 'refreshComplete'
                });
                // タイムアウトエラーの場合は特別なメッセージ
                if (error.message.includes('タイムアウト')) {
                    await this._showError('プロジェクト一覧の読み込みに時間がかかっています。再度試すか、VSCodeを再起動してください。');
                }
                else {
                    await this._showError(`プロジェクト一覧の更新中にエラーが発生しました: ${error.message}`);
                }
            }
            catch (err) {
                logger_1.Logger.error('エラーメッセージ送信中にさらにエラーが発生', err);
            }
        }
    }
    /**
     * ファイル監視の設定
     * docs/CURRENT_STATUS.mdファイルの変更を監視する
     * イベントバスとの連携を強化し、独自の変更検出とリフレッシュも実施
     */
    _setupFileWatcher(projectPath) {
        try {
            // 既存のウォッチャーがあれば解放
            if (this._fileWatcher) {
                this._fileWatcher.dispose();
                this._disposables = this._disposables.filter(d => d !== this._fileWatcher);
            }
            // docs ディレクトリが存在しない場合は作成
            const docsDir = path.join(projectPath, 'docs');
            if (!fs.existsSync(docsDir)) {
                fs.mkdirSync(docsDir, { recursive: true });
            }
            // CURRENT_STATUS.md の変更を監視
            this._fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectPath, 'docs/CURRENT_STATUS.md'), false, // ファイル作成を通知
            false, // ファイル変更を通知
            false // ファイル削除を通知
            );
            // 変更を検出したときに複数回の処理を防ぐためのデバウンス実装
            let debounceTimer = null;
            const debouncedRefresh = () => {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = setTimeout(async () => {
                    logger_1.Logger.info('CURRENT_STATUS.mdファイル変更のデバウンス処理を実行します');
                    await this._refreshProjects();
                    // ウェブビューを確実に更新
                    await this._updateWebview();
                    // イベントバスに通知（他のコンポーネントにも変更を伝播）
                    const eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
                    eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.CURRENT_STATUS_UPDATED, { filePath: path.join(projectPath, 'docs/CURRENT_STATUS.md'), timestamp: Date.now(), source: 'Dashboard' }, 'DashboardPanel', this._activeProject?.id);
                }, 300); // 300ms のデバウンス時間
            };
            // ファイル変更時の処理
            this._fileWatcher.onDidChange(() => {
                logger_1.Logger.info('CURRENT_STATUS.mdファイルの変更を検出しました (Dashboard)');
                debouncedRefresh();
            });
            // 新規ファイル作成時の処理
            this._fileWatcher.onDidCreate(() => {
                logger_1.Logger.info('CURRENT_STATUS.mdファイルが新規作成されました (Dashboard)');
                debouncedRefresh();
            });
            // ファイル削除時の処理（必要に応じて）
            this._fileWatcher.onDidDelete(() => {
                logger_1.Logger.info('CURRENT_STATUS.mdファイルが削除されました (Dashboard)');
                debouncedRefresh();
            });
            // ウォッチャーをdisposablesに追加
            this._disposables.push(this._fileWatcher);
            logger_1.Logger.info('拡張されたCURRENT_STATUS.mdファイルの監視を設定しました');
        }
        catch (error) {
            logger_1.Logger.error('ファイル監視の設定中にエラーが発生しました', error);
        }
    }
    /**
     * プロジェクト詳細情報を非同期でバックグラウンドロード
     * UI応答性を維持するため、メインのレンダリング後に実行
     */
    /**
     * モックアップフォルダの状態をチェックする関数（一元管理のため抽出）
     * @param projectPath プロジェクトパス
     * @param projectId プロジェクトID
     * @returns モックアップHTMLファイルの有無
     */
    _checkMockupFolderStatus(projectPath, projectId) {
        let hasMockupFiles = false;
        try {
            const mockupsDir = path.join(projectPath, 'mockups');
            if (fs.existsSync(mockupsDir)) {
                const files = fs.readdirSync(mockupsDir);
                hasMockupFiles = files.some(file => file.endsWith('.html'));
                // 既存のactiveProjectDetailsがない場合は初期化
                if (!this._projectMockups[projectId]) {
                    this._projectMockups[projectId] = [];
                }
            }
        }
        catch (err) {
            logger_1.Logger.warn(`モックアップフォルダの確認中にエラー: ${err.message}`);
        }
        return hasMockupFiles;
    }
    async _loadProjectDetails(projectId) {
        try {
            const project = this._projectService.getProject(projectId);
            if (!project)
                return;
            const projectPath = project.path;
            // 最低限必要なデータだけロード
            if (!(projectId in this._projectRequirements)) {
                try {
                    const requirements = await this._stateManager.getRequirements(projectId);
                    if (requirements) {
                        this._projectRequirements[projectId] = requirements;
                    }
                    else {
                        // 空のオブジェクトで初期化
                        this._projectRequirements[projectId] = {
                            document: '',
                            sections: [],
                            extractedItems: [],
                            chatHistory: []
                        };
                    }
                }
                catch (e) {
                    logger_1.Logger.debug(`No requirements found for project: ${projectId}`);
                }
            }
            // スコープ情報がまだない場合のみロード
            if (!(projectId in this._projectScopes)) {
                try {
                    const scope = await this._stateManager.getImplementationScope(projectId);
                    if (scope) {
                        this._projectScopes[projectId] = scope;
                    }
                    else {
                        // 基本スコープデータで初期化
                        this._projectScopes[projectId] = {
                            items: [],
                            selectedIds: [],
                            estimatedTime: '',
                            totalProgress: 0,
                            startDate: new Date().toISOString().split('T')[0],
                            targetDate: '',
                            projectPath: projectPath || ''
                        };
                    }
                }
                catch (e) {
                    logger_1.Logger.debug(`No implementation scope found for project: ${projectId}`);
                }
            }
            // モックアップファイルの存在を初回ロード時だけ確認
            if (project.path) {
                // 抽出した関数を使用
                this._checkMockupFolderStatus(project.path, projectId);
            }
            // 詳細情報が読み込まれた後、UI更新（ロードインジケータは表示せずに更新）
            await this._updateWebview();
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト詳細情報読み込みエラー: ${projectId}`, error);
        }
    }
    /**
     * プロジェクト作成処理
     */
    async _handleCreateProject(name, description) {
        try {
            logger_1.Logger.info(`プロジェクト作成処理が開始されました: ${name}`);
            if (!name) {
                throw new Error('プロジェクト名を入力してください');
            }
            // 常にフォルダ選択ダイアログを表示して保存先を選択させる
            const options = {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: `プロジェクト「${name}」の保存先を選択`
            };
            logger_1.Logger.info(`フォルダ選択ダイアログを表示します`);
            const folderUri = await vscode.window.showOpenDialog(options);
            if (!folderUri || folderUri.length === 0) {
                throw new Error('プロジェクトの保存先が選択されていません');
            }
            // 選択されたフォルダに、プロジェクト名のサブフォルダを作成
            const projectPath = path.join(folderUri[0].fsPath, name);
            logger_1.Logger.info(`プロジェクトパス: ${projectPath}`);
            // プロジェクトを作成
            logger_1.Logger.info(`ProjectManagementServiceでプロジェクトを作成します`);
            const projectId = await this._projectService.createProject({
                name,
                description: "",
                path: projectPath
            });
            // 作成したプロジェクトをアクティブに設定
            logger_1.Logger.info(`プロジェクトをアクティブに設定します: ${projectId}`);
            await this._projectService.setActiveProject(projectId);
            // データを更新
            logger_1.Logger.info(`プロジェクト一覧を更新します`);
            await this._refreshProjects();
            // 成功メッセージを表示
            logger_1.Logger.info(`プロジェクト作成成功: ${name}, パス: ${projectPath}`);
            vscode.window.showInformationMessage(`プロジェクト「${name}」が作成されました: ${projectPath}`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト作成エラー`, error);
            await this._showError(`プロジェクトの作成に失敗しました: ${error.message}`);
            // エラー後にモーダルを再表示
            try {
                logger_1.Logger.info('エラー後にモーダルを再表示します');
                await this._panel.webview.postMessage({
                    command: 'showModal'
                });
            }
            catch (e) {
                logger_1.Logger.error('モーダル再表示に失敗しました', e);
            }
        }
    }
    /**
     * VSCodeのエラーダイアログとWebViewエラーメッセージを表示
     */
    async _showError(message) {
        // VSCode拡張のエラーダイアログを表示
        vscode.window.showErrorMessage(message);
        // WebViewにエラーメッセージを送信
        try {
            await this._panel.webview.postMessage({
                command: 'showError',
                message
            });
        }
        catch (e) {
            logger_1.Logger.error('WebViewへのエラーメッセージ送信に失敗しました', e);
        }
    }
    /**
     * プロジェクトオープン処理
     */
    async _handleOpenProject(id) {
        try {
            // プロジェクトの存在確認
            const project = this._projectService.getProject(id);
            if (!project) {
                throw new Error(`プロジェクトが見つかりません: ${id}`);
            }
            // プロジェクトフォルダの存在確認
            if (!fs.existsSync(project.path)) {
                const message = `プロジェクトフォルダが見つかりません: ${project.path}`;
                logger_1.Logger.error(message);
                // フォルダ選択ダイアログを表示
                const options = {
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: `プロジェクト「${project.name}」のフォルダを選択`
                };
                const folderUri = await vscode.window.showOpenDialog(options);
                if (!folderUri || folderUri.length === 0) {
                    throw new Error('プロジェクトのフォルダパスを更新できませんでした');
                }
                // プロジェクトパスを更新（AppGeniusStateManagerを経由）
                const newPath = folderUri[0].fsPath;
                const stateManager = AppGeniusStateManager_1.AppGeniusStateManager.getInstance();
                await stateManager.updateProjectPath(id, newPath);
                logger_1.Logger.info(`プロジェクトパスを更新しました: ID=${id}, 新しいパス=${newPath}`);
                // 更新されたプロジェクト情報を取得
                const updatedProject = this._projectService.getProject(id);
                if (!updatedProject) {
                    throw new Error(`プロジェクト情報の更新に失敗しました: ${id}`);
                }
                // 更新後のパスを使用
                project.path = updatedProject.path;
            }
            // CLAUDE.mdファイルの存在チェック - 存在しなくても続行するように変更
            const claudeMdPath = path.join(project.path, 'CLAUDE.md');
            if (!fs.existsSync(claudeMdPath)) {
                // ファイルが存在しないことをログに記録するだけで続行
                logger_1.Logger.info(`CLAUDE.mdファイルが見つかりませんが、問題なく続行します: ${claudeMdPath}`);
            }
            // docs/mockupsディレクトリの存在確認
            const docsPath = path.join(project.path, 'docs');
            const mockupsPath = path.join(project.path, 'mockups');
            if (!fs.existsSync(docsPath)) {
                fs.mkdirSync(docsPath, { recursive: true });
                this._createInitialDocuments(project.path);
            }
            if (!fs.existsSync(mockupsPath)) {
                fs.mkdirSync(mockupsPath, { recursive: true });
            }
            // プロジェクトをアクティブに設定
            await this._projectService.setActiveProject(id);
            // プロジェクト選択イベントを発火
            this._eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_SELECTED, { id, path: project.path, name: project.name }, 'DashboardPanel', id);
            logger_1.Logger.info(`プロジェクト選択イベント発火: ID=${id}, パス=${project.path}`);
            // データを更新
            await this._refreshProjects();
            // 成功メッセージを表示
            vscode.window.showInformationMessage(`プロジェクト「${project.name}」を開きました`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトオープンエラー: ${id}`, error);
            await this._showError(`プロジェクトを開けませんでした: ${error.message}`);
        }
    }
    /**
     * プロジェクト削除確認処理
     * WebViewから送信されたconfirmDeleteProjectメッセージを処理
     */
    async _handleConfirmDeleteProject(id, projectName) {
        try {
            // VSCodeのネイティブな確認ダイアログを表示
            const answer = await vscode.window.showWarningMessage(`プロジェクト「${projectName}」を削除しますか？この操作は元に戻せません。`, { modal: true }, 'はい', 'いいえ');
            // ユーザーが「はい」を選択した場合のみ削除処理を実行
            if (answer === 'はい') {
                await this._handleDeleteProject(id);
            }
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト削除確認エラー: ${id}`, error);
            await this._showError(`プロジェクト削除確認中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * プロジェクト削除処理
     */
    async _handleDeleteProject(id) {
        try {
            // プロジェクトの存在確認
            const project = this._projectService.getProject(id);
            if (!project) {
                throw new Error(`プロジェクトが見つかりません: ${id}`);
            }
            // プロジェクトを削除
            const success = await this._projectService.deleteProject(id);
            if (!success) {
                throw new Error('プロジェクトの削除に失敗しました');
            }
            // アクティブプロジェクトを更新
            if (this._activeProject && this._activeProject.id === id) {
                const projects = this._projectService.getAllProjects();
                if (projects.length > 0) {
                    await this._projectService.setActiveProject(projects[0].id);
                }
            }
            // データを更新
            await this._refreshProjects();
            // 成功メッセージを表示
            vscode.window.showInformationMessage(`プロジェクト「${project.name}」が削除されました`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト削除エラー: ${id}`, error);
            await this._showError(`プロジェクトの削除に失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクト更新処理
     */
    async _handleUpdateProject(id, updates) {
        try {
            // プロジェクトの存在確認
            const project = this._projectService.getProject(id);
            if (!project) {
                throw new Error(`プロジェクトが見つかりません: ${id}`);
            }
            // プロジェクトを更新
            await this._projectService.updateProject(id, updates);
            // データを更新
            await this._refreshProjects();
            // 成功メッセージを表示
            vscode.window.showInformationMessage(`プロジェクト「${project.name}」が更新されました`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト更新エラー: ${id}`, error);
            await this._showError(`プロジェクトの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * 要件定義エディタを開く
     */
    async _handleOpenRequirementsEditor() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // プロジェクトのパスを取得
            const projectPath = this._activeProject.path;
            if (!projectPath) {
                throw new Error('プロジェクトパスが設定されていません。プロジェクト設定を確認してください。');
            }
            logger_1.Logger.info(`要件定義エディタを開きます。プロジェクトパス: ${projectPath}`);
            // 先にメッセージを表示せずに直接コマンド実行
            // 要件定義エディタを開く（プロジェクトパスを引数として渡す）
            await vscode.commands.executeCommand('appgenius-ai.openSimpleChat', projectPath);
        }
        catch (error) {
            logger_1.Logger.error(`要件定義エディタ起動エラー`, error);
            await this._showError(`要件定義エディタの起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップギャラリーを開く
     */
    async _handleOpenMockupEditor() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // プロジェクトのパスを取得
            const projectPath = this._activeProject.path;
            // プロジェクトパスをパラメータとして渡してモックアップギャラリーを開く
            await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', projectPath);
            // ユーザーに通知
            logger_1.Logger.info(`モックアップギャラリーを開きます。プロジェクトパス: ${projectPath}`);
        }
        catch (error) {
            logger_1.Logger.error(`モックアップギャラリー起動エラー`, error);
            await this._showError(`モックアップギャラリーの起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * スコープマネージャーを開く
     */
    async _handleOpenScopeManager() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // プロジェクトパスを取得
            const projectPath = this._activeProject.path;
            if (!projectPath) {
                throw new Error('プロジェクトパスが設定されていません。プロジェクト設定を確認してください。');
            }
            logger_1.Logger.info(`スコープマネージャーを開きます。プロジェクトパス: ${projectPath}`);
            // 先にメッセージを表示せずに直接コマンド実行
            // スコープマネージャーを開く（プロジェクトパスを引数として渡す）
            logger_1.Logger.info(`[Debug] openScopeManagerコマンド実行: パラメータ=${projectPath}`);
            await vscode.commands.executeCommand('appgenius-ai.openScopeManager', projectPath);
        }
        catch (error) {
            logger_1.Logger.error(`スコープマネージャー起動エラー`, error);
            await this._showError(`スコープマネージャーの起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * 開発アシスタント機能は削除済み
     */
    /**
     * デバッグ探偵を開く
     */
    async _handleOpenDebugDetective() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // プロジェクトパスを取得
            const projectPath = this._activeProject.path;
            if (!projectPath) {
                throw new Error('プロジェクトパスが設定されていません。プロジェクト設定を確認してください。');
            }
            logger_1.Logger.info(`デバッグ探偵を開きます。プロジェクトパス: ${projectPath}`);
            // 先にメッセージを表示せずに直接コマンド実行
            // デバッグ探偵を開く（プロジェクトパスを引数として渡す）
            await vscode.commands.executeCommand('appgenius-ai.openDebugDetective', projectPath);
        }
        catch (error) {
            logger_1.Logger.error(`デバッグ探偵起動エラー`, error);
            await this._showError(`デバッグ探偵の起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数アシスタントを開く
     */
    async _handleOpenEnvironmentVariablesAssistant() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // プロジェクトパスを取得
            const projectPath = this._activeProject.path;
            // 環境変数アシスタントを開く
            await vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant', projectPath);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数アシスタント起動エラー`, error);
            await this._showError(`環境変数アシスタントの起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * リファレンスマネージャーを開く
     */
    async _handleOpenReferenceManager() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // Webview経由でリファレンス追加中の場合はそのメッセージをバックエンドに送信
            await this._panel.webview.postMessage({
                command: 'syncReferenceManagerState'
            });
            // リファレンスマネージャーを開く
            vscode.commands.executeCommand('appgenius-ai.openReferenceManager');
        }
        catch (error) {
            logger_1.Logger.error(`リファレンスマネージャー起動エラー`, error);
            await this._showError(`リファレンスマネージャーの起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクト分析を実行
     */
    async _handleAnalyzeProject() {
        try {
            // アクティブなプロジェクトがあるか確認
            if (!this._activeProject) {
                throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
            }
            // プロジェクト分析を実行
            vscode.commands.executeCommand('appgenius-ai.analyzeProject');
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト分析エラー`, error);
            await this._showError(`プロジェクト分析の実行に失敗しました: ${error.message}`);
        }
    }
    /**
     * 既存プロジェクトを読み込む
     */
    async _handleLoadExistingProject() {
        try {
            // フォルダ選択ダイアログを表示
            const options = {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'プロジェクトフォルダを選択'
            };
            const folderUri = await vscode.window.showOpenDialog(options);
            if (!folderUri || folderUri.length === 0) {
                return; // ユーザーがキャンセルした場合
            }
            const folderPath = folderUri[0].fsPath;
            // プロジェクトフォルダを検証
            await this._validateAndLoadProject(folderPath);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト読み込みエラー`, error);
            await this._showError(`プロジェクトの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクトフォルダを検証して読み込む
     */
    async _validateAndLoadProject(folderPath) {
        // CLAUDE.mdファイルの存在確認 - 存在しなくても続行するように変更
        const claudeMdPath = path.join(folderPath, 'CLAUDE.md');
        let claudeMdExists = fs.existsSync(claudeMdPath);
        // CLAUDE.mdがなくても、常に続行するように修正
        if (!claudeMdExists) {
            logger_1.Logger.info(`CLAUDE.mdファイルが見つかりませんが、問題なく続行します: ${claudeMdPath}`);
        }
        // docs/mockupsディレクトリの存在確認
        const docsPath = path.join(folderPath, 'docs');
        const mockupsPath = path.join(folderPath, 'mockups');
        // 必要に応じてディレクトリを作成
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath, { recursive: true });
            // 基本的なドキュメントファイルも作成
            try {
                this._createInitialDocuments(folderPath);
                logger_1.Logger.info(`初期ドキュメントファイルを作成しました`);
            }
            catch (e) {
                logger_1.Logger.warn(`初期ドキュメントの作成に失敗しました: ${e.message}`);
            }
        }
        if (!fs.existsSync(mockupsPath)) {
            fs.mkdirSync(mockupsPath, { recursive: true });
        }
        // フォルダ名をプロジェクト名として取得
        const folderName = path.basename(folderPath);
        // CLAUDE.mdから説明を取得
        let description = '';
        try {
            const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
            const firstLine = claudeMdContent.split('\n')[0];
            if (firstLine && firstLine.startsWith('# ')) {
                description = firstLine.substring(2).replace(' 開発ガイド', '').trim();
            }
        }
        catch (e) {
            logger_1.Logger.warn(`CLAUDE.mdファイルの読み込みに失敗しました: ${e.message}`);
        }
        // プロジェクトを作成
        const projectData = {
            name: folderName,
            description: "",
            path: folderPath
        };
        try {
            // プロジェクトを登録
            const projectId = await this._projectService.createProject(projectData);
            // 作成したプロジェクトをアクティブに設定
            await this._projectService.setActiveProject(projectId);
            // データを更新
            await this._refreshProjects();
            // 成功メッセージを表示
            vscode.window.showInformationMessage(`プロジェクト「${folderName}」を読み込みました`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト登録エラー`, error);
            throw new Error(`プロジェクトの登録に失敗しました: ${error.message}`);
        }
    }
    /**
     * ファイルが初期テンプレートから変更されているか確認
     * @param content ファイルの内容
     * @param fileType ファイルの種類（'requirements' または 'structure'）
     */
    _isFileChangedFromTemplate(content, fileType) {
        // テンプレート内容
        const templates = {
            requirements: `# 要件定義

## 機能要件

1. 要件1
   - 説明: 機能の詳細説明
   - 優先度: 高

2. 要件2
   - 説明: 機能の詳細説明
   - 優先度: 中

## 非機能要件

1. パフォーマンス
   - 説明: レスポンス時間や処理能力に関する要件
   - 優先度: 中

2. セキュリティ
   - 説明: セキュリティに関する要件
   - 優先度: 高

## ユーザーストーリー

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。`,
            structure: `# ディレクトリ構造

\`\`\`
project/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── models/
\`\`\``
        };
        const templateContent = templates[fileType];
        // 行数が異なるか確認
        const contentLines = content.split('\n').filter(line => line.trim() !== '');
        const templateLines = templateContent.split('\n').filter(line => line.trim() !== '');
        // 行数が明らかに異なる場合は変更されたと判断
        if (Math.abs(contentLines.length - templateLines.length) > 3) {
            return true;
        }
        // 同じ行数でも内容が異なるか確認（最低でも30%以上の行が変更されていること）
        let differentLines = 0;
        for (let i = 0; i < Math.min(contentLines.length, templateLines.length); i++) {
            if (contentLines[i] !== templateLines[i]) {
                differentLines++;
            }
        }
        const diffPercentage = differentLines / Math.min(contentLines.length, templateLines.length);
        return diffPercentage > 0.3; // 30%以上の行が異なる場合は変更されたと判断
    }
    // エラーメッセージの表示メソッドは522行目に定義済み
    /**
     * VSCodeメッセージ表示処理
     */
    async _handleShowVSCodeMessage(type, message) {
        switch (type) {
            case 'info':
                vscode.window.showInformationMessage(message);
                break;
            case 'warning':
                vscode.window.showWarningMessage(message);
                break;
            case 'error':
                vscode.window.showErrorMessage(message);
                break;
            default:
                vscode.window.showInformationMessage(message);
        }
    }
    /**
     * 初期ドキュメントファイルを作成
     * @param projectPath プロジェクトのパス
     */
    _createInitialDocuments(projectPath) {
        try {
            const docsDir = path.join(projectPath, 'docs');
            // 各ファイルの作成（既存のファイルは上書きしない）
            const files = [
                {
                    path: path.join(docsDir, 'requirements.md'),
                    content: `# 要件定義

## 機能要件

1. 要件1
   - 説明: 機能の詳細説明
   - 優先度: 高

2. 要件2
   - 説明: 機能の詳細説明
   - 優先度: 中

## 非機能要件

1. パフォーマンス
   - 説明: レスポンス時間や処理能力に関する要件
   - 優先度: 中

2. セキュリティ
   - 説明: セキュリティに関する要件
   - 優先度: 高

## ユーザーストーリー

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。
`
                },
                {
                    path: path.join(docsDir, 'structure.md'),
                    content: `# ディレクトリ構造

\`\`\`
project/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── models/
\`\`\`
`
                },
                {
                    path: path.join(docsDir, 'scope.md'),
                    content: `# 実装スコープ

## 完了

（まだ完了した項目はありません）

## 進行中

（実装中の項目がここに表示されます）

## 未着手

1. ユーザー認証機能
   - 説明: ログイン・登録機能の実装
   - 優先度: 高
   - 関連ファイル: 未定

2. データ表示機能
   - 説明: メインデータの一覧表示
   - 優先度: 高
   - 関連ファイル: 未定
`
                },
                {
                    path: path.join(docsDir, 'api.md'),
                    content: `# API設計

## エンドポイント一覧

### ユーザー管理

- \`POST /api/auth/login\`
  - 説明: ユーザーログイン
  - リクエスト: \`{ email: string, password: string }\`
  - レスポンス: \`{ token: string, user: User }\`

- \`POST /api/auth/register\`
  - 説明: ユーザー登録
  - リクエスト: \`{ name: string, email: string, password: string }\`
  - レスポンス: \`{ token: string, user: User }\`

### データ管理

- \`GET /api/data\`
  - 説明: データ一覧取得
  - リクエストパラメータ: \`{ page: number, limit: number }\`
  - レスポンス: \`{ data: DataItem[], total: number }\`
`
                },
                {
                    path: path.join(docsDir, 'env.example'),
                    content: `# 環境変数サンプル
# 実際の値は.envファイルに設定してください

# サーバー設定
PORT=3000
NODE_ENV=development

# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydatabase
DB_USER=user
DB_PASSWORD=password

# 認証設定
JWT_SECRET=your_jwt_secret_key
`
                }
            ];
            // 各ファイルを順番に処理
            for (const file of files) {
                // ファイルが存在しない場合のみ作成
                if (!fs.existsSync(file.path)) {
                    fs.writeFileSync(file.path, file.content, 'utf8');
                    logger_1.Logger.info(`${path.basename(file.path)} を作成しました: ${file.path}`);
                }
                else {
                    logger_1.Logger.info(`${path.basename(file.path)} は既に存在するため、スキップします: ${file.path}`);
                }
            }
            // CURRENT_STATUS.mdの作成は ProjectManagementService.createInitialDocuments で行うため、ここでは実装しない
            logger_1.Logger.info(`初期ドキュメントを作成しました: ${projectPath}`);
        }
        catch (error) {
            logger_1.Logger.error(`初期ドキュメント作成エラー: ${error.message}`);
            throw error;
        }
    }
    /**
     * WebViewを更新
     */
    async _update() {
        if (!this._panel.visible) {
            return;
        }
        try {
            logger_1.Logger.info('ダッシュボードWebViewを更新開始');
            // 最新のプロジェクトデータを取得
            this._currentProjects = this._projectService.getAllProjects();
            this._activeProject = this._projectService.getActiveProject();
            // HTMLを設定
            this._panel.webview.html = this._getHtmlForWebview();
            // ローディング表示を開始
            await this._panel.webview.postMessage({
                command: 'refreshProjects'
            });
            // データを更新してWebViewに反映
            await this._updateWebview();
            logger_1.Logger.info('ダッシュボードWebView更新完了');
        }
        catch (error) {
            logger_1.Logger.error(`WebView更新エラー`, error);
            // エラーが発生しても最低限のUIは維持
            this._panel.webview.html = this._getHtmlForWebview();
            // エラー時にもローディング状態を解除
            await this._panel.webview.postMessage({
                command: 'refreshComplete'
            });
        }
    }
    /**
     * WebViewの状態を更新
     */
    async _updateWebview() {
        try {
            // 最新のプロジェクト情報を取得
            this._currentProjects = this._projectService.getAllProjects();
            this._activeProject = this._projectService.getActiveProject();
            logger_1.Logger.info(`ダッシュボードWebView更新: プロジェクト数=${this._currentProjects.length}, アクティブプロジェクト=${this._activeProject?.name || 'なし'}`);
            // WebViewに状態更新を送信
            await this._panel.webview.postMessage({
                command: 'updateState',
                projects: this._currentProjects || [],
                activeProject: this._activeProject, // スコープマネージャーと共有するためにアクティブプロジェクト情報も送信
                activeProjectDetails: this._activeProject ? {
                    id: this._activeProject.id,
                    name: this._activeProject.name,
                    path: this._activeProject.path,
                } : null
            });
            // ローディング状態を終了
            await this._panel.webview.postMessage({
                command: 'refreshComplete'
            });
        }
        catch (error) {
            logger_1.Logger.error(`WebView状態更新エラー`, error);
            // 最低限のメッセージを送信
            await this._panel.webview.postMessage({
                command: 'showError',
                message: 'プロジェクトデータの読み込み中にエラーが発生しました。'
            });
            // エラー時にもローディング状態を解除
            await this._panel.webview.postMessage({
                command: 'refreshComplete'
            });
        }
    }
    /**
     * WebView用のHTMLを生成
     */
    _getHtmlForWebview() {
        const webview = this._panel.webview;
        // WebView内でのリソースへのパスを取得
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js'));
        // WebViewのHTMLを構築 - シンプル化したインラインスタイルで実装
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; frame-src https:;">
  <title>AppGenius プロジェクト管理</title>
  <style>
    /* リセットとベーススタイル */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      color: #333;
      background-color: #f8f9fa;
      line-height: 1.6;
    }
    
    /* コンテナ */
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    /* ヘッダー */
    .header {
      padding: 1rem 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e1e8f5;
      margin-bottom: 2rem;
    }
    
    .header h1 {
      font-size: 1.8rem;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #4a69bd;
      margin: 0;
    }
    
    .header-logo {
      background-color: #4a69bd;
      color: white;
      padding: 8px;
      border-radius: 8px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .header-actions {
      display: flex;
      gap: 10px;
    }
    
    /* ボタン共通スタイル */
    .button {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: none;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    }
    
    .button.primary {
      background-color: #4a69bd;
      color: white;
    }
    
    .button.primary:hover {
      background-color: #3d5aa1;
    }
    
    .button.secondary {
      background-color: #f1f5fd;
      color: #4a69bd;
      border: 1px solid #d0def5;
    }
    
    .button.secondary:hover {
      background-color: #e1ecfc;
    }
    
    /* 主要コンテンツエリア */
    .main-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    
    /* プロジェクト作成セクション */
    .project-actions {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2rem;
      align-items: center;
    }
    
    .project-actions h2 {
      font-size: 1.3rem;
      color: #2d3748;
      font-weight: 600;
      margin: 0;
    }
    
    .actions-buttons {
      display: flex;
      gap: 10px;
    }
    
    /* プロジェクトグリッド */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 2rem;
    }
    
    .project-card {
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    
    .project-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }
    
    .project-card-header {
      padding: 20px;
      border-bottom: 1px solid #f0f4f8;
    }
    
    .project-card-header h3 {
      font-size: 1.1rem;
      color: #2d3748;
      margin-bottom: 5px;
    }
    
    .project-path {
      font-family: monospace;
      font-size: 0.8rem;
      color: #718096;
      background-color: #f8faff;
      padding: 5px 8px;
      border-radius: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .project-card-body {
      padding: 15px 20px;
      flex: 1;
    }
    
    .project-dates {
      display: flex;
      gap: 15px;
      margin-bottom: 10px;
    }
    
    .date-item {
      font-size: 0.8rem;
      color: #718096;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .project-card-footer {
      padding: 15px 20px;
      border-top: 1px solid #f0f4f8;
      background-color: #f9fafc;
      display: flex;
      justify-content: space-between;
    }
    
    /* 空のプロジェクト表示 */
    .empty-projects, .no-projects {
      text-align: center;
      padding: 60px 20px;
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
    
    .empty-projects h3, .no-projects h3 {
      font-size: 1.3rem;
      color: #4a5568;
      margin-bottom: 10px;
    }
    
    .empty-projects p, .no-projects p {
      color: #718096;
      margin-bottom: 25px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .empty-illustration {
      font-size: 4rem;
      margin-bottom: 20px;
      opacity: 0.7;
    }
    
    /* 新規プロジェクトモーダル */
    .modal-overlay, .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }
    
    .modal-overlay.active, .modal.active {
      opacity: 1;
      visibility: visible;
    }
    
    .modal-content, .modal > .modal {
      background-color: white;
      border-radius: 10px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      position: relative;
    }
    
    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .modal-header h2 {
      font-size: 1.3rem;
      color: #2d3748;
      margin: 0;
    }
    
    .modal-body {
      padding: 20px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #4a5568;
    }
    
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.95rem;
    }
    
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #4a69bd;
      box-shadow: 0 0 0 3px rgba(74, 105, 189, 0.2);
    }
    
    .form-description {
      font-size: 0.85rem;
      color: #718096;
      margin-top: 5px;
    }
    
    .modal-footer, .form-actions {
      padding: 15px 20px;
      border-top: 1px solid #e2e8f0;
      background-color: #f9fafc;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    /* ローディング表示 */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: #718096;
    }
    
    .loading-spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #4a69bd;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* エラーメッセージ */
    .error-message {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #f8d7da;
      color: #721c24;
      padding: 10px 15px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    /* 進行中のプロジェクト用のフローUI */
    .process-section {
      background-color: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .section-header {
      margin-bottom: 20px;
    }
    
    .section-header h2 {
      margin: 0 0 10px 0;
      font-size: 1.3rem;
      font-weight: 600;
      color: #2d3748;
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e1e8f5;
    }
    
    .section-description {
      color: #4a5568;
      font-size: 0.9rem;
      line-height: 1.5;
      margin: 0;
    }
    
    .process-steps-flow {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .process-step {
      background-color: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 20px;
      text-decoration: none;
      color: inherit;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .process-step:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }
    
    .process-step.active {
      border-color: #4a69bd;
    }
    
    .step-number {
      position: absolute;
      top: -10px;
      left: -10px;
      width: 30px;
      height: 30px;
      background-color: #4a69bd;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    
    .step-icon {
      font-size: 2rem;
      margin-bottom: 15px;
      color: #4a69bd;
    }
    
    .step-content {
      margin-bottom: 20px;
    }
    
    .step-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 10px;
      color: #2d3748;
    }
    
    .step-instruction {
      font-size: 0.9rem;
      color: #4a5568;
      line-height: 1.5;
    }
    
    .step-action {
      background-color: #4a69bd;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.9rem;
      margin-top: auto;
    }
    
    /* レスポンシブ調整 */
    @media (max-width: 768px) {
      .projects-grid {
        grid-template-columns: 1fr;
      }
      
      .project-actions {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }
      
      .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }
      
      .dashboard-container {
        padding: 1rem;
      }
      
      .process-steps-flow {
        grid-template-columns: 1fr;
      }
    }
    
    @media (min-width: 769px) and (max-width: 1200px) {
      .projects-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* ウェルカム関連 */
    .welcome-panel {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 15px rgba(0, 0, 0, 0.08);
      padding: 30px;
      position: relative;
      margin-bottom: 30px;
    }

    .welcome-dismiss {
      position: absolute;
      top: 15px;
      right: 15px;
      background: none;
      border: none;
      font-size: 1.2rem;
      color: #a0aec0;
      cursor: pointer;
    }

    .welcome-header {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }

    .welcome-icon {
      font-size: 3rem;
      color: #4a69bd;
    }

    .welcome-title h2 {
      font-size: 1.8rem;
      color: #2d3748;
      margin-bottom: 10px;
    }

    .welcome-steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 25px;
      margin-bottom: 30px;
    }

    .welcome-step {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      position: relative;
      text-align: center;
    }

    .step-count {
      position: absolute;
      top: -10px;
      left: -10px;
      background: #4a69bd;
      color: white;
      width: 25px;
      height: 25px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }

    .welcome-actions {
      display: flex;
      justify-content: center;
      gap: 15px;
    }
    
    .welcome-button {
      padding: 10px 16px;
      background: #4a69bd;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .welcome-button.secondary {
      background: #f1f5fd;
      color: #4a69bd;
      border: 1px solid #d0def5;
    }

    /* アクティブプロジェクト表示 */
    .active-project-panel {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      padding: 25px;
      margin-bottom: 30px;
    }

    .project-details h2 {
      font-size: 1.6rem;
      color: #2d3748;
      margin-bottom: 10px;
    }

    .no-active-project {
      text-align: center;
      padding: 50px 20px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .no-active-project h2 {
      font-size: 1.4rem;
      color: #4a5568;
      margin-bottom: 15px;
    }

    .no-active-project p {
      color: #718096;
      max-width: 500px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="dashboard-container">
    <!-- ヘッダー -->
    <header class="header">
      <h1>
        <div class="header-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </div>
        AppGenius ダッシュボード
      </h1>
      <!-- テーマ切替ボタンを削除 -->
      <div class="header-actions">
        <!-- 空のヘッダーアクション - 将来的に必要なボタンがあれば追加 -->
      </div>
    </header>
    
    <!-- メインコンテンツ -->
    <div class="main-content">
      <!-- プロジェクト作成セクション -->
      <div class="project-actions">
        <h2>プロジェクト</h2>
        <div class="actions-buttons">
          <button class="button primary" id="new-project-btn">
            <span>➕</span> 新規プロジェクト作成
          </button>
          <button class="button secondary" id="load-project-btn">
            <span>📂</span> 既存プロジェクトを読み込む
          </button>
        </div>
      </div>
      
      <!-- プロジェクトグリッド -->
      <div id="projects-container" class="projects-grid">
        <!-- ここにプロジェクト一覧が動的に表示されます -->
        <div class="loading">
          <div class="loading-spinner"></div>
          <div>プロジェクトを読み込み中...</div>
        </div>
      </div>
      
      <!-- アクティブなプロジェクト情報 -->
      <div id="active-project-info" style="display: none;">
        <!-- プロジェクト情報はコメントアウト -->
      </div>
    </div>
  </div>

  <!-- 新規プロジェクトモーダル（インラインスタイル適用） -->
  <div class="modal-overlay" id="new-project-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: none !important; align-items: center; justify-content: center; z-index: 9999;">
    <!-- モーダルは動的に生成されるため、このテンプレートは使用されません。JSで生成したモーダルを優先 -->
  </div>
  
  <!-- スクリプト -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
    /**
     * リソースの解放
     */
    dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.DashboardPanel = DashboardPanel;
DashboardPanel.viewType = 'dashboard';
// 必要な権限を指定
DashboardPanel._feature = roles_1.Feature.DASHBOARD;
//# sourceMappingURL=DashboardPanel.js.map