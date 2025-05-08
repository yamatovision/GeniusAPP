import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

// サービスインターフェース
import {
  IFileSystemService,
  IProjectService,
  IPanelService,
  IMessageDispatchService,
  ITabStateService,
  IUIStateService,
  ISharingService,
} from './interfaces';

// 既存の実装クラス
import { FileSystemService } from './FileSystemService';
import { ProjectService } from './ProjectService';
import { PanelService } from './PanelService';
import { MessageDispatchService } from './MessageDispatchService';
import { TabStateService } from './TabStateService';
import { UIStateService } from './UIStateService';
import { SharingService } from './SharingService';
import { AuthenticationHandler, IAuthenticationHandler } from './AuthenticationHandler';

// 新しい実装クラス
import { FileSystemServiceImpl } from './implementations/FileSystemServiceImpl';
import { ProjectServiceImpl } from './implementations/ProjectServiceImpl';
import { MessageDispatchServiceImpl } from './implementations/MessageDispatchServiceImpl';

/**
 * サービスファクトリー
 * 新旧実装の切り替えと各サービスのインスタンス管理を行う
 */
export class ServiceFactory {
  // 拡張機能のURIとコンテキスト
  private static _extensionUri: vscode.Uri;
  private static _context: vscode.ExtensionContext;
  
  // 新実装への切り替えフラグ
  private static _useNewFileSystemService: boolean = true;
  private static _useNewProjectService: boolean = true;
  private static _useNewMessageService: boolean = true;
  
  // サービスインスタンス（キャッシュ）
  private static _fileSystemService: IFileSystemService;
  private static _projectService: IProjectService;
  private static _panelService: IPanelService;
  private static _messageService: IMessageDispatchService;
  private static _tabStateService: ITabStateService;
  private static _uiStateService: IUIStateService;
  private static _sharingService: ISharingService;
  private static _authHandler: IAuthenticationHandler;
  
  /**
   * ファクトリを初期化
   * @param extensionUri 拡張機能URI
   * @param context 拡張機能コンテキスト
   */
  public static initialize(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ): void {
    ServiceFactory._extensionUri = extensionUri;
    ServiceFactory._context = context;
    Logger.info('ServiceFactory: 初期化しました');
  }
  
  /**
   * FileSystemServiceの取得
   * 新旧実装を切り替え可能
   */
  public static getFileSystemService(): IFileSystemService {
    if (!ServiceFactory._fileSystemService) {
      if (ServiceFactory._useNewFileSystemService) {
        Logger.info('ServiceFactory: 新しいFileSystemServiceImplを使用');
        ServiceFactory._fileSystemService = FileSystemServiceImpl.getInstance();
      } else {
        Logger.info('ServiceFactory: 従来のFileSystemServiceを使用');
        ServiceFactory._fileSystemService = FileSystemService.getInstance();
      }
    }
    return ServiceFactory._fileSystemService;
  }
  
  /**
   * ProjectServiceの取得
   * 新旧実装を切り替え可能
   */
  public static getProjectService(): IProjectService {
    if (!ServiceFactory._projectService) {
      const fileSystemService = ServiceFactory.getFileSystemService();
      
      if (ServiceFactory._useNewProjectService) {
        Logger.info('ServiceFactory: 新しいProjectServiceImplを使用');
        ServiceFactory._projectService = ProjectServiceImpl.getInstance(fileSystemService);
      } else {
        Logger.info('ServiceFactory: 従来のProjectServiceを使用');
        ServiceFactory._projectService = ProjectService.getInstance(fileSystemService);
      }
    }
    return ServiceFactory._projectService;
  }
  
  /**
   * PanelServiceの取得
   */
  public static getPanelService(): IPanelService {
    if (!ServiceFactory._panelService) {
      const uiStateService = ServiceFactory.getUIStateService();
      ServiceFactory._panelService = PanelService.getInstance(
        ServiceFactory._extensionUri,
        ServiceFactory._context,
        uiStateService,
        {
          // WebViewオプションにTreeInput初期化プロパティを追加
          webviewOptions: {
            enableScripts: true,
            retainContextWhenHidden: true,
            // @ts-ignore - VSCodeの内部APIにアクセス
            treeInput: {} // DebugReplのTree入力を事前に初期化
          }
        }
      );
    }
    return ServiceFactory._panelService;
  }
  
