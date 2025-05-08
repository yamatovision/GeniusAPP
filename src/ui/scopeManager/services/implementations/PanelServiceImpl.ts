import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';
import { IPanelService } from '../interfaces/IPanelService';
import { IProjectService } from '../interfaces/IProjectService';
import { IFileSystemService } from '../interfaces/IFileSystemService';
import { ITabStateService } from '../interfaces/ITabStateService';
import { ISharingService } from '../interfaces/ISharingService';
import { Message } from '../interfaces/common';
import { MessageDispatchService } from '../MessageDispatchService';
import { EventBus } from '../../../../services/EventBus';

/**
 * WebViewパネル管理サービスの実装
 * UIの表示やWebViewとの通信を一元的に管理
 */
export class PanelServiceImpl implements IPanelService {
  private static readonly viewType = 'scopeManager';
  private _panel: vscode.WebviewPanel | undefined;
  private _extensionUri: vscode.Uri;
  private _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _title = 'AppGenius スコープマネージャー';
  
  // イベントエミッター
  private _onMessageReceived = new vscode.EventEmitter<Message>();
  private _onPanelDisposed = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onMessageReceived = this._onMessageReceived.event;
  public readonly onPanelDisposed = this._onPanelDisposed.event;
  
  // 依存サービス
  private _projectService?: IProjectService;
  private _fileSystemService?: IFileSystemService;
  private _tabStateService?: ITabStateService;
  private _sharingService?: ISharingService;
  private _messageService?: MessageDispatchService;
  
  // イベントバス
  private _eventBus: EventBus;
  
  // シングルトンインスタンス
  private static _instance: PanelServiceImpl;
  
  /**
   * シングルトンインスタンスを取得または作成
   * @param extensionUri 拡張機能URI
   * @param context 拡張機能コンテキスト
   * @returns PanelServiceImplインスタンス
   */
  public static getInstance(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ): PanelServiceImpl {
    if (!PanelServiceImpl._instance) {
      PanelServiceImpl._instance = new PanelServiceImpl(extensionUri, context);
    }
    return PanelServiceImpl._instance;
  }
  
  /**
   * コンストラクタ
   * @param extensionUri 拡張機能URI
   * @param context 拡張機能コンテキスト
   */
  private constructor(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this._extensionUri = extensionUri;
    this._context = context;
    this._eventBus = EventBus.getInstance();
    
    // イベントリスナーの設定
    this._setupEventBusListeners();
    
    Logger.info('PanelServiceImpl: 初期化完了');
  }
  
  /**
   * イベントバスリスナーを設定
   * @private
   */
  private _setupEventBusListeners(): void {
    // タブ状態変更イベントを購読
    this._eventBus.on('tab-changed', (data: { tabId: string }) => {
      if (this._panel && data.tabId) {
        this.sendMessage({
          command: 'selectTab',
          tabId: data.tabId
        });
        Logger.debug(`PanelServiceImpl: タブ変更イベントを処理: ${data.tabId}`);
      }
    });
    
    // タブ内容更新イベントを購読
    this._eventBus.on('tab-content-updated', (data: { tabId: string, content: string }) => {
      if (this._panel && data.tabId && data.content) {
        this.sendMessage({
          command: 'updateTabContent',
          tabId: data.tabId,
          content: data.content
        });
        Logger.debug(`PanelServiceImpl: タブ内容更新イベントを処理: ${data.tabId}`);
      }
    });
    
    // ディレクトリ構造更新イベントを購読
    this._eventBus.on('directory-structure-updated', (structure: any) => {
      if (this._panel && structure) {
        this.sendMessage({
          command: 'updateDirectoryStructure',
          structure: structure
        });
        Logger.debug('PanelServiceImpl: ディレクトリ構造更新イベントを処理');
      }
    });
    
    Logger.info('PanelServiceImpl: イベントバスリスナーを設定しました');
  }
  
  /**
   * 現在のパネルインスタンスを取得
   * @returns WebViewパネルインスタンス（存在しない場合はundefined）
   */
  public getPanel(): vscode.WebviewPanel | undefined {
    return this._panel;
  }
  
  /**
   * メッセージをパネルに送信
   * @param message 送信するメッセージ
   */
  public sendMessage(message: Message): void {
    if (!this._panel) {
      Logger.warn(`PanelServiceImpl: パネルが存在しないためメッセージを送信できません: ${message.command}`);
      return;
    }
    
    try {
      this._panel.webview.postMessage(message);
      Logger.debug(`PanelServiceImpl: メッセージを送信: ${message.command}`);
    } catch (error) {
      // メッセージ送信に失敗した場合
      Logger.error(`PanelServiceImpl: メッセージ送信に失敗しました: ${message.command}`, error as Error);
      
      // 重要なメッセージは1回だけリトライする
      const isImportantMessage = 
        message.priority === 'high' || 
        ['showError', 'syncFullProjectState', 'updateMarkdownContent'].includes(message.command);
      
      if (isImportantMessage) {
        try {
          setTimeout(() => {
            if (this._panel) {
              this._panel.webview.postMessage(message);
              Logger.debug(`PanelServiceImpl: リトライでメッセージを送信: ${message.command}`);
            }
          }, 100);
        } catch (retryError) {
          Logger.error(`PanelServiceImpl: リトライでもメッセージ送信に失敗: ${message.command}`, retryError as Error);
        }
      }
    }
  }
  
