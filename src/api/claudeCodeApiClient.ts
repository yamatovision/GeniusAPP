import axios from 'axios';
import * as vscode from 'vscode';
import { AuthenticationService } from '../core/auth/AuthenticationService';
import { Logger } from '../utils/logger';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';

/**
 * ClaudeCodeApiClient - ClaudeCode CLIと連携するためのAPIクライアント
 * 
 * プロンプトライブラリやユーザー認証情報の同期に使用します。
 */
export class ClaudeCodeApiClient {
  private static instance: ClaudeCodeApiClient;
  private _authService: AuthenticationService;
  private _baseUrl: string;
  private _errorHandler: ErrorHandler;

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    this._errorHandler = ErrorHandler.getInstance();
    // API URLを環境変数から取得、またはデフォルト値を使用
    this._baseUrl = process.env.PORTAL_API_URL || 'https://geniemon-portal-backend-production.up.railway.app/api';
    Logger.info('ClaudeCodeApiClient initialized with baseUrl: ' + this._baseUrl);
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
      
      // レスポンスがオブジェクトかつversionsプロパティがある場合、またはレスポンスが直接配列の場合に対応
      if (response.status === 200) {
        if (Array.isArray(response.data.versions)) {
          return response.data.versions;
        } else if (Array.isArray(response.data)) {
          return response.data;
        }
      }
      
