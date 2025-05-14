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
 * ファイルビューワーパネルクラス
 * ファイルブラウザとファイル表示機能を提供する
 */
export class FileViewerPanel {
  public static readonly viewType = 'appgenius.fileViewer';

  private static _currentPanel: FileViewerPanel | undefined;
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
  /**
   * プロジェクトパスを設定してファイルリストとタイトルを更新
   * @param projectPath 新しいプロジェクトパス
   */
  public setCurrentProjectPath(projectPath: string): void {
    if (!projectPath) {
      Logger.warn('FileViewerPanel: 無効なプロジェクトパスが設定されました');
      return;
    }

    Logger.info(`FileViewerPanel: setCurrentProjectPathが呼び出されました: ${projectPath} (現在のパス: ${this._currentProjectPath})`);

    if (projectPath !== this._currentProjectPath) {
      // ProjectServiceImplを更新（利用可能な場合）
      try {
        // ProjectServiceImplのインスタンスを取得
        const { ProjectServiceImpl } = require('../scopeManager/services/implementations/ProjectServiceImpl');
        const projectService = ProjectServiceImpl.getInstance();

        // プロジェクト名を取得
        const projectName = path.basename(projectPath);

        // ProjectServiceImplを更新
        projectService.selectProject(projectName, projectPath);
        Logger.info(`FileViewerPanel: ProjectServiceImplを更新しました: ${projectName}, ${projectPath}`);
      } catch (error) {
        Logger.warn(`FileViewerPanel: ProjectServiceImplの更新に失敗しました: ${error}`);
      }

      // 内部状態を更新
      this._currentProjectPath = projectPath;

      // パネルのタイトルを更新
      this._panel.title = `ファイルビューワー: ${path.basename(projectPath)}`;

      // ファイルリストとウォッチャーを更新
      this._refreshFileList();
      this._setupFileWatcher();

      // WebViewにプロジェクト変更を通知
      this._sendMessageToWebview({
        command: 'projectChanged',
        projectPath: projectPath,
        projectName: path.basename(projectPath)
      });

      Logger.info(`FileViewerPanel: プロジェクトパスを更新しました: ${projectPath}`);
    } else {
      Logger.info(`FileViewerPanel: 同じプロジェクトパスが指定されました: ${projectPath}`);
    }
  }

  /**
   * パネルが既に存在する場合はそれを表示し、存在しない場合は新しいパネルを作成
   * @param extensionUri 拡張機能のURI
   * @param messageDispatchService メッセージディスパッチサービス
   * @param initialProjectPath 初期プロジェクトパス（オプション）
   * @returns FileViewerPanelのインスタンス
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    messageDispatchService?: IMessageDispatchService,
    initialProjectPath?: string
  ): FileViewerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    try {
      Logger.info(`FileViewerPanel: createOrShow呼び出し (initialProjectPath=${initialProjectPath || 'なし'})`);

      // パネルが既に存在する場合は、それを表示
      if (FileViewerPanel._currentPanel) {
        Logger.info('FileViewerPanel: 既存のパネルを表示します');
        FileViewerPanel._currentPanel._panel.reveal(column);

        // 初期プロジェクトパスが指定されている場合は、既存パネルのプロジェクトパスを更新
        if (initialProjectPath) {
          // 現在のパスと比較
          if (initialProjectPath !== FileViewerPanel._currentPanel._currentProjectPath) {
            Logger.info(`FileViewerPanel: プロジェクトパスを更新します: ${initialProjectPath} (現在のパス: ${FileViewerPanel._currentPanel._currentProjectPath})`);

            // パネルのタイトルを更新
            FileViewerPanel._currentPanel._panel.title = `ファイルビューワー: ${path.basename(initialProjectPath)}`;

            // プロジェクトパスを更新
            FileViewerPanel._currentPanel.setCurrentProjectPath(initialProjectPath);
          } else {
            Logger.info(`FileViewerPanel: 同じプロジェクトパスが指定されました: ${initialProjectPath}`);
          }
        } else {
          Logger.info('FileViewerPanel: 初期プロジェクトパスが指定されていません');
        }

        return FileViewerPanel._currentPanel;
      }

      Logger.info('FileViewerPanel: 新しいパネルを作成します');

      // 新しいパネルを作成（パネルタイトルにプロジェクト名を含める）
      const panelTitle = initialProjectPath
        ? `ファイルビューワー: ${path.basename(initialProjectPath)}`
        : 'ファイルビューワー';

      const panel = vscode.window.createWebviewPanel(
        FileViewerPanel.viewType,
        panelTitle,
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
      FileViewerPanel._currentPanel = new FileViewerPanel(panel, extensionUri, messageDispatchService, initialProjectPath);
      Logger.info(`FileViewerPanel: 新しいインスタンスを作成しました${initialProjectPath ? ` (初期プロジェクトパス: ${initialProjectPath})` : ''}`);
      return FileViewerPanel._currentPanel;
    } catch (error) {
      Logger.error('FileViewerPanel: createOrShowでエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * コンストラクタ
   * @param panel WebViewパネル
   * @param extensionUri 拡張機能のURI
   * @param messageDispatchService メッセージディスパッチサービス（オプション）
   * @param initialProjectPath 初期プロジェクトパス（オプション）
   */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    messageDispatchService?: IMessageDispatchService,
    initialProjectPath?: string
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

