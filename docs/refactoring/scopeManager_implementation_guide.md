# ScopeManager リファクタリング実装詳細ガイド（改訂版）

このドキュメントはScopeManagerコンポーネントの機能指向分割リファクタリングの詳細実装ガイドです。

## 安全なリファクタリング戦略（2025/5/3更新）

初期実装による失敗を踏まえ、より安全なリファクタリング戦略を以下に定義します。

### 基本方針

1. **シャドーモード実装**: 
   - 既存コードの動作は一切変更せず、並行して新機能を実装
   - フラグ制御で切り替え可能に設計

2. **細かなステップでの検証**:
   - 1つの機能単位（例：タブ管理のみ）で完全に検証
   - 各ステップの成功確認後に次へ進む

3. **機能の厳密な分離**:
   - UI要素の操作とビジネスロジックを確実に分離
   - データ整合性は既存コードのメカニズムを尊重

### 具体的な実装アプローチ

1. **分析フェーズ**:
   - 既存コードの完全な理解を優先
   - 依存関係マップの作成
   - 変更範囲の明確化

2. **非破壊的準備**:
   - 新ファイルを作成するだけで既存を変更しない
   - 動作検証は独立したテスト環境で実施

3. **段階的統合**:
   - **第1段階**: フェイク統合 (デコレーターパターン)
     - 既存関数の呼び出しをラップ
     - 処理は既存コードに委譲
     - ログとトレースを追加して挙動を検証

   - **第2段階**: 部分置換 (アダプターパターン)
     - 最小限の機能のみを新コードで実装
     - 制御フラグで切り替え可能に
     - エラー発生時は自動的に既存コードに戻る

   - **第3段階**: 完全置換
     - 全機能を新コードに移行
     - 既存コードはバックアップのみに利用

4. **検証方法**:
   - 単体テスト: 各モジュールの独立した機能検証
   - 統合テスト: 複数モジュール間の連携確認
   - エンドツーエンドテスト: ユーザー操作シナリオの検証
   - パフォーマンステスト: 処理速度や応答性の比較

5. **ロールバック計画**:
   - 各変更に対応するロールバックスクリプトの準備
   - 障害検出時の自動ロールバック機構

## ディレクトリ構造整備計画

リファクタリング後のディレクトリ構造は以下のようになります。

```
media/
  components/
    tabManager/
      tabManager.js
      tabManager.css
    projectNavigation/
      projectNavigation.js
      projectNavigation.css
    markdownViewer/
      markdownViewer.js
      markdownViewer.css
    dialogManager/
      dialogManager.js
      dialogManager.css
    sharingPanel/
      sharingPanel.js (既存)
      sharingPanel.css
  state/
    stateManager.js
  utils/
    uiHelpers.js
    markdownConverter.js
  scopeManager.js (縮小版)
  scopeManager.css (共通スタイルのみ)

src/ui/scopeManager/
  services/
    TabStateService.ts
    UIStateService.ts
    MessageDispatchService.ts
    MarkdownService.ts
    FileSystemService.ts (既存)
    ProjectService.ts (既存)
    SharingService.ts (既存)
    AuthenticationHandler.ts (既存)
  ScopeManagerPanel.ts (リファクタリング)
  types/
    ScopeManagerTypes.ts (既存)
```

各モジュールの役割は以下の通りです：

### フロントエンドコンポーネント
- **tabManager**: タブ切り替え機能を担当
- **projectNavigation**: プロジェクト一覧表示と選択機能
- **markdownViewer**: マークダウンコンテンツの表示と拡張機能
- **dialogManager**: モーダルやエラー表示などのUI通知
- **sharingPanel**: クリップボード共有機能（既存）

### フロントエンド状態管理
- **stateManager**: 状態管理の中心的存在
- **uiHelpers**: UI操作のヘルパー関数群
- **markdownConverter**: マークダウン変換ヘルパー

### バックエンドサービス
- **TabStateService**: タブ状態管理を担当
- **UIStateService**: UI状態全般の管理
- **MessageDispatchService**: メッセージ処理の一元化
- **MarkdownService**: マークダウン関連処理

## フロントエンド実装詳細

### stateManager.js (状態管理の中心)

