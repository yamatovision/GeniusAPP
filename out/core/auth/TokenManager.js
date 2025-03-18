"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
const logger_1 = require("../../utils/logger");
const AuthStorageManager_1 = require("../../utils/AuthStorageManager");
/**
 * TokenManager - 認証トークンの管理を担当するシンプルなクラス
 *
 * トークンの保存・取得・検証のみに責任を限定し、
 * ストレージ層はAuthStorageManagerに委譲します。
 */
class TokenManager {
    /**
     * コンストラクタ
     */
    constructor(context) {
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
     */
    async setAccessToken(token, expiryInSeconds = 86400) {
        await this.storageManager.setAccessToken(token, expiryInSeconds);
    }
    /**
     * リフレッシュトークンを保存
     */
    async setRefreshToken(token) {
        await this.storageManager.setRefreshToken(token);
    }
    /**
     * アクセストークンを取得
     */
    async getAccessToken() {
        return this.storageManager.getAccessToken();
    }
    /**
     * リフレッシュトークンを取得
     */
    async getRefreshToken() {
        return this.storageManager.getRefreshToken();
    }
    /**
     * トークンが有効期限内かチェック
     */
    async isTokenValid(bufferSeconds = 300) {
        const expiry = await this.storageManager.getTokenExpiry();
        if (!expiry) {
            return false;
        }
        const currentTime = Math.floor(Date.now() / 1000);
        return currentTime < (expiry - bufferSeconds);
    }
    /**
     * 保存されているトークンをすべて削除
     */
    async clearTokens() {
        await this.storageManager.clearAll();
    }
    /**
     * トークンが存在するかチェック
     */
    async hasToken() {
        const token = await this.getAccessToken();
        return !!token;
    }
}
exports.TokenManager = TokenManager;
//# sourceMappingURL=TokenManager.js.map