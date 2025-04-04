import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '../../utils/logger';
import { FileOperationManager } from '../../utils/fileOperationManager';
import { ScopeItemStatus, IImplementationItem, IImplementationScope } from '../../types';
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';
import { ClaudeCodeIntegrationService } from '../../services/ClaudeCodeIntegrationService';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';
import { ProtectedPanel } from '../auth/ProtectedPanel';
import { Feature } from '../../core/auth/roles';
import { AuthenticationService } from '../../core/auth/AuthenticationService';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';
import { PromptServiceClient } from '../../services/PromptServiceClient';
import { ClaudeCodeSharingService } from '../../services/ClaudeCodeSharingService';

/**
 * スコープマネージャーパネルクラス
 * CURRENT_STATUS.mdファイルと連携して実装スコープの管理を行う
 * 権限保護されたパネルの基底クラスを継承
 */
export class ScopeManagerPanel extends ProtectedPanel {
  public static currentPanel: ScopeManagerPanel | undefined;
  private static readonly viewType = 'scopeManager';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.SCOPE_MANAGER;

  /**
   * API接続をテストして認証状態と接続性を確認
   */
  private async _testAPIConnection(): Promise<boolean> {
    try {
      // 外部モジュールを使用してAPI接続テストを実行
      const { testAPIConnection } = await import('../../api/scopeManagerTestAPI');
      return testAPIConnection();
    } catch (error) {
      Logger.error('API接続テスト中にエラーが発生しました', error as Error);
      return false;
    }
  }

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _projectPath: string = '';
  private _fileManager: FileOperationManager;
  private _statusFilePath: string = '';
  private _scopes: any[] = [];
  private _selectedScopeIndex: number = -1;
  private _currentScope: any = null;
  private _directoryStructure: string = '';
  private _fileWatcher: vscode.FileSystemWatcher | null = null;
  private _docsDirWatcher: fs.FSWatcher | null = null; // Node.jsのファイルシステムウォッチャー
  private _isPreparationMode: boolean = false; // 準備モード（廃止予定で常にfalse）
  private _isUpdatingStatusFile: boolean = false; // ステータスファイル更新中フラグ
  private _sharingService: ClaudeCodeSharingService | undefined; // ClaudeCode共有サービス
  
  /**
   * 準備ステップのテンプレートを取得（廃止予定）
   * @deprecated 準備モードとともに廃止予定
   */
  private _getPreparationStepsTemplate(): string {
    return `<div class="preparation-steps">
      <h3>準備モードは廃止されました</h3>
      <p>準備モードは実装から削除されました。代わりにClaudeCodeを直接使用してください。</p>
    </div>`;
  }
  
  // プロンプト関連のURLリスト
  private readonly _promptUrls = [
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09",
    "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/bbc6e76a5f448e02bea16918fa1dc9ad"
  ];
  
