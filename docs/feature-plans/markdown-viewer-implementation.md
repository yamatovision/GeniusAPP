# マークダウンファイルビューア実装計画

## 概要

マークダウンファイルを専用のビューで表示するための新しい機能を実装します。この機能は「モックアップギャラリー」と同様に独立したウィンドウとして開き、ファイルブラウザとマークダウン表示を統合したUIを提供します。

## 目的

- マークダウンファイルを統一されたフォーマットで表示
- ファイルブラウザとマークダウン表示を同一ウィンドウに統合
- 既存モックアップをベースにした直感的なUI

## 実装アプローチ

既存のモックアップ「file-browser-with-markdown」をベースに、静的HTMLに変換したものからスタートします。その後、VSCodeの拡張機能と連携するためのバックエンド機能を実装します。

## タスクリスト

1. **準備フェーズ**
   - [ ] モックアップを静的HTMLとCSSに変換
   - [ ] VSCode WebViewに適合するように修正
   - [ ] 必要なCSSとJavaScriptファイルを作成

2. **フロントエンド実装**
   - [ ] マークダウンビューアコンポーネントの作成
   - [ ] ファイルブラウザコンポーネントの移植
   - [ ] UI間の相互作用の実装

3. **バックエンド実装**
   - [ ] 新しいWebViewパネルクラスの作成
   - [ ] ファイル操作ハンドラの実装
   - [ ] マークダウンレンダリング機能の統合

4. **統合とテスト**
   - [ ] フロントエンドとバックエンドの接続
   - [ ] 動作テスト
   - [ ] UI/UXの改善

5. **リファクタリングと最終化**
   - [ ] コードのクリーンアップ
   - [ ] ドキュメント作成
   - [ ] 既存のファイルブラウザコードの整理

## 詳細実装手順

### 1. 静的HTML/CSSの準備

```bash
# 1. モックアップを静的HTMLに変換
cp mockups/file-browser-with-markdown.html media/markdownViewer/template.html

# 2. 必要なCSSファイルを作成
mkdir -p media/markdownViewer/css
touch media/markdownViewer/css/markdownViewer.css

# 3. JavaScriptファイルを作成
mkdir -p media/markdownViewer/js
touch media/markdownViewer/js/markdownViewer.js
```

#### 参考ファイル
- `/mockups/file-browser-with-markdown.html` - 基本的なレイアウトとUIの参考
- `/media/components/fileBrowser/fileBrowser.js` - ファイル一覧表示のロジック参考
- `/media/utils/simpleMarkdownConverter.js` - マークダウン変換の参考

### 2. VSCode拡張側の実装

#### 新しいパネルクラスの作成

`/src/ui/markdownViewer/MarkdownViewerPanel.ts` を作成し、以下の機能を実装します：

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';

export class MarkdownViewerPanel {
  public static currentPanel: MarkdownViewerPanel | undefined;
  private static readonly viewType = 'markdownViewer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _initialFilePath: string | undefined;

  /**
   * 新しいパネルを作成するか、既存のパネルを表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, filePath?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 既存のパネルがある場合は表示する
    if (MarkdownViewerPanel.currentPanel) {
      MarkdownViewerPanel.currentPanel._panel.reveal(column);
      
      // ファイルパスが指定されていれば、そのファイルを表示
      if (filePath) {
        MarkdownViewerPanel.currentPanel._loadFile(filePath);
      }
      
      return;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      MarkdownViewerPanel.viewType,
      'Markdown Viewer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    MarkdownViewerPanel.currentPanel = new MarkdownViewerPanel(panel, extensionUri, filePath);
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, filePath?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._initialFilePath = filePath;

    // WebViewの内容を設定
    this._update();

    // パネルが閉じられたときの処理
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  /**
   * WebViewの内容を更新
   */
  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
    
