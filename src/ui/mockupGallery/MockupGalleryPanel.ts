import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { MockupStorageService, Mockup } from '../../services/mockupStorageService';
import { RequirementsParser, PageInfo } from '../../core/requirementsParser';
import { MockupQueueManager } from './MockupQueueManager';

/**
 * モックアップギャラリーパネル
 * モックアップの一覧表示、編集、プレビューを提供するウェブビューパネル
 */
export class MockupGalleryPanel {
  public static currentPanel: MockupGalleryPanel | undefined;
  private static readonly viewType = 'mockupGallery';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _aiService: AIService;
  private _storage: MockupStorageService;
  private _queueManager: MockupQueueManager;
  
  // 追加
  private _projectPath: string;
  private _requirementsPath: string;
  private _structurePath: string;

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string): MockupGalleryPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (MockupGalleryPanel.currentPanel) {
      MockupGalleryPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが異なる場合は更新
      if (projectPath && MockupGalleryPanel.currentPanel._projectPath !== projectPath) {
        MockupGalleryPanel.currentPanel._updateProjectPath(projectPath);
      }
      
      return MockupGalleryPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      MockupGalleryPanel.viewType,
      'モックアップギャラリー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    MockupGalleryPanel.currentPanel = new MockupGalleryPanel(panel, extensionUri, aiService, projectPath);
    return MockupGalleryPanel.currentPanel;
  }

  /**
   * 特定のモックアップを選択した状態で開く
   */
  public static openWithMockup(extensionUri: vscode.Uri, aiService: AIService, mockupId: string, projectPath?: string): MockupGalleryPanel {
    const panel = MockupGalleryPanel.createOrShow(extensionUri, aiService, projectPath);
    panel._loadAndSelectMockup(mockupId);
    return panel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService, projectPath?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    this._storage = MockupStorageService.getInstance();
    this._queueManager = new MockupQueueManager(aiService);
    
    // プロジェクトパスの設定
    this._projectPath = projectPath || this._getDefaultProjectPath();
    this._requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
    this._structurePath = path.join(this._projectPath, 'docs', 'structure.md');
    
    // ストレージサービスのパス初期化
    if (projectPath) {
      this._storage.initializeWithPath(projectPath);
    }
    
    // キューマネージャーのコールバック設定
    this._queueManager.setOnProgressCallback((queued, processing, completed, total) => {
      this._panel.webview.postMessage({
        command: 'updateQueueStatus',
        status: { queued, processing, completed, total }
      });
    });
    
    this._queueManager.setOnCompletedCallback((mockupId, pageInfo) => {
      this._panel.webview.postMessage({
        command: 'mockupGenerated',
        mockupId,
        pageName: pageInfo.name
      });
    });

    // WebViewの内容を設定
    this._update();

    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'loadMockups':
            await this._handleLoadMockups();
            break;
          case 'updateMockup':
            await this._handleUpdateMockup(message.mockupId, message.text);
            break;
          case 'openInBrowser':
            await this._handleOpenInBrowser(message.mockupId);
            break;
          case 'deleteMockup':
            await this._handleDeleteMockup(message.mockupId);
            break;
          case 'importMockup':
            await this._handleImportMockup();
            break;
          // 追加コマンド
          case 'generateAllMockups':
            await this._handleGenerateAllMockups();
            break;
          case 'updateMockupStatus':
            await this._handleUpdateMockupStatus(message.mockupId, message.status);
            break;
          case 'saveImplementationNotes':
            await this._handleSaveImplementationNotes(message.mockupId, message.notes);
            break;
          case 'addFeedback':
            await this._handleAddFeedback(message.mockupId, message.feedback);
            break;
        }
      },
      null,
      this._disposables
    );

    Logger.info('モックアップギャラリーパネルを作成しました');
  }
  
  /**
   * プロジェクトパスを更新
   */
  private _updateProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
    this._structurePath = path.join(this._projectPath, 'docs', 'structure.md');
    
    // ストレージサービスのパス初期化
    this._storage.initializeWithPath(projectPath);
    
    // モックアップを再読み込み
    this._handleLoadMockups();
    
    Logger.info(`プロジェクトパスを更新しました: ${projectPath}`);
  }
  
  /**
   * デフォルトのプロジェクトパスを取得
   */
  private _getDefaultProjectPath(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0 
      ? workspaceFolders[0].uri.fsPath 
      : process.cwd();
  }
  
  /**
   * 要件定義・ディレクトリ構造からページ一覧を取得
   */
  private async _extractPagesFromRequirements(): Promise<PageInfo[]> {
    try {
      let pages: PageInfo[] = [];
      
      // 要件定義からページを抽出
      if (fs.existsSync(this._requirementsPath)) {
        const reqPages = await RequirementsParser.extractPagesFromRequirements(this._requirementsPath);
        pages = [...pages, ...reqPages];
      }
      
      // ディレクトリ構造からページを抽出
      if (fs.existsSync(this._structurePath)) {
        const structPages = await RequirementsParser.extractPagesFromStructure(this._structurePath);
        
        // 重複を排除して追加
        structPages.forEach(page => {
          if (!pages.some(p => p.name === page.name)) {
            pages.push(page);
          }
        });
      }
      
      return pages;
    } catch (error) {
      Logger.error(`ページ抽出エラー: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * モックアップの読み込み処理
   */
  private async _handleLoadMockups(): Promise<void> {
    try {
      const mockups = this._storage.getAllMockups();
      this._panel.webview.postMessage({
        command: 'updateMockups',
        mockups
      });
      Logger.info(`${mockups.length}個のモックアップを読み込みました`);
    } catch (error) {
      Logger.error('モックアップ読み込みエラー', error as Error);
      this._showError('モックアップの読み込みに失敗しました');
    }
  }

  /**
   * 特定のモックアップを読み込んで選択
   */
  private async _loadAndSelectMockup(mockupId: string): Promise<void> {
    try {
      // まずすべてのモックアップを読み込む
      await this._handleLoadMockups();
      
      // 特定のモックアップを選択するメッセージを送信
      const mockup = this._storage.getMockup(mockupId);
      if (mockup) {
        this._panel.webview.postMessage({
          command: 'selectMockup',
          mockupId
        });
        Logger.info(`モックアップを選択: ${mockupId}`);
      }
    } catch (error) {
      Logger.error(`モックアップ選択エラー: ${mockupId}`, error as Error);
    }
  }

  /**
   * モックアップの更新処理
   */
  private async _handleUpdateMockup(mockupId: string, text: string): Promise<void> {
    try {
      const mockup = this._storage.getMockup(mockupId);
      if (!mockup) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }

      // AIにフィードバックを送信してモックアップを更新
      const updatedHtml = await this._aiService.updateMockupWithFeedback(mockup.html, text);
      
      if (!updatedHtml) {
        throw new Error('更新用のHTMLコードが見つかりませんでした');
      }
      
      // モックアップを更新
      const updatedMockup = await this._storage.updateMockup(mockupId, {
        html: updatedHtml
      });
      
      if (!updatedMockup) {
        throw new Error('モックアップの更新に失敗しました');
      }
      
      // フィードバックを保存
      await this._storage.addFeedback(mockupId, text);
      
      // 更新成功メッセージをWebViewに送信
      this._panel.webview.postMessage({
        command: 'mockupUpdated',
        mockup: updatedMockup,
        text: `モックアップを更新しました：${text}`
      });
      
      Logger.info(`モックアップを更新しました: ${mockupId}`);
    } catch (error) {
      Logger.error(`モックアップ更新エラー: ${(error as Error).message}`);
      this._showError(`モックアップの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップをブラウザで開く
   */
  private async _handleOpenInBrowser(mockupId: string): Promise<void> {
    try {
      const mockup = this._storage.getMockup(mockupId);
      if (!mockup) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }
      
      // 一時ファイルに保存
      const tempDir = path.join(this._getTempDir(), 'mockup-preview');
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `preview-${mockupId}.html`);
      fs.writeFileSync(tempFile, mockup.html, 'utf8');
      
      // ブラウザで開く
      await vscode.env.openExternal(vscode.Uri.file(tempFile));
      
      Logger.info(`モックアップをブラウザで開きました: ${mockupId}`);
    } catch (error) {
      Logger.error(`ブラウザ表示エラー: ${(error as Error).message}`);
      this._showError(`モックアップのブラウザ表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップの削除
   */
  private async _handleDeleteMockup(mockupId: string): Promise<void> {
    try {
      const success = await this._storage.deleteMockup(mockupId);
      
      if (success) {
        // 削除成功をWebViewに通知（awaitを使用しない）
        this._panel.webview.postMessage({
          command: 'mockupDeleted',
          mockupId
        });
        
        Logger.info(`モックアップを削除しました: ${mockupId}`);
      } else {
        throw new Error('モックアップの削除に失敗しました');
      }
    } catch (error) {
      Logger.error(`モックアップ削除エラー: ${(error as Error).message}`);
      this._showError(`モックアップの削除に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * HTMLファイルを直接ロードして表示
   * @param filePath HTMLファイルのパス
   */
  public async loadHtmlFile(filePath: string): Promise<void> {
    try {
      // 既存のモックアップをロードするか、新規にインポートする
      const mockup = await this._storage.getMockupByFilePath(filePath);
      
      if (mockup) {
        // モックアップが存在する場合はそれを表示
        this._loadAndSelectMockup(mockup.id);
        this._panel.webview.postMessage({
          command: 'addAssistantMessage',
          text: `HTMLファイルをロードしました: ${path.basename(filePath)}`
        });
        Logger.info(`HTMLファイルをロードしました: ${filePath}`);
      } else {
        this._showError(`HTMLファイルのロードに失敗しました: ${filePath}`);
      }
    } catch (error) {
      Logger.error(`HTMLファイルロードエラー: ${(error as Error).message}`);
      this._showError(`HTMLファイルのロードに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * HTMLコンテンツを直接表示（IDなしで表示）
   * @param html HTMLコンテンツ
   * @param title 表示タイトル
   */
  public displayHtmlContent(html: string, title: string = 'プレビュー'): void {
    // WebViewにメッセージを送信
    this._panel.webview.postMessage({
      command: 'displayDirectHtml',
      html: html,
      title: title
    });
    
    Logger.info(`HTMLコンテンツを直接表示: ${title}`);
  }

  /**
   * モックアップのインポート
   */
  private async _handleImportMockup(): Promise<void> {
    try {
      // HTMLファイル選択ダイアログを表示
      const fileUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'HTML Files': ['html', 'htm']
        },
        title: 'インポートするHTMLファイルを選択'
      });
      
      if (!fileUris || fileUris.length === 0) {
        return;
      }
      
      const filePath = fileUris[0].fsPath;
      
      // HTMLファイルを読み込む
      const html = fs.readFileSync(filePath, 'utf8');
      
      // ファイル名からモックアップ名を取得
      const fileName = path.basename(filePath);
      const mockupName = fileName.replace(/\.[^/.]+$/, ''); // 拡張子を削除
      
      // モックアップを保存
      const mockupId = await this._storage.saveMockup(
        { html },
        {
          name: mockupName,
          sourceType: 'imported',
          description: `インポート元: ${filePath}`
        }
      );
      
      // モックアップリストを更新
      await this._handleLoadMockups();
      
      // インポートしたモックアップを選択
      await this._loadAndSelectMockup(mockupId);
      
      // 成功メッセージをWebViewに送信
      this._panel.webview.postMessage({
        command: 'addAssistantMessage',
        text: `モックアップ「${mockupName}」をインポートしました。`
      });
      
      Logger.info(`モックアップをインポートしました: ${filePath} -> ${mockupId}`);
    } catch (error) {
      Logger.error(`モックアップインポートエラー: ${(error as Error).message}`);
      this._showError(`モックアップのインポートに失敗しました: ${(error as Error).message}`);
    }
  }


  /**
   * 一時ディレクトリのパスを取得
   */
  private _getTempDir(): string {
    return process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  }

  /**
   * エラーメッセージの表示
   */
  private _showError(message: string): void {
    this._panel.webview.postMessage({
      command: 'showError',
      text: message
    });
  }

  /**
   * 全モックアップ生成処理
   */
  private async _handleGenerateAllMockups(): Promise<void> {
    try {
      // 要件定義とディレクトリ構造からページを抽出
      const pages = await this._extractPagesFromRequirements();
      
      if (pages.length === 0) {
        this._showError('ページが見つかりませんでした。要件定義またはディレクトリ構造を確認してください。');
        return;
      }
      
      // 要件定義ファイルの内容を取得
      let requirementsText = '';
      if (fs.existsSync(this._requirementsPath)) {
        requirementsText = await fs.promises.readFile(this._requirementsPath, 'utf8');
      } else {
        this._showError('要件定義ファイルが見つかりません。');
        return;
      }
      
      // キューに追加
      await this._queueManager.addMultipleToQueue(pages, requirementsText);
      
      this._panel.webview.postMessage({
        command: 'addAssistantMessage',
        text: `${pages.length}ページのモックアップ生成をキューに追加しました。`
      });
      
      Logger.info(`${pages.length}ページのモックアップ生成をキューに追加しました`);
    } catch (error) {
      Logger.error(`モックアップ一括生成エラー: ${(error as Error).message}`);
      this._showError(`モックアップの一括生成に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * モックアップステータス更新処理
   */
  private async _handleUpdateMockupStatus(mockupId: string, status: string): Promise<void> {
    try {
      const updatedMockup = await this._storage.updateMockupStatus(mockupId, status);
      
      if (updatedMockup) {
        // ステータス更新の通知
        this._panel.webview.postMessage({
          command: 'mockupUpdated',
          mockup: updatedMockup,
          text: `モックアップのステータスを「${this._getStatusLabel(status)}」に更新しました`
        });
        
        Logger.info(`モックアップのステータスを更新しました: ${mockupId} -> ${status}`);
      } else {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }
    } catch (error) {
      Logger.error(`モックアップステータス更新エラー: ${(error as Error).message}`);
      this._showError(`モックアップのステータス更新に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 実装メモ保存処理
   */
  private async _handleSaveImplementationNotes(mockupId: string, notes: string): Promise<void> {
    try {
      const updatedMockup = await this._storage.saveImplementationNotes(mockupId, notes);
      
      if (updatedMockup) {
        // 保存成功の通知
        this._panel.webview.postMessage({
          command: 'mockupUpdated',
          mockup: updatedMockup,
          text: `実装メモを保存しました`
        });
        
        Logger.info(`実装メモを保存しました: ${mockupId}`);
      } else {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }
    } catch (error) {
      Logger.error(`実装メモ保存エラー: ${(error as Error).message}`);
      this._showError(`実装メモの保存に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * フィードバック追加処理
   */
  private async _handleAddFeedback(mockupId: string, feedback: string): Promise<void> {
    try {
      const updatedMockup = await this._storage.addFeedback(mockupId, feedback);
      
      if (updatedMockup) {
        // フィードバック追加の通知
        this._panel.webview.postMessage({
          command: 'mockupUpdated',
          mockup: updatedMockup,
          text: `フィードバックを追加しました`
        });
        
        Logger.info(`フィードバックを追加しました: ${mockupId}`);
      } else {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }
    } catch (error) {
      Logger.error(`フィードバック追加エラー: ${(error as Error).message}`);
      this._showError(`フィードバックの追加に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * ステータスラベルの取得
   */
  private _getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return '未生成';
      case 'generating': return '生成中';
      case 'review': return 'レビュー中';
      case 'approved': return '承認済み';
      default: return status;
    }
  }

  /**
   * WebViewを更新
   */
  private _update(): void {
    if (!this._panel.visible) {
      return;
    }

    this._panel.webview.html = this._getHtmlForWebview();
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // WebView内でのリソースへのパスを取得
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'mockupGallery.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'mockupGallery.css')
    );

    // コードアイコンを使用する場合のパス
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    // WebViewのHTMLを構築
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>モックアップギャラリー</title>
  <link href="${styleUri}" rel="stylesheet">
  <link href="${codiconsUri}" rel="stylesheet">
</head>
<body>
  <div class="app-container">
    <!-- 左側パネル - ページ一覧 -->
    <div class="pages-panel">
      <div class="panel-header">
        <h2 class="panel-title">モックアップ一覧</h2>
        <button id="generate-all-button" class="action-button">一括生成</button>
      </div>
      
      <div id="mockups-container" class="mockups-container">
        <!-- モックアップリストがここに表示されます -->
        <div class="empty-state">
          <p>モックアップを読み込み中...</p>
        </div>
      </div>
      
      <div class="queue-info">
        <p><strong>処理状況:</strong> 0件生成中 / 0件待機中</p>
        <p><strong>完了:</strong> 0/0 ページ</p>
      </div>
      
      <div class="panel-footer">
        <button id="import-button" class="secondary-button">HTMLをインポート</button>
        <button id="refresh-button" class="secondary-button">
          <span class="codicon codicon-refresh"></span>
        </button>
      </div>
    </div>
    
    <!-- 中央パネル - モックアップ表示 -->
    <div class="mockup-panel">
      <div class="mockup-toolbar">
        <div class="toolbar-left">
          <h3 class="mockup-title" id="preview-title">モックアップ</h3>
          <span class="page-status status-pending">未選択</span>
        </div>
        <div class="toolbar-right">
          <button id="open-in-browser-button" class="secondary-button">ブラウザで開く</button>
          <button id="show-html-button" class="secondary-button">HTML表示</button>
        </div>
      </div>
      
      <div class="mockup-display">
        <iframe id="mockup-frame" class="mockup-frame"></iframe>
        <pre id="html-code-display" style="display: none; width: 100%; height: 100%; overflow: auto; background: #f5f5f5; padding: 10px;"></pre>
      </div>
    </div>
    
    <!-- 右側パネル - チャット -->
    <div class="chat-panel">
      <div class="panel-header">
        <h2 class="panel-title">フィードバック</h2>
      </div>
      
      <div id="chat-history" class="chat-history">
        <!-- チャット履歴がここに表示されます -->
      </div>
      
      <div class="quick-commands">
        <div class="command-chip">ヘッダーの色を変更</div>
        <div class="command-chip">ボタンを右寄せに</div>
        <div class="command-chip">フォントサイズを大きく</div>
        <div class="command-chip">入力欄にバリデーション追加</div>
      </div>
      
      <div class="chat-input-container">
        <textarea id="chat-input" class="chat-input" placeholder="フィードバックを入力..."></textarea>
        <button id="send-button" class="send-button">
          <span class="codicon codicon-send"></span>
        </button>
      </div>
      
      <!-- 承認フロー -->
      <div class="approval-container">
        <h3 class="approval-title">実装メモ</h3>
        <textarea id="implementation-notes" class="implementation-notes" placeholder="実装時の注意点やポイントを記録..."></textarea>
        <div class="approval-actions">
          <button id="update-request-button" class="secondary-button">更新依頼</button>
          <button id="approve-button" class="action-button success-button">このモックアップを承認</button>
        </div>
      </div>
    </div>
  </div>
  
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    MockupGalleryPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}