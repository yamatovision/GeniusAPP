// /media/requirementsVisualizer.js
(function() {
  const vscode = acquireVsCodeApi();
  
  // DOM Elements
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const statusMessage = document.getElementById('status-message');
  
  // Requirements tab
  const requirementsPreview = document.getElementById('requirements-preview');
  const requirementsEditor = document.getElementById('requirements-editor');
  const editRequirementsBtn = document.getElementById('edit-requirements');
  const saveRequirementsBtn = document.getElementById('save-requirements');
  
  // Structure tab
  const structurePreview = document.getElementById('structure-preview');
  const structureEditor = document.getElementById('structure-editor');
  const editStructureBtn = document.getElementById('edit-structure');
  const saveStructureBtn = document.getElementById('save-structure');
  
  // Tree tab
  const treeView = document.getElementById('tree-view');
  
  // Chat elements
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  
  // State
  let requirementsContent = '';
  let structureContent = '';
  let projectRoot = '';
  let isEditingRequirements = false;
  let isEditingStructure = false;
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.add('hidden'));
      
      // Add active class to clicked tab
      button.classList.add('active');
      
      // Show corresponding content
      const tabId = button.id.replace('tab-', 'content-');
      document.getElementById(tabId).classList.remove('hidden');
      
      // If tree tab is selected, load directory tree
      if (button.id === 'tab-tree') {
        vscode.postMessage({
          type: 'showDirectoryTree'
        });
      }
    });
  });
  
  // Requirements editing
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
      requirementsEditor.value = requirementsContent;
      editRequirementsBtn.textContent = 'プレビュー';
      isEditingRequirements = true;
      saveRequirementsBtn.disabled = false;
    }
  });
  
  saveRequirementsBtn.addEventListener('click', () => {
    const newContent = requirementsEditor.value;
    vscode.postMessage({
      type: 'updateFile',
      filePath: 'docs/requirements.md',
      content: newContent
    });
  });
  
  // Structure editing
  editStructureBtn.addEventListener('click', () => {
    if (isEditingStructure) {
      // Switch to preview mode
      structurePreview.classList.remove('hidden');
      structureEditor.classList.add('hidden');
      editStructureBtn.textContent = '編集';
      isEditingStructure = false;
      saveStructureBtn.disabled = true;
    } else {
      // Switch to edit mode
      structurePreview.classList.add('hidden');
      structureEditor.classList.remove('hidden');
      structureEditor.value = structureContent;
      editStructureBtn.textContent = 'プレビュー';
      isEditingStructure = true;
      saveStructureBtn.disabled = false;
    }
  });
  
  saveStructureBtn.addEventListener('click', () => {
    const newContent = structureEditor.value;
    vscode.postMessage({
      type: 'updateFile',
      filePath: 'docs/structure.md',
      content: newContent
    });
  });
  
  // Simple Markdown renderer (very basic)
  function renderMarkdown(markdown) {
    if (!markdown) return '<p>ファイルが存在しないか、内容がありません。</p>';
    
    let html = markdown
      // Convert headers
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      // Convert code blocks
      .replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>')
      // Convert lists
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      // Wrap list items in <ul> tags
      .replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>')
      // Convert paragraphs (lines that don't start with HTML tags and aren't empty)
      .replace(/^(?!<[^>]+>)(?!\s*$)(.*$)/gm, '<p>$1</p>');
    
    return html;
  }
  
  // Message handling from extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
      case 'initialData':
        requirementsContent = message.requirementsContent;
        structureContent = message.structureContent;
        projectRoot = message.projectRoot;
        
        // Render initial content
        requirementsPreview.innerHTML = renderMarkdown(requirementsContent);
        structurePreview.innerHTML = renderMarkdown(structureContent);
        
        statusMessage.textContent = '初期データを読み込みました';
        break;
        
      case 'fileContent':
        statusMessage.textContent = `ファイルを読み込みました: ${message.filePath}`;
        break;
        
      case 'fileSaved':
        statusMessage.textContent = message.message;
        if (message.filePath.includes('requirements.md')) {
          requirementsContent = requirementsEditor.value;
          requirementsPreview.innerHTML = renderMarkdown(requirementsContent);
          // Switch to preview mode
          requirementsPreview.classList.remove('hidden');
          requirementsEditor.classList.add('hidden');
          editRequirementsBtn.textContent = '編集';
          isEditingRequirements = false;
          saveRequirementsBtn.disabled = true;
        } else if (message.filePath.includes('structure.md')) {
          structureContent = structureEditor.value;
          structurePreview.innerHTML = renderMarkdown(structureContent);
          // Switch to preview mode
          structurePreview.classList.remove('hidden');
          structureEditor.classList.add('hidden');
          editStructureBtn.textContent = '編集';
          isEditingStructure = false;
          saveStructureBtn.disabled = true;
        }
        break;
        
      case 'fileError':
        statusMessage.textContent = message.message;
        break;
        
      case 'directoryTree':
        treeView.textContent = message.treeContent;
        break;
    }
  });
  
  // チャット機能
  if (sendButton && chatInput) {
    sendButton.addEventListener('click', () => {
      sendChatMessage();
    });
    
    chatInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }
  
  function sendChatMessage() {
    if (!chatInput || !chatInput.value.trim()) return;
    
    const message = chatInput.value.trim();
    
    // ユーザーメッセージを表示
    addChatMessage(message, 'user');
    
    // AIにメッセージを送信
    vscode.postMessage({
      type: 'sendMessage',
      message: message
    });
    
    // 入力フィールドをクリア
    chatInput.value = '';
  }
  
  function addChatMessage(message, sender) {
    if (!chatMessages) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${sender}-message`;
    messageEl.innerHTML = `<span class="message-content">${message}</span>`;
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // メッセージ受信ハンドラーを追加
  window.addEventListener('message', event => {
    const message = event.data;
    
    if (message.type === 'receiveMessage') {
      addChatMessage(message.message, message.sender);
    }
  }, false);
  
  // Initial state
  statusMessage.textContent = 'データを読み込んでいます...';
  
  // Request initial data
  vscode.postMessage({
    type: 'initialData'
  });
})();