    // 初期ファイルがある場合は読み込む
    if (this._initialFilePath) {
      // 少し遅延してファイルを読み込む（WebViewの初期化を待つため）
      setTimeout(() => {
        this._loadFile(this._initialFilePath!);
      }, 500);
    }
  }

  /**
   * HTMLコンテンツを生成
   */
  private _getHtmlForWebview() {
    const webview = this._panel.webview;

    // 各種リソースのURIを取得
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'markdownViewer', 'css', 'markdownViewer.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'markdownViewer', 'js', 'markdownViewer.js')
    );
    const mdConverterUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'utils', 'simpleMarkdownConverter.js')
    );
    const designSystemUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css')
    );

    // CSP (Content Security Policy) の設定
    const nonce = this._getNonce();
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
      img-src ${webview.cspSource} data:;
      font-src ${webview.cspSource};
    `;

    // モックアップをベースにした静的HTMLテンプレート
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <link href="${designSystemUri}" rel="stylesheet">
      <link href="${styleUri}" rel="stylesheet">
      <title>Markdown Viewer</title>
    </head>
    <body>
      <div class="markdown-viewer-container">
        <!-- ファイルブラウザ -->
        <div class="file-browser">
          <div class="file-browser-header">
            <h3>ファイルブラウザ</h3>
            <button id="refresh-button" class="button-secondary">更新</button>
          </div>
          <div class="breadcrumb-path" id="current-path">
            <!-- パスがここに表示されます -->
          </div>
          <div class="file-list" id="file-list">
            <!-- ファイルリストがここに表示されます -->
            <div class="loading">読み込み中...</div>
          </div>
        </div>

        <!-- マークダウンビューア -->
        <div class="markdown-content-area">
          <div class="markdown-header">
            <h3 id="current-file">マークダウンビューア</h3>
          </div>
          <div class="markdown-content unified-markdown-view" id="markdown-content">
            <!-- マークダウン内容がここに表示されます -->
            <p>左側のファイルブラウザからマークダウンファイルを選択してください。</p>
          </div>
        </div>
      </div>

      <script nonce="${nonce}" type="module" src="${mdConverterUri}"></script>
      <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  /**
   * WebViewからのメッセージを処理
   */
  private async _handleMessage(message: any) {
    switch (message.command) {
      case 'getDirectory':
        await this._getDirectory(message.path);
        break;
      case 'openFile':
        await this._loadFile(message.path);
        break;
      case 'openInEditor':
        await this._openInEditor(message.path);
        break;
    }
  }

  /**
   * ディレクトリの内容を取得してWebViewに送信
   */
  private async _getDirectory(dirPath: string) {
    try {
      // パスが指定されていない場合は初期ディレクトリを表示
      const path = dirPath || (this._initialFilePath ? require('path').dirname(this._initialFilePath) : undefined);
      
      if (!path) {
        this._panel.webview.postMessage({
          command: 'error',
          message: 'ディレクトリが指定されていません'
        });
        return;
      }

      // ディレクトリが存在するか確認
      if (!fs.existsSync(path)) {
        this._panel.webview.postMessage({
          command: 'error',
          message: `ディレクトリが存在しません: ${path}`
        });
        return;
      }

      // ディレクトリの内容を取得
      const entries = fs.readdirSync(path, { withFileTypes: true });
      
      // ファイルとディレクトリの情報を整形
      const files = entries.map(entry => {
        const entryPath = require('path').join(path, entry.name);
        const stats = fs.statSync(entryPath);
        
        return {
          name: entry.name,
          path: entryPath,
          isDirectory: entry.isDirectory(),
          lastModified: stats.mtime.toISOString()
        };
      });

      // ディレクトリを先に、その後ファイルを表示（アルファベット順）
      const sortedFiles = files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      // WebViewにファイル一覧を送信
      this._panel.webview.postMessage({
        command: 'updateFileList',
        files: sortedFiles,
        currentPath: path
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'error',
        message: `ディレクトリの読み込みエラー: ${(error as Error).message}`
      });
    }
  }

  /**
   * ファイルを読み込んでWebViewに送信
   */
  private async _loadFile(filePath: string) {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        this._panel.webview.postMessage({
          command: 'error',
          message: `ファイルが存在しません: ${filePath}`
        });
        return;
      }

      // ファイルの内容を読み込む
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);

      // WebViewにファイル内容を送信
      this._panel.webview.postMessage({
        command: 'showFile',
        content: content,
        fileName: fileName,
        filePath: filePath
      });

      // パネルのタイトルを更新
      this._panel.title = `Markdown: ${fileName}`;
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'error',
        message: `ファイルの読み込みエラー: ${(error as Error).message}`
      });
    }
  }

  /**
   * ファイルをVSCodeエディタで開く
   */
  private async _openInEditor(filePath: string) {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'error',
        message: `エディタでファイルを開けませんでした: ${(error as Error).message}`
      });
    }
  }

  /**
   * リソースを解放
   */
  public dispose() {
    MarkdownViewerPanel.currentPanel = undefined;

    // パネルを破棄
    this._panel.dispose();

    // Disposableなリソースを破棄
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * nonce値を生成（CSP用）
   */
  private _getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
```

