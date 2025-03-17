// デバッグ探偵 JavaScript

(function() {
  // VSCode WebView API
  const vscode = acquireVsCodeApi();
  
  // 状態の初期化
  let state = {
    projectPath: '',
    currentErrorSession: null,
    relatedFiles: [],
    detectedErrorType: '',
    sessions: [],
    knowledgeBase: []
  };
  
  // DOM要素の取得
  const errorLogTextarea = document.getElementById('error-log');
  const investigateErrorBtn = document.getElementById('investigate-error-btn');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const notificationArea = document.getElementById('notification-area');
  
  // テーマの適用
  function applyTheme(theme) {
    const container = document.querySelector('.detective-container');
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
  
  // 初期化
  function initialize() {
    // イベントリスナーの登録
    investigateErrorBtn.addEventListener('click', investigateError);
    
    // タブ切り替えリスナー
    setupTabNavigation();
    
    // キーボードアクセシビリティ対応
    setupKeyboardAccessibility();
    
    // メッセージハンドラの登録
    window.addEventListener('message', handleMessages);
    
    // テーマリスナーを設定
    setupThemeListener();
    
    // 保存された状態を復元
    restoreState();
  }
  
  // 状態の復元
  function restoreState() {
    const savedState = vscode.getState();
    if (savedState) {
      state = { ...state, ...savedState };
      updateUI();
    }
  }
  
  // 状態の保存
  function saveState() {
    vscode.setState(state);
  }
  
  // UIの更新
  function updateUI() {
    // 現在の調査セッションの表示
    updateCurrentSession();
    
    // 関連ファイルの表示
    updateRelatedFiles();
    
    // エラーセッション一覧の表示
    updateErrorSessions();
    
    // 知見ベースの表示
    updateKnowledgeBase();
  }
  
  // タブナビゲーションの設定
  function setupTabNavigation() {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // タブの切り替え
        const targetId = button.getAttribute('aria-controls');
        const targetPane = document.getElementById(targetId);
        
        if (targetPane) {
          // アクティブなタブを更新
          tabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
          });
          
          tabPanes.forEach(pane => {
            pane.classList.remove('active');
          });
          
          button.classList.add('active');
          button.setAttribute('aria-selected', 'true');
          targetPane.classList.add('active');
          
          // アクセシビリティ通知
          announceTabChange(button.textContent.trim());
        }
      });
    });
  }
  
  // キーボードアクセシビリティの設定
  function setupKeyboardAccessibility() {
    // タブリストのキーボードナビゲーション
    const tabList = document.querySelector('[role="tablist"]');
    if (tabList) {
      tabList.addEventListener('keydown', handleTabListKeyDown);
    }
    
    // フォーカス可視性の向上
    document.addEventListener('keydown', handleGlobalKeyDown);
  }
  
  // タブリストのキーボードナビゲーション
  function handleTabListKeyDown(event) {
    const tabs = Array.from(tabButtons);
    const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
    
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    
    tabs[nextIndex].focus();
  }
  
  // グローバルキーボードイベント
  function handleGlobalKeyDown(event) {
    // Escキーでのモーダルクローズなど
    if (event.key === 'Escape') {
      const modal = document.querySelector('.modal.active');
      if (modal) {
        closeModal(modal);
      }
    }
  }
  
  // メッセージハンドラ
  function handleMessages(event) {
    const message = event.data;
    
    switch (message.command) {
      case 'showError':
        showError(message.message);
        break;
        
      case 'errorSessionCreated':
        handleErrorSessionCreated(message);
        break;
        
      case 'errorSessions':
        handleErrorSessions(message);
        break;
        
      case 'updateState':
        handleUpdateState(message);
        break;
        
      case 'errorTypeDetected':
        handleErrorTypeDetected(message);
        break;
    }
  }
  
  // 状態更新処理
  function handleUpdateState(message) {
    state = {
      ...state,
      currentErrorSession: message.currentErrorSession || state.currentErrorSession,
      relatedFiles: message.relatedFiles || state.relatedFiles,
      detectedErrorType: message.detectedErrorType || state.detectedErrorType,
      sessions: message.sessions || state.sessions,
      knowledgeBase: message.knowledgeBase || state.knowledgeBase,
      projectPath: message.projectPath || state.projectPath
    };
    
    saveState();
    updateUI();
  }
  
  // エラーセッション一覧の処理
  function handleErrorSessions(message) {
    state.sessions = message.sessions || [];
    saveState();
    updateErrorSessions();
  }
  
  // エラータイプ検出の処理
  function handleErrorTypeDetected(message) {
    state.detectedErrorType = message.errorType;
    saveState();
    
    // エラータイプを通知
    announce(`エラータイプを検出しました: ${message.errorType}`);
  }
  
  // エラーの調査依頼
  function investigateError() {
    const errorLog = errorLogTextarea.value.trim();
    
    if (!errorLog) {
      showError('エラーログを入力してください');
      return;
    }
    
    // 処理中の状態を表示
    investigateErrorBtn.disabled = true;
    investigateErrorBtn.textContent = '処理中...';
    investigateErrorBtn.setAttribute('aria-busy', 'true');
    
    // アクセシビリティ通知
    announce('エラーの調査を開始します。処理中...');
    
    vscode.postMessage({
      command: 'investigateError',
      errorLog
    });
  }
  
  // エラーセッション作成完了ハンドラ
  function handleErrorSessionCreated(message) {
    // 状態を更新
    state.currentErrorSession = {
      id: message.sessionId,
      errorType: message.errorType,
      status: 'investigating'
    };
    state.relatedFiles = message.relatedFiles || [];
    state.detectedErrorType = message.errorType;
    
    saveState();
    
    // エラーログをクリア
    errorLogTextarea.value = '';
    
    // ボタンを元に戻す
    investigateErrorBtn.disabled = false;
    investigateErrorBtn.textContent = 'このエラーの調査を依頼する';
    investigateErrorBtn.setAttribute('aria-busy', 'false');
    
    // 完了メッセージ
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.setAttribute('role', 'status');
    successMessage.setAttribute('aria-live', 'polite');
    successMessage.innerHTML = `
      <div class="success-icon" aria-hidden="true">✅</div>
      <div class="success-text">エラーの調査を依頼しました。ClaudeCodeが起動します。</div>
    `;
    
    // 既存のメッセージがあれば削除
    const existingMessage = document.querySelector('.success-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // メッセージを表示
    document.querySelector('.error-input').appendChild(successMessage);
    
    // アクセシビリティ通知
    announce('エラーの調査を依頼しました。ClaudeCodeが起動します。');
    
    // VSCodeの通知も表示
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'info',
      message: 'エラーの調査を依頼しました。ClaudeCodeが起動します。'
    });
    
    // 現在のセッションを表示
    updateCurrentSession();
    
    // 関連ファイルを表示
    updateRelatedFiles();
    
    // 3秒後にメッセージを消す
    setTimeout(() => {
      const message = document.querySelector('.success-message');
      if (message) {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 500);
      }
    }, 3000);
  }
  
  // 現在のセッションの表示を更新
  function updateCurrentSession() {
    const sessionSection = document.getElementById('current-session-section');
    const sessionContainer = document.getElementById('current-session-container');
    
    if (!sessionSection || !sessionContainer) return;
    
    if (state.currentErrorSession) {
      sessionSection.style.display = 'block';
      sessionContainer.innerHTML = `
        <div class="current-session-info">
          <h3>エラータイプ: ${state.detectedErrorType || '分析中...'}</h3>
          <div class="session-status">
            <span class="status-badge investigating">調査中</span>
            <span class="session-id">(セッションID: ${state.currentErrorSession.id})</span>
          </div>
        </div>
      `;
    } else {
      sessionSection.style.display = 'none';
      sessionContainer.innerHTML = '';
    }
  }
  
  // 関連ファイルの表示を更新
  function updateRelatedFiles() {
    const filesSection = document.getElementById('related-files-section');
    const filesContainer = document.getElementById('related-files-container');
    
    if (!filesSection || !filesContainer) return;
    
    if (state.relatedFiles && state.relatedFiles.length > 0) {
      filesSection.style.display = 'block';
      
      // 関連ファイルのリストを構築
      let filesList = '<ul class="related-files-list" role="list">';
      
      state.relatedFiles.forEach(file => {
        const fileName = file.split('/').pop();
        filesList += `
          <li class="file-item" role="listitem">
            <div class="file-path" title="${file}">
              <span class="file-icon" aria-hidden="true">📄</span>
              <span>${fileName}</span>
            </div>
          </li>
        `;
      });
      
      filesList += '</ul>';
      filesContainer.innerHTML = filesList;
    } else {
      filesSection.style.display = 'none';
      filesContainer.innerHTML = '';
    }
  }
  
  // エラーセッション一覧の表示を更新
  function updateErrorSessions() {
    const sessionsContainer = document.getElementById('error-sessions-container');
    
    if (!sessionsContainer) return;
    
    if (state.sessions && state.sessions.length > 0) {
      let sessionsList = '';
      
      state.sessions.forEach(session => {
        const sessionDate = new Date(session.createdAt).toLocaleString();
        sessionsList += `
          <div class="error-session-card" role="listitem" tabindex="0" data-session-id="${session.id}">
            <div class="error-session-header">
              <div class="error-session-title">${session.errorType || '不明なエラー'}</div>
              <div class="error-session-date">${sessionDate}</div>
            </div>
            <div class="error-session-summary">${session.summary || '説明なし'}</div>
            <div class="error-session-footer">
              <div class="error-session-type ${session.errorType ? 'error-type-' + session.errorType.replace(/\s+/g, '-').toLowerCase() : ''}">${session.errorType || '不明'}</div>
              <div class="error-session-status status-${session.status || 'new'}">${getStatusText(session.status)}</div>
            </div>
          </div>
        `;
      });
      
      sessionsContainer.innerHTML = sessionsList;
      
      // セッションカードにイベントリスナーを追加
      document.querySelectorAll('.error-session-card').forEach(card => {
        card.addEventListener('click', () => selectErrorSession(card.dataset.sessionId));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectErrorSession(card.dataset.sessionId);
          }
        });
      });
    } else {
      sessionsContainer.innerHTML = `
        <div class="empty-state" role="status">
          <div class="icon large" aria-hidden="true">📋</div>
          <p>過去のエラーセッションがありません</p>
        </div>
      `;
    }
  }
  
  // 知見ベースの表示を更新
  function updateKnowledgeBase() {
    const knowledgeListContainer = document.getElementById('knowledge-list-container');
    
    if (!knowledgeListContainer) return;
    
    if (state.knowledgeBase && state.knowledgeBase.length > 0) {
      let knowledgeList = '';
      
      state.knowledgeBase.forEach(knowledge => {
        const createdDate = new Date(knowledge.createdAt).toLocaleString();
        knowledgeList += `
          <div class="knowledge-card" role="listitem" tabindex="0" data-knowledge-id="${knowledge.id}">
            <div class="knowledge-header">
              <div class="knowledge-title">${knowledge.title}</div>
              <div class="knowledge-date">${createdDate}</div>
            </div>
            <div class="knowledge-summary">${knowledge.summary || '説明なし'}</div>
            <div class="knowledge-footer">
              <div class="knowledge-type">${knowledge.errorType || '一般'}</div>
              <div class="knowledge-tags">
                ${(knowledge.tags || []).map(tag => `<div class="knowledge-tag">${tag}</div>`).join('')}
              </div>
            </div>
          </div>
        `;
      });
      
      knowledgeListContainer.innerHTML = knowledgeList;
      
      // 知見カードにイベントリスナーを追加
      document.querySelectorAll('.knowledge-card').forEach(card => {
        card.addEventListener('click', () => selectKnowledge(card.dataset.knowledgeId));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectKnowledge(card.dataset.knowledgeId);
          }
        });
      });
    } else {
      knowledgeListContainer.innerHTML = `
        <div class="empty-state" role="status">
          <div class="icon large" aria-hidden="true">📚</div>
          <p>知見ベースが空です</p>
        </div>
      `;
    }
  }
  
  // エラーセッションを選択
  function selectErrorSession(sessionId) {
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // 選択状態を視覚的に示す
    document.querySelectorAll('.error-session-card').forEach(card => {
      if (card.dataset.sessionId === sessionId) {
        card.classList.add('active');
        card.setAttribute('aria-selected', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-selected', 'false');
      }
    });
    
    // アクセシビリティ通知
    announce(`エラーセッション「${session.errorType || '不明なエラー'}」を選択しました`);
    
    // 詳細表示などの処理
    // ...
  }
  
  // 知見を選択
  function selectKnowledge(knowledgeId) {
    const knowledge = state.knowledgeBase.find(k => k.id === knowledgeId);
    if (!knowledge) return;
    
    // 選択状態を視覚的に示す
    document.querySelectorAll('.knowledge-card').forEach(card => {
      if (card.dataset.knowledgeId === knowledgeId) {
        card.classList.add('active');
        card.setAttribute('aria-selected', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-selected', 'false');
      }
    });
    
    // アクセシビリティ通知
    announce(`知見「${knowledge.title}」を選択しました`);
    
    // 詳細表示などの処理
    // ...
  }
  
  // エラーメッセージの表示
  function showError(message) {
    // アクセシビリティ通知
    announce(`エラー: ${message}`, 'assertive');
    
    // VSCodeの通知API
    vscode.postMessage({
      command: 'showVSCodeMessage',
      type: 'error',
      message
    });
  }
  
  // アクセシビリティ通知
  function announce(message, importance = 'polite') {
    if (notificationArea) {
      notificationArea.setAttribute('aria-live', importance);
      notificationArea.textContent = message;
    }
  }
  
  // タブ切り替えを通知
  function announceTabChange(tabName) {
    announce(`${tabName}タブに切り替えました`);
  }
  
  // ステータスのテキスト表現を取得
  function getStatusText(status) {
    switch (status) {
      case 'new': return '新規';
      case 'investigating': return '調査中';
      case 'resolved': return '解決済み';
      default: return '不明';
    }
  }
  
  // 初期化を実行
  initialize();
})();