```javascript
// @ts-check

class StateManager {
  constructor(vscode) {
    this.vscode = vscode;
    this.listeners = new Map();
    this.state = this.vscode.getState() || this._getDefaultState();
  }

  _getDefaultState() {
    return {
      activeTab: 'current-status',
      projects: [],
      activeProject: null,
      directoryStructure: '',
      // その他必要な初期状態
    };
  }

  getState() {
    return this.state;
  }

  setState(newState, notify = true) {
    this.state = { ...this.state, ...newState };
    this.vscode.setState(this.state);
    
    if (notify) {
      this._notifyListeners();
    }
    
    return this.state;
  }

  // 状態変更監視
  addStateChangeListener(listener) {
    const id = Date.now().toString();
    this.listeners.set(id, listener);
    return id;
  }

  removeStateChangeListener(id) {
    return this.listeners.delete(id);
  }

  _notifyListeners() {
    for (const listener of this.listeners.values()) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('State listener error:', error);
      }
    }
  }

  // 共通のVSCodeメッセージ送信処理
  sendMessage(command, data = {}) {
    this.vscode.postMessage({
      command,
      ...data
    });
  }
}

// シングルトンインスタンス
const stateManager = new StateManager(acquireVsCodeApi());
export default stateManager;
```

### tabManager.js (タブ管理コンポーネント)

```javascript
// @ts-check
import stateManager from '../state/stateManager.js';

class TabManager {
  constructor() {
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.activeTab = null;
    this.initialize();
  }

  initialize() {
    // 保存されたタブ状態を復元
    const state = stateManager.getState();
    const savedTab = state.activeTab || 'current-status';
    
    // タブクリックイベントをセットアップ
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (event) => this._handleTabClick(event, tab));
    });
    
    // 初期タブを選択
    this.selectTab(savedTab, false);
    
    console.log('TabManager initialized with tab:', savedTab);
  }

  _handleTabClick(event, tab) {
    const tabId = tab.getAttribute('data-tab');
    
    // モックアップギャラリーなど特殊タブの処理
    if (tabId === 'tools') {
      event.preventDefault();
      event.stopPropagation();
      
      stateManager.sendMessage('openOriginalMockupGallery');
      return;
    }
    
    this.selectTab(tabId, true);
  }

  selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    console.log(`TabManager: selectTab(${tabId}, saveToServer=${saveToServer})`);
    
    // UIの更新
    this.tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    this.tabContents.forEach(content => {
      if (content.id === `${tabId}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // 状態の更新
    this.activeTab = tabId;
    stateManager.setState({ activeTab: tabId }, false);
    
    // サーバーへの保存
    if (saveToServer) {
      stateManager.sendMessage('saveTabState', { tabId });
    }
  }
}

// 初期化して公開
const tabManager = new TabManager();
export default tabManager;
```

### messageHandler.js (メッセージング中央管理)

```javascript
// @ts-check
import stateManager from './state/stateManager.js';
import tabManager from './components/tabManager/tabManager.js';
import markdownViewer from './components/markdownViewer/markdownViewer.js';
import projectNavigation from './components/projectNavigation/projectNavigation.js';
import dialogManager from './components/dialogManager/dialogManager.js';

class MessageHandler {
  constructor() {
    this.handlers = new Map();
    this.setupHandlers();
    this.setupMessageListener();
  }

  setupHandlers() {
    // メッセージハンドラを登録
    this.registerHandler('updateState', this.handleUpdateState.bind(this));
    this.registerHandler('showError', this.handleShowError.bind(this));
    this.registerHandler('showSuccess', this.handleShowSuccess.bind(this));
    this.registerHandler('updateMarkdownContent', this.handleUpdateMarkdownContent.bind(this));
    this.registerHandler('updateProjects', this.handleUpdateProjects.bind(this));
    this.registerHandler('selectTab', this.handleSelectTab.bind(this));
    this.registerHandler('syncProjectState', this.handleSyncProjectState.bind(this));
    // その他のハンドラ登録
  }

  registerHandler(command, handler) {
    this.handlers.set(command, handler);
  }

  setupMessageListener() {
    window.addEventListener('message', event => {
      const message = event.data;
      this.handleMessage(message);
    });
  }

