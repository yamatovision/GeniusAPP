 ClaudeCode共有機能リファクタリング計画

  目標とするレイアウト

  1. 左側: テキスト入力枠
    - 入力した文章を保存できる
    - 文章の最初の部分が自動的にファイル名として使用される
  2. 右側: ファイルアップロード枠
    - ドラッグ＆ドロップまたはファイル選択ボタンでアップロードできる
  3. 下部:
    - 左側のテキスト入力枠の下に履歴表示
    - 右側のファイルアップロード枠の下に操作ボタン（保存、クリア）
  4. 全体的な改善:
    - シンプルで分かりやすいUI
    - 視認性の向上
    - ファイル名生成の自動化（テキストの先頭部分を使用）
    - 不要なボタンを削除（コピーボタンなど）

  実装計画

  1. HTML構造の単純化

  <div class="claude-share-container">
    <!-- 左側：テキスト入力エリア -->
    <div class="text-input-area">
      <textarea class="share-textarea" 
  placeholder="ここにClaudeCodeと共有したいテキストを入力..."></textarea>
      <!-- 履歴表示エリア -->
      <div class="history-container">
        <h4>履歴</h4>
        <div class="shared-history-list">
          <!-- 履歴アイテムはJSで動的に生成 -->
        </div>
      </div>
    </div>

    <!-- 右側：画像アップロードと操作ボタン -->
    <div class="image-upload-area">
      <!-- ドロップゾーン -->
      <div class="drop-zone" id="drop-zone">
        <span class="material-icons">image</span>
        <p>画像をドラッグ＆ドロップまたは<br>ファイルを選択</p>
        <button class="button-secondary">ファイル選択</button>
      </div>

      <!-- ボタンエリア -->
      <div class="action-buttons">
        <button class="button-secondary" id="clear-button">クリア</button>
        <button class="button-primary" id="save-button">保存</button>
      </div>

      <!-- 保存結果通知（成功時のみ表示） -->
      <div class="save-notification" id="save-notification" style="display: none;">
        <span class="material-icons success-icon">check_circle</span>
        <span class="notification-text">保存完了</span>
      </div>
    </div>
  </div>

  2. CSSの改善

  .claude-share-container {
    display: flex;
    gap: var(--spacing-md);
    height: 300px;
    margin-bottom: var(--spacing-md);
  }

  /* 左側：テキスト入力エリア */
  .text-input-area {
    display: flex;
    flex-direction: column;
    flex: 3;
    gap: var(--spacing-sm);
  }

  .share-textarea {
    flex: 1;
    min-height: 150px;
    resize: none;
    padding: var(--spacing-sm);
    border-radius: var(--border-radius);
    background-color: var(--input-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    font-family: var(--font-mono);
  }

  .history-container {
    height: 120px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-sm);
    background-color: var(--card-bg);
  }

  /* 右側：画像アップロードエリア */
  .image-upload-area {
    display: flex;
    flex-direction: column;
    flex: 2;
    gap: var(--spacing-sm);
  }

  .drop-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    transition: all 0.3s ease;
    min-height: 150px;
    background-color: var(--card-bg-light);
  }

  .drop-zone:hover {
    background-color: var(--card-bg-hover);
    border-color: var(--primary-color);
  }

  .action-buttons {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-sm);
  }

  .save-notification {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background-color: var(--success-light);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-xs);
    color: var(--success);
  }

  .success-icon {
    color: var(--success);
  }

  /* 履歴アイテム */
  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    background-color: var(--item-bg);
    font-size: var(--font-size-sm);
  }

  .history-item:hover {
    background-color: var(--item-bg-hover);
  }

  3. JavaScript機能改善

  1. テキストからファイル名自動生成機能
  /**
   * テキストの先頭部分からファイル名を生成
   * @param {string} text 入力テキスト
   * @returns {string} 生成されたファイル名
   */
  function generateFilenameFromText(text) {
    // 先頭の50文字を取得（空白を取り除く）
    const prefix = text.trim().substring(0, 50).replace(/\s+/g, '_');
    // 使用できない文字を取り除く
    const validPrefix = prefix.replace(/[^a-zA-Z0-9_\-]/g, '');
    // 空だった場合はデフォルト名
    const filename = validPrefix || 'shared_text';
    // タイムスタンプを追加
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
    return `${filename}_${timestamp}`;
  }

  2. 保存処理の簡素化
  /**
   * テキストまたは画像を保存
   */
  async function saveContent() {
    const textarea = document.querySelector('.share-textarea');
    const dropZone = document.getElementById('drop-zone');

    // テキストの保存処理
    if (textarea && textarea.value.trim()) {
      const text = textarea.value.trim();
      const filename = generateFilenameFromText(text);

      try {
        // 共有サービスでテキストを保存
        const result = await saveTextContent(text, filename);
        showNotification('保存完了');
        updateHistory();
        textarea.value = ''; // 入力をクリア
      } catch (error) {
        showError('テキストの保存に失敗しました');
      }
    }
    // 画像の保存処理
    else if (dropZone && dropZone.dataset.imageData) {
      try {
        // 共有サービスで画像を保存
        const result = await saveImageContent(
          dropZone.dataset.imageData,
          dropZone.dataset.fileName
        );
        showNotification('保存完了');
        updateHistory();
        resetDropZone(); // 画像をクリア
      } catch (error) {
        showError('画像の保存に失敗しました');
      }
    } else {
      showError('保存するコンテンツがありません');
    }
  }

  4. 履歴表示の改善

  /**
   * 履歴の更新と表示
   */
  function updateHistory() {
    const historyContainer = document.querySelector('.shared-history-list');
    if (!historyContainer) return;

    // 履歴を取得
    vscode.postMessage({ command: 'getHistory' });
  }

  /**
   * 履歴データでUIを更新
   */
  function displayHistory(historyItems) {
    const historyContainer = document.querySelector('.shared-history-list');
    if (!historyContainer) return;

    historyContainer.innerHTML = '';

    if (!historyItems || historyItems.length === 0) {
      historyContainer.innerHTML = '<div class="history-empty">履歴がありません</div>';
      return;
    }

    // 最新10件のみ表示
    const recentItems = historyItems.slice(0, 10);

    recentItems.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';

      // ファイル名または先頭テキストを表示（30文字まで）
      const displayName = item.title || item.fileName || '無題';
      const shortName = displayName.length > 30
        ? displayName.substring(0, 30) + '...'
        : displayName;

      // 時間の表示
      const createdDate = new Date(item.createdAt);
      const timeAgo = getTimeAgo(createdDate);

      historyItem.innerHTML = `
        <div class="history-item-name" title="${displayName}">
          ${item.type === 'image' ? '🖼️ ' : '📄 '}${shortName}
        </div>
        <div class="history-item-time">${timeAgo}</div>
      `;

      // クリック時にコマンドをコピー
      historyItem.addEventListener('click', () => {
        vscode.postMessage({
          command: 'copyCommand',
          fileId: item.id
        });

        // 視覚的フィードバック
        historyItem.classList.add('copied');
        setTimeout(() => {
          historyItem.classList.remove('copied');
        }, 1000);
      });

      historyContainer.appendChild(historyItem);
    });
  }

  このリファクタリング計画に基づいて作業を進めていくことで、よりシンプルで使いやすいUIに改善できます。作業を
  開始してよろしいでしょうか？