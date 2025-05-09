// @ts-check
import stateManager from '../../state/stateManager.js';

class TabManager {
  constructor() {
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.activeTab = null;
    this.isInitialized = false;
    this.pendingTabId = null;
    this.initialize();
  }

  initialize() {
    // 保存されたタブ状態を復元
    const state = stateManager.getState();
    // タブが未選択の場合、必ず進捗状況タブをデフォルトにする
    const savedTab = state.activeTab || 'scope-progress';
    
    // タブクリックイベントをセットアップ
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (event) => this._handleTabClick(event, tab));
    });
    
    // プロジェクト更新イベントリスナーを設定
    window.addEventListener('message', (event) => {
      const message = event.data;
      // プロジェクト更新イベントを処理
      if (message.command === 'project-updated' && message.data) {
        // タブ状態が含まれている場合はタブを更新
        if (message.data.metadata && message.data.metadata.activeTab) {
          console.log(`プロジェクト更新イベントでタブ状態を更新: ${message.data.metadata.activeTab}`);
          this.selectTab(message.data.metadata.activeTab, false); // サーバーには保存しない（二重更新防止）
        } else if (message.data.tabId) {
          // 直接tabIdが指定されている場合
          console.log(`プロジェクト更新イベントでタブIDを更新: ${message.data.tabId}`);
          this.selectTab(message.data.tabId, false);
        }
      }
    });
    
    // VSCode再起動時にタブが選択されていない状態を修正 
    // デフォルトで進捗状況タブを選択（初期状態を明示的に設定）
    this.selectTab(savedTab, true); // サーバーにも保存
    
    // 進捗状況タブの場合は、コンテンツも読み込み
    if (savedTab === 'scope-progress') {
      const projectPath = state.activeProjectPath;
      if (projectPath) {
        stateManager.sendMessage('getMarkdownContent', {
          filePath: `${projectPath}/docs/SCOPE_PROGRESS.md`,
          forScopeProgress: true,
          forceRefresh: true
        });
        console.log('TabManager: 初期化時に進捗状況タブを選択し、内容を読み込みます');
      }
    }
    
    // ファイルタブの追加イベントリスナーを設定
    document.addEventListener('add-file-tab', (event) => {
      const { tabId, title, content, isMarkdown } = event.detail;
      this._addFileTab(tabId, title, content, isMarkdown);
    });
    
    // 初期化完了のフラグを設定
    this.isInitialized = true;
    
    // 保留中のタブ選択があれば実行
    if (this.pendingTabId) {
      setTimeout(() => {
        this.selectTab(this.pendingTabId, true);
        this.pendingTabId = null;
      }, 50);
    }
  }

  _handleTabClick(event, tab) {
    const tabId = tab.getAttribute('data-tab');
    
    // モックアップギャラリーなど特殊タブの処理
    if (tabId === 'tools') {
      event.preventDefault();
      event.stopPropagation();
      
      stateManager.sendMessage('openOriginalMockupGallery');
      return;
    }
    
    // 各タブの特別な初期化処理
    if (tabId === 'requirements') {
      // 要件定義タブが選択された場合、ファイルの読み込みをリクエスト
      stateManager.sendMessage('loadRequirementsFile');
    } else if (tabId === 'file-browser') {
      // ファイルブラウザタブが選択された場合、ファイルリストのリフレッシュをリクエスト
      const projectPath = stateManager.getState().activeProjectPath;
      console.log(`ファイルブラウザタブが選択されました。ファイルリストをリフレッシュします: ${projectPath}`);
      
      // fileBrowserコンポーネントが存在していれば初期化
      if (window.fileBrowser) {
        // まずUIを準備
        if (typeof window.fileBrowser.prepareUI === 'function') {
          window.fileBrowser.prepareUI();
        } else if (typeof window.fileBrowser.initialize === 'function') {
          window.fileBrowser.initialize();
        }
        
        // プレースホルダ表示中にファイルリストをリクエスト（遅延実行）
        setTimeout(() => {
          stateManager.sendMessage('refreshFileBrowser', {
            projectPath: projectPath
          });
          
          // 読み込み中表示のクリア
          const fileList = document.getElementById('file-list');
          if (fileList && fileList.innerHTML.includes('読み込み中')) {
            fileList.innerHTML = '<div class="loading-indicator">ファイルリストを取得中...</div>';
          }
        }, 100);
      } else {
        // fileBrowserがない場合はそのままメッセージ送信
        stateManager.sendMessage('refreshFileBrowser', {
          projectPath: projectPath
        });
      }
    } else if (tabId === 'scope-progress') {
      // 進捗状況タブが選択された場合の処理
      console.log('進捗状況タブが選択されました');
      
      // まず状態に保存されている進捗状況コンテンツをチェック
      const state = stateManager.getState();
      if (state.scopeProgressContent) {
        console.log('ローカルに保存された進捗状況データを表示します');
        // すでに保存されたコンテンツがあればそれを表示
        const event = new CustomEvent('markdown-updated', {
          detail: { content: state.scopeProgressContent }
        });
        document.dispatchEvent(event);
      }
      
      // そのうえで最新データを取得（最新のコンテンツと差し替え）
      console.log('SCOPE_PROGRESS.mdを再読み込みします');
      stateManager.sendMessage('getMarkdownContent', {
        filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
        forScopeProgress: true,
        forceRefresh: true
      });
    }
    
    this.selectTab(tabId, true);
  }

  /**
   * ファイル用の新しいタブを追加
   * @param {string} tabId タブID
   * @param {string} title タブのタイトル
   * @param {string} content ファイルの内容
   * @param {boolean} isMarkdown マークダウン形式かどうか
   * @private
   */
  _addFileTab(tabId, title, content, isMarkdown) {
    console.log(`TabManager: ファイルタブを追加します: ${tabId}, ${title}, isMarkdown=${isMarkdown}`);
    
    // タブバーを取得
    const tabBar = document.querySelector('.tabs');
    if (!tabBar) {
      console.error('TabManager: タブバーが見つかりません');
      return;
    }
    
    // タブコンテンツエリアを取得
    const tabContentsArea = document.querySelector('.tab-content').parentElement;
    if (!tabContentsArea) {
      console.error('TabManager: タブコンテンツエリアが見つかりません');
      return;
    }
    
    // 既存のタブがあれば削除
    const existingTab = document.querySelector(`.tab[data-tab="${tabId}"]`);
    const existingContent = document.getElementById(`${tabId}-tab`);
    
    if (existingTab) {
      existingTab.remove();
    }
    
    if (existingContent) {
      existingContent.remove();
    }
    
    // 新しいタブ要素を作成
    const newTab = document.createElement('div');
    newTab.className = 'tab';
    newTab.setAttribute('data-tab', tabId);
    
    // マークダウンファイルの場合はビューアボタンを追加
    if (isMarkdown) {
      newTab.innerHTML = `
        <span>${title}</span>
        <div class="tab-actions" style="display: flex; align-items: center;">
          <span class="md-viewer-btn" data-tab-id="${tabId}" title="マークダウンビューアで開く" style="margin-right: 5px; cursor: pointer; color: #4a69bd; font-size: 14px;">👁️</span>
          <span class="tab-close" data-tab-id="${tabId}">×</span>
        </div>
      `;
    } else {
      newTab.innerHTML = `
        <span>${title}</span>
        <span class="tab-close" data-tab-id="${tabId}">×</span>
      `;
    }
    
    // クリックイベントを追加
    newTab.addEventListener('click', (event) => {
      // クローズボタンがクリックされた場合
      if (event.target.classList.contains('tab-close')) {
        event.stopPropagation();
        this._removeTab(tabId);
        return;
      }
      
      // マークダウンビューアボタンがクリックされた場合
      if (event.target.classList.contains('md-viewer-btn')) {
        event.stopPropagation();
        
        // VSCodeにメッセージを送信
        const filePath = this._getFilePathFromTabId(tabId);
        if (filePath) {
          stateManager.sendMessage('openMarkdownInTab', {
            filePath: filePath,
            fileName: title
          });
        }
        return;
      }
      
      this._handleTabClick(event, newTab);
    });
    
    // 新しいコンテンツ要素を作成
    const newContent = document.createElement('div');
    newContent.id = `${tabId}-tab`;
    newContent.className = 'tab-content';
    
    if (isMarkdown) {
      // マークダウン表示用のコンテナを追加
      const markdownContainer = document.createElement('div');
      markdownContainer.className = 'markdown-content';
      
      // マークダウンをHTMLに変換して表示
      if (window.markdownViewer && typeof window.markdownViewer._simpleMarkdownToHtml === 'function') {
        markdownContainer.innerHTML = window.markdownViewer._simpleMarkdownToHtml(content);
      } else {
        // シンプルな変換
        markdownContainer.innerHTML = this._convertMarkdownToHtml(content);
      }
      
      newContent.appendChild(markdownContainer);
    } else {
      // 通常のテキスト表示
      const preElement = document.createElement('pre');
      preElement.textContent = content;
      newContent.appendChild(preElement);
    }
    
    // 要素を追加
    tabBar.appendChild(newTab);
    tabContentsArea.appendChild(newContent);
    
    // DOM要素リストを更新
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    // 新しいタブを選択
    this.selectTab(tabId);
  }
  
  /**
   * タブを削除
   * @param {string} tabId 削除するタブのID
   * @private
   */
  _removeTab(tabId) {
    console.log(`TabManager: タブを削除します: ${tabId}`);
    
    // 削除するタブと内容を取得
    const tabToRemove = document.querySelector(`.tab[data-tab="${tabId}"]`);
    const contentToRemove = document.getElementById(`${tabId}-tab`);
    
    if (tabToRemove && contentToRemove) {
      // 削除するタブがアクティブな場合、別のタブに切り替える
      if (tabToRemove.classList.contains('active')) {
        // 優先順位: scope-progress > requirements > 他のタブ
        if (document.querySelector('.tab[data-tab="scope-progress"]')) {
          this.selectTab('scope-progress');
        } else if (document.querySelector('.tab[data-tab="requirements"]')) {
          this.selectTab('requirements');
        } else {
          // 最初のタブを選択
          const firstTab = document.querySelector('.tab:not([data-tab="' + tabId + '"])');
          if (firstTab) {
            this.selectTab(firstTab.getAttribute('data-tab'));
          }
        }
      }
      
      // タブとコンテンツを削除
      tabToRemove.remove();
      contentToRemove.remove();
      
      // DOM要素リストを更新
      this.tabs = document.querySelectorAll('.tab');
      this.tabContents = document.querySelectorAll('.tab-content');
    }
  }
  
  /**
   * タブIDからファイルパスを取得
   * @param {string} tabId タブID
   * @returns {string|null} ファイルパス
   * @private
   */
  _getFilePathFromTabId(tabId) {
    // file-で始まるタブIDの場合、パスを取り出す
    if (tabId.startsWith('file-')) {
      // 形式: file-パス-をハイフンではなくスラッシュに置き換え
      let filePath = tabId.substring(5); // 'file-'を削除
      
      // ハイフンをスラッシュに置き換え
      filePath = filePath.replace(/-/g, '/');
      
      // Windowsパスの場合はバックスラッシュに変換
      if (filePath.includes('Users') && !filePath.startsWith('/')) {
        filePath = filePath.replace(/\//g, '\\');
      }
      
      // 拡張子の補正（"md"→".md"）
      if (filePath.endsWith('md') && !filePath.endsWith('.md')) {
        filePath = filePath.replace(/md$/, '.md');
        console.log(`TabManager: ファイルパス修正（拡張子の区切り文字を追加）: ${filePath}`);
      }
      
      return filePath;
    }
    
    // その他の組み込みタブは各自のパスを持つ
    if (tabId === 'scope-progress') {
      const projectPath = stateManager.getState().activeProjectPath;
      if (projectPath) {
        return `${projectPath}/docs/SCOPE_PROGRESS.md`;
      }
    } else if (tabId === 'requirements') {
      const projectPath = stateManager.getState().activeProjectPath;
      if (projectPath) {
        return `${projectPath}/docs/requirements.md`;
      }
    }
    
    return null;
  }
  
  /**
   * シンプルなマークダウンからHTMLへの変換
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML
   * @private
   */
  _convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // HTMLエスケープ
    let html = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
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
   * 新しいタブを追加
   * @param {string} tabId タブID
   * @param {string} title タブのタイトル
   */
  addTab(tabId, title) {
    console.log(`TabManager: 新しいタブを追加します: ${tabId}, ${title}`);
    
    // タブバーを取得
    const tabBar = document.querySelector('.tabs');
    if (!tabBar) {
      console.error('TabManager: タブバーが見つかりません');
      return;
    }
    
    // 既存のタブがあれば更新して終了
    const existingTab = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (existingTab) {
      console.log(`TabManager: タブ ${tabId} は既に存在します。選択します。`);
      this.selectTab(tabId);
      return;
    }
    
    // 新しいタブ要素を作成
    const newTab = document.createElement('div');
    newTab.className = 'tab';
    newTab.setAttribute('data-tab', tabId);
    newTab.textContent = title;
    
    // クリックイベントを追加
    newTab.addEventListener('click', (event) => {
      this._handleTabClick(event, newTab);
    });
    
    // タブバーに追加
    tabBar.appendChild(newTab);
    
    // DOM要素リストを更新
    this.tabs = document.querySelectorAll('.tab');
  }
  
  selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    // 初期化前の呼び出しは保留する
    if (!this.isInitialized) {
      this.pendingTabId = tabId;
      return;
    }
    
    // タブ選択の再帰ループ検出
    const now = Date.now();
    if (this._lastTabSelectionTime && (now - this._lastTabSelectionTime) < 300) {
      // 前回の選択から300ms以内の場合はスキップ（無限ループ防止）
      console.log(`短時間での連続タブ選択を検出: ${tabId} - スキップします`);
      return;
    }
    this._lastTabSelectionTime = now;
    
    // 既に選択中のタブなら何もしない（冗長な処理を防止）
    if (this.activeTab === tabId) {
      // 同じタブが選択されても、進捗状況タブの場合は内容を更新（競合状態を解決するため）
      // ただし、連続更新を防ぐためにフラグをチェック
      if (tabId === 'scope-progress' && !this._skipProgressReload) {
        this._skipProgressReload = true; // フラグを設定して連続更新を防止
        
        setTimeout(() => {
          // 300ms後にフラグをリセット
          this._skipProgressReload = false;
        }, 300);
        
        stateManager.sendMessage('getMarkdownContent', {
          filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
          forScopeProgress: true,
          forceRefresh: false // 強制的な再読み込みはしない
        });
        console.log('進捗状況タブが再選択されました。コンテンツを更新します');
      }
      return;
    }

    // 進捗状況タブが選択された場合、SCOPE_PROGRESS.mdの内容を明示的に取得
    if (tabId === 'scope-progress') {
      stateManager.sendMessage('getMarkdownContent', {
        filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
        forScopeProgress: true
      });
      console.log('selectTab: 進捗状況タブに切り替えました。SCOPE_PROGRESS.mdを読み込みます');
    } 
    // 要件定義タブが選択された場合、ファイルの読み込みをリクエスト
    else if (tabId === 'requirements') {
      stateManager.sendMessage('loadRequirementsFile');
    }
    
    // UIの更新
    this.tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    this.tabContents.forEach(content => {
      if (content.id === `${tabId}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // 状態の更新
    this.activeTab = tabId;
    stateManager.setState({ activeTab: tabId }, false);
    
    // サーバーへの保存
    if (saveToServer) {
      stateManager.sendMessage('saveTabState', { tabId });
    }
  }
}

// 初期化して公開
const tabManager = new TabManager();
export default tabManager;