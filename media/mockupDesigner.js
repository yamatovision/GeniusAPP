// モックアップデザイナーのためのJavaScriptコード
// このコードは、VSCode拡張のWebViewで使用されます

(function() {
  // VS Code APIのアクセス
  const vscode = acquireVsCodeApi();
  
  // 状態を保持
  let state = {
    currentPhase: 'pageStructure',
    phases: [],
    requirements: '',
    pages: [],
    mockups: [],
    directoryStructure: '',
    specification: ''
  };
  
  // メッセージのハンドラーを登録
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateState':
        updateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'addUserMessage':
        addUserMessage(message.text);
        break;
      case 'addAiMessage':
        addAiMessage(message.text);
        break;
      case 'notifyCodeSaved':
        notifyCodeSaved(message.filename, message.language);
        break;
      case 'saveToProjectComplete':
        notifySaveToProjectComplete(message);
        break;
      case 'saveDirectoryStructureComplete':
        notifySaveDirectoryStructureComplete(message);
        break;
      case 'saveSpecificationComplete':
        notifySaveSpecificationComplete(message);
        break;
      case 'updateClaudeMdProgressComplete':
        notifyClaudeMdUpdateComplete(message);
        break;
    }
  });
  
  // 状態の更新
  function updateState(newState) {
    state = { ...state, ...newState };
    renderMainContent();
  }
  
  // エラーの表示
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const mainContent = document.getElementById('main-content');
    mainContent.prepend(errorDiv);
    
    // 5秒後に自動で消去
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
  
  // メインコンテンツのレンダリング
  function renderMainContent() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    
    // 2つのセクションのみを表示する
    renderPageStructurePhase(mainContent);
    renderMockupsPhase(mainContent);
    
    // チャットセクションを追加
    renderChatSection(mainContent);
  }
  
  // ページ構造フェーズのレンダリング
  function renderPageStructurePhase(container) {
    const header = document.createElement('h3');
    header.textContent = 'ページ構造と機能の策定';
    container.appendChild(header);
    
    const description = document.createElement('p');
    description.textContent = '必要なページとその機能を明確にします';
    container.appendChild(description);
    
    // ボタン
    const buttonContainer = document.createElement('div');
    buttonContainer.innerHTML = `
      <button id="generate-pages" class="button">ページ構造を生成</button>
    `;
    container.appendChild(buttonContainer);
    
    // 現在のページ一覧
    const pagesSection = document.createElement('div');
    pagesSection.innerHTML = '<h4>ページ一覧</h4>';
    
    if (!state.pages || state.pages.length === 0) {
      pagesSection.innerHTML += '<p>ページが定義されていません</p>';
    } else {
      const pagesList = document.createElement('ul');
      state.pages.forEach(page => {
        const pageItem = document.createElement('li');
        pageItem.innerHTML = `
          <strong>${page.name}</strong> (ID: ${page.id}, ルート: ${page.route})
          <p>${page.description}</p>
          <p>コンポーネント: ${page.components.join(', ')}</p>
          <p>API エンドポイント: ${page.apiEndpoints.join(', ')}</p>
        `;
        pagesList.appendChild(pageItem);
      });
      pagesSection.appendChild(pagesList);
    }
    
    container.appendChild(pagesSection);
    
    // イベントリスナーの登録
    document.getElementById('generate-pages').addEventListener('click', () => {
      vscode.postMessage({
        command: 'generatePageStructure'
      });
    });
  }
  
  // モックアップフェーズのレンダリング
  function renderMockupsPhase(container) {
    const header = document.createElement('h3');
    header.textContent = 'モックアップ作成';
    container.appendChild(header);
    
    const description = document.createElement('p');
    description.textContent = '各ページのモックアップを作成します';
    container.appendChild(description);
    
    // ページごとのモックアップセクション
    const mockupsSection = document.createElement('div');
    mockupsSection.innerHTML = '<h4>ページごとのモックアップ</h4>';
    
    if (!state.pages || state.pages.length === 0) {
      mockupsSection.innerHTML += '<p>ページが定義されていません</p>';
    } else {
      const mockupsList = document.createElement('div');
      
      state.pages.forEach(page => {
        const mockupItem = document.createElement('div');
        mockupItem.style.marginBottom = '20px';
        mockupItem.style.padding = '10px';
        mockupItem.style.border = '1px solid var(--vscode-panel-border)';
        mockupItem.style.borderRadius = '4px';
        
        // ページ情報
        const pageInfo = document.createElement('div');
        pageInfo.innerHTML = `
          <h5>${page.name}</h5>
          <p>${page.description}</p>
        `;
        mockupItem.appendChild(pageInfo);
        
        // ボタン
        const mockupButtons = document.createElement('div');
        
        // モックアップの状態に応じてボタンを表示
        const mockup = state.mockups.find(m => m.pageId === page.id);
        
        if (mockup && mockup.hasPreview) {
          mockupButtons.innerHTML = `
            <button class="button show-preview" data-page-id="${page.id}">プレビュー表示</button>
            <button class="button open-browser" data-page-id="${page.id}">ブラウザで開く</button>
            <button class="button regenerate-mockup" data-page-id="${page.id}">再生成</button>
            <button class="button save-to-project" data-page-id="${page.id}">プロジェクトに保存</button>
          `;
        } else {
          mockupButtons.innerHTML = `
            <button class="button generate-mockup" data-page-id="${page.id}" data-framework="html">HTMLモックアップ生成</button>
            <button class="button generate-mockup" data-page-id="${page.id}" data-framework="react">Reactモックアップ生成</button>
          `;
        }
        
        mockupItem.appendChild(mockupButtons);
        mockupsList.appendChild(mockupItem);
      });
      
      mockupsSection.appendChild(mockupsList);
    }
    
    container.appendChild(mockupsSection);
    
    // モックアップ生成ボタン
    document.querySelectorAll('.generate-mockup').forEach(button => {
      button.addEventListener('click', () => {
        const pageId = button.dataset.pageId;
        const framework = button.dataset.framework;
        
        vscode.postMessage({
          command: 'generateMockup',
          pageId,
          framework
        });
      });
    });
    
    // プレビュー表示ボタン
    document.querySelectorAll('.show-preview').forEach(button => {
      button.addEventListener('click', () => {
        const pageId = button.dataset.pageId;
        
        vscode.postMessage({
          command: 'showMockupPreview',
          pageId
        });
      });
    });
    
    // ブラウザで開くボタン
    document.querySelectorAll('.open-browser').forEach(button => {
      button.addEventListener('click', () => {
        const pageId = button.dataset.pageId;
        
        vscode.postMessage({
          command: 'openMockupInBrowser',
          pageId
        });
      });
    });
    
    // 再生成ボタン
    document.querySelectorAll('.regenerate-mockup').forEach(button => {
      button.addEventListener('click', () => {
        const pageId = button.dataset.pageId;
        
        vscode.postMessage({
          command: 'generateMockup',
          pageId,
          framework: 'html' // デフォルトはHTML
        });
      });
    });
    
    // プロジェクト保存ボタン
    document.querySelectorAll('.save-to-project').forEach(button => {
      button.addEventListener('click', () => {
        const pageId = button.dataset.pageId;
        const mockupIndex = button.dataset.mockupIndex || 0;
        
        // ページ名をファイル名の候補として渡す
        const page = state.pages.find(p => p.id === pageId);
        const suggestedFileName = page ? page.name.toLowerCase().replace(/\s+/g, '-') : `page-${pageId}`;
        
        vscode.postMessage({
          command: 'saveToProject',
          pageId,
          mockupIndex: parseInt(mockupIndex),
          fileName: suggestedFileName
        });
      });
    });
  }
  
  // チャットセクションのレンダリング
  function renderChatSection(container) {
    const chatSection = document.createElement('div');
    chatSection.innerHTML = `
      <h3>AIアシスタント</h3>
      <div class="chat-container">
        <div class="chat-messages" id="chat-messages">
          <div class="message system">
            <p>AIアシスタントがUI/UXデザインをサポートします。質問や要望を入力してください。</p>
          </div>
        </div>
        <div class="chat-input">
          <input type="text" id="chat-input" placeholder="メッセージを入力...">
          <button id="send-message" class="button">送信</button>
        </div>
      </div>
    `;
    container.appendChild(chatSection);
    
    // イベントリスナーの登録
    document.getElementById('send-message').addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      
      if (text) {
        // ユーザーメッセージを表示
        addUserMessage(text);
        
        // 入力をクリア
        input.value = '';
        
        // メッセージを送信
        vscode.postMessage({
          command: 'sendChatMessage',
          text
        });
      }
    });
    
    // Enter キーでの送信
    document.getElementById('chat-input').addEventListener('keypress', event => {
      if (event.key === 'Enter') {
        document.getElementById('send-message').click();
      }
    });
  }
  
  // ユーザーメッセージを追加
  function addUserMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.innerHTML = `<p>${text}</p>`;
    messagesContainer.appendChild(userMessage);
    
    // 自動スクロール
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // AIメッセージを追加
  function addAiMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const aiMessage = document.createElement('div');
    aiMessage.className = 'message ai';
    
    // マークダウンのコードブロックをHTMLに変換
    const formattedText = formatMarkdown(text);
    aiMessage.innerHTML = formattedText;
    
    messagesContainer.appendChild(aiMessage);
    
    // コードブロックにコピーボタンを追加
    addCopyButtonsToCodeBlocks(aiMessage);
    
    // 自動スクロール
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // コード保存通知
  function notifyCodeSaved(filename, language) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const notification = document.createElement('div');
    notification.className = 'message system';
    notification.innerHTML = `<p>ファイル保存: <strong>${filename}</strong> (${language})</p>`;
    messagesContainer.appendChild(notification);
    
    // 自動スクロール
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // マークダウンのシンプルな変換（コードブロックのみ）
  function formatMarkdown(text) {
    // コードブロックを変換
    let formattedText = text.replace(/```(\w+)\n([\s\S]*?)```/g, function(match, language, code) {
      return `<pre class="code-block" data-language="${language}"><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
    });
    
    // 改行を保持
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
  }
  
  // HTMLエスケープ
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // コードブロックにコピーボタンを追加
  function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('.code-block');
    
    codeBlocks.forEach(block => {
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.textContent = 'コピー';
      copyButton.addEventListener('click', () => {
        const code = block.querySelector('code').textContent;
        navigator.clipboard.writeText(code).then(() => {
          copyButton.textContent = 'コピー済み';
          setTimeout(() => {
            copyButton.textContent = 'コピー';
          }, 2000);
        }).catch(err => {
          console.error('コピーに失敗しました:', err);
        });
      });
      
      block.appendChild(copyButton);
    });
  }
  
  // プロジェクト保存完了通知
  function notifySaveToProjectComplete(message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const notification = document.createElement('div');
    notification.className = 'message system';
    
    if (message.success) {
      notification.innerHTML = `<p>✅ モックアップをプロジェクトに保存しました: <strong>${message.fileName}</strong></p>`;
      
      if (message.claudeMdUpdateFailed) {
        notification.innerHTML += `<p>⚠️ CLAUDE.mdの更新に失敗しました</p>`;
      } else {
        notification.innerHTML += `<p>✅ CLAUDE.mdの進捗状況も更新しました</p>`;
      }
    } else {
      notification.innerHTML = `<p>❌ モックアップの保存に失敗しました: ${message.error}</p>`;
    }
    
    messagesContainer.appendChild(notification);
    
    // 自動スクロール
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // CLAUDE.md更新完了通知
  function notifyClaudeMdUpdateComplete(message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const notification = document.createElement('div');
    notification.className = 'message system';
    
    if (message.success) {
      notification.innerHTML = `<p>✅ CLAUDE.mdの進捗状況を更新しました: ${message.phase} -> ${message.isCompleted ? '完了' : '未完了'}</p>`;
    } else {
      notification.innerHTML = `<p>❌ CLAUDE.mdの更新に失敗しました: ${message.error}</p>`;
    }
    
    messagesContainer.appendChild(notification);
    
    // 自動スクロール
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 初期化メッセージを送信
  vscode.postMessage({
    command: 'initializeWebview'
  });
})();