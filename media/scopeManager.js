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
  
  // プロンプトURLリスト
  const promptUrls = [
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/bbc6e76a5f448e02bea16918fa1dc9ad"
  ];

  // プロンプト情報マッピング
  const promptInfo = [
    { id: 0, name: "システムアーキテクチャー", icon: "architecture", category: "計画", description: "システム設計を支援します" },
    { id: 1, name: "プロジェクト分析アシスタント", icon: "psychology", category: "分析", description: "プロジェクト分析を行います" },
    { id: 2, name: "要件定義アドバイザー", icon: "description", category: "計画", description: "要件定義を支援します" },
    { id: 3, name: "スコープマネージャー", icon: "assignment_turned_in", category: "管理", description: "開発スコープを管理します" },
    { id: 4, name: "環境変数設定アシスタント", icon: "settings", category: "環境", description: "環境変数の設定を支援します" },
    { id: 5, name: "テスト生成アシスタント", icon: "science", category: "テスト", description: "テスト生成を支援します" },
    { id: 6, name: "モックアップアナライザー", icon: "web", category: "UI", description: "モックアップを分析します" },
    { id: 7, name: "スコープインプリメンター", icon: "build", category: "実装", description: "スコープ実装を支援します" },
    { id: 8, name: "デバック探偵", icon: "bug_report", category: "デバッグ", description: "エラーを分析し解決します" },
    { id: 9, name: "検証アシスタント", icon: "check_circle", category: "検証", description: "実装の検証を行います" }
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
    
    // ClaudeCode連携エリアを初期化
    initializeClaudeCodeShareArea();
  });
  
  // メッセージハンドラーの設定
  window.addEventListener('message', event => {
    const message = event.data;
    
    // シェアリングパネル関連のメッセージは無視（sharingPanel.jsが処理）
    if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
      return; // sharingPanel.jsに処理を任せる
    }
    
    switch (message.command) {
      case 'updateState':
        handleUpdateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'showDirectoryStructure':
        showDirectoryStructure(message.structure);
        break;
      case 'updateProjectPath':
        updateProjectPath(message);
        break;
    }
  });
  
  /**
   * プロジェクトパスの更新
   */
  function updateProjectPath(data) {
    const projectTitle = document.getElementById('project-title');
    const projectPath = document.getElementById('project-path');
    
    // プロジェクト情報の更新
    if (projectTitle && data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      projectTitle.textContent = projectName || 'プロジェクト';
    }
    
    if (projectPath) {
      projectPath.textContent = data.projectPath || '/path/to/project';
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
    
    // VSCodeの通知API経由でエラーメッセージを表示することもできる
    // ここでは簡易的なエラー表示
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
      
      // 5秒後に非表示
      setTimeout(() => {
        errorContainer.style.display = 'none';
      }, 5000);
    }
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
        tabContents.forEach(content => {
          content.classList.toggle('active', content.id === `${tabId}-tab`);
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
    
    console.log('scopeManager.js: 基本的なClaudeCode連携エリアの初期化を完了しました');
    // 詳細な機能はsharingPanel.jsに任せるため、ここでは最小限の初期化のみ行う
  }
})();