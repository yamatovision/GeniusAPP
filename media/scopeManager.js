// @ts-check

// 外部モジュールのインポート
import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from './utils/markdownConverter.js';
import { showError, showSuccess, getStatusClass, getStatusText, getTimeAgo } from './utils/uiHelpers.js';
import tabManager from './components/tabManager/tabManager.js';
import stateManager from './state/stateManager.js';
import markdownViewer from './components/markdownViewer/markdownViewer.js';
import projectNavigation from './components/projectNavigation/projectNavigation.js';
import dialogManager from './components/dialogManager/dialogManager.js';

// VSCode APIを安全に取得
let vscode;
try {
  // グローバル変数として既に存在するか確認
  if (typeof window.vsCodeApi !== 'undefined') {
    vscode = window.vsCodeApi;
    console.log('scopeManager: 既存のVSCode APIを使用します');
  } else {
    // 新規取得
    vscode = acquireVsCodeApi();
    console.log('scopeManager: VSCode APIを新規取得しました');
    // グローバル変数として保存して他のスクリプトでも使えるように
    window.vsCodeApi = vscode;
  }
} catch (e) {
  console.error('scopeManager: VSCode API取得エラー:', e);
  // エラー時のフォールバック
  vscode = {
    postMessage: function(msg) { 
      console.log('ダミーvscode.postMessage:', msg); 
    },
    getState: function() { return {}; },
    setState: function() {}
  };
}

