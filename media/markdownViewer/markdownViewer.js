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
      // 選択状態を更新
      document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      
      if (file.isDirectory) {
        // ディレクトリの場合は、そのディレクトリ内容を表示
        navigateToDirectory(file.path);
      } else {
        // ファイルの場合は、ファイル内容を表示
        openFile(file.path);
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

  // マークダウンをHTMLに変換（シンプルな実装）
  function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // コードブロックをテンポラリに置換
    const codeBlocks = [];
    let html = markdown.replace(/```(?:(\w+))?\n([\s\S]*?)```/g, (match, language, code) => {
      const id = `CODE_BLOCK_${codeBlocks.length}`;
      codeBlocks.push({ language, code });
      return id;
    });
    
    // 見出し処理
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // インラインコード処理
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 太字処理
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体処理
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // リスト処理
    let inList = false;
    const lines = html.split('\n');
    let result = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          result += '<ul>\n';
          inList = true;
        }
        result += `<li>${line.substring(2)}</li>\n`;
      } else if (/^\d+\.\s/.test(line)) {
        if (!inList) {
          result += '<ol>\n';
          inList = true;
        }
        result += `<li>${line.substring(line.indexOf('.') + 2)}</li>\n`;
      } else if (line === '') {
        if (inList) {
          result += inList === 'ul' ? '</ul>\n\n' : '</ol>\n\n';
          inList = false;
        } else {
          result += '<p></p>\n';
        }
      } else if (line.startsWith('> ')) {
        result += `<blockquote>${line.substring(2)}</blockquote>\n`;
      } else if (!line.startsWith('<') && line !== '') {
        if (inList) {
          result += inList === 'ul' ? '</ul>\n\n' : '</ol>\n\n';
          inList = false;
        }
        result += `<p>${line}</p>\n`;
      } else {
        result += line + '\n';
      }
    }
    
    if (inList) {
      result += inList === 'ul' ? '</ul>\n' : '</ol>\n';
    }
    
    // コードブロックを元に戻す
    codeBlocks.forEach((block, index) => {
      const id = `CODE_BLOCK_${index}`;
      const language = block.language ? ` class="language-${block.language}"` : '';
      const highlightedCode = escapeHtml(block.code.trim());
      result = result.replace(id, `<pre><code${language}>${highlightedCode}</code></pre>`);
    });
    
    return result;
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
        
        // 対応するファイルリストアイテムをアクティブに
        const fileItems = document.querySelectorAll('.file-item');
        fileItems.forEach(item => {
          const text = item.querySelector('.file-item-text').textContent;
          if (message.filePath.endsWith(text)) {
            document.querySelectorAll('.file-item.active').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
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