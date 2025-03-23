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
exports.TokenManager = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../utils/logger");
const AuthStorageManager_1 = require("../../utils/AuthStorageManager");
/**
 * TokenManager - 認証トークンの管理を担当するクラス
 *
 * 改善点:
 * - トークン有効期限のデフォルト値を延長（72時間）
 * - リフレッシュ判断のバッファ時間を調整
 * - トークンの健全性チェック機能を追加
 * - 複数ストレージ間での整合性確保
 * - ログ出力の強化
 */
class TokenManager {
    /**
     * コンストラクタ
     */
    constructor(context) {
        this.DEFAULT_TOKEN_EXPIRY = 259200; // 72時間（秒）
        this.REFRESH_BUFFER = 7200; // 2時間前にリフレッシュ（秒）
        this.storageManager = AuthStorageManager_1.AuthStorageManager.getInstance(context);
        logger_1.Logger.info('TokenManager: 初期化完了');
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance(context) {
        if (!TokenManager.instance) {
            if (!context) {
                throw new Error('TokenManagerの初期化時にはExtensionContextが必要です');
            }
            TokenManager.instance = new TokenManager(context);
        }
        return TokenManager.instance;
    }
    /**
     * アクセストークンを保存
     * デフォルト有効期限を72時間（259200秒）に設定
     */
    async setAccessToken(token, expiryInSeconds = this.DEFAULT_TOKEN_EXPIRY) {
        try {
            logger_1.Logger.debug(`TokenManager: アクセストークンを保存 (有効期限: ${expiryInSeconds}秒)`);
            await this.storageManager.setAccessToken(token, expiryInSeconds);
            // トークン保存時刻を記録（トラブルシューティング用）
            const currentTime = new Date().toISOString();
            await vscode.workspace.getConfiguration().update('appgenius.auth.lastTokenUpdate', currentTime, vscode.ConfigurationTarget.Global);
            logger_1.Logger.info(`TokenManager: アクセストークン保存完了 (長さ: ${token.length}文字, 有効期限: ${expiryInSeconds}秒)`);
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: アクセストークン保存エラー', error);
            throw error;
        }
    }
    /**
     * リフレッシュトークンを保存
     */
    async setRefreshToken(token) {
        try {
            logger_1.Logger.debug('TokenManager: リフレッシュトークンを保存');
            await this.storageManager.setRefreshToken(token);
            // リフレッシュトークン保存時刻を記録（トラブルシューティング用）
            const currentTime = new Date().toISOString();
            await vscode.workspace.getConfiguration().update('appgenius.auth.lastRefreshTokenUpdate', currentTime, vscode.ConfigurationTarget.Global);
            logger_1.Logger.info(`TokenManager: リフレッシュトークン保存完了 (長さ: ${token.length}文字)`);
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: リフレッシュトークン保存エラー', error);
            throw error;
        }
    }
    /**
     * アクセストークンを取得
     */
    async getAccessToken() {
        try {
            const token = await this.storageManager.getAccessToken();
            logger_1.Logger.debug(`TokenManager: アクセストークン取得 ${token ? '成功' : '失敗'}`);
            return token;
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: アクセストークン取得エラー', error);
            return undefined;
        }
    }
    /**
     * リフレッシュトークンを取得
     */
    async getRefreshToken() {
        try {
            const token = await this.storageManager.getRefreshToken();
            logger_1.Logger.debug(`TokenManager: リフレッシュトークン取得 ${token ? '成功' : '失敗'}`);
            return token;
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: リフレッシュトークン取得エラー', error);
            return undefined;
        }
    }
    /**
     * トークンが有効期限内かチェック
     * bufferSeconds: リフレッシュが必要と判断するまでの猶予時間（秒）
     */
    async isTokenValid(bufferSeconds = this.REFRESH_BUFFER) {
        try {
            const expiry = await this.storageManager.getTokenExpiry();
            if (!expiry) {
                logger_1.Logger.debug('TokenManager: トークン有効期限情報がありません');
                return false;
            }
            const currentTime = Math.floor(Date.now() / 1000);
            const isValid = currentTime < (expiry - bufferSeconds);
            if (isValid) {
                const remainingTime = expiry - currentTime;
                logger_1.Logger.debug(`TokenManager: トークンは有効です (残り約${Math.floor(remainingTime / 3600)}時間${Math.floor((remainingTime % 3600) / 60)}分)`);
            }
            else {
                logger_1.Logger.info(`TokenManager: トークンの有効期限が近いかすでに期限切れです (バッファ: ${bufferSeconds}秒)`);
            }
            return isValid;
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: トークン有効期限チェックエラー', error);
            return false;
        }
    }
    /**
     * トークンが有効期限切れかどうかを直接チェック
     * トークンリフレッシュのトリガーとは別に、完全な期限切れかどうかを確認
     */
    async isTokenExpired() {
        try {
            const expiry = await this.storageManager.getTokenExpiry();
            if (!expiry) {
                return true;
            }
            const currentTime = Math.floor(Date.now() / 1000);
            return currentTime >= expiry;
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: トークン期限切れチェックエラー', error);
            return true; // エラーが発生した場合は期限切れとみなす
        }
    }
    /**
     * トークンの健全性をチェック
     * 形式が正しいJWTトークンかどうかを確認
     */
    async verifyTokenHealth() {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                return false;
            }
            // JWTの基本的な形式チェック（3つのセクションがあるかどうか）
            const parts = accessToken.split('.');
            if (parts.length !== 3) {
                logger_1.Logger.warn('TokenManager: アクセストークンの形式が無効です');
                return false;
            }
            // ペイロード部分をデコード
            try {
                const payload = JSON.parse(atob(parts[1]));
                // 有効期限の存在チェック
                if (!payload.exp) {
                    logger_1.Logger.warn('TokenManager: トークンペイロードに有効期限情報がありません');
                    return false;
                }
                // ユーザーIDの存在チェック
                if (!payload.id) {
                    logger_1.Logger.warn('TokenManager: トークンペイロードにユーザーID情報がありません');
                    return false;
                }
                return true;
            }
            catch (decodeError) {
                logger_1.Logger.warn('TokenManager: トークンデコードエラー', decodeError);
                return false;
            }
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: トークン健全性チェックエラー', error);
            return false;
        }
    }
    /**
     * 保存されているトークンをすべて削除
     */
    async clearTokens() {
        try {
            logger_1.Logger.debug('TokenManager: すべてのトークンを削除します');
            await this.storageManager.clearAll();
            logger_1.Logger.info('TokenManager: すべてのトークンを削除しました');
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: トークン削除エラー', error);
            throw error;
        }
    }
    /**
     * トークンが存在するかチェック
     */
    async hasToken() {
        try {
            const token = await this.getAccessToken();
            const hasToken = !!token;
            logger_1.Logger.debug(`TokenManager: トークン存在チェック (結果: ${hasToken})`);
            return hasToken;
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: トークン存在チェックエラー', error);
            return false;
        }
    }
    /**
     * トークン有効期限の更新
     * リフレッシュトークン使用時に有効期限を更新するためのメソッド
     */
    async updateTokenExpiry(expiryInSeconds) {
        try {
            const expiryTime = Math.floor(Date.now() / 1000) + expiryInSeconds;
            await this.storageManager.updateTokenExpiry(expiryTime);
            logger_1.Logger.info(`TokenManager: トークン有効期限を更新しました (${new Date(expiryTime * 1000).toLocaleString()}まで)`);
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: トークン有効期限更新エラー', error);
            throw error;
        }
    }
    /**
     * 現在の有効期限までの残り時間（秒）を取得
     */
    async getRemainingTime() {
        try {
            const expiry = await this.storageManager.getTokenExpiry();
            if (!expiry) {
                return undefined;
            }
            const currentTime = Math.floor(Date.now() / 1000);
            const remainingTime = Math.max(0, expiry - currentTime);
            return remainingTime;
        }
        catch (error) {
            logger_1.Logger.error('TokenManager: 残り時間取得エラー', error);
            return undefined;
        }
    }
}
exports.TokenManager = TokenManager;
//# sourceMappingURL=TokenManager.js.map