import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '../../utils/logger';
import { MockupStorageService, Mockup } from '../../services/mockupStorageService';
// PageInfo インターフェース定義（requirementsParser.ts から移行）
interface PageInfo {
  name: string;
  path: string;
  description?: string;
  features?: string[];
}
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';
import { ClaudeCodeIntegrationService } from '../../services/ClaudeCodeIntegrationService';
import { ProtectedPanel } from '../auth/ProtectedPanel';
import { Feature } from '../../core/auth/roles';

/**
 * モックアップギャラリーパネル
 * モックアップの一覧表示、編集、プレビューを提供するウェブビューパネル
 * 権限保護されたパネルの基底クラスを継承
 */
export class MockupGalleryPanel extends ProtectedPanel {
  public static currentPanel: MockupGalleryPanel | undefined;
  private static readonly viewType = 'mockupGallery';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.MOCKUP_GALLERY;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _storage: MockupStorageService;
  
  // ファイル監視関連
  private _fileWatcher?: vscode.FileSystemWatcher; // モックアップファイル監視用
  private _projectServiceImpl: any; // ProjectServiceImplのインスタンス

  // ClaudeCodeランチャーをインポート
  private _claudeCodeLauncher: any; // 型定義がない場合は any として扱う

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  protected static _createOrShowPanel(extensionUri: vscode.Uri, projectPath?: string): MockupGalleryPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合
    if (MockupGalleryPanel.currentPanel) {
      // 既存パネルを表示
      MockupGalleryPanel.currentPanel._panel.reveal(column);
      
      // 現在のプロジェクトパスを取得
      const currentProjectPath = MockupGalleryPanel.currentPanel._getCurrentProjectPath();
      
      // プロジェクトパスが異なる場合は内容を更新
      if (projectPath && currentProjectPath !== projectPath) {
        Logger.info(`プロジェクトが変更されました。モックアップギャラリーの内容を更新: ${currentProjectPath} -> ${projectPath}`);
        
        // パネルのタイトルを更新
        MockupGalleryPanel.currentPanel._panel.title = `モックアップギャラリー: ${path.basename(projectPath)}`;
        
        // プロジェクトパスを更新して内容も更新
        MockupGalleryPanel.currentPanel._updateProjectPath(projectPath);
      } else if (projectPath) {
        // 同じプロジェクトでも内容を再ロード
        MockupGalleryPanel.currentPanel._handleLoadMockups();
      }
      
      return MockupGalleryPanel.currentPanel;
    }