// イベントリスナーの初期化
(function() {
  const previousState = vscode.getState() || { 
    scopes: [],
    selectedScopeIndex: -1,
    selectedScope: null,
    directoryStructure: '',
    activeTab: 'prompts'
  };
  
  // プロンプトURLリスト - developmentway.mdに基づいた15個のプロンプト
  const promptUrls = [
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39", // 要件定義
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec", // システムアーキテクチャ
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb", // モックアップ作成
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/f0f6805b80ae32f3846c35fe9df4eefe", // データモデル統合
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/bbc6e76a5f448e02bea16918fa1dc9ad", // データモデル精査
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589", // 環境変数収集
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/44b995b91e9879080c4e0169e7a51c0e", // 認証システム
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/612fc1991ca477744c4544255d40fe0b", // デプロイ設定
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/e6167ac13d15f778c0cae369b0068813", // GitHub管理
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704", // 実装タスク分析
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a", // スコープ実装
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed", // テスト管理
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09", // デバッグ探偵
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6", // 追加機能実装
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/af9d922c29beffe1224ac6236d083946"  // リファクタリング
  ];

  // プロンプト情報マッピング - developmentway.mdに基づいた15個のプロンプト
  const promptInfo = [
    { id: 0, name: "要件定義", icon: "description", category: "計画", description: "ビジネス要件を要件定義書に変換" },
    { id: 1, name: "システムアーキテクチャ", icon: "architecture", category: "設計", description: "システム全体の設計と開発基盤の確立" },
    { id: 2, name: "モックアップ作成", icon: "web", category: "UI", description: "要件に基づいたモックアップ作成" },
    { id: 3, name: "データモデル統合", icon: "data_object", category: "設計", description: "一貫性のあるシステム全体のモデル構築" },
    { id: 4, name: "データモデル精査", icon: "psychology", category: "設計", description: "データモデルの厳格な精査と品質向上" },
    { id: 5, name: "環境変数設定", icon: "settings", category: "環境", description: "実際の本番環境用の環境変数設定" },
    { id: 6, name: "認証システム構築", icon: "security", category: "実装", description: "シンプルなJWT自社実装による認証" },
    { id: 7, name: "デプロイ設定", icon: "cloud_upload", category: "環境", description: "クラウドベースのWebアプリケーションデプロイ" },
    { id: 8, name: "GitHub管理", icon: "code", category: "管理", description: "コードの安全なアップロード・管理支援" },
    { id: 9, name: "実装タスク分析", icon: "assignment_turned_in", category: "管理", description: "実装順序の最適化と環境統一化" },
    { id: 10, name: "スコープ実装", icon: "build", category: "実装", description: "設計情報から高品質なコード生成" },
    { id: 11, name: "テスト管理", icon: "science", category: "テスト", description: "実データに基づく効率的なテスト実装" },
    { id: 12, name: "デバッグ探偵", icon: "bug_report", category: "デバッグ", description: "フロントエンドエラーとAPI連携問題の解決" },
    { id: 13, name: "追加機能実装", icon: "add_circle", category: "実装", description: "機能追加・変更・削除要望の分析" },
    { id: 14, name: "リファクタリング", icon: "tune", category: "改善", description: "技術的負債の特定と設計改善" }
  ];
  
  // 開発ツール情報
  const toolsInfo = [
    { id: "requirements-editor", name: "要件定義エディタ", icon: "fact_check", description: "要件定義書の編集と管理" },
    { id: "env-assistant", name: "環境変数アシスタント", icon: "emoji_objects", description: "環境変数の設定と管理" },
    { id: "mockup-gallery", name: "モックアップギャラリー", icon: "dashboard", description: "UIモックアップの表示と管理" },
    { id: "debug-detective", name: "デバッグ探偵", icon: "integration_instructions", description: "エラー解析と問題解決" }
  ];
  
  // ページ読み込み完了時の処理
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });
    
    // イベントリスナー設定
    setupEventListeners();
    
    // StateManagerのイベントリスナーを設定
    setupStateManagerEvents();
    
    // 注：タブ初期化はtabManager.jsに移行済み 
    // (tabManagerはインポート時に自動的に初期化されます)
    
    // プロンプトカードを初期化
    initializePromptCards();
    
    // プロジェクトナビゲーションの初期化
    // initializeProjectNav()の呼び出しをprojectNavigation.initializeNavigation()に置き換え
    projectNavigation.initializeNavigation();
    
    // ClaudeCode連携エリアを初期化
    initializeClaudeCodeShareArea();
    
    // マークダウン表示の初期化
    initializeMarkdownDisplay();
    
    // 保存されたプロジェクト状態を復元（他のパネルから戻ってきた時のため）
    // ただし、初期化メッセージのレスポンスを優先するため、短いタイムアウト後に実行
    setTimeout(() => stateManager.restoreProjectState(), 100);
  });
  
  /**
   * StateManagerからのイベントリスナーを設定
   */
  function setupStateManagerEvents() {
    // プロジェクト名が更新されたときのイベントを購読
    // 注: projectNavigation.jsが既にこのイベントをリッスンして処理するので、
    // ここでの処理は不要（二重にイベントを発行しない）
    
    // プロジェクトパスが更新されたときのイベントを購読
    // 注: projectNavigation.jsが既にこのイベントをリッスンして処理するので、
    // ここでの処理は不要
    
    // タブ状態が更新されたときのイベントを購読
    document.addEventListener('tab-state-updated', (event) => {
      tabManager.selectTab(event.detail.tabId, event.detail.saveToServer);
    });
    
    // マークダウンが更新されたときのイベントを購読
    document.addEventListener('markdown-updated', (event) => {
      // markdownViewerに直接処理を委譲
      markdownViewer.updateContent(event.detail.content);
    });
    
    console.log('StateManagerのイベントリスナーを設定しました');
  }
  
  // メッセージハンドラーの設定
  window.addEventListener('message', event => {
    const message = event.data;
    
    // シェアリングパネル関連のメッセージは無視（sharingPanel.jsが処理）
    if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
      return; // sharingPanel.jsに処理を任せる
    }
    
    console.log('メッセージ受信:', message.command);
    
    switch (message.command) {
      case 'updateState':
        // 新しいStateManagerに処理を委譲
        stateManager.handleUpdateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'showSuccess':
        showSuccess(message.message);
        break;
      // 'showDirectoryStructure' ケースは削除（該当機能は廃止）
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
        // 直接markdownViewerに処理を委譲
        markdownViewer.updateContent(message.content);
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
        // 新しいTabManagerを使用
        tabManager.selectTab(message.tabId);
        break;
      case 'updateToolsTab':
        // 削除されたupdateToolsTab関数への参照
        console.log('ツールタブ更新コマンドを受信しましたが、この機能は使用されていません');
        break;
      case 'syncProjectState':
        // ProjectManagementServiceからのプロジェクト状態同期メッセージ
        if (message.project) {
          // 新しいStateManagerに処理を委譲
          stateManager.syncProjectState(message.project);
        }
        break;
    }
  });
  
  /**
   * ProjectManagementServiceからのプロジェクト状態を同期
   * @param {Object} project プロジェクト情報
   * @deprecated stateManager.syncProjectStateに移行しました
   */
  function syncProjectState(project) {
    console.warn('非推奨警告: 古いsyncProjectState関数が呼び出されました。代わりにstateManager.syncProjectStateを使用してください');
    stateManager.syncProjectState(project);
  }

  // プロジェクトパス更新機能はprojectNavigation.jsに移行しました
  
  /**
   * 状態更新ハンドラー
   * @deprecated stateManager.handleUpdateStateに移行しました
   */
  function handleUpdateState(data) {
    console.warn('非推奨警告: 古いhandleUpdateState関数が呼び出されました。代わりにstateManager.handleUpdateStateを使用してください');
    stateManager.handleUpdateState(data);
  }
  
  // マークダウン表示機能はmarkdownViewer.jsに移行しました
  
  // スタイリングとイベントリスナー関数は外部モジュールから提供される
  // enhanceSpecialElements, setupCheckboxes 関数は./utils/markdownConverter.jsに移動
  
  // プロジェクト進捗の更新機能は削除されました
  
  // スコープリスト関連の機能は削除されました
  
  // タブ切り替え処理は initializeTabs に統合されたため、この関数は削除
  
  /**
   * プロンプトカードの初期化
   */
  function initializePromptCards() {
    const promptsTab = document.getElementById('prompts-tab');
    if (!promptsTab) return;
    
    const promptGrid = document.createElement('div');
    promptGrid.className = 'prompt-grid';
    
    // プロンプトカードを作成
    promptUrls.forEach((url, index) => {
      const info = promptInfo[index] || { 
        name: "プロンプト " + (index + 1), 
        icon: "description", 
        category: "その他", 
        description: "プロンプトを実行します" 
      };
      
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.innerHTML = `
        <span class="material-icons prompt-icon">${info.icon}</span>
        <div class="category-tag">${info.category}</div>
        <h3 class="prompt-title">${info.name}</h3>
        <p class="prompt-description">${info.description}</p>
      `;
      
      // クリックイベント
      card.addEventListener('click', () => {
        // 新しいdialogManagerを使ってダイアログを表示
        dialogManager.showTerminalModeDialog(url, info.name, index);
      });
      
      promptGrid.appendChild(card);
    });
    
    // ツールタブのコンテンツ作成処理は削除されました
    // 「tools」タブはクリック時に openOriginalMockupGallery コマンドが実行されるため
    // タブ内のコンテンツは表示されません
    
    // プロンプトタブにグリッドを追加
    promptsTab.appendChild(promptGrid);
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
    
    // ディレクトリ構造ボタン関連の機能は削除（UIに該当要素が存在しないため）
    
    // スコープ新規作成ボタン
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      createScopeButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'addNewScope' });
      });
    }
    
    // タブ切り替えは initializeTabs で設定済み
  }
  
  // スコープ詳細の更新機能は削除されました
  
  // getStatusClass関数はuiHelpers.jsにエクスポートした関数を使用
  
  // getStatusText関数はuiHelpers.jsにエクスポートした関数を使用
  
  // showError関数はuiHelpers.jsにエクスポートした関数を使用
  
  // showSuccess関数はuiHelpers.jsにエクスポートした関数を使用
  
  // プロジェクト名更新機能はprojectNavigation.jsに移行しました
  
  // プロジェクト一覧更新機能はprojectNavigation.jsに移行しました
  
  // プロジェクトナビゲーション初期化機能はprojectNavigation.jsに移行しました
  
  /**
   * マークダウン表示の初期化
   * @deprecated markdownViewerが自動的に初期化するようになりました
   */
  function initializeMarkdownDisplay() {
    // 新しいmarkdownViewerコンポーネントは自動的に初期化されるため、
    // ここでは何もしません
    console.log('マークダウン表示の初期化は新しいmarkdownViewerコンポーネントに移行しました');
  }
  
  // マークダウン変換関数は外部モジュールから提供される
  // convertMarkdownToHtml, convertMarkdownTableToHtml 関数は./utils/markdownConverter.jsに移動
  
  /**
   * 共有機能関連の関数
   * 以下の共有関連機能はsharingPanel.jsで実装されています
   * - showShareResult()
   * - updateSharingHistory()
   * - showCopySuccess()
   * - resetDropZone()
   * 
   * こちらのファイルからは除去し、重複による競合を防止します
   */
  
  /**
   * プロジェクト選択状態を復元する
   * @deprecated stateManager.restoreProjectStateに移行しました
   */
  function restoreProjectState() {
    console.warn('非推奨警告: 古いrestoreProjectState関数が呼び出されました。代わりにstateManager.restoreProjectStateを使用してください');
    stateManager.restoreProjectState();
  }

  // getTimeAgo関数はuiHelpers.jsにエクスポートした関数を使用
  
  // プロジェクト作成モーダル関連の機能はprojectNavigation.jsに移行しました
  
  // displayModelMockupとsetupMockupViewerHandlersは不要になったため削除
  
  // ディレクトリ構造表示機能は削除（UIで使用されていないため）
  
  /**
   * タブ機能の初期化
   * @deprecated 新たに分離されたtabManager.jsの機能を使用してください
   */
  function initializeTabs() {
    console.log('非推奨警告: 古いinitializeTabs関数が呼び出されました。代わりにtabManager.jsが使用されます');
    
    // 新しいTabManagerに任せるため、実際の処理は行わない
    // tabManagerはインポート時に自動的に初期化されます
    
    return;
  }
  
  // 中間ページ関連のコードは不要になりました
  
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
    const shareTextarea = document.querySelector('.share-textarea');
    
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

    // テキストエリアは標準の動作のままにする
    
    // 開発プロンプトカードを初期化
    initializePromptCardsInModal();
    
    console.log('scopeManager.js: 基本的なClaudeCode連携エリアの初期化を完了しました');
    // 詳細な機能はsharingPanel.jsに任せるため、ここでは最小限の初期化のみ行う
  }
  
  /**
   * タブ状態管理機能 - 単一責任の原則に基づいたシンプルな実装
   * @deprecated 新たに分離されたtabManager.jsの機能を使用してください
   */
  const TabStateManager = {
    // 新しいtabManager.jsに移行しました - このオブジェクトは今後削除されます
    getKey: (panelId) => `tab_state_${panelId || 'scopeManager'}`,
    
    save: (panelId, tabId) => {
      console.warn('TabStateManagerは非推奨です。tabManager.jsを使用してください');
      // 新しいtabManagerに委譲
      tabManager.selectTab(tabId, true);
      return true;
    },
    
    restore: (panelId, defaultTab = 'current-status') => {
      console.warn('TabStateManagerは非推奨です。tabManager.jsを使用してください');
      const state = vscode.getState() || {};
      const savedTab = state.activeTab;
      return savedTab || defaultTab;
    }
  };
  
  /**
   * 指定したタブを選択状態にする (移行版)
   * @param {string} tabId タブID
   * @param {boolean} saveToServer サーバーにタブ状態を保存するかどうか（デフォルトはtrue）
   * @deprecated 新たに分離されたtabManager.jsの機能を使用してください
   */
  function selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    console.log(`移行警告: 古いselectTab関数が呼び出されました。tabManager.jsを使用してください - ${tabId}`);
    
    // 新しいTabManagerに処理を委譲
    tabManager.selectTab(tabId, saveToServer);
  }
  
  // updateToolsTab 関数は削除されました
  // 「tools」タブはクリック時に別ウィンドウを開くため、内容更新処理は不要
  
  
  /**
   * 開発プロンプトモーダルにプロンプトカードを初期化
   */
  function initializePromptCardsInModal() {
    const promptGrid = document.querySelector('.claude-code-share-area .prompt-grid');
    if (!promptGrid) return;
    
    // developmentway.md に基づいた15個のプロンプト情報を使用
    const allPrompts = [
      { id: 0, name: "要件定義", icon: "description", category: "計画", description: "ビジネス要件を要件定義書に変換" },
      { id: 1, name: "システムアーキテクチャ", icon: "architecture", category: "設計", description: "システム全体の設計と開発基盤の確立" },
      { id: 2, name: "モックアップ作成", icon: "web", category: "UI", description: "要件に基づいたモックアップ作成" },
      { id: 3, name: "データモデル統合", icon: "data_object", category: "設計", description: "一貫性のあるシステム全体のモデル構築" },
      { id: 4, name: "データモデル精査", icon: "psychology", category: "設計", description: "データモデルの厳格な精査と品質向上" },
      { id: 5, name: "環境変数設定", icon: "settings", category: "環境", description: "実際の本番環境用の環境変数設定" },
      { id: 6, name: "認証システム構築", icon: "security", category: "実装", description: "シンプルなJWT自社実装による認証" },
      { id: 7, name: "デプロイ設定", icon: "cloud_upload", category: "環境", description: "クラウドベースのWebアプリケーションデプロイ" },
      { id: 8, name: "GitHub管理", icon: "code", category: "管理", description: "コードの安全なアップロード・管理支援" },
      { id: 9, name: "実装タスク分析", icon: "assignment_turned_in", category: "管理", description: "実装順序の最適化と環境統一化" },
      { id: 10, name: "スコープ実装", icon: "build", category: "実装", description: "設計情報から高品質なコード生成" },
      { id: 11, name: "テスト管理", icon: "science", category: "テスト", description: "実データに基づく効率的なテスト実装" },
      { id: 12, name: "デバッグ探偵", icon: "bug_report", category: "デバッグ", description: "フロントエンドエラーとAPI連携問題の解決" },
      { id: 13, name: "追加機能実装", icon: "add_circle", category: "実装", description: "機能追加・変更・削除要望の分析" },
      { id: 14, name: "リファクタリング", icon: "tune", category: "改善", description: "技術的負債の特定と設計改善" }
    ];
    
    // モーダル内にプロンプトカードを追加
    allPrompts.forEach(prompt => {
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.innerHTML = `
        <span class="material-icons prompt-icon">${prompt.icon}</span>
        <div class="category-tag">${prompt.category}</div>
        <h3 class="prompt-title">${prompt.name}</h3>
        <p class="prompt-description">${prompt.description}</p>
      `;
      
      // クリックイベント
      card.addEventListener('click', () => {
        // プロンプトのURL
        const url = promptUrls[prompt.id];
        if (url) {
          // 新しいdialogManagerを使ってダイアログを表示
          dialogManager.showModalTerminalModeDialog(url, prompt.id, prompt.name);
        }
      });
      
      promptGrid.appendChild(card);
    });
  }
})();