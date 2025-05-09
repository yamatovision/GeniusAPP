import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';

/**
 * マークダウンビューアパネルクラス
 * マークダウンファイルを専用のビューで表示するためのWebViewパネルを管理
 */
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
    return MarkdownViewerPanel.currentPanel;
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

    // テンプレートを読み込んでプレースホルダーを置換
    try {
      const templatePath = path.join(this._extensionUri.fsPath, 'media', 'markdownViewer', 'template.html');
      let templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // プレースホルダー置換
      templateContent = templateContent
        .replace(/{{cspSource}}/g, webview.cspSource)
        .replace(/{{nonce}}/g, nonce)
        .replace(/{{styleUri}}/g, styleUri.toString())
        .replace(/{{scriptUri}}/g, scriptUri.toString())
        .replace(/{{mdConverterUri}}/g, mdConverterUri.toString())
        .replace(/{{designSystemUri}}/g, designSystemUri.toString());
        
      return templateContent;
    } catch (error) {
      Logger.error('MarkdownViewerPanel: テンプレートの読み込みに失敗しました', error as Error);
      
      // フォールバックとして埋め込みテンプレートを返す
      return `<!DOCTYPE html>
      <html lang="ja">
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
              <div class="action-buttons">
                <button id="edit-button" class="button-secondary">
                  <span class="icon">編集</span>
                </button>
              </div>
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
  }

  /**
   * WebViewからのメッセージを処理
   */
  private async _handleMessage(message: any) {
    try {
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
        case 'updateCheckbox':
          await this._updateCheckbox(message.filePath, message.checked, message.index);
          break;
      }
    } catch (error) {
      Logger.error('MarkdownViewerPanel: メッセージ処理中にエラーが発生しました', error as Error);
      this._showError(`操作中にエラーが発生しました: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリの内容を取得してWebViewに送信
   */
  private async _getDirectory(dirPath: string) {
    try {
      // パスが指定されていない場合は初期ディレクトリを表示
      const targetPath = dirPath || (this._initialFilePath ? path.dirname(this._initialFilePath) : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
      
      if (!targetPath) {
        this._showError('ディレクトリが指定されていません');
        return;
      }

      // ディレクトリが存在するか確認
      if (!fs.existsSync(targetPath)) {
        this._showError(`ディレクトリが存在しません: ${targetPath}`);
        return;
      }

      // ディレクトリの内容を取得
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      
      // ファイルとディレクトリの情報を整形
      const files = entries.map(entry => {
        const entryPath = path.join(targetPath, entry.name);
        const stats = fs.statSync(entryPath);
        
        return {
          name: entry.name,
          path: entryPath,
          isDirectory: entry.isDirectory(),
          lastModified: stats.mtime.toISOString(),
          size: stats.size
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
        currentPath: targetPath
      });
      
      // パネルのタイトルを更新
      this._panel.title = `Markdown: ${path.basename(targetPath)}`;
      
    } catch (error) {
      this._showError(`ディレクトリの読み込みエラー: ${(error as Error).message}`);
      Logger.error(`MarkdownViewerPanel: ディレクトリの読み込みエラー: ${dirPath}`, error as Error);
    }
  }

  /**
   * ファイルを読み込んでWebViewに送信
   */
  private async _loadFile(filePath: string) {
    try {
      // ファイルパスのログ出力と正規化
      Logger.info(`MarkdownViewerPanel: ファイル読み込み開始: ${filePath}`);
      
      // ファイルパスの正規化（ファイル名とパスの区切り文字の修正）
      // 例：CURRENT_STATUS3md → CURRENT_STATUS3.md
      if (!filePath.includes('.') && !filePath.endsWith('.md')) {
        const dirName = path.dirname(filePath);
        const baseName = path.basename(filePath);
        
        // ベース名に.mdが含まれていない場合、追加する
        if (baseName.toLowerCase().includes('md') && !baseName.includes('.')) {
          const correctedName = baseName.replace(/([A-Za-z0-9]+)(md)$/i, '$1.$2');
          filePath = path.join(dirName, correctedName);
          Logger.info(`MarkdownViewerPanel: ファイルパスを修正しました: ${filePath}`);
        }
      }
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        Logger.error(`MarkdownViewerPanel: ファイルが存在しません: ${filePath}`);
        this._showError(`ファイルが存在しません: ${filePath}`);
        return;
      }

      // ファイルの拡張子を確認
      if (!filePath.toLowerCase().endsWith('.md')) {
        Logger.info(`MarkdownViewerPanel: マークダウン以外のファイルなのでエディタで開きます: ${filePath}`);
        // マークダウン以外のファイルはエディタで開く
        this._openInEditor(filePath);
        return;
      }

      // ファイルの内容を読み込む
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      const directoryPath = path.dirname(filePath);

      // WebViewにファイル内容を送信
      this._panel.webview.postMessage({
        command: 'showFile',
        content: content,
        fileName: fileName,
        filePath: filePath
      });

      // パネルのタイトルを更新
      this._panel.title = `Markdown: ${fileName}`;
      
      // 現在のディレクトリも更新
      this._getDirectory(directoryPath);
      
    } catch (error) {
      this._showError(`ファイルの読み込みエラー: ${(error as Error).message}`);
      Logger.error(`MarkdownViewerPanel: ファイルの読み込みエラー: ${filePath}`, error as Error);
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
      this._showError(`エディタでファイルを開けませんでした: ${(error as Error).message}`);
      Logger.error(`MarkdownViewerPanel: エディタでファイルを開くエラー: ${filePath}`, error as Error);
    }
  }

  /**
   * チェックボックスの状態を更新
   */
  private async _updateCheckbox(filePath: string, checked: boolean, index: number) {
    try {
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        this._showError(`ファイルが存在しません: ${filePath}`);
        return;
      }

      // この機能は未実装です
      // 実際にはマークダウン内のチェックボックスを検出して更新する必要があります
      vscode.window.showInformationMessage('チェックボックスの更新は現在サポートされていません。');
      
    } catch (error) {
      this._showError(`チェックボックスの更新に失敗しました: ${(error as Error).message}`);
      Logger.error(`MarkdownViewerPanel: チェックボックスの更新エラー: ${filePath}`, error as Error);
    }
  }

  /**
   * WebViewにエラーメッセージを表示
   */
  private _showError(message: string) {
    this._panel.webview.postMessage({
      command: 'error',
      message: message
    });
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