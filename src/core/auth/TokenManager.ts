import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

/**
 * TokenManager - 認証トークンを安全に管理するクラス
 * 
 * VSCode Secrets APIを使用して認証トークンを安全に保存・管理します。
 * このクラスはシングルトンパターンを使用しています。
 */
export class TokenManager {
  private static instance: TokenManager;
  private secretStorage: vscode.SecretStorage;
  
  // シークレットキー
  private readonly ACCESS_TOKEN_KEY = 'appgenius.accessToken';
  private readonly REFRESH_TOKEN_KEY = 'appgenius.refreshToken';

  /**
   * シングルトンインスタンスを初期化
   */
  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  /**
   * TokenManagerのシングルトンインスタンスを取得
   * @param context 初回呼び出し時のみ必要なVSCode拡張コンテキスト
   */
  public static getInstance(context?: vscode.ExtensionContext): TokenManager {
    if (!TokenManager.instance) {
      // contextが明示的に渡された場合は、それを使用
      if (context) {
        TokenManager.instance = new TokenManager(context);
        return TokenManager.instance;
      }
      
      // contextが渡されなかった場合、グローバル変数をチェック
      try {
        // @ts-ignore - グローバル変数を利用する特例
        const globalContext = global.__extensionContext;
        if (globalContext) {
          Logger.info('グローバル変数からExtensionContextを取得しました');
          TokenManager.instance = new TokenManager(globalContext);
          return TokenManager.instance;
        }
      } catch (e) {
        Logger.error('グローバル変数からのExtensionContext取得に失敗:', e as Error);
      }

      // 両方とも利用できない場合、警告を出してダミーを使用
      // console.error -> Loggerに変更
      if (typeof Logger !== 'undefined' && Logger) {
        Logger.error('警告: TokenManagerの初期化時にExtensionContextが指定されていません');
        Logger.warn('ダミーSecretStorageを使用します（一部機能が制限されます）');
      } else {
        // Loggerが利用できない場合はconsoleにフォールバック
        console.error('警告: TokenManagerの初期化時にExtensionContextが指定されていません');
        console.log('ダミーSecretStorageを使用します（一部機能が制限されます）');
      }
      
      // ダミーコンテキストを作成（安全性向上のため）
      const dummySecretStorage: vscode.SecretStorage = {
        delete: async () => {},
        get: async () => undefined,
        store: async () => {},
        onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event
      };

      // ダミーコンテキストを作成して初期化
      const dummyContext = {
        secrets: dummySecretStorage
      } as vscode.ExtensionContext;

      TokenManager.instance = new TokenManager(dummyContext);
    }
    
    return TokenManager.instance;
  }

  /**
   * アクセストークンを保存
   * @param token 保存するアクセストークン
   */
  public async setAccessToken(token: string): Promise<void> {
    await this.secretStorage.store(this.ACCESS_TOKEN_KEY, token);
  }

  /**
   * リフレッシュトークンを保存
   * @param token 保存するリフレッシュトークン
   */
  public async setRefreshToken(token: string): Promise<void> {
    await this.secretStorage.store(this.REFRESH_TOKEN_KEY, token);
  }

  /**
   * アクセストークンを取得
   * @returns 保存されたアクセストークン、または未設定の場合はnull
   */
  public async getAccessToken(): Promise<string | undefined> {
    return this.secretStorage.get(this.ACCESS_TOKEN_KEY);
  }

  /**
   * リフレッシュトークンを取得
   * @returns 保存されたリフレッシュトークン、または未設定の場合はnull
   */
  public async getRefreshToken(): Promise<string | undefined> {
    return this.secretStorage.get(this.REFRESH_TOKEN_KEY);
  }

  /**
   * 保存されているトークンをすべて削除
   */
  public async clearTokens(): Promise<void> {
    await this.secretStorage.delete(this.ACCESS_TOKEN_KEY);
    await this.secretStorage.delete(this.REFRESH_TOKEN_KEY);
  }

  /**
   * トークンが存在するかチェック
   * @returns アクセストークンが存在する場合はtrue
   */
  public async hasToken(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }
}