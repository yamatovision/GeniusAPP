import axios from 'axios';
import * as vscode from 'vscode';
import { AuthenticationService } from '../core/auth/AuthenticationService';

/**
 * ClaudeCodeApiClient - ClaudeCode CLIと連携するためのAPIクライアント
 * 
 * プロンプトライブラリやユーザー認証情報の同期に使用します。
 */
export class ClaudeCodeApiClient {
  private static instance: ClaudeCodeApiClient;
  private _authService: AuthenticationService;
  private _baseUrl: string;

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    // API URLを環境変数から取得、またはデフォルト値を使用
    this._baseUrl = process.env.PORTAL_API_URL || 'https://geniemon-portal-backend-production.up.railway.app/api';
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeCodeApiClient {
    if (!ClaudeCodeApiClient.instance) {
      ClaudeCodeApiClient.instance = new ClaudeCodeApiClient();
    }
    return ClaudeCodeApiClient.instance;
  }

  /**
   * API呼び出し用の設定を取得
   */
  private async _getApiConfig() {
    const authHeader = await this._authService.getAuthHeader();
    return {
      headers: authHeader || {}
    };
  }

  /**
   * プロンプト一覧を取得
   * @param filters フィルター条件（カテゴリ、タグなど）
   */
  public async getPrompts(filters?: { category?: string, tags?: string[] }): Promise<any[]> {
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
      
      const response = await axios.get(`${this._baseUrl}/sdk/prompts${queryParams}`, config);
      
      if (response.status === 200 && Array.isArray(response.data.prompts)) {
        return response.data.prompts;
      }
      
      return [];
    } catch (error) {
      console.error('プロンプト一覧の取得に失敗しました:', error);
      this._handleApiError(error);
      return [];
    }
  }

  /**
   * プロンプトの詳細を取得
   * @param promptId プロンプトID
   */
  public async getPromptDetail(promptId: string): Promise<any | null> {
    try {
      const config = await this._getApiConfig();
      const response = await axios.get(`${this._baseUrl}/sdk/prompts/${promptId}`, config);
      
      if (response.status === 200 && response.data.prompt) {
        return response.data.prompt;
      }
      
      return null;
    } catch (error) {
      console.error(`プロンプト詳細の取得に失敗しました (ID: ${promptId}):`, error);
      this._handleApiError(error);
      return null;
    }
  }

  /**
   * プロンプトのバージョン履歴を取得
   * @param promptId プロンプトID
   */
  public async getPromptVersions(promptId: string): Promise<any[]> {
    try {
      const config = await this._getApiConfig();
      const response = await axios.get(`${this._baseUrl}/sdk/prompts/${promptId}/versions`, config);
      
      if (response.status === 200 && Array.isArray(response.data.versions)) {
        return response.data.versions;
      }
      
      return [];
    } catch (error) {
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
   * @returns 記録が成功したかどうか
   */
  public async recordPromptUsage(promptId: string, versionId: string, context?: string): Promise<boolean> {
    // リトライ設定
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const config = await this._getApiConfig();
        const payload = {
          versionId,
          context: context || 'claude-code-extension'
        };
        
        // 正しいエンドポイントパス: /prompts/{promptId}/usage
        const response = await axios.post(
          `${this._baseUrl}/prompts/${promptId}/usage`, 
          payload, 
          {
            ...config,
            timeout: 15000 // 15秒タイムアウト
          }
        );
        
        return response.status === 201;
      } catch (error) {
        retryCount++;
        
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;
          
          // 500エラー（サーバーエラー）またはタイムアウトの場合はリトライ
          if ((statusCode === 500 || error.code === 'ECONNABORTED') && retryCount <= maxRetries) {
            // 指数バックオフ（リトライ間隔を徐々に増やす）
            const waitTime = retryDelay * Math.pow(2, retryCount - 1);
            console.warn(`プロンプト使用履歴の記録中にエラーが発生しました。${waitTime}ms後にリトライします (${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else if (statusCode === 404) {
            // 404エラー（Not Found）の場合はレガシーエンドポイントを試す
            // これは後方互換性のための一時的な措置
            if (retryCount === 1) { // 初回リトライでのみレガシーエンドポイントを試す
              try {
                console.warn('レガシーエンドポイントでプロンプト使用履歴の記録を試みます...');
                const legacyConfig = await this._getApiConfig();
                const legacyResponse = await axios.post(
                  `${this._baseUrl}/sdk/prompts/usage`, 
                  {
                    promptId,
                    versionId,
                    context: context || 'claude-code-extension'
                  }, 
                  legacyConfig
                );
                return legacyResponse.status === 201;
              } catch (legacyError) {
                console.error('レガシーエンドポイントでの記録にも失敗しました:', legacyError);
              }
            }
          }
        }
        
        // 最大リトライ回数に達した場合またはリトライ対象外のエラーの場合
        if (retryCount > maxRetries) {
          // 使用履歴記録のエラーはログに残すだけで、UI通知は行わない
          console.error('プロンプト使用履歴の記録に失敗しました:', error);
          return false;
        }
      }
    }
    
    return false; // コードがここに到達することはないはずだが、コンパイラを満足させるため
  }

  /**
   * プロンプト同期情報を取得
   * 最後の同期以降に更新されたプロンプト情報を取得します
   * @param lastSyncTimestamp 最後の同期タイムスタンプ
   */
  public async getSyncUpdates(lastSyncTimestamp?: number): Promise<any> {
    try {
      const config = await this._getApiConfig();
      let endpoint = `${this._baseUrl}/sdk/prompts/sync`;
      
      if (lastSyncTimestamp) {
        endpoint += `?since=${lastSyncTimestamp}`;
      }
      
      const response = await axios.get(endpoint, config);
      
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
    } catch (error) {
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
  private async _handleApiError(error: any): Promise<void> {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // 認証エラーの場合、トークンリフレッシュを試みる
      const refreshSucceeded = await this._authService.refreshToken();
      if (!refreshSucceeded) {
        // リフレッシュに失敗した場合はログアウト
        await this._authService.logout();
        vscode.window.showErrorMessage('認証の有効期限が切れました。再度ログインしてください。');
      }
    } else if (axios.isAxiosError(error) && error.response?.status === 403) {
      // 権限エラー
      vscode.window.showErrorMessage('この操作を行う権限がありません。');
    } else if (axios.isAxiosError(error) && error.response?.status === 404) {
      // リソースが見つからない
      vscode.window.showErrorMessage('リクエストされたリソースが見つかりません。');
    } else {
      // その他のエラー
      const errorMessage = axios.isAxiosError(error) && error.response?.data?.message
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
  public async getPromptFromPublicUrl(url: string): Promise<any | null> {
    try {
      // URLからトークンを抽出（例: https://example.com/api/prompts/public/abcd1234 からabcd1234を抽出）
      const token = url.split('/').pop();

      if (!token) {
        throw new Error('Invalid prompt URL format');
      }

      // トークンを使用して公開APIからプロンプト情報を取得
      // 認証不要のため、通常のaxiosインスタンスを使用
      const baseUrl = new URL(url).origin + '/api';
      const response = await axios.get(`${baseUrl}/prompts/public/${token}`);

      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error(`公開URLからのプロンプト取得に失敗しました (URL: ${url}):`, error);
      this._handleApiError(error);
      return null;
    }
  }
}