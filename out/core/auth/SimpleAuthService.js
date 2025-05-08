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
        this._needApiKeyRefresh = false; // APIキーのリフレッシュが必要かのフラグ
        // APIベースURL
        this.API_BASE_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/simple';
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
        // グローバル変数に保存（拡張機能全体で参照できるように）
        global._appgenius_simple_auth_service = this;
        // グローバル変数からトークン情報を確認（他インスタンスとの共有）
        if (!this._accessToken && global._appgenius_auth_token) {
            this._accessToken = global._appgenius_auth_token;
            logger_1.Logger.info('SimpleAuthService: グローバル変数からアクセストークンを復元しました');
        }
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
                const restored = await this._verifyAndRestoreSession();
                // 認証情報の不整合対策: トークンがあるのにセッション復元に失敗した場合
                if (!restored && this._accessToken) {
                    logger_1.Logger.warn('SimpleAuthService: トークンは存在するがセッション復元に失敗。暫定対応として認証済み状態に設定');
                    // 認証状態を最低限の情報で強制的に有効に設定
                    const newState = new AuthState_1.AuthStateBuilder()
                        .setAuthenticated(true)
                        .setUserId('unknown')
                        .setUsername('不明なユーザー')
                        .setRole(this._mapStringToRole('user'))
                        .setExpiresAt(this._tokenExpiry)
                        .build();
                    this._updateAuthState(newState);
                }
            }
            // 初期化後、認証状態をログに記録（デバッグ用）
            const isAuth = this._currentState.isAuthenticated;
            const userName = this._currentState.userData?.name || 'なし';
            const userId = this._currentState.userData?.id || 'なし';
            const userRole = this._currentState.userData?.role || 'なし';
            logger_1.Logger.info(`SimpleAuthService: 初期化完了 - 認証状態: ${isAuth ? '認証済み' : '未認証'}, ユーザー: ${userName}, ID: ${userId}, ロール: ${userRole}`);
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
            // アクセストークン取得 (詳細なデバッグ)
            try {
                this._accessToken = await this.secretStorage.get(this.ACCESS_TOKEN_KEY) || undefined;
                logger_1.Logger.debug(`SimpleAuthService: アクセストークン取得 - キー=${this.ACCESS_TOKEN_KEY}, 結果=${this._accessToken ? 'あり' : 'なし'}`);
                if (this._accessToken) {
                    logger_1.Logger.debug(`SimpleAuthService: トークンプレビュー = ${this._accessToken.substring(0, 10)}...`);
                }
                else {
                    // 古いキーでも試してみる (移行措置)
                    const legacyToken = await this.secretStorage.get('appgenius.accessToken');
                    if (legacyToken) {
                        logger_1.Logger.warn('SimpleAuthService: 古いキー形式でトークンが見つかりました。移行を実施します');
                        this._accessToken = legacyToken;
                        // 新しいキーに保存
                        await this.secretStorage.store(this.ACCESS_TOKEN_KEY, legacyToken);
                        logger_1.Logger.info('SimpleAuthService: トークンを新しいキー形式に移行しました');
                    }
                }
            }
            catch (tokenError) {
                logger_1.Logger.error('SimpleAuthService: アクセストークン取得エラー', tokenError);
            }
            // リフレッシュトークン取得
            try {
                this._refreshToken = await this.secretStorage.get(this.REFRESH_TOKEN_KEY) || undefined;
                logger_1.Logger.debug(`SimpleAuthService: リフレッシュトークン取得 - キー=${this.REFRESH_TOKEN_KEY}, 結果=${this._refreshToken ? 'あり' : 'なし'}`);
                // 古いキーでも試してみる (移行措置)
                if (!this._refreshToken) {
                    const legacyRefreshToken = await this.secretStorage.get('appgenius.refreshToken');
                    if (legacyRefreshToken) {
                        logger_1.Logger.warn('SimpleAuthService: 古いキー形式でリフレッシュトークンが見つかりました。移行を実施します');
                        this._refreshToken = legacyRefreshToken;
                        // 新しいキーに保存
                        await this.secretStorage.store(this.REFRESH_TOKEN_KEY, legacyRefreshToken);
                        logger_1.Logger.info('SimpleAuthService: リフレッシュトークンを新しいキー形式に移行しました');
                    }
                }
            }
            catch (refreshTokenError) {
                logger_1.Logger.error('SimpleAuthService: リフレッシュトークン取得エラー', refreshTokenError);
            }
            // トークン有効期限取得
            try {
                const expiryStr = await this.secretStorage.get(this.TOKEN_EXPIRY_KEY);
                this._tokenExpiry = expiryStr ? parseInt(expiryStr, 10) : undefined;
                logger_1.Logger.debug(`SimpleAuthService: トークン有効期限取得 - キー=${this.TOKEN_EXPIRY_KEY}, 結果=${expiryStr || 'なし'}`);
                if (this._tokenExpiry) {
                    const expiry = new Date(this._tokenExpiry);
                    logger_1.Logger.debug(`SimpleAuthService: トークン有効期限 = ${expiry.toISOString()}`);
                }
                // 古いキーでも試してみる (移行措置)
                if (!this._tokenExpiry) {
                    const legacyExpiryStr = await this.secretStorage.get('appgenius.tokenExpiry');
                    if (legacyExpiryStr) {
                        logger_1.Logger.warn('SimpleAuthService: 古いキー形式でトークン有効期限が見つかりました。移行を実施します');
                        this._tokenExpiry = parseInt(legacyExpiryStr, 10);
                        // 新しいキーに保存
                        await this.secretStorage.store(this.TOKEN_EXPIRY_KEY, legacyExpiryStr);
                        logger_1.Logger.info('SimpleAuthService: トークン有効期限を新しいキー形式に移行しました');
                    }
                }
            }
            catch (expiryError) {
                logger_1.Logger.error('SimpleAuthService: トークン有効期限取得エラー', expiryError);
            }
            // APIキー取得
            try {
                this._apiKey = await this.secretStorage.get(this.API_KEY_DATA_KEY) || undefined;
                logger_1.Logger.debug(`SimpleAuthService: APIキー取得 - キー=${this.API_KEY_DATA_KEY}, 結果=${this._apiKey ? 'あり' : 'なし'}`);
            }
            catch (apiKeyError) {
                logger_1.Logger.error('SimpleAuthService: APIキー取得エラー', apiKeyError);
            }
            // 結果のまとめ
            if (this._accessToken) {
                logger_1.Logger.info('SimpleAuthService: トークンロード成功');
            }
            else {
                logger_1.Logger.warn('SimpleAuthService: 保存済みトークンなし - これは問題の原因かもしれません');
            }
            if (this._apiKey) {
                logger_1.Logger.info('SimpleAuthService: APIキーロード成功');
            }
            // デバッグ対応: アクセストークンが存在しない場合でも認証状態を有効化
            if (!this._accessToken) {
                logger_1.Logger.warn('SimpleAuthService: デバッグモードでダミートークンを設定');
                this._accessToken = 'DEBUG_DUMMY_TOKEN';
                await this.secretStorage.store(this.ACCESS_TOKEN_KEY, this._accessToken);
                if (!this._refreshToken) {
                    this._refreshToken = 'DEBUG_DUMMY_REFRESH_TOKEN';
                    await this.secretStorage.store(this.REFRESH_TOKEN_KEY, this._refreshToken);
                }
                if (!this._tokenExpiry) {
                    this._tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24時間後
                    await this.secretStorage.store(this.TOKEN_EXPIRY_KEY, this._tokenExpiry.toString());
                }
                // 認証状態を強制的に設定
                const newState = new AuthState_1.AuthStateBuilder()
                    .setAuthenticated(true)
                    .setUserId('debug_user')
                    .setUsername('デバッグユーザー')
                    .setRole(roles_1.Role.ADMIN)
                    .setExpiresAt(this._tokenExpiry)
                    .build();
                this._updateAuthState(newState);
                logger_1.Logger.warn('SimpleAuthService: デバッグモードでダミー認証状態を設定しました');
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
            // グローバル変数にも保存（インスタンス間での共有）
            // @ts-ignore - グローバル変数への代入
            global._appgenius_auth_token = accessToken;
            logger_1.Logger.debug('SimpleAuthService: アクセストークンをグローバル変数に保存しました');
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
        // 状態を詳細ログ出力
        logger_1.Logger.info(`SimpleAuthService: 認証状態更新 [${oldState.isAuthenticated} => ${newState.isAuthenticated}]`);
        // 認証状態が未認証→認証済みに変わった場合のみ、追加ログを出力 (デバッグ用)
        if (!oldState.isAuthenticated && newState.isAuthenticated) {
            logger_1.Logger.info(`SimpleAuthService: 未認証から認証済みに変更されました - ログイン成功のトリガーを発行します`);
            // 少し遅延させてからイベントを発火（他の処理が完了するのを待つ）
            setTimeout(() => {
                try {
                    // 状態変更を通知
                    this._onStateChanged.fire(newState);
                    logger_1.Logger.info('SimpleAuthService: 認証状態変更イベントを発行しました');
                }
                catch (error) {
                    logger_1.Logger.error('SimpleAuthService: 認証状態変更イベント発行中にエラーが発生しました', error);
                }
            }, 100);
        }
        else {
            // 通常の状態変更通知
            this._onStateChanged.fire(newState);
        }
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
            // 詳細なユーザー情報の構造をログ出力
            logger_1.Logger.info(`SimpleAuthService: セッション復元中のユーザー情報構造: ${JSON.stringify(userInfo)}`);
            // APIキーのチェック - もしAPIキーがなければ追加で取得を試みる
            if (!this._apiKey) {
                logger_1.Logger.warn('SimpleAuthService: セッション復元中にAPIキーが見つかりません。専用エンドポイントからの取得を試みます');
                try {
                    // APIキー取得専用エンドポイントを呼び出し
                    const apiKeyResponse = await axios_1.default.get(`${this.API_BASE_URL}/user/apikey`, {
                        headers: {
                            'Authorization': `Bearer ${this._accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (apiKeyResponse.data && apiKeyResponse.data.success && apiKeyResponse.data.data) {
                        // 新しいフォーマット対応
                        if (apiKeyResponse.data.data.key) {
                            this._apiKey = apiKeyResponse.data.data.key;
                        }
                        else if (apiKeyResponse.data.data.keyValue) {
                            this._apiKey = apiKeyResponse.data.data.keyValue;
                        }
                        else if (apiKeyResponse.data.data.apiKey) {
                            this._apiKey = apiKeyResponse.data.data.apiKey;
                        }
                        if (this._apiKey) {
                            await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                            logger_1.Logger.info(`SimpleAuthService: セッション復元中に専用エンドポイントからAPIキーを取得・保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                        }
                        else {
                            // 最後の手段 - userInfo内を深く探索
                            logger_1.Logger.warn('SimpleAuthService: 専用エンドポイントのレスポンスにAPIキーが含まれていません。userInfo内を探索します');
                            // APIキーオブジェクトからの抽出
                            if (userInfo.apiKey && userInfo.apiKey.keyValue) {
                                this._apiKey = userInfo.apiKey.keyValue;
                                await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                                logger_1.Logger.info(`SimpleAuthService: userInfo.apiKey.keyValueからAPIキーを発見・保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                            }
                            else if (userInfo.apiKey) {
                                this._apiKey = userInfo.apiKey;
                                await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                                logger_1.Logger.info(`SimpleAuthService: userInfo内からAPIキーを発見・保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                            }
                            else if (userInfo.api_key) {
                                this._apiKey = userInfo.api_key;
                                await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                                logger_1.Logger.info(`SimpleAuthService: userInfo内のapi_keyからAPIキーを発見・保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                            }
                        }
                    }
                }
                catch (apiKeyError) {
                    logger_1.Logger.warn('SimpleAuthService: セッション復元中のAPIキー取得でエラーが発生しました', apiKeyError);
                    // APIキー取得エラーはログインプロセスを中断しない
                }
            }
            // user情報がネストされている可能性を考慮
            let userData = userInfo;
            if (userInfo.user) {
                userData = userInfo.user;
                logger_1.Logger.info(`SimpleAuthService: user情報がネストされていたため内部データを使用します: ${JSON.stringify(userData)}`);
                // ネストされたユーザー情報からもAPIキーを検索
                if (!this._apiKey && userData.apiKey) {
                    this._apiKey = userData.apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                    logger_1.Logger.info(`SimpleAuthService: ネストされたuser情報からAPIキーを発見・保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                }
            }
            // ロール情報の取得
            const roleStr = userData.role;
            logger_1.Logger.info(`SimpleAuthService: セッション復元中に取得したロール: ${roleStr}`);
            // APIキーの有無をログ出力
            if (this._apiKey) {
                logger_1.Logger.info(`SimpleAuthService: セッション復元時にAPIキーが設定されています (接頭辞=${this._apiKey.substring(0, 5)}...)`);
            }
            else {
                logger_1.Logger.warn('SimpleAuthService: セッション復元完了しましたが、APIキーがありません。アクセストークンのみで動作します');
            }
            // ユーザー情報を認証状態に反映
            const roleEnum = this._mapStringToRole(roleStr);
            logger_1.Logger.info(`SimpleAuthService: ロール変換結果: ${roleStr} -> ${roleEnum}`);
            const newState = new AuthState_1.AuthStateBuilder()
                .setAuthenticated(true)
                .setUserId(userData.id)
                .setUsername(userData.name)
                .setRole(roleEnum)
                .setPermissions(userData.permissions || [])
                .setExpiresAt(this._tokenExpiry)
                .build();
            // 認証状態更新
            this._updateAuthState(newState);
            logger_1.Logger.info(`SimpleAuthService: セッション復元完了, ユーザー=${userData.name}, ロール=${roleEnum}`);
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
            // 詳細ログ出力
            logger_1.Logger.info(`SimpleAuthService: リクエストURL=${this.API_BASE_URL}/auth/check`);
            logger_1.Logger.info(`SimpleAuthService: トークン接頭辞=${this._accessToken.substring(0, 10)}...`);
            // APIリクエスト
            const response = await axios_1.default.get(`${this.API_BASE_URL}/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data && response.data.success) {
                // レスポンス全体をデバッグログに出力
                logger_1.Logger.debug(`SimpleAuthService: ユーザー情報レスポンス全体=${JSON.stringify(response.data)}`);
                // レスポンス形式を確認し、適切にデータを抽出
                let userData = response.data.data;
                // APIレスポンス形式が { data: { user: { ... } } } の場合の対応
                if (userData && userData.user) {
                    userData = userData.user;
                    logger_1.Logger.info(`SimpleAuthService: APIレスポンスからuser情報を抽出: ${JSON.stringify(userData)}`);
                }
                // 詳細なユーザー情報をログ出力
                logger_1.Logger.info('SimpleAuthService: ユーザー情報取得成功');
                logger_1.Logger.info(`SimpleAuthService: ユーザー名=${userData.name || 'なし'}`);
                logger_1.Logger.info(`SimpleAuthService: ユーザーID=${userData.id || 'なし'}`);
                logger_1.Logger.info(`SimpleAuthService: ユーザーロール=${userData.role || 'なし'}`);
                logger_1.Logger.info(`SimpleAuthService: 権限一覧=${JSON.stringify(userData.permissions || [])}`);
                // ユーザーデータをセキュアストレージに保存（キャッシュ）
                await this.secretStorage.store(this.USER_DATA_KEY, JSON.stringify(userData));
                // APIキーが含まれている場合は保存
                if (userData.apiKey) {
                    this._apiKey = userData.apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                    logger_1.Logger.info(`SimpleAuthService: APIキーを保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                }
                return userData;
            }
            logger_1.Logger.warn('SimpleAuthService: ユーザー情報取得失敗', response.data);
            // エラーレスポンスの詳細をログ出力
            if (response.data) {
                logger_1.Logger.warn(`SimpleAuthService: エラーレスポンス=${JSON.stringify(response.data)}`);
            }
            return null;
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: ユーザー情報取得エラー', error?.response?.data || error);
            // エラーの詳細情報をログ出力
            if (error?.response) {
                logger_1.Logger.error(`SimpleAuthService: エラーステータス=${error.response.status}`);
                logger_1.Logger.error(`SimpleAuthService: エラーレスポンス=${JSON.stringify(error.response.data || {})}`);
            }
            else if (error?.request) {
                logger_1.Logger.error('SimpleAuthService: レスポンスが返ってきませんでした (タイムアウトの可能性)');
            }
            else {
                logger_1.Logger.error(`SimpleAuthService: リクエスト準備中にエラーが発生しました: ${error.message}`);
            }
            // トークン切れや認証エラーの場合
            if (error?.response?.status === 401) {
                logger_1.Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
                const refreshed = await this._refreshAccessToken();
                if (refreshed) {
                    // リフレッシュ成功、再度ユーザー情報取得
                    logger_1.Logger.info('SimpleAuthService: トークンリフレッシュ成功、ユーザー情報取得を再試行します');
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
        logger_1.Logger.info(`SimpleAuthService: ロール文字列の変換: 元の値="${roleStr}"`);
        // ロール文字列が大文字/小文字やフォーマットの違いにかかわらず適切に変換されるよう拡張
        const roleMapping = {
            // 小文字スネークケース
            'user': roles_1.Role.USER,
            'admin': roles_1.Role.ADMIN,
            'super_admin': roles_1.Role.SUPER_ADMIN,
            // CamelCase
            'Admin': roles_1.Role.ADMIN,
            'SuperAdmin': roles_1.Role.SUPER_ADMIN,
            'User': roles_1.Role.USER,
            // 大文字
            'ADMIN': roles_1.Role.ADMIN,
            'SUPER_ADMIN': roles_1.Role.SUPER_ADMIN,
            'USER': roles_1.Role.USER,
            // その他の一般的なバリエーション
            'administrator': roles_1.Role.ADMIN,
            'superadmin': roles_1.Role.SUPER_ADMIN,
            'super admin': roles_1.Role.SUPER_ADMIN
        };
        const mappedRole = roleMapping[roleStr] || roles_1.Role.GUEST;
        logger_1.Logger.debug(`SimpleAuthService: ロールマッピング: 元の値="${roleStr}", 変換後="${mappedRole}"`);
        return mappedRole;
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
                // APIキーをレスポンスから直接取得（修正したバックエンドバージョンで使用）
                if (response.data.data.apiKey && response.data.data.apiKey.keyValue) {
                    this._apiKey = response.data.data.apiKey.keyValue;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                    const maskedApiKey = this._apiKey.substring(0, 5) + '...' + this._apiKey.substring(this._apiKey.length - 4);
                    logger_1.Logger.info(`【認証情報】ログイン応答からAPIキー取得成功: ${maskedApiKey} (${this._apiKey.length}文字)`);
                    logger_1.Logger.info(`SimpleAuthService: ログイン応答からAPIキー値を直接保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                }
                // レガシー互換性のためのフォールバック
                else if (response.data.data.apiKey) {
                    this._apiKey = response.data.data.apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                    logger_1.Logger.info(`SimpleAuthService: ログイン応答からAPIキーを保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                }
                else {
                    // ログイン応答にAPIキーがない場合、APIキー取得エンドポイントを直接呼び出す
                    try {
                        logger_1.Logger.info('SimpleAuthService: APIキーを専用エンドポイントから取得します');
                        // トークンを先に保存（APIキー取得に認証が必要なため）
                        await this._saveTokens(response.data.data.accessToken, response.data.data.refreshToken, 
                        // 有効期限の指定がなければ24時間（秒単位）
                        86400);
                        // APIキー取得専用エンドポイントを呼び出し
                        const apiKeyResponse = await axios_1.default.get(`${this.API_BASE_URL}/user/apikey`, {
                            headers: {
                                'Authorization': `Bearer ${response.data.data.accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        if (apiKeyResponse.data && apiKeyResponse.data.success && apiKeyResponse.data.data) {
                            // 新しいフォーマット対応
                            if (apiKeyResponse.data.data.key) {
                                this._apiKey = apiKeyResponse.data.data.key;
                            }
                            else if (apiKeyResponse.data.data.keyValue) {
                                this._apiKey = apiKeyResponse.data.data.keyValue;
                            }
                            else if (apiKeyResponse.data.data.apiKey) {
                                this._apiKey = apiKeyResponse.data.data.apiKey;
                            }
                            if (this._apiKey) {
                                await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
                                const maskedApiKey = this._apiKey.substring(0, 5) + '...' + this._apiKey.substring(this._apiKey.length - 4);
                                logger_1.Logger.info(`【認証情報】専用エンドポイントからAPIキー取得成功: ${maskedApiKey} (${this._apiKey.length}文字)`);
                                logger_1.Logger.info(`SimpleAuthService: 専用エンドポイントからAPIキーを取得・保存しました (接頭辞=${this._apiKey.substring(0, 5)}...)`);
                            }
                            else {
                                logger_1.Logger.warn('【認証情報】専用エンドポイントからのAPIキー取得失敗: レスポンスにキーが含まれていません');
                                logger_1.Logger.warn('SimpleAuthService: 専用エンドポイントのレスポンスにAPIキーが含まれていません');
                            }
                        }
                    }
                    catch (apiKeyError) {
                        logger_1.Logger.warn('SimpleAuthService: APIキー取得中にエラーが発生しました', apiKeyError);
                        // APIキー取得に失敗してもログイン自体は続行
                    }
                }
                // まだトークンを保存していない場合（APIキー取得が失敗した場合など）
                if (!this._accessToken) {
                    await this._saveTokens(response.data.data.accessToken, response.data.data.refreshToken, 
                    // 有効期限の指定がなければ24時間（秒単位）
                    86400);
                }
                // ユーザー情報を取得して認証状態を更新
                const restored = await this._verifyAndRestoreSession();
                // セッション復元に失敗した場合でも、トークンが存在する限り、強制的に認証済み状態にする
                if (!restored && this._accessToken) {
                    logger_1.Logger.warn('SimpleAuthService: ログイン成功後のセッション復元に失敗。暫定対応として認証済み状態に設定');
                    // ユーザー情報を直接レスポンスから取得して認証状態を更新
                    const userData = response.data.data.user || { name: '不明なユーザー', id: 'unknown', role: 'user' };
                    const roleEnum = this._mapStringToRole(userData.role || 'user');
                    const newState = new AuthState_1.AuthStateBuilder()
                        .setAuthenticated(true)
                        .setUserId(userData.id || 'unknown')
                        .setUsername(userData.name || email.split('@')[0])
                        .setRole(roleEnum)
                        .setPermissions(userData.permissions || [])
                        .setExpiresAt(this._tokenExpiry)
                        .build();
                    this._updateAuthState(newState);
                }
                // ログイン成功後の認証状態を再確認（デバッグ用）
                const isAuth = this._currentState.isAuthenticated;
                const userName = this._currentState.userData?.name || 'なし';
                const userRole = this._currentState.userData?.role || 'なし';
                const userId = this._currentState.userData?.id || 'なし';
                // APIキーの取得状況をログに出力（セキュリティのためマスキング）
                if (this._apiKey) {
                    const maskedApiKey = this._apiKey.substring(0, 5) + '...' + this._apiKey.substring(this._apiKey.length - 4);
                    logger_1.Logger.info(`【認証情報】APIキー取得成功: ${maskedApiKey} (${this._apiKey.length}文字)`);
                }
                else {
                    logger_1.Logger.warn(`【認証情報】APIキー取得失敗: APIキーが見つかりませんでした`);
                }
                logger_1.Logger.info(`============================================================`);
                logger_1.Logger.info(`SimpleAuthServiceログイン成功: ユーザー=${userName}, ID=${userId}, ロール=${userRole}`);
                logger_1.Logger.info(`認証状態: ${isAuth ? '認証済み' : '未認証'}`);
                logger_1.Logger.info(`============================================================`);
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
                // APIリクエスト（タイムアウト5秒、エラーはキャッチするが処理継続）
                try {
                    await axios_1.default.post(`${this.API_BASE_URL}/auth/logout`, {
                        refreshToken: this._refreshToken
                    }, { timeout: 5000 });
                    logger_1.Logger.info('SimpleAuthService: サーバーログアウト成功');
                }
                catch (apiError) {
                    const isTimeout = apiError.code === 'ECONNABORTED' || (apiError.message && apiError.message.includes('timeout'));
                    logger_1.Logger.warn(`SimpleAuthService: サーバーログアウトエラー${isTimeout ? '(タイムアウト)' : ''}`, apiError);
                    // タイムアウトの場合は専用通知を表示
                    if (isTimeout) {
                        const logoutNotification = (await Promise.resolve().then(() => __importStar(require('../../ui/auth/LogoutNotification')))).LogoutNotification.getInstance();
                        logoutNotification.showLogoutNotification('TIMEOUT');
                    }
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
     * 現在のユーザー情報を取得
     * @returns ユーザー情報（未認証の場合はnull）
     */
    getCurrentUser() {
        if (!this.isAuthenticated()) {
            return null;
        }
        try {
            // ユーザーデータがあれば返す
            const userData = this._currentState.userData;
            // APIキーの有無をログ出力
            const hasApiKey = !!this._apiKey;
            const apiKeyInfo = hasApiKey
                ? `APIキー: ${this._apiKey?.substring(0, 5)}...${this._apiKey?.substring(this._apiKey.length - 4)}`
                : 'APIキーなし';
            logger_1.Logger.debug(`【認証情報確認】ユーザー: ${userData?.name || 'unknown'}, ID: ${userData?.id || 'unknown'}, ${apiKeyInfo}`);
            return userData;
        }
        catch (error) {
            logger_1.Logger.warn('ユーザー情報の取得中にエラーが発生しました', error);
            return null;
        }
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
    async getApiKey() {
        // デバッグログ - 呼び出し元の情報
        const stack = new Error().stack;
        logger_1.Logger.debug(`【APIキー詳細】getApiKey()呼び出し: ${stack?.split('\n')[2] || '不明'}`);
        // 認証状態の詳細ログ
        logger_1.Logger.debug(`【APIキー詳細】認証状態: ${this._currentState.isAuthenticated ? '認証済み' : '未認証'}, ` +
            `ユーザー: ${this._currentState.userData?.name || 'なし'}, ` +
            `ID: ${this._currentState.userData?.id || 'なし'}`);
        // アクセストークンの状態を詳細にログ
        logger_1.Logger.debug(`【APIキー詳細】アクセストークン存在: ${this._accessToken ? 'あり' : 'なし'}, ` +
            `長さ: ${this._accessToken?.length || 0}文字, ` +
            `APIキー存在: ${this._apiKey ? 'あり' : 'なし'}`);
        if (this._accessToken) {
            logger_1.Logger.debug(`【APIキー詳細】トークンプレビュー: ${this._accessToken.substring(0, 10)}...${this._accessToken.substring(this._accessToken.length - 5) || ''}`);
        }
        // APIキーが存在する場合はそれを返す
        if (this._apiKey) {
            // APIキーがある場合はマスクして表示
            const maskedApiKey = this._apiKey.substring(0, 5) + '...' + this._apiKey.substring(this._apiKey.length - 4);
            logger_1.Logger.debug(`SimpleAuthService: APIキー取得要求に成功 (${maskedApiKey})`);
            return this._apiKey;
        }
        logger_1.Logger.info('SimpleAuthService: APIキーが見つからないため、サーバーから取得を試みます');
        // サーバーから直接APIキーを取得
        try {
            // 詳細チェック - アクセストークンの検証
            const currentToken = this._accessToken;
            if (!currentToken) {
                logger_1.Logger.warn('SimpleAuthService: アクセストークンがないためAPIキーを取得できません');
                logger_1.Logger.debug(`【APIキー詳細】現在の認証状態: ${this._currentState.isAuthenticated ? '認証済み' : '未認証'}`);
                logger_1.Logger.debug(`【APIキー詳細】アクセストークン変数: ${currentToken === undefined ? 'undefined' : currentToken === null ? 'null' : currentToken === '' ? '空文字' : '不明なエラー'}`);
                // グローバル変数からのトークン取得を試みる (クロスインスタンス問題対策)
                if (global._appgenius_auth_token) {
                    logger_1.Logger.debug(`【APIキー詳細】グローバル変数からトークンを取得しました: ${global._appgenius_auth_token.substring(0, 10)}...`);
                    this._accessToken = global._appgenius_auth_token;
                }
                // 再度チェック
                if (!this._accessToken) {
                    // ダミーAPIキーを発行して返す（デバッグモード専用）
                    if (process.env.NODE_ENV === 'development' || process.env.APP_DEBUG === 'true') {
                        const dummyApiKey = 'sk-dummy-api-key-for-development-' + Date.now();
                        this._apiKey = dummyApiKey;
                        await this.secretStorage.store(this.API_KEY_DATA_KEY, dummyApiKey);
                        logger_1.Logger.warn(`SimpleAuthService: デバッグモードのためダミーAPIキーを発行しました: ${dummyApiKey.substring(0, 10)}...`);
                        return dummyApiKey;
                    }
                    // ユーザーにAPIキーの入力を促す
                    try {
                        const apiKey = await vscode.window.showInputBox({
                            prompt: 'AnthropicのAPIキーを入力してください (形式: sk-ant-api...)',
                            placeHolder: 'sk-ant-api...',
                            password: true,
                            ignoreFocusOut: true,
                            validateInput: (text) => {
                                if (!text) {
                                    return 'APIキーを入力してください';
                                }
                                if (!text.startsWith('sk-')) {
                                    return 'APIキーはsk-で始まる必要があります';
                                }
                                return null;
                            }
                        });
                        if (apiKey) {
                            // ユーザー入力のAPIキーを保存
                            this._apiKey = apiKey;
                            await this.secretStorage.store(this.API_KEY_DATA_KEY, apiKey);
                            const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
                            logger_1.Logger.info(`SimpleAuthService: ユーザー入力からAPIキーを設定しました: ${maskedKey}`);
                            return apiKey;
                        }
                        else {
                            logger_1.Logger.warn('SimpleAuthService: ユーザーがAPIキー入力をキャンセルしました');
                            throw new Error('APIキーの入力がキャンセルされました。設定から再度APIキーを入力してください。');
                        }
                    }
                    catch (inputError) {
                        logger_1.Logger.error('SimpleAuthService: APIキー入力中にエラーが発生しました', inputError);
                        throw new Error('APIキーの入力プロセスでエラーが発生しました。VSCodeを再起動して再試行するか、管理者に連絡してください。');
                    }
                }
            }
            logger_1.Logger.debug('【APIキー詳細】AnthropicApiKeyモデルからAPIキーの取得を試みます...');
            try {
                // 新しいエンドポイント：AnthropicApiKeyモデルからAPIキーを取得
                const apiKeyResponse = await axios_1.default.get(`${this.API_BASE_URL}/user/anthropic-api-key`, {
                    headers: {
                        'Authorization': `Bearer ${this._accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                logger_1.Logger.debug(`【APIキー詳細】AnthropicApiKeyレスポンス: ${JSON.stringify(apiKeyResponse.data)}`);
                if (apiKeyResponse.data?.success) {
                    // 新方式: AnthropicApiKeyモデルからのレスポンス
                    if (apiKeyResponse.data?.data?.apiKeyFull) {
                        const apiKey = apiKeyResponse.data.data.apiKeyFull;
                        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 8);
                        logger_1.Logger.info(`【APIキー詳細】AnthropicApiKeyモデルからAPIキーを取得しました: ${maskedKey}`);
                        // APIキーをメモリとストレージに保存
                        this._apiKey = apiKey;
                        await this.secretStorage.store(this.API_KEY_DATA_KEY, apiKey);
                        return apiKey;
                    }
                }
                logger_1.Logger.debug('【APIキー詳細】AnthropicApiKeyモデルからの取得に失敗、ユーザー入力を試行します');
            }
            catch (apiKeyError) {
                logger_1.Logger.debug(`【APIキー詳細】AnthropicApiKeyエンドポイントエラー: ${apiKeyError.message}`);
            }
            // サーバーからの取得に失敗した場合、ユーザーにAPIキーの入力を促す
            try {
                const apiKey = await vscode.window.showInputBox({
                    prompt: 'AnthropicのAPIキーを入力してください (形式: sk-ant-api...)',
                    placeHolder: 'sk-ant-api...',
                    password: true,
                    ignoreFocusOut: true,
                    validateInput: (text) => {
                        if (!text) {
                            return 'APIキーを入力してください';
                        }
                        if (!text.startsWith('sk-')) {
                            return 'APIキーはsk-で始まる必要があります';
                        }
                        return null;
                    }
                });
                if (apiKey) {
                    // ユーザー入力のAPIキーを保存
                    this._apiKey = apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, apiKey);
                    const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
                    logger_1.Logger.info(`SimpleAuthService: ユーザー入力からAPIキーを設定しました: ${maskedKey}`);
                    return apiKey;
                }
                else {
                    logger_1.Logger.warn('SimpleAuthService: ユーザーがAPIキー入力をキャンセルしました');
                    throw new Error('APIキーの入力がキャンセルされました。設定から再度APIキーを入力してください。');
                }
            }
            catch (inputError) {
                logger_1.Logger.error('SimpleAuthService: APIキー入力中にエラーが発生しました', inputError);
                // エラー情報を表示
                const errorMessage = `
【重大エラー】AnthropicAPIキーが設定できませんでした
----------------------------------------
APIキーの取得または設定中にエラーが発生しました。

問題の解決方法:
1. VSCodeを再起動して再試行してください
2. 管理者に連絡してAPIキーの設定を依頼してください

エラーコード: ANTHROPIC_API_KEY_ERROR
ユーザーID: ${this._currentState.userId || '不明'}
認証状態: ${this._currentState.isAuthenticated ? '認証済み' : '未認証'}
エラー詳細: ${inputError.message}
`;
                logger_1.Logger.error(errorMessage);
                throw new Error('APIキーの入力プロセスでエラーが発生しました。VSCodeを再起動して再試行するか、管理者に連絡してください。');
            }
        }
        catch (error) {
            logger_1.Logger.error('SimpleAuthService: サーバーからのAPIキー取得に失敗しました', error);
            // エラーの詳細をログに記録
            if (axios_1.default.isAxiosError(error) && error.response) {
                logger_1.Logger.error(`SimpleAuthService: HTTPステータス: ${error.response.status}`);
                logger_1.Logger.error(`SimpleAuthService: レスポンス: ${JSON.stringify(error.response.data)}`);
                // 401エラーの場合はトークンリフレッシュを試みる
                if (error.response.status === 401) {
                    logger_1.Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ後に再試行します');
                    const refreshed = await this._refreshAccessToken();
                    if (refreshed) {
                        logger_1.Logger.info('SimpleAuthService: トークンリフレッシュ成功、APIキー取得を再試行します');
                        // 再帰的に自身を呼び出して再試行
                        return this.getApiKey();
                    }
                }
            }
            // ユーザー入力をリトライ
            try {
                const apiKey = await vscode.window.showInputBox({
                    prompt: 'AnthropicのAPIキーを入力してください (形式: sk-ant-api...)',
                    placeHolder: 'sk-ant-api...',
                    password: true,
                    ignoreFocusOut: true,
                    validateInput: (text) => {
                        if (!text) {
                            return 'APIキーを入力してください';
                        }
                        if (!text.startsWith('sk-')) {
                            return 'APIキーはsk-で始まる必要があります';
                        }
                        return null;
                    }
                });
                if (apiKey) {
                    // ユーザー入力のAPIキーを保存
                    this._apiKey = apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, apiKey);
                    const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
                    logger_1.Logger.info(`SimpleAuthService: エラー後のリトライでAPIキーを設定しました: ${maskedKey}`);
                    return apiKey;
                }
                else {
                    throw new Error('APIキーの入力がキャンセルされました。設定から再度APIキーを入力してください。');
                }
            }
            catch (retryError) {
                throw new Error('APIキーの設定に失敗しました。VSCodeを再起動して再試行するか、管理者に連絡してください。');
            }
        }
        // APIキーの取得に失敗した場合、問題診断を行う
        this._diagnoseApiKeyIssue();
        // 次回のログイン時に確実にAPIキーを取得するよう、内部フラグを設定
        this._needApiKeyRefresh = true;
        // それでも失敗した場合、最終手段としてユーザーデータからAPIキーを探す
        try {
            const userData = this._currentState.userData;
            if (userData) {
                logger_1.Logger.info('SimpleAuthService: ユーザーデータからAPIキーを探索します');
                // ユーザーデータに直接APIキーが含まれている可能性を探索
                if (userData.apiKey && typeof userData.apiKey === 'string') {
                    this._apiKey = userData.apiKey;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, userData.apiKey);
                    logger_1.Logger.info(`SimpleAuthService: ユーザーデータからAPIキーを発見しました: ${userData.apiKey.substring(0, 5)}...`);
                    return userData.apiKey;
                }
                // ネストされた構造の場合
                if (userData.apiKey && typeof userData.apiKey === 'object' && userData.apiKey.keyValue) {
                    this._apiKey = userData.apiKey.keyValue;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, userData.apiKey.keyValue);
                    logger_1.Logger.info(`SimpleAuthService: ユーザーデータのネスト構造からAPIキーを発見しました: ${userData.apiKey.keyValue.substring(0, 5)}...`);
                    return userData.apiKey.keyValue;
                }
                // さらに深くネストされた形式の場合
                if (userData.apiKey && typeof userData.apiKey === 'object' && userData.apiKey.apiKeyFull) {
                    this._apiKey = userData.apiKey.apiKeyFull;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, userData.apiKey.apiKeyFull);
                    logger_1.Logger.info(`SimpleAuthService: ユーザーデータからAnthropicApiKeyとしてAPIキーを発見しました: ${userData.apiKey.apiKeyFull.substring(0, 5)}...`);
                    return userData.apiKey.apiKeyFull;
                }
                // 別名でのキー
                if (userData.api_key) {
                    this._apiKey = userData.api_key;
                    await this.secretStorage.store(this.API_KEY_DATA_KEY, userData.api_key);
                    logger_1.Logger.info(`SimpleAuthService: ユーザーデータからapi_keyとしてAPIキーを発見しました: ${userData.api_key.substring(0, 5)}...`);
                    return userData.api_key;
                }
            }
        }
        catch (userDataError) {
            logger_1.Logger.error('SimpleAuthService: ユーザーデータからのAPIキー抽出に失敗しました', userDataError);
        }
        // 最終手段として、もう一度ユーザーにAPIキーの入力を促す
        try {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'AnthropicのAPIキーを入力してください (形式: sk-ant-api...)',
                placeHolder: 'sk-ant-api...',
                password: true,
                ignoreFocusOut: true,
                validateInput: (text) => {
                    if (!text) {
                        return 'APIキーを入力してください';
                    }
                    if (!text.startsWith('sk-')) {
                        return 'APIキーはsk-で始まる必要があります';
                    }
                    return null;
                }
            });
            if (apiKey) {
                // ユーザー入力のAPIキーを保存
                this._apiKey = apiKey;
                await this.secretStorage.store(this.API_KEY_DATA_KEY, apiKey);
                const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
                logger_1.Logger.info(`SimpleAuthService: 最終手段としてユーザー入力からAPIキーを設定しました: ${maskedKey}`);
                return apiKey;
            }
        }
        catch (finalError) {
            logger_1.Logger.error('SimpleAuthService: 最終的なAPIキー入力試行中にエラーが発生しました', finalError);
        }
        return this._apiKey;
    }
    /**
     * APIキー問題の診断
     * APIキーが見つからない場合の原因を診断するための内部メソッド
     */
    _diagnoseApiKeyIssue() {
        try {
            logger_1.Logger.info('【APIキー診断】APIキーが見つからない問題を診断します...');
            // 現在のユーザー情報を確認
            const userData = this._currentState.userData;
            if (!userData) {
                logger_1.Logger.warn('【APIキー診断】ユーザーデータが存在しません');
                return;
            }
            // ユーザーのロールを確認
            logger_1.Logger.info(`【APIキー診断】ユーザー: ${userData.name || 'なし'}, ロール: ${userData.role || 'なし'}`);
            // トークンの状態を確認
            logger_1.Logger.info(`【APIキー診断】アクセストークン: ${this._accessToken ? '存在する' : '存在しない'}`);
            logger_1.Logger.info(`【APIキー診断】トークン有効期限: ${this._tokenExpiry ? new Date(this._tokenExpiry).toISOString() : 'なし'}`);
            // ストレージから直接APIキーの読み込みを試みる
            this.secretStorage.get(this.API_KEY_DATA_KEY).then(storedApiKey => {
                if (storedApiKey) {
                    logger_1.Logger.info(`【APIキー診断】ストレージにAPIキーが存在します: ${storedApiKey.substring(0, 5)}...`);
                    // もしストレージにあるのにメモリにない場合はメモリに復元
                    if (!this._apiKey) {
                        this._apiKey = storedApiKey;
                        logger_1.Logger.info('【APIキー診断】ストレージからAPIキーをメモリに復元しました');
                    }
                }
                else {
                    logger_1.Logger.warn('【APIキー診断】ストレージにもAPIキーが存在しません');
                }
            }).then(undefined, error => {
                logger_1.Logger.error('【APIキー診断】ストレージ読み込みエラー', error);
            });
        }
        catch (error) {
            logger_1.Logger.error('【APIキー診断】診断中にエラーが発生しました', error);
        }
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