  /**
   * WebViewにマークダウン内容を更新するメッセージを送信
   * @param content マークダウンコンテンツ
   */
  public updateMarkdownContent(content: string): void {
    this.sendMessage({
      command: 'updateMarkdownContent',
      content: content,
      timestamp: Date.now(),
      priority: 'high',
      forScopeProgress: true
    });
  }
  
  /**
   * 成功メッセージを表示
   * @param message 表示するメッセージ
   */
  public showSuccess(message: string): void {
    this.sendMessage({
      command: 'showSuccess',
      message: message,
      priority: 'high'
    });
  }
  
  /**
   * エラーメッセージを表示
   * @param message 表示するメッセージ
   */
  public showError(message: string): void {
    this.sendMessage({
      command: 'showError',
      message: message,
      priority: 'high'
    });
  }
  
  /**
   * 共有履歴を更新
   * @param history 共有履歴の配列
   */
  public updateSharingHistory(history: any[]): void {
    this.sendMessage({
      command: 'updateSharingHistory',
      history: history
    });
  }
  
  /**
   * パネルの初期化処理
   * @param projectPath プロジェクトパス（オプション）
   */
  public async initializePanel(projectPath?: string): Promise<void> {
    try {
      if (!this._panel) {
        Logger.warn('PanelServiceImpl: 初期化するパネルが存在しません');
        return;
      }
      
      Logger.info('PanelServiceImpl: パネル初期化を開始します');
      
      // 必要なサービスのチェック
      if (!this._projectService) {
        Logger.warn('PanelServiceImpl: ProjectServiceが設定されていないため部分的に初期化します');
      }
      
      if (!this._fileSystemService) {
        Logger.warn('PanelServiceImpl: FileSystemServiceが設定されていないため部分的に初期化します');
      }
      
      // プロジェクト一覧の更新
      await this._refreshProjects();
      
      // プロジェクトパスが指定されている場合
      if (projectPath && this._projectService && this._fileSystemService) {
        // プロジェクト情報を取得して同期
        const project = this._projectService.getProjectByPath(projectPath);
        if (project) {
          await this.syncActiveProject(project);
        } else {
          Logger.warn(`PanelServiceImpl: 指定されたパスのプロジェクトが見つかりません: ${projectPath}`);
        }
      }
      
      // 共有履歴の初期化（SharingServiceが利用可能な場合）
      if (this._sharingService) {
        const history = await this._sharingService.getHistory();
        this.updateSharingHistory(history);
      }
      
      Logger.info('PanelServiceImpl: パネル初期化が完了しました');
    } catch (error) {
      Logger.error('PanelServiceImpl: パネル初期化中にエラーが発生しました', error as Error);
      this.showError(`パネル初期化中にエラーが発生しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * アクティブなプロジェクトの状態を同期する
   * プロジェクト切り替えフロー改善設計に基づく効率的な実装
   * @param project プロジェクト情報
   */
  public async syncActiveProject(project: any): Promise<void> {
    try {
      if (!this._panel) {
        Logger.warn('PanelServiceImpl: パネルが存在しないためプロジェクト状態を同期できません');
        return;
      }
      
      if (!project || !project.path) {
        Logger.warn('PanelServiceImpl: 無効なプロジェクト情報のため同期できません');
        return;
      }
      
      Logger.info(`PanelServiceImpl: プロジェクト状態の同期を開始: ${project.name}`);
      
      // 必要なデータを並列で取得
      const promises: Promise<any>[] = [];
      let progressContent: string = '';
      let directoryStructure: any = null;
      let sharingHistory: any[] = [];
      let allProjects: any[] = [];
      let activeTab: string = 'scope-progress';
      
      // プロジェクトサービスが利用可能な場合
      if (this._projectService) {
        // プロジェクト一覧を並列で取得
        promises.push(
          this._projectService.getAllProjects()
            .then(projects => { allProjects = projects; })
            .catch(error => {
              Logger.error('PanelServiceImpl: プロジェクト一覧の取得に失敗', error as Error);
              allProjects = [];
            })
        );
        
        // 前回のアクティブタブ取得（メタデータから）
        if (project.metadata && project.metadata.activeTab) {
          activeTab = project.metadata.activeTab;
        }
      }
      
      // ファイルシステムサービスが利用可能な場合
      if (this._fileSystemService) {
        // 進捗ファイルの読み込み
        const progressFilePath = path.join(project.path, 'docs', 'SCOPE_PROGRESS.md');
        promises.push(
          this._fileSystemService.fileExists(progressFilePath)
            .then(exists => {
              if (exists) {
                return this._fileSystemService.readMarkdownFile(progressFilePath)
                  .then(content => { progressContent = content; });
              } else {
                progressContent = '# 進捗ファイルが見つかりません\n\n`docs/SCOPE_PROGRESS.md`ファイルが見つかりません。';
                return Promise.resolve();
              }
            })
            .catch(error => {
              Logger.error('PanelServiceImpl: 進捗ファイルの読み込みに失敗', error as Error);
              progressContent = `# エラー\n\n進捗ファイルの読み込み中にエラーが発生しました: ${(error as Error).message}`;
            })
        );
        
