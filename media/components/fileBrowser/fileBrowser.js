// @ts-check

/**
 * ファイルブラウザコンポーネント
 * Webview内でdocsディレクトリ内のファイルをブラウズするためのUIを提供
 */
class FileBrowser {
  constructor() {
    this.currentPath = null;
    this.selectedFile = null;
    this.fileList = [];
    this.expandedFolders = new Set();
    this.isInitialized = false;
    
    // VSCode APIの取得
    this.vscode = window.vsCodeApi;
  }
  
  /**
   * クライアント側のUIのみを準備（サーバー側の初期化を待つ）
   */
  prepareUI() {
    if (this.isInitialized) return;
    
    // DOM要素の取得
    this.container = document.getElementById('file-browser-container');
    this.fileListElement = document.getElementById('file-list');
    this.breadcrumbElement = document.getElementById('file-breadcrumb');
    this.previewElement = document.getElementById('file-preview');
    this.refreshButton = document.getElementById('refresh-file-browser');
    
    if (!this.container || !this.fileListElement) {
      console.error('FileBrowser: 必要なDOM要素が見つかりません');
      return;
    }
    
    // イベントリスナーのセットアップ
    this._setupEventListeners();
    
    // 初期化完了フラグを設定
    this.isInitialized = true;
    
    console.log('FileBrowser: UIの準備完了（サーバー側からの初期化を待機します）');
  }
  
  /**
   * 従来の初期化メソッド（後方互換性のため残しておく）
   * @deprecated prepareUIを使用してください
   */
  initialize() {
    console.warn('FileBrowser: 非推奨のinitializeメソッドが呼び出されました。代わりにprepareUIを使用してください');
    this.prepareUI();
    
    // 安全のため初期リクエストは送信しない
    console.log('FileBrowser: サーバー側の初期化を待機します');
  }
  
