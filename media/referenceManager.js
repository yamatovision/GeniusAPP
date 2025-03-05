// リファレンスマネージャーのフロントエンドスクリプト
(function() {
  // WebView との通信 - エラー防止のためtry/catchで囲む
  let vscode;
  try {
    vscode = acquireVsCodeApi();
  } catch (e) {
    console.error('VSCode API取得エラー:', e);
    // fallback - 開発時のモックオブジェクト
    vscode = {
      getState: () => ({}),
      setState: () => {},
      postMessage: (msg) => console.log('Message to VSCode:', msg)
    };
  }

  // 状態の取得
  const state = vscode.getState() || { references: [] };

  // DOM要素の取得
  const textTabButton = document.querySelector('.tab-button[data-tab="text"]');
  const imageTabButton = document.querySelector('.tab-button[data-tab="image"]');
  const textInputContent = document.getElementById('text-input');
  const imageInputContent = document.getElementById('image-input');
  const referenceTitle = document.getElementById('reference-title');
  const referenceContent = document.getElementById('reference-content');
  const referenceType = document.getElementById('reference-type');
  const addReferenceButton = document.getElementById('add-reference-button');
  const clearReferenceButton = document.getElementById('clear-reference-button');
  const imageDropArea = document.getElementById('image-drop-area');
  const imageFileInput = document.getElementById('image-file-input');
  const previewImageContainer = document.getElementById('preview-image-container');
  const previewImage = document.getElementById('preview-image');
  const removeImageButton = document.getElementById('remove-image-button');
  const imageTitle = document.getElementById('image-title');
  const imageDescription = document.getElementById('image-description');
  const addImageButton = document.getElementById('add-image-button');
  const clearImageButton = document.getElementById('clear-image-button');
  const searchInput = document.getElementById('search-input');
  const referenceList = document.getElementById('reference-list');
  const categoryItems = document.querySelectorAll('.category-item');
  const tagItems = document.querySelectorAll('.tag-item');
  const refreshButton = document.getElementById('refresh-button');
  const referenceDetailOverlay = document.getElementById('reference-detail-overlay');
  const detailTitle = document.getElementById('detail-title');
  const detailContent = document.getElementById('detail-content');
  const detailTags = document.getElementById('detail-tags');
  const detailDate = document.getElementById('detail-date');
  const closeDetailButton = document.getElementById('close-detail-button');
  const editReferenceButton = document.getElementById('edit-reference-button');
  const deleteReferenceButton = document.getElementById('delete-reference-button');

  // 現在の画像ファイルパス
  let currentImagePath = null;
  let currentReferenceId = null;

  // 初期化
  function initialize() {
    // リスナー設定
    setupEventListeners();

    // メッセージハンドラー設定
    window.addEventListener('message', handleMessage);
  }

  // イベントリスナーの設定
  function setupEventListeners() {
    // タブ切り替え
    if (textTabButton) {
      textTabButton.addEventListener('click', () => switchTab('text'));
    }
    if (imageTabButton) {
      imageTabButton.addEventListener('click', () => switchTab('image'));
    }
    
    // デバッグ出力
    console.log('タブボタン:', {textTabButton, imageTabButton});
    console.log('コンテンツ:', {textInputContent, imageInputContent});

    // テキスト入力関連
    addReferenceButton.addEventListener('click', addReference);
    clearReferenceButton.addEventListener('click', clearReferenceForm);

    // 画像入力関連
    if (imageDropArea) {
      imageDropArea.addEventListener('click', () => imageFileInput.click());
      imageDropArea.addEventListener('dragover', handleDragOver);
      imageDropArea.addEventListener('drop', handleDrop);
    }
    
    if (imageFileInput) {
      imageFileInput.addEventListener('change', handleImageSelect);
    }
    
    if (removeImageButton) {
      removeImageButton.addEventListener('click', removeImage);
    }
    
    if (addImageButton) {
      addImageButton.addEventListener('click', addImageReference);
    }
    
    if (clearImageButton) {
      clearImageButton.addEventListener('click', clearImageForm);
    }
    
    // デバッグ出力
    console.log('画像関連要素:', {
      imageDropArea,
      imageFileInput,
      previewImageContainer,
      previewImage,
      removeImageButton,
      imageTitle,
      imageDescription,
      addImageButton,
      clearImageButton
    });

    // 検索関連
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // カテゴリフィルタリング
    categoryItems.forEach(item => {
      item.addEventListener('click', () => {
        // アクティブクラスを設定
        categoryItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // フィルタリング
        const category = item.dataset.category;
        filterByCategory(category);
      });
    });

    // タグフィルタリング
    tagItems.forEach(item => {
      item.addEventListener('click', () => {
        // アクティブクラスのトグル
        item.classList.toggle('active');

        // アクティブなタグを取得
        const activeTags = Array.from(document.querySelectorAll('.tag-item.active'))
          .map(el => el.dataset.tag);

        // フィルタリング
        filterByTags(activeTags);
      });
    });

    // 更新ボタン
    refreshButton.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    // 詳細表示関連
    closeDetailButton.addEventListener('click', closeReferenceDetail);
    editReferenceButton.addEventListener('click', editReference);
    deleteReferenceButton.addEventListener('click', deleteReference);

    // リファレンスアイテムのクリックイベントを設定
    setupReferenceItems();
  }

  // リファレンスアイテムのクリックイベントを設定
  function setupReferenceItems() {
    const items = document.querySelectorAll('.reference-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        showReferenceDetail(id);
      });
    });
  }

  // タブの切り替え
  function switchTab(tabName) {
    console.log(`タブ切り替え: ${tabName}`);
    
    // タブボタンのアクティブ状態を切り替え
    if (textTabButton && imageTabButton) {
      textTabButton.classList.toggle('active', tabName === 'text');
      imageTabButton.classList.toggle('active', tabName === 'image');
    }

    // タブコンテンツの表示/非表示を切り替え - display直接操作で確実に
    if (textInputContent && imageInputContent) {
      // クラス操作
      textInputContent.classList.toggle('active', tabName === 'text');
      imageInputContent.classList.toggle('active', tabName === 'image');
      
      // スタイル直接操作で確実に表示/非表示を強制
      if (tabName === 'text') {
        textInputContent.style.display = 'block';
        imageInputContent.style.display = 'none';
      } else if (tabName === 'image') {
        textInputContent.style.display = 'none';
        imageInputContent.style.display = 'block';
      }
      
      // デバッグ情報
      console.log('タブ切り替え後の状態:', {
        textTabActive: textTabButton?.classList.contains('active'),
        imageTabActive: imageTabButton?.classList.contains('active'),
        textContentActive: textInputContent?.classList.contains('active'),
        imageContentActive: imageInputContent?.classList.contains('active'),
        textContentDisplay: textInputContent?.style.display,
        imageContentDisplay: imageInputContent?.style.display
      });
    }
  }

  // リファレンス追加
  function addReference() {
    const title = referenceTitle.value.trim();
    const content = referenceContent.value.trim();
    const type = referenceType.value;

    if (!content) {
      showError('リファレンス内容を入力してください');
      return;
    }

    vscode.postMessage({
      command: 'addReference',
      title: title,
      content: content,
      type: type
    });

    clearReferenceForm();
  }

  // リファレンスフォームをクリア
  function clearReferenceForm() {
    referenceTitle.value = '';
    referenceContent.value = '';
    referenceType.value = 'auto';
  }

  // 画像の選択
  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      processImageFile(file);
    }
  }

  // ドラッグオーバーイベント
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    imageDropArea.classList.add('dragover');
  }

  // ドロップイベント
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    imageDropArea.classList.remove('dragover');

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    } else {
      showError('画像ファイルをドロップしてください');
    }
  }

  // 画像ファイルの処理
  function processImageFile(file) {
    // ファイルの最大サイズ（5MB）
    const maxFileSize = 5 * 1024 * 1024;
    if (file.size > maxFileSize) {
      showError('ファイルサイズが大きすぎます（最大5MB）');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      // プレビュー表示
      previewImage.src = e.target.result;
      imageDropArea.style.display = 'none';
      previewImageContainer.style.display = 'block';
      addImageButton.disabled = false;

      // 画像データを保存
      vscode.postMessage({
        command: 'saveImage',
        imageData: e.target.result
      });
    };
    reader.readAsDataURL(file);
  }

  // 画像削除
  function removeImage() {
    previewImage.src = '';
    imageDropArea.style.display = 'block';
    previewImageContainer.style.display = 'none';
    addImageButton.disabled = true;
    currentImagePath = null;
  }

  // 画像リファレンス追加
  function addImageReference() {
    const title = imageTitle.value.trim();
    const description = imageDescription.value.trim();

    if (!currentImagePath) {
      showError('画像を選択してください');
      return;
    }

    if (!title) {
      showError('タイトルを入力してください');
      return;
    }

    vscode.postMessage({
      command: 'addImageReference',
      imagePath: currentImagePath,
      title: title,
      description: description
    });

    clearImageForm();
  }

  // 画像フォームをクリア
  function clearImageForm() {
    removeImage();
    imageTitle.value = '';
    imageDescription.value = '';
  }

  // 検索処理
  function handleSearch() {
    const query = searchInput.value.trim();
    
    if (query) {
      vscode.postMessage({
        command: 'searchReferences',
        query: query
      });
    } else {
      // 検索クエリが空の場合はすべて表示
      vscode.postMessage({
        command: 'filterByType',
        type: 'all'
      });
    }
  }

  // カテゴリでフィルタリング
  function filterByCategory(category) {
    // タグのアクティブ状態をリセット
    document.querySelectorAll('.tag-item.active').forEach(item => {
      item.classList.remove('active');
    });

    vscode.postMessage({
      command: 'filterByType',
      type: category
    });
  }

  // タグでフィルタリング
  function filterByTags(tags) {
    if (tags.length === 0) {
      // タグが選択されていない場合はカテゴリに基づくフィルタリング
      const activeCategory = document.querySelector('.category-item.active').dataset.category;
      filterByCategory(activeCategory);
      return;
    }

    const references = state.references.filter(ref => {
      return tags.every(tag => ref.tags.includes(tag));
    });

    updateReferenceList(references);
  }

  // リファレンス詳細を表示
  function showReferenceDetail(id) {
    const reference = state.references.find(ref => ref.id === id);
    if (!reference) return;

    currentReferenceId = id;
    detailTitle.textContent = reference.title;
    
    // コンテンツの整形（Markdown対応）
    detailContent.innerHTML = formatMarkdown(reference.content);
    
    // タグの表示
    detailTags.innerHTML = reference.tags.map(tag => 
      `<span class="detail-tag">${tag}</span>`
    ).join('');
    
    // 日付の表示
    const date = new Date(reference.updatedAt).toLocaleString('ja-JP');
    detailDate.textContent = `更新日: ${date}`;
    
    // 詳細オーバーレイを表示
    referenceDetailOverlay.classList.add('active');
  }

  // リファレンス詳細を閉じる
  function closeReferenceDetail() {
    referenceDetailOverlay.classList.remove('active');
    currentReferenceId = null;
  }

  // リファレンスを編集
  function editReference() {
    const reference = state.references.find(ref => ref.id === currentReferenceId);
    if (!reference) return;

    // 現在未実装
    showError('編集機能は現在実装中です');
  }

  // リファレンスを削除
  function deleteReference() {
    if (!currentReferenceId) return;

    vscode.postMessage({
      command: 'deleteReference',
      id: currentReferenceId
    });

    closeReferenceDetail();
  }

  // リファレンスリストを更新
  function updateReferenceList(references) {
    // リストをクリア
    referenceList.innerHTML = '';

    // リファレンスがない場合
    if (references.length === 0) {
      referenceList.innerHTML = '<div class="empty-list">リファレンスがありません</div>';
      return;
    }

    // リファレンスを追加
    references.forEach(reference => {
      const item = createReferenceItem(reference);
      referenceList.appendChild(item);
    });

    // クリックイベントを再設定
    setupReferenceItems();
  }

  // リファレンスアイテムを作成
  function createReferenceItem(reference) {
    const item = document.createElement('div');
    item.className = 'reference-item';
    item.dataset.id = reference.id;
    item.dataset.type = reference.type;

    // タイプに応じたアイコン
    let typeIcon = '';
    switch (reference.type) {
      case 'api':
        typeIcon = '🔌';
        break;
      case 'code':
        typeIcon = '📝';
        break;
      case 'environment':
        typeIcon = '⚙️';
        break;
      case 'screenshot':
        typeIcon = '📷';
        break;
      default:
        typeIcon = '📄';
        break;
    }

    // 日付とタグの整形
    const date = new Date(reference.updatedAt).toLocaleString('ja-JP');
    const tags = reference.tags.map(tag => 
      `<span class="item-tag">${tag}</span>`
    ).join('');

    // コンテンツのプレビュー
    const preview = getContentPreview(reference.content);

    // HTMLを設定
    item.innerHTML = `
      <div class="item-icon">${typeIcon}</div>
      <div class="item-content">
        <div class="item-title">${reference.title}</div>
        <div class="item-preview">${preview}</div>
        <div class="item-meta">
          <div class="item-tags">${tags}</div>
          <div class="item-date">${date}</div>
        </div>
      </div>
    `;

    return item;
  }

  // コンテンツプレビューを取得
  function getContentPreview(content) {
    const maxLength = 100;
    let preview = content.substring(0, maxLength).replace(/\n/g, ' ');
    if (content.length > maxLength) {
      preview += '...';
    }
    return preview;
  }

  // Markdownを整形
  function formatMarkdown(text) {
    // コードブロックの処理
    text = text.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>');
    
    // リンクの処理
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // 改行の処理
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }

  // WebViewからのメッセージを処理
  function handleMessage(event) {
    const message = event.data;

    switch (message.command) {
      case 'searchResults':
      case 'filterResults':
        updateReferenceList(message.results);
        break;

      case 'imageSaved':
        currentImagePath = message.imagePath;
        break;
    }
  }

  // エラー表示
  function showError(message) {
    vscode.postMessage({
      command: 'showError',
      message: message
    });
  }

  // debounce関数
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // 初期化
  initialize();
})();