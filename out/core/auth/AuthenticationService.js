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
        this._authModeInfo = null;
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
                    logger_1.Logger.warn('トークンのリフレッシュに失敗しました。認証が必要です');
                    // トークンをクリアし、未認証状態で初期化
                    await this._tokenManager.clearTokens();
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
                // サーバーエラーやネットワークエラーの場合、明確なエラーメッセージを表示
                if (axios_1.default.isAxiosError(fetchError)) {
                    if (fetchError.response?.status === 401) {
                        logger_1.Logger.warn('認証エラーが発生しました。再ログインが必要です');
                        // トークンをクリアし、未認証状態にする
                        await this._tokenManager.clearTokens();
                        const newState = AuthState_1.AuthStateBuilder.guest().build();
                        this._updateState(newState);
                        // ユーザーへの通知は初期化中は控えめに
                        return;
                    }
                    else if (fetchError.response?.status === 500) {
                        logger_1.Logger.warn('サーバーエラーが発生しました。しばらく経ってから再試行してください');
                        // ユーザーへの通知は初期化中は控えめに
                    }
                    else if (!fetchError.response) {
                        logger_1.Logger.warn('ネットワークエラーが発生しました。インターネット接続を確認してください');
                        // ユーザーへの通知は初期化中は控えめに
                    }
                }
                // 認証エラー以外の場合は、権限チェックは開始する（次回の自動チェックでリカバリー可能にする）
                this._startAuthCheckInterval();
                logger_1.Logger.info('認証サービスの初期化が完了しました（一部エラーあり）');
            }
        }
        catch (error) {
            logger_1.Logger.error('認証サービスの初期化中にエラーが発生しました', error);
            // 致命的なエラーでも認証状態の回復を試みる
            try {
                const recoverySuccess = await this._recoverUserState();
                if (recoverySuccess) {
                    logger_1.Logger.info('エラー発生後、ローカルデータによる認証状態の回復に成功しました');
                }
            }
            catch (recoveryError) {
                logger_1.Logger.error('認証状態の回復中にエラーが発生しました', recoveryError);
            }
            // 基本的な機能は提供できるようにする
            this._startAuthCheckInterval();
        }
    }
    /**
     * ユーザーログイン - SimpleAuth APIを使用
     */
    async login(email, password) {
        try {
            logger_1.Logger.info('SimpleAuthログイン処理を開始します');
            // 環境変数から認証APIのエンドポイントを取得 - SimpleAuthパスを使用
            const apiUrl = this._getAuthApiUrl();
            // SimpleAuth認証APIを呼び出し - /simple/auth/loginエンドポイントを使用
            const response = await axios_1.default.post(`${apiUrl}/simple/auth/login`, {
                email,
                password
            }, {
                timeout: 10000
            });
            if (response.status === 200 && response.data.success && response.data.data.accessToken) {
                // SimpleAuthレスポンスからデータを取得
                const responseData = response.data.data;
                // トークンの有効期限を取得 - 標準の1日を使用
                const expiresIn = 86400;
                // トークンを保存
                await this._tokenManager.setAccessToken(responseData.accessToken, expiresIn);
                await this._tokenManager.setRefreshToken(responseData.refreshToken);
                // ユーザーデータを保存
                await this._storageManager.setUserData(responseData.user);
                // 認証状態を更新
                const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                    .setAuthenticated(true)
                    .setUserId(responseData.user.id)
                    .setUsername(responseData.user.name)
                    .setRole(this._mapUserRole(responseData.user.role))
                    .setPermissions(responseData.user.permissions || [])
                    .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
                    .build();
                // 状態を更新し、イベントを発行
                this._updateState(newState);
                // 認証チェックインターバルを開始
                this._startAuthCheckInterval();
                // ログイン成功イベントを発行
                this._onLoginSuccess.fire();
                logger_1.Logger.info(`SimpleAuthログインに成功しました: ${responseData.user.name}`);
                return true;
            }
            logger_1.Logger.warn('SimpleAuthログインに失敗しました: レスポンスが無効です');
            return false;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthログイン中にエラーが発生しました', error);
            // エラー情報を設定
            if (axios_1.default.isAxiosError(error)) {
                const statusCode = error.response?.status;
                let errorMessage = '認証に失敗しました';
                let errorCode = 'login_failed';
                // SimpleAuthのエラーメッセージを取得
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                }
                // ステータスコードに応じたメッセージ
                else if (statusCode === 401) {
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
     * ユーザーログアウト - SimpleAuth APIを使用
     */
    async logout() {
        try {
            logger_1.Logger.info('SimpleAuthログアウト処理を開始します');
            // ログアウトイベントをサーバーに送信
            const refreshToken = await this._tokenManager.getRefreshToken();
            const apiUrl = this._getAuthApiUrl();
            if (refreshToken) {
                try {
                    // リフレッシュトークンが有効な形式であるか確認
                    const isValidToken = refreshToken.split('.').length === 3; // JWTの基本的な形式チェック
                    if (isValidToken) {
                        try {
                            // SimpleAuth ログアウトエンドポイントを使用
                            await axios_1.default.post(`${apiUrl}/simple/auth/logout`, { refreshToken }, {
                                timeout: 5000 // タイムアウトを5秒に設定
                            });
                            logger_1.Logger.info('SimpleAuthサーバーへのログアウトリクエストが成功しました');
                        }
                        catch (error) {
                            // エラーをログに記録するだけで、ログアウト処理は続行
                            if (axios_1.default.isAxiosError(error) && error.response?.status === 400) {
                                logger_1.Logger.warn('SimpleAuthサーバーへのログアウトリクエストが拒否されました（既にログアウト済みの可能性があります）');
                            }
                            else {
                                logger_1.Logger.warn('SimpleAuthサーバーへのログアウトリクエスト送信中にエラーが発生しました', error);
                            }
                        }
                    }
                    else {
                        logger_1.Logger.warn('無効な形式のリフレッシュトークンのため、サーバーへのログアウトリクエストをスキップします');
                    }
                }
                catch (error) {
                    // トークン形式チェックでエラーが発生した場合も、ログアウト処理は続行
                    logger_1.Logger.warn('SimpleAuthリフレッシュトークンの検証中にエラーが発生しました', error);
                }
            }
            else {
                logger_1.Logger.warn('リフレッシュトークンが見つからないため、サーバーへのログアウトリクエストをスキップします');
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
            logger_1.Logger.info('SimpleAuthログアウトが完了しました');
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthログアウト中にエラーが発生しました', error);
            // 致命的なエラーが発生しても、トークンと認証状態のクリアを試みる
            try {
                await this._tokenManager.clearTokens();
                const newState = AuthState_1.AuthStateBuilder.guest().build();
                this._updateState(newState);
                this._onLogout.fire();
                logger_1.Logger.info('エラー発生後、強制的にSimpleAuthログアウト処理を完了しました');
            }
            catch (clearError) {
                logger_1.Logger.error('強制SimpleAuthログアウト処理中にエラーが発生しました', clearError);
            }
        }
    }
    /**
     * トークンのリフレッシュ - SimpleAuth APIを使用
     * @param {boolean} silentOnError - エラー時に静かに失敗するかどうか
     * @param {number} retryCount - リトライ回数（最大3回まで）
     */
    async refreshToken(silentOnError = false, retryCount = 0) {
        try {
            logger_1.Logger.info('SimpleAuthトークンのリフレッシュを開始します');
            const refreshToken = await this._tokenManager.getRefreshToken();
            if (!refreshToken) {
                logger_1.Logger.warn('リフレッシュトークンが見つかりません');
                return false;
            }
            const apiUrl = this._getAuthApiUrl();
            logger_1.Logger.debug(`SimpleAuth認証情報確認: リフレッシュトークン長=${refreshToken.length}`);
            // SimpleAuth トークンリフレッシュAPIを呼び出し
            const response = await axios_1.default.post(`${apiUrl}/simple/auth/refresh-token`, {
                refreshToken
            }, {
                // タイムアウト設定を増やして信頼性を向上
                timeout: 30000
            });
            if (response.status === 200 && response.data.success && response.data.data) {
                // SimpleAuth APIからトークン情報を取得
                const responseData = response.data.data;
                // トークンの有効期限を取得 - 標準の1日を使用
                const expiresIn = 86400;
                // 新しいアクセストークンを保存
                await this._tokenManager.setAccessToken(responseData.accessToken, expiresIn);
                // 新しいリフレッシュトークンを保存
                logger_1.Logger.info('新しいリフレッシュトークンを保存します');
                await this._tokenManager.setRefreshToken(responseData.refreshToken);
                // 有効期限を更新
                const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                    .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
                    .build();
                this._updateState(newState);
                // トークンリフレッシュイベントを発行
                this._onTokenRefreshed.fire();
                logger_1.Logger.info(`SimpleAuthトークンのリフレッシュに成功しました（有効期限: ${new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toLocaleString()}）`);
                return true;
            }
            logger_1.Logger.warn('SimpleAuthトークンリフレッシュのレスポンスが無効です');
            return false;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthトークンリフレッシュ中にエラーが発生しました', error);
            // ネットワークエラーの場合はリトライを試みる（最大5回まで - 増加）
            if (axios_1.default.isAxiosError(error) && !error.response && retryCount < 5) {
                const retryDelayMs = 1000 * Math.pow(2, retryCount); // 指数バックオフ（1秒、2秒、4秒、8秒、16秒）
                logger_1.Logger.info(`ネットワークエラー発生。${retryDelayMs / 1000}秒後にリトライします (${retryCount + 1}/5)`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                return this.refreshToken(silentOnError, retryCount + 1);
            }
            // トークンが無効な場合は明示的にログアウトを要求する
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                // エラーレスポンスの詳細を分析
                const errorData = error.response.data;
                // アカウント無効化エラーの検出
                if (errorData?.message && errorData?.message.includes('無効')) {
                    logger_1.Logger.warn('アカウントが無効化されているか、永続的な認証エラーが発生しました');
                    logger_1.Logger.error('API Error Details:', errorData);
                    // ユーザーに明確な通知
                    if (!silentOnError) {
                        vscode.window.showErrorMessage('アカウントが無効化されています。詳細については管理者にお問い合わせください。', 'ログアウト').then(async (selection) => {
                            await this.logout(); // 選択に関わらずログアウト処理
                        });
                    }
                    else {
                        // 静かにトークンをクリアするだけ
                        await this._tokenManager.clearTokens();
                        const newState = AuthState_1.AuthStateBuilder.guest().build();
                        this._updateState(newState);
                        logger_1.Logger.info('アカウント無効化により認証状態をクリアしました');
                    }
                    return false;
                }
                // 通常の認証エラー
                logger_1.Logger.warn('リフレッシュトークンが無効です。ログアウトが必要です');
                // silentOnErrorがtrueの場合、サイレントに処理
                if (!silentOnError) {
                    // ユーザーに通知してからログアウト
                    vscode.window.showWarningMessage('ログインセッションの有効期限が切れました。再ログインしてください。', '再ログイン').then(async (selection) => {
                        if (selection === '再ログイン') {
                            // ログアウト後、ログイン画面を表示
                            await this.logout();
                            // ログイン画面表示のイベントを発行
                            vscode.commands.executeCommand('appgenius.showLogin');
                        }
                        else {
                            await this.logout();
                        }
                    });
                }
                else {
                    // 静かにトークンをクリアするだけ
                    await this._tokenManager.clearTokens();
                    const newState = AuthState_1.AuthStateBuilder.guest().build();
                    this._updateState(newState);
                    logger_1.Logger.info('認証トークンが無効です。ログアウトしました');
                }
            }
            // サーバーエラー（500）が発生した場合は、現在のトークンの有効性をチェック
            else if (axios_1.default.isAxiosError(error) && error.response?.status === 500) {
                logger_1.Logger.warn('トークンリフレッシュ中にサーバーエラーが発生しました。現在のトークンの有効性をチェックします');
                // エラーレスポンスの詳細を分析
                const errorData = error.response.data;
                // サーバーエラーの原因がアカウント無効化の場合
                if (errorData?.message && errorData?.message.includes('無効')) {
                    logger_1.Logger.warn('アカウントが無効化されています。ログアウトします');
                    logger_1.Logger.error('API Error Details:', errorData);
                    if (!silentOnError) {
                        await this.logout();
                        vscode.window.showErrorMessage('アカウントが無効化されています。管理者にお問い合わせください。');
                    }
                    else {
                        // 静かにトークンをクリアするだけ
                        await this._tokenManager.clearTokens();
                        const newState = AuthState_1.AuthStateBuilder.guest().build();
                        this._updateState(newState);
                        logger_1.Logger.info('アカウント無効化により認証状態をクリアしました');
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
                            // 5分後に再度リフレッシュを試みる
                            this._scheduleRefreshRetry(5 * 60 * 1000);
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
     * トークンリフレッシュのリトライをスケジュール
     * ネットワークエラーなどの一時的な問題から回復するため
     *
     * @param {number} delayMs - 再試行までの待機時間（ミリ秒）
     * @param {number} maxRetries - 最大リトライ回数
     * @param {number} currentRetry - 現在のリトライ回数
     */
    _scheduleRefreshRetry(delayMs, maxRetries = 5, currentRetry = 0) {
        setTimeout(async () => {
            try {
                // 現在のトークンが有効期限切れかどうかを確認
                const isValid = await this._tokenManager.isTokenValid();
                if (!isValid) {
                    logger_1.Logger.info(`スケジュールされたトークンリフレッシュを実行します (${currentRetry + 1}/${maxRetries})`);
                    const refreshed = await this.refreshToken(true);
                    // リフレッシュに失敗し、リトライ回数が残っている場合は再度スケジュール
                    if (!refreshed && currentRetry < maxRetries - 1) {
                        logger_1.Logger.info(`トークンリフレッシュに失敗しました。再試行をスケジュールします (${currentRetry + 2}/${maxRetries})`);
                        // 指数バックオフでリトライ間隔を増加（例: 5分、10分、20分...）
                        const nextDelay = delayMs * 2;
                        this._scheduleRefreshRetry(nextDelay, maxRetries, currentRetry + 1);
                    }
                    else if (!refreshed) {
                        logger_1.Logger.warn(`最大リトライ回数に達しました (${maxRetries}回)。リフレッシュ試行を終了します`);
                    }
                    else {
                        logger_1.Logger.info('トークンリフレッシュ成功');
                    }
                }
                else {
                    logger_1.Logger.info('トークンはまだ有効です。リフレッシュは不要です');
                }
            }
            catch (error) {
                logger_1.Logger.error('スケジュールされたトークンリフレッシュに失敗しました', error);
                // エラーが発生した場合も、リトライ回数が残っていれば再試行
                if (currentRetry < maxRetries - 1) {
                    logger_1.Logger.info(`エラーが発生しましたが、再試行をスケジュールします (${currentRetry + 2}/${maxRetries})`);
                    const nextDelay = delayMs * 2;
                    this._scheduleRefreshRetry(nextDelay, maxRetries, currentRetry + 1);
                }
            }
        }, delayMs);
    }
    /**
     * ユーザー情報を取得 - SimpleAuth APIを使用
     * @param retryCount リトライ回数
     */
    async _fetchUserInfo(retryCount = 0) {
        try {
            logger_1.Logger.info('SimpleAuth ユーザー情報の取得を開始します');
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                logger_1.Logger.warn('アクセストークンが見つかりません');
                return;
            }
            const apiUrl = this._getAuthApiUrl();
            // SimpleAuth ユーザー情報取得APIを呼び出し - SimpleAuth の認証チェックエンドポイントを使用
            const response = await axios_1.default.get(`${apiUrl}/simple/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                // タイムアウト設定を追加
                timeout: 10000
            });
            if (response.status === 200 && response.data.success && response.data.data?.user) {
                // SimpleAuth APIからのレスポンス形式でユーザーデータを取得
                const userData = response.data.data.user;
                // ユーザーデータを保存
                await this._storageManager.setUserData(userData);
                // 認証状態を更新
                const newState = AuthState_1.AuthStateBuilder.fromState(this._currentState)
                    .setAuthenticated(true)
                    .setUserId(userData.id)
                    .setUsername(userData.name)
                    .setRole(this._mapUserRole(userData.role))
                    .setPermissions(userData.permissions || [])
                    .build();
                this._updateState(newState);
                logger_1.Logger.info(`SimpleAuth ユーザー情報を取得しました: ${userData.name}`);
            }
            else {
                logger_1.Logger.warn('SimpleAuth ユーザー情報の取得に失敗しました: レスポンスが無効です');
                await this._tryFallbackAuthentication();
            }
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuth ユーザー情報取得中にエラーが発生しました', error);
            // トークンが無効な場合はリフレッシュを試みる
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                logger_1.Logger.info('SimpleAuth アクセストークンが無効です。リフレッシュを試みます');
                const refreshed = await this.refreshToken(true); // 静かに失敗するように変更
                if (refreshed) {
                    logger_1.Logger.info('SimpleAuth トークンリフレッシュに成功しました。ユーザー情報を再取得します');
                    await this._fetchUserInfo();
                }
                else {
                    logger_1.Logger.warn('SimpleAuth トークンリフレッシュに失敗しました。ローカルデータによるフォールバック認証を試みます');
                    // ローカルデータによるフォールバック認証を試みる
                    const fallbackSuccess = await this._tryFallbackAuthentication();
                    if (!fallbackSuccess) {
                        logger_1.Logger.warn('SimpleAuth フォールバック認証に失敗しました。認証状態は未認証になります');
                    }
                }
            }
            // サーバーエラーの場合、一定回数リトライ
            else if (axios_1.default.isAxiosError(error) && error.response?.status === 500 && retryCount < 3) {
                logger_1.Logger.info(`SimpleAuth サーバーエラーが発生しました。リトライします (${retryCount + 1}/3)`);
                // 指数バックオフでリトライ（1秒、2秒、4秒）
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                return this._fetchUserInfo(retryCount + 1);
            }
            // ネットワークエラーの場合も、リトライを試みる
            else if (axios_1.default.isAxiosError(error) && !error.response && retryCount < 3) {
                logger_1.Logger.info(`SimpleAuth ネットワークエラーが発生しました。リトライします (${retryCount + 1}/3)`);
                // 指数バックオフでリトライ（1秒、2秒、4秒）
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                return this._fetchUserInfo(retryCount + 1);
            }
            // すべてのリトライが失敗、または他のエラーの場合はフォールバック認証を試みる
            else {
                logger_1.Logger.info('SimpleAuth サーバーとの通信に失敗しました。ローカルデータを使用して認証状態を維持します');
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
     * トークンの有効期限をチェックし、必要に応じてリフレッシュを行う
     */
    _startAuthCheckInterval() {
        // 既存のインターバルがあれば停止
        this._stopAuthCheckInterval();
        // 環境変数からチェック間隔を取得（デフォルトは30分 - 延長）
        const checkIntervalSeconds = Math.min(parseInt(process.env.CHECK_INTERVAL || '1800', 10), 3600 // 最大1時間
        );
        // トークンの有効期限を事前に計算（予測値）
        let tokenExpiryTime = null;
        try {
            const state = this.getCurrentState();
            if (state.expiresAt) {
                tokenExpiryTime = state.expiresAt;
                const expiryDate = new Date(tokenExpiryTime * 1000);
                logger_1.Logger.info(`トークン有効期限の予測: ${expiryDate.toLocaleString()}`);
            }
        }
        catch (e) {
            logger_1.Logger.warn('トークン有効期限の予測に失敗しました', e);
        }
        // 定期的なトークン検証を設定
        this._authCheckInterval = setInterval(async () => {
            try {
                // 現在の時刻とトークン有効期限を比較（既知の場合）
                const now = Math.floor(Date.now() / 1000);
                // 有効期限が既知で、有効期限まで1時間以上ある場合はスキップ（最適化）
                if (tokenExpiryTime && tokenExpiryTime - now > 3600) {
                    logger_1.Logger.info(`トークン有効期限まで十分な時間があります (${Math.floor((tokenExpiryTime - now) / 3600)}時間以上)。チェックをスキップします`);
                    return;
                }
                // トークンの有効期限をチェック
                logger_1.Logger.info('トークン有効性チェックを実行します');
                const isValid = await this._tokenManager.isTokenValid();
                if (!isValid) {
                    logger_1.Logger.info('トークンの有効期限が近づいているか、期限切れです。リフレッシュを試みます');
                    // トークンリフレッシュを試みる
                    const refreshed = await this.refreshToken(true); // サイレントモード
                    if (refreshed) {
                        // 更新成功した場合、新しい有効期限を取得
                        const newState = this.getCurrentState();
                        tokenExpiryTime = newState.expiresAt || null;
                        if (tokenExpiryTime) {
                            const expiryDate = new Date(tokenExpiryTime * 1000);
                            logger_1.Logger.info(`トークンリフレッシュ成功。新しい有効期限: ${expiryDate.toLocaleString()}`);
                        }
                    }
                    else {
                        // 重要な操作時のみ自動ログアウト
                        logger_1.Logger.warn('トークンのリフレッシュに失敗しましたが、自動ログアウトは行いません。現在の認証状態を維持します');
                        // オフラインとして扱い、随時リトライ
                        this._recoverUserState();
                        // 1時間後に再試行
                        this._scheduleRefreshRetry(3600 * 1000);
                    }
                }
                else {
                    logger_1.Logger.info('トークンは有効です');
                }
            }
            catch (error) {
                logger_1.Logger.error('認証チェック中にエラーが発生しました', error);
                // エラーが発生しても完全失敗にせず、ローカルデータでの回復を試みる
                try {
                    await this._recoverUserState();
                }
                catch (recoveryError) {
                    logger_1.Logger.error('認証状態の回復に失敗しました', recoveryError);
                }
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
     * SimpleAuth のロール値を含むすべての可能なロール値に対応
     */
    _mapUserRole(roleStr) {
        if (!roleStr) {
            return roles_1.Role.GUEST;
        }
        // ロールが文字列でない場合の対策
        const role = String(roleStr).toLowerCase();
        // ログ出力 (デバッグ用)
        logger_1.Logger.debug(`ロールマッピング: 元の値="${roleStr}", 変換後="${role}"`);
        switch (role) {
            // 標準ロール
            case 'admin':
                return roles_1.Role.ADMIN;
            case 'user':
                return roles_1.Role.USER;
            case 'super_admin':
            case 'superadmin':
                return roles_1.Role.SUPER_ADMIN;
            // SimpleAuth 特有のロール (キャメルケースと大文字の両方に対応)
            case 'superadmin':
                return roles_1.Role.SUPER_ADMIN;
            // その他のロール値も適切に処理
            case 'unpaid':
            case 'unsubscribed':
                return roles_1.Role.USER; // 制限付きユーザーとして扱う
            default:
                // 文字列に"admin"が含まれるならADMIN、"super"ならSUPER_ADMIN
                if (role.includes('super') && role.includes('admin')) {
                    logger_1.Logger.info(`"super"と"admin"を含むロール "${roleStr}" をSUPER_ADMINとして処理します`);
                    return roles_1.Role.SUPER_ADMIN;
                }
                else if (role.includes('admin')) {
                    logger_1.Logger.info(`"admin"を含むロール "${roleStr}" をADMINとして処理します`);
                    return roles_1.Role.ADMIN;
                }
                else if (role.includes('user')) {
                    logger_1.Logger.info(`"user"を含むロール "${roleStr}" をUSERとして処理します`);
                    return roles_1.Role.USER;
                }
                logger_1.Logger.warn(`不明なロール「${roleStr}」をゲストとして処理します`);
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
     * ユーザー情報を取得するAPI呼び出し - SimpleAuth APIを使用
     */
    async getUserInfo() {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                throw new Error('認証されていません');
            }
            const apiUrl = this._getAuthApiUrl();
            const response = await axios_1.default.get(`${apiUrl}/simple/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 200 && response.data.success && response.data.data?.user) {
                return response.data.data.user;
            }
            else {
                throw new Error('ユーザー情報の取得に失敗しました: レスポンスが無効です');
            }
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuth ユーザー情報の取得に失敗しました', error);
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
            // APIサーバーへの接続確認を最初に行う
            try {
                const isValid = await this._verifyTokenWithServer();
                if (!isValid) {
                    // サーバー認証に失敗した場合は回復を中止
                    logger_1.Logger.warn('サーバー認証に失敗しました。認証回復を中止します');
                    return false;
                }
            }
            catch (apiError) {
                logger_1.Logger.warn('APIサーバーへの接続に失敗。認証回復を中止します');
                return false;
            }
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
     * SimpleAuth サーバーに対してトークンの有効性を確認
     * @returns トークンが有効な場合はtrue、それ以外はfalse
     */
    async _verifyTokenWithServer() {
        try {
            const token = await this._tokenManager.getAccessToken();
            if (!token) {
                logger_1.Logger.warn('_verifyTokenWithServer: SimpleAuth アクセストークンが見つかりません');
                return false;
            }
            const apiUrl = this._getAuthApiUrl();
            logger_1.Logger.info(`SimpleAuth トークン検証リクエスト実行: ${apiUrl}/simple/auth/check`);
            const response = await axios_1.default.get(`${apiUrl}/simple/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000 // タイムアウト設定を10秒に延長
            });
            const isValid = response.status === 200 && response.data.success && !!response.data.data?.user;
            logger_1.Logger.info(`SimpleAuth トークン検証結果: ${isValid ? '有効' : '無効'}, ステータス: ${response.status}, ユーザー情報: ${!!response.data.data?.user}`);
            return isValid;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    logger_1.Logger.warn('SimpleAuth トークンが無効です（401）');
                }
                else if (error.response) {
                    logger_1.Logger.error(`SimpleAuth サーバー接続確認中にエラーが発生しました: HTTP ${error.response.status} - ${error.response.statusText}`, error);
                }
                else {
                    logger_1.Logger.error(`SimpleAuth ネットワークエラーが発生しました: ${error.message}`, error);
                }
            }
            else {
                logger_1.Logger.error(`SimpleAuth サーバー接続確認中に予期しないエラーが発生しました: ${error.message}`, error);
            }
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
     * 認証モードの情報を取得
     * 認証モードの状態と詳細情報を返す
     * @deprecated 単一認証モデルに移行中のため非推奨
     */
    getAuthModeInfo() {
        // 単一認証モデルに移行中のため、常に分離認証モードが有効として単純化
        const info = {
            isIsolatedAuthEnabled: true,
            detectionMethod: 'simplified_model',
            authFilePath: this._getIsolatedAuthFilePath()
        };
        this._authModeInfo = info;
        return { ...info };
    }
    /**
     * 分離認証モードのファイルパスを取得
     */
    _getIsolatedAuthFilePath() {
        // 環境変数で明示的に指定されている場合はそれを使用
        if (process.env.CLAUDE_AUTH_FILE) {
            return process.env.CLAUDE_AUTH_FILE;
        }
        // OSに応じた標準的なパスを構築
        const homeDir = require('os').homedir();
        const fs = require('fs');
        const path = require('path');
        // 標準的な場所（.appgenius）を確認
        const dotAppGeniusDir = path.join(homeDir, '.appgenius');
        // ディレクトリが存在するか、作成可能な場合は.appgeniusを使用
        try {
            if (fs.existsSync(dotAppGeniusDir)) {
                return path.join(dotAppGeniusDir, 'auth.json');
            }
            // プラットフォーム固有のパス
            if (process.platform === 'win32') {
                // Windowsでの代替設定ディレクトリ
                const appDataDir = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
                return path.join(appDataDir, 'appgenius', 'auth.json');
            }
            else if (process.platform === 'darwin') {
                // macOSでの代替設定ディレクトリ
                return path.join(homeDir, 'Library', 'Application Support', 'appgenius', 'auth.json');
            }
            else {
                // Linux/Unixでの代替設定ディレクトリ
                const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
                return path.join(xdgConfigHome, 'appgenius', 'auth.json');
            }
        }
        catch (error) {
            // エラー発生時はホームディレクトリの.appgenius/auth.jsonをデフォルトとして返す
            logger_1.Logger.warn(`認証ファイルパス検出中にエラー発生: ${error.message}`);
            return path.join(homeDir, '.appgenius', 'auth.json');
        }
    }
    /**
     * 分離認証モードが有効かどうかを返す（シンプルな形式）
     * @deprecated 単一認証モデルに移行中のため非推奨
     * @returns 常にtrueを返す
     */
    isIsolatedAuthEnabled() {
        return true; // 常にtrueを返す（単一認証モデルに移行中）
    }
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