### 3. コマンドの登録

`package.json` のcontributesセクションにコマンドを追加：

```json
"contributes": {
  "commands": [
    {
      "command": "appgenius.openMarkdownViewer",
      "title": "Open in Markdown Viewer",
      "category": "AppGenius"
    }
  ]
}
```

`extension.ts` にコマンドを登録：

```typescript
// マークダウンビューアを開くコマンドを登録
context.subscriptions.push(
  vscode.commands.registerCommand('appgenius.openMarkdownViewer', (filePath?: string) => {
    // ファイルパスが指定されない場合はエディタでアクティブなファイルを使用
    if (!filePath && vscode.window.activeTextEditor) {
      filePath = vscode.window.activeTextEditor.document.uri.fsPath;
    }
    
    // マークダウンファイルでない場合は警告を表示
    if (filePath && !filePath.endsWith('.md')) {
      vscode.window.showWarningMessage('マークダウンファイルのみ表示できます。');
      return;
    }
    
    // マークダウンビューアパネルを表示
    MarkdownViewerPanel.createOrShow(context.extensionUri, filePath);
  })
);
```

### 4. フロントエンドJavaScriptの実装

`media/markdownViewer/js/markdownViewer.js` を作成：

```javascript
// @ts-check

(function() {
  // VSCodeのAPIを取得
  const vscode = acquireVsCodeApi();
  
  // 要素への参照
  const fileList = document.getElementById('file-list');
  const currentPath = document.getElementById('current-path');
  const markdownContent = document.getElementById('markdown-content');
  const currentFile = document.getElementById('current-file');
  const refreshButton = document.getElementById('refresh-button');
  
  // 現在のディレクトリパス
  let currentDirectory = '';
  
  // 初期化処理
  function initialize() {
    // メッセージハンドラを設定
    window.addEventListener('message', handleVSCodeMessage);
    
    // 更新ボタンのイベントリスナー
    refreshButton.addEventListener('click', () => {
      requestDirectory(currentDirectory);
    });
    
    // 初期ディレクトリを要求
    vscode.postMessage({ command: 'getDirectory' });
  }
  
  // VSCodeからのメッセージを処理
  function handleVSCodeMessage(event) {
    const message = event.data;
    
    switch (message.command) {
      case 'updateFileList':
        displayFileList(message.files, message.currentPath);
        break;
      case 'showFile':
        displayMarkdown(message.content, message.fileName);
        break;
      case 'error':
        showError(message.message);
        break;
    }
  }
  
  // ファイル一覧を表示
  function displayFileList(files, path) {
    currentDirectory = path;
    
    // パス表示を更新
    updatePathDisplay(path);
    
    // ファイルリストをクリア
    fileList.innerHTML = '';
    
    // 親ディレクトリへの参照を追加（ルートでない場合）
    if (path !== '/') {
      const parentDir = getParentDirectory(path);
      if (parentDir !== path) {
        const parentElement = createDirectoryElement('..', parentDir);
        fileList.appendChild(parentElement);
      }
    }
    
    // ディレクトリとファイルを表示
    files.forEach(file => {
      let element;
      if (file.isDirectory) {
        element = createDirectoryElement(file.name, file.path);
      } else if (file.name.endsWith('.md')) {
        element = createMarkdownFileElement(file.name, file.path);
      } else {
        element = createOtherFileElement(file.name, file.path);
      }
      fileList.appendChild(element);
    });
  }
  
  // 親ディレクトリのパスを取得
  function getParentDirectory(path) {
    const segments = path.split('/');
    return segments.slice(0, -1).join('/') || '/';
  }
  
  // ディレクトリ要素を作成
  function createDirectoryElement(name, path) {
    const element = document.createElement('div');
    element.className = 'file-item directory';
    element.innerHTML = `
      <span class="material-icons">folder</span>
      <span class="file-name">${name}</span>
    `;
    
    element.addEventListener('click', () => {
      requestDirectory(path);
    });
    
    return element;
  }
  
  // マークダウンファイル要素を作成
  function createMarkdownFileElement(name, path) {
    const element = document.createElement('div');
    element.className = 'file-item markdown';
    element.innerHTML = `
      <span class="material-icons">description</span>
      <span class="file-name">${name}</span>
    `;
    
    element.addEventListener('click', () => {
      requestFile(path);
    });
    
    return element;
  }
  
  // その他のファイル要素を作成
  function createOtherFileElement(name, path) {
    const element = document.createElement('div');
    element.className = 'file-item';
    element.innerHTML = `
      <span class="material-icons">insert_drive_file</span>
      <span class="file-name">${name}</span>
    `;
    
    element.addEventListener('click', () => {
      openInEditor(path);
    });
    
    return element;
  }
  
  // ディレクトリを要求
  function requestDirectory(path) {
    vscode.postMessage({
      command: 'getDirectory',
      path: path
    });
  }
  
  // ファイルを要求
  function requestFile(path) {
    vscode.postMessage({
      command: 'openFile',
      path: path
    });
  }
  
  // エディタでファイルを開く
  function openInEditor(path) {
    vscode.postMessage({
      command: 'openInEditor',
      path: path
    });
  }
  
  // マークダウンを表示
  function displayMarkdown(content, fileName) {
    // ファイル名を表示
    currentFile.textContent = fileName;
    
    // マークダウンをHTMLに変換
    let html;
    if (window.simpleMarkdownConverter && typeof window.simpleMarkdownConverter.convertMarkdownToHtml === 'function') {
      html = window.simpleMarkdownConverter.convertMarkdownToHtml(content);
    } else {
      html = convertMarkdownToHtml(content);
    }
    
    // 内容を表示
    markdownContent.innerHTML = html;
  }
  
  // パス表示を更新
  function updatePathDisplay(path) {
    // パスセグメントに分割して表示
    const segments = path.split('/').filter(segment => segment);
    
    currentPath.innerHTML = '';
    
    // ルートディレクトリ
    const rootElement = document.createElement('span');
    rootElement.className = 'breadcrumb-item clickable';
    rootElement.textContent = '/';
    rootElement.addEventListener('click', () => {
      requestDirectory('/');
    });
    currentPath.appendChild(rootElement);
    
    // 各セグメントを表示
    let currentPathAcc = '';
    segments.forEach((segment, index) => {
      // セパレータ
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '/';
      currentPath.appendChild(separator);
      
      // パスセグメント
      currentPathAcc += '/' + segment;
      const segmentElement = document.createElement('span');
      segmentElement.className = 'breadcrumb-item' + (index === segments.length - 1 ? '' : ' clickable');
      segmentElement.textContent = segment;
      
      // 最後のセグメント以外はクリック可能に
      if (index < segments.length - 1) {
        const pathToUse = currentPathAcc;
        segmentElement.addEventListener('click', () => {
          requestDirectory(pathToUse);
        });
      }
      
      currentPath.appendChild(segmentElement);
    });
  }
  
  // エラーを表示
  function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    document.body.appendChild(errorElement);
    
    // 5秒後に消去
    setTimeout(() => {
      errorElement.classList.add('fade-out');
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement);
        }
      }, 500);
    }, 5000);
  }
  
  // マークダウンの簡易変換関数（シンプルマークダウンコンバーターのバックアップ）
  function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // HTMLエスケープ
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // 基本的なマークダウン変換
    let html = escaped
      // 見出し
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      
      // リスト
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.+<\/li>\n)+/gs, '<ul>$&</ul>')
      
      // 強調
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      
      // リンク
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      
      // コードブロック
      .replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>');
    
    return html;
  }
  
  // 初期化を実行
  document.addEventListener('DOMContentLoaded', initialize);
})();
```

