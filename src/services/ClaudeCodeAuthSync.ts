import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthenticationService } from '../core/auth/AuthenticationService';
import { TokenManager } from '../core/auth/TokenManager';
import { exec } from 'child_process';
import { promisify } from 'util';

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
  private _disposables: vscode.Disposable[] = [];
  private _execPromise = promisify(exec);

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    this._tokenManager = TokenManager.getInstance();
    this._initialize();
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
      this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this))
    );
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
   */
  private async _syncTokensToClaudeCode(): Promise<void> {
    try {
      // 環境変数で同期が無効化されている場合は何もしない
      if (process.env.CLAUDE_INTEGRATION_ENABLED === 'false') {
        return;
      }
      
      // トークンを取得
      const accessToken = await this._tokenManager.getAccessToken();
      const refreshToken = await this._tokenManager.getRefreshToken();
      
      if (!accessToken || !refreshToken) {
        return;
      }
      
      // ClaudeCode CLI設定ディレクトリを取得
      const claudeConfigDir = this._getClaudeConfigDir();
      
      // ディレクトリが存在するか確認し、存在しなければ作成
      if (!fs.existsSync(claudeConfigDir)) {
        fs.mkdirSync(claudeConfigDir, { recursive: true });
      }
      
      // トークン情報をJSONに変換
      const authInfo = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 3600000, // 1時間後
        source: 'vscode-extension'
      };
      
      // 認証情報をファイルに保存
      const authFilePath = path.join(claudeConfigDir, 'auth.json');
      fs.writeFileSync(authFilePath, JSON.stringify(authInfo, null, 2), {
        encoding: 'utf8',
        mode: 0o600 // 所有者のみ読み書き可能
      });
      
      console.log('ClaudeCode CLIに認証情報を同期しました');
    } catch (error) {
      console.error('ClaudeCode CLIへの認証情報同期中にエラーが発生しました:', error);
    }
  }

  /**
   * ClaudeCode CLIからトークンを削除
   */
  private async _removeTokensFromClaudeCode(): Promise<void> {
    try {
      // ClaudeCode CLI設定ディレクトリを取得
      const claudeConfigDir = this._getClaudeConfigDir();
      const authFilePath = path.join(claudeConfigDir, 'auth.json');
      
      // 認証ファイルが存在する場合は削除
      if (fs.existsSync(authFilePath)) {
        fs.unlinkSync(authFilePath);
        console.log('ClaudeCode CLIから認証情報を削除しました');
      }
    } catch (error) {
      console.error('ClaudeCode CLIからの認証情報削除中にエラーが発生しました:', error);
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
   * ClaudeCode CLIが利用可能かチェック
   */
  public async isClaudeCodeAvailable(): Promise<boolean> {
    try {
      // ClaudeCode CLIパスを環境変数から取得、または適切なデフォルトを使用
      const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
      
      // バージョン情報を取得してみる
      await this._execPromise(`${claudeCodePath} --version`);
      return true;
    } catch (error) {
      console.error('ClaudeCode CLIの検出に失敗しました:', error);
      return false;
    }
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