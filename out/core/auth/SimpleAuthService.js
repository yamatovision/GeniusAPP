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
exports.SimpleAuthService = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
const roles_1 = require("./roles");
const AuthState_1 = require("./AuthState");
/**
 * SimpleAuthService - シンプルな認証サービス
 *
 * 分離認証モードの複雑さを排除し、直接的なトークン管理を行います。
 * 簡素化された設計により、認証の信頼性と安定性を向上させます。
 */
class SimpleAuthService {
    /**
     * コンストラクタ
     */
    constructor(context) {
        // APIベースURL
        this.API_BASE_URL = 'http://localhost:3001/simple';
        // ストレージキー
        this.ACCESS_TOKEN_KEY = 'appgenius.simple.accessToken';
        this.REFRESH_TOKEN_KEY = 'appgenius.simple.refreshToken';
        this.TOKEN_EXPIRY_KEY = 'appgenius.simple.tokenExpiry';
        this.USER_DATA_KEY = 'appgenius.simple.userData';
        this.API_KEY_DATA_KEY = 'appgenius.simple.apiKey';
        // イベントエミッター
        this._onStateChanged = new vscode.EventEmitter();
        this._onLoginSuccess = new vscode.EventEmitter();
        this._onLoginFailed = new vscode.EventEmitter();
        this._onLogout = new vscode.EventEmitter();
        // 公開イベント
        this.onStateChanged = this._onStateChanged.event;
        this.onLoginSuccess = this._onLoginSuccess.event;
        this.onLoginFailed = this._onLoginFailed.event;
        this.onLogout = this._onLogout.event;
        this.secretStorage = context.secrets;
        this._currentState = AuthState_1.AuthStateBuilder.guest().build();
        // 初期化
        this._initialize();
    }
    /**
     * シングルトンインスタンスの取得
     */
    static getInstance(context) {
        if (!SimpleAuthService.instance) {
            if (!context) {
                throw new Error('SimpleAuthServiceの初期化時にはExtensionContextが必要です');
            }
            SimpleAuthService.instance = new SimpleAuthService(context);
        }
        return SimpleAuthService.instance;
    }
    /**
     * 初期化処理
     */
    async _initialize() {
        try {
            logger_1.Logger.info('SimpleAuthService: 初期化開始');
            // 保存されているトークンを読み込み
            await this._loadTokens();
            // 認証状態復元
            if (this._accessToken) {
                await this._verifyAndRestoreSession();
            }
            logger_1.Logger.info('SimpleAuthService: 初期化完了');
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: 初期化エラー', error);
        }
    }
    /**
     * トークンをロード
     */
    async _loadTokens() {
        try {
            logger_1.Logger.info('SimpleAuthService: トークンロード開始');
            // アクセストークン取得
            this._accessToken = await this.secretStorage.get(this.ACCESS_TOKEN_KEY) || undefined;
            // リフレッシュトークン取得
            this._refreshToken = await this.secretStorage.get(this.REFRESH_TOKEN_KEY) || undefined;
            // トークン有効期限取得
            const expiryStr = await this.secretStorage.get(this.TOKEN_EXPIRY_KEY);
            this._tokenExpiry = expiryStr ? parseInt(expiryStr, 10) : undefined;
            // APIキー取得
            this._apiKey = await this.secretStorage.get(this.API_KEY_DATA_KEY) || undefined;
            if (this._accessToken) {
                logger_1.Logger.info('SimpleAuthService: トークンロード成功');
            }
            else {
                logger_1.Logger.info('SimpleAuthService: 保存済みトークンなし');
            }
            if (this._apiKey) {
                logger_1.Logger.info('SimpleAuthService: APIキーロード成功');
            }
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: トークンロードエラー', error);
        }
    }
    /**
     * トークンを保存
     */
    async _saveTokens(accessToken, refreshToken, expiryInSeconds) {
        try {
            logger_1.Logger.info('SimpleAuthService: トークン保存開始');
            // メモリに保存
            this._accessToken = accessToken;
            this._refreshToken = refreshToken;
            this._tokenExpiry = Date.now() + (expiryInSeconds * 1000);
            // セキュアストレージに保存
            await this.secretStorage.store(this.ACCESS_TOKEN_KEY, accessToken);
            await this.secretStorage.store(this.REFRESH_TOKEN_KEY, refreshToken);
            await this.secretStorage.store(this.TOKEN_EXPIRY_KEY, this._tokenExpiry.toString());
            logger_1.Logger.info('SimpleAuthService: トークン保存完了');
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: トークン保存エラー', error);
            throw error;
        }
    }
    /**
     * トークンをクリア
     */
    async _clearTokens() {
        try {
            logger_1.Logger.info('SimpleAuthService: トークンクリア開始');
            // メモリから削除
            this._accessToken = undefined;
            this._refreshToken = undefined;
            this._tokenExpiry = undefined;
            this._apiKey = undefined;
            // セキュアストレージから削除
            await this.secretStorage.delete(this.ACCESS_TOKEN_KEY);
            await this.secretStorage.delete(this.REFRESH_TOKEN_KEY);
            await this.secretStorage.delete(this.TOKEN_EXPIRY_KEY);
            await this.secretStorage.delete(this.USER_DATA_KEY);
            await this.secretStorage.delete(this.API_KEY_DATA_KEY);
            logger_1.Logger.info('SimpleAuthService: トークンクリア完了');
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: トークンクリアエラー', error);
        }
    }
    /**
     * 認証状態更新
     */
    _updateAuthState(newState) {
        const oldState = this._currentState;
        this._currentState = newState;
        // 状態変更を通知
        this._onStateChanged.fire(newState);
        // 状態を詳細ログ出力
        logger_1.Logger.info(`SimpleAuthService: 認証状態更新 [${oldState.isAuthenticated} => ${newState.isAuthenticated}]`);
    }
    /**
     * セッション復元
     */
    async _verifyAndRestoreSession() {
        try {
            logger_1.Logger.info('SimpleAuthService: セッション復元開始');
            if (!this._accessToken) {
                logger_1.Logger.info('SimpleAuthService: アクセストークンなし');
                return false;
            }
            // トークン有効期限チェック
            if (this._tokenExpiry && this._tokenExpiry < Date.now()) {
                logger_1.Logger.info('SimpleAuthService: トークン期限切れ、リフレッシュ試行');
                const refreshed = await this._refreshAccessToken();
                if (!refreshed) {
                    logger_1.Logger.info('SimpleAuthService: リフレッシュ失敗');
                    await this._clearTokens();
                    this._updateAuthState(AuthState_1.AuthStateBuilder.guest().build());
                    return false;
                }
            }
            // トークン検証と現在のユーザー情報取得
            const userInfo = await this._fetchUserInfo();
            if (!userInfo) {
                logger_1.Logger.info('SimpleAuthService: ユーザー情報取得失敗');
                await this._clearTokens();
                this._updateAuthState(AuthState_1.AuthStateBuilder.guest().build());
                return false;
            }
            // ユーザー情報を認証状態に反映
            const roleEnum = this._mapStringToRole(userInfo.role);
            const newState = new AuthState_1.AuthStateBuilder()
                .setAuthenticated(true)
                .setUserId(userInfo.id)
                .setUsername(userInfo.name)
                .setRole(roleEnum)
                .setPermissions(userInfo.permissions || [])
                .setExpiresAt(this._tokenExpiry)
                .build();
            // 認証状態更新
            this._updateAuthState(newState);
            logger_1.Logger.info('SimpleAuthService: セッション復元完了', userInfo.name);
            return true;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: セッション復元エラー', error);
            await this._clearTokens();
            this._updateAuthState(AuthState_1.AuthStateBuilder.guest().build());
            return false;
        }
    }
    /**
     * サーバーからユーザー情報取得
     */
    async _fetchUserInfo() {
        try {
            logger_1.Logger.info('SimpleAuthService: ユーザー情報取得開始');
            if (!this._accessToken) {
                logger_1.Logger.info('SimpleAuthService: アクセストークンなし');
                return null;
            }
            // APIリクエスト
            const response = await axios_1.default.get(`${this.API_BASE_URL}/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data && response.data.success) {
                logger_1.Logger.info('SimpleAuthService: ユーザー情報取得成功');
                // ユーザーデータをセキュアストレージに保存（キャッシュ）
                await this.secretStorage.store(this.USER_DATA_KEY, JSON.stringify(response.data.data));
                // APIキーが含まれている場合は保存
                if (response.data.data.apiKey) {
                    this._apiKey = response.data.data.apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                    logger_1.Logger.info('SimpleAuthService: APIキーを保存しました');
                }
                return response.data.data;
            }
            logger_1.Logger.info('SimpleAuthService: ユーザー情報取得失敗', response.data);
            return null;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: ユーザー情報取得エラー', error?.response?.data || error);
            // トークン切れや認証エラーの場合
            if (error?.response?.status === 401) {
                logger_1.Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
                const refreshed = await this._refreshAccessToken();
                if (refreshed) {
                    // リフレッシュ成功、再度ユーザー情報取得
                    return this._fetchUserInfo();
                }
            }
            return null;
        }
    }
    /**
     * アクセストークンをリフレッシュ
     */
    async _refreshAccessToken() {
        try {
            logger_1.Logger.info('SimpleAuthService: トークンリフレッシュ開始');
            if (!this._refreshToken) {
                logger_1.Logger.info('SimpleAuthService: リフレッシュトークンなし');
                return false;
            }
            // APIリクエスト
            const response = await axios_1.default.post(`${this.API_BASE_URL}/auth/refresh-token`, {
                refreshToken: this._refreshToken
            });
            if (response.data && response.data.success && response.data.data.accessToken) {
                logger_1.Logger.info('SimpleAuthService: トークンリフレッシュ成功');
                // 新しいトークンを保存
                await this._saveTokens(response.data.data.accessToken, response.data.data.refreshToken || this._refreshToken, 
                // 有効期限の指定がなければ24時間（秒単位）
                86400);
                return true;
            }
            logger_1.Logger.info('SimpleAuthService: トークンリフレッシュ失敗', response.data);
            return false;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: トークンリフレッシュエラー', error);
            return false;
        }
    }
    /**
     * ロール文字列をEnum変換
     */
    _mapStringToRole(roleStr) {
        const roleMapping = {
            'user': roles_1.Role.USER,
            'admin': roles_1.Role.ADMIN,
            'super_admin': roles_1.Role.SUPER_ADMIN,
            'Admin': roles_1.Role.ADMIN,
            'SuperAdmin': roles_1.Role.SUPER_ADMIN,
            'User': roles_1.Role.USER
        };
        return roleMapping[roleStr] || roles_1.Role.GUEST;
    }
    /**
     * ログイン
     * @param email メールアドレス
     * @param password パスワード
     */
    async login(email, password) {
        try {
            logger_1.Logger.info('SimpleAuthService: ログイン開始');
            const response = await axios_1.default.post(`${this.API_BASE_URL}/auth/login`, {
                email,
                password
            });
            if (response.data && response.data.success && response.data.data.accessToken) {
                logger_1.Logger.info('SimpleAuthService: ログイン成功');
                // トークンを保存
                await this._saveTokens(response.data.data.accessToken, response.data.data.refreshToken, 
                // 有効期限の指定がなければ24時間（秒単位）
                86400);
                // ユーザー情報を取得して認証状態を更新
                await this._verifyAndRestoreSession();
                // ログイン成功イベント
                this._onLoginSuccess.fire();
                return true;
            }
            logger_1.Logger.info('SimpleAuthService: ログイン失敗', response.data);
            this._onLoginFailed.fire({ message: response.data.message || 'ログインに失敗しました' });
            return false;
        }
        catch (error) {
            const errorMessage = error?.response?.data?.message || '接続エラーが発生しました';
            logger_1.Logger.error('SimpleAuthService: ログインエラー', error);
            this._onLoginFailed.fire({ message: errorMessage });
            return false;
        }
    }
    /**
     * ログアウト
     */
    async logout() {
        try {
            logger_1.Logger.info('SimpleAuthService: ログアウト開始');
            if (this._refreshToken) {
                // APIリクエスト（エラーはキャッチするが処理継続）
                try {
                    await axios_1.default.post(`${this.API_BASE_URL}/auth/logout`, {
                        refreshToken: this._refreshToken
                    });
                    logger_1.Logger.info('SimpleAuthService: サーバーログアウト成功');
                }
                catch (apiError) {
                    logger_1.Logger.warn('SimpleAuthService: サーバーログアウトエラー', apiError);
                }
            }
            // トークンクリア
            await this._clearTokens();
            // 認証状態をゲストに変更
            this._updateAuthState(AuthState_1.AuthStateBuilder.guest().build());
            // ログアウトイベント
            this._onLogout.fire();
            logger_1.Logger.info('SimpleAuthService: ログアウト完了');
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: ログアウトエラー', error);
            // エラーが発生しても確実にログアウト状態にする
            await this._clearTokens();
            this._updateAuthState(AuthState_1.AuthStateBuilder.guest().build());
            this._onLogout.fire();
        }
    }
    /**
     * 認証ヘッダーを取得
     * APIリクエスト時に使用
     */
    getAuthHeader() {
        if (!this._accessToken) {
            return {};
        }
        return {
            'Authorization': `Bearer ${this._accessToken}`,
            'Content-Type': 'application/json'
        };
    }
    /**
     * 認証状態を取得
     */
    getCurrentState() {
        return this._currentState;
    }
    /**
     * 認証済みかチェック
     */
    isAuthenticated() {
        return this._currentState.isAuthenticated;
    }
    /**
     * アクセストークン取得
     * 内部利用専用
     */
    getAccessToken() {
        return this._accessToken;
    }
    /**
     * APIキー取得
     * ClaudeCode統合用
     */
    getApiKey() {
        return this._apiKey;
    }
    /**
     * 認証状態の検証
     * 必要に応じてトークンリフレッシュ
     */
    async verifyAuthState() {
        try {
            logger_1.Logger.info('SimpleAuthService: 認証状態検証開始');
            if (!this._accessToken) {
                logger_1.Logger.info('SimpleAuthService: アクセストークンなし');
                return false;
            }
            // トークン有効期限チェック
            if (this._tokenExpiry && this._tokenExpiry < Date.now()) {
                logger_1.Logger.info('SimpleAuthService: トークン期限切れ、リフレッシュ試行');
                const refreshed = await this._refreshAccessToken();
                if (!refreshed) {
                    logger_1.Logger.info('SimpleAuthService: リフレッシュ失敗');
                    return false;
                }
            }
            // サーバーと通信してトークン検証
            const verified = await this._verifyTokenWithServer();
            logger_1.Logger.info(`SimpleAuthService: トークン検証結果=${verified}`);
            return verified;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: 認証状態検証エラー', error);
            return false;
        }
    }
    /**
     * サーバーとの通信でトークン検証
     */
    async _verifyTokenWithServer() {
        try {
            logger_1.Logger.info('SimpleAuthService: サーバートークン検証開始');
            if (!this._accessToken) {
                logger_1.Logger.info('SimpleAuthService: アクセストークンなし');
                return false;
            }
            // APIリクエスト
            const response = await axios_1.default.get(`${this.API_BASE_URL}/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data && response.data.success) {
                logger_1.Logger.info('SimpleAuthService: サーバー検証成功');
                return true;
            }
            logger_1.Logger.info('SimpleAuthService: サーバー検証失敗', response.data);
            return false;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: サーバー検証エラー', error?.response?.data || error);
            // トークン切れや認証エラーの場合
            if (error?.response?.status === 401) {
                logger_1.Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
                return await this._refreshAccessToken();
            }
            return false;
        }
    }
}
exports.SimpleAuthService = SimpleAuthService;
//# sourceMappingURL=SimpleAuthService.js.map