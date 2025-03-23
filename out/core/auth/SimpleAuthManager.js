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
exports.SimpleAuthManager = void 0;
const vscode = __importStar(require("vscode"));
const SimpleAuthService_1 = require("./SimpleAuthService");
const logger_1 = require("../../utils/logger");
/**
 * SimpleAuthManager - シンプル認証の統合マネージャー
 *
 * SimpleAuthServiceを利用するための統合レイヤー。
 * 認証状態の通知と必要なインターフェースの提供を行います。
 */
class SimpleAuthManager {
    /**
     * コンストラクタ
     */
    constructor(context) {
        this._disposables = [];
        this._authService = SimpleAuthService_1.SimpleAuthService.getInstance(context);
        // ステータスバーアイテム作成
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this._statusBar.command = 'appgenius.simpleAuth.showMenu';
        this._statusBar.tooltip = 'AppGenius認証状態';
        this._statusBar.show();
        // ステータス表示更新
        this._updateStatusBar(this._authService.getCurrentState());
        // イベントの初期化
        this._initializeEvents();
        // メニューコマンドの登録
        this._registerCommands(context);
        // 登録したコマンドとステータスバーの登録解除を設定
        context.subscriptions.push(this._statusBar, ...this._disposables);
        logger_1.Logger.info('SimpleAuthManager: 初期化完了');
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance(context) {
        if (!SimpleAuthManager.instance) {
            if (!context) {
                throw new Error('SimpleAuthManagerの初期化時にはExtensionContextが必要です');
            }
            SimpleAuthManager.instance = new SimpleAuthManager(context);
        }
        return SimpleAuthManager.instance;
    }
    /**
     * イベントリスナー初期化
     */
    _initializeEvents() {
        // 認証状態変更のリスナー
        this._disposables.push(this._authService.onStateChanged(state => {
            this._updateStatusBar(state);
            this._notifyStateChange(state);
        }));
        // ログイン成功のリスナー
        this._disposables.push(this._authService.onLoginSuccess(() => {
            vscode.window.showInformationMessage('AppGeniusにログインしました');
        }));
        // ログイン失敗のリスナー
        this._disposables.push(this._authService.onLoginFailed((error) => {
            vscode.window.showErrorMessage(`ログイン失敗: ${error.message}`);
        }));
        // ログアウトのリスナー
        this._disposables.push(this._authService.onLogout(() => {
            vscode.window.showInformationMessage('AppGeniusからログアウトしました');
        }));
    }
    /**
     * ステータスバー表示更新
     */
    _updateStatusBar(state) {
        if (state.isAuthenticated) {
            this._statusBar.text = `$(shield) ${state.username || 'User'}`;
            this._statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        }
        else {
            this._statusBar.text = `$(shield) ログインしてください`;
            this._statusBar.backgroundColor = undefined;
        }
    }
    /**
     * 認証状態変更を通知
     */
    _notifyStateChange(state) {
        // イベント発火
        vscode.commands.executeCommand('appgenius.onAuthStateChanged', state);
    }
    /**
     * メニューコマンドの登録
     */
    _registerCommands(context) {
        // ログイン/ログアウトメニュー表示
        const showMenuDisposable = vscode.commands.registerCommand('appgenius.simpleAuth.showMenu', async () => {
            const isAuthenticated = this._authService.isAuthenticated();
            if (isAuthenticated) {
                // ログイン済みの場合のメニュー
                const choice = await vscode.window.showQuickPick(['ログアウト', 'ユーザー情報表示', '認証状態再検証'], { placeHolder: 'アクション選択' });
                if (choice === 'ログアウト') {
                    await this._authService.logout();
                }
                else if (choice === 'ユーザー情報表示') {
                    this._showUserInfo();
                }
                else if (choice === '認証状態再検証') {
                    this._verifyAuthState();
                }
            }
            else {
                // 未ログインの場合はログイン処理
                await this._showLoginPrompt();
            }
        });
        // ログインコマンド
        const loginDisposable = vscode.commands.registerCommand('appgenius.simpleAuth.login', () => this._showLoginPrompt());
        // ログアウトコマンド
        const logoutDisposable = vscode.commands.registerCommand('appgenius.simpleAuth.logout', () => this._authService.logout());
        // 認証状態検証コマンド
        const verifyDisposable = vscode.commands.registerCommand('appgenius.simpleAuth.verify', () => this._verifyAuthState());
        // コマンドの登録
        this._disposables.push(showMenuDisposable, loginDisposable, logoutDisposable, verifyDisposable);
    }
    /**
     * ログインプロンプト表示
     */
    async _showLoginPrompt() {
        try {
            // メールアドレス入力
            const email = await vscode.window.showInputBox({
                prompt: 'メールアドレスを入力してください',
                placeHolder: 'email@example.com',
                ignoreFocusOut: true
            });
            if (!email) {
                return;
            }
            // パスワード入力
            const password = await vscode.window.showInputBox({
                prompt: 'パスワードを入力してください',
                password: true,
                ignoreFocusOut: true
            });
            if (!password) {
                return;
            }
            // ログイン処理
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'ログイン中...',
                cancellable: false
            }, async () => {
                // ログイン実行
                await this._authService.login(email, password);
            });
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthManager: ログインエラー', error);
            vscode.window.showErrorMessage('ログイン中にエラーが発生しました');
        }
    }
    /**
     * ユーザー情報表示
     */
    _showUserInfo() {
        const state = this._authService.getCurrentState();
        if (!state.isAuthenticated) {
            vscode.window.showWarningMessage('ログインしていません');
            return;
        }
        const userInfo = [
            `ユーザー名: ${state.username || 'Unknown'}`,
            `ユーザーID: ${state.userId || 'Unknown'}`,
            `ロール: ${state.role}`,
            `権限数: ${state.permissions.length}個`,
            `有効期限: ${state.expiresAt ? new Date(state.expiresAt).toLocaleString() : 'Unknown'}`
        ].join('\n');
        vscode.window.showInformationMessage('ユーザー情報', { modal: true, detail: userInfo });
    }
    /**
     * 認証状態の検証
     */
    async _verifyAuthState() {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '認証状態確認中...',
                cancellable: false
            }, async () => {
                const isValid = await this._authService.verifyAuthState();
                if (isValid) {
                    vscode.window.showInformationMessage('認証状態は有効です');
                }
                else {
                    vscode.window.showWarningMessage('認証状態が無効です。再ログインしてください。');
                    // 認証が無効な場合は自動的にログアウト
                    await this._authService.logout();
                }
            });
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthManager: 認証状態検証エラー', error);
            vscode.window.showErrorMessage('認証状態の確認中にエラーが発生しました');
        }
    }
    /**
     * 認証サービスのインスタンスを取得
     */
    getAuthService() {
        return this._authService;
    }
    /**
     * 認証ヘッダー取得
     */
    getAuthHeader() {
        return this._authService.getAuthHeader();
    }
    /**
     * 認証状態チェック
     */
    isAuthenticated() {
        return this._authService.isAuthenticated();
    }
    /**
     * 現在の認証状態取得
     */
    getCurrentState() {
        return this._authService.getCurrentState();
    }
}
exports.SimpleAuthManager = SimpleAuthManager;
//# sourceMappingURL=SimpleAuthManager.js.map