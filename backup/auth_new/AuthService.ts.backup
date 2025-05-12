import * as vscode from 'vscode';
import axios from 'axios';
import { AuthStore } from './AuthStore';
import { Logger } from '../../../utils/logger';

/**
 * AuthService - 認証処理を担当するシンプルなサービス
 * 
 * API通信を行い、ログイン・ログアウト・トークンリフレッシュなどの
 * 認証関連の機能を提供する
 */
export class AuthService {
  private static instance: AuthService;
  private _authStore: AuthStore;
  
  // APIベースURL
  private readonly API_BASE_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/simple';
  
  /**
   * コンストラクタ
   */
  private constructor(authStore: AuthStore) {
    this._authStore = authStore;
  }
  
  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(authStore?: AuthStore): AuthService {
    if (!AuthService.instance) {
      if (!authStore) throw new Error('初期化にはAuthStoreが必要です');
      AuthService.instance = new AuthService(authStore);
    }
    return AuthService.instance;
  }
  
  /**
   * ログイン処理
   */
  public async login(email: string, password: string): Promise<boolean> {
    try {
      Logger.info('AuthService: ログイン開始');
      
      const response = await axios.post(`${this.API_BASE_URL}/auth/login`, { email, password });
      
      if (response.data?.success && response.data?.data?.accessToken) {
        // APIレスポンス構造を解析
        const data = response.data.data;
        const accessToken = data.accessToken;
        const refreshToken = data.refreshToken;
        const expiryInSeconds = 86400; // デフォルト1日
        
        // トークン保存
        await this._authStore.saveTokens(accessToken, refreshToken, expiryInSeconds);
        
        // APIキー保存（もし存在すれば）
        if (data.apiKey) {
          let apiKeyValue;
          
          if (typeof data.apiKey === 'string') {
            apiKeyValue = data.apiKey;
          } else if (data.apiKey.keyValue) {
            apiKeyValue = data.apiKey.keyValue;
          } else if (data.apiKey.apiKeyFull) {
            apiKeyValue = data.apiKey.apiKeyFull;
          }
          
          if (apiKeyValue) {
            await this._authStore.saveApiKey(apiKeyValue);
            Logger.info('AuthService: APIキーをレスポンスから保存しました');
          }
        }
        
        // ユーザー情報抽出
        const userData = data.user || {
          id: 'unknown',
          name: email.split('@')[0],
          role: 'user'
        };
        
        // 認証状態更新
        this._authStore.setAuthenticated(userData, Date.now() + (expiryInSeconds * 1000));
        
        // APIキーがレスポンスになければサーバーから取得
        if (!data.apiKey) {
          try {
            await this._fetchApiKey(accessToken);
          } catch (apiKeyError) {
            // APIキー取得失敗はログイン失敗にしない
            Logger.warn('AuthService: APIキー取得に失敗しましたが、ログインは成功しています');
          }
        }
        
        Logger.info(`AuthService: ログイン成功: ${userData.name}`);
        return true;
      }
      
      Logger.warn('AuthService: ログイン失敗 - サーバーレスポンスエラー');
      return false;
    } catch (error) {
      Logger.error('AuthService: ログインエラー', error as Error);
      return false;
    }
  }
  
  /**
   * ログアウト処理
   */
  public async logout(): Promise<void> {
    try {
      Logger.info('AuthService: ログアウト開始');
      
      const { refreshToken } = await this._authStore.getTokens();
      
      // サーバーにログアウトリクエスト送信（必須ではない）
      if (refreshToken) {
        try {
          await axios.post(`${this.API_BASE_URL}/auth/logout`, { refreshToken });
          Logger.info('AuthService: サーバーログアウト成功');
        } catch (apiError) {
          // サーバーログアウトエラーは無視
          Logger.warn('AuthService: サーバーログアウトエラー', apiError as Error);
        }
      }
    } catch (error) {
      Logger.error('AuthService: ログアウト中にエラーが発生しました', error as Error);
    } finally {
      // 必ずローカルの認証情報をクリア
      await this._authStore.clearTokens();
      await this._authStore.clearApiKey();
      this._authStore.setUnauthenticated();
      Logger.info('AuthService: ログアウト完了');
    }
  }
  
  // 検証処理の進行中フラグ
  private _isVerifying: boolean = false;
  
  /**
   * セッション検証
   */
  public async verifySession(): Promise<boolean> {
    try {
      // 既に検証中の場合は進行中の検証結果を待たずに現在の認証状態を返す
      if (this._isVerifying) {
        Logger.info('AuthService: 検証処理が既に進行中。重複検証回避');
        return this._authStore.getState().isAuthenticated;
      }
      
      this._isVerifying = true;
      Logger.info('AuthService: セッション検証開始');
      
      const { accessToken, refreshToken } = await this._authStore.getTokens();
      if (!accessToken) {
        Logger.info('AuthService: アクセストークンなし');
        this._isVerifying = false;
        return false;
      }
      
      // ユーザー情報取得
      try {
        const response = await axios.get(`${this.API_BASE_URL}/auth/check`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.data?.success) {
          // ユーザー情報を抽出
          let userData = response.data.data;
          
          // APIレスポンス形式が { data: { user: { ... } } } の場合の対応
          if (userData && userData.user) {
            userData = userData.user;
          }
          
          // 認証状態更新
          this._authStore.setAuthenticated(userData);
          
          // APIキーを確認・取得
          const apiKey = await this._authStore.getApiKey();
          if (!apiKey) {
            await this._fetchApiKey(accessToken);
          }
          
          Logger.info(`AuthService: セッション検証成功: ${userData.name}`);
          this._isVerifying = false;
          return true;
        }
      } catch (checkError) {
        // 401エラーの場合はリフレッシュトークン試行
        if (axios.isAxiosError(checkError) && checkError.response?.status === 401) {
          if (refreshToken) {
            Logger.info('AuthService: 認証エラー、トークンリフレッシュ試行');
            const result = await this._refreshToken(refreshToken);
            this._isVerifying = false;
            return result;
          }
        }
        
        Logger.warn('AuthService: セッション検証エラー', checkError as Error);
      }
      
      // ここまでで成功していなければ失敗
      this._authStore.setUnauthenticated();
      this._isVerifying = false;
      return false;
    } catch (error) {
      Logger.error('AuthService: セッション検証中にエラーが発生しました', error as Error);
      this._authStore.setUnauthenticated();
      this._isVerifying = false;
      return false;
    }
  }
  
