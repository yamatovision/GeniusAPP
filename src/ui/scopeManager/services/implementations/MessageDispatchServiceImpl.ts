import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../../utils/logger';
import { IMessageDispatchService } from '../interfaces/IMessageDispatchService';
import { Message } from '../interfaces/common';
import { IProjectService } from '../interfaces/IProjectService';
import { IFileSystemService } from '../interfaces/IFileSystemService';
import { IUIStateService } from '../interfaces/IUIStateService';
import { ISharingService } from '../interfaces/ISharingService';
import { IPanelService } from '../interfaces/IPanelService';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../../services/AppGeniusEventBus';

/**
 * WebViewとバックエンドサービス間のメッセージルーティングを担当するサービス
 */
export class MessageDispatchServiceImpl implements IMessageDispatchService {
  private handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>> = new Map();
  private _disposables: vscode.Disposable[] = [];
  
  // イベントエミッター
  private _onMessageProcessed = new vscode.EventEmitter<{command: string, success: boolean}>();
  public readonly onMessageProcessed = this._onMessageProcessed.event;
  
  // 依存サービス
  private _sharingService?: ISharingService;
  private _projectService?: IProjectService;
  private _fileSystemService?: IFileSystemService;
  private _uiStateService?: IUIStateService;
  private _panelService?: IPanelService;
  
  // イベントバス
  private _eventBus: AppGeniusEventBus;
  
  // シングルトンインスタンス
  private static _instance: MessageDispatchServiceImpl;
  
