import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { AuthStorageManager } from '../../utils/AuthStorageManager';

/**
 * TokenManager - 認証トークンの管理を担当するシンプルなクラス
 * 
 * トークンの保存・取得・検証のみに責任を限定し、
 * ストレージ層はAuthStorageManagerに委譲します。
 */
export class TokenManager {
  private static instance: TokenManager;
  private storageManager: AuthStorageManager;
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this.storageManager = AuthStorageManager.getInstance(context);
    Logger.info('TokenManager: 初期化完了');
  }

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(context?: vscode.ExtensionContext): TokenManager {
    if (!TokenManager.instance) {
      if (!context) {
        throw new Error('TokenManagerの初期化時にはExtensionContextが必要です');
      }
      TokenManager.instance = new TokenManager(context);
    }
    return TokenManager.instance;
  }

  /**
   * アクセストークンを保存
   */
  public async setAccessToken(token: string, expiryInSeconds: number = 86400): Promise<void> {
    await this.storageManager.setAccessToken(token, expiryInSeconds);
  }

  /**
   * リフレッシュトークンを保存
   */
  public async setRefreshToken(token: string): Promise<void> {
    await this.storageManager.setRefreshToken(token);
  }

  /**
   * アクセストークンを取得
   */
  public async getAccessToken(): Promise<string | undefined> {
    return this.storageManager.getAccessToken();
  }

  /**
   * リフレッシュトークンを取得
   */
  public async getRefreshToken(): Promise<string | undefined> {
    return this.storageManager.getRefreshToken();
  }

  /**
   * トークンが有効期限内かチェック
   */
  public async isTokenValid(bufferSeconds: number = 300): Promise<boolean> {
    const expiry = await this.storageManager.getTokenExpiry();
    if (!expiry) {
      return false;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime < (expiry - bufferSeconds);
  }

  /**
   * 保存されているトークンをすべて削除
   */
  public async clearTokens(): Promise<void> {
    await this.storageManager.clearAll();
  }

  /**
   * トークンが存在するかチェック
   */
  public async hasToken(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }
}