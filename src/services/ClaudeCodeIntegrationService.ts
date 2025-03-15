import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '../utils/logger';
import { ClaudeCodeAuthSync } from './ClaudeCodeAuthSync';
import { ClaudeCodeLauncherService } from './ClaudeCodeLauncherService';
import { ProxyManager } from '../utils/ProxyManager';
import { AuthenticationService } from '../core/auth/AuthenticationService';
import { AppGeniusEventBus, AppGeniusEventType } from './AppGeniusEventBus';
import { ClaudeCodeApiClient } from '../api/claudeCodeApiClient';

/**
 * プロンプト同期情報
 */
interface PromptSyncInfo {
  lastSyncTimestamp: number;
  prompts: any[];
}

/**
 * ClaudeCodeIntegrationService - VSCode拡張とClaudeCode CLIの連携サービス
 * 
 * プロンプトライブラリの同期、認証情報の共有、APIプロキシ機能などを提供します。
 */
export class ClaudeCodeIntegrationService {
  private static instance: ClaudeCodeIntegrationService;
  private _authSync: ClaudeCodeAuthSync;
  private _launcher: ClaudeCodeLauncherService;
  private _proxyManager: ProxyManager;
  private _apiClient: ClaudeCodeApiClient;
  private _authService: AuthenticationService;
  private _eventBus: AppGeniusEventBus;
  private _syncInterval: NodeJS.Timer | null = null;
  private _disposables: vscode.Disposable[] = [];
  
  // 設定パラメータ
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5分
  private readonly PROMPT_SYNC_FILE = 'prompt-sync.json';

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authSync = ClaudeCodeAuthSync.getInstance();
    this._launcher = ClaudeCodeLauncherService.getInstance();
    this._proxyManager = ProxyManager.getInstance();
    this._apiClient = ClaudeCodeApiClient.getInstance();
    this._authService = AuthenticationService.getInstance();
    this._eventBus = AppGeniusEventBus.getInstance();
    
    this._initialize();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeCodeIntegrationService {
    if (!ClaudeCodeIntegrationService.instance) {
      ClaudeCodeIntegrationService.instance = new ClaudeCodeIntegrationService();
    }
    return ClaudeCodeIntegrationService.instance;
  }

  /**
   * 初期化
   */
  private async _initialize(): Promise<void> {
    try {
      // 認証状態変更のリスナー
      this._disposables.push(
        this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this))
      );
      
      // ClaudeCode起動/停止イベントのリスナー
      this._disposables.push(
        this._eventBus.onEventType(AppGeniusEventType.CLAUDE_CODE_STARTED, this._handleClaudeCodeStarted.bind(this))
      );
      
      this._disposables.push(
        this._eventBus.onEventType(AppGeniusEventType.CLAUDE_CODE_STOPPED, this._handleClaudeCodeStopped.bind(this))
      );
      
      // 初期状態の確認
      if (this._authService.isAuthenticated()) {
        await this._startIntegration();
      }
      