### 5. CSS実装

`media/markdownViewer/css/markdownViewer.css` を作成：

```css
/* マークダウンビューアのレイアウト */
.markdown-viewer-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background-color: #f8f9fa;
  color: #333333;
}

/* ファイルブラウザ部分 */
.file-browser {
  width: 300px;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}

.file-browser-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-browser-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.breadcrumb-path {
  padding: 8px 16px;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
  overflow-x: auto;
  font-size: 14px;
}

.breadcrumb-item {
  color: #333333;
}

.breadcrumb-item.clickable {
  color: #4a69bd;
  cursor: pointer;
}

.breadcrumb-item.clickable:hover {
  text-decoration: underline;
}

.breadcrumb-separator {
  margin: 0 4px;
  color: #718096;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-item:hover {
  background-color: #f1f5fd;
}

.file-item .material-icons {
  margin-right: 8px;
  font-size: 20px;
}

.file-item.directory .material-icons {
  color: #ffc107;
}

.file-item.markdown .material-icons {
  color: #4a69bd;
}

.file-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* マークダウン表示部分 */
.markdown-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #ffffff;
}

.markdown-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.markdown-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.markdown-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  line-height: 1.6;
}

/* エラーメッセージ */
.error-message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #e74c3c;
  color: white;
  padding: 12px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: fade-in 0.3s ease-out;
}

.error-message.fade-out {
  animation: fade-out 0.5s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fade-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(20px); }
}

/* ボタン */
.button-secondary {
  background-color: #ffffff;
  color: #4a69bd;
  border: 1px solid #4a69bd;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.button-secondary:hover {
  background-color: #f1f5fd;
}

/* 読み込み中表示 */
.loading {
  text-align: center;
  padding: 20px;
  color: #718096;
}
```

