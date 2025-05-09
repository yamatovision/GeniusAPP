// @ts-check

/**
 * マークダウンビューア用のフロントエンドロジック
 * VSCodeのWebViewと連携してファイルシステムの表示とマークダウンレンダリングを行う
 */
(function() {
  // VSCodeのAPIを取得
  const vscode = acquireVsCodeApi();
  
  // 要素への参照
  const fileList = document.getElementById('file-list');
  const currentPath = document.getElementById('current-path');
  const markdownContent = document.getElementById('markdown-content');
  const currentFile = document.getElementById('current-file');
  const refreshButton = document.getElementById('refresh-button');
  const editButton = document.getElementById('edit-button');
  
  // 現在のディレクトリパス
  let currentDirectory = '';
  
  // 初期化処理
  function initialize() {
    // メッセージハンドラを設定
    window.addEventListener('message', handleVSCodeMessage);
    
    // 更新ボタンのイベントリスナー
    refreshButton.addEventListener('click', () => {
      requestDirectory(currentDirectory);
    });
    
    // 編集ボタンのイベントリスナー
    editButton.addEventListener('click', () => {
      const filePath = getCurrentFilePath();
      if (filePath) {
        openInEditor(filePath);
      } else {
        showError('ファイルが選択されていません');
      }
    });
    
    // 状態を復元
    const state = vscode.getState();
    if (state && state.currentDirectory) {
      requestDirectory(state.currentDirectory);
    } else {
      // 初期ディレクトリを要求
      vscode.postMessage({ command: 'getDirectory' });
    }
  }
  
  // 現在表示中のファイルパスを取得
  function getCurrentFilePath() {
    const fileName = currentFile.textContent;
    if (fileName === 'マークダウンビューア') {
      return null;
    }
    
    if (currentDirectory && fileName) {
      return `${currentDirectory}/${fileName}`;
    }
    
    return null;
  }
  
  // VSCodeからのメッセージを処理
  function handleVSCodeMessage(event) {
    const message = event.data;
    
    switch (message.command) {
      case 'updateFileList':
        displayFileList(message.files, message.currentPath);
        break;
      case 'showFile':
        displayMarkdown(message.content, message.fileName, message.filePath);
        break;
      case 'error':
        showError(message.message);
        break;
    }
  }
  
  // ファイル一覧を表示
  function displayFileList(files, path) {
    currentDirectory = path;
    
    // 状態を保存
    vscode.setState({ currentDirectory: path });
    
    // パス表示を更新
    updatePathDisplay(path);
    
    // ファイルリストをクリア
    fileList.innerHTML = '';
    
    // 親ディレクトリへの参照を追加（ルートでない場合）
    if (path !== '/' && !path.endsWith(':/')) {
      const parentDir = getParentDirectory(path);
      if (parentDir !== path) {
        const parentElement = createDirectoryElement('..', parentDir);
        fileList.appendChild(parentElement);
      }
    }
    
    // ディレクトリとファイルを表示
    if (files && files.length > 0) {
      files.forEach(file => {
        let element;
        if (file.isDirectory) {
          element = createDirectoryElement(file.name, file.path);
        } else if (file.name.endsWith('.md')) {
          element = createMarkdownFileElement(file.name, file.path);
        } else {
          element = createOtherFileElement(file.name, file.path);
        }
        fileList.appendChild(element);
      });
    } else {
      // ファイルが見つからない場合
      const emptyElement = document.createElement('div');
      emptyElement.className = 'empty-directory';
      emptyElement.textContent = 'ファイルが見つかりません';
      fileList.appendChild(emptyElement);
    }
  }
  
  // 親ディレクトリのパスを取得
  function getParentDirectory(path) {
    // Windows形式のパスを考慮（C:\\path\\to\\dir）
    if (path.includes('\\')) {
      const segments = path.split('\\');
      // ルートディレクトリの場合（例: C:\\）
      if (segments.length <= 1 || (segments.length === 2 && segments[1] === '')) {
        return path;
      }
      return segments.slice(0, -1).join('\\');
    }
    
    // Unix形式のパス
    const segments = path.split('/');
    
    // ルートディレクトリの場合
    if (segments.length <= 2) {
      return '/';
    }
    
    return segments.slice(0, -1).join('/') || '/';
  }
  
  // ディレクトリ要素を作成
  function createDirectoryElement(name, path) {
    const element = document.createElement('div');
    element.className = 'file-item directory';
    element.innerHTML = `
      <span class="file-item-icon folder">📁</span>
      <span class="file-item-text">${name}</span>
    `;
    
    element.addEventListener('click', () => {
      requestDirectory(path);
    });
    
    return element;
  }
  
  // マークダウンファイル要素を作成
  function createMarkdownFileElement(name, path) {
    const element = document.createElement('div');
    element.className = 'file-item markdown';
    element.innerHTML = `
      <span class="file-item-icon markdown">📄</span>
      <span class="file-item-text">${name}</span>
    `;
    
    element.addEventListener('click', () => {
      requestFile(path);
    });
    
    return element;
  }
  
  // その他のファイル要素を作成
  function createOtherFileElement(name, path) {
    const element = document.createElement('div');
    element.className = 'file-item';
    element.innerHTML = `
      <span class="file-item-icon">📄</span>
      <span class="file-item-text">${name}</span>
    `;
    
    element.addEventListener('click', () => {
      openInEditor(path);
    });
    
    return element;
  }
  
  // ディレクトリを要求
  function requestDirectory(path) {
    vscode.postMessage({
      command: 'getDirectory',
      path: path
    });
  }
  
  // ファイルを要求
  function requestFile(path) {
    vscode.postMessage({
      command: 'openFile',
      path: path
    });
  }
  
  // エディタでファイルを開く
  function openInEditor(path) {
    vscode.postMessage({
      command: 'openInEditor',
      path: path
    });
  }
  
  // マークダウンを表示
  function displayMarkdown(content, fileName, filePath) {
    // ファイル名を表示
    currentFile.textContent = fileName;
    
    // マークダウンをHTMLに変換
    let html;
    
    // simpleMarkdownConverterが読み込まれているか確認
    if (window.simpleMarkdownConverter && typeof window.simpleMarkdownConverter.convertMarkdownToHtml === 'function') {
      html = window.simpleMarkdownConverter.convertMarkdownToHtml(content);
    } else {
      // フォールバックとして内部の簡易変換関数を使用
      html = convertMarkdownToHtml(content);
    }
    
    // 内容を表示
    markdownContent.innerHTML = html;
    
    // ファイルパスを設定
    markdownContent.setAttribute('data-file-path', filePath);
    
    // チェックボックスの処理を設定
    setupCheckboxes();
  }
  
  // チェックボックスにイベントリスナーを設定
  function setupCheckboxes() {
    document.querySelectorAll('.markdown-content input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', e => {
        // チェックボックスの状態変更を通知
        vscode.postMessage({
          command: 'updateCheckbox',
          checked: e.target.checked,
          filePath: markdownContent.getAttribute('data-file-path')
        });
      });
    });
  }
  
  // パス表示を更新
  function updatePathDisplay(path) {
    // パスセグメントに分割して表示
    currentPath.innerHTML = '';
    
    // Windowsパスの場合は特別処理
    if (path.includes('\\')) {
      const segments = path.split('\\').filter(segment => segment);
      
      let currentPathAcc = '';
      segments.forEach((segment, index) => {
        // 最初のセグメントはドライブレターの場合がある
        if (index === 0 && segment.endsWith(':')) {
          const driveElement = document.createElement('span');
          driveElement.className = 'breadcrumb-item clickable';
          driveElement.textContent = segment + '\\';
          driveElement.addEventListener('click', () => {
            requestDirectory(segment + '\\');
          });
          currentPath.appendChild(driveElement);
          currentPathAcc = segment + '\\';
        } else {
          // セパレータ
          if (index > 0 || (index === 0 && !segments[0].endsWith(':'))) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '\\';
            currentPath.appendChild(separator);
          }
          
          // パスセグメント
          currentPathAcc += (index === 0 ? '' : '\\') + segment;
          const segmentElement = document.createElement('span');
          segmentElement.className = 'breadcrumb-item' + (index === segments.length - 1 ? '' : ' clickable');
          segmentElement.textContent = segment;
          
          // 最後のセグメント以外はクリック可能に
          if (index < segments.length - 1) {
            const pathToUse = currentPathAcc;
            segmentElement.addEventListener('click', () => {
              requestDirectory(pathToUse);
            });
          }
          
          currentPath.appendChild(segmentElement);
        }
      });
      return;
    }
    
    // Unixパスの処理
    const segments = path.split('/').filter(segment => segment);
    
    // ルートディレクトリ
    const rootElement = document.createElement('span');
    rootElement.className = 'breadcrumb-item clickable';
    rootElement.textContent = '/';
    rootElement.addEventListener('click', () => {
      requestDirectory('/');
    });
    currentPath.appendChild(rootElement);
    
    // 各セグメントを表示
    let currentPathAcc = '';
    segments.forEach((segment, index) => {
      // セパレータ
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '/';
      currentPath.appendChild(separator);
      
      // パスセグメント
      currentPathAcc += '/' + segment;
      const segmentElement = document.createElement('span');
      segmentElement.className = 'breadcrumb-item' + (index === segments.length - 1 ? '' : ' clickable');
      segmentElement.textContent = segment;
      
      // 最後のセグメント以外はクリック可能に
      if (index < segments.length - 1) {
        const pathToUse = currentPathAcc;
        segmentElement.addEventListener('click', () => {
          requestDirectory(pathToUse);
        });
      }
      
      currentPath.appendChild(segmentElement);
    });
  }
  
  // エラーを表示
  function showError(message) {
    // 既存のエラーメッセージを削除
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(err => {
      if (err.parentNode) {
        err.parentNode.removeChild(err);
      }
    });
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    document.body.appendChild(errorElement);
    
    // 5秒後に消去
    setTimeout(() => {
      errorElement.classList.add('fade-out');
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement);
        }
      }, 500);
    }, 5000);
  }
  
  // マークダウンの簡易変換関数（シンプルマークダウンコンバーターのバックアップ）
  function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // HTMLエスケープ
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // 基本的なマークダウン変換
    let html = escaped
      // 見出し
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
      .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
      
      // リスト
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^* (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.+<\/li>\n)+/gs, '<ul>$&</ul>')
      
      // 番号付きリスト
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.+<\/li>\n)+/gs, '<ul>$&</ul>')
      
      // 強調
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      
      // リンク
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      
      // コードブロック
      .replace(/```([^`]+)```/gs, '<pre><code>$1</code></pre>')
      
      // インラインコード
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // チェックボックス
      .replace(/\[ \]/g, '<input type="checkbox">')
      .replace(/\[x\]/g, '<input type="checkbox" checked>');
    
    // 段落処理
    const lines = html.split('\n');
    let result = '';
    let inList = false;
    
    lines.forEach(line => {
      if (line.trim() === '') {
        if (!inList) {
          result += '<br>';
        }
      } else if (line.startsWith('<li>')) {
        if (!inList) {
          inList = true;
        }
        result += line;
      } else {
        if (inList) {
          inList = false;
        }
        if (!line.startsWith('<')) {
          result += '<p>' + line + '</p>';
        } else {
          result += line;
        }
      }
    });
    
    return result;
  }
  
  // DOMContentLoadedイベントで初期化
  document.addEventListener('DOMContentLoaded', initialize);
})();