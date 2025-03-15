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
exports.LogoutNotification = void 0;
const vscode = __importStar(require("vscode"));
const AuthenticationService_1 = require("../../core/auth/AuthenticationService");
/**
 * LogoutNotification - ログアウト関連の通知を管理するクラス
 *
 * 強制ログアウトなどの通知や、再ログインプロンプトの表示を担当します。
 */
class LogoutNotification {
    /**
     * コンストラクタ
     */
    constructor() {
        this._disposables = [];
        // ログアウト理由の定義
        this.LOGOUT_REASONS = {
            EXPIRED: 'トークンの期限が切れました',
            REVOKED: '管理者によってアクセスが無効化されました',
            ACCOUNT_DISABLED: 'アカウントが無効化されました',
            SECURITY: 'セキュリティ上の理由によりログアウトされました',
            USER_REQUESTED: 'ユーザーによるログアウトリクエスト',
            UNKNOWN: '不明な理由によりログアウトされました'
        };
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        // 認証状態変更イベントをリッスン
        this._disposables.push(this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this)));
    }
    /**
     * LogoutNotificationのシングルトンインスタンスを取得
     */
    static getInstance() {
        if (!LogoutNotification.instance) {
            LogoutNotification.instance = new LogoutNotification();
        }
        return LogoutNotification.instance;
    }
    /**
     * 認証状態変更のハンドラー
     */
    _handleAuthStateChange(isAuthenticated) {
        // ログアウト時（認証状態がtrueからfalseに変わった時）に通知
        if (!isAuthenticated) {
            // フラグをチェックして、意図的なログアウトか強制ログアウトかを判断
            // 実際の実装では、ログアウト理由をサーバーから受け取るロジックが必要
        }
    }
    /**
     * ログアウト通知を表示
     * @param reason ログアウト理由のコード
     */
    showLogoutNotification(reason = 'UNKNOWN') {
        const reasonMessage = this.LOGOUT_REASONS[reason] || this.LOGOUT_REASONS.UNKNOWN;
        // ログアウト通知を表示
        vscode.window.showWarningMessage(`AppGenius: ${reasonMessage}`, 'ログインページを開く').then(selection => {
            if (selection === 'ログインページを開く') {
                vscode.commands.executeCommand('appgenius.login');
            }
        });
    }
    /**
     * 強制ログアウト通知を表示
     * @param message カスタムメッセージ
     */
    showForcedLogoutNotification(message) {
        vscode.window.showErrorMessage(`AppGenius: ${message}`, 'ログインページを開く', '詳細を確認').then(selection => {
            if (selection === 'ログインページを開く') {
                vscode.commands.executeCommand('appgenius.login');
            }
            else if (selection === '詳細を確認') {
                // ヘルプページやドキュメントを開くなどの処理
                vscode.env.openExternal(vscode.Uri.parse('https://example.com/appgenius/help'));
            }
        });
    }
    /**
     * セッション有効期限切れ通知を表示
     */
    showSessionExpiredNotification() {
        vscode.window.showInformationMessage('AppGenius: セッションの有効期限が切れました。再度ログインしてください。', 'ログイン').then(selection => {
            if (selection === 'ログイン') {
                vscode.commands.executeCommand('appgenius.login');
            }
        });
    }
    /**
     * リソースの解放
     */
    dispose() {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }
}
exports.LogoutNotification = LogoutNotification;
//# sourceMappingURL=LogoutNotification.js.map