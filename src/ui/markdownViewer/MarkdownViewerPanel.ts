import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { FileSystemServiceImpl } from '../scopeManager/services/implementations/FileSystemServiceImpl';
import { ProjectServiceImpl } from '../scopeManager/services/implementations/ProjectServiceImpl';
import { IMessageDispatchService } from '../scopeManager/services/interfaces/IMessageDispatchService';
import { Message } from '../scopeManager/services/interfaces/common';
import { IProjectDocument } from '../scopeManager/types/ScopeManagerTypes';

/**
 * マークダウンビューワーパネルクラス
 * ファイルブラウザとマークダウン表示機能を提供する
 */
export class MarkdownViewerPanel {
  public static readonly viewType = 'appgenius.markdownViewer';

  private static _currentPanel: MarkdownViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _fileSystemService: FileSystemServiceImpl;
  private _projectService: ProjectServiceImpl;
  private _currentProjectPath: string = '';
  private _currentFilePath: string = '';
  private _fileWatcher: vscode.Disposable | null = null;
  private _messageDispatchService: IMessageDispatchService | null = null;
  
  // 分割ビュー用の状態
  private _isSplitView: boolean = false;
  private _leftPaneFilePath: string = '';
  private _rightPaneFilePath: string = '';

  // 公開メソッドを追加
  public setCurrentProjectPath(projectPath: string): void {
    if (projectPath && projectPath !== this._currentProjectPath) {
      this._currentProjectPath = projectPath;
      this._refreshFileList();
      this._setupFileWatcher();
      Logger.info(`MarkdownViewerPanel: プロジェクトパスを設定しました: ${projectPath}`);
    }
  }

  /**
   * パネルが既に存在する場合はそれを表示し、存在しない場合は新しいパネルを作成
   * @param extensionUri 拡張機能のURI
   * @param messageDispatchService メッセージディスパッチサービス
   * @returns MarkdownViewerPanelのインスタンス
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    messageDispatchService?: IMessageDispatchService
  ): MarkdownViewerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    try {
      // パネルが既に存在する場合は、それを表示
      if (MarkdownViewerPanel._currentPanel) {
        Logger.info('MarkdownViewerPanel: 既存のパネルを表示します');
        MarkdownViewerPanel._currentPanel._panel.reveal(column);
        return MarkdownViewerPanel._currentPanel;
      }

      Logger.info('MarkdownViewerPanel: 新しいパネルを作成します');

      // 新しいパネルを作成
      const panel = vscode.window.createWebviewPanel(
        MarkdownViewerPanel.viewType,
        'ファイルブラウザ＆マークダウンビューワー',
        column || vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'dist'),
          ],
        }
      );

      // 新しいインスタンスを作成
      MarkdownViewerPanel._currentPanel = new MarkdownViewerPanel(panel, extensionUri, messageDispatchService);
      Logger.info('MarkdownViewerPanel: 新しいインスタンスを作成しました');
      return MarkdownViewerPanel._currentPanel;
    } catch (error) {
      Logger.error('MarkdownViewerPanel: createOrShowでエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * コンストラクタ
   * @param panel WebViewパネル
   * @param extensionUri 拡張機能のURI
   * @param messageDispatchService メッセージディスパッチサービス（オプション）
   */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    messageDispatchService?: IMessageDispatchService
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._messageDispatchService = messageDispatchService || null;

    // サービスの初期化
    this._initializeServices();

    // WebViewの内容を設定
    this._setWebviewContent();

    // パネルが破棄されたときのイベントを登録
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage((message) => {
      this._handleMessage(message);
    });

    // VSCodeのウィンドウ状態変更イベントを処理
    vscode.window.onDidChangeWindowState(
      (e) => {
        if (e.focused) {
          this._refreshContent();
        }
      },
      null,
      this._disposables
    );

    // プロジェクトパスの変更をリッスン
    this._setupProjectPathListener();

    // 初期コンテンツの読み込み
    this._initializeContent();

