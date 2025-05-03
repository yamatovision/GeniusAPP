// @ts-check

// 外部モジュールのインポート
import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from './utils/markdownConverter.js';
import { showError, showSuccess, getStatusClass, getStatusText, getTimeAgo } from './utils/uiHelpers.js';
import tabManager from './components/tabManager/tabManager.js';
import stateManager from './state/stateManager.js';
import markdownViewer from './components/markdownViewer/markdownViewer.js';
import projectNavigation from './components/projectNavigation/projectNavigation.js';

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
    
    // プロジェクトナビゲーションの開閉ボタン処理
    initializeProjectNav();
    
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
    document.addEventListener('project-path-updated', (event) => {
      updateProjectPath(event.detail);
    });
    
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
        updateProjectPath(message);
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
        // プロジェクト一覧を更新するだけで、ここではタブ選択は行わない
        // （selectTabコマンドが別途送信される）
        updateProjects(message.projects, message.activeProject);
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

  /**
   * プロジェクトパスの更新
   */
  function updateProjectPath(data) {
    const projectNameElement = document.querySelector('.project-display .project-name');
    const projectPathElement = document.querySelector('.project-path-display');
    
    // プロジェクト情報の更新
    if (data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      
      // プロジェクト表示部分を更新
      if (projectNameElement) {
        projectNameElement.textContent = projectName || 'プロジェクト';
      }
    }
    
    if (projectPathElement) {
      projectPathElement.textContent = data.projectPath || '/path/to/project';
    }
    
    // CURRENT_STATUS.mdファイルの存在をチェック
    if (data.statusFilePath && data.statusFileExists) {
      console.log('CURRENT_STATUS.mdファイルが存在します:', data.statusFilePath);
      
      // ファイルが存在する場合はマークダウンコンテンツを取得するリクエストを送信
      vscode.postMessage({
        command: 'getMarkdownContent',
        filePath: data.statusFilePath
      });
    }
    
    // forceRefreshフラグがtrueの場合は、強制的に初期化メッセージを送信
    if (data.forceRefresh) {
      console.log('プロジェクトパスが変更されました - 強制更新のためサーバーに初期化メッセージを送信します');
      
      // 状態を完全にリセット
      const resetState = {
        directoryStructure: ''
      };
      
      // 状態リセット
      console.log('状態を完全にリセットします:', resetState);
      vscode.setState(resetState);
      
      // 初期化メッセージの送信（新しいプロジェクトデータを取得するためのリクエスト）
      setTimeout(() => {
        console.log('初期化メッセージを送信します');
        vscode.postMessage({ command: 'initialize' });
      }, 300);
    }
  }
  
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
        // カスタムモーダルダイアログを表示
        showTerminalModeDialog(url, info.name, index);
      });
      
      // ターミナルモード選択用のカスタムダイアログ関数を追加
      function showTerminalModeDialog(url, name, index) {
        // 既存のダイアログがあれば削除
        const existingDialog = document.getElementById('terminal-mode-dialog');
        if (existingDialog) {
          existingDialog.remove();
        }
        
        // モーダルオーバーレイとダイアログを作成
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.id = 'terminal-mode-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        const dialog = document.createElement('div');
        dialog.id = 'terminal-mode-dialog';
        dialog.style.backgroundColor = 'var(--app-bg, #fff)';
        dialog.style.borderRadius = '8px';
        dialog.style.padding = '20px';
        dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        dialog.style.width = '400px';
        dialog.style.maxWidth = '90%';
        
        dialog.innerHTML = `
          <h3 style="margin-top: 0; margin-bottom: 16px;">ターミナル表示モードを選択</h3>
          <p style="margin-bottom: 20px;">ClaudeCodeの起動方法を選択してください：</p>
          <div style="display: flex; justify-content: space-between;">
            <button id="split-terminal-btn" class="button" style="flex: 1; margin-right: 8px;">分割ターミナルで表示</button>
            <button id="new-tab-terminal-btn" class="button button-secondary" style="flex: 1; margin-left: 8px;">新しいタブで表示</button>
          </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // ボタンのイベントリスナーを設定
        document.getElementById('split-terminal-btn').addEventListener('click', () => {
          // 分割ターミナルモードを選択（true）
          console.log('【デバッグ】分割ターミナルボタンがクリックされました - splitTerminal=true を送信します');
          
          // デバッグメッセージを表示（開発者がダイアログの選択を確認できるように）
          const debugMessage = document.createElement('div');
          debugMessage.style.position = 'fixed';
          debugMessage.style.bottom = '20px';
          debugMessage.style.left = '20px';
          debugMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          debugMessage.style.color = 'white';
          debugMessage.style.padding = '8px 16px';
          debugMessage.style.borderRadius = '4px';
          debugMessage.style.zIndex = '999999';
          debugMessage.style.fontFamily = 'monospace';
          debugMessage.textContent = '分割ターミナルモードを選択しました (splitTerminal=true)';
          document.body.appendChild(debugMessage);
          
          // 3秒後にデバッグメッセージを消す
          setTimeout(() => {
            if (debugMessage.parentNode) {
              debugMessage.parentNode.removeChild(debugMessage);
            }
          }, 3000);
          
          vscode.postMessage({
            command: 'launchPromptFromURL',
            url: url,
            name: name,
            index: index,
            splitTerminal: true  // 分割ターミナルモード
          });
          
          // ダイアログを閉じる
          overlay.remove();
        });
        
        document.getElementById('new-tab-terminal-btn').addEventListener('click', () => {
          // 新しいタブモードを選択（false）
          vscode.postMessage({
            command: 'launchPromptFromURL',
            url: url,
            name: name,
            index: index,
            splitTerminal: false  // 新しいタブモード
          });
          
          // ダイアログを閉じる
          overlay.remove();
        });
      }
      
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
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブなプロジェクト
   */
  function updateProjects(projects, activeProject) {
    console.log('プロジェクト一覧更新:', projects.length, '件', 'アクティブプロジェクト:', activeProject?.name);
    
    // アクティブプロジェクト情報を状態に保存（他のパネルから戻ってきた時のために）
    if (activeProject) {
      const state = vscode.getState() || {};
      state.activeProjectName = activeProject.name;
      state.activeProjectPath = activeProject.path;
      state.activeTab = activeProject.metadata?.activeTab || 'current-status';
      vscode.setState(state);
    }
    
    const projectList = document.getElementById('project-list');
    if (!projectList) return;
    
    // 既存のアクティブプロジェクトエリアがあれば削除
    const existingActiveArea = document.getElementById('active-project-area');
    if (existingActiveArea) {
      existingActiveArea.remove();
    }
    
    // 既存の他のプロジェクトラベルがあれば削除
    const existingLabel = document.getElementById('other-projects-label');
    if (existingLabel) {
      existingLabel.remove();
    }
    
    // リストをクリア
    projectList.innerHTML = '';
    
    // プロジェクトがない場合の表示
    if (!projects || projects.length === 0) {
      projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // ソート済みのプロジェクト配列を作成（アクティブプロジェクトを先頭に）
    let sortedProjects = [...projects];
    
    // プロジェクトを作成日時順にソートする（古いものから新しいものへ）
    sortedProjects.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // プロジェクトをリストに追加
    sortedProjects.forEach((project) => {
      const item = document.createElement('div');
      const isActive = activeProject && activeProject.id === project.id;
      
      // すべてのプロジェクトに同じスタイルを適用
      item.className = isActive ? 'project-item active' : 'project-item';
      
      // アクティブプロジェクトにはidを設定
      if (isActive) {
        item.id = 'active-project-item';
      }
      
      // プロジェクト表示名はパスの最後のディレクトリ名か設定されている名前を使用
      let displayName = project.name || '';
      if (!displayName && project.path) {
        // パスから抽出
        const pathParts = project.path.split(/[/\\]/);
        displayName = pathParts[pathParts.length - 1] || 'プロジェクト';
      }
      
      // すべてのプロジェクトで統一されたHTMLを使用
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div>
            <span class="project-name" ${isActive ? 'style="font-weight: 600;"' : ''}>${displayName}</span>
            <span class="project-path" style="font-size: 10px; color: var(--app-text-secondary); display: block; margin-top: 2px;">${project.path || 'パスなし'}</span>
          </div>
          <button class="remove-project-btn" title="プロジェクトの登録を解除" style="background: none; border: none; cursor: pointer; color: var(--app-text-secondary); opacity: 0.5; font-size: 16px;">
            <span class="material-icons" style="font-size: 16px;">close</span>
          </button>
        </div>
      `;
      
      // 全体のクリックイベント
      const handleProjectClick = () => {
        // アクティブクラスを削除
        document.querySelectorAll('.project-item').forEach(pi => pi.classList.remove('active'));
        // クリックされた項目をアクティブに
        item.classList.add('active');
        
        // プロジェクト選択の進行中メッセージを表示
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = `
          <span class="material-icons" style="color: var(--app-warning);">hourglass_top</span>
          <span class="notification-text">プロジェクト「${displayName}」を読み込み中...</span>
        `;
        notification.style.display = 'flex';
        notification.style.opacity = '1';
        notification.style.backgroundColor = 'rgba(253, 203, 110, 0.15)';
        
        // 通知領域にメッセージを表示
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
          errorContainer.parentNode.insertBefore(notification, errorContainer);
        } else {
          document.body.appendChild(notification);
        }
        
        // 現在のアクティブタブIDを取得
        const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
        console.log('現在のアクティブタブ:', currentActiveTab);
        
        // 状態にプロジェクト情報を保存（他のパネルから戻ってきた時に復元するため）
        const state = vscode.getState() || {};
        state.activeProjectName = displayName;
        state.activeProjectPath = project.path;
        state.activeTab = currentActiveTab || 'current-status';
        
        // 手動でCURRENT_STATUS.mdのパスを設定して初期化信号を送信
        const statusFilePath = project.path ? `${project.path}/docs/CURRENT_STATUS.md` : '';
        state.statusFilePath = statusFilePath;
        
        vscode.setState(state);
        
        // タブ状態も新しいtabManagerに同期
        if (currentActiveTab) {
          tabManager.selectTab(currentActiveTab, false); // サーバー保存はselectProjectで行うため
        }
        
        console.log('プロジェクト状態を保存しました:', state);
        
        // VSCodeにプロジェクト変更のメッセージを送信（アクティブタブ情報も送信）
        // selectProjectコマンドだけを送信し、バックエンドからの応答で適切にマークダウンを更新
        vscode.postMessage({
          command: 'selectProject',
          projectName: displayName,
          projectPath: project.path,
          activeTab: currentActiveTab,
          forceRefresh: true // 強制的にコンテンツをリロード
        });
        
        // 3秒後に通知を削除
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      };
      
      // リフレッシュボタンのクリックイベント（アクティブプロジェクトのみ）
      if (isActive) {
        const refreshBtn = item.querySelector('.refresh-project-btn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', (e) => {
            // クリックイベントの伝播を停止
            e.stopPropagation();
            
            // プロジェクト名を取得
            const projectName = item.querySelector('.project-name').textContent;
            
            // リロード中のフィードバック
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.innerHTML = `
              <span class="material-icons" style="color: var(--app-primary);">refresh</span>
              <span class="notification-text">プロジェクト「${projectName}」をリロード中...</span>
            `;
            notification.style.display = 'flex';
            notification.style.opacity = '1';
            notification.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
            
            // 通知領域にメッセージを表示
            const errorContainer = document.getElementById('error-container');
            if (errorContainer) {
              errorContainer.parentNode.insertBefore(notification, errorContainer);
            } else {
              document.body.appendChild(notification);
            }
            
            // 現在のアクティブタブIDを取得
            const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
            console.log('リフレッシュ時の現在のアクティブタブ:', currentActiveTab);
            
            // 状態にも保存
            const state = vscode.getState() || {};
            state.activeProjectName = projectName;
            state.activeProjectPath = project.path;
            state.activeTab = currentActiveTab || 'current-status';
            
            // 手動でCURRENT_STATUS.mdのパスを設定して初期化信号を送信
            const statusFilePath = project.path ? `${project.path}/docs/CURRENT_STATUS.md` : '';
            state.statusFilePath = statusFilePath;
            
            vscode.setState(state);
            
            // タブ状態も新しいtabManagerに同期
            if (currentActiveTab) {
              tabManager.selectTab(currentActiveTab, false); // サーバー保存はselectProjectで行うため
            }
            
            // VSCodeにプロジェクト選択のメッセージを送信（アクティブタブ情報も送信）
            // selectProjectコマンドだけを送信し、バックエンドからの応答で適切にマークダウンを更新
            vscode.postMessage({
              command: 'selectProject',
              projectName: projectName,
              projectPath: project.path,
              activeTab: currentActiveTab,
              forceRefresh: true // 強制的にコンテンツをリロード
            });
            
            // 3秒後に通知を削除
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 3000);
          });
          
          // ホバー効果
          refreshBtn.addEventListener('mouseover', () => {
            refreshBtn.style.color = 'var(--app-primary-dark)';
          });
          
          refreshBtn.addEventListener('mouseout', () => {
            refreshBtn.style.color = 'var(--app-primary)';
          });
        }
      }
      
      // 削除ボタンのクリックイベント
      const removeBtn = item.querySelector('.remove-project-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          // クリックイベントの伝播を停止
          e.stopPropagation();
          
          // 確認ダイアログ
          const projectName = item.querySelector('.project-name').textContent;
          
          // シンプルな確認ダイアログを作成
          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay';
          overlay.style.zIndex = '10000';
          
          const dialog = document.createElement('div');
          dialog.className = 'dialog';
          dialog.innerHTML = `
            <div class="dialog-title">プロジェクト登録解除の確認</div>
            <div style="margin: 20px 0;">
              <p>プロジェクト「${projectName}」の登録を解除しますか？</p>
              <p style="color: var(--app-text-secondary); font-size: 0.9em; margin-top: 10px;">
                注意: この操作はプロジェクトファイルを削除するものではなく、
                AppGeniusからの登録を解除するだけです。
              </p>
            </div>
            <div class="dialog-footer">
              <button class="button button-secondary" id="cancel-remove">キャンセル</button>
              <button class="button" id="confirm-remove" style="background-color: var(--app-danger);">登録解除</button>
            </div>
          `;
          
          overlay.appendChild(dialog);
          document.body.appendChild(overlay);
          
          // キャンセルボタン
          document.getElementById('cancel-remove')?.addEventListener('click', () => {
            document.body.removeChild(overlay);
          });
          
          // 確認ボタン
          document.getElementById('confirm-remove')?.addEventListener('click', () => {
            // VSCodeにプロジェクト削除のメッセージを送信
            vscode.postMessage({
              command: 'removeProject',
              projectName: projectName,
              projectPath: project.path,
              projectId: project.id
            });
            
            // ダイアログを閉じる
            document.body.removeChild(overlay);
            
            // 削除中のフィードバック
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
          });
        });
        
        // ホバー効果
        removeBtn.addEventListener('mouseover', () => {
          removeBtn.style.opacity = '0.8';
          removeBtn.style.color = 'var(--app-text)';
        });
        
        removeBtn.addEventListener('mouseout', () => {
          removeBtn.style.opacity = '0.5';
          removeBtn.style.color = 'var(--app-text-secondary)';
        });
      }
      
      // 削除ボタンとリフレッシュボタン以外の領域のクリックで全体のクリックイベントを発火
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-project-btn') && !e.target.closest('.refresh-project-btn')) {
          handleProjectClick();
        }
      });
      
      projectList.appendChild(item);
    });
  }
  
  /**
   * プロジェクトナビゲーションの初期化
   */
  function initializeProjectNav() {
    const toggleNavBtn = document.getElementById('toggle-nav-btn');
    if (toggleNavBtn) {
      // 初期化時にアイコンの向きを確認・設定
      const projectNav = document.querySelector('.project-nav');
      const icon = toggleNavBtn.querySelector('.material-icons');
      
      if (projectNav && projectNav.classList.contains('collapsed')) {
        icon.textContent = 'chevron_right';
      } else if (icon) {
        icon.textContent = 'chevron_left';
      }
      
      toggleNavBtn.addEventListener('click', function() {
        const projectNav = document.querySelector('.project-nav');
        const contentArea = document.querySelector('.content-area');
        const icon = toggleNavBtn.querySelector('.material-icons');
        
        if (projectNav.classList.contains('collapsed')) {
          // パネルを展開
          projectNav.classList.remove('collapsed');
          contentArea.classList.remove('expanded');
          icon.textContent = 'chevron_left';
          toggleNavBtn.title = 'パネルを閉じる';
        } else {
          // パネルを折りたたむ
          projectNav.classList.add('collapsed');
          contentArea.classList.add('expanded');
          icon.textContent = 'chevron_right';
          toggleNavBtn.title = 'パネルを開く';
        }
      });
    }
    
    // 初期化時はバックエンドからプロジェクト一覧を要求
    // 初期化はすでに実行済みなので、この時点では何もしない

    // プロジェクトリスト初期化
    const projectList = document.getElementById('project-list');
    if (projectList) {
      // 初期状態ではローディングメッセージを表示
      projectList.innerHTML = '<div class="project-item loading">プロジェクト一覧を読み込み中...</div>';
    }
    
    // 新規プロジェクトボタンのイベント設定
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        console.log('新規プロジェクト作成ボタンがクリックされました');
        showNewProjectModal();
      });
    }
    
    // プロジェクトファイル読み込みボタンのイベント設定
    const loadProjectBtn = document.getElementById('load-project-btn');
    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', () => {
        console.log('プロジェクト読み込みボタンがクリックされました');
        vscode.postMessage({
          command: 'loadExistingProject'
        });
      });
    }
  }
  
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
  
  /**
   * 新規プロジェクト作成用モーダルを表示
   */
  function showNewProjectModal() {
    console.log('新規プロジェクトモーダル表示処理を開始します');
    
    try {
      // 既存のモーダルを削除
      document.querySelectorAll('#new-project-modal').forEach(m => {
        console.log('モーダル要素を削除します:', m.id);
        m.remove();
      });
      
      // モーダルを新規作成
      console.log('モーダルを新規作成します');
      const modal = document.createElement('div');
      modal.id = 'new-project-modal';
      
      // スタイルを詳細に設定
      Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '10000'
      });
      
      // シンプルなモーダル内容
      modal.innerHTML = `
        <div style="background-color: white; border-radius: 10px; width: 400px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);">
          <div style="padding: 20px; border-bottom: 1px solid #ddd;">
            <h2 style="margin: 0; font-size: 18px;">新規プロジェクト作成</h2>
          </div>
          <div style="padding: 20px;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px;">プロジェクト名 <span style="color: red;">*</span></label>
              <input type="text" id="project-name" required placeholder="例: MyWebApp" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
          </div>
          <div style="padding: 15px 20px; border-top: 1px solid #ddd; text-align: right;">
            <button type="button" id="cancel-new-project" style="padding: 6px 12px; margin-right: 10px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
            <button type="button" id="create-project-btn" style="padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">作成</button>
          </div>
        </div>
      `;
      
      // ボディにモーダルを追加
      document.body.appendChild(modal);
      
      // イベントリスナーを設定
      const cancelBtn = document.getElementById('cancel-new-project');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', hideNewProjectModal);
      }
      
      const createBtn = document.getElementById('create-project-btn');
      if (createBtn) {
        createBtn.addEventListener('click', createNewProject);
      }
      
      // 名前フィールドにフォーカス
      const projectName = document.getElementById('project-name');
      if (projectName) {
        projectName.focus();
      }
      
    } catch (e) {
      console.error('モーダル表示処理中にエラーが発生しました', e);
    }
  }
  
  /**
   * 新規プロジェクトモーダルを非表示
   */
  function hideNewProjectModal() {
    console.log('モーダルを非表示にします');
    const modal = document.getElementById('new-project-modal');
    if (modal) {
      modal.remove();
    }
  }
  
  /**
   * 新規プロジェクト作成処理
   */
  function createNewProject() {
    console.log('新規プロジェクト作成処理を開始します');
    const nameEl = document.getElementById('project-name');
    
    if (!nameEl) {
      console.error('プロジェクト名入力フィールド(#project-name)が見つかりません');
      return;
    }
    
    const name = nameEl.value.trim();
    console.log('入力されたプロジェクト名:', name);
    
    if (!name) {
      console.warn('プロジェクト名が空です');
      showError('プロジェクト名を入力してください');
      return;
    }
    
    console.log('VSCodeにメッセージを送信します: createProject');
    vscode.postMessage({
      command: 'createProject',
      name,
      description: ""
    });
    
    hideNewProjectModal();
  }
  
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
          // カスタムモーダルダイアログを表示
          showModalTerminalModeDialog(url, prompt.id, prompt.name);
        }
      });
      
      // ターミナルモード選択用のカスタムダイアログ関数
      function showModalTerminalModeDialog(url, promptId, promptName) {
        // 既存のダイアログがあれば削除
        const existingDialog = document.getElementById('modal-terminal-mode-dialog');
        if (existingDialog) {
          existingDialog.remove();
        }
        
        // モーダルオーバーレイとダイアログを作成
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.id = 'modal-terminal-mode-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        const dialog = document.createElement('div');
        dialog.id = 'modal-terminal-mode-dialog';
        dialog.style.backgroundColor = 'var(--app-bg, #fff)';
        dialog.style.borderRadius = '8px';
        dialog.style.padding = '20px';
        dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        dialog.style.width = '400px';
        dialog.style.maxWidth = '90%';
        
        dialog.innerHTML = `
          <h3 style="margin-top: 0; margin-bottom: 16px;">ターミナル表示モードを選択</h3>
          <p style="margin-bottom: 20px;">ClaudeCodeの起動方法を選択してください：</p>
          <div style="display: flex; justify-content: space-between;">
            <button id="modal-split-terminal-btn" class="button" style="flex: 1; margin-right: 8px;">分割ターミナルで表示</button>
            <button id="modal-new-tab-terminal-btn" class="button button-secondary" style="flex: 1; margin-left: 8px;">新しいタブで表示</button>
          </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // ボタンのイベントリスナーを設定
        document.getElementById('modal-split-terminal-btn').addEventListener('click', () => {
          // 分割ターミナルモードを選択（true）
          console.log('【デバッグ】モーダル内の分割ターミナルボタンがクリックされました - splitTerminal=true を送信します');
          
          // デバッグメッセージを表示
          const debugMessage = document.createElement('div');
          debugMessage.style.position = 'fixed';
          debugMessage.style.bottom = '20px';
          debugMessage.style.left = '20px';
          debugMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          debugMessage.style.color = 'white';
          debugMessage.style.padding = '8px 16px';
          debugMessage.style.borderRadius = '4px';
          debugMessage.style.zIndex = '999999';
          debugMessage.style.fontFamily = 'monospace';
          debugMessage.textContent = 'モーダル: 分割ターミナルモードを選択しました (splitTerminal=true)';
          document.body.appendChild(debugMessage);
          
          // 3秒後にデバッグメッセージを消す
          setTimeout(() => {
            if (debugMessage.parentNode) {
              debugMessage.parentNode.removeChild(debugMessage);
            }
          }, 3000);
          
          vscode.postMessage({
            command: 'launchPromptFromURL',
            url: url,
            index: promptId,
            name: promptName,
            splitTerminal: true  // 分割ターミナルモード
          });
          
          // ダイアログを閉じる
          overlay.remove();
        });
        
        document.getElementById('modal-new-tab-terminal-btn').addEventListener('click', () => {
          // 新しいタブモードを選択（false）
          vscode.postMessage({
            command: 'launchPromptFromURL',
            url: url,
            index: promptId,
            name: promptName,
            splitTerminal: false  // 新しいタブモード
          });
          
          // ダイアログを閉じる
          overlay.remove();
        });
      }
      
      promptGrid.appendChild(card);
    });
  }
})();