  handleMessage(message) {
    console.log('Received message:', message.command);
    
    const handler = this.handlers.get(message.command);
    if (handler) {
      handler(message);
    } else {
      console.warn('No handler registered for command:', message.command);
    }
  }

  // 各種ハンドラメソッド
  handleUpdateState(message) {
    stateManager.setState(message);
  }

  handleShowError(message) {
    dialogManager.showError(message.message);
  }

  handleShowSuccess(message) {
    dialogManager.showSuccess(message.message);
  }

  handleUpdateMarkdownContent(message) {
    markdownViewer.updateContent(message.content);
  }

  handleUpdateProjects(message) {
    projectNavigation.updateProjects(message.projects, message.activeProject);
  }

  handleSelectTab(message) {
    tabManager.selectTab(message.tabId, false);
  }

  handleSyncProjectState(message) {
    if (!message.project) return;
    
    const project = message.project;
    stateManager.setState({
      activeProject: project,
      activeTab: project.metadata?.activeTab || stateManager.getState().activeTab
    });
    
    // プロジェクト情報更新
    projectNavigation.updateActiveProject(project);
    
    // タブ状態更新
    if (project.metadata?.activeTab) {
      tabManager.selectTab(project.metadata.activeTab, false);
    }
  }
}

// 初期化
const messageHandler = new MessageHandler();
export default messageHandler;
```

## バックエンド実装詳細

### TabStateService.ts (タブの状態管理)

```typescript
import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface ITabStateService {
  saveTabState(projectId: string, tabId: string): Promise<void>;
  getActiveTab(projectId: string): string | undefined;
  onTabStateChanged: vscode.Event<{ projectId: string, tabId: string }>;
}

export class TabStateService implements ITabStateService {
  private _onTabStateChanged = new vscode.EventEmitter<{ projectId: string, tabId: string }>();
  public readonly onTabStateChanged = this._onTabStateChanged.event;
  
  private _projectTabStates: Map<string, string> = new Map();
  
  private static _instance: TabStateService;
  
  public static getInstance(): TabStateService {
    if (!TabStateService._instance) {
      TabStateService._instance = new TabStateService();
    }
    return TabStateService._instance;
  }
  
  private constructor() {}
  
