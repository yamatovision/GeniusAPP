// @ts-check
import stateManager from '../../core/stateManager.js';

class TabManager {
  constructor() {
    // タブバーが存在しないため、DOM要素の取得は不要
    this.tabs = [];
    this.tabContents = [];
    this.activeTab = null;
    this.isInitialized = false;
    this.pendingTabId = null;
    this.initialize();
  }

  initialize() {
    // 保存されたタブ状態を復元
    const state = stateManager.getState();
    // LPレプリカが唯一のタブ
    
    // タブバーが存在しないため、クリックイベントは設定しない
    
    // プロジェクト更新イベントリスナーを設定
    window.addEventListener('message', (event) => {
      const message = event.data;
      // プロジェクト更新イベントを処理
      if (message.command === 'project-updated' && message.data) {
        // タブバーがないため、タブ切り替えは不要
        // LPレプリカの初期化が必要な場合のみ処理
        if (message.data.metadata && message.data.metadata.activeTab === 'lp-replica') {
          console.log('プロジェクト更新時にLPレプリカを初期化');
          this.selectTab('lp-replica', false);
        }
      }
    });
    
    // LPレプリカの初期化を実行
    this.selectTab('lp-replica', true);
    
    
    
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


  
  
  
  
  
  selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    // 初期化前の呼び出しは保留する
    if (!this.isInitialized) {
      this.pendingTabId = tabId;
      return;
    }
    
    // タブ選択の再帰ループ検出
    const now = Date.now();
    if (this._lastTabSelectionTime && (now - this._lastTabSelectionTime) < 300) {
      // 前回の選択から300ms以内の場合はスキップ（無限ループ防止）
      console.log(`短時間での連続タブ選択を検出: ${tabId} - スキップします`);
      return;
    }
    this._lastTabSelectionTime = now;
    
    // 既に選択中のタブなら何もしない（冗長な処理を防止）
    if (this.activeTab === tabId) {
      return;
    }
    
    // LPレプリカタブが選択された場合の初期化処理
    if (tabId === 'lp-replica') {
      console.log('[DEBUG] selectTab: LPレプリカタブが選択されました');
      // LPレプリカマネージャーを安全に初期化
      setTimeout(() => {
        if (!window.lpReplicaManager && window.lpReplica) {
          try {
            console.log('[DEBUG] selectTab: LPレプリカマネージャーを初期化します');
            window.lpReplicaManager = new window.lpReplica.Manager();
            console.log('[DEBUG] selectTab: LPレプリカマネージャーの初期化が完了しました');
          } catch (error) {
            console.error('[ERROR] selectTab: LPレプリカマネージャーの初期化に失敗:', error);
          }
        } else if (window.lpReplicaManager) {
          console.log('[DEBUG] selectTab: 既存のLPレプリカマネージャーを使用します');
          // 既存マネージャーでもレプリカ存在チェックを実行（重複チェックは内部で制御される）
          console.log('[DEBUG] selectTab: 既存マネージャーでレプリカ存在チェックを実行');
          setTimeout(() => {
            window.lpReplicaManager.checkReplicaExists();
          }, 100);
        }
      }, 50); // DOM更新後に実行
    }
    
    // タブバーがないためUI更新は不要
    // LPレプリカのコンテンツは常に表示されている
    
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