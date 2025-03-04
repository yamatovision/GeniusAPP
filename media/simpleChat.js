(function() {
  const vscode = acquireVsCodeApi();
  let isWaitingForResponse = false;

  // 初期化時に実行
  document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const clearChatButton = document.getElementById('clear-chat-button');
    const createProjectButton = document.getElementById('create-project-button');
    
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        sendMessage();
      }
    });
    
    // クリアボタンの設定
    if (clearChatButton) {
      clearChatButton.addEventListener('click', () => {
        // 確認ダイアログを表示せずに直接クリア（sandbox制約対応）
        clearChat();
      });
    }
    
    // プロジェクト作成ボタンの設定
    if (createProjectButton) {
      createProjectButton.addEventListener('click', createProject);
    }

    // 初期化メッセージを送信
    vscode.postMessage({ command: 'initialize' });
  });
  
  // チャット履歴をクリア
  function clearChat() {
    vscode.postMessage({
      command: 'clearChat'
    });
  }

  // メッセージ送信処理
  function sendMessage() {
    if (isWaitingForResponse) return;

    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    // ユーザーメッセージをUI追加
    addUserMessage(text);
    
    // メッセージを拡張機能に送信
    vscode.postMessage({
      command: 'sendMessage',
      text: text
    });
    
    // 入力フィールドをクリア
    messageInput.value = '';
    
    // 「考え中...」メッセージを表示
    addThinkingMessage();
    
    // 応答待ちフラグをセット
    isWaitingForResponse = true;
  }

  // ユーザーメッセージをチャットに追加
  function addUserMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message user';
    messageElement.innerHTML = `<p>${escapeHtml(text)}</p>`;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // AIの考え中メッセージを追加
  function addThinkingMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message ai thinking';
    messageElement.id = 'thinking-message';
    messageElement.innerHTML = '<p>考え中...<span class="dot-animation"></span></p>';
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // AIメッセージをチャットに追加
  function addAIMessage(text, codeBlocks) {
    // 考え中メッセージを削除
    const thinkingMessage = document.getElementById('thinking-message');
    if (thinkingMessage) {
      thinkingMessage.remove();
    }
    
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message ai';
    
    // コードブロックとリンクを処理
    const formattedText = formatText(text, codeBlocks);
    messageElement.innerHTML = formattedText;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // 保存ボタンにイベントリスナーを追加
    const saveButtons = messageElement.querySelectorAll('.save-code-btn');
    saveButtons.forEach(button => {
      button.addEventListener('click', function() {
        const blockId = parseInt(this.getAttribute('data-block-id'));
        vscode.postMessage({
          command: 'saveCodeBlock',
          blockId: blockId
        });
      });
    });
    
    // コピーボタンにイベントリスナーを追加
    const copyButtons = messageElement.querySelectorAll('.copy-code-btn');
    copyButtons.forEach(button => {
      button.addEventListener('click', function() {
        const blockId = parseInt(this.getAttribute('data-block-id'));
        const codeBlock = messageElement.querySelector(`.code-block[data-block-id="${blockId}"]`);
        if (codeBlock) {
          const codeElement = codeBlock.querySelector('code');
          if (codeElement) {
            // HTMLエンティティをデコードしてからクリップボードにコピー
            const codeText = decodeHtmlEntities(codeElement.textContent);
            navigator.clipboard.writeText(codeText).then(() => {
              // 成功通知
              const notification = document.createElement('div');
              notification.className = 'save-notification';
              notification.textContent = 'コードをクリップボードにコピーしました';
              document.body.appendChild(notification);
              
              // 数秒後に通知を消す
              setTimeout(() => {
                notification.classList.add('fadeout');
                setTimeout(() => {
                  notification.remove();
                }, 500);
              }, 2000);
            }).catch(() => {
              // エラー通知
              const notification = document.createElement('div');
              notification.className = 'save-notification';
              notification.textContent = 'コピーに失敗しました';
              document.body.appendChild(notification);
              
              setTimeout(() => {
                notification.classList.add('fadeout');
                setTimeout(() => {
                  notification.remove();
                }, 500);
              }, 2000);
            });
          }
        }
      });
    });
    
    // HTMLプレビューボタンにイベントリスナーを追加
    const previewButtons = messageElement.querySelectorAll('.preview-code-btn');
    previewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const blockId = parseInt(this.getAttribute('data-block-id'));
        
        // ブロックIDを送信して、サーバー側で正しいコードを取得できるようにする
        vscode.postMessage({
          command: 'openExternalPreview',
          blockId: blockId,
          html: '' // ブロックIDを優先するため空文字を送信
        });
      });
    });
    
    // 応答待ちフラグを解除
    isWaitingForResponse = false;
  }

  // テキストのフォーマット（コードブロック、リンクなど）
  function formatText(text, codeBlocks) {
    // バッククォートが既にエスケープされている可能性があるので、元に戻す
    let processedText = text.replace(/&#96;/g, '`');
    
    // コードブロックの処理（保存ボタン付き、HTMLの場合はプレビューボタン付き）
    let blockId = 0;
    let formattedText = processedText.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, function(match, language, code) {
      const currentBlockId = blockId++;
      const lowerLang = (language || '').toLowerCase();
      const isHtml = lowerLang === 'html';
      
      return `<div class="code-block" data-block-id="${currentBlockId}">
        <div class="code-header">
          <span class="language-name">${language || 'code'}</span>
          <div class="code-actions">
            ${isHtml ? `<button class="preview-code-btn" data-block-id="${currentBlockId}">プレビュー</button>` : ''}
            <button class="save-code-btn" data-block-id="${currentBlockId}">保存</button>
            <button class="copy-code-btn" data-block-id="${currentBlockId}">コピー</button>
          </div>
        </div>
        <pre><code>${escapeHtml(code)}</code></pre>
        </div>`;
    });
    
    // インラインコードの処理
    formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // URLをリンクに変換
    formattedText = formattedText.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank">$1</a>'
    );
    
    // 改行をbrタグに変換
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
  }

  // HTMLエスケープ
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // HTMLエンティティをデコードする
  function decodeHtmlEntities(text) {
    if (!text) return '';
    
    // textContentから取得したテキストをデコードするための処理
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#96;/g, '`')
      .replace(/<br\s*\/?>/g, '\n'); // <br>タグを改行に変換
    
    return textarea.value;
  }
  
  // ユーザーメッセージから自動的にプロジェクト構造を検出する処理は、
  // サーバー側の_handleSendMessage内で実装するため、この関数は削除
  
  // プロジェクト生成中メッセージを追加
  function addGeneratingMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message ai thinking';
    messageElement.id = 'generating-message';
    // 単純なテキストに変更して複雑なアニメーションを避ける
    messageElement.innerHTML = '<p>プロジェクト構造を生成中...</p>';
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // AIの応答にプロジェクト作成ボタンを追加する関数
  function addCreateProjectButtonToMessage(messageElement) {
    if (!messageElement) return;
    
    // 既に作成ボタンがある場合は追加しない
    if (messageElement.querySelector('.create-project-btn')) return;
    
    // コードブロックを含む場合のみボタンを追加
    if (messageElement.querySelector('.code-block')) {
      const createButton = document.createElement('button');
      createButton.className = 'project-action-btn create-project-btn';
      createButton.textContent = 'この構造でプロジェクトを作成';
      createButton.addEventListener('click', createProject);
      messageElement.appendChild(createButton);
    }
  }
  
  // プロジェクト作成（スケルトン）
  function createProject() {
    if (isWaitingForResponse) return;
    
    // 確認ダイアログではなく直接実行（VSCodeのWebview制約により）
    // 「作成中...」メッセージを表示
    addUserMessage("この構造でプロジェクトを作成してください。各ファイルには基本的なスケルトンコードを追加してください。");
    
    // メッセージを拡張機能に送信
    vscode.postMessage({
      command: 'createProject'
    });
    
    // 応答待ちフラグをセット
    isWaitingForResponse = true;
  }

  // 拡張機能からのメッセージ処理
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'addAIResponse':
        // 通常の応答処理（非ストリーミング）
        addAIMessage(message.text, message.codeBlocks);
        
        // プロジェクト作成ボタンの自動追加を削除
        // ユーザーが明示的にプロジェクト作成を求めた場合のみUIボタンから対応
        break;
        
      case 'projectStructureGenerated':
        // プロジェクト構造生成が完了した場合
        // 生成中メッセージを削除
        const generatingMsg = document.getElementById('generating-message');
        if (generatingMsg) {
          generatingMsg.remove();
        }
        
        // AIメッセージとして表示
        addAIMessage(message.text, message.codeBlocks);
        
        // プロジェクト作成ボタンの自動追加を削除
        // プロジェクト構造生成の後も、明示的なプロジェクト作成コマンドのみ有効にする
        break;
        
      case 'projectCreated':
        // プロジェクト作成完了時
        addAIMessage(message.text, message.codeBlocks);
        break;
        
      case 'showMessage':
        // 情報メッセージを表示
        const infoNotification = document.createElement('div');
        infoNotification.className = 'save-notification';
        infoNotification.textContent = message.text;
        document.body.appendChild(infoNotification);
        
        // 数秒後に通知を消す
        setTimeout(() => {
          infoNotification.classList.add('fadeout');
          setTimeout(() => {
            infoNotification.remove();
          }, 500);
        }, 5000);
        break;
      
      case 'startAIResponse':
        // ストリーミング応答の開始
        // 考え中メッセージを削除
        const thinkingMsg = document.getElementById('thinking-message');
        if (thinkingMsg) {
          thinkingMsg.remove();
        }
        
        // 新しいAIメッセージ要素を作成
        const chatMessagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message ai streaming-message';
        messageElement.id = 'streaming-message';
        messageElement.innerHTML = '<p></p>';
        chatMessagesContainer.appendChild(messageElement);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        break;
        
      case 'appendToAIResponse':
        // ストリーミング応答にテキストを追加
        const streamingMessage = document.getElementById('streaming-message');
        if (streamingMessage) {
          const messageParagraph = streamingMessage.querySelector('p');
          if (messageParagraph) {
            // ストリーミング表示用にそのまま使用 (整形しない)
            const text = message.text;
            
            // バッククォートをエスケープ処理
            const escapedText = text.replace(/`/g, '&#96;');
            
            // 改行をbrタグに変換
            const formattedText = escapedText.replace(/\n/g, '<br>');
            
            // テキストを追加
            messageParagraph.innerHTML += formattedText;
            
            // 確実に最下部にスクロール (時間差で実行)
            setTimeout(() => {
              const chatMessages = document.getElementById('chat-messages');
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 10);
          }
        }
        break;
        
      case 'finalizeAIResponse':
        // ストリーミング完了後、完全な応答で置き換え
        const streamingElement = document.getElementById('streaming-message');
        
        if (streamingElement) {
          // 要素のIDをクリア
          streamingElement.removeAttribute('id');
          
          // 完全に整形された応答で置き換え
          const formattedText = formatText(message.text, message.codeBlocks);
          streamingElement.innerHTML = formattedText;
          
          // イベントリスナーを設定
          const saveButtons = streamingElement.querySelectorAll('.save-code-btn');
          saveButtons.forEach(button => {
            button.addEventListener('click', function() {
              const blockId = parseInt(this.getAttribute('data-block-id'));
              vscode.postMessage({
                command: 'saveCodeBlock',
                blockId: blockId
              });
            });
          });
          
          // コピーボタンにイベントリスナーを追加
          const copyButtons = streamingElement.querySelectorAll('.copy-code-btn');
          copyButtons.forEach(button => {
            button.addEventListener('click', function() {
              const blockId = parseInt(this.getAttribute('data-block-id'));
              const codeBlock = streamingElement.querySelector(`.code-block[data-block-id="${blockId}"]`);
              if (codeBlock) {
                const codeElement = codeBlock.querySelector('code');
                if (codeElement) {
                  // HTMLエンティティをデコードしてからクリップボードにコピー
                  const codeText = decodeHtmlEntities(codeElement.textContent);
                  navigator.clipboard.writeText(codeText).then(() => {
                    // 成功通知
                    const notification = document.createElement('div');
                    notification.className = 'save-notification';
                    notification.textContent = 'コードをクリップボードにコピーしました';
                    document.body.appendChild(notification);
                    
                    // 数秒後に通知を消す
                    setTimeout(() => {
                      notification.classList.add('fadeout');
                      setTimeout(() => {
                        notification.remove();
                      }, 500);
                    }, 2000);
                  }).catch(() => {
                    // エラー通知
                    const notification = document.createElement('div');
                    notification.className = 'save-notification';
                    notification.textContent = 'コピーに失敗しました';
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                      notification.classList.add('fadeout');
                      setTimeout(() => {
                        notification.remove();
                      }, 500);
                    }, 2000);
                  });
                }
              }
            });
          });
          
          // HTMLプレビューボタンにイベントリスナーを追加
          const previewButtons = streamingElement.querySelectorAll('.preview-code-btn');
          previewButtons.forEach(button => {
            button.addEventListener('click', function() {
              const blockId = parseInt(this.getAttribute('data-block-id'));
              
              // ブロックIDを送信して、サーバー側で正しいコードを取得できるようにする
              vscode.postMessage({
                command: 'openExternalPreview',
                blockId: blockId,
                html: '' // ブロックIDを優先するため空文字を送信
              });
            });
          });
          
          // プロジェクト作成ボタンの自動追加を削除
          // ストリーミング完了後もプロジェクト作成ボタンは表示しない
          
          // メッセージコンテナを最下部にスクロール
          const scrollContainer = document.getElementById('chat-messages');
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
        
        // 応答待ちフラグを解除
        isWaitingForResponse = false;
        break;
        
      case 'showError':
        // 考え中メッセージを削除
        const thinkingMessage = document.getElementById('thinking-message');
        if (thinkingMessage) {
          thinkingMessage.remove();
        }
        
        // ストリーミングメッセージがあれば削除
        const streamingMsg = document.getElementById('streaming-message');
        if (streamingMsg) {
          streamingMsg.remove();
        }
        
        // エラーメッセージ表示
        const msgContainer = document.getElementById('chat-messages');
        const errorElement = document.createElement('div');
        errorElement.className = 'message error';
        errorElement.innerHTML = `<p>エラー: ${escapeHtml(message.text)}</p>`;
        msgContainer.appendChild(errorElement);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        
        // 応答待ちフラグを解除
        isWaitingForResponse = false;
        break;
        
      case 'codeSaved':
        // 保存成功通知を表示
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.textContent = `ファイルを保存しました: ${message.fileName}`;
        document.body.appendChild(notification);
        
        // 数秒後に通知を消す
        setTimeout(() => {
          notification.classList.add('fadeout');
          setTimeout(() => {
            notification.remove();
          }, 500);
        }, 3000);
        break;
        
      case 'chatCleared':
        // チャットメッセージをクリア
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        // 初期メッセージを追加
        const initialMessage = document.createElement('div');
        initialMessage.className = 'message ai';
        initialMessage.innerHTML = '<p>チャット履歴をクリアしました。新しい会話を始めましょう！</p>';
        chatMessages.appendChild(initialMessage);
        
        // 通知を表示
        const clearNotification = document.createElement('div');
        clearNotification.className = 'save-notification';
        clearNotification.textContent = 'チャット履歴をクリアしました';
        document.body.appendChild(clearNotification);
        
        // 数秒後に通知を消す
        setTimeout(() => {
          clearNotification.classList.add('fadeout');
          setTimeout(() => {
            clearNotification.remove();
          }, 500);
        }, 2000);
        
        break;
    }
  });
})();