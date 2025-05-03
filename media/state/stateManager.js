// @ts-check

// VSCode APIを安全に取得
let vscodeInstance;
try {
  // グローバル変数として既に存在するか確認
  if (typeof window.vsCodeApi !== 'undefined') {
    vscodeInstance = window.vsCodeApi;
    console.log('stateManager: 既存のVSCode APIを使用します');
  } else {
    // 新規取得
    vscodeInstance = acquireVsCodeApi();
    console.log('stateManager: VSCode APIを新規取得しました');
    // グローバル変数として保存して他のスクリプトでも使えるように
    window.vsCodeApi = vscodeInstance;
  }
} catch (e) {
  console.error('stateManager: VSCode API取得エラー:', e);
  // エラー時のフォールバック
  vscodeInstance = {
    postMessage: function(msg) { 
      console.log('ダミーvscode.postMessage (stateManager):', msg); 
    },
    getState: function() { return {}; },
    setState: function() {}
  };
}

class StateManager {
  constructor() {
    this.vscode = vscodeInstance;
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
const stateManager = new StateManager();
export default stateManager;