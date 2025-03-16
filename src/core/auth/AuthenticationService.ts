import * as vscode from 'vscode';
import { TokenManager } from './TokenManager';
import axios, { AxiosError } from 'axios';
import { Logger } from '../../utils/logger';
import { AuthEventBus, AuthEventType } from '../../services/AuthEventBus';

/**
 * 認証エラー情報インターフェース
 */
export interface AuthError {
  code: string;
  message: string;
  statusCode?: number;
  isRetryable: boolean;
}

/**
 * AuthenticationService - VSCode拡張の認証機能を管理するサービス
 * 
 * 中央管理システムとの通信を担当し、ユーザーの認証状態を管理します。
 */
export class AuthenticationService {
  private static instance: AuthenticationService;
  private _tokenManager: TokenManager;
  private _authEventBus: AuthEventBus;
  private _isAuthenticated: boolean = false;
  private _currentUser: any = null;
  private _statusBarItem: vscode.StatusBarItem | null = null;
  private _authCheckInterval: NodeJS.Timer | null = null;
  private _lastError: AuthError | null = null;
  private _isRefreshing: boolean = false;
  private _refreshPromise: Promise<boolean> | null = null;
  
  // リトライ設定
  private _maxRetries: number = 3;
  private _retryDelay: number = 1000; // ミリ秒
  
  // イベントエミッター
  private _onAuthStateChanged = new vscode.EventEmitter<boolean>();
  public readonly onAuthStateChanged = this._onAuthStateChanged.event;

  private constructor() {
    try {
      // 1. グローバル変数の安全な取得を試みる
      let context = null;
      
      try {
        // @ts-ignore グローバル変数アクセス（extension.tsで設定されている場合）
        const globalContext = global.__extensionContext;
        if (globalContext) {
          context = globalContext;
          Logger.info('グローバルExtensionContextを使用してAuthenticationServiceを初期化します');
        }
      } catch (err) {
        Logger.error('グローバルExtensionContext取得エラー:', err as Error);
      }
      
      // 2. コンテキストがあれば渡し、なければTokenManagerにグローバル取得を委任
      if (context) {
        this._tokenManager = TokenManager.getInstance(context);
      } else {
        // TokenManagerの内部でグローバル変数が再度チェックされる
        this._tokenManager = TokenManager.getInstance();
        console.warn('AuthenticationService: ExtensionContextなしでTokenManagerを初期化');
      }
    } catch (e) {
      // 完全なフォールバック - エラー時も機能制限付きで進行
      console.error('AuthenticationService初期化エラー:', e);
      this._tokenManager = TokenManager.getInstance();
    }
    
    this._authEventBus = AuthEventBus.getInstance();
    this._initialize();
  }

  /**
   * AuthenticationServiceのシングルトンインスタンスを取得
   */
  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  /**
   * サービスの初期化
   * 保存されたトークンがあれば読み込み、有効性を検証します
   */
  private async _initialize(): Promise<void> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (token) {
        // トークンの有効性を検証
        const isValid = await this._verifyToken(token);
        this._isAuthenticated = isValid;
        if (isValid) {
          await this._fetchUserInfo();
          this._startAuthCheckInterval();
        }
      }
      
