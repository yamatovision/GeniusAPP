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
    sidebarCollapsed: false
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
    
    // リフレッシュボタン
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshData();
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
   * UI初期化
   */
  function initializeUI() {
    // サイドバーの初期状態を設定
    updateSidebarState();
    
    // テーマ関連のクラスを追加
    const isDarkTheme = document.body.classList.contains('vscode-dark');
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }
  
  /**
   * データ更新
   */
  function refreshData() {
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
      const overallProgress = document.getElementById('overall-progress');
      const processWrapper = document.getElementById('process-wrapper');
      
      if (overallProgress) overallProgress.style.display = 'block';
      if (processWrapper) processWrapper.style.display = 'block';
      
      // プロセスステップのイベントハンドラを設定
      setupProcessStepHandlers();
    } else {
      const overallProgress = document.getElementById('overall-progress');
      const processWrapper = document.getElementById('process-wrapper');
      
      if (overallProgress) overallProgress.style.display = 'none';
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
              <button class="icon-button delete-project" data-id="${project.id}" title="削除">🗑️</button>
            </div>
          </div>
          <p class="project-description">${escapeHtml(project.description || '説明なし')}</p>
          <p class="project-updated">最終更新: ${lastUpdated}</p>
        </div>
      `;
    });
    
    projectsContainer.innerHTML = projectsHtml;
    
    // プロジェクト項目のクリックイベント
    document.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', event => {
        // 削除ボタンのクリックは伝播させない
        if (event.target.classList.contains('delete-project')) {
          event.stopPropagation();
          deleteProject(event.target.dataset.id);
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
        <div id="overall-progress" class="overall-progress" style="display: none;"></div>
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
      activeProjectPanel.innerHTML = `
        <div class="no-active-project">
          <h2>プロジェクトを選択してください</h2>
          <p>左側のリストからプロジェクトを選択するか、新しいプロジェクトを作成してください。</p>
        </div>
      `;
      return;
    }
    
    try {
      const project = state.activeProject;
      const details = state.activeProjectDetails || {};
      const createdDate = new Date(project.createdAt || Date.now()).toLocaleDateString();
      const updatedDate = new Date(project.updatedAt || Date.now()).toLocaleDateString();
      
      // フェーズの完了状況を計算 (プロジェクトフェーズがない場合の対応)
      const phases = project.phases || { requirements: false, design: false, implementation: false, testing: false, deployment: false };
      const completedPhases = Object.entries(phases)
        .filter(([_, isCompleted]) => isCompleted)
        .length;
      const totalPhases = Object.keys(phases).length || 5; // 最低でも5フェーズ
      const progressPercentage = Math.round((completedPhases / totalPhases) * 100);
      
      // 実装スコープの進捗状況
      const implementationProgress = details.implementationProgress || 0;
      const scopeItemCount = details.scopeItemCount || 0;
      const inProgressItems = details.inProgressItems || 0;
      const completedItems = details.completedItems || 0;
      const mockupCount = details.mockupCount || 0;
      
      // 追加の詳細情報
      let detailsSection = '';
      
      // モックアップ情報
      detailsSection += `
        <div class="detail-section">
          <h3><i class="icon">🎨</i> モックアップ</h3>
          <p class="stat-value">${mockupCount} 個のモックアップ</p>
        </div>
      `;
      
      // 実装スコープ情報
      detailsSection += `
        <div class="detail-section">
          <h3><i class="icon">📋</i> 実装スコープ</h3>
          <p class="stat-value">${scopeItemCount} 個の実装項目</p>
          <div class="scope-stats">
            <div class="stat-item">
              <i class="icon">🔄</i>
              <span class="stat-label">実装中</span>
              <span class="stat-value">${inProgressItems}</span>
            </div>
            <div class="stat-item">
              <i class="icon">✅</i>
              <span class="stat-label">完了</span>
              <span class="stat-value">${completedItems}</span>
            </div>
          </div>
          <div class="scope-progress">
            <div class="progress-info">
              <span>実装進捗: ${implementationProgress}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${implementationProgress}%"></div>
            </div>
          </div>
        </div>
      `;
      
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
          
          <div class="project-description-panel">
            <h3><i class="icon">📝</i> プロジェクト説明</h3>
            <p>${escapeHtml(project.description || '説明はありません')}</p>
          </div>
          
          <div class="project-progress">
            <h3><i class="icon">📊</i> 進捗状況</h3>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progressPercentage}%"></div>
            </div>
            <div class="progress-info">
              <span>${completedPhases}/${totalPhases} フェーズ完了</span>
              <span>${progressPercentage}%</span>
            </div>
          </div>
          
          ${detailsSection}
        </div>
      `;
      
      // 関連セクションを表示
      const overallProgress = document.getElementById('overall-progress');
      const processWrapper = document.getElementById('process-wrapper');
      
      if (overallProgress) overallProgress.style.display = 'block';
      if (processWrapper) processWrapper.style.display = 'block';
      
      // 全体の進捗状況も更新
      renderOverallProgress();
      
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
   * 全体の進捗状況を描画
   */
  function renderOverallProgress() {
    const overallProgress = document.getElementById('overall-progress');
    if (!overallProgress || !state.activeProject) return;
    
    try {
      const project = state.activeProject;
      const details = state.activeProjectDetails || {};
      
      // phase情報の安全な取得
      const phases = project.phases || { requirements: false, design: false, implementation: false, testing: false, deployment: false };
      
      // 進捗率を計算
      let totalProgress = 0;
      let totalItems = 0;
      
      if (phases.requirements) { totalProgress += 100; totalItems += 1; }
      if (phases.design) { totalProgress += 100; totalItems += 1; }
      if (phases.implementation) { 
        totalProgress += details.implementationProgress || 0; 
        totalItems += 1; 
      }
      if (phases.testing) { totalProgress += 100; totalItems += 1; }
      if (phases.deployment) { totalProgress += 100; totalItems += 1; }
      
      // 合計がゼロの場合の対応
      if (totalItems === 0) {
        totalItems = 1;
        totalProgress = 0;
      }
      
      const overallPercentage = Math.round(totalProgress / totalItems);
      const fileCount = details.scopeItemCount ? `${details.completedItems || 0}/${details.scopeItemCount}` : '0/0';
      
      overallProgress.innerHTML = `
        <div class="overall-progress-header">
          <h2><i class="icon">📊</i> 開発達成率</h2>
          <div class="progress-percentage">${overallPercentage}%</div>
        </div>
        <div class="progress-bar-container overall">
          <div class="progress-bar" style="width: ${overallPercentage}%;"></div>
        </div>
        <div class="progress-stats">
          <div class="stat-item">
            <i class="icon">📄</i>
            <span class="stat-label">作成済みファイル</span>
            <span class="stat-value">${fileCount}</span>
          </div>
          <div class="stat-item">
            <i class="icon">🎨</i>
            <span class="stat-label">モックアップ</span>
            <span class="stat-value">${details.mockupCount || 0}</span>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('進捗状況の表示中にエラーが発生しました:', error);
      overallProgress.innerHTML = `
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 進捗状況の表示エラー</h2>
          <p>プロジェクトの進捗情報を取得できませんでした。</p>
        </div>
      `;
    }
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

          <a href="#" class="process-step ${phases.design ? 'completed' : (phases.requirements ? 'active' : '')} ${!phases.requirements ? 'disabled' : ''}" id="mockup-step" data-command="openMockupDesigner">
            <div class="step-number">2</div>
            <div class="step-icon">🎨</div>
            <div class="step-content">
              <div class="step-title">モックアップ</div>
              <div class="step-instruction">画面デザインのイメージを作成します</div>
            </div>
            ${phases.design ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step ${phases.implementation ? 'completed' : (phases.design ? 'active' : '')} ${!phases.design ? 'disabled' : ''}" id="scope-step" data-command="openImplementationSelector">
            <div class="step-number">3</div>
            <div class="step-icon">📋</div>
            <div class="step-content">
              <div class="step-title">スコープ設定</div>
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
          <a href="#" class="process-step ${implementationProgress > 0 ? 'active' : ''} ${!phases.design ? 'disabled' : ''}" id="implementation-step" data-command="openDevelopmentAssistant">
            <div class="step-number">4</div>
            <div class="step-icon">💻</div>
            <div class="step-content">
              <div class="step-title">実装</div>
              <div class="step-instruction">AIとチャットしながらコードを生成します</div>
            </div>
            ${implementationProgress >= 100 ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step ${phases.testing ? 'completed' : (implementationProgress >= 80 ? 'active' : '')} ${implementationProgress < 50 ? 'disabled' : ''}" id="testing-step" data-command="openApiManager">
            <div class="step-number">5</div>
            <div class="step-icon">🧪</div>
            <div class="step-content">
              <div class="step-title">テスト</div>
              <div class="step-instruction">テストスクリプトを作成し、動作を確認します</div>
            </div>
            ${phases.testing ? '<div class="step-check">✓</div>' : ''}
            <div class="step-action">開く</div>
          </a>

          <a href="#" class="process-step ${phases.deployment ? 'completed' : (phases.testing ? 'active' : '')} ${!phases.testing ? 'disabled' : ''}" id="deploy-step" data-command="openDeployManager">
            <div class="step-number">6</div>
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
   * 最近のファイル（仮データ）
   */
  function renderRecentFiles() {
    const recentFilesElement = document.getElementById('recent-files');
    if (!recentFilesElement || !state.activeProject) return;
    
    try {
      // プロジェクトパスを取得
      const projectPath = state.activeProject.path || '';
      
      // 標準的なドキュメントファイル
      const standardFiles = [
        { id: 1, name: "CLAUDE.md", type: "md", updated: "今日", path: projectPath ? `${projectPath}/CLAUDE.md` : "" },
        { id: 2, name: "requirements.md", type: "md", updated: "今日", path: projectPath ? `${projectPath}/docs/requirements.md` : "" },
        { id: 3, name: "structure.md", type: "md", updated: "今日", path: projectPath ? `${projectPath}/docs/structure.md` : "" },
        { id: 4, name: "scope.md", type: "md", updated: "今日", path: projectPath ? `${projectPath}/docs/scope.md` : "" }
      ];
      
      const recentFilesHtml = `
        <div class="recent-files-header">
          <h2><i class="icon">📑</i> プロジェクト重要ファイル</h2>
          <a href="#" class="view-all">すべて表示 <i class="icon">→</i></a>
        </div>
        <ul class="file-list">
          ${standardFiles.map(file => `
            <li class="file-item" data-file="${file.path || file.name}">
              <div class="file-icon">
                ${getFileIcon(file.type)}
              </div>
              <div class="file-info">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-meta">
                  <span class="file-date">${file.path ? '編集可能' : '未保存'}</span>
                  <span class="file-type">${file.type.toUpperCase()}</span>
                </div>
              </div>
              <button class="file-action" title="開く" ${!file.path ? 'disabled' : ''}>
                <i class="icon">↗️</i>
              </button>
            </li>
          `).join('')}
        </ul>
      `;
      
      recentFilesElement.innerHTML = recentFilesHtml;
      
      // ファイルアイテムにイベントリスナーを追加
      document.querySelectorAll('.file-item').forEach(item => {
        const filePath = item.dataset.file;
        
        // パスが空の場合はクリックを無効にする
        if (!filePath) {
          item.style.opacity = '0.7';
          item.style.cursor = 'default';
          return;
        }
        
        item.addEventListener('click', () => {
          // ファイルを開くリクエスト
          vscode.postMessage({
            command: 'openFile',
            fileName: filePath,
            projectId: state.activeProject.id
          });
        });
      });
      
      // ファイルアクションボタンにイベントリスナーを追加
      document.querySelectorAll('.file-action:not([disabled])').forEach(button => {
        button.addEventListener('click', event => {
          event.stopPropagation();
          const filePath = event.target.closest('.file-item').dataset.file;
          
          // パスが空の場合は何もしない
          if (!filePath) return;
          
          // ファイルを開くリクエスト
          vscode.postMessage({
            command: 'openFile',
            fileName: filePath,
            projectId: state.activeProject.id
          });
        });
      });
    } catch (error) {
      console.error('ファイル一覧の表示中にエラーが発生しました:', error);
      recentFilesElement.innerHTML = `
        <div class="recent-files-header">
          <h2><i class="icon">📑</i> プロジェクト重要ファイル</h2>
        </div>
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 表示エラー</h2>
          <p>ファイル一覧を取得できませんでした。</p>
        </div>
      `;
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
      step.addEventListener('click', (event) => {
        event.preventDefault();
        
        // disabled状態のステップはクリック無効
        if (step.classList.contains('disabled')) {
          return;
        }
        
        const command = step.getAttribute('data-command');
        if (command) {
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
    const descriptionEl = document.getElementById('project-description');
    
    if (!nameEl || !descriptionEl) return;
    
    const name = nameEl.value.trim();
    const description = descriptionEl.value.trim();
    
    if (!name) {
      showError('プロジェクト名を入力してください');
      return;
    }
    
    vscode.postMessage({
      command: 'createProject',
      name,
      description
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
  }
  
  /**
   * プロジェクトを削除
   */
  function deleteProject(id) {
    // 確認ダイアログを表示
    const projectName = state.projects.find(p => p.id === id)?.name || 'プロジェクト';
    
    if (confirm(`${projectName} を削除します。この操作は元に戻せません。\n\n削除しますか？`)) {
      vscode.postMessage({
        command: 'deleteProject',
        id
      });
      
      updateLoadingState(true);
    }
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