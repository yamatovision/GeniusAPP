// @ts-check

/**
 * ScopeManager - エントリーポイント
 * 
 * このファイルは、ScopeManagerの主要コンポーネントをインポートし、
 * 初期化と連携を行うエントリーポイントとして機能します。
 * 詳細な実装は各コンポーネントに委譲されています。
 */

// 外部モジュールのインポート
import { showError, showSuccess } from './utils/uiHelpers.js';
import tabManager from './components/tabManager/tabManager.js';
import stateManager from './state/stateManager.js';
import markdownViewer from './components/markdownViewer/markdownViewer.js';
import projectNavigation from './components/projectNavigation/projectNavigation.js';
import dialogManager from './components/dialogManager/dialogManager.js';
import promptCards from './components/promptCards/promptCards.js';
import fileBrowser from './components/fileBrowser/fileBrowser.js';

// VSCode APIを安全に取得
let vscode;
try {
  // グローバル変数として既に存在するか確認
  if (typeof window.vsCodeApi !== 'undefined') {
    vscode = window.vsCodeApi;
  } else {
    // 新規取得
    vscode = acquireVsCodeApi();
    // グローバル変数として保存して他のスクリプトでも使えるように
    window.vsCodeApi = vscode;
  }
} catch (e) {
  // エラー時のフォールバック
  vscode = {
    postMessage: function(msg) { 
      console.log('ダミーvscode.postMessage:', msg); 
    },
    getState: function() { return {}; },
    setState: function() {}
  };
}

