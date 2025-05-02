import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { MockupStorageService, Mockup } from '../../services/mockupStorageService';
import { RequirementsParser, PageInfo } from '../../core/requirementsParser';
import { MockupQueueManager } from './MockupQueueManager';
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
  private _aiService: AIService;
  private _storage: MockupStorageService;
  private _queueManager: MockupQueueManager;
  
  // 追加
  private _projectPath: string;
  private _requirementsPath: string;
  private _structurePath: string;
  private _fileWatcher?: vscode.FileSystemWatcher; // モックアップファイル監視用

  // ClaudeCodeランチャーをインポート
  private _claudeCodeLauncher: any; // 型定義がない場合は any として扱う

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  protected static _createOrShowPanel(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string): MockupGalleryPanel {
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
        ],
        // モーダルダイアログを許可
        enableCommandUris: true
      }
    );

    MockupGalleryPanel.currentPanel = new MockupGalleryPanel(panel, extensionUri, aiService, projectPath);
    return MockupGalleryPanel.currentPanel;
  }
  
  /**
   * 外部向けのパネル作成・表示メソッド
   * 権限チェック付きで、パネルを表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string): MockupGalleryPanel | undefined {
    // 権限チェック
    if (!this.checkPermissionForFeature(Feature.MOCKUP_GALLERY, 'MockupGalleryPanel')) {
      return undefined;
    }
    
    // 権限があれば表示
    return this._createOrShowPanel(extensionUri, aiService, projectPath);
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
    super(); // 親クラスのコンストラクタを呼び出し
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    this._storage = MockupStorageService.getInstance();
    this._queueManager = new MockupQueueManager(aiService);
    
    // ClaudeCodeランチャーの初期化
    this._claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
    
    // プロジェクトパスの設定
    this._projectPath = projectPath || this._getDefaultProjectPath();
    this._requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
    this._structurePath = path.join(this._projectPath, 'docs', 'structure.md');
    
    // ストレージサービスを選択中のプロジェクトパスで初期化
    this._storage.initializeWithPath(this._projectPath);
    
    Logger.info(`モックアップギャラリーをプロジェクトパスで初期化: ${this._projectPath}`);

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
          case 'analyzeWithAI':
            await this._handleAnalyzeWithAI(message.mockupId);
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
    
    // ストレージサービスを選択中のプロジェクトパスだけで初期化
    this._storage.initializeWithPath(this._projectPath);
    
    // モックアップを再読み込み
    this._handleLoadMockups();
    
    // ファイル監視を再設定
    this._setupFileWatcher();
    
    Logger.info(`プロジェクトパスを更新しました: ${this._projectPath}`);
  }
  
  /**
   * デフォルトのプロジェクトパスを取得
   */
  private _getDefaultProjectPath(): string {
    try {
      // AppGeniusStateManagerからアクティブプロジェクトパスの取得を試みる
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { AppGeniusStateManager } = require('../../services/AppGeniusStateManager');
        const stateManager = AppGeniusStateManager.getInstance();
        const activeProjectId = stateManager.getActiveProjectId();
        
        if (activeProjectId) {
          const projectPath = stateManager.getProjectPath(activeProjectId);
          if (projectPath) {
            // プロジェクトのmockupsフォルダにHTMLファイルがあるか確認
            const mockupsPath = path.join(projectPath, 'mockups');
            if (fs.existsSync(mockupsPath)) {
              try {
                const files = fs.readdirSync(mockupsPath);
                const hasHtmlFiles = files.some(file => file.endsWith('.html'));
                
                if (hasHtmlFiles) {
                  Logger.info(`プロジェクトのmockupsフォルダにHTMLファイルが見つかりました: ${mockupsPath}`);
                }
              } catch (fsError) {
                Logger.debug(`mockupsフォルダの読み取りに失敗: ${(fsError as Error).message}`);
              }
            }
            
            Logger.info(`AppGeniusStateManagerからプロジェクトパスを取得: ${projectPath}`);
            return projectPath;
          }
        }
      } catch (stateError) {
        // ステートマネージャーの取得に失敗した場合は警告を出して次の方法へ
        Logger.debug(`StateManagerからのパス取得失敗: ${(stateError as Error).message}`);
      }
      
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
      const mockupFilePath = path.join(this._projectPath, 'mockups', mockupFileName);
      
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
   * AIと詳細を詰める処理
   */
  private async _handleAnalyzeWithAI(mockupId: string): Promise<void> {
    try {
      // モックアップを取得
      const mockup = this._storage.getMockup(mockupId);
      if (!mockup) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }
      
      // モックアップのHTMLファイルパスを取得
      const mockupFileName = `${mockup.name}.html`;
      const mockupDir = path.join(this._projectPath, 'mockups');
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(mockupDir)) {
        fs.mkdirSync(mockupDir, { recursive: true });
      }
      
      const mockupFilePath = path.join(mockupDir, mockupFileName);
      
      // スコープディレクトリが存在しない場合は作成
      const scopesDir = path.join(this._projectPath, 'docs', 'scopes');
      if (!fs.existsSync(scopesDir)) {
        fs.mkdirSync(scopesDir, { recursive: true });
      }
      
      // 要件定義ファイルの存在確認
      const requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
      const requirementsExists = fs.existsSync(requirementsPath);
      
      // 追加情報を準備
      let additionalContent = `# 追加情報\n\n## モックアップ情報\n\n`;
      additionalContent += `- モックアップ名: ${mockup.name}\n`;
      additionalContent += `- モックアップパス: ${mockupFilePath}\n`;
      additionalContent += `- プロジェクトパス: ${this._projectPath}\n\n`;
      
      // 要件定義ファイルが存在する場合、その内容を追加
      if (requirementsExists) {
        const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
        additionalContent += `## プロジェクト要件定義\n\n\`\`\`markdown\n${requirementsContent}\n\`\`\`\n`;
        Logger.info(`要件定義ファイルの内容を追加しました: ${requirementsPath}`);
      }
      
      // インテグレーションサービスを取得
      const integrationService = ClaudeCodeIntegrationService.getInstance();
      
      // 中央ポータルURL
      const portalUrl = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb';
      
      try {
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        // 公開URLから起動（追加情報も渡す）
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        Logger.info(`モックアップ「${mockup.name}」の分析のため中央ポータル経由でClaudeCodeを起動しました`);
        vscode.window.showInformationMessage(
          `モックアップ「${mockup.name}」の分析のためClaudeCodeを起動しました。` +
          `詳細な要件定義書は ${path.join(this._projectPath, 'docs/scopes', `${mockup.name}-requirements.md`)} に保存されます。`
        );
      } catch (error) {
        Logger.error(`中央ポータル経由の起動に失敗: ${(error as Error).message}`);
        
        // ローカルファイルにフォールバック
        Logger.warn(`ローカルプロンプトファイルにフォールバックします`);
        
        const templatePath = path.join(this._projectPath, 'docs', 'prompts', 'mockup_analyzer.md');
        if (!fs.existsSync(templatePath)) {
          throw new Error(`モックアップ解析テンプレートが見つかりません: ${templatePath}`);
        }
        
        // ターミナルの作成
        const terminal = vscode.window.createTerminal({
          name: `ClaudeCode - ${mockup.name}の解析 (ローカル)`,
          cwd: this._projectPath // プロジェクトのルートディレクトリで起動
        });
        
        // ターミナルの表示
        terminal.show(true);
        
        // ガイダンスメッセージを表示
        terminal.sendText('echo "\n\n*** AIが自動的に処理を開始します。自動対応と日本語指示を行います ***\n"');
        terminal.sendText('sleep 1'); // 1秒待機
        
        // macOSの場合は環境変数の設定（必要に応じて）
        if (process.platform === 'darwin') {
          terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "" > /dev/null 2>&1');
          terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
        }
        
        // テンプレートファイルを一時的に修正してモックアップパスを埋め込む
        const tempDir = os.tmpdir(); // 一時ディレクトリに保存（25秒後に自動削除）
        
        // 一時的なテンプレートファイルパス
        const tempTemplatePath = path.join(tempDir, `combined_mockup_${Date.now()}.md`);
        
        // テンプレートファイルの内容を読み込む
        let templateContent = fs.readFileSync(templatePath, 'utf8');
        
        // モックアップパスと変数を置換
        templateContent = templateContent
          .replace(/{{MOCKUP_PATH}}/g, mockupFilePath)
          .replace(/{{PROJECT_PATH}}/g, this._projectPath)
          .replace(/{{MOCKUP_NAME}}/g, mockup.name)
          .replace(/{{SOURCE}}/g, 'mockupGallery');
        
        // 要件定義の内容も追加
        if (requirementsExists) {
          templateContent += additionalContent;
        }
        
        // 一時的なテンプレートファイルを作成
        fs.writeFileSync(tempTemplatePath, templateContent, 'utf8');
        
        // エスケープされたパス
        const escapedTempTemplatePath = tempTemplatePath.replace(/ /g, '\\ ');
        
        // ClaudeCodeIntegrationServiceを使用
        // 一時ファイルを閉じる
        terminal.dispose();
        
        const integrationService = ClaudeCodeIntegrationService.getInstance();
        
        // セキュリティガイドライン付きで起動
        Logger.info(`セキュリティガイドライン付きでClaudeCodeを起動します`);
        const guidancePromptUrl = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/6640b55f692b15f4f4e3d6f5b1a5da6c';
        const featurePromptUrl = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb';
        
        // テンプレートの内容を追加コンテンツとして渡す
        await integrationService.launchWithSecurityBoundary(
          guidancePromptUrl,
          featurePromptUrl,
          this._projectPath,
          templateContent
        );
        
        // 一時ファイルの自動削除（25秒後）
        setTimeout(() => {
          try {
            if (fs.existsSync(tempTemplatePath)) {
              fs.unlinkSync(tempTemplatePath);
              Logger.info(`一時プロンプトファイルを削除しました: ${tempTemplatePath}`);
            }
          } catch (err) {
            Logger.error(`一時ファイル削除エラー: ${(err as Error).message}`);
          }
        }, 25000);
        
        Logger.info(`モックアップ「${mockup.name}」の分析のためローカルプロンプトでClaudeCodeを起動しました`);
        vscode.window.showInformationMessage(
          `モックアップ「${mockup.name}」の分析のためClaudeCodeを起動しました（ローカルモード）。` +
          `詳細な要件定義書は ${path.join(this._projectPath, 'docs/scopes', `${mockup.name}-requirements.md`)} に保存されます。`
        );
      }
      
    } catch (error) {
      Logger.error(`モックアップAI分析エラー: ${(error as Error).message}`);
      this._showError(`モックアップの分析に失敗しました: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`モックアップの分析に失敗しました: ${(error as Error).message}`);
    }
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
          <button id="analyze-with-ai-button" class="action-button">AIと詳細を詰める</button>
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
      
      // プロジェクトパスが設定されていない場合は何もしない
      if (!this._projectPath) {
        Logger.warn('プロジェクトパスが設定されていないため、ファイル監視をスキップします');
        return;
      }
      
      // モックアップディレクトリのパス
      const mockupsDir = path.join(this._projectPath, 'mockups');
      
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
    MockupGalleryPanel.currentPanel = undefined;

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