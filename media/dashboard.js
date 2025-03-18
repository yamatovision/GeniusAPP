/**
 * AppGenius ダッシュボード用JavaScript
 * このコードはVSCode拡張のWebViewで使用され、UIとバックエンド連携を行います
 */

(function() {
  // VSCode APIアクセス
  const vscode = acquireVsCodeApi();
  
  // 状態を保持
  let state = {
    projects: [],
    activeProject: null,
    activeProjectDetails: null,
    loading: true,
    error: null,
    firstVisit: true,
    onboardingCompleted: false,
    tutorialDismissed: false
  };
  
  // 保存された状態を復元
  const previousState = vscode.getState();
  if (previousState) {
    state = {...previousState};
  }
  
  // DOMが読み込まれた後に実行
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化処理
    initializeEventListeners();
    // 強制的にライトモードに設定
    const container = document.querySelector('.dashboard-container');
    if (container) {
      container.classList.remove('theme-dark');
      container.classList.add('theme-light');
    }
    
    // プロジェクト一覧の更新をリクエスト
    vscode.postMessage({
      command: 'refreshProjects'
    });
    
    // ローディング状態の更新
    updateLoadingState(true);
    
    // 定期的な状態更新（1秒ごとに更新）
    setInterval(() => {
      if (state.activeProject) {
        vscode.postMessage({
          command: 'refreshProjects'
        });
      }
    }, 1000);
  });
  
  // メッセージのハンドラーを登録
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateState':
        updateState(message);
        updateLoadingState(false);
        break;
      case 'showError':
        showError(message.message);
        updateLoadingState(false);
        break;
      case 'refreshData':
        refreshData();
        break;
      case 'refreshComplete':
        // プロジェクト一覧の更新が完了したことを通知
        updateLoadingState(false);
        break;
    }
  });
  
  /**
   * イベントリスナーの初期化
   */
  function initializeEventListeners() {
    // 新規プロジェクトボタン
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        showNewProjectModal();
      });
    }
    
    // プロジェクト読み込みボタン
    const loadProjectBtn = document.getElementById('load-project-btn');
    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', () => {
        loadExistingProject();
      });
    }
    
    // 新規プロジェクトフォーム
    const newProjectForm = document.getElementById('new-project-form');
    if (newProjectForm) {
      newProjectForm.addEventListener('submit', event => {
        event.preventDefault();
        createNewProject();
      });
    }
    
    // モーダルキャンセルボタン
    const cancelNewProject = document.getElementById('cancel-new-project');
    if (cancelNewProject) {
      cancelNewProject.addEventListener('click', () => {
        hideNewProjectModal();
      });
    }
    
    // テーマ切替ボタン
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        toggleTheme();
      });
    }
  }
  
  /**
   * テーマ切り替え機能（ライトモードに固定）
   */
  function toggleTheme() {
    // 何もしない - ライトモードに固定
    const container = document.querySelector('.dashboard-container');
    
    // 強制的にライトモードに設定
    container.classList.remove('theme-dark');
    container.classList.add('theme-light');
    localStorage.setItem('app-theme', 'light');
    
    // VSCodeにも通知
    vscode.postMessage({
      command: 'themeChanged',
      theme: 'light'
    });
  }
  
  /**
   * データ更新
   */
  function refreshData() {
    // テーマ設定を保持したまま、データのみを更新
    updateLoadingState(true);
    vscode.postMessage({
      command: 'refreshProjects'
    });
  }
  
  /**
   * ローディング状態の更新
   */
  function updateLoadingState(isLoading) {
    state.loading = isLoading;
    saveState();
    
    // プロジェクトコンテナにローディング表示
    const projectsContainer = document.getElementById('projects-container');
    if (projectsContainer) {
      if (isLoading) {
        // ローディング中はグリッドをリセット
        projectsContainer.className = '';
        projectsContainer.innerHTML = `
          <div class="loading">
            <div class="loading-spinner"></div>
            <div>読み込み中...</div>
          </div>
        `;
      } else if (state.projects.length === 0) {
        // プロジェクトがない場合もグリッドをリセット
        projectsContainer.className = '';
        projectsContainer.innerHTML = `
          <div class="no-projects">
            <div>プロジェクトがありません</div>
            <p>新しいプロジェクトを作成するか、既存のプロジェクトを読み込んでください。</p>
            <button class="button primary" onclick="document.getElementById('new-project-btn').click()">
              <span>➕</span> 新規プロジェクト作成
            </button>
          </div>
        `;
      }
    }
  }
  
  /**
   * 状態の保存
   */
  function saveState() {
    vscode.setState(state);
  }
  
  /**
   * 状態の更新
   */
  function updateState(newState) {
    state = { ...state, ...newState };
    saveState();
    
    // UI要素を更新
    renderProjects();
    renderActiveProject();
    
    // アクティブプロジェクトがある場合、プロセスセクションを表示
    if (state.activeProject) {
      const processWrapper = document.getElementById('process-wrapper');
      
      if (processWrapper) processWrapper.style.display = 'block';
      
      // プロセスステップのイベントハンドラを設定
      setupProcessStepHandlers();
    } else {
      const processWrapper = document.getElementById('process-wrapper');
      
      if (processWrapper) processWrapper.style.display = 'none';
    }
  }
  
  /**
   * プロジェクト一覧のレンダリング
   */
  function renderProjects() {
    const projectsContainer = document.getElementById('projects-container');
    if (!projectsContainer) return;
    
    // ローディング中は何もしない
    if (state.loading) return;
    
    // プロジェクトがない場合
    if (state.projects.length === 0) {
      projectsContainer.innerHTML = `
        <div class="no-projects">
          <div>プロジェクトがありません</div>
          <p>新しいプロジェクトを作成するか、既存のプロジェクトを読み込んでください。</p>
          <button class="button primary" onclick="document.getElementById('new-project-btn').click()">
            <span>➕</span> 新規プロジェクト作成
          </button>
        </div>
      `;
      return;
    }
    
    // プロジェクトコンテナ自体がグリッドになるように変更
    projectsContainer.className = 'projects-grid';
    
    // 各プロジェクトカードを直接生成
    let projectsHtml = '';
    
    state.projects.forEach(project => {
      const createdDate = new Date(project.createdAt || Date.now()).toLocaleDateString();
      const updatedDate = new Date(project.updatedAt || Date.now()).toLocaleDateString();
      
      projectsHtml += `
        <div class="project-card">
          <div class="project-card-header">
            <h3>${escapeHtml(project.name)}</h3>
            <div class="project-path">${escapeHtml(project.path || '')}</div>
          </div>
          <div class="project-card-body">
            <div class="project-dates">
              <div class="date-item">
                <span>📅</span> 作成: ${createdDate}
              </div>
              <div class="date-item">
                <span>🔄</span> 更新: ${updatedDate}
              </div>
            </div>
          </div>
          <div class="project-card-footer">
            <button class="button secondary" data-id="${project.id}" title="プロジェクトパスを編集">
              <span>📁</span>
            </button>
            <button class="button primary open-project" data-id="${project.id}">
              <span>🚀</span> 開く
            </button>
          </div>
        </div>
      `;
    });
    
    projectsContainer.innerHTML = projectsHtml;
    
    // プロジェクトカードの「開く」ボタンイベント
    document.querySelectorAll('.button.primary.open-project').forEach(button => {
      button.addEventListener('click', () => {
        openProject(button.dataset.id);
      });
    });
    
    // 編集ボタンのイベントリスナー
    document.querySelectorAll('.button.secondary').forEach(button => {
      button.addEventListener('click', () => {
        showEditPathModal(button.dataset.id);
      });
    });
  }
  
  /**
   * アクティブなプロジェクトの詳細表示
   */
  function renderActiveProject() {
    // メインコンテナを取得
    const mainContainer = document.getElementById('active-project-info');
    if (!mainContainer) {
      return;
    }
    
    // アクティブなプロジェクトがない場合
    if (!state.activeProject) {
      if (state.firstVisit && !state.tutorialDismissed) {
        // 初回訪問時のウェルカムパネル (この機能は維持)
        mainContainer.innerHTML = `
          <div id="welcome-panel" class="welcome-panel">
            <button class="welcome-dismiss" id="dismiss-welcome" title="閉じる">✕</button>
            <div class="welcome-header">
              <div class="welcome-icon">🚀</div>
              <div class="welcome-title">
                <h2>AppGeniusへようこそ！</h2>
                <p>AI駆動の開発ツールで、アプリケーション開発を始めましょう。</p>
              </div>
            </div>
            <div class="welcome-content">
              <div class="welcome-steps">
                <div class="welcome-step">
                  <div class="step-count">1</div>
                  <div class="step-icon">📝</div>
                  <div class="step-title">要件定義</div>
                  <div class="step-description">AIとの対話で、アプリの目的と機能を明確にします。</div>
                </div>
                <div class="welcome-step">
                  <div class="step-count">2</div>
                  <div class="step-icon">🎨</div>
                  <div class="step-title">モックアップ</div>
                  <div class="step-description">UIデザインをAIと一緒に作成・編集します。</div>
                </div>
                <div class="welcome-step">
                  <div class="step-count">3</div>
                  <div class="step-icon">📋</div>
                  <div class="step-title">スコープ設定</div>
                  <div class="step-description">実装する機能の範囲と優先順位を決定します。</div>
                </div>
              </div>
              <div class="welcome-actions">
                <button id="create-first-project" class="welcome-button">
                  <span>➕</span> 最初のプロジェクトを作成
                </button>
                <button id="show-tutorial" class="welcome-button secondary">
                  <span>📚</span> チュートリアルを見る
                </button>
              </div>
            </div>
          </div>
        `;
        
        // ウェルカムパネル関連のイベント設定
        setupWelcomePanelEvents();
      } else {
        // 通常の「プロジェクトを選択してください」表示
        mainContainer.innerHTML = `
          <div class="no-active-project">
            <h2>プロジェクトを選択してください</h2>
            <p>左側のリストからプロジェクトを選択するか、新しいプロジェクトを作成してください。</p>
          </div>
        `;
      }
      return;
    }
    
    try {
      const project = state.activeProject;
      const details = state.activeProjectDetails || {};
      const createdDate = new Date(project.createdAt || Date.now()).toLocaleDateString();
      const updatedDate = new Date(project.updatedAt || Date.now()).toLocaleDateString();
      
      // アクティブプロジェクト情報を表示
      mainContainer.innerHTML = `
        <div id="active-project-panel" class="active-project-panel">
          <div class="project-details">
            <h2>${escapeHtml(project.name || 'プロジェクト名なし')}</h2>
            <div class="project-path">${escapeHtml(project.path || '未設定')}</div>
            <div class="project-dates">
              <div class="date-item">
                <span>📅</span> 作成日: ${createdDate}
              </div>
              <div class="date-item">
                <span>🔄</span> 更新日: ${updatedDate}
              </div>
            </div>
          </div>
        </div>
        
        <div id="process-wrapper">
          <div id="planning-process" class="process-section">
            <div class="section-header">
              <h2><span>🧩</span> 計画と設計</h2>
              <p class="section-description">アプリケーションの要件定義からモックアップ、実装スコープまでのプロセスです。</p>
            </div>
            <div class="process-steps-flow">
              <a href="#" class="process-step active" id="requirements-step" data-command="openRequirementsEditor">
                <div class="step-number">1</div>
                <div class="step-icon">📝</div>
                <div class="step-content">
                  <div class="step-title">要件定義</div>
                  <div class="step-instruction">まずここから始めて、アプリの目的と機能を明確にします</div>
                </div>
                <div class="step-action">開く</div>
              </a>

              <a href="#" class="process-step" id="mockup-step" data-command="openMockupEditor">
                <div class="step-number">2</div>
                <div class="step-icon">🎨</div>
                <div class="step-content">
                  <div class="step-title">モックアップギャラリー</div>
                  <div class="step-instruction">画面デザインのイメージを作成・編集します</div>
                </div>
                <div class="step-action">開く</div>
              </a>

              <a href="#" class="process-step" id="scope-step" data-command="openScopeManager">
                <div class="step-number">3</div>
                <div class="step-icon">📋</div>
                <div class="step-content">
                  <div class="step-title">スコープマネージャー</div>
                  <div class="step-instruction">実装する機能の優先順位と範囲を設定します</div>
                </div>
                <div class="step-action">開く</div>
              </a>
            </div>
          </div>
        </div>
      `;
      
      // プロセスステップのイベント設定
      setupProcessStepHandlers();
    } catch (error) {
      console.error('プロジェクト詳細の表示中にエラーが発生しました:', error);
      mainContainer.innerHTML = `
        <div class="error-panel">
          <h2><span>⚠️</span> 表示エラー</h2>
          <p>プロジェクト情報の表示中にエラーが発生しました。</p>
          <button class="button primary" onclick="refreshData()">
            <span>🔄</span> 再読み込み
          </button>
        </div>
      `;
    }
  }
  
  /**
   * ウェルカムパネルのイベントを設定
   */
  function setupWelcomePanelEvents() {
    // 閉じるボタン
    const dismissButton = document.getElementById('dismiss-welcome');
    if (dismissButton) {
      dismissButton.addEventListener('click', () => {
        // ウェルカムパネルを閉じて状態を保存
        state.tutorialDismissed = true;
        saveState();
        
        // ウェルカムパネルを再描画
        renderActiveProject();
      });
    }
    
    // プロジェクト作成ボタン
    const createFirstButton = document.getElementById('create-first-project');
    if (createFirstButton) {
      createFirstButton.addEventListener('click', () => {
        showNewProjectModal();
      });
    }
    
    // チュートリアルボタン
    const showTutorialButton = document.getElementById('show-tutorial');
    if (showTutorialButton) {
      showTutorialButton.addEventListener('click', () => {
        // チュートリアル表示（現在は何もしない）
        state.tutorialDismissed = true;
        saveState();
        renderActiveProject();
      });
    }
  }
  
  /**
   * プロセスステップのイベントハンドラを設定
   */
  function setupProcessStepHandlers() {
    document.querySelectorAll('.process-step').forEach(step => {
      step.addEventListener('click', event => {
        event.preventDefault();
        
        // disabled状態のステップはクリック無効
        if (step.classList.contains('disabled')) {
          return;
        }
        
        const command = step.getAttribute('data-command');
        if (command) {
          // VSCodeコマンドを実行
          vscode.postMessage({
            command: command
          });
        }
      });
    });
  }
  
  /**
   * 新規プロジェクトモーダルを表示
   */
  function showNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) {
      modal.classList.add('active');
      
      // フォームをリセット
      const form = document.getElementById('new-project-form');
      if (form) form.reset();
      
      // 名前フィールドにフォーカス
      const projectName = document.getElementById('project-name');
      if (projectName) projectName.focus();
    }
  }
  
  /**
   * 新規プロジェクトモーダルを非表示
   */
  function hideNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
  
  /**
   * 新規プロジェクト作成処理
   */
  function createNewProject() {
    const nameEl = document.getElementById('project-name');
    
    if (!nameEl) return;
    
    const name = nameEl.value.trim();
    
    if (!name) {
      showError('プロジェクト名を入力してください');
      return;
    }
    
    vscode.postMessage({
      command: 'createProject',
      name,
      description: ""
    });
    
    hideNewProjectModal();
    updateLoadingState(true);
  }
  
  /**
   * プロジェクトを開く
   * スコープマネージャーを直接開くように変更
   */
  function openProject(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    // appgenius-ai.openScopeManager コマンドを実行する
    vscode.postMessage({
      command: 'executeCommand',
      commandId: 'appgenius-ai.openScopeManager',
      args: [project.path]
    });
    
    updateLoadingState(true);
  }
  
  /**
   * プロジェクトパス編集モーダルを表示
   */
  function showEditPathModal(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    // モーダル要素の作成
    let modal = document.getElementById('edit-path-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-path-modal';
      modal.className = 'modal-overlay';
      
      // モーダルの内容を設定
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2>プロジェクトパスの編集</h2>
          </div>
          <div class="modal-body">
            <form id="edit-path-form">
              <div class="form-group">
                <label for="project-path">プロジェクトパス <span style="color: #e74c3c;">*</span></label>
                <input type="text" id="project-path" value="${escapeHtml(project.path || '')}" required placeholder="/path/to/your/project">
                <div class="form-description">フォルダが移動または名前変更された場合に更新してください</div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="button secondary" id="cancel-edit-path">キャンセル</button>
            <button type="submit" form="edit-path-form" class="button primary">更新</button>
          </div>
        </div>
      `;
      
      // モーダルをDOMに追加
      document.body.appendChild(modal);
    }
    
    // モーダルを表示
    modal.classList.add('active');
    
    // キャンセルボタンのイベントリスナー
    const cancelButton = document.getElementById('cancel-edit-path');
    if (cancelButton) {
      cancelButton.addEventListener('click', hideEditPathModal);
    }
    
    // フォームのイベントリスナー
    const form = document.getElementById('edit-path-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const pathInput = document.getElementById('project-path');
        if (!pathInput) return;
        
        const newPath = pathInput.value.trim();
        if (!newPath) {
          showError('プロジェクトパスを入力してください');
          return;
        }
        
        // パスの更新
        updateProjectPath(id, newPath);
        
        // モーダルを閉じる
        hideEditPathModal();
      });
    }
  }
  
  /**
   * プロジェクトパス編集モーダルを非表示
   */
  function hideEditPathModal() {
    const modal = document.getElementById('edit-path-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
  
  /**
   * プロジェクトパスを更新
   */
  function updateProjectPath(id, newPath) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    // 更新が必要ない場合は何もしない
    if (project.path === newPath) return;
    
    // 更新内容を設定
    const updates = {
      path: newPath
    };
    
    // ローディング状態にする
    updateLoadingState(true);
    
    // バックエンドに更新メッセージを送信
    vscode.postMessage({
      command: 'updateProject',
      id,
      updates
    });
  }
  
  /**
   * 既存プロジェクトの読み込み
   */
  function loadExistingProject() {
    vscode.postMessage({
      command: 'loadExistingProject'
    });
    
    updateLoadingState(true);
  }
  
  /**
   * エラーメッセージ表示
   */
  function showError(message) {
    // 既存のエラーメッセージがあれば削除
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(el => el.remove());
    
    // エラーメッセージの作成
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<span>⚠️</span> ${escapeHtml(message)}`;
    
    document.body.appendChild(errorDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
  
  /**
   * HTMLエスケープ関数
   */
  function escapeHtml(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();