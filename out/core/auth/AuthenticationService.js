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
exports.AuthenticationService = exports.AuthEventType = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const TokenManager_1 = require("./TokenManager");
const logger_1 = require("../../utils/logger");
const roles_1 = require("./roles");
const AuthState_1 = require("./AuthState");
const AuthStorageManager_1 = require("../../utils/AuthStorageManager");
/**
 * 認証イベントの型
 */
var AuthEventType;
(function (AuthEventType) {
    AuthEventType["STATE_CHANGED"] = "state_changed";
    AuthEventType["LOGIN_SUCCESS"] = "login_success";
    AuthEventType["LOGIN_FAILED"] = "login_failed";
    AuthEventType["LOGOUT"] = "logout";
    AuthEventType["TOKEN_REFRESHED"] = "token_refreshed";
})(AuthEventType || (exports.AuthEventType = AuthEventType = {}));
/**
 * AuthenticationService - 認証状態を一元管理するサービス
 *
 * ユーザーの認証状態を管理し、認証関連のイベントを発行します。
 * このクラスはVSCodeのEventEmitterを使用して、状態変更を通知します。
 */
class AuthenticationService {
    /**
     * コンストラクタ
     */
    constructor(context) {
        this._lastError = null;
        this._authCheckInterval = null;
        // イベントエミッター
        this._onStateChanged = new vscode.EventEmitter();
        this._onLoginSuccess = new vscode.EventEmitter();
        this._onLoginFailed = new vscode.EventEmitter();
        this._onLogout = new vscode.EventEmitter();
        this._onTokenRefreshed = new vscode.EventEmitter();
        // 公開イベント
        this.onStateChanged = this._onStateChanged.event;
        this.onLoginSuccess = this._onLoginSuccess.event;
        this.onLoginFailed = this._onLoginFailed.event;
        this.onLogout = this._onLogout.event;
        this.onTokenRefreshed = this._onTokenRefreshed.event;
        this._tokenManager = TokenManager_1.TokenManager.getInstance(context);
        this._storageManager = AuthStorageManager_1.AuthStorageManager.getInstance(context);
        this._currentState = AuthState_1.AuthStateBuilder.guest().build();
        this._initialize();
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance(context) {
        if (!AuthenticationService.instance) {
            if (!context) {
                throw new Error('AuthenticationServiceの初期化時にはExtensionContextが必要です');
            }
            AuthenticationService.instance = new AuthenticationService(context);
        }
        return AuthenticationService.instance;
    }
    /**
     * 初期化処理
     */
    async _initialize() {
        try {
            logger_1.Logger.info('認証サービスの初期化を開始');
            // 保存されているトークンを確認
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                logger_1.Logger.info('保存されたトークンがありません。未認証状態で初期化します');
                return;
            }
            logger_1.Logger.info('保存されたトークンを確認しています');
            // トークンの有効期限をチェック
            const isValid = await this._tokenManager.isTokenValid();
            if (!isValid) {
                logger_1.Logger.info('トークンの有効期限が切れています。リフレッシュを試みます');
                const refreshed = await this.refreshToken(true); // 静かに失敗するオプションを設定
                if (!refreshed) {
                    logger_1.Logger.warn('トークンのリフレッシュに失敗しました');
                    // トークンをクリアせずに続行（次回起動時にも再試行できるように）
                    return;
                }
            }
            try {
                // ユーザー情報を取得
                logger_1.Logger.info('ユーザー情報を取得します');
                await this._fetchUserInfo();
                // 権限チェックインターバルを開始
                this._startAuthCheckInterval();
                logger_1.Logger.info('認証サービスの初期化が完了しました');
            }
            catch (fetchError) {
                logger_1.Logger.error('ユーザー情報の取得中にエラーが発生しました', fetchError);
                // サーバーエラーの場合、ローカルデータでフォールバック
                if (axios_1.default.isAxiosError(fetchError) && fetchError.response?.status === 500) {
                    logger_1.Logger.info('サーバーエラーが発生しました。ローカルデータを使用して認証を試みます');
                    const recoverySuccess = await this._recoverUserState();
                    if (recoverySuccess) {
                        logger_1.Logger.info('ローカルデータによる認証状態の回復に成功しました');
                    }
                    else {
                        logger_1.Logger.warn('ローカルデータによる認証状態の回復に失敗しました。機能が制限される場合があります');
                    }
                }
                // エラーが発生しても、権限チェックは開始する（次回の自動チェックでリカバリー可能にする）
                this._startAuthCheckInterval();
                logger_1.Logger.info('認証サービスの初期化が完了しました（一部エラーあり）');
            }
        }
        catch (error) {
            logger_1.Logger.error('認証サービスの初期化中にエラーが発生しました', error);
            // 致命的なエラーでも基本的な機能は提供できるようにする
            this._startAuthCheckInterval();
        }
    }
    /**
     * ユーザーログイン
     */
    async login(email, password) {
        try {
            logger_1.Logger.info('ログイン処理を開始します');
            // 環境変数から認証APIのエンドポイントを取得
            const apiUrl = this._getAuthApiUrl();
            const clientId = this._getClientId();
            const clientSecret = this._getClientSecret();
            if (!clientId || !clientSecret) {
                this._setLastError({
                    code: 'missing_credentials',
                    message: 'クライアントID/シークレットが設定されていません'
                });
                return false;
            }
            // 認証APIを呼び出し
            const response = await axios_1.default.post(`${apiUrl}/auth/login`, {
                email,
                password,
                clientId,
                clientSecret
            }, {
                timeout: 10000
            });
            if (response.status === 200 && response.data.accessToken && response.data.refreshToken) {
                // トークンの有効期限を取得
                const expiresIn = response.data.expiresIn || 86400;
                // トークンを保存
                await this._tokenManager.setAccessToken(response.data.accessToken, expiresIn);
                await this._tokenManager.setRefreshToken(response.data.refreshToken);
                // ユーザーデータを保存
                await this._storageManager.setUserData(response.data.user);
                // 認証状態を更新
                const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                    .setAuthenticated(true)
                    .setUserId(response.data.user.id)
                    .setUsername(response.data.user.name)
                    .setRole(this._mapUserRole(response.data.user.role))
                    .setPermissions(response.data.user.permissions || [])
                    .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
                    .build();
                // 状態を更新し、イベントを発行
                this._updateState(newState);
                // 認証チェックインターバルを開始
                this._startAuthCheckInterval();
                // ログイン成功イベントを発行
                this._onLoginSuccess.fire();
                logger_1.Logger.info(`ログインに成功しました: ${response.data.user.name}`);
                return true;
            }
            logger_1.Logger.warn('ログインに失敗しました: レスポンスが無効です');
            return false;
        }
        catch (error) {
            logger_1.Logger.error('ログイン中にエラーが発生しました', error);
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
                const authError = {
                    code: errorCode,
                    message: errorMessage,
                    statusCode
                };
                this._setLastError(authError);
                this._onLoginFailed.fire(authError);
            }
            else {
                const authError = {
                    code: 'unknown_error',
                    message: `ログイン中に予期しないエラーが発生しました: ${error.message}`
                };
                this._setLastError(authError);
                this._onLoginFailed.fire(authError);
            }
            return false;
        }
    }
    /**
     * ユーザーログアウト
     */
    async logout() {
        try {
            // ログアウトイベントをサーバーに送信（省略可能）
            const refreshToken = await this._tokenManager.getRefreshToken();
            const apiUrl = this._getAuthApiUrl();
            if (refreshToken) {
                try {
                    await axios_1.default.post(`${apiUrl}/auth/logout`, { refreshToken });
                }
                catch (error) {
                    logger_1.Logger.warn('サーバーへのログアウトリクエスト送信中にエラーが発生しました', error);
                }
            }
            // 認証チェックインターバルを停止
            this._stopAuthCheckInterval();
            // トークンを削除
            await this._tokenManager.clearTokens();
            // 認証状態をリセット
            const newState = AuthState_1.AuthStateBuilder.guest().build();
            this._updateState(newState);
            // ログアウトイベントを発行
            this._onLogout.fire();
            logger_1.Logger.info('ログアウトが完了しました');
        }
        catch (error) {
            logger_1.Logger.error('ログアウト中にエラーが発生しました', error);
        }
    }
    /**
     * トークンのリフレッシュ
     * @param {boolean} silentOnError - エラー時に静かに失敗するかどうか
     * @param {number} retryCount - リトライ回数（最大3回まで）
     */
    async refreshToken(silentOnError = false, retryCount = 0) {
        try {
            logger_1.Logger.info('トークンのリフレッシュを開始します');
            const refreshToken = await this._tokenManager.getRefreshToken();
            if (!refreshToken) {
                logger_1.Logger.warn('リフレッシュトークンが見つかりません');
                return false;
            }
            const apiUrl = this._getAuthApiUrl();
            const clientId = this._getClientId();
            const clientSecret = this._getClientSecret();
            logger_1.Logger.debug(`認証情報確認: リフレッシュトークン長=${refreshToken.length}, クライアントID=${clientId}`);
            // トークンリフレッシュAPIを呼び出し
            const response = await axios_1.default.post(`${apiUrl}/auth/refresh-token`, {
                refreshToken,
                clientId,
                clientSecret
            }, {
                // タイムアウト設定を追加
                timeout: 15000
            });
            if (response.status === 200 && response.data.accessToken) {
                // トークンの有効期限を取得
                const expiresIn = response.data.expiresIn || 86400;
                // 新しいアクセストークンを保存
                await this._tokenManager.setAccessToken(response.data.accessToken, expiresIn);
                // リフレッシュトークンも更新される場合は保存
                if (response.data.refreshToken) {
                    await this._tokenManager.setRefreshToken(response.data.refreshToken);
                }
                // 有効期限を更新
                const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                    .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
                    .build();
                this._updateState(newState);
                // トークンリフレッシュイベントを発行
                this._onTokenRefreshed.fire();
                logger_1.Logger.info('トークンのリフレッシュに成功しました');
                return true;
            }
            logger_1.Logger.warn('トークンリフレッシュのレスポンスが無効です');
            return false;
        }
        catch (error) {
            logger_1.Logger.error('トークンリフレッシュ中にエラーが発生しました', error);
            // ネットワークエラーの場合はリトライを試みる（最大3回まで）
            if (axios_1.default.isAxiosError(error) && !error.response && retryCount < 3) {
                const retryDelayMs = 1000 * Math.pow(2, retryCount); // 指数バックオフ（1秒、2秒、4秒）
                logger_1.Logger.info(`ネットワークエラー発生。${retryDelayMs / 1000}秒後にリトライします (${retryCount + 1}/3)`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                return this.refreshToken(silentOnError, retryCount + 1);
            }
            // トークンが無効な場合はログアウト
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                logger_1.Logger.warn('リフレッシュトークンが無効です。ログアウトします');
                // silentOnErrorがtrueの場合、静かにログアウト処理を行う
                if (!silentOnError) {
                    await this.logout();
                }
                else {
                    // 静かにトークンをクリアするだけ
                    await this._tokenManager.clearTokens();
                    const newState = AuthState_1.AuthStateBuilder.guest().build();
                    this._updateState(newState);
                }
            }
            // サーバーエラー（500）が発生した場合は、現在のトークンの有効性をチェック
            else if (axios_1.default.isAxiosError(error) && error.response?.status === 500) {
                logger_1.Logger.warn('トークンリフレッシュ中にサーバーエラーが発生しました。現在のトークンの有効性をチェックします');
                // サーバーエラーの原因がアカウント無効化の場合
                if (error.response?.data?.error?.details === 'アカウントが無効化されています') {
                    logger_1.Logger.warn('アカウントが無効化されています。ログアウトします');
                    if (!silentOnError) {
                        await this.logout();
                        vscode.window.showErrorMessage('アカウントが無効化されています。管理者にお問い合わせください。');
                    }
                    else {
                        // 静かにトークンをクリアするだけ
                        await this._tokenManager.clearTokens();
                        const newState = AuthState_1.AuthStateBuilder.guest().build();
                        this._updateState(newState);
                    }
                    return false;
                }
                try {
                    // 現在のトークンの有効期限をチェック
                    const isValid = await this._tokenManager.isTokenValid();
                    if (isValid) {
                        logger_1.Logger.info('現在のトークンはまだ有効です。リフレッシュを中断して現在のトークンを使用します');
                        // ユーザー情報を取得して認証状態を回復
                        const recovered = await this._recoverUserState();
                        // 回復に成功した場合
                        if (recovered) {
                            // サーバーエラーでも認証状態を維持
                            return true;
                        }
                        else {
                            logger_1.Logger.warn('認証状態の回復に失敗しました');
                        }
                    }
                    else {
                        logger_1.Logger.warn('現在のトークンも有効期限切れです。リフレッシュに失敗しました');
                        if (!silentOnError) {
                            // エラーメッセージを表示
                            vscode.window.showWarningMessage('認証サーバーとの通信でエラーが発生しました。一部機能が制限される場合があります');
                        }
                    }
                }
                catch (validationError) {
                    logger_1.Logger.error('トークン検証中にエラーが発生しました', validationError);
                }
            }
            return false;
        }
    }
    /**
     * ユーザー情報を取得
     * @param retryCount リトライ回数
     */
    async _fetchUserInfo(retryCount = 0) {
        try {
            logger_1.Logger.info('ユーザー情報の取得を開始します');
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                logger_1.Logger.warn('アクセストークンが見つかりません');
                return;
            }
            const apiUrl = this._getAuthApiUrl();
            // ユーザー情報取得APIを呼び出し - 正しいパスを使用（/auth/users/me）
            const response = await axios_1.default.get(`${apiUrl}/auth/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                // タイムアウト設定を追加
                timeout: 10000
            });
            if (response.status === 200 && response.data.user) {
                // ユーザーデータを保存
                await this._storageManager.setUserData(response.data.user);
                // 認証状態を更新
                const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                    .setAuthenticated(true)
                    .setUserId(response.data.user.id)
                    .setUsername(response.data.user.name)
                    .setRole(this._mapUserRole(response.data.user.role))
                    .setPermissions(response.data.user.permissions || [])
                    .build();
                this._updateState(newState);
                logger_1.Logger.info(`ユーザー情報を取得しました: ${response.data.user.name}`);
            }
            else {
                logger_1.Logger.warn('ユーザー情報の取得に失敗しました: レスポンスが無効です');
                await this._tryFallbackAuthentication();
            }
        }
        catch (error) {
            logger_1.Logger.error('ユーザー情報取得中にエラーが発生しました', error);
            // トークンが無効な場合はリフレッシュを試みる
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                logger_1.Logger.info('アクセストークンが無効です。リフレッシュを試みます');
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    logger_1.Logger.info('トークンリフレッシュに成功しました。ユーザー情報を再取得します');
                    await this._fetchUserInfo();
                }
                else {
                    logger_1.Logger.warn('トークンリフレッシュに失敗しました。ログアウトします');
                    await this.logout();
                }
            }
            // サーバーエラーの場合、一定回数リトライ
            else if (axios_1.default.isAxiosError(error) && error.response?.status === 500 && retryCount < 3) {
                logger_1.Logger.info(`サーバーエラーが発生しました。リトライします (${retryCount + 1}/3)`);
                // 指数バックオフでリトライ（1秒、2秒、4秒）
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                return this._fetchUserInfo(retryCount + 1);
            }
            // すべてのリトライが失敗、または他のエラーの場合はフォールバック認証を試みる
            else {
                logger_1.Logger.info('サーバーとの通信に失敗しました。ローカルデータを使用して認証状態を維持します');
                await this._tryFallbackAuthentication();
            }
        }
    }
    /**
     * サーバー接続エラー時に、ローカルに保存されたユーザーデータを使用した認証フォールバック
     * このメソッドは、サーバーエラーが発生した場合でも、ユーザーがローカルで作業を継続できるようにします
     */
    async _tryFallbackAuthentication() {
        try {
            logger_1.Logger.info('フォールバック認証を試みます: ローカルに保存されたユーザー情報を確認');
            // トークンの存在を確認（最低限の認証チェック）
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                logger_1.Logger.warn('フォールバック認証: アクセストークンが見つかりません');
                return false;
            }
            // ローカルに保存されたユーザーデータを取得
            const userData = await this._storageManager.getUserData();
            if (!userData) {
                logger_1.Logger.warn('フォールバック認証: 保存されたユーザーデータが見つかりません');
                return false;
            }
            logger_1.Logger.info(`フォールバック認証: ローカルユーザーデータを使用します (${userData.name})`);
            // 認証状態を更新（ローカルデータを使用）
            const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                .setAuthenticated(true)
                .setUserId(userData.id)
                .setUsername(userData.name)
                .setRole(this._mapUserRole(userData.role))
                .setPermissions(userData.permissions || [])
                .build();
            this._updateState(newState);
            logger_1.Logger.info(`フォールバック認証に成功しました: ${userData.name} (${this._mapUserRole(userData.role)})`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error('フォールバック認証に失敗しました', error);
            return false;
        }
    }
    /**
     * 認証状態を更新し、変更があればイベントを発行
     */
    _updateState(newState) {
        // 状態の変更点を確認
        const changes = (0, AuthState_1.compareAuthStates)(this._currentState, newState);
        if (changes.length > 0) {
            // 変更があった場合、状態を更新してイベントを発行
            this._currentState = newState;
            // 変更内容をログに出力
            logger_1.Logger.info(`認証状態が変更されました: ${changes.join(', ')}`);
            // 状態変更イベントを発行
            this._onStateChanged.fire(newState);
        }
    }
    /**
     * 認証チェックインターバルを開始
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
                // トークンの有効期限をチェック
                const isValid = await this._tokenManager.isTokenValid();
                if (!isValid) {
                    logger_1.Logger.info('トークンの有効期限が近づいているか、期限切れです。リフレッシュを試みます');
                    // トークンリフレッシュを試みる
                    const refreshed = await this.refreshToken();
                    if (!refreshed) {
                        logger_1.Logger.warn('トークンのリフレッシュに失敗しました。ログアウトします');
                        await this.logout();
                    }
                }
            }
            catch (error) {
                logger_1.Logger.error('認証チェック中にエラーが発生しました', error);
            }
        }, checkIntervalSeconds * 1000);
        logger_1.Logger.info(`認証チェックインターバルを開始しました（${checkIntervalSeconds}秒間隔）`);
    }
    /**
     * 認証チェックインターバルを停止
     */
    _stopAuthCheckInterval() {
        if (this._authCheckInterval) {
            clearInterval(this._authCheckInterval);
            this._authCheckInterval = null;
            logger_1.Logger.info('認証チェックインターバルを停止しました');
        }
    }
    /**
     * APIのエンドポイントURL取得
     */
    _getAuthApiUrl() {
        return 'https://geniemon-portal-backend-production.up.railway.app/api';
    }
    /**
     * クライアントID取得
     */
    _getClientId() {
        return 'appgenius_vscode_client_29a7fb3e';
    }
    /**
     * クライアントシークレット取得
     * 本番環境と一致する値
     */
    _getClientSecret() {
        return 'appgenius_refresh_token_secret_key_for_production';
    }
    /**
     * ユーザーロールのマッピング
     */
    _mapUserRole(roleStr) {
        if (!roleStr) {
            return roles_1.Role.GUEST;
        }
        switch (roleStr) {
            case 'admin':
                return roles_1.Role.ADMIN;
            case 'user':
                return roles_1.Role.USER;
            default:
                return roles_1.Role.GUEST;
        }
    }
    /**
     * エラー情報を設定
     */
    _setLastError(error) {
        this._lastError = error;
        logger_1.Logger.error(`認証エラー: [${error.code}] ${error.message}`);
    }
    /**
     * 現在の認証状態を取得
     */
    getCurrentState() {
        return { ...this._currentState };
    }
    /**
     * 現在のユーザー情報を取得
     */
    getCurrentUser() {
        if (!this._currentState.isAuthenticated) {
            return null;
        }
        return {
            id: this._currentState.userId,
            name: this._currentState.username,
            role: this._currentState.role
        };
    }
    /**
     * 認証ヘッダーを取得
     */
    async getAuthHeader() {
        const token = await this._tokenManager.getAccessToken();
        if (!token) {
            return undefined;
        }
        return {
            'Authorization': `Bearer ${token}`
        };
    }
    /**
     * 認証状態変更通知の別名（互換性維持のため）
     */
    get onAuthStateChanged() {
        return this.onStateChanged;
    }
    /**
     * ユーザー情報を取得するAPI呼び出し
     */
    async getUserInfo() {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                throw new Error('認証されていません');
            }
            const apiUrl = this._getAuthApiUrl();
            const response = await axios_1.default.get(`${apiUrl}/auth/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data.user;
        }
        catch (error) {
            logger_1.Logger.error('ユーザー情報の取得に失敗しました', error);
            throw error;
        }
    }
    /**
     * ユーザープロファイルを更新
     */
    async updateProfile(profileData) {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                throw new Error('認証されていません');
            }
            const apiUrl = this._getAuthApiUrl();
            const response = await axios_1.default.put(`${apiUrl}/users/profile`, profileData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 200) {
                // ユーザー情報を再取得して状態を更新
                await this._fetchUserInfo();
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.Logger.error('プロファイル更新に失敗しました', error);
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
                throw new Error('認証されていません');
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
            logger_1.Logger.error('パスワード変更に失敗しました', error);
            return false;
        }
    }
    /**
     * ローカルに保存されたユーザー情報を使用して認証状態を回復する
     * サーバーエラーやネットワーク接続問題などでAPIにアクセスできない場合のフォールバックとして使用
     */
    async _recoverUserState() {
        try {
            logger_1.Logger.info('ローカルデータを使用して認証状態を回復します');
            // ローカルに保存されたユーザーデータを取得
            const userData = await this._storageManager.getUserData();
            if (!userData) {
                logger_1.Logger.warn('ローカルに保存されたユーザーデータが見つかりません');
                return false;
            }
            // トークンの存在を確認
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                logger_1.Logger.warn('アクセストークンが見つかりません');
                return false;
            }
            // 認証状態を更新（ローカルデータを使用）
            const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                .setAuthenticated(true)
                .setUserId(userData.id)
                .setUsername(userData.name)
                .setRole(this._mapUserRole(userData.role))
                .setPermissions(userData.permissions || [])
                .build();
            this._updateState(newState);
            logger_1.Logger.info(`認証状態を回復しました: ${userData.name} (${this._mapUserRole(userData.role)})`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error('認証状態の回復に失敗しました', error);
            return false;
        }
    }
    /**
     * 最後のエラーを取得
     */
    getLastError() {
        return this._lastError ? { ...this._lastError } : null;
    }
    /**
     * 現在認証済みかどうかを確認
     */
    isAuthenticated() {
        return this._currentState.isAuthenticated;
    }
    /**
     * リソースの解放
     */
    dispose() {
        this._stopAuthCheckInterval();
        this._onStateChanged.dispose();
        this._onLoginSuccess.dispose();
        this._onLoginFailed.dispose();
        this._onLogout.dispose();
        this._onTokenRefreshed.dispose();
    }
}
exports.AuthenticationService = AuthenticationService;
//# sourceMappingURL=AuthenticationService.js.map