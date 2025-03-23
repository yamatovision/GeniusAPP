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
exports.AuthStorageManager = void 0;
const vscode = __importStar(require("vscode"));
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
     * 有効期限のデフォルトは24時間（86400秒）
     */
    async setAccessToken(token, expiryInSeconds = 86400) {
        try {
            // トークンを保存
            await this.set(this.ACCESS_TOKEN_KEY, token);
            // 有効期限を計算して保存（Unix timestamp）
            const expiryTime = Math.floor(Date.now() / 1000) + expiryInSeconds;
            await this.set(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
            // グローバル設定にも有効期限を保存（VSCode再起動時に利用）
            // メモリ内キャッシュではなくSecretStorageに保存するため
            try {
                // フォールバックメカニズム: グローバル設定を試み、エラーならセクション設定を試行
                try {
                    await vscode.workspace.getConfiguration().update('appgenius.global.tokenExpiry', expiryTime, vscode.ConfigurationTarget.Global);
                    logger_1.Logger.debug('グローバルスコープに有効期限を保存しました');
                }
                catch (globalError) {
                    // グローバル設定に失敗した場合、セクション設定を試みる
                    logger_1.Logger.warn(`グローバル設定更新エラー: ${globalError.message}`);
                    try {
                        // appgeniusセクション配下に保存を試みる
                        await vscode.workspace.getConfiguration('appgenius').update('global.tokenExpiry', expiryTime, vscode.ConfigurationTarget.Global);
                        logger_1.Logger.debug('appgenius配下のグローバルスコープに有効期限を保存しました');
                    }
                    catch (sectionError) {
                        // セクション設定にも失敗した場合は、ワークスペース設定に保存
                        logger_1.Logger.warn(`セクション設定更新エラー: ${sectionError.message}`);
                        try {
                            // ワークスペース設定を試みる（プロジェクト固有）
                            await vscode.workspace.getConfiguration().update('appgenius.global.tokenExpiry', expiryTime, vscode.ConfigurationTarget.Workspace);
                            logger_1.Logger.debug('ワークスペーススコープに有効期限を保存しました');
                        }
                        catch (workspaceError) {
                            logger_1.Logger.warn(`ワークスペース設定更新エラー: ${workspaceError.message}`);
                            // すべての設定更新が失敗した場合、メモリキャッシュのみに保存
                        }
                    }
                }
            }
            catch (configError) {
                // すべての設定更新が失敗した場合の最終エラーログ
                logger_1.Logger.warn(`設定更新エラー: ${configError.message}`);
                logger_1.Logger.info('すべての設定更新に失敗しました。メモリキャッシュのみを使用します');
            }
            // 常にメモリキャッシュに保存（最も信頼性の高い方法）
            this._updateMemoryCache('tokenExpiry', expiryTime);
            logger_1.Logger.info(`AuthStorageManager: アクセストークンを保存しました (有効期限: ${new Date(expiryTime * 1000).toLocaleString()})`);
        }
        catch (error) {
            logger_1.Logger.error('アクセストークン保存中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * リフレッシュトークンの保存
     * VSCode永続化ストレージと設定の両方に保存して信頼性を向上
     */
    async setRefreshToken(token) {
        try {
            // SecretStorageに保存
            await this.set(this.REFRESH_TOKEN_KEY, token);
            // リフレッシュトークンの有効期限は長いので、グローバル設定にも保存
            // （VSCode再起動後のバックアップとして）
            // 注: セキュリティ上の理由からハッシュ化してから保存することも検討
            const globalRefreshKey = 'global.hasRefreshToken';
            await vscode.workspace.getConfiguration('appgenius').update(globalRefreshKey, true, // トークン自体ではなく存在フラグだけ保存
            vscode.ConfigurationTarget.Global);
            logger_1.Logger.debug('AuthStorageManager: リフレッシュトークンを保存しました');
        }
        catch (error) {
            logger_1.Logger.error('リフレッシュトークン保存中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * アクセストークンの取得
     */
    async getAccessToken() {
        return this.get(this.ACCESS_TOKEN_KEY);
    }
    /**
     * リフレッシュトークンの取得
     * 基本的にはSecretStorageから取得するが、フラグを使って存在確認も行う
     */
    async getRefreshToken() {
        try {
            // まずSecretStorageから取得を試みる
            const token = await this.get(this.REFRESH_TOKEN_KEY);
            if (token) {
                return token;
            }
            // グローバル設定を確認
            const globalRefreshKey = 'global.hasRefreshToken';
            const hasRefreshToken = vscode.workspace.getConfiguration('appgenius').get(globalRefreshKey);
            // フラグがあるのにトークンがない場合はログ記録
            if (hasRefreshToken) {
                logger_1.Logger.warn('リフレッシュトークンフラグは存在するが、実際のトークンが見つかりません。VSCode再起動による損失の可能性があります。');
            }
            return undefined;
        }
        catch (error) {
            logger_1.Logger.error('リフレッシュトークン取得中にエラーが発生しました', error);
            return undefined;
        }
    }
    /**
     * トークンの有効期限を取得
     * 通常のストレージとグローバル設定の両方をチェック
     *
     * 改善点:
     * - 複数のストレージ間での有効期限の整合性確保
     * - エラー処理の強化
     * - ログ出力の詳細化
     */
    async getTokenExpiry() {
        try {
            // 通常のSecretStorageから取得（最も信頼性が高い）
            const expiryStr = await this.get(this.TOKEN_EXPIRY_KEY);
            if (expiryStr) {
                const expiry = parseInt(expiryStr, 10);
                logger_1.Logger.debug(`AuthStorageManager: SecretStorageからトークン有効期限を取得 (${new Date(expiry * 1000).toLocaleString()}まで)`);
                return expiry;
            }
            // 複数のグローバル設定場所から取得を試みる（VSCode再起動後のフォールバック）
            let globalExpiry;
            // 1. まず直接のグローバル設定を確認
            try {
                globalExpiry = vscode.workspace.getConfiguration().get('appgenius.global.tokenExpiry');
                if (globalExpiry) {
                    logger_1.Logger.info(`AuthStorageManager: グローバル設定からトークン有効期限を取得 (${new Date(globalExpiry * 1000).toLocaleString()}まで)`);
                }
            }
            catch (globalError) {
                logger_1.Logger.warn(`グローバル設定からの取得エラー: ${globalError.message}`);
            }
            // 2. セクション設定を確認
            if (!globalExpiry) {
                try {
                    globalExpiry = vscode.workspace.getConfiguration('appgenius').get('global.tokenExpiry');
                    if (globalExpiry) {
                        logger_1.Logger.info(`AuthStorageManager: appgeniusセクション設定からトークン有効期限を取得 (${new Date(globalExpiry * 1000).toLocaleString()}まで)`);
                    }
                }
                catch (sectionError) {
                    logger_1.Logger.warn(`セクション設定からの取得エラー: ${sectionError.message}`);
                }
            }
            // 3. ワークスペース設定を確認
            if (!globalExpiry) {
                try {
                    // ワークスペース設定も確認
                    const workspaceExpiry = vscode.workspace.getConfiguration('appgenius', null).inspect('global.tokenExpiry')?.workspaceValue;
                    if (workspaceExpiry) {
                        globalExpiry = workspaceExpiry;
                        logger_1.Logger.info(`AuthStorageManager: ワークスペース設定からトークン有効期限を取得 (${new Date(globalExpiry * 1000).toLocaleString()}まで)`);
                    }
                }
                catch (workspaceError) {
                    logger_1.Logger.warn(`ワークスペース設定からの取得エラー: ${workspaceError.message}`);
                }
            }
            // グローバル設定から有効な値が取得できた場合の処理
            if (globalExpiry) {
                // 現在時刻と比較して有効期限が未来の場合のみ有効と判断
                const currentTime = Math.floor(Date.now() / 1000);
                if (globalExpiry > currentTime) {
                    // グローバル設定から取得できた場合、SecretStorageに同期しておく
                    await this.set(this.TOKEN_EXPIRY_KEY, globalExpiry.toString());
                    // メモリキャッシュにも保存（冗長性向上）
                    this._updateMemoryCache('tokenExpiry', globalExpiry);
                    return globalExpiry;
                }
                else {
                    logger_1.Logger.warn(`AuthStorageManager: グローバル設定のトークン有効期限が過去の日時です (${new Date(globalExpiry * 1000).toLocaleString()})`);
                }
            }
            // メモリキャッシュからの回復を試みる
            const cachedExpiry = this._getFromMemoryCache('tokenExpiry');
            if (cachedExpiry && typeof cachedExpiry === 'number') {
                logger_1.Logger.info(`AuthStorageManager: メモリキャッシュからトークン有効期限を回復 (${new Date(cachedExpiry * 1000).toLocaleString()}まで)`);
                // 現在時刻と比較して有効期限が未来の場合のみ有効と判断
                const currentTime = Math.floor(Date.now() / 1000);
                if (cachedExpiry > currentTime) {
                    // キャッシュから取得できた場合、ストレージに同期を試みる
                    await this.set(this.TOKEN_EXPIRY_KEY, cachedExpiry.toString());
                    // グローバル設定への保存も試みるが、エラーをキャッチする
                    try {
                        await vscode.workspace.getConfiguration().update('appgenius.global.tokenExpiry', cachedExpiry, vscode.ConfigurationTarget.Global);
                    }
                    catch (configError) {
                        // 設定更新エラーはログのみ（キャッシュからの値は返せるので）
                        logger_1.Logger.warn(`設定更新エラー: ${configError.message}`);
                    }
                    return cachedExpiry;
                }
            }
            logger_1.Logger.debug('AuthStorageManager: トークン有効期限が見つかりません');
            return undefined;
        }
        catch (error) {
            logger_1.Logger.error('AuthStorageManager: トークン有効期限の取得中にエラー', error);
            // エラー発生時もメモリキャッシュから回復を試みる
            try {
                const cachedExpiry = this._getFromMemoryCache('tokenExpiry');
                if (cachedExpiry && typeof cachedExpiry === 'number') {
                    logger_1.Logger.info('AuthStorageManager: エラー発生後、メモリキャッシュからトークン有効期限を回復');
                    return cachedExpiry;
                }
            }
            catch (cacheError) {
                logger_1.Logger.error('AuthStorageManager: メモリキャッシュからの回復にも失敗', cacheError);
            }
            return undefined;
        }
    }
    /**
     * メモリキャッシュに値を保存
     * VSCode再起動時にはリセットされるが、ストレージアクセスエラー時のフォールバックとして使用
     */
    _updateMemoryCache(key, value) {
        AuthStorageManager._memoryCache.set(key, value);
    }
    /**
     * メモリキャッシュから値を取得
     */
    _getFromMemoryCache(key) {
        return AuthStorageManager._memoryCache.get(key);
    }
    /**
     * トークン有効期限を更新
     * TokenManagerの新機能をサポートするための追加メソッド
     */
    async updateTokenExpiry(expiryTime) {
        try {
            // SecretStorageに保存
            await this.set(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
            // グローバル設定にも保存
            try {
                await vscode.workspace.getConfiguration().update('appgenius.global.tokenExpiry', expiryTime, vscode.ConfigurationTarget.Global);
            }
            catch (configError) {
                // 設定が登録されていない場合のエラーをログに記録
                logger_1.Logger.warn(`設定更新エラー: ${configError.message}`);
                logger_1.Logger.info('グローバル設定の更新はスキップします。メモリキャッシュを使用します');
            }
            // メモリキャッシュには常に保存
            this._updateMemoryCache('tokenExpiry', expiryTime);
            logger_1.Logger.debug(`AuthStorageManager: トークン有効期限を更新しました (${new Date(expiryTime * 1000).toLocaleString()}まで)`);
        }
        catch (error) {
            logger_1.Logger.error('AuthStorageManager: トークン有効期限更新エラー', error);
            throw error;
        }
    }
    /**
     * ユーザーデータの保存
     * SecretStorageとVSCodeグローバル設定の両方に保存して信頼性を向上
     */
    async setUserData(userData) {
        try {
            // 完全なユーザーデータをSecretStorageに保存
            await this.set(this.USER_DATA_KEY, userData);
            // 重要なユーザー情報をグローバル設定にも保存（VSCode再起動時用）
            // 重要: センシティブ情報は含めないこと
            const minimalUserData = {
                id: userData.id,
                name: userData.name,
                role: userData.role,
                lastSaved: new Date().toISOString()
            };
            await vscode.workspace.getConfiguration('appgenius').update('global.userData', minimalUserData, vscode.ConfigurationTarget.Global);
            logger_1.Logger.debug('AuthStorageManager: ユーザーデータを保存しました');
        }
        catch (error) {
            logger_1.Logger.error('ユーザーデータ保存中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * ユーザーデータの取得
     * SecretStorageから取得し、必要に応じてグローバル設定をフォールバックとして使用
     */
    async getUserData() {
        try {
            // まずSecretStorageから取得を試みる
            const userData = await this.getObject(this.USER_DATA_KEY);
            if (userData) {
                return userData;
            }
            // グローバル設定から最小限のユーザーデータを取得
            const minimalUserData = vscode.workspace.getConfiguration('appgenius').get('global.userData');
            if (minimalUserData) {
                logger_1.Logger.info('SecretStorageからユーザーデータを取得できませんでした。グローバル設定からの最小限データを使用します。');
                // SecretStorageに同期しておく
                // minimalUserDataをstringに変換して保存
                const userData = typeof minimalUserData === 'object'
                    ? JSON.stringify(minimalUserData)
                    : String(minimalUserData);
                await this.set(this.USER_DATA_KEY, userData);
                return minimalUserData;
            }
            return undefined;
        }
        catch (error) {
            logger_1.Logger.error('ユーザーデータ取得中にエラーが発生しました', error);
            return undefined;
        }
    }
    /**
     * 全ての認証データを削除
     * SecretStorageとVSCodeグローバル設定の両方をクリア
     */
    async clearAll() {
        try {
            // SecretStorageのデータを削除
            await this.remove(this.ACCESS_TOKEN_KEY);
            await this.remove(this.REFRESH_TOKEN_KEY);
            await this.remove(this.TOKEN_EXPIRY_KEY);
            await this.remove(this.USER_DATA_KEY);
            // グローバル設定の認証関連データも削除
            await vscode.workspace.getConfiguration().update('appgenius.global.tokenExpiry', undefined, vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration().update('appgenius.global.hasRefreshToken', undefined, vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration().update('appgenius.global.userData', undefined, vscode.ConfigurationTarget.Global);
            logger_1.Logger.info('AuthStorageManager: すべての認証データを削除しました');
        }
        catch (error) {
            logger_1.Logger.error('認証データ削除中にエラーが発生しました', error);
            throw error;
        }
    }
}
exports.AuthStorageManager = AuthStorageManager;
// メモリキャッシュ用プライベートデータ
AuthStorageManager._memoryCache = new Map();
//# sourceMappingURL=AuthStorageManager.js.map