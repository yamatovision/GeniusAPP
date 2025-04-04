// @ts-check

/**
 * ClaudeCode共有パネルコンポーネント
 * クライアント側のWeb UI実装
 */
(function() {
  // メッセージハンドラー
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
      case 'updateSharingHistory':
        updateHistoryList(message.history);
        break;
      case 'showShareResult':
        showShareResult(message.data);
        break;
      case 'showError':
        showError(message.message);
        break;
    }
  });
  
  // DOMが読み込まれた時の初期化処理
  document.addEventListener('DOMContentLoaded', () => {
    // ClaudeCode連携エリアの制御
    initSharePanel();
    
    // ドラッグ&ドロップの初期化
    initDragAndDrop();
    
    // ボタンイベントの設定
    setupButtonEvents();
    
    // 履歴の更新リクエスト
    requestHistoryUpdate();
  });
  
  /**
   * 共有パネルの初期化
   */
  function initSharePanel() {
    const toggleShareBtn = document.getElementById('toggle-share-btn');
    const shareArea = document.getElementById('claude-code-share');
    const minimizeBtn = document.getElementById('minimize-share-btn');
    
    if (toggleShareBtn && shareArea && minimizeBtn) {
      // トグルボタンのクリックイベント
      toggleShareBtn.addEventListener('click', () => {
        shareArea.classList.remove('collapsed');
        toggleShareBtn.style.display = 'none';
      });
      
      // 最小化ボタンのクリックイベント
      minimizeBtn.addEventListener('click', () => {
        shareArea.classList.add('collapsed');
        toggleShareBtn.style.display = 'flex';
      });
      
      // 初期状態は非表示
      shareArea.classList.add('collapsed');
    }
  }
  
  /**
   * ドラッグ&ドロップ機能の初期化
   */
  function initDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    
    // ドラッグ&ドロップイベントの処理
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // ドラッグエンター/オーバー時のハイライト
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });
    
    // ドラッグリーブ/ドロップ時のハイライト解除
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
      dropZone.style.borderColor = 'var(--app-primary)';
      dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.1)';
    }
    
    function unhighlight() {
      dropZone.style.borderColor = 'var(--app-border-color)';
      dropZone.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    }
    
    // ファイルドロップ時の処理
    dropZone.addEventListener('drop', handleDrop, false);
    
    // ファイル選択ボタンの処理
    const fileSelectButton = dropZone.querySelector('button');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/gif';
    fileInput.className = 'file-input';
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    });
    
    document.body.appendChild(fileInput);
    
    if (fileSelectButton) {
      fileSelectButton.addEventListener('click', () => {
        fileInput.click();
      });
    }
  }
  
  /**
   * ドロップされたファイルの処理
   * @param {DragEvent} e ドロップイベント
   */
  function handleDrop(e) {
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length) {
      handleFiles(dt.files);
    }
  }
  
  /**
   * ファイルの処理
   * @param {FileList} files ファイルリスト
   */
  function handleFiles(files) {
    const file = files[0]; // 現在は1ファイルのみサポート
    
    if (file.type.match('image.*')) {
      const dropZone = document.getElementById('drop-zone');
      const reader = new FileReader();
      
      reader.onload = function(e) {
        // プレビュー表示
        dropZone.innerHTML = `
          <img src="${e.target.result}" class="image-preview" />
          <p style="margin-top: 10px;">画像を共有準備完了</p>
          <p style="font-size: 12px; color: var(--app-text-secondary);">${file.name}</p>
        `;
        
        // ファイル情報を保存
        dropZone.dataset.fileName = file.name;
        dropZone.dataset.fileType = file.type;
        dropZone.dataset.fileData = e.target.result.toString();
      };
      
      reader.readAsDataURL(file);
    } else {
      showError('サポートされていない形式です。PNG, JPG, JPEG, GIF画像のみ対応しています。');
    }
  }
  
  /**
   * ボタンイベントの設定
   */
  function setupButtonEvents() {
    // 共有ボタン
    const shareButton = document.getElementById('share-to-claude');
    if (shareButton) {
      shareButton.addEventListener('click', handleShareClick);
    }
    
    // クリアボタン
    const clearButton = document.querySelector('.share-actions .button-secondary');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        // テキストエリアをクリア
        const textarea = document.querySelector('.share-textarea');
        if (textarea) {
          textarea.value = '';
        }
        
        // 画像ドロップゾーンをリセット
        resetDropZone();
        
        // 結果ダイアログを非表示
        const resultDialog = document.getElementById('share-result-dialog');
        if (resultDialog) {
          resultDialog.style.display = 'none';
        }
      });
    }
  }
  
  /**
   * 共有ボタンのクリックハンドラ
   */
  function handleShareClick() {
    const dropZone = document.getElementById('drop-zone');
    const textarea = document.querySelector('.share-textarea');
    const hasImage = dropZone && dropZone.dataset.fileData;
    const hasText = textarea && textarea.value.trim() !== '';
    
    if (hasImage) {
      // 画像の共有
      vscode.postMessage({
        command: 'shareImage',
        data: dropZone.dataset.fileData,
        fileName: dropZone.dataset.fileName,
        fileType: dropZone.dataset.fileType
      });
    } else if (hasText) {
      // テキストの共有
      vscode.postMessage({
        command: 'shareText',
        text: textarea.value
      });
    } else {
      showError('共有するテキストまたは画像がありません。');
    }
  }
  
  /**
   * 画像ドロップゾーンのリセット
   */
  function resetDropZone() {
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      dropZone.innerHTML = `
        <span class="material-icons" style="font-size: 32px; margin-bottom: 10px;">image</span>
        <p>画像をドラッグ＆ドロップ<br>または</p>
        <button class="button button-secondary" style="margin-top: 10px;">ファイルを選択</button>
      `;
      
      // データ属性をクリア
      delete dropZone.dataset.fileName;
      delete dropZone.dataset.fileType;
      delete dropZone.dataset.fileData;
      
      // ボタンのイベントを再設定
      const fileSelectButton = dropZone.querySelector('button');
      if (fileSelectButton) {
        fileSelectButton.addEventListener('click', () => {
          const fileInput = document.querySelector('.file-input');
          if (fileInput) {
            fileInput.click();
          }
        });
      }
    }
  }
  
  /**
   * 履歴リストの更新
   * @param {Array} historyItems 履歴アイテムの配列
   */
  function updateHistoryList(historyItems) {
    const historyContainer = document.querySelector('.shared-history');
    if (!historyContainer) return;
    
    historyContainer.innerHTML = '';
    
    if (historyItems && historyItems.length > 0) {
      historyItems.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // アイテム名の表示（先頭30文字まで）
        const displayTitle = item.title || item.originalName || item.fileName;
        const shortTitle = displayTitle.length > 30 
          ? displayTitle.substring(0, 30) + '...' 
          : displayTitle;
        
        // 時間表示の作成
        const createdDate = new Date(item.createdAt);
        const timeAgo = getTimeAgo(createdDate);
        
        historyItem.innerHTML = `
          <span>${item.type === 'image' ? '画像: ' : ''}${shortTitle} (${timeAgo})</span>
          <div>
            <span class="material-icons history-action-copy" style="font-size: 16px; cursor: pointer;" title="コマンドをコピー">content_copy</span>
            <span class="material-icons history-action-delete" style="font-size: 16px; cursor: pointer;" title="履歴から削除">delete</span>
          </div>
        `;
        
        // コピーボタンのイベント
        const copyButton = historyItem.querySelector('.history-action-copy');
        if (copyButton) {
          copyButton.addEventListener('click', () => {
            // コマンドコピーリクエスト
            vscode.postMessage({
              command: 'copyCommand',
              fileId: item.id
            });
          });
        }
        
        // 削除ボタンのイベント
        const deleteButton = historyItem.querySelector('.history-action-delete');
        if (deleteButton) {
          deleteButton.addEventListener('click', () => {
            // 履歴から削除リクエスト
            vscode.postMessage({
              command: 'deleteFromHistory',
              fileId: item.id
            });
          });
        }
        
        // 再利用のためのクリックイベント
        historyItem.addEventListener('click', (e) => {
          // ボタン部分がクリックされた場合は無視
          if (e.target.closest('.history-action-copy') || e.target.closest('.history-action-delete')) {
            return;
          }
          
          // 履歴アイテムの再利用リクエスト
          vscode.postMessage({
            command: 'reuseHistoryItem',
            fileId: item.id
          });
        });
        
        historyContainer.appendChild(historyItem);
      });
    } else {
      historyContainer.innerHTML = '<div class="history-empty">履歴がありません</div>';
    }
  }
  
  /**
   * 共有結果の表示
   * @param {Object} data 共有結果データ
   */
  function showShareResult(data) {
    const resultDialog = document.getElementById('share-result-dialog');
    if (!resultDialog) return;
    
    // 表示内容の設定
    resultDialog.innerHTML = `
      <h4 style="margin-top: 0;">ファイル保存完了</h4>
      <p>以下のコマンドをClaudeCodeに貼り付けてファイルを読み込んでください：</p>
      <div class="command-container">
        <code id="claude-command" style="font-family: monospace; color: #f0f0f0;">${data.command}</code>
        <button id="copy-command" class="copy-button">
          <span class="material-icons" style="font-size: 16px;">content_copy</span>
        </button>
      </div>
    `;
    
    // コピーボタンのイベント設定
    const copyButton = resultDialog.querySelector('#copy-command');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const commandText = document.getElementById('claude-command').textContent;
        
        // コピーリクエスト
        vscode.postMessage({
          command: 'copyToClipboard',
          text: commandText
        });
        
        // コピーフィードバック
        copyButton.innerHTML = '<span class="material-icons" style="font-size: 16px; color: var(--app-secondary);">check</span>';
        setTimeout(() => {
          copyButton.innerHTML = '<span class="material-icons" style="font-size: 16px;">content_copy</span>';
        }, 2000);
      });
    }
    
    // ダイアログを表示
    resultDialog.style.display = 'block';
    
    // 共有後に入力をクリア
    if (data.type === 'image') {
      resetDropZone();
    } else {
      const textarea = document.querySelector('.share-textarea');
      if (textarea) {
        textarea.value = '';
      }
    }
    
    // 履歴の更新リクエスト
    requestHistoryUpdate();
  }
  
  /**
   * エラーメッセージの表示
   * @param {string} message エラーメッセージ
   */
  function showError(message) {
    // エラーメッセージをVSCodeに送信（拡張側でエラー表示）
    vscode.postMessage({
      command: 'showError',
      message: message
    });
  }
  
  /**
   * 履歴の更新リクエスト
   */
  function requestHistoryUpdate() {
    vscode.postMessage({
      command: 'getHistory'
    });
  }
  
  /**
   * 相対時間の取得（〇分前、など）
   * @param {Date} date 日付
   * @returns {string} 相対時間
   */
  function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffMin < 1) {
      return '数秒前';
    } else if (diffMin < 60) {
      return `${diffMin}分前`;
    } else if (diffHour < 24) {
      return `${diffHour}時間前`;
    } else {
      // 日付のフォーマット
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  }
})();