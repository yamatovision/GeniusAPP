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
exports.SimpleMockupEditorPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
const mockupStorageService_1 = require("../../../src/services/mockupStorageService");
/**
 * シンプルモックアップエディターパネル
 * モックアップの表示と編集に特化したシンプルなインターフェース
 */
class SimpleMockupEditorPanel {
    /**
     * パネルを作成または表示
     */
    static createOrShow(extensionUri, aiService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // すでにパネルが存在する場合は、それを表示
        if (SimpleMockupEditorPanel.currentPanel) {
            SimpleMockupEditorPanel.currentPanel._panel.reveal(column);
            return SimpleMockupEditorPanel.currentPanel;
        }
        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(SimpleMockupEditorPanel.viewType, 'モックアップエディター', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'dist')
            ]
        });
        SimpleMockupEditorPanel.currentPanel = new SimpleMockupEditorPanel(panel, extensionUri, aiService);
        return SimpleMockupEditorPanel.currentPanel;
    }
    /**
     * 特定のモックアップを選択した状態で開く
     */
    static openWithMockup(extensionUri, aiService, mockupId) {
        const panel = SimpleMockupEditorPanel.createOrShow(extensionUri, aiService);
        panel._loadAndSelectMockup(mockupId);
        return panel;
    }
    /**
     * コンストラクタ
     */
    constructor(panel, extensionUri, aiService) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._aiService = aiService;
        this._storage = mockupStorageService_1.MockupStorageService.getInstance();
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
                case 'loadMockups':
                    await this._handleLoadMockups();
                    break;
                case 'updateMockup':
                    await this._handleUpdateMockup(message.mockupId, message.text);
                    break;
                case 'openInBrowser':
                    await this._handleOpenInBrowser(message.mockupId);
                    break;
                case 'deleteMockup':
                    await this._handleDeleteMockup(message.mockupId);
                    break;
                case 'importMockup':
                    await this._handleImportMockup();
                    break;
            }
        }, null, this._disposables);
        logger_1.Logger.info('シンプルモックアップエディターパネルを作成しました');
    }
    /**
     * モックアップの読み込み処理
     */
    async _handleLoadMockups() {
        try {
            const mockups = this._storage.getAllMockups();
            this._panel.webview.postMessage({
                command: 'updateMockups',
                mockups
            });
            logger_1.Logger.info(`${mockups.length}個のモックアップを読み込みました`);
        }
        catch (error) {
            logger_1.Logger.error('モックアップ読み込みエラー', error);
            this._showError('モックアップの読み込みに失敗しました');
        }
    }
    /**
     * 特定のモックアップを読み込んで選択
     */
    async _loadAndSelectMockup(mockupId) {
        try {
            // まずすべてのモックアップを読み込む
            await this._handleLoadMockups();
            // 特定のモックアップを選択するメッセージを送信
            const mockup = this._storage.getMockup(mockupId);
            if (mockup) {
                this._panel.webview.postMessage({
                    command: 'selectMockup',
                    mockupId
                });
                logger_1.Logger.info(`モックアップを選択: ${mockupId}`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`モックアップ選択エラー: ${mockupId}`, error);
        }
    }
    /**
     * モックアップの更新処理
     */
    async _handleUpdateMockup(mockupId, text) {
        try {
            const mockup = this._storage.getMockup(mockupId);
            if (!mockup) {
                throw new Error(`モックアップが見つかりません: ${mockupId}`);
            }
            // AIに更新指示を送信
            const prompt = this._buildUpdatePrompt(mockup, text);
            // AIからの応答を取得
            const response = await this._aiService.sendMessage(prompt, 'mockup-edit');
            // HTMLコードを抽出
            const updatedHtml = this._extractHtmlFromResponse(response);
            if (!updatedHtml) {
                throw new Error('更新用のHTMLコードが見つかりませんでした');
            }
            // モックアップを更新
            const updatedMockup = await this._storage.updateMockup(mockupId, {
                html: updatedHtml
            });
            if (!updatedMockup) {
                throw new Error('モックアップの更新に失敗しました');
            }
            // 更新成功メッセージをWebViewに送信
            this._panel.webview.postMessage({
                command: 'mockupUpdated',
                mockup: updatedMockup,
                text: `モックアップを更新しました：${text}`
            });
            logger_1.Logger.info(`モックアップを更新しました: ${mockupId}`);
        }
        catch (error) {
            logger_1.Logger.error(`モックアップ更新エラー: ${error.message}`);
            this._showError(`モックアップの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップをブラウザで開く
     */
    async _handleOpenInBrowser(mockupId) {
        try {
            const mockup = this._storage.getMockup(mockupId);
            if (!mockup) {
                throw new Error(`モックアップが見つかりません: ${mockupId}`);
            }
            // 一時ファイルに保存
            const tempDir = path.join(this._getTempDir(), 'mockup-preview');
            // ディレクトリが存在しない場合は作成
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const tempFile = path.join(tempDir, `preview-${mockupId}.html`);
            fs.writeFileSync(tempFile, mockup.html, 'utf8');
            // ブラウザで開く
            await vscode.env.openExternal(vscode.Uri.file(tempFile));
            logger_1.Logger.info(`モックアップをブラウザで開きました: ${mockupId}`);
        }
        catch (error) {
            logger_1.Logger.error(`ブラウザ表示エラー: ${error.message}`);
            this._showError(`モックアップのブラウザ表示に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップの削除
     */
    async _handleDeleteMockup(mockupId) {
        try {
            const success = await this._storage.deleteMockup(mockupId);
            if (success) {
                // 削除成功をWebViewに通知（awaitを使用しない）
                this._panel.webview.postMessage({
                    command: 'mockupDeleted',
                    mockupId
                });
                logger_1.Logger.info(`モックアップを削除しました: ${mockupId}`);
            }
            else {
                throw new Error('モックアップの削除に失敗しました');
            }
        }
        catch (error) {
            logger_1.Logger.error(`モックアップ削除エラー: ${error.message}`);
            this._showError(`モックアップの削除に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップのインポート
     */
    async _handleImportMockup() {
        try {
            // HTMLファイル選択ダイアログを表示
            const fileUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'HTML Files': ['html', 'htm']
                },
                title: 'インポートするHTMLファイルを選択'
            });
            if (!fileUris || fileUris.length === 0) {
                return;
            }
            const filePath = fileUris[0].fsPath;
            // HTMLファイルを読み込む
            const html = fs.readFileSync(filePath, 'utf8');
            // ファイル名からモックアップ名を取得
            const fileName = path.basename(filePath);
            const mockupName = fileName.replace(/\.[^/.]+$/, ''); // 拡張子を削除
            // モックアップを保存
            const mockupId = await this._storage.saveMockup({ html }, {
                name: mockupName,
                sourceType: 'imported',
                description: `インポート元: ${filePath}`
            });
            // モックアップリストを更新
            await this._handleLoadMockups();
            // インポートしたモックアップを選択
            await this._loadAndSelectMockup(mockupId);
            // 成功メッセージをWebViewに送信
            this._panel.webview.postMessage({
                command: 'addAssistantMessage',
                text: `モックアップ「${mockupName}」をインポートしました。`
            });
            logger_1.Logger.info(`モックアップをインポートしました: ${filePath} -> ${mockupId}`);
        }
        catch (error) {
            logger_1.Logger.error(`モックアップインポートエラー: ${error.message}`);
            this._showError(`モックアップのインポートに失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップ更新用のプロンプトを作成
     */
    _buildUpdatePrompt(mockup, updateText) {
        return `既存のモックアップHTMLを以下の指示に基づいて修正してください：

${updateText}

既存のHTML:
\`\`\`html
${mockup.html}
\`\`\`

【ライブラリ使用ポリシー】
1. 既存のHTMLで既に使用されているライブラリを維持してください
2. 新しいライブラリが必要な場合は、以下の事前定義されたライブラリセットからのみ選択してください:

   ・基本UIフレームワーク（既に使用されている場合は変更しないでください）:
     - Bootstrap 5 (CDN: https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css)
     - Material Design Lite (CDN: https://code.getmdl.io/1.3.0/material.indigo-pink.min.css)

   ・Reactを使用している場合は以下のライブラリの有無を確認し、必要に応じて追加:
     - React + ReactDOM
     - Material UI
     - Framer Motion（アニメーション用）
     - Babel（JSX解析用）

   ・追加可能なJSライブラリ（必要なものだけ選択）:
     - jQuery（単純な操作の場合のみ）
     - Chart.js（グラフ表示が必要な場合のみ）

3. ライブラリは必ずhead要素内に追加してください

【ライブラリの参照方法】
- Reactは「React」オブジェクトとして参照
- ReactDOMは「ReactDOM」オブジェクトとして参照
- Material UIは「MaterialUI」オブジェクトとして参照
- Framer Motionは「motion」オブジェクトとして参照（window.motionとしてグローバルに利用可能）

修正後の完全なHTMLを返してください。
- HTMLの基本構造を維持してください
- head内のCDNリンクなどの重要な要素を削除しないでください
- スタイルや機能を維持しながら、指示に沿って修正を行ってください
- 元のHTMLと同じインデント形式を保持してください
- HTML全体を返してください（部分的な更新ではなく）
- コンソールエラーが出ないように注意してください

回答は以下の形式で返してください：
1. 変更点の説明
2. 完全な修正後のHTMLコード（\`\`\`html と \`\`\` で囲んでください）`;
    }
    /**
     * AIレスポンスからHTMLコードを抽出
     */
    _extractHtmlFromResponse(response) {
        // コードブロックを検出
        const htmlMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
        if (htmlMatch && htmlMatch[1]) {
            return htmlMatch[1].trim();
        }
        // HTMLタグを探す
        const docTypeMatch = response.match(/<(!DOCTYPE html|html)[\s\S]*<\/html>/i);
        if (docTypeMatch) {
            return docTypeMatch[0].trim();
        }
        return null;
    }
    /**
     * 一時ディレクトリのパスを取得
     */
    _getTempDir() {
        return process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
    }
    /**
     * エラーメッセージの表示
     */
    _showError(message) {
        this._panel.webview.postMessage({
            command: 'showError',
            text: message
        });
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
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'simpleMockupEditor.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'simpleMockupEditor.css'));
        // コードアイコンを使用する場合のパス
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        // WebViewのHTMLを構築
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>モックアップエディター</title>
  <link href="${styleUri}" rel="stylesheet">
  <link href="${codiconsUri}" rel="stylesheet">
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <h1>モックアップエディター</h1>
      <div class="top-bar-actions">
        <button id="import-button" class="button">
          <span class="codicon codicon-cloud-download"></span>インポート
        </button>
        <button id="refresh-button" class="button button-secondary">
          <span class="codicon codicon-refresh"></span>更新
        </button>
      </div>
    </div>
    
    <div class="main-container">
      <div class="mockups-list">
        <div class="mockup-actions">
          <div class="action-row">
            <button id="import-html-button" class="button">HTMLをインポート</button>
          </div>
        </div>
        <div class="mockups-container" id="mockups-container">
          <!-- モックアップリストがここに表示されます -->
          <div class="empty-state">
            <p>モックアップが読み込まれています...</p>
          </div>
        </div>
      </div>
      
      <div class="mockup-content">
        <div class="preview-container" id="preview-container" style="display: none;">
          <div class="preview-header">
            <div class="preview-header-title" id="preview-title">モックアッププレビュー</div>
            <div class="preview-header-actions">
              <button id="open-in-browser-button" class="button button-secondary">
                <span class="codicon codicon-browser"></span>ブラウザで開く
              </button>
            </div>
          </div>
          <div class="preview-frame-container">
            <iframe id="preview-frame" class="preview-frame"></iframe>
            <div id="loading-overlay" class="loading-overlay" style="display: none;">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
        
        <div class="editor-container">
          <div class="edit-area">
            <textarea id="edit-textarea" placeholder="モックアップに対する変更指示を入力してください...例: 「ボタンの色を青に変更する」「ヘッダーにロゴを追加する」"></textarea>
            <button id="send-button" class="button">
              <span class="codicon codicon-send"></span>送信
            </button>
          </div>
          <div class="chat-history" id="chat-history">
            <!-- チャット履歴がここに表示されます -->
          </div>
        </div>
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
        SimpleMockupEditorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.SimpleMockupEditorPanel = SimpleMockupEditorPanel;
SimpleMockupEditorPanel.viewType = 'simpleMockupEditor';
//# sourceMappingURL=SimpleMockupEditorPanel.js.map