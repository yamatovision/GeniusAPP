import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { AuthStorageManager } from '../../utils/AuthStorageManager';

/**
 * TokenManager - 認証トークンの管理を担当するクラス
 * 
 * 改善点:
 * - トークン有効期限のデフォルト値を延長（72時間）
 * - リフレッシュ判断のバッファ時間を調整
 * - トークンの健全性チェック機能を追加
 * - 複数ストレージ間での整合性確保
 * - ログ出力の強化
 */
export class TokenManager {
  private static instance: TokenManager;
  private storageManager: AuthStorageManager;
  private readonly DEFAULT_TOKEN_EXPIRY = 259200; // 72時間（秒）
  private readonly REFRESH_BUFFER = 7200; // 2時間前にリフレッシュ（秒）
  
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
   * デフォルト有効期限を72時間（259200秒）に設定
   */
  public async setAccessToken(token: string, expiryInSeconds: number = this.DEFAULT_TOKEN_EXPIRY): Promise<void> {
    try {
      Logger.debug(`TokenManager: アクセストークンを保存 (有効期限: ${expiryInSeconds}秒)`);
      await this.storageManager.setAccessToken(token, expiryInSeconds);
      
      // トークン保存時刻を記録（トラブルシューティング用）
      const currentTime = new Date().toISOString();
      await vscode.workspace.getConfiguration().update(
        'appgenius.auth.lastTokenUpdate', 
        currentTime, 
        vscode.ConfigurationTarget.Global
      );
      
      Logger.info(`TokenManager: アクセストークン保存完了 (長さ: ${token.length}文字, 有効期限: ${expiryInSeconds}秒)`);
    } catch (error) {
      Logger.error('TokenManager: アクセストークン保存エラー', error as Error);
      throw error;
    }
  }

  /**
   * リフレッシュトークンを保存
   */
  public async setRefreshToken(token: string): Promise<void> {
    try {
      Logger.debug('TokenManager: リフレッシュトークンを保存');
      await this.storageManager.setRefreshToken(token);
      
      // リフレッシュトークン保存時刻を記録（トラブルシューティング用）
      const currentTime = new Date().toISOString();
      await vscode.workspace.getConfiguration().update(
        'appgenius.auth.lastRefreshTokenUpdate', 
        currentTime, 
        vscode.ConfigurationTarget.Global
      );
      
      Logger.info(`TokenManager: リフレッシュトークン保存完了 (長さ: ${token.length}文字)`);
    } catch (error) {
      Logger.error('TokenManager: リフレッシュトークン保存エラー', error as Error);
      throw error;
    }
  }

  /**
   * アクセストークンを取得
   */
  public async getAccessToken(): Promise<string | undefined> {
    try {
      const token = await this.storageManager.getAccessToken();
      Logger.debug(`TokenManager: アクセストークン取得 ${token ? '成功' : '失敗'}`);
      return token;
    } catch (error) {
      Logger.error('TokenManager: アクセストークン取得エラー', error as Error);
      return undefined;
    }
  }

  /**
   * リフレッシュトークンを取得
   */
  public async getRefreshToken(): Promise<string | undefined> {
    try {
      const token = await this.storageManager.getRefreshToken();
      Logger.debug(`TokenManager: リフレッシュトークン取得 ${token ? '成功' : '失敗'}`);
      return token;
    } catch (error) {
      Logger.error('TokenManager: リフレッシュトークン取得エラー', error as Error);
      return undefined;
    }
  }

