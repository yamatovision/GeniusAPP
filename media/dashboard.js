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
      const createdDate = new Date(project.createdAt || Date.now()).toLocaleDateString();
      const updatedDate = new Date(project.updatedAt || Date.now()).toLocaleDateString();
      
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
  
  // renderOverallProgress関数を削除
  
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
   * リファレンスアップローダーを表示
   */
  function renderRecentFiles() {
    const recentFilesElement = document.getElementById('recent-files');
    if (!recentFilesElement || !state.activeProject) return;
    
    try {
      const projectPath = state.activeProject.path || '';
      
      const referenceUploaderHtml = `
        <div class="recent-files-header">
          <h2><i class="icon">📚</i> リファレンスアップローダー</h2>
        </div>
        <div class="reference-uploader">
          <div class="uploader-description">
            <p>外部のリファレンス資料やサンプルをアップロードして、AIが参考にできるようにします。</p>
            <p>UIデザイン、技術仕様書、サンプルコードなどが利用できます。</p>
          </div>
          
          <div class="upload-controls">
            <div class="upload-types">
              <div class="upload-type-item active" data-type="ui">
                <i class="icon">🎨</i>
                <span>UIデザイン</span>
              </div>
              <div class="upload-type-item" data-type="code">
                <i class="icon">📜</i>
                <span>サンプルコード</span>
              </div>
              <div class="upload-type-item" data-type="docs">
                <i class="icon">📄</i>
                <span>仕様書</span>
              </div>
            </div>
            
            <div class="upload-dropzone" id="upload-dropzone">
              <i class="icon large">📁</i>
              <p>ファイルをドラッグ＆ドロップ または クリックして選択</p>
              <input type="file" id="file-upload" style="display: none;" />
            </div>
            
            <button class="button primary upload-button" disabled>
              <i class="icon">⬆️</i> アップロード
            </button>
          </div>
          
          <div class="upload-history">
            <h3>最近のアップロード</h3>
            <div class="history-empty">
              <p>アップロード履歴がありません</p>
            </div>
          </div>
        </div>
      `;
      
      recentFilesElement.innerHTML = referenceUploaderHtml;
      
      // ドロップゾーンの処理を設定
      const dropzone = document.getElementById('upload-dropzone');
      const fileInput = document.getElementById('file-upload');
      const uploadButton = document.querySelector('.upload-button');
      
      if (dropzone && fileInput) {
        // ドロップゾーンクリックでファイル選択を開く
        dropzone.addEventListener('click', () => {
          fileInput.click();
        });
        
        // ファイル選択変更時の処理
        fileInput.addEventListener('change', () => {
          if (fileInput.files && fileInput.files.length > 0) {
            dropzone.classList.add('has-files');
            dropzone.innerHTML = `
              <i class="icon">📄</i>
              <p>${fileInput.files[0].name}</p>
              <span class="file-size">${formatFileSize(fileInput.files[0].size)}</span>
            `;
            uploadButton.disabled = false;
          }
        });
        
        // ドラッグ&ドロップイベント
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', () => {
          dropzone.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            fileInput.files = e.dataTransfer.files;
            
            dropzone.classList.add('has-files');
            dropzone.innerHTML = `
              <i class="icon">📄</i>
              <p>${file.name}</p>
              <span class="file-size">${formatFileSize(file.size)}</span>
            `;
            uploadButton.disabled = false;
          }
        });
        
        // アップロードタイプの切り替え
        document.querySelectorAll('.upload-type-item').forEach(item => {
          item.addEventListener('click', () => {
            document.querySelectorAll('.upload-type-item').forEach(i => {
              i.classList.remove('active');
            });
            item.classList.add('active');
          });
        });
        
        // アップロードボタンの処理
        uploadButton.addEventListener('click', () => {
          const activeType = document.querySelector('.upload-type-item.active').dataset.type;
          const file = fileInput.files[0];
          
          // 実際のアップロード処理の代わりに通知を表示
          vscode.postMessage({
            command: 'showInfo',
            message: `${file.name} のアップロードを開始しました (${activeType}タイプ)`
          });
          
          // アップロードの仮実装
          dropzone.innerHTML = `
            <i class="icon large">📁</i>
            <p>ファイルをドラッグ＆ドロップ または クリックして選択</p>
          `;
          dropzone.classList.remove('has-files');
          uploadButton.disabled = true;
          
          // 履歴に追加
          const historyElement = document.querySelector('.upload-history');
          const emptyNotice = historyElement.querySelector('.history-empty');
          
          if (emptyNotice) {
            emptyNotice.remove();
          }
          
          const now = new Date();
          const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          historyElement.insertAdjacentHTML('beforeend', `
            <div class="history-item">
              <div class="history-icon">${getTypeIcon(activeType)}</div>
              <div class="history-details">
                <div class="history-name">${file.name}</div>
                <div class="history-meta">
                  <span class="history-time">${timeStr}</span>
                  <span class="history-type">${getTypeName(activeType)}</span>
                </div>
              </div>
            </div>
          `);
        });
      }
    } catch (error) {
      console.error('リファレンスアップローダーの表示中にエラーが発生しました:', error);
      recentFilesElement.innerHTML = `
        <div class="recent-files-header">
          <h2><i class="icon">📚</i> リファレンスアップローダー</h2>
        </div>
        <div class="error-panel">
          <h2><i class="icon">⚠️</i> 表示エラー</h2>
          <p>アップロードインターフェースを表示できませんでした。</p>
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