  /**
   * アクセストークンのリフレッシュ
   */
  private async _refreshToken(refreshToken: string): Promise<boolean> {
    try {
      Logger.info('AuthService: トークンリフレッシュ開始');
      
      const response = await axios.post(`${this.API_BASE_URL}/auth/refresh-token`, {
        refreshToken
      });
      
      if (response.data?.success && response.data?.data?.accessToken) {
        // 新しいトークンを保存
        await this._authStore.saveTokens(
          response.data.data.accessToken,
          response.data.data.refreshToken || refreshToken,
          86400 // デフォルト1日
        );
        
        // ユーザー情報の取得に成功したかどうかのフラグ
        let userInfoSuccess = false;
        
        try {
          // ユーザー情報を取得
          const userInfoResponse = await axios.get(`${this.API_BASE_URL}/auth/check`, {
            headers: { 'Authorization': `Bearer ${response.data.data.accessToken}` }
          });
          
          if (userInfoResponse.data?.success) {
            // ユーザー情報を抽出
            let userData = userInfoResponse.data.data;
            
            // APIレスポンス形式が { data: { user: { ... } } } の場合の対応
            if (userData && userData.user) {
              userData = userData.user;
            }
            
            // 認証状態更新
            this._authStore.setAuthenticated(userData);
            userInfoSuccess = true;
            
            Logger.info(`AuthService: トークンリフレッシュ成功: ${userData.name}`);
          }
        } catch (userInfoError) {
          // ユーザー情報取得エラーはログに記録するだけで失敗としない
          Logger.warn('AuthService: ユーザー情報取得エラー', userInfoError as Error);
        }
        
        // ユーザー情報取得に失敗しても、トークン自体の更新に成功していれば成功とみなす
        if (!userInfoSuccess) {
          Logger.info('AuthService: トークン更新成功（ユーザー情報なし）');
        }
        
        return true;
      }
      
      Logger.warn('AuthService: トークンリフレッシュ失敗');
      return false;
    } catch (error) {
      Logger.error('AuthService: トークンリフレッシュエラー', error as Error);
      return false;
    }
  }
  
  /**
   * APIキー取得
   */
  private async _fetchApiKey(accessToken: string): Promise<string | undefined> {
    try {
      Logger.info('AuthService: APIキー取得開始');
      
      // APIキー取得専用エンドポイント呼び出し
      const response = await axios.get(`${this.API_BASE_URL}/user/anthropic-api-key`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data?.success && response.data?.data) {
        // 新しいフォーマット対応
        let apiKey;
        
        if (response.data.data.apiKeyFull) {
          apiKey = response.data.data.apiKeyFull;
        } else if (response.data.data.key) {
          apiKey = response.data.data.key;
        } else if (response.data.data.keyValue) {
          apiKey = response.data.data.keyValue;
        }
        
        if (apiKey) {
          await this._authStore.saveApiKey(apiKey);
          Logger.info('AuthService: APIキーを保存しました');
          return apiKey;
        }
      }
      
      Logger.warn('AuthService: APIキー取得失敗 - レスポンスにAPIキーがありません');
      return undefined;
    } catch (error) {
      Logger.error('AuthService: APIキー取得エラー', error as Error);
      return undefined;
    }
  }
  
  /**
   * APIキー取得 (外部向け)
   */
  public async getApiKey(): Promise<string | undefined> {
    try {
      // まずストアから取得
      const storedApiKey = await this._authStore.getApiKey();
      if (storedApiKey) {
        return storedApiKey;
      }
      
      // ストアになければサーバーから取得
      const { accessToken } = await this._authStore.getTokens();
      if (accessToken) {
        return await this._fetchApiKey(accessToken);
      }
      
      Logger.warn('AuthService: APIキー取得失敗 - アクセストークンがありません');
      return undefined;
    } catch (error) {
      Logger.error('AuthService: APIキー取得エラー', error as Error);
      return undefined;
    }
  }
  
  /**
   * トークン情報を取得
   */
  public async getTokens(): Promise<{ accessToken?: string, refreshToken?: string }> {
    try {
      const tokens = await this._authStore.getTokens();
      return tokens;
    } catch (error) {
      Logger.error('AuthService: トークン取得エラー', error as Error);
      return {};
    }
  }
  
  /**
   * 認証ヘッダーの取得
   */
  public async getAuthHeader(): Promise<Record<string, string>> {
    const { accessToken } = await this._authStore.getTokens();
    if (!accessToken) {
      return {};
    }
    
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }
}