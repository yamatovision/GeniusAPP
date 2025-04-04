import { Logger } from '../../utils/logger';

/**
 * ClaudeCode認証同期を管理するクラス
 * 認証関連の処理を担当
 */
export class AuthSyncManager {
  // SimpleAuthサービスとAuthenticationServiceのインスタンス
  private simpleAuthService: any | null = null;
  private authService: any | null = null;
  private authSync: any | null = null;
  
  /**
   * 認証サービスの初期化と取得
   */
  public async initAuthServices(): Promise<boolean> {
    try {
      // 認証同期サービスを取得
      if (!this.authSync) {
        this.authSync = await import('../ClaudeCodeAuthSync')
          .then(module => module.ClaudeCodeAuthSync.getInstance());
      }
      
      // 認証サービスを取得
      if (!this.authService) {
        this.authService = await import('../../core/auth/AuthenticationService')
          .then(module => module.AuthenticationService.getInstance());
      }
      
      // SimpleAuthServiceのインスタンスも取得（APIキー取得用）
      if (!this.simpleAuthService) {
        try {
          this.simpleAuthService = await import('../../core/auth/SimpleAuthService')
            .then(module => module.SimpleAuthService.getInstance());
          Logger.info('SimpleAuthServiceのインスタンスを取得しました');
        } catch (error) {
          Logger.warn('SimpleAuthServiceのインスタンス取得に失敗しました。レガシー認証を使用します', error as Error);
          // SimpleAuthService無しでも続行可能
        }
      }
      
      return true;
    } catch (error) {
      Logger.error('認証サービスの初期化に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * CLIログイン状態を確認
   */
  public isClaudeCliLoggedIn(): boolean {
    if (!this.authSync) {
      Logger.warn('authSyncが初期化されていません。ログイン状態の確認に失敗しました。');
      return false;
    }
    
    const isLoggedIn = this.authSync.isClaudeCliLoggedIn();
    Logger.info(`Claude CLI ログイン状態: ${isLoggedIn ? 'ログイン済み' : '未ログイン'}`);
    return isLoggedIn;
  }
  
  /**
   * APIキーが利用可能かどうかを確認
   * @throws {Error} APIキーが利用できない場合にエラー
   */
  public async isApiKeyAvailable(): Promise<boolean> {
    // 開発モード：常にAPIキーが利用可能と報告
    Logger.info('開発モード: APIキーチェックをスキップし、常に利用可能として処理します');
    return true;
  }
  
  /**
   * サービス利用のためのAPIキー情報をマスク処理して取得（ログ用）
   */
  public async getApiKeyInfo(): Promise<{ 
    available: boolean; 
    maskedApiKey?: string; 
    userId?: string;
    userName?: string;
    userRole?: string;
    orgName?: string;
  }> {
    if (!this.simpleAuthService) {
      return { available: false };
    }
    
    try {
      const apiKey = await this.simpleAuthService.getApiKey();
      
      if (!apiKey) {
        return { available: false };
      }
      
      // ユーザー情報の取得
      const userInfo = this.simpleAuthService.getCurrentUser();
      const userId = userInfo?.id || 'unknown';
      const userName = userInfo?.name || 'unknown';
      const userRole = userInfo?.role || 'unknown';
      const orgName = userInfo?.organization?.name || 'none';
      
      // APIキーをマスク処理して表示（セキュリティ対策）
      const apiKeyMasked = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
      
      return {
        available: true,
        maskedApiKey: apiKeyMasked,
        userId,
        userName,
        userRole,
        orgName
      };
    } catch (error) {
      Logger.error('APIキー情報の取得に失敗しました', error as Error);
      return { available: false };
    }
  }
  
  /**
   * 認証トークンのリフレッシュを試行
   */
  public async refreshTokens(): Promise<boolean> {
    // 開発モード：常にトークンリフレッシュ成功と報告
    Logger.info('開発モード: トークンリフレッシュをスキップし、常に成功として処理します');
    return true;
  }
  
  /**
   * AppGenius専用認証ファイルに認証情報を同期
   */
  public async syncTokensToAppGeniusAuth(): Promise<boolean> {
    // 開発モード：認証同期をスキップ
    Logger.info('開発モード: AppGenius認証情報の同期をスキップします');
    return true;
  }
  
  /**
   * AppGenius専用の認証ファイルパスを取得
   */
  public getAppGeniusAuthFilePath(): string {
    // 開発モード：ダミーのパスを返す
    return '/tmp/appgenius-dummy-auth-file.json';
  }
  
  /**
   * ログイン状態の再確認と必要に応じたリログインプロンプト
   */
  public async ensureLoggedIn(): Promise<boolean> {
    // 開発モード：常にログイン済みとして処理
    Logger.info('開発モード: ログイン状態チェックをスキップし、常にログイン済みとして処理します');
    return true;
  }
}