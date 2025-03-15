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
exports.ClaudeCodePanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ClaudeCodeIntegrationService_1 = require("../../services/ClaudeCodeIntegrationService");
const claudeCodeApiClient_1 = require("../../api/claudeCodeApiClient");
const AuthenticationService_1 = require("../../core/auth/AuthenticationService");
const ProxyManager_1 = require("../../utils/ProxyManager");
const logger_1 = require("../../utils/logger");
/**
 * ClaudeCodePanel - ClaudeCode連携を管理するWebViewパネル
 */
class ClaudeCodePanel {
    /**
     * 現在のパネルインスタンスを取得または新規作成
     */
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // 既存のパネルがある場合はそれを再利用
        if (ClaudeCodePanel.instance) {
            ClaudeCodePanel.instance._panel.reveal(column);
            return ClaudeCodePanel.instance;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(ClaudeCodePanel.viewType, 'ClaudeCode連携', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'webviews', 'claudeCode'),
                vscode.Uri.joinPath(extensionUri, 'media')
            ],
            retainContextWhenHidden: true
        });
        ClaudeCodePanel.instance = new ClaudeCodePanel(panel, extensionUri);
        return ClaudeCodePanel.instance;
    }
    /**
     * コンストラクタ - プライベート（直接インスタンス生成禁止）
     */
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._integrationService = ClaudeCodeIntegrationService_1.ClaudeCodeIntegrationService.getInstance();
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        this._proxyManager = ProxyManager_1.ProxyManager.getInstance();
        // Webviewの内容を設定
        this._update();
        // イベントハンドラーの登録
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // Webviewからのメッセージハンドリング
        this._panel.webview.onDidReceiveMessage(message => {
            this._handleMessage(message);
        }, null, this._disposables);
        // 認証状態の監視
        this._disposables.push(this._authService.onAuthStateChanged(isAuthenticated => {
            this._sendStatusUpdate('authStatus', this._getAuthStatus());
        }));
    }
    /**
     * パネルの内容を更新
     */
    _update() {
        const webview = this._panel.webview;
        // HTMLコンテンツの設定
        webview.html = this._getHtmlForWebview(webview);
        // 初期状態データを送信
        this._sendInitialData();
    }
    /**
     * 初期データ送信
     */
    async _sendInitialData() {
        try {
            // 状態情報を送信
            this._sendStatus();
            // プロンプト一覧を送信
            this._sendPrompts();
        }
        catch (error) {
            logger_1.Logger.error('初期データ送信中にエラーが発生しました', error);
        }
    }
    /**
     * 状態情報を送信
     */
    async _sendStatus() {
        const status = {
            authStatus: this._getAuthStatus(),
            claudeStatus: await this._getClaudeStatus(),
            proxyStatus: this._getProxyStatus(),
            syncStatus: this._getSyncStatus()
        };
        this._panel.webview.postMessage({
            type: 'status',
            data: status
        });
    }
    /**
     * プロンプト一覧送信
     */
    async _sendPrompts() {
        try {
            const prompts = await this._apiClient.getPrompts();
            this._panel.webview.postMessage({
                type: 'prompts',
                data: prompts
            });
        }
        catch (error) {
            logger_1.Logger.error('プロンプト一覧取得中にエラーが発生しました', error);
            this._panel.webview.postMessage({
                type: 'prompts',
                data: []
            });
        }
    }
    /**
     * WebViewからのメッセージハンドリング
     */
    async _handleMessage(message) {
        switch (message.type) {
            case 'getStatus':
                await this._sendStatus();
                break;
            case 'getPrompts':
                await this._sendPrompts();
                break;
            case 'checkInstallation':
                await this._checkInstallation();
                break;
            case 'install':
                await this._installClaudeCode();
                break;
            case 'syncPrompts':
                await this._syncPrompts();
                break;
            case 'openLibrary':
                await this._openPromptLibrary();
                break;
            case 'launchWithPrompt':
                await this._launchWithPrompt();
                break;
            case 'selectPrompt':
                await this._launchWithSelectedPrompt(message.id);
                break;
            case 'updateEnv':
                await this._updateEnvironmentVariables();
                break;
        }
    }
    /**
     * ClaudeCodeインストール確認
     */
    async _checkInstallation() {
        try {
            const isAvailable = await this._integrationService.isClaudeCodeAvailable();
            if (isAvailable) {
                vscode.window.showInformationMessage('ClaudeCodeは正常にインストールされています。');
            }
            else {
                const answer = await vscode.window.showInformationMessage('ClaudeCodeがインストールされていないようです。インストールしますか？', 'インストール', 'キャンセル');
                if (answer === 'インストール') {
                    await this._installClaudeCode();
                }
            }
            // 状態を更新
            this._sendStatusUpdate('claudeStatus', await this._getClaudeStatus());
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCodeインストール確認中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`ClaudeCodeインストール確認中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * ClaudeCodeインストール
     */
    async _installClaudeCode() {
        try {
            const installed = await this._integrationService.installClaudeCode();
            // 状態を更新
            this._sendStatusUpdate('claudeStatus', await this._getClaudeStatus());
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCodeインストール中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`ClaudeCodeインストール中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * プロンプト同期
     */
    async _syncPrompts() {
        try {
            // 認証確認
            if (!this._authService.isAuthenticated()) {
                const answer = await vscode.window.showInformationMessage('この機能を使用するにはログインが必要です。', 'ログイン', 'キャンセル');
                if (answer === 'ログイン') {
                    vscode.commands.executeCommand('appgenius.auth.login');
                }
                return;
            }
            // プログレス表示
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'プロンプトを同期中...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: 'プロンプト情報を取得中...' });
                // 更新情報を取得
                const updates = await this._apiClient.getSyncUpdates();
                progress.report({ increment: 30, message: `${updates.prompts.length}件のプロンプトを同期中...` });
                if (updates.prompts && updates.prompts.length > 0) {
                    // 同期先ディレクトリを確認
                    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
                    const configDir = path.join(homeDir, '.vscode', 'appgenius');
                    const promptDir = path.join(configDir, 'prompts');
                    if (!fs.existsSync(promptDir)) {
                        fs.mkdirSync(promptDir, { recursive: true });
                    }
                    // プロンプトを書き出し
                    for (const prompt of updates.prompts) {
                        const fileName = `${prompt.id.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
                        const filePath = path.join(promptDir, fileName);
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
                    }
                    progress.report({ increment: 40, message: '同期が完了しました' });
                    vscode.window.showInformationMessage(`${updates.prompts.length}件のプロンプトを同期しました。`);
                }
                else {
                    progress.report({ increment: 70, message: '同期するプロンプトはありませんでした' });
                    vscode.window.showInformationMessage('同期するプロンプトはありませんでした。');
                }
            });
            // 同期状態を更新
            this._sendStatusUpdate('syncStatus', this._getSyncStatus(true));
            // プロンプト一覧を更新
            await this._sendPrompts();
        }
        catch (error) {
            logger_1.Logger.error('プロンプト同期中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`プロンプト同期中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * プロンプトライブラリを開く
     */
    async _openPromptLibrary() {
        try {
            // 認証確認
            if (!this._authService.isAuthenticated()) {
                const answer = await vscode.window.showInformationMessage('この機能を使用するにはログインが必要です。', 'ログイン', 'キャンセル');
                if (answer === 'ログイン') {
                    vscode.commands.executeCommand('appgenius.auth.login');
                }
                return;
            }
            // プロンプトディレクトリを確認
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            const configDir = path.join(homeDir, '.vscode', 'appgenius');
            const promptDir = path.join(configDir, 'prompts');
            if (!fs.existsSync(promptDir)) {
                fs.mkdirSync(promptDir, { recursive: true });
            }
            // Explorerでプロンプトディレクトリを開く
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(promptDir));
        }
        catch (error) {
            logger_1.Logger.error('プロンプトライブラリを開く操作中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`プロンプトライブラリを開く操作中にエラーが発生しました: ${error.message}`);
        }
    }
    // プロンプトセレクター関連の機能はここから削除されました
    // プロンプトセレクター関連の機能はここから削除されました
    /**
     * 環境変数を更新
     */
    async _updateEnvironmentVariables() {
        try {
            // プロキシサーバーを起動（まだ起動していなければ）
            const port = await this._proxyManager.startProxyServer();
            // 環境変数を取得
            const envVars = this._integrationService.getEnvironmentVariables();
            // 環境変数を表示
            const formatted = Object.entries(envVars)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            // プレビューで表示
            const doc = await vscode.workspace.openTextDocument({
                language: 'properties',
                content: formatted
            });
            await vscode.window.showTextDocument(doc, { preview: true });
            vscode.window.showInformationMessage('環境変数が表示されました。必要に応じてCLAUDE.mdに追加してください。');
            // プロキシ状態を更新
            this._sendStatusUpdate('proxyStatus', this._getProxyStatus());
        }
        catch (error) {
            logger_1.Logger.error('環境変数の更新中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`環境変数の更新中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * 認証状態情報の取得
     */
    _getAuthStatus() {
        const isAuthenticated = this._authService.isAuthenticated();
        if (isAuthenticated) {
            const user = this._authService.getCurrentUser();
            const displayName = user?.name || user?.email || 'ユーザー';
            return {
                text: `認証済み (${displayName})`,
                icon: '✅',
                status: 'status-success'
            };
        }
        else {
            return {
                text: '未認証',
                icon: '⚠️',
                status: 'status-warning'
            };
        }
    }
    /**
     * ClaudeCode状態情報の取得
     */
    async _getClaudeStatus() {
        try {
            const isAvailable = await this._integrationService.isClaudeCodeAvailable();
            if (isAvailable) {
                return {
                    text: 'インストール済み',
                    icon: '✅',
                    status: 'status-success'
                };
            }
            else {
                return {
                    text: '未インストール',
                    icon: '⚠️',
                    status: 'status-warning'
                };
            }
        }
        catch (error) {
            return {
                text: 'エラー',
                icon: '❌',
                status: 'status-error'
            };
        }
    }
    /**
     * プロキシ状態情報の取得
     */
    _getProxyStatus() {
        const apiProxyUrl = this._proxyManager.getApiProxyEnvValue();
        if (apiProxyUrl) {
            return {
                text: `実行中 (${apiProxyUrl})`,
                icon: '✅',
                status: 'status-success'
            };
        }
        else {
            return {
                text: '停止中',
                icon: '⚠️',
                status: 'status-warning'
            };
        }
    }
    /**
     * 同期状態情報の取得
     */
    _getSyncStatus(justSynced = false) {
        // 認証状態を確認
        const isAuthenticated = this._authService.isAuthenticated();
        if (!isAuthenticated) {
            return {
                text: '未認証',
                icon: '⚠️',
                status: 'status-warning'
            };
        }
        if (justSynced) {
            return {
                text: '同期完了',
                icon: '✅',
                status: 'status-success'
            };
        }
        // 同期ディレクトリの確認
        try {
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            const configDir = path.join(homeDir, '.vscode', 'appgenius');
            const promptDir = path.join(configDir, 'prompts');
            const syncInfoPath = path.join(configDir, 'prompt-sync.json');
            if (fs.existsSync(syncInfoPath)) {
                const syncInfo = JSON.parse(fs.readFileSync(syncInfoPath, 'utf8'));
                const lastSync = new Date(syncInfo.lastSyncTimestamp);
                const now = new Date();
                const diffMs = now.getTime() - lastSync.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                // 24時間以内に同期されていれば良好
                if (diffHours < 24) {
                    return {
                        text: `同期済み (${lastSync.toLocaleDateString()})`,
                        icon: '✅',
                        status: 'status-success'
                    };
                }
                else {
                    return {
                        text: `同期済み (${lastSync.toLocaleDateString()})`,
                        icon: '⚠️',
                        status: 'status-warning'
                    };
                }
            }
            else {
                return {
                    text: '未同期',
                    icon: '⚠️',
                    status: 'status-warning'
                };
            }
        }
        catch (error) {
            return {
                text: '未同期',
                icon: '⚠️',
                status: 'status-warning'
            };
        }
    }
    /**
     * 個別ステータス更新送信
     */
    _sendStatusUpdate(key, value) {
        this._panel.webview.postMessage({
            type: 'statusUpdate',
            data: {
                [key]: value
            }
        });
    }
    /**
     * WebView用HTMLの取得
     */
    _getHtmlForWebview(webview) {
        // WebView内でファイルをロードするためのパスを取得
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'claudeCode', 'script.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'claudeCode', 'style.css'));
        // HTML内で使用するnonce値（セキュリティ対策）
        const nonce = this._getNonce();
        // HTML文字列を返す
        return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <link rel="stylesheet" href="${styleUri}">
      <title>ClaudeCode連携</title>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>ClaudeCode連携</h1>
          <p class="subtitle">VSCode拡張とClaudeCode CLIの連携を管理します</p>
        </header>
  
        <section class="status-panel">
          <h2>システム状態</h2>
          <div class="status-container">
            <div class="status-item">
              <div class="status-icon" id="auth-status-icon">⚪</div>
              <div class="status-text">
                <div class="status-label">認証状況</div>
                <div class="status-value" id="auth-status">確認中...</div>
              </div>
            </div>
            <div class="status-item">
              <div class="status-icon" id="claude-status-icon">⚪</div>
              <div class="status-text">
                <div class="status-label">ClaudeCode</div>
                <div class="status-value" id="claude-status">確認中...</div>
              </div>
            </div>
            <div class="status-item">
              <div class="status-icon" id="proxy-status-icon">⚪</div>
              <div class="status-text">
                <div class="status-label">APIプロキシ</div>
                <div class="status-value" id="proxy-status">確認中...</div>
              </div>
            </div>
            <div class="status-item">
              <div class="status-icon" id="sync-status-icon">⚪</div>
              <div class="status-text">
                <div class="status-label">プロンプト同期</div>
                <div class="status-value" id="sync-status">確認中...</div>
              </div>
            </div>
          </div>
        </section>
  
        <section class="prompt-section">
          <h2>プロンプトライブラリ</h2>
          <div class="tools-bar">
            <button id="sync-prompts-btn" class="primary-btn">プロンプトを同期</button>
            <button id="open-library-btn" class="secondary-btn">ライブラリを開く</button>
          </div>
          <div class="prompts-container">
            <div class="prompts-list" id="prompts-list">
              <div class="loading">読み込み中...</div>
            </div>
          </div>
        </section>
  
        <section class="actions-section">
          <h2>機能</h2>
          <div class="action-buttons">
            <button id="check-claude-btn" class="action-btn">
              <span class="action-icon">🔍</span>
              <span class="action-text">ClaudeCodeを確認</span>
            </button>
            <button id="install-claude-btn" class="action-btn">
              <span class="action-icon">📥</span>
              <span class="action-text">ClaudeCodeをインストール</span>
            </button>
            <button id="launch-prompt-btn" class="action-btn">
              <span class="action-icon">▶️</span>
              <span class="action-text">プロンプトで起動</span>
            </button>
            <button id="update-env-btn" class="action-btn">
              <span class="action-icon">🔄</span>
              <span class="action-text">環境変数を更新</span>
            </button>
          </div>
        </section>
  
        <section class="help-section">
          <h2>ヘルプ</h2>
          <div class="help-accordion">
            <div class="accordion-item">
              <div class="accordion-header">ClaudeCode連携とは？</div>
              <div class="accordion-content">
                <p>
                  ClaudeCode連携により、VSCode内で編集した設計情報やスコープ定義をもとに、
                  ClaudeCode CLIでスムーズに実装作業を進めることができます。
                  認証情報やプロンプトライブラリの共有、APIプロキシ機能を提供します。
                </p>
              </div>
            </div>
            <div class="accordion-item">
              <div class="accordion-header">プロンプトライブラリの使い方</div>
              <div class="accordion-content">
                <p>
                  プロンプトライブラリを使うと、よく使うAIプロンプトを管理・共有できます。
                  「プロンプトを同期」ボタンをクリックして最新のプロンプトを取得し、
                  「プロンプトで起動」ボタンを使ってClaudeCodeを特定のプロンプトで起動できます。
                </p>
              </div>
            </div>
            <div class="accordion-item">
              <div class="accordion-header">連携のトラブルシューティング</div>
              <div class="accordion-content">
                <p>
                  連携に問題がある場合は以下を確認してください：
                </p>
                <ul>
                  <li>VSCode拡張とPortalサービスが正しく認証されているか</li>
                  <li>ClaudeCode CLIがインストールされ、正しくPATHに設定されているか</li>
                  <li>必要な環境変数が設定されているか</li>
                  <li>ネットワーク接続が正常か</li>
                </ul>
                <p>
                  「ClaudeCodeを確認」ボタンをクリックして状態を診断できます。
                </p>
              </div>
            </div>
          </div>
        </section>
  
        <footer>
          <p>AppGenius AI - ClaudeCode連携</p>
        </footer>
      </div>
  
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
      </script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
    }
    /**
     * nonce値生成（セキュリティ対策）
     */
    _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    /**
     * リソース解放
     */
    dispose() {
        ClaudeCodePanel.instance = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.ClaudeCodePanel = ClaudeCodePanel;
ClaudeCodePanel.viewType = 'appgenius.claudeCode';
//# sourceMappingURL=ClaudeCodePanel.js.map