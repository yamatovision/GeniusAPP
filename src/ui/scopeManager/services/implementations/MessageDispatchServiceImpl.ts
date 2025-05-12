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
  // SharingServiceはScopeManagerPanelで直接使用されるため、このクラスでは使用しない
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
    sharingService?: any; // 互換性のために型は残すが使用しない
    projectService?: any;
    fileSystemService?: any;
    uiStateService?: any;
    panelService?: any;
  }): void {
    // SharingServiceはScopeManagerPanelで直接使用されるため設定しない

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
    // 共有ハンドラはScopeManagerPanelで直接処理されるため削除

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

      // ScopeManagerPanelで直接処理される特殊なコマンドのリスト
      const specialCommands = [
        'getHistory',
        'refreshFileBrowser',
        'deleteFromHistory',
        'copyCommand',
        'copyToClipboard'
      ];

      // 特殊コマンドの場合は警告を出さずに無視
      if (specialCommands.includes(message.command)) {
        // ScopeManagerPanelで直接処理されるコマンドなので何もしない
        return;
      }

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

            // 要件定義ファイルもロード
            const requirementsFilePath = path.join(activeProject.path, 'docs', 'requirements.md');
            try {
              if (fs.existsSync(requirementsFilePath)) {
                const content = await this._fileSystemService.readMarkdownFile(requirementsFilePath);
                this.sendMessage(panel, {
                  command: 'updateMarkdownContent',
                  content: content,
                  timestamp: Date.now(),
                  priority: 'high',
                  forRequirements: true
                });

                Logger.info('MessageDispatchServiceImpl: 要件定義ファイルを読み込みました');
              } else {
                // 要件定義ファイルが見つからないことをログに記録するのみ（エラー表示なし）
                Logger.info(`MessageDispatchServiceImpl: 要件定義ファイルが見つかりません: ${requirementsFilePath}`);
              }
            } catch (error) {
              // エラーをログに記録するのみ（UIにエラーは表示しない）
              Logger.warn(`MessageDispatchServiceImpl: 要件定義ファイルのアクセスでエラーが発生: ${requirementsFilePath}`, error as Error);
            }
          }
          
          // 共有履歴を初期化 - 安全なチェック
          try {
            // _sharingServiceが定義されているかどうかを確認
            const sharingService = (this as any)._sharingService;
            if (sharingService && typeof sharingService.getHistory === 'function') {
              // 履歴を取得してパネルに送信
              const history = await sharingService.getHistory();
              if (history) {
                this.sendMessage(panel, {
                  command: 'updateSharingHistory',
                  history: history
                });
              }
              Logger.info('MessageDispatchServiceImpl: 共有履歴を初期化しました');
            }
          } catch (sharingError) {
            // 共有履歴の初期化に失敗した場合でも処理を継続
            Logger.warn('MessageDispatchServiceImpl: 共有履歴の初期化に失敗しました', sharingError as Error);
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
   * マークダウンビューワーを開くハンドラー
   * @param message メッセージ
   * @param panel WebViewパネル
   */
  private async _handleOpenMarkdownViewer(message: Message, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // プロジェクトパスを取得（デバッグ用詳細ログを追加）
      let projectPath = '';

      // 1. まずメッセージからプロジェクトパスを取得
      if (message.projectPath) {
        projectPath = message.projectPath;
        Logger.info(`MessageDispatchServiceImpl: メッセージから取得したプロジェクトパス: ${projectPath}`);
      }
      // 2. メッセージにプロジェクトパスがない場合は、アクティブなプロジェクトパスを取得
      else if (this._projectService) {
        // アクティブなプロジェクトオブジェクトを取得
        const activeProject = this._projectService.getActiveProject();
        if (activeProject && activeProject.path) {
          projectPath = activeProject.path;
          Logger.info(`MessageDispatchServiceImpl: アクティブプロジェクト(${activeProject.name})から取得したパス: ${projectPath}`);
        } else {
          // フォールバック: getActiveProjectPathを使用
          projectPath = this._projectService.getActiveProjectPath();
          Logger.info(`MessageDispatchServiceImpl: getActiveProjectPathから取得したパス: ${projectPath}`);
        }
      }

      // プロジェクトパスが取得できなかった場合のフォールバック
      if (!projectPath && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        Logger.info(`MessageDispatchServiceImpl: ワークスペースフォルダから取得したパス: ${projectPath}`);
      }

      Logger.info(`MessageDispatchServiceImpl: マークダウンビューワーを開く (最終的に使用するprojectPath=${projectPath})`);

      // VSCodeコマンドを使用してマークダウンビューワーを開く
      await vscode.commands.executeCommand('appgenius-ai.openMarkdownViewer', projectPath);

      this.showSuccess(panel, 'マークダウンビューワーを開きました');
    } catch (error) {
      Logger.error('マークダウンビューワーを開く際にエラーが発生しました', error as Error);
      this.showError(panel, 'マークダウンビューワーを開けませんでした');
    }
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

    // マークダウンビューワーを開くハンドラーを登録
    this.registerHandler('openMarkdownViewer', this._handleOpenMarkdownViewer.bind(this));
    
    // Note: openFileInEditor ハンドラーは削除
    // クライアントが直接FileSystemServiceを使用するよう変更
    
    // navigateDirectory ハンドラー
    this.registerHandler('navigateDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.path || message.dirPath) {
        try {
          const dirPath = message.path || message.dirPath;
          // ファイルブラウザ機能が有効な場合は直接メソッドを使用、そうでなければasFunctionを使用して安全に呼び出す
          const files = 'listDirectory' in this._fileSystemService ?
            await this._fileSystemService.listDirectory(dirPath) :
            await (this._fileSystemService as any).listDirectory(dirPath);
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
        // ファイルブラウザ機能が有効な場合は直接メソッドを使用、そうでなければファイル拡張子を使用
        const fileType = message.fileType ||
          ('getFileType' in this._fileSystemService ?
            this._fileSystemService.getFileType(message.filePath) :
            path.extname(message.filePath).substring(1) || 'unknown');
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
    
    // openMarkdownInTab ハンドラー（マークダウンファイルを専用ビューアで開く）
    this.registerHandler('openMarkdownInTab', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        Logger.warn('MessageDispatchServiceImpl: openMarkdownInTabメッセージにfilePath必須パラメータがありません');
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }
      
      try {
        Logger.info(`MessageDispatchServiceImpl: マークダウンファイルを専用ビューで開きます: ${message.filePath}`);
        
        // マークダウンビューアを開く
        vscode.commands.executeCommand('appgenius.openMarkdownViewer', message.filePath);
        
        // 成功メッセージを表示（正しいファイル名を取得）
        const fileName = path.basename(message.filePath);
        this.showSuccess(panel, `マークダウンビューアでファイルを開きました: ${fileName}`);
        
        Logger.info(`MessageDispatchServiceImpl: マークダウンビューアでファイルを開きました: ${message.filePath}`);
        
        // ビューアが表示されない場合に詳細ログを出力
        Logger.debug(`MessageDispatchServiceImpl: マークダウンビューア実行ファイルパス詳細=${message.filePath}, 
          存在=${fs.existsSync(message.filePath) ? 'はい' : 'いいえ'},
          拡張子=${path.extname(message.filePath)},
          ファイル名=${path.basename(message.filePath)}`);

        // ファイルパスが.mdで終わらない場合は警告
        if (!message.filePath.toLowerCase().endsWith('.md')) {
          Logger.warn(`MessageDispatchServiceImpl: ファイルパスがマークダウン拡張子(.md)で終わっていません: ${message.filePath}`);
        }
      } catch (error) {
        Logger.error(`MessageDispatchServiceImpl: マークダウンビューア起動中にエラーが発生しました: ${message.filePath}`, error as Error);
        this.showError(panel, `マークダウンビューアの起動に失敗しました: ${(error as Error).message}`);
      }
    });
    
    // Note: 重複したopenFileAsTabハンドラーの定義は削除
    
    // getMarkdownContent ハンドラー - 要件定義ファイル読み込み問題に対処するため再実装
    this.registerHandler('getMarkdownContent', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        Logger.warn('MessageDispatchServiceImpl: getMarkdownContentメッセージにfilePath必須パラメータがありません');
        this.showError(panel, 'ファイルパスが指定されていません');
        return;
      }

      try {
        Logger.info(`MessageDispatchServiceImpl: マークダウンコンテンツを取得します: ${message.filePath}`);

        // FileSystemServiceを使用してファイルを読み込む
        const content = await this._fileSystemService.readMarkdownFile(message.filePath);

        // SCOPE_PROGRESS.mdかrequirements.mdかを判定
        const isScopeProgressFile = message.filePath.endsWith('SCOPE_PROGRESS.md');
        const isRequirementsFile = message.filePath.endsWith('requirements.md') || message.forRequirements === true;

        // Webviewにコンテンツを送信
        this.sendMessage(panel, {
          command: 'updateMarkdownContent',
          content: content,
          timestamp: Date.now(),
          priority: 'high',
          filePath: message.filePath,
          forScopeProgress: isScopeProgressFile || message.forScopeProgress === true,
          forRequirements: isRequirementsFile || message.forRequirements === true,
          forceRefresh: message.forceRefresh === true
        });

        Logger.info(`MessageDispatchServiceImpl: マークダウンコンテンツを送信しました: ${message.filePath} (scopeProgress=${isScopeProgressFile}, requirements=${isRequirementsFile})`);
      } catch (error) {
        Logger.error(`MessageDispatchServiceImpl: マークダウンコンテンツの取得に失敗しました: ${message.filePath}`, error as Error);
        this.showError(panel, `マークダウンファイルの読み込みに失敗しました: ${(error as Error).message}`);
      }
    });

    // 要件定義ファイルの変更を処理するハンドラー
    this.registerHandler('requirementsFileChanged', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.filePath) {
        Logger.warn('MessageDispatchServiceImpl: requirementsFileChangedメッセージにfilePath必須パラメータがありません');
        return;
      }

      try {
        Logger.info(`MessageDispatchServiceImpl: 要件定義ファイル変更を処理します: ${message.filePath}`);

        // 要件定義ファイルの内容を即時反映
        const content = await this._fileSystemService.readMarkdownFile(message.filePath);

        // 二重のメッセージ送信
        // 1. まず直接requirementsFileChangedメッセージを送信（コンテンツ付き）
        this.sendMessage(panel, {
          command: 'requirementsFileChanged',  // 同じcommandを返す（特殊処理）
          filePath: message.filePath,
          content: content,                    // コンテンツも含める
          timestamp: Date.now(),
          priority: 'high'
        });

        // 2. 通常の更新コマンドも送信（後方互換性のため）
        this.sendMessage(panel, {
          command: 'updateMarkdownContent',
          content: content,
          timestamp: Date.now() + 1,  // タイムスタンプを少しずらす（1ms）
          priority: 'high',
          filePath: message.filePath,
          forRequirements: true,
          forceRefresh: true
        });

        Logger.info(`MessageDispatchServiceImpl: 要件定義ファイル変更を2重通知で反映しました: ${message.filePath}`);
      } catch (error) {
        Logger.error(`MessageDispatchServiceImpl: 要件定義ファイル変更反映中にエラー: ${message.filePath}`, error as Error);
      }
    });
    
    // listDirectory ハンドラー - パス検証機能を強化
    this.registerHandler('listDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (!message.path) {
        Logger.warn('MessageDispatchServiceImpl: listDirectoryメッセージにpath必須パラメータがありません');
        this.showError(panel, 'ディレクトリパスが指定されていません');
        return;
      }

      try {
        // パスの正規化と検証
        let directoryPath = message.path;

        // .DS_Storeを含むパスをチェックして修正
        if (directoryPath.includes('.DS_Store')) {
          Logger.warn(`MessageDispatchServiceImpl: 不正なパス(.DS_Store)を検出: ${directoryPath}`);
          // 親ディレクトリのみを使用
          directoryPath = directoryPath.replace(/\/.DS_Store(\/.*)?$/, '');
          Logger.info(`MessageDispatchServiceImpl: パスを修正しました: ${directoryPath}`);
        }

        // ディレクトリの存在を確認
        if (!fs.existsSync(directoryPath)) {
          // 最新のプロジェクトパスを使用して回復を試みる
          try {
            // message.projectPathが存在すれば、それを優先的に使用
            // これにより、特定のコンテキストからのリクエストが優先される
            if (message.projectPath && typeof message.projectPath === 'string') {
              if (fs.existsSync(message.projectPath)) {
                // メッセージに含まれるプロジェクトパスを使用
                // プロジェクトのdocsディレクトリを試行
                const docsPath = path.join(message.projectPath, 'docs');
                if (fs.existsSync(docsPath)) {
                  directoryPath = docsPath;
                  Logger.info(`MessageDispatchServiceImpl: メッセージのプロジェクトパスからdocsディレクトリに回復: ${directoryPath}`);
                } else {
                  // docsディレクトリがなければ指定されたプロジェクトルートを使用
                  directoryPath = message.projectPath;
                  Logger.info(`MessageDispatchServiceImpl: メッセージのプロジェクトパスに回復: ${directoryPath}`);
                }

                // 正常に回復できたら続行
                if (fs.existsSync(directoryPath)) {
                  Logger.info(`MessageDispatchServiceImpl: 指定されたプロジェクトパスを使用: ${directoryPath}`);
                  // 回復した有効なパスがあれば、これ以上の処理は不要
                  // 直接リスト取得処理に進む
                  // breakは不適切なので、この条件で直接次の処理へ進む
                }
              }
            }

            // messageに有効なprojectPathがない場合は、ProjectServiceから取得
            const projectService = this._projectService;
            if (projectService) {
              // getActiveProjectPathではなく、直接ActiveProjectを取得
              // これにより最も確実に最新の選択プロジェクトを取得できる
              const activeProject = projectService.getActiveProject();

              if (activeProject && activeProject.path && fs.existsSync(activeProject.path)) {
                // アクティブプロジェクトのdocsディレクトリを試行
                const docsPath = path.join(activeProject.path, 'docs');
                if (fs.existsSync(docsPath)) {
                  directoryPath = docsPath;
                  Logger.info(`MessageDispatchServiceImpl: アクティブプロジェクト(${activeProject.name})のdocsディレクトリに回復: ${directoryPath}`);
                } else {
                  // docsディレクトリがなければアクティブプロジェクトルートを使用
                  directoryPath = activeProject.path;
                  Logger.info(`MessageDispatchServiceImpl: アクティブプロジェクト(${activeProject.name})のルートに回復: ${directoryPath}`);
                }
              } else {
                // ProjectServiceのgetActiveProjectPathをフォールバックとして使用
                const projectPath = projectService.getActiveProjectPath();
                if (projectPath && fs.existsSync(projectPath)) {
                  // プロジェクトのdocsディレクトリを試行
                  const docsPath = path.join(projectPath, 'docs');
                  if (fs.existsSync(docsPath)) {
                    directoryPath = docsPath;
                    Logger.info(`MessageDispatchServiceImpl: ProjectServiceからのパスでdocsディレクトリに回復: ${directoryPath}`);
                  } else {
                    // docsディレクトリがなければプロジェクトルートを使用
                    directoryPath = projectPath;
                    Logger.info(`MessageDispatchServiceImpl: ProjectServiceからのパスでプロジェクトルートに回復: ${directoryPath}`);
                  }
                }
              }
            }
          } catch (recoveryError) {
            Logger.warn('MessageDispatchServiceImpl: パス回復中にエラー', recoveryError as Error);
          }

          // 回復後も存在しない場合はエラー
          if (!fs.existsSync(directoryPath)) {
            Logger.warn(`MessageDispatchServiceImpl: ディレクトリが存在しません: ${directoryPath}`);
            this.showError(panel, `ディレクトリが存在しないか、アクセスできません: ${directoryPath}`);
            return;
          }
        }

        // 有効なディレクトリパスでリスト取得
        // ファイルブラウザ機能が有効な場合は直接メソッドを使用、そうでなければasFunctionを使用して安全に呼び出す
        const files = 'listDirectory' in this._fileSystemService ?
          await this._fileSystemService.listDirectory(directoryPath) :
          await (this._fileSystemService as any).listDirectory(directoryPath);

        // 結果を送信
        this.sendMessage(panel, {
          command: 'updateFileList',
          files: files,
          currentPath: directoryPath,
          originalPath: message.path !== directoryPath ? message.path : undefined,
          parentPath: path.dirname(directoryPath) !== directoryPath ? path.dirname(directoryPath) : null
        });

        Logger.info(`MessageDispatchServiceImpl: ディレクトリリスト更新: ${directoryPath}`);
      } catch (error) {
        Logger.error(`MessageDispatchServiceImpl: ディレクトリリスト取得中にエラー: ${message.path}`, error as Error);
        this.showError(panel, `ディレクトリの内容を取得できませんでした: ${(error as Error).message}`);
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
   * @deprecated 共有機能はScopeManagerPanelで直接処理されるようになりました
   */
  public registerSharingHandlers(): void {
    // 共有関連機能はすべてScopeManagerPanelで直接処理されるように変更されました
    Logger.info('MessageDispatchServiceImpl: 共有関連機能はScopeManagerPanelに移行されました');
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