    // 初期プロジェクトパスが指定されている場合は、それを使用
    if (initialProjectPath) {
      this._currentProjectPath = initialProjectPath;
      Logger.info(`FileViewerPanel: 初期プロジェクトパスを設定しました: ${initialProjectPath}`);
    }

    // 初期コンテンツの読み込み
    this._initializeContent();

    Logger.info('FileViewerPanel: パネルが作成されました');
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

      Logger.info('FileViewerPanel: サービスが初期化されました');
    } catch (error) {
      Logger.error('FileViewerPanel: サービスの初期化に失敗しました', error as Error);
      vscode.window.showErrorMessage('ファイルビューワーの初期化に失敗しました');
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
      vscode.Uri.joinPath(this._extensionUri, 'media', 'fileViewer', 'fileViewer.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'fileViewer', 'fileViewer.css')
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
        <title>ファイルブラウザ＆ファイルビューワー</title>

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
              <!-- 通常表示モード用の要素 -->
              <div class="single-view-header" id="singleViewHeader">
                <div class="current-file-path" id="currentFilePath">ファイルが選択されていません</div>
                <div class="content-actions">
                  <button class="button button-primary" id="editButton">
                    <span class="material-icons">edit</span>
                    <span>編集</span>
                  </button>
                </div>
              </div>

              <!-- 分割表示モード用の要素 -->
              <div class="split-view-header" id="splitViewHeader" style="display: none;">
                <div class="split-panes-info">
                  <div class="left-pane-info">
                    <span class="pane-label">左画面：</span>
                    <span class="pane-file-path" id="leftPaneFilePath">ファイルが選択されていません</span>
                    <button class="button-icon" id="leftPaneEditButton" title="左画面を編集">
                      <span class="material-icons">edit</span>
                    </button>
                  </div>
                  <div class="right-pane-info">
                    <span class="pane-label">右画面：</span>
                    <span class="pane-file-path" id="rightPaneFilePath">ファイルが選択されていません</span>
                    <button class="button-icon" id="rightPaneEditButton" title="右画面を編集">
                      <span class="material-icons">edit</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 常に表示される分割表示切り替えボタン -->
              <div class="split-toggle">
                <button class="button button-toggle" id="splitViewButton" title="分割表示の切り替え">
                  <span class="material-icons">vertical_split</span>
                  <span>分割表示</span>
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
      
      Logger.info('FileViewerPanel: プロジェクトパスリスナーが設定されました');
    } catch (error) {
      Logger.error('FileViewerPanel: プロジェクトパスリスナーの設定に失敗しました', error as Error);
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

    // 現在表示中のファイルパスを保存（プロジェクト変更後も表示を維持するため）
    const currentViewState = {
      isSplitView: this._isSplitView,
      currentFilePath: this._currentFilePath,
      leftPaneFilePath: this._leftPaneFilePath,
      rightPaneFilePath: this._rightPaneFilePath
    };

    this._currentProjectPath = projectPath;

    // ファイル監視を更新
    this._setupFileWatcher();

    // プロジェクトパス変更時にdocsディレクトリを優先して表示（ファイル選択状態がない場合のみ）
    let targetPath;
    if (this._isSplitView && (this._leftPaneFilePath || this._rightPaneFilePath)) {
      // 分割表示モードで、ファイルが選択されている場合は現在の表示を維持
      targetPath = this._leftPaneFilePath ? path.dirname(this._leftPaneFilePath) : path.dirname(this._rightPaneFilePath);
      Logger.info(`FileViewerPanel: 現在表示中のディレクトリを維持します: ${targetPath}`);
    } else if (this._currentFilePath) {
      // 通常モードでファイルが選択されている場合
      targetPath = path.dirname(this._currentFilePath);
      Logger.info(`FileViewerPanel: 現在表示中のディレクトリを維持します: ${targetPath}`);
    } else {
      // ファイル選択状態がない場合はdocsディレクトリを優先
      const docsPath = path.join(projectPath, 'docs');
      if (fs.existsSync(docsPath)) {
        targetPath = docsPath;
        Logger.info(`FileViewerPanel: docsディレクトリを優先的に表示します: ${docsPath}`);
      } else {
        targetPath = projectPath;
        Logger.info(`FileViewerPanel: docsディレクトリが存在しないため、プロジェクトルートを表示: ${projectPath}`);
      }
    }

    // ファイルリストを更新
    this._refreshFileList(targetPath);

    Logger.info(`FileViewerPanel: プロジェクトパスが変更されました: ${projectPath}`);
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
      
      // docs ディレクトリの監視設定を追加
      this._setupDocsFileWatcher();
      
      Logger.info(`FileViewerPanel: ファイル監視が設定されました: ${this._currentProjectPath}`);
    } catch (error) {
      Logger.error('FileViewerPanel: ファイル監視の設定に失敗しました', error as Error);
    }
  }
  
  /**
   * docsディレクトリの監視を設定
   * ファイルビューワーが開いている時のみdocsディレクトリの変更を監視する
   */
  private _setupDocsFileWatcher(): void {
    try {
      if (!this._currentProjectPath) {
        return;
      }
      
      // FileWatcherServiceImplのインスタンスを取得
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { FileWatcherServiceImpl } = require('../scopeManager/services/implementations/FileWatcherServiceImpl');
      const fileWatcherService = FileWatcherServiceImpl.getInstance();
      
      // docs ディレクトリを監視
      const docsWatcher = fileWatcherService.setupDocsDirectoryWatcher(
        this._currentProjectPath,
        this._fileSystemService,
        (filePath: string) => {
          Logger.info(`FileViewerPanel: docsディレクトリのファイル変更を検出: ${filePath}`);
          
          // 現在表示中のディレクトリに関係するファイルの変更か確認
          const currentDir = this._getCurrentDisplayedDirectory();
          if (currentDir && filePath.startsWith(currentDir)) {
            // ファイルリストを更新
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
        },
        { delayedReadTime: 500 } // 500msのデバウンス時間
      );
      
      // _fileWatcherを複合Disposableにする
      const oldWatcher = this._fileWatcher;
      this._fileWatcher = {
        dispose: () => {
          if (oldWatcher) {
            oldWatcher.dispose();
          }
          if (docsWatcher) {
            docsWatcher.dispose();
          }
        }
      };
      
      Logger.info(`FileViewerPanel: docsディレクトリの監視が設定されました: ${this._currentProjectPath}`);
    } catch (error) {
      Logger.error('FileViewerPanel: docsディレクトリ監視の設定に失敗しました', error as Error);
    }
  }
  
  /**
   * 現在表示中のディレクトリパスを取得するヘルパーメソッド
   * @returns 現在表示されているディレクトリパス、または null
   */
  private _getCurrentDisplayedDirectory(): string | null {
    try {
      if (this._isSplitView) {
        // 分割表示モードの場合は左右のペインのうち、どちらかが設定されているパスの親ディレクトリを返す
        if (this._leftPaneFilePath) {
          return path.dirname(this._leftPaneFilePath);
        }
        if (this._rightPaneFilePath) {
          return path.dirname(this._rightPaneFilePath);
        }
      } else if (this._currentFilePath) {
        // 通常モードの場合は現在のファイルパスの親ディレクトリを返す
        return path.dirname(this._currentFilePath);
      }
      
      // プロジェクトパスがあれば、デフォルトで docs ディレクトリを返す
      if (this._currentProjectPath) {
        const docsDir = path.join(this._currentProjectPath, 'docs');
        if (fs.existsSync(docsDir)) {
          return docsDir;
        }
        // docs ディレクトリが存在しない場合はプロジェクトルートを返す
        return this._currentProjectPath;
      }
      
      return null;
    } catch (error) {
      Logger.error('FileViewerPanel: 現在のディレクトリパス取得に失敗しました', error as Error);
      return null;
    }
  }

  /**
   * 初期コンテンツの読み込み
   */
  private _initializeContent(): void {
    try {
      // 既にプロジェクトパスが設定されていない場合のみ取得
      if (!this._currentProjectPath) {
        // 現在のプロジェクトパスを取得
        this._currentProjectPath = this._projectService.getActiveProjectPath();

        if (!this._currentProjectPath) {
          // アクティブなプロジェクトがない場合はワークスペースフォルダを使用
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (workspaceFolders && workspaceFolders.length > 0) {
            this._currentProjectPath = workspaceFolders[0].uri.fsPath;
          }
        }
      } else {
        // 既にプロジェクトパスが設定されている場合はログ出力
        Logger.info(`FileViewerPanel: 既に設定されているプロジェクトパスを使用します: ${this._currentProjectPath}`);
      }

      if (this._currentProjectPath) {
        // docsディレクトリを初期表示として試みる
        const docsPath = path.join(this._currentProjectPath, 'docs');

        // docsディレクトリが存在するか確認
        this._fileSystemService.fileExists(docsPath)
          .then(exists => {
            if (exists) {
              // docsディレクトリが存在する場合はそこを表示
              this._refreshFileList(docsPath);
              Logger.info(`FileViewerPanel: docsディレクトリを初期表示します: ${docsPath}`);
            } else {
              // 存在しない場合はプロジェクトルートを表示
              this._refreshFileList(this._currentProjectPath);
              Logger.info(`FileViewerPanel: プロジェクトルートを初期表示します: ${this._currentProjectPath}`);
            }

            // ファイル監視を設定
            this._setupFileWatcher();
          })
          .catch(error => {
            // エラーが発生した場合はプロジェクトルートを表示
            this._refreshFileList(this._currentProjectPath);
            this._setupFileWatcher();
            Logger.error('FileViewerPanel: docsディレクトリの確認に失敗しました', error as Error);
          });
      } else {
        this._sendMessageToWebview({
          command: 'showError',
          message: 'プロジェクトが選択されていません'
        });
        Logger.warn('FileViewerPanel: プロジェクトが選択されていません');
      }
    } catch (error) {
      Logger.error('FileViewerPanel: 初期コンテンツの読み込みに失敗しました', error as Error);
    }
  }

  /**
   * ファイルリストを更新（特定のパスを指定可能）
   * @param specificPath 特定のディレクトリパス（省略時は現在の表示パスを維持、初期化時のみdocsフォルダを優先）
   */
  private _refreshFileList(specificPath?: string): void {
    try {
      if (!this._currentProjectPath) {
        return;
      }

      // ファイルリスト取得を開始したことをWebViewに通知
      this._sendMessageToWebview({
        command: 'startLoading',
      });

      // パスが指定されていない場合の処理
      let pathToList = specificPath;

      if (!pathToList) {
        // 現在のファイルリストが存在する場合は、その親ディレクトリを優先して維持
        if (this._isSplitView && (this._leftPaneFilePath || this._rightPaneFilePath)) {
          // 分割表示モードで、どちらかのペインにファイルが表示されている場合
          const filePath = this._leftPaneFilePath || this._rightPaneFilePath;
          pathToList = path.dirname(filePath);
          Logger.info(`FileViewerPanel: 現在表示中のファイルのディレクトリを維持します: ${pathToList}`);
        } else if (this._currentFilePath) {
          // 通常モードでファイルが表示されている場合
          pathToList = path.dirname(this._currentFilePath);
          Logger.info(`FileViewerPanel: 現在表示中のファイルのディレクトリを維持します: ${pathToList}`);
        } else {
          // ファイル選択状態がない場合のみ、docsディレクトリを優先
          const docsPath = path.join(this._currentProjectPath, 'docs');

          // docsディレクトリの存在を同期的に確認
          if (fs.existsSync(docsPath)) {
            pathToList = docsPath;
            Logger.info(`FileViewerPanel: docsディレクトリを優先的に表示します: ${docsPath}`);
          } else {
            pathToList = this._currentProjectPath;
            Logger.info(`FileViewerPanel: docsディレクトリが存在しないため、プロジェクトルートを表示します: ${this._currentProjectPath}`);
          }
        }
      }

      // ディレクトリ内のファイルとフォルダを一覧取得
      this._fileSystemService.listDirectory(pathToList, false)
        .then((files) => {
          // WebViewにファイルリストを送信
          this._sendMessageToWebview({
            command: 'updateFileList',
            files: files,
            currentPath: pathToList
          });

          Logger.debug(`FileViewerPanel: ファイルリストを更新しました (${files.length}件): ${pathToList}`);
        })
        .catch((error) => {
          // 指定されたパスにアクセスできない場合
          if (pathToList !== this._currentProjectPath) {
            Logger.info(`FileViewerPanel: ${pathToList}にアクセスできないため、プロジェクトルートを表示します`);
            this._refreshFileList(this._currentProjectPath);
            return;
          }

          this._sendMessageToWebview({
            command: 'showError',
            message: `ファイルリストの取得に失敗しました: ${error.message}`
          });

          Logger.error(`FileViewerPanel: ファイルリストの取得に失敗しました: ${pathToList}`, error);
        });
    } catch (error) {
      Logger.error('FileViewerPanel: ファイルリスト更新中にエラーが発生しました', error as Error);
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
              
              Logger.debug(`FileViewerPanel: ファイル内容を読み込みました: ${filePath}`);
            })
            .catch((error) => {
              this._sendMessageToWebview({
                command: 'showError',
                message: `ファイルの読み込みに失敗しました: ${error.message}`
              });
              
              Logger.error(`FileViewerPanel: ファイルの読み込みに失敗しました: ${filePath}`, error);
            });
        })
        .catch((error) => {
          this._sendMessageToWebview({
            command: 'showError',
            message: `ファイルの存在確認に失敗しました: ${error.message}`
          });
          
          Logger.error(`FileViewerPanel: ファイルの存在確認に失敗しました: ${filePath}`, error);
        });
    } catch (error) {
      Logger.error(`FileViewerPanel: ファイル内容読み込み中にエラーが発生しました: ${filePath}`, error as Error);
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

              Logger.debug(`FileViewerPanel: ${pane}ペインにファイル内容を読み込みました: ${filePath}`);
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
      Logger.error(`FileViewerPanel: ペイン用ファイル内容読み込み中にエラーが発生しました: ${filePath}`, error as Error);
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
          
          
        default:
          Logger.warn(`FileViewerPanel: 未知のコマンドを受信: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`FileViewerPanel: メッセージ処理中にエラーが発生しました: ${message.command}`, error as Error);
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
      Logger.error(`FileViewerPanel: WebViewへのメッセージ送信に失敗しました: ${message.command}`, error as Error);
    }
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    // パネルの参照を削除
    FileViewerPanel._currentPanel = undefined;

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

    Logger.info('FileViewerPanel: リソースを解放しました');
  }
  
  /**
   * パネルが閉じられていないかを確認
   * ファイル更新の前に自動チェックするための補助メソッド
   * @returns パネルがまだ表示されていればtrue、破棄されていればfalse
   */
  private _isPanelAlive(): boolean {
    try {
      if (!this._panel) {
        return false;
      }
      
      // 以下の操作でエラーが出なければパネルは生きている
      const title = this._panel.title;
      return true;
    } catch (error) {
      return false;
    }
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