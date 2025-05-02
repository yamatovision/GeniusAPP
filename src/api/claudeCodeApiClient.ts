import axios from 'axios';
import * as vscode from 'vscode';
import { AuthenticationService } from '../core/auth/AuthenticationService';
import { SimpleAuthService } from '../core/auth/SimpleAuthService';
import { Logger } from '../utils/logger';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from '../utils/ErrorHandler';

/**
 * ClaudeCodeApiClient - ClaudeCode CLIと連携するためのAPIクライアント
 * 
 * プロンプトライブラリやユーザー認証情報の同期に使用します。
 */
export class ClaudeCodeApiClient {
  private static instance: ClaudeCodeApiClient;
  private _simpleAuthService?: SimpleAuthService;
  private _legacyAuthService?: AuthenticationService;
  private _baseUrl: string;
  private _errorHandler: ErrorHandler;
  private _useSimpleAuth: boolean = true;

  /**
   * コンストラクタ
   */
  private constructor() {
    // SimpleAuthServiceを優先使用
    try {
      this._simpleAuthService = SimpleAuthService.getInstance();
      this._useSimpleAuth = true;
      Logger.info('ClaudeCodeApiClient: SimpleAuthServiceを使用します');
    } catch (error) {
      // SimpleAuthServiceが初期化されていない場合はレガシー認証を使用
      Logger.warn('ClaudeCodeApiClient: SimpleAuthServiceの取得に失敗、レガシー認証に切り替えます', error as Error);
      this._legacyAuthService = AuthenticationService.getInstance();
      this._useSimpleAuth = false;
    }
    
    this._errorHandler = ErrorHandler.getInstance();
    // API URLを環境変数から取得、またはデフォルト値を使用
    this._baseUrl = process.env.PORTAL_API_URL || 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';
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
        Logger.debug('ClaudeCodeApiClient: APIキーを使用します');
      } else {
        // 通常の認証ヘッダーを取得
        authHeader = this._simpleAuthService.getAuthHeader();
        Logger.debug('ClaudeCodeApiClient: SimpleAuthServiceからヘッダーを取得しました');
      }
    } 
    // レガシー認証の場合は非同期で取得
    else if (this._legacyAuthService) {
      authHeader = await this._legacyAuthService.getAuthHeader() || {};
      Logger.debug('ClaudeCodeApiClient: レガシー認証からヘッダーを取得しました');
    }
    
    return {
      headers: authHeader
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
            let refreshSucceeded = false;
            
            // SimpleAuthを使用している場合
            if (this._useSimpleAuth && this._simpleAuthService) {
              const verified = await this._simpleAuthService.verifyAuthState();
              refreshSucceeded = verified;
              Logger.info(`【API連携】SimpleAuthService検証結果: ${verified}`);
            } 
            // レガシー認証の場合
            else if (this._legacyAuthService) {
              refreshSucceeded = await this._legacyAuthService.refreshToken();
              Logger.info(`【API連携】レガシー認証リフレッシュ結果: ${refreshSucceeded}`);
            }
            
            shouldRetry = refreshSucceeded && retries <= maxRetries;
            
            if (!refreshSucceeded && retries >= maxRetries) {
              // 最大リトライ回数に達し、かつリフレッシュに失敗した場合はログアウト
              Logger.warn('【API連携】トークンリフレッシュに失敗し、最大リトライ回数に達しました。ログアウトします');
              
              // 適切な認証サービスでログアウト
              if (this._useSimpleAuth && this._simpleAuthService) {
                await this._simpleAuthService.logout();
              } else if (this._legacyAuthService) {
                await this._legacyAuthService.logout();
              }
              
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
        let refreshSucceeded = false;
        
        // SimpleAuthを使用している場合
        if (this._useSimpleAuth && this._simpleAuthService) {
          const verified = await this._simpleAuthService.verifyAuthState();
          refreshSucceeded = verified;
          Logger.info(`【API連携】SimpleAuthService検証結果: ${verified}`);
        } 
        // レガシー認証の場合
        else if (this._legacyAuthService) {
          refreshSucceeded = await this._legacyAuthService.refreshToken();
          Logger.info(`【API連携】レガシー認証リフレッシュ結果: ${refreshSucceeded}`);
        }
        
        if (!refreshSucceeded) {
          // リフレッシュに失敗した場合はログアウト
          Logger.warn('【API連携】トークンリフレッシュに失敗しました。ログアウトします');
          
          // 適切な認証サービスでログアウト
          if (this._useSimpleAuth && this._simpleAuthService) {
            await this._simpleAuthService.logout();
          } else if (this._legacyAuthService) {
            await this._legacyAuthService.logout();
          }
          
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
        // URLからベースURLを抽出せず、代わりにデフォルトのAPIエンドポイントを使用する
        const baseUrl = this._baseUrl;
        Logger.info(`【API連携】公開プロンプトの取得を開始: ${baseUrl}/prompts/public/${token} (元URL: ${url})`);
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
   * API接続テスト
   * このメソッドは認証状態を確認し、APIサーバーとの接続性をテストします
   * シンプル認証方式に対応
   * @returns テスト成功の場合はtrue、失敗の場合はfalse
   */
  public async testApiConnection(): Promise<boolean> {
    try {
      Logger.info('【API連携】API接続テストを開始');
      
      // SimpleAuthを使用している場合は、認証状態とアクセストークンを両方チェック
      if (this._useSimpleAuth && this._simpleAuthService) {
        Logger.info('【API連携】シンプル認証を使用してAPI接続テスト');
        
        // SimpleAuthServiceの認証状態を直接確認
        const isAuthenticated = this._simpleAuthService.isAuthenticated();
        // アクセストークンの有効性も確認
        const accessToken = this._simpleAuthService.getAccessToken();
        
        // 詳細なデバッグ情報を出力
        Logger.debug(`【API連携】SimpleAuthService認証状態: ${isAuthenticated}, トークン存在: ${!!accessToken}`);
        if (accessToken) {
          Logger.debug(`【API連携】トークンプレビュー: ${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 5)}`);
        }
        
        // 詳細な認証状態を出力（デバッグ用）
        try {
          // 現在の認証状態の詳細を出力
          const currentState = this._simpleAuthService.getCurrentState();
          Logger.debug(`【API連携】現在の認証状態詳細: isAuthenticated=${currentState.isAuthenticated}, userName=${currentState.username || 'なし'}, userId=${currentState.userId || 'なし'}, role=${currentState.role}`);
          
          // API BASE URLを出力
          Logger.debug(`【API連携】APIベースURL検証: ${this._baseUrl}`);
        } catch (debugError) {
          Logger.error('【API連携】デバッグ情報取得エラー:', debugError as Error);
        }
        
        // 認証状態とアクセストークンの両方が有効な場合に成功とみなす
        if (isAuthenticated && accessToken) {
          Logger.info('【API連携】シンプル認証状態とトークンは有効です。API接続テストに成功したとみなします');
          return true;
        } else {
          Logger.warn('【API連携】シンプル認証状態またはトークンが無効です');
          return false;
        }
      }
      
      // レガシー認証の場合は従来のエンドポイントを使用
      Logger.info('【API連携】レガシー認証を使用してAPI接続テスト');
      
      // 認証ヘッダーを取得
      const config = await this._getApiConfig();
      
      // 認証ヘッダーの存在を確認
      const headers = config?.headers as Record<string, string>;
      const hasAuthHeader = headers && (headers['Authorization'] || headers['authorization'] || headers['x-api-key']);
      if (!hasAuthHeader) {
        Logger.warn('【API連携】認証ヘッダーが不足しています');
        return false;
      }
      
      // 軽量なエンドポイント（/api/auth/users/me）を使用してAPIテスト
      const response = await axios.get(`${this._baseUrl}/auth/users/me`, {
        ...config,
        timeout: 5000  // 5秒タイムアウト（短く設定して迅速にテスト）
      });
      
      // ステータスコード200かつユーザー情報があればOK
      if (response.status === 200 && response.data.user) {
        Logger.info('【API連携】API接続テストに成功しました');
        return true;
      }
      
      Logger.warn(`【API連携】API接続テスト：予期しないレスポンス形式 (${response.status})`);
      return false;
    } catch (error) {
      // エラーの詳細をログに記録
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          Logger.warn('【API連携】API接続テスト：認証エラー (401)');
        } else if (error.response) {
          Logger.error(`【API連携】API接続テスト：サーバーエラー (${error.response.status})`, error);
        } else {
          Logger.error('【API連携】API接続テスト：ネットワークエラー', error);
        }
      } else {
        Logger.error(`【API連携】API接続テスト：不明なエラー: ${(error as Error).message}`, error as Error);
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
  public async recordTokenUsage(tokenCount: number, modelId: string, context?: string): Promise<boolean> {
    // トークン使用量記録機能は削除されました
    // 互換性のために常にtrueを返すだけのメソッドとして維持しています
    Logger.debug(`【API連携】トークン使用履歴記録は無効化されています (${modelId}, ${context || 'no-context'})`);
    return true;
  }

  /**
   * ClaudeCode起動カウンターをインクリメント
   * @param userId ユーザーID
   */
  public async incrementClaudeCodeLaunchCount(userId: string): Promise<any> {
    try {
      Logger.info(`【API連携】ClaudeCode起動カウンターを更新します: ユーザーID ${userId}`);
      Logger.info(`【デバッグ】API呼び出し準備: ユーザーID=${userId}, APIベースURL=${this._baseUrl}`);
      
      // API設定を取得して詳細をログに出力
      const config = await this._getApiConfig();
      const hasAuthHeader = config?.headers && (config.headers['Authorization'] || config.headers['authorization'] || config.headers['x-api-key']);
      Logger.info(`【デバッグ】API認証ヘッダー: ${hasAuthHeader ? '存在します' : '存在しません'}`);
      
      if (hasAuthHeader && config.headers) {
        // ヘッダーの種類と先頭部分を出力（セキュリティのため全体は出力しない）
        if (config.headers['Authorization']) {
          Logger.info(`【デバッグ】Authorization ヘッダー: ${config.headers['Authorization'].substring(0, 15)}...`);
        } else if (config.headers['authorization']) {
          Logger.info(`【デバッグ】authorization ヘッダー: ${config.headers['authorization'].substring(0, 15)}...`);
        } else if (config.headers['x-api-key']) {
          Logger.info(`【デバッグ】x-api-key ヘッダー: ${config.headers['x-api-key'].substring(0, 10)}...`);
        }
      }
      
      // APIエンドポイントURL
      const url = `${this._baseUrl}/simple/users/${userId}/increment-claude-code-launch`;
      Logger.info(`【デバッグ】API呼び出しURL: ${url}`);
      
      // APIリクエスト送信
      Logger.info(`【デバッグ】API呼び出し開始: POST ${url}`);
      const response = await axios.post(url, {}, config);
      
      // レスポンス分析
      Logger.info(`【デバッグ】API呼び出しステータス: ${response.status} ${response.statusText}`);
      Logger.info(`【デバッグ】APIレスポンス: ${JSON.stringify(response.data)}`);
      
      if (response.status === 200) {
        // 詳細なレスポンス情報をログ出力
        const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
        const isSuccess = response.data?.success === true;
        Logger.info(`【API連携】ClaudeCode起動カウンター更新成功: 新しい値=${newCount}, 成功フラグ=${isSuccess}`);
        return response.data;
      }
      
      Logger.warn(`【API連携】ClaudeCode起動カウンター更新：予期しないレスポンス (${response.status})`);
      return null;
    } catch (error) {
      Logger.error('【API連携】ClaudeCode起動カウンター更新エラー:', error);
      
      // エラーの詳細を分析
      if (axios.isAxiosError(error)) {
        if (error.response) {
          Logger.error(`【デバッグ】APIエラー: ステータス=${error.response.status}, データ=${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          Logger.error(`【デバッグ】APIエラー: リクエストは送信されましたがレスポンスがありません`);
        } else {
          Logger.error(`【デバッグ】APIエラー: リクエスト設定中にエラーが発生しました: ${error.message}`);
        }
        
        // URL情報
        if (error.config?.url) {
          Logger.error(`【デバッグ】APIエラー: URL=${error.config.url}`);
        }
      }
      
      this._handleApiError(error);
      return null;
    }
  }
}