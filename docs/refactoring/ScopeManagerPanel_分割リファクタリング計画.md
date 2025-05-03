# ScopeManagerPanel 分割リファクタリング計画

## UIイベント処理と状態管理の分離計画

現在の`media/scopeManager.js`は2,200行以上の巨大なファイルであり、複数の責務が密結合しています。このドキュメントでは特にUIイベント処理と状態管理の分離に焦点を当てた詳細計画を示します。

### 現状の課題

現在のscopeManager.jsでは、以下の機能が密接に結合しています：

1. ユーザーインターフェースのイベント処理
2. 状態管理（VSCodeの状態APIを使用）
3. メッセージ処理と通信
4. UI要素の更新処理

これらが結合していることで、コードの複雑性が高まり、保守性が低下しています。特に以下の問題があります：

- 状態変更がUIに直接反映される構造で、変更の追跡が困難
- メッセージハンドラが複数の責任を持ち、拡張性が低い
- イベントリスナーが分散して定義され、管理が難しい
- 同じUIロジックが複数の場所に重複

### 分離の指針

状態管理とUIイベント処理を明確に分離します：

1. **状態管理（StateManager）**
   - VSCodeの状態APIとのやり取りを一元管理
   - 状態変更の通知メカニズムを提供
   - すべての状態データのシングルソースオブトゥルース

2. **イベント管理（EventManager）**
   - DOMイベントリスナーの登録・管理
   - ユーザー操作のハンドリング
   - 状態管理層への通知

3. **メッセージ処理（MessageHandler）**
   - 外部からのメッセージの受信と処理
   - 内部状態の更新指示
   - UI更新の指示

4. **UI更新（UIRenderer）**
   - 状態に基づいたUI要素の更新
   - DOMの操作
   - UI表示ロジックの集約

## 実装計画

### 1. StateManager（状態管理）

**ファイル**: `media/state/stateManager.js`

```javascript
// @ts-check

/**
 * 状態管理クラス - VSCodeの状態APIとやり取りし、アプリケーション状態を管理
 */
class StateManager {
  /**
   * @param {any} vscode VSCode API
   */
  constructor(vscode) {
    this.vscode = vscode;
    this.listeners = new Map();
    this.state = this.vscode.getState() || this._getDefaultState();
  }
  
  /**
   * デフォルト状態を返す
   * @returns {Object} デフォルト状態
   */
  _getDefaultState() {
    return {
      scopes: [],
      selectedScopeIndex: -1,
      selectedScope: null,
      directoryStructure: '',
      activeTab: 'current-status',
      projects: [],
      activeProject: null,
      isNavCollapsed: false
    };
  }
  
  /**
   * 現在の状態を取得
   * @returns {Object} 現在の状態
   */
  getState() {
    return this.state;
  }
  
  /**
   * 状態を更新
   * @param {Object} newState 新しい状態（部分的）
   * @param {boolean} notify リスナーに通知するか
   * @returns {Object} 更新後の状態
   */
  setState(newState, notify = true) {
    this.state = { ...this.state, ...newState };
    this.vscode.setState(this.state);
    
    if (notify) {
      this._notifyListeners();
    }
    
    return this.state;
  }
  
  /**
   * 状態変更リスナーを追加
   * @param {Function} listener 状態が変更されたときに呼び出される関数
   * @returns {string} リスナーID（リスナー削除時に使用）
   */
  addStateChangeListener(listener) {
    const id = Date.now().toString();
    this.listeners.set(id, listener);
    return id;
  }
  
  /**
   * 状態変更リスナーを削除
   * @param {string} id リスナーID
   * @returns {boolean} 削除に成功したか
   */
  removeStateChangeListener(id) {
    return this.listeners.delete(id);
  }
  
  /**
   * すべてのリスナーに通知
   * @private
   */
  _notifyListeners() {
    for (const listener of this.listeners.values()) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('状態変更リスナーでエラー発生:', error);
      }
    }
  }
  
  /**
   * VSCodeにメッセージを送信
   * @param {string} command コマンド名
   * @param {Object} data メッセージデータ
   */
  sendMessage(command, data = {}) {
    this.vscode.postMessage({
      command,
      ...data
    });
  }
  
  // スコープ関連の状態操作
  
  /**
   * スコープを選択
   * @param {number} index スコープのインデックス
   */
  selectScope(index) {
    if (index >= 0 && index < this.state.scopes.length) {
      const scope = this.state.scopes[index];
      this.setState({
        selectedScopeIndex: index,
        selectedScope: scope
      });
      
      this.sendMessage('selectScope', { index });
    }
  }
  
  /**
   * タブ状態を保存
   * @param {string} tabId タブID
   */
  saveTabState(tabId) {
    this.setState({ activeTab: tabId });
    this.sendMessage('saveTabState', { tabId });
  }
}

// シングルトンインスタンス
export default new StateManager(acquireVsCodeApi());
```

### 2. EventManager（イベント管理）

**ファイル**: `media/utils/eventManager.js`

