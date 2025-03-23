"use strict";
/**
 * AppGenius VSCode Extension メインエントリーポイント
 *
 * 【認証システムリファクタリング 2025/03/23】
 * - 現在、2つの認証システムが並行して存在しています：
 *   1. 従来の認証システム: AuthenticationService + TokenManager
 *   2. 新しい認証システム: SimpleAuthManager + SimpleAuthService
 *
 * - 認証システムリファクタリングにより、SimpleAuthManagerとSimpleAuthServiceを優先使用します
 * - 後方互換性のため、古い認証サービスも維持していますが、将来的には完全に削除します
 * - PermissionManagerは両方の認証サービスに対応するよう更新されています
 * - パネル/コンポーネントは、AuthGuardを通じてPermissionManagerを使用します
 *
 * 詳細は auth-system-refactoring-scope.md を参照
 */
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const statusBar_1 = require("./ui/statusBar");
const logger_1 = require("./utils/logger");
const aiService_1 = require("./core/aiService");
const projectAnalyzer_1 = require("./core/projectAnalyzer");
const codeGenerator_1 = require("./core/codeGenerator");
const gitManager_1 = require("./core/gitManager");
const TerminalInterface_1 = require("./ui/TerminalInterface");
const CommandHandler_1 = require("./ui/CommandHandler");
const fileOperationManager_1 = require("./utils/fileOperationManager");
const MockupGalleryPanel_1 = require("./ui/mockupGallery/MockupGalleryPanel");
const simpleChat_1 = require("./ui/simpleChat");
const DashboardPanel_1 = require("./ui/dashboard/DashboardPanel");
const ClaudeMdEditorPanel_1 = require("./ui/claudeMd/ClaudeMdEditorPanel");
const PlatformManager_1 = require("./utils/PlatformManager");
const ScopeExporter_1 = require("./utils/ScopeExporter");
const ScopeManagerPanel_1 = require("./ui/scopeManager/ScopeManagerPanel");
const DebugDetectivePanel_1 = require("./ui/debugDetective/DebugDetectivePanel");
const EnvironmentVariablesAssistantPanel_1 = require("./ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel");
const TokenManager_1 = require("./core/auth/TokenManager");
const AuthenticationService_1 = require("./core/auth/AuthenticationService");
const SimpleAuthManager_1 = require("./core/auth/SimpleAuthManager"); // 新しい認証マネージャー
const SimpleAuthService_1 = require("./core/auth/SimpleAuthService"); // 新しい認証サービス
const PermissionManager_1 = require("./core/auth/PermissionManager");
const authCommands_1 = require("./core/auth/authCommands");
const promptLibraryCommands_1 = require("./commands/promptLibraryCommands");
const environmentCommands_1 = require("./commands/environmentCommands");
const AuthGuard_1 = require("./ui/auth/AuthGuard");
const roles_1 = require("./core/auth/roles");
const AuthStorageManager_1 = require("./utils/AuthStorageManager");
function activate(context) {
    // グローバルコンテキストを設定（安全対策）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.__extensionContext = context;
    // ロガーの初期化（自動表示をオフにする）
    logger_1.Logger.initialize('AppGenius AI', logger_1.LogLevel.DEBUG, false);
    logger_1.Logger.info('AppGenius AI が起動しました');
    // PlatformManagerの初期化
    const platformManager = PlatformManager_1.PlatformManager.getInstance();
    platformManager.setExtensionContext(context);
    logger_1.Logger.info('PlatformManager initialized successfully');
    // ScopeExporterの初期化
    ScopeExporter_1.ScopeExporter.getInstance();
    logger_1.Logger.info('ScopeExporter initialized successfully');
    // 認証関連の初期化
    try {
        // AuthStorageManagerの初期化
        const authStorageManager = AuthStorageManager_1.AuthStorageManager.getInstance(context);
        logger_1.Logger.info('AuthStorageManager initialized successfully');
        // 新しいシンプル認証マネージャーの初期化（優先使用）
        const simpleAuthManager = SimpleAuthManager_1.SimpleAuthManager.getInstance(context);
        logger_1.Logger.info('SimpleAuthManager initialized successfully');
        // シンプル認証サービスの取得
        const simpleAuthService = simpleAuthManager.getAuthService();
        logger_1.Logger.info('SimpleAuthService accessed successfully');
        // 従来の認証サービス初期化（後方互換性のために維持）
        const tokenManager = TokenManager_1.TokenManager.getInstance(context);
        logger_1.Logger.info('Legacy TokenManager initialized successfully');
        const authService = AuthenticationService_1.AuthenticationService.getInstance(context);
        logger_1.Logger.info('Legacy AuthenticationService initialized successfully');
        // PermissionManagerの初期化（シンプル認証サービスを優先使用）
        const permissionManager = PermissionManager_1.PermissionManager.getInstance(simpleAuthService);
        logger_1.Logger.info('PermissionManager initialized with SimpleAuthService');
        // 認証コマンドの登録
        (0, authCommands_1.registerAuthCommands)(context);
        logger_1.Logger.info('Auth commands registered successfully');
        // プロンプトライブラリコマンドの登録
        (0, promptLibraryCommands_1.registerPromptLibraryCommands)(context);
        logger_1.Logger.info('Prompt library commands registered successfully');
        // 環境変数管理コマンドの登録
        (0, environmentCommands_1.registerEnvironmentCommands)(context);
        logger_1.Logger.info('Environment commands registered successfully');
        // ClaudeCode連携コマンドの登録
        Promise.resolve().then(() => __importStar(require('./commands/claudeCodeCommands'))).then(({ registerClaudeCodeCommands }) => {
            registerClaudeCodeCommands(context);
            logger_1.Logger.info('ClaudeCode commands registered successfully');
        }).catch(error => {
            logger_1.Logger.error(`ClaudeCode commands registration failed: ${error.message}`);
        });
        // URLプロトコルハンドラーの登録
        context.subscriptions.push(vscode.window.registerUriHandler({
            handleUri(uri) {
                if (uri.path === '/launch-claude-code') {
                    try {
                        // URLパラメータからプロンプトURLを取得
                        const queryParams = new URLSearchParams(uri.query);
                        const promptUrl = queryParams.get('url');
                        if (promptUrl) {
                            // デコードしてURLを取得
                            const decodedUrl = decodeURIComponent(promptUrl);
                            logger_1.Logger.info(`外部URLからClaudeCodeを起動: ${decodedUrl}`);
                            // ClaudeCodeを起動
                            vscode.commands.executeCommand('appgenius.claudeCode.launchFromUrl', decodedUrl);
                        }
                        else {
                            logger_1.Logger.error('URLパラメータが指定されていません');
                            vscode.window.showErrorMessage('URLパラメータが指定されていません');
                        }
                    }
                    catch (error) {
                        logger_1.Logger.error(`URLプロトコルハンドリングエラー: ${error.message}`);
                        vscode.window.showErrorMessage(`URLプロトコルハンドリングエラー: ${error.message}`);
                    }
                }
            }
        }));
        logger_1.Logger.info('URL protocol handler registered successfully');
    }
    catch (error) {
        logger_1.Logger.error(`Authentication initialization failed: ${error.message}`);
    }
    // ToolkitManagerとToolkitUpdaterの初期化
    Promise.resolve().then(() => __importStar(require('./utils/ToolkitManager'))).then(({ ToolkitManager }) => {
        ToolkitManager.getInstance();
        logger_1.Logger.info('ToolkitManager initialized successfully');
        Promise.resolve().then(() => __importStar(require('./utils/ToolkitUpdater'))).then(({ ToolkitUpdater }) => {
            const toolkitUpdater = ToolkitUpdater.getInstance();
            toolkitUpdater.setup();
            logger_1.Logger.info('ToolkitUpdater initialized successfully');
        }).catch(error => {
            logger_1.Logger.error(`ToolkitUpdater initialization failed: ${error.message}`);
        });
    }).catch(error => {
        logger_1.Logger.error(`ToolkitManager initialization failed: ${error.message}`);
    });
    // デバッグモードを無効化して実際のAPIを使用する
    vscode.workspace.getConfiguration('appgeniusAI').update('debugMode', false, true);
    vscode.workspace.getConfiguration('appgeniusAI').update('useRealApi', true, true);
    logger_1.Logger.info('デバッグモードが無効化されました');
    // AIサービスの初期化
    const aiService = new aiService_1.AIService();
    // MockupStorageServiceを早期に初期化（プロジェクトパスはcommandで渡す設計に変更）
    const { MockupStorageService } = require('./services/mockupStorageService');
    const mockupStorageService = MockupStorageService.getInstance();
    context.subscriptions.push({
        dispose: () => {
            // クリーンアップが必要な場合は追加
        }
    });
    // コア機能を初期化
    const projectAnalyzer = new projectAnalyzer_1.ProjectAnalyzer();
    const codeGenerator = new codeGenerator_1.CodeGenerator(aiService);
    const gitManager = new gitManager_1.GitManager();
    // ステータスバーの初期化
    const statusBar = new statusBar_1.StatusBar();
    context.subscriptions.push(statusBar);
    // ターミナルインターフェースを初期化
    const terminalInterface = TerminalInterface_1.TerminalInterface.getInstance(aiService);
    // ファイル操作マネージャーを初期化
    const fileOperationManager = fileOperationManager_1.FileOperationManager.getInstance();
    fileOperationManager.setTerminalInterface(terminalInterface);
    // コマンドハンドラーを初期化
    const commandHandler = new CommandHandler_1.CommandHandler(aiService);
    context.subscriptions.push(commandHandler);
    // 認証テスト関連コマンド（開発環境のみ）
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.getSimpleAuthService', () => {
        try {
            return SimpleAuthService_1.SimpleAuthService.getInstance();
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService取得エラー:', error);
            return null;
        }
    }), vscode.commands.registerCommand('appgenius.testFeatureAccess', (featureName) => {
        try {
            return AuthGuard_1.AuthGuard.checkAccess(featureName);
        }
        catch (error) {
            logger_1.Logger.error('機能アクセステストエラー:', error);
            return false;
        }
    }), vscode.commands.registerCommand('appgenius.runAuthVerificationTests', () => {
        try {
            const fs = require('fs');
            const testRunnerPath = path.join(context.extensionPath, 'test_run_auth_tests.js');
            if (fs.existsSync(testRunnerPath)) {
                const testRunner = require(testRunnerPath);
                if (typeof testRunner.activateAuthTests === 'function') {
                    testRunner.activateAuthTests(context);
                    vscode.window.showInformationMessage('認証テストツールが起動しました。コマンドパレットから「Auth Verification Tests」を実行してください。');
                }
                else {
                    vscode.window.showErrorMessage('テストツール内にactivateAuthTests関数が見つかりません');
                }
            }
            else {
                vscode.window.showErrorMessage(`テストスクリプトが見つかりません: ${testRunnerPath}`);
            }
        }
        catch (error) {
            logger_1.Logger.error('認証テスト実行エラー:', error);
            vscode.window.showErrorMessage(`認証テストの実行に失敗しました: ${error.message}`);
        }
    }));
    // メインメニュー表示コマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.showMainMenu', async () => {
        try {
            const selection = await vscode.window.showQuickPick([
                'APIキーを設定',
                'AppGenius ダッシュボードを開く',
                '要件定義ビジュアライザーを開く',
                'モックアップギャラリーを開く',
                '実装スコープ選択を開く',
                'スコープマネージャーを開く',
                'デバッグ探偵を開く',
                '環境変数アシスタントを開く',
                '環境変数管理を開く',
                'リファレンスマネージャーを開く',
                'プロンプトライブラリを開く'
            ], {
                placeHolder: 'AppGenius AI メニュー'
            });
            if (selection === 'APIキーを設定') {
                vscode.commands.executeCommand('appgenius-ai.setApiKey');
            }
            else if (selection === 'AppGenius ダッシュボードを開く') {
                vscode.commands.executeCommand('appgenius-ai.openDashboard');
            }
            else if (selection === '要件定義ビジュアライザーを開く') {
                vscode.commands.executeCommand('appgenius-ai.openSimpleChat');
            }
            else if (selection === 'モックアップギャラリーを開く') {
                vscode.commands.executeCommand('appgenius-ai.openMockupGallery');
            }
            else if (selection === '実装スコープ選択を開く') {
                vscode.commands.executeCommand('appgenius-ai.openImplementationSelector');
            }
            else if (selection === 'スコープマネージャーを開く') {
                vscode.commands.executeCommand('appgenius-ai.openScopeManager');
            }
            else if (selection === '開発アシスタントを開く') {
                vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
            }
            else if (selection === 'デバッグ探偵を開く') {
                vscode.commands.executeCommand('appgenius-ai.openDebugDetective');
            }
            else if (selection === '環境変数アシスタントを開く') {
                vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant');
            }
            else if (selection === '環境変数管理を開く') {
                vscode.commands.executeCommand('appgenius-ai.openEnvVariablesPanel');
            }
            else if (selection === 'リファレンスマネージャーを開く') {
                vscode.commands.executeCommand('appgenius-ai.openReferenceManager');
            }
            else if (selection === 'プロンプトライブラリを開く') {
                vscode.commands.executeCommand('appgenius.openPromptLibrary');
            }
        }
        catch (error) {
            logger_1.Logger.error(`メインメニュー表示エラー: ${error.message}`);
            vscode.window.showErrorMessage(`メインメニュー表示エラー: ${error.message}`);
        }
    }));
    // API キー設定コマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.setApiKey', async () => {
        try {
            const success = await aiService.setApiKey();
            if (success) {
                vscode.window.showInformationMessage('Claude API キーが設定されました');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`API キー設定エラー: ${error.message}`);
        }
    }));
    // プロジェクト分析コマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.analyzeProject', async () => {
        try {
            terminalInterface.showTerminal();
            terminalInterface.processQuery("プロジェクトを分析中...");
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'プロジェクトを分析中...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                // プロジェクト分析
                const result = await projectAnalyzer.analyzeProject();
                progress.report({ increment: 50 });
                // 分析結果をターミナルに表示
                terminalInterface.processResult(JSON.stringify(result, null, 2));
                progress.report({ increment: 50 });
                return result;
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`プロジェクト分析エラー: ${error.message}`);
        }
    }));
    // コード生成コマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.generateCode', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: '生成するコードの説明を入力してください',
                placeHolder: '例: React コンポーネントを作成して...'
            });
            if (query) {
                terminalInterface.showTerminal();
                terminalInterface.processQuery(query);
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'コードを生成中...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0 });
                    // コード生成
                    const options = {
                        language: "javascript",
                        description: query
                    };
                    const result = await codeGenerator.generateCode(options);
                    progress.report({ increment: 100 });
                    // 生成結果をターミナルに表示
                    terminalInterface.processResult(JSON.stringify(result, null, 2));
                    return result;
                });
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`コード生成エラー: ${error.message}`);
        }
    }));
    // Git 操作コマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.executeGitCommand', async () => {
        try {
            const command = await vscode.window.showInputBox({
                prompt: '実行する Git コマンドを入力してください',
                placeHolder: '例: git status'
            });
            if (command) {
                terminalInterface.showTerminal();
                terminalInterface.processQuery(command);
                // Git コマンド実行
                const result = await gitManager.executeCommand(command);
                // 実行結果をターミナルに表示
                terminalInterface.processResult(JSON.stringify(result, null, 2));
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Git コマンド実行エラー: ${error.message}`);
        }
    }));
    // ダッシュボードを開くコマンド（権限チェック付き）
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openDashboard', () => {
        try {
            // 権限チェック済みの基底クラスメソッドを呼び出す
            DashboardPanel_1.DashboardPanel.createOrShow(context.extensionUri, aiService);
        }
        catch (error) {
            vscode.window.showErrorMessage(`ダッシュボード表示エラー: ${error.message}`);
        }
    }));
    // 拡張機能起動時に自動でプロジェクト管理画面（簡易ダッシュボード）を開く
    // ゲストユーザーもダッシュボードは閲覧可能
    if (AuthGuard_1.AuthGuard.checkAccess(roles_1.Feature.DASHBOARD)) {
        DashboardPanel_1.DashboardPanel.createOrShow(context.extensionUri, aiService);
    }
    // Claude MD エディタを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openClaudeMdEditor', () => {
        try {
            ClaudeMdEditorPanel_1.ClaudeMdEditorPanel.createOrShow(context.extensionUri);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Claude MD エディタ表示エラー: ${error.message}`);
        }
    }));
    // モックアップギャラリーを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openMockupGallery', (projectPath) => {
        try {
            logger_1.Logger.info(`モックアップギャラリーを開きます: ${projectPath || 'プロジェクトパスなし'}`);
            // 権限チェックはパネル側のcreateOrShowメソッド内で行うため、ここでは行わない
            MockupGalleryPanel_1.MockupGalleryPanel.createOrShow(context.extensionUri, aiService, projectPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`モックアップギャラリー表示エラー: ${error.message}`);
        }
    }));
    // スコープマネージャーを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openScopeManager', (providedProjectPath) => {
        try {
            // 引数から提供されたパスを優先
            let projectPath = providedProjectPath;
            // パスが提供されていない場合はアクティブプロジェクトから取得
            if (!projectPath) {
                const { AppGeniusStateManager } = require('./services/AppGeniusStateManager');
                const stateManager = AppGeniusStateManager.getInstance();
                projectPath = stateManager.getCurrentProjectPath();
                // アクティブプロジェクトパスがない場合は警告
                if (!projectPath) {
                    logger_1.Logger.warn('アクティブプロジェクトがありません。プロジェクトを選択してください。');
                }
            }
            // パスが有効かログ出力
            logger_1.Logger.debug(`スコープマネージャーパネル起動: projectPath=${projectPath}`);
            // 詳細なデバッグ情報
            logger_1.Logger.info(`[Debug] スコープマネージャーコマンド: 引数=${providedProjectPath}, 使用パス=${projectPath}`);
            // 権限チェックはパネル側のcreateOrShowメソッド内で行うため、ここでは行わない
            ScopeManagerPanel_1.ScopeManagerPanel.createOrShow(context.extensionUri, projectPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`スコープマネージャー表示エラー: ${error.message}`);
        }
    }));
    // 要件定義チャットを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openSimpleChat', (projectPath) => {
        try {
            simpleChat_1.SimpleChatPanel.createOrShow(context.extensionUri, aiService, projectPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`要件定義チャット表示エラー: ${error.message}`);
        }
    }));
    // デバッグ探偵を開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openDebugDetective', (providedProjectPath) => {
        try {
            // 引数から提供されたパスを優先
            let projectPath = providedProjectPath;
            // パスが提供されていない場合はアクティブプロジェクトから取得
            if (!projectPath) {
                const { AppGeniusStateManager } = require('./services/AppGeniusStateManager');
                const stateManager = AppGeniusStateManager.getInstance();
                projectPath = stateManager.getCurrentProjectPath();
                // アクティブプロジェクトパスがない場合は警告
                if (!projectPath) {
                    logger_1.Logger.warn('アクティブプロジェクトがありません。プロジェクトを選択してください。');
                }
            }
            // パスが有効かログ出力
            logger_1.Logger.debug(`デバッグ探偵パネル起動: projectPath=${projectPath}`);
            // 権限チェックはパネル側のcreateOrShowメソッド内で行うため、ここでは行わない
            DebugDetectivePanel_1.DebugDetectivePanel.createOrShow(context.extensionUri, projectPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`デバッグ探偵表示エラー: ${error.message}`);
        }
    }));
    // 環境変数アシスタントを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openEnvironmentVariablesAssistant', (providedProjectPath) => {
        try {
            // 引数から提供されたパスを優先
            let projectPath = providedProjectPath;
            // パスが提供されていない場合はアクティブプロジェクトから取得
            if (!projectPath) {
                const { AppGeniusStateManager } = require('./services/AppGeniusStateManager');
                const stateManager = AppGeniusStateManager.getInstance();
                projectPath = stateManager.getCurrentProjectPath();
                // アクティブプロジェクトパスがない場合は警告
                if (!projectPath) {
                    logger_1.Logger.warn('アクティブプロジェクトがありません。プロジェクトを選択してください。');
                }
            }
            // パスが有効かログ出力
            logger_1.Logger.debug(`環境変数アシスタントパネル起動: projectPath=${projectPath}`);
            // 権限チェックはパネル側のcreateOrShowメソッド内で行うため、ここでは行わない
            EnvironmentVariablesAssistantPanel_1.EnvironmentVariablesAssistantPanel.createOrShow(context.extensionUri, projectPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`環境変数アシスタント表示エラー: ${error.message}`);
        }
    }));
    // リファレンスマネージャーを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openReferenceManager', async (providedProjectPath) => {
        try {
            // ダイナミックインポートで遅延ロード
            const { ReferenceManagerPanel } = await Promise.resolve().then(() => __importStar(require('./ui/referenceManager/ReferenceManagerPanel')));
            // 引数から提供されたパスを優先
            let projectPath = providedProjectPath;
            // パスが提供されていない場合はアクティブプロジェクトから取得
            if (!projectPath) {
                const { AppGeniusStateManager } = require('./services/AppGeniusStateManager');
                const stateManager = AppGeniusStateManager.getInstance();
                projectPath = stateManager.getCurrentProjectPath();
                // アクティブプロジェクトパスがない場合は警告
                if (!projectPath) {
                    logger_1.Logger.warn('アクティブプロジェクトがありません。プロジェクトを選択してください。');
                }
            }
            // パスが有効かログ出力
            logger_1.Logger.debug(`リファレンスマネージャーパネル起動: projectPath=${projectPath}`);
            // 権限チェックはパネル側のcreateOrShowメソッド内で行うため、ここでは行わない
            ReferenceManagerPanel.createOrShow(context.extensionUri, projectPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`リファレンスマネージャー表示エラー: ${error.message}`);
        }
    }));
    // ワークスペースルートのCurrentStatusを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.openCurrentStatus', async () => {
        try {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const currentStatusPath = path.join(workspaceRoot, 'docs', 'CURRENT_STATUS.md');
                const currentStatusUri = vscode.Uri.file(currentStatusPath);
                await vscode.commands.executeCommand('vscode.open', currentStatusUri);
            }
            else {
                vscode.window.showErrorMessage('ワークスペースが開かれていません');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`CurrentStatus表示エラー: ${error.message}`);
        }
    }));
    // サーフコマンド設定コマンド (Claude Code CLI 連携)
    context.subscriptions.push(vscode.commands.registerCommand('appgenius-ai.configureSurfCommand', async () => {
        try {
            const { ToolkitManager } = await Promise.resolve().then(() => __importStar(require('./utils/ToolkitManager')));
            const toolkitManager = ToolkitManager.getInstance();
            const result = await toolkitManager.configureSurfCommand();
            if (result.success) {
                vscode.window.showInformationMessage('surf コマンドが正常に設定されました');
            }
            else {
                vscode.window.showErrorMessage(`surf コマンド設定エラー: ${result.message}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`surf コマンド設定エラー: ${error.message}`);
        }
    }));
    logger_1.Logger.info('AppGenius AI の初期化が完了しました');
}
// this method is called when your extension is deactivated
function deactivate() {
    logger_1.Logger.info('AppGenius AI を終了しました');
}
//# sourceMappingURL=extension.js.map