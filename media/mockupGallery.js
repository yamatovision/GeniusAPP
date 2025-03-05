(function() {
  // 変数定義
  let mockups = [];
  let currentMockupId = null;
  let mockupQueue = [];
  
  // VSCode API
  const vscode = acquireVsCodeApi();
  
  // ページが読み込まれたら初期化
  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    
    // モックアップのロードを要求
    vscode.postMessage({ command: 'loadMockups' });
  });
  
  // イベントリスナーの初期化
  function initEventListeners() {
    // 一括生成ボタン
    const generateAllButton = document.getElementById('generate-all-button');
    if (generateAllButton) {
      generateAllButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'generateAllMockups' });
      });
    }
    
    // 更新ボタン
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'loadMockups' });
      });
    }
    
    // ブラウザで開くボタン
    const openInBrowserButton = document.getElementById('open-in-browser-button');
    if (openInBrowserButton) {
      openInBrowserButton.addEventListener('click', () => {
        if (currentMockupId) {
          vscode.postMessage({
            command: 'openInBrowser',
            mockupId: currentMockupId
          });
        }
      });
    }
    
    // HTMLを表示ボタン
    const showHtmlButton = document.getElementById('show-html-button');
    if (showHtmlButton) {
      showHtmlButton.addEventListener('click', () => {
        if (currentMockupId) {
          // HTMLの表示/非表示を切り替え
          const mockupFrame = document.getElementById('mockup-frame');
          const htmlDisplay = document.getElementById('html-code-display');
          
          if (mockupFrame && htmlDisplay) {
            if (htmlDisplay.style.display === 'none') {
              // HTMLコードを表示
              const currentMockup = mockups.find(m => m.id === currentMockupId);
              if (currentMockup) {
                htmlDisplay.textContent = currentMockup.html;
                htmlDisplay.style.display = 'block';
                mockupFrame.style.display = 'none';
                showHtmlButton.textContent = 'プレビュー表示';
              }
            } else {
              // プレビューに戻す
              htmlDisplay.style.display = 'none';
              mockupFrame.style.display = 'block';
              showHtmlButton.textContent = 'HTML表示';
            }
          }
        }
      });
    }
    
    // フィードバック送信ボタン
    const sendButton = document.getElementById('send-button');
    const chatInput = document.getElementById('chat-input');
    
    if (sendButton && chatInput) {
      sendButton.addEventListener('click', () => {
        sendFeedback();
      });
      
      // Enterキーでも送信可能に
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendFeedback();
        }
      });
    }
    
    // クイックコマンドのクリック
    const commandChips = document.querySelectorAll('.command-chip');
    commandChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (chatInput) {
          chatInput.value = chip.textContent;
          chatInput.focus();
        }
      });
    });
    
    // 承認ボタン
    const approveButton = document.getElementById('approve-button');
    if (approveButton) {
      approveButton.addEventListener('click', () => {
        if (currentMockupId) {
          // 実装メモを取得
          const implementationNotes = document.getElementById('implementation-notes');
          const notes = implementationNotes ? implementationNotes.value : '';
          
          // 実装メモを保存
          vscode.postMessage({
            command: 'saveImplementationNotes',
            mockupId: currentMockupId,
            notes: notes
          });
          
          // モックアップのステータスを更新
          vscode.postMessage({
            command: 'updateMockupStatus',
            mockupId: currentMockupId,
            status: 'approved'
          });
          
          // UI表示を更新
          updateMockupStatusUI(currentMockupId, 'approved');
        }
      });
    }
    
    // 更新依頼ボタン
    const updateRequestButton = document.getElementById('update-request-button');
    if (updateRequestButton) {
      updateRequestButton.addEventListener('click', () => {
        if (chatInput) {
          chatInput.focus();
          chatInput.placeholder = '更新依頼の内容を入力してください...';
        }
      });
    }
    
    // インポートボタン
    const importButton = document.getElementById('import-button');
    if (importButton) {
      importButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'importMockup' });
      });
    }
  }
  
  // フィードバックの送信
  function sendFeedback() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !currentMockupId || !chatInput.value.trim()) return;
    
    const feedback = chatInput.value.trim();
    
    // フィードバックをチャット履歴に追加
    addChatMessage(feedback, 'user');
    
    // VSCodeにフィードバックを送信
    vscode.postMessage({
      command: 'updateMockup',
      mockupId: currentMockupId,
      text: feedback
    });
    
    // フィードバックを保存
    vscode.postMessage({
      command: 'addFeedback',
      mockupId: currentMockupId,
      feedback: feedback
    });
    
    // 入力欄をクリア
    chatInput.value = '';
  }
  
  // チャットメッセージの追加
  function addChatMessage(text, sender) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    messageDiv.textContent = text;
    
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  
  // モックアップリストの表示
  function renderMockupList(mockupsList) {
    const container = document.getElementById('mockups-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (mockupsList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>モックアップがありません。</p>
          <p>要件定義やディレクトリ構造からモックアップを作成しましょう。</p>
        </div>
      `;
      return;
    }
    
    const ul = document.createElement('ul');
    ul.className = 'page-list';
    
    mockupsList.forEach(mockup => {
      const li = document.createElement('li');
      li.className = 'page-item';
      if (mockup.id === currentMockupId) {
        li.classList.add('active');
      }
      
      const status = mockup.status || 'pending';
      
      li.innerHTML = `
        <a href="#">
          <span>${mockup.name}</span>
          <span class="page-status status-${status}">${getStatusLabel(status)}</span>
        </a>
      `;
      
      li.addEventListener('click', () => {
        selectMockup(mockup.id);
      });
      
      ul.appendChild(li);
    });
    
    container.appendChild(ul);
    
    // キュー情報を更新
    updateQueueInfo();
  }
  
  // モックアップの選択
  function selectMockup(mockupId) {
    // 以前のアクティブなアイテムを非アクティブに
    const activeItems = document.querySelectorAll('.page-item.active');
    activeItems.forEach(item => item.classList.remove('active'));
    
    // 新しいアイテムをアクティブに
    const selectedItem = document.querySelector(`.page-item a span:first-child:contains('${mockupId}')`).closest('.page-item');
    if (selectedItem) {
      selectedItem.classList.add('active');
    }
    
    // 現在のモックアップIDを更新
    currentMockupId = mockupId;
    
    // モックアップの表示を更新
    const mockup = mockups.find(m => m.id === mockupId);
    if (mockup) {
      renderMockupPreview(mockup);
      loadMockupChatHistory(mockup);
      updateApprovalUI(mockup);
    }
  }
  
  // モックアップの描画
  function renderMockupPreview(mockup) {
    const previewContainer = document.getElementById('preview-container');
    const mockupFrame = document.getElementById('mockup-frame');
    const previewTitle = document.getElementById('preview-title');
    const statusBadge = document.querySelector('.toolbar-left .page-status');
    
    if (!previewContainer || !mockupFrame) return;
    
    // 表示を有効に
    previewContainer.style.display = 'block';
    
    // タイトルを更新
    if (previewTitle) {
      previewTitle.textContent = mockup.name;
    }
    
    // ステータスバッジを更新
    if (statusBadge) {
      statusBadge.className = `page-status status-${mockup.status || 'pending'}`;
      statusBadge.textContent = getStatusLabel(mockup.status || 'pending');
    }
    
    // HTMLを描画
    const doc = mockupFrame.contentDocument || mockupFrame.contentWindow.document;
    doc.open();
    doc.write(mockup.html);
    doc.close();
  }
  
  // チャット履歴の読み込み
  function loadMockupChatHistory(mockup) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;
    
    // チャット履歴をクリア
    chatHistory.innerHTML = '';
    
    // AIの初期メッセージ
    addChatMessage('モックアップを生成しました。フィードバックや修正依頼があれば入力してください。', 'ai');
    
    // フィードバック履歴を表示
    if (mockup.feedback && Array.isArray(mockup.feedback)) {
      mockup.feedback.forEach(feedback => {
        addChatMessage(feedback, 'user');
      });
    }
  }
  
  // 承認UI更新
  function updateApprovalUI(mockup) {
    const implementationNotes = document.getElementById('implementation-notes');
    const approveButton = document.getElementById('approve-button');
    
    if (implementationNotes) {
      implementationNotes.value = mockup.implementationNotes || '';
    }
    
    if (approveButton) {
      // 承認済みなら非活性化
      if (mockup.status === 'approved') {
        approveButton.disabled = true;
        approveButton.textContent = '承認済み';
      } else {
        approveButton.disabled = false;
        approveButton.textContent = 'このモックアップを承認';
      }
    }
  }
  
  // モックアップステータスUIの更新
  function updateMockupStatusUI(mockupId, status) {
    // モックアップリストの更新
    const mockupItems = document.querySelectorAll('.page-item');
    mockupItems.forEach(item => {
      const itemId = item.dataset.id;
      if (itemId === mockupId) {
        const statusBadge = item.querySelector('.page-status');
        if (statusBadge) {
          statusBadge.className = `page-status status-${status}`;
          statusBadge.textContent = getStatusLabel(status);
        }
      }
    });
    
    // ツールバーのステータスバッジも更新
    if (currentMockupId === mockupId) {
      const statusBadge = document.querySelector('.toolbar-left .page-status');
      if (statusBadge) {
        statusBadge.className = `page-status status-${status}`;
        statusBadge.textContent = getStatusLabel(status);
      }
    }
    
    // モックアップオブジェクトのステータスも更新
    const mockup = mockups.find(m => m.id === mockupId);
    if (mockup) {
      mockup.status = status;
      
      // 承認/レビュー状態の場合、UIも更新
      if (currentMockupId === mockupId) {
        updateApprovalUI(mockup);
      }
    }
  }
  
  // キュー情報の更新
  function updateQueueInfo() {
    const queueInfo = document.querySelector('.queue-info');
    if (!queueInfo) return;
    
    // ステータス集計
    const pending = mockups.filter(m => m.status === 'pending').length;
    const generating = mockups.filter(m => m.status === 'generating').length;
    const completed = mockups.filter(m => ['review', 'approved'].includes(m.status)).length;
    const total = mockups.length;
    
    queueInfo.innerHTML = `
      <p><strong>処理状況:</strong> ${generating}件生成中 / ${pending}件待機中</p>
      <p><strong>完了:</strong> ${completed}/${total} ページ</p>
    `;
  }
  
  // ステータスラベルの取得
  function getStatusLabel(status) {
    switch(status) {
      case 'pending': return '未生成';
      case 'generating': return '生成中';
      case 'review': return 'レビュー中';
      case 'approved': return '承認済み';
      default: return status;
    }
  }
  
  // VSCodeからのメッセージ受信処理
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateMockups':
        // モックアップ一覧を更新
        mockups = message.mockups || [];
        renderMockupList(mockups);
        
        // 最初のモックアップを選択（存在すれば）
        if (mockups.length > 0 && !currentMockupId) {
          selectMockup(mockups[0].id);
        }
        break;
        
      case 'selectMockup':
        // 特定のモックアップを選択
        if (message.mockupId) {
          selectMockup(message.mockupId);
        }
        break;
        
      case 'mockupUpdated':
        // モックアップが更新された
        if (message.mockup) {
          // モックアップ配列内のモックアップを更新
          const index = mockups.findIndex(m => m.id === message.mockup.id);
          if (index !== -1) {
            mockups[index] = message.mockup;
          }
          
          // 現在表示中のモックアップが更新された場合、再描画
          if (currentMockupId === message.mockup.id) {
            renderMockupPreview(message.mockup);
          }
          
          // AIからの応答を追加
          if (message.text) {
            addChatMessage(message.text, 'ai');
          } else {
            addChatMessage('モックアップを更新しました。他に修正が必要な箇所はありますか？', 'ai');
          }
        }
        break;
        
      case 'mockupDeleted':
        // モックアップが削除された
        if (message.mockupId) {
          // 配列から削除
          mockups = mockups.filter(m => m.id !== message.mockupId);
          
          // リストを再描画
          renderMockupList(mockups);
          
          // 現在表示中のモックアップが削除された場合、表示を変更
          if (currentMockupId === message.mockupId) {
            currentMockupId = null;
            
            // 別のモックアップがあれば選択
            if (mockups.length > 0) {
              selectMockup(mockups[0].id);
            } else {
              // モックアップがなければプレビューを非表示
              const previewContainer = document.getElementById('preview-container');
              if (previewContainer) {
                previewContainer.style.display = 'none';
              }
            }
          }
        }
        break;
        
      case 'updateQueueStatus':
        // キュー情報を更新
        if (message.status) {
          // UIを更新
          const queueInfo = document.querySelector('.queue-info');
          if (queueInfo) {
            queueInfo.innerHTML = `
              <p><strong>処理状況:</strong> ${message.status.processing}件生成中 / ${message.status.queued}件待機中</p>
              <p><strong>完了:</strong> ${message.status.completed}/${message.status.total} ページ</p>
            `;
          }
        }
        break;
        
      case 'mockupGenerated':
        // モックアップが生成された
        if (message.mockupId) {
          // キュー情報を更新
          updateQueueInfo();
          
          // モックアップリストを再読み込み
          vscode.postMessage({ command: 'loadMockups' });
          
          // 通知
          addChatMessage(`モックアップ「${message.pageName}」が生成されました。`, 'ai');
        }
        break;
        
      case 'addAssistantMessage':
        // AIからのメッセージを追加
        if (message.text) {
          addChatMessage(message.text, 'ai');
        }
        break;
        
      case 'showError':
        // エラーメッセージを表示
        if (message.text) {
          addChatMessage(`エラー: ${message.text}`, 'ai');
        }
        break;
    }
  });
})();