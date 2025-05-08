// @ts-check
import stateManager from '../../state/stateManager.js';

class TabManager {
  constructor() {
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.activeTab = null;
    this.isInitialized = false;
    this.pendingTabId = null;
    this.initialize();
  }

  initialize() {
    // 保存されたタブ状態を復元
    const state = stateManager.getState();
    const savedTab = state.activeTab || 'scope-progress';
    
    // タブクリックイベントをセットアップ
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (event) => this._handleTabClick(event, tab));
    });
    
    // 初期タブを選択
    this.selectTab(savedTab, false);
    
    // 初期化完了のフラグを設定
    this.isInitialized = true;
    
    // 保留中のタブ選択があれば実行
    if (this.pendingTabId) {
      setTimeout(() => {
        this.selectTab(this.pendingTabId, true);
        this.pendingTabId = null;
      }, 50);
    }
    
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
    
    // 各タブの特別な初期化処理
    if (tabId === 'requirements') {
      // 要件定義タブが選択された場合、ファイルの読み込みをリクエスト
      stateManager.sendMessage('loadRequirementsFile');
    } else if (tabId === 'file-browser') {
      // ファイルブラウザタブが選択された場合、ファイルリストのリフレッシュをリクエスト
      stateManager.sendMessage('refreshFileBrowser');
      
      // fileBrowserコンポーネントが存在していれば初期化
      if (window.fileBrowser && typeof window.fileBrowser.initialize === 'function') {
        window.fileBrowser.initialize();
      }
    }
    
    this.selectTab(tabId, true);
  }

  selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    // 初期化前の呼び出しは保留する
    if (!this.isInitialized) {
      this.pendingTabId = tabId;
      console.log(`TabManager: 初期化前のタブ選択を保留: ${tabId}`);
      return;
    }
    
    console.log(`TabManager: selectTab(${tabId}, saveToServer=${saveToServer})`);
    
    // 既に選択中のタブなら何もしない（冗長な処理を防止）
    if (this.activeTab === tabId) {
      console.log(`TabManager: タブ ${tabId} は既に選択中です`);
      return;
    }
    
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