  public async saveTabState(projectId: string, tabId: string): Promise<void> {
    try {
      // 現在と同じ場合は処理をスキップ
      if (this._projectTabStates.get(projectId) === tabId) {
        return;
      }
      
      // タブ状態を保存
      this._projectTabStates.set(projectId, tabId);
      
      // プロジェクトのメタデータに保存
      // (ここでProjectServiceに連携)
      
      // イベントを発火
      this._onTabStateChanged.fire({ projectId, tabId });
      
      Logger.info(`TabStateService: タブ状態を保存しました: プロジェクト=${projectId}, タブID=${tabId}`);
    } catch (error) {
      Logger.error(`TabStateService: タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  public getActiveTab(projectId: string): string | undefined {
    return this._projectTabStates.get(projectId);
  }
}
```

### UIStateService.ts (UI状態管理サービス)

```typescript
import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface UIState {
  selectedScopeIndex?: number;
  directoryStructure?: string;
  markdownContent?: string;
  isProjectNavCollapsed?: boolean;
}

export interface IUIStateService {
  getUIState(projectId: string): UIState;
  updateUIState(projectId: string, state: Partial<UIState>): void;
  onUIStateChanged: vscode.Event<{ projectId: string, state: UIState }>;
}

export class UIStateService implements IUIStateService {
  private _onUIStateChanged = new vscode.EventEmitter<{ projectId: string, state: UIState }>();
  public readonly onUIStateChanged = this._onUIStateChanged.event;
  
  private _projectUIStates: Map<string, UIState> = new Map();
  
  private static _instance: UIStateService;
  
  public static getInstance(): UIStateService {
    if (!UIStateService._instance) {
      UIStateService._instance = new UIStateService();
    }
    return UIStateService._instance;
  }
  
  private constructor() {}
  
  public getUIState(projectId: string): UIState {
    return this._projectUIStates.get(projectId) || {};
  }
  
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
}
```

### ScopeManagerPanel.ts (リファクタリング後)

```typescript
export class ScopeManagerPanel extends ProtectedPanel {
  // 基本的な変数定義...

  // 主要サービスの参照
  private _fileSystemService: IFileSystemService;
  private _projectService: IProjectService;
  private _sharingService: ISharingService;
  private _authHandler: IAuthenticationHandler;
  private _tabStateService: ITabStateService;
  private _uiStateService: IUIStateService;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string) {
    super();
    
    // パネル初期化
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // サービスのインスタンス取得
    this._fileSystemService = FileSystemService.getInstance();
    this._projectService = ProjectService.getInstance(this._fileSystemService);
    this._sharingService = SharingService.getInstance(context);
    this._authHandler = AuthenticationHandler.getInstance();
    this._tabStateService = TabStateService.getInstance();
    this._uiStateService = UIStateService.getInstance();
    
    // サービスイベントのセットアップ
    this._setupServiceEventListeners();
    
    // WebViewの内容を設定
    this._update();
    
    // WebViewからのメッセージを処理
    this._setupMessageHandlers();
  }
  
  // WebView関連メソッドはそのまま残す
  private _getHtmlForWebview() { /* ... */ }
  private _getNonce() { /* ... */ }
  
  // メッセージハンドラーをより小さく分割
  private _setupMessageHandlers() {
    this._panel.webview.onDidReceiveMessage(
      async message => {
        try {
          switch (message.command) {
            case 'initialize':
              await this._handleInitialize();
              break;
            // 他のメッセージハンドラーは専用メソッドにディスパッチ
            case 'getMarkdownContent':
              await this._handleGetMarkdownContent(message.filePath);
              break;
            case 'saveTabState':
              await this._handleSaveTabState(message.tabId);
              break;
            // その他のハンドラ
          }
        } catch (error) {
          Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
          this._showError(`操作に失敗しました: ${(error as Error).message}`);
        }
      },
      null,
      this._disposables
    );
  }
  
  // 主要なサービス連携のためのイベントリスナーセットアップ
  private _setupServiceEventListeners() {
    // Project Service Events
    this._disposables.push(
      this._projectService.onProjectSelected((project) => {
        this._panel.webview.postMessage({
          command: 'syncProjectState',
          project
        });
      })
    );
    
    // Tab State Service Events
    this._disposables.push(
      this._tabStateService.onTabStateChanged(({projectId, tabId}) => {
        if (this._activeProject?.id === projectId) {
          this._panel.webview.postMessage({
            command: 'selectTab',
            tabId
          });
        }
      })
    );
    
    // UI State Service Events
    this._disposables.push(
      this._uiStateService.onUIStateChanged(({projectId, state}) => {
        if (this._activeProject?.id === projectId) {
          // 状態に応じた更新メッセージを送信
          if (state.markdownContent) {
            this._panel.webview.postMessage({
              command: 'updateMarkdownContent',
              content: state.markdownContent
            });
          }
          
          if (state.directoryStructure) {
            this._panel.webview.postMessage({
              command: 'updateDirectoryStructure',
              structure: state.directoryStructure
            });
          }
        }
      })
    );
  }
  
  // より小さく分割されたハンドラーメソッド
  private async _handleSaveTabState(tabId: string): Promise<void> {
    if (!tabId || !this._activeProject?.id) {
      return;
    }
    
    await this._tabStateService.saveTabState(this._activeProject.id, tabId);
  }
  
  // その他の必要なメソッド...
}
```

### projectNavigation.js (プロジェクトナビゲーションコンポーネント)

```javascript
// @ts-check
import stateManager from '../state/stateManager.js';

class ProjectNavigation {
  constructor() {
    this.projectList = document.getElementById('project-list');
    this.toggleNavBtn = document.getElementById('toggle-nav-btn');
    this.projectNav = document.querySelector('.project-nav');
    this.newProjectBtn = document.getElementById('new-project-btn');
    this.loadProjectBtn = document.getElementById('load-project-btn');
    this.searchInput = document.querySelector('.search-input');
    
    this.initialize();
  }
  
  initialize() {
    // ナビゲーションの開閉ボタン
    if (this.toggleNavBtn) {
      this.toggleNavBtn.addEventListener('click', () => this.toggleNavigation());
    }
    
    // 新規プロジェクト作成ボタン
    if (this.newProjectBtn) {
      this.newProjectBtn.addEventListener('click', () => this.showNewProjectModal());
    }
    
    // 既存プロジェクト読み込みボタン
    if (this.loadProjectBtn) {
      this.loadProjectBtn.addEventListener('click', () => this.loadExistingProject());
    }
    
    // 検索フィルタリング
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.filterProjects(e.target.value));
    }
    
    // 保存された状態から復元
    const state = stateManager.getState();
    if (state.isNavCollapsed) {
      this.collapseNavigation();
    }
    
    console.log('ProjectNavigation initialized');
  }
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブプロジェクト
   */
  updateProjects(projects, activeProject) {
    if (!this.projectList) return;
    
    // リストをクリア
    this.projectList.innerHTML = '';
    
    if (!projects || projects.length === 0) {
      this.projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // 各プロジェクトをリストに追加
    projects.forEach(project => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      if (activeProject && project.id === activeProject.id) {
        projectItem.classList.add('active');
      }
      
      projectItem.innerHTML = `
        <div class="project-item-name">${project.name}</div>
        <div class="project-item-path">${project.path}</div>
      `;
      
      // クリックイベント
      projectItem.addEventListener('click', () => {
        this.selectProject(project);
      });
      
      // コンテキストメニュー
      projectItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showProjectContextMenu(e, project);
      });
      
      this.projectList.appendChild(projectItem);
    });
  }
  
  /**
   * プロジェクト選択
   * @param {Object} project プロジェクト情報
   */
  selectProject(project) {
    stateManager.sendMessage('selectProject', {
      projectName: project.name,
      projectPath: project.path
    });
  }
  
  /**
   * プロジェクト一覧のフィルタリング
   * @param {string} query 検索文字列
   */
  filterProjects(query) {
    const items = this.projectList.querySelectorAll('.project-item');
    const lowerCaseQuery = query.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.project-item-name')?.textContent || '';
      const path = item.querySelector('.project-item-path')?.textContent || '';
      
      if (name.toLowerCase().includes(lowerCaseQuery) || 
          path.toLowerCase().includes(lowerCaseQuery)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  /**
   * ナビゲーションの開閉
   */
  toggleNavigation() {
    if (!this.projectNav) return;
    
    if (this.projectNav.classList.contains('collapsed')) {
      this.expandNavigation();
    } else {
      this.collapseNavigation();
    }
  }
  
  /**
   * ナビゲーションを開く
   */
  expandNavigation() {
    if (!this.projectNav) return;
    
    this.projectNav.classList.remove('collapsed');
    document.querySelector('.content-area')?.classList.remove('expanded');
    stateManager.setState({ isNavCollapsed: false });
  }
  
  /**
   * ナビゲーションを閉じる
   */
  collapseNavigation() {
    if (!this.projectNav) return;
    
    this.projectNav.classList.add('collapsed');
    document.querySelector('.content-area')?.classList.add('expanded');
    stateManager.setState({ isNavCollapsed: true });
  }
  
  /**
   * 新規プロジェクトモーダルを表示
   */
  showNewProjectModal() {
    stateManager.sendMessage('showNewProjectModal');
  }
  
  /**
   * 既存プロジェクト読み込み
   */
  loadExistingProject() {
    stateManager.sendMessage('loadExistingProject');
  }
  
  /**
   * プロジェクトのコンテキストメニュー表示
   */
  showProjectContextMenu(event, project) {
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.position = 'absolute';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.backgroundColor = 'white';
    contextMenu.style.border = '1px solid #ccc';
    contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    contextMenu.style.zIndex = '1000';
    
    // メニュー項目
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="open">開く</div>
      <div class="context-menu-item" data-action="rename">名前変更</div>
      <div class="context-menu-item" data-action="remove">削除</div>
    `;
    
    // メニュー項目のイベント
    contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        this.handleContextMenuAction(action, project);
        document.body.removeChild(contextMenu);
      });
    });
    
    // 任意の場所をクリックしたらメニューを閉じる
    document.addEventListener('click', function closeMenu() {
      if (document.body.contains(contextMenu)) {
        document.body.removeChild(contextMenu);
      }
      document.removeEventListener('click', closeMenu);
    });
    
    // コンテキストメニューを表示
    document.body.appendChild(contextMenu);
  }
  
  /**
   * コンテキストメニューアクション処理
   */
  handleContextMenuAction(action, project) {
    switch (action) {
      case 'open':
        this.selectProject(project);
        break;
      case 'rename':
        // 名前変更ダイアログ表示
        break;
      case 'remove':
        stateManager.sendMessage('removeProject', {
          projectName: project.name,
          projectPath: project.path,
          projectId: project.id
        });
        break;
    }
  }
  
  /**
   * アクティブプロジェクトを更新
   */
  updateActiveProject(project) {
    const items = this.projectList.querySelectorAll('.project-item');
    
    items.forEach(item => {
      const name = item.querySelector('.project-item-name')?.textContent;
      const path = item.querySelector('.project-item-path')?.textContent;
      
      if (name === project.name && path === project.path) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

// 初期化して公開
const projectNavigation = new ProjectNavigation();
export default projectNavigation;
```

### markdownViewer.js (マークダウン表示コンポーネント)

```javascript
// @ts-check
import stateManager from '../state/stateManager.js';
import markdownConverter from '../utils/markdownConverter.js';

class MarkdownViewer {
  constructor() {
    this.container = document.querySelector('.markdown-content');
    this.initialize();
  }
  
  initialize() {
    // 初期化時に何もない場合は「読み込み中...」を表示
    if (this.container && !this.container.innerHTML.trim()) {
      this.container.innerHTML = '<p>読み込み中...</p>';
    }
    
    console.log('MarkdownViewer initialized');
  }
  
  /**
   * マークダウンコンテンツを更新
   * @param {string} content マークダウンテキスト
   */
  updateContent(content) {
    if (!this.container) return;
    
    if (!content) {
      this.container.innerHTML = '<p>ファイルが見つかりません</p>';
      return;
    }
    
    try {
      // マークダウンをHTMLに変換
      const htmlContent = markdownConverter.convertToHtml(content);
      
      // HTMLコンテンツを設定
      this.container.innerHTML = htmlContent;
      
      // 特殊要素のスタイリング
      this._enhanceSpecialElements();
      
      // チェックボックスにイベントリスナーを設定
      this._setupCheckboxes();
      
      console.log('MarkdownViewer: マークダウンを更新しました');
    } catch (error) {
      console.error('MarkdownViewer: マークダウン更新エラー', error);
      this.container.innerHTML = `<p>マークダウンの表示に失敗しました: ${error.message}</p>`;
    }
  }
  
  /**
   * 特殊要素のスタイリング適用
   */
  _enhanceSpecialElements() {
    try {
      // ディレクトリツリーの処理
      const directoryTrees = this.container.querySelectorAll('.directory-tree');
      directoryTrees.forEach(tree => {
        // ツリー項目のスタイリング
        tree.classList.add('enhanced-tree');
      });
      
      // プレーンなコードブロックの処理
      const preBlocks = this.container.querySelectorAll('pre.code-block');
      preBlocks.forEach(preBlock => {
        const content = preBlock.textContent || '';
        
        // ディレクトリ構造っぽい特徴を持っているかチェック
        if ((content.includes('├') || content.includes('└') || content.includes('│')) && 
            content.includes('/')) {
          
          // ディレクトリ構造のようなブロックに特別なクラスを追加
          preBlock.classList.add('directory-structure');
        }
      });
      
      // 表の処理
      const tables = this.container.querySelectorAll('table');
      tables.forEach(table => {
        table.classList.add('md-table');
        
        // テーブルヘッダーにソート機能を追加
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
          header.addEventListener('click', () => this._sortTable(table, index));
          header.style.cursor = 'pointer';
        });
      });
    } catch (error) {
      console.error('MarkdownViewer: 特殊要素のスタイリング中にエラー', error);
    }
  }
  
  /**
   * チェックボックスにイベントリスナーを設定
   */
  _setupCheckboxes() {
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach((checkbox, index) => {
      checkbox.addEventListener('change', (e) => {
        // チェックボックス変更のメッセージを送信
        stateManager.sendMessage('updateMarkdownCheckbox', {
          checked: e.target.checked,
          index: index
        });
      });
    });
  }
  
  /**
   * テーブルのソート機能
   */
  _sortTable(table, columnIndex) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const headerRow = table.querySelector('th:nth-child(' + (columnIndex + 1) + ')');
    const isAscending = !headerRow.classList.contains('sort-asc');
    
    // ソート方向クラスを設定
    table.querySelectorAll('th').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
    });
    
    headerRow.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
    
    // 行をソート
    rows.sort((a, b) => {
      const cellA = a.querySelector('td:nth-child(' + (columnIndex + 1) + ')').textContent.trim();
      const cellB = b.querySelector('td:nth-child(' + (columnIndex + 1) + ')').textContent.trim();
      
      // 数値の場合は数値として比較
      if (!isNaN(cellA) && !isNaN(cellB)) {
        return isAscending ? Number(cellA) - Number(cellB) : Number(cellB) - Number(cellA);
      }
      
      // 文字列の場合は文字列として比較
      return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });
    
    // テーブルを再構築
    const tbody = table.querySelector('tbody');
    rows.forEach(row => tbody.appendChild(row));
  }
}

