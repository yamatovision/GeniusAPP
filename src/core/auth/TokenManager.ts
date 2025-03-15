import * as vscode from 'vscode';

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
      if (!context) {
        // 安全に処理できるようにする
        console.error('警告: TokenManagerの初期化時にExtensionContextが指定されていません');
        
        // vscodeグローバル命名空間からExtensionContextの取得を試みる（バックアップ手段）
        try {
          // @ts-ignore - グローバル変数を利用する特例
          const globalContext = global.__extensionContext;
          if (globalContext) {
            console.log('グローバル変数からExtensionContextを取得しました');
            TokenManager.instance = new TokenManager(globalContext);
            return TokenManager.instance;
          }
        } catch (e) {
          console.error('グローバル変数からのExtensionContext取得に失敗:', e);
        }

        // ダミーコンテキストを作成（安全性向上のため）
        console.log('ダミーSecretStorageを使用します（一部機能が制限されます）');
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
        return TokenManager.instance;
      }
      
      TokenManager.instance = new TokenManager(context);
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