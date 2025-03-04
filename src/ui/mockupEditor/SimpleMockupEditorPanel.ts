import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { MockupStorageService, Mockup } from '../../../src/services/mockupStorageService';

/**
 * シンプルモックアップエディターパネル
 * モックアップの表示と編集に特化したシンプルなインターフェース
 */
export class SimpleMockupEditorPanel {
  public static currentPanel: SimpleMockupEditorPanel | undefined;
  private static readonly viewType = 'simpleMockupEditor';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _aiService: AIService;
  private _storage: MockupStorageService;

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService): SimpleMockupEditorPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (SimpleMockupEditorPanel.currentPanel) {
      SimpleMockupEditorPanel.currentPanel._panel.reveal(column);
      return SimpleMockupEditorPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      SimpleMockupEditorPanel.viewType,
      'モックアップエディター',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    SimpleMockupEditorPanel.currentPanel = new SimpleMockupEditorPanel(panel, extensionUri, aiService);
    return SimpleMockupEditorPanel.currentPanel;
  }

  /**
   * 特定のモックアップを選択した状態で開く
   */
  public static openWithMockup(extensionUri: vscode.Uri, aiService: AIService, mockupId: string): SimpleMockupEditorPanel {
    const panel = SimpleMockupEditorPanel.createOrShow(extensionUri, aiService);
    panel._loadAndSelectMockup(mockupId);
    return panel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    this._storage = MockupStorageService.getInstance();

    // WebViewの内容を設定
    this._update();

    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
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
      },
      null,
      this._disposables
    );

    Logger.info('シンプルモックアップエディターパネルを作成しました');
  }

  /**
   * モックアップの読み込み処理
   */
  private async _handleLoadMockups(): Promise<void> {
    try {
      const mockups = this._storage.getAllMockups();
      this._panel.webview.postMessage({
        command: 'updateMockups',
        mockups
      });
      Logger.info(`${mockups.length}個のモックアップを読み込みました`);
    } catch (error) {
      Logger.error('モックアップ読み込みエラー', error as Error);
      this._showError('モックアップの読み込みに失敗しました');
    }
  }

  /**
   * 特定のモックアップを読み込んで選択
   */
  private async _loadAndSelectMockup(mockupId: string): Promise<void> {
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
        Logger.info(`モックアップを選択: ${mockupId}`);
      }
    } catch (error) {
      Logger.error(`モックアップ選択エラー: ${mockupId}`, error as Error);
    }
  }

  /**
   * モックアップの更新処理
   */
  private async _handleUpdateMockup(mockupId: string, text: string): Promise<void> {
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
      
      Logger.info(`モックアップを更新しました: ${mockupId}`);
    } catch (error) {
      Logger.error(`モックアップ更新エラー: ${(error as Error).message}`);
      this._showError(`モックアップの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップをブラウザで開く
   */
  private async _handleOpenInBrowser(mockupId: string): Promise<void> {
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
      
      Logger.info(`モックアップをブラウザで開きました: ${mockupId}`);
    } catch (error) {
      Logger.error(`ブラウザ表示エラー: ${(error as Error).message}`);
      this._showError(`モックアップのブラウザ表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップの削除
   */
  private async _handleDeleteMockup(mockupId: string): Promise<void> {
    try {
      const success = await this._storage.deleteMockup(mockupId);
      
      if (success) {
        // 削除成功をWebViewに通知（awaitを使用しない）
        this._panel.webview.postMessage({
          command: 'mockupDeleted',
          mockupId
        });
        
        Logger.info(`モックアップを削除しました: ${mockupId}`);
      } else {
        throw new Error('モックアップの削除に失敗しました');
      }
    } catch (error) {
      Logger.error(`モックアップ削除エラー: ${(error as Error).message}`);
      this._showError(`モックアップの削除に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップのインポート
   */
  private async _handleImportMockup(): Promise<void> {
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
      const mockupId = await this._storage.saveMockup(
        { html },
        {
          name: mockupName,
          sourceType: 'imported',
          description: `インポート元: ${filePath}`
        }
      );
      
      // モックアップリストを更新
      await this._handleLoadMockups();
      
      // インポートしたモックアップを選択
      await this._loadAndSelectMockup(mockupId);
      
      // 成功メッセージをWebViewに送信
      this._panel.webview.postMessage({
        command: 'addAssistantMessage',
        text: `モックアップ「${mockupName}」をインポートしました。`
      });
      
      Logger.info(`モックアップをインポートしました: ${filePath} -> ${mockupId}`);
    } catch (error) {
      Logger.error(`モックアップインポートエラー: ${(error as Error).message}`);
      this._showError(`モックアップのインポートに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップ更新用のプロンプトを作成
   */
  private _buildUpdatePrompt(mockup: Mockup, updateText: string): string {
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
  private _extractHtmlFromResponse(response: string): string | null {
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
  private _getTempDir(): string {
    return process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  }

  /**
   * エラーメッセージの表示
   */
  private _showError(message: string): void {
    this._panel.webview.postMessage({
      command: 'showError',
      text: message
    });
  }

  /**
   * WebViewを更新
   */
  private _update(): void {
    if (!this._panel.visible) {
      return;
    }

    this._panel.webview.html = this._getHtmlForWebview();
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // WebView内でのリソースへのパスを取得
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'simpleMockupEditor.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'simpleMockupEditor.css')
    );

    // コードアイコンを使用する場合のパス
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

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
  public dispose(): void {
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