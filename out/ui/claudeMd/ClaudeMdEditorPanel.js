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
exports.ClaudeMdEditorPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const ClaudeMdService_1 = require("../../utils/ClaudeMdService");
/**
 * CLAUDE.mdエディタパネル
 * CLAUDE.mdファイルの編集と管理のためのWebViewインターフェース
 */
class ClaudeMdEditorPanel {
    /**
     * パネルを作成または表示
     */
    static createOrShow(extensionUri, claudeMdPath) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // すでにパネルが存在する場合は、それを表示
        if (ClaudeMdEditorPanel.currentPanel) {
            ClaudeMdEditorPanel.currentPanel._panel.reveal(column);
            if (claudeMdPath) {
                ClaudeMdEditorPanel.currentPanel._loadClaudeMd(claudeMdPath);
            }
            return ClaudeMdEditorPanel.currentPanel;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(ClaudeMdEditorPanel.viewType, 'CLAUDE.md エディタ', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'dist')
            ]
        });
        ClaudeMdEditorPanel.currentPanel = new ClaudeMdEditorPanel(panel, extensionUri, claudeMdPath);
        return ClaudeMdEditorPanel.currentPanel;
    }
    /**
     * コンストラクタ
     */
    constructor(panel, extensionUri, claudeMdPath) {
        this._disposables = [];
        this._claudeMdPath = '';
        this._claudeMdContent = '';
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._claudeMdService = ClaudeMdService_1.ClaudeMdService.getInstance();
        // WebViewの内容を設定
        this._update();
        // CLAUDE.mdを読み込む（指定されている場合）
        if (claudeMdPath) {
            this._loadClaudeMd(claudeMdPath);
        }
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
                case 'saveClaudeMd':
                    await this._saveClaudeMd(message.content);
                    break;
                case 'exportToCli':
                    await this._exportClaudeMdToCli();
                    break;
                case 'loadTemplate':
                    await this._loadTemplateToEditor();
                    break;
                case 'updateSection':
                    await this._updateSection(message.sectionName, message.content);
                    break;
                case 'getSection':
                    await this._getSectionContent(message.sectionName);
                    break;
            }
        }, null, this._disposables);
    }
    /**
     * CLAUDE.mdを読み込む
     */
    async _loadClaudeMd(claudeMdPath) {
        try {
            if (!fs.existsSync(claudeMdPath)) {
                throw new Error(`CLAUDE.mdファイルが存在しません: ${claudeMdPath}`);
            }
            this._claudeMdPath = claudeMdPath;
            this._claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
            // WebViewに内容を送信
            await this._panel.webview.postMessage({
                command: 'updateContent',
                content: this._claudeMdContent,
                path: this._claudeMdPath
            });
            logger_1.Logger.info(`CLAUDE.mdを読み込みました: ${claudeMdPath}`);
        }
        catch (error) {
            logger_1.Logger.error('CLAUDE.md読み込みエラー', error);
            vscode.window.showErrorMessage(`CLAUDE.mdの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * CLAUDE.mdを保存
     */
    async _saveClaudeMd(content) {
        try {
            if (!this._claudeMdPath) {
                // パスが未設定の場合は保存ダイアログを表示
                const result = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(path.join(vscode.workspace.rootPath || '', 'CLAUDE.md')),
                    filters: { 'Markdown': ['md'] }
                });
                if (!result) {
                    return; // キャンセルされた場合
                }
                this._claudeMdPath = result.fsPath;
            }
            // ファイルを保存
            fs.writeFileSync(this._claudeMdPath, content, 'utf8');
            this._claudeMdContent = content;
            // 成功メッセージを表示
            vscode.window.showInformationMessage(`CLAUDE.mdを保存しました: ${this._claudeMdPath}`);
            logger_1.Logger.info(`CLAUDE.mdを保存しました: ${this._claudeMdPath}`);
        }
        catch (error) {
            logger_1.Logger.error('CLAUDE.md保存エラー', error);
            vscode.window.showErrorMessage(`CLAUDE.mdの保存に失敗しました: ${error.message}`);
        }
    }
    /**
     * CLAUDE.mdをClaudeCodeで開く
     */
    async _exportClaudeMdToCli() {
        try {
            if (!this._claudeMdPath || !fs.existsSync(this._claudeMdPath)) {
                throw new Error('先にCLAUDE.mdを保存してください');
            }
            // プロジェクトディレクトリを取得
            const projectPath = path.dirname(this._claudeMdPath);
            // ClaudeCodeを起動
            const terminal = vscode.window.createTerminal({
                name: 'ClaudeCode - CLAUDE.md',
                cwd: projectPath
            });
            terminal.show();
            terminal.sendText(`cd "${projectPath}"`);
            terminal.sendText(`claude "${this._claudeMdPath}"`);
            logger_1.Logger.info(`CLAUDE.mdをClaudeCodeで開きました: ${this._claudeMdPath}`);
            vscode.window.showInformationMessage('CLAUDE.mdをClaudeCodeで開きました');
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode起動エラー', error);
            vscode.window.showErrorMessage(`ClaudeCodeの起動に失敗しました: ${error.message}`);
        }
    }
    /**
     * テンプレートを読み込む
     */
    async _loadTemplateToEditor() {
        try {
            const template = this._claudeMdService.getDefaultTemplate();
            await this._panel.webview.postMessage({
                command: 'updateContent',
                content: template,
                path: ''
            });
            logger_1.Logger.info('テンプレートを読み込みました');
        }
        catch (error) {
            logger_1.Logger.error('テンプレート読み込みエラー', error);
            vscode.window.showErrorMessage(`テンプレートの読み込みに失敗しました: ${error.message}`);
        }
    }
    /**
     * セクションを更新
     */
    async _updateSection(sectionName, content) {
        try {
            if (!this._claudeMdPath) {
                throw new Error('先にCLAUDE.mdを保存してください');
            }
            const projectPath = path.dirname(this._claudeMdPath);
            const success = this._claudeMdService.updateClaudeMdSection(projectPath, sectionName, content);
            if (success) {
                // 更新されたファイルを再度読み込む
                await this._loadClaudeMd(this._claudeMdPath);
                vscode.window.showInformationMessage(`${sectionName}セクションを更新しました`);
            }
            else {
                throw new Error(`${sectionName}セクションの更新に失敗しました`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`セクション更新エラー: ${sectionName}`, error);
            vscode.window.showErrorMessage(`セクションの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * セクション内容を取得
     */
    async _getSectionContent(sectionName) {
        try {
            if (!this._claudeMdPath) {
                throw new Error('先にCLAUDE.mdを保存してください');
            }
            const projectPath = path.dirname(this._claudeMdPath);
            const content = this._claudeMdService.getClaudeMdSection(projectPath, sectionName);
            await this._panel.webview.postMessage({
                command: 'sectionContent',
                sectionName,
                content: content || ''
            });
        }
        catch (error) {
            logger_1.Logger.error(`セクション取得エラー: ${sectionName}`, error);
            vscode.window.showErrorMessage(`セクションの取得に失敗しました: ${error.message}`);
        }
    }
    /**
     * WebViewを更新
     */
    _update() {
        if (!this._panel.visible) {
            return;
        }
        this._panel.webview.html = this._getHtmlForWebview();
    }
    /**
     * WebView用のHTMLを生成
     */
    _getHtmlForWebview() {
        const webview = this._panel.webview;
        // WebView内でのリソースへのパスを取得
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'claudeMdEditor.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'claudeMdEditor.css'));
        const resetCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const vscodeCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        // WebViewのHTMLを構築
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
  <title>CLAUDE.md エディタ</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${vscodeCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="editor-container">
    <div class="toolbar">
      <button id="save-btn" class="button">保存</button>
      <button id="export-cli-btn" class="button">ClaudeCodeで開く</button>
      <button id="load-template-btn" class="button">テンプレート読み込み</button>
      <span id="file-path"></span>
    </div>
    
    <div class="main-content">
      <div class="sections-sidebar">
        <h3>セクション</h3>
        <ul id="sections-list">
          <li data-section="要件定義">要件定義</li>
          <li data-section="ディレクトリ構造">ディレクトリ構造</li>
          <li data-section="モックアップ">モックアップ</li>
          <li data-section="スコープ">スコープ</li>
          <li data-section="ビルドコマンド">ビルドコマンド</li>
          <li data-section="コーディング規約">コーディング規約</li>
          <li data-section="アーキテクチャパターン">アーキテクチャパターン</li>
          <li data-section="ワーク状況">ワーク状況</li>
        </ul>
      </div>
      
      <div class="editor-content">
        <div class="editor-wrapper">
          <textarea id="editor"></textarea>
        </div>
        
        <div class="preview-wrapper">
          <div id="preview"></div>
        </div>
      </div>
    </div>
    
    <div class="section-editor" id="section-editor">
      <div class="section-editor-header">
        <h3 id="section-editor-title">セクション編集</h3>
        <button id="close-section-editor" class="button">閉じる</button>
      </div>
      <textarea id="section-editor-content"></textarea>
      <div class="section-editor-actions">
        <button id="update-section-btn" class="button">更新</button>
        <button id="cancel-section-btn" class="button secondary">キャンセル</button>
      </div>
    </div>
  </div>
  
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
    /**
     * リソースの解放
     */
    dispose() {
        ClaudeMdEditorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.ClaudeMdEditorPanel = ClaudeMdEditorPanel;
ClaudeMdEditorPanel.viewType = 'claudeMdEditor';
//# sourceMappingURL=ClaudeMdEditorPanel.js.map