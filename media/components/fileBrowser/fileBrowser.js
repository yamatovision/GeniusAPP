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
    
    // 初期化タイムスタンプを記録（短時間の重複呼び出しを防止）
    this.lastInitTime = Date.now();
    
    // DOM要素の取得
    this.container = document.getElementById('file-browser-container');
    this.fileListElement = document.getElementById('file-list');
    this.breadcrumbElement = document.getElementById('file-breadcrumb');
    this.previewElement = document.getElementById('file-preview');
    this.refreshButton = document.getElementById('refresh-file-browser');
    
    if (!this.container) {
      console.error('FileBrowser: file-browser-container要素が見つかりません');
      
      // タブコンテンツ内の要素を探す
      const tabContent = document.getElementById('file-browser-tab');
      if (tabContent) {
        console.log('FileBrowser: file-browser-tabが見つかりました。新しいUIを構築します');
        
        // 古いコンテンツをクリア
        tabContent.innerHTML = '';
        
        // モックアップスタイルのファイルブラウザを作成
        const fileBrowserHTML = `
          <div class="file-browser" style="display: flex; flex-direction: column; height: 100%;">
            <div class="file-browser-header" style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border);">
              <div id="file-breadcrumb" class="file-path" style="display: flex; align-items: center; gap: 4px; overflow-x: auto; white-space: nowrap; padding-bottom: 5px; max-width: 80%;"></div>
              <div class="file-actions" style="display: flex; gap: 8px;">
                <button id="refresh-file-browser" class="button-secondary" style="padding: 4px 8px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                  <span class="material-icons" style="font-size: 16px;">refresh</span>
                </button>
                <button id="new-file-button" class="button-secondary" style="padding: 4px 8px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                  <span class="material-icons" style="font-size: 16px;">add</span>
                  <span>新規作成</span>
                </button>
              </div>
            </div>
            
            <div class="files-container" style="flex: 1; display: flex; flex-direction: column;">
              <div id="file-list" style="flex: 1; overflow-y: auto; padding-right: 10px;"></div>
              
              <div id="file-preview-section" style="margin-top: 20px; display: none;">
                <h3 style="margin-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px;">ファイルプレビュー</h3>
                <div id="file-preview" class="file-preview-panel" style="border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 10px; min-height: 200px; max-height: 450px; overflow-y: auto;"></div>
              </div>
            </div>
          </div>
        `;
        
        // HTML挿入
        tabContent.innerHTML = fileBrowserHTML;
        
        // 要素の再取得
        this.container = tabContent;
        this.fileListElement = document.getElementById('file-list');
        this.breadcrumbElement = document.getElementById('file-breadcrumb');
        this.previewElement = document.getElementById('file-preview');
        this.refreshButton = document.getElementById('refresh-file-browser');
        this.newFileButton = document.getElementById('new-file-button');
      } else {
        console.error('FileBrowser: file-browser-tab要素も見つかりません');
        return;
      }
    }
    
    if (!this.fileListElement) {
      console.error('FileBrowser: file-list要素が見つかりません');
      return;
    }
    
    // ファイルリストが空の場合はローディングメッセージを表示
    if (!this.fileListElement.innerHTML || this.fileListElement.innerHTML.trim() === '') {
      this.fileListElement.innerHTML = '<div class="loading-state" style="padding: 20px; text-align: center;">ファイルを読み込み中...<div class="spinner" style="margin-top: 10px; border: 3px solid rgba(0,0,0,0.1); border-top-color: var(--vscode-progressBar-background); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: inline-block;"></div></div>';
      
      // スピナーアニメーションのスタイルを追加
      const style = document.createElement('style');
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // イベントリスナーのセットアップ
    this._setupEventListeners();
    
    // 新規ファイル作成ボタンのイベントリスナー
    if (this.newFileButton) {
      this.newFileButton.addEventListener('click', () => {
        this.vscode.postMessage({
          command: 'createNewFile',
          currentPath: this.currentPath || 'docs'
        });
      });
    }
    
    // 初期化完了フラグを設定
    this.isInitialized = true;
    
    console.log('FileBrowser: UIの準備完了（サーバー側からの初期化を待機します）');
    
    // docsディレクトリをデフォルトで表示するようリクエスト
    // タイマーでvsCodeAPIの初期化を少し待ってからリクエスト送信
    setTimeout(() => {
      if (this.vscode) {
        // 既存のプロジェクトパスがあればそれを使用、なければdocsフォルダを表示
        const targetPath = this.currentPath || 'docs';
        console.log(`FileBrowser: デフォルトで${targetPath}ディレクトリを表示するようリクエスト送信`);
        
        this.vscode.postMessage({
          command: 'listDirectory',  // openDefaultDirectoryではなくlistDirectoryを使用
          path: targetPath
        });
        
        // 最後のリクエスト時間を記録
        this.lastRequestTime = Date.now();
      }
    }, 500);
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
        case 'updateFileBrowser':
          // サーバーからのupdateFileBrowserコマンドを処理
          console.log('FileBrowser: updateFileBrowserコマンドを受信しました', message);
          if (message.files) {
            // filesパラメータがある場合は通常のupdateFileListとして処理
            this.updateFileList(message.files);
          } else if (message.structure) {
            // 構造情報がある場合で、filesパラメータがない場合
            console.log('FileBrowser: 構造情報を受信しました。ファイルリストを自動的に取得します');
            
            // 現在のパスでディレクトリリストを要求（ファイル一覧を更新）
            this._requestDirectoryListing(this.currentPath);
            
            if (this.fileListElement) {
              // 一時的なロード中メッセージを表示
              this.fileListElement.innerHTML = '<div class="loading-state">ファイルを読み込み中...</div>';
            }
          }
          break;
        case 'updateDirectoryStructure':
          // ディレクトリ構造更新メッセージを処理
          console.log('FileBrowser: ディレクトリ構造更新メッセージを受信しました');
          // 必要に応じてディレクトリリストの更新をリクエスト
          this._requestDirectoryListing();
          break;
      }
    });
  }
  
  /**
   * ディレクトリリストの要求をVSCodeに送信
   * @param {string} path 表示するディレクトリパス（省略時は現在のプロジェクトのdocsディレクトリ）
   */
  // ディレクトリリスト要求のキャッシュ
  _directoryCache = new Map();
  _cacheExpiry = 10000; // キャッシュの有効期間（ミリ秒）
  _batchRequests = [];
  _batchRequestTimer = null;
  _batchDelay = 50; // バッチ処理の遅延時間（ミリ秒）

  _requestDirectoryListing(path) {
    try {
      // vscode APIが利用可能か確認
      if (!this.vscode) {
        console.error('FileBrowser: VSCode APIが利用できないためディレクトリリストを要求できません');
        return;
      }
      
      // リクエストのスロットリング（短時間での連続呼び出しを防止）
      const now = Date.now();
      const minRequestInterval = 500; // 最小リクエスト間隔（ミリ秒）
      
      if (this.lastRequestTime && (now - this.lastRequestTime) < minRequestInterval) {
        console.log(`FileBrowser: リクエスト間隔が短すぎるため、スロットリングします (${now - this.lastRequestTime}ms < ${minRequestInterval}ms)`);
        
        // 前回のリクエストから一定時間経過していないためスキップ
        // 必要に応じて遅延実行することも可能
        setTimeout(() => {
          this._requestDirectoryListing(path);
        }, minRequestInterval);
        
        return;
      }
      
      // 最後のリクエスト時間を更新
      this.lastRequestTime = now;
      
      // パスが指定されていない場合は現在のパスを使用
      let directoryPath = path || this.currentPath || null;
      
      // パスがない場合は静かに終了（エラーにしない）
      if (!directoryPath) {
        console.log('FileBrowser: ディレクトリパスが指定されていません、スキップします');
        
        // 空のファイルリストを表示
        if (this.fileListElement) {
          this.fileListElement.innerHTML = '<div class="empty-state">プロジェクトを選択してください</div>';
        }
        return;
      }
      
      // パスの正規化: .DS_Storeなどの特殊ファイルを処理
      directoryPath = this._normalizePath(directoryPath);
      
      // 同じディレクトリのリクエストが短時間で繰り返されていないか確認
      if (this.lastListedPath === directoryPath && (now - this.lastListedTime) < 2000) {
        console.log(`FileBrowser: 同じディレクトリ(${directoryPath})のリクエストがすでに送信されています。スキップします`);
        return;
      }
      
      // キャッシュをチェック
      const cachedData = this._directoryCache.get(directoryPath);
      if (cachedData && (now - cachedData.timestamp) < this._cacheExpiry) {
        console.log(`FileBrowser: キャッシュからディレクトリ情報を使用: ${directoryPath}`);
        this.updateFileList(cachedData.files);
        return;
      }
      
      // ファイルリストにローディング表示を追加
      if (this.fileListElement && (!this.fileListElement.innerHTML || !this.fileListElement.innerHTML.includes('file-item'))) {
        this.fileListElement.innerHTML = '<div class="loading-state" style="padding: 20px; text-align: center;">ファイルを読み込み中...<div class="spinner" style="margin-top: 10px; border: 3px solid rgba(0,0,0,0.1); border-top-color: var(--vscode-progressBar-background); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: inline-block;"></div></div>';
      }
      
      // リクエストをバッチ処理に追加
      this._addToBatchRequest(directoryPath);
      
      // 現在のパスを更新
      this.currentPath = directoryPath;
      this.lastListedPath = directoryPath;
      this.lastListedTime = now;
    } catch (error) {
      console.error('FileBrowser: ディレクトリリスト要求中にエラーが発生しました', error);
      
      // ファイルリスト表示領域にエラーメッセージを表示
      if (this.fileListElement) {
        this.fileListElement.innerHTML = '<div class="error-state">エラーが発生しました</div>';
      }
    }
  }
  
  /**
   * バッチリクエストにディレクトリパスを追加
   * @param {string} directoryPath 
   */
  _addToBatchRequest(directoryPath) {
    // すでに同じパスがバッチに含まれていないか確認
    if (!this._batchRequests.includes(directoryPath)) {
      this._batchRequests.push(directoryPath);
    }
    
    // 既存のタイマーをクリア
    if (this._batchRequestTimer) {
      clearTimeout(this._batchRequestTimer);
    }
    
    // 新しいタイマーを設定
    this._batchRequestTimer = setTimeout(() => {
      this._processBatchRequests();
    }, this._batchDelay);
  }
  
  /**
   * 蓄積されたバッチリクエストを処理
   */
  _processBatchRequests() {
    // バッチが空なら何もしない
    if (this._batchRequests.length === 0) {
      return;
    }
    
    console.log(`FileBrowser: ${this._batchRequests.length}件のディレクトリリクエストをバッチ処理します`);
    
    // 各リクエストを処理（現在のバージョンでは単純にそれぞれを個別に処理）
    // メッセージハンドラー側でキャッシュを実装すればさらに効率化可能
    for (const directoryPath of this._batchRequests) {
      console.log(`FileBrowser: ディレクトリリストを要求: ${directoryPath}`);
      this.vscode.postMessage({
        command: 'listDirectory',
        path: directoryPath,
        isBatch: true
      });
    }
    
    // バッチをクリア
    this._batchRequests = [];
    this._batchRequestTimer = null;
  }
  
  /**
   * パスを正規化するヘルパーメソッド
   * @param {string} path 正規化するパス
   * @returns {string} 正規化されたパス
   * @private
   */
  _normalizePath(path) {
    if (!path) return path;
    
    // 特殊ファイルの処理
    const specialFiles = ['.DS_Store', 'Thumbs.db', '.localized'];
    for (const file of specialFiles) {
      if (path.endsWith(file)) {
        // 親ディレクトリを返す
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        console.log(`FileBrowser: 特殊ファイル「${file}」を除外し、親ディレクトリを使用: ${parentPath}`);
        return parentPath;
      }
    }
    
    return path;
  }
  
  /**
   * ディレクトリ構造を更新処理
   * @param {string} structureJson ディレクトリ構造のJSON文字列
   */
  updateDirectoryStructure(structureJson) {
    console.log('FileBrowser: ディレクトリ構造を更新します');
    
    try {
      // パスの取得: 既存のパスまたは構造情報から抽出
      let projectPath = this._extractPathFromStructure(structureJson);
      
      // パスが取得できない場合はスキップ
      if (!projectPath) {
        // 空のファイルリストを表示
        if (this.fileListElement) {
          this.fileListElement.innerHTML = '<div class="empty-state">プロジェクトを選択してください</div>';
        }
        return;
      }
      
      // ファイルリスト表示領域にローディングメッセージを表示
      if (this.fileListElement) {
        this.fileListElement.innerHTML = '<div class="loading-state">ファイルを読み込み中...</div>';
      }
      
      // ディレクトリリストを要求（パスの正規化も行われる）
      this._requestDirectoryListing(projectPath);
    } catch (error) {
      console.error('FileBrowser: ディレクトリ構造更新中にエラーが発生しました', error);
    }
  }
  
  /**
   * 構造情報からパスを抽出するヘルパーメソッド
   * @param {string} structureJson 構造情報（JSON文字列またはパス文字列）
   * @returns {string|null} 抽出されたパス、または抽出できない場合はnull
   * @private
   */
  _extractPathFromStructure(structureJson) {
    // 既存のパスが設定されている場合はそれを優先使用
    if (this.currentPath) {
      return this.currentPath;
    }
    
    // 構造情報からパスを抽出
    try {
      if (structureJson && typeof structureJson === 'string' && structureJson.startsWith('/')) {
        // 構造情報がパス文字列の場合、最初の行を抽出
        const projectPath = structureJson.split('\n')[0].trim();
        console.log(`FileBrowser: 構造情報からプロジェクトパスを抽出: ${projectPath}`);
        
        // パスの正規化（.DS_Storeなどの特殊ファイルを処理）
        return this._normalizePath(projectPath);
      }
    } catch (error) {
      console.warn('FileBrowser: 構造情報からのパス抽出に失敗しました', error);
    }
    
    // パスが抽出できない場合
    console.warn('FileBrowser: 有効なプロジェクトパスが見つかりません');
    return null;
  }
  
  /**
   * ファイルがテキストファイルかどうかを判定
   * @param {string} filename ファイル名
   * @returns {boolean} テキストファイルならtrue
   * @private
   */
  _isTextFile(filename) {
    if (!filename) return false;
    
    // テキストファイルとして表示可能な拡張子リスト
    const textExtensions = [
      '.md', '.txt', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.json', 
      '.yml', '.yaml', '.xml', '.sh', '.bat', '.ps1', '.py', '.rb', '.java', '.c', 
      '.cpp', '.cs', '.go', '.rs', '.php', '.config', '.ini', '.log', '.csv', '.gitignore'
    ];
    
    // 拡張子を小文字で取得
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    // テキストファイル拡張子リストにあるかチェック
    return textExtensions.includes(ext);
  }

  /**
   * ファイルリストを更新
   * @param {Array} files ファイルとディレクトリの配列
   */
  updateFileList(files, fromCache = false) {
    if (!this.fileListElement) return;
    
    // ファイルリストを保存（フィルタリングはしない）
    this.fileList = files || [];
    
    // 表示をクリア
    this.fileListElement.innerHTML = '';
    
    // ファイルが0件の場合
    if (!files || files.length === 0) {
      this.fileListElement.innerHTML = '<div class="empty-state">ファイルが見つかりません</div>';
      return;
    }
    
    // 新しいディレクトリデータをキャッシュに保存（サーバーから取得した場合のみ）
    if (!fromCache && files.length > 0 && files[0].parentFolder) {
      this._directoryCache.set(files[0].parentFolder, {
        files: files,
        timestamp: Date.now()
      });
    }
    
    // バイナリファイルをフィルタリング（ディレクトリは残す）
    const filteredFiles = files.filter(file => {
      // ディレクトリは常に表示
      if (file.isDirectory) return true;
      
      // ファイル名がない場合はスキップ
      if (!file.name) return false;
      
      // テキストファイルかどうかをチェック
      return this._isTextFile(file.name);
    });
    
    // フィルタリング前後のファイル数を記録（デバッグ用）
    console.log(`FileBrowser: ファイルフィルタリング: 元=${files.length}件 → フィルタ後=${filteredFiles.length}件`);
    
    // ファイルが0件になった場合は早期リターン
    if (filteredFiles.length === 0) {
      this.fileListElement.innerHTML = '<div class="empty-state">表示可能なファイルが見つかりません</div>';
      return;
    }
    
    // カレントディレクトリを保存
    if (files.length > 0 && files[0].parentFolder) {
      this.currentPath = files[0].parentFolder;
      
      // パンくずリストを更新
      this._updateBreadcrumb(this.currentPath);
    }
    
    // /docsディレクトリの場合、特別な表示にする
    if (this.currentPath && this.currentPath.includes('/docs')) {
      // 最上位docsディレクトリのフォルダセクションを作成
      const docsSection = document.createElement('div');
      docsSection.className = 'folder-section main-folder';
      
      // ディレクトリ名を取得（パスの最後の部分）
      const dirName = this.currentPath.split('/').filter(Boolean).pop() || 'docs';
      
      // docsフォルダヘッダーの作成
      const folderHeader = document.createElement('div');
      folderHeader.className = 'folder-header';
      folderHeader.innerHTML = `
        <span class="material-icons folder-icon" style="color: #ffc107;">folder_open</span>
        <span style="font-weight: 500;">${dirName}</span>
      `;
      
      docsSection.appendChild(folderHeader);
      
      // 全ファイルをリスト表示用のコンテナ
      const fileList = document.createElement('div');
      fileList.className = 'file-list';
      
      // ファイルとディレクトリを分類（フィルタリング済みリストを使用）
      const directories = filteredFiles.filter(file => file.isDirectory);
      const regularFiles = filteredFiles.filter(file => !file.isDirectory);
      
      // 通常のファイルを一覧で表示
      regularFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.path = file.path;
        
        // 最終更新日を取得（ない場合は現在の日付）
        const lastModified = file.lastModified ? new Date(file.lastModified) : new Date();
        const dateStr = `${lastModified.getFullYear()}/${String(lastModified.getMonth() + 1).padStart(2, '0')}/${String(lastModified.getDate()).padStart(2, '0')}`;
        
        // ファイル種別に応じたアイコンを設定
        let icon = 'insert_drive_file';
        if (file.type === 'markdown') icon = 'description';
        else if (file.type === 'image') icon = 'image';
        else if (file.type === 'javascript' || file.type === 'typescript') icon = 'code';
        
        fileItem.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="material-icons file-icon" style="color: #42a5f5;">${icon}</span>
              <span class="file-name">${file.name}</span>
            </div>
            <span style="font-size: 11px; color: var(--vscode-descriptionForeground);">${dateStr}</span>
          </div>
        `;
        
        // 現在選択中のファイルであればスタイルを適用
        if (this.selectedFile === file.path) {
          fileItem.className += ' selected';
        }
        
        // クリックイベント: ファイルをタブで開く
        fileItem.addEventListener('click', () => {
          // 選択状態を更新
          document.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
          fileItem.classList.add('selected');
          
          // ファイルタブとして開く（タブマネージャーを通して）
          this.vscode.postMessage({
            command: 'openFileAsTab',
            filePath: file.path,
            fileName: file.name,
            fileType: file.type || this.getFileType(file.path),
            lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString()
          });
        });
        
        fileList.appendChild(fileItem);
      });
      
      // ディレクトリを表示
      directories.forEach(dir => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item directory';
        fileItem.dataset.path = dir.path;
        
        // ディレクトリアイコンを設定
        fileItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="material-icons folder-icon" style="color: #ffc107;">folder</span>
            <span class="file-name">${dir.name}</span>
          </div>
        `;
        
        // クリックイベント: ディレクトリ内に移動
        fileItem.addEventListener('click', () => {
          this.vscode.postMessage({
            command: 'listDirectory',
            path: dir.path
          });
        });
        
        fileList.appendChild(fileItem);
      });
      
      // ファイルリストをdocsセクションに追加
      if (regularFiles.length > 0 || directories.length > 0) {
        const subList = document.createElement('div');
        subList.className = 'sub-file-list';
        subList.appendChild(fileList);
        docsSection.appendChild(subList);
      }
      
      this.fileListElement.appendChild(docsSection);
    } else {
      // 通常の表示（docsディレクトリ以外の場合）
      // ディレクトリとファイルに分類（フィルタリング済みリストを使用）
      const directories = filteredFiles.filter(file => file.isDirectory);
      const regularFiles = filteredFiles.filter(file => !file.isDirectory);
      
      // ディレクトリごとにフォルダセクションを作成
      directories.forEach(dir => {
        const folderSection = document.createElement('div');
        folderSection.className = 'folder-section';
        
        // フォルダヘッダーの作成
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        
        // 展開状態のアイコンを設定
        const isExpanded = this.expandedFolders.has(dir.path);
        const icon = isExpanded ? 'folder_open' : 'folder';
        
        folderHeader.innerHTML = `
          <span class="material-icons folder-icon" style="color: #ffc107;">${icon}</span>
          <span>${dir.name}</span>
        `;
        
        // フォルダヘッダーのクリックイベント
        folderHeader.addEventListener('click', () => {
          this.vscode.postMessage({
            command: 'listDirectory',
            path: dir.path
          });
        });
        
        folderSection.appendChild(folderHeader);
        
        this.fileListElement.appendChild(folderSection);
      });
      
      // 通常のファイルを一覧で表示
      if (regularFiles.length > 0) {
        const filesList = document.createElement('div');
        filesList.className = 'file-list';
        
        regularFiles.forEach(file => {
          const fileItem = this._createFileItem(file);
          filesList.appendChild(fileItem);
        });
        
        this.fileListElement.appendChild(filesList);
      }
    }
  }
  
  /**
   * ファイルプレビューを更新
   * @param {string} content ファイルの内容
   * @param {string} filePath ファイルパス
   * @param {boolean} isError エラーが発生したかどうか
   */
  updateFilePreview(content, filePath, isError = false) {
    console.log('FileBrowser: ファイルプレビュー更新開始', { filePath, isError });
    
    // プレビュー要素の再取得（タブ切り替え後に要素が再描画される可能性があるため）
    this.previewElement = document.getElementById('file-preview');
    
    if (!this.previewElement) {
      console.error('FileBrowser: file-preview要素が見つかりません');
      // file-preview-content要素を代わりに試す
      this.previewElement = document.getElementById('file-preview-content');
      if (!this.previewElement) {
        console.error('FileBrowser: file-preview-content要素も見つかりません');
        return;
      }
    }
    
    // プレビューセクションを表示（プレビュー開始時に常に表示）
    const previewSection = document.getElementById('file-preview-section');
    if (previewSection) {
      previewSection.style.display = 'block';
    }
    
    console.log('FileBrowser: プレビュー要素が見つかりました', this.previewElement);
    
    // ファイルパスから名前を取得
    const fileName = filePath.split('/').pop();
    
    // バイナリファイルの場合、プレビュー表示しない
    if (!isError && !this._isTextFile(fileName) && !filePath.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
      isError = true;
      content = 'このファイルはバイナリファイルのため、プレビューできません。';
      console.log('FileBrowser: バイナリファイルのためプレビューをスキップします', filePath);
    }
    
    // 最終更新日を取得（ファイル情報から探す）
    let lastModified = new Date();
    const fileInfo = this.fileList.find(f => f.path === filePath);
    if (fileInfo && fileInfo.lastModified) {
      lastModified = new Date(fileInfo.lastModified);
    }
    const dateStr = `${lastModified.getFullYear()}/${String(lastModified.getMonth() + 1).padStart(2, '0')}/${String(lastModified.getDate()).padStart(2, '0')}`;
    
    // パンクズリストに情報を移動し、ファイルビューを最大化する
    this._updateBreadcrumb(this.currentPath, {
      fileName,
      dateStr,
      filePath
    });
    
    // プレビューヘッダーは使用しない（パンクズリストに統合したため）
    
    // プレビューコンテンツの更新
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-content full-width-preview';
    previewContent.style.maxWidth = '100%';
    previewContent.style.padding = '20px 0';
    
    // ファイル種別に応じた表示の変更
    if (isError) {
      // エラーメッセージの表示
      previewContent.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--vscode-errorForeground);">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">error_outline</span>
          <p>${content || 'ファイルを開けませんでした。'}</p>
        </div>
      `;
    } else if (filePath.endsWith('.md')) {
      // マークダウンの場合、進捗状況と要件定義と同様のスタイルを適用
      previewContent.innerHTML = this._enhancedMarkdownToHtml(content);
      previewContent.className += ' markdown-preview enhanced-markdown';
      
      // 要素にスタイルを追加
      previewContent.style.fontSize = '14px';
      previewContent.style.lineHeight = '1.6';
      previewContent.style.color = 'var(--vscode-foreground)';
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
      // 画像ファイルの場合、img要素を表示（中央寄せで）
      previewContent.innerHTML = `<div style="text-align: center;"><img src="vscode-resource:${filePath}" alt="${fileName}" style="max-width: 100%; max-height: 600px;"></div>`;
    } else {
      // テキストファイルの場合、preタグでコード表示（シンタックスハイライト風）
      previewContent.innerHTML = `<pre style="background: var(--vscode-editor-background); padding: 15px; border-radius: 6px; overflow: auto; font-family: 'Courier New', monospace;">${this._escapeHtml(content)}</pre>`;
      previewContent.className += ' code-preview';
    }
    
    // プレビュー領域をクリアして新しい内容を表示（ヘッダーは不要）
    this.previewElement.innerHTML = '';
    this.previewElement.appendChild(previewContent);
    
    console.log('FileBrowser: プレビュー内容を更新しました');
    
    // 「エディタで開く」ボタンは既にパンクズリストに移動済み
    
    // プレビューセクションは上部で既に表示している
    
    // 選択されたファイルを保存
    this.selectedFile = filePath;
  }
  
  /**
   * パンくずリストを更新
   * @param {string} path 現在のディレクトリパス
   * @param {Object} fileInfo 現在表示中のファイル情報（オプション）
   */
  _updateBreadcrumb(path, fileInfo = null) {
    if (!this.breadcrumbElement || !path) return;
    
    // パンくずリストをクリア
    this.breadcrumbElement.innerHTML = '';
    
    // パンくず左側コンテナ
    const breadcrumbLeft = document.createElement('div');
    breadcrumbLeft.className = 'breadcrumb-left';
    breadcrumbLeft.style.display = 'flex';
    breadcrumbLeft.style.alignItems = 'center';
    breadcrumbLeft.style.flexGrow = '1';
    breadcrumbLeft.style.overflow = 'hidden';
    
    // ホームリンク（ルート）を追加
    const homeLink = document.createElement('span');
    homeLink.className = 'breadcrumb-item';
    homeLink.innerHTML = '<span class="material-icons" style="font-size: 16px; color: var(--vscode-foreground);">home</span>';
    homeLink.addEventListener('click', () => {
      this._requestDirectoryListing(null); // ルートディレクトリの表示
    });
    
    // モックアップスタイルのパンくずリスト
    breadcrumbLeft.appendChild(homeLink);
    
    // パンくず右側コンテナ (ファイル情報とアクション)
    const breadcrumbRight = document.createElement('div');
    breadcrumbRight.className = 'breadcrumb-right';
    breadcrumbRight.style.display = 'flex';
    breadcrumbRight.style.alignItems = 'center';
    breadcrumbRight.style.gap = '10px';
    breadcrumbRight.style.marginLeft = 'auto';
    
    // 現在のファイル情報がある場合
    if (fileInfo && fileInfo.fileName) {
      // ファイルアイコン
      let iconName = 'description';
      let iconColor = 'var(--vscode-terminal-ansiBlue)';
      
      if (fileInfo.fileName.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        iconName = 'image';
      } else if (fileInfo.fileName.match(/\.md$/i)) {
        iconName = 'article';
      }
      
      // VSCodeで開くボタン
      const openButton = document.createElement('button');
      openButton.className = 'button-secondary';
      openButton.id = 'open-in-editor';
      openButton.style.cssText = 'padding: 4px 8px; font-size: 12px; display: flex; align-items: center; gap: 4px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer;';
      openButton.innerHTML = `
        <span class="material-icons" style="font-size: 14px;">open_in_new</span>
        <span>VSCodeで開く</span>
      `;
      
      // 最終更新日情報
      const fileInfoElement = document.createElement('div');
      fileInfoElement.style.cssText = 'font-size: 12px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 5px;';
      fileInfoElement.innerHTML = `
        <span class="material-icons" style="font-size: 16px; color: ${iconColor};">${iconName}</span>
        <span>${fileInfo.fileName}</span>
        <span style="opacity: 0.7;">最終更新: ${fileInfo.dateStr}</span>
      `;
      
      // ボタンのクリックイベント
      openButton.addEventListener('click', () => {
        this.vscode.postMessage({
          command: 'openFileInEditor',
          filePath: fileInfo.filePath
        });
      });
      
      breadcrumbRight.appendChild(fileInfoElement);
      breadcrumbRight.appendChild(openButton);
    }
    
    // コンテナをパンくずリストに追加
    this.breadcrumbElement.appendChild(breadcrumbLeft);
    
    // 右側コンテナを追加
    if (breadcrumbRight.children.length > 0) {
      this.breadcrumbElement.appendChild(breadcrumbRight);
    }
    
    // docsディレクトリの場合は簡素化したパスを表示
    if (path.includes('/docs')) {
      // セパレータを追加
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '/';
      separator.style.color = 'var(--vscode-descriptionForeground)';
      separator.style.margin = '0 5px';
      this.breadcrumbElement.appendChild(separator.cloneNode(true));
      
      // docsディレクトリへのリンク
      const docsLink = document.createElement('span');
      docsLink.className = 'breadcrumb-item clickable';
      docsLink.textContent = 'docs';
      docsLink.style.color = 'var(--vscode-textLink-foreground)';
      docsLink.style.cursor = 'pointer';
      
      // docsフォルダへの直接リンク
      // プロジェクトパスからdocsフォルダへのパスを構築
      const docsPath = path.substring(0, path.indexOf('docs') + 4);
      docsLink.addEventListener('click', () => {
        this._requestDirectoryListing(docsPath);
      });
      
      this.breadcrumbElement.appendChild(docsLink);
      
      // docs以降のパスを追加
      const pathAfterDocs = path.substring(path.indexOf('docs') + 4).split('/').filter(Boolean);
      if (pathAfterDocs.length > 0) {
        // セパレータを追加
        this.breadcrumbElement.appendChild(separator.cloneNode(true));
        
        // 追加のパスセグメントを表示
        pathAfterDocs.forEach((segment, index) => {
          const segmentLink = document.createElement('span');
          segmentLink.className = 'breadcrumb-item';
          segmentLink.textContent = segment;
          
          // 最後のセグメント以外はクリック可能にする
          if (index < pathAfterDocs.length - 1) {
            segmentLink.className += ' clickable';
            segmentLink.style.color = 'var(--vscode-textLink-foreground)';
            segmentLink.style.cursor = 'pointer';
            
            // パスを構築
            const segmentPath = path.substring(0, path.indexOf('docs') + 4) + '/' + 
                              pathAfterDocs.slice(0, index + 1).join('/');
            
            segmentLink.addEventListener('click', () => {
              this._requestDirectoryListing(segmentPath);
            });
          }
          
          this.breadcrumbElement.appendChild(segmentLink);
          
          // 最後のセグメント以外の後にセパレータを追加
          if (index < pathAfterDocs.length - 1) {
            this.breadcrumbElement.appendChild(separator.cloneNode(true));
          }
        });
      } else {
        // ディレクトリを表すセパレータ
        this.breadcrumbElement.appendChild(separator.cloneNode(true));
      }
    } else {
      // 通常の表示: プロジェクトルートからのパス
      // セパレータを追加
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '/';
      separator.style.color = 'var(--vscode-descriptionForeground)';
      separator.style.margin = '0 5px';
      this.breadcrumbElement.appendChild(separator.cloneNode(true));
      
      // パスをセグメントに分割
      const segments = path.split('/').filter(Boolean);
      let currentPath = '';
      
      // 各セグメントに対応するリンクを作成
      segments.forEach((segment, index) => {
        currentPath += '/' + segment;
        
        const link = document.createElement('span');
        link.className = 'breadcrumb-item';
        link.textContent = segment;
        
        // 最終セグメント以外はクリック可能にする
        if (index < segments.length - 1) {
          link.className += ' clickable';
          link.style.color = 'var(--vscode-textLink-foreground)';
          link.style.cursor = 'pointer';
          link.addEventListener('click', () => {
            this._requestDirectoryListing(currentPath);
          });
        }
        
        this.breadcrumbElement.appendChild(link);
        
        // 最終セグメント以外の後にセパレータを追加
        if (index < segments.length - 1) {
          this.breadcrumbElement.appendChild(separator.cloneNode(true));
        }
      });
      
      // 最終セグメントがない場合は単にセパレータを追加
      if (segments.length === 0) {
        this.breadcrumbElement.appendChild(separator.cloneNode(true));
      }
    }
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
    
    // 最終更新日を取得（ない場合は現在の日付）
    const lastModified = file.lastModified ? new Date(file.lastModified) : new Date();
    const dateStr = `${lastModified.getFullYear()}/${String(lastModified.getMonth() + 1).padStart(2, '0')}/${String(lastModified.getDate()).padStart(2, '0')}`;
    
    // ディレクトリの場合
    if (file.isDirectory) {
      item.className += ' directory';
      
      // 展開状態のアイコンを設定
      const isExpanded = this.expandedFolders.has(file.path);
      const icon = isExpanded ? 'folder_open' : 'folder';
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="material-icons folder-icon">${icon}</i>
          <span class="file-name">${file.name}</span>
        </div>
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
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="material-icons file-icon">${icon}</i>
            <span class="file-name">${file.name}</span>
          </div>
          <span style="font-size: 11px; color: var(--vscode-descriptionForeground);">${dateStr}</span>
        </div>
      `;
      
      // 現在選択中のファイルであればスタイルを適用
      if (this.selectedFile === file.path) {
        item.className += ' selected';
      }
      
      // クリックイベント: ファイルをタブで開く
      item.addEventListener('click', () => {
        // 選択状態を更新
        document.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        
        // ファイルタブとして開く
        this.vscode.postMessage({
          command: 'openFileAsTab',
          filePath: file.path,
          fileName: file.name,
          fileType: file.type || this.getFileType(file.path),
          lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString()
        });
      });
    }
    
    return item;
  }
  
  /**
   * マークダウン→HTML変換（強化版）
   * 要件定義や進捗状況と同様のスタイルを適用
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML
   */
  _enhancedMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // 安全のためHTMLエスケープ
    let html = this._escapeHtml(markdown);
    
    // 見出し
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: 1.7em; margin-top: 0.8em; margin-bottom: 0.5em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; color: var(--vscode-panelTitle-activeForeground);">$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 1.4em; margin-top: 1em; margin-bottom: 0.5em; color: var(--vscode-foreground);">$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 1.2em; margin-top: 1em; margin-bottom: 0.5em; color: var(--vscode-foreground);">$1</h3>');
    
    // 段落
    html = html.replace(/\n\n([^#-].*?)\n\n/gs, '\n\n<p style="margin-bottom: 1em;">$1</p>\n\n');
    
    // 強調
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // リンク
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: var(--vscode-textLink-foreground); text-decoration: none;">$1</a>');
    
    // テーブル
    const tablePattern = /^\|(.*)\|\s*\n\|\s*[:\-]+\s*\|(.*)\|\s*\n((?:\|.*\|\s*\n)+)/gm;
    html = html.replace(tablePattern, (match) => {
      // テーブルタグで囲む
      const tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">' +
        match
          // 行の処理
          .split('\n')
          .filter(line => line.trim().startsWith('|') && line.trim().endsWith('|'))
          .map((line, index) => {
            // セル内容の抽出
            const cells = line
              .trim()
              .split('|')
              .slice(1, -1)
              .map(cell => cell.trim());
              
            // ヘッダー行か判定
            const isHeader = index === 0;
            // セパレータ行はスキップ
            const isSeparator = index === 1 && line.includes('-');
            
            if (isSeparator) return '';
            
            // 行の開始タグ
            let rowHtml = '<tr style="border-bottom: 1px solid var(--vscode-panel-border);">';
            
            // セルの処理
            cells.forEach(cell => {
              const cellTag = isHeader ? 'th' : 'td';
              const cellStyle = isHeader 
                ? 'style="padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--vscode-panel-border);"'
                : 'style="padding: 8px; text-align: left;"';
              rowHtml += `<${cellTag} ${cellStyle}>${cell}</${cellTag}>`;
            });
            
            // 行の終了タグ
            rowHtml += '</tr>';
            return rowHtml;
          })
          .filter(row => row !== '')
          .join('') +
        '</table>';
        
      return tableHtml;
    });
    
    // チェックボックス付きリスト
    html = html.replace(/^- \[ \] (.+)$/gm, '<li style="list-style-type: none; margin-left: -20px;"><input type="checkbox" disabled> $1</li>');
    html = html.replace(/^- \[x\] (.+)$/gm, '<li style="list-style-type: none; margin-left: -20px;"><input type="checkbox" checked disabled> $1</li>');
    
    // 通常リスト
    html = html.replace(/^- (.+)$/gm, '<li style="margin-bottom: 0.3em;">$1</li>');
    html = html.replace(/(<li.*>.+<\/li>)+/gs, '<ul style="margin-bottom: 1em; padding-left: 2em;">$&</ul>');
    
    // コードブロック
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre style="background-color: var(--vscode-editor-background); border-radius: 6px; padding: 16px; overflow: auto; margin: 1em 0; font-family: \'Courier New\', monospace; font-size: 13px; line-height: 1.5;">$2</pre>');
    
    // インラインコード
    html = html.replace(/`([^`]+)`/g, '<code style="background-color: var(--vscode-editor-background); padding: 2px 4px; border-radius: 3px; font-family: \'Courier New\', monospace; font-size: 0.9em;">$1</code>');
    
    // 水平線
    html = html.replace(/^---+$/gm, '<hr style="border: none; border-top: 1px solid var(--vscode-panel-border); margin: 1.5em 0;">');
    
    // 引用
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left: 4px solid var(--vscode-textLink-foreground); padding-left: 16px; margin-left: 0; margin-right: 0; color: var(--vscode-descriptionForeground);">$1</blockquote>');
    
    // 改行は段落に変換
    html = html.replace(/\n\n/g, '</p><p style="margin-bottom: 1em;">');
    
    // 単一改行は改行タグに
    html = html.replace(/\n/g, '<br>');
    
    // 全体を段落で囲む
    html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;">${html}</div>`;
    
    return html;
  }
  
  /**
   * シンプルなマークダウンからHTMLへの変換（互換性のために残す）
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML
   */
  _simpleMarkdownToHtml(markdown) {
    return this._enhancedMarkdownToHtml(markdown);
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