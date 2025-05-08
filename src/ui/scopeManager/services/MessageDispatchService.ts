import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface Message {
  command: string;
  [key: string]: any;
}

export interface IMessageDispatchService {
  // 基本メッセージング機能
  sendMessage(panel: vscode.WebviewPanel, message: Message): void;
  registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void;
  handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void>;
  
  // 拡張機能: 標準メッセージ
  showError(panel: vscode.WebviewPanel, message: string): void;
  showSuccess(panel: vscode.WebviewPanel, message: string): void;
  
  // WebViewからのメッセージ処理設定
  setupMessageReceiver(panel: vscode.WebviewPanel): vscode.Disposable;
  
  // プロジェクト管理メッセージハンドラー
  selectProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, activeTab?: string): Promise<void>;
  createProject(panel: vscode.WebviewPanel, projectName: string, description: string): Promise<void>;
  removeProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, projectId?: string): Promise<void>;
  
  // イベント
  onMessageProcessed: vscode.Event<{command: string, success: boolean}>;
}

export class MessageDispatchService implements IMessageDispatchService {
  private handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>> = new Map();
  private _disposables: vscode.Disposable[] = [];
  
  // イベントエミッター
  private _onMessageProcessed = new vscode.EventEmitter<{command: string, success: boolean}>();
  public readonly onMessageProcessed = this._onMessageProcessed.event;
  
  // 依存サービスの参照（必要に応じて設定）
  private _sharingService?: any;
  private _projectService?: any;
  private _fileSystemService?: any;
  private _uiStateService?: any;
  
  private static _instance: MessageDispatchService;
  
  public static getInstance(): MessageDispatchService {
    if (!MessageDispatchService._instance) {
      MessageDispatchService._instance = new MessageDispatchService();
    }
    return MessageDispatchService._instance;
  }
  
  private constructor() {
    Logger.info('MessageDispatchService: 初期化完了');
  }
  
  /**
   * サービスの依存性を設定
   * @param services 依存サービス
   */
  public setDependencies(services: {
    sharingService?: any;
    projectService?: any;
    fileSystemService?: any;
    uiStateService?: any;
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
  }
  
  /**
   * WebViewパネルにメッセージを送信
   * @param panel VSCodeのWebViewパネル
   * @param message 送信するメッセージオブジェクト
   */
  public sendMessage(panel: vscode.WebviewPanel, message: Message): void {
    try {
      panel.webview.postMessage(message);
      Logger.debug(`MessageDispatchService: メッセージを送信しました: ${message.command}`);
    } catch (error) {
      Logger.error(`MessageDispatchService: メッセージ送信に失敗しました: ${(error as Error).message}`, error as Error);
    }
  }
  
  /**
   * メッセージハンドラを登録
   * @param command コマンド名
   * @param handler ハンドラ関数
   */
  public registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void {
    this.handlers.set(command, handler);
    Logger.debug(`MessageDispatchService: ハンドラを登録しました: ${command}`);
  }
  
  /**
   * 複数のメッセージハンドラを一括登録
   * @param handlers コマンド名とハンドラ関数のマップ
   */
  public registerHandlers(handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>>): void {
    handlers.forEach((handler, command) => {
      this.registerHandler(command, handler);
    });
    Logger.info(`MessageDispatchService: ${handlers.size}個のハンドラを一括登録しました`);
  }
  
  /**
   * WebViewからのメッセージを処理
   * @param message 受信したメッセージ
   * @param panel VSCodeのWebViewパネル
   */
  public async handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.debug(`MessageDispatchService: メッセージを受信しました: ${message.command}`);
      
      const handler = this.handlers.get(message.command);
      if (handler) {
        await handler(message, panel);
        this._onMessageProcessed.fire({ command: message.command, success: true });
      } else {
        Logger.warn(`MessageDispatchService: ハンドラが未登録のコマンドです: ${message.command}`);
        this._onMessageProcessed.fire({ command: message.command, success: false });
      }
    } catch (error) {
      Logger.error(`MessageDispatchService: メッセージ処理でエラーが発生しました: ${(error as Error).message}`, error as Error);
      
      // エラーメッセージをWebViewに返す
      this.showError(panel, `操作中にエラーが発生しました: ${(error as Error).message}`);
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
    
    Logger.info('MessageDispatchService: WebViewからのメッセージ受信処理を設定しました');
    return disposable;
  }
  
