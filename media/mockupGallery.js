(function() {
  // 変数定義
  let mockups = [];
  let currentMockupId = null;
  let mockupQueue = [];
  let isPanelCollapsed = false; // パネルの折りたたみ状態
  
  // 通知を表示する関数
  function showNotification(text) {
    // 既存の通知があれば削除
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
      notification.remove();
    });
    
    // 新しい通知要素を作成
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = text;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.backgroundColor = 'rgba(50, 50, 50, 0.9)';
    notification.style.color = 'white';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    notification.style.zIndex = '10000';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    
    // 通知をドキュメントに追加
    document.body.appendChild(notification);
    
    // フェードインエフェクト
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // 数秒後に通知を消す
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // VSCode API
  const vscode = acquireVsCodeApi();
  
  // ページが読み込まれたら初期化
  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    
    // 初期状態では削除ボタンを無効化
    const deleteMockupButton = document.getElementById('delete-mockup-button');
    if (deleteMockupButton) {
      deleteMockupButton.disabled = true;
    }
    
    // パネルの折りたたみ状態を復元
    restorePanelState();
    
    // モックアップのロードを要求
    vscode.postMessage({ command: 'loadMockups' });
  });
  
  // イベントリスナーの初期化
  function initEventListeners() {
    // パネル開閉ボタン
    const togglePanelButton = document.getElementById('toggle-panel-button');
    if (togglePanelButton) {
      togglePanelButton.addEventListener('click', () => {
        togglePanel();
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
    
    // モックアップ削除ボタン
    const deleteMockupButton = document.getElementById('delete-mockup-button');
    if (deleteMockupButton) {
      deleteMockupButton.addEventListener('click', () => {
        if (currentMockupId) {
          const currentMockup = mockups.find(m => m.id === currentMockupId);
          if (currentMockup) {
            // サンドボックスの制限でconfirm()が使えないため、直接削除コマンドを送信
            vscode.postMessage({
              command: 'deleteMockup',
              mockupId: currentMockupId
            });
          }
        }
      });
    }
    
    // AIと詳細を詰めるボタン
    const analyzeWithAiButton = document.getElementById('analyze-with-ai-button');
    if (analyzeWithAiButton) {
      analyzeWithAiButton.addEventListener('click', () => {
        if (currentMockupId) {
          vscode.postMessage({
            command: 'analyzeWithAI',
            mockupId: currentMockupId
          });
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
          <p>HTMLファイルをインポートしてモックアップを作成しましょう。</p>
        </div>
      `;
      return;
    }
    
    const ul = document.createElement('ul');
    ul.className = 'page-list';
    
    mockupsList.forEach(mockup => {
      const li = document.createElement('li');
      li.className = 'page-item';
      // データ属性としてモックアップIDを追加
      li.dataset.mockupId = mockup.id;
      
      if (mockup.id === currentMockupId) {
        li.classList.add('active');
      }
      
      li.innerHTML = `
        <a href="#">
          <span>${mockup.name}</span>
        </a>
      `;
      
      // モックアップ選択のイベントリスナー
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        selectMockup(mockup.id);
      });
      
      ul.appendChild(li);
    });
    
    container.appendChild(ul);
  }
  
  // モックアップの選択
  function selectMockup(mockupId) {
    // 以前のアクティブなアイテムを非アクティブに
    const activeItems = document.querySelectorAll('.page-item.active');
    activeItems.forEach(item => item.classList.remove('active'));
    
    // モックアップIDをデータ属性として設定するよう変更
    const mockupItems = document.querySelectorAll('.page-item');
    mockupItems.forEach(item => {
      if (item.dataset.mockupId === mockupId) {
        item.classList.add('active');
      }
    });
    
    // 現在のモックアップIDを更新
    currentMockupId = mockupId;
    
    // モックアップの表示を更新
    const mockup = mockups.find(m => m.id === mockupId);
    if (mockup) {
      renderMockupPreview(mockup);
      
      // 削除ボタンを有効化
      const deleteMockupButton = document.getElementById('delete-mockup-button');
      if (deleteMockupButton) {
        deleteMockupButton.disabled = false;
      }
    }
  }
  
  // モックアップの描画
  function renderMockupPreview(mockup) {
    // mockupFrameがiframeであることを確認
    const mockupFrame = document.getElementById('mockup-frame');
    const previewTitle = document.getElementById('preview-title');
    
    if (!mockupFrame) {
      console.error('mockup-frame element not found');
      return;
    }
    
    // モックアップパネルを表示状態にする
    const mockupPanel = document.querySelector('.mockup-panel');
    if (mockupPanel) {
      mockupPanel.style.display = 'flex';
    }
    
    // タイトルを更新
    if (previewTitle) {
      previewTitle.textContent = mockup.name;
    }
    
    // HTMLを描画 - 処理前にHTML表示を非表示にして、iframeを表示状態にする
    const htmlDisplay = document.getElementById('html-code-display');
    if (htmlDisplay) {
      htmlDisplay.style.display = 'none';
    }
    mockupFrame.style.display = 'block';
    
    // HTMLを描画
    try {
      // 安全にiframeにアクセス
      setTimeout(() => {
        try {
          const doc = mockupFrame.contentDocument || (mockupFrame.contentWindow && mockupFrame.contentWindow.document);
          if (doc) {
            doc.open();
            doc.write(mockup.html);
            doc.close();
          } else {
            console.error('Cannot access iframe document');
          }
        } catch (innerError) {
          console.error('Error in delayed iframe rendering:', innerError);
        }
      }, 10);
    } catch (error) {
      console.error('Error rendering mockup preview:', error);
    }
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
      // 正しいデータ属性名を使用
      const itemId = item.dataset.mockupId;
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
  
  // 削除されたメソッド（使用されなくなった）
  
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
          
          // 現在表示中のモックアップが更新された場合、強制的に再描画
          if (currentMockupId === message.mockup.id) {
            // 強制的に再読み込み
            const mockupFrame = document.getElementById('mockup-frame');
            if (mockupFrame) {
              try {
                const doc = mockupFrame.contentDocument || (mockupFrame.contentWindow && mockupFrame.contentWindow.document);
                if (doc) {
                  doc.open();
                  doc.write(message.mockup.html);
                  doc.close();
                }
              } catch (error) {
                console.error('Error rendering updated mockup:', error);
              }
            }
          }
          
          // AIからの応答を追加 (テキストがある場合のみ)
          if (message.text) {
            addChatMessage(message.text, 'ai');
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
              // モックアップがなければプレビューをリセット
              const mockupFrame = document.getElementById('mockup-frame');
              if (mockupFrame) {
                try {
                  const doc = mockupFrame.contentDocument || (mockupFrame.contentWindow && mockupFrame.contentWindow.document);
                  if (doc) {
                    doc.open();
                    doc.write('<div style="padding: 20px; text-align: center;"><p>モックアップがありません</p></div>');
                    doc.close();
                  }
                } catch (error) {
                  console.error('Error resetting iframe:', error);
                }
              }
              
              // プレビュータイトルをリセット
              const previewTitle = document.getElementById('preview-title');
              if (previewTitle) {
                previewTitle.textContent = 'モックアップ';
              }
              
              // ステータスバッジをリセット
              const statusBadge = document.querySelector('.toolbar-left .page-status');
              if (statusBadge) {
                statusBadge.className = 'page-status status-pending';
                statusBadge.textContent = '未選択';
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
        
      case 'showNotification':
        // 通知を表示
        if (message.text) {
          showNotification(message.text);
        }
        break;
        
      case 'clearMockupFrame':
        // フレームを一時的にクリア (古いコンテンツがちらつくのを防止)
        const mockupFrame = document.getElementById('mockup-frame');
        if (mockupFrame) {
          try {
            const doc = mockupFrame.contentDocument || (mockupFrame.contentWindow && mockupFrame.contentWindow.document);
            if (doc) {
              doc.open();
              doc.write(message.loadingMessage || '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial; color: #666;">読み込み中...</div>');
              doc.close();
            }
          } catch (error) {
            console.error('Error clearing mockup frame:', error);
          }
        }
        break;
        
      case 'projectChanged':
        // プロジェクトが変更された - フレームをクリアして通知表示
        showNotification(`プロジェクトを切り替えました: ${message.projectName || path.basename(message.projectPath)}`);
        currentMockupId = null; // 現在のモックアップID選択状態をリセット
        
        // モックアップが選択されなくなったので削除ボタンを無効化
        const deleteMockupButton = document.getElementById('delete-mockup-button');
        if (deleteMockupButton) {
          deleteMockupButton.disabled = true;
        }
        break;
        
      case 'displayDirectHtml':
        // HTMLを直接表示（IDなしで表示）
        if (message.html) {
          // 現在のモックアップIDを一時的にクリア
          const previousMockupId = currentMockupId;
          currentMockupId = null;
          
          // タイトルを更新
          const previewTitle = document.getElementById('preview-title');
          if (previewTitle) {
            previewTitle.textContent = message.title || 'プレビュー';
          }
          
          // ステータスバッジを更新
          const statusBadge = document.querySelector('.toolbar-left .page-status');
          if (statusBadge) {
            statusBadge.className = 'page-status status-review';
            statusBadge.textContent = 'プレビュー中';
          }
          
          // iframeにHTMLを直接書き込み
          const mockupFrame = document.getElementById('mockup-frame');
          if (mockupFrame) {
            try {
              // HTMLディスプレイを非表示に
              const htmlDisplay = document.getElementById('html-code-display');
              if (htmlDisplay) {
                htmlDisplay.style.display = 'none';
              }
              
              // iframeを表示
              mockupFrame.style.display = 'block';
              
              // HTMLを書き込み
              const doc = mockupFrame.contentDocument || (mockupFrame.contentWindow && mockupFrame.contentWindow.document);
              if (doc) {
                doc.open();
                doc.write(message.html);
                doc.close();
                
                // 承認UIをリセット
                resetApprovalUI();
                
                // チャット履歴をクリア
                const chatHistory = document.getElementById('chat-history');
                if (chatHistory) {
                  chatHistory.innerHTML = '';
                  addChatMessage('プレビューモードでHTMLを直接表示しています。このモードではフィードバックや承認機能は利用できません。', 'ai');
                }
                
                // 通知
                console.log('Direct HTML display:', message.title);
              }
            } catch (error) {
              console.error('Error displaying direct HTML:', error);
            }
          }
        }
        break;
    }
  });
  
  // 承認UIをリセット
  function resetApprovalUI() {
    const implementationNotes = document.getElementById('implementation-notes');
    const approveButton = document.getElementById('approve-button');
    
    if (implementationNotes) {
      implementationNotes.value = '';
      implementationNotes.disabled = true;
    }
    
    if (approveButton) {
      approveButton.disabled = true;
      approveButton.textContent = 'プレビューモード';
    }
    
    const updateRequestButton = document.getElementById('update-request-button');
    if (updateRequestButton) {
      updateRequestButton.disabled = true;
    }
  }
  
  // パネルの折りたたみ状態を切り替え
  function togglePanel() {
    const appContainer = document.querySelector('.app-container');
    const toggleButton = document.getElementById('toggle-panel-button');
    
    if (!appContainer || !toggleButton) return;
    
    // 折りたたみ状態を反転
    isPanelCollapsed = !isPanelCollapsed;
    
    // 状態をLocalStorageに保存
    localStorage.setItem('mockupGallery.isPanelCollapsed', isPanelCollapsed);
    
    // クラスの切り替え
    if (isPanelCollapsed) {
      appContainer.classList.add('panel-collapsed');
      toggleButton.innerHTML = '&#9654;'; // 右向き三角形
    } else {
      appContainer.classList.remove('panel-collapsed');
      toggleButton.innerHTML = '&#9664;'; // 左向き三角形
    }
  }
  
  // パネルの折りたたみ状態を復元
  function restorePanelState() {
    // LocalStorageから状態を取得
    const savedState = localStorage.getItem('mockupGallery.isPanelCollapsed');
    if (savedState === 'true') {
      isPanelCollapsed = true;
      
      // UIの状態を更新
      const appContainer = document.querySelector('.app-container');
      const toggleButton = document.getElementById('toggle-panel-button');
      
      if (appContainer) {
        appContainer.classList.add('panel-collapsed');
      }
      
      if (toggleButton) {
        toggleButton.innerHTML = '&#9654;'; // 右向き三角形
      }
    }
  }
})();