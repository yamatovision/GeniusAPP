import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

// サービスインターフェースのインポート
import {
  IService,
  IFileSystemService,
  IProjectService,
  IPanelService,
  IMessageDispatchService,
  ITabStateService,
  IUIStateService,
  ISharingService,
} from './interfaces';

// ファクトリのインポート
import { ServiceFactory } from './ServiceFactory';

// インターフェースのインポート
import { AuthenticationHandler, IAuthenticationHandler } from './AuthenticationHandler';

/**
 * サービスタイプを定義する型
 */
export type ServiceType = 
  | 'fileSystemService' 
  | 'projectService' 
  | 'panelService' 
  | 'messageService' 
  | 'tabStateService' 
  | 'uiStateService' 
  | 'sharingService'
  | 'authHandler'
  | string;

/**
 * サービスインスタンスとインターフェースのマッピング
 */
export interface ServiceDefinitions {
  fileSystemService: IFileSystemService;
  projectService: IProjectService;
  panelService: IPanelService;
  messageService: IMessageDispatchService;
  tabStateService: ITabStateService;
  uiStateService: IUIStateService;
  sharingService: ISharingService;
  authHandler: IAuthenticationHandler;
  [key: string]: IService;
}

/**
 * 強化版サービスレジストリ
 * より柔軟で型安全なサービス管理を提供
 */
export class ServiceRegistry2 {
  // サービスインスタンスを保持する内部マップ
  private _services: Map<string, IService> = new Map();
  
  // 従来のプロパティアクセス用のゲッターを維持（互換性のため）
  public get messageService(): IMessageDispatchService { return this.getService<IMessageDispatchService>('messageService'); }
  public get projectService(): IProjectService { return this.getService<IProjectService>('projectService'); }
  public get fileSystemService(): IFileSystemService { return this.getService<IFileSystemService>('fileSystemService'); }
  public get panelService(): IPanelService { return this.getService<IPanelService>('panelService'); }
  public get uiStateService(): IUIStateService { return this.getService<IUIStateService>('uiStateService'); }
  public get tabStateService(): ITabStateService { return this.getService<ITabStateService>('tabStateService'); }
  public get sharingService(): ISharingService { return this.getService<ISharingService>('sharingService'); }
  public get authHandler(): IAuthenticationHandler { return this.getService<IAuthenticationHandler>('authHandler'); }
  
  // シングルトンインスタンス
  private static _instance: ServiceRegistry2;
  
  /**
   * サービスレジストリを初期化
   * @param extensionUri 拡張機能URI
   * @param context 拡張機能コンテキスト
   * @returns ServiceRegistryインスタンス
   */
  public static initialize(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ): ServiceRegistry2 {
    if (!ServiceRegistry2._instance) {
      ServiceRegistry2._instance = new ServiceRegistry2(extensionUri, context);
    }
    return ServiceRegistry2._instance;
  }
  
  /**
   * 現在のインスタンスを取得
   * @returns ServiceRegistryインスタンス（初期化済みの場合）
   * @throws 初期化されていない場合はエラー
   */
  public static getInstance(): ServiceRegistry2 {
    if (!ServiceRegistry2._instance) {
      throw new Error('ServiceRegistry2が初期化されていません。まずinitialize()を呼び出してください。');
    }
    return ServiceRegistry2._instance;
  }
  
