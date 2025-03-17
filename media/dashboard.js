/**
 * AppGenius ダッシュボード用JavaScript
 * このコードはVSCode拡張のWebViewで使用され、UIとバックエンド連携を行います
 */

(function() {
  // VSCode APIアクセス
  const vscode = acquireVsCodeApi();
  
  // アイコンマッピング
  const PHASE_ICONS = {
    requirements: '📝',
    design: '🎨',
    implementation: '💻',
    testing: '🧪',
    deployment: '🚀'
  };
  
  const FILE_TYPE_ICONS = {
    md: '📄',
    markdown: '📄',
    js: '📜',
    ts: '📜',
    json: '📋',
    html: '🌐',
    css: '🎨',
    svg: '🖼️',
    png: '🖼️',
    jpg: '🖼️',
    pdf: '📑',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    zip: '📦',
    default: '📄'
  };
  
  // 状態を保持
  let state = {
    projects: [],
    activeProject: null,
    activeProjectDetails: null,
    loading: true,
    error: null,
    sidebarCollapsed: false,
    // 初回表示管理用フラグ
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
    initializeUI();
    
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
        showTutorial();
      });
    }
  }
  
  /**
   * チュートリアルを表示
   */
  function showTutorial() {
    // まず初回フラグは非表示に
    state.firstVisit = false;
    saveState();
    
    // ウェルカムパネルを閉じる
    renderActiveProject();
    
    // サイドバーの新規プロジェクトボタンにヒントを表示
    addTutorialHint(
      'new-project-btn', 
      'このボタンでプロジェクトを作成できます。プロジェクトはAppGeniusの基本単位です。',
      'bottom'
    );
    
    // 2秒後に次のヒントを表示（ローディング完了するまで待機）
    setTimeout(() => {
      // 新規プロジェクトボタンのヒントを削除
      removeTutorialHint('new-project-btn');
      
      // プロセスセクションにヒントを表示（新規プロジェクト作成を促進）
      const projectsContainer = document.getElementById('projects-container');
      if (projectsContainer) {
        const hint = document.createElement('div');
        hint.className = 'tutorial-hint';
        hint.innerHTML = `
          <i class="tutorial-hint-icon">💡</i>
          まずは「新規作成」ボタンをクリックして、プロジェクトを作成しましょう！
          <button class="tutorial-hint-dismiss" id="dismiss-hint-container">✕</button>
        `;
        hint.style.position = 'relative';
        hint.style.margin = '1rem 0';
        
        // プロジェクトコンテナに追加
        projectsContainer.prepend(hint);
        
        // ヒント閉じるボタンのイベント
        const dismissHint = document.getElementById('dismiss-hint-container');
        if (dismissHint) {
          dismissHint.addEventListener('click', () => {
            hint.remove();
          });
        }
      }
    }, 2000);
  }
  
  /**
   * チュートリアルヒントを追加
   */
  function addTutorialHint(targetId, text, position = 'right') {
    const target = document.getElementById(targetId);
    if (!target) return;
    
    // 既存のヒントがあれば削除
    removeTutorialHint(targetId);
    
    // ヒント要素を作成
    const hint = document.createElement('div');
    hint.className = `tutorial-hint ${position}`;
    hint.id = `hint-${targetId}`;
    hint.innerHTML = `
      <i class="tutorial-hint-icon">💡</i>
      ${text}
      <button class="tutorial-hint-dismiss" id="dismiss-hint-${targetId}">✕</button>
    `;
    
    // 位置調整
    const rect = target.getBoundingClientRect();
    
    // 位置に応じて配置を変更
    switch (position) {
      case 'top':
        hint.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        hint.style.left = `${rect.left + rect.width / 2 - 100}px`;
        break;
      case 'bottom':
        hint.style.top = `${rect.bottom + 10}px`;
        hint.style.left = `${rect.left + rect.width / 2 - 100}px`;
        break;
      case 'left':
        hint.style.right = `${window.innerWidth - rect.left + 10}px`;
        hint.style.top = `${rect.top + rect.height / 2 - 20}px`;
        break;
      case 'right':
        hint.style.left = `${rect.right + 10}px`;
        hint.style.top = `${rect.top + rect.height / 2 - 20}px`;
        break;
    }
    
    // ヒントをDOMに追加
    document.body.appendChild(hint);
    
    // 閉じるボタンのイベント
    const dismissButton = document.getElementById(`dismiss-hint-${targetId}`);
    if (dismissButton) {
      dismissButton.addEventListener('click', () => {
        removeTutorialHint(targetId);
      });
    }
  }
  
  /**
   * チュートリアルヒントを削除
   */
  function removeTutorialHint(targetId) {
    const hint = document.getElementById(`hint-${targetId}`);
    if (hint) {
      hint.remove();
    }
  }
  
  /**
   * サンプルプロジェクトを作成
   */
  function createSampleProject() {
    // プロジェクト名と説明を設定
    const name = "サンプルTodoアプリ";
    const description = "AppGeniusの機能を試すための簡単なTodoリストアプリケーションのサンプルプロジェクトです。";
    
    // 通常のプロジェクト作成処理を呼び出す
    vscode.postMessage({
      command: 'createProject',
      name,
      description
    });
    
    // ローディング状態にする
    updateLoadingState(true);
    
    // 成功メッセージを表示
    showInfo(`サンプルプロジェクト「${name}」を作成しています...`);
  }
  
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
    
    // サイドバートグルボタン（オプショナル）
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => {
        toggleSidebar();
      });
    }
    
    // プロセスステップボタンへのイベントリスナーは
    // ステップ描画時に動的に追加
  }
  
  /**
   * テーマ切り替え機能
   */
  function toggleTheme() {
    const container = document.querySelector('.dashboard-container');
    const currentTheme = container.classList.contains('theme-light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // まずダッシュボードのテーマを切り替え
    if (newTheme === 'dark') {
      container.classList.remove('theme-light');
      container.classList.add('theme-dark');
      localStorage.setItem('app-theme', 'dark');
      console.log('ダークモードに切り替えました');
    } else {
      container.classList.remove('theme-dark');
      container.classList.add('theme-light');
      localStorage.setItem('app-theme', 'light');
      console.log('ライトモードに切り替えました');
    }
    
    // テーマ変更のイベント発火
    // このイベントは各コンポーネントでリッスンされ、テーマを同期する
    document.dispatchEvent(new CustomEvent('theme-changed', { 
      detail: { theme: newTheme } 
    }));
    
    // VSCodeにもテーマ変更を通知
    vscode.postMessage({
      command: 'themeChanged',
      theme: newTheme
    });
  }
  
  /**
   * 初期テーマの設定
   */
  function setInitialTheme() {
    // デフォルトはライト
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const container = document.querySelector('.dashboard-container');
    
    // 初期クラスは既にHTMLで設定しているが、
    // 保存されたテーマがある場合は上書き
    if (savedTheme === 'dark') {
      container.classList.remove('theme-light');
      container.classList.add('theme-dark');
    } else {
      container.classList.remove('theme-dark');
      container.classList.add('theme-light');
    }
    
    // 初期ロード時にもテーマ変更イベントを発火
    // 他のコンポーネントが開かれる前に発火する必要がある
    document.dispatchEvent(new CustomEvent('theme-changed', { 
      detail: { theme: savedTheme } 
    }));
    
    // VSCodeにも初期テーマを通知
    vscode.postMessage({
      command: 'themeChanged',
      theme: savedTheme
    });
  }
  
  /**
   * UI初期化
   */
  function initializeUI() {
    // サイドバーの初期状態を設定
    updateSidebarState();
    
    // 初期テーマを設定
    setInitialTheme();
    
    // ボタンテキストの色を強制的に白に設定
    const fixButtonTextColors = () => {
      // ヘッダーボタンとプロジェクトボタンのテキストを白に
      document.querySelectorAll('.header-actions button, .project-buttons button').forEach(button => {
        button.style.color = "white";
        
        // ボタン内のspanも白く
        const spans = button.querySelectorAll('span');
        spans.forEach(span => {
          span.style.color = "white";
        });
      });
    };
    
    // 初回実行
    fixButtonTextColors();
    
    // DOM変更を監視して、動的に追加されたボタンにも適用
    const observer = new MutationObserver(fixButtonTextColors);
    observer.observe(document.body, { childList: true, subtree: true });
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
        projectsContainer.innerHTML = `
          <div class="loading">
            <div class="loading-spinner"></div>
            <div>読み込み中...</div>
          </div>
        `;
      } else if (state.projects.length === 0) {
        projectsContainer.innerHTML = `
          <div class="no-projects">
            <div>プロジェクトがありません</div>
            <p>新しいプロジェクトを作成するか、既存のプロジェクトを読み込んでください。</p>
            <button class="button primary" onclick="document.getElementById('new-project-btn').click()">
              <i class="icon">➕</i> 新規プロジェクト作成
            </button>
          </div>
        `;
      }
    }
  }
  
  /**
   * サイドバーの状態を更新
   */
  function updateSidebarState() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (state.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
      }
    }
  }
  
  /**
   * サイドバーの表示切替
   */
  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    saveState();
    updateSidebarState();
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
            <i class="icon">➕</i> 新規プロジェクト作成
          </button>
        </div>
      `;
      return;
    }
    
    // プロジェクト一覧を描画
    let projectsHtml = '';
    
    state.projects.forEach(project => {
      const isActive = state.activeProject && project.id === state.activeProject.id;
      const lastUpdated = new Date(project.updatedAt).toLocaleString();
      
      projectsHtml += `
        <div class="project-item ${isActive ? 'active' : ''}" data-id="${project.id}">
          <div class="project-header">
            <h3>${escapeHtml(project.name)}</h3>
            <div class="project-actions">
              <button class="icon-button edit-project" data-id="${project.id}" title="パス編集">📁</button>
              <button class="icon-button delete-project" data-id="${project.id}" title="削除">🗑️</button>
            </div>
          </div>
          <p class="project-updated">最終更新: ${lastUpdated}</p>
        </div>
      `;
    });
    
    projectsContainer.innerHTML = projectsHtml;
    
    // プロジェクト項目のクリックイベント
    document.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', event => {
        // ボタンのクリックは伝播させない
        if (event.target.classList.contains('delete-project') || 
            event.target.classList.contains('edit-project')) {
          event.stopPropagation();
          return;
        }
        
        openProject(item.dataset.id);
      });
    });
    
    // 削除ボタンのイベントリスナー
    document.querySelectorAll('.delete-project').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        deleteProject(button.dataset.id);
      });
    });
    
    // 編集ボタンのイベントリスナー
    document.querySelectorAll('.edit-project').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
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
      console.error('アクティブプロジェクト情報コンテナが見つかりません');
      return;
    }
    
    // 常に表示するパネルを作成
    if (!document.getElementById('active-project-panel')) {
      mainContainer.innerHTML = `
        <div id="active-project-panel" class="active-project-panel"></div>
        <div id="process-wrapper" style="display: none;">
          <div id="planning-process" class="process-section">
            <div class="section-header">
              <h2><i class="icon">🧩</i> 計画と設計</h2>
              <p class="section-description">アプリケーションの要件定義からモックアップ、実装スコープまでのプロセスです。</p>
            </div>
            <div class="process-steps-flow"></div>
          </div>
          <div id="implementation-process" class="process-section">
            <div class="section-header">
              <h2><i class="icon">⚙️</i> 実装と展開</h2>
              <p class="section-description">コードの生成からテスト、デプロイまでのプロセスです。</p>
            </div>
            <div class="process-steps-flow"></div>
          </div>
        </div>
        <div id="recent-files" class="recent-files"></div>
      `;
    }
    
    // アクティブプロジェクトパネル参照を更新
    const activeProjectPanel = document.getElementById('active-project-panel');
    if (!activeProjectPanel) return;
    
    // プロジェクトがない場合
    if (!state.activeProject) {
      // 初回訪問時のウェルカムパネルを表示
      if (state.firstVisit && !state.tutorialDismissed) {
        activeProjectPanel.innerHTML = `
          <div class="welcome-panel">
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
                  <i class="icon">➕</i> 最初のプロジェクトを作成
                </button>
                <button id="show-tutorial" class="welcome-button secondary">
                  <i class="icon">📚</i> チュートリアルを見る
                </button>
              </div>
            </div>
          </div>
          <div class="no-active-project">
            <h2>プロジェクトを選択してください</h2>
            <p>左側のリストからプロジェクトを選択するか、新しいプロジェクトを作成してください。</p>
          </div>
        `;
        
        // ウェルカムパネル関連のイベント設定
        setupWelcomePanelEvents();
      } else {
        // 通常の表示
        activeProjectPanel.innerHTML = `
          <div class="no-active-project">
            <h2>プロジェクトを選択してください</h2>
            <p>左側のリストからプロジェクトを選択するか、新しいプロジェクトを作成してください。</p>
            ${state.projects.length === 0 ? `
              <button class="welcome-button" id="create-sample-project" style="margin-top: 1.5rem;">
                <i class="icon">🔮</i> サンプルプロジェクトを作成
              </button>
            ` : ''}
          </div>
        `;
        
        // サンプルプロジェクト作成ボタンのイベント設定
        const sampleButton = document.getElementById('create-sample-project');
        if (sampleButton) {
          sampleButton.addEventListener('click', createSampleProject);
        }
      }
      return;
    }
    
    try {
      const project = state.activeProject;
      const details = state.activeProjectDetails || {};
      const createdDate = new Date(project.createdAt || Date.now()).toLocaleDateString();
      const updatedDate = new Date(project.updatedAt || Date.now()).toLocaleDateString();
      
      // ファイル進捗情報の表示コンテンツを生成
      const fileProgressHtml = renderFileProgressSection(details.fileProgress);
      
      activeProjectPanel.innerHTML = `
        <div class="project-details">
          <h2><i class="icon">📂</i> ${escapeHtml(project.name || 'プロジェクト名なし')}</h2>
          <div class="project-path">${escapeHtml(project.path || '未設定')}</div>
          <div class="project-dates">
            <div class="date-item">
              <i class="icon">📅</i> 作成日: ${createdDate}
            </div>
            <div class="date-item">
              <i class="icon">🔄</i> 更新日: ${updatedDate}
            </div>
          </div>
          
          ${fileProgressHtml}
        </div>
      `;
      
      // プロセスラッパーを表示
      const processWrapper = document.getElementById('process-wrapper');
      if (processWrapper) processWrapper.style.display = 'block';
      
      // 開発プロセスの描画
      renderProcessSteps();
      
      // 最近のファイル（仮データ）
      renderRecentFiles();
    } catch (error) {
      console.error('プロジェクト詳細の表示中にエラーが発生しました:', error);
      activeProjectPanel.innerHTML = `
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 表示エラー</h2>
          <p>プロジェクト情報の表示中にエラーが発生しました。</p>
          <button class="button primary" onclick="refreshData()">
            <i class="icon">🔄</i> 再読み込み
          </button>
        </div>
      `;
    }
  }
  
  /**
   * ファイル進捗表示セクションを生成
   */
  function renderFileProgressSection(progressData) {
    return '';
  }
  
  /**
   * 開発プロセスステップの描画
   */
  function renderProcessSteps() {
    const planningProcess = document.getElementById('planning-process');
    const implementationProcess = document.getElementById('implementation-process');
    
    if (!planningProcess || !implementationProcess || !state.activeProject) return;
    
    try {
      const project = state.activeProject;
      const details = state.activeProjectDetails || {};
      
      // phase情報の安全な取得
      const phases = project.phases || { requirements: false, design: false, implementation: false, testing: false, deployment: false };
      
      // モックアップファイルの存在チェック (新しい条件) - 常に最新の状態を反映
      const hasMockupFiles = details.hasMockupFiles || false;
      
      // モックアップファイルの存在フラグを確認
      
      // 計画プロセスのステップ描画
      const planningStepsHtml = `
        <div class="process-steps-flow">
          <a href="#" class="process-step ${phases.requirements ? 'completed' : 'active'}" id="requirements-step" data-command="openRequirementsEditor">
            <div class="step-number">1</div>
            <div class="step-icon">📝</div>
            <div class="step-content">
              <div class="step-title">要件定義</div>
              <div class="step-instruction">まずここから始めて、アプリの目的と機能を明確にします</div>
            </div>
            ${phases.requirements ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step ${phases.design ? 'completed' : 'active'}" id="mockup-step" data-command="openMockupEditor">
            <div class="step-number">2</div>
            <div class="step-icon">🎨</div>
            <div class="step-content">
              <div class="step-title">モックアップギャラリー</div>
              <div class="step-instruction">画面デザインのイメージを作成・編集します</div>
            </div>
            ${phases.design ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step ${phases.implementation ? 'completed' : (hasMockupFiles ? 'active' : '')} ${!hasMockupFiles ? 'disabled' : ''}" id="scope-step" data-command="openScopeManager">
            <div class="step-number">3</div>
            <div class="step-icon">📋</div>
            <div class="step-content">
              <div class="step-title">スコープマネージャー</div>
              <div class="step-instruction">実装する機能の優先順位と範囲を設定します</div>
            </div>
            ${phases.implementation && (details.implementationProgress || 0) >= 100 ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>
        </div>
      `;
      
      // 実装プロセスのステップ描画
      const implementationProgress = details.implementationProgress || 0;
      
      const implementationStepsHtml = `
        <div class="process-steps-flow">
          <a href="#" class="process-step active" id="testing-step" data-command="openDebugDetective">
            <div class="step-number">4</div>
            <div class="step-icon">🔍</div>
            <div class="step-content">
              <div class="step-title">デバッグ探偵</div>
              <div class="step-instruction">エラーを検出し解決します。シャーロックホームズがお手伝いします</div>
            </div>
            ${phases.testing ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step active" id="env-vars-step" data-command="openEnvironmentVariablesAssistant">
            <div class="step-number">6</div>
            <div class="step-icon">🔑</div>
            <div class="step-content">
              <div class="step-title">環境変数アシスタント</div>
              <div class="step-instruction">APIキーや接続設定など、環境変数の設定をサポートします</div>
            </div>
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step active" id="deploy-step" data-command="openDeployManager">
            <div class="step-number">7</div>
            <div class="step-icon">🚀</div>
            <div class="step-content">
              <div class="step-title">デプロイ</div>
              <div class="step-instruction">完成したアプリの公開準備をします</div>
            </div>
            ${phases.deployment ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>
        </div>
      `;
      
      // 計画プロセスのHTMLを更新
      const existingPlanningFlow = planningProcess.querySelector('.process-steps-flow');
      if (existingPlanningFlow) {
        existingPlanningFlow.remove();
      }
      planningProcess.insertAdjacentHTML('beforeend', planningStepsHtml);
      
      // 実装プロセスのHTMLを更新
      const existingImplementationFlow = implementationProcess.querySelector('.process-steps-flow');
      if (existingImplementationFlow) {
        existingImplementationFlow.remove();
      }
      implementationProcess.insertAdjacentHTML('beforeend', implementationStepsHtml);
      
      // イベントリスナーを設定
      setupProcessStepHandlers();
    } catch (error) {
      console.error('プロセスステップの表示中にエラーが発生しました:', error);
      
      // 各プロセスセクションにエラーメッセージを表示
      planningProcess.innerHTML = `
        <div class="section-header">
          <h2><i class="icon">🧩</i> 計画と設計</h2>
        </div>
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 表示エラー</h2>
          <p>プロセスステップの情報を取得できませんでした。</p>
          <button class="button primary" onclick="refreshData()">
            <i class="icon">🔄</i> 再読み込み
          </button>
        </div>
      `;
      
      implementationProcess.innerHTML = `
        <div class="section-header">
          <h2><i class="icon">⚙️</i> 実装と展開</h2>
        </div>
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 表示エラー</h2>
          <p>プロセスステップの情報を取得できませんでした。</p>
        </div>
      `;
    }
  }
  
  /**
   * リファレンスマネージャーを表示
   */
  function renderRecentFiles() {
    const recentFilesElement = document.getElementById('recent-files');
    if (!recentFilesElement || !state.activeProject) return;
    
    try {
      const projectPath = state.activeProject.path || '';
      
      const referenceManagerHtml = `
        <div class="recent-files-header">
          <h2><i class="icon">📚</i> リファレンスマネージャー</h2>
        </div>
        <div class="reference-manager-wrapper">
          <div class="reference-description" style="color: #333; background-color: #f2f6fc; font-size: 0.95rem;">
            <p>リファレンス情報を簡単に追加して整理できます。</p>
            <p>コードスニペット、API情報、環境設定、ドキュメントなどを保存できます。</p>
          </div>
          
          <div class="reference-input-wrapper">
            <div class="tabs">
              <div class="tab-item active" data-tab="text">テキスト</div>
              <div class="tab-item" data-tab="image">画像</div>
            </div>
            
            <!-- テキスト入力タブ -->
            <div class="tab-content active" id="text-content">
              <div class="input-field">
                <textarea id="reference-content" placeholder="ここにテキストを入力またはコピー＆ペーストしてください。タイトルとタイプが自動検出されます。"></textarea>
              </div>
              
              <div class="input-actions">
                <button id="add-reference-button" class="button primary">
                  <i class="icon">➕</i> 追加
                </button>
                <button id="clear-reference-button" class="button">
                  <i class="icon">🗑️</i> クリア
                </button>
              </div>
            </div>
            
            <!-- 画像入力タブ -->
            <div class="tab-content" id="image-content" style="display: none;">
              <div class="upload-dropzone" id="upload-dropzone">
                <i class="icon large">📷</i>
                <p>画像をドラッグ＆ドロップ または クリックして選択</p>
                <input type="file" id="image-upload" accept="image/*" style="display: none;" />
              </div>
              
              <div id="image-preview-container" style="display: none;">
                <img id="preview-image" src="" alt="プレビュー">
                <button id="remove-image-button" class="button">
                  <i class="icon">🗑️</i> 削除
                </button>
              </div>
              
              <div class="input-field">
                <input type="text" id="image-title" placeholder="画像タイトル (必須)">
              </div>
              
              <div class="input-actions">
                <button id="add-image-button" class="button primary" disabled>
                  <i class="icon">➕</i> 追加
                </button>
                <button id="clear-image-button" class="button">
                  <i class="icon">🗑️</i> クリア
                </button>
              </div>
            </div>
          </div>
          
          <div class="reference-history">
            <h3 style="color: #2d3748; font-size: 1.05rem; margin-bottom: 0.8rem;">最近のリファレンス</h3>
            <div class="history-empty">
              <p style="color: #4a5568; font-size: 0.95rem;">リファレンス履歴がありません</p>
            </div>
          </div>
        </div>
      `;
      
      recentFilesElement.innerHTML = referenceManagerHtml;
      
      // タブ切り替え処理
      const tabs = document.querySelectorAll('.tab-item');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // タブのアクティブ状態を切り替え
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // コンテンツ表示を切り替え
          const tabName = tab.dataset.tab;
          document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
          });
          
          const activeContent = document.getElementById(`${tabName}-content`);
          if (activeContent) {
            activeContent.style.display = 'block';
          }
        });
      });
      
      // テキスト入力処理
      const referenceContent = document.getElementById('reference-content');
      const addReferenceButton = document.getElementById('add-reference-button');
      const clearReferenceButton = document.getElementById('clear-reference-button');
      
      if (addReferenceButton) {
        addReferenceButton.addEventListener('click', () => {
          if (!referenceContent || !referenceContent.value.trim()) {
            vscode.postMessage({
              command: 'showError',
              message: 'リファレンス内容を入力してください'
            });
            return;
          }
          
          vscode.postMessage({
            command: 'addReference',
            content: referenceContent.value,
            type: 'auto'
          });
          
          // 入力をクリア
          if (referenceContent) {
            referenceContent.value = '';
          }
          
          // 履歴に追加 (仮実装)
          const historyElement = document.querySelector('.reference-history');
          const emptyNotice = historyElement.querySelector('.history-empty');
          
          if (emptyNotice) {
            emptyNotice.remove();
          }
          
          const now = new Date();
          const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          historyElement.insertAdjacentHTML('beforeend', `
            <div class="history-item">
              <div class="history-icon">📄</div>
              <div class="history-details">
                <div class="history-name">新しいリファレンス</div>
                <div class="history-meta">
                  <span class="history-time">${timeStr}</span>
                  <span class="history-type">テキスト</span>
                </div>
              </div>
            </div>
          `);
        });
      }
      
      if (clearReferenceButton) {
        clearReferenceButton.addEventListener('click', () => {
          if (referenceContent) {
            referenceContent.value = '';
          }
        });
      }
      
      // 画像入力処理
      const uploadDropzone = document.getElementById('upload-dropzone');
      const imageUpload = document.getElementById('image-upload');
      const previewContainer = document.getElementById('image-preview-container');
      const previewImage = document.getElementById('preview-image');
      const removeImageButton = document.getElementById('remove-image-button');
      const imageTitle = document.getElementById('image-title');
      const addImageButton = document.getElementById('add-image-button');
      const clearImageButton = document.getElementById('clear-image-button');
      
      if (uploadDropzone && imageUpload) {
        // ドロップゾーンクリックでファイル選択を開く
        uploadDropzone.addEventListener('click', () => {
          imageUpload.click();
        });
        
        // ファイル選択変更時の処理
        imageUpload.addEventListener('change', () => {
          handleImageSelection(imageUpload);
        });
        
        // ドラッグ&ドロップイベント
        uploadDropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadDropzone.classList.add('dragover');
        });
        
        uploadDropzone.addEventListener('dragleave', () => {
          uploadDropzone.classList.remove('dragover');
        });
        
        uploadDropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadDropzone.classList.remove('dragover');
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
              imageUpload.files = e.dataTransfer.files;
              handleImageSelection(imageUpload);
            } else {
              vscode.postMessage({
                command: 'showError',
                message: '画像ファイルを選択してください'
              });
            }
          }
        });
      }
      
      // 画像選択処理
      function handleImageSelection(input) {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          const reader = new FileReader();
          
          reader.onload = function(e) {
            if (previewImage && previewContainer && uploadDropzone) {
              previewImage.src = e.target.result;
              previewContainer.style.display = 'block';
              uploadDropzone.style.display = 'none';
              
              if (addImageButton) {
                addImageButton.disabled = imageTitle.value.trim() === '';
              }
              
              // バックエンドに画像データを送信
              vscode.postMessage({
                command: 'saveImage',
                imageData: e.target.result
              });
            }
          };
          
          reader.readAsDataURL(file);
        }
      }
      
      // 画像タイトル入力監視
      if (imageTitle) {
        imageTitle.addEventListener('input', () => {
          if (addImageButton) {
            addImageButton.disabled = imageTitle.value.trim() === '';
          }
        });
      }
      
      // 画像削除処理
      if (removeImageButton) {
        removeImageButton.addEventListener('click', () => {
          if (previewContainer && uploadDropzone) {
            previewContainer.style.display = 'none';
            uploadDropzone.style.display = 'block';
            if (previewImage) {
              previewImage.src = '';
            }
            if (addImageButton) {
              addImageButton.disabled = true;
            }
          }
        });
      }
      
      // 画像追加処理
      if (addImageButton) {
        addImageButton.addEventListener('click', () => {
          if (!imageTitle || !imageTitle.value.trim()) {
            vscode.postMessage({
              command: 'showError',
              message: '画像タイトルを入力してください'
            });
            return;
          }
          
          vscode.postMessage({
            command: 'addImageReference',
            title: imageTitle.value,
            type: 'screenshot'
          });
          
          // 入力をクリア
          if (previewContainer && uploadDropzone) {
            previewContainer.style.display = 'none';
            uploadDropzone.style.display = 'block';
            if (previewImage) {
              previewImage.src = '';
            }
            if (imageTitle) {
              imageTitle.value = '';
            }
            if (addImageButton) {
              addImageButton.disabled = true;
            }
          }
          
          // 履歴に追加 (仮実装)
          const historyElement = document.querySelector('.reference-history');
          const emptyNotice = historyElement.querySelector('.history-empty');
          
          if (emptyNotice) {
            emptyNotice.remove();
          }
          
          const now = new Date();
          const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          historyElement.insertAdjacentHTML('beforeend', `
            <div class="history-item">
              <div class="history-icon">📷</div>
              <div class="history-details">
                <div class="history-name">${imageTitle.value}</div>
                <div class="history-meta">
                  <span class="history-time">${timeStr}</span>
                  <span class="history-type">画像</span>
                </div>
              </div>
            </div>
          `);
        });
      }
      
      // 画像フォームクリア
      if (clearImageButton) {
        clearImageButton.addEventListener('click', () => {
          if (previewContainer && uploadDropzone) {
            previewContainer.style.display = 'none';
            uploadDropzone.style.display = 'block';
            if (previewImage) {
              previewImage.src = '';
            }
            if (imageTitle) {
              imageTitle.value = '';
            }
            if (addImageButton) {
              addImageButton.disabled = true;
            }
          }
        });
      }
    } catch (error) {
      console.error('リファレンスマネージャーの表示中にエラーが発生しました:', error);
      recentFilesElement.innerHTML = `
        <div class="recent-files-header">
          <h2><i class="icon">📚</i> リファレンスマネージャー</h2>
        </div>
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 表示エラー</h2>
          <p>リファレンスマネージャーを表示できませんでした。</p>
        </div>
      `;
    }
  }
  
  /**
   * ファイルサイズを読みやすい形式にフォーマット
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  }
  
  /**
   * アップロードタイプごとのアイコンを取得
   */
  function getTypeIcon(type) {
    switch(type) {
      case 'ui': return '<i class="icon">🎨</i>';
      case 'code': return '<i class="icon">📜</i>';
      case 'docs': return '<i class="icon">📄</i>';
      default: return '<i class="icon">📁</i>';
    }
  }
  
  /**
   * アップロードタイプの名前を取得
   */
  function getTypeName(type) {
    switch(type) {
      case 'ui': return 'UIデザイン';
      case 'code': return 'サンプルコード';
      case 'docs': return '仕様書';
      default: return 'その他';
    }
  }
  
  /**
   * ファイルタイプに応じたアイコンを取得
   */
  function getFileIcon(fileType) {
    const icon = FILE_TYPE_ICONS[fileType.toLowerCase()] || FILE_TYPE_ICONS.default;
    return icon;
  }
  
  /**
   * プロセスステップのイベントハンドラ設定
   */
  function setupProcessStepHandlers() {
    // 計画プロセスのステップハンドラ
    document.querySelectorAll('.process-step').forEach(step => {
      // ステップ番号を白色に強制
      const stepNumber = step.querySelector('.step-number');
      if (stepNumber) {
        stepNumber.style.color = "white !important";
        stepNumber.setAttribute('style', 'color: white !important');
      }
      
      // ステップボタンのテキストを白色に強制
      const stepAction = step.querySelector('.step-action');
      if (stepAction) {
        stepAction.style.color = "white !important";
        stepAction.setAttribute('style', 'color: white !important');
      }
      
      // 開くボタンのテキストを白色に強制
      const openButton = step.querySelector('.open-button');
      if (openButton) {
        openButton.style.color = "white !important";
        openButton.setAttribute('style', 'color: white !important');
      }
      
      step.addEventListener('click', (event) => {
        event.preventDefault();
        
        // disabled状態のステップはクリック無効
        if (step.classList.contains('disabled')) {
          return;
        }
        
        const command = step.getAttribute('data-command');
        if (command) {
          console.log(`コマンドを実行します: ${command}`);
          
          // すべてのパネルを同じ方法で処理 (特別処理を削除)
          
          // VSCodeにメッセージを送信
          // VSCode側で登録されているコマンドIDを使用
          if (command === 'openRequirementsEditor') {
            console.log('要件定義エディタを開きます');
            // 直接VSCodeコマンドを実行（登録済みのコマンドIDを使用）
            vscode.postMessage({
              command: 'openRequirementsEditor'
            });
          } else {
            vscode.postMessage({
              command: command
            });
          }
        }
      });
    });
    
    // 青背景エリアの文字色を確実に白にするためのCSSルールを追加
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .header h1, 
      .header-actions button,
      .header-actions button span,
      .step-number, 
      .step-action,
      .project-buttons button,
      .project-buttons button span,
      .open-button {
        color: white !important;
      }
    `;
    document.head.appendChild(styleElement);
    
    // すべてのボタン内のspanタグに白色を適用
    document.querySelectorAll('.project-buttons button span, .header-actions button span').forEach(span => {
      span.style.color = "white";
      span.setAttribute('style', 'color: white !important');
    });
  }
  
  /**
   * 情報メッセージを表示する簡易関数
   */
  function showInfo(message) {
    console.log(`Info: ${message}`);
    // VSCodeに通知を送信
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'info',
      message
    });
  }
  
  /**
   * 新規プロジェクトモーダルを表示
   */
  function showNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) modal.style.display = 'flex';
    
    // フォームをリセット
    const form = document.getElementById('new-project-form');
    if (form) form.reset();
    
    // 名前フィールドにフォーカス
    const projectName = document.getElementById('project-name');
    if (projectName) projectName.focus();
  }
  
  /**
   * 新規プロジェクトモーダルを非表示
   */
  function hideNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal) modal.style.display = 'none';
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
   */
  function openProject(id) {
    vscode.postMessage({
      command: 'openProject',
      id
    });
    
    updateLoadingState(true);
    
    // 初回のプロジェクト開封時、オンボーディングフラグを設定
    // これにより、プロジェクト開封後にステップバイステップガイドが表示される
    if (!state.onboardingCompleted) {
      state.onboardingStarted = true;
      saveState();
      
      // プロジェクト読み込み完了後に実行するために少し遅延
      setTimeout(() => {
        // 読み込みが完了した場合のみガイドを表示
        if (!state.loading) {
          startOnboardingFlow();
        } else {
          // まだロード中なら、完了後にガイドを表示するように別のタイマーをセット
          const checkLoadingInterval = setInterval(() => {
            if (!state.loading) {
              startOnboardingFlow();
              clearInterval(checkLoadingInterval);
            }
          }, 500);
        }
      }, 1500);
    }
  }
  
  /**
   * オンボーディングフローを開始
   */
  function startOnboardingFlow() {
    // プロセスマップが表示されたら、各ステップへのガイドを表示
    if (!document.getElementById('requirements-step')) {
      // プロセスマップがまだレンダリングされていない場合は後で再試行
      setTimeout(startOnboardingFlow, 500);
      return;
    }
    
    // 要件定義ステップを強調
    const requirementsStep = document.getElementById('requirements-step');
    if (requirementsStep) {
      // 要件定義ステップにヒントを表示
      addTutorialHint(
        'requirements-step',
        'まずは要件定義から始めましょう。AIがアプリの機能を整理するお手伝いをします。',
        'bottom'
      );
      
      // ヒント表示後、要件定義ステップにハイライトエフェクトを追加
      requirementsStep.classList.add('highlight');
      
      // スクロールして要件定義ステップを表示
      requirementsStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // オンボーディング完了フラグを設定
      state.onboardingCompleted = true;
      saveState();
    }
  }
  
  /**
   * プロジェクトを削除
   */
  function deleteProject(id) {
    // 確認ダイアログはconfirm()を使わずにVSCode APIで処理
    const projectName = state.projects.find(p => p.id === id)?.name || 'プロジェクト';
    
    // 確認メッセージをバックエンドに送信
    vscode.postMessage({
      command: 'confirmDeleteProject',
      id,
      projectName
    });
    
    // バックエンド側で確認ダイアログを表示し、結果に応じて削除処理を行う
    // メッセージハンドラはextension.tsで処理
  }
  
  /**
   * プロジェクトパス編集モーダルを表示
   */
  function showEditPathModal(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    // モーダル要素の作成
    const modal = document.createElement('div');
    modal.id = 'edit-path-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    // モーダルの内容を設定
    modal.innerHTML = `
      <div class="modal-content">
        <h2>プロジェクトパスの編集</h2>
        <form id="edit-path-form">
          <div class="form-group">
            <label for="project-path">プロジェクトパス <span style="color: #e74c3c;">*</span></label>
            <input type="text" id="project-path" value="${escapeHtml(project.path || '')}" required placeholder="/path/to/your/project">
            <p class="help-text" style="font-size: 0.8rem; color: #718096; margin-top: 0.3rem;">フォルダが移動または名前変更された場合に更新してください</p>
          </div>
          <div class="form-actions">
            <button type="button" class="button secondary" id="cancel-edit-path">キャンセル</button>
            <button type="submit" class="button primary">更新</button>
          </div>
        </form>
      </div>
    `;
    
    // モーダルをDOMに追加
    document.body.appendChild(modal);
    
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
      document.body.removeChild(modal);
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
    errorDiv.innerHTML = `<i class="icon">⚠️</i> ${escapeHtml(message)}`;
    
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