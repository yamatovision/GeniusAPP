// デバッグ探偵 JavaScript

(function() {
  // VSCode WebView API
  const vscode = acquireVsCodeApi();
  
  // 状態の初期化
  let state = {
    currentErrorSession: null,
    relatedFiles: [],
    detectedErrorType: '',
    sessions: [],
    knowledgeBase: [],
    projectPath: ''
  };
  
  // DOM要素の取得
  const refreshBtn = document.getElementById('refresh-btn');
  const errorLogTextarea = document.getElementById('error-log');
  const scanErrorBtn = document.getElementById('scan-error-btn');
  const addErrorBtn = document.getElementById('add-error-btn');
  const loadLogBtn = document.getElementById('load-log-btn');
  const saveTerminalBtn = document.getElementById('save-terminal-btn');
  const errorSessionsContainer = document.getElementById('error-sessions-container');
  const currentSessionSection = document.getElementById('current-session-section');
  const currentSessionContainer = document.getElementById('current-session-container');
  const relatedFilesSection = document.getElementById('related-files-section');
  const relatedFilesContainer = document.getElementById('related-files-container');
  const startInvestigationBtn = document.getElementById('start-investigation-btn');
  const solutionContainer = document.getElementById('solution-container');
  const solutionActions = document.getElementById('solution-actions');
  const applySolutionBtn = document.getElementById('apply-solution-btn');
  const markResolvedBtn = document.getElementById('mark-resolved-btn');
  const saveKnowledgeCheckbox = document.getElementById('save-knowledge');
  const knowledgeListContainer = document.getElementById('knowledge-list-container');
  const knowledgeDetailSection = document.getElementById('knowledge-detail-section');
  const knowledgeDetailContainer = document.getElementById('knowledge-detail-container');
  const addKnowledgeBtn = document.getElementById('add-knowledge-btn');
  const addKnowledgeModal = document.getElementById('add-knowledge-modal');
  const addKnowledgeForm = document.getElementById('add-knowledge-form');
  const cancelAddKnowledgeBtn = document.getElementById('cancel-add-knowledge');
  const runBackendTestBtn = document.getElementById('run-backend-test-btn');
  const runFrontendTestBtn = document.getElementById('run-frontend-test-btn');
  const runTypecheckBtn = document.getElementById('run-typecheck-btn');
  const runLintBtn = document.getElementById('run-lint-btn');
  const backendTestCommand = document.getElementById('backend-test-command');
  const frontendTestCommand = document.getElementById('frontend-test-command');
  const typecheckCommand = document.getElementById('typecheck-command');
  const lintCommand = document.getElementById('lint-command');
  const knowledgeSearch = document.getElementById('knowledge-search');
  const searchKnowledgeBtn = document.getElementById('search-knowledge-btn');
  const errorTypeFilter = document.getElementById('error-type-filter');
  
  // タブの切り替え
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // アクティブなタブを更新
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // 初期化
  function initialize() {
    // イベントリスナーの登録
    refreshBtn.addEventListener('click', refreshData);
    scanErrorBtn.addEventListener('click', scanErrorLog);
    addErrorBtn.addEventListener('click', addErrorLog);
    loadLogBtn.addEventListener('click', loadLogFile);
    saveTerminalBtn.addEventListener('click', saveTerminalOutput);
    startInvestigationBtn.addEventListener('click', startInvestigation);
    applySolutionBtn.addEventListener('click', applySolution);
    markResolvedBtn.addEventListener('click', markAsResolved);
    addKnowledgeBtn.addEventListener('click', showAddKnowledgeModal);
    cancelAddKnowledgeBtn.addEventListener('click', hideAddKnowledgeModal);
    addKnowledgeForm.addEventListener('submit', handleAddKnowledge);
    runBackendTestBtn.addEventListener('click', runBackendTest);
    runFrontendTestBtn.addEventListener('click', runFrontendTest);
    runTypecheckBtn.addEventListener('click', runTypecheck);
    runLintBtn.addEventListener('click', runLint);
    searchKnowledgeBtn.addEventListener('click', searchKnowledge);
    
    // 初期データの取得
    getErrorSessions();
    
    // メッセージハンドラの登録
    window.addEventListener('message', handleMessages);
  }
  
  // メッセージハンドラ
  function handleMessages(event) {
    const message = event.data;
    
    switch (message.command) {
      case 'updateState':
        updateState(message);
        break;
      case 'errorSessionCreated':
        handleErrorSessionCreated(message);
        break;
      case 'scanResult':
        handleScanResult(message);
        break;
      case 'sessionResolved':
        handleSessionResolved(message);
        break;
      case 'solutionApplied':
        handleSolutionApplied(message);
        break;
      case 'knowledgeAdded':
        handleKnowledgeAdded(message);
        break;
      case 'knowledgeList':
        handleKnowledgeList(message);
        break;
      case 'errorSessions':
        handleErrorSessions(message);
        break;
      case 'errorTypeDetected':
        handleErrorTypeDetected(message);
        break;
      case 'showError':
        showError(message.message);
        break;
    }
  }
  
  // 状態の更新
  function updateState(message) {
    state = {
      ...state,
      currentErrorSession: message.currentErrorSession,
      relatedFiles: message.relatedFiles,
      detectedErrorType: message.detectedErrorType,
      sessions: message.sessions,
      knowledgeBase: message.knowledgeBase,
      projectPath: message.projectPath
    };
    
    // UIの更新
    updateUI();
  }
  
  // UIの更新
  function updateUI() {
    // エラーセッション一覧の更新
    updateErrorSessionsList();
    
    // 現在のエラーセッションの更新
    updateCurrentSession();
    
    // 関連ファイルの更新
    updateRelatedFiles();
    
    // 解決策の更新
    updateSolution();
    
    // 知見ベースの更新
    updateKnowledgeBase();
  }
  
  // エラーセッション一覧の更新
  function updateErrorSessionsList() {
    if (!state.sessions || state.sessions.length === 0) {
      errorSessionsContainer.innerHTML = `
        <div class="empty-state">
          <i class="icon large">📋</i>
          <p>エラーセッションがありません。新しいエラーログを追加してください。</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    state.sessions.forEach(session => {
      // エラーの短い説明を生成
      const errorSummary = session.errorLog ? session.errorLog.split('\n')[0].substring(0, 80) : '不明なエラー';
      
      // 作成日時をフォーマット
      const createdAt = new Date(session.createdAt).toLocaleString();
      
      // ステータスをフォーマット
      let statusText = '';
      let statusClass = '';
      
      switch (session.status) {
        case 'new':
          statusText = '新規';
          statusClass = 'status-new';
          break;
        case 'investigating':
          statusText = '調査中';
          statusClass = 'status-investigating';
          break;
        case 'resolved':
          statusText = '解決済み';
          statusClass = 'status-resolved';
          break;
      }
      
      // エラータイプのスタイル
      let errorTypeClass = '';
      if (session.errorType) {
        if (session.errorType.includes('構文')) errorTypeClass = 'error-type-syntax';
        else if (session.errorType.includes('ファイル')) errorTypeClass = 'error-type-file';
        else if (session.errorType.includes('モジュール')) errorTypeClass = 'error-type-module';
        else if (session.errorType.includes('接続')) errorTypeClass = 'error-type-connection';
        else if (session.errorType.includes('データベース')) errorTypeClass = 'error-type-database';
        else if (session.errorType.includes('認証')) errorTypeClass = 'error-type-auth';
        else if (session.errorType.includes('ビルド')) errorTypeClass = 'error-type-build';
        else if (session.errorType.includes('環境変数')) errorTypeClass = 'error-type-env';
      }
      
      // アクティブなセッションの場合はハイライト
      const isActive = state.currentErrorSession && state.currentErrorSession.id === session.id;
      
      html += `
        <div class="error-session-card ${isActive ? 'active' : ''}" data-id="${session.id}">
          <div class="error-session-header">
            <div class="error-session-title">${session.errorType || '不明なエラー'}</div>
            <div class="error-session-date">${createdAt}</div>
          </div>
          <div class="error-session-summary">${errorSummary}</div>
          <div class="error-session-footer">
            <div class="error-session-type ${errorTypeClass}">${session.errorType || '不明なエラー'}</div>
            <div class="error-session-status ${statusClass}">
              <i class="icon">${getStatusIcon(session.status)}</i>
              ${statusText}
            </div>
          </div>
        </div>
      `;
    });
    
    errorSessionsContainer.innerHTML = html;
    
    // エラーセッションカードのクリックイベントを追加
    document.querySelectorAll('.error-session-card').forEach(card => {
      card.addEventListener('click', () => {
        const sessionId = card.getAttribute('data-id');
        selectErrorSession(sessionId);
      });
    });
  }
  
  // ステータスアイコンの取得
  function getStatusIcon(status) {
    switch (status) {
      case 'new':
        return '🆕';
      case 'investigating':
        return '🔍';
      case 'resolved':
        return '✅';
      default:
        return '❓';
    }
  }
  
  // エラーセッションの選択
  function selectErrorSession(sessionId) {
    const session = state.sessions.find(s => s.id === sessionId);
    
    if (session) {
      state.currentErrorSession = session;
      state.relatedFiles = session.relatedFiles || [];
      state.detectedErrorType = session.errorType || '';
      
      updateCurrentSession();
      updateRelatedFiles();
      updateSolution();
    }
  }
  
  // 現在のエラーセッションの更新
  function updateCurrentSession() {
    if (!state.currentErrorSession) {
      currentSessionSection.style.display = 'none';
      return;
    }
    
    currentSessionSection.style.display = 'block';
    
    // エラーログを整形（最大500行までに制限）
    const errorLogLines = state.currentErrorSession.errorLog.split('\n');
    const truncatedErrorLog = errorLogLines.length > 500
      ? errorLogLines.slice(0, 500).join('\n') + '\n... (truncated)'
      : state.currentErrorSession.errorLog;
    
    // 作成日時をフォーマット
    const createdAt = new Date(state.currentErrorSession.createdAt).toLocaleString();
    
    // ステータスを文字列化
    let statusText = '';
    switch (state.currentErrorSession.status) {
      case 'new':
        statusText = '新規';
        break;
      case 'investigating':
        statusText = '調査中';
        break;
      case 'resolved':
        statusText = '解決済み';
        break;
    }
    
    currentSessionContainer.innerHTML = `
      <div class="session-details">
        <div><strong>ID:</strong> ${state.currentErrorSession.id}</div>
        <div><strong>作成日時:</strong> ${createdAt}</div>
        <div><strong>ステータス:</strong> ${statusText}</div>
        <div><strong>エラータイプ:</strong> ${state.currentErrorSession.errorType || '不明'}</div>
      </div>
      <div class="session-log">${truncatedErrorLog}</div>
    `;
  }
  
  // 関連ファイルの更新
  function updateRelatedFiles() {
    if (!state.currentErrorSession) {
      relatedFilesSection.style.display = 'none';
      return;
    }
    
    relatedFilesSection.style.display = 'block';
    
    if (!state.relatedFiles || state.relatedFiles.length === 0) {
      relatedFilesContainer.innerHTML = `
        <div class="empty-state">
          <p>関連ファイルが見つかりません。手動で追加してください。</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    state.relatedFiles.forEach(filePath => {
      // ファイル名と拡張子を取得
      const parts = filePath.split('/');
      const fileName = parts[parts.length - 1];
      
      const isProjectRelative = filePath.startsWith(state.projectPath);
      const displayPath = isProjectRelative
        ? filePath.substring(state.projectPath.length)
        : filePath;
      
      html += `
        <div class="file-item">
          <input type="checkbox" class="file-checkbox" data-path="${filePath}" checked>
          <div class="file-path" title="${filePath}">${displayPath}</div>
          <div class="file-actions">
            <button class="button" onclick="window.openFile('${filePath}')">
              <i class="icon">📄</i> 開く
            </button>
          </div>
        </div>
      `;
    });
    
    relatedFilesContainer.innerHTML = html;
    
    // ファイルを開く関数をグローバルに追加
    window.openFile = function(filePath) {
      vscode.postMessage({
        command: 'openFile',
        filePath
      });
    };
  }
  
  // 解決策の更新
  function updateSolution() {
    if (!state.currentErrorSession || !state.currentErrorSession.solution) {
      solutionContainer.innerHTML = `
        <div class="empty-state">
          <i class="icon large">🔍</i>
          <p>エラーセッションを選択して調査を開始してください。</p>
        </div>
      `;
      solutionActions.style.display = 'none';
      return;
    }
    
    // 解決済みの場合
    if (state.currentErrorSession.status === 'resolved') {
      solutionContainer.innerHTML = `
        <div class="solution-analysis">
          <div class="solution-title">解決済みの事件</div>
          <p>${state.currentErrorSession.solution}</p>
        </div>
      `;
      solutionActions.style.display = 'none';
      return;
    }
    
    // 解決策がある場合
    solutionContainer.innerHTML = `
      <div class="solution-analysis">
        <div class="solution-title">事件の分析と解決策</div>
        <p>${state.currentErrorSession.solution}</p>
      </div>
    `;
    
    // 解決策が適用される場合
    if (state.currentErrorSession.fileChanges && state.currentErrorSession.fileChanges.length > 0) {
      let fileChangesHtml = `<div class="solution-file-changes">`;
      
      state.currentErrorSession.fileChanges.forEach(change => {
        fileChangesHtml += `
          <div class="file-change">
            <div class="file-change-header">
              ${change.filePath}
            </div>
            <div class="file-change-body">
              <div class="diff-section">
                <div class="diff-header">変更前</div>
                <div class="diff-content before">${change.oldContent || '(新規ファイル)'}</div>
                <div class="diff-header">変更後</div>
                <div class="diff-content after">${change.newContent}</div>
              </div>
            </div>
          </div>
        `;
      });
      
      fileChangesHtml += `</div>`;
      solutionContainer.innerHTML += fileChangesHtml;
    }
    
    solutionActions.style.display = 'flex';
  }
  
  // 知見ベースの更新
  function updateKnowledgeBase() {
    if (!state.knowledgeBase || state.knowledgeBase.length === 0) {
      knowledgeListContainer.innerHTML = `
        <div class="empty-state">
          <i class="icon large">📚</i>
          <p>知見ベースにはまだ何もありません。エラーを解決すると自動的に知見が追加されます。</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    state.knowledgeBase.forEach(knowledge => {
      // 作成日時をフォーマット
      const createdAt = new Date(knowledge.createdAt).toLocaleString();
      
      // 問題の要約（最初の行を抽出）
      const problemSummary = knowledge.problem.split('\n')[0].substring(0, 100);
      
      // エラータイプのスタイル
      let errorTypeClass = '';
      if (knowledge.errorType) {
        if (knowledge.errorType.includes('構文')) errorTypeClass = 'error-type-syntax';
        else if (knowledge.errorType.includes('ファイル')) errorTypeClass = 'error-type-file';
        else if (knowledge.errorType.includes('モジュール')) errorTypeClass = 'error-type-module';
        else if (knowledge.errorType.includes('接続')) errorTypeClass = 'error-type-connection';
        else if (knowledge.errorType.includes('データベース')) errorTypeClass = 'error-type-database';
        else if (knowledge.errorType.includes('認証')) errorTypeClass = 'error-type-auth';
        else if (knowledge.errorType.includes('ビルド')) errorTypeClass = 'error-type-build';
        else if (knowledge.errorType.includes('環境変数')) errorTypeClass = 'error-type-env';
      }
      
      html += `
        <div class="knowledge-card" data-id="${knowledge.id}">
          <div class="knowledge-header">
            <div class="knowledge-title">${knowledge.title}</div>
            <div class="knowledge-date">${createdAt}</div>
          </div>
          <div class="knowledge-summary">${problemSummary}</div>
          <div class="knowledge-footer">
            <div class="knowledge-type ${errorTypeClass}">${knowledge.errorType}</div>
            <div class="knowledge-tags">
              ${(knowledge.tags || []).map(tag => `<span class="knowledge-tag">${tag}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    });
    
    knowledgeListContainer.innerHTML = html;
    
    // 知見カードのクリックイベントを追加
    document.querySelectorAll('.knowledge-card').forEach(card => {
      card.addEventListener('click', () => {
        const knowledgeId = card.getAttribute('data-id');
        selectKnowledge(knowledgeId);
      });
    });
  }
  
  // 知見の選択
  function selectKnowledge(knowledgeId) {
    const knowledge = state.knowledgeBase.find(k => k.id === knowledgeId);
    
    if (knowledge) {
      knowledgeDetailSection.style.display = 'block';
      
      // 作成日時をフォーマット
      const createdAt = new Date(knowledge.createdAt).toLocaleString();
      
      // 関連ファイルの表示
      let relatedFilesHtml = '';
      if (knowledge.relatedFiles && knowledge.relatedFiles.length > 0) {
        knowledge.relatedFiles.forEach(filePath => {
          const parts = filePath.split('/');
          const fileName = parts[parts.length - 1];
          
          relatedFilesHtml += `
            <div class="knowledge-detail-file" title="${filePath}">
              <i class="icon">📄</i> ${fileName}
            </div>
          `;
        });
      } else {
        relatedFilesHtml = '<p>関連ファイルはありません</p>';
      }
      
      // タグの表示
      let tagsHtml = '';
      if (knowledge.tags && knowledge.tags.length > 0) {
        tagsHtml = knowledge.tags.map(tag => `<span class="knowledge-tag">${tag}</span>`).join(' ');
      } else {
        tagsHtml = 'タグはありません';
      }
      
      knowledgeDetailContainer.innerHTML = `
        <div class="knowledge-detail">
          <div class="knowledge-detail-header">
            <div class="knowledge-detail-title">${knowledge.title}</div>
            <div class="knowledge-detail-metadata">
              <div><strong>エラータイプ:</strong> ${knowledge.errorType}</div>
              <div><strong>作成日時:</strong> ${createdAt}</div>
            </div>
          </div>
          
          <div class="knowledge-detail-section">
            <div class="knowledge-detail-section-title">問題</div>
            <div class="knowledge-detail-content">${knowledge.problem}</div>
          </div>
          
          <div class="knowledge-detail-section">
            <div class="knowledge-detail-section-title">解決策</div>
            <div class="knowledge-detail-content">${knowledge.solution}</div>
          </div>
          
          <div class="knowledge-detail-section">
            <div class="knowledge-detail-section-title">関連ファイル</div>
            <div class="knowledge-detail-files">
              ${relatedFilesHtml}
            </div>
          </div>
          
          <div class="knowledge-detail-section">
            <div class="knowledge-detail-section-title">タグ</div>
            <div class="knowledge-detail-content">
              ${tagsHtml}
            </div>
          </div>
        </div>
      `;
    }
  }
  
  // データの更新
  function refreshData() {
    vscode.postMessage({
      command: 'refreshData'
    });
    
    getErrorSessions();
  }
  
  // エラーログのスキャン
  function scanErrorLog() {
    const errorLog = errorLogTextarea.value.trim();
    
    if (!errorLog) {
      showError('エラーログを入力してください');
      return;
    }
    
    vscode.postMessage({
      command: 'scanErrorLog',
      errorLog
    });
  }
  
  // エラーログの追加
  function addErrorLog() {
    const errorLog = errorLogTextarea.value.trim();
    
    if (!errorLog) {
      showError('エラーログを入力してください');
      return;
    }
    
    vscode.postMessage({
      command: 'addErrorLog',
      errorLog
    });
  }
  
  // ログファイルの読み込み
  function loadLogFile() {
    vscode.postMessage({
      command: 'loadLogFile'
    });
  }
  
  // ターミナル出力の保存
  function saveTerminalOutput() {
    vscode.postMessage({
      command: 'saveTerminalOutput'
    });
  }
  
  // 調査の開始
  function startInvestigation() {
    if (!state.currentErrorSession) {
      showError('エラーセッションを選択してください');
      return;
    }
    
    // 選択されたファイルの取得
    const selectedFiles = [];
    document.querySelectorAll('.file-checkbox:checked').forEach(checkbox => {
      selectedFiles.push(checkbox.getAttribute('data-path'));
    });
    
    vscode.postMessage({
      command: 'startInvestigation',
      sessionId: state.currentErrorSession.id,
      selectedFiles
    });
  }
  
  // 解決策の適用
  function applySolution() {
    if (!state.currentErrorSession) {
      showError('エラーセッションを選択してください');
      return;
    }
    
    if (!state.currentErrorSession.fileChanges) {
      showError('適用できる解決策がありません');
      return;
    }
    
    vscode.postMessage({
      command: 'applySolution',
      solutionId: state.currentErrorSession.id,
      fileChanges: state.currentErrorSession.fileChanges
    });
  }
  
  // 解決済みとしてマーク
  function markAsResolved() {
    if (!state.currentErrorSession) {
      showError('エラーセッションを選択してください');
      return;
    }
    
    const saveAsKnowledge = saveKnowledgeCheckbox.checked;
    
    vscode.postMessage({
      command: 'markAsResolved',
      sessionId: state.currentErrorSession.id,
      saveAsKnowledge
    });
  }
  
  // 知見追加モーダルの表示
  function showAddKnowledgeModal() {
    addKnowledgeModal.classList.add('active');
  }
  
  // 知見追加モーダルの非表示
  function hideAddKnowledgeModal() {
    addKnowledgeModal.classList.remove('active');
    addKnowledgeForm.reset();
  }
  
  // 知見の追加
  function handleAddKnowledge(event) {
    event.preventDefault();
    
    const title = document.getElementById('knowledge-title').value.trim();
    const errorType = document.getElementById('knowledge-error-type').value;
    const problem = document.getElementById('knowledge-problem').value.trim();
    const solution = document.getElementById('knowledge-solution').value.trim();
    const tagsInput = document.getElementById('knowledge-tags').value.trim();
    
    if (!title || !problem || !solution) {
      showError('タイトル、問題、解決策は必須です');
      return;
    }
    
    // タグの処理
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
    
    const knowledge = {
      title,
      errorType,
      problem,
      solution,
      tags,
      createdAt: new Date().toISOString()
    };
    
    vscode.postMessage({
      command: 'addToKnowledgeBase',
      knowledge
    });
    
    hideAddKnowledgeModal();
  }
  
  // バックエンドテストの実行
  function runBackendTest() {
    const command = backendTestCommand.value.trim();
    
    vscode.postMessage({
      command: 'runBackendTest',
      testCommand: command
    });
  }
  
  // フロントエンドテストの実行
  function runFrontendTest() {
    const command = frontendTestCommand.value.trim();
    
    vscode.postMessage({
      command: 'runFrontendTest',
      testCommand: command
    });
  }
  
  // タイプチェックの実行
  function runTypecheck() {
    const command = typecheckCommand.value.trim();
    
    vscode.postMessage({
      command: 'runBackendTest',
      testCommand: command
    });
  }
  
  // リントの実行
  function runLint() {
    const command = lintCommand.value.trim();
    
    vscode.postMessage({
      command: 'runBackendTest',
      testCommand: command
    });
  }
  
  // 知見の検索
  function searchKnowledge() {
    const keyword = knowledgeSearch.value.trim();
    const errorType = errorTypeFilter.value;
    
    vscode.postMessage({
      command: 'browseKnowledge',
      filter: {
        keyword,
        errorType
      }
    });
  }
  
  // エラーセッション一覧の取得
  function getErrorSessions() {
    vscode.postMessage({
      command: 'getErrorSessions'
    });
  }
  
  // エラーセッション作成完了ハンドラ
  function handleErrorSessionCreated(message) {
    const { sessionId, errorType, relatedFiles } = message;
    
    // 作成したセッションを選択
    const session = state.sessions.find(s => s.id === sessionId);
    
    if (session) {
      state.currentErrorSession = session;
      state.relatedFiles = relatedFiles;
      state.detectedErrorType = errorType;
      
      updateCurrentSession();
      updateRelatedFiles();
    }
    
    // エラーログをクリア
    errorLogTextarea.value = '';
    
    // タブを調査タブに切り替え
    document.querySelector('.tab-button[data-tab="error-session"]').click();
  }
  
  // スキャン結果ハンドラ
  function handleScanResult(message) {
    const { errorType, relatedFiles, similarSessions, relatedKnowledge } = message;
    
    // エラータイプを表示
    if (errorType) {
      showInfo(`エラータイプ: ${errorType}`);
    }
    
    // 関連ファイルを表示
    if (relatedFiles && relatedFiles.length > 0) {
      showInfo(`関連ファイルが ${relatedFiles.length} 件見つかりました。`);
    }
    
    // 類似セッションを表示
    if (similarSessions && similarSessions.length > 0) {
      showInfo(`類似のエラーセッションが ${similarSessions.length} 件見つかりました。`);
    }
    
    // 関連知見を表示
    if (relatedKnowledge && relatedKnowledge.length > 0) {
      showInfo(`関連する知見が ${relatedKnowledge.length} 件見つかりました。`);
    }
  }
  
  // セッション解決ハンドラ
  function handleSessionResolved(message) {
    const { sessionId, saveAsKnowledge } = message;
    
    // セッションのステータスを更新
    const session = state.sessions.find(s => s.id === sessionId);
    
    if (session) {
      session.status = 'resolved';
      
      updateErrorSessionsList();
      updateCurrentSession();
      updateSolution();
    }
    
    showInfo(`エラーセッションを解決済みとしてマークしました${saveAsKnowledge ? '（知見ベースに追加しました）' : ''}`);
  }
  
  // 解決策適用ハンドラ
  function handleSolutionApplied(message) {
    const { success, error } = message;
    
    if (success) {
      showInfo('解決策を適用しました。確認テストを実行してください。');
    } else {
      showError(`解決策の適用に失敗しました: ${error}`);
    }
  }
  
  // 知見追加ハンドラ
  function handleKnowledgeAdded(message) {
    showInfo('知見ベースに追加しました。');
    
    // 知見ベースタブに切り替え
    document.querySelector('.tab-button[data-tab="knowledge-base"]').click();
  }
  
  // 知見リストハンドラ
  function handleKnowledgeList(message) {
    state.knowledgeBase = message.knowledgeList;
    updateKnowledgeBase();
  }
  
  // エラーセッション一覧ハンドラ
  function handleErrorSessions(message) {
    state.sessions = message.sessions;
    updateErrorSessionsList();
  }
  
  // エラータイプ検出ハンドラ
  function handleErrorTypeDetected(message) {
    const { errorType } = message;
    
    if (errorType) {
      showInfo(`エラータイプ: ${errorType}`);
    }
  }
  
  // エラーメッセージの表示
  function showError(message) {
    // VSCodeの通知API
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'error',
      message
    });
  }
  
  // 情報メッセージの表示
  function showInfo(message) {
    // VSCodeの通知API
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'info',
      message
    });
  }
  
  // 初期化を実行
  initialize();
})();