      Logger.info('ClaudeCodeIntegrationService initialized');
    } catch (error) {
      Logger.error('ClaudeCodeIntegrationServiceの初期化に失敗しました', error as Error);
    }
  }

  /**
   * 認証状態変更ハンドラー
   */
  private async _handleAuthStateChange(isAuthenticated: boolean): Promise<void> {
    try {
      if (isAuthenticated) {
        await this._startIntegration();
      } else {
        await this._stopIntegration();
      }
    } catch (error) {
      Logger.error('認証状態変更の処理中にエラーが発生しました', error as Error);
    }
  }

  /**
   * ClaudeCode起動イベントハンドラー
   */
  private async _handleClaudeCodeStarted(data: any): Promise<void> {
    try {
      // プロンプトの同期を即時実行
      await this._syncPrompts();
      
      // プロキシサーバーが起動していなければ起動
      if (!this._proxyManager.getApiProxyEnvValue()) {
        await this._proxyManager.startProxyServer();
      }
      
      Logger.info('ClaudeCode起動イベントを処理しました');
    } catch (error) {
      Logger.error('ClaudeCode起動イベントの処理中にエラーが発生しました', error as Error);
    }
  }

  /**
   * ClaudeCode停止イベントハンドラー
   */
  private async _handleClaudeCodeStopped(data: any): Promise<void> {
    // ClaudeCodeの使用が終了した場合の処理
    // 必要に応じてプロキシサーバーを停止するなどの処理を行う
    // 現時点では特に処理は行わない（他の機能で使用している可能性があるため）
    Logger.info('ClaudeCode停止イベントを処理しました');
  }

  /**
   * 統合機能の開始
   */
  private async _startIntegration(): Promise<void> {
    try {
      // プロキシサーバーの起動
      await this._proxyManager.startProxyServer();
      
      // プロンプト同期の開始
      this._startPromptSync();
      
      Logger.info('ClaudeCode統合機能を開始しました');
    } catch (error) {
      Logger.error('ClaudeCode統合機能の開始に失敗しました', error as Error);
    }
  }

  /**
   * 統合機能の停止
   */
  private async _stopIntegration(): Promise<void> {
    try {
      // プロンプト同期の停止
      this._stopPromptSync();
      
      // プロキシサーバーの停止（オプション）
      // 現在は停止しない（他の機能で使用している可能性があるため）
      
      Logger.info('ClaudeCode統合機能を停止しました');
    } catch (error) {
      Logger.error('ClaudeCode統合機能の停止に失敗しました', error as Error);
    }
  }

  /**
   * プロンプト同期の開始
   */
  private _startPromptSync(): void {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
    }
    
    // 初回同期を実行
    this._syncPrompts().catch(error => {
      Logger.error('初回プロンプト同期に失敗しました', error as Error);
    });
    
    // 定期的な同期を設定
    this._syncInterval = setInterval(async () => {
      try {
        await this._syncPrompts();
      } catch (error) {
        Logger.error('定期プロンプト同期に失敗しました', error as Error);
      }
    }, this.SYNC_INTERVAL_MS);
    
    Logger.info('プロンプト同期を開始しました');
  }

  /**
   * プロンプト同期の停止
   */
  private _stopPromptSync(): void {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
    
    Logger.info('プロンプト同期を停止しました');
  }

  /**
   * プロンプトの同期
   */
  private async _syncPrompts(): Promise<void> {
    try {
      // ClaudeCodeが利用可能か確認
      const isAvailable = await this._authSync.isClaudeCodeAvailable();
      if (!isAvailable) {
        Logger.warn('ClaudeCodeが見つかりません。プロンプト同期をスキップします。');
        return;
      }
      
      // 前回の同期情報を読み込み
      const syncInfo = this._loadPromptSyncInfo();
      
      // 更新情報を取得
      const updates = await this._apiClient.getSyncUpdates(syncInfo.lastSyncTimestamp);
      
      if (updates.prompts && updates.prompts.length > 0) {
        // 同期先ディレクトリを取得・作成
        const syncDir = this._getPromptSyncDir();
        if (!fs.existsSync(syncDir)) {
          fs.mkdirSync(syncDir, { recursive: true });
        }
        
        // プロンプトを書き出し
        for (const prompt of updates.prompts) {
          await this._writePromptToFile(prompt, syncDir);
        }
        
        // 同期情報を更新
        syncInfo.lastSyncTimestamp = updates.timestamp;
        syncInfo.prompts = [...syncInfo.prompts.filter(p => 
          !updates.prompts.some((up: any) => up.id === p.id)
        ), ...updates.prompts];
        
        this._savePromptSyncInfo(syncInfo);
        
        Logger.info(`${updates.prompts.length}件のプロンプトを同期しました`);
      } else {
        Logger.debug('同期するプロンプトはありませんでした');
      }
    } catch (error) {
      Logger.error('プロンプトの同期に失敗しました', error as Error);
    }
  }

  /**
   * 同期情報の読み込み
   */
  private _loadPromptSyncInfo(): PromptSyncInfo {
    try {
      const filePath = path.join(this._getConfigDir(), this.PROMPT_SYNC_FILE);
      
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      Logger.error('同期情報の読み込みに失敗しました', error as Error);
    }
    
    // デフォルト値
    return {
      lastSyncTimestamp: 0,
      prompts: []
    };
  }

  /**
   * 同期情報の保存
   */
  private _savePromptSyncInfo(syncInfo: PromptSyncInfo): void {
    try {
      const configDir = this._getConfigDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const filePath = path.join(configDir, this.PROMPT_SYNC_FILE);
      fs.writeFileSync(filePath, JSON.stringify(syncInfo, null, 2), 'utf8');
    } catch (error) {
      Logger.error('同期情報の保存に失敗しました', error as Error);
    }
  }

  /**
   * プロンプトをファイルに書き出し
   */
  private async _writePromptToFile(prompt: any, syncDir: string): Promise<void> {
    try {
      // プロンプトファイル名を生成（IDをファイル名に変換）
      const fileName = `${prompt.id.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
      const filePath = path.join(syncDir, fileName);
      
      // プロンプト内容をマークダウン形式で生成
      let content = `# ${prompt.title}\n\n`;
      content += `型: ${prompt.type}\n`;
      content += `カテゴリ: ${prompt.category || 'なし'}\n`;
      content += `タグ: ${prompt.tags ? prompt.tags.join(', ') : 'なし'}\n`;
      content += `最終更新: ${new Date(prompt.updatedAt).toLocaleString()}\n\n`;
      content += `---\n\n`;
      content += prompt.content;
      
      // ファイルに書き込み
      fs.writeFileSync(filePath, content, 'utf8');
      
      Logger.debug(`プロンプトを保存しました: ${filePath}`);
    } catch (error) {
      Logger.error(`プロンプトのファイル書き出しに失敗しました: ${prompt.id}`, error as Error);
    }
  }

  /**
   * 設定ディレクトリのパスを取得
   */
  private _getConfigDir(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.vscode', 'appgenius');
  }

  /**
   * プロンプト同期ディレクトリのパスを取得
   */
  private _getPromptSyncDir(): string {
    return path.join(this._getConfigDir(), 'prompts');
  }

  /**
   * 環境変数情報を取得
   * ClaudeCode CLI用の環境変数として設定する値を取得
   */
  public getEnvironmentVariables(): { [key: string]: string } {
    const env: { [key: string]: string } = {};
    
    // プロキシURLの設定
    const apiProxyUrl = this._proxyManager.getApiProxyEnvValue();
    if (apiProxyUrl) {
      env['PORTAL_API_PROXY_URL'] = apiProxyUrl;
    }
    
    // ClaudeプロキシURLの設定（必要に応じて）
    const claudeProxyUrl = this._proxyManager.getClaudeProxyEnvValue();
    if (claudeProxyUrl) {
      env['CLAUDE_API_PROXY_URL'] = claudeProxyUrl;
    }
    
    // 統合モードが有効であることを示す設定
    env['CLAUDE_INTEGRATION_ENABLED'] = 'true';
    
    // プロンプト同期ディレクトリのパス
    env['CLAUDE_PROMPT_DIR'] = this._getPromptSyncDir();
    
    return env;
  }

  /**
   * ClaudeCodeを起動（プロンプトファイルを指定）
   */
  public async launchWithPrompt(promptId: string, projectPath: string): Promise<boolean> {
    try {
      // プロンプト情報を取得
      const prompt = await this._apiClient.getPromptDetail(promptId);
      if (!prompt) {
        throw new Error(`プロンプトが見つかりません: ${promptId}`);
      }
      
      // プロンプトファイルを準備
      const promptDir = this._getPromptSyncDir();
      const promptFilePath = path.join(promptDir, `${promptId.replace(/[^a-zA-Z0-9]/g, '_')}.md`);
      
      // プロンプトファイルが存在しない場合は作成
      if (!fs.existsSync(promptFilePath)) {
        await this._writePromptToFile(prompt, promptDir);
      }
      
      // 使用履歴を記録
      await this._apiClient.recordPromptUsage(
        promptId, 
        prompt.currentVersion || prompt.versionId, 
        'vscode-extension'
      );
      
      // ClaudeCodeを起動
      return await this._launcher.launchClaudeCodeWithPrompt(
        projectPath,
        promptFilePath,
        { title: `ClaudeCode - ${prompt.title}` }
      );
    } catch (error) {
      Logger.error('プロンプト指定のClaudeCode起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`プロンプト指定のClaudeCode起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * ClaudeCodeをインストール
   */
  public async installClaudeCode(): Promise<boolean> {
    return await this._launcher.installClaudeCode();
  }

  /**
   * ClaudeCodeが利用可能か確認
   */
  public async isClaudeCodeAvailable(): Promise<boolean> {
    return await this._authSync.isClaudeCodeAvailable();
  }
  
  /**
   * 公開URLを指定してClaudeCodeを起動
   * @param promptUrl 公開プロンプトURL
   * @param projectPath プロジェクトパス
   * @returns 起動成功したかどうか
   */
  public async launchWithPublicUrl(promptUrl: string, projectPath: string): Promise<boolean> {
    try {
      // URLからプロンプト情報を取得
      const prompt = await this._apiClient.getPromptFromPublicUrl(promptUrl);
      if (!prompt) {
        throw new Error(`URLからプロンプトを取得できませんでした: ${promptUrl}`);
      }

      // プロンプトファイルを一時的に作成
      const tempDir = os.tmpdir();
      const promptFileName = `prompt_${Date.now()}.md`;
      const promptFilePath = path.join(tempDir, promptFileName);

      // マークダウン形式でプロンプト内容を生成
      let content = `# ${prompt.title}\n\n`;
      if (prompt.description) content += `${prompt.description}\n\n`;
      if (prompt.tags && prompt.tags.length > 0) content += `タグ: ${prompt.tags.join(', ')}\n`;
      content += `\n---\n\n${prompt.content}`;

      // ファイルに書き込み
      fs.writeFileSync(promptFilePath, content, 'utf8');

      // 使用履歴を記録（可能であれば）
      if (prompt.id) {
        await this._apiClient.recordPromptUsage(
          prompt.id,
          '1',
          'public-url'
        ).catch(err => {
          // エラーでも処理は続行
          Logger.warn('プロンプト使用履歴の記録に失敗しました', err as Error);
        });
      }

      // ClaudeCodeを起動
      return await this._launcher.launchClaudeCodeWithPrompt(
        projectPath,
        promptFilePath,
        { title: `ClaudeCode - ${prompt.title}` }
      );
    } catch (error) {
      Logger.error('公開URLでのClaudeCode起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`公開URLでのClaudeCode起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    this._stopPromptSync();
    
    // プロキシサーバーは停止しない（他の機能で使用している可能性があるため）
    
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}