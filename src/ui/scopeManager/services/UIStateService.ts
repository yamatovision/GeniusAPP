import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

/**
 * UIの状態を表すインターフェース
 */
export interface UIState {
  selectedScopeIndex?: number;
  directoryStructure?: string;
  markdownContent?: string;
  isProjectNavCollapsed?: boolean;
  activeTabId?: string;
}

/**
 * UI状態管理サービスインターフェース
 * ScopeManagerPanelのUI関連機能を分離
 */
export interface IUIStateService {
  // UI状態管理
  getUIState(projectId: string): UIState;
  updateUIState(projectId: string, state: Partial<UIState>): void;
  
  // UI更新メソッド
  updateUI(): void;
  
  // 通知メソッド
  showError(message: string): void;
  showSuccess(message: string): void;
  
  // ディレクトリ構造表示
  showDirectoryStructure(structure: string): void;
  
  // WebViewのHTMLコンテンツを取得
  getWebviewContent(extensionUri: vscode.Uri): string;
  
  // イベント
  onUIStateChanged: vscode.Event<{ projectId: string, state: UIState }>;
  onWebviewReady: vscode.Event<void>;
  
  // リソース解放
  dispose(): void;
}

/**
 * UI状態管理サービス実装クラス
 */
export class UIStateService implements IUIStateService {
  // イベントエミッター
  private _onUIStateChanged = new vscode.EventEmitter<{ projectId: string, state: UIState }>();
  public readonly onUIStateChanged = this._onUIStateChanged.event;
  
  private _onWebviewReady = new vscode.EventEmitter<void>();
  public readonly onWebviewReady = this._onWebviewReady.event;
  
  // UI状態データ
  private _projectUIStates: Map<string, UIState> = new Map();
  
  // 依存オブジェクト
  private _panel: vscode.WebviewPanel | undefined;
  private _extensionUri: vscode.Uri | undefined;
  private _disposables: vscode.Disposable[] = [];
  
  // シングルトンインスタンス
  private static _instance: UIStateService;
  
  public static getInstance(panel?: vscode.WebviewPanel, extensionUri?: vscode.Uri): UIStateService {
    if (!UIStateService._instance) {
      UIStateService._instance = new UIStateService();
    }
    
    // パネルとURIが指定された場合は設定
    if (panel && extensionUri) {
      UIStateService._instance._setDependencies(panel, extensionUri);
    }
    
    return UIStateService._instance;
  }
  
  private constructor() {
    Logger.info('UIStateService: 初期化完了');
  }
  
  /**
   * 依存オブジェクトを設定
   */
  private _setDependencies(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    Logger.info('UIStateService: 依存オブジェクトを設定しました');
  }
  
  /**
   * 指定したプロジェクトのUI状態を取得
   * @param projectId プロジェクトID
   */
  public getUIState(projectId: string): UIState {
    return this._projectUIStates.get(projectId) || {};
  }
  
  /**
   * 指定したプロジェクトのUI状態を更新
   * @param projectId プロジェクトID
   * @param state 更新する状態
   */
  public updateUIState(projectId: string, state: Partial<UIState>): void {
    try {
      const currentState = this._projectUIStates.get(projectId) || {};
      const newState = { ...currentState, ...state };
      
      // 状態を更新
      this._projectUIStates.set(projectId, newState);
      
      // イベントを発火
      this._onUIStateChanged.fire({ projectId, state: newState });
      
      Logger.info(`UIStateService: UI状態を更新しました: プロジェクト=${projectId}`);
    } catch (error) {
      Logger.error(`UIStateService: UI状態の更新に失敗しました: ${(error as Error).message}`, error as Error);
    }
  }
  
  /**
   * WebViewのUIを更新
   */
  public updateUI(): void {
    try {
      if (this._panel && this._extensionUri) {
        // WebViewのHTMLコンテンツを更新
        this._panel.webview.html = this.getWebviewContent(this._extensionUri);
        Logger.info('UIStateService: WebView UIを更新しました');
      } else {
        Logger.warn('UIStateService: パネルまたは拡張機能URIが設定されていません');
      }
    } catch (error) {
      Logger.error('UIStateService: UI更新エラー', error as Error);
    }
  }
  
  /**
   * エラーメッセージを表示
   * @param message 表示するエラーメッセージ
   */
  public showError(message: string): void {
    try {
      if (this._panel) {
        this._panel.webview.postMessage({
          command: 'showError',
          message: message
        });
        Logger.info(`UIStateService: エラーメッセージを表示: ${message}`);
      } else {
        // パネルが未設定の場合はVSCodeのUIに表示
        vscode.window.showErrorMessage(message);
      }
    } catch (error) {
      Logger.error('UIStateService: エラー表示に失敗', error as Error);
      // VSCodeのUIにフォールバック
      vscode.window.showErrorMessage(message);
    }
  }
  
