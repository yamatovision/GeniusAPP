(function() {
  // VSCode APIとの連携
  const vscode = acquireVsCodeApi();
  
  // DOM要素
  const authStatusIcon = document.getElementById('auth-status-icon');
  const authStatus = document.getElementById('auth-status');
  const claudeStatusIcon = document.getElementById('claude-status-icon');
  const claudeStatus = document.getElementById('claude-status');
  const proxyStatusIcon = document.getElementById('proxy-status-icon');
  const proxyStatus = document.getElementById('proxy-status');
  const syncStatusIcon = document.getElementById('sync-status-icon');
  const syncStatus = document.getElementById('sync-status');
  
  const promptsList = document.getElementById('prompts-list');
  
  const syncPromptsBtn = document.getElementById('sync-prompts-btn');
  const openLibraryBtn = document.getElementById('open-library-btn');
  const checkClaudeBtn = document.getElementById('check-claude-btn');
  const installClaudeBtn = document.getElementById('install-claude-btn');
  // プロンプトセレクター関連の機能は削除されました
  const updateEnvBtn = document.getElementById('update-env-btn');
  
  // 初期化
  init();
  
  function init() {
    setupEventListeners();
    setupAccordion();
    requestStatus();
    requestPrompts();
  }
  
  // イベントリスナーの設定
  function setupEventListeners() {
    // ボタンイベント
    syncPromptsBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'syncPrompts' });
    });
    
    openLibraryBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openLibrary' });
    });
    
    checkClaudeBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'checkInstallation' });
    });
    
    installClaudeBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'install' });
    });
    
    // プロンプトセレクター関連の機能は削除されました
    
    updateEnvBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'updateEnv' });
    });
    
    // VSCodeからのメッセージリスニング
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'status':
          updateStatus(message.data);
          break;
        case 'prompts':
          updatePrompts(message.data);
          break;
        case 'statusUpdate':
          // 個別の状態アップデート（一部のみ更新）
          if (message.data.authStatus) {
            updateAuthStatus(message.data.authStatus);
          }
          if (message.data.claudeStatus) {
            updateClaudeStatus(message.data.claudeStatus);
          }
          if (message.data.proxyStatus) {
            updateProxyStatus(message.data.proxyStatus);
          }
          if (message.data.syncStatus) {
            updateSyncStatus(message.data.syncStatus);
          }
          break;
        case 'error':
          showError(message.data);
          break;
      }
    });
  }
  
  // アコーディオン機能の設定
  function setupAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        
        // アクティブ状態を切り替え
        content.classList.toggle('active');
        
        // 他のアコーディオンを閉じる
        document.querySelectorAll('.accordion-content').forEach(item => {
          if (item !== content) {
            item.classList.remove('active');
          }
        });
      });
    });
  }
  
  // 状態情報の更新
  function updateStatus(data) {
    if (data.authStatus) {
      updateAuthStatus(data.authStatus);
    }
    
    if (data.claudeStatus) {
      updateClaudeStatus(data.claudeStatus);
    }
    
    if (data.proxyStatus) {
      updateProxyStatus(data.proxyStatus);
    }
    
    if (data.syncStatus) {
      updateSyncStatus(data.syncStatus);
    }
  }
  
  // 認証状態の更新
  function updateAuthStatus(authStatusData) {
    authStatus.textContent = authStatusData.text;
    authStatusIcon.textContent = authStatusData.icon || '⚪';
    authStatusIcon.className = 'status-icon ' + (authStatusData.status || 'status-default');
  }
  
  // ClaudeCode状態の更新
  function updateClaudeStatus(claudeStatusData) {
    claudeStatus.textContent = claudeStatusData.text;
    claudeStatusIcon.textContent = claudeStatusData.icon || '⚪';
    claudeStatusIcon.className = 'status-icon ' + (claudeStatusData.status || 'status-default');
  }
  
  // プロキシ状態の更新
  function updateProxyStatus(proxyStatusData) {
    proxyStatus.textContent = proxyStatusData.text;
    proxyStatusIcon.textContent = proxyStatusData.icon || '⚪';
    proxyStatusIcon.className = 'status-icon ' + (proxyStatusData.status || 'status-default');
  }
  
  // 同期状態の更新
  function updateSyncStatus(syncStatusData) {
    syncStatus.textContent = syncStatusData.text;
    syncStatusIcon.textContent = syncStatusData.icon || '⚪';
    syncStatusIcon.className = 'status-icon ' + (syncStatusData.status || 'status-default');
  }
  
  // プロンプト一覧の更新
  function updatePrompts(prompts) {
    if (!prompts || prompts.length === 0) {
      promptsList.innerHTML = '<div class="loading">プロンプトがありません</div>';
      return;
    }
    
    promptsList.innerHTML = '';
    
    prompts.forEach(prompt => {
      const promptItem = document.createElement('div');
      promptItem.className = 'prompt-item';
      promptItem.dataset.id = prompt.id;
      
      const promptHeader = document.createElement('div');
      promptHeader.className = 'prompt-header';
      
      const promptTitle = document.createElement('div');
      promptTitle.className = 'prompt-title';
      promptTitle.textContent = prompt.title;
      
      const promptCategory = document.createElement('div');
      promptCategory.className = 'prompt-category';
      promptCategory.textContent = prompt.category || 'その他';
      
      promptHeader.appendChild(promptTitle);
      promptHeader.appendChild(promptCategory);
      
      const promptTags = document.createElement('div');
      promptTags.className = 'prompt-tags';
      promptTags.textContent = prompt.tags ? prompt.tags.join(', ') : '';
      
      promptItem.appendChild(promptHeader);
      promptItem.appendChild(promptTags);
      
      // プロンプトセレクター関連の機能は削除されました
      
      promptsList.appendChild(promptItem);
    });
  }
  
  // エラー表示
  function showError(errorData) {
    const { message } = errorData;
    
    // エラーメッセージをVSCodeに表示（既にVSCode側で対応するため何もしない）
    console.error('Error:', message);
  }
  
  // 状態情報をリクエスト
  function requestStatus() {
    vscode.postMessage({ type: 'getStatus' });
  }
  
  // プロンプト一覧をリクエスト
  function requestPrompts() {
    vscode.postMessage({ type: 'getPrompts' });
  }
})();