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
exports.AuthGuard = void 0;
const vscode = __importStar(require("vscode"));
const PermissionManager_1 = require("../../core/auth/PermissionManager");
const logger_1 = require("../../utils/logger");
/**
 * AuthGuard - UIコンポーネントのアクセス制御を担当
 *
 * Webviewパネルやコマンド実行前に権限チェックを行い、
 * アクセス権限がない場合は適切なフィードバックを提供します。
 */
class AuthGuard {
    /**
     * 特定機能へのアクセス権限をチェック
     * アクセス不可の場合は適切なメッセージを表示
     *
     * @param feature チェックする機能
     * @returns アクセス可能かどうか
     */
    static checkAccess(feature) {
        try {
            logger_1.Logger.debug(`AuthGuard: ${feature}へのアクセス権限をチェックします`);
            const permissionManager = PermissionManager_1.PermissionManager.getInstance();
            return permissionManager.checkAccessWithFeedback(feature);
        }
        catch (error) {
            logger_1.Logger.error(`AuthGuard: アクセス権チェック中にエラーが発生しました`, error);
            return false;
        }
    }
    /**
     * 管理者権限が必要な機能へのアクセスをチェック
     *
     * @param feature チェックする機能
     * @returns アクセス可能かどうか
     */
    static checkAdminAccess(feature) {
        try {
            const permissionManager = PermissionManager_1.PermissionManager.getInstance();
            const isAdmin = permissionManager.isAdmin();
            if (!isAdmin) {
                vscode.window.showErrorMessage(`この機能は管理者のみ使用できます`);
                return false;
            }
            return permissionManager.checkAccessWithFeedback(feature);
        }
        catch (error) {
            logger_1.Logger.error(`AuthGuard: 管理者権限チェック中にエラーが発生しました`, error);
            return false;
        }
    }
    /**
     * ログイン状態をチェック
     * ログインしていない場合はログインを促す
     *
     * @returns ログイン済みかどうか
     */
    static checkLoggedIn() {
        try {
            const permissionManager = PermissionManager_1.PermissionManager.getInstance();
            const isLoggedIn = permissionManager.isLoggedIn();
            if (!isLoggedIn) {
                vscode.window.showInformationMessage('この機能を使用するにはログインが必要です', 'ログイン')
                    .then(selection => {
                    if (selection === 'ログイン') {
                        vscode.commands.executeCommand('appgenius.login');
                    }
                });
            }
            return isLoggedIn;
        }
        catch (error) {
            logger_1.Logger.error(`AuthGuard: ログイン状態チェック中にエラーが発生しました`, error);
            return false;
        }
    }
}
exports.AuthGuard = AuthGuard;
//# sourceMappingURL=AuthGuard.js.map