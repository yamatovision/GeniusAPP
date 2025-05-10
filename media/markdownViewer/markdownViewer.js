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

  // 現在のフォルダパス
  let currentPath = '';

  // 状態管理
  let state = {
    files: [],
    currentFilePath: '',
    currentContent: '',
    fileType: ''
  };

  // 初期状態を復元
  const previousState = vscode.getState();
  if (previousState) {
    state = previousState;
    renderFileList(state.files);
    if (state.currentContent) {
      renderContent(state.currentContent, state.fileType);
      currentFilePath.textContent = state.currentFilePath;
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

    // 初期ファイルリストを要求
    vscode.postMessage({ command: 'refreshFileList' });
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
    if (file.path === state.currentFilePath) {
      item.classList.add('active');
    }
    
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
      // ファイルを開くだけで選択状態は一時的にのみ表示し、すぐに解除する
      if (file.isDirectory) {
        // ディレクトリの場合は、そのディレクトリ内容を表示
        navigateToDirectory(file.path);
      } else {
        // 一時的に選択状態を表示
        document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        // ファイルの場合は、ファイル内容を表示
        openFile(file.path);

        // 選択状態を短い時間で解除（モックアップギャラリーと同様の動作）
        setTimeout(() => {
          item.classList.remove('active');
        }, 300);
      }
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
    
    // 現在のファイルパスを更新
    state.currentFilePath = filePath;
    currentFilePath.textContent = filePath;
    vscode.setState(state);
  }

  // コンテンツを描画
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
    
    // 状態を更新
    state.currentContent = content;
    state.fileType = fileType;
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
        vscode.setState(state);
        break;
        
      case 'updateFileContent':
      case 'updateMarkdownContent':
        renderContent(message.content, message.fileType);
        state.currentFilePath = message.filePath;
        currentFilePath.textContent = message.filePath;
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