import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ReferenceStorageService, ReferenceType, Reference } from '../../services/referenceStorageService';
import { Logger } from '../../utils/logger';
import { PlatformManager } from '../../utils/PlatformManager';

/**
 * リファレンスマネージャーパネル
 * テキストや画像を入力して、自動的に分類・保存するUI
 */
export class ReferenceManagerPanel {
  public static readonly viewType = 'appgenius.referenceManager';
  
  private static instance: ReferenceManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _projectPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _storageService: ReferenceStorageService;
  
  /**
   * パネルシングルトンの作成
   * @param extensionUri 拡張機能のURI
   * @param projectPath プロジェクトパス
   */
  public static createOrShow(extensionUri: vscode.Uri, projectPath: string): ReferenceManagerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    
    // 既存のパネルがあれば再利用
    if (ReferenceManagerPanel.instance) {
      ReferenceManagerPanel.instance._panel.reveal(column);
      return ReferenceManagerPanel.instance;
    }
    
    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      ReferenceManagerPanel.viewType,
      'リファレンスマネージャー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'media', 'referenceManager'),
          vscode.Uri.file(path.join(projectPath, 'media', 'references'))
        ],
        retainContextWhenHidden: true
      }
    );
    
    ReferenceManagerPanel.instance = new ReferenceManagerPanel(panel, extensionUri, projectPath);
    return ReferenceManagerPanel.instance;
  }
  
  /**
   * コンストラクタ
   * @param panel WebViewパネル
   * @param extensionUri 拡張機能のURI
   * @param projectPath プロジェクトパス
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, projectPath: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._projectPath = projectPath;
    this._storageService = ReferenceStorageService.getInstance();
    
    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    // メッセージハンドラを設定
    this._panel.webview.onDidReceiveMessage(this._handleMessage.bind(this), null, this._disposables);
    
    // ストレージサービスを初期化してパネルを更新
    this._initialize();
  }
  
  /**
   * 初期化
   */
  private async _initialize(): Promise<void> {
    try {
      // ストレージサービスを初期化
      await this._storageService.initialize(this._projectPath);
      
      // WebViewを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('リファレンスマネージャーの初期化に失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスマネージャーの初期化に失敗しました');
    }
  }
  
  /**
   * WebViewを更新
   */
  private _updateWebview(): void {
    // WebViewスクリプトのURI
    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'referenceManager.js')
    );
    
    // WebViewスタイルのURI
    const styleUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'referenceManager.css')
    );
    
    // リセットCSSのURI
    const resetUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    
    // VSCodeスタイルのURI
    const vscodeUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    
    // アイコンのURI
    const iconUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg')
    );
    
    // リファレンス一覧を取得
    const references = this._storageService.getAllReferences();
    
    // リファレンスをタイプごとに分類
    const apiRefs = this._storageService.getReferencesByType(ReferenceType.API);
    const codeRefs = this._storageService.getReferencesByType(ReferenceType.Code);
    const envRefs = this._storageService.getReferencesByType(ReferenceType.Environment);
    const docRefs = this._storageService.getReferencesByType(ReferenceType.Documentation);
    const screenshotRefs = this._storageService.getReferencesByType(ReferenceType.Screenshot);
    
    // すべてのタグを収集
    const allTags = new Set<string>();
    references.forEach(ref => {
      ref.tags.forEach(tag => allTags.add(tag));
    });
    
    // HTMLを構築
    const html = `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>リファレンスマネージャー</title>
      <link href="${resetUri}" rel="stylesheet">
      <link href="${vscodeUri}" rel="stylesheet">
      <link href="${styleUri}" rel="stylesheet">
      <script>
        // 初期状態
        const initialState = {
          references: ${JSON.stringify(references)},
          apiRefs: ${JSON.stringify(apiRefs)},
          codeRefs: ${JSON.stringify(codeRefs)},
          envRefs: ${JSON.stringify(envRefs)},
          docRefs: ${JSON.stringify(docRefs)},
          screenshotRefs: ${JSON.stringify(screenshotRefs)},
          tags: Array.from(${JSON.stringify(Array.from(allTags))})
        };
        
        // VSCode APIの取得は1回だけ行うようscriptタグで分離
        // (acquireVsCodeApi()は1度しか呼び出せないため)
      </script>
      <script>
        // WebViewとVS Codeの通信用 - メインスクリプトより前に実行
        try {
          const vscode = acquireVsCodeApi();
          // 状態を保存
          vscode.setState(initialState);
        } catch (e) {
          console.error('VSCode API初期化エラー:', e);
        }
      </script>
    </head>
    <body>
      <div class="reference-manager">
        <header class="reference-header">
          <div class="logo">
            <img src="${iconUri}" alt="AppGenius" width="32" height="32">
            <h1>リファレンスマネージャー</h1>
          </div>
          <div class="header-actions">
            <button id="refresh-button" class="button">更新</button>
          </div>
        </header>
        
        <main class="reference-content">
          <div class="reference-sidebar">
            <div class="reference-categories">
              <h2>カテゴリ</h2>
              <ul class="category-list">
                <li class="category-item active" data-category="all">
                  <span class="category-name">すべて</span>
                  <span class="category-count">${references.length}</span>
                </li>
                <li class="category-item" data-category="api">
                  <span class="category-name">API</span>
                  <span class="category-count">${apiRefs.length}</span>
                </li>
                <li class="category-item" data-category="code">
                  <span class="category-name">コードスニペット</span>
                  <span class="category-count">${codeRefs.length}</span>
                </li>
                <li class="category-item" data-category="env">
                  <span class="category-name">環境設定</span>
                  <span class="category-count">${envRefs.length}</span>
                </li>
                <li class="category-item" data-category="doc">
                  <span class="category-name">ドキュメント</span>
                  <span class="category-count">${docRefs.length}</span>
                </li>
                <li class="category-item" data-category="screenshot">
                  <span class="category-name">スクリーンショット</span>
                  <span class="category-count">${screenshotRefs.length}</span>
                </li>
              </ul>
            </div>
            
            <div class="reference-tags">
              <h2>タグ</h2>
              <div class="tag-list">
                ${Array.from(allTags).map(tag => `
                  <div class="tag-item" data-tag="${tag}">
                    ${tag}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="reference-main">
            <div class="reference-input-section">
              <div class="input-header">
                <h2>新規リファレンス追加</h2>
                <div class="input-tabs">
                  <button class="tab-button active" data-tab="text">テキスト</button>
                  <button class="tab-button" data-tab="image">画像</button>
                </div>
              </div>
              
              <div class="input-container">
                <!-- テキスト入力タブ -->
                <div class="input-tab-content active" id="text-input">
                  <div class="input-field">
                    <label for="reference-title">タイトル</label>
                    <input type="text" id="reference-title" placeholder="自動検出されない場合のタイトル（任意）">
                  </div>
                  
                  <div class="input-field">
                    <label for="reference-content">リファレンス内容</label>
                    <textarea id="reference-content" placeholder="ここにテキストを入力またはコピー＆ペーストしてください。AI が自動的にカテゴリとタグを検出します。"></textarea>
                  </div>
                  
                  <div class="input-field">
                    <label for="reference-type">タイプ</label>
                    <select id="reference-type">
                      <option value="auto">自動検出</option>
                      <option value="api">API</option>
                      <option value="code">コードスニペット</option>
                      <option value="environment">環境設定</option>
                      <option value="documentation">ドキュメント</option>
                    </select>
                  </div>
                  
                  <div class="input-actions">
                    <button id="add-reference-button" class="button primary">追加</button>
                    <button id="clear-reference-button" class="button">クリア</button>
                  </div>
                </div>
                
                <!-- 画像入力タブ - 初期状態では非表示 -->
                <div class="input-tab-content" id="image-input" style="display: none;">
                  <div class="image-upload-area" id="image-drop-area">
                    <div class="upload-icon">📷</div>
                    <p>ここに画像をドラッグ＆ドロップするか、クリックして選択</p>
                    <input type="file" id="image-file-input" accept="image/*" style="display:none;">
                  </div>
                  
                  <div class="preview-image-container" id="preview-image-container" style="display:none;">
                    <img id="preview-image" src="" alt="プレビュー">
                    <button id="remove-image-button" class="button">削除</button>
                  </div>
                  
                  <div class="input-field">
                    <label for="image-title">タイトル</label>
                    <input type="text" id="image-title" placeholder="スクリーンショットのタイトル">
                  </div>
                  
                  <div class="input-field">
                    <label for="image-description">説明</label>
                    <textarea id="image-description" placeholder="スクリーンショットの説明"></textarea>
                  </div>
                  
                  <div class="input-actions">
                    <button id="add-image-button" class="button primary" disabled>追加</button>
                    <button id="clear-image-button" class="button">クリア</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="reference-list-section">
              <div class="list-header">
                <h2>リファレンス一覧</h2>
                <div class="list-actions">
                  <input type="text" id="search-input" placeholder="リファレンスを検索">
                </div>
              </div>
              
              <div class="reference-list" id="reference-list">
                ${references.map(ref => this._generateReferenceItem(ref)).join('')}
              </div>
            </div>
          </div>
        </main>
        
        <div class="reference-detail-overlay" id="reference-detail-overlay">
          <div class="reference-detail-container">
            <div class="detail-header">
              <h2 id="detail-title"></h2>
              <button id="close-detail-button" class="button">閉じる</button>
            </div>
            
            <div class="detail-content" id="detail-content"></div>
            
            <div class="detail-meta">
              <div class="detail-tags" id="detail-tags"></div>
              <div class="detail-date" id="detail-date"></div>
            </div>
            
            <div class="detail-actions">
              <button id="edit-reference-button" class="button">編集</button>
              <button id="delete-reference-button" class="button danger">削除</button>
            </div>
          </div>
        </div>
      </div>
      
      <script src="${scriptUri}"></script>
    </body>
    </html>`;
    
    // WebViewを設定
    this._panel.webview.html = html;
  }
  
  /**
   * リファレンス項目のHTMLを生成
   * @param reference リファレンス
   */
  private _generateReferenceItem(reference: Reference): string {
    const date = new Date(reference.updatedAt).toLocaleString('ja-JP');
    const tags = reference.tags.map(tag => `<span class="item-tag">${tag}</span>`).join('');
    
    // リファレンスタイプに基づいてアイコンを選択
    let typeIcon = '';
    switch (reference.type) {
      case ReferenceType.API:
        typeIcon = '🔌';
        break;
      case ReferenceType.Code:
        typeIcon = '📝';
        break;
      case ReferenceType.Environment:
        typeIcon = '⚙️';
        break;
      case ReferenceType.Screenshot:
        typeIcon = '📷';
        break;
      default:
        typeIcon = '📄';
        break;
    }
    
    return `
    <div class="reference-item" data-id="${reference.id}" data-type="${reference.type}">
      <div class="item-icon">${typeIcon}</div>
      <div class="item-content">
        <div class="item-title">${reference.title}</div>
        <div class="item-preview">${this._getContentPreview(reference.content)}</div>
        <div class="item-meta">
          <div class="item-tags">${tags}</div>
          <div class="item-date">${date}</div>
        </div>
      </div>
    </div>
    `;
  }
  
  /**
   * コンテンツのプレビューを取得
   * @param content コンテンツ
   */
  private _getContentPreview(content: string): string {
    const maxLength = 100;
    let preview = content.substring(0, maxLength).replace(/\n/g, ' ');
    if (content.length > maxLength) {
      preview += '...';
    }
    return preview;
  }
  
  /**
   * WebViewからのメッセージを処理
   * @param message メッセージ
   */
  private async _handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'addReference':
        await this._addReference(message.content, message.title, message.type);
        break;
      
      case 'addImageReference':
        await this._addImageReference(message.imagePath, message.title, message.description);
        break;
      
      case 'updateReference':
        await this._updateReference(message.id, message.updates);
        break;
      
      case 'deleteReference':
        await this._deleteReference(message.id);
        break;
      
      case 'searchReferences':
        this._searchReferences(message.query);
        break;
      
      case 'filterByType':
        this._filterByType(message.type);
        break;
      
      case 'filterByTag':
        this._filterByTag(message.tag);
        break;
      
      case 'refresh':
        await this._refresh();
        break;
      
      case 'saveImage':
        await this._saveImage(message.imageData);
        return;
    }
  }
  
  /**
   * リファレンスを追加
   * @param content コンテンツ
   * @param title タイトル
   * @param type タイプ
   */
  private async _addReference(content: string, title?: string, type?: string): Promise<void> {
    try {
      // タイプを変換
      let referenceType: ReferenceType | undefined;
      if (type && type !== 'auto') {
        switch (type) {
          case 'api':
            referenceType = ReferenceType.API;
            break;
          case 'code':
            referenceType = ReferenceType.Code;
            break;
          case 'environment':
            referenceType = ReferenceType.Environment;
            break;
          case 'documentation':
            referenceType = ReferenceType.Documentation;
            break;
          case 'screenshot':
            referenceType = ReferenceType.Screenshot;
            break;
        }
      }
      
      // リファレンスを追加
      await this._storageService.addReference(content, title, referenceType);
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage('リファレンスを追加しました');
      
      // パネルを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('リファレンスの追加に失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスの追加に失敗しました');
    }
  }
  
  /**
   * 画像リファレンスを追加
   * @param imagePath 画像パス
   * @param title タイトル
   * @param description 説明
   */
  private async _addImageReference(imagePath: string, title: string, description: string): Promise<void> {
    try {
      // リファレンスを追加
      await this._storageService.addImageReference(imagePath, title, description);
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage('画像リファレンスを追加しました');
      
      // パネルを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('画像リファレンスの追加に失敗しました', error as Error);
      vscode.window.showErrorMessage('画像リファレンスの追加に失敗しました');
    }
  }
  
  /**
   * 画像を保存
   * @param imageData 画像データ
   */
  private async _saveImage(imageData: string): Promise<void> {
    try {
      // Base64データからバイナリに変換
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 一時ファイルに保存
      const tempImagePath = path.join(this._projectPath, 'media', 'references', `temp_${Date.now()}.png`);
      
      // ディレクトリが存在するか確認
      const dir = path.dirname(tempImagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // ファイルに書き込む
      fs.writeFileSync(tempImagePath, buffer);
      
      // ファイルパスを返す
      this._panel.webview.postMessage({
        command: 'imageSaved',
        imagePath: tempImagePath
      });
    } catch (error) {
      Logger.error('画像の保存に失敗しました', error as Error);
      vscode.window.showErrorMessage('画像の保存に失敗しました');
    }
  }
  
  /**
   * リファレンスを更新
   * @param id リファレンスID
   * @param updates 更新内容
   */
  private async _updateReference(id: string, updates: Partial<Reference>): Promise<void> {
    try {
      // リファレンスを更新
      await this._storageService.updateReference(id, updates);
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage('リファレンスを更新しました');
      
      // パネルを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('リファレンスの更新に失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスの更新に失敗しました');
    }
  }
  
  /**
   * リファレンスを削除
   * @param id リファレンスID
   */
  private async _deleteReference(id: string): Promise<void> {
    try {
      // 確認ダイアログを表示
      const result = await vscode.window.showWarningMessage(
        'このリファレンスを削除しますか？',
        '削除',
        'キャンセル'
      );
      
      if (result !== '削除') {
        return;
      }
      
      // リファレンスを削除
      await this._storageService.deleteReference(id);
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage('リファレンスを削除しました');
      
      // パネルを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('リファレンスの削除に失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスの削除に失敗しました');
    }
  }
  
  /**
   * リファレンスを検索
   * @param query 検索クエリ
   */
  private _searchReferences(query: string): void {
    try {
      // リファレンスを検索
      const results = this._storageService.searchReferences(query);
      
      // 検索結果をポストバック
      this._panel.webview.postMessage({
        command: 'searchResults',
        results
      });
    } catch (error) {
      Logger.error('リファレンスの検索に失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスの検索に失敗しました');
    }
  }
  
  /**
   * タイプでフィルタリング
   * @param type タイプ
   */
  private _filterByType(type: string): void {
    try {
      let results: Reference[];
      
      if (type === 'all') {
        // すべてのリファレンスを取得
        results = this._storageService.getAllReferences();
      } else {
        // 特定タイプのリファレンスを取得
        let referenceType: ReferenceType;
        switch (type) {
          case 'api':
            referenceType = ReferenceType.API;
            break;
          case 'code':
            referenceType = ReferenceType.Code;
            break;
          case 'env':
            referenceType = ReferenceType.Environment;
            break;
          case 'doc':
            referenceType = ReferenceType.Documentation;
            break;
          case 'screenshot':
            referenceType = ReferenceType.Screenshot;
            break;
          default:
            throw new Error(`不明なリファレンスタイプ: ${type}`);
        }
        
        results = this._storageService.getReferencesByType(referenceType);
      }
      
      // フィルタリング結果をポストバック
      this._panel.webview.postMessage({
        command: 'filterResults',
        results
      });
    } catch (error) {
      Logger.error('リファレンスのフィルタリングに失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスのフィルタリングに失敗しました');
    }
  }
  
  /**
   * タグでフィルタリング
   * @param tag タグ
   */
  private _filterByTag(tag: string): void {
    try {
      // タグでリファレンスを取得
      const results = this._storageService.getReferencesByTag(tag);
      
      // フィルタリング結果をポストバック
      this._panel.webview.postMessage({
        command: 'filterResults',
        results
      });
    } catch (error) {
      Logger.error('リファレンスのタグフィルタリングに失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスのタグフィルタリングに失敗しました');
    }
  }
  
  /**
   * 更新
   */
  private async _refresh(): Promise<void> {
    try {
      // ストレージサービスを再初期化
      await this._storageService.initialize(this._projectPath);
      
      // WebViewを更新
      this._updateWebview();
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage('リファレンスマネージャーを更新しました');
    } catch (error) {
      Logger.error('リファレンスマネージャーの更新に失敗しました', error as Error);
      vscode.window.showErrorMessage('リファレンスマネージャーの更新に失敗しました');
    }
  }
  
  /**
   * 破棄
   */
  public dispose(): void {
    ReferenceManagerPanel.instance = undefined;
    
    this._panel.dispose();
    
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}