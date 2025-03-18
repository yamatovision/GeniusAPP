(function() {
  // VSCode APIアクセス
  const vscode = acquireVsCodeApi();
  
  // デバッグログ関数
  function debugLog(message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[EnvAssistant][${timestamp}] ${message}`, data || '');
  }
  
  // 状態を保持
  let state = {
    envFiles: [],
    activeEnvFile: null,
    envVariables: {},
    progress: {
      total: 0,
      configured: 0
    },
    projectPath: ''
  };
  
  // 初期化時にデバッグログ
  debugLog('環境変数アシスタントを初期化中');
  
  // DOM要素のキャッシュ
  let elements = {
    envList: null,
    progressValue: null,
    progressBar: null,
    aiSuggestionText: null,
    autoDetectButton: null,
    saveAllButton: null,
    launchClaudeButton: null
  };
  
  // DOM要素にIDを付与（Claude UI連携用）
  function assignClaudeIds() {
    // すでにIDが割り当てられている要素はスキップするためのマップ
    const assignedIds = new Map();
    
    // 重要なUI要素にIDを割り当て（階層的に処理）
    function assignIdsRecursively(element, prefix, index = 0) {
      // すでに割り当て済みならスキップ
      if (assignedIds.has(element)) {
        return;
      }
      
      // IDを生成して割り当て
      const id = `${prefix}-${index}`;
      element.setAttribute('data-claude-id', id);
      assignedIds.set(element, id);
      
      // 子要素も処理
      const children = element.children;
      for (let i = 0; i < children.length; i++) {
        assignIdsRecursively(children[i], `${id}-child`, i);
      }
    }
    
    // 主要コンテナ要素にIDを割り当て
    const containers = document.querySelectorAll('.container, .main-content, .env-list, .guide-panel, .footer');
    containers.forEach((container, index) => {
      assignIdsRecursively(container, `container`, index);
    });
    
    // ボタン要素にIDを割り当て
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button, index) => {
      // ボタンテキストを使用してIDを作成
      const buttonText = button.textContent.trim().toLowerCase().replace(/\s+/g, '-');
      assignIdsRecursively(button, `button-${buttonText}`, index);
    });
    
    // 入力要素にIDを割り当て
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const inputType = input.getAttribute('type') || input.tagName.toLowerCase();
      let idPrefix = `input`;
      
      // 名前や属性から推測
      if (input.name) {
        idPrefix = `input-${input.name}`;
      } else if (input.id) {
        idPrefix = `input-${input.id}`;
      } else if (input.placeholder) {
        idPrefix = `input-${input.placeholder.toLowerCase().replace(/\s+/g, '-')}`;
      }
      
      assignIdsRecursively(input, idPrefix, index);
    });
  }
  
  // 保存された状態を復元
  function restoreState() {
    const savedState = vscode.getState();
    if (savedState) {
      state = {...state, ...savedState};
      debugLog('状態を復元しました', state);
    } else {
      debugLog('保存された状態がありません');
    }
  }
  
  // DOM要素を取得してキャッシュ
  function cacheElements() {
    elements.envList = document.querySelector('.env-list');
    elements.progressValue = document.getElementById('progress-value');
    elements.progressBar = document.querySelector('.progress-value');
    elements.aiSuggestionText = document.getElementById('ai-suggestion-text');
    elements.autoDetectButton = document.getElementById('auto-detect-variables');
    elements.saveAllButton = document.getElementById('save-all-variables');
    elements.launchClaudeButton = document.getElementById('launch-claude-assistant');
    
    // 各要素の存在をログに記録
    debugLog('DOM要素を取得:',
      {
        envList: !!elements.envList,
        progressValue: !!elements.progressValue,
        progressBar: !!elements.progressBar,
        aiSuggestionText: !!elements.aiSuggestionText,
        autoDetectButton: !!elements.autoDetectButton,
        saveAllButton: !!elements.saveAllButton,
        launchClaudeButton: !!elements.launchClaudeButton
      }
    );
  }
  
  // イベントリスナーを設定
  function setupEventListeners() {
    // AIアシスタント起動ボタンのみを残す
    if (elements.launchClaudeButton) {
      elements.launchClaudeButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'launchClaudeCodeAssistant'
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
          
        case 'requestDOMSnapshot':
          handleDOMSnapshotRequest();
          break;
          
        case 'executeAction':
          handleExecuteAction(message.action);
          break;
      }
    });
  }
  
  // 状態更新を処理
  function handleUpdateState(message) {
    debugLog('状態更新メッセージを受信:', message);
    
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
    debugLog('新しい状態を保存:', state);
    
    // UIを更新
    updateUI();
  }
  
  // エラーメッセージを処理
  function handleShowError(message) {
    // エラーメッセージをUIに表示（簡易的な実装）
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // UIの先頭に表示
    const container = document.querySelector('.container');
    if (container && container.firstChild) {
      container.insertBefore(errorDiv, container.firstChild);
    } else if (container) {
      container.appendChild(errorDiv);
    }
    
    // 一定時間後に削除
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }
  
  // 接続テストの開始を処理
  function handleConnectionTestStart(message) {
    const { connectionType, name } = message;
    
    // 対応するカードを見つける
    const card = document.querySelector(`.env-card[data-name="${name}"]`);
    if (card) {
      // 既存の結果表示を削除
      const existingResult = card.querySelector('.connection-test-result');
      if (existingResult) {
        existingResult.remove();
      }
      
      // テスト中のメッセージを表示
      const testingDiv = document.createElement('div');
      testingDiv.className = 'connection-test-result testing';
      testingDiv.innerHTML = `
        <div class="spinner-small"></div>
        <span>接続テスト実行中...</span>
      `;
      card.appendChild(testingDiv);
      
      // テストボタンを無効化
      const testButton = card.querySelector('.button-test');
      if (testButton) {
        testButton.disabled = true;
        testButton.textContent = 'テスト中...';
      }
    }
  }
  
  // 接続テスト結果を処理
  function handleConnectionTestResult(message) {
    const { connectionType, success, verified, lastVerified, message: resultMessage } = message;
    
    // 対応するカードをname属性で探す（データ型ではなく変数名で検索）
    const cards = document.querySelectorAll(`.env-card`);
    let targetCard = null;
    
    // 該当するカードを探す
    cards.forEach(card => {
      const input = card.querySelector('.env-input');
      if (input && input.dataset.name && getConnectionType(input.dataset.name, card.getAttribute('data-category')) === connectionType) {
        targetCard = card;
      }
    });
    
    if (targetCard) {
      // 既存の結果表示を削除
      const existingResult = targetCard.querySelector('.connection-test-result');
      if (existingResult) {
        existingResult.remove();
      }
      
      // テストボタンを再有効化
      const testButton = targetCard.querySelector('.button-test');
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = verified ? '接続テスト済み' : '接続テスト';
        
        // 検証済みなら色を変える
        if (verified) {
          testButton.classList.add('verified');
        } else {
          testButton.classList.remove('verified');
        }
      }
      
      // 新しい結果を表示
      const resultDiv = document.createElement('div');
      resultDiv.className = `connection-test-result ${success ? 'success' : 'error'}`;
      
      // 結果内容を構築
      let resultContent = resultMessage;
      
      // 検証状態を追加
      if (success) {
        if (verified) {
          resultContent += `<div class="verification-badge verified">✓ 接続確認済み</div>`;
          if (lastVerified) {
            const date = new Date(lastVerified);
            resultContent += `<div class="verification-time">テスト日時: ${date.toLocaleString()}</div>`;
          }
        } else {
          resultContent += `<div class="verification-badge format-only">⚠ 形式確認のみ</div>`;
        }
      }
      
      resultDiv.innerHTML = resultContent;
      targetCard.appendChild(resultDiv);
      
      // 環境変数カードのステータスクラスを更新
      if (success) {
        if (verified) {
          targetCard.classList.add('verified');
          
          // ステータスアイコンも更新
          const statusIcon = targetCard.querySelector('.status-icon');
          if (statusIcon) {
            statusIcon.classList.add('verified');
            statusIcon.classList.remove('completed', 'warning');
            
            // 親要素のテキスト更新
            const statusText = statusIcon.parentElement;
            if (statusText) {
              statusText.textContent = '接続確認済み';
            }
          }
        }
      }
    }
  }
  
  // DOM構造のスナップショットリクエストを処理
  function handleDOMSnapshotRequest() {
    // DOM構造のスナップショットを作成
    const snapshot = captureDOMSnapshot();
    
    // スナップショットをVSCodeに送信
    vscode.postMessage({
      command: 'captureDOMSnapshot',
      data: snapshot
    });
  }
  
  // アクション実行リクエストを処理
  function handleExecuteAction(action) {
    // アクションのタイプによって処理を分岐
    switch (action.type) {
      case 'click':
        executeClickAction(action);
        break;
        
      case 'input':
        executeInputAction(action);
        break;
        
      case 'select':
        executeSelectAction(action);
        break;
        
      case 'scroll':
        executeScrollAction(action);
        break;
        
      case 'wait':
        // タイマーを使用して指定した時間だけ待機
        // 実装は特になし（VSCode側のタイムアウトで処理）
        break;
    }
  }
  
  // クリックアクションを実行
  function executeClickAction(action) {
    const { targetElementId, altTargetSelector } = action;
    
    // IDで要素を検索
    let element = document.querySelector(`[data-claude-id="${targetElementId}"]`);
    
    // 見つからなければ代替セレクタを使用
    if (!element && altTargetSelector) {
      element = document.querySelector(altTargetSelector);
    }
    
    // 要素が見つかった場合はクリック
    if (element) {
      element.click();
      return true;
    }
    
    return false;
  }
  
  // 入力アクションを実行
  function executeInputAction(action) {
    const { targetElementId, altTargetSelector, value } = action;
    
    // IDで要素を検索
    let element = document.querySelector(`[data-claude-id="${targetElementId}"]`);
    
    // 見つからなければ代替セレクタを使用
    if (!element && altTargetSelector) {
      element = document.querySelector(altTargetSelector);
    }
    
    // 要素が見つかった場合は値を設定
    if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT')) {
      element.value = value;
      
      // イベントをディスパッチ
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  }
  
  // 選択アクションを実行
  function executeSelectAction(action) {
    const { targetElementId, altTargetSelector, value } = action;
    
    // IDで要素を検索
    let element = document.querySelector(`[data-claude-id="${targetElementId}"]`);
    
    // 見つからなければ代替セレクタを使用
    if (!element && altTargetSelector) {
      element = document.querySelector(altTargetSelector);
    }
    
    // 要素が見つかった場合は値を選択
    if (element && element.tagName === 'SELECT') {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  }
  
  // スクロールアクションを実行
  function executeScrollAction(action) {
    const { targetElementId, altTargetSelector } = action;
    
    // IDで要素を検索
    let element = document.querySelector(`[data-claude-id="${targetElementId}"]`);
    
    // 見つからなければ代替セレクタを使用
    if (!element && altTargetSelector) {
      element = document.querySelector(altTargetSelector);
    }
    
    // 要素が見つかった場合はスクロール
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    } else {
      // 要素が指定されていない場合は座標指定のスクロール
      if (action.x !== undefined && action.y !== undefined) {
        window.scrollTo({ top: action.y, left: action.x, behavior: 'smooth' });
        return true;
      }
    }
    
    return false;
  }
  
  // UIを更新
  function updateUI() {
    debugLog('UIを更新開始');
    
    // 進捗状況の更新
    updateProgress();
    
    // 環境変数リストの更新
    updateEnvList();
    
    debugLog('UIの更新完了');
  }
  
  // 進捗状況を更新
  function updateProgress() {
    debugLog('進捗状況更新:', state.progress);
    
    if (elements.progressValue && state.progress) {
      elements.progressValue.textContent = `${state.progress.configured}/${state.progress.total}`;
      debugLog('進捗テキスト更新完了');
    } else {
      debugLog('進捗表示エレメントが見つからないか、進捗情報がありません', {
        progressValueExists: !!elements.progressValue,
        progressExists: !!state.progress
      });
    }
    
    if (elements.progressBar && state.progress && state.progress.total > 0) {
      try {
        const percentage = (state.progress.configured / state.progress.total) * 100;
        elements.progressBar.style.width = `${percentage}%`;
        debugLog('進捗バー更新完了', { percentage });
      } catch (error) {
        debugLog('進捗バー更新エラー', error);
      }
    } else {
      debugLog('進捗バーが見つからないか、進捗情報が不完全です', {
        progressBarExists: !!elements.progressBar,
        progressExists: !!state.progress,
        totalExists: state.progress ? !!state.progress.total : false
      });
    }
  }
  
  // 環境変数リストの更新
  function updateEnvList() {
    debugLog('環境変数リストの更新を開始');
    
    // envListがない場合は何もしない
    if (!elements.envList) {
      debugLog('環境変数リスト要素が見つかりません');
      return;
    }
    
    // envListをクリア
    elements.envList.innerHTML = '';
    debugLog('環境変数リストをクリア');
    
    // アクティブなファイルがない場合はメッセージを表示
    if (!state.activeEnvFile) {
      debugLog('アクティブな環境変数ファイルがありません');
      const message = document.createElement('div');
      message.className = 'no-file-message';
      message.textContent = 'env.mdとCLAUDE.mdから環境変数情報を読み込み中です。「AIアシスタントを起動」をクリックして、必要な環境変数を分析してください。';
      elements.envList.appendChild(message);
      return;
    }
    
    debugLog('アクティブなファイル:', state.activeEnvFile);
    
    // アクティブなファイルの変数がない場合はメッセージを表示
    const activeVars = state.envVariables[state.activeEnvFile];
    debugLog('アクティブなファイルの変数:', {
      exists: !!activeVars,
      count: activeVars ? Object.keys(activeVars).length : 0,
      sampleKeys: activeVars ? Object.keys(activeVars).slice(0, 3) : []
    });
    
    if (!activeVars || Object.keys(activeVars).length === 0) {
      debugLog('環境変数情報が見つかりません');
      const message = document.createElement('div');
      message.className = 'no-variables-message';
      message.textContent = 'env.mdからの環境変数情報が見つかりません。「プロジェクト分析を開始」をクリックしてプロジェクトに必要な環境変数を特定してください。';
      elements.envList.appendChild(message);
      return;
    }
    
    // カテゴリセクションを作成
    const categories = {
      'database': { title: 'データベース設定', items: [] },
      'api': { title: 'API設定', items: [] },
      'security': { title: 'セキュリティ設定', items: [] },
      'server': { title: 'サーバー設定', items: [] },
      'other': { title: 'その他の設定', items: [] }
    };
    
    // 環境変数をカテゴリごとに分類
    Object.entries(activeVars).forEach(([name, value]) => {
      const category = detectVariableCategory(name);
      
      // 変数情報を作成
      const isRequired = isRequiredVariable(name, category);
      const isSensitive = isSensitiveVariable(name);
      
      // 設定状態を判定
      const needsConfiguration = typeof value === 'string' && (
        value.includes('【要設定】') || 
        value.includes('your-') || 
        value === 'dbpassword' ||
        value.includes('実際の値で置き換え')
      );
      const isConfigured = value && !needsConfiguration;
      
      // 変数情報をカテゴリに追加
      if (categories[category]) {
        categories[category].items.push({
          name,
          value,
          isRequired,
          isSensitive,
          isConfigured,
          needsConfiguration
        });
      } else {
        categories['other'].items.push({
          name,
          value,
          isRequired,
          isSensitive,
          isConfigured,
          needsConfiguration
        });
      }
    });
    
    // サマリー情報を作成 - 一番上に表示
    const totalVars = Object.keys(activeVars).length;
    const configuredVars = Object.values(categories).reduce((sum, cat) => sum + cat.items.filter(item => item.isConfigured).length, 0);
    const needsConfigVars = Object.values(categories).reduce((sum, cat) => sum + cat.items.filter(item => item.needsConfiguration).length, 0);
    
    const summarySection = document.createElement('div');
    summarySection.className = 'env-summary-section';
    summarySection.innerHTML = `
      <div class="summary-header">
        <h3>環境変数設定状況</h3>
      </div>
      <div class="summary-content">
        <div class="summary-item">
          <div class="summary-label">合計</div>
          <div class="summary-value">${totalVars}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">設定済み</div>
          <div class="summary-value ${configuredVars === totalVars ? 'completed' : ''}">${configuredVars}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">要設定</div>
          <div class="summary-value ${needsConfigVars > 0 ? 'warning' : ''}">${needsConfigVars}</div>
        </div>
      </div>
    `;
    // サマリーセクションをリストの先頭に追加
    elements.envList.appendChild(summarySection);
    
    // 各カテゴリのセクションを作成し追加
    Object.entries(categories).forEach(([categoryId, categoryData]) => {
      // 項目がないカテゴリはスキップ
      if (categoryData.items.length === 0) {
        return;
      }
      
      // カテゴリセクションを作成
      const section = document.createElement('div');
      section.className = `env-section ${categoryId}-section`;
      
      // カテゴリヘッダーを追加
      const header = document.createElement('div');
      header.className = 'env-section-header';
      header.innerHTML = `
        <h3>${categoryData.title}</h3>
        <div class="section-status">
          設定済み: ${categoryData.items.filter(item => item.isConfigured).length}/${categoryData.items.length}
        </div>
      `;
      section.appendChild(header);
      
      // 各環境変数カードを追加
      categoryData.items.forEach(item => {
        // カードの作成
        const card = document.createElement('div');
        card.className = `env-card ${item.isRequired ? 'required' : 'optional'} ${item.isConfigured ? 'completed' : ''} ${item.needsConfiguration ? 'needs-config' : ''}`;
        card.setAttribute('data-name', item.name);
        card.setAttribute('data-category', categoryId);
        card.setAttribute('data-claude-id', `env-card-${item.name}`);
        
        // カードの内容を構築
        card.innerHTML = `
          <div class="env-card-header">
            <div class="env-name">
              ${item.name}
              <span class="badge ${item.isRequired ? 'required' : 'optional'}">${item.isRequired ? '必須' : '任意'}</span>
            </div>
            <div class="env-status">
              <div class="status-icon ${item.isConfigured ? 'completed' : (item.needsConfiguration ? 'warning' : '')}"></div>
              ${item.isConfigured ? '設定済み' : (item.needsConfiguration ? '要設定' : '未設定')}
            </div>
          </div>
          <div class="env-description">
            ${getVariableDescription(item.name, categoryId)}
          </div>
          <div class="env-input-group">
            <input type="text" class="env-input" value="${item.isSensitive && item.value ? '********' : item.value || ''}" 
                   placeholder="${getPlaceholder(item.name, categoryId)}" 
                   data-name="${item.name}" 
                   data-mask="${item.isSensitive}"
                   data-claude-id="input-${item.name}">
          </div>
          <div class="env-actions">
            ${getActionButtons(item.name, categoryId, item.isSensitive)}
          </div>
        `;
        
        // カードを追加
        section.appendChild(card);
        
        // 入力フィールドのイベントリスナーを設定
        const input = card.querySelector('.env-input');
        if (input) {
          input.addEventListener('change', () => {
            saveEnvironmentVariable(item.name, input.value);
          });
        }
        
        // ボタンのイベントリスナーを設定
        setupCardButtonListeners(card, item.name, categoryId);
      });
      
      // セクションをリストに追加
      elements.envList.appendChild(section);
    });
  }
  
  // 環境変数カードのボタンリスナーを設定
  function setupCardButtonListeners(card, name, category) {
    // 保存ボタン
    const saveButton = card.querySelector('.button-save');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        const input = card.querySelector('.env-input');
        if (input) {
          saveEnvironmentVariable(name, input.value);
        }
      });
    }
    
    // 値生成ボタン
    const generateButton = card.querySelector('.button-generate');
    if (generateButton) {
      generateButton.addEventListener('click', () => {
        const input = card.querySelector('.env-input');
        if (input) {
          input.value = generateSecureValue(name, category);
          saveEnvironmentVariable(name, input.value);
        }
      });
    }
    
    // テストボタン
    const testButton = card.querySelector('.button-test');
    if (testButton) {
      testButton.addEventListener('click', () => {
        const connectionType = getConnectionType(name, category);
        testConnection(connectionType, {
          name,
          value: card.querySelector('.env-input').value
        });
      });
    }
  }
  
  // DOM構造のスナップショットを取得
  function captureDOMSnapshot() {
    // ページ全体の要素を取得
    const elements = [];
    
    // data-claude-id属性を持つ要素を取得
    document.querySelectorAll('[data-claude-id]').forEach(el => {
      // 要素の基本情報を収集
      const rect = el.getBoundingClientRect();
      
      // 入力要素の場合は値も取得
      let value = null;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        value = el.value;
      }
      
      // 属性を収集
      const attributes = {};
      Array.from(el.attributes).forEach(attr => {
        attributes[attr.name] = attr.value;
      });
      
      // 子要素のIDを収集
      const childIds = [];
      Array.from(el.children).forEach(child => {
        const childId = child.getAttribute('data-claude-id');
        if (childId) {
          childIds.push(childId);
        }
      });
      
      // 親要素のIDを取得
      const parentId = el.parentElement ? el.parentElement.getAttribute('data-claude-id') : null;
      
      // 要素情報をスナップショットに追加
      elements.push({
        id: el.getAttribute('data-claude-id'),
        type: el.tagName.toLowerCase(),
        text: el.textContent,
        isVisible: isElementVisible(el),
        isEnabled: !el.disabled,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        parentId,
        childIds,
        attributes,
        value
      });
    });
    
    // スナップショット情報
    return {
      timestamp: Date.now(),
      elements,
      activeElementId: document.activeElement ? document.activeElement.getAttribute('data-claude-id') : null,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      currentScreenshot: `screenshot_${Date.now()}.png`
    };
  }
  
  // 要素が可視かどうかを判定
  function isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null;
  }
  
  // 環境変数を保存
  function saveEnvironmentVariable(name, value) {
    vscode.postMessage({
      command: 'saveEnvironmentVariable',
      variableName: name,
      variableValue: value,
      variableFilePath: state.activeEnvFile
    });
  }
  
  // 接続テストを実行
  function testConnection(connectionType, config) {
    vscode.postMessage({
      command: 'testConnection',
      connectionType,
      config
    });
  }
  
  // 安全な値を生成
  function generateSecureValue(name, category) {
    const lowerName = name.toLowerCase();
    
    // JWT/シークレット系
    if (lowerName.includes('secret') || lowerName.includes('key') || lowerName.includes('token') || lowerName.includes('jwt')) {
      return generateRandomString(32);
    }
    
    // パスワード系
    if (lowerName.includes('password')) {
      return generateRandomString(16);
    }
    
    // API Key系
    if (lowerName.includes('api') && lowerName.includes('key')) {
      return `API_${generateRandomString(24)}`;
    }
    
    // その他
    return generateRandomString(16);
  }
  
  // ランダムな文字列を生成
  function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  // 変数カテゴリを検出
  function detectVariableCategory(name) {
    const lowercaseName = name.toLowerCase();
    
    if (lowercaseName.includes('db') || lowercaseName.includes('database') || lowercaseName.includes('mongo') || lowercaseName.includes('sql')) {
      return 'database';
    }
    
    if (lowercaseName.includes('api') || lowercaseName.includes('endpoint') || lowercaseName.includes('url') || lowercaseName.includes('uri')) {
      return 'api';
    }
    
    if (lowercaseName.includes('secret') || lowercaseName.includes('key') || lowercaseName.includes('token') || lowercaseName.includes('password') || lowercaseName.includes('auth')) {
      return 'security';
    }
    
    if (lowercaseName.includes('port') || lowercaseName.includes('host') || lowercaseName.includes('env') || lowercaseName.includes('debug') || lowercaseName.includes('log')) {
      return 'server';
    }
    
    return 'other';
  }
  
  // 変数が必須かどうか判定
  function isRequiredVariable(name, category) {
    // 一般的に必須とされる変数名のリスト
    const requiredVars = [
      'NODE_ENV', 'PORT', 'DATABASE_URL', 'API_KEY', 'JWT_SECRET', 'SECRET_KEY', 'DB_PASSWORD'
    ];
    
    // 名前が完全一致する場合は必須
    if (requiredVars.includes(name)) {
      return true;
    }
    
    // データベースとセキュリティカテゴリは基本的に必須
    if (category === 'database' || category === 'security') {
      return true;
    }
    
    return false;
  }
  
  // 変数が機密情報かどうか判定
  function isSensitiveVariable(name) {
    const lowercaseName = name.toLowerCase();
    
    // パスワード、キー、トークン、シークレットなどの単語を含む場合は機密
    return lowercaseName.includes('password') ||
      lowercaseName.includes('secret') ||
      lowercaseName.includes('key') ||
      lowercaseName.includes('token') ||
      lowercaseName.includes('auth') ||
      lowercaseName.includes('credentials');
  }
  
  // 接続タイプを取得
  function getConnectionType(name, category) {
    const lowercaseName = name.toLowerCase();
    
    if (category === 'database' || lowercaseName.includes('db') || lowercaseName.includes('database')) {
      return 'database';
    }
    
    if (category === 'api' || lowercaseName.includes('api')) {
      return 'api';
    }
    
    if (lowercaseName.includes('smtp') || lowercaseName.includes('mail')) {
      return 'smtp';
    }
    
    return 'general';
  }
  
  // アクションボタンを取得
  function getActionButtons(name, category, isSensitive) {
    let buttons = '';
    
    // 保存ボタン（すべての変数に表示）
    buttons += `<button class="button button-primary button-save" data-claude-id="button-save-${name}">保存</button>`;
    
    // 機密情報の場合は値生成ボタンを追加
    if (isSensitive) {
      buttons += `<button class="button button-secondary button-generate" data-claude-id="button-generate-${name}">安全な値を生成</button>`;
    }
    
    // 接続テスト可能なカテゴリの場合は検証ボタンを追加
    if (category === 'database' || category === 'api' || name.toLowerCase().includes('smtp')) {
      buttons += `<button class="button button-secondary button-test" data-claude-id="button-test-${name}">接続テスト</button>`;
    }
    
    return buttons;
  }
  
  // プレースホルダーを取得
  function getPlaceholder(name, category) {
    const lowercaseName = name.toLowerCase();
    
    if (lowercaseName.includes('password')) {
      return 'パスワードを入力...';
    }
    
    if (lowercaseName.includes('secret') || lowercaseName.includes('key')) {
      return 'シークレットキーを入力...';
    }
    
    if (lowercaseName.includes('port')) {
      return '3000';
    }
    
    if (lowercaseName.includes('host')) {
      return 'localhost';
    }
    
    if (lowercaseName.includes('url') || lowercaseName.includes('uri')) {
      return 'https://example.com/api';
    }
    
    return '値を入力...';
  }
  
  // 変数の説明を取得
  function getVariableDescription(name, category) {
    // よく使われる変数名に対する説明
    const descriptions = {
      'NODE_ENV': '実行環境（開発/本番）を指定します',
      'PORT': 'アプリケーションが動作するポート番号',
      'DATABASE_URL': 'データベースへの接続URL',
      'API_KEY': 'APIサービスへのアクセスに必要な認証キー',
      'JWT_SECRET': 'JWTトークンの署名に使用する秘密鍵',
      'SECRET_KEY': 'アプリケーションのセキュリティに使用する秘密鍵',
      'DEBUG': 'デバッグモードの有効/無効を設定',
      'ALLOWED_HOSTS': 'アクセスを許可するホスト名のリスト'
    };
    
    // 名前が完全一致する場合は対応する説明を返す
    if (descriptions[name]) {
      return descriptions[name];
    }
    
    // カテゴリに応じた汎用的な説明
    switch (category) {
      case 'database':
        return 'データベース接続に関する設定';
      case 'api':
        return 'API連携に関する設定';
      case 'security':
        return 'セキュリティ関連の設定';
      case 'server':
        return 'サーバー動作に関する設定';
      default:
        return 'アプリケーション設定';
    }
  }
  
  // テーマの適用
  function applyTheme(theme) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    if (theme === 'dark') {
      container.classList.remove('theme-light');
      container.classList.add('theme-dark');
    } else {
      container.classList.remove('theme-dark');
      container.classList.add('theme-light');
    }
  }
  
  // 保存されているテーマを適用
  function applyStoredTheme() {
    const theme = localStorage.getItem('app-theme') || 'light';
    applyTheme(theme);
  }
  
  // テーマ変更イベントのリスナーを設定
  function setupThemeListener() {
    // 保存されているテーマを適用
    applyStoredTheme();
    
    // テーマ変更イベントをリッスン
    document.addEventListener('theme-changed', (e) => {
      applyTheme(e.detail.theme);
    });
  }
  
  // 初期化処理
  function initialize() {
    debugLog('=== 環境変数アシスタント初期化開始 ===');
    
    try {
      // 保存された状態を復元
      restoreState();
      
      // DOM要素にClaudeIdを割り当て
      assignClaudeIds();
      debugLog('Claude IDを割り当て完了');
      
      // DOM要素を取得
      cacheElements();
      
      // イベントリスナーを設定
      setupEventListeners();
      debugLog('イベントリスナー設定完了');
      
      // メッセージハンドラを設定
      setupMessageHandler();
      debugLog('メッセージハンドラ設定完了');
      
      // テーマリスナーを設定
      setupThemeListener();
      debugLog('テーマリスナー設定完了');
      
      // UIを更新
      updateUI();
      
      // HTML構造をログに記録（デバッグ用）
      debugLog('現在のHTML構造:', document.body.innerHTML);
      
      // 初期化完了メッセージを送信
      vscode.postMessage({
        command: 'initialize'
      });
      
      debugLog('=== 環境変数アシスタント初期化完了 ===');
    } catch (error) {
      debugLog('初期化処理中にエラーが発生しました:', error);
    }
  }
  
  // DOMContentLoadedイベントで初期化を開始
  document.addEventListener('DOMContentLoaded', initialize);
  
})();