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
import simpleMarkdownConverter from './utils/simpleMarkdownConverter.js';

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

    // Note: マークダウンビューワーを開くボタンは削除されました
    // 代わりにファイルタブをクリックしたら直接マークダウンビューワーが開きます
  }

  // ページ読み込み完了時の処理
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });

    // シンプルマークダウンコンバーターをグローバル変数として公開
    // これにより、他のコンポーネントから利用可能になる
    window.simpleMarkdownConverter = simpleMarkdownConverter;
    window.markdownViewer = markdownViewer;

    // エラーメッセージ無限ループ防止用のグローバル変数
    window._lastErrorMap = new Map();
    window._processedErrors = new Set();

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

    // 保存されたプロジェクト状態を復元（他のパネルから戻ってきた時のため）
    // 初期化メッセージのレスポンスを優先するため、短いタイムアウト後に実行
    setTimeout(() => stateManager.restoreProjectState(), 100);
  });
  
  // メッセージハンドラー
  window.addEventListener('message', event => {
    const message = event.data;
    
    // シェアリングパネル関連のメッセージは無視（sharingPanel.jsが処理）
    if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
      // sharingPanel.jsに処理を任せるが、念のためmessageオブジェクトを出力
      console.log('共有パネル関連メッセージをsharingPanel.jsに転送:', message.command);
      return;
    }
    
    switch (message.command) {
      case 'updateState':
        // StateManagerに処理を委譲
        stateManager.handleUpdateState(message);
        break;
      case 'showError':
        // マークダウンビューワー関連のエラーは無視（sharingPanelと重複するため）
        if (message.message && message.message.includes('マークダウンビューワーを開けませんでした')) {
          console.warn('マークダウンビューワーエラーを無視します:', message.message);
        } else {
          // その他のエラーは正常に表示
          showError(message.message);
        }
        break;
      case 'showSuccess':
        showSuccess(message.message);
        break;
      // 削除済み: ファイルブラウザ関連メッセージハンドラ
        break;
        
      case 'openFileInTab':
        // ファイルをタブで開く処理
        console.log('scopeManager: ファイルをタブで開きます', message.filePath);
        
        // ファイルのタイプを判定
        const filePath = message.filePath;
        const fileName = filePath.split('/').pop();
        const isMarkdown = fileName.endsWith('.md');
        
        // ファイル内容を取得するためにリクエスト送信
        vscode.postMessage({
          command: 'getFileContentForTab',
          filePath: filePath,
          isMarkdown: isMarkdown,
        });
        break;
        
      case 'openFileContentInTab':
        // ファイル内容をタブで表示
        console.log('scopeManager: ファイル内容をタブで表示します');
        if (message.filePath && message.content) {
          const fileName = message.filePath.split('/').pop();
          
          // タブマネージャーを利用してタブを追加
          if (typeof tabManager.addTab === 'function') {
            // カスタムタブIDを作成
            const tabId = `file-${fileName.replace(/\./g, '-')}`;
            
            // ファイルの内容をタブに表示するカスタムイベントを発行
            const event = new CustomEvent('add-file-tab', {
              detail: {
                tabId: tabId,
                title: fileName,
                content: message.content,
                isMarkdown: message.isMarkdown || false
              }
            });
            document.dispatchEvent(event);
            
            // タブを作成し、選択する
            tabManager.addTab(tabId, fileName);
            tabManager.selectTab(tabId);
          }
        }
        break;
      case 'updateDirectoryStructure':
        // ディレクトリ構造更新処理（必要に応じてファイルブラウザに反映）
        if (fileBrowser && typeof fileBrowser.updateDirectoryStructure === 'function') {
          console.log('scopeManager: ディレクトリ構造の更新メッセージを受信しました');
          
          // ファイルブラウザのタブがアクティブかどうかを確認
          const activeTabId = stateManager.getState().activeTab;
          
          // プロジェクトパスを抽出
          let projectPath = '';
          if (typeof message.structure === 'string' && message.structure.startsWith('/')) {
            projectPath = message.structure.split('\n')[0].trim();
          } else if (message.projectPath) {
            projectPath = message.projectPath;
          }
          
          // docsディレクトリを優先する処理
          if (projectPath) {
            const docsPath = `${projectPath}/docs`;
            
            // docsパスに変更
            if (activeTabId === 'file-browser') {
              // アクティブな場合は、直接docsディレクトリをリクエスト
              console.log('scopeManager: ファイルブラウザタブがアクティブなため、docsディレクトリを表示します');
              
              setTimeout(() => {
                if (fileBrowser && fileBrowser.vscode) {
                  fileBrowser.vscode.postMessage({
                    command: 'listDirectory',
                    path: docsPath
                  });
                }
              }, 300); // 少し遅延させて他のリクエストより後に実行
            } else {
              // 非アクティブな場合は静かに状態のみ保持（表示更新はスキップ）
              console.log('scopeManager: ファイルブラウザタブが非アクティブのため、状態のみ更新します');
              // 内部的にパスを記録しておく
              if (fileBrowser) {
                fileBrowser.currentPath = docsPath;
              }
            }
          } else {
            // プロジェクトパスがない場合、通常の更新処理
            if (activeTabId === 'file-browser') {
              console.log('scopeManager: ファイルブラウザタブがアクティブなため、ディレクトリ構造を更新します');
              fileBrowser.updateDirectoryStructure(message.structure);
            }
          }
        }
        break;
      case 'showError':
        // マークダウンビューワー関連のエラーは無視（冗長なメッセージ防止）
        if (message.message && message.message.includes('マークダウンビューワーを開けませんでした')) {
          console.warn('scopeManager: マークダウンビューワーエラーを無視します:', message.message);
        }
        // ファイルブラウザ関連のエラーも無視（ファイルブラウザは削除済み）
        else if (message.message && message.message.includes('ファイルを開けませんでした:')) {
          console.warn('scopeManager: ファイルブラウザ関連エラーを無視します:', message.message);
        } else {
          // その他のエラーは正常に表示
          showError(message.message);
        }
        break;
      case 'updateFilePreview':
        // ファイルブラウザのプレビュー更新
        if (fileBrowser && typeof fileBrowser.updateFilePreview === 'function') {
          fileBrowser.updateFilePreview(message.content, message.filePath, message.isError);
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

        // 強制更新フラグがある場合は常に処理（プロジェクト切り替え時等）
        if (message.forceRefresh) {
          console.log('マークダウン強制更新が要求されました');
          
          // コンテンツを更新
          markdownViewer.updateContent(message.content);
          
          // 更新時間の記録（無限ループ防止）
          window._lastContentUpdateTime = Date.now();
          
          // 進捗状況タブ自動選択は行わない（無限ループ防止のため）
          // 以前: tabManager.selectTab('scope-progress', false);
          
          break;
        }

        // 進捗状況用のマークダウン更新は保存しておき、タブが選択された時に表示
        if (message.forScopeProgress) {
          // 最新のコンテンツを状態に保存（タブが非アクティブでも保存）
          stateManager.setState({ 
            scopeProgressContent: message.content 
          }, false);
          
          // タブがアクティブな場合のみ表示
          if (activeTabId === 'scope-progress') {
            console.log(`進捗状況タブが表示中なので内容を更新します`);
            markdownViewer.updateContent(message.content);
          } else {
            console.log(`進捗状況タブが非アクティブなので内容を保存のみします (現在のタブ: ${activeTabId})`);
          }
          break;
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
      case 'addFileTab':
        // TabManagerを使用してファイルタブを追加
        if (message.tabId && message.title && message.content) {
          // _addFileTabメソッドは非公開（protected）なので、代わりにカスタムイベントを発行
          const addTabEvent = new CustomEvent('add-file-tab', {
            detail: {
              tabId: message.tabId,
              title: message.title,
              content: message.content,
              isMarkdown: message.isMarkdown || false,
              filePath: message.filePath
            }
          });
          document.dispatchEvent(addTabEvent);
          console.log(`ファイルタブを追加しました: ${message.title}`);
        }
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