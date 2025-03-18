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
exports.ProtectedPanel = void 0;
const vscode = __importStar(require("vscode"));
const AuthGuard_1 = require("./AuthGuard");
const logger_1 = require("../../utils/logger");
const AuthenticationService_1 = require("../../core/auth/AuthenticationService");
const PermissionManager_1 = require("../../core/auth/PermissionManager");
/**
 * 権限保護パネル基底クラス
 *
 * このクラスを継承することで、各UIパネルは統一した権限チェック機能を取得します。
 * シンプルな責任範囲と明確な権限チェックプロセスを提供します。
 */
class ProtectedPanel {
    constructor() {
        // クラスが初期化されたときに一度だけ認証リスナーを設定
        if (!ProtectedPanel.authListenersInitialized) {
            try {
                // 認証状態変更の監視を設定
                const authService = AuthenticationService_1.AuthenticationService.getInstance();
                const permissionManager = PermissionManager_1.PermissionManager.getInstance();
                // 権限変更イベントをリッスン
                permissionManager.onPermissionsChanged(() => {
                    logger_1.Logger.debug('ProtectedPanel: 権限変更を検知しました。UIの更新が必要かもしれません。');
                });
                ProtectedPanel.authListenersInitialized = true;
                logger_1.Logger.debug('ProtectedPanel: 認証リスナーを初期化しました');
            }
            catch (error) {
                logger_1.Logger.error('ProtectedPanel: 認証リスナーの初期化に失敗しました', error);
            }
        }
    }
    /**
     * 特定の機能について権限チェックを行い、権限があればtrueを返します
     *
     * @param feature チェックする機能
     * @param className 呈示用のクラス名（ログ出力用）
     * @returns 権限がある場合はtrue、ない場合はfalse
     */
    static checkPermissionForFeature(feature, className = 'ProtectedPanel') {
        logger_1.Logger.debug(`${className}: 権限チェックを実行します (${feature})`);
        try {
            // AuthGuardの権限チェックを利用
            if (!AuthGuard_1.AuthGuard.checkAccess(feature)) {
                logger_1.Logger.warn(`${className}: ${feature}へのアクセスが拒否されました`);
                return false;
            }
            logger_1.Logger.debug(`${className}: 権限チェックOK`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`${className}: 権限チェック中にエラーが発生しました`, error);
            vscode.window.showErrorMessage(`機能へのアクセスチェック中にエラーが発生しました。ログを確認してください。`);
            return false;
        }
    }
}
exports.ProtectedPanel = ProtectedPanel;
ProtectedPanel.authListenersInitialized = false;
//# sourceMappingURL=ProtectedPanel.js.map