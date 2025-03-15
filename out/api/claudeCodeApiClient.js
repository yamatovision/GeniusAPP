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
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        // API URLを環境変数から取得、またはデフォルト値を使用
        this._baseUrl = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
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
        const authHeader = await this._authService.getAuthHeader();
        return {
            headers: authHeader || {}
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
            if (response.status === 200 && Array.isArray(response.data.versions)) {
                return response.data.versions;
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
     * プロンプト使用履歴を記録
     * @param promptId プロンプトID
     * @param versionId バージョンID
     * @param context 使用コンテキスト
     */
    async recordPromptUsage(promptId, versionId, context) {
        try {
            const config = await this._getApiConfig();
            const payload = {
                promptId,
                versionId,
                context: context || 'claude-code-extension'
            };
            const response = await axios_1.default.post(`${this._baseUrl}/sdk/prompts/usage`, payload, config);
            return response.status === 201;
        }
        catch (error) {
            console.error('プロンプト使用履歴の記録に失敗しました:', error);
            this._handleApiError(error);
            return false;
        }
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
     * APIエラー処理
     * 認証エラーの場合はトークンリフレッシュを試みる
     */
    async _handleApiError(error) {
        if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
            // 認証エラーの場合、トークンリフレッシュを試みる
            const refreshSucceeded = await this._authService.refreshToken();
            if (!refreshSucceeded) {
                // リフレッシュに失敗した場合はログアウト
                await this._authService.logout();
                vscode.window.showErrorMessage('認証の有効期限が切れました。再度ログインしてください。');
            }
        }
        else if (axios_1.default.isAxiosError(error) && error.response?.status === 403) {
            // 権限エラー
            vscode.window.showErrorMessage('この操作を行う権限がありません。');
        }
        else if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
            // リソースが見つからない
            vscode.window.showErrorMessage('リクエストされたリソースが見つかりません。');
        }
        else {
            // その他のエラー
            const errorMessage = axios_1.default.isAxiosError(error) && error.response?.data?.message
                ? error.response.data.message
                : '不明なエラーが発生しました。';
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
            // URLからトークンを抽出（例: https://example.com/api/prompts/public/abcd1234 からabcd1234を抽出）
            const token = url.split('/').pop();
            if (!token) {
                throw new Error('Invalid prompt URL format');
            }
            // トークンを使用して公開APIからプロンプト情報を取得
            // 認証不要のため、通常のaxiosインスタンスを使用
            const baseUrl = new URL(url).origin + '/api';
            const response = await axios_1.default.get(`${baseUrl}/prompts/public/${token}`);
            if (response.status === 200 && response.data) {
                return response.data;
            }
            return null;
        }
        catch (error) {
            console.error(`公開URLからのプロンプト取得に失敗しました (URL: ${url}):`, error);
            this._handleApiError(error);
            return null;
        }
    }
}
exports.ClaudeCodeApiClient = ClaudeCodeApiClient;
//# sourceMappingURL=claudeCodeApiClient.js.map