// 初期化して公開
const markdownViewer = new MarkdownViewer();
export default markdownViewer;
```

### MarkdownService.ts (マークダウン処理サービス)

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { FileSystemService } from './FileSystemService';

export interface IMarkdownService {
  // マークダウン読み込み/解析
  readMarkdownFile(filePath: string): Promise<string>;
  updateMarkdownCheckbox(filePath: string, index: number, checked: boolean): Promise<boolean>;
  parseScopes(content: string): { name: string, status: string, progress: number }[];
  
  // イベント
  onMarkdownUpdated: vscode.Event<{ filePath: string, content: string }>;
}

export class MarkdownService implements IMarkdownService {
  private _onMarkdownUpdated = new vscode.EventEmitter<{ filePath: string, content: string }>();
  public readonly onMarkdownUpdated = this._onMarkdownUpdated.event;
  
  private _fileSystemService: FileSystemService;
  
  private static _instance: MarkdownService;
  
  public static getInstance(fileSystemService?: FileSystemService): MarkdownService {
    if (!MarkdownService._instance) {
      MarkdownService._instance = new MarkdownService(fileSystemService);
    }
    return MarkdownService._instance;
  }
  
  private constructor(fileSystemService?: FileSystemService) {
    this._fileSystemService = fileSystemService || FileSystemService.getInstance();
  }
  
  /**
   * マークダウンファイルを読み込む
   */
  public async readMarkdownFile(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      const content = await this._fileSystemService.readMarkdownFile(filePath);
      
      // イベントを発火
      this._onMarkdownUpdated.fire({ filePath, content });
      
      return content;
    } catch (error) {
      Logger.error(`MarkdownService: ファイル読み込みに失敗しました: ${filePath}`, error as Error);
      throw error;
    }
  }
  
  /**
   * マークダウンファイルのチェックボックスを更新
   */
  public async updateMarkdownCheckbox(filePath: string, index: number, checked: boolean): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を読み込む
      const content = fs.readFileSync(filePath, 'utf8');
      
      // チェックボックスを検索して更新
      const lines = content.split('\n');
      let checkboxCount = 0;
      
      const updatedLines = lines.map(line => {
        // チェックボックスを含む行を検索
        if (line.match(/- \[[ x]\]/i)) {
          if (checkboxCount === index) {
            // 指定されたインデックスのチェックボックスを更新
            return line.replace(/- \[[ x]\]/i, checked ? '- [x]' : '- [ ]');
          }
          checkboxCount++;
        }
        return line;
      });
      
      // 更新された内容を書き込む
      fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf8');
      
      // 更新された内容を読み込んでイベントを発火
      const updatedContent = fs.readFileSync(filePath, 'utf8');
      this._onMarkdownUpdated.fire({ filePath, content: updatedContent });
      
      return true;
    } catch (error) {
      Logger.error(`MarkdownService: チェックボックス更新に失敗しました: ${filePath}`, error as Error);
      return false;
    }
  }
  
  /**
   * マークダウン内のスコープ情報を解析
   */
  public parseScopes(content: string): { name: string, status: string, progress: number }[] {
    try {
      const scopes: { name: string, status: string, progress: number }[] = [];
      
      // 進行中スコープを抽出
      const inProgressRegex = /### 進行中スコープ\s+([^#]*)/s;
      const inProgressMatch = content.match(inProgressRegex);
      if (inProgressMatch && inProgressMatch[1]) {
        const scopeLines = inProgressMatch[1].trim().split('\n');
        
        for (const line of scopeLines) {
          // - [ ] スコープ名 (進捗率%) - 説明 の形式を解析
          const scopeMatch = line.match(/- \[[ ]\] ([^(]+) \((\d+)%\)(.*)/);
          if (scopeMatch) {
            const name = scopeMatch[1].trim();
            const progress = parseInt(scopeMatch[2], 10);
            
            scopes.push({
              name,
              status: 'in-progress',
              progress
            });
          }
        }
      }
      
      // 未着手スコープを抽出
      const pendingRegex = /### 未着手スコープ\s+([^#]*)/s;
      const pendingMatch = content.match(pendingRegex);
      if (pendingMatch && pendingMatch[1]) {
        const scopeLines = pendingMatch[1].trim().split('\n');
        
        for (const line of scopeLines) {
          // - [ ] スコープ名 (0%) - 説明 の形式を解析
          const scopeMatch = line.match(/- \[[ ]\] ([^(]+)(?:\s*\((\d+)%\))?/);
          if (scopeMatch) {
            const name = scopeMatch[1].trim();
            const progress = scopeMatch[2] ? parseInt(scopeMatch[2], 10) : 0;
            
            scopes.push({
              name,
              status: 'pending',
              progress
            });
          }
        }
      }
      
      // 完了済みスコープを抽出
      const completedRegex = /### 完了済みスコープ\s+([^#]*)/s;
      const completedMatch = content.match(completedRegex);
      if (completedMatch && completedMatch[1]) {
        const scopeLines = completedMatch[1].trim().split('\n');
        
        for (const line of scopeLines) {
          // - [x] スコープ名 (100%) - 説明 の形式を解析
          const scopeMatch = line.match(/- \[x\] ([^(]+)(?:\s*\((\d+)%\))?/);
          if (scopeMatch) {
            const name = scopeMatch[1].trim();
            const progress = scopeMatch[2] ? parseInt(scopeMatch[2], 10) : 100;
            
            scopes.push({
              name,
              status: 'completed',
              progress
            });
          }
        }
      }
      
      return scopes;
    } catch (error) {
      Logger.error('MarkdownService: スコープ解析に失敗しました', error as Error);
      return [];
    }
  }
}
```