  /**
   * MessageDispatchServiceの取得
   * 新旧実装を切り替え可能
   */
  public static getMessageService(): IMessageDispatchService {
    if (!ServiceFactory._messageService) {
      if (ServiceFactory._useNewMessageService) {
        Logger.info('ServiceFactory: 新しいMessageDispatchServiceImplを使用');
        ServiceFactory._messageService = MessageDispatchServiceImpl.getInstance();
      } else {
        Logger.info('ServiceFactory: 従来のMessageDispatchServiceを使用');
        ServiceFactory._messageService = MessageDispatchService.getInstance();
      }
    }
    return ServiceFactory._messageService;
  }
  
  /**
   * TabStateServiceの取得
   */
  public static getTabStateService(): ITabStateService {
    if (!ServiceFactory._tabStateService) {
      ServiceFactory._tabStateService = TabStateService.getInstance();
    }
    return ServiceFactory._tabStateService;
  }
  
  /**
   * UIStateServiceの取得
   */
  public static getUIStateService(): IUIStateService {
    if (!ServiceFactory._uiStateService) {
      ServiceFactory._uiStateService = UIStateService.getInstance();
    }
    return ServiceFactory._uiStateService;
  }
  
  /**
   * SharingServiceの取得
   */
  public static getSharingService(): ISharingService {
    if (!ServiceFactory._sharingService) {
      ServiceFactory._sharingService = SharingService.getInstance(ServiceFactory._context);
    }
    return ServiceFactory._sharingService;
  }
  
  /**
   * AuthenticationHandlerの取得
   */
  public static getAuthHandler(): IAuthenticationHandler {
    if (!ServiceFactory._authHandler) {
      ServiceFactory._authHandler = AuthenticationHandler.getInstance();
    }
    return ServiceFactory._authHandler;
  }
  
