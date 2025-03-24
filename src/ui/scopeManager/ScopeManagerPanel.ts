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
  
  // 開発モード管理
  private _isPreparationMode: boolean = false; // 準備モードまたは実装モード

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  protected static _createOrShowPanel(extensionUri: vscode.Uri, projectPath?: string): ScopeManagerPanel {
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
    ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, projectPath);
    return ScopeManagerPanel.currentPanel;
  }
  
  /**
   * 外部向けのパネル作成・表示メソッド
   * 認証状態と権限チェック付きで、パネルを表示する
   */
  public static async createOrShow(extensionUri: vscode.Uri, projectPath?: string): Promise<ScopeManagerPanel | undefined> {
    // 権限チェック
    if (!this.checkPermissionForFeature(Feature.SCOPE_MANAGER, 'ScopeManagerPanel')) {
      return undefined;
    }
    
    // 権限があれば表示
    const panel = this._createOrShowPanel(extensionUri, projectPath);
    
    // API接続テスト（認証状態確認）
    const isAPIConnected = await panel._testAPIConnection();
    if (!isAPIConnected) {
      Logger.warn('API接続テストに失敗しました。スコープマネージャーは表示できません');
      vscode.window.showErrorMessage('サーバー接続に問題があります。再ログインしてください。');
      
      // 再ログイン用コマンドを提案
      const action = await vscode.window.showInformationMessage(
        'API接続に失敗しました。再ログインしますか？',
        '再ログイン'
      );
      
      if (action === '再ログイン') {
        // ログアウトしてから再ログイン画面を表示
        vscode.commands.executeCommand('appgenius-ai.logout').then(() => {
          setTimeout(() => {
            vscode.commands.executeCommand('appgenius-ai.login');
          }, 500);
        });
      }
      
      return panel; // APIチェックに失敗してもパネルは表示する（後から再認証できるようにするため）
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
    this._fileManager = FileOperationManager.getInstance();
    
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
            case 'updateScopeStatus':
              await this._handleUpdateScopeStatus(message.scopeId, message.status, message.progress);
              break;
            case 'toggleFileStatus':
              await this._handleToggleFileStatus(message.filePath, message.completed);
              break;
            case 'startImplementation':
              await this._handleStartImplementation();
              break;
            case 'editScope':
              await this._handleEditScope(message.scopeData);
              break;
            case 'showDirectoryStructure':
              await this._handleShowDirectoryStructure();
              break;
            case 'addNewScope':
              await this._handleAddNewScope();
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
            case 'openReferenceManager':
              await this._handleOpenReferenceManager();
              break;
            case 'launchScopeCreator':
              await this._handleLaunchScopeCreator();
              break;
            case 'launchImplementationAssistant':
              await this._handleLaunchImplementationAssistant();
              break;
            case 'openRequirementsVisualizer':
              await this._handleOpenRequirementsVisualizer();
              break;
            case 'switchToImplementationMode':
              await this._handleSwitchToImplementationMode();
              break;
            case 'resetToPreparationMode':
              await this._handleResetToPreparationMode();
              break;
          }
        } catch (error) {
          Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
          await this._showError(`操作に失敗しました: ${(error as Error).message}`);
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
    Logger.info(`[Debug] スコープマネージャー:setProjectPath呼び出し - パラメータ: ${projectPath}`);
    
    // スタックトレースを表示（呼び出し元を特定するため）
    try {
      throw new Error('スタックトレース確認用');
    } catch (e) {
      Logger.debug(`[Debug] setProjectPathの呼び出し元スタック: ${(e as Error).stack?.split('\n').slice(1, 3).join('\n')}`);
    }
    
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
   * ファイル変更の監視を設定
   */
  private _setupFileWatcher(): void {
    try {
      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(this._projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      
      // Node.jsのネイティブfs.watchを使用してdocsディレクトリを監視
      // これにより、OSレベルのファイルシステムイベントを直接検知できる
      this._docsDirWatcher = fs.watch(docsDir, (eventType, filename) => {
        if (filename === 'CURRENT_STATUS.md') {
          Logger.info('CURRENT_STATUS.mdファイルの変更を検出しました (fs.watch)');
          Logger.info(`ファイルパス: ${this._statusFilePath}, 存在確認: ${fs.existsSync(this._statusFilePath) ? '存在します' : '存在しません'}`);
          
          // イベントバスに通知を送信 - グローバルイベントとして通知
          const eventBus = AppGeniusEventBus.getInstance();
          // プロジェクトIDは現在のプロジェクトパスから抽出する
          const projectId = this._projectPath ? path.basename(this._projectPath) : undefined;
          
          eventBus.emit(
            AppGeniusEventType.CURRENT_STATUS_UPDATED,
            { filePath: this._statusFilePath, timestamp: Date.now() },
            'ScopeManagerPanel',
            projectId
          );
          
          // 直接ファイルを読み込み、WebViewを強制更新する
          // 実装モードの場合はリアルタイムで更新する
          setTimeout(() => {
            Logger.info('CURRENT_STATUS.mdファイルの変更を検出 - 遅延読み込みによる強制更新を実行');
            if (fs.existsSync(this._statusFilePath)) {
              try {
                const content = fs.readFileSync(this._statusFilePath, 'utf8');
                this._parseStatusFile(content);
                this._updateWebview();
                
                // 二重の更新を防ぐための追加ログ
                Logger.info('CURRENT_STATUS.mdファイルの強制更新が完了しました');
              } catch (err) {
                Logger.error('強制更新中にエラーが発生しました', err as Error);
              }
            }
          }, 200); // 少し遅延させて確実にファイル書き込みが完了した後に読み込む
          
          // 通常の更新処理も維持
          if (!this._isPreparationMode) {
            Logger.info('実装モードでCURRENT_STATUSが更新されました - リアルタイム更新を行います');
            this._loadStatusFile();
          } else {
            Logger.info('準備モードでの変更は標準の処理を実行します');
            this._loadStatusFile();
          }
        }
      });
      
      // VS Codeのファイルシステムウォッチャーもバックアップとして維持
      // このウォッチャーはVS Code内部での操作を監視するために使用
      this._fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          this._projectPath, 
          'docs/CURRENT_STATUS.md'
        )
      );
      
      // ファイル変更時の処理
      this._fileWatcher.onDidChange(() => {
        Logger.info('CURRENT_STATUS.mdファイルの変更を検出しました (VSCode watcher)');
        this._loadStatusFile();
      });
      
      // 新規ファイル作成時の処理
      this._fileWatcher.onDidCreate(() => {
        Logger.info('CURRENT_STATUS.mdファイルが新規作成されました');
        this._loadStatusFile();
      });
      
      // ファイル削除時の処理（必要に応じて）
      this._fileWatcher.onDidDelete(() => {
        Logger.info('CURRENT_STATUS.mdファイルが削除されました');
        // ファイルが削除された場合は空のスコープリストを表示
        this._scopes = [];
        this._updateWebview();
      });
      
      // ウォッチャーをdisposablesに追加
      this._disposables.push(this._fileWatcher);
      
      // スコープ進捗のトリガーとなる重要ファイルの監視（docs/requirements.md, mockups/*.html, docs/scopes/*.md, docs/env.md）
      
      // 要件定義ファイルの監視
      const requirementsWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this._projectPath, 'docs/requirements.md')
      );
      
      requirementsWatcher.onDidCreate(() => {
        Logger.info('requirements.mdファイルが作成されました - スコープ1の完了を確認します');
        this._checkAndUpdateScopeCompletion();
      });
      
      this._disposables.push(requirementsWatcher);
      
      // モックアップディレクトリの監視
      const mockupsWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this._projectPath, 'mockups/**/*.html')
      );
      
      mockupsWatcher.onDidCreate(() => {
        Logger.info('新しいモックアップファイルが作成されました - スコープ2の完了を確認します');
        this._checkAndUpdateScopeCompletion();
      });
      
      this._disposables.push(mockupsWatcher);
      
      // スコープディレクトリの監視
      const scopesWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this._projectPath, 'docs/scopes/**/*.md')
      );
      
      scopesWatcher.onDidCreate(() => {
        Logger.info('新しいスコープ定義ファイルが作成されました - スコープ3の完了を確認します');
        this._checkAndUpdateScopeCompletion();
      });
      
      this._disposables.push(scopesWatcher);
      
      // 環境変数ファイルの監視
      const envWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this._projectPath, 'docs/env.md')
      );
      
      envWatcher.onDidCreate(() => {
        Logger.info('env.mdファイルが作成されました - スコープ4の完了を確認します');
        this._checkAndUpdateScopeCompletion();
      });
      
      this._disposables.push(envWatcher);
      
      Logger.info('ファイル監視を設定しました');
    } catch (error) {
      Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * CURRENT_STATUS.mdファイルを読み込む
   */
  private async _loadStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath) {
        Logger.warn(`ステータスファイルのパスが未設定です`);
        return;
      }
      
      Logger.info(`CURRENT_STATUS.mdファイルを読み込みます。パス: ${this._statusFilePath}`);
      
      // ファイルが存在しない場合、開発準備モードで表示する
      if (!fs.existsSync(this._statusFilePath)) {
        Logger.info(`CURRENT_STATUS.mdファイルが見つかりません - 開発準備モードを有効化します`);
        
        // 開発準備モードを有効化
        this._isPreparationMode = true;
        
        // 準備モード用のスコープを解析
        let preparationTemplate = this._getPreparationStepsTemplate();
        this._parseStatusFile(preparationTemplate);
        
        // WebViewを更新（準備モードUI）
        this._updateWebview();
        
        return;  // ここで処理を終了（ファイル読み込みは不要）
      } else {
        // CURRENT_STATUS.mdが存在する場合は実装モードで動作
        this._isPreparationMode = false;
        
        // ユーザーに再作成の確認（開発準備フェーズに戻る場合）
        if (await this._shouldResetToPreparationMode()) {
          try {
            // docsディレクトリが存在するか確認し、必要に応じて作成
            const docsDir = path.dirname(this._statusFilePath);
            if (!fs.existsSync(docsDir)) {
              fs.mkdirSync(docsDir, { recursive: true });
              Logger.info(`ディレクトリを作成しました: ${docsDir}`);
            }
            
            // 内部定義のテンプレートを使用
            let template = this._getPreparationStepsTemplate();
            Logger.info(`内部テンプレートを使用してCURRENT_STATUSを作成します`);
            
            fs.writeFileSync(this._statusFilePath, template, 'utf8');
            Logger.info(`CURRENT_STATUS.mdテンプレートを作成しました: ${this._statusFilePath}`);
            
            // 開発準備モードを有効化
            this._isPreparationMode = true;
            
            // 作成したファイルを読み込み
            let content = template;
            
            // 自動的にファイル存在に基づいてスコープ状態を更新
            await this._checkAndUpdateScopeCompletion();
            
          } catch (error) {
            Logger.error(`テンプレートファイルの作成に失敗しました: ${(error as Error).message}`);
            vscode.window.showErrorMessage(`テンプレートファイルの作成に失敗しました: ${(error as Error).message}`);
            return;
          }
        } else {
          // ユーザーがテンプレート作成を拒否した場合
          this._panel.webview.postMessage({
            command: 'showError',
            message: `CURRENT_STATUS.mdファイルが見つかりません。ファイルを手動で作成してください: ${this._statusFilePath}`
          });
          return;
        }
      }

      // ファイルの内容を読み込む
      let content = await this._fileManager.readFileAsString(this._statusFilePath);
      Logger.info(`ファイル読み込み完了 - 内容の長さ: ${content.length}バイト`);
      
      // ステータスファイルからスコープ情報を解析
      this._parseStatusFile(content);
      Logger.info(`ステータスファイル解析完了 - スコープ数: ${this._scopes.length}`);
      
      // 明示的にWebViewを更新
      await this._updateWebview();
      
      // フォーマットチェックを行い、問題があればファイルに警告コメントを追加（一度だけ）
      let needsWarning = false;
      let warningMessage = '';
      
      // 必要なセクションが存在するか確認
      const hasUnstartedSection = content.includes('### 未着手スコープ');
      const hasInProgressSection = content.includes('### 進行中スコープ');
      const hasCompletedSection = content.includes('### 完了済みスコープ');
      
      // 未着手スコープセクションがない
      if (!hasUnstartedSection) {
        Logger.warn('「未着手スコープ」セクションが見つかりません。');
        needsWarning = true;
        warningMessage += `\n### 未着手スコープ\n`;
      }
      
      // 進行中スコープセクションがない
      if (!hasInProgressSection) {
        Logger.warn('「進行中スコープ」セクションが見つかりません。');
        needsWarning = true;
        warningMessage += `\n### 進行中スコープ\n（実装中のスコープはまだありません）\n`;
      }
      
      // 完了済みスコープセクションがない
      if (!hasCompletedSection) {
        Logger.warn('「完了済みスコープ」セクションが見つかりません。');
        needsWarning = true;
        warningMessage += `\n### 完了済みスコープ\n（完了したスコープはまだありません）\n`;
      }
      
      // 箇条書きフォーマットチェック
      const completedScopeSection = content.match(/### 完了済みスコープ\s*\n((?:.*\n)*?)(?:\n###|$)/);
      const inProgressScopeSection = content.match(/### 進行中スコープ\s*\n((?:.*\n)*?)(?:\n###|$)/);
      const pendingScopeSection = content.match(/### 未着手スコープ\s*\n((?:.*\n)*?)(?:\n###|$)/);
      
      const hasCompletedBullets = completedScopeSection && completedScopeSection[1].trim().match(/^- \[x\]/m);
      const hasInProgressBullets = inProgressScopeSection && inProgressScopeSection[1].trim().match(/^- \[ \]/m);
      const hasPendingBullets = pendingScopeSection && pendingScopeSection[1].trim().match(/^- \[ \]/m);
      
      // 警告が既に存在するか確認（重複追加を防ぐ）
      const hasExistingWarning = content.includes('<!-- スコープマネージャー警告:');
      
      // 問題があり、かつ既存の警告がない場合のみ、ファイルに警告を追加
      if ((needsWarning || !hasCompletedBullets || !hasInProgressBullets || !hasPendingBullets) && !hasExistingWarning) {
        Logger.warn('フォーマットに問題があります。ファイルに警告を追加します。');
        
        // 警告メッセージを作成
        const warningTemplate = `\n\n<!-- スコープマネージャー警告: 以下のフォーマット推奨事項を確認してください -->
<!-- 
スコープマネージャーが正しく動作するには、以下のセクションとフォーマットが必要です：

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）
または
- [x] 完了したスコープ名 (100%)

### 進行中スコープ
（実装中のスコープはまだありません）
または
- [ ] 進行中のスコープ名 (50%)

### 未着手スコープ
- [ ] スコープ名
  - 説明: スコープの説明
  - 優先度: 高/中/低
  - 関連ファイル: ファイルパス1, ファイルパス2
-->

${warningMessage}`;
        
        // ファイルに警告を追加
        try {
          // 不足している必須セクションを追加しつつ、警告メッセージも追記
          let updatedContent = content;
          
          // スコープ状況セクションの有無をチェック
          if (!content.includes('## スコープ状況')) {
            // ファイルの末尾にスコープ状況セクションを追加
            updatedContent = updatedContent.trim() + `\n\n## スコープ状況`;
          }
          
          // 警告を追加（ファイルの末尾）
          updatedContent = updatedContent.trim() + warningTemplate;
          
          // 更新したファイルを保存
          await fs.promises.writeFile(this._statusFilePath, updatedContent, 'utf8');
          Logger.info('CURRENT_STATUS.mdファイルにフォーマット警告とサンプルを追加しました');
          
          // 更新した内容を再読み込み
          content = updatedContent;
          // 修正したファイルを再解析
          this._parseStatusFile(content);
        } catch (writeError) {
          Logger.error(`警告の追加に失敗しました: ${(writeError as Error).message}`);
        }
      } else if (!needsWarning && hasCompletedBullets && hasInProgressBullets && hasPendingBullets) {
        // 全ての条件を満たしている場合、既存の警告があれば削除
        if (hasExistingWarning) {
          try {
            // 既存の警告を削除
            const updatedContent = content.replace(/\n*<!-- スコープマネージャー警告:[\s\S]*?-->[\s\S]*?(?=\n\n|$)/g, '');
            
            // 更新したファイルを保存
            await fs.promises.writeFile(this._statusFilePath, updatedContent, 'utf8');
            Logger.info('フォーマットが修正されたため、警告を削除しました');
            
            // 更新した内容を再読み込み
            content = updatedContent;
          } catch (removeError) {
            Logger.error(`警告の削除に失敗しました: ${(removeError as Error).message}`);
          }
        }
      }
      
      // WebViewを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * CURRENT_STATUS.mdファイルのテンプレートを取得（新規作成用）
   * このメソッドは直接ファイルを変更せず、テンプレート文字列を返すだけ
   */
  private _getStatusFileTemplate(): string {
    return `# プロジェクト現状

## 全体進捗
- 要件定義: 未完了
- モックアップ: 未完了
- ディレクトリ構造: 未完了
- 実装: 未開始
- テスト: 未開始
- デプロイ: 未開始

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
（未着手のスコープはまだありません。スコープを追加するには次の形式を使用してください）

- [ ] スコープ名
  - 説明: スコープの説明
  - 優先度: 高/中/低
  - 関連ファイル: ファイルパス1, ファイルパス2

## 環境変数設定状況

必要な環境変数:
- API_KEY: 未設定
- DATABASE_URL: 未設定

## API設計

APIエンドポイントはまだ定義されていません。
`;
  }

  /**
   * ステータスファイルからスコープ情報を解析
   */
  private _parseStatusFile(content: string): void {
    try {
      this._scopes = [];
      let currentSection = '';
      let completedScopes: any[] = [];
      let inProgressScopes: any[] = [];
      let pendingScopes: any[] = [];
      let directoryStructure = '';
      let completedFiles: string[] = [];
      let inProgressFiles: string[] = [];
      let nextScope: any = null;
      let inheritanceInfo: string = '';
      
      // 行ごとに処理
      const lines = content.split(/\r?\n/);
      let i = 0;
      
      while (i < lines.length) {
        const line = lines[i];
        
        // セクションヘッダーを検出 (## や ### 両方に対応)
        if (line.startsWith('## ')) {
          currentSection = line.substring(3).trim();
          i++;
          continue;
        }
        
        // スコープセクションの処理
        if (currentSection === 'スコープ状況') {
          // 見出しを検出する正規表現を拡張
          if (line.startsWith('### 完了済みスコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const scopeLine = lines[i].trim();
              // 完了スコープの箇条書きパターンを検出 ([x])
              const match = scopeLine.match(/- \[x\] (.+?) \(100%\)/);
              if (match) {
                const name = match[1];
                completedScopes.push({
                  name,
                  status: 'completed',
                  progress: 100
                });
              }
              i++;
            }
            continue;
          } else if (line.startsWith('### 進行中スコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const scopeLine = lines[i].trim();
              // 進行中スコープの箇条書きパターンを検出 ([ ] + 進捗率)
              const match = scopeLine.match(/- \[ \] (.+?) \((\d+)%\)/);
              if (match) {
                const name = match[1];
                const progress = parseInt(match[2]);
                inProgressScopes.push({
                  name,
                  status: 'in-progress',
                  progress
                });
              }
              i++;
            }
            continue;
          } else if (line.startsWith('### 未着手スコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const scopeLine = lines[i].trim();
              // より柔軟な未着手スコープの検出パターン：
              // 1. 標準形式 ([ ] スコープ名 (0%))
              // 2. ダッシュボード形式 ([ ] スコープ名) - 進捗情報なし
              // 3. ID付き形式 ([ ] スコープ名 (scope-xxx-xxx))
              let match = scopeLine.match(/- \[ \] (.+?) \(0%\)/);
              
              if (!match) {
                // 進捗情報のない形式を検出
                match = scopeLine.match(/^- \[ \] ([^(]+)(?:\s|$)/);
              }
              
              if (!match && scopeLine.includes('(scope-')) {
                // スコープID付きの形式を検出
                match = scopeLine.match(/^- \[ \] (.+?) \(scope-[^)]+\)/);
              }
              
              if (match) {
                const name = match[1].trim();
                
                // ロギングを追加（デバッグ用）
                Logger.info(`未着手スコープを検出: "${name}" (行: ${scopeLine})`);
                
                // スコープID抽出を試みる (スコープIDパターンがあれば)
                let scopeId = '';
                const idMatch = scopeLine.match(/\(scope-([^)]+)\)/);
                if (idMatch) {
                  scopeId = `scope-${idMatch[1]}`;
                }
                
                // 説明の抽出を試みる（次の行がインデントされている場合）
                let description = '';
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith('- 説明:')) {
                  description = lines[i + 1].trim().substring('- 説明:'.length).trim();
                }
                
                pendingScopes.push({
                  name,
                  status: 'pending',
                  progress: 0,
                  id: scopeId,
                  description: description
                });
              }
              i++;
            }
            continue;
          }
        }
        
        // ディレクトリ構造セクションの処理
        if (currentSection === '現在のディレクトリ構造') {
          if (line.startsWith('```')) {
            i++;
            let structureContent = '';
            while (i < lines.length && !lines[i].startsWith('```')) {
              structureContent += lines[i] + '\n';
              i++;
            }
            directoryStructure = structureContent;
            this._directoryStructure = structureContent;
            i++; // ```の行をスキップ
            continue;
          }
        }
        
        // 実装ファイルセクションの処理（スコープ別）
        // 「実装完了ファイル」「実装すべきファイル」「実装予定ファイル」など複数のパターンに対応
        if (currentSection.includes('実装完了ファイル') || 
            currentSection.includes('実装すべきファイル') || 
            currentSection.includes('実装予定ファイル')) {
          // スコープ別のファイルリストを処理
          if (line.startsWith('### スコープ') || line.trim().startsWith('- [')) {
            let currentScopeName = '';
            
            // スコープヘッダーを検出
            if (line.startsWith('### スコープ')) {
              currentScopeName = line.substring(4).trim();
              i++;
            }
            
            // ファイルリストを処理
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const fileLine = lines[i].trim();
              if (fileLine.startsWith('- [')) {
                const completedMatch = fileLine.match(/- \[([ x])\] ([^\(\)]+)/);
                if (completedMatch) {
                  const isCompleted = completedMatch[1] === 'x';
                  const filePath = completedMatch[2].trim();
                  
                  // 完了済みならcompletedFilesに追加
                  if (isCompleted) {
                    completedFiles.push(filePath);
                  }
                  
                  // 該当するスコープのファイルリストを更新
                  const scopesToUpdate = [...completedScopes, ...inProgressScopes, ...pendingScopes];
                  scopesToUpdate.forEach(scope => {
                    if (scope.name === currentScopeName || fileLine.includes(scope.name)) {
                      if (!scope.files) scope.files = [];
                      
                      // 既存のファイルリストにあれば更新、なければ追加
                      const fileIndex = scope.files.findIndex((f: any) => f.path === filePath);
                      if (fileIndex >= 0) {
                        scope.files[fileIndex].completed = isCompleted;
                      } else {
                        scope.files.push({
                          path: filePath,
                          completed: isCompleted
                        });
                      }
                    }
                  });
                }
              }
              i++;
            }
            continue;
          }
        }
        
        // 実装中ファイルセクションの処理（より柔軟性を持たせる）
        if (currentSection === '実装中ファイル' || currentSection.includes('実装中')) {
          if (line.trim().startsWith('- [ ]')) {
            const filePath = line.match(/- \[ \] ([^\(\)]+)/)?.[1]?.trim();
            if (filePath) {
              inProgressFiles.push(filePath);
              
              // 進行中スコープのファイルリストを更新
              inProgressScopes.forEach(scope => {
                if (line.includes(scope.name)) {
                  if (!scope.files) scope.files = [];
                  
                  // 既存のファイルリストにあれば更新、なければ追加
                  const fileIndex = scope.files.findIndex((f: any) => f.path === filePath);
                  if (fileIndex >= 0) {
                    scope.files[fileIndex].completed = false;
                  } else {
                    scope.files.push({
                      path: filePath,
                      completed: false
                    });
                  }
                }
              });
            }
          }
          i++;
          continue;
        }
        
        // 引継ぎ情報セクションの処理
        if (currentSection === '引継ぎ情報') {
          // 現在のスコープ情報の処理
          if (line.startsWith('### 現在のスコープ:')) {
            const scopeName = line.substring('### 現在のスコープ:'.length).trim();
            let scopeId = '';
            let description = '';
            let features = [];
            let files = [];
            
            // 引継ぎ情報の内容をキャプチャ
            let sectionStartIdx = i;
            let sectionEndIdx = i;
            
            i++;
            while (i < lines.length && !lines[i].startsWith('##')) {
              const currentLine = lines[i];
              
              if (currentLine.startsWith('**スコープID**:')) {
                scopeId = currentLine.substring('**スコープID**:'.length).trim();
              } else if (currentLine.startsWith('**説明**:')) {
                description = currentLine.substring('**説明**:'.length).trim();
              } else if (currentLine.startsWith('**含まれる機能**:')) {
                i++;
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                  features.push(lines[i].replace(/^\d+\. /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**実装すべきファイル**:') || 
                         currentLine.startsWith('**実装予定ファイル**:') || 
                         currentLine.includes('実装すべきファイル') || 
                         currentLine.includes('実装予定ファイル')) {
                
                sectionEndIdx = i - 1; // 実装すべきファイルの前の行まで引継ぎ情報としてキャプチャ
                i++;
                
                // ファイルリストを処理（空行までまたは別のセクションまで）
                while (i < lines.length && 
                       (lines[i].trim().startsWith('- ') || lines[i].trim().length === 0) && 
                       !lines[i].startsWith('**') && 
                       !lines[i].startsWith('##')) {
                  
                  const line = lines[i].trim();
                  if (line.length === 0) {
                    i++;
                    continue;
                  }
                  
                  // 箇条書きチェックボックス形式 (- [ ] path)
                  const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
                  if (checkboxMatch) {
                    const completed = checkboxMatch[1] === 'x';
                    const filePath = checkboxMatch[2].trim();
                    files.push({
                      path: filePath,
                      completed
                    });
                  } 
                  // 単純な箇条書き形式 (- path)
                  else if (line.startsWith('- ')) {
                    const filePath = line.substring(2).trim();
                    // 「（ファイルはまだ定義されていません）」はスキップ
                    if (!filePath.includes('ファイルはまだ定義されていません')) {
                      files.push({
                        path: filePath,
                        completed: false
                      });
                    }
                  }
                  i++;
                }
                continue;
              }
              
              i++;
            }
            
            // 引継ぎ情報を抽出
            if (sectionEndIdx > sectionStartIdx) {
              inheritanceInfo = lines.slice(sectionStartIdx, sectionEndIdx + 1).join('\n');
            }
            
            // 現在進行中のスコープを選択
            const found = [...completedScopes, ...inProgressScopes, ...pendingScopes].find(s => s.name.includes(scopeName));
            if (found) {
              this._currentScope = {
                ...found,
                id: scopeId,
                description,
                features,
                files,
                inheritanceInfo
              };
            } else if (scopeName) {
              // スコープリストに存在しないが、スコープ名が記載されている場合は新規作成
              const newScope = {
                name: scopeName,
                id: scopeId || `scope-${Date.now()}`,
                description,
                status: 'pending',
                progress: 0,
                features,
                files,
                inheritanceInfo
              };
              
              pendingScopes.push(newScope);
              this._currentScope = newScope;
            }
            
            continue;
          }
        }
        
        // 次のスコープ情報の処理
        if (currentSection === '次回実装予定') {
          if (line.startsWith('### 次のスコープ:')) {
            const scopeName = line.substring('### 次のスコープ:'.length).trim();
            let scopeId = '';
            let description = '';
            let features = [];
            let files = [];
            let dependencies = [];
            
            // 引継ぎ情報の開始位置
            let sectionStartIdx = i;
            let sectionEndIdx = i;
            
            i++;
            while (i < lines.length && !lines[i].startsWith('##')) {
              const currentLine = lines[i];
              
              if (currentLine.startsWith('**スコープID**:')) {
                scopeId = currentLine.substring('**スコープID**:'.length).trim();
              } else if (currentLine.startsWith('**説明**:')) {
                description = currentLine.substring('**説明**:'.length).trim();
              } else if (currentLine.startsWith('**含まれる機能**:')) {
                i++;
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                  features.push(lines[i].replace(/^\d+\. /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**依存するスコープ**:')) {
                i++;
                while (i < lines.length && lines[i].trim().startsWith('- ')) {
                  dependencies.push(lines[i].replace(/^- /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**実装予定ファイル**:') || 
                         currentLine.startsWith('**実装すべきファイル**:') || 
                         currentLine.includes('実装すべきファイル') || 
                         currentLine.includes('実装予定ファイル')) {
                
                sectionEndIdx = i - 1; // 実装すべきファイルの前の行まで引継ぎ情報としてキャプチャ
                i++;
                
                // ファイルリストを処理（空行までまたは別のセクションまで）
                while (i < lines.length && 
                       (lines[i].trim().startsWith('- ') || lines[i].trim().length === 0) && 
                       !lines[i].startsWith('**') && 
                       !lines[i].startsWith('##')) {
                  
                  const line = lines[i].trim();
                  if (line.length === 0) {
                    i++;
                    continue;
                  }
                  
                  // 箇条書きチェックボックス形式 (- [ ] path)
                  const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
                  if (checkboxMatch) {
                    const completed = checkboxMatch[1] === 'x';
                    const filePath = checkboxMatch[2].trim();
                    files.push({
                      path: filePath,
                      completed
                    });
                  } 
                  // 単純な箇条書き形式 (- path)
                  else if (line.startsWith('- ')) {
                    const filePath = line.substring(2).trim();
                    // 「（ファイルはまだ定義されていません）」はスキップ
                    if (!filePath.includes('ファイルはまだ定義されていません')) {
                      files.push({
                        path: filePath,
                        completed: false
                      });
                    }
                  }
                  i++;
                }
                continue;
              }
              
              i++;
            }
            
            // 引継ぎ情報を抽出
            let nextInheritanceInfo = '';
            if (sectionEndIdx > sectionStartIdx) {
              nextInheritanceInfo = lines.slice(sectionStartIdx, sectionEndIdx + 1).join('\n');
            }
            
            // 次のスコープ情報を保存
            nextScope = {
              name: scopeName,
              id: scopeId || `scope-${Date.now()}`,
              description,
              status: 'pending',
              progress: 0,
              features,
              files,
              dependencies,
              inheritanceInfo: nextInheritanceInfo
            };
            
            // もし次のスコープが未着手スコープリストに存在しなければ追加
            const existingNextScope = pendingScopes.find(s => s.name.includes(scopeName));
            if (!existingNextScope && scopeName) {
              pendingScopes.push(nextScope);
            }
            
            continue;
          }
        }
        
        i++;
      }
      
      // 詳細情報からもスコープを検出（代替方法）
      // より柔軟なパターンマッチングを使用
      let detailedScopeMatches = [...content.matchAll(/#### ([^:\n]+)[\s\S]*?スコープID[^:]*?: ([^\n]*)/g)];
      
      // 別形式のスコープも検出 (### 現在のスコープ: や ### 次のスコープ: の形式)
      const currentScopeMatch = content.match(/### 現在のスコープ:\s*([^\n]+)[\s\S]*?スコープID[^:]*?:\s*([^\n]*)/);
      const nextScopeMatch = content.match(/### 次のスコープ:\s*([^\n]+)[\s\S]*?スコープID[^:]*?:\s*([^\n]*)/);
      
      if (currentScopeMatch) {
        // RegExpExecArray型として扱うために変換
        const execArray = Object.assign([null, currentScopeMatch[1], currentScopeMatch[2]], {
          index: 0,
          input: '',
          groups: undefined
        }) as RegExpExecArray;
        detailedScopeMatches.push(execArray);
      }
      
      if (nextScopeMatch) {
        // RegExpExecArray型として扱うために変換
        const execArray = Object.assign([null, nextScopeMatch[1], nextScopeMatch[2]], {
          index: 0,
          input: '',
          groups: undefined
        }) as RegExpExecArray;
        detailedScopeMatches.push(execArray);
      }
      
      // 詳細情報からスコープを補完
      for (const match of detailedScopeMatches) {
        const scopeName = match[1].trim();
        const scopeId = match[2] ? match[2].trim() : `scope-${Date.now()}`;
        
        // 既存のスコープリストに存在しなければ未着手スコープとして追加
        const existingScope = [...completedScopes, ...inProgressScopes, ...pendingScopes]
          .find(s => s.name === scopeName);
        
        if (!existingScope) {
          Logger.info(`詳細情報から新たなスコープを検出: ${scopeName}`);
          pendingScopes.push({
            name: scopeName,
            id: scopeId,
            status: 'pending',
            progress: 0
          });
        }
      }
      
      // スコープの「実装予定ファイル」や「実装すべきファイル」セクションからファイル情報を抽出
      // 実装予定/実装すべきファイルセクションを検出するより汎用的なパターン
      const fileListPatterns = [
        // #### スコープ名\n...\n**実装予定ファイル**:
        new RegExp(`#### ([^:\\n]+)[\\s\\S]*?(?:実装予定ファイル|実装すべきファイル)[^:]*:[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // ### 現在のスコープ: スコープ名\n...\n**実装すべきファイル**:
        new RegExp(`### 現在のスコープ:\\s*([^\\n]+)[\\s\\S]*?(?:実装予定ファイル|実装すべきファイル)[^:]*:[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // ### 次のスコープ: スコープ名\n...\n**実装予定ファイル**:
        new RegExp(`### 次のスコープ:\\s*([^\\n]+)[\\s\\S]*?(?:実装予定ファイル|実装すべきファイル)[^:]*:[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // スコープ専用セクション: ## スコープ名\n直後にファイルリストが続くパターン
        new RegExp(`## ([^#\\n]+)\\s*\\n(?:\\s*\\n)*((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // 新しいパターン: ## スコープ名 の下に ### カテゴリ名 があり、その下に直接タスクリストがある場合
        new RegExp(`## ([^#\\n]+)[\\s\\S]*?### [^#\\n]+\\s*\\n((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // より一般的なパターン: ## スコープ -> 任意のコンテンツ -> タスクリスト
        new RegExp(`## ([^#\\n]+)[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g')
      ];
      
      for (const pattern of fileListPatterns) {
        const matches = [...content.matchAll(pattern)];
        for (const match of matches) {
          const scopeName = match[1].trim();
          const fileListText = match[2];
          
          // スコープ名の前後の空白を除去し、正規化
          const normalizedScopeName = scopeName.replace(/^\s+|\s+$/g, '');
        
          // 部分一致を許容してスコープを探す
          const targetScope = [...inProgressScopes, ...pendingScopes, ...completedScopes]
            .find(s => {
              const normalizedSName = s.name.replace(/^\s+|\s+$/g, '');
              return normalizedSName === normalizedScopeName || 
                    normalizedScopeName.includes(normalizedSName) ||
                    normalizedSName.includes(normalizedScopeName);
            });
          
          if (targetScope) {
            // ファイルリストを解析
            const fileLines = fileListText.split('\n').filter(line => line.trim().startsWith('- '));
            const files = fileLines.map(line => {
              const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
              if (checkboxMatch) {
                return {
                  path: checkboxMatch[2].trim(),
                  completed: checkboxMatch[1] === 'x'
                };
              } else {
                // 単純な箇条書き形式の場合
                return {
                  path: line.replace(/^- /, '').trim(),
                  completed: false
                };
              }
            }).filter(file => 
              file.path && !file.path.includes('ファイルはまだ定義されていません')
            );
            
            // スコープにファイル情報を追加
            if (files.length > 0) {
              if (!targetScope.files) {
                targetScope.files = [];
              }
              
              // 重複を避けて追加
              for (const file of files) {
                if (!targetScope.files.some(f => f.path === file.path)) {
                  targetScope.files.push(file);
                }
              }
              
              Logger.info(`スコープ "${scopeName}" に ${files.length} 個のファイルを追加しました (マッチ: ${targetScope.name})`);
            }
          } else {
            Logger.info(`スコープが見つかりませんでした: "${scopeName}" - 対象の候補: ${[...inProgressScopes, ...pendingScopes, ...completedScopes].map(s => `"${s.name}"`).join(', ')}`);
          }
        }
      }
      
      // すべてのスコープをまとめる（進行中、未着手、完了済みの順）
      this._scopes = [...inProgressScopes, ...pendingScopes, ...completedScopes];
      
      // スコープにインデックス情報を追加
      this._scopes.forEach((scope, index) => {
        scope.index = index;
        
        // #### 形式のスコープ詳細情報を関連付け
        const detailMatch = content.match(new RegExp(`#### [^:\n]*${scope.name}[^:\n]*\\s*\\n\\s*\\*\\*スコープID\\*\\*: ([^\\n]*)`, 'i'));
        if (detailMatch) {
          scope.id = detailMatch[1].trim();
          
          // 機能一覧を抽出
          const featuresSection = content.match(new RegExp(`#### [^:\n]*${scope.name}[^:\n]*[\\s\\S]*?\\*\\*含まれる機能\\*\\*:[\\s\\S]*?(\\d+\\. .*?)\\n\\n`, 'i'));
          if (featuresSection) {
            const featuresText = featuresSection[1];
            scope.features = featuresText.split('\n').map(line => line.replace(/^\d+\. /, '').trim());
          }
        }
        
        // ## 形式のスコープセクションも検索
        const sectionMatch = content.match(new RegExp(`## ${scope.name}\\s*\\n`, 'i'));
        if (sectionMatch) {
          // ## 形式のスコープセクションが見つかった場合、そのスコープの情報を設定
          Logger.info(`スコープ "${scope.name}" の専用セクションが見つかりました`);
          
          // このセクションの下のファイルリストをチェック
          const sectionStart = content.indexOf(sectionMatch[0]);
          const sectionEnd = content.indexOf('##', sectionStart + 2);
          const sectionContent = sectionEnd !== -1 
            ? content.substring(sectionStart, sectionEnd) 
            : content.substring(sectionStart);
          
          // セクション内のファイルリストを解析
          const fileLines = sectionContent.split('\n')
            .filter(line => line.trim().startsWith('- ['));
          
          if (fileLines.length > 0) {
            // ファイルリストを解析してスコープに追加
            const files = fileLines.map(line => {
              const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
              if (checkboxMatch) {
                return {
                  path: checkboxMatch[2].trim(),
                  completed: checkboxMatch[1] === 'x'
                };
              } else {
                // 単純な箇条書き形式の場合
                return {
                  path: line.replace(/^- /, '').trim(),
                  completed: false
                };
              }
            }).filter(file => file.path && !file.path.includes('ファイルはまだ定義されていません'));
            
            // スコープにファイル情報を追加
            if (files.length > 0) {
              if (!scope.files) {
                scope.files = [];
              }
              
              // 重複を避けて追加
              for (const file of files) {
                if (!scope.files.some(f => f.path === file.path)) {
                  scope.files.push(file);
                }
              }
              
              Logger.info(`スコープセクションから "${scope.name}" に ${files.length} 個のファイルを追加しました`);
            }
          }
        }
        
        // 現在のスコープを特定
        if (this._currentScope && scope.name.includes(this._currentScope.name)) {
          this._selectedScopeIndex = index;
          
          // 現在のスコープが既に選択されている場合は、引継ぎ情報を引き継ぐ
          if (this._currentScope.inheritanceInfo) {
            scope.inheritanceInfo = this._currentScope.inheritanceInfo;
          }
        }
      });
      
      // 現在のスコープが選択されていない場合、次のスコープを選択
      if (this._selectedScopeIndex < 0 && nextScope) {
        const nextScopeIndex = this._scopes.findIndex(s => s.name.includes(nextScope.name));
        if (nextScopeIndex >= 0) {
          this._selectedScopeIndex = nextScopeIndex;
          this._currentScope = this._scopes[nextScopeIndex];
          
          // 次のスコープに引継ぎ情報がある場合は設定
          if (nextScope.inheritanceInfo) {
            this._currentScope.inheritanceInfo = nextScope.inheritanceInfo;
          }
        }
      }
      
      Logger.info(`${this._scopes.length}個のスコープを読み込みました`);
      
      if (this._selectedScopeIndex >= 0) {
        Logger.info(`現在のスコープ: ${this._scopes[this._selectedScopeIndex].name}`);
      }
      
      if (nextScope) {
        Logger.info(`次のスコープ: ${nextScope.name}`);
      }
    } catch (error) {
      Logger.error('ステータスファイルの解析中にエラーが発生しました', error as Error);
    }
  }

  /**
   * ファイルの存在に基づいてスコープの完了状態を確認し更新する
   */
  private async _checkAndUpdateScopeCompletion(): Promise<void> {
    try {
      if (!this._projectPath) {
        Logger.warn('プロジェクトパスが設定されていないため、スコープ完了状態の確認をスキップします');
        return;
      }
      
      // 現在のスコープを取得
      let content = await this._fileManager.readFileAsString(this._statusFilePath);
      
      // スコープの更新が必要かどうかを追跡
      let needsUpdate = false;
      
      // スコープ1: 要件定義を作成する - docs/requirements.mdの存在を確認
      const requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
      const requirementsExists = fs.existsSync(requirementsPath);
      
      // スコープ2: モックアップを完成させる - mockups/*.htmlファイルの存在を確認
      const mockupsDir = path.join(this._projectPath, 'mockups');
      let mockupsExist = false;
      if (fs.existsSync(mockupsDir)) {
        const mockupFiles = fs.readdirSync(mockupsDir)
          .filter(file => file.endsWith('.html'));
        mockupsExist = mockupFiles.length > 0;
      }
      
      // スコープ3: モックアップを完璧にし要件定義を整える - docs/scopes/*.mdファイルの存在を確認
      const scopesDir = path.join(this._projectPath, 'docs', 'scopes');
      let scopesExist = false;
      if (fs.existsSync(scopesDir)) {
        const scopeFiles = fs.readdirSync(scopesDir)
          .filter(file => file.endsWith('.md'));
        scopesExist = scopeFiles.length > 0;
      }
      
      // スコープ4: プロジェクトの計画を立てる - docs/env.mdファイルの存在を確認
      const envPath = path.join(this._projectPath, 'docs', 'env.md');
      const envExists = fs.existsSync(envPath);
      
      // スコープ状態を更新
      if (requirementsExists) {
        // スコープ1を完了状態に更新
        content = content.replace(/- \[ \] スコープ1: 要件定義を作成する \(0%\)/g, 
                                '- [x] スコープ1: 要件定義を作成する (100%)');
        needsUpdate = true;
        Logger.info('スコープ1（要件定義）が完了しています - ステータスを更新します');
      }
      
      if (mockupsExist) {
        // スコープ2を完了状態に更新
        content = content.replace(/- \[ \] スコープ2: モックアップを完成させる \(0%\)/g, 
                                '- [x] スコープ2: モックアップを完成させる (100%)');
        needsUpdate = true;
        Logger.info('スコープ2（モックアップ）が完了しています - ステータスを更新します');
      }
      
      if (scopesExist) {
        // スコープ3を完了状態に更新
        content = content.replace(/- \[ \] スコープ3: モックアップを完璧にし要件定義を整える \(0%\)/g, 
                                '- [x] スコープ3: モックアップを完璧にし要件定義を整える (100%)');
        needsUpdate = true;
        Logger.info('スコープ3（詳細要件定義）が完了しています - ステータスを更新します');
      }
      
      if (envExists) {
        // スコープ4を完了状態に更新
        content = content.replace(/- \[ \] スコープ4: プロジェクトの計画を立てる \(0%\)/g, 
                                '- [x] スコープ4: プロジェクトの計画を立てる (100%)');
        needsUpdate = true;
        Logger.info('スコープ4（プロジェクト計画）が完了しています - ステータスを更新します');
        
        // スコープ4が完了した場合、スコープ5を進行中状態に更新
        content = content.replace(/- \[ \] スコープ5: 環境変数を設定する \(0%\)/g, 
                                '- [ ] スコープ5: 環境変数を設定する (10%)');
        
        // スコープマネージャーが本格的な実装フェーズに移行する準備ができていることを示す
        if (requirementsExists && mockupsExist && scopesExist) {
          Logger.info('すべての初期フェーズが完了しました - CURRENT_STATUSを更新して実装フェーズに移行します');
          
          // このタイミングでCURRENT_STATUSファイルを完全に更新（実装フェーズ用の内容に変更）
          // このロジックは別のメソッドに分けるか、または特別な処理としてフラグを立てるなどの対応が必要かもしれません
        }
      }
      
      // 更新が必要な場合はファイルを書き込み
      if (needsUpdate) {
        await fs.promises.writeFile(this._statusFilePath, content, 'utf8');
        Logger.info('ファイル存在チェックに基づいてCURRENT_STATUS.mdを更新しました');
        
        // 更新後のファイルを再読み込み
        await this._parseStatusFile(content);
      }
    } catch (error) {
      Logger.error('スコープ完了状態の確認中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * 開発準備ステップのテンプレートを取得
   * 開発の初期段階で表示するCURRENT_STATUSの内容
   */
  private _getPreparationStepsTemplate(): string {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    
    return `# プロジェクト開発 - 準備フェーズ (${today}更新)

## 全体進捗
- 要件定義: 未完了
- モックアップ: 未完了
- スコープ計画: 未完了
- 環境変数設定: 未設定
- 実装: 未開始
- テスト: 未開始

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
- [ ] スコープ1: 要件定義を作成する (0%)
  - 説明: 要件定義ビジュアライザーに行って要件定義書を作成する
  - 優先度: 高
  - 関連ファイル: docs/requirements.md
- [ ] スコープ2: モックアップを完成させる (0%)
  - 説明: 要件定義ビジュアライザーでモックアップを作成する
  - 優先度: 高
  - 関連ファイル: mockups/*.html
- [ ] スコープ3: モックアップを完璧にし要件定義を整える (0%)
  - 説明: モックアップギャラリーでモックアップをブラッシュアップし各ページの要件定義を完成させる
  - 優先度: 高
  - 関連ファイル: docs/scopes/*.md
- [ ] スコープ4: プロジェクトの計画を立てる (0%)
  - 説明: スコープマネージャーで新規スコープを作成し、プロジェクト計画を立てる
  - 優先度: 高
  - 関連ファイル: docs/env.md
- [ ] スコープ5: 環境変数を設定する (0%)
  - 説明: 環境変数設定アシスタントで環境変数をセットしCI/CDパイプラインを作成する
  - 優先度: 高
  - 関連ファイル: .env, .github/workflows/*.yml
- [ ] スコープ6: スコープマネージャーの計画に沿ってプロジェクトを完成させる (0%)
  - 説明: スコープマネージャーの実装計画に沿って開発を進める
  - 優先度: 高
  - 関連ファイル: src/**/*.*

## 最終的なディレクトリ構造(予測)
\`\`\`
project-root/
└── [ディレクトリ構造はスコープ4の完了後に更新されます]
\`\`\`

## 現在のディレクトリ構造
\`\`\`
project-root/
└── [現在の実際のディレクトリ構造]
\`\`\`

## 開発フェーズのガイド
1. まず要件定義を作成してください（スコープ1）
2. 次にモックアップを作成してください（スコープ2）
3. モックアップを完璧にして詳細な要件定義を作成してください（スコープ3）
4. プロジェクト計画を立て、実装スコープを定義してください（スコープ4）
5. 環境変数を設定し、開発環境を整えてください（スコープ5）
6. 定義されたスコープに沿って実装を進めてください（スコープ6）

## スコープ1: 要件定義を作成する
- [ ] docs/requirements.md

## スコープ2: モックアップを完成させる
- [ ] mockups/*.html

## スコープ3: モックアップを完璧にし要件定義を整える
- [ ] docs/scopes/*.md

## スコープ4: プロジェクトの計画を立てる
- [ ] docs/env.md

## スコープ5: 環境変数を設定する
- [ ] .env
- [ ] .github/workflows/*.yml

## スコープ6: スコープマネージャーの計画に沿ってプロジェクトを完成させる
- [ ] src/**/*.*`;
  }
  
  /**
   * 初期化処理
   */
  private async _handleInitialize(): Promise<void> {
    try {
      Logger.info('スコープマネージャーパネルを初期化しています');
      
      // プロジェクトパスが設定されていない場合はワークスペースフォルダを使用
      if (!this._projectPath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (workspaceFolders && workspaceFolders.length > 0) {
          const wsPath = workspaceFolders[0].uri.fsPath;
          this.setProjectPath(wsPath);
          Logger.info(`プロジェクトパスが未設定のためワークスペースパスを使用: ${wsPath}`);
        }
      }
      
      // ステータスファイルを読み込む
      await this._loadStatusFile();
      
      // ファイル存在チェックによるスコープ状態の更新
      await this._checkAndUpdateScopeCompletion();
      
      // WebViewを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('パネル初期化エラー', error as Error);
    }
  }

  /**
   * スコープを選択
   */
  private async _handleSelectScope(index: number): Promise<void> {
    try {
      if (index < 0 || index >= this._scopes.length) {
        throw new Error('無効なスコープインデックスです');
      }
      
      this._selectedScopeIndex = index;
      this._currentScope = this._scopes[index];
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`スコープを選択しました: ${this._currentScope.name}`);
    } catch (error) {
      Logger.error('スコープ選択中にエラーが発生しました', error as Error);
      await this._showError(`スコープの選択に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープのステータスを更新
   */
  private async _handleUpdateScopeStatus(scopeId: string, status: string, progress: number): Promise<void> {
    try {
      if (this._selectedScopeIndex < 0) {
        throw new Error('スコープが選択されていません');
      }
      
      // 選択中のスコープのステータスを更新
      this._scopes[this._selectedScopeIndex].status = status;
      this._scopes[this._selectedScopeIndex].progress = progress;
      this._currentScope.status = status;
      this._currentScope.progress = progress;
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`スコープステータスを更新しました: ${status}, 進捗: ${progress}%`);
    } catch (error) {
      Logger.error('スコープステータスの更新中にエラーが発生しました', error as Error);
      await this._showError(`スコープステータスの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ファイルのステータスを切り替え
   */
  private async _handleToggleFileStatus(filePath: string, completed: boolean): Promise<void> {
    try {
      if (!this._currentScope) {
        throw new Error('スコープが選択されていません');
      }
      
      // ファイルのステータスを更新
      const fileIndex = this._currentScope.files.findIndex((f: any) => f.path === filePath);
      if (fileIndex >= 0) {
        this._currentScope.files[fileIndex].completed = completed;
      }
      
      // 進捗率を再計算
      const completedCount = this._currentScope.files.filter((f: any) => f.completed).length;
      const totalCount = this._currentScope.files.length;
      const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      
      // スコープのステータスと進捗を更新
      this._currentScope.progress = newProgress;
      this._scopes[this._selectedScopeIndex].progress = newProgress;
      
      // すべてのファイルが完了した場合はステータスを完了に
      if (newProgress === 100) {
        this._currentScope.status = 'completed';
        this._scopes[this._selectedScopeIndex].status = 'completed';
      } else if (newProgress > 0) {
        this._currentScope.status = 'in-progress';
        this._scopes[this._selectedScopeIndex].status = 'in-progress';
      }
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`ファイルステータスを更新しました: ${filePath}, 完了: ${completed}, 新しい進捗: ${newProgress}%`);
    } catch (error) {
      Logger.error('ファイルステータスの更新中にエラーが発生しました', error as Error);
      await this._showError(`ファイルステータスの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープ作成プロンプトでClaudeCodeを起動
   */
  private async _handleLaunchScopeCreator(): Promise<void> {
    try {
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // 中央ポータルURL 
      // 開発準備モードではスコープマネージャー、実装モードではプロジェクト分析アシスタントを使用
      const portalUrl = this._isPreparationMode 
        ? 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704' // スコープマネージャー
        : 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6'; // プロジェクト分析アシスタント
      
      // ログにモードと使用プロンプトを記録
      Logger.info(`現在のモード: ${this._isPreparationMode ? '開発準備モード' : '実装モード'}, 使用プロンプト: ${portalUrl}`);
      
      // ステータスファイルの内容を追加コンテンツとして渡す
      let additionalContent = '';
      const statusFilePath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, 'utf8');
        additionalContent = `# 追加情報\n\n## CURRENT_STATUS.md\n\n\`\`\`markdown\n${statusContent}\n\`\`\``;
      }
      
      // インテグレーションサービスを動的importで安全に取得
      const integrationService = await import('../../services/ClaudeCodeIntegrationService').then(
        module => module.ClaudeCodeIntegrationService.getInstance()
      );
      
      try {
        // 一時ファイルにも保存（デバッグ用・参照用）
        const tempDir = os.tmpdir();
        const analysisFilePath = path.join(tempDir, `scope_creator_${Date.now()}.md`);
        fs.writeFileSync(analysisFilePath, additionalContent, 'utf8');
        Logger.info(`スコープ作成用の分析ファイルを作成しました: ${analysisFilePath}`);
        
        // 公開URLから起動（追加情報も渡す）
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        vscode.window.showInformationMessage('スコープ作成のためのClaudeCodeを起動しました。');
      } catch (error) {
        // URL起動に失敗した場合、ローカルファイルにフォールバック
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // スコープマネージャプロンプトのパスを取得
        const promptFilePath = path.join(this._projectPath, 'docs', 'prompts', 'scope_manager.md');
        
        if (!fs.existsSync(promptFilePath)) {
          throw new Error(`スコープマネージャプロンプトファイルが見つかりません: ${promptFilePath}`);
        }
        
        // 一時的なテンプレートファイルを作成
        const tempDir = os.tmpdir(); // 一時ディレクトリに保存（25秒後に自動削除）
        const tempFilePath = path.join(tempDir, `combined_scope_${Date.now()}.md`);
        
        // プロンプトファイルの内容を読み込む
        let promptContent = fs.readFileSync(promptFilePath, 'utf8');
        
        // 追加コンテンツの準備
        let scopeAdditionalContent = '';
        
        // ステータスの内容を追加（外部から渡されたもの）
        if (additionalContent) {
          promptContent += '\n\n' + additionalContent;
        }
        
        // 一時的なテンプレートファイルを作成
        fs.writeFileSync(tempFilePath, promptContent, 'utf8');
        
        // ClaudeCodeIntegrationServiceを使用して起動
        const integrationService = ClaudeCodeIntegrationService.getInstance();
        
        // セキュリティガイドライン付きで起動
        Logger.info(`セキュリティガイドライン付きでClaudeCodeを起動します`);
        const guidancePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/6640b55f692b15f4f4e3d6f5b1a5da6c';
        const featurePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704';
        
        // プロンプトファイルの内容を追加コンテンツとして渡す
        scopeAdditionalContent = promptContent;
        
        const success = await integrationService.launchWithSecurityBoundary(
          guidancePromptUrl,
          featurePromptUrl,
          this._projectPath,
          scopeAdditionalContent
        );
        
        if (success) {
          vscode.window.showInformationMessage('スコープ作成のためのClaudeCodeを起動しました（ローカルモード）。');
        } else {
          vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
        }
      }
    } catch (error) {
      Logger.error('スコープ作成の起動に失敗しました', error as Error);
      await this._showError(`スコープ作成の起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 実装アシスタントプロンプトでClaudeCodeを起動
   */
  private async _handleLaunchImplementationAssistant(): Promise<void> {
    try {
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // 中央ポータルURL - プロジェクト分析アシスタント
      const portalUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6';
      
      // ステータスファイルの内容を追加コンテンツとして渡す
      let additionalContent = '';
      const statusFilePath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      if (fs.existsSync(statusFilePath)) {
        // Fileのコンテンツを現在のステータスとして渡す
        const statusContent = fs.readFileSync(statusFilePath, 'utf8');
        additionalContent = `# 追加情報\n\n## CURRENT_STATUS.md\n\n\`\`\`markdown\n${statusContent}\n\`\`\``;
      } else {
        Logger.warn('CURRENT_STATUS.mdファイルが見つかりません: ' + statusFilePath);
      }
      
      // extensionContextの参照を確保
      const context = (global as any).extensionContext || (global as any).__extensionContext;
      
      // ClaudeCodeAuthSyncの取得（安全に）
      let authSync;
      try {
        const { ClaudeCodeAuthSync } = await import('../../services/ClaudeCodeAuthSync');
        
        // グローバルコンテキストを使用して初期化
        if (global.__extensionContext) {
          authSync = ClaudeCodeAuthSync.getInstance(global.__extensionContext);
        } else {
          // フォールバック
          const extension = vscode.extensions.getExtension('appgenius.appgenius-ai');
          if (extension) {
            authSync = ClaudeCodeAuthSync.getInstance(extension.exports.context);
          } else {
            throw new Error('拡張機能コンテキストが取得できません');
          }
        }
        Logger.info('ClaudeCodeAuthSyncが正常に初期化されました');
      } catch (error) {
        Logger.error('ClaudeCodeAuthSyncの初期化エラー', error as Error);
        vscode.window.showErrorMessage('認証サービスの初期化に失敗しました。VSCodeを再起動してください。');
        return;
      }
      
      // インテグレーションサービスを動的importで安全に取得
      const module = await import('../../services/ClaudeCodeIntegrationService');
      const integrationService = module.ClaudeCodeIntegrationService.getInstance();
      
      try {
        // 一時ファイルにも保存（デバッグ用・参照用）
        const tempDir = os.tmpdir();
        const analysisFilePath = path.join(tempDir, `analyzer_content_${Date.now()}.md`);
        fs.writeFileSync(analysisFilePath, additionalContent, 'utf8');
        Logger.info(`プロジェクト分析アシスタント用の分析ファイルを作成しました: ${analysisFilePath}`);
        
        // 公開URLから起動（追加情報も渡す）
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        vscode.window.showInformationMessage('開発案件追加のためのプロジェクト分析アシスタントを起動しました。');
      } catch (error) {
        // URL起動に失敗した場合、ローカルファイルにフォールバック
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // 実装アシスタントプロンプトのパスを取得
        const promptFilePath = path.join(this._projectPath, 'docs', 'prompts', 'scope_implementer.md');
        
        if (!fs.existsSync(promptFilePath)) {
          throw new Error(`実装アシスタントプロンプトファイルが見つかりません: ${promptFilePath}`);
        }
        
        // 一時的なテンプレートファイルを作成
        const tempDir = os.tmpdir(); // 一時ディレクトリに保存（25秒後に自動削除）
        const tempFilePath = path.join(tempDir, `combined_implementer_${Date.now()}.md`);
        
        // プロンプトファイルの内容を読み込む
        let promptContent = fs.readFileSync(promptFilePath, 'utf8');
        
        // ステータスの内容を追加
        if (additionalContent) {
          promptContent += '\n\n' + additionalContent;
        }
        
        // 一時的なテンプレートファイルを作成
        fs.writeFileSync(tempFilePath, promptContent, 'utf8');
        Logger.info(`フォールバック用プロンプトを作成しました: ${tempFilePath}`);
        
        // ClaudeCodeIntegrationServiceを使用して起動
        const integrationService = ClaudeCodeIntegrationService.getInstance();
        
        // セキュリティガイドライン付きで起動
        Logger.info(`セキュリティガイドライン付きでClaudeCodeを起動します`);
        const guidancePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/6640b55f692b15f4f4e3d6f5b1a5da6c';
        const featurePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a';
        
        // プロンプトファイルの内容を追加コンテンツとして渡す
        const implementerAdditionalContent = promptContent;
        
        const success = await integrationService.launchWithSecurityBoundary(
          guidancePromptUrl,
          featurePromptUrl,
          this._projectPath,
          implementerAdditionalContent
        );
        
        if (success) {
          vscode.window.showInformationMessage('実装アシスタントのためのClaudeCodeを起動しました（ローカルモード）。');
        } else {
          vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
        }
      }
    } catch (error) {
      Logger.error('実装アシスタントの起動に失敗しました', error as Error);
      await this._showError(`実装アシスタントの起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数アシスタントを開く
   */
  private async _handleOpenEnvironmentVariablesAssistant(): Promise<void> {
    try {
      // 環境変数アシスタントを開くコマンドを実行
      await vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant', this._projectPath);
      
      Logger.info('環境変数アシスタントを開きました');
    } catch (error) {
      Logger.error('環境変数アシスタントの起動に失敗しました', error as Error);
      await this._showError(`環境変数アシスタントの起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 実装モードに切り替え、CURRENT_STATUSを作成
   */
  private async _handleSwitchToImplementationMode(): Promise<void> {
    try {
      // 既に実装モードの場合は何もしない
      if (!this._isPreparationMode) {
        vscode.window.showInformationMessage('すでに実装モードです');
        return;
      }
      
      // 正式なCURRENT_STATUSファイルを作成するか確認
      const confirm = await vscode.window.showInformationMessage(
        '実装フェーズに移行し、CURRENT_STATUS.mdを作成しますか？これにより開発準備フェーズが完了し、実装フェーズに進みます。',
        { modal: true },
        'はい', 'いいえ'
      );
      
      if (confirm !== 'はい') {
        return;
      }
      
      // ユーザーに実装フェーズのCURRENT_STATUSの初期内容を入力させるか確認
      const useTemplate = await vscode.window.showQuickPick(
        ['新規作成', '準備フェーズの内容を保持'],
        {
          placeHolder: 'CURRENT_STATUSの初期化方法を選択してください',
          canPickMany: false
        }
      );
      
      let initialContent = '';
      
      if (useTemplate === '準備フェーズの内容を保持') {
        // 準備フェーズのテンプレートをベースに、進捗情報を維持した状態でCURRENT_STATUSを作成
        initialContent = this._getPreparationStepsTemplate();
        
        // [スコープを作成してください] 部分を [実装フェーズに移行しました] に変更
        initialContent = initialContent.replace('# プロジェクト開発 - 準備フェーズ', '# プロジェクト開発 - 実装フェーズ');
      } else {
        // 実装フェーズ用の新しいテンプレートでCURRENT_STATUSを作成
        initialContent = `# プロジェクト開発 - 実装フェーズ (${new Date().toISOString().split('T')[0].replace(/-/g, '/')}更新)

## 全体進捗
- 完成予定ファイル数: 0
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: ${new Date().toISOString().split('T')[0].replace(/-/g, '/')}

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
（スコープを追加するには「新規スコープ作成」ボタンを使用してください）

## 最終的なディレクトリ構造
\`\`\`
project-root/
└── [ディレクトリ構造]
\`\`\`

## 現在のディレクトリ構造
\`\`\`
project-root/
└── [ディレクトリ構造]
\`\`\`
`;
      }
      
      // docsディレクトリが存在するか確認し、必要に応じて作成
      const docsDir = path.dirname(this._statusFilePath);
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        Logger.info(`ディレクトリを作成しました: ${docsDir}`);
      }
      
      // CURRENT_STATUSファイルを作成
      fs.writeFileSync(this._statusFilePath, initialContent, 'utf8');
      Logger.info(`実装フェーズ用のCURRENT_STATUS.mdを作成しました: ${this._statusFilePath}`);
      
      // モードを実装モードに変更
      this._isPreparationMode = false;
      
      // ファイルを読み込み直して表示を更新
      await this._loadStatusFile();
      
      // 通知
      vscode.window.showInformationMessage('実装フェーズに移行しました。CURRENT_STATUS.mdが作成されました。');
    } catch (error) {
      Logger.error('実装モードへの切り替え中にエラーが発生しました', error as Error);
      await this._showError(`実装モードへの切り替えに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 開発準備モードに戻す
   */
  private async _handleResetToPreparationMode(): Promise<void> {
    try {
      // 既に準備モードの場合は何もしない
      if (this._isPreparationMode) {
        vscode.window.showInformationMessage('既に開発準備モードです');
        return;
      }
      
      // 確認
      const confirm = await vscode.window.showInformationMessage(
        '開発準備モードに戻しますか？現在のCURRENT_STATUS.mdは上書きされます。',
        { modal: true },
        'はい', 'いいえ'
      );
      
      if (confirm !== 'はい') {
        return;
      }
      
      // 準備モードのテンプレートを使用
      const template = this._getPreparationStepsTemplate();
      
      // docsディレクトリが存在するか確認し、必要に応じて作成
      const docsDir = path.dirname(this._statusFilePath);
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        Logger.info(`ディレクトリを作成しました: ${docsDir}`);
      }
      
      // CURRENT_STATUSファイルを上書き
      fs.writeFileSync(this._statusFilePath, template, 'utf8');
      Logger.info(`開発準備モードのCURRENT_STATUS.mdを作成しました: ${this._statusFilePath}`);
      
      // モードを準備モードに変更
      this._isPreparationMode = true;
      
      // ファイルを読み込み直して表示を更新
      await this._loadStatusFile();
      
      // 通知
      vscode.window.showInformationMessage('開発準備モードに戻しました。CURRENT_STATUS.mdが更新されました。');
    } catch (error) {
      Logger.error('開発準備モードへの切り替え中にエラーが発生しました', error as Error);
      await this._showError(`開発準備モードへの切り替えに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 要件定義エディタを開く（シンプルチャット）
   */
  private async _handleOpenRequirementsVisualizer(): Promise<void> {
    try {
      // シンプルチャット（要件定義エディタ）を開くコマンドを実行
      await vscode.commands.executeCommand('appgenius-ai.openSimpleChat', this._projectPath);
      
      Logger.info('要件定義エディタを開きました');
    } catch (error) {
      Logger.error('要件定義エディタの起動に失敗しました', error as Error);
      await this._showError(`要件定義エディタの起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * モックアップギャラリーを開く
   */
  private async _handleOpenMockupGallery(): Promise<void> {
    try {
      // モックアップギャラリーを開くコマンドを実行
      await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', this._projectPath);
      
      Logger.info('モックアップギャラリーを開きました');
    } catch (error) {
      Logger.error('モックアップギャラリーの起動に失敗しました', error as Error);
      await this._showError(`モックアップギャラリーの起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * デバッグ探偵を開く
   */
  private async _handleOpenDebugDetective(): Promise<void> {
    try {
      // デバッグ探偵を開くコマンドを実行
      await vscode.commands.executeCommand('appgenius-ai.openDebugDetective', this._projectPath);
      
      Logger.info('デバッグ探偵を開きました');
    } catch (error) {
      Logger.error('デバッグ探偵の起動に失敗しました', error as Error);
      await this._showError(`デバッグ探偵の起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * リファレンスマネージャーを開く
   */
  private async _handleOpenReferenceManager(): Promise<void> {
    try {
      // リファレンスマネージャーを開くコマンドを実行
      await vscode.commands.executeCommand('appgenius-ai.openReferenceManager', this._projectPath);
      
      Logger.info('リファレンスマネージャーを開きました');
    } catch (error) {
      Logger.error('リファレンスマネージャーの起動に失敗しました', error as Error);
      await this._showError(`リファレンスマネージャーの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  private async _handleStartImplementation(): Promise<void> {
    try {
      if (!this._currentScope) {
        throw new Error('スコープが選択されていません');
      }
      
      // 実装アシスタントプロンプトのパスを取得
      const promptFilePath = path.join(this._projectPath, 'docs', 'prompts', 'scope_implementer.md');
      
      // CURRENT_STATUS.mdファイルへの参照を追加
      const statusFilePath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      // ClaudeCodeの起動方法を決定
      const launcher = ClaudeCodeLauncherService.getInstance();
      let success = false;
      
      // ファイル配列が未定義または空の場合のデフォルト値を設定
      const files = this._currentScope.files || [];
      
      // 実装に必要な情報の準備
      const scopeInfo: IImplementationScope = {
        id: this._currentScope.id || `scope-${Date.now()}`,
        name: this._currentScope.name,
        description: this._currentScope.description || '説明が設定されていません',
        items: files.map((file: any) => ({
          id: `file-${Math.random().toString(36).substr(2, 9)}`,
          title: file.path,
          description: `Implementation of ${file.path}`,
          status: file.completed ? ScopeItemStatus.COMPLETED : ScopeItemStatus.PENDING,
          progress: file.completed ? 100 : 0,
          priority: 'medium',
          complexity: 'medium',
          dependencies: [],
          relatedFiles: [file.path]
        })),
        selectedIds: files
          .filter((f: any) => !f.completed)
          .map(() => `file-${Math.random().toString(36).substr(2, 9)}`),
        estimatedTime: this._currentScope.estimatedTime || "10時間",
        totalProgress: this._currentScope.progress || 0,
        projectPath: this._projectPath
      };
      
      // CURRENT_STATUS.mdファイルの存在を確認
      if (!fs.existsSync(statusFilePath)) {
        // 存在しない場合は作成
        await this._updateStatusFile();
        Logger.info(`CURRENT_STATUS.mdファイルが存在しなかったため作成しました: ${statusFilePath}`);
      }
      
      // ステータスファイルの内容を読み込む
      const statusContent = fs.readFileSync(statusFilePath, 'utf8');
      
      // 中央ポータルURL
      const portalUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a';
      
      // 追加情報（現在の実装状況など）
      const additionalContent = `# 追加情報\n\n## CURRENT_STATUS.md\n\n\`\`\`markdown\n${statusContent}\n\`\`\`\n\n## 選択されたスコープ\n\n現在選択されているスコープ: **${this._currentScope.name}**\n\n説明: ${this._currentScope.description || '説明が設定されていません'}\n\n進捗: ${this._currentScope.progress || 0}%`;
      
      try {
        // 一時ファイルにも保存（デバッグ用・参照用）
        const tempDir = os.tmpdir();
        const analysisFilePath = path.join(tempDir, `scope_implementation_${Date.now()}.md`);
        fs.writeFileSync(analysisFilePath, additionalContent, 'utf8');
        Logger.info(`実装用の分析ファイルを作成しました: ${analysisFilePath}`);
        
        // インテグレーションサービスを動的importで安全に取得
        const integrationService = await import('../../services/ClaudeCodeIntegrationService').then(
          module => module.ClaudeCodeIntegrationService.getInstance()
        );
        
        // 公開URLから起動（追加情報も渡す）
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        // 成功とみなす
        success = true;
      } catch (error) {
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // 実装アシスタントプロンプトが存在する場合はそれを使用
        if (fs.existsSync(promptFilePath)) {
          try {
            // プロンプトファイルの内容を読み込む
            const promptContent = fs.readFileSync(promptFilePath, 'utf8');
            
            // 一時的な結合ファイルを作成して両方の内容を含める
            const tempDir = os.tmpdir(); // OSの一時ディレクトリを使用
            const combinedFilePath = path.join(tempDir, `combined_prompt_${Date.now()}.md`);
            
            // 結合ファイルを作成
            const combinedContent = 
              promptContent + 
              '\n\n# 追加情報\n\n' +
              '## CURRENT_STATUS.md\n\n' +
              '```markdown\n' +
              statusContent + 
              '\n```\n\n' +
              '## 選択されたスコープ\n\n' +
              `現在選択されているスコープ: **${this._currentScope.name}**\n\n` +
              `説明: ${this._currentScope.description || '説明が設定されていません'}\n\n` +
              `進捗: ${this._currentScope.progress || 0}%`;
            
            fs.writeFileSync(combinedFilePath, combinedContent, 'utf8');
            Logger.info(`結合プロンプトファイルを作成しました: ${combinedFilePath}`);
            
            // ClaudeCodeIntegrationServiceを使用して起動
            const integrationService = ClaudeCodeIntegrationService.getInstance();
            
            // セキュリティガイドライン付きで起動
            Logger.info(`セキュリティガイドライン付きでClaudeCodeを起動します`);
            const guidancePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/6640b55f692b15f4f4e3d6f5b1a5da6c';
            const featurePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a';
            
            // プロンプトコンテンツを追加コンテンツとして渡す
            success = await integrationService.launchWithSecurityBoundary(
              guidancePromptUrl,
              featurePromptUrl,
              this._projectPath,
              combinedContent
            );
            
            // メッセージを変更してローカルモードであることを示す
            if (success) {
              vscode.window.showInformationMessage('実装アシスタントのためのClaudeCodeを起動しました（ローカルモード）。');
            }
          } catch (error) {
            Logger.error('結合プロンプトファイルの作成に失敗しました', error as Error);
            throw error;
          }
        } else {
          // 旧式のスコープベースの起動方法にフォールバック
          success = await launcher.launchClaudeCode(scopeInfo);
        }
      }
      
      if (success) {
        vscode.window.showInformationMessage('ClaudeCodeを起動しました。実装が開始されます。');
        
        // スコープのステータスを進行中に更新
        if (this._currentScope.status === 'pending') {
          this._currentScope.status = 'in-progress';
          this._scopes[this._selectedScopeIndex].status = 'in-progress';
          
          // 進捗が0の場合は10%に設定（開始の印として）
          if (this._currentScope.progress === 0) {
            this._currentScope.progress = 10;
            this._scopes[this._selectedScopeIndex].progress = 10;
          }
          
          // CURRENT_STATUS.mdファイルを更新
          await this._updateStatusFile();
          
          // WebViewを更新
          this._updateWebview();
        }
      } else {
        vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
      }
    } catch (error) {
      Logger.error('実装開始中にエラーが発生しました', error as Error);
      await this._showError(`実装の開始に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープを編集
   */
  private async _handleEditScope(scopeData: any): Promise<void> {
    try {
      if (this._selectedScopeIndex < 0) {
        throw new Error('スコープが選択されていません');
      }
      
      // スコープの情報を更新
      this._scopes[this._selectedScopeIndex].name = scopeData.name;
      this._scopes[this._selectedScopeIndex].description = scopeData.description;
      this._scopes[this._selectedScopeIndex].priority = scopeData.priority;
      this._scopes[this._selectedScopeIndex].estimatedTime = scopeData.estimatedTime;
      
      // 現在のスコープも更新
      this._currentScope = {
        ...this._currentScope,
        name: scopeData.name,
        description: scopeData.description,
        priority: scopeData.priority,
        estimatedTime: scopeData.estimatedTime
      };
      
      // ファイルリストを更新
      if (scopeData.files) {
        this._currentScope.files = scopeData.files.map((file: string) => ({
          path: file,
          completed: false
        }));
      }
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`スコープを編集しました: ${scopeData.name}`);
    } catch (error) {
      Logger.error('スコープ編集中にエラーが発生しました', error as Error);
      await this._showError(`スコープの編集に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 開発準備モードにリセットすべきかユーザーに確認
   * ファイルが存在するがモードをリセットして開発準備に戻りたい場合に使用
   * 
   * 注：確認ダイアログは現在無効化されています
   */
  private async _shouldResetToPreparationMode(): Promise<boolean> {
    try {
      // 常にfalseを返して確認ダイアログを表示せず、
      // 既存のCURRENT_STATUS.mdを上書きしないようにする
      return false;
    } catch (error) {
      Logger.error('開発準備モードの確認中にエラーが発生しました', error as Error);
      return false;
    }
  }

  /**
   * ディレクトリ構造を表示
   */
  private async _handleShowDirectoryStructure(): Promise<void> {
    try {
      if (!this._directoryStructure) {
        throw new Error('ディレクトリ構造が読み込まれていません');
      }
      
      // ディレクトリ構造を表示
      await this._panel.webview.postMessage({
        command: 'showDirectoryStructure',
        structure: this._directoryStructure
      });
      
      Logger.info('ディレクトリ構造を表示しました');
    } catch (error) {
      Logger.error('ディレクトリ構造の表示中にエラーが発生しました', error as Error);
      await this._showError(`ディレクトリ構造の表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 新しいスコープを追加
   */
  private async _handleAddNewScope(): Promise<void> {
    try {
      // 新しいスコープの情報を入力するフォームを表示
      const name = await vscode.window.showInputBox({
        prompt: 'スコープ名を入力してください',
        placeHolder: '例: 初期セットアップ/環境構築'
      });
      
      if (!name) {
        return;
      }
      
      const description = await vscode.window.showInputBox({
        prompt: 'スコープの説明を入力してください',
        placeHolder: '例: プロジェクトの基盤となる環境を整備する'
      });
      
      const priority = await vscode.window.showQuickPick(['高', '中', '低'], {
        placeHolder: '優先度を選択してください'
      });
      
      const estimatedTime = await vscode.window.showInputBox({
        prompt: '見積作業時間を入力してください',
        placeHolder: '例: 16時間',
        value: '8時間'
      });
      
      // 新しいスコープを作成
      const newScope = {
        name,
        description,
        priority,
        estimatedTime,
        status: 'pending',
        progress: 0,
        id: `scope-${Date.now()}`,
        files: [],
        features: [],
        index: this._scopes.length
      };
      
      // スコープリストに追加
      this._scopes.push(newScope);
      
      // 新しいスコープを選択
      this._selectedScopeIndex = this._scopes.length - 1;
      this._currentScope = newScope;
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`新しいスコープを追加しました: ${name}`);
    } catch (error) {
      Logger.error('スコープ追加中にエラーが発生しました', error as Error);
      await this._showError(`スコープの追加に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * CURRENT_STATUS.mdファイルを更新
   */
  private async _updateStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath) {
        throw new Error('ステータスファイルパスが設定されていません');
      }
      
      // docsディレクトリが存在しない場合は作成
      const docsDir = path.join(this._projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        Logger.info(`docsディレクトリを作成しました: ${docsDir}`);
      }
      
      // ファイルの内容を生成
      let content = '# 実装状況 (';
      content += new Date().toISOString().split('T')[0].replace(/-/g, '/');
      content += '更新)\n\n';
      
      // 全体進捗
      const totalFiles = this._scopes.reduce((sum, scope) => sum + (scope.files?.length || 0), 0);
      const completedFiles = this._scopes.reduce((sum, scope) => {
        return sum + (scope.files?.filter((f: any) => f.completed)?.length || 0);
      }, 0);
      const progressPercent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
      
      content += '## 全体進捗\n';
      content += `- 完成予定ファイル数: ${totalFiles}\n`;
      content += `- 作成済みファイル数: ${completedFiles}\n`;
      content += `- 進捗率: ${progressPercent}%\n`;
      content += `- 最終更新日: ${new Date().toISOString().split('T')[0].replace(/-/g, '/')}\n\n`;
      
      // スコープ状況
      content += '## スコープ状況\n\n';
      
      // 進行中スコープ
      const inProgressScopes = this._scopes.filter(s => s.status === 'in-progress');
      content += '### 進行中スコープ\n';
      if (inProgressScopes.length === 0) {
        content += '（実装中のスコープはまだありません）\n\n';
      } else {
        inProgressScopes.forEach(scope => {
          content += `- [ ] ${scope.name} (${scope.progress}%)\n`;
        });
        content += '\n';
      }
      
      // 未着手スコープ
      const pendingScopes = this._scopes.filter(s => s.status === 'pending');
      content += '### 未着手スコープ\n';
      if (pendingScopes.length === 0) {
        content += '（未着手のスコープはありません）\n\n';
      } else {
        pendingScopes.forEach(scope => {
          content += `- [ ] ${scope.name} (0%)\n`;
        });
        content += '\n';
      }
      
      // 完了済みスコープ
      const completedScopes = this._scopes.filter(s => s.status === 'completed');
      content += '### 完了済みスコープ\n';
      if (completedScopes.length === 0) {
        content += '（完了したスコープはまだありません）\n\n';
      } else {
        completedScopes.forEach(scope => {
          content += `- [x] ${scope.name} (100%)\n`;
        });
        content += '\n';
      }
      
      // ディレクトリ構造
      content += '## 現在のディレクトリ構造\n';
      content += '```\n';
      content += this._directoryStructure || '（ディレクトリ構造はまだ定義されていません）\n';
      content += '```\n\n';
      
      // 実装完了ファイル
      content += '## 実装完了ファイル\n';
      const allCompletedFiles = this._scopes.flatMap(scope => 
        (scope.files || [])
          .filter((f: any) => f.completed)
          .map((f: any) => ({ path: f.path, scope: scope.name }))
      );
      
      if (allCompletedFiles.length === 0) {
        content += '（実装済みファイルはまだありません）\n\n';
      } else {
        allCompletedFiles.forEach(file => {
          content += `- ✅ ${file.path} (${file.scope})\n`;
        });
        content += '\n';
      }
      
      // 実装中ファイル
      content += '## 実装中ファイル\n';
      const allInProgressFiles = this._scopes
        .filter(scope => scope.status === 'in-progress')
        .flatMap(scope => 
          (scope.files || [])
            .filter((f: any) => !f.completed)
            .map((f: any) => ({ path: f.path, scope: scope.name }))
        );
      
      if (allInProgressFiles.length === 0) {
        content += '（実装中のファイルはまだありません）\n\n';
      } else {
        allInProgressFiles.forEach(file => {
          content += `- ⏳ ${file.path} (${file.scope})\n`;
        });
        content += '\n';
      }
      
      // 引継ぎ情報
      content += '## 引継ぎ情報\n\n';
      
      // 現在のスコープ情報
      if (this._currentScope) {
        content += `### 現在のスコープ: ${this._currentScope.name}\n`;
        content += `**スコープID**: ${this._currentScope.id || `scope-${Date.now()}`}  \n`;
        content += `**説明**: ${this._currentScope.description || ''}  \n`;
        
        // 含まれる機能
        content += '**含まれる機能**:\n';
        if (this._currentScope.features && this._currentScope.features.length > 0) {
          this._currentScope.features.forEach((feature: string, index: number) => {
            content += `${index + 1}. ${feature}\n`;
          });
        } else {
          content += '1. （機能はまだ定義されていません）\n';
        }
        content += '\n';
        
        // 実装すべきファイル
        content += '**実装すべきファイル**: \n';
        if (this._currentScope.files && this._currentScope.files.length > 0) {
          this._currentScope.files.forEach((file: any) => {
            content += `- [${file.completed ? 'x' : ' '}] ${file.path}\n`;
          });
        } else {
          content += '- [ ] （ファイルはまだ定義されていません）\n';
        }
        content += '\n';
      } else {
        content += '（現在のスコープはまだ選択されていません）\n\n';
      }
      
      // 次回実装予定
      content += '## 次回実装予定\n\n';
      
      // 次のスコープを特定（現在のスコープが進行中なら次のスコープ、そうでなければ最初の未着手スコープ）
      let nextScope = null;
      if (this._currentScope && this._currentScope.status === 'in-progress') {
        // 現在のスコープが進行中なら、最初の未着手スコープを次のスコープとする
        nextScope = pendingScopes[0];
      } else if (this._currentScope && this._currentScope.status === 'completed') {
        // 現在のスコープが完了なら、最初の進行中または未着手スコープを次のスコープとする
        nextScope = inProgressScopes[0] || pendingScopes[0];
      } else {
        // 現在のスコープが未選択なら、最初の進行中スコープまたは未着手スコープを次のスコープとする
        nextScope = inProgressScopes[0] || pendingScopes[0] || this._currentScope;
      }
      
      if (nextScope) {
        content += `### 次のスコープ: ${nextScope.name}\n`;
        content += `**スコープID**: ${nextScope.id || `scope-${Date.now()}`}  \n`;
        content += `**説明**: ${nextScope.description || ''}  \n`;
        
        // 含まれる機能
        content += '**含まれる機能**:\n';
        if (nextScope.features && nextScope.features.length > 0) {
          nextScope.features.forEach((feature: string, index: number) => {
            content += `${index + 1}. ${feature}\n`;
          });
        } else {
          content += '1. （機能はまだ定義されていません）\n';
        }
        content += '\n';
        
        // 依存するスコープ
        const prevScopes = completedScopes
          .map(s => s.name)
          .filter(name => name !== nextScope.name);
        
        if (prevScopes.length > 0) {
          content += '**依存するスコープ**:\n';
          prevScopes.forEach((name: string) => {
            content += `- ${name}\n`;
          });
          content += '\n';
        }
        
        // 実装予定ファイル
        content += '**実装予定ファイル**:\n';
        if (nextScope.files && nextScope.files.length > 0) {
          nextScope.files
            .filter((f: any) => !f.completed)
            .forEach((file: any) => {
              content += `- [ ] ${file.path}\n`;
            });
        } else {
          content += '- [ ] （ファイルはまだ定義されていません）\n';
        }
      } else {
        content += '（次回実装予定のスコープはありません）\n';
      }
      
      // ファイルに書き込み
      await fs.promises.writeFile(this._statusFilePath, content, 'utf8');
      
      Logger.info(`CURRENT_STATUS.mdファイルを更新しました: ${this._statusFilePath}`);
    } catch (error) {
      Logger.error('ステータスファイルの更新中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * エラーメッセージの表示
   */
  private async _showError(message: string): Promise<void> {
    vscode.window.showErrorMessage(message);
    
    // WebViewにもエラーを表示
    await this._panel.webview.postMessage({ 
      command: 'showError', 
      message 
    });
  }

  /**
   * WebViewを更新
   */
  private async _update(): Promise<void> {
    if (!this._panel.visible) {
      return;
    }

    this._panel.webview.html = this._getHtmlForWebview();
    await this._updateWebview();
  }

  /**
   * WebViewの状態を更新
   */
  private async _updateWebview(): Promise<void> {
    try {
      // 選択中のスコープを設定
      let selectedScope = null;
      if (this._selectedScopeIndex >= 0 && this._selectedScopeIndex < this._scopes.length) {
        selectedScope = {
          ...this._scopes[this._selectedScopeIndex],
          files: this._currentScope?.files || []
        };
      }
      
      // 全体進捗の計算
      const totalFiles = this._scopes.reduce((sum, scope) => sum + (scope.files?.length || 0), 0);
      const completedFiles = this._scopes.reduce((sum, scope) => {
        return sum + (scope.files?.filter((f: any) => f.completed)?.length || 0);
      }, 0);
      const totalProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
      
      // WebViewにデータを送信
      Logger.info(`WebViewに状態更新を送信します - スコープ数: ${this._scopes.length}, 実装フェーズ: ${!this._isPreparationMode}`);
      
      // メッセージオブジェクトを作成（デバッグ用に変数に格納）
      const message = {
        command: 'updateState',
        scopes: this._scopes,
        selectedScopeIndex: this._selectedScopeIndex,
        selectedScope,
        directoryStructure: this._directoryStructure,
        projectPath: this._projectPath,
        isPreparationMode: this._isPreparationMode, // 明示的に追加して確実に送信
        totalProgress: totalProgress,
        projectStats: {
          totalFiles,
          completedFiles,
          totalProgress
        }
      };
      
      // 実際にメッセージを送信
      Logger.info(`WebView更新メッセージ送信: ${JSON.stringify(message, (key, value) => 
        key === 'scopes' || key === 'selectedScope' || key === 'directoryStructure' 
          ? '[省略]' : value)}`);
      
      await this._panel.webview.postMessage(message);
    } catch (error) {
      Logger.error('WebViewの状態更新中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`WebViewの状態更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // CSS, JS のURI生成
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    
    // モックアップのJS/CSSを使用
    const scopeManagerCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.css')
    );

    const scopeManagerJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.js')
    );

    const designSystemCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css')
    );

    const componentsCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'components.css')
    );

    // WebViewのHTMLを構築
    // ハブ＆スポークデザインを採用したHTML
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AppGenius ダッシュボード</title>
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <link href="${designSystemCssUri}" rel="stylesheet">
  <link href="${componentsCssUri}" rel="stylesheet">
  <link href="${scopeManagerCssUri}" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    /* ライトモード (デフォルト) */
    body {
      color: #333333;
      background-color: #f5f5f5;
    }
    
    /* ダークモード */
    body.theme-dark {
      color: #e0e0e0;
      background-color: #1e1e1e;
    }
    
    /* 全体のレイアウト */
    .layout-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    /* メインコンテンツ */
    .main-content {
      display: flex;
      flex: 1;
    }
    
    /* サイドバー */
    .sidebar {
      width: 280px;
      padding: 20px;
      overflow-y: auto;
      transition: background-color 0.3s ease;
    }
    
    /* ライトモード */
    .sidebar {
      background-color: #ffffff;
      border-right: 1px solid #e0e0e0;
    }
    
    /* ダークモード */
    body.theme-dark .sidebar {
      background-color: #252526;
      border-right: 1px solid #3c3c3c;
    }
    
    .sidebar-header {
      margin-bottom: 20px;
    }
    
    .sidebar-header h2 {
      font-size: 1.2rem;
      margin-bottom: 15px;
    }
    
    .project-buttons {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .project-buttons button {
      flex: 1;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    
    .scope-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .scope-item {
      padding: 15px;
      background-color: var(--vscode-editor-background);
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .scope-item.active {
      border-left: 4px solid var(--vscode-button-background);
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    
    .scope-item:hover:not(.active) {
      background-color: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-button-background);
    }
    
    .scope-item h3 {
      font-size: 1.1rem;
      margin-bottom: 5px;
    }
    
    .scope-progress {
      height: 8px;
      border-radius: 4px;
      margin-top: 8px;
      overflow: hidden;
      background-color: var(--vscode-progressBar-background);
    }
    
    .scope-progress-bar {
      height: 100%;
      transition: width 0.5s ease;
    }
    
    /* ダッシュボードエリア */
    .dashboard {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }
    
    .project-info {
      background-color: var(--vscode-editor-background);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid var(--vscode-panel-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }
    
    .project-info h2 {
      font-size: 1.4rem;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .project-path {
      font-family: monospace;
      background-color: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 4px;
      font-size: 0.9rem;
      color: var(--vscode-foreground);
    }
    
    /* グリッドレイアウト */
    .grid-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    /* メインのスコープ詳細 */
    .main-scope {
      grid-column: 1;
      grid-row: 1 / span 2;
      background-color: var(--vscode-editor-background);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
    }
    
    /* 右側のスコープ関連情報 */
    .scope-info-blocks {
      grid-column: 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 20px;
    }
    
    /* カード共通スタイル */
    .card {
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
    }
    
    /* ライトモード */
    .card {
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
    }
    
    /* ダークモード */
    body.theme-dark .card {
      background-color: #2d2d2d;
      border: 1px solid #3c3c3c;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    
    .card-header {
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }
    
    /* ライトモード */
    .card-header {
      border-bottom: 1px solid #e0e0e0;
      background-color: #f8f8f8;
    }
    
    /* ダークモード */
    body.theme-dark .card-header {
      border-bottom: 1px solid #3c3c3c;
      background-color: #333333;
    }
    
    .card-header h3 {
      margin: 0;
      font-size: 1.1rem;
    }
    
    .card-content {
      padding: 15px;
      flex: 1;
      overflow-y: auto;
    }
    
    .card-footer {
      padding: 10px 15px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: flex-end;
      background-color: var(--vscode-tab-inactiveBackground);
    }
    
    .card-button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .card-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    /* スコープ関連スタイル */
    /* ライトモード */
    .main-scope .card-header {
      background-color: #4a69bd;
      color: white;
    }
    
    /* ダークモード */
    body.theme-dark .main-scope .card-header {
      background-color: #0e639c;
      color: white;
    }
    
    .files-list {
      margin-top: 10px;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      padding: 8px;
      transition: background-color 0.2s ease;
    }
    
    /* ライトモード */
    .file-item {
      border-bottom: 1px solid #e0e0e0;
    }
    
    .file-item:hover {
      background-color: #f0f0f0;
    }
    
    /* ダークモード */
    body.theme-dark .file-item {
      border-bottom: 1px solid #3c3c3c;
    }
    
    body.theme-dark .file-item:hover {
      background-color: #3c3c3c;
    }
    
    .file-item:last-child {
      border-bottom: none;
    }
    
    .file-checkbox {
      margin-right: 8px;
      cursor: pointer;
    }
    
    .progress-bar {
      height: 8px;
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    
    .progress-fill {
      height: 100%;
      background-color: var(--vscode-button-background);
      border-radius: 4px;
      transition: width 0.5s ease, background-color 0.5s ease;
    }
    
    .status-pending {
      background-color: var(--vscode-charts-yellow);
    }
    
    .status-in-progress {
      background-color: var(--vscode-charts-blue);
    }
    
    .status-completed {
      background-color: var(--vscode-charts-green);
    }
    
    .status-blocked {
      background-color: var(--vscode-charts-red);
    }
    
    /* 環境変数、ディレクトリ、要件の共通スタイル */
    /* ライトモード */
    .env-vars .card-header {
      background-color: #42a5f5;
      color: white;
    }
    
    .directory .card-header {
      background-color: #66bb6a;
      color: white;
    }
    
    .requirements .card-header {
      background-color: #ec407a;
      color: white;
    }
    
    .tools .card-header {
      background-color: #ffa726;
      color: white;
    }
    
    /* ダークモード */
    body.theme-dark .env-vars .card-header {
      background-color: #1976d2;
      color: white;
    }
    
    body.theme-dark .directory .card-header {
      background-color: #2e7d32;
      color: white;
    }
    
    body.theme-dark .requirements .card-header {
      background-color: #c2185b;
      color: white;
    }
    
    body.theme-dark .tools .card-header {
      background-color: #ef6c00;
      color: white;
    }
    
    .item-list {
      list-style: none;
      padding: 0;
    }
    
    .item-list li {
      padding: 8px;
      margin-bottom: 8px;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--vscode-panel-border);
      transition: all 0.2s ease;
    }
    
    .item-list li:hover {
      background-color: var(--vscode-list-hoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    /* 継承情報 */
    .inheritance-info {
      margin-top: 20px;
      padding: 12px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.5;
      transition: all 0.3s ease;
    }
    
    /* ライトモード */
    .inheritance-info {
      background-color: #e3f2fd;
      border-left: 4px solid #2196f3;
      color: #0d47a1;
    }
    
    /* ダークモード */
    body.theme-dark .inheritance-info {
      background-color: rgba(33, 150, 243, 0.1);
      border-left: 4px solid #1976d2;
      color: #bbdefb;
    }
    
    /* 開発準備モード用のスタイル */
    .preparation-step-list {
      margin-top: 20px;
    }
    
    .preparation-step {
      margin-bottom: 25px;
      padding: 15px;
      border-radius: 8px;
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
    }
    
    .preparation-step h4 {
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 1.1rem;
      color: var(--vscode-button-foreground);
      background-color: var(--vscode-button-background);
      padding: 8px 12px;
      border-radius: 4px;
    }
    
    .preparation-step p {
      margin-bottom: 15px;
    }
    
    .preparation-step button {
      display: inline-block;
      margin-top: 10px;
    }
    
    /* ダイアログスタイル */
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .dialog {
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      padding: 16px;
      width: 500px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .dialog-title {
      font-size: 18px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }
    
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    
    /* レスポンシブデザイン調整 */
    @media (max-width: 1200px) {
      .grid-layout {
        grid-template-columns: 1fr;
      }
      
      .main-scope {
        grid-column: 1;
        grid-row: 1;
        margin-bottom: 20px;
      }
      
      .scope-info-blocks {
        grid-column: 1;
        grid-row: 2;
      }
    }
    
    @media (max-width: 768px) {
      .main-content {
        flex-direction: column;
      }
      
      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      
      .scope-info-blocks {
        grid-template-columns: 1fr;
        grid-template-rows: repeat(4, auto);
      }
    }
  </style>
</head>
<body>
  <div class="layout-container">
    <!-- メインコンテンツ -->
    <div class="main-content">
      <!-- サイドバー -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h2 id="panel-header-title">プロジェクトスコープ</h2>
          <div class="project-buttons">
            <button id="add-scope-button">
              <span class="material-icons">add</span> 新規作成
            </button>
            <button id="create-scope-button">
              <span class="material-icons">auto_awesome</span> <span id="ai-button-text">実装計画を立てる</span>
            </button>
          </div>
        </div>
        
        <!-- 開発準備モード用のビュー -->
        <div id="preparation-mode-view" style="display: none;">
          <div class="preparation-step-list">
            <h3>開発準備フェーズ</h3>
            <p>AppGeniusプロジェクトを成功させるために、以下のステップに沿って開発準備を進めてください。</p>
            
            <div class="preparation-step">
              <h4>ステップ1: 要件定義を作成する</h4>
              <p>要件定義ビジュアライザーを使って、プロジェクトの要件定義を行いましょう。</p>
              <button id="requirements-button" class="card-button">
                <span class="material-icons">description</span> 要件定義エディタを開く
              </button>
            </div>
            
            <div class="preparation-step">
              <h4>ステップ2: モックアップを作成する</h4>
              <p>要件定義に基づいて、アプリケーションのモックアップを作成しましょう。</p>
              <button id="mockup-gallery-button" class="card-button">
                <span class="material-icons">image</span> モックアップギャラリーを開く
              </button>
            </div>
            
            <div class="preparation-step">
              <h4>ステップ3: 詳細要件定義を整える</h4>
              <p>モックアップに基づいて、具体的な要件定義を整えましょう。</p>
              <button id="requirements-button" class="card-button">
                <span class="material-icons">article</span> 要件定義エディタを開く
              </button>
            </div>
            
            <div class="preparation-step">
              <h4>ステップ4: プロジェクト計画を立てる</h4>
              <p>実装に向けたプロジェクト計画を立てましょう。</p>
              <button id="create-scope-button-alt" class="card-button">
                <span class="material-icons">auto_awesome</span> <span id="ai-button-text-alt">実装計画を立てる</span>
              </button>
              <script>
                // 開発準備フェーズのAIボタンのイベントハンドラー
                document.getElementById('create-scope-button-alt').addEventListener('click', () => {
                  const vscode = acquireVsCodeApi();
                  vscode.postMessage({ command: 'launchScopeCreator' });
                });
              </script>
            </div>
            
            <div class="preparation-step">
              <h4>ステップ5: 環境変数を設定する</h4>
              <p>実装に必要な環境変数を設定しましょう。</p>
              <button id="env-vars-button" class="card-button">
                <span class="material-icons">settings</span> 環境変数アシスタントを開く
              </button>
            </div>
            
            <div class="preparation-step">
              <h4>実装フェーズへ移行</h4>
              <p>準備が整ったら、実装フェーズに移行しましょう。</p>
              <button id="switch-to-implementation-button" class="card-button">
                <span class="material-icons">arrow_forward</span> 実装フェーズに移行
              </button>
            </div>
          </div>
        </div>
        
        <!-- 実装モード用のスコープリスト（通常のビュー） -->
        <div id="scope-list-container">
          <div id="scope-list" class="scope-list">
            <!-- スコープリストがここに動的に生成されます -->
            <div class="scope-item">
              <h3>スコープを読み込んでいます...</h3>
              <div class="scope-progress">
                <div class="scope-progress-bar status-in-progress" style="width: 50%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- ダッシュボードエリア -->
      <div class="dashboard">
        <!-- プロジェクト情報 -->
        <div class="project-info">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2><span class="material-icons">folder</span> <span id="project-title">プロジェクト</span></h2>
            <div class="overall-progress">
              <div style="font-size: 0.9rem; margin-bottom: 4px; text-align: right;">全体進捗</div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div id="project-progress-text" style="font-weight: bold; font-size: 1.2rem;">0%</div>
                <div class="progress-bar" style="width: 120px; height: 8px;">
                  <div id="project-progress-bar" class="progress-fill" style="width: 0%;"></div>
                </div>
              </div>
            </div>
          </div>
          <div id="project-path" class="project-path">/path/to/project</div>
          
          <div class="project-stats" style="display: flex; margin-top: 15px; font-size: 0.9rem; background-color: var(--vscode-editor-background); padding: 10px; border-radius: 4px; border: 1px solid var(--vscode-panel-border);">
            <div style="flex: 1; text-align: center; border-right: 1px solid var(--vscode-panel-border);">
              <div>総ファイル数</div>
              <div id="total-files" style="font-weight: bold; margin-top: 4px;">0</div>
            </div>
            <div style="flex: 1; text-align: center; border-right: 1px solid var(--vscode-panel-border);">
              <div>完了ファイル数</div>
              <div id="completed-files" style="font-weight: bold; margin-top: 4px; color: var(--vscode-charts-green);">0</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div>スコープ進捗率</div>
              <div id="scope-completion-rate" style="font-weight: bold; margin-top: 4px;">0%</div>
            </div>
          </div>
        </div>
        
        <!-- グリッドレイアウト -->
        <div class="grid-layout">
          <!-- メインのスコープ詳細 -->
          <div class="main-scope">
            <div class="card">
              <div class="card-header">
                <span class="material-icons">assignment</span>
                <h3 id="scope-title">スコープを選択してください</h3>
              </div>
              
              <div id="scope-detail-content" class="card-content" style="display: none;">
                <p id="scope-description"></p>
                <div style="margin-top: 12px;">
                  <div style="font-size: 0.9rem; color: var(--vscode-descriptionForeground);">進捗状況</div>
                  <div style="display: flex; align-items: center; margin-top: 4px;">
                    <div id="scope-progress" style="font-weight: bold; margin-right: 10px;">0%</div>
                    <div class="progress-bar" style="flex-grow: 1;">
                      <div id="scope-progress-bar" class="progress-fill status-pending" style="width: 0%;"></div>
                    </div>
                  </div>
                </div>
                
                <h4 style="margin-top: 20px;">実装予定ファイル</h4>
                <div id="implementation-files" class="files-list">
                  <!-- ファイルリストがここに動的に生成されます -->
                  <div class="file-item">実装予定ファイルが定義されていません</div>
                </div>
                
                <div id="inheritance-info" class="inheritance-info">
                  引継ぎ情報はありません
                </div>
              </div>
              
              <div id="scope-empty-message" class="card-content">
                <p>左側のリストからスコープを選択してください。</p>
                <p style="margin-top: 10px;">スコープとは、アプリケーションの機能単位であり、実装の作業範囲を定義します。</p>
                <p style="margin-top: 10px;">スコープを選択すると、その詳細情報や実装予定ファイル、進捗状況などが表示されます。</p>
              </div>
              
              <div class="card-footer">
                <button id="implement-button" class="card-button" style="display: none;">
                  <span class="material-icons">code</span> 実装開始
                </button>
              </div>
            </div>
          </div>
          
          <!-- 右側のスコープ関連情報 -->
          <div class="scope-info-blocks">
            <!-- 要件定義エディタ -->
            <div class="card requirements">
              <div class="card-header">
                <span class="material-icons">description</span>
                <h3>要件定義エディタ</h3>
              </div>
              
              <div class="card-content">
                <p>アプリの目的と機能を明確にします</p>
                
                <ul class="item-list">
                  <li><span style="color: var(--vscode-charts-green);">✅</span> ユーザーストーリー</li>
                  <li><span style="color: var(--vscode-charts-green);">✅</span> 機能要件</li>
                  <li><span style="color: var(--vscode-charts-blue);">⏳</span> 非機能要件</li>
                  <li><span style="color: var(--vscode-charts-yellow);">⭕</span> 優先順位設定</li>
                </ul>
              </div>
              
              <div class="card-footer">
                <button id="requirements-button" class="card-button">
                  <span class="material-icons">edit</span> 要件を編集
                </button>
              </div>
            </div>
            
            <!-- モックアップギャラリー -->
            <div class="card directory">
              <div class="card-header">
                <span class="material-icons">image</span>
                <h3>モックアップギャラリー</h3>
              </div>
              
              <div class="card-content">
                <p>画面デザインのイメージを作成・編集</p>
                
                <ul class="item-list">
                  <li><span>🖼️</span> ログイン画面</li>
                  <li><span>🖼️</span> ダッシュボード</li>
                  <li><span>🖼️</span> ユーザープロフィール</li>
                </ul>
              </div>
              
              <div class="card-footer">
                <button id="mockup-gallery-button" class="card-button">
                  <span class="material-icons">collections</span> モックアップを表示
                </button>
              </div>
            </div>
            
            <!-- 環境変数アシスタント -->
            <div class="card env-vars">
              <div class="card-header">
                <span class="material-icons">key</span>
                <h3>環境変数アシスタント</h3>
              </div>
              
              <div class="card-content">
                <p>環境変数の設定をサポート</p>
                
                <ul class="item-list">
                  <li><span style="color: var(--vscode-charts-green);">✅</span> API認証キー</li>
                  <li><span style="color: var(--vscode-charts-green);">✅</span> データベース接続</li>
                  <li><span style="color: var(--vscode-charts-red);">⚠️</span> サーバー設定</li>
                  <li><span style="color: var(--vscode-charts-green);">✅</span> OAuth認証</li>
                </ul>
              </div>
              
              <div class="card-footer">
                <button id="env-vars-button" class="card-button">
                  <span class="material-icons">settings</span> 環境変数を設定
                </button>
              </div>
            </div>
            
            <!-- デバッグ探偵 -->
            <div class="card tools">
              <div class="card-header">
                <span class="material-icons">bug_report</span>
                <h3>デバッグ探偵</h3>
              </div>
              
              <div class="card-content">
                <p>エラーを検出し解決します</p>
                
                <ul class="item-list">
                  <li><span style="color: var(--vscode-charts-red);">🐞</span> レンダリングエラー</li>
                  <li><span style="color: var(--vscode-charts-green);">✅</span> API接続問題</li>
                  <li><span style="color: var(--vscode-charts-blue);">🔄</span> ステート管理</li>
                </ul>
              </div>
              
              <div class="card-footer">
                <button id="debug-detective-button" class="card-button">
                  <span class="material-icons">search</span> デバッグを開始
                </button>
              </div>
            </div>
            
            <!-- リファレンスマネージャー -->
            <div class="card reference">
              <div class="card-header">
                <span class="material-icons">menu_book</span>
                <h3>リファレンスマネージャー</h3>
              </div>
              
              <div class="card-content">
                <p>参考資料の管理を行います</p>
                
                <ul class="item-list">
                  <li><span style="color: var(--vscode-charts-green);">📑</span> コード例</li>
                  <li><span style="color: var(--vscode-charts-green);">📑</span> APIドキュメント</li>
                  <li><span style="color: var(--vscode-charts-green);">📑</span> 設計資料</li>
                  <li><span style="color: var(--vscode-charts-yellow);">📑</span> ガイドライン</li>
                </ul>
              </div>
              
              <div class="card-footer">
                <button id="reference-manager-button" class="card-button">
                  <span class="material-icons">bookmark</span> リファレンスを管理
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- ディレクトリ構造ダイアログ -->
  <div id="directory-dialog" class="dialog-overlay" style="display: none;">
    <div class="dialog">
      <h3 class="dialog-title">ディレクトリ構造</h3>
      <pre id="directory-structure" style="background-color: var(--vscode-textCodeBlock-background); padding: 10px; overflow: auto; max-height: 400px; white-space: pre-wrap; font-family: monospace;"></pre>
      <div class="dialog-footer">
        <button id="directory-close" class="card-button">閉じる</button>
      </div>
    </div>
  </div>
  
  <!-- モード切替ボタンを追加 -->
  <div style="position: fixed; bottom: 20px; right: 20px; z-index: 900;">
    <button id="reset-to-preparation-button" class="card-button" style="display: none;">
      <span class="material-icons">settings_backup_restore</span> 開発準備モードに戻る
    </button>
  </div>
  
  <script src="${scopeManagerJsUri}"></script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    ScopeManagerPanel.currentPanel = undefined;

    this._panel.dispose();

    // Node.jsのファイルシステムウォッチャーを解放
    if (this._docsDirWatcher) {
      this._docsDirWatcher.close();
      this._docsDirWatcher = null;
    }

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}