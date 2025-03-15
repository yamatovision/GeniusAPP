import * as vscode from 'vscode';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';
import { CategoryManager } from './CategoryManager';
import { PromptEditor, PromptEditorOptions } from './PromptEditor';
import { PromptImportExport } from './PromptImportExport';

/**
 * プロンプトライブラリパネルクラス
 * - プロンプト一覧の表示
 * - カテゴリによるフィルタリング
 * - プロンプトの検索
 * - プロンプトの詳細表示・編集
 */
export class PromptLibraryPanel {
  /**
   * トラックされている現在のパネル。
   * プロンプトライブラリパネルは一度に1つだけ存在する。
   */
  public static currentPanel: PromptLibraryPanel | undefined;

  /**
   * 対応するwebviewパネルのトラッキング
   */
  private readonly _panel: vscode.WebviewPanel;
  
  /**
   * パネルの廃棄を処理するためのリソース廃棄機構
   */
  private _disposables: vscode.Disposable[] = [];

  /**
   * APIクライアント
   */
  private _apiClient: ClaudeCodeApiClient;

  /**
   * カテゴリマネージャー
   */
  private _categoryManager: CategoryManager;

  /**
   * プロンプトエディタ
   */
  private _promptEditor: PromptEditor;

  /**
   * プロンプトインポート/エクスポート
   */
  private _promptImportExport: PromptImportExport;

  /**
   * 現在表示中のプロンプト一覧
   */
  private _currentPrompts: any[] = [];

  /**
   * 検索クエリ
   */
  private _searchQuery: string = '';

  /**
   * ローディング状態
   */
  private _isLoading: boolean = false;