```javascript
// @ts-check
import stateManager from '../state/stateManager.js';

/**
 * イベント管理クラス - DOMイベントリスナーを登録・管理
 */
class EventManager {
  constructor() {
    this.events = new Map();
    this.initialize();
  }
  
  /**
   * イベントリスナーを初期化
   */
  initialize() {
    this._setupTabEvents();
    this._setupProjectNavigationEvents();
    this._setupScopeListEvents();
    this._setupImplementationButtonEvents();
    this._setupDirectoryStructureButtonEvents();
    this._setupCreateScopeButtonEvents();
    
    console.log('EventManager: すべてのイベントリスナーを初期化しました');
  }
  
  /**
   * タブイベントをセットアップ
   * @private
   */
  _setupTabEvents() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      const tabId = tab.getAttribute('data-tab');
      if (!tabId) return;
      
      const handler = (event) => {
        // モックアップギャラリーなど特殊タブの処理
        if (tabId === 'tools') {
          event.preventDefault();
          event.stopPropagation();
          
          stateManager.sendMessage('openOriginalMockupGallery');
          return;
        }
        
        // タブ状態を更新
        stateManager.saveTabState(tabId);
      };
      
      tab.addEventListener('click', handler);
      this._registerEventCleanup(tab, 'click', handler);
    });
  }
  
  /**
   * プロジェクトナビゲーションイベントをセットアップ
   * @private
   */
  _setupProjectNavigationEvents() {
    // トグルボタン
    const toggleNavBtn = document.getElementById('toggle-nav-btn');
    if (toggleNavBtn) {
      const handler = () => {
        const projectNav = document.querySelector('.project-nav');
        const contentArea = document.querySelector('.content-area');
        const icon = toggleNavBtn.querySelector('.material-icons');
        
        // ナビゲーションの開閉状態を反転
        const isCollapsed = projectNav?.classList.contains('collapsed') ?? false;
        
        if (isCollapsed) {
          // パネルを展開
          projectNav?.classList.remove('collapsed');
          contentArea?.classList.remove('expanded');
          icon.textContent = 'chevron_left';
        } else {
          // パネルを折りたたむ
          projectNav?.classList.add('collapsed');
          contentArea?.classList.add('expanded');
          icon.textContent = 'chevron_right';
        }
        
        // 状態を更新
        stateManager.setState({ isNavCollapsed: !isCollapsed });
      };
      
      toggleNavBtn.addEventListener('click', handler);
      this._registerEventCleanup(toggleNavBtn, 'click', handler);
    }
    
    // 新規プロジェクトボタン
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      const handler = () => {
        stateManager.sendMessage('showNewProjectModal');
      };
      
      newProjectBtn.addEventListener('click', handler);
      this._registerEventCleanup(newProjectBtn, 'click', handler);
    }
    
    // 既存プロジェクト読み込みボタン
    const loadProjectBtn = document.getElementById('load-project-btn');
    if (loadProjectBtn) {
      const handler = () => {
        stateManager.sendMessage('loadExistingProject');
      };
      
      loadProjectBtn.addEventListener('click', handler);
      this._registerEventCleanup(loadProjectBtn, 'click', handler);
    }
  }
  
  /**
   * スコープリストイベントをセットアップ
   * @private
   */
  _setupScopeListEvents() {
    // 動的に生成されるスコープアイテムは、親要素にイベント委譲する
    const scopeList = document.getElementById('scope-list');
    if (scopeList) {
      const handler = (event) => {
        const scopeItem = event.target.closest('.scope-item');
        if (!scopeItem) return;
        
        // スコープのインデックスを取得
        const index = Array.from(scopeList.children).indexOf(scopeItem);
        if (index >= 0) {
          stateManager.selectScope(index);
        }
      };
      
      scopeList.addEventListener('click', handler);
      this._registerEventCleanup(scopeList, 'click', handler);
    }
  }
  
  /**
   * 実装開始ボタンイベントをセットアップ
   * @private
   */
  _setupImplementationButtonEvents() {
    const implementButton = document.getElementById('implement-button');
    if (implementButton) {
      const handler = () => {
        stateManager.sendMessage('startImplementation');
      };
      
      implementButton.addEventListener('click', handler);
      this._registerEventCleanup(implementButton, 'click', handler);
    }
  }
  
  /**
   * ディレクトリ構造ボタンイベントをセットアップ
   * @private
   */
  _setupDirectoryStructureButtonEvents() {
    const directoryButton = document.getElementById('directory-structure-button');
    if (directoryButton) {
      const handler = () => {
        stateManager.sendMessage('showDirectoryStructure');
      };
      
      directoryButton.addEventListener('click', handler);
      this._registerEventCleanup(directoryButton, 'click', handler);
    }
  }
  
  /**
   * スコープ新規作成ボタンイベントをセットアップ
   * @private
   */
  _setupCreateScopeButtonEvents() {
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      const handler = () => {
        stateManager.sendMessage('addNewScope');
      };
      
      createScopeButton.addEventListener('click', handler);
      this._registerEventCleanup(createScopeButton, 'click', handler);
    }
  }
  
  /**
   * イベントクリーンアップを登録
   * @param {HTMLElement} element 要素
   * @param {string} eventType イベントタイプ
   * @param {Function} handler イベントハンドラ
   * @private
   */
  _registerEventCleanup(element, eventType, handler) {
    const elementEvents = this.events.get(element) || [];
    elementEvents.push({ type: eventType, handler });
    this.events.set(element, elementEvents);
  }
  
  /**
   * リソースをクリーンアップ
   */
  cleanup() {
    this.events.forEach((events, element) => {
      events.forEach(({ type, handler }) => {
        element.removeEventListener(type, handler);
      });
    });
    
    this.events.clear();
  }
}

// シングルトンインスタンス
export default new EventManager();
```

### 3. MessageHandler（メッセージ処理）

**ファイル**: `media/utils/messageHandler.js`

