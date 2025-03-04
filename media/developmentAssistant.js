// 開発アシスタントの JavaScript

(function() {
  // VSCode APIの取得
  const vscode = acquireVsCodeApi();
  
  // 状態の初期化
  const state = {
    currentPhase: '',
    phases: [],
    messages: [],
    directoryStructure: '',
    scope: '',
    files: [],
    selectedItems: [],
    estimatedTime: '',
    totalProgress: 0,
    startDate: '',
    targetDate: '',
    progressSummary: {
      totalItems: 0,
      completedItems: 0,
      inProgressItems: 0,
      pendingItems: 0,
      blockedItems: 0
    }
  };
  
  // DOM要素
  let chatMessages;
  let chatInput;
  let sendButton;
  let phasesList;
  let projectStructureInfo;
  let scopeInfo;
  let loadingElement;
  let implementationItems;
  let progressFill;
  let progressPercentage;
  let startDateElement;
  let targetDateElement;
  let completedCount;
  let inProgressCount;
  let pendingCount;
  let blockedCount;
  
  // 現在のフィルター
  let currentFilter = 'all';
  
  // ページ読み込み時の初期化
  document.addEventListener('DOMContentLoaded', init);
  
  function init() {
    // DOM要素の取得
    chatMessages = document.getElementById('chat-messages');
    chatInput = document.getElementById('chat-input');
    sendButton = document.getElementById('send-message');
    phasesList = document.getElementById('phases-list');
    projectStructureInfo = document.getElementById('project-structure-info');
    scopeInfo = document.getElementById('scope-info');
    loadingElement = document.getElementById('loading');
    
    // 進捗ダッシュボード要素
    progressFill = document.getElementById('progress-fill');
    progressPercentage = document.getElementById('progress-percentage');
    startDateElement = document.getElementById('start-date');
    targetDateElement = document.getElementById('target-date');
    completedCount = document.getElementById('completed-count');
    inProgressCount = document.getElementById('in-progress-count');
    pendingCount = document.getElementById('pending-count');
    blockedCount = document.getElementById('blocked-count');
    implementationItems = document.getElementById('implementation-items');
    
    // イベントリスナーの設定
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', handleInputKeydown);
    chatInput.addEventListener('input', autoResizeTextarea);
    
    // タブ切り替えのイベントリスナー
    setupTabNavigation();
    
    // フィルターボタンのイベントリスナー
    setupFilterButtons();
    
    // WebViewの準備完了を通知
    vscode.postMessage({ command: 'webviewReady' });
    
    // ローディング表示を非表示に
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }
  
  // タブナビゲーションをセットアップ
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabButtons.length > 0) {
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          // すべてのタブから active クラスを削除
          tabButtons.forEach(btn => btn.classList.remove('active'));
          // クリックされたタブに active クラスを追加
          button.classList.add('active');
          
          // 対応するコンテンツを表示
          const targetId = button.id.replace('tab-', 'tab-content-');
          tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === targetId) {
              content.classList.add('active');
            }
          });
        });
      });
    }
  }
  
  // フィルターボタンをセットアップ
  function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-button');
    
    if (filterButtons.length > 0) {
      filterButtons.forEach(button => {
        button.addEventListener('click', () => {
          // すべてのフィルターボタンから active クラスを削除
          filterButtons.forEach(btn => btn.classList.remove('active'));
          // クリックされたボタンに active クラスを追加
          button.classList.add('active');
          
          // フィルター状態を更新
          currentFilter = button.getAttribute('data-filter');
          filterImplementationItems();
        });
      });
    }
  }
  
  // 実装項目をフィルタリング
  function filterImplementationItems() {
    if (!implementationItems) return;
    
    const items = implementationItems.querySelectorAll('.progress-item');
    
    items.forEach(item => {
      const status = item.getAttribute('data-status');
      
      if (currentFilter === 'all' || status === currentFilter) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  // 送信中フラグ
  let isSending = false;
  
  // メッセージ送信処理
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isSending) return;
    
    // 二重送信防止のためフラグを設定
    isSending = true;
    
    // UIにメッセージを表示（即時応答）
    addUserMessage(text);
    
    // 入力欄をクリア - すぐに空にする
    chatInput.value = '';
    
    // テキストエリアをリサイズしてスクロール位置をリセット
    chatInput.style.height = 'auto';
    chatInput.style.height = '36px'; // 初期高さに戻す
    
    // 入力欄にフォーカスを戻す
    chatInput.focus();
    
    // VSCodeにメッセージを送信
    vscode.postMessage({
      command: 'sendChatMessage',
      text: text
    });
    
    // 送信ボタンを無効化して処理中表示
    setProcessingState(true);
    
    // 一定時間後にフラグをリセット（非同期処理の完了を保証するため）
    setTimeout(() => {
      isSending = false;
    }, 1000);
  }
  
  // キー入力のハンドル（Enter で送信、Shift+Enter で改行）
  function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
  
  // テキストエリアの自動リサイズ
  function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  }
  
  // 処理状態の設定
  function setProcessingState(isProcessing) {
    if (isProcessing) {
      sendButton.disabled = true;
      sendButton.textContent = '処理中...';
    } else {
      sendButton.disabled = false;
      sendButton.textContent = '送信';
    }
  }
  
  // ユーザーメッセージの追加
  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    // 改行をHTMLの改行に変換
    const content = text.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `<p>${content}</p>`;
    
    if (chatMessages) {
      chatMessages.appendChild(messageDiv);
      scrollToBottom();
    }
  }
  
  // AIメッセージの追加
  function addAIMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    
    // Markdownパース（簡易的な実装）
    const content = parseMarkdown(text);
    messageDiv.innerHTML = `<p>${content}</p>`;
    
    if (chatMessages) {
      chatMessages.appendChild(messageDiv);
      scrollToBottom();
      
      // コードブロックにコピーボタンを追加
      addCopyButtonsToCodeBlocks(messageDiv);
    }
  }
  
  // エラーメッセージの表示
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error';
    errorDiv.innerHTML = `<p>${message}</p>`;
    
    if (chatMessages) {
      chatMessages.appendChild(errorDiv);
      scrollToBottom();
      
      // 5秒後に自動で消去
      setTimeout(() => {
        errorDiv.classList.add('fadeout');
        setTimeout(() => errorDiv.remove(), 500);
      }, 5000);
    }
  }
  
  // 簡易的なMarkdownパース
  function parseMarkdown(text) {
    if (!text) return '';
    
    // コードブロックの処理
    let parsed = text.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, language, code) {
      const langClass = language ? ` class="language-${language}"` : '';
      const codeHtml = escapeHtml(code);
      return `<pre><code${langClass}>${codeHtml}</code></pre>`;
    });
    
    // インラインコードの処理
    parsed = parsed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 太字の処理
    parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 斜体の処理
    parsed = parsed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // リンクの処理
    parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 改行の処理
    parsed = parsed.replace(/\n/g, '<br>');
    
    return parsed;
  }
  
  // HTMLエスケープ
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // コードブロックにコピーボタンを追加
  function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre code');
    
    codeBlocks.forEach(codeBlock => {
      // すでにボタンがある場合はスキップ
      if (codeBlock.parentElement.querySelector('.code-actions')) {
        return;
      }
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'code-actions';
      
      const copyButton = document.createElement('button');
      copyButton.textContent = 'コピー';
      copyButton.addEventListener('click', () => {
        // コードをクリップボードにコピー
        const code = codeBlock.textContent;
        navigator.clipboard.writeText(code)
          .then(() => {
            copyButton.textContent = 'コピー済み';
            setTimeout(() => {
              copyButton.textContent = 'コピー';
            }, 2000);
          })
          .catch(err => {
            console.error('コピーに失敗:', err);
            showError('コードのコピーに失敗しました');
          });
      });
      
      const saveButton = document.createElement('button');
      saveButton.textContent = '保存';
      saveButton.addEventListener('click', () => {
        // VSCodeに保存リクエストを送信
        const code = codeBlock.textContent;
        const language = codeBlock.className.replace('language-', '');
        
        vscode.postMessage({
          command: 'saveCodeBlock',
          codeBlock: {
            code: code,
            language: language || 'text',
            // filenameはExtension側で推測するため、ここでは空
            filename: ''
          }
        });
      });
      
      actionsDiv.appendChild(copyButton);
      actionsDiv.appendChild(saveButton);
      
      codeBlock.parentElement.appendChild(actionsDiv);
    });
  }
  
  // チャット領域を下にスクロール
  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
  
  // フェーズリストのレンダリング
  function renderPhasesList() {
    if (!phasesList) return;
    
    phasesList.innerHTML = '';
    
    state.phases.forEach(phase => {
      const phaseItem = document.createElement('div');
      phaseItem.className = 'phase-item';
      phaseItem.textContent = phase.name;
      
      if (phase.id === state.currentPhase) {
        phaseItem.classList.add('active');
      }
      
      if (phase.isCompleted) {
        phaseItem.classList.add('completed');
      }
      
      phaseItem.addEventListener('click', () => {
        vscode.postMessage({
          command: 'startPhase',
          phase: phase.id
        });
      });
      
      phasesList.appendChild(phaseItem);
    });
  }
  
  // プロジェクト情報の更新
  function updateProjectInfo() {
    if (!projectStructureInfo || !scopeInfo) return;
    
    if (state.directoryStructure) {
      projectStructureInfo.innerHTML = '<p>ディレクトリ構造:</p>' +
        `<pre>${state.directoryStructure}</pre>`;
    } else {
      projectStructureInfo.innerHTML = '<p>ディレクトリ構造が読み込まれていません</p>';
    }
    
    if (state.scope) {
      scopeInfo.innerHTML = '<p>実装スコープ:</p>' +
        `<pre>${state.scope}</pre>`;
    } else {
      scopeInfo.innerHTML = '<p>実装スコープが設定されていません</p>';
    }
  }
  
  // 進捗ダッシュボードの更新
  function updateProgressDashboard() {
    // 進捗バー
    if (progressFill && progressPercentage) {
      progressFill.style.width = `${state.totalProgress}%`;
      progressPercentage.textContent = `${state.totalProgress}%`;
    }
    
    // 日付情報
    if (startDateElement && state.startDate) {
      startDateElement.textContent = `開始日: ${formatDate(state.startDate)}`;
    }
    
    if (targetDateElement && state.targetDate) {
      targetDateElement.textContent = `目標日: ${formatDate(state.targetDate)}`;
    }
    
    // 進捗カウンター
    if (state.progressSummary) {
      if (completedCount) {
        completedCount.textContent = `完了: ${state.progressSummary.completedItems}`;
      }
      
      if (inProgressCount) {
        inProgressCount.textContent = `進行中: ${state.progressSummary.inProgressItems}`;
      }
      
      if (pendingCount) {
        pendingCount.textContent = `未着手: ${state.progressSummary.pendingItems}`;
      }
      
      if (blockedCount) {
        blockedCount.textContent = `ブロック: ${state.progressSummary.blockedItems}`;
      }
    }
  }
  
  // 日付のフォーマット
  function formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP');
    } catch (error) {
      return dateString || '未設定';
    }
  }
  
  // 実装項目リストの更新
  function updateImplementationItems() {
    if (!implementationItems) return;
    
    implementationItems.innerHTML = '';
    
    if (!state.selectedItems || state.selectedItems.length === 0) {
      implementationItems.innerHTML = '<p>実装項目がロードされていません</p>';
      return;
    }
    
    state.selectedItems.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'progress-item';
      itemElement.setAttribute('data-id', item.id);
      itemElement.setAttribute('data-status', item.status || 'pending');
      
      // タイトル行
      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.justifyContent = 'space-between';
      titleRow.style.alignItems = 'center';
      
      const titleElement = document.createElement('span');
      titleElement.className = 'title';
      titleElement.textContent = item.title;
      titleRow.appendChild(titleElement);
      
      const statusBadge = document.createElement('span');
      statusBadge.className = `status-badge status-${item.status || 'pending'}`;
      statusBadge.textContent = getStatusText(item.status);
      titleRow.appendChild(statusBadge);
      
      itemElement.appendChild(titleRow);
      
      // 進捗バー
      const progressRow = document.createElement('div');
      progressRow.style.display = 'flex';
      progressRow.style.justifyContent = 'space-between';
      progressRow.style.alignItems = 'center';
      progressRow.style.marginTop = '5px';
      
      const progressBar = document.createElement('div');
      progressBar.className = 'item-progress-bar';
      
      const progressFill = document.createElement('div');
      progressFill.className = 'item-progress-fill';
      progressFill.style.width = `${item.progress || 0}%`;
      progressBar.appendChild(progressFill);
      
      progressRow.appendChild(progressBar);
      
      const progressText = document.createElement('span');
      progressText.style.fontSize = '12px';
      progressText.style.marginLeft = '10px';
      progressText.textContent = `${item.progress || 0}%`;
      progressRow.appendChild(progressText);
      
      itemElement.appendChild(progressRow);
      
      // ステータス変更ボタン
      const buttonsRow = document.createElement('div');
      buttonsRow.style.display = 'flex';
      buttonsRow.style.gap = '5px';
      buttonsRow.style.marginTop = '5px';
      
      const statusOptions = [
        { value: 'pending', text: '未着手' },
        { value: 'in-progress', text: '進行中' },
        { value: 'completed', text: '完了' },
        { value: 'blocked', text: 'ブロック' }
      ];
      
      statusOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = `filter-button ${item.status === option.value ? 'active' : ''}`;
        button.textContent = option.text;
        button.style.fontSize = '11px';
        button.style.padding = '2px 5px';
        
        button.addEventListener('click', () => {
          vscode.postMessage({
            command: 'updateItemStatus',
            itemId: item.id,
            status: option.value
          });
          
          // UIの更新(Webサイドで一時的に反映)
          statusBadge.className = `status-badge status-${option.value}`;
          statusBadge.textContent = option.text;
          
          // ボタンのスタイル更新
          buttonsRow.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
          });
          button.classList.add('active');
          
          // アイテムのステータス属性を更新
          itemElement.setAttribute('data-status', option.value);
          
          // スタータスがcompletedの場合、進捗を100%に
          if (option.value === 'completed') {
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
          } else if (option.value === 'in-progress' && (item.progress === 0 || !item.progress)) {
            progressFill.style.width = '10%';
            progressText.textContent = '10%';
          }
        });
        
        buttonsRow.appendChild(button);
      });
      
      // 進捗率を直接入力するフォーム
      const progressFormRow = document.createElement('div');
      progressFormRow.style.display = 'flex';
      progressFormRow.style.alignItems = 'center';
      progressFormRow.style.marginTop = '5px';
      
      const progressLabel = document.createElement('label');
      progressLabel.textContent = '進捗率:';
      progressLabel.style.fontSize = '12px';
      progressLabel.style.marginRight = '5px';
      progressFormRow.appendChild(progressLabel);
      
      const progressInput = document.createElement('input');
      progressInput.type = 'number';
      progressInput.min = '0';
      progressInput.max = '100';
      progressInput.value = item.progress || 0;
      progressInput.style.width = '50px';
      progressInput.style.marginRight = '5px';
      progressFormRow.appendChild(progressInput);
      
      const updateButton = document.createElement('button');
      updateButton.textContent = '更新';
      updateButton.className = 'filter-button';
      updateButton.style.fontSize = '11px';
      updateButton.style.padding = '2px 5px';
      
      updateButton.addEventListener('click', () => {
        const newProgress = parseInt(progressInput.value, 10);
        
        if (newProgress >= 0 && newProgress <= 100) {
          vscode.postMessage({
            command: 'updateItemProgress',
            itemId: item.id,
            progress: newProgress
          });
          
          // UIの更新(Webサイドで一時的に反映)
          progressFill.style.width = `${newProgress}%`;
          progressText.textContent = `${newProgress}%`;
          
          // 進捗に基づいてステータスを更新
          let newStatus = item.status;
          
          if (newProgress >= 100) {
            newStatus = 'completed';
            statusBadge.className = 'status-badge status-completed';
            statusBadge.textContent = getStatusText('completed');
            itemElement.setAttribute('data-status', 'completed');
          } else if (newProgress > 0 && item.status === 'pending') {
            newStatus = 'in-progress';
            statusBadge.className = 'status-badge status-in-progress';
            statusBadge.textContent = getStatusText('in-progress');
            itemElement.setAttribute('data-status', 'in-progress');
          }
          
          // ボタンのスタイル更新
          buttonsRow.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === getStatusText(newStatus)) {
              btn.classList.add('active');
            }
          });
        }
      });
      
      progressFormRow.appendChild(updateButton);
      
      itemElement.appendChild(buttonsRow);
      itemElement.appendChild(progressFormRow);
      
      implementationItems.appendChild(itemElement);
    });
    
    // フィルターを適用
    filterImplementationItems();
  }
  
  // ステータスのテキスト表示を取得
  function getStatusText(status) {
    switch (status) {
      case 'pending': return '未着手';
      case 'in-progress': return '進行中';
      case 'completed': return '完了';
      case 'blocked': return 'ブロック';
      default: return '未設定';
    }
  }
  
  // メッセージ履歴の表示
  function renderMessageHistory() {
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    
    state.messages.forEach(msg => {
      if (msg.role === 'user') {
        addUserMessage(msg.content);
      } else if (msg.role === 'assistant') {
        addAIMessage(msg.content);
      }
    });
  }
  
  // 保存通知の表示
  function showSaveNotification(filename) {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.textContent = `コードが保存されました: ${filename}`;
    document.body.appendChild(notification);
    
    // 3秒後に通知を消す
    setTimeout(() => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
  
  // WebViewからのメッセージ処理
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateState':
        // 状態の更新
        Object.assign(state, message);
        renderPhasesList();
        updateProjectInfo();
        updateProgressDashboard();
        updateImplementationItems();
        break;
        
      case 'addUserMessage':
        // ユーザーメッセージの追加
        addUserMessage(message.text);
        break;
        
      case 'addAiMessage':
        // AIメッセージの追加
        addAIMessage(message.text);
        // 処理完了で送信ボタンを再有効化
        setProcessingState(false);
        // isSendingフラグもリセット
        isSending = false;
        break;
        
      case 'showError':
        // エラーメッセージの表示
        showError(message.message);
        // エラー発生時も送信ボタンを再有効化
        setProcessingState(false);
        // isSendingフラグもリセット
        isSending = false;
        break;
        
      case 'notifyCodeSaved':
        // コード保存通知
        showSaveNotification(message.filename);
        break;
        
      case 'showProcessing':
        // 処理中表示
        setProcessingState(message.processing);
        // 処理が完了した場合、isSendingフラグもリセット
        if (!message.processing) {
          isSending = false;
        }
        break;
    }
  });
})();