        // ディレクトリ構造の取得
        promises.push(
          this._fileSystemService.getDirectoryStructure(project.path)
            .then(structure => { directoryStructure = structure; })
            .catch(error => {
              Logger.error('PanelServiceImpl: ディレクトリ構造の取得に失敗', error as Error);
              directoryStructure = { files: [], directories: [] };
            })
        );
      }
      
      // 共有サービスが利用可能な場合
      if (this._sharingService) {
        // 共有履歴の取得
        promises.push(
          this._sharingService.getHistory()
            .then(history => { sharingHistory = history; })
            .catch(error => {
              Logger.error('PanelServiceImpl: 共有履歴の取得に失敗', error as Error);
              sharingHistory = [];
            })
        );
      }
      
      // すべてのデータ取得処理の完了を待機
      await Promise.all(promises);
      
      // 一括してすべての状態をWebViewに送信
      this.sendMessage({
        command: 'syncFullProjectState',
        state: {
          activeProject: project,
          allProjects: allProjects,
          progressContent: progressContent,
          directoryStructure: directoryStructure,
          activeTab: activeTab,
          sharingHistory: sharingHistory
        },
        priority: 'high',
        timestamp: Date.now()
      });
      
      // タブ状態サービスが利用可能な場合は、タブ状態も更新
      if (this._tabStateService && project.id) {
        await this._tabStateService.saveTabState(project.id, activeTab);
      }
      
      this.showSuccess(`プロジェクト「${project.name}」を読み込みました`);
      
      Logger.info(`PanelServiceImpl: プロジェクト状態の同期が完了: ${project.name}`);
    } catch (error) {
      Logger.error('PanelServiceImpl: プロジェクト状態の同期中にエラーが発生しました', error as Error);
      this.showError(`プロジェクト状態の同期中にエラーが発生しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * プロジェクト一覧を更新する
   * @private
   */
  private async _refreshProjects(): Promise<void> {
    if (!this._projectService) {
      Logger.warn('PanelServiceImpl: ProjectServiceが設定されていないためプロジェクト一覧を更新できません');
      return;
    }
    
    try {
      const allProjects = await this._projectService.getAllProjects();
      const activeProject = this._projectService.getActiveProject();
      
      this.sendMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject
      });
      
      Logger.info(`PanelServiceImpl: プロジェクト一覧を更新しました: ${allProjects.length}件`);
    } catch (error) {
      Logger.error('PanelServiceImpl: プロジェクト一覧の更新に失敗しました', error as Error);
      this.showError(`プロジェクト一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * ProjectServiceを設定
   * @param projectService ProjectServiceインスタンス
   */
  public setProjectService(projectService: IProjectService): void {
    this._projectService = projectService;
    Logger.info('PanelServiceImpl: ProjectServiceを設定しました');
  }
  
  /**
   * MessageServiceを設定
   * @param messageService MessageDispatchServiceインスタンス
   */
  public setMessageService(messageService: MessageDispatchService): void {
    this._messageService = messageService;
    Logger.info('PanelServiceImpl: MessageDispatchServiceを設定しました');
  }
  
  /**
   * FileSystemServiceを設定
   * @param fileSystemService FileSystemServiceインスタンス
   */
  public setFileSystemService(fileSystemService: IFileSystemService): void {
    this._fileSystemService = fileSystemService;
    Logger.info('PanelServiceImpl: FileSystemServiceを設定しました');
  }
  
  /**
   * TabStateServiceを設定
   * @param tabStateService TabStateServiceインスタンス
   */
  public setTabStateService(tabStateService: ITabStateService): void {
    this._tabStateService = tabStateService;
    Logger.info('PanelServiceImpl: TabStateServiceを設定しました');
  }
  
  /**
   * SharingServiceを設定
   * @param sharingService SharingServiceインスタンス
   */
  public setSharingService(sharingService: ISharingService): void {
    this._sharingService = sharingService;
    Logger.info('PanelServiceImpl: SharingServiceを設定しました');
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    // パネルを破棄
    if (this._panel) {
      this._panel.dispose();
      this._panel = undefined;
    }
    
    // イベントエミッタを解放
    this._onMessageReceived.dispose();
    this._onPanelDisposed.dispose();
    
    // Disposableなリソースを解放
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
    
    Logger.info('PanelServiceImpl: リソースを解放しました');
  }
}