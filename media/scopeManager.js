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
    theme: 'light',
    isPreparationMode: false // 開発準備モードかどうかのフラグを追加
  };
  
  // テーマの適用
  function applyTheme(theme) {
    const body = document.body;
    if (!body) return;
    
    if (theme === 'dark') {
      body.classList.add('theme-dark');
      body.classList.remove('theme-light');
      // テーマトグルボタンのテキスト更新
      updateThemeToggleButton('dark');
    } else {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      // テーマトグルボタンのテキスト更新
      updateThemeToggleButton('light');
    }
    
    // 状態を保存
    localStorage.setItem('app-theme', theme);
    const currentState = vscode.getState() || {};
    vscode.setState({
      ...currentState,
      theme
    });
  }
  
  // テーマトグルボタンのテキストとアイコンを更新
  function updateThemeToggleButton(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');
    const themeText = themeToggle?.querySelector('.theme-text');
    
    if (themeToggle) {
      if (theme === 'dark') {
        themeIcon.textContent = 'light_mode';
        themeText.textContent = 'ライトモード';
      } else {
        themeIcon.textContent = 'dark_mode';
        themeText.textContent = 'ダークモード';
      }
    }
  }
  
  // 常にダークモードを適用
  function applyStoredTheme() {
    // テーマは常に'dark'に設定
    localStorage.setItem('app-theme', 'dark');
    // ダークモードクラスを適用
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    // ダークモードを適用
    applyTheme('dark');
  }
  
  // テーマの切り替え
  function toggleTheme() {
    const currentTheme = localStorage.getItem('app-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  }
  
  // ページ読み込み完了時の処理
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });
    
    // 保存されているテーマを適用
    applyStoredTheme();
    
    // リファレンスマネージャーカードを非表示にする
    hideReferenceManagerCard();
    
    // イベントリスナー設定
    setupEventListeners();
  });
  
  // テーマ変更イベントをリッスン
  document.addEventListener('theme-changed', (e) => {
    applyTheme(e.detail.theme);
  });
  
  // メッセージハンドラーの設定
  window.addEventListener('message', event => {
    const message = event.data;
    
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
    
    if (projectTitle && data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      projectTitle.textContent = projectName || 'プロジェクト';
    }
    
    if (projectPath) {
      projectPath.textContent = data.projectPath || '/path/to/project';
    }
  }
  
  /**
   * 状態更新ハンドラー
   */
  function handleUpdateState(data) {
    // 準備モードフラグを取得
    const isPreparationMode = data.isPreparationMode !== undefined ? data.isPreparationMode : previousState.isPreparationMode;
    
    // 状態の更新
    vscode.setState({
      scopes: data.scopes || previousState.scopes,
      selectedScopeIndex: data.selectedScopeIndex !== undefined ? data.selectedScopeIndex : previousState.selectedScopeIndex,
      selectedScope: data.selectedScope || previousState.selectedScope,
      directoryStructure: data.directoryStructure || previousState.directoryStructure,
      isPreparationMode: isPreparationMode // 準備モードフラグを保存
    });
    
    // プロジェクト情報を更新
    updateProjectInfo(data);
    
    // モードに応じたUIの表示切替
    updateModeView(isPreparationMode);
    
    // UIの更新
    updateScopeList(data.scopes || []);
    updateSelectedScope(data.selectedScope, data.selectedScopeIndex);
    
    // ディレクトリ構造の更新
    updateDirectoryStructure(data.directoryStructure);
  }
  
  /**
   * モードに応じたUI表示の切替
   */
  function updateModeView(isPreparationMode) {
    // 開発準備モード用の要素を取得
    const preparationModeView = document.getElementById('preparation-mode-view');
    // 実装モード用の要素を取得
    const implementationModeView = document.getElementById('implementation-mode-view');
    
    // ヘッダータイトルを取得
    const headerTitle = document.getElementById('panel-header-title');
    
    // AIボタンのテキスト要素
    const aiButtonText = document.getElementById('ai-button-text');
    const aiButtonTextAlt = document.getElementById('ai-button-text-alt');
    
    // 新規作成ボタンを非表示にする
    const addScopeButton = document.getElementById('add-scope-button');
    if (addScopeButton) {
      addScopeButton.style.display = 'none';
    }
    
    // モードに応じて表示を切り替え
    if (isPreparationMode) {
      // 開発準備モードの表示
      if (preparationModeView) preparationModeView.style.display = 'block';
      if (implementationModeView) implementationModeView.style.display = 'none';
      if (headerTitle) headerTitle.textContent = 'AppGenius 開発準備ガイド';
      
      // 通常のスコープ選択リストは隠す
      const scopeListContainer = document.getElementById('scope-list-container');
      if (scopeListContainer) scopeListContainer.style.display = 'none';
      
      // 実装ボタンを隠す
      const implementButton = document.getElementById('implement-button');
      if (implementButton) implementButton.style.display = 'none';
      
      // 「実装フェーズに移行」ボタンを表示
      const switchToImplementationButton = document.getElementById('switch-to-implementation-button');
      if (switchToImplementationButton) switchToImplementationButton.style.display = 'block';
      
      // AIボタンのテキスト更新 - 準備モードでは「実装計画を立てる」
      if (aiButtonText) aiButtonText.textContent = '実装計画を立てる';
      if (aiButtonTextAlt) aiButtonTextAlt.textContent = '実装計画を立てる';
    } else {
      // 実装モードの表示
      if (preparationModeView) preparationModeView.style.display = 'none';
      if (implementationModeView) implementationModeView.style.display = 'block';
      if (headerTitle) headerTitle.textContent = 'AppGenius スコープマネージャー';
      
      // 通常のスコープ選択リストを表示
      const scopeListContainer = document.getElementById('scope-list-container');
      if (scopeListContainer) scopeListContainer.style.display = 'block';
      
      // 「実装フェーズに移行」ボタンを隠す
      const switchToImplementationButton = document.getElementById('switch-to-implementation-button');
      if (switchToImplementationButton) switchToImplementationButton.style.display = 'none';
      
      // AIボタンのテキスト更新 - 実装モードでは「開発案件を追加する」
      if (aiButtonText) aiButtonText.textContent = '開発案件を追加する';
      if (aiButtonTextAlt) aiButtonTextAlt.textContent = '開発案件を追加する';
    }
  }
  
  /**
   * プロジェクト情報の更新
   */
  function updateProjectInfo(data) {
    const projectTitle = document.getElementById('project-title');
    const projectPath = document.getElementById('project-path');
    const progressText = document.getElementById('project-progress-text');
    const progressBar = document.getElementById('project-progress-bar');
    const totalFiles = document.getElementById('total-files');
    const completedFiles = document.getElementById('completed-files');
    const totalScopes = document.getElementById('total-scopes');
    
    if (projectTitle && data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      projectTitle.textContent = projectName || 'プロジェクト';
    }
    
    if (projectPath && data.projectPath) {
      projectPath.textContent = data.projectPath;
    }
    
    // 全体進捗状況の更新
    if (progressText && data.totalProgress !== undefined) {
      progressText.textContent = `${data.totalProgress}%`;
    }
    
    if (progressBar && data.totalProgress !== undefined) {
      progressBar.style.width = `${data.totalProgress}%`;
      
      // 進捗に応じて色を変更
      if (data.totalProgress >= 80) {
        progressBar.className = 'progress-fill status-completed';
      } else if (data.totalProgress >= 30) {
        progressBar.className = 'progress-fill status-in-progress';
      } else {
        progressBar.className = 'progress-fill status-pending';
      }
    }
    
    // プロジェクト統計情報の更新
    if (data.projectStats) {
      if (totalFiles) {
        totalFiles.textContent = data.projectStats.totalFiles || 0;
      }
      
      if (completedFiles) {
        completedFiles.textContent = data.projectStats.completedFiles || 0;
      }
      
      // スコープ進捗率の計算と表示
      const scopeCompletionRate = document.getElementById('scope-completion-rate');
      if (scopeCompletionRate && data.scopes && data.scopes.length > 0) {
        // 各スコープの進捗を平均して全体の進捗率を計算
        const totalProgress = data.scopes.reduce((sum, scope) => sum + (scope.progress || 0), 0);
        const avgProgress = Math.round(totalProgress / data.scopes.length);
        scopeCompletionRate.textContent = `${avgProgress}%`;
        
        // 進捗率に応じて色を変更
        if (avgProgress >= 80) {
          scopeCompletionRate.style.color = 'var(--vscode-charts-green)';
        } else if (avgProgress >= 30) {
          scopeCompletionRate.style.color = 'var(--vscode-charts-blue)';
        } else {
          scopeCompletionRate.style.color = 'var(--vscode-charts-yellow)';
        }
      } else if (scopeCompletionRate) {
        scopeCompletionRate.textContent = '0%';
      }
    }
  }
  
  /**
   * ディレクトリ構造プレビューの更新
   */
  function updateDirectoryStructure(dirStructure) {
    const previewElement = document.querySelector('.directory .card-content pre');
    if (previewElement && dirStructure) {
      // 最初の数行だけを表示（プレビュー用）
      const lines = dirStructure.split('\n');
      const preview = lines.slice(0, 6).join('\n');
      previewElement.textContent = preview + (lines.length > 6 ? '\n...' : '');
    }
  }
  
  /**
   * リファレンスマネージャーカードを非表示にする
   */
  function hideReferenceManagerCard() {
    // リファレンスマネージャーカードを検索（classやidで特定）
    const referenceCards = document.querySelectorAll('.card.reference, .reference-card, [id*="reference-manager"]');
    
    // 見つかったカードを非表示に
    referenceCards.forEach(card => {
      if (card) {
        card.style.display = 'none';
      }
    });
    
    // または親要素からリファレンスマネージャーという文字列を含む要素を検索して非表示に
    const allCards = document.querySelectorAll('.card, .card-container');
    allCards.forEach(card => {
      if (card.textContent.includes('リファレンスマネージャー') || 
          card.textContent.includes('リファレンスを管理')) {
        card.style.display = 'none';
      }
    });
  }
  
  /**
   * スコープリストの更新
   */
  function updateScopeList(scopes) {
    const scopeList = document.getElementById('scope-list');
    if (!scopeList) return;
    
    // リストをクリア
    scopeList.innerHTML = '';
    
    // スコープが空の場合の表示
    const directoryButton = document.getElementById('directory-structure-button');
    const createScopeButton = document.getElementById('create-scope-button');
    
    if (scopes.length === 0) {
      scopeList.innerHTML = `
        <div class="scope-item">
          <h3>スコープがありません</h3>
          <p style="color: var(--vscode-descriptionForeground); font-size: 0.9rem; margin-top: 5px;">
            「実装計画を立てる」ボタンをクリックしてスコープを作成してください
          </p>
        </div>
      `;
      
      // スコープが空の場合でもディレクトリボタンは表示する
      if (directoryButton) directoryButton.style.display = 'block';
      if (createScopeButton) createScopeButton.style.display = 'block';
      return;
    }
    
    // スコープがある場合はディレクトリボタンを表示
    if (directoryButton) directoryButton.style.display = 'block';
    // スコープ作成ボタンは常に表示する
    if (createScopeButton) createScopeButton.style.display = 'block';
    
    // スコープごとにリスト項目を生成
    scopes.forEach((scope, index) => {
      const isActive = index === previousState.selectedScopeIndex;
      
      // ステータスに応じたクラスを設定
      const statusClass = `status-${scope.status || 'pending'}`;
      const progress = scope.progress || 0;
      
      // スコープアイテムのHTML
      const scopeItem = document.createElement('div');
      scopeItem.className = `scope-item ${isActive ? 'active' : ''}`;
      scopeItem.setAttribute('data-index', index.toString());
      
      // スコープ名から「実装スコープ」という接頭辞を削除
      const displayName = scope.name.replace(/^実装スコープ\s*/, '');
      
      scopeItem.innerHTML = `
        <h3>${displayName}</h3>
        <div class="scope-progress">
          <div class="scope-progress-bar ${statusClass}" style="width: ${progress}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
          <span style="font-size: 0.9rem; color: var(--vscode-descriptionForeground);">
            ${scope.files ? scope.files.length + 'ファイル' : 'ファイルなし'}
          </span>
          <span style="font-size: 0.9rem; padding: 2px 8px; background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px;">
            ${progress}% ${getStatusText(scope.status)}
          </span>
        </div>
      `;
      
      // クリックイベントのハンドラー
      scopeItem.addEventListener('click', () => {
        vscode.postMessage({ 
          command: 'selectScope',
          index
        });
      });
      
      scopeList.appendChild(scopeItem);
    });
  }
  
  /**
   * 選択中のスコープの詳細表示を更新
   */
  function updateSelectedScope(scope, selectedIndex) {
    // 要素の取得
    const scopeTitle = document.getElementById('scope-title');
    const scopeDescription = document.getElementById('scope-description');
    const scopeProgress = document.getElementById('scope-progress');
    const scopeProgressBar = document.getElementById('scope-progress-bar');
    const scopeDetailContent = document.getElementById('scope-detail-content');
    const scopeEmptyMessage = document.getElementById('scope-empty-message');
    const implementButton = document.getElementById('implement-button');
    const filesList = document.getElementById('implementation-files');
    const inheritanceInfo = document.getElementById('inheritance-info');
    
    if (!scope) {
      // スコープが選択されていない場合
      if (scopeTitle) scopeTitle.textContent = 'スコープを選択してください';
      if (scopeDetailContent) scopeDetailContent.style.display = 'none';
      if (scopeEmptyMessage) scopeEmptyMessage.style.display = 'block';
      if (implementButton) implementButton.style.display = 'none';
      return;
    }
    
    // スコープの詳細情報を表示
    if (scopeTitle) scopeTitle.textContent = scope.name || '';
    if (scopeDescription) scopeDescription.textContent = scope.description || '';
    
    // 進捗状況の更新
    if (scopeProgress) scopeProgress.textContent = `${scope.progress || 0}%`;
    if (scopeProgressBar) {
      const statusClass = `status-${scope.status || 'pending'}`;
      scopeProgressBar.className = `progress-fill ${statusClass}`;
      scopeProgressBar.style.width = `${scope.progress || 0}%`;
    }
    
    // 表示/非表示の切り替え
    if (scopeDetailContent) scopeDetailContent.style.display = 'block';
    if (scopeEmptyMessage) scopeEmptyMessage.style.display = 'none';
    if (implementButton) implementButton.style.display = 'block';
    
    // 実装予定ファイルリストの更新
    if (filesList) {
      filesList.innerHTML = '';
      
      if (!scope.files || scope.files.length === 0) {
        filesList.innerHTML = '<div class="file-item">実装予定ファイルが定義されていません</div>';
      } else {
        scope.files.forEach(file => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          
          // 完了状態を表示
          fileItem.innerHTML = `
            <input type="checkbox" class="file-checkbox" ${file.completed ? 'checked' : ''} />
            <span>${file.path}</span>
          `;
          
          // チェックボックスのクリックイベント
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
          
          filesList.appendChild(fileItem);
        });
      }
    }
    
    // 引継ぎ情報の更新
    if (inheritanceInfo) {
      if (scope.inheritanceInfo) {
        inheritanceInfo.innerHTML = scope.inheritanceInfo;
        inheritanceInfo.style.display = 'block';
      } else {
        inheritanceInfo.style.display = 'none';
      }
    }
    
    // 実装ボタンの状態更新
    if (implementButton) {
      // 完了済みのスコープは実装ボタンを無効化しないが表示を変更
      const isCompleted = scope.status === 'completed';
      
      if (isCompleted) {
        implementButton.innerHTML = '<span class="material-icons">check_circle</span> 実装完了';
        implementButton.style.backgroundColor = 'var(--vscode-charts-green)';
      } else if (scope.status === 'in-progress') {
        implementButton.innerHTML = '<span class="material-icons">code</span> 実装を再開';
        implementButton.style.backgroundColor = 'var(--vscode-button-background)';
      } else {
        implementButton.innerHTML = '<span class="material-icons">play_arrow</span> 実装を開始';
        implementButton.style.backgroundColor = 'var(--vscode-button-background)';
      }
    }
    
    // 実装ツールカードの実装アシスタントボタンも連動
    const launchAssistantButton = document.getElementById('launch-implementation-assistant');
    if (launchAssistantButton) {
      launchAssistantButton.innerHTML = `<span class="material-icons">play_arrow</span> ${scope.name}を実装`;
    }
  }
  
  /**
   * 環境変数アシスタントを開くボタンのイベントハンドラー
   */
  function handleOpenEnvironmentVariables() {
    vscode.postMessage({ command: 'openEnvironmentVariablesAssistant' });
  }
  
  /**
   * ディレクトリ構造ダイアログを表示
   */
  function showDirectoryStructure(structure) {
    const directoryDialog = document.getElementById('directory-dialog');
    const directoryStructure = document.getElementById('directory-structure');
    
    if (directoryDialog && directoryStructure) {
      directoryStructure.textContent = structure || '（ディレクトリ構造はまだ定義されていません）';
      directoryDialog.style.display = 'flex';
    }
  }
  
  /**
   * エラーメッセージの表示
   */
  function showError(message) {
    // VSCodeの組み込み通知を使用
    vscode.postMessage({
      command: 'showError',
      message
    });
  }
  
  /**
   * ステータスコードに対応する表示テキストを取得
   */
  function getStatusText(status) {
    switch (status) {
      case 'completed':
        return '完了';
      case 'in-progress':
        return '進行中';
      case 'blocked':
        return 'ブロック';
      case 'pending':
      default:
        return '未着手';
    }
  }
  
  /**
   * イベントリスナーの設定
   */
  function setupEventListeners() {
    // ディレクトリ構造ボタン
    const directoryButton = document.getElementById('directory-structure-button');
    if (directoryButton) {
      directoryButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'showDirectoryStructure' });
      });
    }
    
    // ディレクトリダイアログの閉じるボタン
    const directoryClose = document.getElementById('directory-close');
    if (directoryClose) {
      directoryClose.addEventListener('click', () => {
        const directoryDialog = document.getElementById('directory-dialog');
        if (directoryDialog) {
          directoryDialog.style.display = 'none';
        }
      });
    }
    
    // スコープ追加ボタンの機能は削除
    
    // スコープ作成ボタン (AI) - モードに応じた機能を提供
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      // ボタンを大きく表示するスタイル適用
      createScopeButton.style.padding = '12px 20px';
      createScopeButton.style.fontSize = '1.1rem';
      createScopeButton.style.fontWeight = 'bold';
      
      createScopeButton.addEventListener('click', () => {
        // 現在のモードを取得
        const currentState = vscode.getState() || {};
        const isPreparationMode = currentState.isPreparationMode !== undefined 
          ? currentState.isPreparationMode 
          : false;
          
        // モードに応じたコマンドを実行
        if (isPreparationMode) {
          // 開発準備モード - スコープ作成プロンプト
          vscode.postMessage({ command: 'launchScopeCreator' });
        } else {
          // 実装モード - プロジェクト分析プロンプト
          vscode.postMessage({ command: 'launchImplementationAssistant' });
        }
      });
    }
    
    // 実装ボタン
    const implementButton = document.getElementById('implement-button');
    if (implementButton) {
      implementButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'startImplementation' });
      });
    }
    
    // 環境変数アシスタントボタン - 全てのボタンにイベントリスナーを設定
    const envVarsButtons = document.querySelectorAll('#env-vars-button, .env-vars-button, .environment-variables-button');
    if (envVarsButtons.length > 0) {
      envVarsButtons.forEach(button => {
        button.addEventListener('click', handleOpenEnvironmentVariables);
      });
    }
    
    // 実装アシスタント起動ボタン
    const launchAssistantButton = document.getElementById('launch-implementation-assistant');
    if (launchAssistantButton) {
      // ボタンを大きく表示するスタイル適用
      launchAssistantButton.style.padding = '12px 20px';
      launchAssistantButton.style.fontSize = '1.1rem';
      launchAssistantButton.style.fontWeight = 'bold';
      
      launchAssistantButton.addEventListener('click', () => {
        // 現在のモードを取得
        const currentState = vscode.getState() || {};
        const isPreparationMode = currentState.isPreparationMode !== undefined 
          ? currentState.isPreparationMode 
          : false;
          
        // モードに応じたコマンドを実行
        if (isPreparationMode) {
          // 開発準備モード - スコープ作成プロンプト
          vscode.postMessage({ command: 'launchScopeCreator' });
        } else {
          // 実装モード - プロジェクト分析プロンプト
          vscode.postMessage({ command: 'launchImplementationAssistant' });
        }
      });
    }
    
    // 要件定義エディタボタン - 全てのボタンにイベントリスナーを設定
    const requirementsButtons = document.querySelectorAll('#requirements-button, .requirements-edit-button');
    if (requirementsButtons.length > 0) {
      requirementsButtons.forEach(button => {
        button.addEventListener('click', () => {
          // 要件定義エディタコマンドを実行
          vscode.postMessage({ command: 'openRequirementsVisualizer' });
        });
      });
    }
    
    // モックアップギャラリーボタン - 全てのボタンにイベントリスナーを設定
    const mockupGalleryButtons = document.querySelectorAll('#mockup-gallery-button, .mockup-gallery-button');
    if (mockupGalleryButtons.length > 0) {
      mockupGalleryButtons.forEach(button => {
        button.addEventListener('click', () => {
          vscode.postMessage({ command: 'openMockupGallery' });
        });
      });
    }
    
    // デバッグ探偵ボタン
    const debugDetectiveButton = document.getElementById('debug-detective-button');
    if (debugDetectiveButton) {
      debugDetectiveButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'openDebugDetective' });
      });
    }
    
    // リファレンスマネージャーボタン - 一時的に無効化
    /* 
    const referenceManagerButton = document.getElementById('reference-manager-button');
    if (referenceManagerButton) {
      referenceManagerButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'openReferenceManager' });
      });
    }
    */
    
    // 実装フェーズに移行ボタン
    const switchToImplementationButton = document.getElementById('switch-to-implementation-button');
    if (switchToImplementationButton) {
      switchToImplementationButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'switchToImplementationMode' });
      });
    }
    
    // 開発準備モードに戻るボタン
    const resetToPreparationButton = document.getElementById('reset-to-preparation-button');
    if (resetToPreparationButton) {
      resetToPreparationButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'resetToPreparationMode' });
      });
    }
    
    // ダークモードのみのため、テーマ切り替えボタンの処理は削除
  }
})();