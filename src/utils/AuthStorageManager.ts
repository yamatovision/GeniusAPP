import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * AuthStorageManager - 認証情報を安全に保存・取得するためのシンプルなマネージャー
 * 
 * VSCode SecretStorageのみを使用し、認証情報の保存・取得を一元管理します。
 */
export class AuthStorageManager {
  private static instance: AuthStorageManager;
  private secretStorage: vscode.SecretStorage;
  
  // セキュリティキー定義
  private readonly ACCESS_TOKEN_KEY = 'appgenius.accessToken';
  private readonly REFRESH_TOKEN_KEY = 'appgenius.refreshToken';
  private readonly TOKEN_EXPIRY_KEY = 'appgenius.tokenExpiry';
  private readonly USER_DATA_KEY = 'appgenius.userData';

  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
    Logger.info('AuthStorageManager: 初期化完了');
  }

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(context?: vscode.ExtensionContext): AuthStorageManager {
    if (!AuthStorageManager.instance) {
      if (!context) {
        throw new Error('AuthStorageManagerの初期化時にはExtensionContextが必要です');
      }
      AuthStorageManager.instance = new AuthStorageManager(context);
    }
    return AuthStorageManager.instance;
  }

  /**
   * データの保存
   */
  public async set(key: string, value: string | object): Promise<void> {
    try {
      // オブジェクトの場合はJSON文字列に変換
      const valueToStore = typeof value === 'object' 
        ? JSON.stringify(value) 
        : value;
      
      await this.secretStorage.store(key, valueToStore);
      Logger.debug(`AuthStorageManager: データを保存しました (キー: ${key})`);
    } catch (error) {
      Logger.error(`AuthStorageManager: データ保存エラー (キー: ${key})`, error as Error);
      throw error;
    }
  }

  /**
   * データの取得
   */
  public async get(key: string): Promise<string | undefined> {
    try {
      const value = await this.secretStorage.get(key);
      return value;
    } catch (error) {
      Logger.error(`AuthStorageManager: データ取得エラー (キー: ${key})`, error as Error);
      return undefined;
    }
  }

  /**
   * オブジェクトデータの取得
   */
  public async getObject<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.get(key);
      if (!value) {
        return undefined;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      Logger.error(`AuthStorageManager: オブジェクト解析エラー (キー: ${key})`, error as Error);
      return undefined;
    }
  }

  /**
   * データの削除
   */
  public async remove(key: string): Promise<void> {
    try {
      await this.secretStorage.delete(key);
      Logger.debug(`AuthStorageManager: データを削除しました (キー: ${key})`);
    } catch (error) {
      Logger.error(`AuthStorageManager: データ削除エラー (キー: ${key})`, error as Error);
      throw error;
    }
  }

  /**
   * アクセストークンの保存
   */
  public async setAccessToken(token: string, expiryInSeconds: number = 86400): Promise<void> {
    await this.set(this.ACCESS_TOKEN_KEY, token);
    
    // 有効期限を計算して保存（Unix timestamp）
    const expiryTime = Math.floor(Date.now() / 1000) + expiryInSeconds;
    await this.set(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    Logger.info(`AuthStorageManager: アクセストークンを保存しました (有効期限: ${new Date(expiryTime * 1000).toLocaleString()})`);
  }

  /**
   * リフレッシュトークンの保存
   */
  public async setRefreshToken(token: string): Promise<void> {
    await this.set(this.REFRESH_TOKEN_KEY, token);
    Logger.debug('AuthStorageManager: リフレッシュトークンを保存しました');
  }

  /**
   * アクセストークンの取得
   */
  public async getAccessToken(): Promise<string | undefined> {
    return this.get(this.ACCESS_TOKEN_KEY);
  }

  /**
   * リフレッシュトークンの取得
   */
  public async getRefreshToken(): Promise<string | undefined> {
    return this.get(this.REFRESH_TOKEN_KEY);
  }

  /**
   * トークンの有効期限を取得
   */
  public async getTokenExpiry(): Promise<number | undefined> {
    const expiryStr = await this.get(this.TOKEN_EXPIRY_KEY);
    return expiryStr ? parseInt(expiryStr, 10) : undefined;
  }

  /**
   * ユーザーデータの保存
   */
  public async setUserData(userData: any): Promise<void> {
    await this.set(this.USER_DATA_KEY, userData);
    Logger.debug('AuthStorageManager: ユーザーデータを保存しました');
  }

  /**
   * ユーザーデータの取得
   */
  public async getUserData<T>(): Promise<T | undefined> {
    return this.getObject<T>(this.USER_DATA_KEY);
  }

  /**
   * 全ての認証データを削除
   */
  public async clearAll(): Promise<void> {
    await this.remove(this.ACCESS_TOKEN_KEY);
    await this.remove(this.REFRESH_TOKEN_KEY);
    await this.remove(this.TOKEN_EXPIRY_KEY);
    await this.remove(this.USER_DATA_KEY);
    Logger.info('AuthStorageManager: すべての認証データを削除しました');
  }
}