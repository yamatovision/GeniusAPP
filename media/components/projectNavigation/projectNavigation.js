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
}

// 初期化して公開
const projectNavigation = new ProjectNavigation();
export default projectNavigation;