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
exports.DebugDetectivePanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const AppGeniusEventBus_1 = require("../../services/AppGeniusEventBus");
const ClaudeCodeLauncherService_1 = require("../../services/ClaudeCodeLauncherService");
const ErrorSessionManager_1 = require("./ErrorSessionManager");
const KnowledgeBaseManager_1 = require("./KnowledgeBaseManager");
/**
 * デバッグ探偵パネル
 * エラー検出と解決を支援するシャーロックホームズ風デバッグアシスタント
 */
class DebugDetectivePanel {
    /**
     * パネルを作成または表示
     */
    static createOrShow(extensionUri, projectPath, projectId) {
        try {
            logger_1.Logger.info(`デバッグ探偵パネル作成開始: projectPath=${projectPath}, projectId=${projectId || 'なし'}`);
            // プロジェクトパスのチェック
            if (!projectPath || projectPath.trim() === '') {
                logger_1.Logger.error('プロジェクトパスが指定されていません');
                vscode.window.showErrorMessage('プロジェクトパスが指定されていません。プロジェクトを選択してください。');
                throw new Error('プロジェクトパスが指定されていません');
            }
            // 注意：中央サーバーのプロンプトURLを使用するため、ローカルファイルの存在チェックは警告のみ
            const debugPromptPath = path.join(projectPath, 'docs', 'prompts', 'debug_detective.md');
            if (!fs.existsSync(debugPromptPath)) {
                logger_1.Logger.warn(`ローカルデバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
                // 警告メッセージは表示しない（中央サーバーのプロンプトを使用するため）
            }
            const column = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn
                : undefined;
            // すでにパネルが存在する場合は、それを表示
            if (DebugDetectivePanel.currentPanel) {
                logger_1.Logger.info('既存のデバッグ探偵パネルを再表示します');
                DebugDetectivePanel.currentPanel._panel.reveal(column);
                // プロジェクトパスが変わっていれば更新
                if (projectPath && DebugDetectivePanel.currentPanel._projectPath !== projectPath) {
                    logger_1.Logger.info(`プロジェクトパスを更新します: ${projectPath}`);
                    DebugDetectivePanel.currentPanel._projectPath = projectPath;
                    DebugDetectivePanel.currentPanel._update();
                }
                return DebugDetectivePanel.currentPanel;
            }
            logger_1.Logger.info('新しいデバッグ探偵パネルを作成します');
            // 新しいパネルを作成
            const panel = vscode.window.createWebviewPanel(DebugDetectivePanel.viewType, 'デバッグ探偵 - シャーロックホームズ', column || vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'dist')
                ],
                enableFindWidget: true,
                enableCommandUris: true
            });
            logger_1.Logger.info('デバッグ探偵インスタンスを初期化します');
            try {
                DebugDetectivePanel.currentPanel = new DebugDetectivePanel(panel, extensionUri, projectPath, projectId);
                logger_1.Logger.info('デバッグ探偵パネル作成完了');
                return DebugDetectivePanel.currentPanel;
            }
            catch (error) {
                // パネルの初期化に失敗した場合、パネルを破棄
                panel.dispose();
                logger_1.Logger.error('デバッグ探偵インスタンスの初期化に失敗しました', error);
                throw error;
            }
        }
        catch (error) {
            logger_1.Logger.error('デバッグ探偵パネル作成エラー', error);
            logger_1.Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
            vscode.window.showErrorMessage(`デバッグ探偵パネルの作成に失敗しました: ${error.message}`);
            throw error;
        }
    }
    /**
     * コンストラクタ
     */
    constructor(panel, extensionUri, projectPath, projectId) {
        this._disposables = [];
        // 作業状態
        this._projectPath = '';
        this._currentProjectId = ''; // プロジェクトID追加
        this._currentErrorSession = null;
        this._relatedFiles = [];
        this._detectedErrorType = '';
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._projectPath = projectPath;
        this._currentProjectId = projectId || '';
        // サービスの初期化
        this._eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        this._errorSessionManager = new ErrorSessionManager_1.ErrorSessionManager(projectPath);
        this._knowledgeBaseManager = new KnowledgeBaseManager_1.KnowledgeBaseManager(projectPath);
        this._claudeCodeLauncher = ClaudeCodeLauncherService_1.ClaudeCodeLauncherService.getInstance();
        // 初期化処理
        this._initializeDebugDetective();
        // WebViewの内容を設定
        this._update();
        // パネルが破棄されたときのクリーンアップ
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // パネルの状態が変更されたときに更新
        this._panel.onDidChangeViewState(_e => {
            if (this._panel.visible) {
                this._update();
            }
        }, null, this._disposables);
        // WebViewからのメッセージを処理
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'investigateError':
                    await this._handleInvestigateError(message.errorLog);
                    break;
                case 'getErrorSessions':
                    await this._handleGetErrorSessions();
                    break;
                case 'saveTerminalOutput':
                    await this._handleSaveTerminalOutput();
                    break;
                case 'detectErrorType':
                    await this._handleDetectErrorType(message.errorLog);
                    break;
            }
        }, null, this._disposables);
        // プロジェクトパス更新イベントをリッスン
        this._disposables.push(this._eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_PATH_UPDATED, async (event) => {
            if (event.data && this._currentProjectId && event.projectId === this._currentProjectId) {
                const newPath = event.data.projectPath;
                logger_1.Logger.info(`プロジェクトパスが更新されました: ${newPath}`);
                // パスが実際に変更された場合のみ更新処理
                if (newPath && this._projectPath !== newPath) {
                    logger_1.Logger.debug(`デバッグ探偵パネルのプロジェクトパスを更新: ${this._projectPath} → ${newPath}`);
                    this._projectPath = newPath;
                    // 各マネージャーのパスも更新
                    this._errorSessionManager.updateProjectPath(newPath);
                    this._knowledgeBaseManager.updateProjectPath(newPath);
                    // UIを更新
                    this._update();
                }
            }
        }));
    }
    /**
     * デバッグ探偵初期化
     */
    async _initializeDebugDetective() {
        try {
            logger_1.Logger.info(`デバッグ探偵の初期化を開始します。プロジェクトパス: ${this._projectPath}`);
            // プロジェクトパスの検証
            if (!this._projectPath || this._projectPath.trim() === '') {
                throw new Error('プロジェクトパスが指定されていません');
            }
            logger_1.Logger.info('ログディレクトリの作成を開始します');
            // ログディレクトリの作成
            await this._ensureDebugDirectories();
            logger_1.Logger.info('エラーセッションマネージャーの初期化を開始します');
            // エラーセッション初期化
            await this._errorSessionManager.initialize();
            logger_1.Logger.info('知見ベースマネージャーの初期化を開始します');
            // 知見ベース初期化
            await this._knowledgeBaseManager.initialize();
            // デバッグプロンプトファイルの存在を確認（フォールバック用）
            const debugPromptPath = path.join(this._projectPath, 'docs', 'prompts', 'debug_detective.md');
            logger_1.Logger.info(`ローカルデバッグプロンプトファイルをチェックします（フォールバック用）: ${debugPromptPath}`);
            if (!fs.existsSync(debugPromptPath)) {
                logger_1.Logger.warn(`ローカルデバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
                // 警告メッセージは表示しない（中央サーバーのプロンプトを使用するため）
            }
            else {
                logger_1.Logger.info(`ローカルデバッグプロンプトファイルを確認しました（フォールバック用）: ${debugPromptPath}`);
            }
            // 中央サーバーのデバッグ探偵プロンプトURLをチェック
            logger_1.Logger.info(`中央サーバーのデバッグ探偵プロンプトURLを使用します: http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09`);
            logger_1.Logger.info(`デバッグ探偵を初期化しました。プロジェクトパス: ${this._projectPath}`);
        }
        catch (error) {
            logger_1.Logger.error('デバッグ探偵初期化エラー', error);
            logger_1.Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
            vscode.window.showErrorMessage(`デバッグ探偵の初期化に失敗しました: ${error.message}`);
            // エラーを再スローして呼び出し元でも検知できるようにする
            throw error;
        }
    }
    /**
     * デバッグディレクトリの作成
     */
    async _ensureDebugDirectories() {
        try {
            logger_1.Logger.info(`デバッグディレクトリの作成を開始します: プロジェクトパス=${this._projectPath}`);
            // logs/debugディレクトリの作成
            const logsPath = path.join(this._projectPath, 'logs');
            const debugPath = path.join(logsPath, 'debug');
            const sessionsPath = path.join(debugPath, 'sessions');
            const archivedPath = path.join(debugPath, 'archived');
            const knowledgePath = path.join(debugPath, 'knowledge');
            logger_1.Logger.info(`logsPathを作成します: ${logsPath}`);
            if (!fs.existsSync(logsPath)) {
                fs.mkdirSync(logsPath, { recursive: true });
                logger_1.Logger.info(`logsPathを新規作成しました: ${logsPath}`);
            }
            else {
                logger_1.Logger.info(`logsPathは既に存在します: ${logsPath}`);
            }
            logger_1.Logger.info(`debugPathを作成します: ${debugPath}`);
            if (!fs.existsSync(debugPath)) {
                fs.mkdirSync(debugPath, { recursive: true });
                logger_1.Logger.info(`debugPathを新規作成しました: ${debugPath}`);
            }
            else {
                logger_1.Logger.info(`debugPathは既に存在します: ${debugPath}`);
            }
            logger_1.Logger.info(`sessionsPathを作成します: ${sessionsPath}`);
            if (!fs.existsSync(sessionsPath)) {
                fs.mkdirSync(sessionsPath, { recursive: true });
                logger_1.Logger.info(`sessionsPathを新規作成しました: ${sessionsPath}`);
            }
            else {
                logger_1.Logger.info(`sessionsPathは既に存在します: ${sessionsPath}`);
            }
            logger_1.Logger.info(`archivedPathを作成します: ${archivedPath}`);
            if (!fs.existsSync(archivedPath)) {
                fs.mkdirSync(archivedPath, { recursive: true });
                logger_1.Logger.info(`archivedPathを新規作成しました: ${archivedPath}`);
            }
            else {
                logger_1.Logger.info(`archivedPathは既に存在します: ${archivedPath}`);
            }
            logger_1.Logger.info(`knowledgePathを作成します: ${knowledgePath}`);
            if (!fs.existsSync(knowledgePath)) {
                fs.mkdirSync(knowledgePath, { recursive: true });
                logger_1.Logger.info(`knowledgePathを新規作成しました: ${knowledgePath}`);
            }
            else {
                logger_1.Logger.info(`knowledgePathは既に存在します: ${knowledgePath}`);
            }
            // ディレクトリが正しく作成されたか確認
            const dirs = [logsPath, debugPath, sessionsPath, archivedPath, knowledgePath];
            for (const dir of dirs) {
                if (!fs.existsSync(dir)) {
                    throw new Error(`ディレクトリの作成に失敗しました: ${dir}`);
                }
            }
            // .gitkeepファイルを作成して空ディレクトリをgitで追跡できるようにする
            fs.writeFileSync(path.join(sessionsPath, '.gitkeep'), '', 'utf8');
            fs.writeFileSync(path.join(archivedPath, '.gitkeep'), '', 'utf8');
            fs.writeFileSync(path.join(knowledgePath, '.gitkeep'), '', 'utf8');
            logger_1.Logger.info(`デバッグディレクトリを作成しました: ${debugPath}`);
        }
        catch (error) {
            logger_1.Logger.error('デバッグディレクトリ作成エラー', error);
            throw error;
        }
    }
    /**
     * エラーの調査依頼処理
     */
    async _handleInvestigateError(errorLog) {
        try {
            if (!errorLog || errorLog.trim() === '') {
                throw new Error('エラーログが空です');
            }
            // エラーセッションを作成
            const sessionId = await this._errorSessionManager.createSession(errorLog);
            // エラーの種類を検出
            const errorType = await this._detectErrorType(errorLog);
            // 関連ファイルを自動検出
            const detectedFiles = await this._detectRelatedFiles(errorLog);
            // エラーセッション情報を更新
            await this._errorSessionManager.updateSession(sessionId, {
                errorType,
                relatedFiles: detectedFiles,
                status: 'investigating',
                investigationStartTime: new Date().toISOString()
            });
            // 現在のセッションを更新
            this._currentErrorSession = await this._errorSessionManager.getSession(sessionId);
            this._relatedFiles = detectedFiles;
            this._detectedErrorType = errorType;
            logger_1.Logger.info(`エラーセッションを作成しました: ${sessionId}`);
            // 実際のファイル内容を読み込み
            const relatedFilesContent = await this._loadRelatedFilesContent(detectedFiles);
            // エラー情報とファイル内容を結合したプロンプトを作成
            const tempDir = path.join(this._projectPath, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const combinedPromptPath = path.join(tempDir, `combined_debug_${Date.now()}.md`);
            // 中央サーバーのデバッグ探偵プロンプトURL
            const debugDetectivePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09';
            // ClaudeCodeIntegrationServiceを使用して公開URL経由で起動
            try {
                // VSCodeのlaunchFromUrlコマンドを実行（このコマンドはすでに実装済み）
                logger_1.Logger.info(`ClaudeCodeをURL経由で起動します: ${debugDetectivePromptUrl}`);
                // ClaudeCodeIntegrationServiceのインスタンスを取得
                const integrationService = await Promise.resolve().then(() => __importStar(require('../../services/ClaudeCodeIntegrationService'))).then(module => module.ClaudeCodeIntegrationService.getInstance());
                // エラー情報と関連ファイル内容を一時ファイルに保存
                let analysisContent = '# エラー情報\n\n```\n';
                analysisContent += errorLog;
                analysisContent += '\n```\n\n';
                analysisContent += '# 関連ファイル\n\n';
                for (const [filePath, content] of Object.entries(relatedFilesContent)) {
                    analysisContent += `## ${filePath}\n\n`;
                    analysisContent += '```\n';
                    analysisContent += content;
                    analysisContent += '\n```\n\n';
                }
                // 一時ファイルに保存（デバッグ用・参照用）
                const analysisFilePath = path.join(tempDir, `error_analysis_${Date.now()}.md`);
                fs.writeFileSync(analysisFilePath, analysisContent, 'utf8');
                logger_1.Logger.info(`エラー分析ファイルを作成しました: ${analysisFilePath}`);
                // 公開URLからClaudeCodeを起動（エラー分析内容を追加コンテンツとして渡す）
                logger_1.Logger.info(`公開URL経由でClaudeCodeを起動します: ${debugDetectivePromptUrl}`);
                await integrationService.launchWithPublicUrl(debugDetectivePromptUrl, this._projectPath, analysisContent // 重要：エラー分析内容を追加コンテンツとして渡す
                );
                // 解析データのファイルを作成するだけで開かず、通知も表示しない
                logger_1.Logger.info(`エラー分析ファイルを作成しました: ${analysisFilePath}`);
            }
            catch (error) {
                // URL起動に失敗した場合、ローカルファイルにフォールバック
                logger_1.Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
                // ローカルのプロンプトファイルをチェック
                const debugPromptPath = path.join(this._projectPath, 'docs', 'prompts', 'debug_detective.md');
                // プロンプトファイルの存在確認
                if (!fs.existsSync(debugPromptPath)) {
                    logger_1.Logger.error(`デバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
                    throw new Error(`デバッグプロンプトファイル（debug_detective.md）が見つかりません。docs/prompts/debug_detective.mdを確認してください。`);
                }
                logger_1.Logger.info(`デバッグプロンプトファイルを読み込みます: ${debugPromptPath}`);
                let combinedContent = fs.readFileSync(debugPromptPath, 'utf8');
                combinedContent += '\n\n# エラー情報\n\n```\n';
                combinedContent += errorLog;
                combinedContent += '\n```\n\n';
                combinedContent += '# 関連ファイル\n\n';
                for (const [filePath, content] of Object.entries(relatedFilesContent)) {
                    combinedContent += `## ${filePath}\n\n`;
                    combinedContent += '```\n';
                    combinedContent += content;
                    combinedContent += '\n```\n\n';
                }
                logger_1.Logger.info(`調査用プロンプトを作成します: ${combinedPromptPath}`);
                fs.writeFileSync(combinedPromptPath, combinedContent, 'utf8');
                // ClaudeCodeを起動（フォールバック）
                logger_1.Logger.info(`ClaudeCodeを起動します（フォールバック）: ${combinedPromptPath}`);
                await this._claudeCodeLauncher.launchClaudeCodeWithPrompt(this._projectPath, combinedPromptPath, {
                    title: `デバッグ探偵 - 調査中: ${errorType || '不明なエラー'}`,
                    deletePromptFile: true // セキュリティ対策として自動削除
                });
            }
            // UI更新
            await this._updateWebview();
            // 作成済みセッションIDを通知
            await this._panel.webview.postMessage({
                command: 'errorSessionCreated',
                sessionId,
                errorType,
                relatedFiles: detectedFiles
            });
            logger_1.Logger.info(`調査を開始しました: ${sessionId}`);
        }
        catch (error) {
            logger_1.Logger.error('エラー調査依頼エラー', error);
            await this._showError(`エラーの調査依頼に失敗しました: ${error.message}`);
        }
    }
    /**
     * エラーセッション一覧取得処理
     */
    async _handleGetErrorSessions() {
        try {
            // エラーセッション一覧を取得
            const sessions = await this._errorSessionManager.getAllSessions();
            // UI更新
            await this._panel.webview.postMessage({
                command: 'errorSessions',
                sessions
            });
            logger_1.Logger.info(`エラーセッション一覧を取得しました: ${sessions.length}件`);
        }
        catch (error) {
            logger_1.Logger.error('エラーセッション一覧取得エラー', error);
            await this._showError(`エラーセッション一覧の取得に失敗しました: ${error.message}`);
        }
    }
    /**
     * ターミナル出力保存処理
     */
    async _handleSaveTerminalOutput() {
        try {
            // クリップボードからターミナル出力を取得するよう促す
            vscode.window.showInformationMessage('ターミナル出力をクリップボードにコピーし、テキストエリアに貼り付けてください。');
        }
        catch (error) {
            logger_1.Logger.error('ターミナル出力保存エラー', error);
            await this._showError(`ターミナル出力の保存に失敗しました: ${error.message}`);
        }
    }
    /**
     * エラータイプ検出処理
     */
    async _handleDetectErrorType(errorLog) {
        try {
            if (!errorLog || errorLog.trim() === '') {
                throw new Error('エラーログが空です');
            }
            // エラーの種類を検出
            const errorType = await this._detectErrorType(errorLog);
            // UI更新
            await this._panel.webview.postMessage({
                command: 'errorTypeDetected',
                errorType
            });
            logger_1.Logger.info(`エラータイプを検出しました: ${errorType}`);
        }
        catch (error) {
            logger_1.Logger.error('エラータイプ検出エラー', error);
            await this._showError(`エラータイプの検出に失敗しました: ${error.message}`);
        }
    }
    /**
     * エラーの種類を検出
     */
    async _detectErrorType(errorLog) {
        // エラーパターンの定義
        const errorPatterns = [
            { pattern: /(TypeError|ReferenceError|SyntaxError|RangeError)/i, type: '構文エラー' },
            { pattern: /(ENOENT|EACCES|EPERM|EEXIST)/i, type: 'ファイルシステムエラー' },
            { pattern: /(Cannot find module|Module not found)/i, type: 'モジュールエラー' },
            { pattern: /(Connection refused|ECONNREFUSED|timeout|ETIMEDOUT)/i, type: '接続エラー' },
            { pattern: /(Uncaught|unhandled)/i, type: '未処理例外' },
            { pattern: /(undefined is not a function|is not a function)/i, type: '型エラー' },
            { pattern: /(DatabaseError|MongoError|SequelizeError|PrismaClientKnownRequestError)/i, type: 'データベースエラー' },
            { pattern: /(AUTH_|Authorization|Authentication|token|jwt)/i, type: '認証エラー' },
            { pattern: /(Cannot read property|Cannot access|is undefined)/i, type: 'プロパティアクセスエラー' },
            { pattern: /(Component|React|Vue|Angular|DOM)/i, type: 'UIコンポーネントエラー' },
            { pattern: /(404|500|403|401|422|400)/i, type: 'HTTPエラー' },
            { pattern: /(npm ERR|yarn error|package.json)/i, type: 'パッケージ管理エラー' },
            { pattern: /(webpack|babel|rollup|vite|esbuild)/i, type: 'ビルドエラー' },
            { pattern: /(test|expect|assert|describe|it\(|test\()/i, type: 'テストエラー' },
            { pattern: /(memory leak|Out of memory|heap)/i, type: 'メモリエラー' },
            { pattern: /(TypeScript|TS|type annotations|interface)/i, type: '型定義エラー' },
            { pattern: /(lint|eslint|tslint|prettier)/i, type: 'リントエラー' },
            { pattern: /(環境変数|env|process.env|Environment)/i, type: '環境変数エラー' },
        ];
        // エラーパターンを順に検査
        for (const { pattern, type } of errorPatterns) {
            if (pattern.test(errorLog)) {
                return type;
            }
        }
        // デフォルト
        return '不明なエラー';
    }
    /**
     * エラーに関連するファイルを検出
     */
    async _detectRelatedFiles(errorLog) {
        try {
            const relatedFiles = [];
            // ファイルパスのパターンを検出
            const filePathPatterns = [
                /(?:at |from |in |file |path:)([^()\n:]+\.(?:js|ts|jsx|tsx|vue|html|css|scss|json))/gi,
                /([a-zA-Z0-9_\-/.]+\.(?:js|ts|jsx|tsx|vue|html|css|scss|json))(?::(\d+))?(?::(\d+))?/gi,
                /(?:import|require|from) ['"]([^'"]+)['"]/gi,
                /(?:load|open|read|write|access) ['"]([^'"]+)['"]/gi
            ];
            // パターンごとに検出
            for (const pattern of filePathPatterns) {
                let match;
                while ((match = pattern.exec(errorLog)) !== null) {
                    const filePath = match[1].trim();
                    // 絶対パスかどうかをチェック
                    const fullPath = path.isAbsolute(filePath)
                        ? filePath
                        : path.join(this._projectPath, filePath);
                    // ファイルが存在するか確認
                    try {
                        if (fs.existsSync(fullPath)) {
                            // 重複を避けて追加
                            if (!relatedFiles.includes(fullPath)) {
                                relatedFiles.push(fullPath);
                            }
                        }
                        else {
                            // プロジェクト内を検索
                            const foundFile = await this._searchFileInProject(filePath);
                            if (foundFile && !relatedFiles.includes(foundFile)) {
                                relatedFiles.push(foundFile);
                            }
                        }
                    }
                    catch (e) {
                        // エラー処理は行わない
                    }
                }
            }
            // パッケージ.jsonを検索（モジュールエラーの場合）
            if (errorLog.includes('Cannot find module') || errorLog.includes('Module not found')) {
                const packageJsonPath = path.join(this._projectPath, 'package.json');
                if (fs.existsSync(packageJsonPath) && !relatedFiles.includes(packageJsonPath)) {
                    relatedFiles.push(packageJsonPath);
                }
            }
            // 環境変数を検索（環境変数エラーの場合）
            if (errorLog.includes('process.env') || errorLog.includes('環境変数')) {
                const envPaths = [
                    path.join(this._projectPath, '.env'),
                    path.join(this._projectPath, '.env.local'),
                    path.join(this._projectPath, '.env.development'),
                    path.join(this._projectPath, '.env.production')
                ];
                for (const envPath of envPaths) {
                    if (fs.existsSync(envPath) && !relatedFiles.includes(envPath)) {
                        relatedFiles.push(envPath);
                    }
                }
            }
            return relatedFiles;
        }
        catch (error) {
            logger_1.Logger.error('関連ファイル検出エラー', error);
            return [];
        }
    }
    /**
     * プロジェクト内のファイルを検索
     */
    async _searchFileInProject(fileName) {
        try {
            // ファイル名のみを取得
            const baseFileName = path.basename(fileName);
            // ファイル名に拡張子が含まれていない場合は一般的な拡張子を追加
            const searchPatterns = baseFileName.includes('.')
                ? [baseFileName]
                : [
                    `${baseFileName}.js`,
                    `${baseFileName}.ts`,
                    `${baseFileName}.jsx`,
                    `${baseFileName}.tsx`,
                    `${baseFileName}.vue`,
                    `${baseFileName}.html`,
                    `${baseFileName}.css`,
                    `${baseFileName}.scss`,
                    `${baseFileName}.json`
                ];
            // VS Codeの検索APIを使用
            for (const pattern of searchPatterns) {
                const uris = await vscode.workspace.findFiles(`**/${pattern}`, '**/node_modules/**', 10);
                if (uris.length > 0) {
                    return uris[0].fsPath;
                }
            }
            return null;
        }
        catch (error) {
            logger_1.Logger.error('ファイル検索エラー', error);
            return null;
        }
    }
    /**
     * 関連ファイルの内容を読み込む
     */
    async _loadRelatedFilesContent(filePaths) {
        const contents = {};
        for (const filePath of filePaths) {
            try {
                // ファイルが存在するか確認
                if (!fs.existsSync(filePath)) {
                    continue;
                }
                // ファイルの内容を読み込む
                const content = fs.readFileSync(filePath, 'utf8');
                // ファイルサイズが大きすぎる場合は最初の1000行だけ読み込む
                const lines = content.split('\n');
                const truncatedContent = lines.length > 1000
                    ? lines.slice(0, 1000).join('\n') + '\n... (truncated)'
                    : content;
                contents[filePath] = truncatedContent;
            }
            catch (error) {
                logger_1.Logger.error(`ファイル読み込みエラー: ${filePath}`, error);
            }
        }
        return contents;
    }
    /**
     * エラーメッセージの表示
     */
    async _showError(message) {
        vscode.window.showErrorMessage(message);
        // WebViewにもエラーを表示
        await this._panel.webview.postMessage({
            command: 'showError',
            message
        });
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
            // エラーセッション一覧を取得
            const sessions = await this._errorSessionManager.getAllSessions();
            // 知見ベース一覧を取得
            const knowledgeBase = await this._knowledgeBaseManager.getAllKnowledge();
            await this._panel.webview.postMessage({
                command: 'updateState',
                currentErrorSession: this._currentErrorSession,
                relatedFiles: this._relatedFiles,
                detectedErrorType: this._detectedErrorType,
                sessions,
                knowledgeBase,
                projectPath: this._projectPath
            });
        }
        catch (error) {
            logger_1.Logger.error(`WebView状態更新エラー`, error);
            // 最低限のメッセージを送信
            await this._panel.webview.postMessage({
                command: 'showError',
                message: 'デバッグデータの読み込み中にエラーが発生しました。'
            });
        }
    }
    /**
     * WebView用のHTMLを生成
     */
    _getHtmlForWebview() {
        const webview = this._panel.webview;
        try {
            // WebView内でのリソースへのパスを取得
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'debugDetective.js'));
            const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'debugDetective.css'));
            const resetCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
            const vscodeCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
            // シャーロックアイコンのパスを取得
            const sherlockIconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'assets', 'sherlock.svg');
            const sherlockIconExists = fs.existsSync(sherlockIconPath.fsPath);
            // アイコンが存在する場合のみURIを取得
            const sherlockIconUri = sherlockIconExists
                ? webview.asWebviewUri(sherlockIconPath)
                : webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg')); // フォールバックアイコン
            // WebViewのHTMLを構築
            return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; frame-src https:;">
  <title>デバッグ探偵 - シャーロックホームズ</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
  <style>
    :root {
      --vscode-bg: var(--vscode-editor-background, #1e1e1e);
      --vscode-fg: var(--vscode-editor-foreground, #d4d4d4);
      --vscode-input-bg: var(--vscode-input-background, #3c3c3c);
      --vscode-input-fg: var(--vscode-input-foreground, #cccccc);
      --vscode-button-bg: var(--vscode-button-background, #0e639c);
      --vscode-button-fg: var(--vscode-button-foreground, white);
      --vscode-button-hover-bg: var(--vscode-button-hoverBackground, #1177bb);
      --vscode-border: var(--vscode-input-border, #3c3c3c);
      --vscode-success: #89d185;
    }
    
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      color: var(--vscode-fg);
      background-color: var(--vscode-bg);
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }
    
    .detective-container {
      width: 100%;
      max-width: 100%;
      padding: 0.25rem;
    }
    
    .header {
      display: flex;
      align-items: center;
      padding: 0.25rem;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid var(--vscode-border);
    }
    
    .header-title {
      display: flex;
      align-items: center;
    }
    
    .sherlock-icon {
      width: 16px;
      height: 16px;
      margin-right: 0.25rem;
    }
    
    .header-title h1 {
      font-size: 0.85rem;
      margin: 0;
      font-weight: 400;
      opacity: 0.8;
    }
    
    .content {
      width: 100%;
    }
    
    .error-input-section {
      width: 100%;
    }
    
    .error-input {
      width: 100%;
    }
    
    #error-log {
      width: 100%;
      min-height: 400px;
      background-color: var(--vscode-input-bg);
      color: var(--vscode-input-fg);
      border: 1px solid var(--vscode-border);
      padding: 0.5rem;
      font-family: var(--vscode-editor-font-family, 'SFMono-Regular', Consolas, monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      line-height: 1.5;
      margin-bottom: 0.5rem;
      resize: vertical;
    }
    
    #error-log:focus {
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
    }
    
    #investigate-error-btn {
      background-color: #8b6b57; /* 茶色 */
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      width: 100%;
      justify-content: center;
    }
    
    #investigate-error-btn:hover {
      background-color: #7d5f4d; /* 濃い茶色 */
    }
    
    #investigate-error-btn .icon {
      font-size: 1rem;
      margin-right: 0.5rem;
    }
    
    .success-message {
      display: flex;
      align-items: center;
      background-color: rgba(137, 209, 133, 0.1);
      border-left: 2px solid var(--vscode-success);
      padding: 0.5rem;
      margin-top: 0.5rem;
      width: 100%;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    
    .success-icon {
      color: var(--vscode-success);
      margin-right: 0.5rem;
    }
    
    .success-text {
      color: var(--vscode-success);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="detective-container">
    <!-- ヘッダー -->
    <div class="header">
      <div class="header-title">
        <img src="${sherlockIconUri}" alt="シャーロックホームズ" class="sherlock-icon">
        <h1>デバッグ探偵 - シャーロックホームズ</h1>
      </div>
    </div>
    
    <!-- メインコンテンツ -->
    <div class="content">
      <!-- エラーセッションコンテンツ -->
      <div class="error-input-section">
        <div class="error-input">
          <textarea id="error-log" placeholder="エラーログをここに貼り付けてください..."></textarea>
          <button id="investigate-error-btn">
            <i class="icon">🕵️</i> このエラーの調査を依頼する
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- スクリプト -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
        }
        catch (error) {
            logger_1.Logger.error(`WebView HTML生成エラー`, error);
            // エラーが発生した場合のシンプルなフォールバックHTMLを返す
            return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>デバッグ探偵 - シャーロックホームズ</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .error { color: #c25450; margin: 20px 0; padding: 10px; border: 1px solid #c25450; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>デバッグ探偵 - シャーロックホームズ</h1>
  <div class="error">
    <h2>エラーが発生しました</h2>
    <p>デバッグ探偵の初期化中にエラーが発生しました。開発ログを確認してください。</p>
    <button onclick="window.location.reload()">再読み込み</button>
  </div>
</body>
</html>`;
        }
    }
    /**
     * リソースの解放
     */
    dispose() {
        DebugDetectivePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.DebugDetectivePanel = DebugDetectivePanel;
DebugDetectivePanel.viewType = 'debugDetective';
//# sourceMappingURL=DebugDetectivePanel.js.map