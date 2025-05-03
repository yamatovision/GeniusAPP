// @ts-check
import stateManager from '../../state/stateManager.js';

class ProjectNavigation {
  constructor() {
    this.projectList = document.getElementById('project-list');
    this.toggleNavBtn = document.getElementById('toggle-nav-btn');
    this.projectNav = document.querySelector('.project-nav');
    this.newProjectBtn = document.getElementById('new-project-btn');
    this.loadProjectBtn = document.getElementById('load-project-btn');
    this.searchInput = document.querySelector('.search-input');
    this.projectDisplayName = document.querySelector('.project-display .project-name');
    this.projectPathElement = document.querySelector('.project-path-display');
    
    // VSCode APIを取得
    this.vscode = window.vsCodeApi;
    
    this.initialize();
  }
  
  initialize() {
    // ナビゲーションの開閉ボタン
    if (this.toggleNavBtn) {
      this.toggleNavBtn.addEventListener('click', () => this.toggleNavigation());
    }
    
    // 新規プロジェクト作成ボタン
    if (this.newProjectBtn) {
      this.newProjectBtn.addEventListener('click', () => this.showNewProjectModal());
    }
    
    // 既存プロジェクト読み込みボタン
    if (this.loadProjectBtn) {
      this.loadProjectBtn.addEventListener('click', () => this.loadExistingProject());
    }
    
    // 検索フィルタリング
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.filterProjects(e.target.value));
    }
    
    // 保存された状態から復元
    const state = stateManager.getState();
    if (state.isNavCollapsed) {
      this.collapseNavigation();
    }
    
    // プロジェクト名更新イベントリスナーを設定
    document.addEventListener('project-name-updated', (event) => {
      this.updateProjectName(event.detail.name);
    });
    
    // プロジェクトパス更新イベントリスナーを設定
    document.addEventListener('project-path-updated', (event) => {
      this.updateProjectPath(event.detail);
    });
    
    console.log('ProjectNavigation initialized');
  }
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブプロジェクト
   */
  updateProjects(projects, activeProject) {
    if (!this.projectList) return;
    
    // リストをクリア
    this.projectList.innerHTML = '';
    
    if (!projects || projects.length === 0) {
      this.projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // 各プロジェクトをリストに追加
    projects.forEach(project => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      if (activeProject && project.id === activeProject.id) {
        projectItem.classList.add('active');
      }
      
      projectItem.innerHTML = `
        <div class="project-item-name">${project.name}</div>
        <div class="project-item-path">${project.path}</div>
      `;
      
      // クリックイベント
      projectItem.addEventListener('click', () => {
        this.selectProject(project);
      });
      
      // コンテキストメニュー
      projectItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showProjectContextMenu(e, project);
      });
      
      this.projectList.appendChild(projectItem);
    });
  }
  
  /**
   * プロジェクト選択
   * @param {Object} project プロジェクト情報
   */
  selectProject(project) {
    stateManager.sendMessage('selectProject', {
      projectName: project.name,
      projectPath: project.path
    });
  }
  
  /**
   * プロジェクト一覧のフィルタリング
   * @param {string} query 検索文字列
   */
  filterProjects(query) {
    const items = this.projectList.querySelectorAll('.project-item');
    const lowerCaseQuery = query.toLowerCase();
    
    items.forEach(item => {
      const name = item.querySelector('.project-item-name')?.textContent || '';
      const path = item.querySelector('.project-item-path')?.textContent || '';
      
      if (name.toLowerCase().includes(lowerCaseQuery) || 
          path.toLowerCase().includes(lowerCaseQuery)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  /**
   * ナビゲーションの開閉
   */
  toggleNavigation() {
    if (!this.projectNav) return;
    
    if (this.projectNav.classList.contains('collapsed')) {
      this.expandNavigation();
    } else {
      this.collapseNavigation();
    }
  }
  
  /**
   * ナビゲーションを開く
   */
  expandNavigation() {
    if (!this.projectNav) return;
    
    this.projectNav.classList.remove('collapsed');
    document.querySelector('.content-area')?.classList.remove('expanded');
    stateManager.setState({ isNavCollapsed: false });
  }
  
  /**
   * ナビゲーションを閉じる
   */
  collapseNavigation() {
    if (!this.projectNav) return;
    
    this.projectNav.classList.add('collapsed');
    document.querySelector('.content-area')?.classList.add('expanded');
    stateManager.setState({ isNavCollapsed: true });
  }
  
  /**
   * 新規プロジェクトモーダルを表示
   */
  showNewProjectModal() {
    stateManager.sendMessage('showNewProjectModal');
  }
  
  /**
   * 既存プロジェクト読み込み
   */
  loadExistingProject() {
    stateManager.sendMessage('loadExistingProject');
  }
  
  /**
   * プロジェクトのコンテキストメニュー表示
   */
  showProjectContextMenu(event, project) {
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.position = 'absolute';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.backgroundColor = 'white';
    contextMenu.style.border = '1px solid #ccc';
    contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    contextMenu.style.zIndex = '1000';
    
    // メニュー項目
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="open">開く</div>
      <div class="context-menu-item" data-action="rename">名前変更</div>
      <div class="context-menu-item" data-action="remove">削除</div>
    `;
    
    // メニュー項目のイベント
    contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        this.handleContextMenuAction(action, project);
        document.body.removeChild(contextMenu);
      });
    });
    
    // 任意の場所をクリックしたらメニューを閉じる
    document.addEventListener('click', function closeMenu() {
      if (document.body.contains(contextMenu)) {
        document.body.removeChild(contextMenu);
      }
      document.removeEventListener('click', closeMenu);
    });
    
    // コンテキストメニューを表示
    document.body.appendChild(contextMenu);
  }
  
  /**
   * コンテキストメニューアクション処理
   */
  handleContextMenuAction(action, project) {
    switch (action) {
      case 'open':
        this.selectProject(project);
        break;
      case 'rename':
        // 名前変更ダイアログ表示
        break;
      case 'remove':
        stateManager.sendMessage('removeProject', {
          projectName: project.name,
          projectPath: project.path,
          projectId: project.id
        });
        break;
    }
  }
  
  /**
   * アクティブプロジェクトを更新
   */
  updateActiveProject(project) {
    const items = this.projectList.querySelectorAll('.project-item');
    
    items.forEach(item => {
      const name = item.querySelector('.project-item-name')?.textContent;
      const path = item.querySelector('.project-item-path')?.textContent;
      
      if (name === project.name && path === project.path) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
  
  /**
   * プロジェクト名を更新
   * @param {string} projectName プロジェクト名
   */
  updateProjectName(projectName) {
    console.log(`projectNavigation: プロジェクト名を更新: ${projectName}`);
    
    // 状態保存のため、現在表示中のプロジェクト名を記録
    const state = stateManager.getState();
    
    // 同じプロジェクト名が既に表示されている場合は変更しない
    if (state.currentDisplayedProject === projectName) {
      console.log(`projectNavigation: プロジェクト名は既に更新済み: ${projectName}`);
      return;
    }
    
    // プロジェクト名をヘッダーに更新
    if (this.projectDisplayName) {
      console.log(`projectNavigation: プロジェクト名要素を更新: ${projectName}`);
      this.projectDisplayName.textContent = projectName;
      
      // 現在表示中のプロジェクト名を記録
      state.currentDisplayedProject = projectName;
      stateManager.setState(state);
    } else {
      console.warn('projectNavigation: プロジェクト名表示要素が見つかりません: .project-display .project-name');
    }
  }
  
  /**
   * プロジェクトパスを更新
   * @param {Object} data プロジェクトパス情報
   */
  updateProjectPath(data) {
    console.log(`projectNavigation: プロジェクトパス更新:`, data.projectPath);
    
    // プロジェクト情報の更新
    if (data.projectPath) {
      // パスから最後のディレクトリ名を取得（プロジェクト名自動設定用）
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      
      // プロジェクト表示部分を更新
      if (this.projectDisplayName && (!data.projectName || data.autoSetName)) {
        this.updateProjectName(projectName || 'プロジェクト');
      }
      
      // パス表示を更新
      if (this.projectPathElement) {
        this.projectPathElement.textContent = data.projectPath || '/path/to/project';
      }
    }
    
    // CURRENT_STATUS.mdファイルの存在をチェック
    if (data.statusFilePath && data.statusFileExists) {
      console.log('projectNavigation: CURRENT_STATUS.mdファイルが存在します:', data.statusFilePath);
      
      // ファイルが存在する場合はマークダウンコンテンツを取得するリクエストを送信
      this.vscode.postMessage({
        command: 'getMarkdownContent',
        filePath: data.statusFilePath
      });
    }
    
    // forceRefreshフラグがtrueの場合は、強制的に初期化メッセージを送信
    if (data.forceRefresh) {
      console.log('projectNavigation: プロジェクトパスが変更されました - 強制更新のためサーバーに初期化メッセージを送信します');
      
      // 状態を完全にリセット
      const resetState = {
        directoryStructure: ''
      };
      
      // 状態リセット
      console.log('projectNavigation: 状態を完全にリセットします:', resetState);
      this.vscode.setState(resetState);
      
      // 初期化メッセージの送信（新しいプロジェクトデータを取得するためのリクエスト）
      setTimeout(() => {
        console.log('projectNavigation: 初期化メッセージを送信します');
        this.vscode.postMessage({ command: 'initialize' });
      }, 300);
    }
  }
}

// 初期化して公開
const projectNavigation = new ProjectNavigation();
export default projectNavigation;