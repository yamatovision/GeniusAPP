import * as vscode from 'vscode';
import axios from 'axios';
import { TokenManager } from './TokenManager';
import { Logger } from '../../utils/logger';
import { Role } from './roles';
import { AuthState, AuthStateBuilder, compareAuthStates } from './AuthState';
import { AuthStorageManager } from '../../utils/AuthStorageManager';

/**
 * 認証イベントの型
 */
export enum AuthEventType {
  STATE_CHANGED = 'state_changed',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  TOKEN_REFRESHED = 'token_refreshed'
}

/**
 * 認証エラーの型
 */
export interface AuthError {
  code: string;
  message: string;
  statusCode?: number;
}

/**
 * AuthenticationService - 認証状態を一元管理するサービス
 * 
 * ユーザーの認証状態を管理し、認証関連のイベントを発行します。
 * このクラスはVSCodeのEventEmitterを使用して、状態変更を通知します。
 */
export class AuthenticationService {
  private static instance: AuthenticationService;
  private _tokenManager: TokenManager;
  private _storageManager: AuthStorageManager;
  private _currentState: AuthState;
  private _lastError: AuthError | null = null;
  private _authCheckInterval: NodeJS.Timer | null = null;
  
  // イベントエミッター
  private _onStateChanged = new vscode.EventEmitter<AuthState>();
  private _onLoginSuccess = new vscode.EventEmitter<void>();
  private _onLoginFailed = new vscode.EventEmitter<AuthError>();
  private _onLogout = new vscode.EventEmitter<void>();
  private _onTokenRefreshed = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onStateChanged = this._onStateChanged.event;
  public readonly onLoginSuccess = this._onLoginSuccess.event;
  public readonly onLoginFailed = this._onLoginFailed.event;
  public readonly onLogout = this._onLogout.event;
  public readonly onTokenRefreshed = this._onTokenRefreshed.event;
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this._tokenManager = TokenManager.getInstance(context);
    this._storageManager = AuthStorageManager.getInstance(context);
    this._currentState = AuthStateBuilder.guest().build();
    