  /**
   * サービス間の依存関係を設定
   */
  public static setupDependencies(): void {
    try {
      // 各サービスを取得（確実に初期化するため）
      const messageService = ServiceFactory.getMessageService();
      const projectService = ServiceFactory.getProjectService();
      const fileSystemService = ServiceFactory.getFileSystemService();
      const panelService = ServiceFactory.getPanelService();
      const uiStateService = ServiceFactory.getUIStateService();
      const tabStateService = ServiceFactory.getTabStateService();
      const sharingService = ServiceFactory.getSharingService();
      
      // MessageDispatchServiceに依存サービスを設定
      messageService.setDependencies({
        sharingService: sharingService,
        projectService: projectService,
        fileSystemService: fileSystemService,
        uiStateService: uiStateService,
        panelService: panelService
      });
      
      // PanelServiceにProjectServiceを設定
      if (panelService && typeof panelService.setProjectService === 'function') {
        panelService.setProjectService(projectService);
        
        // PanelServiceにMessageDispatchServiceへの参照も設定
        if (typeof panelService.setMessageService === 'function') {
          panelService.setMessageService(messageService);
        } else {
          // 互換性のために残す
          const panelServiceInstance = panelService as any;
          if (panelServiceInstance._messageService === undefined) {
            panelServiceInstance._messageService = messageService;
          }
        }
      }
      
      // 各サービスのイベントリスナーを設定
      ServiceFactory.setupEventListeners();
      
      Logger.info('ServiceFactory: すべてのサービス間の依存関係を設定しました');
    } catch (error) {
      Logger.error('ServiceFactory: 依存関係設定エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * サービス間のイベントリスナーを設定
   */
  public static setupEventListeners(): void {
    try {
      const panelService = ServiceFactory.getPanelService();
      const messageService = ServiceFactory.getMessageService();
      const uiStateService = ServiceFactory.getUIStateService();
      const projectService = ServiceFactory.getProjectService();
      const fileSystemService = ServiceFactory.getFileSystemService();
      
      // PanelServiceのMessageReceived イベントをMessageDispatchServiceに接続
      panelService.onMessageReceived(message => {
        if (panelService.getPanel()) {
          messageService.handleMessage(message, panelService.getPanel()!);
        }
      });
      
      // UIStateServiceのイベントをPanelServiceに反映
      uiStateService.onUIStateChanged(({ projectId, state }) => {
        if (state.directoryStructure && panelService.getPanel()) {
          panelService.sendMessage({
            command: 'updateDirectoryStructure',
            structure: state.directoryStructure
          });
        }
      });
      
      // ProjectServiceのイベントをPanelServiceに反映
      projectService.onProjectsUpdated(projects => {
        if (panelService.getPanel()) {
          const activeProject = projectService.getActiveProject();
          panelService.sendMessage({
            command: 'updateProjects',
            projects: projects,
            activeProject: activeProject
          });
        }
      });
      
      // FileSystemServiceのイベントをPanelServiceに反映
      fileSystemService.onDirectoryStructureUpdated(structure => {
        if (panelService.getPanel()) {
          panelService.sendMessage({
            command: 'updateDirectoryStructure',
            structure: structure
          });
        }
      });
      
      Logger.info('ServiceFactory: サービス間のイベントリスナーを設定しました');
    } catch (error) {
      Logger.error('ServiceFactory: イベントリスナー設定エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 標準メッセージハンドラーを登録
   */
  public static registerStandardHandlers(): void {
    try {
      const messageService = ServiceFactory.getMessageService();
      const tabStateService = ServiceFactory.getTabStateService();
      
      // メッセージディスパッチャーが持つハンドラー登録
      // 明示的に各ハンドラーを登録（新しいMessageDispatchServiceImplでは自動登録されるが、念のため）
      if (ServiceFactory._useNewMessageService) {
        Logger.info('ServiceFactory: 新しいMessageDispatchServiceImplのハンドラーを登録');
        // 新実装では初期化時にすでに登録されているはずだが、念のため明示的に呼び出す
        messageService.registerProjectHandlers();
        messageService.registerFileHandlers();
        messageService.registerSharingHandlers();
      } else {
        Logger.info('ServiceFactory: 従来のMessageDispatchServiceのハンドラーを登録');
        messageService.registerProjectHandlers();
        messageService.registerFileHandlers();
        messageService.registerSharingHandlers();
      }
      
      // タブ状態サービスのメッセージハンドラーを登録
      tabStateService.registerMessageHandlers(messageService);
      
      // ハンドラー登録状況のログ出力（デバッグ用）
      if (messageService instanceof MessageDispatchServiceImpl) {
        Logger.info('ServiceFactory: MessageDispatchServiceImplのハンドラーが登録されました');
      } else {
        Logger.info('ServiceFactory: 従来のMessageDispatchServiceのハンドラーが登録されました');
      }
      
      Logger.info('ServiceFactory: 標準メッセージハンドラーを登録しました');
    } catch (error) {
      Logger.error('ServiceFactory: メッセージハンドラー登録エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 新実装への切り替えフラグを設定
   * @param useNewFileSystem 新しいFileSystemServiceを使用する場合はtrue
   * @param useNewProject 新しいProjectServiceを使用する場合はtrue
   * @param useNewMessage 新しいMessageDispatchServiceを使用する場合はtrue
   */
  public static setImplementationFlags(
    useNewFileSystem: boolean, 
    useNewProject: boolean, 
    useNewMessage: boolean = true
  ): void {
    // すでにインスタンスが作成されている場合は変更を許可しない
    if (ServiceFactory._fileSystemService) {
      Logger.warn('ServiceFactory: FileSystemServiceはすでに初期化されています。フラグは無視されます。');
    } else {
      ServiceFactory._useNewFileSystemService = useNewFileSystem;
      Logger.info(`ServiceFactory: FileSystemService切り替えフラグを ${useNewFileSystem} に設定しました`);
    }
    
    if (ServiceFactory._projectService) {
      Logger.warn('ServiceFactory: ProjectServiceはすでに初期化されています。フラグは無視されます。');
    } else {
      ServiceFactory._useNewProjectService = useNewProject;
      Logger.info(`ServiceFactory: ProjectService切り替えフラグを ${useNewProject} に設定しました`);
    }
    
    if (ServiceFactory._messageService) {
      Logger.warn('ServiceFactory: MessageDispatchServiceはすでに初期化されています。フラグは無視されます。');
    } else {
      ServiceFactory._useNewMessageService = useNewMessage;
      Logger.info(`ServiceFactory: MessageDispatchService切り替えフラグを ${useNewMessage} に設定しました`);
    }
  }
  
  /**
   * リソースの解放
   */
  public static dispose(): void {
    // キャッシュされたサービスインスタンスをクリア
    ServiceFactory._fileSystemService = undefined as any;
    ServiceFactory._projectService = undefined as any;
    ServiceFactory._panelService = undefined as any;
    ServiceFactory._messageService = undefined as any;
    ServiceFactory._tabStateService = undefined as any;
    ServiceFactory._uiStateService = undefined as any;
    ServiceFactory._sharingService = undefined as any;
    ServiceFactory._authHandler = undefined as any;
    
    Logger.info('ServiceFactory: すべてのサービス参照をクリアしました');
  }
}