      // 認証状態が変更されたことを通知
      this._onAuthStateChanged.fire(this._isAuthenticated);
      this._authEventBus.updateAuthState({ 
        isAuthenticated: this._isAuthenticated,
        userId: this._currentUser?.id,
        username: this._currentUser?.name
      }, 'AuthenticationService');
      
    } catch (error) {
      Logger.error('認証サービスの初期化中にエラーが発生しました:', error as Error);
      this._setLastError({
        code: 'init_failed',
        message: `認証サービスの初期化に失敗しました: ${(error as Error).message}`,
        isRetryable: false
      });
    }
  }

  /**
   * ユーザーログイン
   * @param email ユーザーのメールアドレス
   * @param password ユーザーのパスワード
   * @returns ログイン成功時はtrue、失敗時はfalse
   */
  public async login(email: string, password: string): Promise<boolean> {
    try {
      // 環境変数から認証APIのエンドポイントを取得
      const apiUrl = this._getAuthApiUrl();
      
      // クライアントID/シークレットを取得
      const clientId = this._getClientId();
      const clientSecret = this._getClientSecret();
      
      if (!clientId || !clientSecret) {
        Logger.warn('クライアントID/シークレットが設定されていません');
        this._setLastError({
          code: 'missing_credentials',
          message: 'クライアントID/シークレットが設定されていません',
          isRetryable: false
        });
      }
      
      // 認証APIを呼び出し
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
        clientId,
        clientSecret
      });

      if (response.status === 200 && response.data.accessToken && response.data.refreshToken) {
        // トークンを保存
        await this._tokenManager.setAccessToken(response.data.accessToken);
        await this._tokenManager.setRefreshToken(response.data.refreshToken);
        
        // 認証状態を更新
        this._isAuthenticated = true;
        this._currentUser = response.data.user;
        this._lastError = null;
        
        // 認証チェックインターバルを開始
        this._startAuthCheckInterval();
        
        // 認証状態が変更されたことを通知
        this._onAuthStateChanged.fire(true);
        this._authEventBus.publish(AuthEventType.LOGIN_SUCCESS, {
          userId: this._currentUser?.id,
          username: this._currentUser?.name
        }, 'AuthenticationService');
        
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('ログイン中にエラーが発生しました:', error as Error);
      
      // エラー情報を設定
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        let errorMessage = '認証に失敗しました';
        let errorCode = 'login_failed';
        
        // ステータスコードに応じたメッセージ
        if (statusCode === 401) {
          errorMessage = 'メールアドレスまたはパスワードが正しくありません';
          errorCode = 'invalid_credentials';
        } else if (statusCode === 403) {
          errorMessage = 'アクセスが拒否されました';
          errorCode = 'access_denied';
        } else if (statusCode === 429) {
          errorMessage = 'リクエスト回数が多すぎます。しばらく待ってから再試行してください';
          errorCode = 'rate_limited';
        }
        
        this._setLastError({
          code: errorCode,
          message: errorMessage,
          statusCode,
          isRetryable: statusCode === 429 || (statusCode && statusCode >= 500)
        });
        
        // エラーイベントを発行
        this._authEventBus.publish(AuthEventType.LOGIN_FAILED, {
          code: errorCode,
          message: errorMessage,
          statusCode
        }, 'AuthenticationService');
      } else {
        this._setLastError({
          code: 'unknown_error',
          message: `ログイン中に予期しないエラーが発生しました: ${(error as Error).message}`,
          isRetryable: true
        });
        
        this._authEventBus.publish(AuthEventType.LOGIN_FAILED, {
          code: 'unknown_error',
          message: (error as Error).message
        }, 'AuthenticationService');
      }
      
      return false;
    }
  }

  /**
   * ユーザーログアウト
   */
  public async logout(): Promise<void> {
    try {
      const refreshToken = await this._tokenManager.getRefreshToken();
      const apiUrl = this._getAuthApiUrl();
      
      // サーバーにログアウトリクエストを送信
      if (refreshToken) {
        try {
          await axios.post(`${apiUrl}/auth/logout`, {
            refreshToken
          });
        } catch (error) {
          Logger.error('サーバーへのログアウトリクエスト中にエラーが発生しました:', error as Error);
        }
      }
    } catch (error) {
      Logger.error('ログアウト処理中にエラーが発生しました:', error as Error);
    } finally {
      // ローカルの認証情報をクリア
      await this._tokenManager.clearTokens();
      this._isAuthenticated = false;
      this._currentUser = null;
      
      // 認証チェックインターバルを停止
      this._stopAuthCheckInterval();
      
      // 認証状態が変更されたことを通知
      this._onAuthStateChanged.fire(false);
      this._authEventBus.publish(AuthEventType.LOGOUT, {}, 'AuthenticationService');
    }
  }

  /**
   * トークンのリフレッシュ
   * アクセストークンの期限が切れている場合に、リフレッシュトークンを使用して新しいアクセストークンを取得
   */
  public async refreshToken(): Promise<boolean> {
    // 既にリフレッシュ中なら、そのPromiseを返す
    if (this._isRefreshing && this._refreshPromise) {
      return this._refreshPromise;
    }
    
    try {
      this._isRefreshing = true;
      this._refreshPromise = this._doRefreshToken();
      return await this._refreshPromise;
    } finally {
      this._isRefreshing = false;
      this._refreshPromise = null;
    }
  }
  
  /**
   * 実際のトークンリフレッシュ処理
   */
  private async _doRefreshToken(): Promise<boolean> {
    try {
      const refreshToken = await this._tokenManager.getRefreshToken();
      if (!refreshToken) {
        Logger.warn('リフレッシュトークンが見つかりません');
        return false;
      }
      
      const apiUrl = this._getAuthApiUrl();
      const clientId = this._getClientId();
      const clientSecret = this._getClientSecret();
      
      // トークンリフレッシュAPIを呼び出し
      const response = await axios.post(`${apiUrl}/auth/refresh-token`, {
        refreshToken,
        clientId,
        clientSecret
      });
      
      if (response.status === 200 && response.data.accessToken) {
        // 新しいアクセストークンを保存
        await this._tokenManager.setAccessToken(response.data.accessToken);
        
        // リフレッシュトークンも更新される場合は保存
        if (response.data.refreshToken) {
          await this._tokenManager.setRefreshToken(response.data.refreshToken);
        }
        
        // トークンリフレッシュイベントを発行
        this._authEventBus.publish(AuthEventType.TOKEN_REFRESHED, {}, 'AuthenticationService');
        
        Logger.info('アクセストークンをリフレッシュしました');
        return true;
      }
      
      Logger.warn('トークンリフレッシュのレスポンスが無効です');
      return false;
    } catch (error) {
      Logger.error('トークンリフレッシュ中にエラーが発生しました:', error as Error);
      
      // エラー情報を設定
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        
        if (statusCode === 401 || statusCode === 403) {
          // リフレッシュトークンが無効な場合
          this._setLastError({
            code: 'invalid_refresh_token',
            message: 'リフレッシュトークンが無効です。再ログインが必要です。',
            statusCode,
            isRetryable: false
          });
          
          // リフレッシュに失敗した場合はログアウト
          await this.logout();
          
          // トークン期限切れイベントを発行
          this._authEventBus.publish(AuthEventType.TOKEN_EXPIRED, {
            message: 'セッションの有効期限が切れました。再ログインしてください。'
          }, 'AuthenticationService');
        } else if (statusCode === 429) {
          // レート制限の場合
          this._setLastError({
            code: 'rate_limited',
            message: 'リクエスト回数が多すぎます。しばらく待ってから再試行してください。',
            statusCode,
            isRetryable: true
          });
        } else {
          // その他のエラー
          this._setLastError({
            code: 'refresh_failed',
            message: `トークンリフレッシュに失敗しました: ${error.message}`,
            statusCode,
            isRetryable: statusCode ? statusCode >= 500 : true
          });
        }
      } else {
        // Axiosエラーではない場合
        this._setLastError({
          code: 'unknown_error',
          message: `トークンリフレッシュ中に予期しないエラーが発生しました: ${(error as Error).message}`,
          isRetryable: true
        });
      }
      
      // 認証エラーイベントを発行
      this._authEventBus.publish(AuthEventType.AUTH_ERROR, {
        error: this._lastError
      }, 'AuthenticationService');
      
      return false;
    }
  }
  
  /**
   * 外部トークンの直接設定（ClaudeCode連携用）
   * このメソッドはClaudeCodeとの統合時や、テスト目的でも使用されます
   */
  public async setAuthTokenDirectly(token: string): Promise<boolean> {
    try {
      // トークンの有効性を検証
      const isValid = await this._verifyToken(token);
      if (!isValid) {
        Logger.warn('設定しようとしたトークンは無効です');
        return false;
      }
      
      // トークンを設定
      await this._tokenManager.setAccessToken(token);
      
      // ユーザー情報を取得
      await this._fetchUserInfo();
      
      // 認証状態を更新
      this._isAuthenticated = true;
      
      // 認証チェックインターバルを開始
      this._startAuthCheckInterval();
      
      // 認証状態が変更されたことを通知
      this._onAuthStateChanged.fire(true);
      this._authEventBus.publish(AuthEventType.LOGIN_SUCCESS, {
        userId: this._currentUser?.id,
        username: this._currentUser?.name
      }, 'AuthenticationService');
      
      return true;
    } catch (error) {
      Logger.error('外部トークン設定中にエラーが発生しました:', error as Error);
      this._setLastError({
        code: 'token_validation_failed',
        message: `外部トークンの検証に失敗しました: ${(error as Error).message}`,
        isRetryable: false
      });
      return false;
    }
  }

  /**
   * 現在の認証状態を確認
   */
  public isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  /**
   * 現在のユーザー情報を取得
   */
  public getCurrentUser(): any {
    return this._currentUser;
  }
  
  /**
   * ユーザー情報を取得（外部公開API）
   */
  public async getUserInfo(): Promise<any> {
    try {
      await this._fetchUserInfo();
      return this._currentUser;
    } catch (error) {
      Logger.error('ユーザー情報取得中にエラーが発生しました:', error as Error);
      throw error;
    }
  }
  
  /**
   * 最後のエラー情報を取得
   */
  public getLastError(): AuthError | null {
    return this._lastError;
  }
  
  /**
   * アクセストークンを取得
   */
  public async getAuthToken(): Promise<string | undefined> {
    return this._tokenManager.getAccessToken();
  }
  
  /**
   * 認証情報をリセット（テスト用）
   * 警告: このメソッドは主にテストのために使用されます
   */
  public async resetAuthState(): Promise<void> {
    await this._tokenManager.clearTokens();
    this._isAuthenticated = false;
    this._currentUser = null;
    this._lastError = null;
    
    // 認証状態が変更されたことを通知
    this._onAuthStateChanged.fire(false);
    this._authEventBus.publish(AuthEventType.LOGOUT, {}, 'AuthenticationService');
  }
  
  /**
   * ユーザープロファイルを更新
   */
  public async updateProfile(profileData: any): Promise<boolean> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        return false;
      }
      
      const apiUrl = this._getAuthApiUrl();
      
      const response = await axios.put(`${apiUrl}/users/profile`, profileData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200 && response.data.user) {
        this._currentUser = response.data.user;
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('プロファイル更新中にエラーが発生しました:', error as Error);
      
      // エラー情報を設定
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        
        if (statusCode === 401) {
          // アクセストークンの期限切れの場合はリフレッシュを試みる
          const refreshSucceeded = await this.refreshToken();
          if (refreshSucceeded) {
            // リフレッシュに成功したら再試行
            return this.updateProfile(profileData);
          }
        }
        
        this._setLastError({
          code: 'profile_update_failed',
          message: `プロファイル更新に失敗しました: ${error.message}`,
          statusCode,
          isRetryable: statusCode ? statusCode >= 500 : true
        });
      } else {
        this._setLastError({
          code: 'unknown_error',
          message: `プロファイル更新中に予期しないエラーが発生しました: ${(error as Error).message}`,
          isRetryable: true
        });
      }
      
      return false;
    }
  }
  
  /**
   * パスワード変更
   */
  public async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        return false;
      }
      
      const apiUrl = this._getAuthApiUrl();
      
      const response = await axios.post(`${apiUrl}/users/change-password`, {
        currentPassword,
        newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.status === 200;
    } catch (error) {
      Logger.error('パスワード変更中にエラーが発生しました:', error as Error);
      
      // エラー情報を設定
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        let errorMessage = 'パスワード変更に失敗しました';
        let errorCode = 'password_change_failed';
        
        if (statusCode === 401) {
          // アクセストークンの期限切れの場合はリフレッシュを試みる
          const refreshSucceeded = await this.refreshToken();
          if (refreshSucceeded) {
            // リフレッシュに成功したら再試行
            return this.changePassword(currentPassword, newPassword);
          }
          
          errorMessage = '認証に失敗しました。再ログインしてください';
          errorCode = 'authentication_failed';
        } else if (statusCode === 400) {
          errorMessage = '現在のパスワードが正しくないか、新しいパスワードが要件を満たしていません';
          errorCode = 'invalid_password';
        }
        
        this._setLastError({
          code: errorCode,
          message: errorMessage,
          statusCode,
          isRetryable: statusCode ? statusCode >= 500 : true
        });
      } else {
        this._setLastError({
          code: 'unknown_error',
          message: `パスワード変更中に予期しないエラーが発生しました: ${(error as Error).message}`,
          isRetryable: true
        });
      }
      
      return false;
    }
  }

  /**
   * ユーザー情報を取得
   */
  private async _fetchUserInfo(): Promise<void> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        return;
      }
      
      const apiUrl = this._getAuthApiUrl();
      
      // ユーザー情報取得APIを呼び出し
      const response = await axios.get(`${apiUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200 && response.data.user) {
        this._currentUser = response.data.user;
        
        // 認証状態を更新
        this._authEventBus.updateAuthState({
          userId: this._currentUser.id,
          username: this._currentUser.name,
          permissions: this._currentUser.permissions || []
        }, 'AuthenticationService');
      }
    } catch (error) {
      Logger.error('ユーザー情報取得中にエラーが発生しました:', error as Error);
      
      // トークンが無効の場合は認証エラーとしてログアウト
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // トークンリフレッシュを試みる
        const refreshSucceeded = await this.refreshToken();
        if (!refreshSucceeded) {
          await this.logout();
        } else {
          // リフレッシュに成功したら再度ユーザー情報を取得
          await this._fetchUserInfo();
        }
      }
    }
  }

  /**
   * トークンの有効性を検証
   */
  private async _verifyToken(token: string): Promise<boolean> {
    let retries = 0;
    
    while (retries <= this._maxRetries) {
      try {
        const apiUrl = this._getAuthApiUrl();
        
        // トークン検証APIを呼び出し
        const response = await axios.post(`${apiUrl}/auth/verify`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        return response.status === 200;
      } catch (error) {
        Logger.error(`トークン検証中にエラーが発生しました (試行 ${retries + 1}/${this._maxRetries + 1}):`, error as Error);
        
        // トークンが無効の場合はリフレッシュを試みる
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return await this.refreshToken();
        }
        
        // ネットワークエラーや500系エラーの場合はリトライ
        if (this._isRetryableError(error) && retries < this._maxRetries) {
          retries++;
          // 指数バックオフで待機
          await this._delay(this._retryDelay * Math.pow(2, retries - 1));
          continue;
        }
        
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * リトライ可能なエラーかどうかを判定
   */
  private _isRetryableError(error: any): boolean {
    // ネットワークエラー（タイムアウトなど）
    if (axios.isAxiosError(error) && !error.response) {
      return true;
    }
    
    // 特定のHTTPステータスコード（サーバーエラーなど）
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      // 429: Too Many Requests, 5xx: サーバーエラー
      return status === 429 || (status >= 500 && status < 600);
    }
    
    return false;
  }
  
  /**
   * 指定された時間（ミリ秒）待機する
   */
  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 定期的な認証チェックを開始
   */
  private _startAuthCheckInterval(): void {
    // 既存のインターバルがあれば停止
    this._stopAuthCheckInterval();
    
    // 環境変数からチェック間隔を取得（デフォルトは5分）
    const checkIntervalSeconds = Math.min(
      parseInt(process.env.CHECK_INTERVAL || '300', 10),
      300 // 最大5分
    );
    
    // 定期的なトークン検証を設定
    this._authCheckInterval = setInterval(async () => {
      try {
        const token = await this._tokenManager.getAccessToken();
        if (token) {
          const isValid = await this._verifyToken(token);
          if (!isValid) {
            // トークンが無効になった場合はログアウト
            Logger.warn('定期チェックでトークンが無効と判断されました。ログアウトします。');
            await this.logout();
          }
        }
      } catch (error) {
        Logger.error('認証チェック中にエラーが発生しました:', error as Error);
      }
    }, checkIntervalSeconds * 1000);
    
    Logger.debug(`認証チェックインターバルを開始しました (${checkIntervalSeconds}秒間隔)`);
  }

  /**
   * 定期的な認証チェックを停止
   */
  private _stopAuthCheckInterval(): void {
    if (this._authCheckInterval) {
      clearInterval(this._authCheckInterval);
      this._authCheckInterval = null;
      Logger.debug('認証チェックインターバルを停止しました');
    }
  }

  /**
   * 認証APIのURLを取得
   */
  private _getAuthApiUrl(): string {
    const url = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
    return url;
  }
  
  /**
   * クライアントIDを取得
   */
  private _getClientId(): string {
    return process.env.CLIENT_ID || '';
  }
  
  /**
   * クライアントシークレットを取得
   */
  private _getClientSecret(): string {
    return process.env.CLIENT_SECRET || '';
  }

  /**
   * 認証ヘッダーを取得
   * API呼び出し時のAuthorization headerとして使用
   */
  public async getAuthHeader(): Promise<{[key: string]: string} | null> {
    try {
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        return null;
      }
      return {
        'Authorization': `Bearer ${token}`
      };
    } catch (error) {
      Logger.error('認証ヘッダー取得中にエラーが発生しました:', error as Error);
      return null;
    }
  }

  /**
   * 権限チェック
   * @param requiredRole 必要な権限（'user'または'admin'）
   */
  public hasPermission(requiredRole: string): boolean {
    if (!this._isAuthenticated || !this._currentUser) {
      return false;
    }
    
    // 管理者は全ての権限を持つ
    if (this._currentUser.role === 'admin') {
      return true;
    }
    
    // ユーザー権限のチェック
    return this._currentUser.role === requiredRole;
  }
  
  /**
   * 権限（パーミッション）チェック
   */
  public hasPermissions(requiredPermissions: string[]): boolean {
    if (!this._isAuthenticated || !this._currentUser) {
      return false;
    }
    
    // 管理者は全ての権限を持つ
    if (this._currentUser.role === 'admin') {
      return true;
    }
    
    // ユーザーの権限リストをチェック
    const userPermissions = this._currentUser.permissions || [];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }
  
  /**
   * 最後のエラーを設定
   */
  private _setLastError(error: AuthError): void {
    this._lastError = error;
    Logger.error(`認証エラー: [${error.code}] ${error.message}`);
  }

  /**
   * リソースへのクリーンアップ
   */
  public dispose(): void {
    this._stopAuthCheckInterval();
    if (this._statusBarItem) {
      this._statusBarItem.dispose();
    }
    this._onAuthStateChanged.dispose();
  }
}