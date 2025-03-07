// @ts-check

// VSCode API取得 
const vscode = acquireVsCodeApi();

// イベントリスナーの初期化
(function() {
  const previousState = vscode.getState() || { 
    scopes: [],
    selectedScopeIndex: -1,
    selectedScope: null,
    directoryStructure: ''
  };
  
  // ページ読み込み完了時の処理
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });
    
    // イベントリスナー設定
    setupEventListeners();
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
    }
  });
  
  /**
   * 状態更新ハンドラー
   */
  function handleUpdateState(data) {
    // 状態の更新
    vscode.setState({
      scopes: data.scopes || previousState.scopes,
      selectedScopeIndex: data.selectedScopeIndex !== undefined ? data.selectedScopeIndex : previousState.selectedScopeIndex,
      selectedScope: data.selectedScope || previousState.selectedScope,
      directoryStructure: data.directoryStructure || previousState.directoryStructure
    });
    
    // UIの更新
    updateScopeList(data.scopes || []);
    updateSelectedScope(data.selectedScope, data.selectedScopeIndex);
  }
  
  /**
   * スコープリストの更新
   */
  function updateScopeList(scopes) {
    const scopeList = document.getElementById('scope-list');
    if (!scopeList) return;
    
    // リストをクリア
    scopeList.innerHTML = '';
    
    // スコープが空の場合の表示と「スコープを作成する」ボタンの表示/非表示
    const directoryButton = document.getElementById('directory-structure-button');
    const createScopeButton = document.getElementById('create-scope-button');
    
    if (scopes.length === 0) {
      scopeList.innerHTML = `
        <div class="scope-tree-item">
          <div style="flex-grow: 1;">
            <div>スコープがありません</div>
          </div>
        </div>
      `;
      
      // スコープが空の場合はディレクトリボタンを隠し、スコープ作成ボタンを表示
      if (directoryButton) directoryButton.style.display = 'none';
      if (createScopeButton) createScopeButton.style.display = 'block';
      return;
    }
    
    // スコープがある場合はディレクトリボタンを表示し、スコープ作成ボタンを隠す
    if (directoryButton) directoryButton.style.display = 'block';
    if (createScopeButton) createScopeButton.style.display = 'none';
    
    // スコープごとにリスト項目を生成
    scopes.forEach((scope, index) => {
      const isActive = index === previousState.selectedScopeIndex;
      
      // ステータスに応じたクラスを設定
      const statusClass = `status-${scope.status || 'pending'}`;
      const progress = scope.progress || 0;
      
      // スコープアイテムのHTML
      const scopeItem = document.createElement('div');
      scopeItem.className = `scope-tree-item ${isActive ? 'active' : ''}`;
      scopeItem.setAttribute('data-index', index.toString());
      scopeItem.innerHTML = `
        <div style="flex-grow: 1;">
          <div>${scope.name}</div>
          <div class="scope-progress">
            <div class="scope-progress-bar ${statusClass}" style="width: ${progress}%;"></div>
          </div>
        </div>
        <div class="status-chip ${statusClass}">${getStatusText(scope.status)}</div>
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
    const scopePriority = document.getElementById('scope-priority');
    const scopeComplexity = document.getElementById('scope-complexity');
    const scopeEstimatedTime = document.getElementById('scope-estimated-time');
    const scopeProgress = document.getElementById('scope-progress');
    const scopeDetailContent = document.getElementById('scope-detail-content');
    const scopeEmptyMessage = document.getElementById('scope-empty-message');
    const scopeActions = document.getElementById('scope-actions');
    const fileList = document.getElementById('file-list');
    const implementButton = document.getElementById('implement-button');
    const scopeWarnMessage = document.getElementById('scope-warn-message');
    
    if (!scope) {
      // スコープが選択されていない場合
      if (scopeTitle) scopeTitle.textContent = 'スコープを選択してください';
      if (scopeDetailContent) scopeDetailContent.style.display = 'none';
      if (scopeEmptyMessage) scopeEmptyMessage.style.display = 'block';
      if (scopeActions) scopeActions.style.display = 'none';
      return;
    }
    
    // スコープの詳細情報を表示
    if (scopeTitle) scopeTitle.textContent = scope.name || '';
    if (scopeDescription) scopeDescription.textContent = scope.description || '';
    if (scopeProgress) scopeProgress.textContent = `${scope.progress || 0}%`;
    
    // 表示/非表示の切り替え
    if (scopeDetailContent) scopeDetailContent.style.display = 'block';
    if (scopeEmptyMessage) scopeEmptyMessage.style.display = 'none';
    if (scopeActions) scopeActions.style.display = 'block';
    
    // 機能リストの更新
    if (fileList) {
      // IDを更新して機能リストと明確にする
      fileList.id = 'feature-list';
      fileList.innerHTML = '';
      
      if (!scope.features || scope.features.length === 0) {
        fileList.innerHTML = '<div class="feature-item">機能が定義されていません</div>';
      } else {
        scope.features.forEach((feature, index) => {
          const featureItem = document.createElement('div');
          featureItem.className = 'feature-item';
          
          // 擬似的な完了状態を機能インデックスと進捗状況から判断
          // スコープの進捗に応じて機能を自動的に完了としてマーク
          const totalFeatures = scope.features.length;
          const completedFeaturesCount = Math.floor((scope.progress / 100) * totalFeatures);
          const isCompleted = index < completedFeaturesCount;
          
          featureItem.innerHTML = `
            <input type="checkbox" class="feature-checkbox" ${isCompleted ? 'checked' : ''} />
            <span>${feature}</span>
          `;
          
          // チェックボックスのイベントハンドラー
          const checkbox = featureItem.querySelector('input');
          if (checkbox) {
            checkbox.addEventListener('change', (e) => {
              // チェックされた機能の数をカウント
              const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
              const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
              
              // 進捗率を計算
              const progress = Math.round((checkedCount / totalFeatures) * 100);
              
              vscode.postMessage({
                command: 'updateScopeStatus',
                scopeId: scope.id,
                status: progress === 100 ? 'completed' : (progress > 0 ? 'in-progress' : 'pending'),
                progress: progress
              });
            });
          }
          
          fileList.appendChild(featureItem);
        });
      }
    }
    
    // 環境変数セクションの更新
    // ここに環境変数の表示を追加することも可能
    
    // 依存関係セクションの更新
    updateDependencySection(scope);
    
    // 実装ボタンの状態更新
    if (implementButton) {
      // 完了済みのスコープは実装ボタンを無効化
      const isCompleted = scope.status === 'completed';
      implementButton.disabled = isCompleted;
      
      // 依存関係のチェック（仮の実装 - 実際には依存関係の情報が必要）
      const hasDependencies = false;
      const dependenciesCompleted = true;
      
      if (isCompleted) {
        implementButton.textContent = '✅ 実装完了';
      } else if (scope.status === 'in-progress') {
        implementButton.textContent = '📝 実装を再開';
      } else {
        implementButton.textContent = '🚀 このスコープの実装を開始する';
      }
      
      // 依存関係の警告メッセージ
      if (scopeWarnMessage) {
        scopeWarnMessage.style.display = (hasDependencies && !dependenciesCompleted) ? 'block' : 'none';
      }
    }
  }
  
  /**
   * 依存関係セクションの更新
   */
  function updateDependencySection(scope) {
    const dependenciesContent = document.getElementById('dependencies-content');
    if (!dependenciesContent) return;
    
    // 環境変数関連の情報を表示
    dependenciesContent.innerHTML = '';
    
    // セクションタイトルの追加
    const envVarsTitle = document.createElement('h3');
    envVarsTitle.textContent = '必要な環境変数';
    envVarsTitle.style.marginTop = '0';
    dependenciesContent.appendChild(envVarsTitle);
    
    // 仮の環境変数リスト - 実際にはCURRENT_STATUS.mdから取得する必要がある
    // この部分は後でサーバーサイドから正確なデータで更新
    const envVars = [
      { name: 'API_KEY', description: 'API認証キー', status: 'unconfigured' },
      { name: 'DATABASE_URL', description: 'データベース接続URL', status: 'configured' },
      { name: 'PORT', description: 'サーバーポート', status: 'unconfigured' }
    ];
    
    if (envVars.length === 0) {
      const noVarsMessage = document.createElement('p');
      noVarsMessage.textContent = 'このスコープで必要な環境変数はありません';
      dependenciesContent.appendChild(noVarsMessage);
    } else {
      // 環境変数リストの表示
      const envVarsList = document.createElement('div');
      envVarsList.className = 'env-vars-list';
      
      envVars.forEach(envVar => {
        const envVarItem = document.createElement('div');
        envVarItem.className = 'env-var-item';
        
        // 環境変数の状態に基づいてチェックボックスの状態を設定
        const isConfigured = envVar.status === 'configured';
        
        envVarItem.innerHTML = `
          <input type="checkbox" class="env-var-checkbox" ${isConfigured ? 'checked' : ''} disabled />
          <div class="env-var-details">
            <span class="env-var-name">${envVar.name}</span>
            <span class="env-var-description">${envVar.description}</span>
          </div>
        `;
        
        envVarsList.appendChild(envVarItem);
      });
      
      dependenciesContent.appendChild(envVarsList);
      
      // 環境変数設定ボタン
      const configButton = document.createElement('button');
      configButton.className = 'button button-secondary';
      configButton.textContent = '環境変数アシスタントを開く';
      configButton.style.marginTop = '12px';
      configButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'openEnvironmentVariablesAssistant' });
      });
      
      dependenciesContent.appendChild(configButton);
    }
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
    
    // スコープ追加ボタン
    const addScopeButton = document.getElementById('add-scope-button');
    if (addScopeButton) {
      addScopeButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'addNewScope' });
      });
    }
    
    // スコープ編集ボタン
    const editScopeButton = document.getElementById('edit-scope-button');
    if (editScopeButton) {
      editScopeButton.addEventListener('click', () => {
        const selectedScope = previousState.selectedScope;
        if (!selectedScope) return;
        
        // 編集ダイアログのフィールドを初期化
        const nameInput = document.getElementById('edit-name');
        const descriptionInput = document.getElementById('edit-description');
        const prioritySelect = document.getElementById('edit-priority');
        const estimatedTimeInput = document.getElementById('edit-estimated-time');
        const filesInput = document.getElementById('edit-files');
        
        if (nameInput) nameInput.value = selectedScope.name || '';
        if (descriptionInput) descriptionInput.value = selectedScope.description || '';
        if (prioritySelect) {
          [...prioritySelect.options].forEach(option => {
            option.selected = option.value === selectedScope.priority;
          });
        }
        if (estimatedTimeInput) estimatedTimeInput.value = selectedScope.estimatedTime || '';
        if (filesInput && selectedScope.files) {
          filesInput.value = selectedScope.files.map(file => file.path).join('\n');
        }
        
        // ダイアログを表示
        const editDialog = document.getElementById('edit-dialog');
        if (editDialog) {
          editDialog.style.display = 'flex';
        }
      });
    }
    
    // 編集ダイアログの保存ボタン
    const editSaveButton = document.getElementById('edit-save');
    if (editSaveButton) {
      editSaveButton.addEventListener('click', () => {
        const nameInput = document.getElementById('edit-name');
        const descriptionInput = document.getElementById('edit-description');
        const prioritySelect = document.getElementById('edit-priority');
        const estimatedTimeInput = document.getElementById('edit-estimated-time');
        const filesInput = document.getElementById('edit-files');
        
        // 入力値の取得
        const name = nameInput ? nameInput.value : '';
        const description = descriptionInput ? descriptionInput.value : '';
        const priority = prioritySelect ? prioritySelect.value : '';
        const estimatedTime = estimatedTimeInput ? estimatedTimeInput.value : '';
        const files = filesInput ? 
          filesInput.value.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0) : 
          [];
        
        // 更新データの送信
        vscode.postMessage({
          command: 'editScope',
          scopeData: {
            name,
            description,
            priority,
            estimatedTime,
            files
          }
        });
        
        // ダイアログを閉じる
        const editDialog = document.getElementById('edit-dialog');
        if (editDialog) {
          editDialog.style.display = 'none';
        }
      });
    }
    
    // 編集ダイアログのキャンセルボタン
    const editCancelButton = document.getElementById('edit-cancel');
    if (editCancelButton) {
      editCancelButton.addEventListener('click', () => {
        const editDialog = document.getElementById('edit-dialog');
        if (editDialog) {
          editDialog.style.display = 'none';
        }
      });
    }
    
    // スコープ作成ボタン
    const scopeCreatorButton = document.getElementById('scope-creator-button');
    if (scopeCreatorButton) {
      scopeCreatorButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'launchScopeCreator' });
      });
    }
    
    // サイドバーの「スコープを作成する」ボタン
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      createScopeButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'launchScopeCreator' });
      });
    }
    
    // 実装ボタン
    const implementButton = document.getElementById('implement-button');
    if (implementButton) {
      implementButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'startImplementation' });
      });
    }
    
    // 依存関係グラフボタン
    const dependencyGraphButton = document.getElementById('dependency-graph-button');
    if (dependencyGraphButton) {
      dependencyGraphButton.addEventListener('click', () => {
        const dependencyGraph = document.getElementById('dependency-graph');
        if (dependencyGraph) {
          const isVisible = dependencyGraph.style.display !== 'none';
          dependencyGraph.style.display = isVisible ? 'none' : 'block';
        }
      });
    }
  }
})();