  /**
   * シングルトンインスタンスを取得
   * @returns MessageDispatchServiceImplのインスタンス
   */
  public static getInstance(): MessageDispatchServiceImpl {
    if (!MessageDispatchServiceImpl._instance) {
      MessageDispatchServiceImpl._instance = new MessageDispatchServiceImpl();
    }
    return MessageDispatchServiceImpl._instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor() {
    this._eventBus = AppGeniusEventBus.getInstance();
    
    // イベントリスナーの設定
    this._setupEventListeners();
    
    // 標準ハンドラの登録は依存サービスが設定された後で行うため、ここでは行わない
    // 代わりにsetDependencies内でハンドラ登録を行う
    
    Logger.info('MessageDispatchServiceImpl: 初期化完了');
  }
  
  /**
   * イベントバスリスナーを設定
   * @private
   */
  private _setupEventListeners(): void {
    // イベントリスナーはより選択的に追加する
    // 循環参照の問題を回避するため、制限付きのリスナーのみ追加
    this._eventBus.onEvent((event) => {
      // 自分自身が発行したイベントは無視（循環を防止）
      if (event.source === 'MessageDispatchService') {
        return;
      }
      
      // 特定の条件を満たすイベントのみを処理
      if (typeof event.data === 'object' && event.data && 
          ('command' in event.data || 'success' in event.data)) {
        // イベントバス経由で他のサービスから送信されたメッセージを中継
        this._onMessageProcessed.fire({
          command: event.data.command || '',
          success: event.data.success || false
        });
      }
    });
    
    Logger.info('MessageDispatchServiceImpl: イベントリスナーを設定しました');
  }
  
  /**
   * 依存サービスを設定
   * @param services 依存サービス
   */
  public setDependencies(services: {
    sharingService?: any;
    projectService?: any;
    fileSystemService?: any;
    uiStateService?: any;
    panelService?: any;
  }): void {
    if (services.sharingService) {
      this._sharingService = services.sharingService;
    }
    
    if (services.projectService) {
      this._projectService = services.projectService;
    }
    
    if (services.fileSystemService) {
      this._fileSystemService = services.fileSystemService;
    }
    
    if (services.uiStateService) {
      this._uiStateService = services.uiStateService;
    }
    
    if (services.panelService) {
      this._panelService = services.panelService;
    }
    
    // 依存サービスが設定された後でハンドラを登録
    this.registerProjectHandlers();
    this.registerFileHandlers();
    this.registerSharingHandlers();
    
    Logger.debug('MessageDispatchServiceImpl: 依存サービスを設定しました');
  }
  
  /**
   * WebViewパネルにメッセージを送信
   * @param panel WebViewパネル
   * @param message 送信するメッセージ
   */
  public sendMessage(panel: vscode.WebviewPanel, message: Message): void {
    try {
      panel.webview.postMessage(message);
      
      // 最小限のログ出力に抑える
      if (message.command && message.command !== 'updateMarkdownContent' && message.command !== 'updateDirectoryStructure') {
        // コマンド名のみをログ出力し、データは出力しない
        Logger.debug(`MessageDispatchServiceImpl: 送信: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: メッセージ「${message.command}」の送信に失敗`, error as Error);
      
      // 重要なメッセージのみリトライ
      if (message.priority === 'high') {
        try {
          setTimeout(() => panel.webview.postMessage(message), 100);
        } catch (retryError) {
          // エラーログは出力しない（重複防止）
        }
      }
    }
  }
  
  /**
   * メッセージハンドラを登録
   * @param command コマンド名
   * @param handler ハンドラ関数
   */
  public registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void {
    this.handlers.set(command, handler);
    Logger.debug(`MessageDispatchServiceImpl: ハンドラを登録しました: ${command}`);
  }
  
  /**
   * 複数のメッセージハンドラを一括登録
   * @param handlers コマンド名とハンドラ関数のマップ
   */
  public registerHandlers(handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>>): void {
    handlers.forEach((handler, command) => {
      this.registerHandler(command, handler);
    });
    Logger.info(`MessageDispatchServiceImpl: ${handlers.size}個のハンドラを一括登録しました`);
  }
  
  /**
   * WebViewからのメッセージを処理
   * @param message 受信したメッセージ
   * @param panel VSCodeのWebViewパネル
   */
  public async handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // コマンド名のみログ出力
      Logger.debug(`MessageDispatchServiceImpl: 受信: ${message.command}`);
      
      // サービスタイプがある場合は対応するサービスに直接ルーティング
      if (message.serviceType) {
        await this._routeToService(message, panel);
        return;
      }
      
      // 従来のハンドラベースルーティング
      const handler = this.handlers.get(message.command);
      if (handler) {
        // 対応するハンドラが登録されている場合
        await handler(message, panel);
        
        // 処理成功イベントを発行
        this._onMessageProcessed.fire({ command: message.command, success: true });
      } else {
        // ハンドラーが見つからない場合のみ警告ログ
        Logger.warn(`MessageDispatchServiceImpl: ハンドラが未登録のコマンド: ${message.command}`);
        
        // 処理失敗イベントを発行
        this._onMessageProcessed.fire({ command: message.command, success: false });
      }
    } catch (error) {
      // エラー発生時のログは簡潔に
      Logger.error(`MessageDispatchServiceImpl: エラー: ${message.command}`, error as Error);
      
      // エラーメッセージをWebViewに返す
      this.showError(panel, `操作中にエラーが発生しました: ${(error as Error).message}`);
      
      // 処理失敗イベントを発行
      this._onMessageProcessed.fire({ command: message.command, success: false });
    }
  }
  