```javascript
// @ts-check
import stateManager from '../state/stateManager.js';
import uiRenderer from './uiRenderer.js';

/**
 * メッセージ処理クラス - VSCodeとの通信を管理
 */
class MessageHandler {
  constructor() {
    this.handlers = new Map();
    this._setupHandlers();
    this._setupMessageListener();
  }
  
  /**
   * メッセージハンドラーを設定
   * @private
   */
  _setupHandlers() {
    // ハンドラーを登録
    this._registerHandler('updateState', this._handleUpdateState.bind(this));
    this._registerHandler('showError', this._handleShowError.bind(this));
    this._registerHandler('showSuccess', this._handleShowSuccess.bind(this));
    this._registerHandler('showDirectoryStructure', this._handleShowDirectoryStructure.bind(this));
    this._registerHandler('updateProjectPath', this._handleUpdateProjectPath.bind(this));
    this._registerHandler('updateProjectName', this._handleUpdateProjectName.bind(this));
    this._registerHandler('updateMarkdownContent', this._handleUpdateMarkdownContent.bind(this));
    this._registerHandler('updateProjects', this._handleUpdateProjects.bind(this));
    this._registerHandler('selectTab', this._handleSelectTab.bind(this));
    this._registerHandler('updateToolsTab', this._handleUpdateToolsTab.bind(this));
    this._registerHandler('syncProjectState', this._handleSyncProjectState.bind(this));
  }
  
  /**
   * メッセージリスナーを設定
   * @private
   */
  _setupMessageListener() {
    window.addEventListener('message', event => {
      const message = event.data;
      
      // シェアリングパネル関連のメッセージは無視
      if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
        return;
      }
      
      console.log('メッセージ受信:', message.command);
      
      const handler = this.handlers.get(message.command);
      if (handler) {
        try {
          handler(message);
        } catch (error) {
          console.error(`メッセージハンドラーでエラー発生: ${message.command}`, error);
          uiRenderer.showError(`メッセージ処理中にエラーが発生しました: ${error.message}`);
        }
      } else {
        console.warn(`未登録のコマンド: ${message.command}`);
      }
    });
  }
  
  /**
   * メッセージハンドラーを登録
   * @param {string} command コマンド名
   * @param {Function} handler ハンドラー関数
   * @private
   */
  _registerHandler(command, handler) {
    this.handlers.set(command, handler);
  }
  
  /**
   * 状態更新メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleUpdateState(message) {
    // 状態を更新
    stateManager.setState(message);
    
    // UI更新指示
    if (message.scopes) {
      uiRenderer.updateScopeList(message.scopes);
      uiRenderer.updateProjectProgress(message.scopes);
    }
    
    if (message.selectedScope) {
      uiRenderer.updateSelectedScope(message.selectedScope);
    }
  }
  
  /**
   * エラーメッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleShowError(message) {
    uiRenderer.showError(message.message);
  }
  
  /**
   * 成功メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleShowSuccess(message) {
    uiRenderer.showSuccess(message.message);
  }
  
  /**
   * ディレクトリ構造表示メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleShowDirectoryStructure(message) {
    uiRenderer.showDirectoryStructure(message.structure);
  }
  
  /**
   * プロジェクトパス更新メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleUpdateProjectPath(message) {
    uiRenderer.updateProjectPath(message);
    
    if (message.statusFilePath && message.statusFileExists) {
      stateManager.sendMessage('getMarkdownContent', {
        filePath: message.statusFilePath
      });
    }
  }
  
  /**
   * プロジェクト名更新メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleUpdateProjectName(message) {
    uiRenderer.updateProjectName(message.projectName);
  }
  
  /**
   * マークダウンコンテンツ更新メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleUpdateMarkdownContent(message) {
    uiRenderer.displayMarkdownContent(message.content);
  }
  
  /**
   * プロジェクト一覧更新メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleUpdateProjects(message) {
    uiRenderer.updateProjects(message.projects, message.activeProject);
  }
  
  /**
   * タブ選択メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleSelectTab(message) {
    uiRenderer.selectTab(message.tabId, false);
  }
  
  /**
   * ツールタブ更新メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleUpdateToolsTab(message) {
    uiRenderer.updateToolsTab(message.content);
  }
  
  /**
   * プロジェクト状態同期メッセージを処理
   * @param {Object} message メッセージデータ
   * @private
   */
  _handleSyncProjectState(message) {
    if (!message.project) return;
    
    const project = message.project;
    
    // 必要な更新を行う
    if (project.name) {
      uiRenderer.updateProjectName(project.name);
    }
    
    if (project.path) {
      uiRenderer.updateProjectPath({
        projectPath: project.path,
        statusFilePath: project.path ? `${project.path}/docs/CURRENT_STATUS.md` : '',
        statusFileExists: true
      });
    }
    
    if (project.metadata && project.metadata.activeTab) {
      const activeTabFromMetadata = project.metadata.activeTab;
      
      // タブが存在するか確認
      const tabExists = Array.from(document.querySelectorAll('.tab'))
        .some(tab => tab.getAttribute('data-tab') === activeTabFromMetadata);
      
      const tabToSelect = tabExists ? activeTabFromMetadata : 'current-status';
      
      // UIを更新
      uiRenderer.selectTab(tabToSelect, false);
    }
    
    // 状態を更新
    stateManager.setState({
      activeProjectName: project.name,
      activeProjectPath: project.path,
      activeTab: project.metadata?.activeTab || 'current-status'
    });
  }
}

// シングルトンインスタンス
export default new MessageHandler();
```

### 4. UIRenderer（UI更新）

**ファイル**: `media/utils/uiRenderer.js`

