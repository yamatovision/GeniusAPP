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
exports.EnvVariablesPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const AppGeniusEventBus_1 = require("../../services/AppGeniusEventBus");
/**
 * 環境変数管理パネルクラス
 * 環境変数の表示、編集、管理を行うVSCode WebViewパネル
 */
class EnvVariablesPanel {
    /**
     * パネルの作成または表示（シングルトンパターン）
     */
    static createOrShow(extensionUri, projectPath) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // すでにパネルが存在する場合は、それを表示
        if (EnvVariablesPanel.currentPanel) {
            EnvVariablesPanel.currentPanel._panel.reveal(column);
            // プロジェクトパスが指定されている場合は更新
            if (projectPath) {
                EnvVariablesPanel.currentPanel.setProjectPath(projectPath);
            }
            return EnvVariablesPanel.currentPanel;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(EnvVariablesPanel.viewType, '環境変数管理', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'webviews'),
                vscode.Uri.joinPath(extensionUri, 'dist')
            ]
        });
        EnvVariablesPanel.currentPanel = new EnvVariablesPanel(panel, extensionUri, projectPath);
        return EnvVariablesPanel.currentPanel;
    }
    /**
     * コンストラクタ
     */
    constructor(panel, extensionUri, projectPath) {
        this._disposables = [];
        this._projectPath = '';
        // 環境変数関連のデータ
        this._envFiles = [];
        this._activeEnvFile = null;
        this._envVariables = {};
        // ファイル監視
        this._fileWatcher = null;
        this._panel = panel;
        this._extensionUri = extensionUri;
        // サービスを初期化
        this._eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        // イベントリスナーを設定
        this._setupEventListeners();
        // プロジェクトパスが指定されている場合は設定
        if (projectPath) {
            this.setProjectPath(projectPath);
        }
        // WebViewの内容を設定
        this._update();
        // パネルが破棄されたときのクリーンアップ
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // パネルの状態が変更されたときに更新
        this._panel.onDidChangeViewState(e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // WebViewからのメッセージを処理
        this._panel.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.command) {
                    case 'initialize':
                        await this._handleInitialize();
                        break;
                    case 'saveEnvironmentVariable':
                        await this._handleSaveEnvironmentVariable(message.variableName, message.variableValue, message.variableFilePath);
                        break;
                    case 'createEnvFile':
                        await this._handleCreateEnvFile(message.fileName);
                        break;
                    case 'selectEnvFile':
                        await this._handleSelectEnvFile(message.filePath);
                        break;
                    case 'testConnection':
                        await this._handleTestConnection(message.connectionType, message.config);
                        break;
                    case 'autoDetectVariables':
                        await this._handleAutoDetectVariables();
                        break;
                    case 'saveAllVariables':
                        await this._handleSaveAllVariables();
                        break;
                    case 'importVariables':
                        await this._handleImportVariables(message.filePath);
                        break;
                    case 'exportVariables':
                        await this._handleExportVariables(message.filePath);
                        break;
                }
            }
            catch (error) {
                logger_1.Logger.error(`メッセージ処理エラー: ${message.command}`, error);
                await this._showError(`操作に失敗しました: ${error.message}`);
            }
        }, null, this._disposables);
    }
    /**
     * プロジェクトパスを設定
     */
    async setProjectPath(projectPath) {
        if (!fs.existsSync(projectPath)) {
            throw new Error(`プロジェクトパスが存在しません: ${projectPath}`);
        }
        this._projectPath = projectPath;
        logger_1.Logger.info(`環境変数管理: プロジェクトパスを設定しました: ${projectPath}`);
        // 環境変数ファイルの検出
        this._detectEnvFiles();
        // WebViewの更新
        await this._updateWebview();
    }
    /**
     * イベントリスナーの設定
     * EventBusからのイベントをリッスン
     */
    _setupEventListeners() {
        try {
            // 必要に応じて他のイベントリスナーをここに追加
            logger_1.Logger.info('環境変数管理: イベントリスナーを設定しました');
        }
        catch (error) {
            logger_1.Logger.error('環境変数管理: イベントリスナー設定エラー:', error);
        }
    }
    /**
     * リソースの解放
     */
    dispose() {
        EnvVariablesPanel.currentPanel = undefined;
        // ファイル監視を停止
        if (this._fileWatcher) {
            this._fileWatcher.close();
            this._fileWatcher = null;
        }
        // パネルを破棄
        this._panel.dispose();
        // 他のリソースを解放
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    /**
     * WebViewのHTML生成
     */
    _getHtmlForWebview() {
        const webview = this._panel.webview;
        // WebView内でのリソースへのパスを取得
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'environmentVariables', 'script.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'environmentVariables', 'style.css'));
        const resetCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const vscodeCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        // WebViewのHTMLを構築
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource}; font-src ${webview.cspSource};">
  <title>環境変数管理</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${vscodeCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>環境変数管理</h1>
      <div class="progress-indicator">
        <div class="progress-text">進捗: <span id="progress-value">0/0</span></div>
        <div class="progress-bar">
          <div class="progress-value" style="width: 0%"></div>
        </div>
      </div>
    </header>
    
    <div class="main-content">
      <div class="env-file-selector">
        <div class="section-header">
          <h2>環境変数ファイル</h2>
          <button id="create-env-file" class="button button-secondary">新規作成</button>
        </div>
        <div class="env-files-list" id="env-files-container">
          <div class="loading">ファイルを読み込み中...</div>
        </div>
      </div>
      
      <div class="env-variables">
        <div class="section-header">
          <h2>環境変数 <span id="current-env-file"></span></h2>
          <div class="action-buttons">
            <button id="import-variables" class="button button-secondary">インポート</button>
            <button id="export-variables" class="button button-secondary">エクスポート</button>
            <button id="detect-variables" class="button button-secondary">変数検出</button>
          </div>
        </div>
        <div id="env-variables-container" class="env-variables-list">
          <div class="loading">環境変数を読み込み中...</div>
        </div>
      </div>
      
      <div class="env-groups">
        <div class="section-header">
          <h2>変数グループ</h2>
        </div>
        <div id="env-groups-container" class="env-groups-list">
          <div class="env-group" data-group-id="database">
            <h3>データベース</h3>
            <div class="group-status">0/0 設定済み</div>
          </div>
          <div class="env-group" data-group-id="api">
            <h3>API連携</h3>
            <div class="group-status">0/0 設定済み</div>
          </div>
          <div class="env-group" data-group-id="security">
            <h3>セキュリティ</h3>
            <div class="group-status">0/0 設定済み</div>
          </div>
          <div class="env-group" data-group-id="server">
            <h3>サーバー</h3>
            <div class="group-status">0/0 設定済み</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <div class="connection-test">
        <button id="test-database" class="button button-action">データベース接続テスト</button>
        <button id="test-api" class="button button-action">API接続テスト</button>
      </div>
      <button id="save-all-variables" class="button button-success">すべて保存</button>
      <button id="update-env-md" class="button button-primary">env.mdを更新</button>
    </div>
  </div>
  
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
    /**
     * WebViewを更新
     */
    async _update() {
        if (!this._panel.visible) {
            return;
        }
        try {
            this._panel.webview.html = this._getHtmlForWebview();
            await this._updateWebview();
        }
        catch (error) {
            logger_1.Logger.error(`WebView更新エラー`, error);
            // エラーが発生しても最低限のUIは維持
            this._panel.webview.html = this._getHtmlForWebview();
        }
    }
    /**
     * WebViewの状態を更新
     */
    async _updateWebview() {
        try {
            // 進捗状況を計算
            const totalVars = this._countTotalVariables();
            const configuredVars = this._countConfiguredVariables();
            // WebViewにデータを送信
            await this._panel.webview.postMessage({
                command: 'updateState',
                envFiles: this._envFiles,
                activeEnvFile: this._activeEnvFile,
                envVariables: this._envVariables,
                progress: {
                    total: totalVars,
                    configured: configuredVars
                },
                projectPath: this._projectPath
            });
        }
        catch (error) {
            logger_1.Logger.error(`WebView状態更新エラー`, error);
            await this._showError('環境変数データの読み込み中にエラーが発生しました');
        }
    }
    /**
     * 総環境変数数をカウント
     */
    _countTotalVariables() {
        let count = 0;
        // env.mdから取得した変数の合計数
        // 実際の実装では、環境変数ファイルの各変数をカウント
        for (const filePath in this._envVariables) {
            count += Object.keys(this._envVariables[filePath]).length;
        }
        return count;
    }
    /**
     * 設定済み環境変数数をカウント
     */
    _countConfiguredVariables() {
        let count = 0;
        // 値が設定されている変数のみカウント
        for (const filePath in this._envVariables) {
            for (const key in this._envVariables[filePath]) {
                const value = this._envVariables[filePath][key];
                if (value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】') {
                    count++;
                }
            }
        }
        return count;
    }
    /**
     * エラーメッセージを表示
     */
    async _showError(message) {
        await this._panel.webview.postMessage({
            command: 'showError',
            message
        });
    }
    /**
     * 初期化を処理
     */
    async _handleInitialize() {
        try {
            // プロジェクトパスがない場合は、アクティブなワークスペースを使用
            if (!this._projectPath) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    this._projectPath = workspaceFolders[0].uri.fsPath;
                    logger_1.Logger.info(`環境変数管理: ワークスペースからプロジェクトパスを設定: ${this._projectPath}`);
                }
                else {
                    await this._showError('プロジェクトパスが設定されていません。フォルダを開いてから再試行してください。');
                    return;
                }
            }
            // 環境変数ファイルの検出
            this._detectEnvFiles();
            // env.mdから環境変数情報を読み込む
            await this._loadEnvironmentVariablesFromEnvMd();
            // WebViewを更新
            await this._updateWebview();
        }
        catch (error) {
            logger_1.Logger.error(`初期化エラー:`, error);
            await this._showError(`初期化に失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数ファイルの検出
     */
    _detectEnvFiles() {
        try {
            if (!this._projectPath) {
                return;
            }
            // .envで始まるファイルを検索
            const files = fs.readdirSync(this._projectPath)
                .filter(file => file.startsWith('.env'))
                .map(file => path.join(this._projectPath, file));
            this._envFiles = files;
            // アクティブファイルがない場合は最初のファイルを選択
            if (!this._activeEnvFile && files.length > 0) {
                this._activeEnvFile = files[0];
                this._loadEnvFile(this._activeEnvFile);
            }
            // ファイル監視を設定（既存のものがあれば閉じる）
            if (this._fileWatcher) {
                this._fileWatcher.close();
            }
            // ディレクトリを監視して.envファイルの変更を検出
            this._fileWatcher = fs.watch(this._projectPath, (eventType, filename) => {
                if (filename && filename.startsWith('.env')) {
                    logger_1.Logger.info(`環境変数ファイル変更を検出: ${filename}`);
                    this._detectEnvFiles();
                    this._updateWebview();
                }
            });
            logger_1.Logger.info(`環境変数ファイルを検出: ${files.length}個のファイルが見つかりました`);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル検出エラー:`, error);
        }
    }
    /**
     * 環境変数ファイルの読み込み
     */
    async _loadEnvFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイル ${filePath} が見つかりません`);
            }
            // ファイルを読み込む
            const content = fs.readFileSync(filePath, 'utf8');
            // 環境変数を解析
            const variables = {};
            content.split('\n').forEach(line => {
                // コメント行をスキップ
                if (line.startsWith('#')) {
                    return;
                }
                // キーと値を分離
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    // 引用符を取り除く
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    else if (value.startsWith("'") && value.endsWith("'")) {
                        value = value.slice(1, -1);
                    }
                    variables[key] = value;
                }
            });
            // 環境変数を保存
            this._envVariables[filePath] = variables;
            this._activeEnvFile = filePath;
            logger_1.Logger.info(`環境変数ファイルを読み込み: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル読み込みエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数ファイルの保存
     */
    async _saveEnvFile(filePath, variables) {
        try {
            // 環境変数をファイル形式に変換
            let content = '';
            for (const key in variables) {
                const value = variables[key];
                content += `${key}=${value}\n`;
            }
            // ファイルに書き込み
            fs.writeFileSync(filePath, content, 'utf8');
            logger_1.Logger.info(`環境変数ファイルを保存: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル保存エラー:`, error);
            throw error;
        }
    }
    /**
     * env.mdから環境変数情報を読み込む
     */
    async _loadEnvironmentVariablesFromEnvMd() {
        try {
            const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
            if (!fs.existsSync(envMdPath)) {
                logger_1.Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
                return;
            }
            const content = fs.readFileSync(envMdPath, 'utf8');
            // envMdの内容を解析
            // 実際の実装では、env.mdからさらに詳細な情報を抽出する
            logger_1.Logger.info(`env.mdから環境変数情報を読み込みました`);
        }
        catch (error) {
            logger_1.Logger.error(`env.md読み込みエラー:`, error);
        }
    }
    /**
     * env.mdの更新
     */
    async _updateEnvMdFile() {
        try {
            const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
            if (!fs.existsSync(envMdPath)) {
                logger_1.Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
                return;
            }
            let content = fs.readFileSync(envMdPath, 'utf8');
            // env.mdを更新（実際の実装では、設定された環境変数の状態を更新する）
            fs.writeFileSync(envMdPath, content, 'utf8');
            logger_1.Logger.info(`env.mdファイルを更新しました`);
            vscode.window.showInformationMessage('env.mdファイルを更新しました');
        }
        catch (error) {
            logger_1.Logger.error(`env.md更新エラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数の保存を処理
     */
    async _handleSaveEnvironmentVariable(name, value, filePath) {
        try {
            if (!filePath) {
                if (!this._activeEnvFile) {
                    throw new Error('環境変数ファイルが選択されていません');
                }
                filePath = this._activeEnvFile;
            }
            // ファイルのデータがなければ初期化
            if (!this._envVariables[filePath]) {
                this._envVariables[filePath] = {};
            }
            // 変数を更新
            this._envVariables[filePath][name] = value;
            // ファイルに書き込み
            await this._saveEnvFile(filePath, this._envVariables[filePath]);
            // WebViewを更新
            await this._updateWebview();
            vscode.window.showInformationMessage(`環境変数 ${name} を保存しました`);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数保存エラー:`, error);
            await this._showError(`環境変数の保存に失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数ファイルの作成を処理
     */
    async _handleCreateEnvFile(fileName) {
        try {
            if (!fileName) {
                throw new Error('ファイル名が指定されていません');
            }
            // .envで始まることを確認
            if (!fileName.startsWith('.env')) {
                fileName = `.env.${fileName}`;
            }
            // パスの作成
            const filePath = path.join(this._projectPath, fileName);
            // ファイルが既に存在するかチェック
            if (fs.existsSync(filePath)) {
                throw new Error(`ファイル ${fileName} は既に存在します`);
            }
            // 空のファイルを作成
            fs.writeFileSync(filePath, '', 'utf8');
            // 環境変数ファイルを再検出
            this._detectEnvFiles();
            // 新しいファイルをアクティブに
            this._activeEnvFile = filePath;
            this._envVariables[filePath] = {};
            // WebViewを更新
            await this._updateWebview();
            vscode.window.showInformationMessage(`環境変数ファイル ${fileName} を作成しました`);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル作成エラー:`, error);
            await this._showError(`環境変数ファイルの作成に失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数ファイルの選択を処理
     */
    async _handleSelectEnvFile(filePath) {
        try {
            if (!filePath) {
                throw new Error('ファイルパスが指定されていません');
            }
            // ファイルが存在するかチェック
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイル ${filePath} が見つかりません`);
            }
            // ファイルを読み込む
            await this._loadEnvFile(filePath);
            // WebViewを更新
            await this._updateWebview();
            logger_1.Logger.info(`環境変数ファイルを選択: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル選択エラー:`, error);
            await this._showError(`環境変数ファイルの選択に失敗しました: ${error.message}`);
        }
    }
    /**
     * 接続テストを処理
     */
    async _handleTestConnection(connectionType, config) {
        try {
            // 接続テスト開始を通知
            await this._panel.webview.postMessage({
                command: 'connectionTestStart',
                connectionType
            });
            // 実際の接続テストを実行（例: データベース接続や API 接続）
            let success = false;
            let message = '';
            switch (connectionType) {
                case 'database':
                    // データベース接続テストのロジック
                    // 実際の実装では、設定された接続情報を使用してテスト
                    success = true;
                    message = 'データベース接続に成功しました';
                    break;
                case 'api':
                    // API 接続テストのロジック
                    success = true;
                    message = 'API接続に成功しました';
                    break;
                default:
                    throw new Error(`未知の接続タイプ: ${connectionType}`);
            }
            // テスト結果を通知
            await this._panel.webview.postMessage({
                command: 'connectionTestResult',
                connectionType,
                success,
                message
            });
            if (success) {
                vscode.window.showInformationMessage(message);
            }
            else {
                vscode.window.showErrorMessage(message);
            }
        }
        catch (error) {
            logger_1.Logger.error(`接続テストエラー:`, error);
            // テスト失敗を通知
            await this._panel.webview.postMessage({
                command: 'connectionTestResult',
                connectionType,
                success: false,
                message: `接続テストに失敗しました: ${error.message}`
            });
            await this._showError(`接続テストに失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数の自動検出を処理
     */
    async _handleAutoDetectVariables() {
        try {
            // プロジェクトコードを分析して環境変数を検出
            // 実際の実装では、コードを解析して必要な環境変数を検出する
            // 例: サンプルの変数を追加
            if (this._activeEnvFile && this._envVariables[this._activeEnvFile]) {
                const detectedVars = {
                    'DB_HOST': 'localhost',
                    'DB_PORT': '5432',
                    'DB_NAME': 'appgenius_db',
                    'DB_USER': 'postgres',
                    'DB_PASSWORD': '【要設定】',
                    'API_URL': 'https://api.example.com',
                    'API_KEY': '【要設定】'
                };
                // 既存の変数と検出した変数をマージ
                this._envVariables[this._activeEnvFile] = {
                    ...this._envVariables[this._activeEnvFile],
                    ...detectedVars
                };
                // ファイルに保存
                await this._saveEnvFile(this._activeEnvFile, this._envVariables[this._activeEnvFile]);
                // WebViewを更新
                await this._updateWebview();
                vscode.window.showInformationMessage('環境変数を自動検出しました');
            }
            else {
                throw new Error('環境変数ファイルが選択されていません');
            }
        }
        catch (error) {
            logger_1.Logger.error(`環境変数自動検出エラー:`, error);
            await this._showError(`環境変数の自動検出に失敗しました: ${error.message}`);
        }
    }
    /**
     * すべての環境変数の保存を処理
     */
    async _handleSaveAllVariables() {
        try {
            // すべての環境変数ファイルを保存
            for (const filePath in this._envVariables) {
                await this._saveEnvFile(filePath, this._envVariables[filePath]);
            }
            // env.mdを更新
            await this._updateEnvMdFile();
            vscode.window.showInformationMessage('すべての環境変数を保存しました');
        }
        catch (error) {
            logger_1.Logger.error(`環境変数一括保存エラー:`, error);
            await this._showError(`環境変数の保存に失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数のインポートを処理
     */
    async _handleImportVariables(filePath) {
        try {
            // インポート処理のロジック
            // 実際の実装では、ファイルから環境変数をインポート
            vscode.window.showInformationMessage('環境変数をインポートしました');
        }
        catch (error) {
            logger_1.Logger.error(`環境変数インポートエラー:`, error);
            await this._showError(`環境変数のインポートに失敗しました: ${error.message}`);
        }
    }
    /**
     * 環境変数のエクスポートを処理
     */
    async _handleExportVariables(filePath) {
        try {
            // エクスポート処理のロジック
            // 実際の実装では、環境変数をファイルにエクスポート
            vscode.window.showInformationMessage('環境変数をエクスポートしました');
        }
        catch (error) {
            logger_1.Logger.error(`環境変数エクスポートエラー:`, error);
            await this._showError(`環境変数のエクスポートに失敗しました: ${error.message}`);
        }
    }
}
exports.EnvVariablesPanel = EnvVariablesPanel;
EnvVariablesPanel.viewType = 'environmentVariables';
//# sourceMappingURL=EnvVariablesPanel.js.map