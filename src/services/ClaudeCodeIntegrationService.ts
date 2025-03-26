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
    try {
      // extentionContextの参照を確保
      const context = (global as any).extensionContext;
      if (context) {
        this._authSync = ClaudeCodeAuthSync.getInstance(context);
      } else {
        // コンテキストがない場合はログと警告
        Logger.warn('ExtensionContextが見つかりません。ClaudeCodeAuthSyncは後で初期化されます。');
        this._authSync = null as any; // 後で適切に初期化
      }
      this._launcher = ClaudeCodeLauncherService.getInstance();
      this._proxyManager = ProxyManager.getInstance();
      this._apiClient = ClaudeCodeApiClient.getInstance();
      this._authService = AuthenticationService.getInstance();
      this._eventBus = AppGeniusEventBus.getInstance();
      
      this._initialize();
    } catch (error) {
      Logger.error('ClaudeCodeIntegrationServiceの初期化中にエラーが発生しました', error as Error);
    }
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ClaudeCodeIntegrationService {
    if (!ClaudeCodeIntegrationService.instance) {
      // インスタンス生成前にClaudeCodeAuthSyncの初期化を試行
      try {
        const context = (global as any).extensionContext || (global as any).__extensionContext;
        if (context) {
          // ClaudeCodeAuthSyncを先に初期化
          const { ClaudeCodeAuthSync } = require('./ClaudeCodeAuthSync');
          ClaudeCodeAuthSync.getInstance(context);
          Logger.info('ClaudeCodeIntegrationService: ClaudeCodeAuthSyncを初期化しました');
        }
      } catch (error) {
        Logger.warn('ClaudeCodeAuthSyncの事前初期化に失敗しました', error as Error);
        // エラーでも続行（コンストラクタでも初期化を試みる）
      }
      
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
   * ユーザーの認証状態・ロール・APIアクセス権限を考慮して判定します
   */
  public async isClaudeCodeAvailable(): Promise<boolean> {
    try {
      // 認証状態をチェック
      if (!this._authService.isAuthenticated()) {
        Logger.warn('未認証ユーザーはClaudeCodeを利用できません');
        return false;
      }
      
      // ユーザー情報を取得
      const user = this._authService.getCurrentUser();
      
      // ユーザー情報がない場合はアクセス不可
      if (!user) {
        Logger.warn('ユーザー情報が取得できないためClaudeCodeを利用できません');
        return false;
      }
      
      // ロールチェック - unsubscribeユーザーはアクセス不可
      if (user.role === 'unsubscribe') {
        Logger.warn('退会済みユーザーはClaudeCodeを利用できません');
        return false;
      }
      
      // APIアクセスチェック - 無効化されている場合はアクセス不可
      if (user.apiAccess && user.apiAccess.enabled === false) {
        Logger.warn('APIアクセスが無効化されているユーザーはClaudeCodeを利用できません');
        return false;
      }
      
      // ClaudeCodeが実際にインストールされているかチェック
      return await this._authSync.isClaudeCodeAvailable();
    } catch (error) {
      Logger.error('ClaudeCode利用可否チェック中にエラーが発生しました', error as Error);
      return false;
    }
  }
  
  /**
   * 公開URLを指定してClaudeCodeを起動
   * @param promptUrl 公開プロンプトURL
   * @param projectPath プロジェクトパス
   * @param additionalContent 追加コンテンツ（オプション）
   * @param splitView 分割表示を使用するかどうか（オプション）
   * @param location ターミナルの表示位置（オプション）
   * @returns 起動成功したかどうか
   */
  public async launchWithPublicUrl(
    promptUrl: string, 
    projectPath: string, 
    additionalContent?: string,
    splitView?: boolean,
    location?: vscode.ViewColumn
  ): Promise<boolean> {
    try {
      // URLからプロンプト情報を取得
      const prompt = await this._apiClient.getPromptFromPublicUrl(promptUrl);
      if (!prompt) {
        throw new Error(`URLからプロンプトを取得できませんでした: ${promptUrl}`);
      }

      // プロジェクト内に隠しディレクトリを作成（既に存在する場合は作成しない）
      const hiddenDir = path.join(projectPath, '.appgenius_temp');
      if (!fs.existsSync(hiddenDir)) {
        fs.mkdirSync(hiddenDir, { recursive: true });
      }
      
      // ランダムな文字列を生成して隠しファイル名に使用
      const randomStr = Math.random().toString(36).substring(2, 15);
      const promptFileName = `.vq${randomStr}`;
      const promptFilePath = path.join(hiddenDir, promptFileName);
      
      // ユーザーにパスをログで表示（デバッグ用）
      Logger.info(`セキュアな隠しプロンプトファイルを作成します: ${promptFilePath}`);

      // マークダウン形式でプロンプト内容を生成
      let content = `# ${prompt.title}\n\n`;
      if (prompt.description) content += `${prompt.description}\n\n`;
      if (prompt.tags && prompt.tags.length > 0) content += `タグ: ${prompt.tags.join(', ')}\n`;
      content += `\n---\n\n${prompt.content}`;
      
      // 追加コンテンツがあれば追加（デバッグ探偵からのエラー情報など）
      if (additionalContent) {
        content += `\n\n${additionalContent}`;
        Logger.info('追加コンテンツをプロンプトに追加しました');
      }

      // ファイルに書き込み
      fs.writeFileSync(promptFilePath, content, 'utf8');
      Logger.info('セキュアな隠しプロンプトファイルに内容を書き込みました');

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

      // 分割表示が指定されている場合はログ出力
      if (splitView) {
        Logger.info(`分割表示モードでClaudeCodeを起動します: ${splitView ? 'Enabled' : 'Disabled'}`);
        if (location) {
          Logger.info(`ターミナル表示位置: ${location}`);
        }
      }

      // ClaudeCodeを起動（プロンプトファイル即時削除オプションと分割表示オプション付き）
      return await this._launcher.launchClaudeCodeWithPrompt(
        projectPath,
        promptFilePath,
        { 
          title: `ClaudeCode - ${prompt.title}`,
          deletePromptFile: true, // セキュリティ対策としてプロンプトファイルを即時削除
          splitView: splitView, // 分割表示
          location: location // 表示位置
        }
      );
    } catch (error) {
      Logger.error('公開URLでのClaudeCode起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`公開URLでのClaudeCode起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * URLからプロンプト内容を取得する
   * @param promptUrl プロンプトURL
   * @returns プロンプト内容
   */
  public async fetchPromptContent(promptUrl: string): Promise<string> {
    try {
      const prompt = await this._apiClient.getPromptFromPublicUrl(promptUrl);
      if (!prompt) {
        throw new Error(`URLからプロンプトを取得できませんでした: ${promptUrl}`);
      }
      
      return prompt.content;
    } catch (error) {
      Logger.error(`プロンプト内容の取得に失敗しました: ${promptUrl}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 複数プロンプトを組み合わせて起動
   * ガイダンスプロンプトと機能プロンプトを組み合わせて使用
   * @param guidancePromptUrl ガイダンスプロンプトのURL
   * @param featurePromptUrl 機能プロンプトのURL
   * @param projectPath プロジェクトパス
   * @param additionalContent 追加コンテンツ（オプション）
   * @returns 起動成功したかどうか
   */
  public async launchWithSecurityBoundary(
    guidancePromptUrl: string,
    featurePromptUrl: string,
    projectPath: string,
    additionalContent?: string
  ): Promise<boolean> {
    try {
      Logger.info(`複合プロンプトでClaudeCodeを起動: プロンプト1=${guidancePromptUrl}, プロンプト2=${featurePromptUrl}`);
      
      // 両方のプロンプトの内容を取得
      const guidancePrompt = await this.fetchPromptContent(guidancePromptUrl);
      if (!guidancePrompt) {
        throw new Error(`ガイダンスプロンプトの取得に失敗しました: ${guidancePromptUrl}`);
      }
      
      const featurePrompt = await this.fetchPromptContent(featurePromptUrl);
      if (!featurePrompt) {
        throw new Error(`機能プロンプトの取得に失敗しました: ${featurePromptUrl}`);
      }
      
      // プロジェクト内に隠しディレクトリを作成（既に存在する場合は作成しない）
      const hiddenDir = path.join(projectPath, '.appgenius_temp');
      if (!fs.existsSync(hiddenDir)) {
        fs.mkdirSync(hiddenDir, { recursive: true });
      }
      
      // ランダムな文字列を生成して隠しファイル名に使用
      const randomStr = Math.random().toString(36).substring(2, 15);
      const combinedPromptFileName = `.vq${randomStr}`;
      const combinedPromptPath = path.join(hiddenDir, combinedPromptFileName);
      
      // ガイダンスプロンプトを先頭に配置して結合
      let combinedContent = guidancePrompt;
      combinedContent += '\n\n---\n\n';
      combinedContent += featurePrompt;
      
      // 追加コンテンツがあれば最後に追加
      if (additionalContent) {
        combinedContent += '\n\n---\n\n';
        combinedContent += additionalContent;
      }
      
      // 結合したプロンプトをファイルに保存
      fs.writeFileSync(combinedPromptPath, combinedContent, 'utf8');
      Logger.info(`セキュアな複合プロンプトファイルを作成しました: ${combinedPromptPath}`);
      
      // ClaudeCodeを起動（プロンプトファイル即時削除オプション付き）
      return await this._launcher.launchClaudeCodeWithPrompt(
        projectPath,
        combinedPromptPath,
        {
          title: 'AIアシスタント',
          deletePromptFile: true // ClaudeCodeLauncherServiceでファイルが読み込まれた後にタイマーベースで削除
        }
      );
    } catch (error) {
      Logger.error('複合プロンプトでのClaudeCode起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`AIアシスタントの起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * ローカルファイルを使用してClaudeCodeを起動
   * @param promptFilePath ローカルプロンプトファイルのパス
   * @param projectPath プロジェクトパス
   * @param additionalContent 追加コンテンツ（オプション）
   * @param splitView 分割表示を使用するかどうか（オプション）
   * @param options その他のオプション（タイトルなど）
   * @returns 起動成功したかどうか
   */
  public async launchWithFile(
    promptFilePath: string,
    projectPath: string,
    additionalContent?: string,
    splitView?: boolean,
    options?: { 
      title?: string; 
      deletePromptFile?: boolean;
      location?: vscode.ViewColumn;
    }
  ): Promise<boolean> {
    try {
      Logger.info(`ローカルファイルでClaudeCodeを起動: ${promptFilePath}`);
      
      // プロンプトファイルが存在するか確認
      if (!fs.existsSync(promptFilePath)) {
        throw new Error(`プロンプトファイルが見つかりません: ${promptFilePath}`);
      }
      
      // プロンプト内容を読み込む
      let content = fs.readFileSync(promptFilePath, 'utf8');
      
      // 追加コンテンツがあれば追加
      if (additionalContent) {
        content += '\n\n---\n\n';
        content += additionalContent;
      }
      
      // 一時ファイルを作成
      const tempDir = path.join(projectPath, '.appgenius_temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // ランダムな文字列を生成
      const randomStr = Math.random().toString(36).substring(2, 15);
      const tempFileName = `.vq${randomStr}`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      // 一時ファイルに書き込み
      fs.writeFileSync(tempFilePath, content, 'utf8');
      Logger.info(`セキュアな一時ファイルを作成しました: ${tempFilePath}`);
      
      // ClaudeCodeを起動
      return await this._launcher.launchClaudeCodeWithPrompt(
        projectPath,
        tempFilePath,
        {
          title: options?.title || 'ClaudeCode',
          deletePromptFile: options?.deletePromptFile || true,
          splitView: splitView,
          location: options?.location
        }
      );
    } catch (error) {
      Logger.error('ローカルファイルでのClaudeCode起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`ローカルファイルでのClaudeCode起動に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 直接プロンプト内容を使用してClaudeCodeを起動
   * @param promptContent プロンプト内容
   * @param projectPath プロジェクトパス
   * @param splitView 分割表示を使用するかどうか（オプション）
   * @param options その他のオプション（タイトルなど）
   * @returns 起動成功したかどうか
   */
  public async launchWithDirectPrompt(
    promptContent: string,
    projectPath: string,
    splitView?: boolean,
    options?: { 
      title?: string; 
      deletePromptFile?: boolean;
      location?: vscode.ViewColumn;
    }
  ): Promise<boolean> {
    try {
      Logger.info(`ダイレクトプロンプトでClaudeCodeを起動`);
      
      // 一時ファイルを作成
      const tempDir = path.join(projectPath, '.appgenius_temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // ランダムな文字列を生成
      const randomStr = Math.random().toString(36).substring(2, 15);
      const tempFileName = `.vq${randomStr}`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      // 一時ファイルに書き込み
      fs.writeFileSync(tempFilePath, promptContent, 'utf8');
      Logger.info(`セキュアな一時ファイルを作成しました: ${tempFilePath}`);
      
      // ClaudeCodeを起動
      return await this._launcher.launchClaudeCodeWithPrompt(
        projectPath,
        tempFilePath,
        {
          title: options?.title || 'ClaudeCode',
          deletePromptFile: options?.deletePromptFile || true,
          splitView: splitView,
          location: options?.location
        }
      );
    } catch (error) {
      Logger.error('ダイレクトプロンプトでのClaudeCode起動に失敗しました', error as Error);
      vscode.window.showErrorMessage(`ダイレクトプロンプトでのClaudeCode起動に失敗しました: ${(error as Error).message}`);
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