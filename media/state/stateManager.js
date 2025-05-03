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