  /**
   * トークンが有効期限内かチェック
   * bufferSeconds: リフレッシュが必要と判断するまでの猶予時間（秒）
   */
  public async isTokenValid(bufferSeconds: number = this.REFRESH_BUFFER): Promise<boolean> {
    try {
      const expiry = await this.storageManager.getTokenExpiry();
      if (!expiry) {
        Logger.debug('TokenManager: トークン有効期限情報がありません');
        return false;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const isValid = currentTime < (expiry - bufferSeconds);
      
      if (isValid) {
        const remainingTime = expiry - currentTime;
        Logger.debug(`TokenManager: トークンは有効です (残り約${Math.floor(remainingTime / 3600)}時間${Math.floor((remainingTime % 3600) / 60)}分)`);
      } else {
        Logger.info(`TokenManager: トークンの有効期限が近いかすでに期限切れです (バッファ: ${bufferSeconds}秒)`);
      }
      
      return isValid;
    } catch (error) {
      Logger.error('TokenManager: トークン有効期限チェックエラー', error as Error);
      return false;
    }
  }

  /**
   * トークンが有効期限切れかどうかを直接チェック
   * トークンリフレッシュのトリガーとは別に、完全な期限切れかどうかを確認
   */
  public async isTokenExpired(): Promise<boolean> {
    try {
      const expiry = await this.storageManager.getTokenExpiry();
      if (!expiry) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime >= expiry;
    } catch (error) {
      Logger.error('TokenManager: トークン期限切れチェックエラー', error as Error);
      return true; // エラーが発生した場合は期限切れとみなす
    }
  }

  /**
   * トークンの健全性をチェック
   * 形式が正しいJWTトークンかどうかを確認
   */
  public async verifyTokenHealth(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return false;
      }
      
      // JWTの基本的な形式チェック（3つのセクションがあるかどうか）
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        Logger.warn('TokenManager: アクセストークンの形式が無効です');
        return false;
      }
      
      // ペイロード部分をデコード
      try {
        const payload = JSON.parse(atob(parts[1]));
        
        // 有効期限の存在チェック
        if (!payload.exp) {
          Logger.warn('TokenManager: トークンペイロードに有効期限情報がありません');
          return false;
        }
        
        // ユーザーIDの存在チェック
        if (!payload.id) {
          Logger.warn('TokenManager: トークンペイロードにユーザーID情報がありません');
          return false;
        }
        
        return true;
      } catch (decodeError) {
        Logger.warn('TokenManager: トークンデコードエラー', decodeError as Error);
        return false;
      }
    } catch (error) {
      Logger.error('TokenManager: トークン健全性チェックエラー', error as Error);
      return false;
    }
  }

  /**
   * 保存されているトークンをすべて削除
   */
  public async clearTokens(): Promise<void> {
    try {
      Logger.debug('TokenManager: すべてのトークンを削除します');
      await this.storageManager.clearAll();
      Logger.info('TokenManager: すべてのトークンを削除しました');
    } catch (error) {
      Logger.error('TokenManager: トークン削除エラー', error as Error);
      throw error;
    }
  }

  /**
   * トークンが存在するかチェック
   */
  public async hasToken(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const hasToken = !!token;
      Logger.debug(`TokenManager: トークン存在チェック (結果: ${hasToken})`);
      return hasToken;
    } catch (error) {
      Logger.error('TokenManager: トークン存在チェックエラー', error as Error);
      return false;
    }
  }

  /**
   * トークン有効期限の更新
   * リフレッシュトークン使用時に有効期限を更新するためのメソッド
   */
  public async updateTokenExpiry(expiryInSeconds: number): Promise<void> {
    try {
      const expiryTime = Math.floor(Date.now() / 1000) + expiryInSeconds;
      await this.storageManager.updateTokenExpiry(expiryTime);
      Logger.info(`TokenManager: トークン有効期限を更新しました (${new Date(expiryTime * 1000).toLocaleString()}まで)`);
    } catch (error) {
      Logger.error('TokenManager: トークン有効期限更新エラー', error as Error);
      throw error;
    }
  }

  /**
   * 現在の有効期限までの残り時間（秒）を取得
   */
  public async getRemainingTime(): Promise<number | undefined> {
    try {
      const expiry = await this.storageManager.getTokenExpiry();
      if (!expiry) {
        return undefined;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const remainingTime = Math.max(0, expiry - currentTime);
      
      return remainingTime;
    } catch (error) {
      Logger.error('TokenManager: 残り時間取得エラー', error as Error);
      return undefined;
    }
  }
}