### 6. ファイルブラウザからの連携

`src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts` の `openMarkdownInTab` ハンドラを修正：

```typescript
// openMarkdownInTab ハンドラー（マークダウンファイルを専用ビューで開く）
this.registerHandler('openMarkdownInTab', async (message: Message, panel: vscode.WebviewPanel) => {
  if (!message.filePath) {
    Logger.warn('MessageDispatchServiceImpl: openMarkdownInTabメッセージにfilePath必須パラメータがありません');
    this.showError(panel, 'ファイルパスが指定されていません');
    return;
  }
  
  try {
    Logger.info(`MessageDispatchServiceImpl: マークダウンファイルを専用ビューで開きます: ${message.filePath}`);
    
    // マークダウンビューアを開く
    vscode.commands.executeCommand('appgenius.openMarkdownViewer', message.filePath);
    
    // 成功メッセージを表示
    this.showSuccess(panel, `マークダウンビューアでファイルを開きました: ${path.basename(message.filePath)}`);
    
    Logger.info(`MessageDispatchServiceImpl: マークダウンビューアでファイルを開きました: ${message.filePath}`);
  } catch (error) {
    Logger.error(`MessageDispatchServiceImpl: マークダウンビューア起動中にエラーが発生しました: ${message.filePath}`, error as Error);
    this.showError(panel, `マークダウンビューアの起動に失敗しました: ${(error as Error).message}`);
  }
});
```

