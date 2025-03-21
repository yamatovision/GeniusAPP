import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { AuthenticationService } from '../core/auth/AuthenticationService';
import { TokenManager } from '../core/auth/TokenManager';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger';
import { ClaudeCodeApiClient } from '../api/claudeCodeApiClient';

/**
 * ClaudeCodeAuthSync - VSCode拡張機能とClaudeCode CLIの認証を同期するクラス
 * 
 * VSCode拡張の認証情報をClaudeCode CLIと共有し、
 * 両環境で一貫した認証状態を維持します。
 */
export class ClaudeCodeAuthSync {
  private static instance: ClaudeCodeAuthSync;
  private _authService: AuthenticationService;
  private _tokenManager: TokenManager;
  private _apiClient: ClaudeCodeApiClient;
  private _disposables: vscode.Disposable[] = [];
  private _execPromise = promisify(exec);
  private _lastTokenRefresh: number = 0; // 最後にトークンをリフレッシュした時刻
  private _claudeCliLoginStatus: boolean = false; // Claude CLIのログイン状態

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    this._tokenManager = TokenManager.getInstance();
    this._apiClient = ClaudeCodeApiClient.getInstance();
    this._initialize();
    Logger.info('ClaudeCodeAuthSync initialized');
  }

  /**
   * ClaudeCodeAuthSyncのシングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeCodeAuthSync {
    if (!ClaudeCodeAuthSync.instance) {
      ClaudeCodeAuthSync.instance = new ClaudeCodeAuthSync();
    }
    return ClaudeCodeAuthSync.instance;
  }

  /**
   * 初期化
   */
  private _initialize(): void {
    // 認証状態変更のリスナー
    this._disposables.push(
      this._authService.onStateChanged(state => {
        this._handleAuthStateChange(state.isAuthenticated);
      })
    );
    
    // 定期的なトークン状態確認（10分ごと）
    // これにより、アプリが長時間開かれたままでも認証状態を維持できる
    setInterval(() => this._checkAndRefreshTokenIfNeeded(), 10 * 60 * 1000);
  }
  
  /**
   * トークン状態を確認し、必要に応じてリフレッシュする
   */
  private async _checkAndRefreshTokenIfNeeded(): Promise<void> {
    try {
      // 最後のリフレッシュから1時間以上経過していて、認証状態の場合にのみ実行
      const now = Date.now();
      const isAuthenticated = await this._authService.isAuthenticated();
      
      if (isAuthenticated && (now - this._lastTokenRefresh > 60 * 60 * 1000)) {
        Logger.info('【API連携】定期的なトークン状態確認を実行します');
        const refreshSucceeded = await this._authService.refreshToken();
        
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
  private async _syncTokensToClaudeCode(useIsolatedAuth: boolean = false): Promise<void> {
    try {
      // 環境変数の検出
      const isIsolatedModeEnabled = this._isIsolatedAuthEnabled();
      
      // 明示的にパラメータで指定された場合はその値を優先
      // 指定がない場合は環境変数の設定を使用
      const useIsolatedMode = useIsolatedAuth !== undefined ? useIsolatedAuth : isIsolatedModeEnabled;
      
      // 実際に使用するモードをログに記録
      Logger.info(`認証同期モード: ${useIsolatedMode ? '分離認証モード' : '標準モード'} (環境変数設定: ${isIsolatedModeEnabled ? '有効' : '無効'})`);
      
      // 環境変数で同期が無効化されている場合は何もしない
      if (process.env.CLAUDE_INTEGRATION_ENABLED === 'false') {
        Logger.debug('ClaudeCode CLI同期が環境変数により無効化されています');
        return;
      }
      
      // トークンを取得
      const accessToken = await this._tokenManager.getAccessToken();
      const refreshToken = await this._tokenManager.getRefreshToken();
      
      if (!accessToken || !refreshToken) {
        Logger.warn('トークンが取得できないため、ClaudeCode CLIとの同期をスキップします');
        return;
      }
      
      // アクセストークンの初期部分と末尾部分をログに記録（セキュリティを考慮）
      const maskedAccessToken = accessToken.length > 15 ? 
        `${accessToken.substring(0, 5)}...${accessToken.substring(accessToken.length - 5)}` : 
        '[マスク済み]';
      Logger.debug(`トークン取得確認: ${maskedAccessToken} (${accessToken.length}文字)`);
      
      // トークンの有効性を確認する追加チェック
      try {
        const isValid = await this._authService.isAuthenticated();
        if (!isValid) {
          Logger.info('現在のトークンが有効でないため、リフレッシュを試みます');
          const refreshed = await this._authService.refreshToken();
          if (refreshed) {
            Logger.info('トークンのリフレッシュに成功しました。新しいトークンを取得します');
            // 新しいトークンで再取得
            const newAccessToken = await this._tokenManager.getAccessToken();
            const newRefreshToken = await this._tokenManager.getRefreshToken();
            
            if (newAccessToken && newRefreshToken) {
              Logger.info('リフレッシュされたトークンの取得に成功しました');
            } else {
              Logger.warn('リフレッシュ後のトークン取得に失敗しました。利用可能なトークンを使用します');
            }
          } else {
            Logger.warn('トークンのリフレッシュに失敗しました。利用可能なトークンを使用します');
          }
        }
      } catch (authCheckError) {
        Logger.warn('認証状態の確認中にエラーが発生しました。利用可能なトークンを使用します', authCheckError as Error);
      }
      
      // トークンの有効期限を計算
      let expiresAt = Date.now() + 3600000; // デフォルトは1時間後
      
      try {
        // TokenManagerから有効期限を取得
        const expiryTimestamp = await this._tokenManager.getTokenExpiryTime();
        if (expiryTimestamp && expiryTimestamp > 0) {
          expiresAt = expiryTimestamp * 1000; // TokenManagerは秒単位で保存
          Logger.info(`トークン有効期限情報を取得しました: ${new Date(expiresAt).toLocaleString()}`);
        } else {
          Logger.info(`トークン有効期限情報が見つからないため、デフォルト値を使用します: ${new Date(expiresAt).toLocaleString()}`);
        }
      } catch (expiryError) {
        Logger.warn(`トークン有効期限の取得に失敗しました: ${(expiryError as Error).message}`);
      }
      
      // 認証情報ディレクトリとファイルパスを決定
      let authDir: string;
      let authFileName: string;
      
      if (useIsolatedMode) {
        // AppGenius専用の認証情報ディレクトリを使用
        authDir = this._getAppGeniusAuthDir();
        authFileName = 'auth.json';
        Logger.info(`分離認証モードを使用: AppGenius専用の認証情報を保存します (ディレクトリ: ${authDir})`);
      } else {
        // 標準のClaudeCode CLI設定ディレクトリを使用
        authDir = this._getClaudeConfigDir();
        authFileName = 'auth.json';
        Logger.info(`標準認証モードを使用: ClaudeCode CLI標準の認証情報を更新します (ディレクトリ: ${authDir})`);
      }
      
      // ディレクトリが存在するか確認し、存在しなければ作成
      try {
        // fs-extraのensureDirを使用してディレクトリを確実に作成
        await fs.ensureDir(authDir, { mode: 0o700 }); // 所有者のみ読み書き実行可能
        
        // Unix系OSの場合は、パーミッションを明示的に設定（再保証）
        if (process.platform !== 'win32') {
          await fs.chmod(authDir, 0o700);
          Logger.debug(`ディレクトリのパーミッションを設定しました (700): ${authDir}`);
        }
        
        Logger.info(`認証情報ディレクトリを確認/作成しました: ${authDir}`);
        
        // 分離認証モードでは、代替ディレクトリも確保（互換性のため）
        if (useIsolatedMode) {
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
        }
      } catch (dirError) {
        Logger.error(`認証情報ディレクトリの作成に失敗しました: ${authDir}`, dirError as Error);
        
        // エラー発生時の代替ディレクトリを試みる（フォールバックメカニズム）
        if (useIsolatedMode) {
          // 分離認証モードで失敗した場合は、順番に代替ディレクトリを試す
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
              authDir = dir;
              Logger.info(`代替認証ディレクトリの作成に成功しました: ${authDir}`);
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
        } else {
          // 標準モードのフォールバック
          try {
            const altDir = path.join(os.homedir(), '.claude');
            await fs.ensureDir(altDir, { mode: 0o700 });
            if (process.platform !== 'win32') {
              await fs.chmod(altDir, 0o700);
            }
            authDir = altDir;
            Logger.info(`標準モードの代替ディレクトリを使用します: ${authDir}`);
          } catch (altDirError) {
            throw new Error(`認証情報ディレクトリの作成に失敗しました: ${(dirError as Error).message}`);
          }
        }
      }
      
      // トークン情報をJSONに変換
      const authInfo = {
        accessToken,
        refreshToken,
        expiresAt: expiresAt,
        source: useIsolatedMode ? 'appgenius-extension' : 'vscode-extension',
        syncedAt: Date.now(),
        updatedAt: Date.now(),
        isolatedAuth: useIsolatedMode
      };
      
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
        if (useIsolatedMode) {
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
          authFilePath = tempAuthFile; // 認証ファイルパスを一時ファイルに更新
        } catch (tempFileError) {
          // すべてのフォールバックが失敗した場合のみエラーをスロー
          throw new Error(`認証情報ファイルの保存に失敗しました: ${(fileError as Error).message}`);
        }
      }
      
      // 分離認証モードの場合は、.claudeディレクトリも確保
      if (useIsolatedMode && process.platform === 'darwin') {
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
      
      const modeText = useIsolatedMode ? 'AppGenius専用認証情報' : 'ClaudeCode CLI標準認証情報';
      Logger.info(`【API連携】${modeText}を同期しました: ${authFilePath}`);
      
      // 認証同期成功をトークン使用量としても記録
      try {
        // ログメッセージ追加
        Logger.info('認証同期情報をトークン使用履歴に記録します...');
        
        // エラー発生時も詳細にログを記録できるように改善
        try {
          const result = await this._apiClient.recordTokenUsage(0, 'auth-sync', useIsolatedMode ? 'isolated-auth' : 'standard-auth');
          if (result) {
            Logger.info('認証同期情報をトークン使用履歴に記録しました (成功)');
          } else {
            Logger.warn('認証同期情報をトークン使用履歴の記録に失敗しました (falseが返されました)');
          }
        } catch (recordError) {
          Logger.error('認証同期情報をトークン使用履歴に記録できませんでした:', recordError as Error);
        }
      } catch (tokenRecordError) {
        // トークン使用記録の失敗は致命的ではないのでログのみ
        Logger.warn('認証同期情報をトークン使用履歴に記録できませんでした:', tokenRecordError as Error);
      }
    } catch (error) {
      Logger.error('認証情報の同期中にエラーが発生しました', error as Error);
      throw error; // エラーを上位に伝播させる
    }
  }
  
  /**
   * 分離認証モードが有効かどうかを検出
   * 単一認証モデルへの移行により、常にtrueを返す
   * 
   * @deprecated 単一認証モデルに移行中のため非推奨
   * @returns 常にtrueを返します
   */
  private _isIsolatedAuthEnabled(): boolean {
    // 単一認証モデルへの移行により、常にtrueを返す
    Logger.info('単一認証モデルに移行中のため、分離認証モードは常に有効です');
    return true;
  }
  
  /**
   * AppGenius専用モードで認証情報を同期
   * 分離認証モードで認証情報を保存します
   */
  public async syncTokensToAppGeniusAuth(): Promise<void> {
    Logger.info('分離認証モードで認証情報を同期します');
    try {
      // AppGeniusの認証ディレクトリを確保
      const authDir = this._getAppGeniusAuthDir();
      await fs.ensureDir(authDir, { mode: 0o700 }); // 所有者のみ読み書き実行可能
      
      if (process.platform !== 'win32') {
        // Unix系OSでは明示的にパーミッションを設定
        await fs.chmod(authDir, 0o700);
        Logger.debug(`ディレクトリのパーミッションを設定しました (700): ${authDir}`);
      }
      
      // 代替ディレクトリも確保（macOS特有）
      if (process.platform === 'darwin') {
        const altAuthDir = path.join(os.homedir(), '.claude');
        if (!fs.existsSync(altAuthDir)) {
          await fs.ensureDir(altAuthDir, { mode: 0o700 });
          Logger.debug(`代替認証ディレクトリを作成しました: ${altAuthDir}`);
        }
      }
      
      // 分離認証モードを有効にして同期
      await this._syncTokensToClaudeCode(true);
      
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
      
      // 主要な認証ファイルの場所を確認
      const possibleAuthPaths = [
        path.join(homeDir, '.claude', 'auth.json'), // 標準の場所
        path.join(homeDir, 'Library', 'Application Support', 'claude-cli', 'auth.json'), // macOS
        path.join(homeDir, 'AppData', 'Roaming', 'claude-cli', 'auth.json'), // Windows
        path.join(homeDir, '.config', 'claude-cli', 'auth.json') // Linux
      ];
      
      // AppGenius認証ファイルが存在しない場合にコピー
      const appGeniusAuthExists = await fs.pathExists(appGeniusAuthPath);
      if (!appGeniusAuthExists) {
        Logger.info('AppGenius専用認証ファイルが見つかりません。他の認証ファイルをコピーします。');
        
        // 既存の認証ファイルを探索
        let foundValidAuth = false;
        
        for (const authPath of possibleAuthPaths) {
          const authPathExists = await fs.pathExists(authPath);
          if (authPathExists) {
            Logger.info(`既存の認証ファイルが見つかりました: ${authPath}`);
            
            try {
              // 認証データを読み込み
              const authData = await fs.readJson(authPath);
              
              // トークンの有効性を確認
              if (!authData.accessToken || !authData.refreshToken) {
                Logger.warn(`認証ファイルにアクセストークンまたはリフレッシュトークンがありません: ${authPath}`);
                continue;
              }
              
              // 有効期限の確認 (オプション)
              if (authData.expiresAt && authData.expiresAt < Date.now()) {
                Logger.warn(`認証ファイルのトークンが期限切れです: ${authPath}`);
                // 期限切れでもコピーは続行
              }
              
              // AppGenius用にソース情報を追加
              authData.source = 'appgenius-extension';
              authData.syncedAt = Date.now();
              authData.updatedAt = Date.now();
              authData.isolatedAuth = true;
              
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
              foundValidAuth = true;
              break;
            } catch (copyError) {
              Logger.error(`認証ファイルのコピー中にエラーが発生しました: ${authPath}`, copyError as Error);
            }
          }
        }
        
        // どの認証ファイルも見つからなかった場合
        if (!foundValidAuth) {
          Logger.warn('既存の認証ファイルが見つかりませんでした。トークン同期が必要です。');
          
          // 空のAppGenius認証ファイルを作成（障害対策として）
          try {
            const emptyAuthInfo = {
              source: 'appgenius-extension',
              syncedAt: Date.now(),
              isolatedAuth: true,
              needsSync: true // 同期が必要なフラグを追加
            };
            
            await fs.writeJson(appGeniusAuthPath, emptyAuthInfo, {
              spaces: 2,
              mode: 0o600
            });
            
            if (process.platform !== 'win32') {
              await fs.chmod(appGeniusAuthPath, 0o600);
            }
            
            Logger.info(`空のAppGenius認証ファイルを作成しました (後で同期が必要): ${appGeniusAuthPath}`);
          } catch (emptyFileError) {
            Logger.error(`空の認証ファイルの作成に失敗しました: ${emptyFileError.message}`);
          }
        }
      } else {
        // 既存ファイルの有効性チェック
        try {
          const existingAuthData = await fs.readJson(appGeniusAuthPath);
          const hasValidTokens = existingAuthData.accessToken && existingAuthData.refreshToken;
          
          if (hasValidTokens) {
            Logger.info(`AppGenius専用認証ファイルが既に存在し、有効なトークンを含んでいます: ${appGeniusAuthPath}`);
          } else {
            Logger.warn(`AppGenius専用認証ファイルは存在しますが、有効なトークンがありません: ${appGeniusAuthPath}`);
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
      // 標準のClaudeCode CLI認証情報を削除
      const claudeConfigDir = this._getClaudeConfigDir();
      const standardAuthFilePath = path.join(claudeConfigDir, 'auth.json');
      
      if (fs.existsSync(standardAuthFilePath)) {
        fs.unlinkSync(standardAuthFilePath);
        Logger.info('【API連携】ClaudeCode CLI標準の認証情報を削除しました');
      } else {
        Logger.debug('ClaudeCode CLI標準認証ファイルが存在しないため、削除操作はスキップします');
      }
      
      // AppGenius専用の認証情報も削除する場合
      if (removeIsolatedAuth) {
        const appGeniusAuthFilePath = this.getAppGeniusAuthFilePath();
        
        if (fs.existsSync(appGeniusAuthFilePath)) {
          fs.unlinkSync(appGeniusAuthFilePath);
          Logger.info('【API連携】AppGenius専用の認証情報を削除しました');
        } else {
          Logger.debug('AppGenius専用認証ファイルが存在しないため、削除操作はスキップします');
        }
      }
      
      // 認証削除をトークン使用量としても記録
      try {
        await this._apiClient.recordTokenUsage(0, 'auth-logout', 'token-sync');
        Logger.debug('認証削除情報をトークン使用履歴に記録しました');
      } catch (tokenRecordError) {
        // トークン使用記録の失敗は致命的ではないのでログのみ
        Logger.warn('認証削除情報をトークン使用履歴に記録できませんでした:', tokenRecordError as Error);
      }
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
      const isAuthenticated = await this._authService.isAuthenticated();
      
      if (!isAuthenticated) {
        Logger.warn('【API連携】認証されていません。リフレッシュを試みます');
        return await this._authService.refreshToken();
      }
      
      // 最後のリフレッシュから30分以上経過している場合、トークンをリフレッシュ
      const now = Date.now();
      if (now - this._lastTokenRefresh > 30 * 60 * 1000) {
        Logger.info('【API連携】前回のリフレッシュから30分以上経過しているため、トークンをリフレッシュします');
        const refreshSucceeded = await this._authService.refreshToken();
        
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
   * ClaudeCodeの設定ディレクトリを取得
   * 
   * この関数はOSに応じて適切なディレクトリを返します。
   * また、最新のclaude-cliの実装に合わせて、代替ディレクトリの場所も考慮します。
   */
  private _getClaudeConfigDir(): string {
    const homeDir = os.homedir();
    
    // 環境変数が設定されている場合は、それを優先
    if (process.env.CLAUDE_CONFIG_DIR) {
      return process.env.CLAUDE_CONFIG_DIR;
    }
    
    // OSによって設定ディレクトリの場所が異なる
    if (process.platform === 'win32') {
      // Windowsでの標準的な設定ディレクトリ
      const appDataDir = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appDataDir, 'claude-cli');
    } else if (process.platform === 'darwin') {
      // macOSでの標準的な設定ディレクトリ
      // CLAUDE_AUTH_FILEが設定されている場合は、その親ディレクトリを使用
      if (process.env.CLAUDE_AUTH_FILE) {
        return path.dirname(process.env.CLAUDE_AUTH_FILE);
      }
      
      // 最新のclaude-cliでは、Application Supportディレクトリを使用
      const libraryDir = path.join(homeDir, 'Library', 'Application Support', 'claude-cli');
      if (fs.existsSync(libraryDir)) {
        return libraryDir;
      }
      
      // 旧バージョンとの互換性のために、.claudeディレクトリも確認
      const dotClaudeDir = path.join(homeDir, '.claude');
      if (fs.existsSync(dotClaudeDir)) {
        return dotClaudeDir;
      }
      
      // デフォルトとして最新の場所を返す
      return path.join(homeDir, 'Library', 'Application Support', 'claude-cli');
    } else {
      // Linux/Unixでの標準的な設定ディレクトリ
      // XDG_CONFIG_HOMEが設定されている場合は、それを使用
      const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
      const xdgConfigDir = path.join(xdgConfigHome, 'claude-cli');
      
      // XDG_CONFIG_HOMEに従ったディレクトリが存在する場合はそれを使用
      if (fs.existsSync(xdgConfigDir)) {
        return xdgConfigDir;
      }
      
      // 旧バージョンとの互換性のために、.claudeディレクトリも確認
      const dotClaudeDir = path.join(homeDir, '.claude');
      if (fs.existsSync(dotClaudeDir)) {
        return dotClaudeDir;
      }
      
      // デフォルトとしてXDG仕様に従った場所を返す
      return xdgConfigDir;
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
      // ClaudeCode CLIパスを環境変数から取得、または適切なデフォルトを使用
      const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
      
      // バージョン情報を取得してみる
      await this._execPromise(`${claudeCodePath} --version`);
      
      // 利用可能な場合、ログイン状態も確認する
      await this.checkClaudeCliLoginStatus();
      
      return true;
    } catch (error) {
      console.error('ClaudeCode CLIの検出に失敗しました:', error);
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
      const claudeConfigDir = this._getClaudeConfigDir();
      const authFilePath = path.join(claudeConfigDir, 'auth.json');
      
      // auth.jsonファイルが存在し、有効なトークンが含まれているか確認
      if (fs.existsSync(authFilePath)) {
        try {
          const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
          
          // 必要なトークンが含まれていて、有効期限が切れていないかを確認
          const isValid = authData.accessToken && 
                          authData.refreshToken && 
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