  /**
   * コンストラクタ - 依存関係順にサービスを初期化
   * @param extensionUri 拡張機能URI
   * @param context 拡張機能コンテキスト
   */
  private constructor(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    try {
      Logger.info('ServiceRegistry2: サービスの初期化を開始');
      
      // ServiceFactoryを初期化
      ServiceFactory.initialize(extensionUri, context);
      
      // 依存関係順に各サービスを取得し登録
      // 1. 基本サービス
      this.registerService('fileSystemService', ServiceFactory.getFileSystemService());
      this.registerService('authHandler', ServiceFactory.getAuthHandler());
      
      // 2. プロジェクトサービス (FileSystemServiceに依存)
      this.registerService('projectService', ServiceFactory.getProjectService());
      
      // 3. UIサービス
      this.registerService('uiStateService', ServiceFactory.getUIStateService());
      this.registerService('tabStateService', ServiceFactory.getTabStateService());
      
      // 4. 共有サービス
      this.registerService('sharingService', ServiceFactory.getSharingService());
      
      // 5. パネルサービス (UIStateServiceに依存)
      this.registerService('panelService', ServiceFactory.getPanelService());
      
      // 6. メッセージングサービス (他のサービスに依存)
      this.registerService('messageService', ServiceFactory.getMessageService());
      
      // サービス間の依存関係を設定
      this.setupDependencies();
      
      Logger.info('ServiceRegistry2: すべてのサービスが正常に初期化されました');
    } catch (error) {
      Logger.error('ServiceRegistry2: 初期化エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 型安全なサービス登録
   * @param serviceType サービスの識別子
   * @param implementation サービスの実装
   */
  public registerService<T extends IService>(serviceType: string, implementation: T): void {
    if (this._services.has(serviceType)) {
      Logger.warn(`ServiceRegistry2: サービス '${serviceType}' は既に登録されています。上書きします。`);
    }
    
    this._services.set(serviceType, implementation);
    Logger.debug(`ServiceRegistry2: サービス '${serviceType}' を登録しました`);
  }
  
  /**
   * 型安全なサービス取得
   * @param serviceType サービスの識別子
   * @returns サービスのインスタンス
   * @throws サービスが登録されていない場合はエラー
   */
  public getService<T extends IService>(serviceType: string): T {
    const service = this._services.get(serviceType);
    if (!service) {
      throw new Error(`ServiceRegistry2: サービス '${serviceType}' が登録されていません`);
    }
    return service as T;
  }
  
  /**
   * サービスの存在チェック
   * @param serviceType サービスの識別子
   * @returns 登録されていればtrue、それ以外はfalse
   */
  public hasService(serviceType: string): boolean {
    return this._services.has(serviceType);
  }
  
  /**
   * サービス間の依存関係を設定
   */
  private setupDependencies(): void {
    try {
      // ServiceFactoryを使用して依存関係を設定
      ServiceFactory.setupDependencies();
      
      // 依存関係設定完了のログを詳細に
      Logger.info('ServiceRegistry2: すべてのサービス間の依存関係を設定しました');
    } catch (error) {
      Logger.error('ServiceRegistry2: 依存関係設定エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * サービス間のイベントリスナーを設定
   * @deprecated ServiceFactoryが提供する setupEventListeners() を使用してください
   */
  private setupEventListeners(): void {
    try {
      // 何もせず、ServiceFactoryに処理を委譲
      Logger.info('ServiceRegistry2: イベントリスナーの設定はServiceFactoryで行われています');
    } catch (error) {
      Logger.error('ServiceRegistry2: イベントリスナー設定エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 標準メッセージハンドラーを登録
   */
  public registerStandardHandlers(): void {
    try {
      // ServiceFactoryを使用してハンドラーを登録
      ServiceFactory.registerStandardHandlers();
      
      Logger.info('ServiceRegistry2: 標準メッセージハンドラーを登録しました');
    } catch (error) {
      Logger.error('ServiceRegistry2: メッセージハンドラー登録エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 全サービスのリソースを解放
   */
  public dispose(): void {
    try {
      // 各サービスのリソースを解放（登録された順序の逆で解放）
      for (const service of this._services.values()) {
        service.dispose();
      }
      
      // サービスマップをクリア
      this._services.clear();
      
      // ServiceFactoryのリソースも解放
      ServiceFactory.dispose();
      
      // シングルトンインスタンスをクリア
      ServiceRegistry2._instance = undefined as any;
      
      Logger.info('ServiceRegistry2: すべてのサービスのリソースを解放しました');
    } catch (error) {
      Logger.error('ServiceRegistry2: リソース解放エラー', error as Error);
      throw error;
    }
  }
}