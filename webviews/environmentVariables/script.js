(function() {
  // VSCode APIアクセス
  const vscode = acquireVsCodeApi();
  
  // 状態を保持
  let state = {
    envFiles: [],
    activeEnvFile: null,
    envVariables: {},
    progress: {
      total: 0,
      configured: 0
    },
    projectPath: '',
    activeGroup: null
  };
  
  // DOM要素のキャッシュ
  let elements = {
    envFilesContainer: null,
    envVariablesContainer: null,
    envGroupsContainer: null,
    progressValue: null,
    progressBar: null,
    currentEnvFile: null,
    createEnvFileButton: null,
    importVariablesButton: null,
    exportVariablesButton: null,
    detectVariablesButton: null,
    testDatabaseButton: null,
    testApiButton: null,
    saveAllVariablesButton: null,
    updateEnvMdButton: null
  };
  
  // 保存された状態を復元
  function restoreState() {
    const savedState = vscode.getState();
    if (savedState) {
      state = {...state, ...savedState};
    }
  }
  
  // DOM要素を取得してキャッシュ
  function cacheElements() {
    elements.envFilesContainer = document.getElementById('env-files-container');
    elements.envVariablesContainer = document.getElementById('env-variables-container');
    elements.envGroupsContainer = document.getElementById('env-groups-container');
    elements.progressValue = document.getElementById('progress-value');
    elements.progressBar = document.querySelector('.progress-value');
    elements.currentEnvFile = document.getElementById('current-env-file');
    elements.createEnvFileButton = document.getElementById('create-env-file');
    elements.importVariablesButton = document.getElementById('import-variables');
    elements.exportVariablesButton = document.getElementById('export-variables');
    elements.detectVariablesButton = document.getElementById('detect-variables');
    elements.testDatabaseButton = document.getElementById('test-database');
    elements.testApiButton = document.getElementById('test-api');
    elements.saveAllVariablesButton = document.getElementById('save-all-variables');
    elements.updateEnvMdButton = document.getElementById('update-env-md');
  }
  
  // イベントリスナーを設定
  function setupEventListeners() {
    // 環境変数ファイル作成ボタン
    if (elements.createEnvFileButton) {
      elements.createEnvFileButton.addEventListener('click', () => {
        // ファイル名の入力を促す
        const fileName = prompt('環境変数ファイル名を入力してください：');
        if (fileName) {
          vscode.postMessage({
            command: 'createEnvFile',
            fileName
          });
        }
      });
    }
    
    // 環境変数インポートボタン
    if (elements.importVariablesButton) {
      elements.importVariablesButton.addEventListener('click', () => {
        // 未実装
        showToast('インポート機能は現在実装中です', 'info');
      });
    }
    
    // 環境変数エクスポートボタン
    if (elements.exportVariablesButton) {
      elements.exportVariablesButton.addEventListener('click', () => {
        // 未実装
        showToast('エクスポート機能は現在実装中です', 'info');
      });
    }
    
    // 変数検出ボタン
    if (elements.detectVariablesButton) {
      elements.detectVariablesButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'autoDetectVariables'
        });
      });
    }
    
    // データベース接続テストボタン
    if (elements.testDatabaseButton) {
      elements.testDatabaseButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'testConnection',
          connectionType: 'database',
          config: getConnectionConfig('database')
        });
      });
    }
    
    // API接続テストボタン
    if (elements.testApiButton) {
      elements.testApiButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'testConnection',
          connectionType: 'api',
          config: getConnectionConfig('api')
        });
      });
    }
    
    // すべて保存ボタン
    if (elements.saveAllVariablesButton) {
      elements.saveAllVariablesButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'saveAllVariables'
        });
      });
    }
    
    // env.md更新ボタン
    if (elements.updateEnvMdButton) {
      elements.updateEnvMdButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'updateEnvMd'
        });
      });
    }
  }
  
  // メッセージハンドラを設定
  function setupMessageHandler() {
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'updateState':
          handleUpdateState(message);
          break;
          
        case 'showError':
          handleShowError(message.message);
          break;
          
        case 'connectionTestStart':
          handleConnectionTestStart(message);
          break;
          
        case 'connectionTestResult':
          handleConnectionTestResult(message);
          break;
      }
    });
  }
  
  // 状態更新を処理
  function handleUpdateState(message) {
    // 状態を更新
    state = {
      ...state,
      envFiles: message.envFiles || state.envFiles,
      activeEnvFile: message.activeEnvFile || state.activeEnvFile,
      envVariables: message.envVariables || state.envVariables,
      progress: message.progress || state.progress,
      projectPath: message.projectPath || state.projectPath
    };
    
    // 状態を保存
    vscode.setState(state);
    
    // UIを更新
    updateUI();
  }
  
  // エラーメッセージを処理
  function handleShowError(message) {
    showToast(message, 'error');
  }
  
  // 接続テスト開始を処理
  function handleConnectionTestStart(message) {
    const { connectionType } = message;
    
    // 対応するボタンを無効化して「テスト中...」テキストを表示
    if (connectionType === 'database' && elements.testDatabaseButton) {
      const originalText = elements.testDatabaseButton.textContent;
      elements.testDatabaseButton.disabled = true;
      elements.testDatabaseButton.textContent = 'テスト中...';
      elements.testDatabaseButton.dataset.originalText = originalText;
    } else if (connectionType === 'api' && elements.testApiButton) {
      const originalText = elements.testApiButton.textContent;
      elements.testApiButton.disabled = true;
      elements.testApiButton.textContent = 'テスト中...';
      elements.testApiButton.dataset.originalText = originalText;
    }
  }
  
  // 接続テスト結果を処理
  function handleConnectionTestResult(message) {
    const { connectionType, success, message: resultMessage } = message;
    
    // 対応するボタンを元に戻す
    if (connectionType === 'database' && elements.testDatabaseButton) {
      elements.testDatabaseButton.disabled = false;
      elements.testDatabaseButton.textContent = elements.testDatabaseButton.dataset.originalText || 'データベース接続テスト';
    } else if (connectionType === 'api' && elements.testApiButton) {
      elements.testApiButton.disabled = false;
      elements.testApiButton.textContent = elements.testApiButton.dataset.originalText || 'API接続テスト';
    }
    
    // 結果を表示
    showToast(resultMessage, success ? 'success' : 'error');
  }
  
  // UIを更新
  function updateUI() {
    updateProgressIndicator();
    updateEnvFilesList();
    updateEnvVariablesList();
    updateEnvGroupsList();
  }
  
  // 進捗インジケータを更新
  function updateProgressIndicator() {
    if (elements.progressValue && elements.progressBar) {
      elements.progressValue.textContent = `${state.progress.configured}/${state.progress.total}`;
      
      const progressPercent = state.progress.total > 0 
        ? Math.round((state.progress.configured / state.progress.total) * 100) 
        : 0;
      
      elements.progressBar.style.width = `${progressPercent}%`;
    }
  }
  
  // 環境変数ファイルリストを更新
  function updateEnvFilesList() {
    if (!elements.envFilesContainer) return;
    
    // ローディング表示をクリア
    elements.envFilesContainer.innerHTML = '';
    
    // 環境変数ファイルがない場合の表示
    if (!state.envFiles || state.envFiles.length === 0) {
      elements.envFilesContainer.innerHTML = '<div class="no-files" role="status">環境変数ファイルがありません</div>';
      return;
    }
    
    // 各ファイルの要素を作成
    state.envFiles.forEach(filePath => {
      const fileName = filePath.split('/').pop();
      
      const fileItem = document.createElement('div');
      fileItem.className = `env-file-item ${filePath === state.activeEnvFile ? 'active' : ''}`;
      fileItem.dataset.filePath = filePath;
      fileItem.setAttribute('role', 'listitem');
      fileItem.setAttribute('tabindex', '0');
      fileItem.setAttribute('aria-label', `環境変数ファイル: ${fileName} ${filePath === state.activeEnvFile ? '（選択中）' : ''}`);
      
      fileItem.innerHTML = `
        <span class="env-file-icon" aria-hidden="true">📄</span>
        <span class="env-file-name">${fileName}</span>
      `;
      
      // ファイル選択イベントリスナー - クリック
      fileItem.addEventListener('click', () => {
        selectEnvFile(filePath);
      });
      
      // キーボードイベントリスナー - Enter/Space
      fileItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectEnvFile(filePath);
        }
      });
      
      elements.envFilesContainer.appendChild(fileItem);
    });
    
    // 現在のファイル名を表示
    if (elements.currentEnvFile && state.activeEnvFile) {
      const fileName = state.activeEnvFile.split('/').pop();
      elements.currentEnvFile.textContent = `(${fileName})`;
    }
  }
  
  // 環境変数ファイルを選択
  function selectEnvFile(filePath) {
    // アクティブなファイルをハイライト
    const fileItems = document.querySelectorAll('.env-file-item');
    fileItems.forEach(item => {
      if (item.dataset.filePath === filePath) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      }
    });
    
    // 通知領域に更新を通知
    const notificationArea = document.getElementById('notification-area');
    if (notificationArea) {
      const fileName = filePath.split('/').pop();
      notificationArea.textContent = `環境変数ファイル ${fileName} を選択しました`;
    }
    
    // サーバーに選択を通知
    vscode.postMessage({
      command: 'selectEnvFile',
      filePath
    });
  }
  
  // 環境変数リストを更新
  function updateEnvVariablesList() {
    if (!elements.envVariablesContainer) return;
    
    // ローディング表示をクリア
    elements.envVariablesContainer.innerHTML = '';
    
    // アクティブなファイルがない場合の表示
    if (!state.activeEnvFile) {
      elements.envVariablesContainer.innerHTML = '<div class="no-file-selected" role="status">環境変数ファイルを選択してください</div>';
      return;
    }
    
    // 変数がない場合の表示
    const variables = state.envVariables[state.activeEnvFile] || {};
    
    if (Object.keys(variables).length === 0) {
      elements.envVariablesContainer.innerHTML = '<div class="no-variables" role="status">環境変数がありません</div>';
      return;
    }
    
    // フィルタリング
    let filteredVariables = variables;
    if (state.activeGroup) {
      filteredVariables = {};
      
      // グループに基づいてフィルタリング
      for (const key in variables) {
        const value = variables[key];
        
        let group = 'other';
        if (key.startsWith('DB_')) {
          group = 'database';
        } else if (key.includes('API') || key.includes('URL')) {
          group = 'api';
        } else if (key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN') || key.includes('AUTH')) {
          group = 'security';
        } else if (key.includes('PORT') || key.includes('HOST') || key.includes('ENV') || key.includes('LOG')) {
          group = 'server';
        }
        
        if (group === state.activeGroup) {
          filteredVariables[key] = value;
        }
      }
    }
    
    // 変数をソートして表示
    const sortedKeys = Object.keys(filteredVariables).sort();
    
    // フィルター結果の件数を読み上げる
    const notificationArea = document.getElementById('notification-area');
    if (notificationArea && state.activeGroup) {
      notificationArea.textContent = `${state.activeGroup}グループの環境変数が${sortedKeys.length}件見つかりました`;
    }
    
    sortedKeys.forEach(key => {
      const value = filteredVariables[key];
      const isConfigured = value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】';
      
      const variableItem = document.createElement('div');
      variableItem.className = `env-variable-item ${isConfigured ? 'configured' : 'unconfigured'}`;
      variableItem.setAttribute('role', 'listitem');
      
      const variableId = `var-${key.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      variableItem.innerHTML = `
        <div class="env-variable-name" id="${variableId}-label">${key}</div>
        <input type="text" class="env-variable-value" 
          id="${variableId}-input" 
          value="${value}" 
          placeholder="値を入力" 
          aria-labelledby="${variableId}-label"
          ${isConfigured ? 'aria-describedby="configured-message"' : 'aria-describedby="unconfigured-message"'}>
        <div class="env-variable-actions">
          <button class="app-button-icon save-variable" 
            aria-label="${key}の値を保存" 
            title="保存">✓</button>
          <button class="app-button-icon suggest-value" 
            aria-label="${key}の推奨値を設定" 
            title="推奨値">💡</button>
        </div>
      `;
      
      // 保存ボタンのイベントリスナー
      const saveButton = variableItem.querySelector('.save-variable');
      if (saveButton) {
        saveButton.addEventListener('click', () => {
          const input = variableItem.querySelector('.env-variable-value');
          if (input) {
            saveEnvironmentVariable(key, input.value);
          }
        });
      }
      
      // 推奨値ボタンのイベントリスナー
      const suggestButton = variableItem.querySelector('.suggest-value');
      if (suggestButton) {
        suggestButton.addEventListener('click', () => {
          const input = variableItem.querySelector('.env-variable-value');
          if (input) {
            const suggestedValue = getSuggestedValue(key);
            input.value = suggestedValue;
            
            // スクリーンリーダー用に通知
            if (notificationArea) {
              notificationArea.textContent = `${key}に推奨値「${suggestedValue}」を設定しました`;
            }
          }
        });
      }
      
      elements.envVariablesContainer.appendChild(variableItem);
    });
    
    // スクリーンリーダー用の補足説明を追加
    if (!document.getElementById('configured-message')) {
      const configuredMsg = document.createElement('div');
      configuredMsg.id = 'configured-message';
      configuredMsg.className = 'sr-only';
      configuredMsg.textContent = '設定済みの環境変数です';
      document.body.appendChild(configuredMsg);
      
      const unconfiguredMsg = document.createElement('div');
      unconfiguredMsg.id = 'unconfigured-message';
      unconfiguredMsg.className = 'sr-only';
      unconfiguredMsg.textContent = 'まだ設定されていない環境変数です';
      document.body.appendChild(unconfiguredMsg);
    }
  }
  
  // 環境変数を保存
  function saveEnvironmentVariable(key, value) {
    vscode.postMessage({
      command: 'saveEnvironmentVariable',
      variableName: key,
      variableValue: value,
      variableFilePath: state.activeEnvFile
    });
    
    // スクリーンリーダー用に通知
    const notificationArea = document.getElementById('notification-area');
    if (notificationArea) {
      notificationArea.textContent = `${key}の値を保存しました`;
    }
  }
  
  // 環境変数グループリストを更新
  function updateEnvGroupsList() {
    if (!elements.envGroupsContainer) return;
    
    // 各グループの要素をアクティブ状態に更新
    const groupElements = elements.envGroupsContainer.querySelectorAll('.env-group');
    
    groupElements.forEach(groupElement => {
      const groupId = groupElement.dataset.groupId;
      
      // アクティブ状態を更新
      if (groupId === state.activeGroup) {
        groupElement.classList.add('active');
        groupElement.setAttribute('aria-selected', 'true');
      } else {
        groupElement.classList.remove('active');
        groupElement.setAttribute('aria-selected', 'false');
      }
      
      // グループの状態を更新
      if (state.activeEnvFile && state.envVariables[state.activeEnvFile]) {
        const variables = state.envVariables[state.activeEnvFile];
        let groupCount = 0;
        let configuredCount = 0;
        
        for (const key in variables) {
          const value = variables[key];
          
          let group = 'other';
          if (key.startsWith('DB_')) {
            group = 'database';
          } else if (key.includes('API') || key.includes('URL')) {
            group = 'api';
          } else if (key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN') || key.includes('AUTH')) {
            group = 'security';
          } else if (key.includes('PORT') || key.includes('HOST') || key.includes('ENV') || key.includes('LOG')) {
            group = 'server';
          }
          
          if (group === groupId) {
            groupCount++;
            if (value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】') {
              configuredCount++;
            }
          }
        }
        
        // グループの状態表示を更新
        const groupStatus = groupElement.querySelector('.group-status');
        if (groupStatus) {
          groupStatus.textContent = `${configuredCount}/${groupCount} 設定済み`;
        }
        
        // アクセシビリティ属性の更新
        const groupLabel = groupElement.querySelector('h3').textContent;
        groupElement.setAttribute('aria-label', 
          `${groupLabel} グループ - ${configuredCount}/${groupCount} 設定済み${groupId === state.activeGroup ? '（選択中）' : ''}`
        );
      }
      
      // イベントリスナーをクリア
      const newGroupElement = groupElement.cloneNode(true);
      groupElement.parentNode.replaceChild(newGroupElement, groupElement);
      
      // グループクリックイベントリスナー
      newGroupElement.addEventListener('click', () => {
        toggleGroupFilter(groupId);
      });
      
      // キーボードナビゲーション対応
      newGroupElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleGroupFilter(groupId);
        }
      });
    });
    
    // キーボードナビゲーションのための矢印キー対応
    elements.envGroupsContainer.addEventListener('keydown', handleGroupKeyNavigation);
  }
  
  // グループフィルターの切り替え
  function toggleGroupFilter(groupId) {
    if (state.activeGroup === groupId) {
      // 同じグループを選択した場合はフィルターを解除
      state.activeGroup = null;
      
      // 通知
      const notificationArea = document.getElementById('notification-area');
      if (notificationArea) {
        notificationArea.textContent = `フィルターを解除しました`;
      }
    } else {
      state.activeGroup = groupId;
      
      // グループ名を取得
      const groupElements = elements.envGroupsContainer.querySelectorAll('.env-group');
      let groupName = groupId;
      groupElements.forEach(el => {
        if (el.dataset.groupId === groupId) {
          groupName = el.querySelector('h3').textContent;
        }
      });
      
      // 通知
      const notificationArea = document.getElementById('notification-area');
      if (notificationArea) {
        notificationArea.textContent = `${groupName}グループでフィルターしました`;
      }
    }
    
    // 状態を保存
    vscode.setState(state);
    
    // 環境変数リストを更新
    updateEnvVariablesList();
    updateEnvGroupsList();
  }
  
  // グループリストのキーボードナビゲーション
  function handleGroupKeyNavigation(e) {
    const groups = Array.from(elements.envGroupsContainer.querySelectorAll('.env-group'));
    if (!groups.length) return;
    
    const currentFocusIndex = groups.findIndex(g => g === document.activeElement);
    if (currentFocusIndex === -1) return;
    
    let nextIndex = currentFocusIndex;
    
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (currentFocusIndex + 1) % groups.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = (currentFocusIndex - 1 + groups.length) % groups.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = groups.length - 1;
        break;
      default:
        return;
    }
    
    groups[nextIndex].focus();
  }
  
  // 接続設定を取得
  function getConnectionConfig(connectionType) {
    if (!state.activeEnvFile || !state.envVariables[state.activeEnvFile]) {
      return {};
    }
    
    const variables = state.envVariables[state.activeEnvFile];
    
    if (connectionType === 'database') {
      return {
        host: variables['DB_HOST'] || '',
        port: variables['DB_PORT'] || '',
        database: variables['DB_NAME'] || '',
        user: variables['DB_USER'] || '',
        password: variables['DB_PASSWORD'] || ''
      };
    } else if (connectionType === 'api') {
      return {
        url: variables['API_URL'] || variables['REACT_APP_API_URL'] || '',
        key: variables['API_KEY'] || ''
      };
    }
    
    return {};
  }
  
  // 推奨値を取得
  function getSuggestedValue(name) {
    // 変数名に基づいて推奨値を提案
    if (name === 'DB_HOST') {
      return 'localhost';
    } else if (name === 'DB_PORT') {
      return '5432';  // PostgreSQL標準ポート
    } else if (name === 'DB_NAME') {
      return 'appgenius_db';
    } else if (name === 'DB_USER') {
      return 'postgres';
    } else if (name === 'NODE_ENV') {
      return 'development';
    } else if (name === 'PORT') {
      return '3000';
    } else if (name === 'JWT_EXPIRY') {
      return '1h';
    } else if (name === 'REFRESH_TOKEN_EXPIRY') {
      return '7d';
    } else if (name === 'LOG_LEVEL') {
      return 'info';
    } else if (name.includes('SECRET') || name.includes('KEY')) {
      return generateSecureRandomString(32);
    } else {
      return '【要設定】';
    }
  }
  
  // セキュアなランダム文字列を生成
  function generateSecureRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    
    return result;
  }
  
  // トースト通知を表示
  function showToast(message, type = 'info') {
    // 既存のトーストを削除
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // 新しいトーストを作成
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    
    // アイコンを追加
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    
    // タイプに応じたアイコンを設定
    switch (type) {
      case 'success':
        iconSpan.textContent = '✓';
        toast.setAttribute('aria-label', `成功: ${message}`);
        break;
      case 'error':
        iconSpan.textContent = '✗';
        toast.setAttribute('aria-label', `エラー: ${message}`);
        break;
      case 'warning':
        iconSpan.textContent = '⚠';
        toast.setAttribute('aria-label', `警告: ${message}`);
        break;
      default:
        iconSpan.textContent = 'ℹ';
        toast.setAttribute('aria-label', `情報: ${message}`);
    }
    
    // メッセージテキスト用のspan
    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;
    
    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.setAttribute('aria-label', '通知を閉じる');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    });
    
    // 要素を追加
    toast.appendChild(iconSpan);
    toast.appendChild(messageSpan);
    toast.appendChild(closeButton);
    
    // トーストを表示
    document.body.appendChild(toast);
    
    // アニメーションを適用
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // 数秒後に自動的に消える
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(toast)) {
            toast.remove();
          }
        }, 300);
      }
    }, 5000);
    
    // スクリーンリーダー用の通知エリアにも追加
    const notificationArea = document.getElementById('notification-area');
    if (notificationArea) {
      notificationArea.textContent = message;
    }
  }
  
  // 初期化
  function initialize() {
    // 保存された状態を復元
    restoreState();
    
    // DOM要素をキャッシュ
    cacheElements();
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // メッセージハンドラを設定
    setupMessageHandler();
    
    // UIを更新
    updateUI();
    
    // 初期化完了メッセージを送信
    vscode.postMessage({
      command: 'initialize'
    });
  }
  
  // ページロード時に初期化
  document.addEventListener('DOMContentLoaded', initialize);
})();