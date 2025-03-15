"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
/**
 * TokenManager - 認証トークンを安全に管理するクラス
 *
 * VSCode Secrets APIを使用して認証トークンを安全に保存・管理します。
 * このクラスはシングルトンパターンを使用しています。
 */
class TokenManager {
    /**
     * シングルトンインスタンスを初期化
     */
    constructor(context) {
        // シークレットキー
        this.ACCESS_TOKEN_KEY = 'appgenius.accessToken';
        this.REFRESH_TOKEN_KEY = 'appgenius.refreshToken';
        this.secretStorage = context.secrets;
    }
    /**
     * TokenManagerのシングルトンインスタンスを取得
     * @param context 初回呼び出し時のみ必要なVSCode拡張コンテキスト
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
     * @param token 保存するアクセストークン
     */
    async setAccessToken(token) {
        await this.secretStorage.store(this.ACCESS_TOKEN_KEY, token);
    }
    /**
     * リフレッシュトークンを保存
     * @param token 保存するリフレッシュトークン
     */
    async setRefreshToken(token) {
        await this.secretStorage.store(this.REFRESH_TOKEN_KEY, token);
    }
    /**
     * アクセストークンを取得
     * @returns 保存されたアクセストークン、または未設定の場合はnull
     */
    async getAccessToken() {
        return this.secretStorage.get(this.ACCESS_TOKEN_KEY);
    }
    /**
     * リフレッシュトークンを取得
     * @returns 保存されたリフレッシュトークン、または未設定の場合はnull
     */
    async getRefreshToken() {
        return this.secretStorage.get(this.REFRESH_TOKEN_KEY);
    }
    /**
     * 保存されているトークンをすべて削除
     */
    async clearTokens() {
        await this.secretStorage.delete(this.ACCESS_TOKEN_KEY);
        await this.secretStorage.delete(this.REFRESH_TOKEN_KEY);
    }
    /**
     * トークンが存在するかチェック
     * @returns アクセストークンが存在する場合はtrue
     */
    async hasToken() {
        const token = await this.getAccessToken();
        return !!token;
    }
}
exports.TokenManager = TokenManager;
//# sourceMappingURL=TokenManager.js.map