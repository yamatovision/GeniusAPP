// シンプルモックアップエディターのフロントエンドスクリプト
(function() {
  // VSCodeのAPIを取得
  const vscode = acquireVsCodeApi();
  
  // 状態を初期化
  let state = {
    mockups: [],
    selectedMockupId: null,
    loading: false,
    messages: []
  };
  
  // 要素を取得
  const mockupsContainer = document.getElementById('mockups-container');
  const previewContainer = document.getElementById('preview-container');
  const previewFrame = document.getElementById('preview-frame');
  const previewTitle = document.getElementById('preview-title');
  const editTextarea = document.getElementById('edit-textarea');
  const sendButton = document.getElementById('send-button');
  const importButton = document.getElementById('import-button');
  const refreshButton = document.getElementById('refresh-button');
  const chatHistory = document.getElementById('chat-history');
  const loadingOverlay = document.getElementById('loading-overlay');
  
  // モックアップリストを更新
  function updateMockupsList() {
    // モックアップリストのコンテナをクリア
    mockupsContainer.innerHTML = '';
    
    if (state.mockups.length === 0) {
      // モックアップがない場合は空の状態を表示
      mockupsContainer.innerHTML = `
        <div class="empty-state">
          <p>モックアップがありません。モックアップをインポートするか、要件定義ビジュアライザーで作成してください。</p>
        </div>`;
      return;
    }
    
    // 各モックアップをリストに追加
    state.mockups.forEach(mockup => {
      const mockupElement = document.createElement('div');
      mockupElement.className = `mockup-item ${state.selectedMockupId === mockup.id ? 'selected' : ''}`;
      mockupElement.dataset.id = mockup.id;
      
      const sourceIcon = {
        'requirements': '📋',
        'manual': '✏️',
        'imported': '📥'
      }[mockup.sourceType] || '📄';
      
      // 日付フォーマット
      const createdDate = new Date(mockup.createdAt).toLocaleString();
      const updatedDate = new Date(mockup.updatedAt).toLocaleString();
      
      mockupElement.innerHTML = `
        <div class="mockup-name">${sourceIcon} ${mockup.name}</div>
        <div class="mockup-info">作成: ${createdDate}</div>
        <div class="mockup-info">更新: ${updatedDate}</div>
        <div class="mockup-actions-row">
          <button class="button button-small preview-button" data-id="${mockup.id}">プレビュー</button>
          <button class="button button-small button-secondary edit-button" data-id="${mockup.id}">編集</button>
          <button class="button button-small button-secondary browser-button" data-id="${mockup.id}">ブラウザで開く</button>
          <button class="button button-small button-secondary delete-button" data-id="${mockup.id}">削除</button>
        </div>
      `;
      
      // モックアップをクリックした時の処理
      mockupElement.addEventListener('click', (e) => {
        // ボタンクリックは個別に処理
        if (e.target.closest('button')) {
          return;
        }
        
        selectMockup(mockup.id);
      });
      
      // プレビューボタンのイベント
      const previewButton = mockupElement.querySelector('.preview-button');
      previewButton.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMockup(mockup.id);
      });
      
      // 編集ボタンのイベント
      const editButton = mockupElement.querySelector('.edit-button');
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMockup(mockup.id);
        // フォーカスを編集エリアに移動
        editTextarea.focus();
      });
      
      // ブラウザで開くボタンのイベント
      const browserButton = mockupElement.querySelector('.browser-button');
      browserButton.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({
          command: 'openInBrowser',
          mockupId: mockup.id
        });
      });
      
      // 削除ボタンのイベント
      const deleteButton = mockupElement.querySelector('.delete-button');
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`「${mockup.name}」を削除しますか？この操作は元に戻せません。`)) {
          vscode.postMessage({
            command: 'deleteMockup',
            mockupId: mockup.id
          });
        }
      });
      
      mockupsContainer.appendChild(mockupElement);
    });
  }
  
  // モックアップを選択
  function selectMockup(mockupId) {
    state.selectedMockupId = mockupId;
    
    // 選択状態をUIに反映
    document.querySelectorAll('.mockup-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.id === mockupId);
    });
    
    // 選択されたモックアップを取得
    const mockup = state.mockups.find(m => m.id === mockupId);
    
    if (mockup) {
      // プレビューを更新
      updatePreview(mockup);
      
      // チャット履歴をクリア
      clearChatHistory();
      
      // ウェルカムメッセージを追加
      addAssistantMessage(`モックアップ「${mockup.name}」が選択されました。このモックアップに対する変更指示を入力してください。例: "ボタンの色を青に変更する"、"ヘッダーにロゴを追加する"など`);
    }
  }
  
  // プレビューを更新
  function updatePreview(mockup) {
    if (!mockup) {
      previewContainer.style.display = 'none';
      return;
    }
    
    previewContainer.style.display = 'flex';
    previewTitle.textContent = mockup.name;
    
    // iframeのsrcdocでHTMLを表示
    previewFrame.srcdoc = mockup.html;
  }
  
  // チャット履歴をクリア
  function clearChatHistory() {
    chatHistory.innerHTML = '';
    state.messages = [];
  }
  
  // ユーザーメッセージを追加
  function addUserMessage(text) {
    const message = {
      role: 'user',
      content: text
    };
    
    state.messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message user';
    messageElement.innerHTML = `
      <div class="message-content">${text}</div>
    `;
    
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  
  // AIアシスタントメッセージを追加
  function addAssistantMessage(text) {
    const message = {
      role: 'assistant',
      content: text
    };
    
    state.messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message assistant';
    messageElement.innerHTML = `
      <div class="message-content">${formatMessage(text)}</div>
    `;
    
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  
  // メッセージのフォーマット（簡易的なMarkdown対応）
  function formatMessage(text) {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }
  
  // ローディング表示の切り替え
  function setLoading(isLoading) {
    state.loading = isLoading;
    
    if (isLoading) {
      loadingOverlay.style.display = 'flex';
    } else {
      loadingOverlay.style.display = 'none';
    }
  }
  
  // エディット内容を送信
  function sendEditMessage() {
    const text = editTextarea.value.trim();
    
    if (!text) {
      return;
    }
    
    if (!state.selectedMockupId) {
      alert('モックアップを先に選択してください');
      return;
    }
    
    // UIの編集メッセージを追加
    addUserMessage(text);
    
    // 入力欄をクリア
    editTextarea.value = '';
    
    // バックエンドに送信
    vscode.postMessage({
      command: 'updateMockup',
      mockupId: state.selectedMockupId,
      text: text
    });
    
    // ローディング表示
    setLoading(true);
  }
  
  // モックアップのインポート
  function importMockup() {
    vscode.postMessage({
      command: 'importMockup'
    });
  }
  
  // モックアップリストの更新
  function refreshMockupList() {
    vscode.postMessage({
      command: 'loadMockups'
    });
    
    // ローディング表示
    setLoading(true);
  }
  
  // 初期化
  function initialize() {
    // イベントリスナーの設定
    sendButton.addEventListener('click', sendEditMessage);
    
    importButton.addEventListener('click', importMockup);
    
    refreshButton.addEventListener('click', refreshMockupList);
    
    // Enterキーでの送信（Shift+Enterは改行）
    editTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendEditMessage();
      }
    });
    
    // 初期メッセージ
    addAssistantMessage('モックアップエディターへようこそ。左側のリストからモックアップを選択するか、「インポート」ボタンからモックアップをインポートしてください。');
    
    // モックアップの読み込み
    refreshMockupList();
  }
  
  // VSCodeからのメッセージハンドラ
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateMockups':
        state.mockups = message.mockups;
        updateMockupsList();
        setLoading(false);
        break;
        
      case 'mockupUpdated':
        // モックアップが更新された場合
        const updatedMockup = message.mockup;
        
        // 状態のモックアップを更新
        const index = state.mockups.findIndex(m => m.id === updatedMockup.id);
        if (index !== -1) {
          state.mockups[index] = updatedMockup;
        }
        
        // プレビューを更新
        if (state.selectedMockupId === updatedMockup.id) {
          updatePreview(updatedMockup);
        }
        
        // リストを更新
        updateMockupsList();
        
        // ローディング終了
        setLoading(false);
        
        // アシスタントメッセージを追加
        addAssistantMessage(message.text || 'モックアップが更新されました。');
        break;
        
      case 'showError':
        alert(message.text);
        setLoading(false);
        break;
        
      case 'mockupDeleted':
        // モックアップが削除された場合
        const deletedId = message.mockupId;
        
        // 状態からモックアップを削除
        state.mockups = state.mockups.filter(m => m.id !== deletedId);
        
        // 選択中のモックアップが削除された場合はクリア
        if (state.selectedMockupId === deletedId) {
          state.selectedMockupId = null;
          previewContainer.style.display = 'none';
        }
        
        // リストを更新
        updateMockupsList();
        break;
        
      case 'addAssistantMessage':
        addAssistantMessage(message.text);
        setLoading(false);
        break;
    }
  });
  
  // 初期化の実行
  initialize();
})();