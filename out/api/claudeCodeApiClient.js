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
exports.ClaudeCodeApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const AuthenticationService_1 = require("../core/auth/AuthenticationService");
const SimpleAuthService_1 = require("../core/auth/SimpleAuthService");
const logger_1 = require("../utils/logger");
const ErrorHandler_1 = require("../utils/ErrorHandler");
/**
 * ClaudeCodeApiClient - ClaudeCode CLIと連携するためのAPIクライアント
 *
 * プロンプトライブラリやユーザー認証情報の同期に使用します。
 */
class ClaudeCodeApiClient {
    /**
     * コンストラクタ
     */
    constructor() {
        this._useSimpleAuth = true;
        // SimpleAuthServiceを優先使用
        try {
            this._simpleAuthService = SimpleAuthService_1.SimpleAuthService.getInstance();
            this._useSimpleAuth = true;
            logger_1.Logger.info('ClaudeCodeApiClient: SimpleAuthServiceを使用します');
        }
        catch (error) {
            // SimpleAuthServiceが初期化されていない場合はレガシー認証を使用
            logger_1.Logger.warn('ClaudeCodeApiClient: SimpleAuthServiceの取得に失敗、レガシー認証に切り替えます', error);
            this._legacyAuthService = AuthenticationService_1.AuthenticationService.getInstance();
            this._useSimpleAuth = false;
        }
        this._errorHandler = ErrorHandler_1.ErrorHandler.getInstance();
        // API URLを環境変数から取得、またはデフォルト値を使用
        this._baseUrl = process.env.PORTAL_API_URL || 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';
        logger_1.Logger.info('ClaudeCodeApiClient initialized with baseUrl: ' + this._baseUrl);
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ClaudeCodeApiClient.instance) {
            ClaudeCodeApiClient.instance = new ClaudeCodeApiClient();
        }
        return ClaudeCodeApiClient.instance;
    }
    /**
     * API呼び出し用の設定を取得
     */
    async _getApiConfig() {
        let authHeader = {};
        // SimpleAuthを使用している場合は直接ヘッダーを取得
        if (this._useSimpleAuth && this._simpleAuthService) {
            // APIキーの有無を確認 (非同期で取得)
            const apiKey = await this._simpleAuthService.getApiKey();
            if (apiKey) {
                // APIキーがある場合はAPIキーヘッダーを設定
                authHeader = {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                };
                logger_1.Logger.debug('ClaudeCodeApiClient: APIキーを使用します');
            }
            else {
                // 通常の認証ヘッダーを取得
                authHeader = this._simpleAuthService.getAuthHeader();
                logger_1.Logger.debug('ClaudeCodeApiClient: SimpleAuthServiceからヘッダーを取得しました');
            }
        }
        // レガシー認証の場合は非同期で取得
        else if (this._legacyAuthService) {
            authHeader = await this._legacyAuthService.getAuthHeader() || {};
            logger_1.Logger.debug('ClaudeCodeApiClient: レガシー認証からヘッダーを取得しました');
        }
        return {
            headers: authHeader
        };
    }
    /**
     * プロンプト一覧を取得
     * @param filters フィルター条件（カテゴリ、タグなど）
     */
    async getPrompts(filters) {
        try {
            const config = await this._getApiConfig();
            // フィルターをクエリパラメータに変換
            let queryParams = '';
            if (filters) {
                const params = new URLSearchParams();
                if (filters.category) {
                    params.append('category', filters.category);
                }
                if (filters.tags && filters.tags.length > 0) {
                    params.append('tags', filters.tags.join(','));
                }
                queryParams = `?${params.toString()}`;
            }
            const response = await axios_1.default.get(`${this._baseUrl}/sdk/prompts${queryParams}`, config);
            if (response.status === 200 && Array.isArray(response.data.prompts)) {
                return response.data.prompts;
            }
            return [];
        }
        catch (error) {
            console.error('プロンプト一覧の取得に失敗しました:', error);
            this._handleApiError(error);
            return [];
        }
    }
    /**
     * プロンプトの詳細を取得
     * @param promptId プロンプトID
     */
    async getPromptDetail(promptId) {
        try {
            const config = await this._getApiConfig();
            const response = await axios_1.default.get(`${this._baseUrl}/sdk/prompts/${promptId}`, config);
            if (response.status === 200 && response.data.prompt) {
                return response.data.prompt;
            }
            return null;
        }
        catch (error) {
            console.error(`プロンプト詳細の取得に失敗しました (ID: ${promptId}):`, error);
            this._handleApiError(error);
            return null;
        }
    }
    /**
     * プロンプトのバージョン履歴を取得
     * @param promptId プロンプトID
     */
    async getPromptVersions(promptId) {
        try {
            const config = await this._getApiConfig();
            const response = await axios_1.default.get(`${this._baseUrl}/sdk/prompts/${promptId}/versions`, config);
            // レスポンスがオブジェクトかつversionsプロパティがある場合、またはレスポンスが直接配列の場合に対応
            if (response.status === 200) {
                if (Array.isArray(response.data.versions)) {
                    return response.data.versions;
                }
                else if (Array.isArray(response.data)) {
                    return response.data;
                }
            }
            return [];
        }
        catch (error) {
            console.error(`プロンプトバージョン履歴の取得に失敗しました (ID: ${promptId}):`, error);
            this._handleApiError(error);
            return [];
        }
    }
    /**
     * プロンプト使用履歴を記録 (使用統計機能削除済み)
     * @param promptId プロンプトID
     * @param versionId バージョンID
     * @param context 使用コンテキスト
     * @returns 記録が成功したかどうか
     * @deprecated 使用統計機能は削除されました。後方互換性のために維持されています。
     */
    async recordPromptUsage(promptId, versionId, context) {
        // 使用統計機能は削除されたため、実際にはAPIを呼び出さない
        // 後方互換性のために、成功したというレスポンスを返す
        logger_1.Logger.info(`プロンプト使用履歴記録 (非推奨) - promptId: ${promptId}, versionId: ${versionId}`);
        return true;
    }
    /**
     * プロンプト同期情報を取得
     * 最後の同期以降に更新されたプロンプト情報を取得します
     * @param lastSyncTimestamp 最後の同期タイムスタンプ
     */
    async getSyncUpdates(lastSyncTimestamp) {
        try {
            const config = await this._getApiConfig();
            let endpoint = `${this._baseUrl}/sdk/prompts/sync`;
            if (lastSyncTimestamp) {
                endpoint += `?since=${lastSyncTimestamp}`;
            }
            const response = await axios_1.default.get(endpoint, config);
            if (response.status === 200) {
                return {
                    prompts: response.data.prompts || [],
                    timestamp: response.data.timestamp || Date.now()
                };
            }
            return {
                prompts: [],
                timestamp: Date.now()
            };
        }
        catch (error) {
            console.error('プロンプト同期情報の取得に失敗しました:', error);
            this._handleApiError(error);
            return {
                prompts: [],
                timestamp: Date.now()
            };
        }
    }
    /**
     * 指数バックオフとジッターを用いたリトライ処理
     * @param operation 実行する非同期操作
     * @param maxRetries 最大リトライ回数
     * @param retryableStatusCodes リトライ可能なHTTPステータスコード
     * @param operationName 操作名（ログ用）
     * @returns 操作の結果
     */
    async _retryWithExponentialBackoff(operation, maxRetries = 3, retryableStatusCodes = [429, 500, 502, 503, 504], operationName = '操作') {
        let retries = 0;
        const baseDelay = 1000; // 1秒
        while (true) {
            try {
                return await operation();
            }
            catch (error) {
                retries++;
                // エラーを適切にログに記録
                logger_1.Logger.error(`【API連携】${operationName}に失敗しました (${retries}回目)`, error);
                // リトライ判断
                let shouldRetry = false;
                if (axios_1.default.isAxiosError(error)) {
                    const statusCode = error.response?.status;
                    // 認証エラーの場合、トークンをリフレッシュしてリトライ
                    if (statusCode === 401) {
                        logger_1.Logger.info('【API連携】トークンの有効期限切れ。リフレッシュを試みます');
                        let refreshSucceeded = false;
                        // SimpleAuthを使用している場合
                        if (this._useSimpleAuth && this._simpleAuthService) {
                            const verified = await this._simpleAuthService.verifyAuthState();
                            refreshSucceeded = verified;
                            logger_1.Logger.info(`【API連携】SimpleAuthService検証結果: ${verified}`);
                        }
                        // レガシー認証の場合
                        else if (this._legacyAuthService) {
                            refreshSucceeded = await this._legacyAuthService.refreshToken();
                            logger_1.Logger.info(`【API連携】レガシー認証リフレッシュ結果: ${refreshSucceeded}`);
                        }
                        shouldRetry = refreshSucceeded && retries <= maxRetries;
                        if (!refreshSucceeded && retries >= maxRetries) {
                            // 最大リトライ回数に達し、かつリフレッシュに失敗した場合はログアウト
                            logger_1.Logger.warn('【API連携】トークンリフレッシュに失敗し、最大リトライ回数に達しました。ログアウトします');
                            // 適切な認証サービスでログアウト
                            if (this._useSimpleAuth && this._simpleAuthService) {
                                await this._simpleAuthService.logout();
                            }
                            else if (this._legacyAuthService) {
                                await this._legacyAuthService.logout();
                            }
                            vscode.window.showErrorMessage('認証の有効期限が切れました。再度ログインしてください。');
                        }
                    }
                    // ネットワークエラーまたは特定のステータスコードならリトライ
                    else if (!statusCode || retryableStatusCodes.includes(statusCode)) {
                        shouldRetry = retries <= maxRetries;
                    }
                }
                else {
                    // その他のエラーの場合もリトライ
                    shouldRetry = retries <= maxRetries;
                }
                // リトライしない場合はエラーを再スロー
                if (!shouldRetry) {
                    // ErrorHandlerを使用して詳細なエラー情報を記録
                    this._errorHandler.handleError(error, 'ClaudeCodeApiClient');
                    throw error;
                }
                // 指数バックオフ + ジッター計算
                const delay = baseDelay * Math.pow(2, retries - 1) * (0.5 + Math.random() * 0.5);
                logger_1.Logger.info(`【API連携】${operationName}を${delay}ms後に再試行します (${retries}/${maxRetries})`);
                // 指定時間待機
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    /**
     * APIエラー処理
     * 認証エラーの場合はトークンリフレッシュを試みる
     */
    async _handleApiError(error) {
        // ErrorHandlerを使用して詳細なエラー情報を記録
        this._errorHandler.handleError(error, 'ClaudeCodeApiClient');
        if (axios_1.default.isAxiosError(error)) {
            const statusCode = error.response?.status;
            if (statusCode === 401) {
                // 認証エラーの場合、トークンリフレッシュを試みる
                logger_1.Logger.info('【API連携】認証エラー(401)。トークンリフレッシュを試みます');
                let refreshSucceeded = false;
                // SimpleAuthを使用している場合
                if (this._useSimpleAuth && this._simpleAuthService) {
                    const verified = await this._simpleAuthService.verifyAuthState();
                    refreshSucceeded = verified;
                    logger_1.Logger.info(`【API連携】SimpleAuthService検証結果: ${verified}`);
                }
                // レガシー認証の場合
                else if (this._legacyAuthService) {
                    refreshSucceeded = await this._legacyAuthService.refreshToken();
                    logger_1.Logger.info(`【API連携】レガシー認証リフレッシュ結果: ${refreshSucceeded}`);
                }
                if (!refreshSucceeded) {
                    // リフレッシュに失敗した場合はログアウト
                    logger_1.Logger.warn('【API連携】トークンリフレッシュに失敗しました。ログアウトします');
                    // 適切な認証サービスでログアウト
                    if (this._useSimpleAuth && this._simpleAuthService) {
                        await this._simpleAuthService.logout();
                    }
                    else if (this._legacyAuthService) {
                        await this._legacyAuthService.logout();
                    }
                    vscode.window.showErrorMessage('認証の有効期限が切れました。再度ログインしてください。');
                }
            }
            else if (statusCode === 403) {
                // 権限エラー
                logger_1.Logger.warn('【API連携】権限エラー(403): アクセス権限がありません');
                vscode.window.showErrorMessage('この操作を行う権限がありません。');
            }
            else if (statusCode === 404) {
                // リソースが見つからない
                logger_1.Logger.warn(`【API連携】リソースが見つかりません(404): ${error.config?.url}`);
                vscode.window.showErrorMessage('リクエストされたリソースが見つかりません。');
            }
            else if (statusCode && statusCode >= 500) {
                // サーバーエラー
                logger_1.Logger.error(`【API連携】サーバーエラー(${statusCode}): ${error.config?.url}`, error);
                vscode.window.showErrorMessage(`サーバーエラーが発生しました(${statusCode})。しばらく時間をおいて再試行してください。`);
            }
            else {
                // その他のエラー
                const errorMessage = error.response?.data?.message
                    ? error.response.data.message
                    : '不明なエラーが発生しました。';
                logger_1.Logger.error(`【API連携】API呼び出しエラー: ${errorMessage}`, error);
                vscode.window.showErrorMessage(`API呼び出し中にエラーが発生しました: ${errorMessage}`);
            }
        }
        else {
            // Axiosエラーでない場合
            const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
            logger_1.Logger.error(`【API連携】不明なエラー: ${errorMessage}`, error instanceof Error ? error : new Error(errorMessage));
            vscode.window.showErrorMessage(`API呼び出し中にエラーが発生しました: ${errorMessage}`);
        }
    }
    /**
     * 公開URLからプロンプトを取得
     * @param url プロンプトの公開URL
     * @returns プロンプト情報
     */
    async getPromptFromPublicUrl(url) {
        try {
            return await this._retryWithExponentialBackoff(async () => {
                // URLからトークンを抽出（例: https://example.com/api/prompts/public/abcd1234 からabcd1234を抽出）
                const token = url.split('/').pop();
                if (!token) {
                    throw new Error('Invalid prompt URL format');
                }
                // トークンを使用して公開APIからプロンプト情報を取得
                // 認証不要のため、通常のaxiosインスタンスを使用
                // URLからベースURLを抽出せず、代わりにデフォルトのAPIエンドポイントを使用する
                const baseUrl = this._baseUrl;
                logger_1.Logger.info(`【API連携】公開プロンプトの取得を開始: ${baseUrl}/prompts/public/${token} (元URL: ${url})`);
                const response = await axios_1.default.get(`${baseUrl}/prompts/public/${token}`);
                if (response.status === 200 && response.data) {
                    logger_1.Logger.info('【API連携】公開プロンプトの取得が成功しました');
                    return response.data;
                }
                return null;
            }, 3, [429, 500, 502, 503, 504], '公開プロンプト取得');
        }
        catch (error) {
            logger_1.Logger.error(`【API連携】公開URLからのプロンプト取得に失敗しました (URL: ${url})`, error);
            this._handleApiError(error);
            return null;
        }
    }
    /**
     * API接続テスト
     * このメソッドは認証状態を確認し、APIサーバーとの接続性をテストします
     * シンプル認証方式に対応
     * @returns テスト成功の場合はtrue、失敗の場合はfalse
     */
    async testApiConnection() {
        try {
            logger_1.Logger.info('【API連携】API接続テストを開始');
            // SimpleAuthを使用している場合は、認証状態とアクセストークンを両方チェック
            if (this._useSimpleAuth && this._simpleAuthService) {
                logger_1.Logger.info('【API連携】シンプル認証を使用してAPI接続テスト');
                // SimpleAuthServiceの認証状態を直接確認
                const isAuthenticated = this._simpleAuthService.isAuthenticated();
                // アクセストークンの有効性も確認
                const accessToken = this._simpleAuthService.getAccessToken();
                // 詳細なデバッグ情報を出力
                logger_1.Logger.debug(`【API連携】SimpleAuthService認証状態: ${isAuthenticated}, トークン存在: ${!!accessToken}`);
                if (accessToken) {
                    logger_1.Logger.debug(`【API連携】トークンプレビュー: ${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 5)}`);
                }
                // 詳細な認証状態を出力（デバッグ用）
                try {
                    // 現在の認証状態の詳細を出力
                    const currentState = this._simpleAuthService.getCurrentState();
                    logger_1.Logger.debug(`【API連携】現在の認証状態詳細: isAuthenticated=${currentState.isAuthenticated}, userName=${currentState.username || 'なし'}, userId=${currentState.userId || 'なし'}, role=${currentState.role}`);
                    // API BASE URLを出力
                    logger_1.Logger.debug(`【API連携】APIベースURL検証: ${this._baseUrl}`);
                }
                catch (debugError) {
                    logger_1.Logger.error('【API連携】デバッグ情報取得エラー:', debugError);
                }
                // 認証状態とアクセストークンの両方が有効な場合に成功とみなす
                if (isAuthenticated && accessToken) {
                    logger_1.Logger.info('【API連携】シンプル認証状態とトークンは有効です。API接続テストに成功したとみなします');
                    return true;
                }
                else {
                    logger_1.Logger.warn('【API連携】シンプル認証状態またはトークンが無効です');
                    return false;
                }
            }
            // レガシー認証の場合は従来のエンドポイントを使用
            logger_1.Logger.info('【API連携】レガシー認証を使用してAPI接続テスト');
            // 認証ヘッダーを取得
            const config = await this._getApiConfig();
            // 認証ヘッダーの存在を確認
            const headers = config?.headers;
            const hasAuthHeader = headers && (headers['Authorization'] || headers['authorization'] || headers['x-api-key']);
            if (!hasAuthHeader) {
                logger_1.Logger.warn('【API連携】認証ヘッダーが不足しています');
                return false;
            }
            // 軽量なエンドポイント（/api/auth/users/me）を使用してAPIテスト
            const response = await axios_1.default.get(`${this._baseUrl}/auth/users/me`, {
                ...config,
                timeout: 5000 // 5秒タイムアウト（短く設定して迅速にテスト）
            });
            // ステータスコード200かつユーザー情報があればOK
            if (response.status === 200 && response.data.user) {
                logger_1.Logger.info('【API連携】API接続テストに成功しました');
                return true;
            }
            logger_1.Logger.warn(`【API連携】API接続テスト：予期しないレスポンス形式 (${response.status})`);
            return false;
        }
        catch (error) {
            // エラーの詳細をログに記録
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    logger_1.Logger.warn('【API連携】API接続テスト：認証エラー (401)');
                }
                else if (error.response) {
                    logger_1.Logger.error(`【API連携】API接続テスト：サーバーエラー (${error.response.status})`, error);
                }
                else {
                    logger_1.Logger.error('【API連携】API接続テスト：ネットワークエラー', error);
                }
            }
            else {
                logger_1.Logger.error(`【API連携】API接続テスト：不明なエラー: ${error.message}`, error);
            }
            return false;
        }
    }
    /**
     * Claude APIのトークン使用を記録
     * @param tokenCount 使用されたトークン数
     * @param modelId モデルID (例: "claude-3-opus-20240229")
     * @param context 使用コンテキスト (オプション)
     * @returns 常にtrueを返す（使用履歴記録機能は削除済み）
     * @deprecated 使用量記録機能は削除されました。互換性のために空の実装を維持しています。
     */
    async recordTokenUsage(tokenCount, modelId, context) {
        // トークン使用量記録機能は削除されました
        // 互換性のために常にtrueを返すだけのメソッドとして維持しています
        logger_1.Logger.debug(`【API連携】トークン使用履歴記録は無効化されています (${modelId}, ${context || 'no-context'})`);
        return true;
    }
    /**
     * ClaudeCode起動カウンターをインクリメント
     * @param userId ユーザーID
     */
    async incrementClaudeCodeLaunchCount(userId) {
        try {
            logger_1.Logger.info(`【API連携】ClaudeCode起動カウンターを更新します: ユーザーID ${userId}`);
            logger_1.Logger.info(`【デバッグ】API呼び出し準備: ユーザーID=${userId}, APIベースURL=${this._baseUrl}`);
            // API設定を取得して詳細をログに出力
            const config = await this._getApiConfig();
            const hasAuthHeader = config?.headers && (config.headers['Authorization'] || config.headers['authorization'] || config.headers['x-api-key']);
            logger_1.Logger.info(`【デバッグ】API認証ヘッダー: ${hasAuthHeader ? '存在します' : '存在しません'}`);
            if (hasAuthHeader && config.headers) {
                // ヘッダーの種類と先頭部分を出力（セキュリティのため全体は出力しない）
                if (config.headers['Authorization']) {
                    logger_1.Logger.info(`【デバッグ】Authorization ヘッダー: ${config.headers['Authorization'].substring(0, 15)}...`);
                }
                else if (config.headers['authorization']) {
                    logger_1.Logger.info(`【デバッグ】authorization ヘッダー: ${config.headers['authorization'].substring(0, 15)}...`);
                }
                else if (config.headers['x-api-key']) {
                    logger_1.Logger.info(`【デバッグ】x-api-key ヘッダー: ${config.headers['x-api-key'].substring(0, 10)}...`);
                }
            }
            // APIエンドポイントURL
            const url = `${this._baseUrl}/simple/users/${userId}/increment-claude-code-launch`;
            logger_1.Logger.info(`【デバッグ】API呼び出しURL: ${url}`);
            // APIリクエスト送信
            logger_1.Logger.info(`【デバッグ】API呼び出し開始: POST ${url}`);
            const response = await axios_1.default.post(url, {}, config);
            // レスポンス分析
            logger_1.Logger.info(`【デバッグ】API呼び出しステータス: ${response.status} ${response.statusText}`);
            logger_1.Logger.info(`【デバッグ】APIレスポンス: ${JSON.stringify(response.data)}`);
            if (response.status === 200) {
                // 詳細なレスポンス情報をログ出力
                const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
                const isSuccess = response.data?.success === true;
                logger_1.Logger.info(`【API連携】ClaudeCode起動カウンター更新成功: 新しい値=${newCount}, 成功フラグ=${isSuccess}`);
                return response.data;
            }
            logger_1.Logger.warn(`【API連携】ClaudeCode起動カウンター更新：予期しないレスポンス (${response.status})`);
            return null;
        }
        catch (error) {
            logger_1.Logger.error('【API連携】ClaudeCode起動カウンター更新エラー:', error);
            // エラーの詳細を分析
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    logger_1.Logger.error(`【デバッグ】APIエラー: ステータス=${error.response.status}, データ=${JSON.stringify(error.response.data)}`);
                }
                else if (error.request) {
                    logger_1.Logger.error(`【デバッグ】APIエラー: リクエストは送信されましたがレスポンスがありません`);
                }
                else {
                    logger_1.Logger.error(`【デバッグ】APIエラー: リクエスト設定中にエラーが発生しました: ${error.message}`);
                }
                // URL情報
                if (error.config?.url) {
                    logger_1.Logger.error(`【デバッグ】APIエラー: URL=${error.config.url}`);
                }
            }
            this._handleApiError(error);
            return null;
        }
    }
}
exports.ClaudeCodeApiClient = ClaudeCodeApiClient;
//# sourceMappingURL=claudeCodeApiClient.js.map