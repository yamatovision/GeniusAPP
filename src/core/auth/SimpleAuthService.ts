import * as vscode from 'vscode';
import axios from 'axios';
import { Logger } from '../../utils/logger';
import { Role } from './roles';
import { AuthState, AuthStateBuilder } from './AuthState';

/**
 * SimpleAuthService - シンプルな認証サービス
 * 
 * 分離認証モードの複雑さを排除し、直接的なトークン管理を行います。
 * 簡素化された設計により、認証の信頼性と安定性を向上させます。
 */
export class SimpleAuthService {
  private static instance: SimpleAuthService;
  private _currentState: AuthState;
  private _accessToken: string | undefined;
  private _refreshToken: string | undefined;
  private _tokenExpiry: number | undefined;
  private _apiKey: string | undefined;
  
  // APIベースURL
  private readonly API_BASE_URL = 'http://localhost:3001/simple';
  
  // ストレージキー
  private readonly ACCESS_TOKEN_KEY = 'appgenius.simple.accessToken';
  private readonly REFRESH_TOKEN_KEY = 'appgenius.simple.refreshToken';
  private readonly TOKEN_EXPIRY_KEY = 'appgenius.simple.tokenExpiry';
  private readonly USER_DATA_KEY = 'appgenius.simple.userData';
  private readonly API_KEY_DATA_KEY = 'appgenius.simple.apiKey';
  
  // イベントエミッター
  private _onStateChanged = new vscode.EventEmitter<AuthState>();
  private _onLoginSuccess = new vscode.EventEmitter<void>();
  private _onLoginFailed = new vscode.EventEmitter<{message: string}>();
  private _onLogout = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onStateChanged = this._onStateChanged.event;
  public readonly onLoginSuccess = this._onLoginSuccess.event;
  public readonly onLoginFailed = this._onLoginFailed.event;
  public readonly onLogout = this._onLogout.event;
  
  /**
   * シークレットストレージ
   */
  private secretStorage: vscode.SecretStorage;
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
    this._currentState = AuthStateBuilder.guest().build();
    
