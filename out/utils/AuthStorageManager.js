"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthStorageManager = void 0;
const logger_1 = require("./logger");
/**
 * AuthStorageManager - 認証情報を安全に保存・取得するためのシンプルなマネージャー
 *
 * VSCode SecretStorageのみを使用し、認証情報の保存・取得を一元管理します。
 */
class AuthStorageManager {
    /**
     * コンストラクタ
     */
    constructor(context) {
        // セキュリティキー定義
        this.ACCESS_TOKEN_KEY = 'appgenius.accessToken';
        this.REFRESH_TOKEN_KEY = 'appgenius.refreshToken';
        this.TOKEN_EXPIRY_KEY = 'appgenius.tokenExpiry';
        this.USER_DATA_KEY = 'appgenius.userData';
        this.secretStorage = context.secrets;
        logger_1.Logger.info('AuthStorageManager: 初期化完了');
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance(context) {
        if (!AuthStorageManager.instance) {
            if (!context) {
                throw new Error('AuthStorageManagerの初期化時にはExtensionContextが必要です');
            }
            AuthStorageManager.instance = new AuthStorageManager(context);
        }
        return AuthStorageManager.instance;
    }
    /**
     * データの保存
     */
    async set(key, value) {
        try {
            // オブジェクトの場合はJSON文字列に変換
            const valueToStore = typeof value === 'object'
                ? JSON.stringify(value)
                : value;
            await this.secretStorage.store(key, valueToStore);
            logger_1.Logger.debug(`AuthStorageManager: データを保存しました (キー: ${key})`);
        }
        catch (error) {
            logger_1.Logger.error(`AuthStorageManager: データ保存エラー (キー: ${key})`, error);
            throw error;
        }
    }
    /**
     * データの取得
     */
    async get(key) {
        try {
            const value = await this.secretStorage.get(key);
            return value;
        }
        catch (error) {
            logger_1.Logger.error(`AuthStorageManager: データ取得エラー (キー: ${key})`, error);
            return undefined;
        }
    }
    /**
     * オブジェクトデータの取得
     */
    async getObject(key) {
        try {
            const value = await this.get(key);
            if (!value) {
                return undefined;
            }
            return JSON.parse(value);
        }
        catch (error) {
            logger_1.Logger.error(`AuthStorageManager: オブジェクト解析エラー (キー: ${key})`, error);
            return undefined;
        }
    }
    /**
     * データの削除
     */
    async remove(key) {
        try {
            await this.secretStorage.delete(key);
            logger_1.Logger.debug(`AuthStorageManager: データを削除しました (キー: ${key})`);
        }
        catch (error) {
            logger_1.Logger.error(`AuthStorageManager: データ削除エラー (キー: ${key})`, error);
            throw error;
        }
    }
    /**
     * アクセストークンの保存
     */
    async setAccessToken(token, expiryInSeconds = 86400) {
        await this.set(this.ACCESS_TOKEN_KEY, token);
        // 有効期限を計算して保存（Unix timestamp）
        const expiryTime = Math.floor(Date.now() / 1000) + expiryInSeconds;
        await this.set(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
        logger_1.Logger.info(`AuthStorageManager: アクセストークンを保存しました (有効期限: ${new Date(expiryTime * 1000).toLocaleString()})`);
    }
    /**
     * リフレッシュトークンの保存
     */
    async setRefreshToken(token) {
        await this.set(this.REFRESH_TOKEN_KEY, token);
        logger_1.Logger.debug('AuthStorageManager: リフレッシュトークンを保存しました');
    }
    /**
     * アクセストークンの取得
     */
    async getAccessToken() {
        return this.get(this.ACCESS_TOKEN_KEY);
    }
    /**
     * リフレッシュトークンの取得
     */
    async getRefreshToken() {
        return this.get(this.REFRESH_TOKEN_KEY);
    }
    /**
     * トークンの有効期限を取得
     */
    async getTokenExpiry() {
        const expiryStr = await this.get(this.TOKEN_EXPIRY_KEY);
        return expiryStr ? parseInt(expiryStr, 10) : undefined;
    }
    /**
     * ユーザーデータの保存
     */
    async setUserData(userData) {
        await this.set(this.USER_DATA_KEY, userData);
        logger_1.Logger.debug('AuthStorageManager: ユーザーデータを保存しました');
    }
    /**
     * ユーザーデータの取得
     */
    async getUserData() {
        return this.getObject(this.USER_DATA_KEY);
    }
    /**
     * 全ての認証データを削除
     */
    async clearAll() {
        await this.remove(this.ACCESS_TOKEN_KEY);
        await this.remove(this.REFRESH_TOKEN_KEY);
        await this.remove(this.TOKEN_EXPIRY_KEY);
        await this.remove(this.USER_DATA_KEY);
        logger_1.Logger.info('AuthStorageManager: すべての認証データを削除しました');
    }
}
exports.AuthStorageManager = AuthStorageManager;
//# sourceMappingURL=AuthStorageManager.js.map