import * as vscode from 'vscode';
import { Role, Feature } from '../roles';

/**
 * シンプルな認証状態インターフェース
 */
export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  username?: string;
  role: Role;
  permissions?: string[];
  timestamp?: number;
  expiresAt?: number;
  userData?: any;
}

/**
 * AuthStore - 認証状態を一元管理するシンプルなストア
 * 
 * 全ての認証関連状態を一箇所で管理し、変更を監視できるようにする
 */
export class AuthStore {
  private static instance: AuthStore;
  
  // 基本状態
  private _state: AuthState = { isAuthenticated: false, role: Role.GUEST };
  
  // イベントリスナー
  private _listeners: ((state: AuthState) => void)[] = [];
  
  // ストレージ
  private _storage: vscode.SecretStorage;
  
  // ストレージキー
  private readonly ACCESS_TOKEN_KEY = 'auth.accessToken';
  private readonly REFRESH_TOKEN_KEY = 'auth.refreshToken';
  private readonly API_KEY_KEY = 'auth.apiKey';
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this._storage = context.secrets;
  }
  
  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(context?: vscode.ExtensionContext): AuthStore {
    if (!AuthStore.instance) {
      if (!context) throw new Error('初期化にはExtensionContextが必要です');
      AuthStore.instance = new AuthStore(context);
    }
    return AuthStore.instance;
  }
  
  /**
   * 現在の認証状態を取得
   */
  public getState(): AuthState {
    return { ...this._state }; // イミュータブルコピーを返す
  }
  
  /**
   * 認証状態を更新
   */
  public setState(newState: Partial<AuthState>): void {
    this._state = { ...this._state, ...newState };
    this._notifyListeners();
    
    // グローバル変数への保存（後方互換性のため）
    // @ts-ignore - グローバル変数への代入
    global._appgenius_auth_state = this._state;
    
    // 認証状態の変更をコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.log('認証状態更新:', JSON.stringify({
        isAuthenticated: this._state.isAuthenticated,
        role: this._state.role,
        username: this._state.username
      }));
    }
  }
  
  /**
   * ユーザーを認証済み状態に設定
   */
  public setAuthenticated(userData: any, expiresAt?: number): void {
    const role = this._mapRole(userData.role);
    
    this._state = {
      isAuthenticated: true,
      userId: userData.id,
      username: userData.name,
      role,
      expiresAt,
      userData
    };
    
    this._notifyListeners();
    
    // グローバル変数への保存（後方互換性のため）
    // @ts-ignore - グローバル変数への代入
    global._appgenius_auth_state = this._state;
  }
  
  /**
   * 未認証状態に設定
   */
  public setUnauthenticated(): void {
    this._state = { isAuthenticated: false, role: Role.GUEST };
    this._notifyListeners();
    
    // グローバル変数への保存（後方互換性のため）
    // @ts-ignore - グローバル変数への代入
    global._appgenius_auth_state = this._state;
  }
  
  /**
   * 変更リスナーに通知
   */
  private _notifyListeners(): void {
    this._listeners.forEach(listener => listener(this.getState()));
  }
  
  /**
   * 状態変更を購読
   * @returns 購読解除関数
   */
  public subscribe(listener: (state: AuthState) => void): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * トークンを保存
   */
  public async saveTokens(accessToken: string, refreshToken: string, expiryInSeconds: number = 86400): Promise<void> {
    try {
      await this._storage.store(this.ACCESS_TOKEN_KEY, accessToken);
      await this._storage.store(this.REFRESH_TOKEN_KEY, refreshToken);
      
      const expiryTimestamp = Date.now() + (expiryInSeconds * 1000);
      this.setState({ expiresAt: expiryTimestamp });
      
      // グローバル変数への保存（後方互換性のため）
      // @ts-ignore - グローバル変数への代入
      global._appgenius_auth_token = accessToken;
    } catch (error) {
      console.error('トークン保存エラー:', error);
      throw error;
    }
  }
  
  /**
   * トークンの取得
   */
  public async getTokens(): Promise<{ accessToken?: string, refreshToken?: string }> {
    try {
      const accessToken = await this._storage.get(this.ACCESS_TOKEN_KEY) || undefined;
      const refreshToken = await this._storage.get(this.REFRESH_TOKEN_KEY) || undefined;
      
      // バックアップとしてグローバル変数からのアクセストークン取得（後方互換性のため）
      if (!accessToken && global._appgenius_auth_token) {
        return { 
          accessToken: global._appgenius_auth_token,
          refreshToken
        };
      }
      
      return { accessToken, refreshToken };
    } catch (error) {
      console.error('トークン取得エラー:', error);
      return {};
    }
  }
  
  /**
   * トークンのクリア
   */
  public async clearTokens(): Promise<void> {
    try {
      await this._storage.delete(this.ACCESS_TOKEN_KEY);
      await this._storage.delete(this.REFRESH_TOKEN_KEY);
      
      // グローバル変数からも削除
      // @ts-ignore - グローバル変数への代入
      global._appgenius_auth_token = undefined;
    } catch (error) {
      console.error('トークンクリアエラー:', error);
    }
  }
  
  /**
   * APIキーの保存
   */
  public async saveApiKey(apiKey: string): Promise<void> {
    try {
      await this._storage.store(this.API_KEY_KEY, apiKey);
    } catch (error) {
      console.error('APIキー保存エラー:', error);
      throw error;
    }
  }
  
  /**
   * APIキーの取得
   */
  public async getApiKey(): Promise<string | undefined> {
    try {
      return await this._storage.get(this.API_KEY_KEY) || undefined;
    } catch (error) {
      console.error('APIキー取得エラー:', error);
      return undefined;
    }
  }
  
  /**
   * APIキーのクリア
   */
  public async clearApiKey(): Promise<void> {
    try {
      await this._storage.delete(this.API_KEY_KEY);
    } catch (error) {
      console.error('APIキークリアエラー:', error);
    }
  }
  
  /**
   * ロール文字列を内部Roleに変換
   */
  private _mapRole(roleStr: string): Role {
    // 単純化したロールマッピング
    const lowercased = roleStr?.toLowerCase() || '';
    
    if (lowercased.includes('super') && lowercased.includes('admin')) {
      return Role.SUPER_ADMIN;
    }
    
    if (lowercased.includes('admin')) {
      return Role.ADMIN;
    }
    
    if (lowercased) {
      return Role.USER;
    }
    
    return Role.GUEST;
  }
}