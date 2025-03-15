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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = void 0;
const vscode = __importStar(require("vscode"));
const TokenManager_1 = require("./TokenManager");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
const AuthEventBus_1 = require("../../services/AuthEventBus");
/**
 * AuthenticationService - VSCode拡張の認証機能を管理するサービス
 *
 * 中央管理システムとの通信を担当し、ユーザーの認証状態を管理します。
 */
class AuthenticationService {
    constructor() {
        this._isAuthenticated = false;
        this._currentUser = null;
        this._statusBarItem = null;
        this._authCheckInterval = null;
        this._lastError = null;
        this._isRefreshing = false;
        this._refreshPromise = null;
        // リトライ設定
        this._maxRetries = 3;
        this._retryDelay = 1000; // ミリ秒
        // イベントエミッター
        this._onAuthStateChanged = new vscode.EventEmitter();
        this.onAuthStateChanged = this._onAuthStateChanged.event;
        this._tokenManager = TokenManager_1.TokenManager.getInstance();
        this._authEventBus = AuthEventBus_1.AuthEventBus.getInstance();
        this._initialize();
    }
    /**
     * AuthenticationServiceのシングルトンインスタンスを取得
     */
    static getInstance() {
        if (!AuthenticationService.instance) {
            AuthenticationService.instance = new AuthenticationService();
        }
        return AuthenticationService.instance;
    }
    /**
     * サービスの初期化
     * 保存されたトークンがあれば読み込み、有効性を検証します
     */
    async _initialize() {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (token) {
                // トークンの有効性を検証
                const isValid = await this._verifyToken(token);
                this._isAuthenticated = isValid;
                if (isValid) {
                    await this._fetchUserInfo();
                    this._startAuthCheckInterval();
                }
            }
            // 認証状態が変更されたことを通知
            this._onAuthStateChanged.fire(this._isAuthenticated);
            this._authEventBus.updateAuthState({
                isAuthenticated: this._isAuthenticated,
                userId: this._currentUser?.id,
                username: this._currentUser?.name
            }, 'AuthenticationService');
        }
        catch (error) {
            logger_1.Logger.error('認証サービスの初期化中にエラーが発生しました:', error);
            this._setLastError({
                code: 'init_failed',
                message: `認証サービスの初期化に失敗しました: ${error.message}`,
                isRetryable: false
            });
        }
    }
    /**
     * ユーザーログイン
     * @param email ユーザーのメールアドレス
     * @param password ユーザーのパスワード
     * @returns ログイン成功時はtrue、失敗時はfalse
     */
    async login(email, password) {
        try {
            // 環境変数から認証APIのエンドポイントを取得
            const apiUrl = this._getAuthApiUrl();
            // クライアントID/シークレットを取得
            const clientId = this._getClientId();
            const clientSecret = this._getClientSecret();
            if (!clientId || !clientSecret) {
                logger_1.Logger.warn('クライアントID/シークレットが設定されていません');
                this._setLastError({
                    code: 'missing_credentials',
                    message: 'クライアントID/シークレットが設定されていません',
                    isRetryable: false
                });
            }
            // 認証APIを呼び出し
            const response = await axios_1.default.post(`${apiUrl}/auth/login`, {
                email,
                password,
                clientId,
                clientSecret
            });
            if (response.status === 200 && response.data.accessToken && response.data.refreshToken) {
                // トークンを保存
                await this._tokenManager.setAccessToken(response.data.accessToken);
                await this._tokenManager.setRefreshToken(response.data.refreshToken);
                // 認証状態を更新
                this._isAuthenticated = true;
                this._currentUser = response.data.user;
                this._lastError = null;
                // 認証チェックインターバルを開始
                this._startAuthCheckInterval();
                // 認証状態が変更されたことを通知
                this._onAuthStateChanged.fire(true);
                this._authEventBus.publish(AuthEventBus_1.AuthEventType.LOGIN_SUCCESS, {
                    userId: this._currentUser?.id,
                    username: this._currentUser?.name
                }, 'AuthenticationService');
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.Logger.error('ログイン中にエラーが発生しました:', error);
            // エラー情報を設定
            if (axios_1.default.isAxiosError(error)) {
                const statusCode = error.response?.status;
                let errorMessage = '認証に失敗しました';
                let errorCode = 'login_failed';
                // ステータスコードに応じたメッセージ
                if (statusCode === 401) {
                    errorMessage = 'メールアドレスまたはパスワードが正しくありません';
                    errorCode = 'invalid_credentials';
                }
                else if (statusCode === 403) {
                    errorMessage = 'アクセスが拒否されました';
                    errorCode = 'access_denied';
                }
                else if (statusCode === 429) {
                    errorMessage = 'リクエスト回数が多すぎます。しばらく待ってから再試行してください';
                    errorCode = 'rate_limited';
                }
                this._setLastError({
                    code: errorCode,
                    message: errorMessage,
                    statusCode,
                    isRetryable: statusCode === 429 || (statusCode && statusCode >= 500)
                });
                // エラーイベントを発行
                this._authEventBus.publish(AuthEventBus_1.AuthEventType.LOGIN_FAILED, {
                    code: errorCode,
                    message: errorMessage,
                    statusCode
                }, 'AuthenticationService');
            }
            else {
                this._setLastError({
                    code: 'unknown_error',
                    message: `ログイン中に予期しないエラーが発生しました: ${error.message}`,
                    isRetryable: true
                });
                this._authEventBus.publish(AuthEventBus_1.AuthEventType.LOGIN_FAILED, {
                    code: 'unknown_error',
                    message: error.message
                }, 'AuthenticationService');
            }
            return false;
        }
    }
    /**
     * ユーザーログアウト
     */
    async logout() {
        try {
            const refreshToken = await this._tokenManager.getRefreshToken();
            const apiUrl = this._getAuthApiUrl();
            // サーバーにログアウトリクエストを送信
            if (refreshToken) {
                try {
                    await axios_1.default.post(`${apiUrl}/auth/logout`, {
                        refreshToken
                    });
                }
                catch (error) {
                    logger_1.Logger.error('サーバーへのログアウトリクエスト中にエラーが発生しました:', error);
                }
            }
        }
        catch (error) {
            logger_1.Logger.error('ログアウト処理中にエラーが発生しました:', error);
        }
        finally {
            // ローカルの認証情報をクリア
            await this._tokenManager.clearTokens();
            this._isAuthenticated = false;
            this._currentUser = null;
            // 認証チェックインターバルを停止
            this._stopAuthCheckInterval();
            // 認証状態が変更されたことを通知
            this._onAuthStateChanged.fire(false);
            this._authEventBus.publish(AuthEventBus_1.AuthEventType.LOGOUT, {}, 'AuthenticationService');
        }
    }
    /**
     * トークンのリフレッシュ
     * アクセストークンの期限が切れている場合に、リフレッシュトークンを使用して新しいアクセストークンを取得
     */
    async refreshToken() {
        // 既にリフレッシュ中なら、そのPromiseを返す
        if (this._isRefreshing && this._refreshPromise) {
            return this._refreshPromise;
        }
        try {
            this._isRefreshing = true;
            this._refreshPromise = this._doRefreshToken();
            return await this._refreshPromise;
        }
        finally {
            this._isRefreshing = false;
            this._refreshPromise = null;
        }
    }
    /**
     * 実際のトークンリフレッシュ処理
     */
    async _doRefreshToken() {
        try {
            const refreshToken = await this._tokenManager.getRefreshToken();
            if (!refreshToken) {
                logger_1.Logger.warn('リフレッシュトークンが見つかりません');
                return false;
            }
            const apiUrl = this._getAuthApiUrl();
            const clientId = this._getClientId();
            const clientSecret = this._getClientSecret();
            // トークンリフレッシュAPIを呼び出し
            const response = await axios_1.default.post(`${apiUrl}/auth/refresh-token`, {
                refreshToken,
                clientId,
                clientSecret
            });
            if (response.status === 200 && response.data.accessToken) {
                // 新しいアクセストークンを保存
                await this._tokenManager.setAccessToken(response.data.accessToken);
                // リフレッシュトークンも更新される場合は保存
                if (response.data.refreshToken) {
                    await this._tokenManager.setRefreshToken(response.data.refreshToken);
                }
                // トークンリフレッシュイベントを発行
                this._authEventBus.publish(AuthEventBus_1.AuthEventType.TOKEN_REFRESHED, {}, 'AuthenticationService');
                logger_1.Logger.info('アクセストークンをリフレッシュしました');
                return true;
            }
            logger_1.Logger.warn('トークンリフレッシュのレスポンスが無効です');
            return false;
        }
        catch (error) {
            logger_1.Logger.error('トークンリフレッシュ中にエラーが発生しました:', error);
            // エラー情報を設定
            if (axios_1.default.isAxiosError(error)) {
                const statusCode = error.response?.status;
                if (statusCode === 401 || statusCode === 403) {
                    // リフレッシュトークンが無効な場合
                    this._setLastError({
                        code: 'invalid_refresh_token',
                        message: 'リフレッシュトークンが無効です。再ログインが必要です。',
                        statusCode,
                        isRetryable: false
                    });
                    // リフレッシュに失敗した場合はログアウト
                    await this.logout();
                    // トークン期限切れイベントを発行
                    this._authEventBus.publish(AuthEventBus_1.AuthEventType.TOKEN_EXPIRED, {
                        message: 'セッションの有効期限が切れました。再ログインしてください。'
                    }, 'AuthenticationService');
                }
                else if (statusCode === 429) {
                    // レート制限の場合
                    this._setLastError({
                        code: 'rate_limited',
                        message: 'リクエスト回数が多すぎます。しばらく待ってから再試行してください。',
                        statusCode,
                        isRetryable: true
                    });
                }
                else {
                    // その他のエラー
                    this._setLastError({
                        code: 'refresh_failed',
                        message: `トークンリフレッシュに失敗しました: ${error.message}`,
                        statusCode,
                        isRetryable: statusCode ? statusCode >= 500 : true
                    });
                }
            }
            else {
                // Axiosエラーではない場合
                this._setLastError({
                    code: 'unknown_error',
                    message: `トークンリフレッシュ中に予期しないエラーが発生しました: ${error.message}`,
                    isRetryable: true
                });
            }
            // 認証エラーイベントを発行
            this._authEventBus.publish(AuthEventBus_1.AuthEventType.AUTH_ERROR, {
                error: this._lastError
            }, 'AuthenticationService');
            return false;
        }
    }
    /**
     * 外部トークンの直接設定（ClaudeCode連携用）
     */
    async setAuthTokenDirectly(token) {
        try {
            // トークンの有効性を検証
            const isValid = await this._verifyToken(token);
            if (!isValid) {
                logger_1.Logger.warn('設定しようとしたトークンは無効です');
                return false;
            }
            // トークンを設定
            await this._tokenManager.setAccessToken(token);
            // ユーザー情報を取得
            await this._fetchUserInfo();
            // 認証状態を更新
            this._isAuthenticated = true;
            // 認証チェックインターバルを開始
            this._startAuthCheckInterval();
            // 認証状態が変更されたことを通知
            this._onAuthStateChanged.fire(true);
            this._authEventBus.publish(AuthEventBus_1.AuthEventType.LOGIN_SUCCESS, {
                userId: this._currentUser?.id,
                username: this._currentUser?.name
            }, 'AuthenticationService');
            return true;
        }
        catch (error) {
            logger_1.Logger.error('外部トークン設定中にエラーが発生しました:', error);
            this._setLastError({
                code: 'token_validation_failed',
                message: `外部トークンの検証に失敗しました: ${error.message}`,
                isRetryable: false
            });
            return false;
        }
    }
    /**
     * 現在の認証状態を確認
     */
    isAuthenticated() {
        return this._isAuthenticated;
    }
    /**
     * 現在のユーザー情報を取得
     */
    getCurrentUser() {
        return this._currentUser;
    }
    /**
     * ユーザー情報を取得（外部公開API）
     */
    async getUserInfo() {
        try {
            await this._fetchUserInfo();
            return this._currentUser;
        }
        catch (error) {
            logger_1.Logger.error('ユーザー情報取得中にエラーが発生しました:', error);
            throw error;
        }
    }
    /**
     * 最後のエラー情報を取得
     */
    getLastError() {
        return this._lastError;
    }
    /**
     * アクセストークンを取得
     */
    async getAuthToken() {
        return this._tokenManager.getAccessToken();
    }
    /**
     * トークンを直接設定（テスト用）
     * 警告: このメソッドは主にテストのために使用されます
     */
    async setAuthTokenDirectly(token) {
        try {
            // トークンの有効性を検証
            const isValid = await this._verifyToken(token);
            if (!isValid) {
                logger_1.Logger.warn('設定しようとしたトークンは無効です');
                return false;
            }
            // トークンを設定
            await this._tokenManager.setAccessToken(token);
            // ユーザー情報を取得
            await this._fetchUserInfo();
            // 認証状態を更新
            this._isAuthenticated = true;
            // 認証チェックインターバルを開始
            this._startAuthCheckInterval();
            // 認証状態が変更されたことを通知
            this._onAuthStateChanged.fire(true);
            this._authEventBus.publish(AuthEventBus_1.AuthEventType.LOGIN_SUCCESS, {
                userId: this._currentUser?.id,
                username: this._currentUser?.name
            }, 'AuthenticationService');
            return true;
        }
        catch (error) {
            logger_1.Logger.error('外部トークン設定中にエラーが発生しました:', error);
            this._setLastError({
                code: 'token_validation_failed',
                message: `外部トークンの検証に失敗しました: ${error.message}`,
                isRetryable: false
            });
            return false;
        }
    }
    /**
     * ユーザープロファイルを更新
     */
    async updateProfile(profileData) {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                return false;
            }
            const apiUrl = this._getAuthApiUrl();
            const response = await axios_1.default.put(`${apiUrl}/users/profile`, profileData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 200 && response.data.user) {
                this._currentUser = response.data.user;
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.Logger.error('プロファイル更新中にエラーが発生しました:', error);
            // エラー情報を設定
            if (axios_1.default.isAxiosError(error)) {
                const statusCode = error.response?.status;
                if (statusCode === 401) {
                    // アクセストークンの期限切れの場合はリフレッシュを試みる
                    const refreshSucceeded = await this.refreshToken();
                    if (refreshSucceeded) {
                        // リフレッシュに成功したら再試行
                        return this.updateProfile(profileData);
                    }
                }
                this._setLastError({
                    code: 'profile_update_failed',
                    message: `プロファイル更新に失敗しました: ${error.message}`,
                    statusCode,
                    isRetryable: statusCode ? statusCode >= 500 : true
                });
            }
            else {
                this._setLastError({
                    code: 'unknown_error',
                    message: `プロファイル更新中に予期しないエラーが発生しました: ${error.message}`,
                    isRetryable: true
                });
            }
            return false;
        }
    }
    /**
     * パスワード変更
     */
    async changePassword(currentPassword, newPassword) {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                return false;
            }
            const apiUrl = this._getAuthApiUrl();
            const response = await axios_1.default.post(`${apiUrl}/users/change-password`, {
                currentPassword,
                newPassword
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.status === 200;
        }
        catch (error) {
            logger_1.Logger.error('パスワード変更中にエラーが発生しました:', error);
            // エラー情報を設定
            if (axios_1.default.isAxiosError(error)) {
                const statusCode = error.response?.status;
                let errorMessage = 'パスワード変更に失敗しました';
                let errorCode = 'password_change_failed';
                if (statusCode === 401) {
                    // アクセストークンの期限切れの場合はリフレッシュを試みる
                    const refreshSucceeded = await this.refreshToken();
                    if (refreshSucceeded) {
                        // リフレッシュに成功したら再試行
                        return this.changePassword(currentPassword, newPassword);
                    }
                    errorMessage = '認証に失敗しました。再ログインしてください';
                    errorCode = 'authentication_failed';
                }
                else if (statusCode === 400) {
                    errorMessage = '現在のパスワードが正しくないか、新しいパスワードが要件を満たしていません';
                    errorCode = 'invalid_password';
                }
                this._setLastError({
                    code: errorCode,
                    message: errorMessage,
                    statusCode,
                    isRetryable: statusCode ? statusCode >= 500 : true
                });
            }
            else {
                this._setLastError({
                    code: 'unknown_error',
                    message: `パスワード変更中に予期しないエラーが発生しました: ${error.message}`,
                    isRetryable: true
                });
            }
            return false;
        }
    }
    /**
     * ユーザー情報を取得
     */
    async _fetchUserInfo() {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                return;
            }
            const apiUrl = this._getAuthApiUrl();
            // ユーザー情報取得APIを呼び出し
            const response = await axios_1.default.get(`${apiUrl}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 200 && response.data.user) {
                this._currentUser = response.data.user;
                // 認証状態を更新
                this._authEventBus.updateAuthState({
                    userId: this._currentUser.id,
                    username: this._currentUser.name,
                    permissions: this._currentUser.permissions || []
                }, 'AuthenticationService');
            }
        }
        catch (error) {
            logger_1.Logger.error('ユーザー情報取得中にエラーが発生しました:', error);
            // トークンが無効の場合は認証エラーとしてログアウト
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                // トークンリフレッシュを試みる
                const refreshSucceeded = await this.refreshToken();
                if (!refreshSucceeded) {
                    await this.logout();
                }
                else {
                    // リフレッシュに成功したら再度ユーザー情報を取得
                    await this._fetchUserInfo();
                }
            }
        }
    }
    /**
     * トークンの有効性を検証
     */
    async _verifyToken(token) {
        let retries = 0;
        while (retries <= this._maxRetries) {
            try {
                const apiUrl = this._getAuthApiUrl();
                // トークン検証APIを呼び出し
                const response = await axios_1.default.post(`${apiUrl}/auth/verify`, {}, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                return response.status === 200;
            }
            catch (error) {
                logger_1.Logger.error(`トークン検証中にエラーが発生しました (試行 ${retries + 1}/${this._maxRetries + 1}):`, error);
                // トークンが無効の場合はリフレッシュを試みる
                if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                    return await this.refreshToken();
                }
                // ネットワークエラーや500系エラーの場合はリトライ
                if (this._isRetryableError(error) && retries < this._maxRetries) {
                    retries++;
                    // 指数バックオフで待機
                    await this._delay(this._retryDelay * Math.pow(2, retries - 1));
                    continue;
                }
                return false;
            }
        }
        return false;
    }
    /**
     * リトライ可能なエラーかどうかを判定
     */
    _isRetryableError(error) {
        // ネットワークエラー（タイムアウトなど）
        if (axios_1.default.isAxiosError(error) && !error.response) {
            return true;
        }
        // 特定のHTTPステータスコード（サーバーエラーなど）
        if (axios_1.default.isAxiosError(error) && error.response) {
            const status = error.response.status;
            // 429: Too Many Requests, 5xx: サーバーエラー
            return status === 429 || (status >= 500 && status < 600);
        }
        return false;
    }
    /**
     * 指定された時間（ミリ秒）待機する
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 定期的な認証チェックを開始
     */
    _startAuthCheckInterval() {
        // 既存のインターバルがあれば停止
        this._stopAuthCheckInterval();
        // 環境変数からチェック間隔を取得（デフォルトは5分）
        const checkIntervalSeconds = Math.min(parseInt(process.env.CHECK_INTERVAL || '300', 10), 300 // 最大5分
        );
        // 定期的なトークン検証を設定
        this._authCheckInterval = setInterval(async () => {
            try {
                const token = await this._tokenManager.getAccessToken();
                if (token) {
                    const isValid = await this._verifyToken(token);
                    if (!isValid) {
                        // トークンが無効になった場合はログアウト
                        logger_1.Logger.warn('定期チェックでトークンが無効と判断されました。ログアウトします。');
                        await this.logout();
                    }
                }
            }
            catch (error) {
                logger_1.Logger.error('認証チェック中にエラーが発生しました:', error);
            }
        }, checkIntervalSeconds * 1000);
        logger_1.Logger.debug(`認証チェックインターバルを開始しました (${checkIntervalSeconds}秒間隔)`);
    }
    /**
     * 定期的な認証チェックを停止
     */
    _stopAuthCheckInterval() {
        if (this._authCheckInterval) {
            clearInterval(this._authCheckInterval);
            this._authCheckInterval = null;
            logger_1.Logger.debug('認証チェックインターバルを停止しました');
        }
    }
    /**
     * 認証APIのURLを取得
     */
    _getAuthApiUrl() {
        const url = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
        return url;
    }
    /**
     * クライアントIDを取得
     */
    _getClientId() {
        return process.env.CLIENT_ID || '';
    }
    /**
     * クライアントシークレットを取得
     */
    _getClientSecret() {
        return process.env.CLIENT_SECRET || '';
    }
    /**
     * 認証ヘッダーを取得
     * API呼び出し時のAuthorization headerとして使用
     */
    async getAuthHeader() {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                return null;
            }
            return {
                'Authorization': `Bearer ${token}`
            };
        }
        catch (error) {
            logger_1.Logger.error('認証ヘッダー取得中にエラーが発生しました:', error);
            return null;
        }
    }
    /**
     * 権限チェック
     * @param requiredRole 必要な権限（'user'または'admin'）
     */
    hasPermission(requiredRole) {
        if (!this._isAuthenticated || !this._currentUser) {
            return false;
        }
        // 管理者は全ての権限を持つ
        if (this._currentUser.role === 'admin') {
            return true;
        }
        // ユーザー権限のチェック
        return this._currentUser.role === requiredRole;
    }
    /**
     * 権限（パーミッション）チェック
     */
    hasPermissions(requiredPermissions) {
        if (!this._isAuthenticated || !this._currentUser) {
            return false;
        }
        // 管理者は全ての権限を持つ
        if (this._currentUser.role === 'admin') {
            return true;
        }
        // ユーザーの権限リストをチェック
        const userPermissions = this._currentUser.permissions || [];
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }
    /**
     * 最後のエラーを設定
     */
    _setLastError(error) {
        this._lastError = error;
        logger_1.Logger.error(`認証エラー: [${error.code}] ${error.message}`);
    }
    /**
     * リソースへのクリーンアップ
     */
    dispose() {
        this._stopAuthCheckInterval();
        if (this._statusBarItem) {
            this._statusBarItem.dispose();
        }
        this._onAuthStateChanged.dispose();
    }
}
exports.AuthenticationService = AuthenticationService;
//# sourceMappingURL=AuthenticationService.js.map