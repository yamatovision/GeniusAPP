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
import { EventBus } from '../../../../services/EventBus';

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
  private _eventBus: EventBus;
  
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
    this._eventBus = EventBus.getInstance();
    
    // イベントリスナーの設定
    this._setupEventListeners();
    
    Logger.info('MessageDispatchServiceImpl: 初期化完了');
  }
  
  /**
   * イベントバスリスナーを設定
   * @private
   */
  private _setupEventListeners(): void {
    // イベントリスナーを登録
    this._eventBus.on('message-sent', (data: { command: string, success: boolean }) => {
      // イベントバス経由で他のサービスから送信されたメッセージを中継
      this._onMessageProcessed.fire(data);
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
      Logger.debug('MessageDispatchServiceImpl: SharingServiceが設定されました');
    }
    
    if (services.projectService) {
      this._projectService = services.projectService;
      Logger.debug('MessageDispatchServiceImpl: ProjectServiceが設定されました');
    }
    
    if (services.fileSystemService) {
      this._fileSystemService = services.fileSystemService;
      Logger.debug('MessageDispatchServiceImpl: FileSystemServiceが設定されました');
    }
    
    if (services.uiStateService) {
      this._uiStateService = services.uiStateService;
      Logger.debug('MessageDispatchServiceImpl: UIStateServiceが設定されました');
    }
    
    if (services.panelService) {
      this._panelService = services.panelService;
      Logger.debug('MessageDispatchServiceImpl: PanelServiceが設定されました');
    }
    
    Logger.info('MessageDispatchServiceImpl: 依存サービスを設定しました');
  }
  
  /**
   * WebViewパネルにメッセージを送信
   * @param panel WebViewパネル
   * @param message 送信するメッセージ
   */
  public sendMessage(panel: vscode.WebviewPanel, message: Message): void {
    try {
      panel.webview.postMessage(message);
      
      // メッセージ送信のログ記録
      if (message.command === 'updateMarkdownContent' || message.command === 'updateDirectoryStructure') {
        // 大きいコンテンツはログに出力しない
        Logger.debug(`MessageDispatchServiceImpl: 大きいコンテンツのメッセージを送信: ${message.command}`);
      } else {
        Logger.debug(`MessageDispatchServiceImpl: メッセージを送信: ${message.command}, データ: ${JSON.stringify(message, (key, value) => 
          key === 'content' || key === 'structure' || key === 'projects' || key === 'history' ? '[省略]' : value)}`);
      }
      
      // イベントバスに送信イベントを発行
      this._eventBus.emit('message-sent', {
        command: message.command,
        success: true
      });
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: メッセージ「${message.command}」の送信に失敗`, error as Error);
      
      // エラーイベントを発行
      this._eventBus.emit('message-sent', {
        command: message.command,
        success: false
      });
      
      // メッセージの重要度に応じてリトライするかどうかを判断
      const isImportantMessage = 
        message.priority === 'high' || 
        ['showError', 'syncFullProjectState', 'updateMarkdownContent'].includes(message.command);
      
      if (isImportantMessage) {
        try {
          setTimeout(() => {
            Logger.info(`MessageDispatchServiceImpl: 重要なメッセージ「${message.command}」を再送信`);
            panel.webview.postMessage(message);
          }, 100);
        } catch (retryError) {
          Logger.error(`MessageDispatchServiceImpl: メッセージ「${message.command}」の再送信にも失敗`, retryError as Error);
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
      Logger.debug(`MessageDispatchServiceImpl: メッセージを受信: ${message.command}, データ: ${JSON.stringify(message, (key, value) => 
        key === 'content' || key === 'structure' ? '[省略]' : value)}`);
      
      const handler = this.handlers.get(message.command);
      if (handler) {
        // 対応するハンドラが登録されている場合
        await handler(message, panel);
        
        // 処理成功イベントを発行
        this._onMessageProcessed.fire({ command: message.command, success: true });
        
        // イベントバス経由でも成功を通知
        this._eventBus.emit('message-processed', {
          command: message.command,
          success: true,
          data: message
        });
      } else {
        // ハンドラーが見つからない場合
        Logger.warn(`MessageDispatchServiceImpl: ハンドラが未登録のコマンドです: ${message.command}`);
        
        // 処理失敗イベントを発行
        this._onMessageProcessed.fire({ command: message.command, success: false });
        
        // イベントバス経由でも失敗を通知
        this._eventBus.emit('message-processed', {
          command: message.command, 
          success: false,
          error: 'ハンドラが未登録のコマンドです'
        });
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: メッセージ処理中にエラーが発生: ${message.command}`, error as Error);
      
      // エラーメッセージをWebViewに返す
      this.showError(panel, `操作中にエラーが発生しました: ${(error as Error).message}`);
      
      // 処理失敗イベントを発行
      this._onMessageProcessed.fire({ command: message.command, success: false });
      
      // イベントバス経由でもエラーを通知
      this._eventBus.emit('message-processed', {
        command: message.command, 
        success: false,
        error: (error as Error).message
      });
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
        
        // PanelServiceが設定されている場合はそれを使用
        if (this._panelService && typeof this._panelService.initializePanel === 'function') {
          const projectPath = message.projectPath || this._projectService.getActiveProjectPath();
          await this._panelService.initializePanel(projectPath);
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
          
          // 進捗ファイルをロード
          if (activeProject && activeProject.path && this._fileSystemService) {
            const progressFilePath = path.join(activeProject.path, 'docs', 'SCOPE_PROGRESS.md');
            if (fs.existsSync(progressFilePath)) {
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
          
          // 共有履歴を初期化
          if (this._sharingService) {
            await this.getHistory(panel);
          }
        }
      } catch (error) {
        Logger.error('MessageDispatchServiceImpl: 初期化処理でエラー', error as Error);
        this.showError(panel, `初期化に失敗しました: ${(error as Error).message}`);
      }
    });
    
    // selectProject ハンドラー
    this.registerHandler('selectProject', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectName && message.projectPath) {
        await this.selectProject(panel, message.projectName, message.projectPath, message.activeTab);
      } else {
        Logger.warn('MessageDispatchServiceImpl: selectProjectメッセージに必要なパラメータがありません');
        this.showError(panel, 'プロジェクト選択に必要な情報が不足しています');
      }
    });
    
    // createProject ハンドラー
    this.registerHandler('createProject', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectName) {
        await this.createProject(panel, message.projectName, message.description || '');
      } else {
        Logger.warn('MessageDispatchServiceImpl: createProjectメッセージに必要なパラメータがありません');
        this.showError(panel, 'プロジェクト作成に必要な情報が不足しています');
      }
    });
    
    // removeProject ハンドラー
    this.registerHandler('removeProject', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.projectName && message.projectPath) {
        await this.removeProject(panel, message.projectName, message.projectPath, message.projectId);
      } else {
        Logger.warn('MessageDispatchServiceImpl: removeProjectメッセージに必要なパラメータがありません');
        this.showError(panel, 'プロジェクト削除に必要な情報が不足しています');
      }
    });
    
    // getProjectList ハンドラー
    this.registerHandler('getProjectList', async (_: Message, panel: vscode.WebviewPanel) => {
      try {
        const allProjects = await this._projectService.getAllProjects();
        const activeProject = this._projectService.getActiveProject();
        
        this.sendMessage(panel, {
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
      } catch (error) {
        Logger.error('MessageDispatchServiceImpl: プロジェクト一覧取得でエラー', error as Error);
        this.showError(panel, `プロジェクト一覧の取得に失敗しました: ${(error as Error).message}`);
      }
    });
    
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
    
    // openFileInEditor ハンドラー
    this.registerHandler('openFileInEditor', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.filePath) {
        try {
          await this._fileSystemService.openFileInEditor(message.filePath);
          this.showSuccess(panel, `ファイルをエディタで開きました: ${path.basename(message.filePath)}`);
        } catch (error) {
          this.showError(panel, `ファイルを開けませんでした: ${(error as Error).message}`);
        }
      } else {
        Logger.warn('MessageDispatchServiceImpl: openFileInEditorメッセージにfilePath必須パラメータがありません');
        this.showError(panel, 'ファイルパスが指定されていません');
      }
    });
    
    // navigateDirectory ハンドラー
    this.registerHandler('navigateDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.dirPath) {
        try {
          const files = await this._fileSystemService.listDirectory(message.dirPath);
          this.sendMessage(panel, {
            command: 'updateFileList',
            files: files,
            currentPath: message.dirPath,
            parentPath: path.dirname(message.dirPath) !== message.dirPath ? path.dirname(message.dirPath) : null
          });
        } catch (error) {
          this.showError(panel, `ディレクトリの移動に失敗しました: ${(error as Error).message}`);
        }
      } else {
        Logger.warn('MessageDispatchServiceImpl: navigateDirectoryメッセージにdirPath必須パラメータがありません');
        this.showError(panel, 'ディレクトリパスが指定されていません');
      }
    });
    
    // openFile ハンドラー
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
    
    // refreshFileBrowser ハンドラー
    this.registerHandler('refreshFileBrowser', async (message: Message, panel: vscode.WebviewPanel) => {
      try {
        const projectPath = message.projectPath || (this._projectService ? this._projectService.getActiveProjectPath() : undefined);
        
        if (!projectPath) {
          this.showError(panel, 'アクティブなプロジェクトがありません');
          return;
        }
        
        const structure = await this._fileSystemService.getDirectoryStructure(projectPath);
        this.sendMessage(panel, {
          command: 'updateDirectoryStructure',
          structure: structure
        });
      } catch (error) {
        this.showError(panel, `ディレクトリ構造の更新に失敗しました: ${(error as Error).message}`);
      }
    });
    
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
    
    // getHistory ハンドラー
    this.registerHandler('getHistory', async (message: Message, panel: vscode.WebviewPanel) => {
      await this.getHistory(panel);
    });
    
    // deleteFromHistory ハンドラー
    this.registerHandler('deleteFromHistory', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.fileId) {
        await this.deleteFromHistory(panel, message.fileId);
      } else {
        Logger.warn('MessageDispatchServiceImpl: deleteFromHistoryメッセージにfileId必須パラメータがありません');
        this.showError(panel, 'ファイルIDが指定されていません');
      }
    });
    
    // copyCommand ハンドラー
    this.registerHandler('copyCommand', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.fileId) {
        await this.copyCommand(panel, message.fileId);
      } else {
        Logger.warn('MessageDispatchServiceImpl: copyCommandメッセージにfileId必須パラメータがありません');
        this.showError(panel, 'ファイルIDが指定されていません');
      }
    });
    
    // copyToClipboard ハンドラー
    this.registerHandler('copyToClipboard', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.text) {
        await this.copyToClipboard(panel, message.text);
      } else {
        Logger.warn('MessageDispatchServiceImpl: copyToClipboardメッセージにtext必須パラメータがありません');
        this.showError(panel, 'コピーするテキストが指定されていません');
      }
    });
    
    // shareClipboard ハンドラー
    this.registerHandler('shareClipboard', async (message: Message, panel: vscode.WebviewPanel) => {
      try {
        if (!message.content) {
          this.showError(panel, '共有するコンテンツが指定されていません');
          return;
        }
        
        await this._sharingService.shareContent(message.content, message.title);
        await this.getHistory(panel);
        this.showSuccess(panel, '内容をClaudeCodeで共有できるようになりました');
      } catch (error) {
        this.showError(panel, `共有に失敗しました: ${(error as Error).message}`);
      }
    });
    
    Logger.info('MessageDispatchServiceImpl: 共有関連のメッセージハンドラーを登録しました');
  }
  
  /**
   * 共有履歴を取得
   * @param panel WebViewパネル
   * @returns 処理が成功したかどうか
   */
  public async getHistory(panel: vscode.WebviewPanel): Promise<boolean> {
    try {
      if (!this._sharingService) {
        Logger.warn('MessageDispatchServiceImpl: 共有履歴取得に失敗 - SharingServiceが設定されていません');
        this.showError(panel, '共有サービスが利用できないため、履歴を取得できません');
        return false;
      }
      
      const history = await this._sharingService.getHistory();
      
      this.sendMessage(panel, {
        command: 'updateSharingHistory',
        history: history || []
      });
      
      return true;
    } catch (error) {
      Logger.error('MessageDispatchServiceImpl: 共有履歴取得でエラー', error as Error);
      this.showError(panel, `共有履歴の取得に失敗しました: ${(error as Error).message}`);
      return false;
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
        Logger.warn('MessageDispatchServiceImpl: 履歴削除に失敗 - SharingServiceが設定されていません');
        this.showError(panel, '共有サービスが利用できないため、履歴から削除できません');
        return;
      }
      
      const success = await this._sharingService.deleteFromHistory(fileId);
      
      if (success) {
        Logger.info(`MessageDispatchServiceImpl: 共有履歴から項目を削除: ${fileId}`);
        // 履歴を更新して送信
        await this.getHistory(panel);
        this.showSuccess(panel, '履歴から項目を削除しました');
      } else {
        Logger.warn(`MessageDispatchServiceImpl: 共有履歴からの項目削除に失敗: ${fileId}`);
        this.showError(panel, '履歴からの削除に失敗しました');
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: 履歴削除でエラー: ${fileId}`, error as Error);
      this.showError(panel, `履歴からの削除中にエラーが発生しました: ${(error as Error).message}`);
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
        Logger.warn('MessageDispatchServiceImpl: コマンドコピーに失敗 - SharingServiceが設定されていません');
        this.showError(panel, '共有サービスが利用できないため、コマンドをコピーできません');
        return;
      }
      
      // ファイルを履歴から検索
      const history = await this._sharingService.getHistory();
      const file = history.find((item: any) => item.id === fileId);
      
      if (file) {
        // コマンドを生成
        const command = await this._sharingService.generateCommand(file);
        
        // VSCodeのクリップボード機能を使用
        await vscode.env.clipboard.writeText(command);
        
        // アクセスカウントを増やす
        await this._sharingService.recordAccess(fileId);
        
        // 成功メッセージを表示
        this.showSuccess(panel, `コマンドをクリップボードにコピーしました`);
        
        // WebViewに通知
        this.sendMessage(panel, {
          command: 'commandCopied',
          fileId: fileId,
          fileName: file.title || file.originalName || file.fileName
        });
      } else {
        Logger.warn(`MessageDispatchServiceImpl: コピー対象のファイルが見つかりません: ${fileId}`);
        this.showError(panel, '指定されたファイルが見つかりません');
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: コピーコマンド実行でエラー: ${fileId}`, error as Error);
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
      
      // 成功メッセージを表示
      this.showSuccess(panel, 'テキストをクリップボードにコピーしました');
    } catch (error) {
      Logger.error('MessageDispatchServiceImpl: クリップボードコピーでエラー', error as Error);
      this.showError(panel, `クリップボードへのコピーに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクト選択
   * @param panel WebViewパネル
   * @param projectName プロジェクト名
   * @param projectPath プロジェクトパス
   * @param activeTab アクティブタブID（オプション）
   * @returns 処理結果
   */
  public async selectProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, activeTab?: string): Promise<boolean> {
    try {
      Logger.info(`MessageDispatchServiceImpl: プロジェクト選択処理: ${projectName}, パス: ${projectPath}`);
      
      // 必須サービスが設定されているか確認
      if (!this._projectService) {
        this.showError(panel, 'プロジェクトサービスが利用できないため、プロジェクトを選択できません');
        return false;
      }
      
      // パネルサービスが利用可能か確認
      if (this._panelService && typeof this._panelService.syncActiveProject === 'function') {
        // プロジェクト選択処理
        await this._projectService.selectProject(projectName, projectPath, activeTab);
        
        // プロジェクト情報を取得
        const project = this._projectService.getActiveProject();
        
        // パネルサービスを使用してプロジェクト状態を一括同期
        if (project) {
          await this._panelService.syncActiveProject(project);
          return true;
        } else {
          this.showError(panel, 'プロジェクト情報を取得できませんでした');
          return false;
        }
      } else {
        // 従来の実装（PanelServiceが利用できない場合）
        Logger.warn('MessageDispatchServiceImpl: PanelServiceが利用できないため従来の実装でプロジェクト選択');
        
        // プロジェクトを選択
        await this._projectService.selectProject(projectName, projectPath, activeTab);
        
        // WebViewにプロジェクト状態同期メッセージを送信
        const activeProject = this._projectService.getActiveProject();
        if (activeProject) {
          this.sendMessage(panel, {
            command: 'syncProjectState',
            project: activeProject
          });
        }
        
        // WebViewにプロジェクト一覧を更新
        const allProjects = await this._projectService.getAllProjects();
        this.sendMessage(panel, {
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // 進捗ファイルの内容も読み込んで表示
        try {
          if (this._fileSystemService) {
            const progressFilePath = path.join(projectPath, 'docs', 'SCOPE_PROGRESS.md');
            if (fs.existsSync(progressFilePath)) {
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
        } catch (innerError) {
          Logger.warn('MessageDispatchServiceImpl: 進捗ファイル読み込みエラー', innerError as Error);
        }
        
        // 成功メッセージを表示
        this.showSuccess(panel, `プロジェクト「${projectName}」を開きました`);
        return true;
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: プロジェクト選択でエラー: ${projectName}`, error as Error);
      this.showError(panel, `プロジェクト「${projectName}」の選択に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * 新規プロジェクト作成
   * @param panel WebViewパネル
   * @param projectName プロジェクト名
   * @param description プロジェクト説明
   * @returns 処理結果
   */
  public async createProject(panel: vscode.WebviewPanel, projectName: string, description: string): Promise<boolean> {
    try {
      Logger.info(`MessageDispatchServiceImpl: プロジェクト作成処理: ${projectName}`);
      
      // 入力検証
      if (!projectName || projectName.trim() === '') {
        this.showError(panel, 'プロジェクト名を入力してください');
        return false;
      }
      
      // 必須サービスが設定されているか確認
      if (!this._projectService) {
        this.showError(panel, 'プロジェクトサービスが利用できないため、プロジェクトを作成できません');
        return false;
      }
      
      // プロジェクト作成
      const projectId = await this._projectService.createProject(projectName, description);
      
      // プロジェクト情報取得
      const project = this._projectService.getActiveProject();
      
      // パネルサービスが利用可能か確認
      if (this._panelService && typeof this._panelService.syncActiveProject === 'function' && project) {
        // パネルサービスを使用してプロジェクト状態を一括同期
        await this._panelService.syncActiveProject(project);
        return true;
      } else {
        // 従来の実装（PanelServiceが利用できない場合）
        Logger.warn('MessageDispatchServiceImpl: PanelServiceが利用できないため従来の実装でプロジェクト作成後処理');
        
        // プロジェクトの最新情報を取得
        const activeProject = this._projectService.getActiveProject();
        const allProjects = await this._projectService.getAllProjects();
        
        // WebViewにプロジェクト一覧を更新
        this.sendMessage(panel, {
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // 成功メッセージを表示
        this.showSuccess(panel, `プロジェクト「${projectName}」を作成しました`);
        return true;
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: プロジェクト作成でエラー: ${projectName}`, error as Error);
      this.showError(panel, `プロジェクト「${projectName}」の作成に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * プロジェクト削除（登録解除）
   * @param panel WebViewパネル
   * @param projectName プロジェクト名
   * @param projectPath プロジェクトパス
   * @param projectId プロジェクトID（オプション）
   * @returns 処理結果
   */
  public async removeProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, projectId?: string): Promise<boolean> {
    try {
      Logger.info(`MessageDispatchServiceImpl: プロジェクト削除処理: ${projectName}, パス: ${projectPath}`);
      
      // 必須サービスが設定されているか確認
      if (!this._projectService) {
        this.showError(panel, 'プロジェクトサービスが利用できないため、プロジェクトを削除できません');
        return false;
      }
      
      // プロジェクト削除
      const removed = await this._projectService.removeProject(projectName, projectPath, projectId);
      
      if (removed) {
        // 最新のプロジェクト情報を取得
        const activeProject = this._projectService.getActiveProject();
        const allProjects = await this._projectService.getAllProjects();
        
        // WebViewにプロジェクト一覧を更新
        this.sendMessage(panel, {
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject
        });
        
        // 成功メッセージを表示
        this.showSuccess(panel, `プロジェクト「${projectName}」の登録を解除しました`);
        return true;
      } else {
        this.showError(panel, `プロジェクト「${projectName}」の登録解除に失敗しました`);
        return false;
      }
    } catch (error) {
      Logger.error(`MessageDispatchServiceImpl: プロジェクト削除でエラー: ${projectName}`, error as Error);
      this.showError(panel, `プロジェクト「${projectName}」の登録解除に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
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