  // 一時ファイル保存ディレクトリ (隠しフォルダ方式)
  private _tempShareDir: string = '';
  private _promptServiceClient: PromptServiceClient;

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string): ScopeManagerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (ScopeManagerPanel.currentPanel) {
      ScopeManagerPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが指定されている場合は更新
      if (projectPath) {
        Logger.info(`既存のスコープマネージャーパネルを使用して、プロジェクトパスを更新: ${projectPath}`);
        ScopeManagerPanel.currentPanel.setProjectPath(projectPath);
      }
      
      return ScopeManagerPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      ScopeManagerPanel.viewType,
      'AppGenius スコープマネージャー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
        ]
      }
    );
    
    Logger.info(`新しいスコープマネージャーパネルを作成: プロジェクトパス=${projectPath || '未指定'}`);
    ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, context, projectPath);
    return ScopeManagerPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string) {
    super();
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._fileManager = FileOperationManager.getInstance();
    this._promptServiceClient = PromptServiceClient.getInstance();
    
    // ClaudeCode共有サービスを初期化
    this._sharingService = new ClaudeCodeSharingService(context);
    
    // 一時ディレクトリはプロジェクトパス設定時に作成されるため、ここでは初期化のみ
    this._tempShareDir = '';
    
    // プロジェクトパスが指定されている場合は設定
    if (projectPath) {
      this.setProjectPath(projectPath);
    }
    
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
        try {
          switch (message.command) {
            case 'initialize':
              await this._handleInitialize();
              break;
            case 'selectScope':
              await this._handleSelectScope(message.index);
              break;
            case 'startImplementation':
              await this._handleStartImplementation();
              break;
            case 'showDirectoryStructure':
              await this._handleShowDirectoryStructure();
              break;
            case 'addNewScope':
              await this._handleAddNewScope();
              break;
            case 'toggleFileStatus':
              await this._handleToggleFileStatus(message.filePath, message.completed);
              break;
            // 新しいコマンド
            case 'launchPromptFromURL':
              await this._handleLaunchPromptFromURL(message.url, message.index);
              break;
            case 'shareText':
              await this._handleShareText(message.text);
              break;
            case 'shareImage':
              await this._handleShareImage(message.imageData, message.fileName);
              break;
            case 'openRequirementsVisualizer':
              await this._handleOpenRequirementsVisualizer();
              break;
            case 'openEnvironmentVariablesAssistant':
              await this._handleOpenEnvironmentVariablesAssistant();
              break;
            case 'openMockupGallery':
              await this._handleOpenMockupGallery();
              break;
            case 'openDebugDetective':
              await this._handleOpenDebugDetective();
              break;
            case 'shareText':
              await this._handleShareText(message.text);
              break;
            case 'shareImage':
              await this._handleShareImage(message.imageData, message.fileName);
              break;
            case 'getHistory':
              await this._handleGetHistory();
              break;
            case 'deleteFromHistory':
              await this._handleDeleteFromHistory(message.fileId);
              break;
            case 'copyCommand':
              await this._handleCopyCommand(message.fileId);
              break;
            case 'copyToClipboard':
              await this._handleCopyToClipboard(message.text);
              break;
            case 'reuseHistoryItem':
              await this._handleReuseHistoryItem(message.fileId);
              break;
          }
        } catch (error) {
          Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
          this._showError(`操作に失敗しました: ${(error as Error).message}`);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * プロジェクトパスを設定する
   */
  public setProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._statusFilePath = path.join(projectPath, 'docs', 'CURRENT_STATUS.md');
    
    Logger.info(`プロジェクトパスを設定しました: ${projectPath}`);
    Logger.info(`ステータスファイルパス: ${this._statusFilePath}, ファイル存在: ${fs.existsSync(this._statusFilePath) ? 'はい' : 'いいえ'}`);

    // 既存のファイルウォッチャーを破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    // Node.jsのファイルシステムウォッチャーも破棄
    if (this._docsDirWatcher) {
      this._docsDirWatcher.close();
      this._docsDirWatcher = null;
    }
    
    // プロジェクト直下に一時ディレクトリを作成
    this._tempShareDir = path.join(projectPath, '.appgenius_temp');
    if (!fs.existsSync(this._tempShareDir)) {
      fs.mkdirSync(this._tempShareDir, { recursive: true });
      Logger.info(`プロジェクト直下に一時ディレクトリを作成しました: ${this._tempShareDir}`);
    }
    
    // PromptServiceClientにもプロジェクトパスを設定
    this._promptServiceClient.setProjectPath(projectPath);
    
    // 共有サービスにもプロジェクトパスを設定
    if (this._sharingService) {
      this._sharingService.setProjectBasePath(projectPath);
    }
    
    // ファイルウォッチャーを設定
    this._setupFileWatcher();

    // パスが設定されたらステータスファイルを読み込む
    this._loadStatusFile();
    
    // WebViewにもプロジェクトパス情報を送信
    this._panel.webview.postMessage({
      command: 'updateProjectPath',
      projectPath: this._projectPath,
      statusFilePath: this._statusFilePath,
      statusFileExists: fs.existsSync(this._statusFilePath)
    });
  }

  /**
   * 初期化処理
   */
  private async _handleInitialize(): Promise<void> {
    await this._loadStatusFile();

    // ディレクトリ構造を更新
    await this._updateDirectoryStructure();
    
    // 共有履歴を初期化
    if (this._sharingService) {
      await this._handleGetHistory();
    }
  }

  /**
   * プロンプトURLからClaudeCodeを起動する
   */
  private async _handleLaunchPromptFromURL(url: string, index: number): Promise<void> {
    try {
      Logger.info(`プロンプトを取得中: ${url}`);
      
      // プロンプトURLからインデックスを取得
      const promptIndex = this._promptUrls.findIndex(u => u === url);
      const indexToUse = promptIndex !== -1 ? promptIndex : index;
      
      // プロンプトの内容を取得して一時ファイルに保存（プロジェクトパスを指定）
      const promptFilePath = await this._promptServiceClient.fetchAndSavePrompt(url, indexToUse, this._projectPath);
      
      // ClaudeCodeを起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        {
          deletePromptFile: true, // 使用後に一時ファイルを削除
          splitView: true // 分割ビューで表示
        }
      );
      
      if (success) {
        Logger.info(`ClaudeCode起動成功: ${promptFilePath}`);
      } else {
        this._showError('ClaudeCodeの起動に失敗しました');
      }
    } catch (error) {
      Logger.error('プロンプト起動中にエラーが発生しました', error as Error);
      this._showError(`プロンプトの取得または起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * テキストを一時ファイルに保存して共有
   */
  private async _handleShareText(text: string): Promise<void> {
    try {
      // 隠しファイル名を生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
      // ランダムな文字列を生成して隠しファイル名に使用
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileName = `.vq${randomStr}`;
      const filePath = path.join(this._tempShareDir, fileName);
      
      // ファイルに書き込み
      await fs.promises.writeFile(filePath, text, 'utf8');
      
      // 成功メッセージ
      this._panel.webview.postMessage({
        command: 'shareSuccess',
        filePath,
        viewCommand: `view ${filePath}`
      });
      
      Logger.info(`テキストを共有しました: ${filePath}`);
    } catch (error) {
      Logger.error('テキスト共有中にエラーが発生しました', error as Error);
      this._showError(`テキストの共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 画像を一時ファイルに保存して共有
   */
  private async _handleShareImage(imageData: string, fileName: string): Promise<void> {
    try {
      // 隠しファイル名を生成（.appgenius_tempディレクトリ直下に作成）
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
      
      // ランダムな文字列を生成して隠しファイル名に使用
      const randomStr = Math.random().toString(36).substring(2, 15);
      
      // 拡張子を取得
      const extension = path.extname(fileName) || '.png';
      const saveFileName = `.vq${randomStr}${extension}`;
      const filePath = path.join(this._tempShareDir, saveFileName);
      
      // Base64データを取得
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // ファイルに書き込み
      await fs.promises.writeFile(filePath, buffer);
      
      // 成功メッセージ
      this._panel.webview.postMessage({
        command: 'shareSuccess',
        filePath,
        viewCommand: `view ${filePath}`
      });
      
      Logger.info(`画像を共有しました: ${filePath}`);
    } catch (error) {
      Logger.error('画像共有中にエラーが発生しました', error as Error);
      this._showError(`画像の共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 要件定義エディタを開く
   */
  private async _handleOpenRequirementsVisualizer(): Promise<void> {
    // 要件定義エディタを開くコマンドを実行
    // 注: 要件定義エディタのコマンドが存在しない場合は一時的にチャットを開く
    try {
      // 要件定義エディタ用のコマンドを探す
      vscode.commands.executeCommand('appgenius-ai.openSimpleChat', this._projectPath);
      Logger.info('要件定義エディタの代わりにSimpleChatを開きました');
    } catch (error) {
      Logger.error('要件定義エディタを開けませんでした', error as Error);
      this._showError('要件定義エディタを開けませんでした');
    }
  }

  /**
   * 環境変数アシスタントを開く
   */
  private async _handleOpenEnvironmentVariablesAssistant(): Promise<void> {
    // 環境変数アシスタントを開くコマンドを実行
    try {
      vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant', this._projectPath);
      Logger.info('環境変数アシスタントを開きました');
    } catch (error) {
      Logger.error('環境変数アシスタントを開けませんでした', error as Error);
      this._showError('環境変数アシスタントを開けませんでした');
    }
  }

  /**
   * モックアップギャラリーを開く
   */
  private async _handleOpenMockupGallery(): Promise<void> {
    // モックアップギャラリーを開くコマンドを実行
    try {
      vscode.commands.executeCommand('appgenius-ai.openMockupGallery', this._projectPath);
      Logger.info('モックアップギャラリーを開きました');
    } catch (error) {
      Logger.error('モックアップギャラリーを開けませんでした', error as Error);
      this._showError('モックアップギャラリーを開けませんでした');
    }
  }

  /**
   * デバッグ探偵を開く
   */
  private async _handleOpenDebugDetective(): Promise<void> {
    // デバッグ探偵を開くコマンドを実行
    try {
      vscode.commands.executeCommand('appgenius-ai.openDebugDetective', this._projectPath);
      Logger.info('デバッグ探偵を開きました');
    } catch (error) {
      Logger.error('デバッグ探偵を開けませんでした', error as Error);
      this._showError('デバッグ探偵を開けませんでした');
    }
  }

  /**
   * 共有履歴を取得してWebViewに送信
   */
  private async _handleGetHistory(): Promise<void> {
    if (!this._sharingService) return;
    
    const history = this._sharingService.getHistory();
    
    this._panel.webview.postMessage({
      command: 'updateSharingHistory',
      history: history
    });
  }

  /**
   * テキストを共有サービスで共有
   */
  private async _handleShareText(text: string): Promise<void> {
    try {
      if (!this._sharingService) {
        this._showError('共有サービスが初期化されていません');
        return;
      }
      
      // 共有サービスを使ってテキストを共有
      const file = await this._sharingService.shareText(text);
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // 成功メッセージを送信
      this._panel.webview.postMessage({
        command: 'showShareResult',
        data: {
          filePath: file.path,
          command: command,
          type: 'text'
        }
      });
      
    } catch (error) {
      this._showError(`テキストの共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 画像を共有サービスで共有
   */
  private async _handleShareImage(imageData: string, fileName: string): Promise<void> {
    try {
      if (!this._sharingService) {
        this._showError('共有サービスが初期化されていません');
        return;
      }
      
      // 共有サービスを使って画像を共有
      const file = await this._sharingService.shareBase64Image(imageData, fileName);
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // 成功メッセージを送信
      this._panel.webview.postMessage({
        command: 'showShareResult',
        data: {
          filePath: file.path,
          command: command,
          type: 'image'
        }
      });
      
    } catch (error) {
      this._showError(`画像の共有に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 履歴からアイテムを削除
   */
  private async _handleDeleteFromHistory(fileId: string): Promise<void> {
    if (!this._sharingService) return;
    
    const success = this._sharingService.deleteFromHistory(fileId);
    
    if (success) {
      // 履歴を更新して送信
      await this._handleGetHistory();
    }
  }

  /**
   * ファイルのコマンドをクリップボードにコピー
   */
  private async _handleCopyCommand(fileId: string): Promise<void> {
    if (!this._sharingService) return;
    
    // ファイルを履歴から検索
    const history = this._sharingService.getHistory();
    const file = history.find(item => item.id === fileId);
    
    if (file) {
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // VSCodeのクリップボード機能を使用
      vscode.env.clipboard.writeText(command);
      
      // アクセスカウントを増やす
      this._sharingService.recordAccess(fileId);
      
      // 成功メッセージを送信
      this._panel.webview.postMessage({
        command: 'commandCopied',
        fileId: fileId
      });
    }
  }

  /**
   * テキストをクリップボードにコピー
   */
  private async _handleCopyToClipboard(text: string): Promise<void> {
    // VSCodeのクリップボード機能を使用
    vscode.env.clipboard.writeText(text);
  }

  /**
   * 履歴アイテムを再利用
   */
  private async _handleReuseHistoryItem(fileId: string): Promise<void> {
    if (!this._sharingService) return;
    
    // ファイルを履歴から検索
    const history = this._sharingService.getHistory();
    const file = history.find(item => item.id === fileId);
    
    if (file) {
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // アクセスカウントを増やす
      this._sharingService.recordAccess(fileId);
      
      // 結果を表示
      this._panel.webview.postMessage({
        command: 'showShareResult',
        data: {
          filePath: file.path,
          command: command,
          type: file.type
        }
      });
    }
  }

  /**
   * スコープを選択
   */
  private async _handleSelectScope(index: number): Promise<void> {
    if (index < 0 || index >= this._scopes.length) {
      return;
    }
    
    this._selectedScopeIndex = index;
    this._currentScope = this._scopes[index];
    
    // Webviewに選択したスコープの情報を送信
    this._panel.webview.postMessage({
      command: 'updateState',
      scopes: this._scopes,
      selectedScopeIndex: this._selectedScopeIndex,
      selectedScope: this._currentScope
    });
  }

  /**
   * 実装を開始
   */
  private async _handleStartImplementation(): Promise<void> {
    if (!this._currentScope) {
      this._showError('スコープが選択されていません');
      return;
    }
    
    try {
      // スコープの実装を進めるためにClaudeCodeを起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      const scopeData = {
        id: this._currentScope.id,
        name: this._currentScope.name || '実装スコープ',
        description: this._currentScope.description || '',
        projectPath: this._projectPath,
        items: this._currentScope.files ? this._currentScope.files.map(file => ({
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: file.path,
          description: `ファイル: ${file.path}`,
          priority: 'medium',
          complexity: 'medium',
          dependencies: [],
          completed: file.completed
        })) : [],
        selectedIds: [],
        estimatedTime: '0h',
        totalProgress: this._currentScope.progress || 0
      };
      
      const success = await launcher.launchClaudeCode(scopeData);
      
      if (!success) {
        this._showError('ClaudeCodeの起動に失敗しました');
      }
    } catch (error) {
      Logger.error('実装の開始に失敗しました', error as Error);
      this._showError(`実装の開始に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリ構造を表示
   */
  private async _handleShowDirectoryStructure(): Promise<void> {
    if (!this._directoryStructure) {
      await this._updateDirectoryStructure();
    }
    
    this._panel.webview.postMessage({
      command: 'showDirectoryStructure',
      structure: this._directoryStructure
    });
  }

  /**
   * 新しいスコープを追加
   */
  private async _handleAddNewScope(): Promise<void> {
    // スコープ名の入力
    const scopeName = await vscode.window.showInputBox({
      prompt: '新しいスコープの名前を入力してください',
      placeHolder: '例: 認証システムの改善'
    });
    
    if (!scopeName) {
      return;
    }
    
    // スコープの説明を入力
    const description = await vscode.window.showInputBox({
      prompt: 'スコープの説明を入力してください',
      placeHolder: '例: ユーザー認証の機能を改善し、セキュリティを強化します'
    });
    
    if (!description) {
      return;
    }
    
    // CURRENT_STATUS.mdファイルを読み込む
    let content = await this._fileManager.readFileAsString(this._statusFilePath);
    
    // 「### 未着手スコープ」セクションを探す
    const pendingSectionMatch = content.match(/### 未着手スコープ[^\n]*\n/);
    if (!pendingSectionMatch) {
      this._showError('CURRENT_STATUS.mdファイルに「### 未着手スコープ」セクションが見つかりません');
      return;
    }
    
    // 新しいスコープを追加する位置を特定
    const pendingSectionIndex = pendingSectionMatch.index || 0;
    const insertPosition = pendingSectionIndex + pendingSectionMatch[0].length;
    
    // 新しいスコープの内容を作成
    const newScopeContent = `- [ ] ${scopeName} (0%)
  - 説明: ${description}
  - ステータス: 未着手
  - スコープID: scope-${Date.now()}
  - 関連ファイル:
    - (ファイルはまだ定義されていません)

`;
    
    // ステータスファイルを更新
    const updatedContent = content.substring(0, insertPosition) + newScopeContent + content.substring(insertPosition);
    await fs.promises.writeFile(this._statusFilePath, updatedContent, 'utf8');
    
    // スコープリストを再読み込み
    await this._loadStatusFile();
  }

  /**
   * ファイルのステータスを切り替え
   */
  private async _handleToggleFileStatus(filePath: string, completed: boolean): Promise<void> {
    if (!this._currentScope || !this._currentScope.files) {
      return;
    }
    
    // 対象ファイルを見つける
    const fileIndex = this._currentScope.files.findIndex((f: any) => f.path === filePath);
    if (fileIndex === -1) {
      return;
    }
    
    // ファイルのステータスを更新
    this._currentScope.files[fileIndex].completed = completed;
    
    // 完了したファイルの数をカウント
    const totalFiles = this._currentScope.files.length;
    const completedFiles = this._currentScope.files.filter((f: any) => f.completed).length;
    
    // 進捗率を計算
    const progress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
    this._currentScope.progress = progress;
    
    // スコープのステータスを更新
    if (progress === 100) {
      this._currentScope.status = 'completed';
    } else if (progress > 0) {
      this._currentScope.status = 'in-progress';
    } else {
      this._currentScope.status = 'pending';
    }
    
    // CURRENT_STATUS.mdファイルを更新
    await this._updateStatusFile();
    
    // スコープリストを再読み込み
    await this._loadStatusFile();
  }

  /**
   * エラーメッセージを表示
   */
  private _showError(message: string): void {
    this._panel.webview.postMessage({
      command: 'showError',
      message: message
    });
  }

  /**
   * WebViewを更新
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * WebViewのHTMLを生成
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // スタイルシートやスクリプトのURIを取得
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const designSystemStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.js')
    );
    
    // Material Iconsの読み込み
    const materialIconsUrl = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    
    // CSPを設定
    const nonce = this._getNonce();
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com;
      font-src https://fonts.gstatic.com;
      script-src 'nonce-${nonce}';
      img-src ${webview.cspSource} data:;
    `;
    
    // HTMLを生成
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <link href="${styleResetUri}" rel="stylesheet">
      <link href="${designSystemStyleUri}" rel="stylesheet">
      <link href="${styleMainUri}" rel="stylesheet">
      <link href="${materialIconsUrl}" rel="stylesheet">
      <title>AppGenius スコープマネージャー</title>
    </head>
    <body>
      <div class="scope-manager-container">
        <div class="panel-header">
          <h1 id="panel-header-title">AppGenius スコープマネージャー</h1>
          <div style="display: flex; gap: 8px;">
            <button class="button button-secondary" id="create-scope-button">
              <span class="material-icons">add</span>
              開発案件を追加する
            </button>
          </div>
        </div>

        <div class="main-content">
          <!-- 左サイドパネル：スコープリスト -->
          <div class="card" style="margin-bottom: 0; padding: var(--app-spacing-sm);">
            <div class="card-header">
              <h2>開発スコープ</h2>
              <button class="button button-secondary" id="directory-structure-button" style="padding: 4px 8px; font-size: 12px;">
                <span class="material-icons" style="font-size: 16px;">folder</span>
                ディレクトリ
              </button>
            </div>
            <div id="scope-list" class="scope-list">
              <!-- スコープアイテムはJSで動的に生成される -->
              <div class="scope-item">
                <p>読み込み中...</p>
              </div>
            </div>
          </div>

          <!-- 右コンテンツエリア -->
          <div class="content-area">
            <!-- スコープ詳細カード -->
            <div class="card">
              <div class="card-header">
                <h2 id="scope-title">スコープが選択されていません</h2>
                <button class="button" id="implement-button">
                  <span class="material-icons">play_arrow</span>
                  実装を開始
                </button>
              </div>
              <p id="scope-description">
                左側のリストからスコープを選択してください。
              </p>
              <div style="margin: var(--app-spacing-md) 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--app-spacing-xs);">
                  <span>進捗状況</span>
                  <span id="scope-progress">0%</span>
                </div>
                <div style="height: 8px; background-color: var(--app-gray-200); border-radius: 4px; overflow: hidden;">
                  <div id="scope-progress-bar" class="status-pending" style="width: 0%; height: 100%;"></div>
                </div>
              </div>
              <h3>実装予定ファイル</h3>
              <div id="implementation-files">
                <div class="file-item">実装予定ファイルがありません</div>
              </div>
            </div>

            <!-- 開発プロンプトセクション -->
            <div class="card">
              <div class="tabs">
                <div class="tab active" data-tab="prompts">開発プロンプト</div>
                <div class="tab" data-tab="tools">開発ツール</div>
              </div>

              <!-- プロンプトタブコンテンツ -->
              <div id="prompts-tab" class="tab-content active">
                <div class="filter-bar">
                  <input type="text" class="search-input" placeholder="プロンプトを検索..." />
                  <select class="button button-secondary" style="padding: 6px 12px;">
                    <option value="all">すべてのカテゴリー</option>
                    <option value="implementation">実装</option>
                    <option value="planning">計画</option>
                    <option value="debug">デバッグ</option>
                    <option value="testing">テスト</option>
                    <option value="design">設計</option>
                  </select>
                </div>
                <!-- プロンプトカードはJSで動的に生成 -->
              </div>

              <!-- ツールタブコンテンツ -->
              <div id="tools-tab" class="tab-content">
                <!-- ツールカードはJSで動的に生成 -->
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- ClaudeCode連携エリア -->
      <div class="toggle-share-btn" id="toggle-share-btn" style="display: flex;">
        <span class="material-icons">sync</span>
        <span>ClaudeCode連携</span>
      </div>
      
      <div class="claude-code-share-area" id="claude-code-share">
        <div class="claude-code-share-header">
          <h3>ClaudeCode連携</h3>
          <div>
            <button class="button button-secondary" id="minimize-share-btn" style="padding: 4px 8px;">
              <span class="material-icons" style="font-size: 16px;">expand_more</span>
            </button>
          </div>
        </div>
        
        <div class="share-content">
          <div class="text-share-zone">
            <textarea class="share-textarea" placeholder="ここにClaudeCodeと共有したいテキスト（エラーメッセージ、コード、メモなど）を入力またはペーストしてください..."></textarea>
            <div class="shared-history">
              <!-- 共有履歴はJSで動的に生成 -->
            </div>
          </div>
          
          <div class="image-share-zone" id="drop-zone">
            <span class="material-icons" style="font-size: 32px; margin-bottom: 10px;">image</span>
            <p>画像をドラッグ＆ドロップ<br>または</p>
            <button class="button button-secondary" style="margin-top: 10px; margin-bottom: 10px;">ファイルを選択</button>
            
            <!-- ボタンをドロップゾーン内に配置 -->
            <div class="image-action-buttons">
              <button class="button button-secondary" id="clear-button">クリア</button>
              <button class="button" id="share-to-claude">保存</button>
              <button class="button button-secondary" id="copy-button" style="display: none;">
                <span class="material-icons" style="font-size: 16px;">content_copy</span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 結果表示エリア (シンプル化) -->
        <div class="share-result" id="share-result" style="display: none; margin-top: 10px;">
          <div class="success-indicator">
            <span class="material-icons" style="color: var(--app-secondary);">check_circle</span>
            <span>保存完了:</span>
          </div>
          <div class="command-display" id="command-text">view /tmp/file.txt</div>
        </div>
        
        <!-- 旧ダイアログ（非表示、後方互換性のため残す） -->
        <div id="share-result-dialog" style="display: none;"></div>
      </div>
      
      <div id="error-container" style="display: none; position: fixed; bottom: 20px; right: 20px; background-color: var(--app-danger); color: white; padding: 10px; border-radius: 4px;"></div>
      
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  /**
   * ステータスファイルを読み込む
   */
  private async _loadStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath || !this._projectPath) {
        return;
      }

      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(this._projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      // ステータスファイルが存在しない場合はテンプレートを作成
      if (!fs.existsSync(this._statusFilePath)) {
        Logger.info('CURRENT_STATUS.mdファイルが存在しないため、テンプレートを作成します');
        const templateContent = this._getDefaultTemplate();
        await fs.promises.writeFile(this._statusFilePath, templateContent, 'utf8');
      }

      // ファイルを読み込み
      const content = await this._fileManager.readFileAsString(this._statusFilePath);
      
      // スコープ情報を解析
      await this._parseStatusFile(content);
      
      // ファイルの存在に基づいてスコープの完了状態を確認し更新
      await this._checkAndUpdateScopeCompletion();
      
      // Webviewに状態を送信
      this._panel.webview.postMessage({
        command: 'updateState',
        scopes: this._scopes,
        selectedScopeIndex: this._selectedScopeIndex,
        selectedScope: this._currentScope
      });
    } catch (error) {
      Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
      this._showError(`ステータスファイルの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ステータスファイルを更新する
   */
  private async _updateStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath || !this._projectPath) {
        return;
      }

      // 更新中フラグを設定
      this._isUpdatingStatusFile = true;

      // ファイルを読み込み
      let content = await this._fileManager.readFileAsString(this._statusFilePath);
      
      // 現在のスコープ情報を更新
      if (this._currentScope) {
        const scopeName = this._currentScope.name;
        const progress = this._currentScope.progress || 0;
        const status = this._currentScope.status || 'pending';
        
        // 完了したスコープ
        if (status === 'completed') {
          // 進行中または未着手からスコープを削除
          content = content.replace(new RegExp(`- \\[ \\] ${scopeName}[^\n]*\n(?:  [^\n]*\n)*`, 'g'), '');
          
          // 完了済みスコープセクションにスコープを追加
          const completedMatch = content.match(/### 完了済みスコープ[^\n]*\n/);
          if (completedMatch) {
            const insertPos = completedMatch.index || 0;
            const completedSection = completedMatch[0];
            const newCompletedScope = `- [x] ${scopeName} (100%)\n  - 説明: ${this._currentScope.description || ''}\n  - ステータス: 完了\n  - スコープID: ${this._currentScope.id || ''}\n\n`;
            
            // セクションの直後にスコープを挿入
            content = content.substring(0, insertPos + completedSection.length) + newCompletedScope + content.substring(insertPos + completedSection.length);
          }
        } 
        // 進行中スコープ
        else if (status === 'in-progress') {
          // 既存のスコープ情報を更新
          const scopeRegex = new RegExp(`- \\[ \\] ${scopeName} \\((\\d+)%\\)`, 'g');
          content = content.replace(scopeRegex, `- [ ] ${scopeName} (${progress}%)`);
        }
        
        // ファイルリストの更新
        if (this._currentScope.files && this._currentScope.files.length > 0) {
          // スコープセクションを見つける
          const scopeSection = content.match(new RegExp(`(###[^#]+${scopeName}[^#]+)`, 'g'));
          if (scopeSection) {
            // ファイルリストの開始位置を見つける
            const fileListMatch = scopeSection[0].match(/関連ファイル:(\s*\n(?:\s*- (?:\[[^\]]*\] )?[^\n]+\n)*)/);
            if (fileListMatch) {
              // 新しいファイルリストを生成
              let newFileList = '  - 関連ファイル:\n';
              this._currentScope.files.forEach((file: any) => {
                newFileList += `    - [${file.completed ? 'x' : ' '}] ${file.path}\n`;
              });
              
              // ファイルリストを置換
              content = content.replace(fileListMatch[0], `関連ファイル:${newFileList}`);
            }
          }
        }
      }
      
      // ファイルを更新
      await fs.promises.writeFile(this._statusFilePath, content, 'utf8');
    } catch (error) {
      Logger.error('ステータスファイルの更新中にエラーが発生しました', error as Error);
      this._showError(`ステータスファイルの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリ構造を更新する
   */
  private async _updateDirectoryStructure(): Promise<void> {
    if (!this._projectPath) {
      return;
    }
    
    try {
      // ディレクトリツールを利用してプロジェクト構造を取得
      const { execSync } = require('child_process');
      
      // コマンドを実行
      const command = process.platform === 'win32'
        ? `cmd /c cd "${this._projectPath}" && tree /F /A`
        : `find "${this._projectPath}" -type f | grep -v "node_modules" | grep -v ".git" | sort`;
      
      const output = execSync(command, { maxBuffer: 10 * 1024 * 1024 }).toString();
      
      this._directoryStructure = output;
    } catch (error) {
      Logger.error('ディレクトリ構造の取得中にエラーが発生しました', error as Error);
      this._directoryStructure = 'ディレクトリ構造の取得に失敗しました。';
    }
  }

  /**
   * ファイル変更の監視を設定
   */
  private _setupFileWatcher(): void {
    try {
      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(this._projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      
      // デバウンス用のタイマーID
      let debounceTimer: NodeJS.Timeout | null = null;
      // 前回変更時刻を記録
      let lastModified = 0;
      
      // Node.jsのネイティブfs.watchを使用してdocsディレクトリを監視
      this._docsDirWatcher = fs.watch(docsDir, (eventType, filename) => {
        if (filename === 'CURRENT_STATUS.md') {
          // 最小間隔(300ms)以内の連続変更は無視する
          const now = Date.now();
          if (now - lastModified < 300) {
            return;
          }
          lastModified = now;
          
          Logger.info('CURRENT_STATUS.mdファイルの変更を検出しました (fs.watch)');
          
          // 既存のタイマーをクリア
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          
          // デバウンス処理：500ms後に実行
          debounceTimer = setTimeout(() => {
            // プログラムによる変更チェック（自分自身が変更した場合は通知しない）
            if (this._isUpdatingStatusFile) {
              this._isUpdatingStatusFile = false;
              return;
            }
            
            Logger.info('バウンス処理を実行します');
            
            // イベントバスに通知を送信
            const eventBus = AppGeniusEventBus.getInstance();
            const projectId = path.basename(this._projectPath);
            eventBus.emit(AppGeniusEventType.CURRENT_STATUS_UPDATED, { projectId }, 'scopeManager', projectId);
            
            // ファイルが変更されたらステータスを再読み込み
            this._loadStatusFile();
          }, 500);
        }
      });
    } catch (error) {
      Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * デフォルトテンプレートを取得
   */
  private _getDefaultTemplate(): string {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    
    return `# プロジェクト開発 - 進行状況 (${today}更新)

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
- [ ] 基本機能の実装 (0%)
  - 説明: プロジェクトの基本機能を実装します
  - ステータス: 未着手
  - スコープID: scope-${Date.now()}
  - 関連ファイル:
    - (ファイルはまだ定義されていません)
`;
  }

  /**
   * nonce値を生成
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    if (ScopeManagerPanel.currentPanel === this) {
      ScopeManagerPanel.currentPanel = undefined;
    }

    // パネル自体を破棄
    this._panel.dispose();

    // ファイルウォッチャーを破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    // Node.jsのファイルシステムウォッチャーも破棄
    if (this._docsDirWatcher) {
      this._docsDirWatcher.close();
      this._docsDirWatcher = null;
    }
    
    // 共有サービスの一時ファイルクリーンアップを実行
    if (this._sharingService) {
      this._sharingService.cleanupExpiredFiles();
    }

    // disposable なオブジェクトを破棄
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * ファイル存在に基づいて解析したスコープ情報をステータスファイルから解析
   */
  private async _parseStatusFile(content: string): Promise<void> {
    try {
      this._scopes = [];
      
      // スコープを抽出して追加
      // 完了済みスコープのパターン: [x] スコープ名 (100%)
      const completedScopeRegex = /- \[x\] ([^\n]+?) \(100%\)[^\n]*\n(?:  [^\n]*\n)*/g;
      let completedScopeMatch;
      while ((completedScopeMatch = completedScopeRegex.exec(content)) !== null) {
        const scopeName = completedScopeMatch[1].trim();
        const scopeContent = completedScopeMatch[0];
        
        // 説明とIDを抽出
        const descriptionMatch = scopeContent.match(/- 説明: ([^\n]+)/);
        const idMatch = scopeContent.match(/- スコープID: ([^\n]+)/);
        
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        const id = idMatch ? idMatch[1].trim() : `scope-${Date.now()}`;
        
        this._scopes.push({
          name: scopeName,
          description: description,
          id: id,
          status: 'completed',
          progress: 100,
          files: []
        });
      }
      
      // 進行中スコープのパターン: [ ] スコープ名 (進捗%)
      const inProgressScopeRegex = /- \[ \] ([^\n]+?) \((\d+)%\)[^\n]*\n(?:  [^\n]*\n)*/g;
      let inProgressScopeMatch;
      while ((inProgressScopeMatch = inProgressScopeRegex.exec(content)) !== null) {
        const scopeName = inProgressScopeMatch[1].trim();
        const progress = parseInt(inProgressScopeMatch[2]);
        const scopeContent = inProgressScopeMatch[0];
        
        // 説明とIDを抽出
        const descriptionMatch = scopeContent.match(/- 説明: ([^\n]+)/);
        const idMatch = scopeContent.match(/- スコープID: ([^\n]+)/);
        
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        const id = idMatch ? idMatch[1].trim() : `scope-${Date.now()}`;
        
        // ファイルリストを抽出
        const filesMatch = scopeContent.match(/関連ファイル:([^\n]*\n(?:    - (?:\[[^\]]*\] )?[^\n]+\n)*)/);
        const files: any[] = [];
        
        if (filesMatch) {
          const filesContent = filesMatch[1];
          const fileLines = filesContent.split('\n');
          
          for (const line of fileLines) {
            const fileMatch = line.match(/^\s*- \[([x ])\] (.+)$/);
            if (fileMatch) {
              files.push({
                path: fileMatch[2].trim(),
                completed: fileMatch[1] === 'x'
              });
            } else if (line.match(/^\s*- [^[]/) && !line.includes('ファイルはまだ定義されていません')) {
              // チェックボックスなしの箇条書き
              const filePath = line.replace(/^\s*- /, '').trim();
              files.push({
                path: filePath,
                completed: false
              });
            }
          }
        }
        
        this._scopes.push({
          name: scopeName,
          description: description,
          id: id,
          status: progress > 0 ? 'in-progress' : 'pending',
          progress: progress,
          files: files
        });
      }
      
      // 現在のスコープと選択インデックスを更新
      if (this._selectedScopeIndex >= this._scopes.length) {
        this._selectedScopeIndex = this._scopes.length > 0 ? 0 : -1;
      }
      
      if (this._selectedScopeIndex >= 0) {
        this._currentScope = this._scopes[this._selectedScopeIndex];
      } else {
        this._currentScope = null;
      }
    } catch (error) {
      Logger.error('ステータスファイルの解析中にエラーが発生しました', error as Error);
      this._showError(`ステータスファイルの解析に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ファイルの存在に基づいてスコープの完了状態を確認し更新する
   */
  private async _checkAndUpdateScopeCompletion(): Promise<void> {
    try {
      if (!this._projectPath) {
        return;
      }
      
      // スコープのファイルリストを確認
      for (const scope of this._scopes) {
        if (scope.files && scope.files.length > 0) {
          let completedFiles = 0;
          
          for (const file of scope.files) {
            // ファイルパスの最初の文字が / または \ の場合は絶対パス、そうでなければ相対パス
            const isAbsolutePath = file.path.startsWith('/') || file.path.startsWith('\\');
            const absolutePath = isAbsolutePath ? file.path : path.join(this._projectPath, file.path);
            
            // ファイルが存在するか確認
            file.exists = fs.existsSync(absolutePath);
            
            if (file.exists && file.completed) {
              completedFiles++;
            }
          }
          
          // 進捗率を計算
          const totalFiles = scope.files.length;
          const progress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
          
          // 進捗率が変更された場合は更新
          if (progress !== scope.progress) {
            scope.progress = progress;
            
            // スコープのステータスを更新
            if (progress === 100) {
              scope.status = 'completed';
            } else if (progress > 0) {
              scope.status = 'in-progress';
            } else {
              scope.status = 'pending';
            }
          }
        }
      }
      
      // ステータスファイルを更新
      await this._updateStatusFile();
    } catch (error) {
      Logger.error('スコープ完了状態の確認中にエラーが発生しました', error as Error);
    }
  }
}