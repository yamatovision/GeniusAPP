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
    this._isProcessingStateUpdate = false;
    this._lastDisplayedMarkdown = '';
  }

  _getDefaultState() {
    return {
      activeTab: 'scope-progress',
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

  /**
   * 状態更新ハンドラー (最適化版)
   * @param {Object} data - 更新する状態データ
   */
  handleUpdateState(data) {
    // データがない場合は処理しない
    if (!data) {
      console.warn('状態更新受信: データなし');
      return;
    }
    
    console.log('状態更新受信: データ処理開始');
    
    // 処理中フラグ（重複実行防止）
    if (this._isProcessingStateUpdate) {
      console.log('状態更新: 別の更新処理が進行中のため遅延実行します');
      // 後で実行するようにキューに入れる
      setTimeout(() => this.handleUpdateState(data), 100);
      return;
    }
    
    this._isProcessingStateUpdate = true;
    
    try {
      // 以前の状態を保持して、本当に変更があるか確認
      const prevState = this.vscode.getState() || {};
      
      // 新しい状態を保存（既存の値を保持しつつ、新しい値で上書き）
      const newState = { ...prevState, ...data };
      this.setState(newState, false); // リスナー通知は後で行うため、ここではfalse
      
      // SCOPE_PROGRESS.mdのマークダウン表示（バックエンドから受け取っている場合）
      // 前回と同じ内容の場合は再レンダリングしない
      if (data.scopeProgressMarkdown && 
          data.scopeProgressMarkdown !== prevState.scopeProgressMarkdown) {
        // マークダウン表示処理のイベントを発火
        const event = new CustomEvent('markdown-updated', {
          detail: { content: data.scopeProgressMarkdown }
        });
        document.dispatchEvent(event);
      } else if (data.progressFilePath && 
                !data.scopeProgressMarkdown && 
                data.progressFilePath !== prevState.lastRequestedProgressFile) {
        // マークダウンデータがない場合はファイル取得メッセージを送信
        // 以前と同じファイルを再度リクエストするのを防止
        console.log('マークダウンコンテンツをリクエスト:', data.progressFilePath);
        newState.lastRequestedProgressFile = data.progressFilePath;
        this.setState(newState, false);
        
        this.sendMessage('getMarkdownContent', {
          filePath: data.progressFilePath
        });
      }
      
      // 状態変更リスナーに通知
      this._notifyListeners();
    } finally {
      // 処理完了
      this._isProcessingStateUpdate = false;
    }
  }

  /**
   * プロジェクト状態を同期する
   * @param {Object} project - プロジェクト情報
   */
  syncProjectState(project) {
    try {
      if (!project) {
        console.warn('プロジェクト情報が空のため同期をスキップします');
        return;
      }
      
      console.log('ProjectManagementServiceからプロジェクト状態を同期:', project);
      
      // 現在の状態を取得
      const state = this.getState();
      
      // 連続同期対策 - 短時間での重複同期を防止
      const now = Date.now();
      const lastSyncTime = state.lastProjectSyncTime || 0;
      const lastSyncId = state.lastSyncedProjectId;
      const syncThreshold = 300; // 300ms以内の同期はスキップ
      
      // 同じプロジェクトの頻繁すぎる同期はスキップ
      if (now - lastSyncTime < syncThreshold && lastSyncId === project.id) {
        console.log(`プロジェクト同期をスキップ: 直近(${now - lastSyncTime}ms前)に同期済み`);
        return;
      }
      
      // 同期状態を更新
      const newState = {
        ...state,
        lastProjectSyncTime: now,
        lastSyncedProjectId: project.id,
        activeProjectName: project.name,
        activeProjectPath: project.path
      };
      
      // タブ状態の同期
      if (project.metadata && project.metadata.activeTab) {
        newState.activeTab = project.metadata.activeTab;
      } else if (!newState.activeTab) {
        newState.activeTab = 'current-status';
      }
      
      // 状態を更新
      this.setState(newState);
      
      // 1. プロジェクト基本情報の更新
      if (project.name) {
        // プロジェクト名を更新するイベントを発火
        const nameEvent = new CustomEvent('project-name-updated', {
          detail: { name: project.name }
        });
        document.dispatchEvent(nameEvent);
      }
      
      if (project.path) {
        // このプロジェクトへの切り替えが初めてか、明示的なリロードの場合のみforceRefreshを有効に
        const isNewProject = state.lastSyncedProjectId !== project.id;
        const isExplicitRefresh = !!project.forceRefresh;
        
        const pathData = {
          projectPath: project.path,
          statusFilePath: project.path ? `${project.path}/docs/SCOPE_PROGRESS.md` : '',
          statusFileExists: true,
          forceRefresh: isNewProject || isExplicitRefresh // 新しいプロジェクトか明示的リフレッシュ時のみ
        };
        
        console.log(`プロジェクトパス更新: ${project.path} (強制更新: ${isNewProject || isExplicitRefresh})`);
        
        // プロジェクトパス更新イベントを発火
        const pathEvent = new CustomEvent('project-path-updated', {
          detail: pathData
        });
        document.dispatchEvent(pathEvent);
      }
      
      // 2. タブ状態の同期
      if (project.metadata && project.metadata.activeTab) {
        // タブ状態更新イベントを発火
        const tabEvent = new CustomEvent('tab-state-updated', {
          detail: { 
            tabId: project.metadata.activeTab,
            saveToServer: false
          }
        });
        document.dispatchEvent(tabEvent);
      }
      
      console.log(`プロジェクト状態同期完了: ${project.name}`);
    } catch (error) {
      console.error('プロジェクト状態の同期中にエラーが発生しました:', error);
    }
  }

  /**
   * プロジェクト選択状態を復元する
   * 他のパネル（モックアップギャラリーなど）から戻ってきた時に、
   * 以前選択していたプロジェクトとタブを復元する
   */
  restoreProjectState() {
    try {
      // 状態の取得
      const currentState = this.getState();
      const { activeProjectName, activeProjectPath, activeTab } = currentState;
      
      // タブが存在するか確認
      if (activeTab) {
        // タブ状態更新イベントを発火
        const tabEvent = new CustomEvent('tab-state-updated', {
          detail: { 
            tabId: activeTab,
            saveToServer: true
          }
        });
        document.dispatchEvent(tabEvent);
      }
      
      // 残りの復元処理は少し遅らせて実行
      setTimeout(() => {
        try {
          // 最新の状態を再取得（遅延実行の間に変わっている可能性があるため）
          const updatedState = this.getState();
          const { activeProjectName, activeProjectPath } = updatedState;
          
          console.log('プロジェクト状態の復元を試みます:', { 
            activeProjectName, 
            activeProjectPath
          });
          
          // 状態がローカルに保存されていない場合はバックエンドから同期されるのを待つ
          if (!activeProjectName || !activeProjectPath) {
            console.log('ローカルにプロジェクト状態が保存されていません。バックエンドから同期を待ちます。');
            return;
          }
          
          // プロジェクト名更新イベントを発火
          const nameEvent = new CustomEvent('project-name-updated', {
            detail: { name: activeProjectName }
          });
          document.dispatchEvent(nameEvent);
          
          // プロジェクトパス更新イベントを発火
          const pathEvent = new CustomEvent('project-path-updated', {
            detail: { 
              projectPath: activeProjectPath,
              statusFilePath: activeProjectPath ? `${activeProjectPath}/docs/SCOPE_PROGRESS.md` : '',
              statusFileExists: true,
              forceRefresh: false // 復元時は強制更新しない
            }
          });
          document.dispatchEvent(pathEvent);
          
        } catch (error) {
          console.error('プロジェクト状態の完全復元中にエラーが発生しました:', error);
        }
      }, 100);
    } catch (error) {
      console.error('プロジェクト状態の復元中にエラーが発生しました:', error);
    }
  }
}

// シングルトンインスタンス
const stateManager = new StateManager();
export default stateManager;