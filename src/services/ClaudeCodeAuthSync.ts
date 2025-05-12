import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger';
import { ClaudeCodeApiClient } from '../api/claudeCodeApiClient';
import { SimpleAuthService } from '../core/auth/SimpleAuthService';
import { SimpleAuthManager } from '../core/auth/SimpleAuthManager';

/**
 * ClaudeCodeAuthSync - VSCode拡張機能とClaudeCode CLIの認証を同期するクラス
 * 
 * VSCode拡張の認証情報をClaudeCode CLIと共有し、
 * 両環境で一貫した認証状態を維持します。
 * 
 * このクラスはリファクタリングにより、SimpleAuthServiceを使用するように更新されました。
 */
export class ClaudeCodeAuthSync {
  private static instance: ClaudeCodeAuthSync;
  private _authService: SimpleAuthService;
  private _authManager: SimpleAuthManager;
  private _apiClient: ClaudeCodeApiClient;
  private _disposables: vscode.Disposable[] = [];
  private _execPromise = promisify(exec);
  private _lastTokenRefresh: number = 0; // 最後にトークンをリフレッシュした時刻
  private _claudeCliLoginStatus: boolean = false; // Claude CLIのログイン状態
  // 削除：APIキー関連の定数は不要になりました

  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    // 新しいSimpleAuthServiceとSimpleAuthManagerを使用
    this._authService = SimpleAuthService.getInstance(context);
    this._authManager = SimpleAuthManager.getInstance(context);
    this._apiClient = ClaudeCodeApiClient.getInstance();
    
    // トークン情報をグローバル変数に保存（インスタンス間での共有）
    const accessToken = this._authService.getAccessToken();
    if (accessToken) {
      // @ts-ignore - グローバル変数への代入
      global._appgenius_auth_token = accessToken;
      Logger.info('ClaudeCodeAuthSync: アクセストークンをグローバル変数に保存しました');
    }
    