  /**
   * メッセージを対応するサービスに転送
   * @param message メッセージ
   * @param panel WebViewパネル
   */
  private async _routeToService(message: Message, panel: vscode.WebviewPanel): Promise<void> {
    try {
      let service: any = null;
      
      // サービスタイプに応じたサービスを取得
      switch (message.serviceType) {
        case 'fileSystem':
          service = this._fileSystemService;
          break;
        case 'project':
          service = this._projectService;
          break;
        case 'sharing':
          service = this._sharingService;
          break;
        case 'uiState':
          service = this._uiStateService;
          break;
        case 'panel':
          service = this._panelService;
          break;
        default:
          throw new Error(`不明なサービスタイプ: ${message.serviceType}`);
      }
      
      if (!service) {
        throw new Error(`サービスが見つかりません: ${message.serviceType}`);
      }
      
      // コマンドに対応するメソッドを呼び出す
      if (typeof service[message.command] === 'function') {
        // サービスの該当メソッドを呼び出し
        const result = await service[message.command](message, panel);
        
        // リクエストIDがある場合は結果を返す
        if (message.requestId) {
          this.sendMessage(panel, {
            command: 'response',
            requestId: message.requestId,
            data: result
          });
        }
        
        this._onMessageProcessed.fire({ command: message.command, success: true });
      } else {
        throw new Error(`メソッドが見つかりません: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`サービスルーティングエラー: ${message.serviceType}.${message.command}`, error as Error);
      
      // リクエストIDがある場合はエラーを返す
      if (message.requestId) {
        this.sendMessage(panel, {
          command: 'response',
          requestId: message.requestId,
          error: (error as Error).message
        });
      } else {
        // 通常のエラー表示
        this.showError(panel, `${message.serviceType}サービスでエラーが発生: ${(error as Error).message}`);
      }
      
      this._onMessageProcessed.fire({ command: message.command, success: false });
    }
  }
  
  /**
   * WebViewからのメッセージ受信処理を設定
   * @param panel VSCodeのWebViewパネル
   * @returns 登録したイベントリスナーのDisposable
   */
  public setupMessageReceiver(panel: vscode.WebviewPanel): vscode.Disposable {
    const disposable = panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message, panel);
      },
      null,
      this._disposables
    );
    
    Logger.info('MessageDispatchServiceImpl: WebViewからのメッセージ受信処理を設定しました');
    return disposable;
  }
  
  /**
   * 成功メッセージを表示
   * @param panel WebViewパネル
   * @param message 表示するメッセージ
   */
  public showSuccess(panel: vscode.WebviewPanel, message: string): void {
    this.sendMessage(panel, {
      command: 'showSuccess',
      message,
      priority: 'high'
    });
  }
  
  /**
   * エラーメッセージを表示
   * @param panel WebViewパネル
   * @param message 表示するエラーメッセージ
   */
  public showError(panel: vscode.WebviewPanel, message: string): void {
    // messageが未定義またはnullの場合のデフォルトメッセージを設定
    const errorMessage = message || 'エラーが発生しました（詳細情報がありません）';
    this.sendMessage(panel, {
      command: 'showError',
      message: errorMessage,
      priority: 'high'
    });
  }
  
  /**
   * プロジェクト関連のメッセージハンドラーを登録
   */
  public registerProjectHandlers(): void {
    // プロジェクトサービスが設定されているか確認
    if (!this._projectService) {
      Logger.warn('MessageDispatchServiceImpl: ProjectServiceが設定されていないため、プロジェクト関連ハンドラーは登録できません');
      return;
    }
    
    // initialize ハンドラー
    this.registerHandler('initialize', async (message: Message, panel: vscode.WebviewPanel) => {
      try {
        Logger.info('MessageDispatchServiceImpl: initialize メッセージを受信');
        
        // パネルの初期化前にDebugReplのツリー入力を確認
        if (panel.webview.options && typeof panel.webview.options === 'object') {
          // DebugReplのツリー入力初期化フラグを設定
          try {
            // @ts-ignore - DebugRep内部プロパティにアクセス
            panel.webview.options.treeInput = {};
            Logger.info('MessageDispatchServiceImpl: DebugReplのツリー入力を初期化しました');
          } catch (treeError) {
            Logger.warn('MessageDispatchServiceImpl: DebugReplのツリー入力初期化に失敗', treeError as Error);
          }
        }
        
        // PanelServiceが設定されている場合はそれを使用
        if (this._panelService && typeof this._panelService.initializePanel === 'function') {
          const projectPath = message.projectPath || this._projectService.getActiveProjectPath();
          await this._panelService.initializePanel(projectPath);
          
          // 初期化後にログ出力（デバッグ用）
          Logger.info('MessageDispatchServiceImpl: PanelServiceを使用してパネルを初期化しました');
        } else {
          // 従来の方法で初期化処理（PanelServiceが利用できない場合）
          Logger.warn('MessageDispatchServiceImpl: PanelServiceが利用できないため従来の方法で初期化');
          
          // プロジェクト一覧を更新
          const allProjects = await this._projectService.getAllProjects();
          const activeProject = this._projectService.getActiveProject();
          
          this.sendMessage(panel, {
            command: 'updateProjects',
            projects: allProjects,
            activeProject: activeProject
          });
          
          // プロジェクトのディレクトリ構造を読み込む（ファイルブラウザ用）
          if (activeProject && activeProject.path && this._fileSystemService) {
            try {
              // ファイルブラウザの初期化
              const structure = await this._fileSystemService.getDirectoryStructure(activeProject.path);
              this.sendMessage(panel, {
                command: 'updateDirectoryStructure',
                structure: structure
              });
              
              Logger.info('MessageDispatchServiceImpl: ファイルブラウザ用ディレクトリ構造を送信しました');
            } catch (dirError) {
              Logger.warn('MessageDispatchServiceImpl: ディレクトリ構造取得でエラー', dirError as Error);
            }
          }
          
          // 進捗ファイルをロード
          if (activeProject && activeProject.path && this._fileSystemService) {
            const progressFilePath = path.join(activeProject.path, 'docs', 'SCOPE_PROGRESS.md');
            try {
              if (fs.existsSync(progressFilePath)) {
                const content = await this._fileSystemService.readMarkdownFile(progressFilePath);
                this.sendMessage(panel, {
                  command: 'updateMarkdownContent',
                  content: content,
                  timestamp: Date.now(),
                  priority: 'high',
                  forScopeProgress: true
                });
                
                Logger.info('MessageDispatchServiceImpl: 進捗ファイルを読み込みました');
              } else {
                // docsディレクトリが存在するか確認
                const docsPath = path.join(activeProject.path, 'docs');
                if (!fs.existsSync(docsPath)) {
                  // docsディレクトリがなければ作成
                  try {
                    fs.mkdirSync(docsPath, { recursive: true });
                    Logger.info(`MessageDispatchServiceImpl: docsディレクトリを作成しました: ${docsPath}`);
                  } catch (mkdirError) {
                    Logger.warn(`MessageDispatchServiceImpl: docsディレクトリの作成に失敗: ${docsPath}`, mkdirError as Error);
                  }
                }
                
                // 進捗ファイルが見つからないことをログに記録するのみ（エラー表示なし）
                Logger.info(`MessageDispatchServiceImpl: 進捗ファイルが見つかりません: ${progressFilePath}`);
              }
            } catch (error) {
              // エラーをログに記録するのみ（UIにエラーは表示しない）
              Logger.warn(`MessageDispatchServiceImpl: 進捗ファイルのアクセスでエラーが発生: ${progressFilePath}`, error as Error);
            }
          }
          
          // 共有履歴を初期化
          if (this._sharingService && typeof this._sharingService.getHistory === 'function') {
            // 履歴を取得してパネルに送信
            const history = await this._sharingService.getHistory();
            if (history) {
              this.sendMessage(panel, {
                command: 'updateSharingHistory',
                history: history
              });
            }
            Logger.info('MessageDispatchServiceImpl: 共有履歴を初期化しました');
          }
        }
        
        // 初期化に成功したことをログに記録
        Logger.info('MessageDispatchServiceImpl: 初期化が正常に完了しました');
      } catch (error) {
        Logger.error('MessageDispatchServiceImpl: 初期化処理でエラー', error as Error);
        this.showError(panel, `初期化に失敗しました: ${(error as Error).message}`);
      }
    });
    
    // Note: selectProject ハンドラーを削除 - ScopeManagerPanelで直接ProjectServiceImplを使って処理
    
    // createProject ハンドラーの再実装
    // 従来のハンドラーと同じ機能ですが、ProjectServiceを利用するように変更
    this.registerHandler('createProject', async (message: Message, panel: vscode.WebviewPanel) => {
      try {
        const name = message.name || message.projectName || '';
        const description = message.description || '';
        
        if (!name) {
          throw new Error('プロジェクト名が指定されていません');
        }
        
        Logger.info(`MessageDispatchServiceImpl: createProjectメッセージを受信 - ProjectServiceを利用して処理します: ${name}`);
        
        // ProjectServiceを使用してプロジェクトを作成
        const projectId = await this._projectService.createProject(name, description);
        
        Logger.info(`MessageDispatchServiceImpl: プロジェクト作成に成功: ${name}, ID=${projectId}`);
        this.showSuccess(panel, `プロジェクト「${name}」を作成しました`);
      } catch (error) {
        Logger.error(`MessageDispatchServiceImpl: プロジェクト作成でエラー`, error as Error);
        this.showError(panel, `プロジェクト作成に失敗しました: ${(error as Error).message}`);
      }
    });
    
    // removeProject ハンドラーの再実装
    // 従来のハンドラーと同じ機能ですが、ProjectServiceを利用するように変更
    this.registerHandler('removeProject', async (message: Message, panel: vscode.WebviewPanel) => {
      try {
        const name = message.projectName || '';
        const path = message.projectPath || '';
        const id = message.projectId;
        
        if (!name && !path && !id) {
          throw new Error('プロジェクト情報が不足しています');
        }
        
        Logger.info(`MessageDispatchServiceImpl: removeProjectメッセージを受信 - ProjectServiceを利用して処理します: ${name}, path=${path}, id=${id || '不明'}`);
        
        // ProjectServiceを使用してプロジェクトを削除
        const result = await this._projectService.removeProject(name, path, id);
        
        if (result) {
          Logger.info(`MessageDispatchServiceImpl: プロジェクト削除に成功: ${name}`);
          this.showSuccess(panel, `プロジェクト「${name}」の登録を解除しました`);
        } else {
          Logger.warn(`MessageDispatchServiceImpl: プロジェクト削除に失敗: ${name}`);
          this.showError(panel, `プロジェクト「${name}」の登録解除に失敗しました`);
        }
      } catch (error) {
        Logger.error(`MessageDispatchServiceImpl: プロジェクト削除でエラー`, error as Error);
        this.showError(panel, `プロジェクト登録解除に失敗しました: ${(error as Error).message}`);
      }
    });
    
    // Note: getProjectList ハンドラーは削除
    // クライアントが直接ProjectServiceを使用するよう変更
    
    Logger.info('MessageDispatchServiceImpl: プロジェクト関連のメッセージハンドラーを登録しました');
  }
  
  /**
   * ファイル操作関連のメッセージハンドラーを登録
   */
  public registerFileHandlers(): void {
    // ファイルシステムサービスが設定されているか確認
    if (!this._fileSystemService) {
      Logger.warn('MessageDispatchServiceImpl: FileSystemServiceが設定されていないため、ファイル操作ハンドラーは登録できません');
      return;
    }
    
    // Note: openFileInEditor ハンドラーは削除
    // クライアントが直接FileSystemServiceを使用するよう変更
    
    // navigateDirectory ハンドラー
    this.registerHandler('navigateDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.path || message.dirPath) {
        try {
          const dirPath = message.path || message.dirPath;
          const files = await this._fileSystemService.listDirectory(dirPath);
          this.sendMessage(panel, {
            command: 'updateFileList',
            files: files,
            currentPath: dirPath,
            parentPath: path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null
          });
        } catch (error) {
          this.showError(panel, `ディレクトリの移動に失敗しました: ${(error as Error).message}`);
        }
      } else {
        Logger.warn('MessageDispatchServiceImpl: navigateDirectoryメッセージにpath/dirPath必須パラメータがありません');
        this.showError(panel, 'ディレクトリパスが指定されていません');
      }
    });
    
    // openFile ハンドラー（従来の実装 - プレビュー表示用）
    this.registerHandler('openFile', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.filePath) {
        try {
          const content = await this._fileSystemService.readFile(message.filePath);
          this.sendMessage(panel, {
            command: 'showFileContent',
            filePath: message.filePath,
            fileName: path.basename(message.filePath),
            content: content
          });
        } catch (error) {
          this.showError(panel, `ファイルを開けませんでした: ${(error as Error).message}`);
        }
      } else {
        Logger.warn('MessageDispatchServiceImpl: openFileメッセージにfilePath必須パラメータがありません');
        this.showError(panel, 'ファイルパスが指定されていません');
      }
    });
    
    // Note: getFileContentForTab ハンドラーは削除
    // クライアントが直接FileSystemServiceを使用するよう変更
    
    // openFileAsTab ハンドラー（ファイルをタブで直接開く）
    this.registerHandler('openFileAsTab', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }
      
      try {
        // ファイルの内容を読み込む
        const content = await this._fileSystemService.readFile(message.filePath);
        
        // 最低限必要な情報を取得
        const fileType = message.fileType || this._fileSystemService.getFileType(message.filePath);
        const isMarkdown = fileType === 'markdown';
        const fileName = message.fileName || path.basename(message.filePath);
        const tabId = `file-${message.filePath.split('/').join('-').replace(/[^\w-]/g, '')}`;
        
        // タブを開くメッセージを送信
        this.sendMessage(panel, {
          command: 'addFileTab',
          tabId,
          title: fileName,
          content,
          isMarkdown,
          filePath: message.filePath,
          lastModified: message.lastModified || new Date().toISOString()
        });
      } catch (error) {
        this.showError(panel, `ファイルを開けません: ${(error as Error).message}`);
      }
    });
    
    // Note: 重複したopenFileAsTabハンドラーの定義は削除
    
    // Note: getMarkdownContent ハンドラーは削除
    // クライアントが直接FileSystemServiceを使用するよう変更
    
    // Note: listDirectory ハンドラーは維持（現時点では削除せず）
    this.registerHandler('listDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.path) {
        Logger.warn('MessageDispatchServiceImpl: listDirectoryメッセージにpath必須パラメータがありません');
        this.showError(panel, 'ディレクトリパスが指定されていません');
        return;
      }
      
      try {
        const files = await this._fileSystemService.listDirectory(message.path);
        this.sendMessage(panel, {
          command: 'updateFileList',
          files: files,
          currentPath: message.path,
          parentPath: path.dirname(message.path) !== message.path ? path.dirname(message.path) : null
        });
      } catch (error) {
        Logger.warn(`FileSystemService: ディレクトリが存在しません: ${message.path}`);
        this.showError(panel, `ディレクトリが存在しないか、アクセスできません: ${message.path}`);
      }
    });
    
    // openFileAsTabハンドラーは上部で既に定義済み
    
    // Note: refreshFileBrowser ハンドラーは削除
    // クライアントが直接FileSystemServiceを使用するよう変更
    
    // Note: getProjectPath ハンドラーは削除
    // クライアントが直接ProjectServiceを使用するよう変更
    
    Logger.info('MessageDispatchServiceImpl: ファイル操作関連のメッセージハンドラーを登録しました');
  }
  
  /**
   * 共有関連のメッセージハンドラーを登録
   */
  public registerSharingHandlers(): void {
    // 共有サービスが設定されているか確認
    if (!this._sharingService) {
      Logger.warn('MessageDispatchServiceImpl: SharingServiceが設定されていないため、共有関連ハンドラーは登録できません');
      return;
    }
    
    // Note: getHistory ハンドラーは削除
    // クライアントが直接SharingServiceを使用するよう変更
    
    // Note: deleteFromHistory ハンドラーは削除
    // クライアントが直接SharingServiceを使用するよう変更
    
    // Note: copyCommand ハンドラーは削除
    // クライアントが直接SharingServiceを使用するよう変更
    
    // Note: copyToClipboard ハンドラーは削除
    // クライアントが直接VSCodeのクリップボードAPIを使用するよう変更
    
    // Note: shareClipboard ハンドラーは削除
    // クライアントが直接SharingServiceを使用するよう変更
    
    Logger.info('MessageDispatchServiceImpl: 共有関連のメッセージハンドラーを登録しました');
  }
  
  // Note: 共有関連のメソッドはすべて削除
  // クライアントが直接SharingServiceを使用するよう変更
  
  // Note: selectProjectメソッドは削除済み - ScopeManagerPanelで直接ProjectServiceImplを呼び出す
  
  // Note: createProjectメソッドは削除 - クライアントが直接ProjectServiceを使用するよう変更
  
  // Note: removeProjectメソッドは削除 - クライアントが直接ProjectServiceを使用するよう変更
  
  /**
   * リソース解放
   */
  public dispose(): void {
    // イベントエミッタを解放
    this._onMessageProcessed.dispose();
    
    // Disposableなリソースを解放
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    // 登録されたハンドラをクリア
    this.handlers.clear();
    
    Logger.info('MessageDispatchServiceImpl: リソースを解放しました');
  }
}