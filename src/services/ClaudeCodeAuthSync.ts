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
      
      // 認証情報ディレクトリとファイルパスを決定
      let authDir: string;
      let authFileName: string;
      
      if (useIsolatedMode) {
        // AppGenius専用の認証情報ディレクトリを使用
        authDir = this._getAppGeniusAuthDir();
        authFileName = 'claude-auth.json';
        Logger.info(`分離認証モードを使用: AppGenius専用の認証情報を保存します (ディレクトリ: ${authDir})`);
      } else {
        // 標準のClaudeCode CLI設定ディレクトリを使用
        authDir = this._getClaudeConfigDir();
        authFileName = 'auth.json';
        Logger.info(`標準認証モードを使用: ClaudeCode CLI標準の認証情報を更新します (ディレクトリ: ${authDir})`);
      }
      
      // ディレクトリが存在するか確認し、存在しなければ作成
      try {
        await fs.ensureDir(authDir);
        Logger.info(`認証情報ディレクトリを確認/作成しました: ${authDir}`);
      } catch (dirError) {
        Logger.error(`認証情報ディレクトリの作成に失敗しました: ${authDir}`, dirError as Error);
        throw new Error(`認証情報ディレクトリの作成に失敗しました: ${(dirError as Error).message}`);
      }
      
      // トークン情報をJSONに変換
      const authInfo = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 3600000, // 1時間後
        source: useIsolatedMode ? 'appgenius-extension' : 'vscode-extension',
        syncedAt: Date.now(),
        isolatedAuth: useIsolatedMode
      };
      
      // 認証情報をファイルに保存
      const authFilePath = path.join(authDir, authFileName);
      
      try {
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
      } catch (fileError) {
        Logger.error(`認証情報ファイルの保存に失敗しました: ${authFilePath}`, fileError as Error);
        throw new Error(`認証情報ファイルの保存に失敗しました: ${(fileError as Error).message}`);
      }
      
      // 同期日時を記録
      this._lastTokenRefresh = Date.now();
      
      const modeText = useIsolatedMode ? 'AppGenius専用認証情報' : 'ClaudeCode CLI標準認証情報';
      Logger.info(`【API連携】${modeText}を同期しました: ${authFilePath}`);
      
      // 認証同期成功をトークン使用量としても記録
      try {
        await this._apiClient.recordTokenUsage(0, 'auth-sync', useIsolatedMode ? 'isolated-auth' : 'standard-auth');
        Logger.debug('認証同期情報をトークン使用履歴に記録しました');
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
   * 分離認証モードが有効かどうかを環境変数から検出
   * @returns 分離認証モードが有効かどうか
   */
  private _isIsolatedAuthEnabled(): boolean {
    // 環境変数から直接検出
    const envVar = process.env.APPGENIUS_USE_ISOLATED_AUTH;
    if (envVar !== undefined) {
      const isEnabled = envVar.toLowerCase() === 'true';
      Logger.info(`分離認証モード環境変数: ${envVar} (${isEnabled ? '有効' : '無効'})`);
      return isEnabled;
    }
    
    // VSCode環境の検出
    try {
      const isVSCodeEnv = !!vscode && !!vscode.env && !!vscode.env.appName;
      const appName = isVSCodeEnv ? vscode.env.appName : 'unknown';
      Logger.info(`VSCode環境検出: ${isVSCodeEnv}, アプリ名: ${appName}`);
      
      // VSCode環境では分離認証をデフォルトで有効化
      if (isVSCodeEnv) {
        Logger.info('VSCode環境で実行中のため、分離認証モードをデフォルトで有効化します');
        return true;
      }
    } catch (error) {
      Logger.warn(`VSCode環境の検出中にエラー発生: ${(error as Error).message}`);
    }
    
    // デフォルトは無効
    return false;
  }
  
  /**
   * AppGenius専用モードで認証情報を同期
   * 分離認証モードで認証情報を保存します
   */
  public async syncTokensToAppGeniusAuth(): Promise<void> {
    Logger.info('分離認証モードで認証情報を同期します');
    try {
      // 分離認証モードを有効にして同期
      await this._syncTokensToClaudeCode(true);
      return;
    } catch (error) {
      Logger.error('分離認証モードでの同期に失敗しました', error as Error);
      throw error;
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
   */
  private _getClaudeConfigDir(): string {
    const homeDir = os.homedir();
    // OSによって設定ディレクトリの場所が異なる
    if (process.platform === 'win32') {
      return path.join(homeDir, 'AppData', 'Roaming', 'claude-cli');
    } else if (process.platform === 'darwin') {
      return path.join(homeDir, 'Library', 'Application Support', 'claude-cli');
    } else {
      // Linux
      return path.join(homeDir, '.config', 'claude-cli');
    }
  }
  
  /**
   * AppGenius専用の認証情報ディレクトリを取得
   * @returns AppGenius専用の認証情報ディレクトリパス
   */
  private _getAppGeniusAuthDir(): string {
    const homeDir = os.homedir();
    // OSによって設定ディレクトリの場所が異なる
    if (process.platform === 'win32') {
      return path.join(homeDir, 'AppData', 'Roaming', 'appgenius');
    } else if (process.platform === 'darwin') {
      return path.join(homeDir, 'Library', 'Application Support', 'appgenius');
    } else {
      // Linux
      return path.join(homeDir, '.config', 'appgenius');
    }
  }
  
  /**
   * AppGenius専用の認証情報ファイルパスを取得
   * @returns AppGenius専用の認証情報ファイルパス
   */
  public getAppGeniusAuthFilePath(): string {
    return path.join(this._getAppGeniusAuthDir(), 'claude-auth.json');
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