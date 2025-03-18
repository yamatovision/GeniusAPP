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
exports.AuthStatusBar = void 0;
const vscode = __importStar(require("vscode"));
const AuthenticationService_1 = require("../../core/auth/AuthenticationService");
const logger_1 = require("../../utils/logger");
/**
 * AuthStatusBar - VSCodeのステータスバーに認証状態を表示するクラス
 *
 * 現在のログイン状態やユーザー情報をステータスバーに表示し、
 * クリックするとログイン/ログアウト機能を提供します。
 */
class AuthStatusBar {
    /**
     * コンストラクタ
     */
    constructor() {
        this._disposables = [];
        this._isUpdating = false;
        // アイコン設定
        this.ICON_LOGGED_IN = '$(person-filled)';
        this.ICON_LOGGED_OUT = '$(person)';
        this.ICON_ERROR = '$(warning)';
        this.ICON_UPDATING = '$(sync~spin)';
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        // ステータスバーアイテムの作成
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        // 認証イベント監視
        this._registerAuthEventListeners();
        // 初期状態の表示
        this._updateStatusBar(this._authService.isAuthenticated());
        this._statusBarItem.show();
        logger_1.Logger.debug('認証ステータスバーを初期化しました');
    }
    /**
     * AuthStatusBarのシングルトンインスタンスを取得
     */
    static getInstance() {
        if (!AuthStatusBar.instance) {
            AuthStatusBar.instance = new AuthStatusBar();
        }
        return AuthStatusBar.instance;
    }
    /**
     * 認証イベントリスナーを登録
     */
    _registerAuthEventListeners() {
        // 認証サービスのイベントを監視
        this._disposables.push(this._authService.onStateChanged(state => {
            this._updateStatusBar(state.isAuthenticated);
        }), this._authService.onLoginSuccess(() => {
            this._updateStatusBar(true);
        }), this._authService.onLogout(() => {
            this._updateStatusBar(false);
        }), this._authService.onTokenRefreshed(() => {
            this._showUpdatingStatus(true);
            setTimeout(() => {
                this._showUpdatingStatus(false);
                this._updateStatusBar(this._authService.isAuthenticated());
            }, 1000);
        }), this._authService.onLoginFailed((error) => {
            // 一時的にエラーアイコンを表示
            this._showErrorStatus(error.message);
            setTimeout(() => {
                this._updateStatusBar(this._authService.isAuthenticated());
            }, 3000);
        }));
    }
    /**
     * ステータスバーの表示を更新
     */
    async _updateStatusBar(isAuthenticated) {
        if (this._isUpdating) {
            return;
        }
        if (isAuthenticated) {
            const user = this._authService.getCurrentUser();
            if (user) {
                // ユーザー名を表示
                this._statusBarItem.text = `${this.ICON_LOGGED_IN} ${user.name || user.email}`;
                this._statusBarItem.tooltip = `AppGenius: ${user.name || user.email} としてログイン中\nクリックしてログアウト`;
                this._statusBarItem.command = 'appgenius.logout';
                this._statusBarItem.backgroundColor = undefined;
            }
            else {
                // ユーザー情報がまだ読み込まれていない場合
                this._statusBarItem.text = `${this.ICON_LOGGED_IN} AppGenius`;
                this._statusBarItem.tooltip = `AppGenius: ログイン中\nクリックしてログアウト`;
                this._statusBarItem.command = 'appgenius.logout';
                this._statusBarItem.backgroundColor = undefined;
            }
        }
        else {
            // 未ログイン状態
            this._statusBarItem.text = `${this.ICON_LOGGED_OUT} 未ログイン`;
            this._statusBarItem.tooltip = 'AppGenius: クリックしてログイン';
            this._statusBarItem.command = 'appgenius.login';
            this._statusBarItem.backgroundColor = undefined;
        }
    }
    /**
     * エラー状態を表示
     */
    _showErrorStatus(errorMessage) {
        this._statusBarItem.text = `${this.ICON_ERROR} 認証エラー`;
        this._statusBarItem.tooltip = `AppGenius: 認証エラー\n${errorMessage || '認証中にエラーが発生しました'}`;
        this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    /**
     * 更新中状態を表示
     */
    _showUpdatingStatus(isUpdating) {
        this._isUpdating = isUpdating;
        if (isUpdating) {
            this._statusBarItem.text = `${this.ICON_UPDATING} 認証更新中...`;
            this._statusBarItem.tooltip = 'AppGenius: 認証情報を更新中...';
        }
        else {
            this._updateStatusBar(this._authService.isAuthenticated());
        }
    }
    /**
     * ステータスバーの表示/非表示を切り替え
     */
    toggleVisibility(visible) {
        if (visible) {
            this._statusBarItem.show();
        }
        else {
            this._statusBarItem.hide();
        }
    }
    /**
     * リソースの解放
     */
    dispose() {
        this._statusBarItem.dispose();
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }
}
exports.AuthStatusBar = AuthStatusBar;
//# sourceMappingURL=AuthStatusBar.js.map