  /**
   * 成功メッセージを表示
   * @param message 表示する成功メッセージ
   */
  public showSuccess(message: string): void {
    try {
      if (this._panel) {
        this._panel.webview.postMessage({
          command: 'showSuccess',
          message: message
        });
        Logger.info(`UIStateService: 成功メッセージを表示: ${message}`);
      } else {
        // パネルが未設定の場合はVSCodeのUIに表示
        vscode.window.showInformationMessage(message);
      }
    } catch (error) {
      Logger.error('UIStateService: 成功メッセージ表示に失敗', error as Error);
      // VSCodeのUIにフォールバック
      vscode.window.showInformationMessage(message);
    }
  }
  
  /**
   * ディレクトリ構造を表示
   * @param structure ディレクトリ構造の文字列
   */
  public showDirectoryStructure(structure: string): void {
    try {
      if (this._panel) {
        this._panel.webview.postMessage({
          command: 'updateDirectoryStructure',
          structure: structure
        });
        Logger.info('UIStateService: ディレクトリ構造を更新しました');
      }
    } catch (error) {
      Logger.error('UIStateService: ディレクトリ構造表示に失敗', error as Error);
    }
  }
  
  /**
   * WebViewのHTMLコンテンツを取得
   * @param extensionUri 拡張機能のURI
   * @returns HTMLコンテンツ
   */
  public getWebviewContent(extensionUri: vscode.Uri): string {
    if (!this._panel) {
      throw new Error('UIStateService: パネルが設定されていません');
    }
    
    const webview = this._panel.webview;
    
    // CSS, JSファイルへのパスを取得
    const styleResetPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'reset.css'));
    const stylesPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'scopeManager.css'));
    const designSystemPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'design-system.css'));
    const componentsStylePath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components.css'));
    const scriptPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'scopeManager.js'));
    
    // 各コンポーネントのJSパス
    const stateManagerPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'state', 'stateManager.js'));
    const tabManagerPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components', 'tabManager', 'tabManager.js'));
    const markdownViewerPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components', 'markdownViewer', 'markdownViewer.js'));
    const projectNavigationPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components', 'projectNavigation', 'projectNavigation.js'));
    const dialogManagerPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components', 'dialogManager', 'dialogManager.js'));
    const promptCardsPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components', 'promptCards', 'promptCards.js'));
    const fileBrowserPath = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'components', 'fileBrowser', 'fileBrowser.js'));
    
    // 実際のHTMLコンテンツを返す
    // Note: この内容はWebViewパネルの作成時に一度だけ設定され、その後はJS側で内容が更新される
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AppGenius スコープマネージャー</title>
        <link href="${styleResetPath}" rel="stylesheet">
        <link href="${designSystemPath}" rel="stylesheet">
        <link href="${componentsStylePath}" rel="stylesheet">
        <link href="${stylesPath}" rel="stylesheet">
        <script type="module" src="${stateManagerPath}"></script>
        <script type="module" src="${tabManagerPath}"></script>
        <script type="module" src="${markdownViewerPath}"></script>
        <script type="module" src="${projectNavigationPath}"></script>
        <script type="module" src="${dialogManagerPath}"></script>
        <script type="module" src="${promptCardsPath}"></script>
        <script type="module" src="${fileBrowserPath}"></script>
        <script type="module" src="${scriptPath}"></script>
    </head>
    <body>
        <div class="app-container">
            <!-- ヘッダー部分 -->
            <header class="app-header">
                <div class="logo-container">
                    <div class="app-logo">A</div>
                    <h1 class="app-title">AppGenius スコープマネージャー</h1>
                </div>
                <div class="project-selector">
                    <div id="project-name-display" class="project-name">プロジェクトを選択</div>
                    <button id="select-project-button" class="icon-button" title="プロジェクト選択">
                        <span class="icon">📁</span>
                    </button>
                    <button id="refresh-project-button" class="icon-button" title="更新">
                        <span class="icon">⟳</span>
                    </button>
                </div>
            </header>

            <!-- メインコンテンツ部分 -->
            <main class="app-content">
                <!-- タブ部分 -->
                <div class="tab-container">
                    <div class="tab-list" id="tab-list">
                        <button class="tab active" data-tab-id="scope-progress">
                            <span class="tab-icon">📊</span>進捗管理
                        </button>
                        <button class="tab" data-tab-id="requirements">
                            <span class="tab-icon">📋</span>要件定義
                        </button>
                        <button class="tab" data-tab-id="file-browser">
                            <span class="tab-icon">📁</span>ファイル
                        </button>
                        <button class="tab" data-tab-id="directory">
                            <span class="tab-icon">🌲</span>構造
                        </button>
                    </div>

                    <!-- タブコンテンツ部分 -->
                    <div class="tab-content-container">
                        <!-- 進捗管理タブ -->
                        <div class="tab-content active" id="scope-progress-content">
                            <div id="markdown-viewer" class="markdown-content"></div>
                        </div>

                        <!-- 要件定義タブ -->
                        <div class="tab-content" id="requirements-content">
                            <div id="requirements-viewer" class="markdown-content"></div>
                        </div>

                        <!-- ファイルブラウザタブ -->
                        <div class="tab-content" id="file-browser-content">
                            <div class="file-browser-container">
                                <div class="file-browser-header">
                                    <div class="current-path" id="current-path">
                                        <span class="path-segment">プロジェクト</span>
                                        <span class="path-separator">/</span>
                                        <span class="path-segment">docs</span>
                                    </div>
                                    <button id="refresh-files-button" class="icon-button" title="更新">
                                        <span class="icon">⟳</span>
                                    </button>
                                </div>
                                <div class="file-browser-body">
                                    <div class="file-list" id="file-list">
                                        <!-- ファイル一覧はJSで動的に生成 -->
                                    </div>
                                    <div class="file-preview" id="file-preview">
                                        <div class="file-preview-placeholder">
                                            ファイルを選択してください
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ディレクトリ構造タブ -->
                        <div class="tab-content" id="directory-content">
                            <div class="directory-container">
                                <div class="directory-header">
                                    <div class="directory-title">プロジェクト構造</div>
                                    <button id="refresh-directory-button" class="icon-button" title="更新">
                                        <span class="icon">⟳</span>
                                    </button>
                                </div>
                                <pre id="directory-structure" class="directory-structure">ディレクトリ構造を読み込み中...</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <!-- サイドバー部分 -->
            <aside class="app-sidebar">
                <div class="sidebar-section prompt-section">
                    <h3 class="sidebar-title">開発プロンプト</h3>
                    <div class="prompt-cards" id="prompt-cards">
                        <!-- プロンプトカードはJSで動的生成 -->
                    </div>
                </div>
                
                <!-- シェアエリアトグルボタン -->
                <button id="toggle-share-btn" class="toggle-share-btn">
                    <span class="share-icon">🔄</span>
                    <span>ClaudeCode共有</span>
                </button>
            </aside>

            <!-- モーダルダイアログ -->
            <div id="modal-container" class="modal-container hidden">
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">ダイアログタイトル</h3>
                        <button id="modal-close" class="modal-close">&times;</button>
                    </div>
                    <div id="modal-body" class="modal-body">
                        <!-- モーダルの内容はJSで動的に生成 -->
                    </div>
                </div>
            </div>

            <!-- ClaudeCode共有エリア（初期状態では非表示） -->
            <div id="claude-code-share" class="claude-code-share collapsed">
                <div class="share-header">
                    <h3>ClaudeCode連携</h3>
                    <button id="minimize-share-btn" class="minimize-btn">
                        <span class="minimize-icon">▼</span>
                    </button>
                </div>
                <div class="share-tabs">
                    <button class="share-tab active" data-tab="share-content">テキスト共有</button>
                    <button class="share-tab" data-tab="share-image">画像共有</button>
                    <button class="share-tab" data-tab="share-history">履歴</button>
                </div>
                <div class="share-content active" id="share-content-tab">
                    <div class="share-input-container">
                        <textarea id="share-text" class="share-textarea" placeholder="共有するテキストを入力してください"></textarea>
                        <div class="share-controls">
                            <input type="text" id="share-filename" class="share-filename" placeholder="ファイル名 (オプション)">
                            <button id="share-button" class="share-button">共有</button>
                        </div>
                    </div>
                </div>
                <div class="share-content" id="share-image-tab">
                    <div class="share-image-container">
                        <div id="image-drop-zone" class="image-drop-zone">
                            <div class="drop-message">画像をドラッグ＆ドロップするか、クリックして選択</div>
                            <div class="preview-container" id="image-preview-container"></div>
                        </div>
                        <div class="share-controls">
                            <input type="text" id="image-filename" class="share-filename" placeholder="ファイル名">
                            <button id="share-image-button" class="share-button" disabled>共有</button>
                        </div>
                    </div>
                </div>
                <div class="share-content" id="share-history-tab">
                    <div class="share-history-container">
                        <div class="history-header">
                            <h4>共有履歴</h4>
                            <button id="refresh-history" class="icon-button small" title="履歴を更新">
                                <span class="icon">⟳</span>
                            </button>
                        </div>
                        <div id="history-list" class="history-list">
                            <!-- 履歴はJSで動的に生成 -->
                            <div class="history-placeholder">履歴はありません</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
  }
  
  /**
   * WebView準備完了を通知
   */
  public notifyWebviewReady(): void {
    this._onWebviewReady.fire();
    Logger.info('UIStateService: WebView準備完了を通知しました');
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    // イベントエミッタを解放
    this._onUIStateChanged.dispose();
    this._onWebviewReady.dispose();
    
    // Disposableなリソースを解放
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    Logger.info('UIStateService: リソースを解放しました');
  }
}