## 段階的実装計画

### フェーズ1: フロントエンド分割（2週間）
1. ディレクトリ構造の設定（1日）
2. stateManager.jsの実装とテスト（2日）
3. tabManager.jsの実装と統合（2日）
4. projectNavigation.jsの実装と統合（3日）
5. markdownViewer.jsの実装と統合（3日）
6. dialogManager.jsの実装（1日）
7. messageHandler.jsの実装と統合（2日）
8. 統合テストと修正（2日）

### フェーズ2: バックエンド分割（2週間）
1. TabStateServiceの実装（2日）
2. UIStateServiceの実装（2日） 
3. ScopeManagerPanelのリファクタリング（5日）
4. 既存サービスとの連携調整（3日）
5. 統合テストと修正（2日）

### フェーズ3: メッセージング層強化（1週間）
1. タイプセーフなイベントシステム実装（2日）
2. エラーハンドリング強化（2日）
3. リカバリーメカニズム実装（1日）
4. 最終テストと文書化（2日）

## 移行戦略と検証方法

各コンポーネントを実装した後の統合と検証は、以下の手順で行います：

1. **段階的移行**：
   - 既存の機能を一度に置き換えるのではなく、一つずつコンポーネントを置き換える
   - 各コンポーネントごとに検証してから次に進む

2. **並行実行モード**：
   - 切り替えフラグを用意し、新旧実装を切り替え可能にする
   - 問題発生時に即座に古い実装に戻せるようにする

3. **検証用ログ**：
   - 新旧実装で同じ操作を行った際の挙動をログで比較
   - 状態変化を詳細にトレースして一致を確認

4. **リグレッションテスト**：
   - 主要機能ごとに以下の点をテストする：
     - プロジェクト作成、読み込み、選択
     - タブ切り替えと状態保持
     - マークダウン表示と操作
     - 共有機能

この計画により、既存機能を損なうことなく、段階的に拡張性と保守性を向上させることができます。