// 自己実行関数でスコープを作成
(function() {
  /**
   * StateManagerからのイベントリスナーを設定
   */
  function setupStateManagerEvents() {
    // タブ状態が更新されたときのイベントを購読
    document.addEventListener('tab-state-updated', (event) => {
      tabManager.selectTab(event.detail.tabId, event.detail.saveToServer);
    });
    
    // マークダウンが更新されたときのイベントを購読
    document.addEventListener('markdown-updated', (event) => {
      // markdownViewerに直接処理を委譲
      markdownViewer.updateContent(event.detail.content);
    });
  }

  /**
   * ClaudeCode連携エリアの初期化
   * 注: 基本的な表示/非表示のトグル処理のみを担当し、
   * 詳細機能はsharingPanel.jsに任せる簡易版
   */
  function initializeClaudeCodeShareArea() {
    // トグルボタンとシェアエリア要素を取得
    const toggleBtn = document.getElementById('toggle-share-btn');
    const shareArea = document.getElementById('claude-code-share');
    const minimizeBtn = document.getElementById('minimize-share-btn');
    
    if (!toggleBtn || !shareArea || !minimizeBtn) return;
    
    // 初期状態では非表示
    shareArea.classList.add('collapsed');
    
    // トグルボタンのクリックイベント
    toggleBtn.addEventListener('click', () => {
      shareArea.classList.remove('collapsed');
      toggleBtn.style.display = 'none';
    });
    
    // 最小化ボタンのクリックイベント
    minimizeBtn.addEventListener('click', () => {
      shareArea.classList.add('collapsed');
      toggleBtn.style.display = 'flex';
    });

    // 開発プロンプトカードを初期化 (promptCards.jsコンポーネントが担当)
    promptCards.initializePromptCardsInModal();
  }
  
  /**
   * イベントリスナーの設定
   */
  function setupEventListeners() {
    // 実装開始ボタン
    const implementButton = document.getElementById('implement-button');
    if (implementButton) {
      implementButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'startImplementation' });
      });
    }
    
    // スコープ新規作成ボタン
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      createScopeButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'addNewScope' });
      });
    }
  }

  // ページ読み込み完了時の処理
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });
    
    // イベントリスナー設定
    setupEventListeners();
    
    // StateManagerのイベントリスナーを設定
    setupStateManagerEvents();
    
    // 各コンポーネントの初期化（順序が重要）
    // 1. プロンプトカードの初期化
    promptCards.initializePromptCards();
    
    // 2. プロジェクトナビゲーションの初期化
    projectNavigation.initializeNavigation();
    
    // 3. ClaudeCode連携エリアの初期化
    initializeClaudeCodeShareArea();
    
    // 4. マークダウン表示の初期化を委譲
    markdownViewer.init();
    
    // 5. クライアント側のファイルブラウザUIの準備
    // 注：実際の初期化とファイル読み込みはサーバーサイド(VSCode拡張)で処理
    if (typeof fileBrowser.prepareUI === 'function') {
      fileBrowser.prepareUI(); 
    } else if (typeof fileBrowser.initialize === 'function') {
      // 後方互換性のため
      fileBrowser.initialize();
    }
    
    // 保存されたプロジェクト状態を復元（他のパネルから戻ってきた時のため）
    // 初期化メッセージのレスポンスを優先するため、短いタイムアウト後に実行
    setTimeout(() => stateManager.restoreProjectState(), 100);
  });
  
  // メッセージハンドラー
  window.addEventListener('message', event => {
    const message = event.data;
    
    // シェアリングパネル関連のメッセージは無視（sharingPanel.jsが処理）
    if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
      return; // sharingPanel.jsに処理を任せる
    }
    
    switch (message.command) {
      case 'updateState':
        // StateManagerに処理を委譲
        stateManager.handleUpdateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'showSuccess':
        showSuccess(message.message);
        break;
      case 'updateFileList':
        // ファイルブラウザコンポーネントに委譲
        if (fileBrowser && typeof fileBrowser.updateFileList === 'function') {
          fileBrowser.updateFileList(message.files);
        }
        break;
      case 'updateFileBrowser':
        // updateFileBrowserコマンドを処理
        if (fileBrowser) {
          console.log('scopeManager: updateFileBrowserメッセージを受信しました');
          
          if (typeof fileBrowser.updateFileList === 'function' && message.files) {
            // ファイルリストがある場合はそのまま渡す
            console.log('scopeManager: updateFileBrowser -> updateFileListに変換して処理します');
            fileBrowser.updateFileList(message.files);
            
            // 現在のパスを更新（必要であれば）
            if (message.currentPath && !fileBrowser.currentPath) {
              fileBrowser.currentPath = message.currentPath;
              console.log(`scopeManager: ファイルブラウザの現在のパスを更新: ${message.currentPath}`);
            }
          } else if (message.structure) {
            // 構造情報がある場合は直接構造情報を処理
            console.log('scopeManager: ファイルブラウザの構造情報を処理します');
            
            // プロジェクトパスを特定
            let projectPath = null;
            
            // structureからパスを抽出
            if (typeof message.structure === 'string' && message.structure.startsWith('/')) {
              projectPath = message.structure.split('\n')[0].trim();
              console.log(`scopeManager: 構造情報からプロジェクトパスを抽出: ${projectPath}`);
              
              // .DS_Storeなどの隠しファイルをパスから検出して除外
              if (projectPath.endsWith('.DS_Store')) {
                // 親ディレクトリを取得
                projectPath = projectPath.substring(0, projectPath.lastIndexOf('/'));
                console.log(`scopeManager: .DS_Storeを除外し、親ディレクトリを使用: ${projectPath}`);
              }
              
              // fileBrowserの現在のパスを更新
              fileBrowser.currentPath = projectPath;
            }
            
            // 抽出したパスでディレクトリリストを要求
            if (projectPath && typeof fileBrowser._requestDirectoryListing === 'function') {
              console.log(`scopeManager: プロジェクトパスでディレクトリリストを要求: ${projectPath}`);
              fileBrowser._requestDirectoryListing(projectPath);
            } else if (typeof fileBrowser.updateDirectoryStructure === 'function') {
              // 直接構造情報を処理
              fileBrowser.updateDirectoryStructure(message.structure);
            }
          }
        }
        break;
      case 'updateDirectoryStructure':
        // ディレクトリ構造更新処理（必要に応じてファイルブラウザに反映）
        if (fileBrowser) {
          console.log('scopeManager: ディレクトリ構造の更新メッセージを受信しました');
          
          // プロジェクトパスを特定
          let projectPath = null;
          
          // structureからパスを抽出
          if (typeof message.structure === 'string' && message.structure.startsWith('/')) {
            projectPath = message.structure.split('\n')[0].trim();
            console.log(`scopeManager: 構造情報からプロジェクトパスを抽出: ${projectPath}`);
            
            // .DS_Storeなどの隠しファイルをパスから検出して除外
            if (projectPath.endsWith('.DS_Store')) {
              // 親ディレクトリを取得
              projectPath = projectPath.substring(0, projectPath.lastIndexOf('/'));
              console.log(`scopeManager: .DS_Storeを除外し、親ディレクトリを使用: ${projectPath}`);
            }
            
            // fileBrowserの現在のパスを更新（まだ設定されていなければ）
            if (!fileBrowser.currentPath) {
              fileBrowser.currentPath = projectPath;
              console.log(`scopeManager: ファイルブラウザの現在のパスを設定: ${projectPath}`);
            }
          } else {
            // 現在のパスを取得
            projectPath = fileBrowser.currentPath;
          }
          
          // ファイルブラウザのタブがアクティブな場合、自動的にディレクトリリストを更新
          const activeTabId = stateManager.getState().activeTab;
          if (activeTabId === 'file-browser' && typeof fileBrowser._requestDirectoryListing === 'function' && projectPath) {
            // 現在のプロジェクトパスでファイル一覧を再取得
            console.log(`scopeManager: ファイルブラウザのリストを更新します (パス: ${projectPath})`);
            fileBrowser._requestDirectoryListing(projectPath);
          } else if (typeof fileBrowser.updateDirectoryStructure === 'function') {
            // 直接構造情報を処理
            fileBrowser.updateDirectoryStructure(message.structure);
          }
        }
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'updateFilePreview':
        // ファイルブラウザのプレビュー更新
        if (fileBrowser && typeof fileBrowser.updateFilePreview === 'function') {
          fileBrowser.updateFilePreview(message.content, message.filePath);
        }
        break;
      case 'updateProjectPath':
        // 直接Custom Eventを発行
        const pathEvent = new CustomEvent('project-path-updated', {
          detail: message
        });
        document.dispatchEvent(pathEvent);
        break;
      case 'updateProjectName':
        // 直接Custom Eventを発行
        const event = new CustomEvent('project-name-updated', {
          detail: { name: message.projectName }
        });
        document.dispatchEvent(event);
        break;
      case 'updateMarkdownContent':
        // 現在アクティブなタブIDを確認
        const activeTabId = stateManager.getState().activeTab;

        // 強制更新フラグがある場合は常に処理
        if (message.forceRefresh) {
          console.log('マークダウン強制更新が要求されました');
          markdownViewer.updateContent(message.content);
          break;
        }

        // 進捗状況用のマークダウン更新は、そのタブがアクティブな場合のみ処理
        if (message.forScopeProgress && activeTabId !== 'scope-progress') {
          console.log(`進捗状況タブがアクティブでないため更新をスキップします (現在のタブ: ${activeTabId})`);
          return;
        }

        // 要件定義用のマークダウン更新は、そのタブがアクティブな場合のみ処理
        if (message.forRequirements && activeTabId !== 'requirements') {
          console.log(`要件定義タブがアクティブでないため更新をスキップします (現在のタブ: ${activeTabId})`);
          return;
        }

        // 直接markdownViewerに処理を委譲
        console.log(`マークダウン更新: タブID=${activeTabId}, 長さ=${message.content ? message.content.length : 0}文字`);
        markdownViewer.updateContent(message.content);
        break;
        
      case 'updateTabContent':
        // 特定のタブに対するコンテンツ更新
        if (message.tabId && message.content) {
          // 現在アクティブなタブIDを確認
          const currentActiveTab = stateManager.getState().activeTab;
          
          // 対象のタブがアクティブな場合のみ処理
          if (currentActiveTab === message.tabId) {
            // コンテナ要素を直接取得
            const tabContentEl = document.querySelector(`#${message.tabId}-tab .markdown-content`);
            
            if (tabContentEl) {
              // 更新したコンテナをmarkdownViewerのupdateContentに渡す
              markdownViewer.updateContent(message.content, tabContentEl);
              
              // デバッグログ
              console.log(`タブ ${message.tabId} のコンテンツを更新しました`);
            } else {
              console.error(`タブ ${message.tabId} のコンテナが見つかりません`);
            }
          } else {
            console.log(`現在のアクティブタブ (${currentActiveTab}) と異なるタブ (${message.tabId}) の更新はスキップします`);
          }
        }
        break;
      case 'updateProjects':
        // 直接Custom Eventを発行
        const projectsEvent = new CustomEvent('projects-updated', {
          detail: {
            projects: message.projects,
            activeProject: message.activeProject
          }
        });
        document.dispatchEvent(projectsEvent);
        break;
      case 'selectTab':
        // TabManagerを使用
        tabManager.selectTab(message.tabId);
        break;
      case 'syncProjectState':
        // ProjectManagementServiceからのプロジェクト状態同期メッセージ
        if (message.project) {
          stateManager.syncProjectState(message.project);
        }
        break;
    }
  });
})();