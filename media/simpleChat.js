(function() {
  const vscode = acquireVsCodeApi();
  let isWaitingForResponse = false;
  let activeTab = 'chat'; // Default active tab
  let requirementsContent = '';

  // 初期化時に実行
  document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const clearChatButton = document.getElementById('clear-chat-button');
    const exportRequirementsButton = document.getElementById('export-requirements-button');
    
    // 送信ボタンのイベントリスナーを再登録
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
      console.log('送信ボタンにイベントリスナーを設定しました');
    } else {
      console.error('送信ボタンが見つかりません');
    }
    
    // 入力フィールドのイベントリスナーを再登録
    if (messageInput) {
      messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault(); // フォーム送信を防止
          sendMessage();
        }
      });
      console.log('メッセージ入力欄にイベントリスナーを設定しました');
    } else {
      console.error('メッセージ入力欄が見つかりません');
    }
    
    // クリアボタンの設定
    if (clearChatButton) {
      clearChatButton.addEventListener('click', () => {
        // 確認ダイアログを表示せずに直接クリア（sandbox制約対応）
        clearChat();
      });
    }
    
    // 要件定義エクスポートボタンの設定
    if (exportRequirementsButton) {
      exportRequirementsButton.addEventListener('click', exportRequirements);
    }

    // Tab functionality
    addTabFunctionality();

    // File editor functionality
    addFileEditorFunctionality();
    
    // 初期ビューの設定
    // デフォルトタブの設定
    const defaultTab = 'chat';
    switchTab(defaultTab);
    
    // 初期化メッセージを送信
    vscode.postMessage({ command: 'initialize' });
    
    console.log('初期化処理が完了しました');
  });

  // タブ機能を追加
  function addTabFunctionality() {
    // HTMLにすでにタブ要素がある場合の処理
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabButtons.length > 0) {
      console.log(`タブボタンが見つかりました (${tabButtons.length}個)`);
      
      // すでに存在するタブボタンにイベントリスナーを追加
      tabButtons.forEach(button => {
        const tabId = button.id.replace('tab-', '');
        
        // クリックイベントを設定
        button.addEventListener('click', () => {
          console.log(`タブクリック: ${tabId}`);
          switchTab(tabId);
        });
        
        console.log(`タブボタンにイベントリスナーを設定: ${button.id} -> ${tabId}`);
      });
      
      // タブコンテンツの初期状態を設定
      if (tabContents.length > 0) {
        console.log(`タブコンテンツが見つかりました (${tabContents.length}個)`);
        
        // 初期状態ではすべて非表示に
        tabContents.forEach(content => {
          // すべてのコンテンツを一旦非表示に
          content.classList.add('hidden');
          content.style.display = 'none';
        });
        
        // チャットタブを初期表示に設定
        const chatContent = document.getElementById('content-chat');
        if (chatContent) {
          chatContent.classList.remove('hidden');
          chatContent.classList.add('active');
          chatContent.style.display = 'block';
        }
      }
      
      // デフォルトの active タブを設定
      document.getElementById('tab-chat')?.classList.add('active');
      
      return;
    }
    
    // 以下は互換性のために残しておくが、通常は実行されません
    console.log('タブ要素が見つかりません。これは通常は起きないはずです。');
  }

  // File editor functionality
  function addFileEditorFunctionality() {
    // State for editing
    let isEditingRequirements = false;
    
    // Requirements editor
    const requirementsPreview = document.getElementById('requirements-preview');
    const requirementsEditor = document.getElementById('requirements-editor');
    const editRequirementsBtn = document.getElementById('edit-requirements');
    const saveRequirementsBtn = document.getElementById('save-requirements');
    const claudecodeRequirementsBtn = document.getElementById('claudecode-requirements');
    
    if (editRequirementsBtn) {
      editRequirementsBtn.addEventListener('click', () => {
        if (isEditingRequirements) {
          // Switch to preview mode
          requirementsPreview.classList.remove('hidden');
          requirementsEditor.classList.add('hidden');
          editRequirementsBtn.textContent = '編集';
          isEditingRequirements = false;
          saveRequirementsBtn.disabled = true;
        } else {
          // Switch to edit mode
          requirementsPreview.classList.add('hidden');
          requirementsEditor.classList.remove('hidden');
          requirementsEditor.value = requirementsContent || requirementsPreview.innerHTML;
          editRequirementsBtn.textContent = 'プレビュー';
          isEditingRequirements = true;
          saveRequirementsBtn.disabled = false;
        }
      });
    }
    
    if (saveRequirementsBtn) {
      saveRequirementsBtn.addEventListener('click', () => {
        // Get content from editor
        requirementsContent = requirementsEditor.value;
        
        // Update the preview with HTML
        requirementsPreview.innerHTML = formatMarkdown(requirementsContent);
        
        // Switch to preview mode
        requirementsPreview.classList.remove('hidden');
        requirementsEditor.classList.add('hidden');
        editRequirementsBtn.textContent = '編集';
        isEditingRequirements = false;
        saveRequirementsBtn.disabled = true;
        
        // Send to extension
        vscode.postMessage({
          command: 'updateFile',
          filePath: 'docs/requirements.md',
          content: requirementsContent
        });
        
        // Update status message
        document.getElementById('status-message').textContent = '要件定義を保存しました';
        
        // Reset after 3 seconds
        setTimeout(() => {
          document.getElementById('status-message').textContent = '準備完了';
        }, 3000);
      });
    }

    // ClaudeCode起動ボタン
    if (claudecodeRequirementsBtn) {
      claudecodeRequirementsBtn.addEventListener('click', () => {
        // 状態メッセージを更新
        document.getElementById('status-message').textContent = 'AIを起動しています...';
        
        // 拡張機能に要求
        vscode.postMessage({
          command: 'launchClaudeCode',
          filePath: 'docs/requirements.md'
        });
      });
    }
    
    // 「モックアップ作成プロンプトを起動」ボタンを追加
    const launchMockupBtn = document.createElement('button');
    launchMockupBtn.textContent = 'モックアップ作成プロンプトを起動';
    launchMockupBtn.className = 'action-button';
    launchMockupBtn.addEventListener('click', () => {
      // VSCodeにモックアップ作成プロンプトの起動を要求
      vscode.postMessage({
        command: 'launchMockupCreator'
      });

      // 処理中表示
      showLoading('モックアップ作成プロンプトを起動中...');
    });


    // ボタンコンテナを取得
    const buttonContainer = document.querySelector('.actions');
    if (buttonContainer) {
      // 既存のボタンコンテナに追加
      buttonContainer.appendChild(launchMockupBtn);
    } else {
      console.error('ボタンコンテナが見つかりません');
    }
  }

  // Tab switching function
  function switchTab(tabId) {
    // Update active tab
    activeTab = tabId;
    
    console.log(`タブ切替を開始: ${tabId}`);
    
    // タブの存在を確認
    const selectedTab = document.getElementById(`tab-${tabId}`);
    const selectedContent = document.getElementById(`content-${tabId}`);
    
    if (!selectedTab) {
      console.error(`タブが見つかりません: tab-${tabId}`);
      return;
    }
    
    if (!selectedContent) {
      console.error(`タブコンテンツが見つかりません: content-${tabId}`);
      return;
    }
    
    // すべてのタブボタンから active クラスを削除
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // すべてのコンテンツを非表示にする (重要：CSSとの競合を避けるために !important を使用)
    document.querySelectorAll('.tab-content').forEach(content => {
      // active クラスを削除
      content.classList.remove('active');
      
      // hidden クラスを追加（すでに追加されていなければ）
      if (!content.classList.contains('hidden')) {
        content.classList.add('hidden');
      }
      
      // 非表示にする (CSS優先度の問題を避けるため強制的に設定)
      content.style.cssText = 'display: none !important';
    });
    
    // 選択したタブに active クラスを追加
    selectedTab.classList.add('active');
    
    // 選択したコンテンツを表示
    selectedContent.classList.add('active');
    selectedContent.classList.remove('hidden');
    selectedContent.style.cssText = 'display: block !important';
    
    console.log(`タブ切替完了: ${tabId} -> ${selectedContent.id}`);
    
    // タブごとの特別な処理
    if (tabId === 'requirements') {
      // 要件定義タブが選択された場合、コンテンツを再表示
      const requirementsPreview = document.getElementById('requirements-preview');
      if (requirementsPreview && requirementsContent) {
        console.log('要件定義コンテンツを再表示します', requirementsContent.length);
        requirementsPreview.innerHTML = formatMarkdown(requirementsContent);
      } else {
        console.log('要件定義コンテンツを表示できません', { 
          previewElement: !!requirementsPreview, 
          contentLength: requirementsContent ? requirementsContent.length : 0 
        });
      }
    }
    
    // ステータスメッセージの更新
    document.getElementById('status-message').textContent = `${tabId}タブを表示しています`;
    
    // 初期データリクエストの送信（必要に応じて）
    if (tabId === 'requirements' && !requirementsContent) {
      console.log('初期データの再リクエスト');
      vscode.postMessage({ command: 'initialize' });
    }
  }

  // Helper function to convert HTML to Markdown
  function createMarkdownFromHtml(html) {
    // Extract content from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let markdown = '';
    
    // Process headings
    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      const hashes = '#'.repeat(level);
      markdown += `${hashes} ${heading.textContent}\n\n`;
    });
    
    // Process paragraphs
    const paragraphs = tempDiv.querySelectorAll('p');
    paragraphs.forEach(p => {
      markdown += `${p.textContent}\n\n`;
    });
    
    // Process lists
    const lists = tempDiv.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const items = list.querySelectorAll('li');
      items.forEach(item => {
        const prefix = list.tagName === 'UL' ? '- ' : '1. ';
        markdown += `${prefix}${item.textContent}\n`;
      });
      markdown += '\n';
    });
    
    // Process code blocks
    const codeBlocks = tempDiv.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      markdown += '```\n' + block.textContent + '\n```\n\n';
    });
    
    return markdown;
  }
  
  // チャット履歴をクリア
  function clearChat() {
    vscode.postMessage({
      command: 'clearChat'
    });
  }

  // 要件定義をプロジェクトに保存
  function exportRequirements() {
    vscode.postMessage({
      command: 'exportRequirements'
    });
  }
  
  // メッセージ送信処理
  function sendMessage() {
    console.log('sendMessage関数が呼び出されました');
    
    if (isWaitingForResponse) {
      console.log('応答待ち中のため、送信をスキップします');
      return;
    }

    const messageInput = document.getElementById('message-input');
    if (!messageInput) {
      console.error('メッセージ入力欄が見つかりません (送信時)');
      return;
    }
    
    const text = messageInput.value.trim();
    console.log(`入力テキスト: "${text}"`);
    
    if (!text) {
      console.log('テキストが空のため、送信をスキップします');
      return;
    }
    
    // ユーザーメッセージをUI追加
    addUserMessage(text);
    
    // メッセージを拡張機能に送信
    try {
      console.log('VSCodeにメッセージを送信します', { command: 'sendMessage', text });
      vscode.postMessage({
        command: 'sendMessage',
        text: text
      });
      console.log('メッセージ送信完了');
    } catch (error) {
      console.error('メッセージ送信中にエラーが発生しました', error);
    }
    
    // 入力フィールドをクリア
    messageInput.value = '';
    
    // 「考え中...」メッセージを表示
    addThinkingMessage();
    
    // 応答待ちフラグをセット
    isWaitingForResponse = true;
    console.log('送信処理完了、応答待ち状態に設定しました');
  }

  // ユーザーメッセージをチャットに追加
  function addUserMessage(text) {
    console.log('ユーザーメッセージを追加します');
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) {
      console.error('チャットメッセージコンテナが見つかりません');
      return;
    }
    
    try {
      const messageElement = document.createElement('div');
      messageElement.className = 'message user';
      messageElement.innerHTML = `<p>${escapeHtml(text)}</p>`;
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      console.log('ユーザーメッセージを追加しました');
    } catch (error) {
      console.error('ユーザーメッセージ追加中にエラーが発生しました', error);
    }
  }

  // AIの考え中メッセージを追加
  function addThinkingMessage() {
    console.log('AIの考え中メッセージを追加します');
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) {
      console.error('チャットメッセージコンテナが見つかりません');
      return;
    }
    
    try {
      const messageElement = document.createElement('div');
      messageElement.className = 'message ai thinking';
      messageElement.id = 'thinking-message';
      messageElement.innerHTML = '<p>考え中...<span class="dot-animation"></span></p>';
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      console.log('AIの考え中メッセージを追加しました');
    } catch (error) {
      console.error('考え中メッセージ追加中にエラーが発生しました', error);
    }
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
    
    // メッセージ下部にクイックアクション機能ボタンを追加
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'message-actions';
    
    // 要件定義として保存ボタン
    const saveAsRequirementsBtn = document.createElement('button');
    saveAsRequirementsBtn.className = 'message-action-btn requirements-btn';
    saveAsRequirementsBtn.innerHTML = '要件定義として保存';
    saveAsRequirementsBtn.addEventListener('click', function() {
      // このメッセージだけを要件定義として保存（親要素のメッセージを取得）
      const messageElement = this.closest('.message');
      if (!messageElement) {
        console.error('親メッセージ要素が見つかりません');
        return;
      }
      
      // メッセージのテキスト部分だけを抽出（ボタン部分や他の要素は除外）
      const messageParagraphs = messageElement.querySelectorAll('p, code, pre');
      let messageContent = '';
      
      // 各テキスト要素からコンテンツを抽出
      messageParagraphs.forEach(element => {
        // コードブロックの場合は特別な処理
        if (element.tagName === 'PRE' || element.tagName === 'CODE') {
          // コードブロックの場合はバッククォートで囲む
          const codeContent = element.textContent || '';
          if (codeContent.trim()) {
            messageContent += '```\n' + codeContent + '\n```\n\n';
          }
        } else {
          // 通常のテキスト
          const text = element.textContent || '';
          if (text.trim()) {
            messageContent += text + '\n\n';
          }
        }
      });
      
      // メッセージが取得できない場合のフォールバック
      if (!messageContent.trim()) {
        console.warn('メッセージ内容が取得できなかったため、元のテキストを使用します');
        messageContent = text;
      }
      
      // 要件定義としてフォーマット
      // 見出しがなければ追加する
      let formattedContent = messageContent.trim();
      if (!formattedContent.startsWith('# ')) {
        formattedContent = '# 要件定義\n\n' + formattedContent;
      }
      
      // 要件定義タブを表示
      switchTab('requirements');
      
      // 要件定義エディタに内容をセット
      const requirementsEditor = document.getElementById('requirements-editor');
      const requirementsPreview = document.getElementById('requirements-preview');
      requirementsContent = formattedContent;
      requirementsEditor.value = formattedContent;
      requirementsPreview.innerHTML = formatMarkdown(formattedContent);
      
      // 保存コマンドを送信
      vscode.postMessage({
        command: 'updateFile',
        filePath: 'docs/requirements.md',
        content: formattedContent
      });
      
      // 通知
      const notification = document.createElement('div');
      notification.className = 'save-notification';
      notification.textContent = 'このメッセージだけを要件定義として保存しました';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('fadeout');
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 2000);
    });
    
    // ディレクトリ構造として保存ボタン
    const saveAsStructureBtn = document.createElement('button');
    saveAsStructureBtn.className = 'message-action-btn structure-btn';
    saveAsStructureBtn.innerHTML = 'ディレクトリ構造として保存';
    saveAsStructureBtn.addEventListener('click', function() {
      // メッセージからコードブロックを抽出
      const structureMatch = text.match(/```[a-z]*\n([\s\S]*?)```/);
      
      let structureContent = '';
      if (structureMatch && structureMatch[1]) {
        // コードブロックが見つかった場合
        structureContent = '# ディレクトリ構造\n\n```\n' + structureMatch[1] + '```';
      } else {
        // コードブロックが見つからない場合は全体を保存
        structureContent = '# ディレクトリ構造\n\n```\n' + text + '\n```';
      }
      
      // ディレクトリ構造タブを表示
      switchTab('structure');
      
      // 構造エディタに内容をセット
      const structureEditor = document.getElementById('structure-editor');
      const structurePreview = document.getElementById('structure-preview');
      structureContent = structureContent;
      structureEditor.value = structureContent;
      structurePreview.innerHTML = formatMarkdown(structureContent);
      
      // 保存コマンドを送信
      vscode.postMessage({
        command: 'updateFile',
        filePath: 'docs/structure.md',
        content: structureContent
      });
      
      // 通知
      const notification = document.createElement('div');
      notification.className = 'save-notification';
      notification.textContent = 'ディレクトリ構造として保存しました';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('fadeout');
        setTimeout(() => {
          notification.remove();
        }, 500);
      }, 2000);
    });
    
    // ボタンをアクションコンテナに追加
    actionsContainer.appendChild(saveAsRequirementsBtn);
    actionsContainer.appendChild(saveAsStructureBtn);
    
    // アクションコンテナをメッセージに追加
    messageElement.appendChild(actionsContainer);
    
    // メッセージをチャットコンテナに追加
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
    
    // コピーボタンの処理は削除
    
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
  
  // ローディング表示/非表示関数
  function showLoading(message) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-overlay';
    loadingElement.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    loadingElement.id = 'loading-overlay';

    document.body.appendChild(loadingElement);
  }

  function hideLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
      loadingElement.remove();
    }
  }
  
  // ローディングキャンセル用関数を追加
  function cancelLoading() {
    hideLoading();
    // キャンセルメッセージを表示
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.textContent = '操作をキャンセルしました';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fadeout');
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 2000);
  }

  // エラー表示関数
  function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'save-notification error';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);

    setTimeout(() => {
      errorElement.classList.add('fadeout');
      setTimeout(() => {
        errorElement.remove();
      }, 500);
    }, 3000);
  }

  // 成功メッセージ表示関数
  function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'save-notification success';
    successElement.textContent = message;
    document.body.appendChild(successElement);

    setTimeout(() => {
      successElement.remove();
    }, 5000);
  }

  // 拡張機能からのメッセージ処理
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'addAIResponse':
        // 通常の応答処理（非ストリーミング）
        addAIMessage(message.text, message.codeBlocks);
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
        
        // 生成完了通知
        document.getElementById('status-message').textContent = 'プロジェクト構造を生成しました';
        break;
        
      case 'projectCreated':
        // プロジェクト作成完了時
        addAIMessage(message.text, message.codeBlocks);
        break;
        
      case 'showNotification':
        // 指定されたタイプの通知メッセージを表示
        const notification = document.createElement('div');
        notification.className = `save-notification ${message.type || ''}`;
        notification.textContent = message.message;
        document.body.appendChild(notification);
        
        // 数秒後に通知を消す
        setTimeout(() => {
          notification.classList.add('fadeout');
          setTimeout(() => {
            notification.remove();
          }, 500);
        }, 3000);
        break;
        
      case 'showSuccess':
        hideLoading();
        showSuccess(message.message);
        break;

      case 'showError':
        hideLoading();
        showError(message.message);
        break;        
      
      case 'hideLoading':
        hideLoading();
        break;
        
      case 'showMessage':
        // 情報メッセージを表示
        const infoNotification = document.createElement('div');
        infoNotification.className = 'save-notification';
        infoNotification.textContent = message.text;
        document.body.appendChild(infoNotification);
        
        // ステータスメッセージにも表示
        document.getElementById('status-message').textContent = message.text;
        
        // 要件定義タブと構造タブのコンテンツを確認してデバッグ出力
        console.log('要件定義プレビュー要素:', document.getElementById('requirements-preview'));
        console.log('構造プレビュー要素:', document.getElementById('structure-preview'));
        console.log('要件定義タブ:', document.getElementById('tab-requirements'));
        console.log('構造タブ:', document.getElementById('tab-structure'));
        
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
          
          // メッセージ下部にクイックアクション機能ボタンを追加
          const actionsContainer = document.createElement('div');
          actionsContainer.className = 'message-actions';
          
          // 要件定義として保存ボタン
          const saveAsRequirementsBtn = document.createElement('button');
          saveAsRequirementsBtn.className = 'message-action-btn requirements-btn';
          saveAsRequirementsBtn.innerHTML = '要件定義として保存';
          saveAsRequirementsBtn.addEventListener('click', function() {
            // このメッセージだけを要件定義として保存（親要素のメッセージを取得）
            const messageElement = this.closest('.message');
            if (!messageElement) {
              console.error('親メッセージ要素が見つかりません');
              return;
            }
            
            // メッセージのテキスト部分だけを抽出（ボタン部分や他の要素は除外）
            const messageParagraphs = messageElement.querySelectorAll('p, code, pre');
            let messageContent = '';
            
            // 各テキスト要素からコンテンツを抽出
            messageParagraphs.forEach(element => {
              // コードブロックの場合は特別な処理
              if (element.tagName === 'PRE' || element.tagName === 'CODE') {
                // コードブロックの場合はバッククォートで囲む
                const codeContent = element.textContent || '';
                if (codeContent.trim()) {
                  messageContent += '```\n' + codeContent + '\n```\n\n';
                }
              } else {
                // 通常のテキスト
                const text = element.textContent || '';
                if (text.trim()) {
                  messageContent += text + '\n\n';
                }
              }
            });
            
            // メッセージが取得できない場合のフォールバック
            if (!messageContent.trim()) {
              console.warn('メッセージ内容が取得できなかったため、元のテキストを使用します');
              messageContent = message.text;
            }
            
            // 要件定義としてフォーマット
            // 見出しがなければ追加する
            let formattedContent = messageContent.trim();
            if (!formattedContent.startsWith('# ')) {
              formattedContent = '# 要件定義\n\n' + formattedContent;
            }
            
            // 要件定義タブを表示
            switchTab('requirements');
            
            // 要件定義エディタに内容をセット
            const requirementsEditor = document.getElementById('requirements-editor');
            const requirementsPreview = document.getElementById('requirements-preview');
            requirementsContent = formattedContent;
            requirementsEditor.value = formattedContent;
            requirementsPreview.innerHTML = formatMarkdown(formattedContent);
            
            // 保存コマンドを送信
            vscode.postMessage({
              command: 'updateFile',
              filePath: 'docs/requirements.md',
              content: formattedContent
            });
            
            // 通知
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.textContent = 'このメッセージだけを要件定義として保存しました';
            document.body.appendChild(notification);
            
            setTimeout(() => {
              notification.classList.add('fadeout');
              setTimeout(() => {
                notification.remove();
              }, 500);
            }, 2000);
          });
          
          // ボタンをアクションコンテナに追加
          actionsContainer.appendChild(saveAsRequirementsBtn);
          
          // アクションコンテナをメッセージに追加
          streamingElement.appendChild(actionsContainer);
          
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
          
          // コピーボタンの処理は削除
          
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
        const codeSavedNotification = document.createElement('div');
        codeSavedNotification.className = 'save-notification';
        codeSavedNotification.textContent = `ファイルを保存しました: ${message.fileName}`;
        document.body.appendChild(codeSavedNotification);
        
        // 数秒後に通知を消す
        setTimeout(() => {
          codeSavedNotification.classList.add('fadeout');
          setTimeout(() => {
            codeSavedNotification.remove();
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

      case 'initialData':
        // Initial file data loading
        if (message.requirementsContent) {
          requirementsContent = message.requirementsContent;
          document.getElementById('requirements-preview').innerHTML = formatMarkdown(message.requirementsContent);
        }
        document.getElementById('status-message').textContent = '初期データを読み込みました';
        break;

      case 'updateRequirementsContent':
        // 要件定義ファイルの内容だけを更新（外部でファイルが変更された場合）
        if (message.content) {
          // 要件定義エディタに内容をセット
          requirementsContent = message.content;
          const requirementsEditor = document.getElementById('requirements-editor');
          const requirementsPreview = document.getElementById('requirements-preview');
          
          if (requirementsEditor) {
            requirementsEditor.value = message.content;
          }
          
          if (requirementsPreview) {
            requirementsPreview.innerHTML = formatMarkdown(message.content);
          }
          
          // ステータス表示を更新
          document.getElementById('status-message').textContent = '要件定義ファイルが更新されました';
          
          // 小さな通知を表示
          const notification = document.createElement('div');
          notification.className = 'save-notification';
          notification.textContent = '要件定義ファイルが更新されました';
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.classList.add('fadeout');
            setTimeout(() => {
              notification.remove();
            }, 500);
          }, 2000);
        }
        break;
        
      case 'fileSaved':
        document.getElementById('status-message').textContent = message.message;
        
        // ファイルパスに応じた処理
        if (message.filePath.includes('requirements.md')) {
          // 保存したコンテンツを変数に保持
          if (requirementsEditor && requirementsEditor.value) {
            requirementsContent = requirementsEditor.value;
          }
        }
        break;

      case 'directoryTree':
        // Update tree view
        const treeView = document.getElementById('tree-view');
        if (treeView && message.treeContent) {
          treeView.textContent = message.treeContent;
        }
        break;
    }
  });

  // Simple markdown formatter for file preview content
  function formatMarkdown(markdown) {
    if (!markdown) {
      return '<p>ファイルが存在しないか内容がありません</p>';
    }

    // Convert headings
    let html = markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>');

    // Convert code blocks
    html = html.replace(/```([\s\S]*?)```/gm, function(match, code) {
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });

    // Convert lists
    html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');

    // Convert numbered lists
    html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n)+/g, function(match) {
      // Only wrap in <ol> if not already inside <ul>
      if (!match.includes('<ul>')) {
        return `<ol>${match}</ol>`;
      }
      return match;
    });

    // Convert paragraphs
    html = html.replace(/^(?!<[^>]+>)(?!\s*$)(.*$)/gm, '<p>$1</p>');

    return html;
  }
})();