    this._initialize();
  }
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(context?: vscode.ExtensionContext): AuthenticationService {
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
  private async _initialize(): Promise<void> {
    try {
      Logger.info('認証サービスの初期化を開始');
      
      // 保存されているトークンを確認
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        Logger.info('保存されたトークンがありません。未認証状態で初期化します');
        return;
      }
      
      Logger.info('保存されたトークンを確認しています');
      
      // トークンの有効期限をチェック
      const isValid = await this._tokenManager.isTokenValid();
      if (!isValid) {
        Logger.info('トークンの有効期限が切れています。リフレッシュを試みます');
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          Logger.warn('トークンのリフレッシュに失敗しました');
          return;
        }
      }
      
      // ユーザー情報を取得
      Logger.info('ユーザー情報を取得します');
      await this._fetchUserInfo();
      
      // 権限チェックインターバルを開始
      this._startAuthCheckInterval();
      
      Logger.info('認証サービスの初期化が完了しました');
    } catch (error) {
      Logger.error('認証サービスの初期化中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * ユーザーログイン
   */
  public async login(email: string, password: string): Promise<boolean> {
    try {
      Logger.info('ログイン処理を開始します');
      
      // 環境変数から認証APIのエンドポイントを取得
      const apiUrl = this._getAuthApiUrl();
      const clientId = this._getClientId();
      const clientSecret = this._getClientSecret();
      
      if (!clientId || !clientSecret) {
        this._setLastError({
          code: 'missing_credentials',
          message: 'クライアントID/シークレットが設定されていません'
        });
        return false;
      }
      
      // 認証APIを呼び出し
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
        clientId,
        clientSecret
      }, {
        timeout: 10000
      });
      
      if (response.status === 200 && response.data.accessToken && response.data.refreshToken) {
        // トークンの有効期限を取得
        const expiresIn = response.data.expiresIn || 86400;
        
        // トークンを保存
        await this._tokenManager.setAccessToken(response.data.accessToken, expiresIn);
        await this._tokenManager.setRefreshToken(response.data.refreshToken);
        
        // ユーザーデータを保存
        await this._storageManager.setUserData(response.data.user);
        
        // 認証状態を更新
        const newState = AuthStateBuilder.fromState(this._currentState)
          .setAuthenticated(true)
          .setUserId(response.data.user.id)
          .setUsername(response.data.user.name)
          .setRole(this._mapUserRole(response.data.user.role))
          .setPermissions(response.data.user.permissions || [])
          .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
          .build();
        
        // 状態を更新し、イベントを発行
        this._updateState(newState);
        
        // 認証チェックインターバルを開始
        this._startAuthCheckInterval();
        
        // ログイン成功イベントを発行
        this._onLoginSuccess.fire();
        
        Logger.info(`ログインに成功しました: ${response.data.user.name}`);
        return true;
      }
      
      Logger.warn('ログインに失敗しました: レスポンスが無効です');
      return false;
    } catch (error) {
      Logger.error('ログイン中にエラーが発生しました', error as Error);
      
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
        }
        
        const authError = {
          code: errorCode,
          message: errorMessage,
          statusCode
        };
        
        this._setLastError(authError);
        this._onLoginFailed.fire(authError);
      } else {
        const authError = {
          code: 'unknown_error',
          message: `ログイン中に予期しないエラーが発生しました: ${(error as Error).message}`
        };
        
        this._setLastError(authError);
        this._onLoginFailed.fire(authError);
      }
      
      return false;
    }
  }
  
  /**
   * ユーザーログアウト
   */
  public async logout(): Promise<void> {
    try {
      // ログアウトイベントをサーバーに送信（省略可能）
      const refreshToken = await this._tokenManager.getRefreshToken();
      const apiUrl = this._getAuthApiUrl();
      
      if (refreshToken) {
        try {
          await axios.post(`${apiUrl}/auth/logout`, { refreshToken });
        } catch (error) {
          Logger.warn('サーバーへのログアウトリクエスト送信中にエラーが発生しました', error as Error);
        }
      }
      
      // 認証チェックインターバルを停止
      this._stopAuthCheckInterval();
      
      // トークンを削除
      await this._tokenManager.clearTokens();
      
      // 認証状態をリセット
      const newState = AuthStateBuilder.guest().build();
      this._updateState(newState);
      
      // ログアウトイベントを発行
      this._onLogout.fire();
      
      Logger.info('ログアウトが完了しました');
    } catch (error) {
      Logger.error('ログアウト中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * トークンのリフレッシュ
   */
  public async refreshToken(): Promise<boolean> {
    try {
      Logger.info('トークンのリフレッシュを開始します');
      
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
        // トークンの有効期限を取得
        const expiresIn = response.data.expiresIn || 86400;
        
        // 新しいアクセストークンを保存
        await this._tokenManager.setAccessToken(response.data.accessToken, expiresIn);
        
        // リフレッシュトークンも更新される場合は保存
        if (response.data.refreshToken) {
          await this._tokenManager.setRefreshToken(response.data.refreshToken);
        }
        
        // 有効期限を更新
        const newState = AuthStateBuilder.fromState(this._currentState)
          .setExpiresAt(Math.floor(Date.now() / 1000) + expiresIn)
          .build();
        
        this._updateState(newState);
        
        // トークンリフレッシュイベントを発行
        this._onTokenRefreshed.fire();
        
        Logger.info('トークンのリフレッシュに成功しました');
        return true;
      }
      
      Logger.warn('トークンリフレッシュのレスポンスが無効です');
      return false;
    } catch (error) {
      Logger.error('トークンリフレッシュ中にエラーが発生しました', error as Error);
      
      // トークンが無効な場合はログアウト
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Logger.warn('リフレッシュトークンが無効です。ログアウトします');
        await this.logout();
      }
      
      return false;
    }
  }
  
  /**
   * ユーザー情報を取得
   */
  private async _fetchUserInfo(): Promise<void> {
    try {
      Logger.info('ユーザー情報の取得を開始します');
      
      const token = await this._tokenManager.getAccessToken();
      if (!token) {
        Logger.warn('アクセストークンが見つかりません');
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
        // ユーザーデータを保存
        await this._storageManager.setUserData(response.data.user);
        
        // 認証状態を更新
        const newState = AuthStateBuilder.fromState(this._currentState)
          .setAuthenticated(true)
          .setUserId(response.data.user.id)
          .setUsername(response.data.user.name)
          .setRole(this._mapUserRole(response.data.user.role))
          .setPermissions(response.data.user.permissions || [])
          .build();
        
        this._updateState(newState);
        
        Logger.info(`ユーザー情報を取得しました: ${response.data.user.name}`);
      } else {
        Logger.warn('ユーザー情報の取得に失敗しました: レスポンスが無効です');
      }
    } catch (error) {
      Logger.error('ユーザー情報取得中にエラーが発生しました', error as Error);
      
      // トークンが無効な場合はリフレッシュを試みる
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Logger.info('アクセストークンが無効です。リフレッシュを試みます');
        const refreshed = await this.refreshToken();
        if (refreshed) {
          Logger.info('トークンリフレッシュに成功しました。ユーザー情報を再取得します');
          await this._fetchUserInfo();
        } else {
          Logger.warn('トークンリフレッシュに失敗しました。ログアウトします');
          await this.logout();
        }
      }
    }
  }
  
  /**
   * 認証状態を更新し、変更があればイベントを発行
   */
  private _updateState(newState: AuthState): void {
    // 状態の変更点を確認
    const changes = compareAuthStates(this._currentState, newState);
    
    if (changes.length > 0) {
      // 変更があった場合、状態を更新してイベントを発行
      this._currentState = newState;
      
      // 変更内容をログに出力
      Logger.info(`認証状態が変更されました: ${changes.join(', ')}`);
      
      // 状態変更イベントを発行
      this._onStateChanged.fire(newState);
    }
  }
  
  /**
   * 認証チェックインターバルを開始
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
        // トークンの有効期限をチェック
        const isValid = await this._tokenManager.isTokenValid();
        
        if (!isValid) {
          Logger.info('トークンの有効期限が近づいているか、期限切れです。リフレッシュを試みます');
          
          // トークンリフレッシュを試みる
          const refreshed = await this.refreshToken();
          if (!refreshed) {
            Logger.warn('トークンのリフレッシュに失敗しました。ログアウトします');
            await this.logout();
          }
        }
      } catch (error) {
        Logger.error('認証チェック中にエラーが発生しました', error as Error);
      }
    }, checkIntervalSeconds * 1000);
    
    Logger.info(`認証チェックインターバルを開始しました（${checkIntervalSeconds}秒間隔）`);
  }
  
  /**
   * 認証チェックインターバルを停止
   */
  private _stopAuthCheckInterval(): void {
    if (this._authCheckInterval) {
      clearInterval(this._authCheckInterval);
      this._authCheckInterval = null;
      Logger.info('認証チェックインターバルを停止しました');
    }
  }
  
  /**
   * APIのエンドポイントURL取得
   */
  private _getAuthApiUrl(): string {
    return 'https://geniemon-portal-backend-production.up.railway.app/api';
  }
  
  /**
   * クライアントID取得
   */
  private _getClientId(): string {
    return 'appgenius_vscode_client_29a7fb3e';
  }
  
  /**
   * クライアントシークレット取得
   */
  private _getClientSecret(): string {
    return 'sk_8f2d61ae94c7b5829e3a150d7692fd84';
  }
  
  /**
   * ユーザーロールのマッピング
   */
  private _mapUserRole(roleStr?: string): Role {
    if (!roleStr) {
      return Role.GUEST;
    }
    
    switch (roleStr) {
      case 'admin':
        return Role.ADMIN;
      case 'user':
        return Role.USER;
      default:
        return Role.GUEST;
    }
  }
  
  /**
   * エラー情報を設定
   */
  private _setLastError(error: AuthError): void {
    this._lastError = error;
    Logger.error(`認証エラー: [${error.code}] ${error.message}`);
  }
  
  /**
   * 現在の認証状態を取得
   */
  public getCurrentState(): AuthState {
    return { ...this._currentState };
  }
  
  /**
   * 最後のエラーを取得
   */
  public getLastError(): AuthError | null {
    return this._lastError ? { ...this._lastError } : null;
  }
  
  /**
   * 現在認証済みかどうかを確認
   */
  public isAuthenticated(): boolean {
    return this._currentState.isAuthenticated;
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this._stopAuthCheckInterval();
    this._onStateChanged.dispose();
    this._onLoginSuccess.dispose();
    this._onLoginFailed.dispose();
    this._onLogout.dispose();
    this._onTokenRefreshed.dispose();
  }
}