    // 初期化
    this._initialize();
  }
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(context?: vscode.ExtensionContext): SimpleAuthService {
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
  private async _initialize(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: 初期化開始');
      
      // 保存されているトークンを読み込み
      await this._loadTokens();
      
      // 認証状態復元
      if (this._accessToken) {
        await this._verifyAndRestoreSession();
      }
      
      Logger.info('SimpleAuthService: 初期化完了');
    } catch (error) {
      Logger.error('SimpleAuthService: 初期化エラー', error as Error);
    }
  }
  
  /**
   * トークンをロード
   */
  private async _loadTokens(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: トークンロード開始');
      
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
        Logger.info('SimpleAuthService: トークンロード成功');
      } else {
        Logger.info('SimpleAuthService: 保存済みトークンなし');
      }
      
      if (this._apiKey) {
        Logger.info('SimpleAuthService: APIキーロード成功');
      }
    } catch (error) {
      Logger.error('SimpleAuthService: トークンロードエラー', error as Error);
    }
  }
  
  /**
   * トークンを保存
   */
  private async _saveTokens(
    accessToken: string, 
    refreshToken: string, 
    expiryInSeconds: number
  ): Promise<void> {
    try {
      Logger.info('SimpleAuthService: トークン保存開始');
      
      // メモリに保存
      this._accessToken = accessToken;
      this._refreshToken = refreshToken;
      this._tokenExpiry = Date.now() + (expiryInSeconds * 1000);
      
      // セキュアストレージに保存
      await this.secretStorage.store(this.ACCESS_TOKEN_KEY, accessToken);
      await this.secretStorage.store(this.REFRESH_TOKEN_KEY, refreshToken);
      await this.secretStorage.store(this.TOKEN_EXPIRY_KEY, this._tokenExpiry.toString());
      
      Logger.info('SimpleAuthService: トークン保存完了');
    } catch (error) {
      Logger.error('SimpleAuthService: トークン保存エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * トークンをクリア
   */
  private async _clearTokens(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: トークンクリア開始');
      
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
      
      Logger.info('SimpleAuthService: トークンクリア完了');
    } catch (error) {
      Logger.error('SimpleAuthService: トークンクリアエラー', error as Error);
    }
  }
  
  /**
   * 認証状態更新
   */
  private _updateAuthState(newState: AuthState): void {
    const oldState = this._currentState;
    this._currentState = newState;
    
    // 状態変更を通知
    this._onStateChanged.fire(newState);
    
    // 状態を詳細ログ出力
    Logger.info(`SimpleAuthService: 認証状態更新 [${oldState.isAuthenticated} => ${newState.isAuthenticated}]`);
  }
  
  /**
   * セッション復元
   */
  private async _verifyAndRestoreSession(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: セッション復元開始');
      
      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        return false;
      }
      
      // トークン有効期限チェック
      if (this._tokenExpiry && this._tokenExpiry < Date.now()) {
        Logger.info('SimpleAuthService: トークン期限切れ、リフレッシュ試行');
        const refreshed = await this._refreshAccessToken();
        if (!refreshed) {
          Logger.info('SimpleAuthService: リフレッシュ失敗');
          await this._clearTokens();
          this._updateAuthState(AuthStateBuilder.guest().build());
          return false;
        }
      }
      
      // トークン検証と現在のユーザー情報取得
      const userInfo = await this._fetchUserInfo();
      
      if (!userInfo) {
        Logger.info('SimpleAuthService: ユーザー情報取得失敗');
        await this._clearTokens();
        this._updateAuthState(AuthStateBuilder.guest().build());
        return false;
      }
      
      // ユーザー情報を認証状態に反映
      const roleEnum = this._mapStringToRole(userInfo.role);
      const newState = new AuthStateBuilder()
        .setAuthenticated(true)
        .setUserId(userInfo.id)
        .setUsername(userInfo.name)
        .setRole(roleEnum)
        .setPermissions(userInfo.permissions || [])
        .setExpiresAt(this._tokenExpiry)
        .build();
      
      // 認証状態更新
      this._updateAuthState(newState);
      Logger.info('SimpleAuthService: セッション復元完了', userInfo.name);
      return true;
    } catch (error) {
      Logger.error('SimpleAuthService: セッション復元エラー', error as Error);
      await this._clearTokens();
      this._updateAuthState(AuthStateBuilder.guest().build());
      return false;
    }
  }
  
  /**
   * サーバーからユーザー情報取得
   */
  private async _fetchUserInfo(): Promise<any> {
    try {
      Logger.info('SimpleAuthService: ユーザー情報取得開始');
      
      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        return null;
      }
      
      // APIリクエスト
      const response = await axios.get(`${this.API_BASE_URL}/auth/check`, {
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.success) {
        Logger.info('SimpleAuthService: ユーザー情報取得成功');
        
        // ユーザーデータをセキュアストレージに保存（キャッシュ）
        await this.secretStorage.store(
          this.USER_DATA_KEY, 
          JSON.stringify(response.data.data)
        );
        
        // APIキーが含まれている場合は保存
        if (response.data.data.apiKey) {
          this._apiKey = response.data.data.apiKey;
          await this.secretStorage.store(this.API_KEY_DATA_KEY, this._apiKey);
          Logger.info('SimpleAuthService: APIキーを保存しました');
        }
        
        return response.data.data;
      }
      
      Logger.info('SimpleAuthService: ユーザー情報取得失敗', response.data);
      return null;
    } catch (error: any) {
      Logger.error('SimpleAuthService: ユーザー情報取得エラー', error?.response?.data || error);
      
      // トークン切れや認証エラーの場合
      if (error?.response?.status === 401) {
        Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
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
  private async _refreshAccessToken(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: トークンリフレッシュ開始');
      
      if (!this._refreshToken) {
        Logger.info('SimpleAuthService: リフレッシュトークンなし');
        return false;
      }
      
      // APIリクエスト
      const response = await axios.post(`${this.API_BASE_URL}/auth/refresh-token`, {
        refreshToken: this._refreshToken
      });
      
      if (response.data && response.data.success && response.data.data.accessToken) {
        Logger.info('SimpleAuthService: トークンリフレッシュ成功');
        
        // 新しいトークンを保存
        await this._saveTokens(
          response.data.data.accessToken,
          response.data.data.refreshToken || this._refreshToken,
          // 有効期限の指定がなければ24時間（秒単位）
          86400
        );
        
        return true;
      }
      
      Logger.info('SimpleAuthService: トークンリフレッシュ失敗', response.data);
      return false;
    } catch (error) {
      Logger.error('SimpleAuthService: トークンリフレッシュエラー', error as Error);
      return false;
    }
  }
  
  /**
   * ロール文字列をEnum変換
   */
  private _mapStringToRole(roleStr: string): Role {
    const roleMapping: Record<string, Role> = {
      'user': Role.USER,
      'admin': Role.ADMIN,
      'super_admin': Role.SUPER_ADMIN,
      'Admin': Role.ADMIN,
      'SuperAdmin': Role.SUPER_ADMIN,
      'User': Role.USER
    };
    
    return roleMapping[roleStr] || Role.GUEST;
  }
  
  /**
   * ログイン
   * @param email メールアドレス
   * @param password パスワード
   */
  public async login(email: string, password: string): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: ログイン開始');
      
      const response = await axios.post(`${this.API_BASE_URL}/auth/login`, {
        email,
        password
      });
      
      if (response.data && response.data.success && response.data.data.accessToken) {
        Logger.info('SimpleAuthService: ログイン成功');
        
        // トークンを保存
        await this._saveTokens(
          response.data.data.accessToken,
          response.data.data.refreshToken,
          // 有効期限の指定がなければ24時間（秒単位）
          86400
        );
        
        // ユーザー情報を取得して認証状態を更新
        await this._verifyAndRestoreSession();
        
        // ログイン成功イベント
        this._onLoginSuccess.fire();
        
        return true;
      }
      
      Logger.info('SimpleAuthService: ログイン失敗', response.data);
      this._onLoginFailed.fire({ message: response.data.message || 'ログインに失敗しました' });
      return false;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || '接続エラーが発生しました';
      Logger.error('SimpleAuthService: ログインエラー', error);
      this._onLoginFailed.fire({ message: errorMessage });
      return false;
    }
  }
  
  /**
   * ログアウト
   */
  public async logout(): Promise<void> {
    try {
      Logger.info('SimpleAuthService: ログアウト開始');
      
      if (this._refreshToken) {
        // APIリクエスト（エラーはキャッチするが処理継続）
        try {
          await axios.post(`${this.API_BASE_URL}/auth/logout`, {
            refreshToken: this._refreshToken
          });
          Logger.info('SimpleAuthService: サーバーログアウト成功');
        } catch (apiError) {
          Logger.warn('SimpleAuthService: サーバーログアウトエラー', apiError as Error);
        }
      }
      
      // トークンクリア
      await this._clearTokens();
      
      // 認証状態をゲストに変更
      this._updateAuthState(AuthStateBuilder.guest().build());
      
      // ログアウトイベント
      this._onLogout.fire();
      
      Logger.info('SimpleAuthService: ログアウト完了');
    } catch (error) {
      Logger.error('SimpleAuthService: ログアウトエラー', error as Error);
      
      // エラーが発生しても確実にログアウト状態にする
      await this._clearTokens();
      this._updateAuthState(AuthStateBuilder.guest().build());
      this._onLogout.fire();
    }
  }
  
  /**
   * 認証ヘッダーを取得
   * APIリクエスト時に使用
   */
  public getAuthHeader(): Record<string, string> {
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
  public getCurrentState(): AuthState {
    return this._currentState;
  }
  
  /**
   * 認証済みかチェック
   */
  public isAuthenticated(): boolean {
    return this._currentState.isAuthenticated;
  }
  
  /**
   * アクセストークン取得
   * 内部利用専用
   */
  public getAccessToken(): string | undefined {
    return this._accessToken;
  }
  
  /**
   * APIキー取得
   * ClaudeCode統合用
   */
  public getApiKey(): string | undefined {
    return this._apiKey;
  }
  
  /**
   * 認証状態の検証
   * 必要に応じてトークンリフレッシュ
   */
  public async verifyAuthState(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: 認証状態検証開始');
      
      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        return false;
      }
      
      // トークン有効期限チェック
      if (this._tokenExpiry && this._tokenExpiry < Date.now()) {
        Logger.info('SimpleAuthService: トークン期限切れ、リフレッシュ試行');
        const refreshed = await this._refreshAccessToken();
        if (!refreshed) {
          Logger.info('SimpleAuthService: リフレッシュ失敗');
          return false;
        }
      }
      
      // サーバーと通信してトークン検証
      const verified = await this._verifyTokenWithServer();
      Logger.info(`SimpleAuthService: トークン検証結果=${verified}`);
      
      return verified;
    } catch (error) {
      Logger.error('SimpleAuthService: 認証状態検証エラー', error as Error);
      return false;
    }
  }
  
  /**
   * サーバーとの通信でトークン検証
   */
  private async _verifyTokenWithServer(): Promise<boolean> {
    try {
      Logger.info('SimpleAuthService: サーバートークン検証開始');
      
      if (!this._accessToken) {
        Logger.info('SimpleAuthService: アクセストークンなし');
        return false;
      }
      
      // APIリクエスト
      const response = await axios.get(`${this.API_BASE_URL}/auth/check`, {
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.success) {
        Logger.info('SimpleAuthService: サーバー検証成功');
        return true;
      }
      
      Logger.info('SimpleAuthService: サーバー検証失敗', response.data);
      return false;
    } catch (error: any) {
      Logger.error('SimpleAuthService: サーバー検証エラー', error?.response?.data || error);
      
      // トークン切れや認証エラーの場合
      if (error?.response?.status === 401) {
        Logger.info('SimpleAuthService: 認証エラー、トークンリフレッシュ試行');
        return await this._refreshAccessToken();
      }
      
      return false;
    }
  }
}