  /**
   * イベントリスナーのセットアップ
   */
  _setupEventListeners() {
    // カスタムイベントリスナー
    document.addEventListener('file-browser-updated', (event) => {
      this.updateFileList(event.detail.files);
    });
    
    // 更新ボタンのクリックイベント
    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => {
        this._requestDirectoryListing();
      });
    }
    
    // VSCodeからのメッセージハンドリング
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      switch (message.command) {
        case 'updateFileList':
          this.updateFileList(message.files);
          break;
        case 'updateFilePreview':
          this.updateFilePreview(message.content, message.filePath);
          break;
      }
    });
  }
  
  /**
   * ディレクトリリストの要求をVSCodeに送信
   * @param {string} path 表示するディレクトリパス（省略時は現在のプロジェクトのdocsディレクトリ）
   */
  _requestDirectoryListing(path) {
    // パスが指定されていない場合は現在のパスを使用
    const directoryPath = path || this.currentPath || null;
    
    this.vscode.postMessage({
      command: 'listDirectory',
      path: directoryPath
    });
  }
  
  /**
   * ファイルリストを更新
   * @param {Array} files ファイルとディレクトリの配列
   */
  updateFileList(files) {
    if (!this.fileListElement) return;
    
    // ファイルリストを保存
    this.fileList = files || [];
    
    // 表示をクリア
    this.fileListElement.innerHTML = '';
    
    // ファイルが0件の場合
    if (!files || files.length === 0) {
      this.fileListElement.innerHTML = '<div class="empty-state">ファイルが見つかりません</div>';
      return;
    }
    
    // カレントディレクトリを保存
    if (files.length > 0 && files[0].parentFolder) {
      this.currentPath = files[0].parentFolder;
      
      // パンくずリストを更新
      this._updateBreadcrumb(this.currentPath);
    }
    
    // ファイルとディレクトリをリストに表示
    files.forEach(file => {
      const fileItem = this._createFileItem(file);
      this.fileListElement.appendChild(fileItem);
      
      // ディレクトリが展開されている場合は子要素も表示
      if (file.isDirectory && file.children && this.expandedFolders.has(file.path)) {
        const subList = document.createElement('div');
        subList.className = 'sub-file-list';
        
        file.children.forEach(child => {
          const childItem = this._createFileItem(child);
          subList.appendChild(childItem);
        });
        
        this.fileListElement.appendChild(subList);
      }
    });
  }
  
  /**
   * ファイルプレビューを更新
   * @param {string} content ファイルの内容
   * @param {string} filePath ファイルパス
   */
  updateFilePreview(content, filePath) {
    if (!this.previewElement) return;
    
    // ファイルパスから名前を取得
    const fileName = filePath.split('/').pop();
    
    // プレビューヘッダーの更新
    const previewHeader = document.createElement('div');
    previewHeader.className = 'preview-header';
    previewHeader.innerHTML = `
      <span class="preview-file-name">${fileName}</span>
      <button class="button-primary" id="open-in-editor">エディタで開く</button>
    `;
    
    // プレビューコンテンツの更新
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-content';
    
    // ファイル種別に応じた表示の変更
    if (filePath.endsWith('.md')) {
      // マークダウンの場合、シンプルな変換を行う
      previewContent.innerHTML = this._simpleMarkdownToHtml(content);
      previewContent.className += ' markdown-preview';
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
      // 画像ファイルの場合、img要素を表示
      previewContent.innerHTML = `<img src="vscode-resource:${filePath}" alt="${fileName}" style="max-width: 100%; max-height: 300px;">`;
    } else {
      // テキストファイルの場合、preタグでコード表示
      previewContent.innerHTML = `<pre>${this._escapeHtml(content)}</pre>`;
      previewContent.className += ' code-preview';
    }
    
    // プレビュー領域をクリアして新しい内容を表示
    this.previewElement.innerHTML = '';
    this.previewElement.appendChild(previewHeader);
    this.previewElement.appendChild(previewContent);
    
    // 「エディタで開く」ボタンのイベントリスナー
    const openButton = document.getElementById('open-in-editor');
    if (openButton) {
      openButton.addEventListener('click', () => {
        this.vscode.postMessage({
          command: 'openFileInEditor',
          filePath: filePath
        });
      });
    }
    
    // 選択されたファイルを保存
    this.selectedFile = filePath;
  }
  
  /**
   * パンくずリストを更新
   * @param {string} path 現在のディレクトリパス
   */
  _updateBreadcrumb(path) {
    if (!this.breadcrumbElement || !path) return;
    
    // パンくずリストをクリア
    this.breadcrumbElement.innerHTML = '';
    
    // パスをセグメントに分割
    const segments = path.split('/');
    let currentPath = '';
    
    // ホームリンク（ルート）を追加
    const homeLink = document.createElement('span');
    homeLink.className = 'breadcrumb-item';
    homeLink.innerHTML = '<i class="material-icons">home</i>';
    homeLink.addEventListener('click', () => {
      this._requestDirectoryListing(null); // ルートディレクトリの表示
    });
    this.breadcrumbElement.appendChild(homeLink);
    
    // セパレータを追加
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '/';
    this.breadcrumbElement.appendChild(separator.cloneNode(true));
    
    // 各セグメントに対応するリンクを作成
    segments.forEach((segment, index) => {
      if (!segment) return; // 空のセグメントはスキップ
      
      currentPath += '/' + segment;
      
      const link = document.createElement('span');
      link.className = 'breadcrumb-item';
      link.textContent = segment;
      link.title = currentPath;
      
      // 最終セグメント以外はクリック可能にする
      if (index < segments.length - 1) {
        link.className += ' clickable';
        link.addEventListener('click', () => {
          this._requestDirectoryListing(currentPath);
        });
      } else {
        link.className += ' current';
      }
      
      this.breadcrumbElement.appendChild(link);
      
      // 最終セグメント以外の後にセパレータを追加
      if (index < segments.length - 1) {
        this.breadcrumbElement.appendChild(separator.cloneNode(true));
      }
    });
  }
  
  /**
   * ファイルアイテム要素の作成
   * @param {Object} file ファイル情報オブジェクト
   * @returns {HTMLElement} ファイル要素
   */
  _createFileItem(file) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.path = file.path;
    
    // ディレクトリの場合
    if (file.isDirectory) {
      item.className += ' directory';
      
      // 展開状態のアイコンを設定
      const isExpanded = this.expandedFolders.has(file.path);
      const icon = isExpanded ? 'folder_open' : 'folder';
      
      item.innerHTML = `
        <i class="material-icons folder-icon">${icon}</i>
        <span class="file-name">${file.name}</span>
      `;
      
      // クリックイベント: ディレクトリの展開/折りたたみ
      item.addEventListener('click', () => {
        if (this.expandedFolders.has(file.path)) {
          this.expandedFolders.delete(file.path);
        } else {
          this.expandedFolders.add(file.path);
          
          // 子要素をロード（まだロードされていない場合）
          if (!file.children || file.children.length === 0) {
            this.vscode.postMessage({
              command: 'listDirectory',
              path: file.path
            });
          }
        }
        
        // ファイルリストを再描画
        this.updateFileList(this.fileList);
      });
    } 
    // 通常のファイルの場合
    else {
      // ファイル種別に応じたアイコンを設定
      let icon = 'insert_drive_file';
      if (file.type === 'markdown') icon = 'description';
      else if (file.type === 'image') icon = 'image';
      else if (file.type === 'javascript' || file.type === 'typescript') icon = 'code';
      
      item.innerHTML = `
        <i class="material-icons file-icon">${icon}</i>
        <span class="file-name">${file.name}</span>
      `;
      
      // 現在選択中のファイルであればスタイルを適用
      if (this.selectedFile === file.path) {
        item.className += ' selected';
      }
      
      // クリックイベント: ファイルプレビュー
      item.addEventListener('click', () => {
        // 選択状態を更新
        document.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        
        // ファイル内容の取得をリクエスト
        this.vscode.postMessage({
          command: 'openFile',
          filePath: file.path
        });
      });
    }
    
    return item;
  }
  
  /**
   * シンプルなマークダウンからHTMLへの変換
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML
   */
  _simpleMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // 安全のためHTMLエスケープ
    let html = this._escapeHtml(markdown);
    
    // 見出し
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    
    // 段落
    html = html.replace(/\n\n([^#].*?)\n\n/gs, '\n\n<p>$1</p>\n\n');
    
    // 強調
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // リンク
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    // リスト
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.+<\/li>\n)+/gs, '<ul>$&</ul>');
    
    // 改行
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }
  
  /**
   * HTML特殊文字のエスケープ
   * @param {string} text エスケープするテキスト
   * @returns {string} エスケープされたテキスト
   */
  _escapeHtml(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// 初期化して公開
const fileBrowser = new FileBrowser();
export default fileBrowser;