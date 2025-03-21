"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeIntegrationService = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const logger_1 = require("../utils/logger");
const ClaudeCodeAuthSync_1 = require("./ClaudeCodeAuthSync");
const ClaudeCodeLauncherService_1 = require("./ClaudeCodeLauncherService");
const ProxyManager_1 = require("../utils/ProxyManager");
const AuthenticationService_1 = require("../core/auth/AuthenticationService");
const AppGeniusEventBus_1 = require("./AppGeniusEventBus");
const claudeCodeApiClient_1 = require("../api/claudeCodeApiClient");
/**
 * ClaudeCodeIntegrationService - VSCode拡張とClaudeCode CLIの連携サービス
 *
 * プロンプトライブラリの同期、認証情報の共有、APIプロキシ機能などを提供します。
 */
class ClaudeCodeIntegrationService {
    /**
     * コンストラクタ
     */
    constructor() {
        this._syncInterval = null;
        this._disposables = [];
        // 設定パラメータ
        this.SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5分
        this.PROMPT_SYNC_FILE = 'prompt-sync.json';
        this._authSync = ClaudeCodeAuthSync_1.ClaudeCodeAuthSync.getInstance();
        this._launcher = ClaudeCodeLauncherService_1.ClaudeCodeLauncherService.getInstance();
        this._proxyManager = ProxyManager_1.ProxyManager.getInstance();
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        this._eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        this._initialize();
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ClaudeCodeIntegrationService.instance) {
            ClaudeCodeIntegrationService.instance = new ClaudeCodeIntegrationService();
        }
        return ClaudeCodeIntegrationService.instance;
    }
    /**
     * 初期化
     */
    async _initialize() {
        try {
            // 認証状態変更のリスナー
            this._disposables.push(this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this)));
            // ClaudeCode起動/停止イベントのリスナー
            this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.CLAUDE_CODE_STARTED, this._handleClaudeCodeStarted.bind(this)));
            this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.CLAUDE_CODE_STOPPED, this._handleClaudeCodeStopped.bind(this)));
            // 初期状態の確認
            if (this._authService.isAuthenticated()) {
                await this._startIntegration();
            }
            logger_1.Logger.info('ClaudeCodeIntegrationService initialized');
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCodeIntegrationServiceの初期化に失敗しました', error);
        }
    }
    /**
     * 認証状態変更ハンドラー
     */
    async _handleAuthStateChange(isAuthenticated) {
        try {
            if (isAuthenticated) {
                await this._startIntegration();
            }
            else {
                await this._stopIntegration();
            }
        }
        catch (error) {
            logger_1.Logger.error('認証状態変更の処理中にエラーが発生しました', error);
        }
    }
    /**
     * ClaudeCode起動イベントハンドラー
     */
    async _handleClaudeCodeStarted(data) {
        try {
            // プロンプトの同期を即時実行
            await this._syncPrompts();
            // プロキシサーバーが起動していなければ起動
            if (!this._proxyManager.getApiProxyEnvValue()) {
                await this._proxyManager.startProxyServer();
            }
            logger_1.Logger.info('ClaudeCode起動イベントを処理しました');
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode起動イベントの処理中にエラーが発生しました', error);
        }
    }
    /**
     * ClaudeCode停止イベントハンドラー
     */
    async _handleClaudeCodeStopped(data) {
        // ClaudeCodeの使用が終了した場合の処理
        // 必要に応じてプロキシサーバーを停止するなどの処理を行う
        // 現時点では特に処理は行わない（他の機能で使用している可能性があるため）
        logger_1.Logger.info('ClaudeCode停止イベントを処理しました');
    }
    /**
     * 統合機能の開始
     */
    async _startIntegration() {
        try {
            // プロキシサーバーの起動
            await this._proxyManager.startProxyServer();
            // プロンプト同期の開始
            this._startPromptSync();
            logger_1.Logger.info('ClaudeCode統合機能を開始しました');
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode統合機能の開始に失敗しました', error);
        }
    }
    /**
     * 統合機能の停止
     */
    async _stopIntegration() {
        try {
            // プロンプト同期の停止
            this._stopPromptSync();
            // プロキシサーバーの停止（オプション）
            // 現在は停止しない（他の機能で使用している可能性があるため）
            logger_1.Logger.info('ClaudeCode統合機能を停止しました');
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode統合機能の停止に失敗しました', error);
        }
    }
    /**
     * プロンプト同期の開始
     */
    _startPromptSync() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
        }
        // 初回同期を実行
        this._syncPrompts().catch(error => {
            logger_1.Logger.error('初回プロンプト同期に失敗しました', error);
        });
        // 定期的な同期を設定
        this._syncInterval = setInterval(async () => {
            try {
                await this._syncPrompts();
            }
            catch (error) {
                logger_1.Logger.error('定期プロンプト同期に失敗しました', error);
            }
        }, this.SYNC_INTERVAL_MS);
        logger_1.Logger.info('プロンプト同期を開始しました');
    }
    /**
     * プロンプト同期の停止
     */
    _stopPromptSync() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
        logger_1.Logger.info('プロンプト同期を停止しました');
    }
    /**
     * プロンプトの同期
     */
    async _syncPrompts() {
        try {
            // ClaudeCodeが利用可能か確認
            const isAvailable = await this._authSync.isClaudeCodeAvailable();
            if (!isAvailable) {
                logger_1.Logger.warn('ClaudeCodeが見つかりません。プロンプト同期をスキップします。');
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
                syncInfo.prompts = [...syncInfo.prompts.filter(p => !updates.prompts.some((up) => up.id === p.id)), ...updates.prompts];
                this._savePromptSyncInfo(syncInfo);
                logger_1.Logger.info(`${updates.prompts.length}件のプロンプトを同期しました`);
            }
            else {
                logger_1.Logger.debug('同期するプロンプトはありませんでした');
            }
        }
        catch (error) {
            logger_1.Logger.error('プロンプトの同期に失敗しました', error);
        }
    }
    /**
     * 同期情報の読み込み
     */
    _loadPromptSyncInfo() {
        try {
            const filePath = path.join(this._getConfigDir(), this.PROMPT_SYNC_FILE);
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            logger_1.Logger.error('同期情報の読み込みに失敗しました', error);
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
    _savePromptSyncInfo(syncInfo) {
        try {
            const configDir = this._getConfigDir();
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            const filePath = path.join(configDir, this.PROMPT_SYNC_FILE);
            fs.writeFileSync(filePath, JSON.stringify(syncInfo, null, 2), 'utf8');
        }
        catch (error) {
            logger_1.Logger.error('同期情報の保存に失敗しました', error);
        }
    }
    /**
     * プロンプトをファイルに書き出し
     */
    async _writePromptToFile(prompt, syncDir) {
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
            logger_1.Logger.debug(`プロンプトを保存しました: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`プロンプトのファイル書き出しに失敗しました: ${prompt.id}`, error);
        }
    }
    /**
     * 設定ディレクトリのパスを取得
     */
    _getConfigDir() {
        const homeDir = os.homedir();
        return path.join(homeDir, '.vscode', 'appgenius');
    }
    /**
     * プロンプト同期ディレクトリのパスを取得
     */
    _getPromptSyncDir() {
        return path.join(this._getConfigDir(), 'prompts');
    }
    /**
     * 環境変数情報を取得
     * ClaudeCode CLI用の環境変数として設定する値を取得
     */
    getEnvironmentVariables() {
        const env = {};
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
    async launchWithPrompt(promptId, projectPath) {
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
            await this._apiClient.recordPromptUsage(promptId, prompt.currentVersion || prompt.versionId, 'vscode-extension');
            // ClaudeCodeを起動
            return await this._launcher.launchClaudeCodeWithPrompt(projectPath, promptFilePath, { title: `ClaudeCode - ${prompt.title}` });
        }
        catch (error) {
            logger_1.Logger.error('プロンプト指定のClaudeCode起動に失敗しました', error);
            vscode.window.showErrorMessage(`プロンプト指定のClaudeCode起動に失敗しました: ${error.message}`);
            return false;
        }
    }
    /**
     * ClaudeCodeをインストール
     */
    async installClaudeCode() {
        return await this._launcher.installClaudeCode();
    }
    /**
     * ClaudeCodeが利用可能か確認
     * ユーザーの認証状態・ロール・APIアクセス権限を考慮して判定します
     */
    async isClaudeCodeAvailable() {
        try {
            // 認証状態をチェック
            if (!this._authService.isAuthenticated()) {
                logger_1.Logger.warn('未認証ユーザーはClaudeCodeを利用できません');
                return false;
            }
            // ユーザー情報を取得
            const user = this._authService.getCurrentUser();
            // ユーザー情報がない場合はアクセス不可
            if (!user) {
                logger_1.Logger.warn('ユーザー情報が取得できないためClaudeCodeを利用できません');
                return false;
            }
            // ロールチェック - unsubscribeユーザーはアクセス不可
            if (user.role === 'unsubscribe') {
                logger_1.Logger.warn('退会済みユーザーはClaudeCodeを利用できません');
                return false;
            }
            // APIアクセスチェック - 無効化されている場合はアクセス不可
            if (user.apiAccess && user.apiAccess.enabled === false) {
                logger_1.Logger.warn('APIアクセスが無効化されているユーザーはClaudeCodeを利用できません');
                return false;
            }
            // ClaudeCodeが実際にインストールされているかチェック
            return await this._authSync.isClaudeCodeAvailable();
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode利用可否チェック中にエラーが発生しました', error);
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
    async launchWithPublicUrl(promptUrl, projectPath, additionalContent, splitView, location) {
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
            logger_1.Logger.info(`セキュアな隠しプロンプトファイルを作成します: ${promptFilePath}`);
            // マークダウン形式でプロンプト内容を生成
            let content = `# ${prompt.title}\n\n`;
            if (prompt.description)
                content += `${prompt.description}\n\n`;
            if (prompt.tags && prompt.tags.length > 0)
                content += `タグ: ${prompt.tags.join(', ')}\n`;
            content += `\n---\n\n${prompt.content}`;
            // 追加コンテンツがあれば追加（デバッグ探偵からのエラー情報など）
            if (additionalContent) {
                content += `\n\n${additionalContent}`;
                logger_1.Logger.info('追加コンテンツをプロンプトに追加しました');
            }
            // ファイルに書き込み
            fs.writeFileSync(promptFilePath, content, 'utf8');
            logger_1.Logger.info('セキュアな隠しプロンプトファイルに内容を書き込みました');
            // 使用履歴を記録（可能であれば）
            if (prompt.id) {
                await this._apiClient.recordPromptUsage(prompt.id, '1', 'public-url').catch(err => {
                    // エラーでも処理は続行
                    logger_1.Logger.warn('プロンプト使用履歴の記録に失敗しました', err);
                });
            }
            // 分割表示が指定されている場合はログ出力
            if (splitView) {
                logger_1.Logger.info(`分割表示モードでClaudeCodeを起動します: ${splitView ? 'Enabled' : 'Disabled'}`);
                if (location) {
                    logger_1.Logger.info(`ターミナル表示位置: ${location}`);
                }
            }
            // ClaudeCodeを起動（プロンプトファイル即時削除オプションと分割表示オプション付き）
            return await this._launcher.launchClaudeCodeWithPrompt(projectPath, promptFilePath, {
                title: `ClaudeCode - ${prompt.title}`,
                deletePromptFile: true, // セキュリティ対策としてプロンプトファイルを即時削除
                splitView: splitView, // 分割表示
                location: location // 表示位置
            });
        }
        catch (error) {
            logger_1.Logger.error('公開URLでのClaudeCode起動に失敗しました', error);
            vscode.window.showErrorMessage(`公開URLでのClaudeCode起動に失敗しました: ${error.message}`);
            return false;
        }
    }
    /**
     * URLからプロンプト内容を取得する
     * @param promptUrl プロンプトURL
     * @returns プロンプト内容
     */
    async fetchPromptContent(promptUrl) {
        try {
            const prompt = await this._apiClient.getPromptFromPublicUrl(promptUrl);
            if (!prompt) {
                throw new Error(`URLからプロンプトを取得できませんでした: ${promptUrl}`);
            }
            return prompt.content;
        }
        catch (error) {
            logger_1.Logger.error(`プロンプト内容の取得に失敗しました: ${promptUrl}`, error);
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
    async launchWithSecurityBoundary(guidancePromptUrl, featurePromptUrl, projectPath, additionalContent) {
        try {
            logger_1.Logger.info(`複合プロンプトでClaudeCodeを起動: プロンプト1=${guidancePromptUrl}, プロンプト2=${featurePromptUrl}`);
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
            logger_1.Logger.info(`セキュアな複合プロンプトファイルを作成しました: ${combinedPromptPath}`);
            // ClaudeCodeを起動（プロンプトファイル即時削除オプション付き）
            return await this._launcher.launchClaudeCodeWithPrompt(projectPath, combinedPromptPath, {
                title: 'AIアシスタント',
                deletePromptFile: true // ClaudeCodeLauncherServiceでファイルが読み込まれた後にタイマーベースで削除
            });
        }
        catch (error) {
            logger_1.Logger.error('複合プロンプトでのClaudeCode起動に失敗しました', error);
            vscode.window.showErrorMessage(`AIアシスタントの起動に失敗しました: ${error.message}`);
            return false;
        }
    }
    /**
     * リソースの解放
     */
    dispose() {
        this._stopPromptSync();
        // プロキシサーバーは停止しない（他の機能で使用している可能性があるため）
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }
}
exports.ClaudeCodeIntegrationService = ClaudeCodeIntegrationService;
//# sourceMappingURL=ClaudeCodeIntegrationService.js.map