  /**
   * 新しいパネルの作成または既存パネルを表示するスタティックメソッド
   */
  public static createOrShow(extensionUri: vscode.Uri, options?: PromptEditorOptions): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 既にパネルが存在する場合は表示する
    if (PromptLibraryPanel.currentPanel) {
      PromptLibraryPanel.currentPanel._panel.reveal(column);
      
      // オプションが指定されている場合は、モードを切り替える
      if (options) {
        PromptLibraryPanel.currentPanel._handleEditorModeChange(options);
      }
      
      return;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      'promptLibrary',
      'プロンプトライブラリ',
      column || vscode.ViewColumn.One,
      {
        // Webviewに制限をかけて安全性を確保
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webviews', 'promptLibrary')
        ],
        retainContextWhenHidden: true
      }
    );

    PromptLibraryPanel.currentPanel = new PromptLibraryPanel(panel, extensionUri, options);
  }

  /**
   * コンストラクタ - privateにして直接newできないようにする
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, options?: PromptEditorOptions) {
    this._panel = panel;
    this._apiClient = ClaudeCodeApiClient.getInstance();
    this._categoryManager = new CategoryManager();
    this._promptEditor = new PromptEditor();
    this._promptImportExport = new PromptImportExport();

    // webviewの内容を設定
    this._initWebview(extensionUri);

    // パネルが破棄されたときにクリーンアップを行う
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // webviewのメッセージハンドラーを設定
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // 初期データの読み込み
    this._loadInitialData(options);
  }

  /**
   * Webviewの初期化
   */
  private _initWebview(extensionUri: vscode.Uri): void {
    this._panel.webview.html = this._getHtmlForWebview(extensionUri);
  }

  /**
   * 初期データの読み込み
   */
  private async _loadInitialData(options?: PromptEditorOptions): Promise<void> {
    this._setLoading(true);

    try {
      // カテゴリの取得
      await this._categoryManager.fetchCategories();

      // プロンプト一覧の取得
      await this._loadPrompts();

      // 編集モードの設定（指定されている場合）
      if (options) {
        await this._handleEditorModeChange(options);
      }
    } catch (error) {
      console.error('初期データの読み込みに失敗しました:', error);
      vscode.window.showErrorMessage('プロンプトライブラリの初期化に失敗しました。');
    } finally {
      this._setLoading(false);
    }
  }

  /**
   * エディタモードの変更を処理
   */
  private async _handleEditorModeChange(options: PromptEditorOptions): Promise<void> {
    this._setLoading(true);

    try {
      if (options.mode === 'create') {
        // 新規作成モード
        this._promptEditor.initNewPrompt();
        this._promptEditor.setMode('create');
        
        // Webviewに通知
        this._panel.webview.postMessage({
          type: 'promptEditor',
          action: 'create',
          prompt: this._promptEditor.getCurrentPrompt()
        });
      } else if (options.mode === 'edit' && options.promptId) {
        // 編集モード
        const prompt = await this._promptEditor.loadPrompt(options.promptId);
        this._promptEditor.setMode('edit');
        
        if (prompt) {
          // Webviewに通知
          this._panel.webview.postMessage({
            type: 'promptEditor',
            action: 'edit',
            prompt
          });
        }
      } else if (options.mode === 'view' && options.promptId) {
        // 閲覧モード
        const prompt = await this._promptEditor.loadPrompt(options.promptId);
        this._promptEditor.setMode('view');
        
        if (prompt) {
          // 使用履歴を記録
          await this._promptEditor.recordUsage(options.promptId);
          
          // Webviewに通知
          this._panel.webview.postMessage({
            type: 'promptEditor',
            action: 'view',
            prompt
          });
        }
      }
    } catch (error) {
      console.error('エディタモードの変更に失敗しました:', error);
      vscode.window.showErrorMessage('プロンプトの読み込みに失敗しました。');
    } finally {
      this._setLoading(false);
    }
  }

  /**
   * プロンプト一覧の読み込み
   */
  private async _loadPrompts(): Promise<void> {
    this._setLoading(true);

    try {
      // フィルタリング条件の設定
      const filters: any = {};
      
      const selectedCategory = this._categoryManager.getSelectedCategory();
      if (selectedCategory) {
        filters.category = selectedCategory;
      }
      
      // プロンプト一覧を取得
      const prompts = await this._apiClient.getPrompts(filters);
      this._currentPrompts = prompts;
      
      // 検索フィルタリングを適用（検索クエリがある場合）
      let filteredPrompts = this._currentPrompts;
      if (this._searchQuery) {
        const query = this._searchQuery.toLowerCase();
        filteredPrompts = this._currentPrompts.filter(p => 
          p.title.toLowerCase().includes(query) || 
          p.content.toLowerCase().includes(query) ||
          (p.tags && p.tags.some(tag => tag.toLowerCase().includes(query)))
        );
      }
      
      // Webviewに通知
      this._panel.webview.postMessage({
        type: 'promptList',
        prompts: filteredPrompts,
        categories: this._categoryManager.getCategories(),
        selectedCategory: this._categoryManager.getSelectedCategory(),
        searchQuery: this._searchQuery
      });
    } catch (error) {
      console.error('プロンプト一覧の読み込みに失敗しました:', error);
      vscode.window.showErrorMessage('プロンプト一覧の取得に失敗しました。');
      
      // エラー通知
      this._panel.webview.postMessage({
        type: 'error',
        message: 'プロンプト一覧の取得に失敗しました。'
      });
    } finally {
      this._setLoading(false);
    }
  }

  /**
   * ローディング状態の設定
   */
  private _setLoading(isLoading: boolean): void {
    this._isLoading = isLoading;
    
    this._panel.webview.postMessage({
      type: 'loading',
      isLoading
    });
  }

  /**
   * Webviewからのメッセージハンドリング
   */
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'init':
        // 初期データの再読み込み
        await this._loadInitialData();
        break;
        
      case 'selectPrompt':
        // プロンプトの選択
        if (message.promptId) {
          await this._handleEditorModeChange({
            mode: 'view',
            promptId: message.promptId
          });
        }
        break;
        
      case 'editPrompt':
        // プロンプトの編集
        if (message.promptId) {
          await this._handleEditorModeChange({
            mode: 'edit',
            promptId: message.promptId
          });
        }
        break;
        
      case 'createPrompt':
        // 新規プロンプト作成
        await this._handleEditorModeChange({
          mode: 'create'
        });
        break;
        
      case 'savePrompt':
        // プロンプトの保存
        if (message.promptData) {
          const success = await this._promptEditor.savePrompt(message.promptData);
          
          if (success) {
            // 保存成功後、プロンプト一覧を再読み込み
            await this._loadPrompts();
            
            // Webviewに通知
            this._panel.webview.postMessage({
              type: 'promptSaved',
              prompt: this._promptEditor.getCurrentPrompt()
            });
          }
        }
        break;
        
      case 'cancelEdit':
        // 編集キャンセル
        await this._loadPrompts();
        
        // Webviewに通知
        this._panel.webview.postMessage({
          type: 'promptEditor',
          action: 'cancel'
        });
        break;
        
      case 'filterByCategory':
        // カテゴリでフィルタリング
        this._categoryManager.setSelectedCategory(message.category);
        await this._loadPrompts();
        break;
        
      case 'search':
        // 検索
        this._searchQuery = message.query || '';
        await this._loadPrompts();
        break;
        
      case 'exportPrompt':
        // プロンプトのエクスポート
        if (message.promptData) {
          await this._promptImportExport.exportPromptToMarkdown(message.promptData);
        }
        break;
        
      case 'exportAllPrompts':
        // すべてのプロンプトのエクスポート
        await this._promptImportExport.exportPrompts();
        break;
        
      case 'importPrompts':
        // プロンプトのインポート
        await this._promptImportExport.importPrompts();
        // インポート後にプロンプト一覧を再読み込み
        await this._loadPrompts();
        break;
    }
  }

  /**
   * パネル廃棄時の処理
   */
  public dispose(): void {
    PromptLibraryPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Webview用のHTML生成
   */
  private _getHtmlForWebview(extensionUri: vscode.Uri): string {
    // スタイルシートとスクリプトのURIを取得
    const styleUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'webviews', 'promptLibrary', 'style.css')
    );
    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'webviews', 'promptLibrary', 'script.js')
    );

    // コンテンツセキュリティポリシーの設定
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>プロンプトライブラリ</title>
    </head>
    <body>
      <div class="container">
        <div class="sidebar">
          <div class="search-box">
            <input type="text" id="searchInput" placeholder="プロンプトを検索...">
            <button id="searchButton">検索</button>
          </div>
          
          <div class="category-filter">
            <h3>カテゴリ</h3>
            <div id="categoryList">
              <div class="category-item selected" data-category="">すべて</div>
              <!-- カテゴリ一覧がここに動的に追加されます -->
            </div>
          </div>
          
          <div class="action-buttons">
            <button id="createPromptBtn">新規プロンプト</button>
            <button id="importBtn">インポート</button>
            <button id="exportAllBtn">すべてエクスポート</button>
          </div>
        </div>
        
        <div class="content">
          <div id="promptListView">
            <h2>プロンプト一覧</h2>
            <div id="promptList">
              <!-- プロンプト一覧がここに動的に追加されます -->
              <div class="loading-message">読み込み中...</div>
            </div>
          </div>
          
          <div id="promptEditorView" style="display: none;">
            <div class="editor-header">
              <h2 id="editorTitle">プロンプト詳細</h2>
              <div class="editor-actions">
                <button id="saveBtn" style="display: none;">保存</button>
                <button id="editBtn" style="display: none;">編集</button>
                <button id="exportBtn" style="display: none;">エクスポート</button>
                <button id="cancelBtn">戻る</button>
              </div>
            </div>
            
            <div class="editor-form">
              <div class="form-group">
                <label for="promptTitle">タイトル</label>
                <input type="text" id="promptTitle" placeholder="プロンプトのタイトル" disabled>
              </div>
              
              <div class="form-group">
                <label for="promptType">タイプ</label>
                <select id="promptType" disabled>
                  <option value="system">システム</option>
                  <option value="user">ユーザー</option>
                  <option value="assistant">アシスタント</option>
                  <option value="template">テンプレート</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="promptCategory">カテゴリ</label>
                <input type="text" id="promptCategory" placeholder="カテゴリ" disabled>
              </div>
              
              <div class="form-group">
                <label for="promptTags">タグ（カンマ区切り）</label>
                <input type="text" id="promptTags" placeholder="タグ1, タグ2, ..." disabled>
              </div>
              
              <div class="form-group">
                <label for="promptContent">内容</label>
                <textarea id="promptContent" placeholder="プロンプトの内容" rows="10" disabled></textarea>
              </div>
              
              <div class="form-group">
                <label>
                  <input type="checkbox" id="promptPublic" disabled>
                  公開する
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
      
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  /**
   * CSP用のランダムなnonceを生成
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}