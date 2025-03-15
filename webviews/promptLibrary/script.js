(function () {
  // VSCodeのWebviewに接続するためのvscodeオブジェクト
  const vscode = acquireVsCodeApi();
  
  // 状態変数
  let currentView = 'list'; // 'list' または 'editor'
  let editorMode = 'view'; // 'view', 'edit', 'create'
  let currentPrompt = null;
  let categories = [];
  let selectedCategory = null;
  let prompts = [];
  
  // DOM要素
  const promptListView = document.getElementById('promptListView');
  const promptEditorView = document.getElementById('promptEditorView');
  const promptList = document.getElementById('promptList');
  const categoryList = document.getElementById('categoryList');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const createPromptBtn = document.getElementById('createPromptBtn');
  const importBtn = document.getElementById('importBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const editorTitle = document.getElementById('editorTitle');
  const saveBtn = document.getElementById('saveBtn');
  const editBtn = document.getElementById('editBtn');
  const exportBtn = document.getElementById('exportBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  // フォーム要素
  const promptTitle = document.getElementById('promptTitle');
  const promptType = document.getElementById('promptType');
  const promptCategory = document.getElementById('promptCategory');
  const promptTags = document.getElementById('promptTags');
  const promptContent = document.getElementById('promptContent');
  const promptPublic = document.getElementById('promptPublic');
  
  // 初期化
  window.addEventListener('load', () => {
    // 初期データをVSCodeから取得
    vscode.postMessage({ type: 'init' });
    
    // イベントリスナーを設定
    setupEventListeners();
  });
  
  // イベントリスナーの設定
  function setupEventListeners() {
    // 検索ボタン
    searchButton.addEventListener('click', handleSearch);
    
    // 検索入力フィールドでEnterキーを押したとき
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
    
    // 新規プロンプト作成ボタン
    createPromptBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'createPrompt' });
    });
    
    // インポートボタン
    importBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'importPrompts' });
    });
    
    // すべてエクスポートボタン
    exportAllBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportAllPrompts' });
    });
    
    // エディタの保存ボタン
    saveBtn.addEventListener('click', handleSavePrompt);
    
    // エディタの編集ボタン
    editBtn.addEventListener('click', () => {
      setEditorMode('edit');
    });
    
    // エディタのエクスポートボタン
    exportBtn.addEventListener('click', () => {
      if (currentPrompt) {
        vscode.postMessage({
          type: 'exportPrompt',
          promptData: currentPrompt
        });
      }
    });
    
    // エディタのキャンセルボタン
    cancelBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'cancelEdit' });
      setView('list');
    });
  }
  
  // VSCodeからのメッセージを処理
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.type) {
      case 'promptList':
        // プロンプト一覧を更新
        prompts = message.prompts || [];
        categories = message.categories || [];
        selectedCategory = message.selectedCategory;
        
        renderPromptList();
        renderCategoryList();
        break;
        
      case 'promptEditor':
        // エディタモードの切り替え
        if (message.action === 'view' || message.action === 'edit') {
          currentPrompt = message.prompt;
          setEditorMode(message.action);
          setView('editor');
        } else if (message.action === 'create') {
          currentPrompt = message.prompt;
          setEditorMode('create');
          setView('editor');
        } else if (message.action === 'cancel') {
          setView('list');
        }
        break;
        
      case 'promptSaved':
        // プロンプトの保存完了
        currentPrompt = message.prompt;
        setEditorMode('view');
        showNotification('プロンプトを保存しました', 'success');
        break;
        
      case 'loading':
        // ローディング状態の切り替え
        setLoading(message.isLoading);
        break;
        
      case 'error':
        // エラーメッセージの表示
        showNotification(message.message, 'error');
        break;
    }
  });
  
  // プロンプト一覧の描画
  function renderPromptList() {
    promptList.innerHTML = '';
    
    if (prompts.length === 0) {
      promptList.innerHTML = `<div class="empty-message">プロンプトが見つかりません</div>`;
      return;
    }
    
    // プロンプトカードを作成
    prompts.forEach(prompt => {
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.dataset.id = prompt.id;
      
      // タイプに応じたラベルを取得
      const typeLabel = getTypeLabel(prompt.type);
      
      // プレビューテキスト（内容の最初の100文字）
      const previewText = prompt.content ? prompt.content.substring(0, 100) + (prompt.content.length > 100 ? '...' : '') : '';
      
      // カードの内容
      card.innerHTML = `
        <h3 title="${prompt.title}">${prompt.title}</h3>
        <div class="prompt-type">${typeLabel}</div>
        <div class="prompt-preview">${previewText}</div>
        ${prompt.category ? `<div class="prompt-category">${prompt.category}</div>` : ''}
        ${prompt.tags && prompt.tags.length > 0 ? 
          `<div class="prompt-tags">
            ${prompt.tags.map(tag => `<span class="prompt-tag">${tag}</span>`).join('')}
          </div>` : 
          ''}
      `;
      
      // カードのクリックイベント
      card.addEventListener('click', () => {
        vscode.postMessage({
          type: 'selectPrompt',
          promptId: prompt.id
        });
      });
      
      promptList.appendChild(card);
    });
  }
  
  // カテゴリ一覧の描画
  function renderCategoryList() {
    // 「すべて」カテゴリ以外を削除
    const allCategoryItem = categoryList.querySelector('[data-category=""]');
    categoryList.innerHTML = '';
    if (allCategoryItem) {
      categoryList.appendChild(allCategoryItem);
    } else {
      const allItem = document.createElement('div');
      allItem.className = 'category-item';
      allItem.textContent = 'すべて';
      allItem.dataset.category = '';
      allItem.addEventListener('click', () => handleCategorySelect(''));
      categoryList.appendChild(allItem);
    }
    
    // カテゴリの追加
    categories.forEach(category => {
      const item = document.createElement('div');
      item.className = 'category-item';
      item.textContent = category;
      item.dataset.category = category;
      
      if (selectedCategory === category) {
        item.classList.add('selected');
      }
      
      item.addEventListener('click', () => handleCategorySelect(category));
      categoryList.appendChild(item);
    });
    
    // 選択状態の更新
    updateCategorySelection();
  }
  
  // カテゴリ選択の処理
  function handleCategorySelect(category) {
    vscode.postMessage({
      type: 'filterByCategory',
      category: category || null
    });
  }
  
  // カテゴリ選択状態の更新
  function updateCategorySelection() {
    // すべての選択状態をクリア
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // 選択されているカテゴリにクラスを追加
    if (selectedCategory) {
      const selectedItem = document.querySelector(`.category-item[data-category="${selectedCategory}"]`);
      if (selectedItem) {
        selectedItem.classList.add('selected');
      }
    } else {
      const allItem = document.querySelector('.category-item[data-category=""]');
      if (allItem) {
        allItem.classList.add('selected');
      }
    }
  }
  
  // 検索処理
  function handleSearch() {
    const query = searchInput.value.trim();
    
    vscode.postMessage({
      type: 'search',
      query: query
    });
  }
  
  // プロンプト保存処理
  function handleSavePrompt() {
    // フォームからデータを取得
    const promptData = {
      id: currentPrompt?.id,
      title: promptTitle.value.trim(),
      content: promptContent.value.trim(),
      type: promptType.value,
      category: promptCategory.value.trim() || undefined,
      tags: promptTags.value.trim() ? promptTags.value.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      isPublic: promptPublic.checked
    };
    
    // バリデーションチェック
    if (!promptData.title) {
      showNotification('タイトルは必須です', 'error');
      return;
    }
    
    if (!promptData.content) {
      showNotification('プロンプト内容は必須です', 'error');
      return;
    }
    
    // VSCodeにメッセージを送信
    vscode.postMessage({
      type: 'savePrompt',
      promptData: promptData
    });
  }
  
  // エディタフォームの更新
  function updateEditorForm() {
    if (!currentPrompt) return;
    
    promptTitle.value = currentPrompt.title || '';
    promptType.value = currentPrompt.type || 'system';
    promptCategory.value = currentPrompt.category || '';
    promptTags.value = currentPrompt.tags ? currentPrompt.tags.join(', ') : '';
    promptContent.value = currentPrompt.content || '';
    promptPublic.checked = currentPrompt.isPublic || false;
  }
  
  // エディタモードの設定
  function setEditorMode(mode) {
    editorMode = mode;
    
    // フォーム要素の編集可否を設定
    const isEditable = mode === 'edit' || mode === 'create';
    promptTitle.disabled = !isEditable;
    promptType.disabled = !isEditable;
    promptCategory.disabled = !isEditable;
    promptTags.disabled = !isEditable;
    promptContent.disabled = !isEditable;
    promptPublic.disabled = !isEditable;
    
    // ボタンの表示を設定
    saveBtn.style.display = isEditable ? 'inline-block' : 'none';
    editBtn.style.display = mode === 'view' ? 'inline-block' : 'none';
    exportBtn.style.display = mode === 'view' ? 'inline-block' : 'none';
    
    // タイトルを設定
    if (mode === 'view') {
      editorTitle.textContent = 'プロンプト詳細';
    } else if (mode === 'edit') {
      editorTitle.textContent = 'プロンプト編集';
    } else if (mode === 'create') {
      editorTitle.textContent = '新規プロンプト作成';
    }
    
    // フォームを更新
    updateEditorForm();
  }
  
  // 表示モードの切り替え（リスト/エディタ）
  function setView(view) {
    currentView = view;
    
    if (view === 'list') {
      promptListView.style.display = 'block';
      promptEditorView.style.display = 'none';
    } else if (view === 'editor') {
      promptListView.style.display = 'none';
      promptEditorView.style.display = 'block';
    }
  }
  
  // ローディングオーバーレイの表示/非表示
  function setLoading(isLoading) {
    loadingOverlay.style.display = isLoading ? 'flex' : 'none';
  }
  
  // 通知メッセージの表示
  function showNotification(message, type = 'info') {
    // メッセージをVSCodeに送信して表示
    vscode.postMessage({
      type: 'notification',
      message: message,
      notificationType: type
    });
  }
  
  // プロンプトタイプのラベルを取得
  function getTypeLabel(type) {
    switch (type) {
      case 'system':
        return 'システム';
      case 'user':
        return 'ユーザー';
      case 'assistant':
        return 'アシスタント';
      case 'template':
        return 'テンプレート';
      default:
        return type;
    }
  }
})();