    Logger.info('MarkdownViewerPanel: パネルが作成されました');
  }

  /**
   * サービスの初期化
   */
  private _initializeServices(): void {
    try {
      // FileSystemServiceImplのインスタンスを取得
      this._fileSystemService = FileSystemServiceImpl.getInstance();

      // FileSystemServiceImplにメッセージハンドラを登録
      if (this._messageDispatchService) {
        this._fileSystemService.registerMessageHandlers(this._messageDispatchService);
      }

      // プロジェクトサービスのインスタンスを取得
      this._projectService = ProjectServiceImpl.getInstance(this._fileSystemService);

      Logger.info('MarkdownViewerPanel: サービスが初期化されました');
    } catch (error) {
      Logger.error('MarkdownViewerPanel: サービスの初期化に失敗しました', error as Error);
      vscode.window.showErrorMessage('マークダウンビューワーの初期化に失敗しました');
    }
  }

  /**
   * WebViewの内容を設定
   */
  private _setWebviewContent(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * WebView用のHTMLを生成
   * @param webview WebView
   * @returns HTMLコンテンツ
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // 各リソースのURIを取得
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'markdownViewer', 'markdownViewer.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'markdownViewer', 'markdownViewer.css')
    );

    const designSystemUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css')
    );

    // スコープマネージャーのCSSを優先的に読み込む（スタイルを完全に合わせるため）
    const scopeManagerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.css')
    );

    const materialIconsUri = 'https://fonts.googleapis.com/icon?family=Material+Icons';

    // nonce: スクリプトインジェクション攻撃を防ぐためのランダムな文字列
    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ファイルブラウザ＆マークダウンビューワー</title>

        <meta http-equiv="Content-Security-Policy" content="
          default-src 'none';
          style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com;
          font-src ${webview.cspSource} https://fonts.gstatic.com;
          script-src 'nonce-${nonce}';
          img-src ${webview.cspSource} https: data:;
        ">

        <link href="${designSystemUri}" rel="stylesheet">
        <link href="${scopeManagerUri}" rel="stylesheet">
        <link href="${styleUri}" rel="stylesheet">
        <link href="${materialIconsUri}" rel="stylesheet">
      </head>
      <body>
        <div class="app-container">
          <!-- ファイルブラウザパネル -->
          <div class="file-browser-panel" id="filePanel">
            <div class="file-browser-header">
              <div class="file-browser-title">ファイルブラウザ</div>
              <button class="toggle-panel-btn" id="toggleFilePanel" title="パネルを開閉">
                <span class="material-icons">chevron_left</span>
              </button>
            </div>
            <div class="file-filter-container">
              <span class="material-icons filter-icon">search</span>
              <input type="text" class="file-filter-input" id="fileFilter" placeholder="ファイルを検索...">
            </div>
            <div class="file-browser-content">
              <ul class="file-list" id="fileList">
                <div class="loading">
                  <div class="spinner"></div>
                </div>
              </ul>
            </div>
          </div>

          <!-- メインコンテンツエリア -->
          <div class="content-area">
            <div class="content-header">
              <div class="current-file-path" id="currentFilePath">ファイルが選択されていません</div>
              <div class="content-actions">
                <!-- 分割表示ボタンを追加 -->
                <button class="button button-toggle" id="splitViewButton" title="分割表示の切り替え">
                  <span class="material-icons">vertical_split</span>
                  <span>分割表示</span>
                </button>
                <button class="button button-secondary" id="refreshButton">
                  <span class="material-icons">refresh</span>
                  <span>更新</span>
                </button>
                <button class="button button-primary" id="editButton">
                  <span class="material-icons">edit</span>
                  <span>編集</span>
                </button>
              </div>
            </div>
            <div class="content-body">
              <!-- 単一表示モード -->
              <div id="singleViewContainer" class="view-container active">
                <div id="markdownContent" class="markdown-content">
                  <div class="no-file-selected">
                    <span class="material-icons icon">description</span>
                    <h2>ファイルが選択されていません</h2>
                    <p>左側のファイルブラウザからファイルを選択してください。</p>
                  </div>
                </div>
              </div>

              <!-- 分割表示モード -->
              <div id="splitViewContainer" class="view-container split-view">
                <!-- 分割コンテンツエリア -->
                <div class="split-content">
                  <div id="leftPane" class="pane">
                    <div class="pane-header">
                      <div class="pane-file-path" id="leftPaneFilePath">左ペイン</div>
                      <div class="pane-actions">
                        <button class="button-icon" id="leftPaneRefreshButton" title="更新">
                          <span class="material-icons">refresh</span>
                        </button>
                        <button class="button-icon" id="leftPaneEditButton" title="編集">
                          <span class="material-icons">edit</span>
                        </button>
                      </div>
                    </div>
                    <div id="leftMarkdownContent" class="markdown-content">
                      <div class="no-file-selected">
                        <span class="material-icons icon">description</span>
                        <h2>ファイルが選択されていません</h2>
                        <p>左側のファイルブラウザからファイルを選択してください。</p>
                      </div>
                    </div>
                  </div>

                  <div class="pane-resizer" id="paneResizer"></div>

                  <div id="rightPane" class="pane">
                    <div class="pane-header">
                      <div class="pane-file-path" id="rightPaneFilePath">右ペイン</div>
                      <div class="pane-actions">
                        <button class="button-icon" id="rightPaneRefreshButton" title="更新">
                          <span class="material-icons">refresh</span>
                        </button>
                        <button class="button-icon" id="rightPaneEditButton" title="編集">
                          <span class="material-icons">edit</span>
                        </button>
                      </div>
                    </div>
                    <div id="rightMarkdownContent" class="markdown-content">
                      <div class="no-file-selected">
                        <span class="material-icons icon">description</span>
                        <h2>ファイルが選択されていません</h2>
                        <p>左側のファイルブラウザからファイルを選択してください。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  /**
   * プロジェクトパスのリスナーを設定
   */
  private _setupProjectPathListener(): void {
    try {
      // プロジェクト選択イベントをリッスン
      this._projectService.onProjectSelected((projectInfo) => {
        this._onProjectChanged(projectInfo.path);
      });
      
      Logger.info('MarkdownViewerPanel: プロジェクトパスリスナーが設定されました');
    } catch (error) {
      Logger.error('MarkdownViewerPanel: プロジェクトパスリスナーの設定に失敗しました', error as Error);
    }
  }

  /**
   * プロジェクト変更時の処理
   * @param projectPath 新しいプロジェクトパス
   */
  private _onProjectChanged(projectPath: string): void {
    if (projectPath === this._currentProjectPath) {
      return;
    }

    this._currentProjectPath = projectPath;
    this._refreshFileList();
    
    // ファイル監視を更新
    this._setupFileWatcher();
    
    Logger.info(`MarkdownViewerPanel: プロジェクトパスが変更されました: ${projectPath}`);
  }

  /**
   * ファイル監視を設定
   */
  private _setupFileWatcher(): void {
    try {
      // 既存のファイル監視を解放
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
        this._fileWatcher = null;
      }

      if (!this._currentProjectPath) {
        return;
      }

      // プロジェクトディレクトリのファイル変更を監視
      this._fileWatcher = this._fileSystemService.setupProjectFileWatcher(
        this._currentProjectPath,
        (filePath) => {
          // ファイル変更時の処理
          this._refreshFileList();
          
          // 現在表示中のファイルの変更を監視
          if (this._isSplitView) {
            // 分割表示モードの場合
            if (filePath === this._leftPaneFilePath) {
              this._loadFileContentForPane(filePath, 'left');
            }
            if (filePath === this._rightPaneFilePath) {
              this._loadFileContentForPane(filePath, 'right');
            }
          } else {
            // 通常モードの場合
            if (filePath === this._currentFilePath) {
              this._loadFileContent(filePath);
            }
          }
        }
      );
      
      Logger.info(`MarkdownViewerPanel: ファイル監視が設定されました: ${this._currentProjectPath}`);
    } catch (error) {
      Logger.error('MarkdownViewerPanel: ファイル監視の設定に失敗しました', error as Error);
    }
  }

  /**
   * 初期コンテンツの読み込み
   */
  private _initializeContent(): void {
    try {
      // 現在のプロジェクトパスを取得
      this._currentProjectPath = this._projectService.getActiveProjectPath();

      if (!this._currentProjectPath) {
        // アクティブなプロジェクトがない場合はワークスペースフォルダを使用
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          this._currentProjectPath = workspaceFolders[0].uri.fsPath;
        }
      }

      if (this._currentProjectPath) {
        this._refreshFileList();
        this._setupFileWatcher();
        Logger.info(`MarkdownViewerPanel: 初期コンテンツを読み込みました: ${this._currentProjectPath}`);
      } else {
        this._sendMessageToWebview({
          command: 'showError',
          message: 'プロジェクトが選択されていません'
        });
        Logger.warn('MarkdownViewerPanel: プロジェクトが選択されていません');
      }
    } catch (error) {
      Logger.error('MarkdownViewerPanel: 初期コンテンツの読み込みに失敗しました', error as Error);
    }
  }

  /**
   * ファイルリストを更新
   */
  private _refreshFileList(): void {
    try {
      if (!this._currentProjectPath) {
        return;
      }

      // ファイルリスト取得を開始したことをWebViewに通知
      this._sendMessageToWebview({
        command: 'startLoading',
      });

      // ディレクトリ内のファイルとフォルダを一覧取得
      this._fileSystemService.listDirectory(this._currentProjectPath, false)
        .then((files) => {
          // WebViewにファイルリストを送信
          this._sendMessageToWebview({
            command: 'updateFileList',
            files: files,
            currentPath: this._currentProjectPath
          });
          
          Logger.debug(`MarkdownViewerPanel: ファイルリストを更新しました (${files.length}件)`);
        })
        .catch((error) => {
          this._sendMessageToWebview({
            command: 'showError',
            message: `ファイルリストの取得に失敗しました: ${error.message}`
          });
          
          Logger.error('MarkdownViewerPanel: ファイルリストの取得に失敗しました', error);
        });
    } catch (error) {
      Logger.error('MarkdownViewerPanel: ファイルリスト更新中にエラーが発生しました', error as Error);
    }
  }

  /**
   * ファイル内容を読み込む
   * @param filePath 読み込むファイルパス
   */
  private _loadFileContent(filePath: string): void {
    try {
      if (!filePath) {
        return;
      }

      // ファイルの存在確認
      this._fileSystemService.fileExists(filePath)
        .then((exists) => {
          if (!exists) {
            this._sendMessageToWebview({
              command: 'showError',
              message: `ファイルが見つかりません: ${filePath}`
            });
            return;
          }

          // ファイルタイプを取得
          const fileType = this._fileSystemService.getFileType(filePath);
          
          // ファイルの内容を読み込む
          this._fileSystemService.readFile(filePath, fileType)
            .then((content) => {
              // WebViewにファイル内容を送信
              this._sendMessageToWebview({
                command: 'updateFileContent',
                content: content,
                filePath: filePath,
                fileType: fileType
              });
              
              // 現在のファイルパスを更新
              this._currentFilePath = filePath;
              
              Logger.debug(`MarkdownViewerPanel: ファイル内容を読み込みました: ${filePath}`);
            })
            .catch((error) => {
              this._sendMessageToWebview({
                command: 'showError',
                message: `ファイルの読み込みに失敗しました: ${error.message}`
              });
              
              Logger.error(`MarkdownViewerPanel: ファイルの読み込みに失敗しました: ${filePath}`, error);
            });
        })
        .catch((error) => {
          this._sendMessageToWebview({
            command: 'showError',
            message: `ファイルの存在確認に失敗しました: ${error.message}`
          });
          
          Logger.error(`MarkdownViewerPanel: ファイルの存在確認に失敗しました: ${filePath}`, error);
        });
    } catch (error) {
      Logger.error(`MarkdownViewerPanel: ファイル内容読み込み中にエラーが発生しました: ${filePath}`, error as Error);
    }
  }

  /**
   * 指定されたペインにファイル内容を読み込む
   * @param filePath 読み込むファイルパス
   * @param pane ペイン名（'left'または'right'）
   */
  private _loadFileContentForPane(filePath: string, pane: string): void {
    try {
      if (!filePath) {
        return;
      }

      this._fileSystemService.fileExists(filePath)
        .then((exists) => {
          if (!exists) {
            this._sendMessageToWebview({
              command: 'showError',
              message: `ファイルが見つかりません: ${filePath}`
            });
            return;
          }

          const fileType = this._fileSystemService.getFileType(filePath);

          this._fileSystemService.readFile(filePath, fileType)
            .then((content) => {
              // WebViewにファイル内容を送信（ペイン情報付き）
              this._sendMessageToWebview({
                command: 'updatePaneContent',
                content: content,
                filePath: filePath,
                fileType: fileType,
                pane: pane
              });

              // ペイン別のファイルパスを更新
              if (pane === 'left') {
                this._leftPaneFilePath = filePath;
              } else {
                this._rightPaneFilePath = filePath;
              }

              Logger.debug(`MarkdownViewerPanel: ${pane}ペインにファイル内容を読み込みました: ${filePath}`);
            })
            .catch((error) => {
              this._sendMessageToWebview({
                command: 'showError',
                message: `ファイルの読み込みに失敗しました: ${error.message}`
              });
            });
        })
        .catch((error) => {
          // エラーハンドリング
        });
    } catch (error) {
      Logger.error(`MarkdownViewerPanel: ペイン用ファイル内容読み込み中にエラーが発生しました: ${filePath}`, error as Error);
    }
  }

  /**
   * コンテンツを更新
   */
  private _refreshContent(): void {
    this._refreshFileList();
    
    if (this._isSplitView) {
      // 分割表示モードの場合、両方のペインを更新
      if (this._leftPaneFilePath) {
        this._loadFileContentForPane(this._leftPaneFilePath, 'left');
      }
      if (this._rightPaneFilePath) {
        this._loadFileContentForPane(this._rightPaneFilePath, 'right');
      }
    } else {
      // 通常モードの場合
      if (this._currentFilePath) {
        this._loadFileContent(this._currentFilePath);
      }
    }
  }

  /**
   * WebViewからのメッセージを処理
   * @param message WebViewからのメッセージ
   */
  private _handleMessage(message: Message): void {
    try {
      switch (message.command) {
        case 'readFile':
          if (message.filePath) {
            if (message.pane) {
              // ペイン指定付きでファイルを読み込む
              this._loadFileContentForPane(message.filePath, message.pane);
            } else {
              // 通常のファイル読み込み
              this._loadFileContent(message.filePath);
            }
          }
          break;
          
        case 'listDirectory':
          if (message.path) {
            this._fileSystemService.listDirectory(message.path, false)
              .then((files) => {
                this._sendMessageToWebview({
                  command: 'updateFileList',
                  files: files,
                  currentPath: message.path
                });
              })
              .catch((error) => {
                this._sendMessageToWebview({
                  command: 'showError',
                  message: `ディレクトリの読み込みに失敗しました: ${error.message}`
                });
              });
          }
          break;
          
        case 'openFileInEditor':
          if (message.filePath) {
            this._fileSystemService.openFileInEditor(message.filePath)
              .catch((error) => {
                this._sendMessageToWebview({
                  command: 'showError',
                  message: `エディタでファイルを開けませんでした: ${error.message}`
                });
              });
          }
          break;
          
        case 'refreshFileList':
          this._refreshFileList();
          break;
          
        case 'refreshContent':
          this._refreshContent();
          break;
          
        case 'showFileOpenMenu':
          // ファイルを開くメニューを表示
          vscode.window.showQuickPick([
            { label: '左ペインで開く', value: 'left' },
            { label: '右ペインで開く', value: 'right' }
          ]).then(selection => {
            if (selection) {
              // 選択結果をWebViewに送信
              this._sendMessageToWebview({
                command: 'fileOpenMenuResult',
                filePath: message.filePath,
                option: selection.label
              });
              
              this._isSplitView = true;
            }
          });
          break;

        case 'showPaneSelectDialog':
          // 分割モード解除時のペイン選択ダイアログ
          vscode.window.showQuickPick([
            { label: '左ペインを保持', description: path.basename(message.leftFile || '未選択'), value: 'left' },
            { label: '右ペインを保持', description: path.basename(message.rightFile || '未選択'), value: 'right' }
          ]).then(selection => {
            if (selection) {
              // 選択結果をWebViewに送信
              this._sendMessageToWebview({
                command: 'paneSelectResult',
                pane: selection.value
              });
              
              this._isSplitView = false;
              
              // 選択されたペインのファイルパスを現在のファイルパスとして設定
              this._currentFilePath = selection.value === 'left' ? this._leftPaneFilePath : this._rightPaneFilePath;
            }
          });
          break;
          
        default:
          Logger.warn(`MarkdownViewerPanel: 未知のコマンドを受信: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`MarkdownViewerPanel: メッセージ処理中にエラーが発生しました: ${message.command}`, error as Error);
    }
  }

  /**
   * WebViewにメッセージを送信
   * @param message 送信するメッセージ
   */
  private _sendMessageToWebview(message: any): void {
    try {
      this._panel.webview.postMessage(message);
    } catch (error) {
      Logger.error(`MarkdownViewerPanel: WebViewへのメッセージ送信に失敗しました: ${message.command}`, error as Error);
    }
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    // パネルの参照を削除
    MarkdownViewerPanel._currentPanel = undefined;

    // WebViewパネルを破棄
    this._panel.dispose();

    // ファイル監視を解放
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }

    // ディスポーザブルを解放
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    Logger.info('MarkdownViewerPanel: リソースを解放しました');
  }
}

/**
 * nonce（暗号学的に安全な乱数）を生成
 * @returns nonce文字列
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}