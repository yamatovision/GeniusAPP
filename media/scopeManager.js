// @ts-check

// VSCode API取得 
const vscode = acquireVsCodeApi();

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
    
    // タブ機能の初期化
    initializeTabs();
    
    // プロンプトカードを初期化
    initializePromptCards();
    
    // 開発ツールのカードを初期化
    initializeToolCards();
    
    // プロジェクトナビゲーションの開閉ボタン処理
    initializeProjectNav();
    
    // ClaudeCode連携エリアを初期化
    initializeClaudeCodeShareArea();
    
    // マークダウン表示の初期化
    initializeMarkdownDisplay();
  });
  
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
        handleUpdateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'showSuccess':
        showSuccess(message.message);
        break;
      case 'showDirectoryStructure':
        showDirectoryStructure(message.structure);
        break;
      case 'updateProjectPath':
        updateProjectPath(message);
        break;
      case 'updateProjectName':
        updateProjectName(message.projectName);
        break;
      case 'updateMarkdownContent':
        displayMarkdownContent(message.content);
        break;
      case 'updateProjects':
        updateProjects(message.projects, message.activeProject);
        break;
    }
  });
  
  /**
   * プロジェクトパスの更新
   */
  function updateProjectPath(data) {
    const projectNameElement = document.querySelector('.project-name');
    const projectPathElement = document.querySelector('.project-path-display');
    
    // プロジェクト情報の更新
    if (projectNameElement && data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      projectNameElement.textContent = projectName || 'プロジェクト';
      
      // プロジェクト表示部分も更新（タブバーの左側に表示されるプロジェクト名）
      const projectDisplayName = document.querySelector('.project-display .project-name');
      if (projectDisplayName) {
        projectDisplayName.textContent = projectName || 'プロジェクト';
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
      
      // 現在のスコープ情報をクリア
      const scopeList = document.getElementById('scope-list');
      if (scopeList) {
        scopeList.innerHTML = '<div class="scope-item"><span>データを更新中...</span></div>';
      }
      
      // ステータスバーのテキストを変更して更新中であることを示す
      const progressText = document.getElementById('project-progress-text');
      if (progressText) {
        progressText.textContent = '更新中...';
      }
      
      // 状態を完全にリセット
      const resetState = {
        scopes: [],
        selectedScopeIndex: -1,
        selectedScope: null,
        directoryStructure: ''
      };
      
      // 状態リセット
      console.log('状態を完全にリセットします:', resetState);
      vscode.setState(resetState);
      
      // UI要素をクリア
      const selectedScopeTitle = document.getElementById('scope-title');
      if (selectedScopeTitle) {
        selectedScopeTitle.textContent = 'スコープを選択してください';
      }
      
      // 選択されたスコープの詳細表示をクリア
      const scopeDetailContent = document.getElementById('scope-detail-content');
      if (scopeDetailContent) {
        scopeDetailContent.style.display = 'none';
      }
      
      const scopeEmptyMessage = document.getElementById('scope-empty-message');
      if (scopeEmptyMessage) {
        scopeEmptyMessage.style.display = 'block';
      }
      
      // 初期化メッセージの送信（新しいプロジェクトデータを取得するためのリクエスト）
      setTimeout(() => {
        console.log('初期化メッセージを送信します');
        vscode.postMessage({ command: 'initialize' });
      }, 300);
    }
  }
  
  /**
   * 状態更新ハンドラー
   */
  function handleUpdateState(data) {
    // デバッグログ
    console.log('状態更新受信:', 
      'スコープ数:', data.scopes ? data.scopes.length : 0, 
      '選択中インデックス:', data.selectedScopeIndex);
    
    // 初期データを保存
    vscode.setState(data);
    
    // スコープリスト更新
    updateScopeList(data.scopes);
    
    // 選択されたスコープの表示を更新
    if (data.selectedScopeIndex >= 0 && data.selectedScope) {
      updateSelectedScope(data.selectedScope);
    }
    
    // プロジェクト進捗の更新
    updateProjectProgress(data.scopes);
    
    // CURRENT_STATUS.mdのマークダウン表示（バックエンドから受け取っている場合）
    if (data.currentStatusMarkdown) {
      displayMarkdownContent(data.currentStatusMarkdown);
    } else {
      // バックエンドからマークダウンデータが取得できていない場合は
      // ファイル取得メッセージを送信
      if (data.statusFilePath) {
        vscode.postMessage({
          command: 'getMarkdownContent',
          filePath: data.statusFilePath
        });
      }
    }
  }
  
  /**
   * マークダウンコンテンツを表示
   */
  function displayMarkdownContent(markdownContent) {
    const markdownContainer = document.querySelector('.markdown-content');
    if (markdownContainer) {
      // マークダウンをHTMLに変換（実際には適切なライブラリを使用する）
      const htmlContent = convertMarkdownToHtml(markdownContent);
      
      // HTML内容を設定
      markdownContainer.innerHTML = htmlContent;
      
      // チェックボックスのイベントリスナー設定
      setupCheckboxes();
    }
  }
  
  /**
   * マークダウン内のチェックボックスにイベントリスナーを設定
   */
  function setupCheckboxes() {
    const checkboxes = document.querySelectorAll('.markdown-content input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        // チェックボックス変更のメッセージを送信
        // この部分は実際の実装では、CURRENT_STATUS.mdファイルの変更に連動する必要がある
        console.log('チェックボックス状態変更:', e.target.checked);
        
        // マークダウン内のチェックボックス変更メッセージを送信
        vscode.postMessage({
          command: 'updateMarkdownCheckbox',
          checked: e.target.checked,
          // 実際の実装では、ここにチェックボックスを特定するための情報が必要
          // 例: テキスト内容や行番号など
          index: Array.from(checkboxes).indexOf(e.target)
        });
      });
    });
  }
  
  /**
   * プロジェクト進捗の更新
   */
  function updateProjectProgress(scopes) {
    if (!scopes || scopes.length === 0) {
      return;
    }
    
    const progressElement = document.getElementById('project-progress');
    const progressText = document.getElementById('project-progress-text');
    
    // プロジェクト全体の進捗を計算
    const totalScopes = scopes.length;
    const completedScopes = scopes.filter(scope => scope.status === 'completed').length;
    const inProgressScopes = scopes.filter(scope => scope.status === 'in-progress').length;
    
    // 進捗率の計算 (完了=100%, 進行中=50%として計算)
    const progressPercentage = Math.round((completedScopes * 100 + inProgressScopes * 50) / totalScopes);
    
    // 進捗バーの更新
    if (progressElement) {
      progressElement.style.width = `${progressPercentage}%`;
    }
    
    // 進捗テキストの更新
    if (progressText) {
      progressText.textContent = `${progressPercentage}% 完了`;
    }
  }
  
  /**
   * スコープリストの更新
   */
  function updateScopeList(scopes) {
    const scopeList = document.getElementById('scope-list');
    if (!scopeList) return;
    
    // リストをクリア
    scopeList.innerHTML = '';
    
    // スコープがない場合は空のメッセージを表示
    if (!scopes || scopes.length === 0) {
      scopeList.innerHTML = `
        <div class="scope-item">
          <p>スコープが定義されていません</p>
          <p>CURRENT_STATUS.mdファイルにスコープを追加してください</p>
        </div>
      `;
      return;
    }
    
    // 各スコープをリストに追加
    scopes.forEach((scope, index) => {
      const statusClass = getStatusClass(scope.status);
      const progressPercentage = scope.progress || 0;
      
      // スコープアイテムの作成
      const scopeItem = document.createElement('div');
      scopeItem.className = `scope-item ${index === vscode.getState().selectedScopeIndex ? 'active' : ''}`;
      scopeItem.innerHTML = `
        <h3>${scope.name}</h3>
        <div class="scope-progress">
          <div class="scope-progress-bar ${statusClass}" style="width: ${progressPercentage}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
          <span style="font-size: 0.9rem; color: var(--app-text-secondary);">${scope.files ? scope.files.length : 0}ファイル</span>
          <span style="font-size: 0.9rem; padding: 2px 8px; background-color: var(--app-primary-light); color: var(--app-primary); border-radius: 10px;">
            ${progressPercentage}% ${getStatusText(scope.status)}
          </span>
        </div>
      `;
      
      // クリックイベントの追加
      scopeItem.addEventListener('click', () => {
        // スコープが選択されたことをバックエンドに通知
        vscode.postMessage({
          command: 'selectScope',
          index: index
        });
      });
      
      scopeList.appendChild(scopeItem);
    });
  }
  
  /**
   * タブ切り替え処理
   */
  function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // 全てのタブから active クラスを削除
        tabs.forEach(t => t.classList.remove('active'));
        
        // クリックされたタブに active クラスを追加
        tab.classList.add('active');
        
        // 全てのタブコンテンツを非表示
        tabContents.forEach(content => content.classList.remove('active'));
        
        // クリックされたタブに対応するコンテンツを表示
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
      });
    });
  }
  
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
        vscode.postMessage({
          command: 'launchPromptFromURL',
          url: url,
          name: info.name
        });
      });
      
      promptGrid.appendChild(card);
    });
    
    // ツールタブのコンテンツも作成
    const toolsTab = document.getElementById('tools-tab');
    if (toolsTab) {
      const toolsGrid = document.createElement('div');
      toolsGrid.className = 'prompt-grid';
      
      // 開発ツールカードを追加
      const toolsData = [
        { 
          name: "要件定義エディタ", 
          icon: "fact_check", 
          command: "openRequirementsVisualizer", 
          description: "要件定義書の編集と管理" 
        },
        { 
          name: "環境変数アシスタント", 
          icon: "emoji_objects", 
          command: "openEnvironmentVariablesAssistant", 
          description: "環境変数の設定と管理" 
        },
        { 
          name: "モックアップギャラリー", 
          icon: "dashboard", 
          command: "openMockupGallery", 
          description: "UIモックアップの表示と管理" 
        },
        { 
          name: "デバッグ探偵", 
          icon: "bug_report", 
          command: "openDebugDetective", 
          description: "エラー解析とデバッグ支援" 
        }
      ];
      
      toolsData.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        card.innerHTML = `
          <span class="material-icons prompt-icon">${tool.icon}</span>
          <h3 class="prompt-title">${tool.name}</h3>
          <p class="prompt-description">${tool.description}</p>
        `;
        
        // クリックイベント
        card.addEventListener('click', () => {
          vscode.postMessage({
            command: tool.command
          });
        });
        
        toolsGrid.appendChild(card);
      });
      
      toolsTab.appendChild(toolsGrid);
    }
    
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
    
    // ディレクトリ構造ボタン
    const directoryButton = document.getElementById('directory-structure-button');
    if (directoryButton) {
      directoryButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'showDirectoryStructure' });
      });
    }
    
    // スコープ新規作成ボタン
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      createScopeButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'addNewScope' });
      });
    }
    
    // タブ切り替えの設定
    setupTabSwitching();
  }
  
  /**
   * 選択されたスコープの詳細を更新
   */
  function updateSelectedScope(scope) {
    const scopeTitle = document.getElementById('scope-title');
    const scopeDescription = document.getElementById('scope-description');
    const scopeProgressBar = document.getElementById('scope-progress-bar');
    const scopeProgressText = document.getElementById('scope-progress');
    const implementationFiles = document.getElementById('implementation-files');
    
    if (scopeTitle) {
      scopeTitle.textContent = scope.name;
    }
    
    if (scopeDescription) {
      scopeDescription.textContent = scope.description || '説明がありません';
    }
    
    const progress = scope.progress || 0;
    
    if (scopeProgressBar) {
      scopeProgressBar.style.width = `${progress}%`;
      scopeProgressBar.className = `progress-fill ${getStatusClass(scope.status)}`;
    }
    
    if (scopeProgressText) {
      scopeProgressText.textContent = `${progress}%`;
    }
    
    // 実装予定ファイルのリスト更新
    if (implementationFiles) {
      implementationFiles.innerHTML = '';
      
      if (scope.files && scope.files.length > 0) {
        scope.files.forEach(file => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          fileItem.innerHTML = `
            <input type="checkbox" class="file-checkbox" ${file.completed ? 'checked' : ''} />
            <span>${file.path}</span>
          `;
          
          // チェックボックスのイベントリスナー
          const checkbox = fileItem.querySelector('.file-checkbox');
          if (checkbox) {
            checkbox.addEventListener('change', (e) => {
              vscode.postMessage({
                command: 'toggleFileStatus',
                filePath: file.path,
                completed: e.target.checked
              });
            });
          }
          
          implementationFiles.appendChild(fileItem);
        });
      } else {
        implementationFiles.innerHTML = '<div class="file-item">実装予定ファイルがありません</div>';
      }
    }
    
    // スコープ詳細カードを表示
    const scopeDetailContent = document.getElementById('scope-detail-content');
    if (scopeDetailContent) {
      scopeDetailContent.style.display = 'block';
    }
    
    // 空メッセージを非表示
    const scopeEmptyMessage = document.getElementById('scope-empty-message');
    if (scopeEmptyMessage) {
      scopeEmptyMessage.style.display = 'none';
    }
  }
  
  /**
   * ステータスに応じたCSSクラスを返す
   */
  function getStatusClass(status) {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'in-progress':
        return 'status-in-progress';
      case 'blocked':
        return 'status-blocked';
      case 'pending':
      default:
        return 'status-pending';
    }
  }
  
  /**
   * ステータスの表示テキストを返す
   */
  function getStatusText(status) {
    switch (status) {
      case 'completed':
        return '完了';
      case 'in-progress':
        return '進行中';
      case 'blocked':
        return '停止中';
      case 'pending':
      default:
        return '未着手';
    }
  }
  
  /**
   * エラーメッセージを表示
   */
  function showError(message) {
    console.error('エラー:', message);
    
    // 既存のメッセージがあれば削除
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(el => el.remove());
    
    // エラーメッセージの作成
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<span>⚠️</span> ${message}`;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.padding = '10px 20px';
    errorDiv.style.borderRadius = '4px';
    errorDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    errorDiv.style.zIndex = '10000';
    
    document.body.appendChild(errorDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }
  
  /**
   * 成功メッセージ表示
   */
  function showSuccess(message) {
    console.log('成功:', message);
    
    // 既存のメッセージがあれば削除
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(el => el.remove());
    
    // 成功メッセージの作成
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `<span>✅</span> ${message}`;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.left = '50%';
    successDiv.style.transform = 'translateX(-50%)';
    successDiv.style.backgroundColor = '#d4edda';
    successDiv.style.color = '#155724';
    successDiv.style.padding = '10px 20px';
    successDiv.style.borderRadius = '4px';
    successDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    successDiv.style.zIndex = '10000';
    
    document.body.appendChild(successDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 5000);
  }
  
  /**
   * プロジェクト名を更新
   */
  function updateProjectName(projectName) {
    // プロジェクト名をヘッダーに更新
    const projectNameElement = document.querySelector('.project-name');
    if (projectNameElement) {
      projectNameElement.textContent = projectName;
    }
    
    // プロジェクト表示部分も更新（タブバーの左側に表示されるプロジェクト名）
    const projectDisplayName = document.querySelector('.project-display .project-name');
    if (projectDisplayName) {
      projectDisplayName.textContent = projectName;
    }
    
    // プロジェクトリストのアクティブなプロジェクト名も更新（一致するもの）
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
      const nameElement = item.querySelector('.project-name');
      if (nameElement && nameElement.textContent === projectName) {
        // このプロジェクトをアクティブに
        projectItems.forEach(pi => pi.classList.remove('active'));
        item.classList.add('active');
      }
    });
  }
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブなプロジェクト
   */
  function updateProjects(projects, activeProject) {
    console.log('プロジェクト一覧更新:', projects.length, '件');
    
    const projectList = document.getElementById('project-list');
    if (!projectList) return;
    
    // リストをクリア
    projectList.innerHTML = '';
    
    // プロジェクトがない場合の表示
    if (!projects || projects.length === 0) {
      projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // 各プロジェクトをリストに追加
    projects.forEach((project) => {
      const item = document.createElement('div');
      const isActive = activeProject && activeProject.id === project.id;
      item.className = 'project-item' + (isActive ? ' active' : '');
      
      // プロジェクト表示名はパスの最後のディレクトリ名か設定されている名前を使用
      let displayName = project.name || '';
      if (!displayName && project.path) {
        // パスから抽出
        const pathParts = project.path.split(/[/\\]/);
        displayName = pathParts[pathParts.length - 1] || 'プロジェクト';
      }
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div>
            <span class="project-name">${displayName}</span>
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
        
        // プロジェクト名を取得
        const projectName = item.querySelector('.project-name').textContent;
        // プロジェクトタブ表示を更新
        const projectNameTab = document.querySelector('.project-name-tab');
        if (projectNameTab) {
          projectNameTab.textContent = projectName;
        }
        
        // プロジェクト選択の進行中メッセージを表示
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = `
          <span class="material-icons" style="color: var(--app-warning);">hourglass_top</span>
          <span class="notification-text">プロジェクト「${projectName}」を読み込み中...</span>
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
        
        // VSCodeにプロジェクト変更のメッセージを送信
        vscode.postMessage({
          command: 'selectProject',
          projectName: projectName,
          projectPath: project.path
        });
        
        // 3秒後に通知を削除
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      };
      
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
      
      // 削除ボタン以外の領域のクリックで全体のクリックイベントを発火
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-project-btn')) {
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
   */
  function initializeMarkdownDisplay() {
    // CURRENT_STATUS.mdファイルをマークダウンとして表示する処理
    // バックエンドから受け取ったマークダウンデータを表示
    // この段階では何もしない、メッセージハンドラーで処理される
    console.log('マークダウン表示の初期化完了');
  }
  
  /**
   * マークダウンをHTMLに変換する簡易的な関数
   * 実際の実装ではmarked.jsなどのライブラリを使用するべき
   */
  function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // 簡易的な実装
    let html = markdown
      // 見出し
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      
      // リスト
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      
      // 強調
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      
      // リンク
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      
      // コード
      .replace(/`(.+?)`/g, '<code>$1</code>')
      
      // 段落
      .replace(/\n\n/g, '</p><p>');
    
    // 段落タグで囲む
    html = '<p>' + html + '</p>';
    
    // リストをリストタグで囲む処理（簡易的）
    html = html.replace(/<li>(.+?)<\/li>/g, '<ul><li>$1</li></ul>');
    
    // チェックボックス対応
    html = html.replace(/\[ \] (.+?)(?=<\/li>)/g, '<input type="checkbox"> $1');
    html = html.replace(/\[x\] (.+?)(?=<\/li>)/g, '<input type="checkbox" checked> $1');
    
    return html;
  }
  
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
   * 相対時間の取得（〇分前、など）
   * @param {Date} date 日付
   * @returns {string} 相対時間
   */
  function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffMin < 1) {
      return '数秒前';
    } else if (diffMin < 60) {
      return `${diffMin}分前`;
    } else if (diffHour < 24) {
      return `${diffHour}時間前`;
    } else {
      // 日付のフォーマット
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  }
  
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
  
  /**
   * ディレクトリ構造ダイアログを表示
   */
  function showDirectoryStructure(structure) {
    // モーダルダイアログを作成
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <div class="dialog-title">プロジェクト構造</div>
      <div style="max-height: 400px; overflow-y: auto; font-family: monospace; white-space: pre; font-size: 12px;">
        ${structure.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      <div class="dialog-footer">
        <button class="button" id="close-dialog">閉じる</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 閉じるボタンのイベントリスナー
    document.getElementById('close-dialog').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  }
  
  /**
   * タブ機能の初期化
   */
  function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // 保存されたアクティブタブがあれば、それを選択状態にする
    const state = vscode.getState();
    if (state && state.activeTab) {
      tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === state.activeTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
      
      tabContents.forEach(content => {
        if (content.id === `${state.activeTab}-tab`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    }
    
    // タブクリックイベントの設定
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // アクティブなタブの状態を保存
        const newState = vscode.getState() || {};
        newState.activeTab = tab.getAttribute('data-tab');
        vscode.setState(newState);
        
        // タブの見た目を更新
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // コンテンツ表示を切り替え
        const tabId = tab.getAttribute('data-tab');
        
        // 対応するタブコンテンツを表示し、それ以外を非表示にする
        tabContents.forEach(content => {
          if (content.id === `${tabId}-tab`) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }
  
  /**
   * 開発ツールカードの初期化
   */
  function initializeToolCards() {
    const toolsTab = document.getElementById('tools-tab');
    if (!toolsTab) return;
    
    // すでに初期化されていれば何もしない
    if (toolsTab.querySelector('.prompt-grid')) return;
    
    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'prompt-grid';
    
    // 開発ツール情報のマッピング（commandはScopeManagerPanel.tsの対応するメソッド名）
    const tools = [
      { id: "requirements-editor", name: "要件定義エディタ", icon: "fact_check", description: "要件定義書の編集と管理", command: "openRequirementsVisualizer" },
      { id: "env-assistant", name: "環境変数アシスタント", icon: "emoji_objects", description: "環境変数の設定と管理", command: "openEnvironmentVariablesAssistant" },
      { id: "mockup-gallery", name: "モックアップギャラリー", icon: "dashboard", description: "UIモックアップの表示と管理", command: "openMockupGallery" },
      { id: "debug-detective", name: "デバッグ探偵", icon: "bug_report", description: "エラー解析と問題解決", command: "openDebugDetective" }
    ];
    
    // 各ツールのカードを作成
    tools.forEach(tool => {
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.innerHTML = `
        <span class="material-icons prompt-icon">${tool.icon}</span>
        <h3 class="prompt-title">${tool.name}</h3>
        <p class="prompt-description">${tool.description}</p>
      `;
      
      // クリックイベント - ツールを開く
      card.addEventListener('click', () => {
        vscode.postMessage({
          command: tool.command
        });
      });
      
      toolsGrid.appendChild(card);
    });
    
    toolsTab.appendChild(toolsGrid);
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
          vscode.postMessage({
            command: 'launchPromptFromURL',
            url: url,
            index: prompt.id
          });
        }
      });
      
      promptGrid.appendChild(card);
    });
  }
})();