```javascript
// @ts-check
import stateManager from '../state/stateManager.js';
import markdownConverter from './markdownConverter.js';

/**
 * UI更新クラス - 状態に基づいてUI要素を更新
 */
class UIRenderer {
  /**
   * スコープリストを更新
   * @param {Array} scopes スコープ一覧
   */
  updateScopeList(scopes) {
    const scopeList = document.getElementById('scope-list');
    if (!scopeList) return;
    
    // リストをクリア
    scopeList.innerHTML = '';
    
    // スコープがない場合は空のメッセージを表示
    if (!scopes || scopes.length === 0) {
      scopeList.innerHTML = `
        <div class="scope-item">
          <p>スコープが定義されていません</p>
          <p>CURRENT_STATUS.mdファイルにスコープを追加してください</p>
        </div>
      `;
      return;
    }
    
    // 現在選択されているスコープのインデックス
    const selectedIndex = stateManager.getState().selectedScopeIndex;
    
    // 各スコープをリストに追加
    scopes.forEach((scope, index) => {
      const statusClass = this._getStatusClass(scope.status);
      const progressPercentage = scope.progress || 0;
      
      // スコープアイテムの作成
      const scopeItem = document.createElement('div');
      scopeItem.className = `scope-item ${index === selectedIndex ? 'active' : ''}`;
      scopeItem.innerHTML = `
        <h3>${scope.name}</h3>
        <div class="scope-progress">
          <div class="scope-progress-bar ${statusClass}" style="width: ${progressPercentage}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
          <span style="font-size: 0.9rem; color: var(--app-text-secondary);">${scope.files ? scope.files.length : 0}ファイル</span>
          <span style="font-size: 0.9rem; padding: 2px 8px; background-color: var(--app-primary-light); color: var(--app-primary); border-radius: 10px;">
            ${progressPercentage}% ${this._getStatusText(scope.status)}
          </span>
        </div>
      `;
      
      scopeList.appendChild(scopeItem);
    });
  }
  
  /**
   * 選択されたスコープの詳細を更新
   * @param {Object} scope スコープ情報
   */
  updateSelectedScope(scope) {
    const scopeTitle = document.getElementById('scope-title');
    const scopeDescription = document.getElementById('scope-description');
    const scopeProgressBar = document.getElementById('scope-progress-bar');
    const scopeProgressText = document.getElementById('scope-progress');
    const implementationFiles = document.getElementById('implementation-files');
    
    if (scopeTitle) {
      scopeTitle.textContent = scope.name;
    }
    
    if (scopeDescription) {
      scopeDescription.textContent = scope.description || '説明がありません';
    }
    
    const progress = scope.progress || 0;
    
    if (scopeProgressBar) {
      scopeProgressBar.style.width = `${progress}%`;
      scopeProgressBar.className = `progress-fill ${this._getStatusClass(scope.status)}`;
    }
    
    if (scopeProgressText) {
      scopeProgressText.textContent = `${progress}%`;
    }
    
    // 実装予定ファイルのリスト更新
    if (implementationFiles) {
      implementationFiles.innerHTML = '';
      
      if (scope.files && scope.files.length > 0) {
        scope.files.forEach(file => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          fileItem.innerHTML = `
            <input type="checkbox" class="file-checkbox" ${file.completed ? 'checked' : ''} data-path="${file.path}" />
            <span>${file.path}</span>
          `;
          
          implementationFiles.appendChild(fileItem);
        });
        
        // チェックボックスのイベントリスナー設定
        const checkboxes = implementationFiles.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', (e) => {
            const path = e.target.getAttribute('data-path');
            stateManager.sendMessage('toggleFileStatus', {
              filePath: path,
              completed: e.target.checked
            });
          });
        });
      } else {
        implementationFiles.innerHTML = '<div class="file-item">実装予定ファイルがありません</div>';
      }
    }
    
    // スコープ詳細カードを表示
    const scopeDetailContent = document.getElementById('scope-detail-content');
    if (scopeDetailContent) {
      scopeDetailContent.style.display = 'block';
    }
    
    // 空メッセージを非表示
    const scopeEmptyMessage = document.getElementById('scope-empty-message');
    if (scopeEmptyMessage) {
      scopeEmptyMessage.style.display = 'none';
    }
  }
  
  /**
   * プロジェクト進捗を更新
   * @param {Array} scopes スコープ一覧
   */
  updateProjectProgress(scopes) {
    if (!scopes || scopes.length === 0) {
      return;
    }
    
    const progressElement = document.getElementById('project-progress');
    const progressText = document.getElementById('project-progress-text');
    
    // プロジェクト全体の進捗を計算
    const totalScopes = scopes.length;
    const completedScopes = scopes.filter(scope => scope.status === 'completed').length;
    const inProgressScopes = scopes.filter(scope => scope.status === 'in-progress').length;
    
    // 進捗率の計算 (完了=100%, 進行中=50%として計算)
    const progressPercentage = Math.round((completedScopes * 100 + inProgressScopes * 50) / totalScopes);
    
    // 進捗バーの更新
    if (progressElement) {
      progressElement.style.width = `${progressPercentage}%`;
    }
    
    // 進捗テキストの更新
    if (progressText) {
      progressText.textContent = `${progressPercentage}% 完了`;
    }
  }
  
  /**
   * マークダウンコンテンツを表示
   * @param {string} markdownContent マークダウンテキスト
   */
  displayMarkdownContent(markdownContent) {
    const markdownContainer = document.querySelector('.markdown-content');
    if (markdownContainer) {
      // マークダウンをHTMLに変換
      const htmlContent = markdownConverter.toHtml(markdownContent);
      
      // HTML内容を設定
      markdownContainer.innerHTML = htmlContent;
      
      // ディレクトリツリーと表の特別なスタイリングを適用
      this._enhanceSpecialElements();
      
      // チェックボックスのイベントリスナー設定
      this._setupCheckboxes();
    }
  }
  
  /**
   * ディレクトリツリーと表の特別なスタイリングを適用
   * @private
   */
  _enhanceSpecialElements() {
    try {
      // ディレクトリツリーの処理
      const directoryTrees = document.querySelectorAll('.directory-tree');
      directoryTrees.forEach(tree => {
        // ツリー項目の特別スタイリング
        const treeItems = tree.querySelectorAll('.tree-item');
        treeItems.forEach(item => {
          // 必要に応じて追加スタイリング
          item.style.fontFamily = 'monospace';
        });
        
        // 適切なスタイルクラスを追加
        tree.classList.add('enhanced-tree');
      });
      
      // プレーンなコードブロックの処理
      const preBlocks = document.querySelectorAll('.markdown-content pre.code-block');
      preBlocks.forEach(preBlock => {
        const content = preBlock.textContent || '';
        
        // コードブロックのベーススタイル
        preBlock.style.fontFamily = 'monospace';
        preBlock.style.whiteSpace = 'pre';
        preBlock.style.overflow = 'auto';
        preBlock.style.backgroundColor = 'var(--app-gray-100)';
        preBlock.style.padding = '12px';
        preBlock.style.borderRadius = 'var(--app-border-radius-sm)';
        preBlock.style.border = '1px solid var(--app-border-color)';
        preBlock.style.lineHeight = '1.5';
        preBlock.style.color = 'var(--app-text)';
        
        // ディレクトリ構造っぽい特徴を持っているかチェック
        if ((content.includes('├') || content.includes('└') || content.includes('│')) && 
            content.includes('/')) {
          
          // ディレクトリ構造のような特徴を持つブロックには特別なクラスを追加
          preBlock.classList.add('directory-structure');
        }
      });
    } catch (error) {
      console.error('特殊要素のスタイリング中にエラーが発生しました:', error);
    }
  }
  
  /**
   * マークダウン内のチェックボックスにイベントリスナーを設定
   * @private
   */
  _setupCheckboxes() {
    const checkboxes = document.querySelectorAll('.markdown-content input[type="checkbox"]');
    
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
   * プロジェクトパスを更新
   * @param {Object} data プロジェクトパスデータ
   */
  updateProjectPath(data) {
    const projectNameElement = document.querySelector('.project-display .project-name');
    const projectPathElement = document.querySelector('.project-path-display');
    
    // プロジェクト情報の更新
    if (data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      
      // プロジェクト表示部分を更新
      if (projectNameElement) {
        projectNameElement.textContent = projectName || 'プロジェクト';
      }
    }
    
    if (projectPathElement) {
      projectPathElement.textContent = data.projectPath || '/path/to/project';
    }
  }
  
  /**
   * プロジェクト名を更新
   * @param {string} projectName プロジェクト名
   */
  updateProjectName(projectName) {
    // プロジェクト名をヘッダーに更新
    const projectDisplayName = document.querySelector('.project-display .project-name');
    if (projectDisplayName) {
      projectDisplayName.textContent = projectName;
    }
  }
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブプロジェクト
   */
  updateProjects(projects, activeProject) {
    const projectList = document.getElementById('project-list');
    if (!projectList) return;
    
    // 既存のアクティブプロジェクトエリアがあれば削除
    const existingActiveArea = document.getElementById('active-project-area');
    if (existingActiveArea) {
      existingActiveArea.remove();
    }
    
    // 既存の他のプロジェクトラベルがあれば削除
    const existingLabel = document.getElementById('other-projects-label');
    if (existingLabel) {
      existingLabel.remove();
    }
    
    // リストをクリア
    projectList.innerHTML = '';
    
    // プロジェクトがない場合の表示
    if (!projects || projects.length === 0) {
      projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // ソート済みのプロジェクト配列を作成
    let sortedProjects = [...projects];
    sortedProjects.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // プロジェクトをリストに追加
    sortedProjects.forEach((project) => {
      const item = document.createElement('div');
      const isActive = activeProject && activeProject.id === project.id;
      
      item.className = isActive ? 'project-item active' : 'project-item';
      if (isActive) {
        item.id = 'active-project-item';
      }
      
      // プロジェクト表示名の設定
      let displayName = project.name || '';
      if (!displayName && project.path) {
        const pathParts = project.path.split(/[/\\]/);
        displayName = pathParts[pathParts.length - 1] || 'プロジェクト';
      }
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div>
            <span class="project-name" ${isActive ? 'style="font-weight: 600;"' : ''}>${displayName}</span>
            <span class="project-path" style="font-size: 10px; color: var(--app-text-secondary); display: block; margin-top: 2px;">${project.path || 'パスなし'}</span>
          </div>
          <button class="remove-project-btn" title="プロジェクトの登録を解除" style="background: none; border: none; cursor: pointer; color: var(--app-text-secondary); opacity: 0.5; font-size: 16px;">
            <span class="material-icons" style="font-size: 16px;">close</span>
          </button>
        </div>
      `;
      
      // 削除ボタンのイベントリスナー
      const removeBtn = item.querySelector('.remove-project-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._showProjectRemoveConfirmation(displayName, project);
        });
        
        // ホバー効果
        removeBtn.addEventListener('mouseover', () => {
          removeBtn.style.opacity = '0.8';
          removeBtn.style.color = 'var(--app-text)';
        });
        
        removeBtn.addEventListener('mouseout', () => {
          removeBtn.style.opacity = '0.5';
          removeBtn.style.color = 'var(--app-text-secondary)';
        });
      }
      
      // プロジェクト選択イベント
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-project-btn')) {
          this._selectProject(displayName, project.path);
        }
      });
      
      projectList.appendChild(item);
    });
  }
  
  /**
   * プロジェクト削除確認ダイアログを表示
   * @param {string} projectName プロジェクト名
   * @param {Object} project プロジェクト情報
   * @private
   */
  _showProjectRemoveConfirmation(projectName, project) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '10000';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-title">プロジェクト登録解除の確認</div>
      <div style="margin: 20px 0;">
        <p>プロジェクト「${projectName}」の登録を解除しますか？</p>
        <p style="color: var(--app-text-secondary); font-size: 0.9em; margin-top: 10px;">
          注意: この操作はプロジェクトファイルを削除するものではなく、
          AppGeniusからの登録を解除するだけです。
        </p>
      </div>
      <div class="dialog-footer">
        <button class="button button-secondary" id="cancel-remove">キャンセル</button>
        <button class="button" id="confirm-remove" style="background-color: var(--app-danger);">登録解除</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // キャンセルボタン
    document.getElementById('cancel-remove')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    // 確認ボタン
    document.getElementById('confirm-remove')?.addEventListener('click', () => {
      stateManager.sendMessage('removeProject', {
        projectName: projectName,
        projectPath: project.path,
        projectId: project.id
      });
      
      document.body.removeChild(overlay);
    });
  }
  
  /**
   * プロジェクトを選択
   * @param {string} projectName プロジェクト名
   * @param {string} projectPath プロジェクトパス
   * @private
   */
  _selectProject(projectName, projectPath) {
    // 現在のアクティブタブIDを取得
    const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
    
    // 状態を保存
    stateManager.setState({
      activeProjectName: projectName,
      activeProjectPath: projectPath,
      activeTab: currentActiveTab || 'current-status'
    });
    
    // プロジェクト選択メッセージを送信
    stateManager.sendMessage('selectProject', {
      projectName: projectName,
      projectPath: projectPath,
      activeTab: currentActiveTab
    });
    
    // 選択中の通知を表示
    this._showProjectLoadingNotification(projectName);
  }
  
  /**
   * プロジェクト読み込み中通知を表示
   * @param {string} projectName プロジェクト名
   * @private
   */
  _showProjectLoadingNotification(projectName) {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.innerHTML = `
      <span class="material-icons" style="color: var(--app-warning);">hourglass_top</span>
      <span class="notification-text">プロジェクト「${projectName}」を読み込み中...</span>
    `;
    
    // スタイル設定
    notification.style.display = 'flex';
    notification.style.opacity = '1';
    notification.style.backgroundColor = 'rgba(253, 203, 110, 0.15)';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.alignItems = 'center';
    notification.style.gap = '8px';
    notification.style.zIndex = '1000';
    
    // 通知を表示
    document.body.appendChild(notification);
    
    // 3秒後に自動で閉じる
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
  
  /**
   * タブを選択
   * @param {string} tabId タブID
   * @param {boolean} saveToServer サーバーに保存するか
   */
  selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // タブのアクティブ状態を更新
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // タブコンテンツの表示状態を更新
    tabContents.forEach(content => {
      if (content.id === `${tabId}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // 状態を更新
    stateManager.setState({ activeTab: tabId }, false);
    
    // サーバーに保存
    if (saveToServer) {
      stateManager.saveTabState(tabId);
    }
  }
  
  /**
   * ツールタブの内容を更新
   * @param {string} content HTMLコンテンツ
   */
  updateToolsTab(content) {
    const toolsTab = document.getElementById('tools-tab');
    if (!toolsTab) return;
    
    toolsTab.innerHTML = content;
  }
  
  /**
   * ディレクトリ構造ダイアログを表示
   * @param {string} structure ディレクトリ構造テキスト
   */
  showDirectoryStructure(structure) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-title">プロジェクト構造</div>
      <div style="max-height: 400px; overflow-y: auto; font-family: monospace; white-space: pre; font-size: 12px;">
        ${structure.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      <div class="dialog-footer">
        <button class="button" id="close-dialog">閉じる</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 閉じるボタン
    document.getElementById('close-dialog').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  }
  
  /**
   * エラーメッセージを表示
   * @param {string} message メッセージ
   */
  showError(message) {
    this._showNotification(message, 'error');
  }
  
  /**
   * 成功メッセージを表示
   * @param {string} message メッセージ
   */
  showSuccess(message) {
    this._showNotification(message, 'success');
  }
  
  /**
   * 通知メッセージを表示
   * @param {string} message メッセージ
   * @param {'error'|'success'|'info'|'warning'} type 通知タイプ
   * @private
   */
  _showNotification(message, type) {
    // 既存の通知を削除
    document.querySelectorAll('.notification-message').forEach(el => el.remove());
    
    // 通知のスタイル情報
    const styles = {
      error: { bg: '#f8d7da', color: '#721c24', icon: '⚠️' },
      success: { bg: '#d4edda', color: '#155724', icon: '✅' },
      info: { bg: '#d1ecf1', color: '#0c5460', icon: 'ℹ️' },
      warning: { bg: '#fff3cd', color: '#856404', icon: '⚠️' }
    };
    
    const style = styles[type] || styles.info;
    
    // 通知要素の作成
    const notification = document.createElement('div');
    notification.className = `notification-message ${type}-message`;
    notification.innerHTML = `<span>${style.icon}</span> ${message}`;
    
    // スタイル設定
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: style.bg,
      color: style.color,
      padding: '10px 20px',
      borderRadius: '4px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      zIndex: '10000'
    });
    
    document.body.appendChild(notification);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
  
  /**
   * ステータスに応じたCSSクラスを返す
   * @param {string} status ステータス
   * @returns {string} CSSクラス
   * @private
   */
  _getStatusClass(status) {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'in-progress':
        return 'status-in-progress';
      case 'blocked':
        return 'status-blocked';
      case 'pending':
      default:
        return 'status-pending';
    }
  }
  
  /**
   * ステータスの表示テキストを返す
   * @param {string} status ステータス
   * @returns {string} 表示テキスト
   * @private
   */
  _getStatusText(status) {
    switch (status) {
      case 'completed':
        return '完了';
      case 'in-progress':
        return '進行中';
      case 'blocked':
        return '停止中';
      case 'pending':
      default:
        return '未着手';
    }
  }
}

// シングルトンインスタンス
export default new UIRenderer();
```

### 5. マークダウン変換（Utils）

**ファイル**: `media/utils/markdownConverter.js`

```javascript
// @ts-check

/**
 * マークダウン変換クラス - マークダウンテキストをHTMLに変換
 */
class MarkdownConverter {
  /**
   * マークダウンテキストをHTMLに変換
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML
   */
  static toHtml(markdown) {
    if (!markdown) return '';
    
    // コードブロックを先に処理して保護
    const codeBlocks = [];
    let processedMarkdown = markdown.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `CODE_BLOCK_${codeBlocks.length}`;
      codeBlocks.push(code);
      return id;
    });
    
    // テーブルを先に処理して保護
    const tables = [];
    processedMarkdown = processedMarkdown.replace(/\|(.+)\|\s*\n\|(?:[-:]+\|)+\s*\n(\|(?:.+)\|\s*\n)+/g, (match) => {
      const id = `TABLE_BLOCK_${tables.length}`;
      tables.push(match);
      return id;
    });
    
    // 強調（太字）を保護
    const boldTexts = [];
    processedMarkdown = processedMarkdown.replace(/\*\*(.+?)\*\*/g, (match, text) => {
      const id = `BOLD_TEXT_${boldTexts.length}`;
      boldTexts.push(text);
      return id;
    });
    
    // 斜体を保護
    const italicTexts = [];
    processedMarkdown = processedMarkdown.replace(/(?<!\*)\*([^\*]+)\*(?!\*)/g, (match, text) => {
      const id = `ITALIC_TEXT_${italicTexts.length}`;
      italicTexts.push(text);
      return id;
    });
    
    // 番号付きリストアイテムの番号を保持する特別処理
    processedMarkdown = processedMarkdown.replace(/^(\s*)(\d+)\.\s+(.+)$/gm, (match, indent, number, content) => {
      return `${indent}NUM_LIST_${number}. ${content}`;
    });
    
    // ネスト付きリストの処理のために行を分割
    const lines = processedMarkdown.split('\n');
    const processedLines = [];
    let inList = false;
    let inNumberedList = false;
    let currentListLevel = 0;
    let listStack = [];
    
    // 各行を順番に処理
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 番号付きリストアイテムの検出
      const numberedListMatch = trimmedLine.match(/^(\s*)NUM_LIST_(\d+)\. (.+)$/);
      
      // 通常のリストアイテムの検出
      const listMatch = trimmedLine.match(/^(\s*)[-*+] (.+)$/);
      
      if (numberedListMatch) {
        // 番号付きリスト処理
        // ...
        const indent = numberedListMatch[1];
        const number = numberedListMatch[2];
        const content = numberedListMatch[3];
        const indentLevel = Math.floor(indent.length / 2); // 2スペースごとに1レベル
        
        // リスト開始または継続
        if (!inList) {
          inList = true;
          inNumberedList = true;
          processedLines.push('<ol>');
          listStack.push('ol');
          currentListLevel = 0;
        } else if (!inNumberedList && currentListLevel === 0) {
          // 番号なしから番号付きリストへの切り替え
          processedLines.push('</ul>');
          listStack.pop();
          processedLines.push('<ol>');
          listStack.push('ol');
          inNumberedList = true;
        }
        
        // レベル調整処理
        // ...
        // リストアイテムの追加（番号付き）
        processedLines.push(`<li value="${number}">${content}</li>`);
      } else if (listMatch) {
        // 通常リスト処理
        // ...
        const indent = listMatch[1];
        const content = listMatch[2];
        const indentLevel = Math.floor(indent.length / 2); // 2スペースごとに1レベル
        
        // リスト開始または継続
        if (!inList) {
          inList = true;
          inNumberedList = false;
          processedLines.push('<ul>');
          listStack.push('ul');
          currentListLevel = 0;
        } else if (inNumberedList && currentListLevel === 0) {
          // 番号付きから番号なしリストへの切り替え
          processedLines.push('</ol>');
          listStack.pop();
          processedLines.push('<ul>');
          listStack.push('ul');
          inNumberedList = false;
        }
        
        // レベル調整処理
        // ...
        // リストアイテムの追加（通常）
        processedLines.push(`<li>${content}</li>`);
      } else if (trimmedLine === '' && inList) {
        // 空行でリストを終了
        while (listStack.length > 0) {
          processedLines.push(`</${listStack.pop()}>`);
        }
        inList = false;
        inNumberedList = false;
        currentListLevel = 0;
        processedLines.push('');
      } else {
        // 通常の行はそのまま追加
        processedLines.push(line);
      }
    }
    
    // リストが閉じられていない場合は閉じる
    if (inList) {
      while (listStack.length > 0) {
        processedLines.push(`</${listStack.pop()}>`);
      }
    }
    
    // 処理済みの行を結合
    let processedText = processedLines.join('\n');
    
    // 見出し処理
    processedText = processedText
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    
    // リンク処理
    processedText = processedText
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    // インラインコード処理
    processedText = processedText
      .replace(/`(.+?)`/g, '<code>$1</code>');
    
    // 太字テキストを復元
    for (let i = 0; i < boldTexts.length; i++) {
      processedText = processedText.replace(
        new RegExp(`BOLD_TEXT_${i}`, 'g'), 
        `<strong>${boldTexts[i]}</strong>`
      );
    }
    
    // 斜体テキストを復元
    for (let i = 0; i < italicTexts.length; i++) {
      processedText = processedText.replace(
        new RegExp(`ITALIC_TEXT_${i}`, 'g'), 
        `<em>${italicTexts[i]}</em>`
      );
    }
    
    // 段落処理
    let html = processedText.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // テーブルを復元して変換
    html = html.replace(/TABLE_BLOCK_(\d+)/g, (match, index) => {
      const tableContent = tables[parseInt(index, 10)];
      return this.convertMarkdownTableToHtml(tableContent);
    });
    
    // コードブロックを復元
    html = html.replace(/CODE_BLOCK_(\d+)/g, (match, index) => {
      const code = codeBlocks[parseInt(index, 10)];
      // コードブロックをHTMLエスケープして<pre>タグで囲む
      const escapedCode = this._escapeHtml(code);
      return `<pre class="code-block">${escapedCode}</pre>`;
    });
    
    return html;
  }
  
  /**
   * マークダウンテーブルをHTMLテーブルに変換
   * @param {string} markdownTable マークダウン形式のテーブル
   * @returns {string} HTMLテーブル
   */
  static convertMarkdownTableToHtml(markdownTable) {
    try {
      if (!markdownTable) return '';
      
      // テーブル行を分割
      const lines = markdownTable.trim().split('\n');
      if (lines.length < 3) return markdownTable; // 最低でもヘッダー行、区切り行、データ行が必要
      
      // ヘッダー行を処理
      const headerRow = lines[0];
      const headers = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      
      // 行の配置情報を取得（左寄せ、中央寄せ、右寄せ）
      const alignmentRow = lines[1];
      const alignments = alignmentRow.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });
      
      // テーブルのHTML開始
      let html = '<table class="md-table">\n';
      
      // ヘッダー行を追加
      html += '  <thead>\n    <tr>\n';
      headers.forEach((header, index) => {
        const align = alignments[index] || 'left';
        html += `      <th style="text-align: ${align}">${header}</th>\n`;
      });
      html += '    </tr>\n  </thead>\n';
      
      // データ行を追加
      html += '  <tbody>\n';
      for (let i = 2; i < lines.length; i++) {
        const row = lines[i];
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        
        html += '    <tr>\n';
        cells.forEach((cell, index) => {
          const align = alignments[index] || 'left';
          html += `      <td style="text-align: ${align}">${cell}</td>\n`;
        });
        html += '    </tr>\n';
      }
      html += '  </tbody>\n</table>';
      
      return html;
    } catch (error) {
      console.error('テーブル変換エラー:', error);
      return markdownTable; // エラー時は元のマークダウンを返す
    }
  }
  
  /**
   * HTMLエスケープ
   * @param {string} text エスケープするテキスト
   * @returns {string} エスケープされたテキスト
   * @private
   */
  static _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export default MarkdownConverter;
```

### 6. 新しいscopeManager.js（エントリーポイント）

**ファイル**: `media/scopeManager.js`

```javascript
// @ts-check

// VSCode API取得 
const vscode = acquireVsCodeApi();

// コンポーネント・サービスのインポート
import stateManager from './state/stateManager.js';
import messageHandler from './utils/messageHandler.js';
import eventManager from './utils/eventManager.js';
import uiRenderer from './utils/uiRenderer.js';
import './components/tabManager/tabManager.js';
import './components/projectNavigation/projectNavigation.js';
import './components/markdownViewer/markdownViewer.js';
import './components/dialogManager/dialogManager.js';

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('ScopeManager: DOM読み込み完了、初期化を開始します');
  
  try {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });
    
    // 保存されたプロジェクト状態を復元（他のパネルから戻ってきた時のため）
    setTimeout(() => {
      const state = stateManager.getState();
      
      if (state.activeTab) {
        const tabExists = Array.from(document.querySelectorAll('.tab'))
          .some(tab => tab.getAttribute('data-tab') === state.activeTab);
        
        const tabToSelect = tabExists ? state.activeTab : 'current-status';
        uiRenderer.selectTab(tabToSelect, false);
      }
    }, 100);
    
    console.log('ScopeManager: 初期化が完了しました');
  } catch (error) {
    console.error('ScopeManager: 初期化中にエラーが発生しました', error);
  }
});

// アンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
  eventManager.cleanup();
});
```

## 移行計画

1. **準備フェーズ**
   - 必要なディレクトリ構造を作成
   - バックアップを取る

2. **基盤構築フェーズ**
   - stateManager.jsの実装
   - markdownConverter.jsの実装
   - uiRenderer.jsの実装
   - messageHandler.jsの実装
   - eventManager.jsの実装

3. **検証と修正フェーズ**
   - 全コンポーネントを連携して動作確認
   - デバッグと修正

4. **完了フェーズ**
   - 新しいscopeManager.jsへの切り替え
   - 最終検証

## 移行における注意点

1. **下位互換性の確保**
   - 既存のメッセージプロトコルとの互換性を維持
   - 状態形式の互換性を維持

2. **段階的な実装**
   - 一度にすべての変更を行わず、一部ずつ実装して検証

3. **適切なモジュール間連携**
   - 循環参照を避ける
   - 明確な責任分担を維持

4. **エラーハンドリング**
   - 適切なエラーハンドリングと回復メカニズム
   - ロギングの充実

## 期待される効果

1. **メンテナンス性の向上**
   - 各モジュールが明確な責任を持ち、修正が容易になる
   - コードが整理され、理解しやすくなる

2. **拡張性の向上**
   - 新機能追加時に適切なモジュールのみを変更
   - プラグイン構造によるカスタマイズ容易性

3. **パフォーマンスの向上**
   - 必要に応じた更新のみを行い、不要な再描画を減少
   - メモリ使用量の最適化

4. **品質の向上**
   - テスト可能性の向上によるバグの減少
   - 明確な責任分担によるエラーの特定容易化