    // パネルが存在しない場合は新規作成
    const panel = vscode.window.createWebviewPanel(
      MockupGalleryPanel.viewType,
      projectPath ? `モックアップギャラリー: ${path.basename(projectPath)}` : 'モックアップギャラリー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ],
        // モーダルダイアログを許可
        enableCommandUris: true
      }
    );

    MockupGalleryPanel.currentPanel = new MockupGalleryPanel(panel, extensionUri, projectPath);
    return MockupGalleryPanel.currentPanel;
  }
  
  /**
   * 外部向けのパネル作成・表示メソッド
   * 権限チェック付きで、パネルを表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, projectPath?: string): MockupGalleryPanel | undefined {
    // 権限チェック
    if (!this.checkPermissionForFeature(Feature.MOCKUP_GALLERY, 'MockupGalleryPanel')) {
      return undefined;
    }
    
    // 権限があれば表示
    return this._createOrShowPanel(extensionUri, projectPath);
  }

  /**
   * 特定のモックアップを選択した状態で開く
   */
  public static openWithMockup(extensionUri: vscode.Uri, mockupId: string, projectPath?: string): MockupGalleryPanel {
    const panel = MockupGalleryPanel.createOrShow(extensionUri, projectPath);
    
    // パネルが返された場合のみロード処理を実行
    if (panel) {
      panel._loadAndSelectMockup(mockupId);
    }
    
    return panel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, projectPath?: string) {
    super(); // 親クラスのコンストラクタを呼び出し
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._storage = MockupStorageService.getInstance();
    
    // ClaudeCodeランチャーの初期化
    this._claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
    
    // ProjectServiceImplのインスタンスを取得
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ProjectServiceImpl } = require('../../ui/scopeManager/services/implementations/ProjectServiceImpl');
      this._projectServiceImpl = ProjectServiceImpl.getInstance();
      Logger.info('ProjectServiceImplのインスタンスを取得しました');
    } catch (error) {
      Logger.warn('ProjectServiceImplのインスタンス取得に失敗しました', error as Error);
    }
    
    // プロジェクトパスの設定
    const initialProjectPath = projectPath || this._getDefaultProjectPath();
    
    // ストレージサービスを初期化
    this._storage.initializeWithPath(initialProjectPath);
    
    Logger.info(`モックアップギャラリーをプロジェクトパスで初期化: ${initialProjectPath}`);

    // WebViewの内容を設定
    this._update();
    
    // モックアップファイルの監視を設定
    this._setupFileWatcher();

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
          case 'openInBrowser':
            await this._handleOpenInBrowser(message.mockupId);
            break;
          case 'deleteMockup':
            await this._handleDeleteMockup(message.mockupId);
            break;
          case 'importMockup':
            await this._handleImportMockup();
            break;
        }
      },
      null,
      this._disposables
    );

    Logger.info('モックアップギャラリーパネルを作成しました');
  }
  
  /**
   * プロジェクトパスを更新（より強力な更新処理）
   */
  private _updateProjectPath(projectPath: string): void {
    // ProjectServiceImplが利用可能な場合はプロジェクトパスを更新
    if (this._projectServiceImpl) {
      try {
        // ProjectServiceImplを使ってプロジェクトを選択
        const projectName = path.basename(projectPath);
        this._projectServiceImpl.selectProject(projectName, projectPath);
        Logger.info(`ProjectServiceImplを使用してプロジェクトを選択: ${projectName}, ${projectPath}`);
      } catch (error) {
        Logger.warn(`ProjectServiceImplでのプロジェクト選択に失敗: ${error}`);
      }
    }
    
    // ストレージサービスを選択中のプロジェクトパスだけで初期化
    this._storage.initializeWithPath(projectPath);
    
    // UI表示の更新
    this._update();
    
    // モックアップを再読み込み (内容の更新)
    this._handleLoadMockups();
    
    // フレームを一時的にクリア (古いコンテンツがちらつくのを防止) - WebViewに依頼
    this._panel.webview.postMessage({
      command: 'clearMockupFrame',
      loadingMessage: '<html><body style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial; color: #666;">モックアップを読み込み中...</body></html>'
    });
    
    // Webviewにプロジェクト変更を通知
    this._panel.webview.postMessage({
      command: 'projectChanged',
      projectPath: projectPath,
      projectName: path.basename(projectPath)
    });
    
    // ファイル監視を再設定
    this._setupFileWatcher();
    
    Logger.info(`プロジェクトパスを更新しました: ${projectPath}`);
    
    // 強制的なUI更新のタイミングを微調整するため、短い遅延後に再度モックアップのリストを更新
    setTimeout(() => {
      this._handleLoadMockups();
    }, 100);
  }
  
  /**
   * デフォルトのプロジェクトパスを取得
   */
  /**
   * 現在のプロジェクトパスを取得するヘルパーメソッド
   * ProjectServiceImplを優先的に使用し、利用できない場合はフォールバック
   */
  private _getCurrentProjectPath(): string {
    // まずProjectServiceImplを使用してパスを取得
    if (this._projectServiceImpl) {
      try {
        const projectPath = this._projectServiceImpl.getActiveProjectPath();
        if (projectPath) {
          Logger.info(`ProjectServiceImplからプロジェクトパスを取得: ${projectPath}`);
          return projectPath;
        }
      } catch (error) {
        Logger.warn(`ProjectServiceImplからのパス取得に失敗: ${(error as Error).message}`);
      }
    }
    
    // ProjectServiceImplからパスを取得できなかった場合は、他の方法にフォールバック
    return this._getDefaultProjectPath();
  }

  /**
   * フォールバック用のプロジェクトパス取得メソッド
   */
  private _getDefaultProjectPath(): string {
    try {
      
      // VSCodeのアクティブなプロジェクトパスを取得（ワークスペースフォルダ）
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (workspaceFolders && workspaceFolders.length > 0) {
        const wsPath = workspaceFolders[0].uri.fsPath;
        
        // ワークスペースのmockupsフォルダにHTMLファイルがあるか確認
        const mockupsPath = path.join(wsPath, 'mockups');
        if (fs.existsSync(mockupsPath)) {
          try {
            const files = fs.readdirSync(mockupsPath);
            const hasHtmlFiles = files.some(file => file.endsWith('.html'));
            
            if (hasHtmlFiles) {
              Logger.info(`ワークスペースのmockupsフォルダにHTMLファイルが見つかりました: ${mockupsPath}`);
            }
          } catch (fsError) {
            Logger.debug(`ワークスペースのmockupsフォルダの読み取りに失敗: ${(fsError as Error).message}`);
          }
        }
        
        Logger.info(`ワークスペースフォルダからプロジェクトパスを取得: ${wsPath}`);
        return wsPath;
      }
      
      // 現在のディレクトリを使用
      const currentPath = process.cwd();
      
      // 現在のディレクトリのmockupsフォルダにHTMLファイルがあるか確認
      const currentMockupsPath = path.join(currentPath, 'mockups');
      if (fs.existsSync(currentMockupsPath)) {
        try {
          const files = fs.readdirSync(currentMockupsPath);
          const hasHtmlFiles = files.some(file => file.endsWith('.html'));
          
          if (hasHtmlFiles) {
            Logger.info(`カレントディレクトリのmockupsフォルダにHTMLファイルが見つかりました: ${currentMockupsPath}`);
          }
        } catch (fsError) {
          Logger.debug(`カレントディレクトリのmockupsフォルダの読み取りに失敗: ${(fsError as Error).message}`);
        }
      }
      
      Logger.info(`カレントディレクトリからプロジェクトパスを取得: ${currentPath}`);
      return currentPath;
    } catch (error) {
      // エラーが発生した場合は現在のディレクトリをフォールバックとして使用
      const fallbackPath = process.cwd();
      Logger.error(`プロジェクトパスの取得中にエラー: ${(error as Error).message}`);
      Logger.info(`フォールバックパスを使用: ${fallbackPath}`);
      return fallbackPath;
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
   * WSL環境かどうかを検出
   */
  private isWSL(): boolean {
    try {
      // 方法1: 環境変数をチェック
      if (process.env.WSL_DISTRO_NAME) {
        Logger.info(`WSL環境を検出（ディストリビューション: ${process.env.WSL_DISTRO_NAME}）`);
        return true;
      }

      // 方法2: /proc/versionファイルをチェック
      if (process.platform === 'linux' && fs.existsSync('/proc/version')) {
        const version = fs.readFileSync('/proc/version', 'utf8');
        const isWSL = version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
        if (isWSL) {
          Logger.info('WSL環境を検出（/proc/versionから）');
        }
        return isWSL;
      }

      return false;
    } catch (error) {
      Logger.error('WSL環境の検出中にエラーが発生しました', error as Error);
      return false;
    }
  }

  /**
   * WSL環境用のファイルURIを作成
   */
  private createWSLFileUri(filePath: string): vscode.Uri {
    try {
      // WSLディストリビューション名を取得
      const distroName = process.env.WSL_DISTRO_NAME || 'Ubuntu';
      
      // Windowsパス形式に変換
      // 例: /home/user/file.html → file://wsl.localhost/Ubuntu/home/user/file.html
      const wslPath = `file://wsl.localhost/${distroName}${filePath}`;
      
      Logger.info(`WSLパス変換: ${filePath} → ${wslPath}`);
      
      return vscode.Uri.parse(wslPath);
    } catch (error) {
      Logger.error('WSLファイルURI作成エラー', error as Error);
      // フォールバック: 通常のファイルURIを返す
      return vscode.Uri.file(filePath);
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
      
      Logger.info(`一時ファイル作成: ${tempFile}`);
      Logger.info(`現在のプラットフォーム: ${process.platform}`);
      Logger.info(`WSL_DISTRO_NAME: ${process.env.WSL_DISTRO_NAME || 'undefined'}`);
      
      // ブラウザで開く
      let fileUri: vscode.Uri;
      if (this.isWSL()) {
        // WSL環境の場合、特殊なパス形式を使用
        fileUri = this.createWSLFileUri(tempFile);
      } else {
        // 通常の環境
        fileUri = vscode.Uri.file(tempFile);
      }
      
      Logger.info(`ブラウザで開くURI: ${fileUri.toString()}`);
      await vscode.env.openExternal(fileUri);
      
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
      // 削除前にモックアップ情報を取得
      const mockup = this._storage.getMockup(mockupId);
      
      if (!mockup) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }
      
      // VSCodeの確認ダイアログを表示
      const answer = await vscode.window.showWarningMessage(
        `モックアップ「${mockup.name}」を削除しますか？`,
        { modal: true },
        '削除する'
      );
      
      // キャンセルされた場合
      if (answer !== '削除する') {
        return;
      }
      
      // HTMLファイルのパスを構築
      const mockupFileName = `${mockup.name}.html`;
      const projectPath = this._getCurrentProjectPath();
      const mockupFilePath = path.join(projectPath, 'mockups', mockupFileName);
      
      // ストレージからモックアップを削除
      const success = await this._storage.deleteMockup(mockupId);
      
      if (success) {
        // 対応するHTMLファイルが存在する場合は削除
        if (fs.existsSync(mockupFilePath)) {
          try {
            fs.unlinkSync(mockupFilePath);
            Logger.info(`モックアップファイルを削除しました: ${mockupFilePath}`);
          } catch (fileError) {
            Logger.warn(`モックアップファイルの削除に失敗しました: ${mockupFilePath}`, fileError as Error);
            // ファイル削除の失敗は通知するが、全体のエラーにはしない
          }
        }
        
        // 削除成功をWebViewに通知
        this._panel.webview.postMessage({
          command: 'mockupDeleted',
          mockupId
        });
        
        vscode.window.showInformationMessage(`モックアップ「${mockup.name}」を削除しました`);
        Logger.info(`モックアップを削除しました: ${mockupId}`);
      } else {
        throw new Error('モックアップの削除に失敗しました');
      }
    } catch (error) {
      Logger.error(`モックアップ削除エラー: ${(error as Error).message}`);
      this._showError(`モックアップの削除に失敗しました: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`モックアップの削除に失敗しました: ${(error as Error).message}`);
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

    // WebView内でのリソースへのパスを取得（リファクタリング後のパス）
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'mockupGallery', 'mockupGallery.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'mockupGallery', 'mockupGallery.css')
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
  <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'design-system.css'))}" rel="stylesheet">
</head>
<body>
  <div class="app-container">
    <!-- 左側パネル - ページ一覧 -->
    <div class="pages-panel">
      <div class="panel-header">
        <h2 class="panel-title">モックアップ一覧</h2>
        <button id="toggle-panel-button" class="toggle-panel-button" title="パネルを折りたたむ/展開する">
          &#9664;
        </button>
      </div>
      
      <div id="mockups-container" class="mockups-container">
        <!-- モックアップリストがここに表示されます -->
        <div class="empty-state">
          <p>モックアップを読み込み中...</p>
        </div>
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
        </div>
        <div class="toolbar-right">
          <button id="delete-mockup-button" class="danger-button" title="このモックアップを削除">削除</button>
          <button id="open-in-browser-button" class="secondary-button">ブラウザで開く</button>
        </div>
      </div>
      
      <div class="mockup-display">
        <iframe id="mockup-frame" class="mockup-frame"></iframe>
        <pre id="html-code-display" style="display: none; width: 100%; height: 100%; overflow: auto; background: #f5f5f5; padding: 10px;"></pre>
      </div>
    </div>
  </div>
  
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * モックアップファイルの監視を設定
   */
  private _setupFileWatcher(): void {
    try {
      // 既存のウォッチャーがあれば破棄
      if (this._fileWatcher) {
        this._fileWatcher.dispose();
      }
      
      // ProjectServiceImplからプロジェクトパスを取得
      const projectPath = this._getCurrentProjectPath();
      
      // プロジェクトパスが取得できない場合は何もしない
      if (!projectPath) {
        Logger.warn('有効なプロジェクトパスを取得できないため、ファイル監視をスキップします');
        return;
      }
      
      // モックアップディレクトリのパス
      const mockupsDir = path.join(projectPath, 'mockups');
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(mockupsDir)) {
        fs.mkdirSync(mockupsDir, { recursive: true });
        Logger.info(`モックアップディレクトリを作成しました: ${mockupsDir}`);
      }
      
      // HTMLファイルのパターン
      const htmlGlob = new vscode.RelativePattern(
        mockupsDir,
        '*.html'
      );
      
      // ファイルウォッチャーを作成（作成、変更、削除を監視）
      this._fileWatcher = vscode.workspace.createFileSystemWatcher(htmlGlob);
      
      // ファイル作成イベントをリッスン
      this._fileWatcher.onDidCreate(async (uri) => {
        try {
          // ストレージを更新してリロード
          await this._storage.reloadMockups();
          
          // UI更新
          await this._handleLoadMockups();
        } catch (error) {
          Logger.error(`モックアップファイル作成の監視中にエラーが発生: ${(error as Error).message}`);
        }
      });
      
      // ファイル変更イベントをリッスン
      this._fileWatcher.onDidChange(async (uri) => {
        try {
          // ストレージを更新してリロード
          await this._storage.reloadMockups();
          
          // UI更新
          await this._handleLoadMockups();
          
          // ファイル名からモックアップIDを特定
          const fileName = path.basename(uri.fsPath);
          const mockupName = fileName.replace(/\.html$/, '');
          const mockup = this._storage.getMockupByName(mockupName);
          
          if (mockup) {
            // モックアップが更新された場合、mockupUpdatedコマンドを送信して強制的に内容を更新
            this._panel.webview.postMessage({
              command: 'mockupUpdated',
              mockup: mockup
            });
          }
        } catch (error) {
          Logger.error(`モックアップファイル更新の監視中にエラーが発生: ${(error as Error).message}`);
        }
      });
      
      // ファイル削除イベントをリッスン
      this._fileWatcher.onDidDelete(async (uri) => {
        try {
          // ストレージを更新してリロード
          await this._storage.reloadMockups();
          
          // UI更新
          await this._handleLoadMockups();
        } catch (error) {
          Logger.error(`モックアップファイル削除の監視中にエラーが発生: ${(error as Error).message}`);
        }
      });
      
      // ウォッチャーを破棄リストに追加
      this._disposables.push(this._fileWatcher);
      
      Logger.info('モックアップファイルの監視を開始しました');
    } catch (error) {
      Logger.error(`モックアップファイル監視の設定に失敗: ${(error as Error).message}`);
    }
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    // このインスタンスがcurrentPanelの場合のみundefinedに設定
    if (MockupGalleryPanel.currentPanel === this) {
      MockupGalleryPanel.currentPanel = undefined;
      Logger.info('メインのモックアップギャラリーパネルを破棄しました');
    } else {
      Logger.info('追加のモックアップギャラリーパネルを破棄しました');
    }

    // ファイルウォッチャーを解放（すでに_disposablesに追加されている場合もあるが念のため）
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = undefined;
    }

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    Logger.info('モックアップギャラリーパネルを破棄しました');
  }
}