## 参考資料

### 既存コード

- `/media/components/fileBrowser/fileBrowser.js` - ファイル一覧表示のロジック
- `/src/ui/mockupGallery/MockupGalleryPanel.ts` - 同様の独立パネルの実装例
- `/media/utils/simpleMarkdownConverter.js` - マークダウン変換ロジック
- `/media/design-system.css` - 共通スタイル定義

### 既存モックアップ

- `/mockups/file-browser-with-markdown.html` - 基本UI設計

## 参考ファイルからの具体的な実装例

### ファイル一覧表示の実装例

現在の `fileBrowser.js` の実装では以下のように実装されています：

```javascript
// ファイルリストを更新
updateFileList(files, fromCache = false) {
  if (!this.fileListElement) return;
  
  // ファイルリストを保存
  this.fileList = files || [];
  
  // 表示をクリア
  this.fileListElement.innerHTML = '';
  
  // ディレクトリとファイルを分類
  const directories = files.filter(file => file.isDirectory);
  const regularFiles = files.filter(file => !file.isDirectory);
  
  // ディレクトリを先に表示
  directories.forEach(dir => {
    const dirItem = this._createDirectoryElement(dir);
    this.fileListElement.appendChild(dirItem);
  });
  
  // 通常ファイルを表示
  regularFiles.forEach(file => {
    const fileItem = this._createFileElement(file);
    this.fileListElement.appendChild(fileItem);
  });
}
```

### マークダウンレンダリングの実装例

`simpleMarkdownConverter.js` の実装では次のようにマークダウンをHTMLに変換しています：

```javascript
// マークダウンをHTMLに変換
convertMarkdownToHtml(markdown) {
  if (!markdown) return '';
  
  // マークダウン要素を変換
  let html = markdown
    // 見出し
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // その他の変換処理...
  
  return html;
}
```

## 今後の改善点

1. **検索機能の追加** - ファイル一覧に検索機能を追加して大きなプロジェクトでの使用性を向上させる
2. **テーマ対応** - VSCodeのテーマに合わせた表示の実装
3. **ファイルタイプのフィルタリング** - マークダウン以外のファイルタイプにも対応
4. **プレビュー自動更新** - ファイル変更時の自動更新機能

## 制限事項

- 初期版では、マークダウンファイルの編集機能は含まれません（表示のみ）
- 大量のファイルがあるディレクトリでは、パフォーマンスに影響がある可能性があります
- 画像などの埋め込みファイルの参照パスには制限があります

## タスクリスト（詳細）

1. **準備フェーズ**
   - [ ] モックアップを静的HTMLとCSSに変換する（1日目 - 2時間）
   - [ ] 必要なディレクトリとファイルを作成する（1日目 - 30分）

2. **バックエンド実装**
   - [ ] MarkdownViewerPanelクラスの作成（1日目 - 3時間）
   - [ ] コマンド登録と初期化処理の実装（1日目 - 1時間）
   - [ ] ファイル操作関連の処理実装（2日目 - 2時間）

3. **フロントエンド実装**
   - [ ] CSS実装（2日目 - 2時間）
   - [ ] JavaScript実装（2日目 - 3時間）
   - [ ] マークダウン表示機能の統合（3日目 - 2時間）

4. **統合とテスト**
   - [ ] ファイルブラウザからの連携テスト（3日目 - 1時間）
   - [ ] 表示とナビゲーションのテスト（3日目 - 1時間）
   - [ ] バグ修正と調整（3日目 - 2時間）

## 完成基準

以下の機能が正常に動作していることを確認:

1. ファイルブラウザからマークダウンファイルをクリックすると、専用ビューアで開く
2. ファイル一覧ナビゲーションが正常に動作する
3. マークダウンファイルが正しく整形されて表示される
4. ディレクトリ間の移動ができる
5. 表示中のファイルをエディタで開ける