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
exports.registerAuthCommands = registerAuthCommands;
const vscode = __importStar(require("vscode"));
const AuthenticationService_1 = require("./AuthenticationService");
const LoginWebviewPanel_1 = require("../../ui/auth/LoginWebviewPanel");
const AuthStatusBar_1 = require("../../ui/auth/AuthStatusBar");
const UsageIndicator_1 = require("../../ui/auth/UsageIndicator");
const LogoutNotification_1 = require("../../ui/auth/LogoutNotification");
/**
 * registerAuthCommands - 認証関連のコマンドを登録する関数
 *
 * VSCode拡張機能内で認証関連のコマンドを登録し、ユーザーが認証操作を行えるように
 * します。
 *
 * @param context VSCode拡張のコンテキスト
 */
function registerAuthCommands(context) {
    const authService = AuthenticationService_1.AuthenticationService.getInstance();
    // ログインコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.login', () => {
        LoginWebviewPanel_1.LoginWebviewPanel.createOrShow(context.extensionUri);
    }));
    // ログアウトコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.logout', async () => {
        const answer = await vscode.window.showWarningMessage('AppGeniusからログアウトしますか？', 'ログアウト', 'キャンセル');
        if (answer === 'ログアウト') {
            await authService.logout();
            vscode.window.showInformationMessage('AppGeniusからログアウトしました');
        }
    }));
    // 使用量詳細表示コマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.showUsageDetails', () => {
        // 使用量詳細画面を表示するロジック
        // 今後実装予定
        vscode.window.showInformationMessage('使用量詳細機能は現在実装中です');
    }));
    // 認証状態表示を初期化
    initAuthStatusBar(context);
    // 使用量表示を初期化
    initUsageIndicator(context);
    // ログアウト通知を初期化
    initLogoutNotification(context);
}
/**
 * 認証ステータスバーの初期化
 */
function initAuthStatusBar(context) {
    const statusBar = AuthStatusBar_1.AuthStatusBar.getInstance();
    context.subscriptions.push(statusBar);
}
/**
 * 使用量インジケーターの初期化
 */
function initUsageIndicator(context) {
    const usageIndicator = UsageIndicator_1.UsageIndicator.getInstance();
    context.subscriptions.push(usageIndicator);
}
/**
 * ログアウト通知の初期化
 */
function initLogoutNotification(context) {
    const logoutNotification = LogoutNotification_1.LogoutNotification.getInstance();
    context.subscriptions.push(logoutNotification);
}
//# sourceMappingURL=authCommands.js.map