      return [];
    } catch (error) {
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
  public async recordPromptUsage(promptId: string, versionId: string, context?: string): Promise<boolean> {
    // 使用統計機能は削除されたため、実際にはAPIを呼び出さない
    // 後方互換性のために、成功したというレスポンスを返す
    Logger.info(`プロンプト使用履歴記録 (非推奨) - promptId: ${promptId}, versionId: ${versionId}`);
    return true;
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
   * 指数バックオフとジッターを用いたリトライ処理
   * @param operation 実行する非同期操作
   * @param maxRetries 最大リトライ回数
   * @param retryableStatusCodes リトライ可能なHTTPステータスコード
   * @param operationName 操作名（ログ用）
   * @returns 操作の結果
   */
  private async _retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryableStatusCodes: number[] = [429, 500, 502, 503, 504],
    operationName: string = '操作'
  ): Promise<T> {
    let retries = 0;
    const baseDelay = 1000; // 1秒

    while (true) {
      try {
        return await operation();
      } catch (error) {
        retries++;
        
        // エラーを適切にログに記録
        Logger.error(`【API連携】${operationName}に失敗しました (${retries}回目)`, error as Error);
        
        // リトライ判断
        let shouldRetry = false;
        
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;
          
          // 認証エラーの場合、トークンをリフレッシュしてリトライ
          if (statusCode === 401) {
            Logger.info('【API連携】トークンの有効期限切れ。リフレッシュを試みます');
            const refreshSucceeded = await this._authService.refreshToken();
            shouldRetry = refreshSucceeded && retries <= maxRetries;
            
            if (!refreshSucceeded && retries >= maxRetries) {
              // 最大リトライ回数に達し、かつリフレッシュに失敗した場合はログアウト
              Logger.warn('【API連携】トークンリフレッシュに失敗し、最大リトライ回数に達しました。ログアウトします');
              await this._authService.logout();
              vscode.window.showErrorMessage('認証の有効期限が切れました。再度ログインしてください。');
            }
          }
          // ネットワークエラーまたは特定のステータスコードならリトライ
          else if (!statusCode || retryableStatusCodes.includes(statusCode)) {
            shouldRetry = retries <= maxRetries;
          }
        } else {
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
        Logger.info(`【API連携】${operationName}を${delay}ms後に再試行します (${retries}/${maxRetries})`);
        
        // 指定時間待機
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * APIエラー処理
   * 認証エラーの場合はトークンリフレッシュを試みる
   */
  private async _handleApiError(error: any): Promise<void> {
    // ErrorHandlerを使用して詳細なエラー情報を記録
    this._errorHandler.handleError(error, 'ClaudeCodeApiClient');
    
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      
      if (statusCode === 401) {
        // 認証エラーの場合、トークンリフレッシュを試みる
        Logger.info('【API連携】認証エラー(401)。トークンリフレッシュを試みます');
        const refreshSucceeded = await this._authService.refreshToken();
        if (!refreshSucceeded) {
          // リフレッシュに失敗した場合はログアウト
          Logger.warn('【API連携】トークンリフレッシュに失敗しました。ログアウトします');
          await this._authService.logout();
          vscode.window.showErrorMessage('認証の有効期限が切れました。再度ログインしてください。');
        }
      } else if (statusCode === 403) {
        // 権限エラー
        Logger.warn('【API連携】権限エラー(403): アクセス権限がありません');
        vscode.window.showErrorMessage('この操作を行う権限がありません。');
      } else if (statusCode === 404) {
        // リソースが見つからない
        Logger.warn(`【API連携】リソースが見つかりません(404): ${error.config?.url}`);
        vscode.window.showErrorMessage('リクエストされたリソースが見つかりません。');
      } else if (statusCode && statusCode >= 500) {
        // サーバーエラー
        Logger.error(`【API連携】サーバーエラー(${statusCode}): ${error.config?.url}`, error as Error);
        vscode.window.showErrorMessage(`サーバーエラーが発生しました(${statusCode})。しばらく時間をおいて再試行してください。`);
      } else {
        // その他のエラー
        const errorMessage = error.response?.data?.message
          ? error.response.data.message
          : '不明なエラーが発生しました。';
        
        Logger.error(`【API連携】API呼び出しエラー: ${errorMessage}`, error as Error);
        vscode.window.showErrorMessage(`API呼び出し中にエラーが発生しました: ${errorMessage}`);
      }
    } else {
      // Axiosエラーでない場合
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      Logger.error(`【API連携】不明なエラー: ${errorMessage}`, error instanceof Error ? error : new Error(errorMessage));
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
      return await this._retryWithExponentialBackoff(async () => {
        // URLからトークンを抽出（例: https://example.com/api/prompts/public/abcd1234 からabcd1234を抽出）
        const token = url.split('/').pop();
  
        if (!token) {
          throw new Error('Invalid prompt URL format');
        }
  
        // トークンを使用して公開APIからプロンプト情報を取得
        // 認証不要のため、通常のaxiosインスタンスを使用
        const baseUrl = new URL(url).origin + '/api';
        Logger.info(`【API連携】公開プロンプトの取得を開始: ${baseUrl}/prompts/public/${token}`);
        const response = await axios.get(`${baseUrl}/prompts/public/${token}`);
  
        if (response.status === 200 && response.data) {
          Logger.info('【API連携】公開プロンプトの取得が成功しました');
          return response.data;
        }
  
        return null;
      }, 3, [429, 500, 502, 503, 504], '公開プロンプト取得');
    } catch (error) {
      Logger.error(`【API連携】公開URLからのプロンプト取得に失敗しました (URL: ${url})`, error as Error);
      this._handleApiError(error);
      return null;
    }
  }

  /**
   * Claude APIのトークン使用を記録
   * @param tokenCount 使用されたトークン数
   * @param modelId モデルID (例: "claude-3-opus-20240229")
   * @param context 使用コンテキスト (オプション)
   * @returns 記録が成功したかどうか
   */
  public async recordTokenUsage(tokenCount: number, modelId: string, context?: string): Promise<boolean> {
    try {
      return await this._retryWithExponentialBackoff(async () => {
        const config = await this._getApiConfig();
        
        // API呼び出し前にログ
        Logger.info(`【API連携】トークン使用履歴の記録を開始: ${tokenCount}トークン, モデル: ${modelId}`);
        
        // 主要APIエンドポイント - proxy/usageを使用
        const primaryEndpoint = `${this._baseUrl}/proxy/usage/record`;
        
        try {
          // 主要エンドポイントで記録を試みる
          const response = await axios.post(
            primaryEndpoint,
            {
              tokenCount,
              modelId,
              context: context || 'vscode-extension'
            },
            {
              ...config,
              timeout: 20000 // 20秒タイムアウト（増加）
            }
          );
          
          Logger.info(`【API連携】トークン使用履歴の記録に成功しました: ステータス ${response.status}`);
          return response.status === 201 || response.status === 200;
        } catch (error) {
          // 主要エンドポイントが404の場合、フォールバックエンドポイントを試す
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            Logger.warn('【API連携】主要エンドポイントが見つかりません。フォールバックエンドポイントを試みます');
            
            // フォールバックエンドポイント - 既存のusage/meエンドポイントと同じパスを使用
            const fallbackEndpoint = `${this._baseUrl}/proxy/usage/me/record`;
            
            try {
              const fallbackResponse = await axios.post(
                fallbackEndpoint,
                {
                  tokenCount,
                  modelId,
                  context: context || 'vscode-extension'
                },
                {
                  ...config,
                  timeout: 20000
                }
              );
              
              Logger.info(`【API連携】フォールバックエンドポイントでトークン使用履歴の記録に成功しました: ステータス ${fallbackResponse.status}`);
              return fallbackResponse.status === 201 || fallbackResponse.status === 200;
            } catch (fallbackError) {
              // フォールバックも失敗した場合、デバッグのために詳細なエラーログを記録
              if (axios.isAxiosError(fallbackError)) {
                Logger.error(`【API連携】フォールバックエンドポイントでの記録に失敗: ${fallbackError.response?.status || 'ネットワークエラー'}`, fallbackError);
                
                // 最終フォールバックとして /api/proxy/claude/chat と同じパスベースを試す
                const lastResortEndpoint = `${this._baseUrl}/proxy/claude/usage`;
                
                try {
                  const lastResortResponse = await axios.post(
                    lastResortEndpoint,
                    {
                      tokenCount,
                      modelId,
                      context: context || 'vscode-extension'
                    },
                    {
                      ...config,
                      timeout: 15000
                    }
                  );
                  
                  Logger.info(`【API連携】最終フォールバックエンドポイントでトークン使用履歴の記録に成功しました: ステータス ${lastResortResponse.status}`);
                  return lastResortResponse.status === 201 || lastResortResponse.status === 200;
                } catch (lastError) {
                  // 全てのエンドポイントが失敗した場合
                  Logger.warn('【API連携】全てのエンドポイントが失敗しました。使用履歴記録はスキップします');
                  return false;
                }
              }
              throw fallbackError;
            }
          }
          
          // 認証エラーの特別処理
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            Logger.warn('【API連携】認証エラーが発生しました。トークンのリフレッシュを試みます');
            const refreshed = await this._authService.refreshToken();
            if (!refreshed) {
              Logger.error('【API連携】トークンのリフレッシュに失敗しました');
              return false;
            }
            throw error; // リトライさせるためにエラーを再スロー
          }
          
          // その他のエラーは再スロー
          throw error;
        }
      }, 5, [401, 429, 500, 502, 503, 504], 'トークン使用履歴記録'); // リトライ回数を増やし、401もリトライ対象に
    } catch (error) {
      // エラーの詳細をログに記録（ユーザーには通知しない）
      Logger.error('【API連携】トークン使用履歴の記録に失敗しました', error as Error);
      
      // 使用履歴記録の失敗はユーザー体験に影響しないため、エラーメッセージは表示せず
      // ただしエラーはログに残す
      return false;
    }
  }
}