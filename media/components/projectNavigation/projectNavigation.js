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
    
    // プロジェクト一覧更新イベントリスナーを設定
    document.addEventListener('projects-updated', (event) => {
      this.updateProjects(event.detail.projects, event.detail.activeProject);
    });
    
    console.log('ProjectNavigation initialized');
  }
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブプロジェクト
   */
  updateProjects(projects, activeProject) {
    console.log('projectNavigation: プロジェクト一覧更新:', projects?.length, '件', 'アクティブプロジェクト:', activeProject?.name);
    
    if (!this.projectList) return;
    
    // アクティブプロジェクト情報を状態に保存（他のパネルから戻ってきた時のために）
    if (activeProject) {
      const state = stateManager.getState();
      state.activeProjectName = activeProject.name;
      state.activeProjectPath = activeProject.path;
      state.activeTab = activeProject.metadata?.activeTab || 'current-status';
      stateManager.setState(state);
    }
    
    // 既存のアクティブプロジェクトエリアがあれば削除
    const existingActiveArea = document.getElementById('active-project-area');
    if (existingActiveArea) {
      existingActiveArea.remove();
    }
    
    // 既存の他のプロジェクトラベルがあれば削除
    const existingLabel = document.getElementById('other-projects-label');
    if (existingLabel) {
      existingLabel.remove();
    }
    
    // リストをクリア
    this.projectList.innerHTML = '';
    
    // プロジェクトがない場合の表示
    if (!projects || projects.length === 0) {
      this.projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // ソート済みのプロジェクト配列を作成（アクティブプロジェクトを先頭に）
    let sortedProjects = [...projects];
    
    // プロジェクトを作成日時順にソートする（古いものから新しいものへ）
    sortedProjects.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // プロジェクトをリストに追加
    sortedProjects.forEach((project) => {
      const item = document.createElement('div');
      const isActive = activeProject && activeProject.id === project.id;
      
      // すべてのプロジェクトに同じスタイルを適用
      item.className = isActive ? 'project-item active' : 'project-item';
      
      // アクティブプロジェクトにはidを設定
      if (isActive) {
        item.id = 'active-project-item';
      }
      
      // プロジェクト表示名はパスの最後のディレクトリ名か設定されている名前を使用
      let displayName = project.name || '';
      if (!displayName && project.path) {
        // パスから抽出
        const pathParts = project.path.split(/[/\\]/);
        displayName = pathParts[pathParts.length - 1] || 'プロジェクト';
      }
      
      // すべてのプロジェクトで統一されたHTMLを使用
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div>
            <span class="project-name" ${isActive ? 'style="font-weight: 600;"' : ''}>${displayName}</span>
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
        
        // プロジェクト選択の進行中メッセージを表示
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = `
          <span class="material-icons" style="color: var(--app-warning);">hourglass_top</span>
          <span class="notification-text">プロジェクト「${displayName}」を読み込み中...</span>
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
        
        // 現在のアクティブタブIDを取得
        const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
        console.log('projectNavigation: 現在のアクティブタブ:', currentActiveTab);
        
        // 状態にプロジェクト情報を保存（他のパネルから戻ってきた時に復元するため）
        const state = stateManager.getState();
        state.activeProjectName = displayName;
        state.activeProjectPath = project.path;
        state.activeTab = currentActiveTab || 'current-status';
        
        // 手動でCURRENT_STATUS.mdのパスを設定して初期化信号を送信
        const statusFilePath = project.path ? `${project.path}/docs/CURRENT_STATUS.md` : '';
        state.statusFilePath = statusFilePath;
        
        stateManager.setState(state);
        
        // VSCodeにプロジェクト変更のメッセージを送信（アクティブタブ情報も送信）
        this.vscode.postMessage({
          command: 'selectProject',
          projectName: displayName,
          projectPath: project.path,
          activeTab: currentActiveTab,
          forceRefresh: true // 強制的にコンテンツをリロード
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
            this.vscode.postMessage({
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
      
      this.projectList.appendChild(item);
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
   * プロジェクトナビゲーションの初期化
   * 注：既にconstructorとinitialize()メソッドで実装されている基本機能に加えて、
   * 追加の初期化処理が必要な場合に使用します
   */
  initializeNavigation() {
    console.log('projectNavigation: ナビゲーションを初期化します');
    
    // トグルボタンのアイコン初期化
    if (this.toggleNavBtn) {
      const icon = this.toggleNavBtn.querySelector('.material-icons');
      
      if (this.projectNav && this.projectNav.classList.contains('collapsed')) {
        if (icon) icon.textContent = 'chevron_right';
      } else if (icon) {
        icon.textContent = 'chevron_left';
      }
    }
    
    // プロジェクトリスト初期化（ローディングメッセージ）
    if (this.projectList) {
      // すでにプロジェクトが読み込まれている場合は、ローディングメッセージを表示しない
      if (this.projectList.childElementCount === 0) {
        this.projectList.innerHTML = '<div class="project-item loading">プロジェクト一覧を読み込み中...</div>';
      }
    }
    
    // 初期化完了イベントを発信
    const event = new CustomEvent('project-navigation-initialized');
    document.dispatchEvent(event);
    
    return this;
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
    console.log('projectNavigation: 新規プロジェクトモーダル表示処理を開始します');
    
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
        cancelBtn.addEventListener('click', () => this.hideNewProjectModal());
      }
      
      const createBtn = document.getElementById('create-project-btn');
      if (createBtn) {
        createBtn.addEventListener('click', () => this.createNewProject());
      }
      
      // 名前フィールドにフォーカス
      const projectNameInput = document.getElementById('project-name');
      if (projectNameInput) {
        projectNameInput.focus();
      }
      
    } catch (e) {
      console.error('モーダル表示処理中にエラーが発生しました', e);
    }
  }
  
  /**
   * 新規プロジェクトモーダルを非表示
   */
  hideNewProjectModal() {
    console.log('projectNavigation: モーダルを非表示にします');
    const modal = document.getElementById('new-project-modal');
    if (modal) {
      modal.remove();
    }
  }
  
  /**
   * 新規プロジェクト作成処理
   */
  createNewProject() {
    console.log('projectNavigation: 新規プロジェクト作成処理を開始します');
    const nameEl = document.getElementById('project-name');
    
    if (!nameEl) {
      console.error('プロジェクト名入力フィールド(#project-name)が見つかりません');
      return;
    }
    
    const name = nameEl.value.trim();
    console.log('入力されたプロジェクト名:', name);
    
    if (!name) {
      console.warn('プロジェクト名が空です');
      const event = new CustomEvent('show-error', {
        detail: { message: 'プロジェクト名を入力してください' }
      });
      document.dispatchEvent(event);
      return;
    }
    
    console.log('VSCodeにメッセージを送信します: createProject');
    this.vscode.postMessage({
      command: 'createProject',
      name,
      description: ""
    });
    
    this.hideNewProjectModal();
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