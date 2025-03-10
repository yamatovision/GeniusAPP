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
    
    // スコープが空の場合の表示
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
      
      // スコープが空の場合はディレクトリボタンを隠す
      if (directoryButton) directoryButton.style.display = 'none';
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
    const scopeProgress = document.getElementById('scope-progress');
    const scopeDetailContent = document.getElementById('scope-detail-content');
    const scopeEmptyMessage = document.getElementById('scope-empty-message');
    const scopeActions = document.getElementById('scope-actions');
    const fileList = document.getElementById('implementation-files');
    const inheritanceInfo = document.getElementById('inheritance-info');
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
    
    // 実装予定ファイルリストの更新
    if (fileList) {
      fileList.innerHTML = '';
      
      if (!scope.files || scope.files.length === 0) {
        fileList.innerHTML = '<div class="file-item">実装予定ファイルが定義されていません</div>';
      } else {
        scope.files.forEach((file) => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          
          // 完了状態を表示（読み取り専用）
          fileItem.innerHTML = `
            <input type="checkbox" class="file-checkbox" ${file.completed ? 'checked' : ''} disabled />
            <span>${file.path}</span>
          `;
          
          fileList.appendChild(fileItem);
        });
      }
    }
    
    // 引継ぎ情報の更新
    if (inheritanceInfo && scope.inheritanceInfo) {
      inheritanceInfo.innerHTML = scope.inheritanceInfo || '引継ぎ情報はありません';
    } else if (inheritanceInfo) {
      inheritanceInfo.innerHTML = '引継ぎ情報はありません';
    }
    
    // 実装ボタンの状態更新
    if (implementButton) {
      // 完了済みのスコープは実装ボタンを無効化
      const isCompleted = scope.status === 'completed';
      implementButton.disabled = isCompleted;
      
      if (isCompleted) {
        implementButton.textContent = '✅ 実装完了';
      } else if (scope.status === 'in-progress') {
        implementButton.textContent = '📝 実装を再開';
      } else {
        implementButton.textContent = '🚀 このスコープの実装を開始する';
      }
      
      // 依存関係の警告メッセージ
      if (scopeWarnMessage) {
        scopeWarnMessage.style.display = 'none'; // 簡略化のため非表示に
      }
    }
  }
  
  /**
   * 環境変数アシスタントを開くボタンを追加
   */
  function addEnvironmentVariablesButton() {
    const actionsArea = document.getElementById('scope-actions');
    if (!actionsArea) return;
    
    // 既存のボタンがあれば削除
    const existingButton = document.getElementById('env-vars-button');
    if (existingButton) {
      existingButton.remove();
    }
    
    // 環境変数設定ボタンを追加
    const configButton = document.createElement('button');
    configButton.id = 'env-vars-button';
    configButton.className = 'button button-secondary';
    configButton.style.marginLeft = '8px';
    configButton.innerHTML = '<i class="material-icons" style="margin-right: 4px;">settings</i>環境変数アシスタント';
    configButton.addEventListener('click', () => {
      vscode.postMessage({ command: 'openEnvironmentVariablesAssistant' });
    });
    
    actionsArea.appendChild(configButton);
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