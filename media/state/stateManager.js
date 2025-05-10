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

// markdownConverterをインポート
import { convertMarkdownToHtml } from '../utils/markdownConverter.js';

class StateManager {
  constructor() {
    this.vscode = vscodeInstance;
    this.listeners = new Map();
    this.state = this.vscode.getState() || this._getDefaultState();
  }

  _getDefaultState() {
    return {
      activeTab: 'scope-progress',
      projects: [],
      activeProject: null,
      directoryStructure: '',
      scopeProgressContent: ''
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
  sendMessage(command, data = {}, commandOverride = null) {
    this.vscode.postMessage({
      command: commandOverride || command,
      ...data
    });
  }

  /**
   * 状態更新ハンドラー（シンプル化版）
   * @param {Object} data - 更新する状態データ
   */
  handleUpdateState(data) {
    // データがない場合は処理しない
    if (!data) return;
    
    // 新しい状態を保存
    const prevState = this.state;
    this.setState(data);
    
    // マークダウンコンテンツの更新があれば通知
    if (data.scopeProgressMarkdown && 
        data.scopeProgressMarkdown !== prevState.scopeProgressMarkdown) {
      document.dispatchEvent(new CustomEvent('markdown-updated', {
        detail: { content: data.scopeProgressMarkdown }
      }));
    }
    
    // 進捗ファイルパスが更新され、マークダウンデータがない場合はファイル取得メッセージを送信
    if (data.progressFilePath && 
        !data.scopeProgressMarkdown && 
        data.progressFilePath !== prevState.lastRequestedProgressFile) {
      // リクエスト状態を保存
      this.setState({ lastRequestedProgressFile: data.progressFilePath });
      
      // ファイル内容をリクエスト
      this.sendMessage('getMarkdownContent', {
        filePath: data.progressFilePath
      });
    }
  }

  /**
   * プロジェクト状態を同期する（シンプル化版）
   * @param {Object} project - プロジェクト情報
   */
  syncProjectState(project) {
    if (!project || !project.path) return;
    
    // 現在の状態を取得
    const state = this.getState();
    
    // 最小限の状態更新
    this.setState({
      lastProjectSyncTime: Date.now(),
      lastSyncedProjectId: project.id,
      activeProjectName: project.name,
      activeProjectPath: project.path,
      activeTab: project.metadata?.activeTab || state.activeTab || 'scope-progress'
    });
    
    // 単一のプロジェクト更新イベントを発行
    document.dispatchEvent(new CustomEvent('project-updated', {
      detail: { project }
    }));
    
    // プロジェクトパスが変更された場合、必要な初期コンテンツを読み込む
    const activeTab = project.metadata?.activeTab || 'scope-progress';
    const progressFilePath = `${project.path}/docs/SCOPE_PROGRESS.md`;
    
    // 進捗ファイルを読み込み
    this.sendMessage('getMarkdownContent', {
      filePath: progressFilePath,
      forScopeProgress: true,
      timestamp: Date.now(),
      forceRefresh: true
    });
    
    // アクティブタブに応じて適切なコンテンツを読み込む
    if (activeTab === 'requirements') {
      this.sendMessage('loadRequirementsFile');
    } else if (activeTab === 'file-browser') {
      this.sendMessage('refreshFileBrowser', {
        projectPath: project.path
      });
    }
  }

  /**
   * プロジェクト選択状態を復元する（シンプル化版）
   */
  restoreProjectState() {
    const state = this.getState();
    
    // 再利用可能なsyncProjectStateを呼び出す
    if (state.activeProjectName && state.activeProjectPath) {
      // 既存の状態をプロジェクト形式に変換して同期
      this.syncProjectState({
        name: state.activeProjectName,
        path: state.activeProjectPath,
        id: state.lastSyncedProjectId || `local_${Date.now()}`,
        metadata: { activeTab: state.activeTab }
      });
    }
  }
}

// シングルトンインスタンス
const stateManager = new StateManager();
export default stateManager;