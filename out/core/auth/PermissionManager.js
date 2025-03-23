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
exports.PermissionManager = void 0;
const vscode = __importStar(require("vscode"));
const roles_1 = require("./roles");
const logger_1 = require("../../utils/logger");
/**
 * PermissionManager - 機能へのアクセス権限をチェックするクラス
 *
 * 認証サービスの状態に基づいて、
 * ユーザーが特定の機能にアクセスできるかどうかをチェックします。
 * SimpleAuthServiceとAuthenticationServiceの両方に対応しています。
 */
class PermissionManager {
    /**
     * コンストラクタ
     */
    constructor(authService) {
        this._onPermissionsChanged = new vscode.EventEmitter();
        // 公開イベント
        this.onPermissionsChanged = this._onPermissionsChanged.event;
        this._authService = authService;
        // SimpleAuthServiceかどうかを判定
        this._isSimpleAuth = 'getAccessToken' in authService;
        // 認証状態変更イベントをリッスン
        this._authService.onStateChanged(this._handleAuthStateChanged.bind(this));
        logger_1.Logger.info(`PermissionManager: 初期化完了 (SimpleAuth: ${this._isSimpleAuth})`);
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance(authService) {
        if (!PermissionManager.instance) {
            if (!authService) {
                throw new Error('PermissionManagerの初期化時には認証サービスが必要です');
            }
            PermissionManager.instance = new PermissionManager(authService);
        }
        return PermissionManager.instance;
    }
    /**
     * 認証状態変更ハンドラー
     */
    _handleAuthStateChanged() {
        // 権限変更イベントを発行
        this._onPermissionsChanged.fire();
        logger_1.Logger.debug('PermissionManager: 権限変更イベントを発行しました');
    }
    /**
     * 特定機能へのアクセス権限を確認
     */
    canAccess(feature) {
        // 現在の認証状態を取得
        const state = this._authService.getCurrentState();
        // 認証されていない場合はゲストロールとして扱う
        const role = state.isAuthenticated ? state.role : roles_1.Role.GUEST;
        // 管理者は常にアクセス可能
        if (role === roles_1.Role.ADMIN) {
            return true;
        }
        // 現在のロールでアクセス可能な機能リストをチェック
        const allowedFeatures = roles_1.RoleFeatureMap[role] || [];
        return allowedFeatures.includes(feature);
    }
    /**
     * 指定された機能へのアクセス権限をチェックし、
     * 権限がなければエラーメッセージを表示
     */
    checkAccessWithFeedback(feature) {
        const hasAccess = this.canAccess(feature);
        if (!hasAccess) {
            const action = this.getAccessDeniedAction(feature);
            // メッセージ表示とアクション
            if (action.action === 'login') {
                vscode.window.showInformationMessage(action.message, 'ログイン')
                    .then(selection => {
                    if (selection === 'ログイン' && action.command) {
                        vscode.commands.executeCommand(action.command);
                    }
                });
            }
            else {
                vscode.window.showErrorMessage(action.message);
            }
        }
        return hasAccess;
    }
    /**
     * アクセス拒否時のアクション情報を取得
     */
    getAccessDeniedAction(feature) {
        const featureName = roles_1.FeatureDisplayNames[feature] || feature;
        const state = this._authService.getCurrentState();
        // 認証されていない場合
        if (!state.isAuthenticated) {
            return {
                message: `「${featureName}」を使用するにはログインが必要です。`,
                action: 'login',
                command: 'appgenius.login'
            };
        }
        // 認証されているが、権限がない場合
        return {
            message: `「${featureName}」へのアクセス権限がありません。`,
            action: 'contact_admin'
        };
    }
    /**
     * 現在のユーザーが管理者かどうかを確認
     */
    isAdmin() {
        const state = this._authService.getCurrentState();
        return state.isAuthenticated && state.role === roles_1.Role.ADMIN;
    }
    /**
     * 現在ログイン中かどうかを確認
     */
    isLoggedIn() {
        return this._authService.isAuthenticated();
    }
    /**
     * 現在のロールを取得
     */
    getCurrentRole() {
        const state = this._authService.getCurrentState();
        return state.role;
    }
}
exports.PermissionManager = PermissionManager;
//# sourceMappingURL=PermissionManager.js.map