  /**
   * エラーメッセージを表示
   * @param panel VSCodeのWebViewパネル
   * @param message エラーメッセージ
   */
  public showError(panel: vscode.WebviewPanel, message: string): void {
    this.sendMessage(panel, {
      command: 'showError',
      message
    });
  }
  
  /**
   * 成功メッセージを表示
   * @param panel VSCodeのWebViewパネル
   * @param message 成功メッセージ
   */
  public showSuccess(panel: vscode.WebviewPanel, message: string): void {
    this.sendMessage(panel, {
      command: 'showSuccess',
      message
    });
  }
  
  /**
   * 共有履歴を取得して表示
   * @param panel WebViewパネル
   */
  public async getHistory(panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (!this._sharingService) {
        Logger.warn('MessageDispatchService: 共有履歴取得に失敗しました - SharingServiceが設定されていません');
        return;
      }
      
      const history = this._sharingService.getHistory();
      Logger.debug('MessageDispatchService: 共有履歴を取得しました', { count: history.length });
      
      this.sendMessage(panel, {
        command: 'updateSharingHistory',
        history: history || []
      });
    } catch (error) {
      Logger.error('MessageDispatchService: 履歴取得エラー', error as Error);
    }
  }
  
  /**
   * 履歴から項目を削除
   * @param panel WebViewパネル
   * @param fileId 削除するファイルID
   */
  public async deleteFromHistory(panel: vscode.WebviewPanel, fileId: string): Promise<void> {
    try {
      if (!this._sharingService) {
        Logger.warn('MessageDispatchService: 履歴削除に失敗しました - SharingServiceが設定されていません');
        return;
      }
      
      const success = this._sharingService.deleteFromHistory(fileId);
      
      if (success) {
        Logger.info(`MessageDispatchService: 共有履歴から項目を削除しました: ${fileId}`);
        // 履歴を更新して送信
        await this.getHistory(panel);
      } else {
        Logger.warn(`MessageDispatchService: 共有履歴からの項目削除に失敗しました: ${fileId}`);
      }
    } catch (error) {
      Logger.error(`MessageDispatchService: 履歴削除エラー: ${fileId}`, error as Error);
    }
  }
  
  /**
   * ファイルのコマンドをクリップボードにコピー
   * @param panel WebViewパネル
   * @param fileId コピーするファイルID
   */
  public async copyCommand(panel: vscode.WebviewPanel, fileId: string): Promise<void> {
    try {
      if (!this._sharingService) {
        Logger.warn('MessageDispatchService: コマンドコピーに失敗しました - SharingServiceが設定されていません');
        return;
      }
      
      // ファイルを履歴から検索
      const history = this._sharingService.getHistory();
      const file = history.find((item: any) => item.id === fileId);
      
      if (file) {
        // コマンドを生成
        const command = this._sharingService.generateCommand(file);
        
        // VSCodeのクリップボード機能を使用
        await vscode.env.clipboard.writeText(command);
        
        // アクセスカウントを増やす
        this._sharingService.recordAccess(fileId);
        
        // 成功メッセージを送信
        this.sendMessage(panel, {
          command: 'commandCopied',
          fileId: fileId,
          fileName: file.title || file.originalName || file.fileName
        });
        
        // VSCodeの通知も表示（オプション）
        vscode.window.showInformationMessage(`コマンド "${command}" をコピーしました！`);
        
        Logger.info(`MessageDispatchService: コマンドをコピーしました: ${fileId}, ファイル: ${file.fileName}`);
      } else {
        Logger.warn(`MessageDispatchService: コピー対象のファイルが見つかりません: ${fileId}`);
      }
    } catch (error) {
      Logger.error(`MessageDispatchService: コピーコマンド実行中にエラーが発生しました: ${fileId}`, error as Error);
      this.showError(panel, `コピーに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * テキストをクリップボードにコピー
   * @param panel WebViewパネル
   * @param text コピーするテキスト
   */
  public async copyToClipboard(panel: vscode.WebviewPanel, text: string): Promise<void> {
    try {
      // VSCodeのクリップボード機能を使用
      await vscode.env.clipboard.writeText(text);
      Logger.debug('MessageDispatchService: テキストをクリップボードにコピーしました');
    } catch (error) {
      Logger.error(`MessageDispatchService: クリップボードコピー中にエラーが発生しました`, error as Error);
    }
  }
  
  /**
   * 共有関連の標準メッセージハンドラーを登録
   */
  public registerSharingHandlers(): void {
    // getHistory ハンドラー
    this.registerHandler('getHistory', async (message: Message, panel: vscode.WebviewPanel) => {
      await this.getHistory(panel);
    });
    
    // deleteFromHistory ハンドラー
    this.registerHandler('deleteFromHistory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.fileId) {
        await this.deleteFromHistory(panel, message.fileId);
      }
    });
    
    // copyCommand ハンドラー
    this.registerHandler('copyCommand', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.fileId) {
        await this.copyCommand(panel, message.fileId);
      }
    });
    
    // copyToClipboard ハンドラー
    this.registerHandler('copyToClipboard', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.text) {
        await this.copyToClipboard(panel, message.text);
      }
    });
    
    Logger.info('MessageDispatchService: 共有関連のメッセージハンドラーを登録しました');
  }
  
  /**
   * プロジェクト選択
   * @param panel WebViewパネル
   * @param projectName プロジェクト名
   * @param projectPath プロジェクトパス
   * @param activeTab アクティブタブID（オプション）
   */
  public async selectProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, activeTab?: string): Promise<void> {
    try {
      Logger.info(`MessageDispatchService: プロジェクト選択処理: ${projectName}, パス: ${projectPath}`);
      
      if (!this._projectService) {
        throw new Error('ProjectServiceが設定されていません');
      }
      
      // ProjectServiceを使用してプロジェクトを選択
      await this._projectService.selectProject(projectName, projectPath, activeTab);
      
      // WebViewにプロジェクト状態同期メッセージを送信
      const activeProject = this._projectService.getActiveProject();
      if (activeProject) {
        this.sendMessage(panel, {
          command: 'syncProjectState',
          project: activeProject
        });
        Logger.info(`MessageDispatchService: プロジェクト状態同期メッセージを送信: ${activeProject.name}`);
      }
      
      // WebViewにプロジェクト一覧を更新
      const allProjects = this._projectService.getAllProjects();
      this.sendMessage(panel, {
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
      
      // 進捗ファイルの内容も読み込んで表示
      const progressFilePath = this._projectService.getProgressFilePath();
      if (progressFilePath && require('fs').existsSync(progressFilePath)) {
        // ファイルシステムサービスでマークダウンファイルを読み込む
        if (this._fileSystemService) {
          const content = await this._fileSystemService.readMarkdownFile(progressFilePath);
          this.sendMessage(panel, {
            command: 'updateMarkdownContent',
            content: content,
            timestamp: Date.now(),
            priority: 'high',
            forScopeProgress: true
          });
        }
      }
      
      // WebViewに成功メッセージを送信
      this.showSuccess(panel, `プロジェクト「${projectName}」を開きました`);
      
      // イベント発行
      this._onMessageProcessed.fire({
        command: 'selectProject',
        success: true
      });
    } catch (error) {
      Logger.error(`MessageDispatchService: プロジェクト選択エラー: ${(error as Error).message}`, error as Error);
      this.showError(panel, `プロジェクトを開けませんでした: ${(error as Error).message}`);
      
      this._onMessageProcessed.fire({
        command: 'selectProject',
        success: false
      });
    }
  }
  
  /**
   * 新規プロジェクト作成
   * @param panel WebViewパネル
   * @param projectName プロジェクト名
   * @param description プロジェクト説明
   */
  public async createProject(panel: vscode.WebviewPanel, projectName: string, description: string): Promise<void> {
    try {
      Logger.info(`MessageDispatchService: プロジェクト作成処理: ${projectName}`);
      
      if (!this._projectService) {
        throw new Error('ProjectServiceが設定されていません');
      }
      
      // ProjectServiceを使用してプロジェクトを作成
      const projectId = await this._projectService.createProject(projectName, description);
      
      // プロジェクトの最新情報を取得
      const activeProject = this._projectService.getActiveProject();
      const allProjects = this._projectService.getAllProjects();
      
      // WebViewにプロジェクト一覧を更新
      this.sendMessage(panel, {
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
      
      // プロジェクト名を更新
      this.sendMessage(panel, {
        command: 'updateProjectName',
        projectName: projectName
      });
      
      // 進捗ファイルの内容も読み込んで表示
      if (activeProject && activeProject.path) {
        const progressFilePath = this._projectService.getProgressFilePath();
        if (progressFilePath && require('fs').existsSync(progressFilePath) && this._fileSystemService) {
          const content = await this._fileSystemService.readMarkdownFile(progressFilePath);
          this.sendMessage(panel, {
            command: 'updateMarkdownContent',
            content: content,
            timestamp: Date.now(),
            priority: 'high',
            forScopeProgress: true
          });
        }
      }
      
      // 成功メッセージを表示
      this.showSuccess(panel, `プロジェクト「${projectName}」を作成しました`);
      
      // イベント発行
      this._onMessageProcessed.fire({
        command: 'createProject',
        success: true
      });
    } catch (error) {
      Logger.error(`MessageDispatchService: プロジェクト作成エラー: ${(error as Error).message}`, error as Error);
      this.showError(panel, `プロジェクトの作成に失敗しました: ${(error as Error).message}`);
      
      this._onMessageProcessed.fire({
        command: 'createProject',
        success: false
      });
    }
  }
  
  /**
   * プロジェクト削除（登録解除）
   * @param panel WebViewパネル
   * @param projectName プロジェクト名
   * @param projectPath プロジェクトパス
   * @param projectId プロジェクトID（オプション）
   */
  public async removeProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, projectId?: string): Promise<void> {
    try {
      Logger.info(`MessageDispatchService: プロジェクト削除処理: ${projectName}, パス: ${projectPath}, ID: ${projectId || 'なし'}`);
      
      if (!this._projectService) {
        throw new Error('ProjectServiceが設定されていません');
      }
      
      if (!projectName && !projectPath && !projectId) {
        throw new Error('プロジェクト情報が不足しています');
      }
      
      // ProjectServiceを使用してプロジェクトを登録解除
      const removed = await this._projectService.removeProject(projectName, projectPath, projectId);
      
      if (removed) {
        // プロジェクトの最新情報を取得
        const activeProject = this._projectService.getActiveProject();
        const allProjects = this._projectService.getAllProjects();
        
        // WebViewにプロジェクト一覧と現在のプロジェクトを送信
        this.sendMessage(panel, {
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        this.showSuccess(panel, `プロジェクト「${projectName}」の登録を解除しました`);
        
        // イベント発行
        this._onMessageProcessed.fire({
          command: 'removeProject',
          success: true
        });
      } else {
        this.showError(panel, `プロジェクト「${projectName}」の登録解除に失敗しました`);
        
        this._onMessageProcessed.fire({
          command: 'removeProject',
          success: false
        });
      }
    } catch (error) {
      Logger.error(`MessageDispatchService: プロジェクト削除エラー: ${(error as Error).message}`, error as Error);
      this.showError(panel, `プロジェクト登録解除に失敗しました: ${(error as Error).message}`);
      
      this._onMessageProcessed.fire({
        command: 'removeProject',
        success: false
      });
    }
  }
  
  /**
   * プロジェクト関連のメッセージハンドラーを登録
   */
  public registerProjectHandlers(): void {
    // selectProject ハンドラー
    this.registerHandler('selectProject', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectName && message.projectPath) {
        await this.selectProject(panel, message.projectName, message.projectPath, message.activeTab);
      } else {
        Logger.warn('MessageDispatchService: selectProjectメッセージに必要なパラメータがありません');
      }
    });
    
    // createProject ハンドラー
    this.registerHandler('createProject', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectName) {
        await this.createProject(panel, message.projectName, message.description || '');
      } else {
        Logger.warn('MessageDispatchService: createProjectメッセージに必要なパラメータがありません');
      }
    });
    
    // removeProject ハンドラー
    this.registerHandler('removeProject', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectName && message.projectPath) {
        await this.removeProject(panel, message.projectName, message.projectPath, message.projectId);
      } else {
        Logger.warn('MessageDispatchService: removeProjectメッセージに必要なパラメータがありません');
      }
    });
    
    Logger.info('MessageDispatchService: プロジェクト関連のメッセージハンドラーを登録しました');
  }
  
  /**
   * ファイル操作関連のメッセージハンドラーを登録
   */
  public registerFileHandlers(): void {
    if (!this._fileSystemService) {
      Logger.error('MessageDispatchService: FileSystemServiceが設定されていないため、ファイル操作ハンドラーは登録できません');
      return;
    }
    
    // openFileInEditor ハンドラー
    this.registerHandler('openFileInEditor', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.filePath) {
        try {
          await this._fileSystemService.openFileInEditor(message.filePath);
          // 成功メッセージ
          if (this._uiStateService) {
            this._uiStateService.showSuccess(`ファイルをエディタで開きました: ${path.basename(message.filePath)}`);
          }
        } catch (error) {
          // エラーメッセージ
          if (this._uiStateService) {
            this._uiStateService.showError(`ファイルを開けませんでした: ${(error as Error).message}`);
          }
        }
      } else {
        Logger.warn('MessageDispatchService: openFileInEditorメッセージにfilePath必須パラメータがありません');
      }
    });
    
    // navigateDirectory ハンドラー
    this.registerHandler('navigateDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.dirPath) {
        try {
          await this._fileSystemService.navigateDirectory(message.dirPath, panel);
        } catch (error) {
          // エラーメッセージ
          if (this._uiStateService) {
            this._uiStateService.showError(`ディレクトリの移動に失敗しました: ${(error as Error).message}`);
          }
        }
      } else {
        Logger.warn('MessageDispatchService: navigateDirectoryメッセージにdirPath必須パラメータがありません');
      }
    });
    
    // openFile ハンドラー
    this.registerHandler('openFile', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.filePath) {
        try {
          await this._fileSystemService.openFile(message.filePath, panel);
        } catch (error) {
          // エラーメッセージ
          if (this._uiStateService) {
            this._uiStateService.showError(`ファイルを開けませんでした: ${(error as Error).message}`);
          }
        }
      } else {
        Logger.warn('MessageDispatchService: openFileメッセージにfilePath必須パラメータがありません');
      }
    });
    
    // refreshFileBrowser ハンドラー
    this.registerHandler('refreshFileBrowser', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectPath) {
        try {
          await this._fileSystemService.refreshFileBrowser(message.projectPath, panel);
        } catch (error) {
          // エラーメッセージ
          if (this._uiStateService) {
            this._uiStateService.showError(`ファイルブラウザの更新に失敗しました: ${(error as Error).message}`);
          }
        }
      } else {
        // プロジェクトパスが指定されていない場合はエラー
        Logger.warn('MessageDispatchService: refreshFileBrowserメッセージにprojectPath必須パラメータがありません');
      }
    });
    
    // listDirectory ハンドラー
    this.registerHandler('listDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      const dirPath = message.path || (message.projectPath ? path.join(message.projectPath, 'docs') : '');
      if (dirPath) {
        try {
          // ディレクトリが存在するか確認
          if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            if (this._uiStateService) {
              this._uiStateService.showError(`ディレクトリが見つかりません: ${dirPath}`);
            }
            return;
          }
          
          // ディレクトリの内容をリストアップ
          const files = await this._fileSystemService.listDirectory(dirPath);
          
          // ファイルリストを送信
          panel.webview.postMessage({
            command: 'updateFileList',
            files: files,
            currentPath: dirPath,
            parentPath: path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null
          });
        } catch (error) {
          if (this._uiStateService) {
            this._uiStateService.showError(`ディレクトリの内容を表示できませんでした: ${(error as Error).message}`);
          }
        }
      } else {
        Logger.warn('MessageDispatchService: listDirectoryメッセージにdirPathが指定されていません');
      }
    });
    
    Logger.info('MessageDispatchService: ファイル操作関連のメッセージハンドラーを登録しました');
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
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
    
    Logger.info('MessageDispatchService: リソースを解放しました');
  }
}