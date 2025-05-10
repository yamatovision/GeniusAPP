// @ts-check

/**
 * ClaudeCode共有パネルコンポーネント
 * クライアント側のWeb UI実装
 */
(function() {
  // VSCodeとの通信用APIを取得（既に取得済みの場合は取得しない）
  let vscode;
  try {
    // 外部から提供されるvsCodeオブジェクトをチェック（グローバル変数として存在する可能性）
    if (typeof window.vsCodeApi !== 'undefined') {
      vscode = window.vsCodeApi;
      console.log('sharingPanel: 既存のVSCode APIを使用します');
    } else {
      // なければ取得を試みる（エラーは捕捉）
      vscode = acquireVsCodeApi();
      console.log('sharingPanel: VSCode APIを新規取得しました');
      // 他のスクリプトでも使えるようにグローバル変数として保存
      window.vsCodeApi = vscode;
    }
  } catch (e) {
    console.warn('sharingPanel: VSCode API取得エラー:', e);
    // エラー時のフォールバック（ダミー実装）
    vscode = {
      postMessage: function(msg) {
        console.log('ダミーvscode.postMessage:', msg);
      }
    };
  }
  
  // ドラッグ&ドロップの適切なハンドリングのためのヘルパー関数
  function initDropZoneStyles() {
    console.log('ドロップゾーンのスタイルを初期化します');
    
    // ドロップゾーンのスタイルを初期化
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      // ドロップゾーンに適切なスタイルを設定
      dropZone.style.border = '2px dashed var(--app-border-color)';
      dropZone.style.borderRadius = 'var(--app-border-radius)';
      dropZone.style.padding = '15px';
      dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.05)';
      dropZone.style.transition = 'all 0.3s ease';
    }
  }
  
  // 初期化時に実行
  initDropZoneStyles();
  // メッセージハンドラー
  window.addEventListener('message', event => {
    const message = event.data;
    
    // 処理しないメッセージリスト（他のコンポーネントに処理を任せる）
    const skipCommands = [
      'displayModelMockup',        // モックアップ表示（scopeManager.js担当）
      'updateDirectoryStructure',  // ディレクトリ構造更新（fileBrowser.js担当）
      'updateFileBrowser',         // ファイルブラウザ更新（fileBrowser.js担当）
      'listDirectory',             // ディレクトリリスト要求（VSCode拡張担当）
      'initFileBrowser'            // ファイルブラウザ初期化（fileBrowser.js担当）
    ];
    
    // スキップリストに含まれるコマンドは処理しない
    if (skipCommands.includes(message.command)) {
      return;
    }
    
    // 処理するメッセージのみログに出力
    console.log('メッセージ受信:', message.command, message);
    
    switch (message.command) {
      case 'updateSharingHistory':
        displayHistory(message.history);
        break;
      // 後方互換性のため
      case 'updateHistoryList':
        displayHistory(message.history);
        break;
      case 'showShareResult':
        console.log('共有結果表示メッセージを受信:', message.data);
        showSaveNotification(message.data);
        break;
      case 'shareSuccess': // 旧式メッセージタイプにも対応
        console.log('共有成功メッセージを受信:', message);
        showSaveNotification({
          filePath: message.filePath,
          command: message.viewCommand,
          type: message.filePath.endsWith('.png') || message.filePath.endsWith('.jpg') ? 'image' : 'text'
        });
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'commandCopied':
        showCopyFeedback(message.fileId);
        break;
      case 'resetDropZone':
        // 画像アップロードエリアをクリア
        const force = message.force === true;
        console.log(`sharingPanel.js: resetDropZone命令を受信 (force=${force}, timestamp=${message.timestamp || 'none'})`);
        resetDropZone(force);
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
    
    // 履歴の更新リクエスト - 少し遅延させてリクエストを送信（他の初期化処理が完了した後）
    setTimeout(() => {
      requestHistoryUpdate();
      console.log('初期化後の履歴更新リクエストを送信しました');
    }, 500);
  });
  
  /**
   * テキストの先頭部分からファイル名を生成
   * @param {string} text 入力テキスト
   * @returns {string} 生成されたファイル名
   */
  function generateFilenameFromText(text) {
    // null、undefined、または空の場合はデフォルト名
    if (!text || typeof text !== 'string') {
      console.log('生成に使用するテキストが無効です。デフォルト名を使用します', { text });
      return 'shared_text';
    }
    
    // 複数行の場合は最初の行のみ使用
    let firstLine = text.split('\n')[0].trim();
    
    // 先頭の50文字を取得
    if (firstLine.length > 50) {
      firstLine = firstLine.substring(0, 50);
    }
    
    // 日本語を含む場合の処理
    if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(firstLine)) {
      console.log('日本語を含むテキストを検出しました');
      
      // 日付と時間の生成（識別子として）
      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      
      // 短いハッシュを生成（一意性確保のため）
      const hashStr = Math.random().toString(36).substring(2, 4);
      
      // 日本語テキストの最初の10文字を抽出
      let jpTextPart = '';
      if (firstLine.length > 0) {
        // 10文字以内にする
        jpTextPart = firstLine.substring(0, Math.min(10, firstLine.length));
        
        // 制御文字や特殊文字を除去（ファイル名に使用できない文字を削除）
        jpTextPart = jpTextPart.replace(/[\\/:*?"<>|]/g, '');
        jpTextPart = jpTextPart.replace(/\s+/g, '_');
      }
      
      // 日本語テキストが空になっていた場合は「日本語」を使用
      if (!jpTextPart || jpTextPart.length === 0) {
        jpTextPart = '日本語';
      }
      
      // ファイル名の形式: [日本語テキスト]_[日付]_[時間]_[ハッシュ]
      return `${jpTextPart}_${dateStr}_${timeStr}_${hashStr}`;
    }
    
    // 英数字の場合は従来通り処理
    // 空白をアンダースコアに置換
    const prefix = firstLine.replace(/\s+/g, '_');
    // ファイル名に使用できない文字を取り除く
    const validPrefix = prefix.replace(/[^a-zA-Z0-9_\-]/g, '');
    
    // 有効な文字が残らなかった場合はデフォルト名
    if (!validPrefix) {
      return 'shared_text';
    }
    
    return validPrefix;
  }
  
  /**
   * 共有パネルの初期化（最初から表示）
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
        
        // VSCodeのネイティブメッセージは自然に表示させる
      });
      
      // 最小化ボタンのクリックイベント
      minimizeBtn.addEventListener('click', () => {
        shareArea.classList.add('collapsed');
        toggleShareBtn.style.display = 'flex';
      });
      
      // 初期状態は非表示（ユーザーが必要なときに表示するように）
      shareArea.classList.add('collapsed');
      toggleShareBtn.style.display = 'flex';
      
      // ドロップゾーンに目立つスタイルを適用
      const dropZone = document.getElementById('drop-zone');
      if (dropZone) {
        dropZone.style.borderColor = 'var(--app-primary)';
        dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
        dropZone.style.boxShadow = '0 0 15px rgba(74, 105, 189, 0.4)';
        
        // ドロップゾーン内のテキストを変更
        const p = dropZone.querySelector('p');
        if (p) {
          p.innerHTML = `
            <span style="color: white; font-weight: bold;">画像をここにドロップ</span><br>
            <span style="font-size: 12px; color: var(--app-text-secondary);">
              画像ファイルをここにドラッグしてください
            </span>
          `;
        }
      }
    }
  }
  
  /**
   * ドラッグ&ドロップ機能の初期化
   * シンプル版: 基本的なドラッグ&ドロップ処理に集中
   */
  function initDragAndDrop() {
    console.log('シンプル化されたドラッグ&ドロップ機能を初期化します');
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) {
      console.error('ドロップゾーン要素が見つかりません');
      return;
    }
    
    // ファイル入力要素を準備
    let fileInput = document.querySelector('.file-input');
    if (fileInput) {
      fileInput.remove();
    }
    
    // 新しいファイル入力要素を作成
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/gif';
    fileInput.className = 'file-input';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // ファイル選択イベント
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    });
    
    // クリックでファイル選択
    dropZone.onclick = function(e) {
      if (e.target.id !== 'file-select-btn' && !e.target.closest('#file-select-btn')) {
        fileInput.click();
      }
    };
    
    // ファイル選択ボタンの処理
    const fileSelectButton = document.getElementById('file-select-btn');
    if (fileSelectButton) {
      fileSelectButton.onclick = function(e) {
        e.stopPropagation();
        fileInput.click();
      };
    }
    
    // ドロップゾーンのみにドラッグ&ドロップイベントを設定
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });
    
    // ドラッグエンター/オーバー時のハイライト
    dropZone.addEventListener('dragenter', function() {
      dropZone.style.borderColor = 'var(--app-primary)';
      dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
    });
    
    dropZone.addEventListener('dragover', function() {
      dropZone.style.borderColor = 'var(--app-primary)';
      dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
    });
    
    // ドラッグリーブ/ドロップ時のハイライト解除
    dropZone.addEventListener('dragleave', function() {
      dropZone.style.borderColor = 'var(--app-border-color)';
      dropZone.style.backgroundColor = 'rgba(20, 20, 20, 0.3)';
    });
    
    // ファイルドロップ時の処理
    dropZone.addEventListener('drop', function(e) {
      dropZone.style.borderColor = 'var(--app-border-color)';
      dropZone.style.backgroundColor = 'rgba(20, 20, 20, 0.3)';
      
      const dt = e.dataTransfer;
      if (dt.files && dt.files.length) {
        handleFiles(dt.files);
      }
    });
    
    // クリップボードからの画像ペースト
    dropZone.addEventListener('paste', (e) => {
      const items = e.clipboardData.items;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFiles([file]);
            break;
          }
        }
      }
    });
    
    console.log('ドラッグ&ドロップ機能の初期化が完了しました');
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
        try {
          // 結果が文字列型である確認
          const result = e.target.result;
          if (!result) {
            console.error('FileReader結果がnullまたはundefined');
            showError('画像データの読み込みに失敗しました（nullまたはundefined）');
            return;
          }
          
          // 文字列に変換
          const resultString = result.toString();
          console.log(`画像データ読み込み完了: 型=${typeof result}, 長さ=${resultString.length}`);
          
          // プレビュー表示（アップロード中表示）
          dropZone.innerHTML = `
            <img src="${resultString}" class="image-preview" />
            <p style="margin: 0 0 10px 0; color: var(--app-text-secondary);">${file.name}</p>
            <p style="color: var(--app-warning);">自動保存中...</p>
          `;
          
          // ファイル情報を保存
          dropZone.dataset.fileName = file.name;
          dropZone.dataset.fileType = file.type;
          dropZone.dataset.fileData = resultString;
          
          // 自動的に保存処理を実行
          setTimeout(() => {
            handleSaveClick();
          }, 300); // 少し遅延させて実行（UIのレンダリングが完了した後）
        } catch (error) {
          console.error('画像読み込み処理エラー:', error);
          showError(`画像データの処理に失敗しました: ${error.message}`);
        }
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
    // 保存ボタン
    const saveButton = document.getElementById('share-to-claude');
    if (saveButton) {
      saveButton.addEventListener('click', handleSaveClick);
    }
    
    // クリアボタン
    const clearButton = document.getElementById('clear-button');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        // テキストエリアをクリア
        const textarea = document.querySelector('.share-textarea');
        if (textarea) {
          textarea.value = '';
        }
        
        // 画像ドロップゾーンをリセット
        resetDropZone();
        
        // 通知を非表示
        hideSaveNotification();
      });
    }
  }
  
  /**
   * 保存ボタンのクリックハンドラ
   */
  function handleSaveClick() {
    // 保存ボタンの多重クリックを防止
    const saveButton = document.getElementById('share-to-claude');
    if (saveButton) {
      if (saveButton.disabled) {
        console.log('保存処理中のため、クリックを無視します');
        return;
      }
      
      // ボタンを無効化して再クリックを防止
      saveButton.disabled = true;
      saveButton.innerHTML = '<span class="material-icons" style="font-size: 14px;">hourglass_top</span> 保存中...';
    }
    
    const dropZone = document.getElementById('drop-zone');
    const textarea = document.querySelector('.share-textarea');
    const hasImage = dropZone && dropZone.dataset.fileData;
    const hasText = textarea && textarea.value.trim() !== '';
    
    // 送信前に保存中メッセージを表示
    const notification = document.getElementById('save-notification');
    if (notification) {
      notification.style.display = 'flex';
      notification.innerHTML = `
        <span class="material-icons" style="color: var(--app-warning);">hourglass_top</span>
        <span class="notification-text">保存中...</span>
      `;
      notification.style.opacity = '1';
      // 保存中状態の視覚的なフィードバック
      notification.style.backgroundColor = 'rgba(253, 203, 110, 0.15)';
    }
    
    if (hasImage) {
      console.log('画像データを送信します');
      // 画像データのバックアップを取る（送信後に確実にクリアするため）
      const imageData = dropZone.dataset.fileData;
      const fileName = dropZone.dataset.fileName;
      const fileType = dropZone.dataset.fileType;
      
      // 画像の共有（ScopeManagerPanel.tsで期待されるフィールド名に合わせる）
      vscode.postMessage({
        command: 'shareImage',
        // serviceTypeは不要なので削除（ScopeManagerPanelで直接処理される）
        imageData: imageData,  // ScopeManagerPanel.tsは'imageData'フィールドを参照している
        fileName: fileName,
        fileType: fileType
      });
      
      // 画像保存後、確実にドロップゾーンをリセット
      console.log('画像保存後すぐにドロップゾーンをリセットします');
      resetDropZone(true); // 強制リセット
      
      // 念のため、タイマーを使って少し遅れて再度リセットする
      setTimeout(() => {
        console.log('遅延リセットを実行');
        resetDropZone(true); // 強制リセット
      }, 500);
    } else if (hasText) {
      // テキストの共有、先頭部分をファイル名に
      const text = textarea.value.trim();
      const suggestedFilename = generateFilenameFromText(text);

      console.log('テキストデータを送信します', { textLength: text.length, filename: suggestedFilename });

      vscode.postMessage({
        command: 'shareText',
        // serviceTypeは不要なので削除（ScopeManagerPanelで直接処理される）
        text: text,
        suggestedFilename: suggestedFilename
      });
      
      // テキスト入力をすぐにクリア（UXの向上）
      textarea.value = '';
    } else {
      showError('共有するテキストまたは画像がありません。');
      
      // エラー時は通知を非表示に
      if (notification) {
        notification.style.display = 'none';
      }
      
      // エラー時はボタンを再有効化
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = '保存';
      }
    }
    
    // 10秒後にもボタンが無効のままならタイムアウトとして扱い、強制的に有効化
    setTimeout(() => {
      const saveButton = document.getElementById('share-to-claude');
      if (saveButton && saveButton.disabled) {
        console.warn('保存処理がタイムアウトした可能性があります。ボタンを再有効化します。');
        saveButton.disabled = false;
        saveButton.innerHTML = '保存';
        
        // 通知も非表示にする
        const notification = document.getElementById('save-notification');
        if (notification && notification.innerHTML.includes('保存中')) {
          notification.style.display = 'none';
        }
      }
    }, 10000);
  }
  
  /**
   * 画像ドロップゾーンのリセット
   * @param {boolean} force - 強制リセットフラグ
   */
  function resetDropZone(force = false) {
    console.log('sharingPanel.js: 画像ドロップゾーンをリセットします (force=' + force + ')');
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      try {
        // データ属性を確実にクリア (最初に実行)
        delete dropZone.dataset.fileName;
        delete dropZone.dataset.fileType;
        delete dropZone.dataset.fileData;
        
        // リセット時の状態をデバッグ
        console.log('リセット前のドロップゾーン状態:', dropZone.innerHTML);
        
        // HTMLをリセット
        dropZone.innerHTML = `
          <span class="material-icons" style="font-size: 36px; margin-bottom: 10px; color: var(--app-primary);">add_photo_alternate</span>
          <p style="margin-bottom: 8px; color: #ffffff; text-align: center;">
            このエリアをクリックして画像をアップロード<br>
            <span style="font-size: 12px; color: var(--app-text-secondary);">またはファイルをドラッグ＆ドロップ</span>
          </p>
          <button id="file-select-btn" class="button-secondary">ブラウズ...</button>
        `;
        
        // リセット後の状態をデバッグ
        console.log('リセット後のドロップゾーン状態:', dropZone.innerHTML);
        
        // 確実に画像要素がないことを確認
        const imgElements = dropZone.querySelectorAll('img');
        if (imgElements.length > 0) {
          console.warn('リセット後も画像要素が残っています。強制削除します。');
          imgElements.forEach(img => img.remove());
        }
        
        // 要素内のすべての子要素を確認し、不要な要素を削除
        if (force) {
          // 画像要素を含むすべての子要素を確認
          const children = [...dropZone.children];
          children.forEach(child => {
            if (child.tagName === 'IMG' || (child.tagName === 'P' && child.textContent.includes('共有準備完了'))) {
              child.remove();
            }
          });
        }
        
        // ファイル入力要素を作成し直す
        let fileInput = document.querySelector('.file-input');
        // 古いファイル入力要素があれば削除
        if (fileInput) {
          fileInput.remove();
        }
        
        // 新しいファイル入力要素を作成
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/jpeg,image/jpg,image/gif';
        fileInput.className = 'file-input';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // ファイル入力要素のイベントハンドラ
        fileInput.addEventListener('change', e => {
          console.log('ファイル選択イベント発生', e.target.files);
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
          }
        });
        
        // dropZoneにクリックイベントを追加（シフトキーなどの修飾なしで動作するように）
        dropZone.onclick = function(e) {
          console.log('ドロップゾーンクリック');
          // ボタンのクリックと重複しないように
          if (e.target.id !== 'file-select-btn' && !e.target.closest('#file-select-btn')) {
            console.log('ファイル選択ダイアログを開きます');
            fileInput.click(); // これでファイル選択ダイアログが開く
          }
        };
        
        // ボタンのイベントを再設定
        const fileSelectButton = document.getElementById('file-select-btn');
        if (fileSelectButton) {
          fileSelectButton.onclick = function(e) {
            e.stopPropagation(); // dropZoneのクリックイベントと重複しないように
            console.log('ファイル選択ボタンクリック');
            fileInput.click();
          };
        }
        
        // ドラッグ&ドロップイベントの再設定
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
          dropZone.addEventListener(eventName, function(e) {
            e.preventDefault();
            e.stopPropagation();
          }, false);
        });
        
        // ハイライト効果
        dropZone.addEventListener('dragenter', function() {
          dropZone.style.borderColor = 'var(--app-primary)';
          dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
        });
        
        dropZone.addEventListener('dragover', function() {
          dropZone.style.borderColor = 'var(--app-primary)';
          dropZone.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
        });
        
        // ハイライト解除
        dropZone.addEventListener('dragleave', function() {
          dropZone.style.borderColor = 'var(--app-border-color)';
          dropZone.style.backgroundColor = 'rgba(20, 20, 20, 0.3)';
        });
        
        // ドロップ処理
        dropZone.addEventListener('drop', function(e) {
          dropZone.style.borderColor = 'var(--app-border-color)';
          dropZone.style.backgroundColor = 'rgba(20, 20, 20, 0.3)';
          
          const dt = e.dataTransfer;
          if (dt.files && dt.files.length) {
            handleFiles(dt.files);
          }
        });
        
        console.log('ドロップゾーンのリセットと再初期化が完了しました');
        
      } catch (error) {
        console.error('ドロップゾーンのリセット中にエラーが発生しました:', error);
      }
    } else {
      console.error('ドロップゾーン要素が見つかりません');
    }
  }
  
  /**
   * 履歴データでUIを更新
   * @param {Array} historyItems 履歴アイテムの配列
   */
  function displayHistory(historyItems) {
    console.log('履歴更新:', historyItems);
    const historyContainer = document.querySelector('.shared-history-list, .shared-history');
    if (!historyContainer) {
      console.error('履歴コンテナが見つかりません');
      return;
    }
    
    // アニメーション効果用にフェードアウト
    historyContainer.style.opacity = '0.5';
    historyContainer.style.transition = 'opacity 0.2s ease';
    
    setTimeout(() => {
      historyContainer.innerHTML = '';
      
      if (!historyItems || historyItems.length === 0) {
        historyContainer.innerHTML = '<div class="history-empty">履歴がありません</div>';
        historyContainer.style.opacity = '1';
        return;
      }
      
      // 最新10件のみ表示
      const recentItems = historyItems.slice(0, 10);
      
      // アイテムをDOMに追加
      recentItems.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.id = item.id;
        
        // ディレイを付けてフェードイン効果（アニメーション）
        historyItem.style.opacity = '0';
        historyItem.style.transform = 'translateX(-10px)';
        historyItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        // ファイル名または先頭テキストを表示
        // メタデータから元の提案名を優先使用
        let displayName = '';
        
        if (item.metadata && item.metadata.originalSuggestedName) {
          displayName = item.metadata.originalSuggestedName;
          console.log('メタデータから元の提案名を使用:', displayName);
        } else {
          displayName = item.title || item.originalName || item.fileName;
        }
        
        // 日本語を含むか確認
        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(displayName);
        
        // 日本語の場合は20文字まで、それ以外は30文字まで表示
        const maxLength = hasJapanese ? 20 : 30;
        const shortName = displayName.length > maxLength 
          ? displayName.substring(0, maxLength) + '...' 
          : displayName;
        
        // 日本語テキストの場合、クラスを追加
        const jpClass = hasJapanese ? 'japanese-text' : '';
        
        // 時間の表示
        const createdDate = new Date(item.createdAt);
        const timeAgo = getTimeAgo(createdDate);
        
        // ファイルタイプに応じたアイコンとクラス
        const iconClass = item.type === 'image' ? 'image' : 'description';
        const itemTypeClass = item.type === 'image' ? 'image-history-item' : 'text-history-item';
        
        // 適切なクラスを追加
        historyItem.className = `history-item ${itemTypeClass}`;
        
        historyItem.innerHTML = `
          <div class="history-item-name ${jpClass}" title="${displayName}">
            <span class="material-icons" style="font-size: 16px;">${iconClass}</span>
            ${shortName}
          </div>
          <div class="history-item-actions">
            <span class="history-item-time">${timeAgo}</span>
            <span class="material-icons history-action-copy" style="font-size: 16px; cursor: pointer; margin-left: 8px;" title="コマンドをコピー">content_copy</span>
            <span class="material-icons history-action-delete" style="font-size: 16px; cursor: pointer; margin-left: 4px;" title="履歴から削除">delete</span>
          </div>
        `;
        
        // コピーアイコンへのイベント
        const copyIcon = historyItem.querySelector('.history-action-copy');
        if (copyIcon) {
          copyIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // イベントバブリングを防止
            
            // コピーコマンドのメッセージ送信
            vscode.postMessage({
              command: 'copyCommand',
              fileId: item.id
            });
          });
        }
        
        // 削除アイコンへのイベント
        const deleteIcon = historyItem.querySelector('.history-action-delete');
        if (deleteIcon) {
          deleteIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // イベントバブリングを防止
            
            // 削除コマンドのメッセージ送信
            vscode.postMessage({
              command: 'deleteFromHistory',
              fileId: item.id
            });
          });
        }
        
        historyContainer.appendChild(historyItem);
        
        // ディレイを付けてアニメーション効果
        setTimeout(() => {
          historyItem.style.opacity = '1';
          historyItem.style.transform = 'translateX(0)';
        }, index * 50); // 各アイテムを少しずつ遅延表示
      });
      
      // コンテナを再表示
      historyContainer.style.opacity = '1';
    }, 100);
  }
  
  /**
   * 保存完了通知の表示
   */
  function showSaveNotification(data) {
    console.log('保存完了通知:', data);
    const notification = document.getElementById('save-notification');
    if (!notification) {
      console.error('通知要素が見つかりません');
      return;
    }
    
    try {
      // 保存中表示から保存完了表示への視覚的トランジション
      notification.style.backgroundColor = 'rgba(0, 184, 148, 0.15)';
      notification.style.display = 'flex';
      notification.innerHTML = `
        <span class="material-icons success-icon">check_circle</span>
        <span class="notification-text">保存完了 - コピーする場合は履歴をクリック</span>
      `;
      
      // スムーズなアニメーション効果
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(5px)';
      
      // セーブボタンの状態を元に戻す
      const saveButton = document.getElementById('share-to-claude');
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = '保存';
      }
      
      // アニメーション開始
      setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
      }, 10);
      
      // ハイライト効果（短くフラッシュ）
      setTimeout(() => {
        notification.style.boxShadow = '0 0 15px rgba(0, 184, 148, 0.6)';
      }, 100);
      
      setTimeout(() => {
        notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
      }, 600);
      
      // 4秒後に自動的に消える（フェードアウト効果付き）
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(5px)';
        
        setTimeout(() => {
          notification.style.display = 'none';
        }, 300);
      }, 4000);
    } catch (error) {
      console.error('通知表示エラー:', error);
      // エラー時も最低限の表示を保証
      notification.innerHTML = '<span>保存完了</span>';
      notification.style.display = 'flex';
    }
    
    // 入力をクリア
    if (data && data.type === 'image') {
      resetDropZone();
    } else {
      const textarea = document.querySelector('.share-textarea');
      if (textarea) {
        textarea.value = '';
      }
    }
    
    // 保存された直後に履歴エリアをハイライト
    const historyContainer = document.querySelector('.history-container');
    if (historyContainer) {
      historyContainer.style.boxShadow = '0 0 0 2px rgba(74, 105, 189, 0.5)';
      setTimeout(() => {
        historyContainer.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.2)';
      }, 1500);
    }
    
    // 履歴の更新リクエスト - 少し遅延させてリクエストを送信（他の初期化処理が完了した後）
    setTimeout(() => {
      requestHistoryUpdate();
      console.log('初期化後の履歴更新リクエストを送信しました');
    }, 500);
    
    // 複数回の更新を試みて確実に履歴が反映されるようにする
    // 最初の更新
    setTimeout(() => {
      requestHistoryUpdate();
      console.log('履歴再更新リクエスト送信 (1回目)');
    }, 500);
    
    // 念のため2回目の更新
    setTimeout(() => {
      requestHistoryUpdate();
      console.log('履歴再更新リクエスト送信 (2回目)');
    }, 1500);
  }
  
  /**
   * 保存完了通知を非表示
   */
  function hideSaveNotification() {
    const notification = document.getElementById('save-notification');
    if (notification) {
      notification.style.display = 'none';
    }
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
   * 履歴アイテムのコピー成功フィードバック
   * @param {string} fileId ファイルID
   */
  function showCopyFeedback(fileId, fileName) {
    const historyItems = document.querySelectorAll('.history-item');
    
    // コピー成功のグローバル通知
    const mainToast = document.createElement('div');
    mainToast.className = 'main-copy-toast';
    mainToast.innerHTML = `
      <span class="material-icons" style="color: var(--app-secondary); margin-right: 8px;">check_circle</span>
      コマンドをコピーしました！
    `;
    document.body.appendChild(mainToast);
    
    // アニメーション
    setTimeout(() => {
      mainToast.style.opacity = '1';
      mainToast.style.transform = 'translateY(0)';
    }, 10);
    
    // 3秒後に自動的に消える
    setTimeout(() => {
      mainToast.style.opacity = '0';
      mainToast.style.transform = 'translateY(10px)';
      
      // 完全に削除
      setTimeout(() => {
        if (mainToast.parentNode) {
          mainToast.parentNode.removeChild(mainToast);
        }
      }, 300);
    }, 3000);
    
    // 該当する履歴アイテムを強調表示
    historyItems.forEach(item => {
      // 重要な修正: fileIdと一致するアイテムだけに処理を適用する
      if (item.dataset.id === fileId) {
        // 画像アイテムかどうかを確認
        const isImage = item.classList.contains('image-history-item');
        
        // どのタイプのアイテムでも、コピー済みのクラスを追加
        // CSSがアイテムタイプによって異なる視覚効果を提供する
        item.classList.add('copied');
        
        // コピーアイコンを一時的に変更
        const copyIcon = item.querySelector('.history-action-copy');
        if (copyIcon) {
          const originalIcon = copyIcon.innerHTML;
          const originalTitle = copyIcon.title;
          
          // アイコンとタイトルを変更
          copyIcon.innerHTML = 'check_circle';
          copyIcon.title = 'コピーしました！';
          copyIcon.style.color = 'var(--app-secondary)';
          
          // 画像の場合はアイコンも拡大
          if (isImage) {
            copyIcon.style.transform = 'scale(1.2)';
            copyIcon.style.transition = 'transform 0.2s ease, color 0.2s ease';
          }
          
          // 2秒後に元に戻す
          setTimeout(() => {
            item.classList.remove('copied');
            copyIcon.innerHTML = originalIcon;
            copyIcon.title = originalTitle;
            copyIcon.style.color = '';
            copyIcon.style.transform = '';
          }, 2000);
        }
      }
    });
  }
  
  /**
   * 履歴の更新リクエスト
   */
  function requestHistoryUpdate() {
    try {
      vscode.postMessage({
        command: 'getHistory'
        // serviceTypeは不要なので削除（ScopeManagerPanelで直接処理される）
      });
      console.log('履歴更新リクエストを送信しました');
    } catch (error) {
      console.error('履歴更新リクエスト送信エラー:', error);
    }
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
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffMin < 1) {
      return '数秒前';
    } else if (diffMin < 60) {
      return `${diffMin}分前`;
    } else if (diffHour < 24) {
      return `${diffHour}時間前`;
    } else if (diffDay < 7) {
      return `${diffDay}日前`;
    } else {
      // 日付のフォーマット
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  }
})();