    this._initialize();
    Logger.info('ClaudeCodeAuthSync initialized with SimpleAuthService');
  }

  /**
   * ClaudeCodeAuthSyncのシングルトンインスタンスを取得
   */
  public static getInstance(context?: vscode.ExtensionContext): ClaudeCodeAuthSync {
    if (!ClaudeCodeAuthSync.instance) {
      if (!context) {
        throw new Error('ClaudeCodeAuthSyncの初期化時にはExtensionContextが必要です');
      }
      ClaudeCodeAuthSync.instance = new ClaudeCodeAuthSync(context);
    }
    return ClaudeCodeAuthSync.instance;
  }

  /**
   * 初期化
   */
  private _initialize(): void {
    try {
      // 認証状態変更のリスナー
      this._disposables.push(
        this._authService.onStateChanged(state => {
          this._handleAuthStateChange(state.isAuthenticated);
        })
      );
      
      // 認証状態が既に有効であれば、すぐに同期を試行
      if (this._authService.isAuthenticated()) {
        // 少し遅延させて認証プロセスが完全に終わった後に実行
        setTimeout(() => {
          try {
            Logger.info('ClaudeCodeAuthSync: 初期化時に既存の認証状態を検出しました。APIキー同期を試行します');
            // 非同期処理をPromiseチェーンとして実行
            this._syncTokensToClaudeCode()
              .then(() => Logger.info('ClaudeCodeAuthSync: 初期同期が完了しました'))
              .catch(syncError => {
                Logger.error('ClaudeCodeAuthSync: 初期同期中にエラーが発生しました', syncError as Error);
              });
          } catch (syncError) {
            Logger.error('ClaudeCodeAuthSync: 初期同期準備中にエラーが発生しました', syncError as Error);
          }
        }, 3000); // 3秒後に実行
      } else {
        Logger.info('ClaudeCodeAuthSync: 初期化時に認証されていません。認証イベント待機中');
      }
      
      // 定期的なトークン状態確認（10分ごと）
      // これにより、アプリが長時間開かれたままでも認証状態を維持できる
      setInterval(() => {
        this._checkAndRefreshTokenIfNeeded().catch(error => {
          Logger.error('ClaudeCodeAuthSync: 定期トークン確認中にエラーが発生しました', error as Error);
        });
      }, 10 * 60 * 1000);
      
      // 追加の安全策：起動から1分後に一度だけ同期を試行
      setTimeout(() => {
        if (this._authService.isAuthenticated()) {
          Logger.info('ClaudeCodeAuthSync: 1分後のセーフティチェックでトークン同期を試行します');
          this._syncTokensToClaudeCode().catch(error => {
            Logger.error('ClaudeCodeAuthSync: セーフティ同期中にエラーが発生しました', error as Error);
          });
        }
      }, 60000);
      
      Logger.info('ClaudeCodeAuthSync: 初期化完了');
    } catch (initError) {
      Logger.error('ClaudeCodeAuthSync: 初期化エラー', initError as Error);
    }
  }
  
  /**
   * トークン状態を確認し、必要に応じてリフレッシュする
   */
  private async _checkAndRefreshTokenIfNeeded(): Promise<void> {
    try {
      // 最後のリフレッシュから1時間以上経過していて、認証状態の場合にのみ実行
      const now = Date.now();
      const isAuthenticated = this._authService.isAuthenticated();
      
      if (isAuthenticated && (now - this._lastTokenRefresh > 60 * 60 * 1000)) {
        Logger.info('【API連携】定期的なトークン状態確認を実行します');
        const refreshSucceeded = await this._authService.verifyAuthState();
        
        if (refreshSucceeded) {
          this._lastTokenRefresh = now;
          Logger.info('【API連携】トークンが正常にリフレッシュされました');
          
          // CLIとのトークン同期
          await this._syncTokensToClaudeCode();
        } else {
          Logger.warn('【API連携】トークンリフレッシュに失敗しました');
        }
      }
    } catch (error) {
      Logger.error('トークン状態確認中にエラーが発生しました', error as Error);
    }
  }

  /**
   * 認証状態変更ハンドラー
   */
  private async _handleAuthStateChange(isAuthenticated: boolean): Promise<void> {
    if (isAuthenticated) {
      // ログイン状態になった場合、ClaudeCode CLIにトークンを同期
      await this._syncTokensToClaudeCode();
    } else {
      // ログアウトした場合、ClaudeCode CLIからトークンを削除
      await this._removeTokensFromClaudeCode();
    }
  }

  /**
   * トークンをClaudeCode CLIに同期
   * @param useIsolatedAuth 分離認証モードを使用するかどうか
   */
  private async _syncTokensToClaudeCode(useIsolatedAuth: boolean = true): Promise<void> {
    try {
      // 分離認証モードは常に有効（シンプル化のため）
      Logger.info(`認証同期モード: 分離認証モード (標準設定)`);

      // 環境変数で同期が無効化されている場合は何もしない
      if (process.env.CLAUDE_INTEGRATION_ENABLED === 'false') {
        Logger.debug('ClaudeCode CLI同期が環境変数により無効化されています');
        return;
      }

      // 認証情報取得の詳細ログ
      Logger.info('ClaudeCode CLI同期: 認証情報の取得を開始します');

      // アクセストークンの確認
      const accessToken = this._authService.getAccessToken();
      if (!accessToken) {
        Logger.warn('ClaudeCode CLI同期: アクセストークンが見つかりません。同期をスキップします');
        return;
      }

      // トークンの有効性を確認（SimpleAuthServiceを使用）
      try {
        const isValid = await this._authService.verifyAuthState();
        if (!isValid) {
          Logger.warn('現在の認証状態が有効ではありません。CLIとの同期をスキップします');
          return;
        }
      } catch (authCheckError) {
        Logger.warn('認証状態の確認中にエラーが発生しました。CLIとの同期をスキップします', authCheckError as Error);
        return;
      }

      // ユーザー情報の詳細ログ記録
      const userInfo = this._authService.getCurrentUser();
      const userId = userInfo?.id || 'unknown';
      const userName = userInfo?.name || 'unknown';
      const userRole = userInfo?.role || 'unknown';

      Logger.info(`【認証情報】詳細ユーザー情報:
      ユーザーID: ${userId}
      名前: ${userName}
      ロール: ${userRole}
      認証方法: アクセストークン認証
      `);

      // SimpleAuthServiceのデバッグ情報
      try {
        const authServiceName = this._authService.constructor.name;
        Logger.debug(`使用中の認証サービス: ${authServiceName}`);

        // 内部状態の詳細確認
        const isAuthMethod = typeof this._authService.isAuthenticated === 'function';
        Logger.debug(`isAuthenticatedメソッド存在: ${isAuthMethod}`);

        if (isAuthMethod) {
          const isAuth = this._authService.isAuthenticated();
          Logger.debug(`認証状態: ${isAuth ? '認証済み' : '未認証'}`);
        }

        // ユーザーデータがシリアライズ可能か確認
        let userDataJson = '不明';
        try {
          userDataJson = JSON.stringify(userInfo);
        } catch (e) {
          userDataJson = '取得失敗 - シリアライズエラー';
        }
        Logger.debug(`ユーザーデータ: ${userDataJson}`);
      } catch (debugError) {
        Logger.warn('認証情報分析中にエラーが発生しました', debugError as Error);
      }
      
      // 認証情報ディレクトリとファイルパスを決定
      // AppGenius専用の認証情報ディレクトリを使用
      const authDir = this._getAppGeniusAuthDir();
      const authFileName = 'auth.json';
      Logger.info(`分離認証モードを使用: AppGenius専用の認証情報を保存します (ディレクトリ: ${authDir})`);

      // ディレクトリが存在するか確認し、存在しなければ作成
      try {
        // fs-extraのensureDirを使用してディレクトリを確実に作成
        await fs.ensureDir(authDir, { mode: 0o700 }); // 所有者のみ読み書き実行可能

        // Unix系OSの場合は、パーミッションを明示的に設定
        if (process.platform !== 'win32') {
          await fs.chmod(authDir, 0o700);
          Logger.debug(`ディレクトリのパーミッションを設定しました (700): ${authDir}`);
        }

        Logger.info(`認証情報ディレクトリを確認/作成しました: ${authDir}`);

        // ホームディレクトリの.appgeniusフォルダも確保（標準的な場所）
        const dotAppGeniusDir = path.join(os.homedir(), '.appgenius');
        if (!fs.existsSync(dotAppGeniusDir)) {
          await fs.ensureDir(dotAppGeniusDir, { mode: 0o700 });
          Logger.info(`標準の.appgeniusディレクトリを作成しました: ${dotAppGeniusDir}`);

          if (process.platform !== 'win32') {
            await fs.chmod(dotAppGeniusDir, 0o700);
          }
        }

        // OSごとの標準的な設定ディレクトリも確保
        let osSpecificDir: string;
        if (process.platform === 'darwin') {
          osSpecificDir = path.join(os.homedir(), 'Library', 'Application Support', 'appgenius');
        } else if (process.platform === 'win32') {
          osSpecificDir = path.join(os.homedir(), 'AppData', 'Roaming', 'appgenius');
        } else {
          osSpecificDir = path.join(os.homedir(), '.config', 'appgenius');
        }

        if (!fs.existsSync(osSpecificDir)) {
          await fs.ensureDir(osSpecificDir, { mode: 0o700 });
          Logger.info(`OS固有の設定ディレクトリを作成しました: ${osSpecificDir}`);

          if (process.platform !== 'win32') {
            await fs.chmod(osSpecificDir, 0o700);
          }
        }
      } catch (dirError) {
        Logger.error(`認証情報ディレクトリの作成に失敗しました: ${authDir}`, dirError as Error);

        // エラー発生時の代替ディレクトリを試みる（フォールバックメカニズム）
        Logger.info('分離認証モードで代替ディレクトリを試みます');

        // 代替ディレクトリのリスト（優先順）
        const altDirs = [
          // 1. ホームの.appgenius（標準）
          path.join(os.homedir(), '.appgenius'),
          // 2. OS固有の標準的な設定ディレクトリ
          path.join(
            os.homedir(),
            process.platform === 'darwin' ? 'Library/Application Support/appgenius' :
            process.platform === 'win32' ? 'AppData/Roaming/appgenius' :
            '.config/appgenius'
          ),
          // 3. 最終手段として一時ディレクトリ
          path.join(os.tmpdir(), 'appgenius-auth')
        ];

        // 代替ディレクトリを順番に試す
        let success = false;
        for (const dir of altDirs) {
          try {
            await fs.ensureDir(dir, { mode: 0o700 });
            if (process.platform !== 'win32') {
              await fs.chmod(dir, 0o700);
            }
            // 変数に代入ではなく、現在のディレクトリを使用するよう修正
            Logger.info(`代替認証ディレクトリの作成に成功しました: ${dir}`);
            success = true;
            break;
          } catch (altError) {
            Logger.warn(`代替ディレクトリの作成に失敗しました: ${dir} - ${(altError as Error).message}`);
          }
        }

        // すべての代替ディレクトリが失敗した場合
        if (!success) {
          throw new Error(`すべての認証ディレクトリの作成に失敗しました: ${(dirError as Error).message}`);
        }
      }

      // 認証状態から有効期限を取得
      const state = this._authService.getCurrentState();
      const expiresAt = state.expiresAt || (Date.now() + 3600000); // デフォルトは1時間後

      // トークン情報をJSONに変換（必ず文字列として保存）
      const authInfo = {
        accessToken: accessToken, // アクセストークンを使用
        refreshToken: 'appgenius-refresh-token', // ダミーリフレッシュトークン
        expiresAt: expiresAt,
        source: 'appgenius-extension',
        syncedAt: Date.now(),
        updatedAt: Date.now(),
        isolatedAuth: true,
        isApiKey: false // APIキーを使用していない
      };
      
      // デバッグ用に変換後の型を確認
      Logger.debug(`【認証情報】JSON変換後の認証トークン型: ${typeof authInfo.accessToken}`);
      if (authInfo.accessToken && authInfo.accessToken.length > 0) {
        Logger.debug(`【認証情報】認証トークンのプレビュー: ${authInfo.accessToken.substring(0, 8)}...`);
      } else {
        Logger.warn('【認証情報】警告: 保存されるaccessTokenが空または無効です');
      }
      
      // 認証情報をファイルに保存
      const authFilePath = path.join(authDir, authFileName);
      
      try {
        // fs-extraのwriteJsonを使用して認証情報を保存
        await fs.writeJson(authFilePath, authInfo, {
          spaces: 2,
          mode: 0o600 // 所有者のみ読み書き可能
        });
        Logger.info(`認証情報ファイルを保存しました: ${authFilePath}`);
        
        // Unix系OSの場合は、パーミッションを明示的に設定
        if (process.platform !== 'win32') {
          await fs.chmod(authFilePath, 0o600);
          Logger.debug(`ファイルのパーミッションを設定しました (600): ${authFilePath}`);
        }
        
        // 分離認証モードでは代替ファイルも作成（他の場所にも保存）
        try {
          const altAuthPaths = [];
          // ホームディレクトリの標準的な場所
          if (authDir !== path.join(os.homedir(), '.appgenius')) {
            altAuthPaths.push(path.join(os.homedir(), '.appgenius', 'auth.json'));
          }
          
          // OS固有のアプリケーションサポートディレクトリ
          let osSpecificAuthPath: string;
          if (process.platform === 'darwin') {
            osSpecificAuthPath = path.join(os.homedir(), 'Library', 'Application Support', 'appgenius', 'claude-auth.json');
          } else if (process.platform === 'win32') {
            osSpecificAuthPath = path.join(os.homedir(), 'AppData', 'Roaming', 'appgenius', 'claude-auth.json');
          } else {
            osSpecificAuthPath = path.join(os.homedir(), '.config', 'appgenius', 'claude-auth.json');
          }
          
          if (path.join(authDir, authFileName) !== osSpecificAuthPath) {
            altAuthPaths.push(osSpecificAuthPath);
          }
          
          // 代替パスにも書き込み
          for (const altPath of altAuthPaths) {
            try {
              // 親ディレクトリの存在確認
              const altDir = path.dirname(altPath);
              await fs.ensureDir(altDir, { mode: 0o700 });
              
              await fs.writeJson(altPath, authInfo, {
                spaces: 2,
                mode: 0o600
              });
              
              if (process.platform !== 'win32') {
                await fs.chmod(altPath, 0o600);
              }
              
              Logger.info(`代替認証ファイルを作成しました: ${altPath}`);
            } catch (altError) {
              // 代替ファイルの書き込みエラーはログに記録するだけで続行
              Logger.warn(`代替認証ファイルの保存に失敗しました: ${altPath} - ${(altError as Error).message}`);
            }
          }
        } catch (replicaError) {
          // 代替ファイル作成エラーはログに記録するだけで続行
          Logger.warn(`代替認証ファイルの準備中にエラーが発生しました: ${(replicaError as Error).message}`);
        }
      } catch (fileError) {
        Logger.error(`認証情報ファイルの保存に失敗しました: ${authFilePath}`, fileError as Error);
        
        // 代替ファイルパスへの保存を試みる
        try {
          // エラー発生時のフォールバックとして一時ディレクトリを使用
          const tempDir = path.join(os.tmpdir(), 'appgenius-auth');
          await fs.ensureDir(tempDir, { mode: 0o700 });
          
          const tempAuthFile = path.join(tempDir, 'auth.json');
          await fs.writeJson(tempAuthFile, authInfo, {
            spaces: 2,
            mode: 0o600
          });
          
          if (process.platform !== 'win32') {
            await fs.chmod(tempAuthFile, 0o600);
          }
          
          Logger.warn(`一時認証ファイルに保存しました: ${tempAuthFile}`);
          // 定数への代入ではなく、新しいパスを使用
          Logger.info(`認証ファイルパスを一時ファイルに更新します: ${tempAuthFile} → ${authFilePath}`);
        } catch (tempFileError) {
          // すべてのフォールバックが失敗した場合のみエラーをスロー
          throw new Error(`認証情報ファイルの保存に失敗しました: ${(fileError as Error).message}`);
        }
      }
      
      // 分離認証モードの場合は、.claudeディレクトリも確保
      if (process.platform === 'darwin') {
        try {
          const dotClaudeDir = path.join(os.homedir(), '.claude');
          if (!fs.existsSync(dotClaudeDir)) {
            await fs.ensureDir(dotClaudeDir, { mode: 0o700 });
            Logger.info(`代替の.claudeディレクトリを作成しました: ${dotClaudeDir}`);
          }
        } catch (dotClaudeError) {
          // エラーはログに記録するだけで続行
          Logger.warn(`代替の.claudeディレクトリの作成に失敗しました: ${(dotClaudeError as Error).message}`);
        }
      }
      
      // 同期日時を記録
      this._lastTokenRefresh = Date.now();
      
      Logger.info(`【API連携】AppGenius専用認証情報を同期しました: ${authFilePath}`);
      
      // 認証同期成功のログ記録（使用量記録機能は削除済み）
      Logger.info('認証同期が完了しました - 認証情報ファイル: ' + authFilePath);
    } catch (error) {
      Logger.error('認証情報の同期中にエラーが発生しました', error as Error);
      throw error; // エラーを上位に伝播させる
    }
  }

  /**
   * AppGenius専用モードで認証情報を同期
   * 分離認証モードで認証情報を保存します
   */
  public async syncTokensToAppGeniusAuth(): Promise<void> {
    Logger.info('分離認証モードで認証情報を同期します');
    try {
      // 認証状態がアクティブか確認
      if (!this._authService.isAuthenticated()) {
        Logger.warn('認証されていないため、認証情報の同期をスキップします');
        return;
      }
      
      // 分離認証モードで同期
      await this._syncTokensToClaudeCode();
      
      // Claude CLI認証ファイルの存在確認
      await this._checkAndCopyClaudeCliAuth();
      
      return;
    } catch (error) {
      Logger.error('分離認証モードでの同期に失敗しました', error as Error);
      throw error;
    }
  }
  
  /**
   * Claude CLI認証ファイルの存在を確認し、必要に応じてコピー
   */
  private async _checkAndCopyClaudeCliAuth(): Promise<void> {
    try {
      const homeDir = os.homedir();
      const appGeniusAuthPath = this.getAppGeniusAuthFilePath();
      
      // AppGenius認証ディレクトリを確実に作成
      const appGeniusAuthDir = path.dirname(appGeniusAuthPath);
      try {
        await fs.ensureDir(appGeniusAuthDir, { mode: 0o700 });
        if (process.platform !== 'win32') {
          await fs.chmod(appGeniusAuthDir, 0o700);
        }
        Logger.debug(`AppGenius認証ディレクトリを確保しました: ${appGeniusAuthDir}`);
      } catch (dirError) {
        Logger.warn(`AppGenius認証ディレクトリの作成に失敗しました: ${appGeniusAuthDir}`, dirError as Error);
      }
      
      // AppGenius認証ファイルが存在するか確認
      const appGeniusAuthExists = await fs.pathExists(appGeniusAuthPath);
      if (!appGeniusAuthExists) {
        Logger.info('AppGenius専用認証ファイルが見つかりません。認証情報を作成します。');
        
        try {
          // 現在の認証状態から新しい認証ファイルを作成
          const accessToken = this._authService.getAccessToken();
          const state = this._authService.getCurrentState();
          const expiresAt = state.expiresAt || (Date.now() + 3600000);
          
          if (!accessToken) {
            Logger.warn('アクセストークンが取得できないため、認証ファイルの作成をスキップします');
            return;
          }
          
          // 認証データの作成
          const authData = {
            accessToken,
            refreshToken: 'appgenius-refresh-token', // ダミー
            expiresAt,
            source: 'appgenius-extension',
            syncedAt: Date.now(),
            updatedAt: Date.now(),
            isolatedAuth: true
          };
          
          // 認証ファイルの親ディレクトリを再確認
          await fs.ensureDir(path.dirname(appGeniusAuthPath), { mode: 0o700 });
          
          // 認証ファイルを書き込み
          await fs.writeJson(appGeniusAuthPath, authData, {
            spaces: 2,
            mode: 0o600 // 所有者のみ読み書き可能
          });
          
          // Unix系OSでは明示的にパーミッションを設定
          if (process.platform !== 'win32') {
            await fs.chmod(appGeniusAuthPath, 0o600);
          }
          
          Logger.info(`AppGenius専用認証ファイルを作成しました: ${appGeniusAuthPath}`);
        } catch (createError) {
          Logger.error(`新しい認証ファイルの作成に失敗しました: ${appGeniusAuthPath}`, createError as Error);
          // エラーがあっても続行
        }
      } else {
        // 既存ファイルの有効性チェック
        try {
          const existingAuthData = await fs.readJson(appGeniusAuthPath);
          const hasValidTokens = existingAuthData.accessToken;
          
          if (hasValidTokens) {
            Logger.info(`AppGenius専用認証ファイルが既に存在し、有効なトークンを含んでいます: ${appGeniusAuthPath}`);
          } else {
            Logger.warn(`AppGenius専用認証ファイルは存在しますが、有効なトークンがありません: ${appGeniusAuthPath}`);
            
            // トークンを更新
            const accessToken = this._authService.getAccessToken();
            const state = this._authService.getCurrentState();
            const expiresAt = state.expiresAt || (Date.now() + 3600000);
            
            if (accessToken) {
              // 既存のデータを更新
              existingAuthData.accessToken = accessToken;
              existingAuthData.expiresAt = expiresAt;
              existingAuthData.updatedAt = Date.now();
              
              // 更新したデータを保存
              await fs.writeJson(appGeniusAuthPath, existingAuthData, {
                spaces: 2,
                mode: 0o600
              });
              
              Logger.info(`AppGenius専用認証ファイルを更新しました: ${appGeniusAuthPath}`);
            }
          }
          
          // Unix系OSでは、権限の確認と修正
          if (process.platform !== 'win32') {
            try {
              const stats = await fs.stat(appGeniusAuthPath);
              const currentPerms = stats.mode & 0o777; // 権限部分のみ取得
              
              if (currentPerms !== 0o600) {
                Logger.warn(`認証ファイルの権限が不適切です (${currentPerms.toString(8)}), 600に修正します`);
                await fs.chmod(appGeniusAuthPath, 0o600);
              }
            } catch (statError) {
              Logger.warn(`権限の確認に失敗しました: ${statError.message}`);
            }
          }
        } catch (readError) {
          Logger.error(`既存の認証ファイルの読み込みに失敗しました: ${readError.message}`);
        }
      }
    } catch (error) {
      Logger.error('認証ファイルの確認中にエラーが発生しました', error as Error);
    }
  }

  /**
   * ClaudeCode CLIからトークンを削除
   * @param removeIsolatedAuth AppGenius専用の認証情報も削除するかどうか
   */
  private async _removeTokensFromClaudeCode(removeIsolatedAuth: boolean = true): Promise<void> {
    try {
      // AppGenius専用の認証情報も削除する
      if (removeIsolatedAuth) {
        const appGeniusAuthFilePath = this.getAppGeniusAuthFilePath();
        
        if (fs.existsSync(appGeniusAuthFilePath)) {
          fs.unlinkSync(appGeniusAuthFilePath);
          Logger.info('【API連携】AppGenius専用の認証情報を削除しました');
        } else {
          Logger.debug('AppGenius専用認証ファイルが存在しないため、削除操作はスキップします');
        }
      }
      
      // 認証削除完了のログ記録（使用量記録機能は削除済み）
      Logger.debug('認証ファイル削除完了');
    } catch (error) {
      Logger.error('認証情報の削除中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * AppGenius専用の認証情報のみを削除
   */
  public async removeAppGeniusAuthOnly(): Promise<void> {
    try {
      const appGeniusAuthFilePath = this.getAppGeniusAuthFilePath();
      
      if (fs.existsSync(appGeniusAuthFilePath)) {
        fs.unlinkSync(appGeniusAuthFilePath);
        Logger.info('【API連携】AppGenius専用の認証情報のみを削除しました');
      } else {
        Logger.debug('AppGenius専用認証ファイルが存在しないため、削除操作はスキップします');
      }
    } catch (error) {
      Logger.error('AppGenius専用認証情報の削除中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * 現在の認証状態を確認し、必要に応じてトークンをリフレッシュする
   * @returns リフレッシュが成功したかどうか
   */
  public async ensureValidAuth(): Promise<boolean> {
    try {
      const isAuthenticated = this._authService.isAuthenticated();
      
      if (!isAuthenticated) {
        Logger.warn('【API連携】認証されていません。リフレッシュを試みます');
        return await this._authService.verifyAuthState();
      }
      
      // 最後のリフレッシュから30分以上経過している場合、トークンをリフレッシュ
      const now = Date.now();
      if (now - this._lastTokenRefresh > 30 * 60 * 1000) {
        Logger.info('【API連携】前回のリフレッシュから30分以上経過しているため、トークンをリフレッシュします');
        const refreshSucceeded = await this._authService.verifyAuthState();
        
        if (refreshSucceeded) {
          this._lastTokenRefresh = now;
          Logger.info('【API連携】トークンが正常にリフレッシュされました');
          
          // CLIとのトークン同期
          await this._syncTokensToClaudeCode();
        } else {
          Logger.warn('【API連携】トークンリフレッシュに失敗しました');
        }
        
        return refreshSucceeded;
      }
      
      Logger.debug('【API連携】認証は有効です');
      return true;
    } catch (error) {
      Logger.error('認証状態の確認中にエラーが発生しました', error as Error);
      return false;
    }
  }

  /**
   * AppGenius専用の認証情報ディレクトリを取得
   * @returns AppGenius専用の認証情報ディレクトリパス
   */
  private _getAppGeniusAuthDir(): string {
    const homeDir = os.homedir();
    
    // 環境変数が設定されている場合は、それを優先
    if (process.env.APPGENIUS_AUTH_DIR) {
      return process.env.APPGENIUS_AUTH_DIR;
    }
    
    // まず、標準的な場所（.appgenius）を確認
    const dotAppGeniusDir = path.join(homeDir, '.appgenius');
    
    // ディレクトリが存在するか、作成可能な場合は.appgeniusを使用
    try {
      if (fs.existsSync(dotAppGeniusDir)) {
        return dotAppGeniusDir;
      }
      
      // 試験的に作成を試みる（権限がない場合は例外が発生）
      // 実際の作成は呼び出し側で行う
      const testDir = `${dotAppGeniusDir}_test`;
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true, mode: 0o700 });
        fs.rmdirSync(testDir);
      }
      
      // 作成可能であれば、標準の場所を返す
      return dotAppGeniusDir;
    } catch (error) {
      Logger.debug(`標準認証ディレクトリに問題があります: ${(error as Error).message}`);
      // 作成できない場合は、OSごとの代替ディレクトリを使用
    }
    
    // OSによって設定ディレクトリの場所が異なる
    if (process.platform === 'win32') {
      // Windowsでの代替設定ディレクトリ
      const appDataDir = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appDataDir, 'appgenius');
    } else if (process.platform === 'darwin') {
      // macOSでの代替設定ディレクトリ
      return path.join(homeDir, 'Library', 'Application Support', 'appgenius');
    } else {
      // Linux/Unixでの代替設定ディレクトリ
      const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
      return path.join(xdgConfigHome, 'appgenius');
    }
  }
  
  /**
   * AppGenius専用の認証情報ファイルパスを取得
   * @returns AppGenius専用の認証情報ファイルパス
   */
  public getAppGeniusAuthFilePath(): string {
    // 環境変数で明示的に指定されている場合はそれを使用
    if (process.env.CLAUDE_AUTH_FILE) {
      return process.env.CLAUDE_AUTH_FILE;
    }
    
    // 標準のファイル名を使用
    return path.join(this._getAppGeniusAuthDir(), 'auth.json');
  }

  /**
   * ClaudeCode CLIが利用可能かチェック
   */
  public async isClaudeCodeAvailable(): Promise<boolean> {
    try {
      // ClaudeCode CLIパスを環境変数から取得、またはNVMパスを含めて検索
      const claudeCodePaths = [
        process.env.CLAUDE_CODE_PATH,
        'claude',
        `/Users/${os.userInfo().username}/.nvm/versions/node/v18.20.6/bin/claude`,
        '/usr/local/bin/claude'  // グローバルインストール一般的な場所
      ].filter(Boolean); // undefined/nullを除去
      
      // 複数のパスで順番に試行
      let foundPath = null;
      for (const path of claudeCodePaths) {
        try {
          if (!path) continue;
          Logger.debug(`ClaudeCode CLIパスを試行中: ${path}`);
          await this._execPromise(`${path} --version`);
          foundPath = path;
          Logger.info(`ClaudeCode CLIが見つかりました: ${path}`);
          break;
        } catch (pathError) {
          Logger.debug(`パス ${path} でのCLI検出に失敗: ${pathError.message}`);
          // 続行して次のパスを試す
        }
      }
      
      if (!foundPath) {
        // すべてのパスが失敗した場合
        Logger.warn('すべてのパスでClaudeCode CLIの検出に失敗しました');
        this._claudeCliLoginStatus = false;
        return false;
      }
      
      // 見つかったパスを環境変数に設定（メモリ内のみ）
      process.env.CLAUDE_CODE_PATH = foundPath;
      
      // 利用可能な場合、ログイン状態も確認する
      await this.checkClaudeCliLoginStatus();
      
      return true;
    } catch (error) {
      Logger.error('ClaudeCode CLIの検出処理中にエラーが発生しました:', error as Error);
      this._claudeCliLoginStatus = false;
      return false;
    }
  }
  
  /**
   * Claude CLIのログイン状態を確認
   * @returns ログインしているかどうか
   */
  public async checkClaudeCliLoginStatus(): Promise<boolean> {
    try {
      const appGeniusAuthPath = this.getAppGeniusAuthFilePath();
      
      // auth.jsonファイルが存在し、有効なトークンが含まれているか確認
      if (fs.existsSync(appGeniusAuthPath)) {
        try {
          const authData = JSON.parse(fs.readFileSync(appGeniusAuthPath, 'utf8'));
          
          // 必要なトークンが含まれていて、有効期限が切れていないかを確認
          const isValid = authData.accessToken && 
                         authData.expiresAt && 
                         authData.expiresAt > Date.now();
          
          this._claudeCliLoginStatus = isValid;
          Logger.debug(`Claude CLI ログイン状態確認: ${isValid ? 'ログイン済み' : '未ログインまたは期限切れ'}`);
          return isValid;
        } catch (error) {
          Logger.warn('Claude CLI認証ファイルの解析に失敗しました:', error);
          this._claudeCliLoginStatus = false;
          return false;
        }
      } else {
        Logger.debug('Claude CLI認証ファイルが見つかりません。未ログイン状態と判断します。');
        this._claudeCliLoginStatus = false;
        return false;
      }
    } catch (error) {
      Logger.error('Claude CLIログイン状態の確認に失敗しました:', error);
      this._claudeCliLoginStatus = false;
      return false;
    }
  }
  
  /**
   * Claude CLIのログイン状態を取得
   * @returns 現在のログイン状態
   */
  public isClaudeCliLoggedIn(): boolean {
    return this._claudeCliLoginStatus;
  }

  /**
   * VSCodeからClaudeCode CLIを実行
   */
  public async executeClaudeCode(command: string): Promise<string> {
    try {
      // ClaudeCode CLIが使用可能かチェック
      const isAvailable = await this.isClaudeCodeAvailable();
      if (!isAvailable) {
        throw new Error('ClaudeCode CLIが見つかりません。インストールされていることを確認してください。');
      }
      
      // ClaudeCode CLIパスを環境変数から取得、またはデフォルトを使用
      const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
      
      // コマンド実行
      const { stdout, stderr } = await this._execPromise(`${claudeCodePath} ${command}`);
      
      if (stderr) {
        console.warn('ClaudeCode CLIからの警告:', stderr);
      }
      
      return stdout;
    } catch (error) {
      console.error('ClaudeCode CLI実行中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}