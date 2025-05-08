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
    // タブが未選択の場合、必ず進捗状況タブをデフォルトにする
    const savedTab = state.activeTab || 'scope-progress';
    
    // タブクリックイベントをセットアップ
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (event) => this._handleTabClick(event, tab));
    });
    
    // VSCode再起動時にタブが選択されていない状態を修正 
    // デフォルトで進捗状況タブを選択（初期状態を明示的に設定）
    this.selectTab(savedTab, true); // サーバーにも保存
    
    // 進捗状況タブの場合は、コンテンツも読み込み
    if (savedTab === 'scope-progress') {
      const projectPath = state.activeProjectPath;
      if (projectPath) {
        stateManager.sendMessage('getMarkdownContent', {
          filePath: `${projectPath}/docs/SCOPE_PROGRESS.md`,
          forScopeProgress: true,
          forceRefresh: true
        });
        console.log('TabManager: 初期化時に進捗状況タブを選択し、内容を読み込みます');
      }
    }
    
    // 初期化完了のフラグを設定
    this.isInitialized = true;
    
    // 保留中のタブ選択があれば実行
    if (this.pendingTabId) {
      setTimeout(() => {
        this.selectTab(this.pendingTabId, true);
        this.pendingTabId = null;
      }, 50);
    }
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
      const projectPath = stateManager.getState().activeProjectPath;
      console.log(`ファイルブラウザタブが選択されました。ファイルリストをリフレッシュします: ${projectPath}`);
      
      // fileBrowserコンポーネントが存在していれば初期化
      if (window.fileBrowser) {
        // まずUIを準備
        if (typeof window.fileBrowser.prepareUI === 'function') {
          window.fileBrowser.prepareUI();
        } else if (typeof window.fileBrowser.initialize === 'function') {
          window.fileBrowser.initialize();
        }
        
        // プレースホルダ表示中にファイルリストをリクエスト（遅延実行）
        setTimeout(() => {
          stateManager.sendMessage('refreshFileBrowser', {
            projectPath: projectPath
          });
          
          // 読み込み中表示のクリア
          const fileList = document.getElementById('file-list');
          if (fileList && fileList.innerHTML.includes('読み込み中')) {
            fileList.innerHTML = '<div class="loading-indicator">ファイルリストを取得中...</div>';
          }
        }, 100);
      } else {
        // fileBrowserがない場合はそのままメッセージ送信
        stateManager.sendMessage('refreshFileBrowser', {
          projectPath: projectPath
        });
      }
    } else if (tabId === 'scope-progress') {
      // 進捗状況タブが選択された場合、SCOPE_PROGRESS.mdのコンテンツを明示的に再取得
      stateManager.sendMessage('getMarkdownContent', {
        filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
        forScopeProgress: true
      });
      console.log('進捗状況タブが選択されました。SCOPE_PROGRESS.mdを再読み込みします');
    }
    
    this.selectTab(tabId, true);
  }

  selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    // 初期化前の呼び出しは保留する
    if (!this.isInitialized) {
      this.pendingTabId = tabId;
      return;
    }
    
    // 既に選択中のタブなら何もしない（冗長な処理を防止）
    if (this.activeTab === tabId) {
      // 同じタブが選択されても、進捗状況タブの場合は内容を更新（競合状態を解決するため）
      if (tabId === 'scope-progress') {
        stateManager.sendMessage('getMarkdownContent', {
          filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
          forScopeProgress: true,
          forceRefresh: true // 強制的に再読み込みする
        });
        console.log('進捗状況タブが再選択されました。強制的に再読み込みします');
      }
      return;
    }

    // 進捗状況タブが選択された場合、SCOPE_PROGRESS.mdの内容を明示的に取得
    if (tabId === 'scope-progress') {
      stateManager.sendMessage('getMarkdownContent', {
        filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
        forScopeProgress: true
      });
      console.log('selectTab: 進捗状況タブに切り替えました。SCOPE_PROGRESS.mdを読み込みます');
    } 
    // 要件定義タブが選択された場合、ファイルの読み込みをリクエスト
    else if (tabId === 'requirements') {
      stateManager.sendMessage('loadRequirementsFile');
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