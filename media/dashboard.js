// ダッシュボードのためのJavaScriptコード
// このコードは、VSCode拡張のWebViewで使用されます

(function() {
  // VS Code APIのアクセス
  const vscode = acquireVsCodeApi();
  
  // 状態を保持
  let state = {
    projects: [],
    activeProject: null,
    activeProjectDetails: null
  };
  
  // DOMが読み込まれた後に実行
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化処理
    initializeEventListeners();
    
    // プロジェクト一覧の更新をリクエスト
    vscode.postMessage({
      command: 'refreshProjects'
    });
  });
  
  // メッセージのハンドラーを登録
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateState':
        updateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
    }
  });
  
  // イベントリスナーの初期化
  function initializeEventListeners() {
    // 新規プロジェクトボタン
    document.getElementById('new-project-btn').addEventListener('click', () => {
      showNewProjectModal();
    });
    
    // 新規プロジェクトフォーム
    document.getElementById('new-project-form').addEventListener('submit', event => {
      event.preventDefault();
      createNewProject();
    });
    
    // モーダルキャンセルボタン
    document.getElementById('cancel-new-project').addEventListener('click', () => {
      hideNewProjectModal();
    });
    
    // ツールボタン
    document.getElementById('requirements-editor').querySelector('button').addEventListener('click', () => {
      vscode.postMessage({
        command: 'openRequirementsEditor'
      });
    });
    
    document.getElementById('mockup-designer').querySelector('button').addEventListener('click', () => {
      vscode.postMessage({
        command: 'openMockupDesigner'
      });
    });
    
    document.getElementById('implementation-selector').querySelector('button').addEventListener('click', () => {
      vscode.postMessage({
        command: 'openImplementationSelector'
      });
    });
    
    document.getElementById('development-assistant').querySelector('button').addEventListener('click', () => {
      vscode.postMessage({
        command: 'openDevelopmentAssistant'
      });
    });
    
    // プロジェクトアクションボタン
    document.getElementById('analyze-project').addEventListener('click', () => {
      vscode.postMessage({
        command: 'analyzeProject'
      });
    });
  }
  
  // 状態の更新
  function updateState(newState) {
    state = { ...state, ...newState };
    renderProjects();
    renderActiveProject();
    updateToolsStatus();
  }
  
  // プロジェクト一覧のレンダリング
  function renderProjects() {
    const projectsContainer = document.getElementById('projects-container');
    projectsContainer.innerHTML = '';
    
    if (state.projects.length === 0) {
      projectsContainer.innerHTML = '<div class="no-projects">プロジェクトがありません</div>';
      return;
    }
    
    state.projects.forEach(project => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      
      if (state.activeProject && project.id === state.activeProject.id) {
        projectItem.classList.add('active');
      }
      
      const lastUpdated = new Date(project.updatedAt).toLocaleString();
      
      projectItem.innerHTML = `
        <div class="project-header">
          <h3>${project.name}</h3>
          <div class="project-actions">
            <button class="icon-button delete-project" data-id="${project.id}" title="削除">🗑️</button>
          </div>
        </div>
        <p class="project-description">${project.description || '説明なし'}</p>
        <p class="project-updated">最終更新: ${lastUpdated}</p>
      `;
      
      projectItem.addEventListener('click', event => {
        // 削除ボタンのクリックは伝播させない
        if (event.target.classList.contains('delete-project')) {
          event.stopPropagation();
          deleteProject(project.id);
          return;
        }
        
        openProject(project.id);
      });
      
      projectsContainer.appendChild(projectItem);
    });
    
    // 削除ボタンのイベントリスナー
    document.querySelectorAll('.delete-project').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        deleteProject(button.dataset.id);
      });
    });
  }
  
  // アクティブなプロジェクトの詳細表示
  function renderActiveProject() {
    const activeProjectPanel = document.getElementById('active-project-panel');
    
    if (!state.activeProject) {
      activeProjectPanel.innerHTML = `
        <div class="no-active-project">
          <h2>プロジェクトを選択してください</h2>
          <p>左側のリストからプロジェクトを選択するか、新しいプロジェクトを作成してください。</p>
        </div>
      `;
      return;
    }
    
    const project = state.activeProject;
    const details = state.activeProjectDetails || {};
    const createdDate = new Date(project.createdAt).toLocaleDateString();
    const updatedDate = new Date(project.updatedAt).toLocaleDateString();
    
    const completedPhases = Object.entries(project.phases)
      .filter(([_, isCompleted]) => isCompleted)
      .length;
    const totalPhases = Object.keys(project.phases).length;
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
    if (mockupCount > 0) {
      detailsSection += `
        <div class="detail-section">
          <h3>モックアップ</h3>
          <p class="stat-value">${mockupCount} 個のモックアップ</p>
        </div>
      `;
    }
    
    // 実装スコープ情報
    if (scopeItemCount > 0) {
      detailsSection += `
        <div class="detail-section">
          <h3>実装スコープ</h3>
          <p class="stat-value">${scopeItemCount} 個の実装項目</p>
          <div class="scope-stats">
            <div class="stat-item">
              <span class="stat-label">実装中</span>
              <span class="stat-value">${inProgressItems}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">完了</span>
              <span class="stat-value">${completedItems}</span>
            </div>
          </div>
          <div class="scope-progress">
            <div class="progress-label">実装進捗: ${implementationProgress}%</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${implementationProgress}%"></div>
            </div>
          </div>
        </div>
      `;
    }
    
    activeProjectPanel.innerHTML = `
      <div class="project-details">
        <h2>${project.name}</h2>
        <p class="project-path">${project.path || '未設定'}</p>
        <p class="project-dates">作成日: ${createdDate} | 更新日: ${updatedDate}</p>
        
        <div class="project-description-panel">
          <h3>プロジェクト説明</h3>
          <p>${project.description || '説明はありません'}</p>
        </div>
        
        <div class="project-progress">
          <h3>進捗状況</h3>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
          </div>
          <p>${completedPhases}/${totalPhases} フェーズ完了 (${progressPercentage}%)</p>
          
          <div class="phases-list">
            ${renderPhasesList(project.phases)}
          </div>
        </div>
        
        ${detailsSection}
      </div>
    `;
  }
  
  // フェーズリストのレンダリング
  function renderPhasesList(phases) {
    return Object.entries(phases)
      .map(([phase, isCompleted]) => {
        const phaseNames = {
          requirements: '要件定義',
          design: 'デザイン',
          implementation: '実装',
          testing: 'テスト',
          deployment: 'デプロイ'
        };
        
        const phaseName = phaseNames[phase] || phase;
        const statusClass = isCompleted ? 'completed' : 'pending';
        const statusIcon = isCompleted ? '✓' : '○';
        
        return `
          <div class="phase-item ${statusClass}">
            <span class="phase-status">${statusIcon}</span>
            <span class="phase-name">${phaseName}</span>
          </div>
        `;
      })
      .join('');
  }
  
  // ツールパネルの状態更新
  function updateToolsStatus() {
    const hasActiveProject = !!state.activeProject;
    const toolButtons = document.querySelectorAll('.tool-card button');
    
    toolButtons.forEach(button => {
      button.disabled = !hasActiveProject;
    });
    
    document.getElementById('analyze-project').disabled = !hasActiveProject;
    document.getElementById('export-project').disabled = !hasActiveProject;
    document.getElementById('project-settings').disabled = !hasActiveProject;
  }
  
  // 新規プロジェクトモーダルを表示
  function showNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    modal.style.display = 'flex';
    
    // フォームをリセット
    document.getElementById('new-project-form').reset();
    
    // 名前フィールドにフォーカス
    document.getElementById('project-name').focus();
  }
  
  // 新規プロジェクトモーダルを非表示
  function hideNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    modal.style.display = 'none';
  }
  
  // 新規プロジェクト作成処理
  function createNewProject() {
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-description').value.trim();
    
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
  }
  
  // プロジェクトを開く
  function openProject(id) {
    vscode.postMessage({
      command: 'openProject',
      id
    });
  }
  
  // プロジェクトを削除
  function deleteProject(id) {
    // VSCodeのネイティブUIを使用
    vscode.postMessage({
      command: 'deleteProject',
      id
    });
  }
  
  // エラーメッセージ表示
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
})();