// マークダウンビューワー用スクリプト
(function() {
  'use strict';

  // VSCodeのWebViewパネル
  const vscode = acquireVsCodeApi();

  // DOM要素の取得
  const filePanel = document.getElementById('filePanel');
  const toggleFilePanel = document.getElementById('toggleFilePanel');
  const fileList = document.getElementById('fileList');
  const fileFilter = document.getElementById('fileFilter');
  const currentFilePath = document.getElementById('currentFilePath');
  const markdownContent = document.getElementById('markdownContent');
  const refreshButton = document.getElementById('refreshButton');
  const editButton = document.getElementById('editButton');
  const splitViewButton = document.getElementById('splitViewButton');
  const singleViewContainer = document.getElementById('singleViewContainer');
  const splitViewContainer = document.getElementById('splitViewContainer');
  const leftMarkdownContent = document.getElementById('leftMarkdownContent');
  const rightMarkdownContent = document.getElementById('rightMarkdownContent');
  const leftPaneFilePath = document.getElementById('leftPaneFilePath');
  const rightPaneFilePath = document.getElementById('rightPaneFilePath');
  const leftPaneRefreshButton = document.getElementById('leftPaneRefreshButton');
  const leftPaneEditButton = document.getElementById('leftPaneEditButton');
  const rightPaneRefreshButton = document.getElementById('rightPaneRefreshButton');
  const rightPaneEditButton = document.getElementById('rightPaneEditButton');
  const paneResizer = document.getElementById('paneResizer');

  // 現在のフォルダパス
  let currentPath = '';

  // 状態管理
  let state = {
    files: [],
    currentFilePath: '', // ファイルパスは保存するが、UI上の選択表示には使わない
    currentContent: '',
    fileType: '',
    isSplitView: false,
    leftPane: {
      filePath: '',
      content: '',
      fileType: ''
    },
    rightPane: {
      filePath: '',
      content: '',
      fileType: ''
    }
  };

  // 初期状態を復元するが、ファイル選択状態は復元しない
  const previousState = vscode.getState();
  if (previousState) {
    state = {
      ...previousState,
      // ファイル選択状態をリセット
      selectedFilePath: '' // 選択状態は保持しない
    };
    renderFileList(state.files);
    
    // 分割表示の状態を復元
    if (state.isSplitView) {
      activateSplitView();
      
      // 左右のペインコンテンツを復元
      if (state.leftPane.content) {
        renderPaneContent('left', state.leftPane.content, state.leftPane.fileType);
        leftPaneFilePath.textContent = state.leftPane.filePath;
      }
      
      if (state.rightPane.content) {
        renderPaneContent('right', state.rightPane.content, state.rightPane.fileType);
        rightPaneFilePath.textContent = state.rightPane.filePath;
      }
    } else {
      // 通常モードでコンテンツを復元
      if (state.currentContent) {
        renderContent(state.currentContent, state.fileType);
        currentFilePath.textContent = state.currentFilePath;
      }
    }
  }

  // イベントリスナーを設定
  function init() {
    // ファイルパネルの開閉
    toggleFilePanel.addEventListener('click', () => {
      filePanel.classList.toggle('collapsed');
      
      // アイコンの向きを変更
      const icon = toggleFilePanel.querySelector('.material-icons');
      if (filePanel.classList.contains('collapsed')) {
        icon.textContent = 'chevron_right';
      } else {
        icon.textContent = 'chevron_left';
      }
    });

    // ファイル検索フィルタリング
    fileFilter.addEventListener('input', () => {
      filterFileList();
    });

    // 更新ボタン
    refreshButton.addEventListener('click', () => {
      vscode.postMessage({ command: 'refreshContent' });
    });

    // 編集ボタン
    editButton.addEventListener('click', () => {
      if (state.currentFilePath) {
        vscode.postMessage({ 
          command: 'openFileInEditor',
          filePath: state.currentFilePath
        });
      }
    });

    // 分割表示ボタン
    splitViewButton.addEventListener('click', () => {
      toggleSplitView();
    });

    // 左ペインの更新ボタン
    leftPaneRefreshButton.addEventListener('click', () => {
      if (state.leftPane.filePath) {
        vscode.postMessage({
          command: 'readFile',
          filePath: state.leftPane.filePath,
          pane: 'left'
        });
      }
    });

    // 左ペインの編集ボタン
    leftPaneEditButton.addEventListener('click', () => {
      if (state.leftPane.filePath) {
        vscode.postMessage({
          command: 'openFileInEditor',
          filePath: state.leftPane.filePath
        });
      }
    });

    // 右ペインの更新ボタン
    rightPaneRefreshButton.addEventListener('click', () => {
      if (state.rightPane.filePath) {
        vscode.postMessage({
          command: 'readFile',
          filePath: state.rightPane.filePath,
          pane: 'right'
        });
      }
    });

    // 右ペインの編集ボタン
    rightPaneEditButton.addEventListener('click', () => {
      if (state.rightPane.filePath) {
        vscode.postMessage({
          command: 'openFileInEditor',
          filePath: state.rightPane.filePath
        });
      }
    });

    // リサイザーの初期化
    initializeResizer();

    // 初期ファイルリストを要求
    vscode.postMessage({ command: 'refreshFileList' });
  }

  // 分割表示の切り替え
  function toggleSplitView() {
    if (!state.isSplitView) {
      // 通常モード → 分割モードへ
      state.isSplitView = true;
      splitViewButton.classList.add('active');

      // 現在表示中のファイルを左ペインにセット
      if (state.currentFilePath) {
        state.leftPane.filePath = state.currentFilePath;
        state.leftPane.content = state.currentContent;
        state.leftPane.fileType = state.fileType;

        // 左ペインのファイルパス表示を更新
        leftPaneFilePath.textContent = state.currentFilePath;
      }

      // 分割モードを有効化
      activateSplitView();

      // 左ペインを表示
      renderPaneContent('left', state.leftPane.content, state.leftPane.fileType);
    } else {
      // 分割モード → 通常モードへ
      showPaneSelectDialog();
    }
  }

  // 分割モードへの切り替え
  function activateSplitView() {
    singleViewContainer.classList.remove('active');
    splitViewContainer.classList.add('active');
  }

  // 通常モードへの切り替え
  function activateSingleView(selectedPane) {
    // 選択されたペインの内容を通常モードで表示
    const paneData = selectedPane === 'left' ? state.leftPane : state.rightPane;
    state.currentFilePath = paneData.filePath;
    state.currentContent = paneData.content;
    state.fileType = paneData.fileType;
    state.isSplitView = false;
    splitViewButton.classList.remove('active');

    // コンテナの切り替え
    splitViewContainer.classList.remove('active');
    singleViewContainer.classList.add('active');

    // 内容を表示
    renderContent(state.currentContent, state.fileType);

    // ファイルパス表示を更新
    currentFilePath.textContent = state.currentFilePath;

    // 状態を保存
    vscode.setState(state);
  }

  // どちらのペインを保持するか選択するダイアログ
  function showPaneSelectDialog() {
    vscode.postMessage({
      command: 'showPaneSelectDialog',
      leftFile: state.leftPane.filePath || '未選択',
      rightFile: state.rightPane.filePath || '未選択'
    });
  }

  // リサイザーの初期化
  function initializeResizer() {
    if (!paneResizer) return;

    const leftPane = document.getElementById('leftPane');
    const rightPane = document.getElementById('rightPane');
    const splitContent = document.querySelector('.split-content');

    let x = 0;
    let leftWidth = 0;
    let isDragging = false;

    // マウスダウンイベント
    paneResizer.addEventListener('mousedown', e => {
      x = e.clientX;
      leftWidth = leftPane.offsetWidth;
      isDragging = true;
      paneResizer.classList.add('dragging');

      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
    });

    // リサイズ関数
    function resize(e) {
      if (!isDragging) return;

      const dx = e.clientX - x;
      const newLeftWidth = leftWidth + dx;
      const containerWidth = splitContent.offsetWidth;

      // 最小幅を25%、最大幅を75%に制限
      const minWidth = containerWidth * 0.25;
      const maxWidth = containerWidth * 0.75;

      if (newLeftWidth > minWidth && newLeftWidth < maxWidth) {
        leftPane.style.width = `${newLeftWidth}px`;
        rightPane.style.width = `${containerWidth - newLeftWidth - 8}px`; // 8はリサイザーの幅
      }
    }

    // リサイズ停止
    function stopResize() {
      isDragging = false;
      paneResizer.classList.remove('dragging');
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    }
  }

  // ファイルリストをフィルタリング
  function filterFileList() {
    const filterText = fileFilter.value.toLowerCase();
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
      const fileName = item.querySelector('.file-item-text').textContent.toLowerCase();
      
      if (fileName.includes(filterText)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }

  // ファイルリストを描画
  function renderFileList(files) {
    if (!files || files.length === 0) {
      fileList.innerHTML = '<div class="no-files">ファイルがありません</div>';
      return;
    }

    fileList.innerHTML = '';
    
    // ファイルとフォルダを分類
    const folders = files.filter(file => file.isDirectory);
    const markdownFiles = files.filter(file => !file.isDirectory && file.type === 'markdown');
    const otherFiles = files.filter(file => !file.isDirectory && file.type !== 'markdown');
    
    // 親ディレクトリへのナビゲーション（最初のレベルではない場合）
    if (currentPath) {
      const parentPath = getParentPath(currentPath);
      if (parentPath !== currentPath) {
        const parentItem = document.createElement('li');
        parentItem.className = 'file-item';
        parentItem.innerHTML = `
          <span class="material-icons file-item-icon">arrow_upward</span>
          <span class="file-item-text">..</span>
        `;
        parentItem.addEventListener('click', () => {
          navigateToDirectory(parentPath);
        });
        fileList.appendChild(parentItem);
      }
    }
    
    // フォルダを表示
    folders.forEach(folder => {
      const folderItem = createFileListItem(folder);
      fileList.appendChild(folderItem);
    });
    
    // マークダウンファイルを表示
    markdownFiles.forEach(file => {
      const fileItem = createFileListItem(file);
      fileList.appendChild(fileItem);
    });
    
    // その他のファイルを表示
    otherFiles.forEach(file => {
      const fileItem = createFileListItem(file);
      fileList.appendChild(fileItem);
    });
    
    // 現在のフォルダパスを更新
    currentPath = files.length > 0 ? files[0].parentFolder : '';
  }

  // ファイルリストアイテムを作成
  function createFileListItem(file) {
    const item = document.createElement('li');
    item.className = 'file-item';

    // アイコンを決定
    let iconName = 'insert_drive_file';
    let iconClass = '';
    
    if (file.isDirectory) {
      iconName = 'folder';
      iconClass = 'folder';
    } else {
      switch(file.type) {
        case 'markdown':
          iconName = 'description';
          iconClass = 'markdown';
          break;
        case 'javascript':
          iconName = 'javascript';
          break;
        case 'typescript':
          iconName = 'code';
          break;
        case 'html':
          iconName = 'html';
          break;
        case 'css':
          iconName = 'css';
          break;
        case 'json':
          iconName = 'code';
          break;
        case 'image':
          iconName = 'image';
          break;
        default:
          iconName = 'insert_drive_file';
      }
    }
    
    item.innerHTML = `
      <span class="material-icons file-item-icon ${iconClass}">${iconName}</span>
      <span class="file-item-text">${file.name}</span>
    `;
    
    // クリックイベントを追加
    item.addEventListener('click', () => {
      // 一時的に選択状態を表示
      document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      if (file.isDirectory) {
        // ディレクトリの場合は、そのディレクトリ内容を表示
        navigateToDirectory(file.path);
      } else {
        // 分割モードの場合はどちらのペインで開くか選択
        if (state.isSplitView) {
          vscode.postMessage({
            command: 'showFileOpenMenu',
            filePath: file.path,
            options: ['左ペインで開く', '右ペインで開く']
          });
        } else {
          // 通常モードでは現在のペインにファイルを開く
          openFile(file.path);
        }
      }

      // 選択状態を短い時間で解除
      setTimeout(() => {
        item.classList.remove('active');
      }, 300);
    });
    
    return item;
  }

  // ディレクトリへ移動
  function navigateToDirectory(dirPath) {
    vscode.postMessage({
      command: 'listDirectory',
      path: dirPath
    });
  }

  // ファイルを開く
  function openFile(filePath) {
    vscode.postMessage({
      command: 'readFile',
      filePath: filePath
    });

    // 現在のファイルパスを更新（表示用のみ、選択状態は保持しない）
    state.currentFilePath = filePath;
    currentFilePath.textContent = filePath;

    // 状態を保存するが、UI上の選択状態に影響しないように設計する
    const stateForStorage = {
      ...state,
      // 明示的に選択状態をリセット
      selectedFilePath: ''
    };
    vscode.setState(stateForStorage);
  }

  // 指定したペインにファイルを開く
  function openFileInPane(filePath, pane) {
    vscode.postMessage({
      command: 'readFile',
      filePath: filePath,
      pane: pane
    });
  }

  // コンテンツを描画（通常モード用）
  function renderContent(content, fileType) {
    if (!content) {
      markdownContent.innerHTML = `
        <div class="no-file-selected">
          <span class="material-icons icon">description</span>
          <h2>ファイルが選択されていません</h2>
          <p>左側のファイルブラウザからファイルを選択してください。</p>
        </div>
      `;
      return;
    }

    // コンテンツタイプに応じた描画処理
    if (fileType === 'markdown') {
      // マークダウンをHTMLに変換
      const html = convertMarkdownToHtml(content);
      markdownContent.innerHTML = html;
    } else if (fileType === 'image') {
      // 画像を表示
      markdownContent.innerHTML = `<img src="data:image;base64,${content}" class="image-preview">`;
    } else {
      // コードとしてそのまま表示
      markdownContent.innerHTML = `<pre><code>${escapeHtml(content)}</code></pre>`;
    }

    // 状態を更新（内容とタイプは保存するが、選択状態を保持しない）
    state.currentContent = content;
    state.fileType = fileType;

    // 状態を保存するが、UI上の選択状態に影響しないように設計する
    const stateForStorage = {
      ...state,
      // 明示的に選択状態をリセット
      selectedFilePath: ''
    };
    vscode.setState(stateForStorage);
  }

  // ペインのコンテンツを描画（分割モード用）
  function renderPaneContent(pane, content, fileType) {
    const contentElement = pane === 'left' ? leftMarkdownContent : rightMarkdownContent;
    
    if (!content) {
      contentElement.innerHTML = `
        <div class="no-file-selected">
          <span class="material-icons icon">description</span>
          <h2>ファイルが選択されていません</h2>
          <p>左側のファイルブラウザからファイルを選択してください。</p>
        </div>
      `;
      return;
    }

    // コンテンツタイプに応じた描画処理
    if (fileType === 'markdown') {
      // マークダウンをHTMLに変換
      const html = convertMarkdownToHtml(content);
      contentElement.innerHTML = html;
    } else if (fileType === 'image') {
      // 画像を表示
      contentElement.innerHTML = `<img src="data:image;base64,${content}" class="image-preview">`;
    } else {
      // コードとしてそのまま表示
      contentElement.innerHTML = `<pre><code>${escapeHtml(content)}</code></pre>`;
    }

    // 状態を更新
    if (pane === 'left') {
      state.leftPane.content = content;
      state.leftPane.fileType = fileType;
    } else {
      state.rightPane.content = content;
      state.rightPane.fileType = fileType;
    }

    // 状態を保存
    vscode.setState(state);
  }

  // 親ディレクトリのパスを取得
  function getParentPath(path) {
    const parts = path.split(/[/\\]/);
    return parts.slice(0, -1).join('/');
  }

  // HTMLをエスケープ
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // スコープマネージャーで使用されている変換関数を使用
  function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';

    // コードブロックとテーブルを一時的に置き換え
    const codeBlocks = [];
    const tables = [];

    // コードブロックを保護
    let html = markdown.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `CODE_BLOCK_${codeBlocks.length}`;
      codeBlocks.push(code);
      return id;
    });

    // テーブルを保護
    html = html.replace(/\|(.+)\|\s*\n\|(?:[-:]+\|)+\s*\n(\|(?:.+)\|\s*\n)+/g, (match) => {
      const id = `TABLE_BLOCK_${tables.length}`;
      tables.push(match);
      return id;
    });

    // マークダウン要素の変換
    // 見出し処理 - インラインスタイルを使用
    html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:1.1em; margin-top:0.7em; margin-bottom:0.3em; font-weight:600; color:#569CD6;">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.2em; margin-top:0.8em; margin-bottom:0.4em; font-weight:600; color:#569CD6;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.5em; margin-top:1em; margin-bottom:0.5em; font-weight:600; border-bottom:1px solid var(--vscode-panel-border); padding-bottom:0.3em; color:#569CD6;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:2em; margin-top:1.2em; margin-bottom:0.6em; font-weight:600; border-bottom:1px solid var(--vscode-panel-border); padding-bottom:0.3em; color:#569CD6;">$1</h1>');

    // インラインコード処理 - インラインスタイルを使用
    html = html.replace(/`([^`]+)`/g, '<code style="font-family:var(--vscode-editor-font-family,monospace); background-color:#1E1E1E; color:#FFFFFF; padding:0.2em 0.4em; border-radius:3px; font-size:0.85em; border:1px solid #3E3E3E;">$1</code>');

    // 太字処理
    const boldPattern = /\*\*(.*?)\*\*/g;

    // 太字処理 - インラインスタイルを使用して適切なスタイリング
    html = html.replace(boldPattern, (match, content) => {
      return `<span style="font-weight:700; color:#003366;">${content}</span>`;
    });

    // チェックボックス処理 - シンプルにチェックボックス部分だけを置換
    html = html.replace(/\[x\]/g, '<input type="checkbox" checked>');
    html = html.replace(/\[ \]/g, '<input type="checkbox">');

    // 段落処理 - divタグを使用して間隔を調整
    const lines = html.split('\n');
    let result = '';
    let previousLine = ''; // 直前の行を記録

    for (const line of lines) {
      if (line.trim() === '') {
        // 見出し後の空行は無視（過剰なスペースを防ぐ）
        const isAfterHeading = previousLine.match(/<h[1-6]>.*<\/h[1-6]>/);
        if (!isAfterHeading) {
          // 見出し以外の後の空行は<br>タグに変換
          result += '<br>\n';
        }
        continue;
      }

      if (line.startsWith('<')) {
        result += line + '\n';  // HTMLタグの場合はそのまま + 改行追加
      } else {
        result += '<div class="md-line">' + line + '</div>\n';  // divタグで囲む + 改行追加
      }

      previousLine = line; // 現在の行を記録
    }

    // コードブロックの復元 - インラインスタイルを使用
    result = result.replace(/CODE_BLOCK_(\d+)/g, (match, index) => {
      return `<pre style="background-color:#1E1E1E; padding:16px; border-radius:6px; overflow-x:auto; margin:1em 0; border:1px solid #3E3E3E; box-shadow:0 2px 8px rgba(0,0,0,0.15);"><code style="background-color:transparent; padding:0; color:#E0E0E0; display:block; line-height:1.5;">${codeBlocks[Number(index)]}</code></pre>`;
    });

    // テーブルの復元
    result = result.replace(/TABLE_BLOCK_(\d+)/g, (match, index) => {
      return renderTable(tables[Number(index)]);
    });

    return result;
  }

  // テーブル描画用のヘルパー関数
  function renderTable(tableText) {
    try {
      const lines = tableText.trim().split('\n');
      if (lines.length < 3) return tableText;

      // ヘッダー行を処理
      const headerRow = lines[0];
      const headers = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell !== '');

      // 配置情報を処理
      const alignmentRow = lines[1];
      const alignments = alignmentRow.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });

      // テーブル構築
      let html = '<table class="md-table">\n<thead>\n<tr>\n';

      // ヘッダー行
      headers.forEach((header, i) => {
        const align = alignments[i] || 'left';
        html += `<th style="text-align: ${align}">${header}</th>\n`;
      });

      html += '</tr>\n</thead>\n<tbody>\n';

      // データ行
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        if (cells.length === 0) continue;

        html += '<tr>\n';
        cells.forEach((cell, j) => {
          const align = alignments[j] || 'left';
          html += `<td style="text-align: ${align}">${cell}</td>\n`;
        });
        html += '</tr>\n';
      }

      html += '</tbody>\n</table>';
      return html;
    } catch {
      return tableText;
    }
  }

  // VScodeからのメッセージを処理
  window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
      case 'updateFileList':
        renderFileList(message.files);
        state.files = message.files;
        // 選択状態をリセットした状態で保存
        const stateForStorageAfterFileList = {
          ...state,
          selectedFilePath: ''
        };
        vscode.setState(stateForStorageAfterFileList);
        break;

      case 'updateFileContent':
      case 'updateMarkdownContent':
        if (state.isSplitView) {
          // ペインが指定されている場合は、指定されたペインに表示
          if (message.pane) {
            renderPaneContent(message.pane, message.content, message.fileType);
            if (message.pane === 'left') {
              state.leftPane.filePath = message.filePath;
              leftPaneFilePath.textContent = message.filePath;
            } else {
              state.rightPane.filePath = message.filePath;
              rightPaneFilePath.textContent = message.filePath;
            }
          } else {
            // ペインが指定されていない場合は、左ペインに表示
            renderPaneContent('left', message.content, message.fileType);
            state.leftPane.filePath = message.filePath;
            leftPaneFilePath.textContent = message.filePath;
          }
        } else {
          // 通常モードの場合
          renderContent(message.content, message.fileType);
          state.currentFilePath = message.filePath;
          currentFilePath.textContent = message.filePath;
        }
        vscode.setState(state);

        // ファイルリストアイテムの選択状態を変更しない（モックアップギャラリーと同様の動作）
        // モックアップギャラリーのように一時的な視覚的フィードバックのみにする
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
          const text = item.querySelector('.file-item-text').textContent;
          if (message.filePath.endsWith(text)) {
            // 一時的なハイライト効果
            item.classList.add('highlight-briefly');
            setTimeout(() => {
              item.classList.remove('highlight-briefly');
            }, 500);
          }
        });
        break;
        
      case 'updatePaneContent':
        // 特定のペインのコンテンツを更新
        renderPaneContent(message.pane, message.content, message.fileType);
        if (message.pane === 'left') {
          state.leftPane.filePath = message.filePath;
          leftPaneFilePath.textContent = message.filePath;
        } else {
          state.rightPane.filePath = message.filePath;
          rightPaneFilePath.textContent = message.filePath;
        }
        vscode.setState(state);
        break;

      case 'fileOpenMenuResult':
        // ファイル選択メニューの結果を処理
        if (message.option === '左ペインで開く') {
          openFileInPane(message.filePath, 'left');
        } else if (message.option === '右ペインで開く') {
          openFileInPane(message.filePath, 'right');
        }
        break;

      case 'paneSelectResult':
        // ペイン選択ダイアログの結果を処理
        activateSingleView(message.pane);
        break;

      case 'showError':
        alert(message.message);
        break;
        
      case 'startLoading':
        fileList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        break;
    }
  });

  // 初期化を実行
  init();
})();