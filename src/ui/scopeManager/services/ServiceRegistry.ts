import { IFileSystemService } from './interfaces/IFileSystemService';
import { IMessageDispatchService } from './interfaces/IMessageDispatchService';
import { IProjectService } from './interfaces/IProjectService';
import { ISharingService } from './interfaces/ISharingService';
import { IUIStateService } from './interfaces/IUIStateService';
import { IPanelService } from './interfaces/IPanelService';
import { IWebViewCommunication } from './interfaces/IWebViewCommunication';
import { ITabStateService } from './interfaces/ITabStateService';
import { Logger } from '../../../utils/logger';

/**
 * サービスレジストリ
 * 
 * 各サービスのインスタンスを管理し、サービス間の直接参照を可能にします。
 * シングルトンパターンを使用して一元管理します。
 */
export class ServiceRegistry {
  private static _instance: ServiceRegistry;
  
  private _messageDispatchService: IMessageDispatchService | null = null;
  private _fileSystemService: IFileSystemService | null = null;
  private _projectService: IProjectService | null = null;
  private _sharingService: ISharingService | null = null;
  private _uiStateService: IUIStateService | null = null;
  private _panelService: IPanelService | null = null;
  private _tabStateService: ITabStateService | null = null;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry._instance) {
      ServiceRegistry._instance = new ServiceRegistry();
    }
    return ServiceRegistry._instance;
  }
  
  /**
   * プライベートコンストラクタ
   */
  private constructor() {
    Logger.debug('ServiceRegistry: 初期化されました');
  }
  
  /**
   * メッセージディスパッチサービスを登録
   */
  public registerMessageDispatchService(service: IMessageDispatchService): void {
    this._messageDispatchService = service;
    this.updateDependencies();
  }
  
  /**
   * ファイルシステムサービスを登録
   */
  public registerFileSystemService(service: IFileSystemService): void {
    this._fileSystemService = service;
    this.updateDependencies();
  }
  
  /**
   * プロジェクトサービスを登録
   */
  public registerProjectService(service: IProjectService): void {
    this._projectService = service;
    this.updateDependencies();
  }
  
  /**
   * 共有サービスを登録
   */
  public registerSharingService(service: ISharingService): void {
    this._sharingService = service;
    this.updateDependencies();
  }
  
  /**
   * UI状態サービスを登録
   */
  public registerUIStateService(service: IUIStateService): void {
    this._uiStateService = service;
    this.updateDependencies();
  }
  
  /**
   * パネルサービスを登録
   */
  public registerPanelService(service: IPanelService): void {
    this._panelService = service;
    this.updateDependencies();
  }
  
  /**
   * タブ状態サービスを登録
   */
  public registerTabStateService(service: ITabStateService): void {
    this._tabStateService = service;
    this.updateDependencies();
  }
  
  /**
   * 依存関係を更新
   */
  private updateDependencies(): void {
    if (this._messageDispatchService) {
      // IMessageDispatchServiceのsetDependencies定義に合わせる
      // tabStateServiceは正式にサポートされていないのでプロパティを削除
      this._messageDispatchService.setDependencies({
        fileSystemService: this._fileSystemService,
        projectService: this._projectService,
        sharingService: this._sharingService,
        uiStateService: this._uiStateService,
        panelService: this._panelService
      });
    }
    
    // 各サービスのWebView通信機能を登録
    this.registerWebViewCommunications();
  }
  
  /**
   * WebView通信機能を各サービスに登録
   */
  private registerWebViewCommunications(): void {
    if (!this._messageDispatchService) {
      Logger.warn('ServiceRegistry: メッセージディスパッチサービスがないためWebView通信機能を登録できません');
      return;
    }
    
    // FileSystemServiceにWebView通信機能を登録
    if (this._fileSystemService && 'registerMessageHandlers' in this._fileSystemService) {
      (this._fileSystemService as unknown as IWebViewCommunication).registerMessageHandlers(this._messageDispatchService);
      Logger.debug('ServiceRegistry: FileSystemServiceにWebView通信機能を登録しました');
    }
    
    // ProjectServiceにWebView通信機能を登録
    if (this._projectService && 'registerMessageHandlers' in this._projectService) {
      (this._projectService as unknown as IWebViewCommunication).registerMessageHandlers(this._messageDispatchService);
      Logger.debug('ServiceRegistry: ProjectServiceにWebView通信機能を登録しました');
    }
    
    // SharingServiceにWebView通信機能を登録
    if (this._sharingService && 'registerMessageHandlers' in this._sharingService) {
      (this._sharingService as unknown as IWebViewCommunication).registerMessageHandlers(this._messageDispatchService);
      Logger.debug('ServiceRegistry: SharingServiceにWebView通信機能を登録しました');
    }
    
    // UIStateServiceにWebView通信機能を登録
    if (this._uiStateService && 'registerMessageHandlers' in this._uiStateService) {
      (this._uiStateService as unknown as IWebViewCommunication).registerMessageHandlers(this._messageDispatchService);
      Logger.debug('ServiceRegistry: UIStateServiceにWebView通信機能を登録しました');
    }
    
    // TabStateServiceにWebView通信機能を登録
    if (this._tabStateService && 'registerMessageHandlers' in this._tabStateService) {
      (this._tabStateService as unknown as IWebViewCommunication).registerMessageHandlers(this._messageDispatchService);
      Logger.debug('ServiceRegistry: TabStateServiceにWebView通信機能を登録しました');
    }
    
    Logger.info('ServiceRegistry: すべてのサービスにWebView通信機能を登録しました');
  }
  
  /**
   * メッセージディスパッチサービスを取得
   */
  public getMessageDispatchService(): IMessageDispatchService | null {
    return this._messageDispatchService;
  }
  
  /**
   * ファイルシステムサービスを取得
   */
  public getFileSystemService(): IFileSystemService | null {
    return this._fileSystemService;
  }
  
  /**
   * プロジェクトサービスを取得
   */
  public getProjectService(): IProjectService | null {
    return this._projectService;
  }
  
  /**
   * 共有サービスを取得
   */
  public getSharingService(): ISharingService | null {
    return this._sharingService;
  }
  
  /**
   * UI状態サービスを取得
   */
  public getUIStateService(): IUIStateService | null {
    return this._uiStateService;
  }
  
  /**
   * パネルサービスを取得
   */
  public getPanelService(): IPanelService | null {
    return this._panelService;
  }
  
  /**
   * タブ状態サービスを取得
   */
  public getTabStateService(): ITabStateService | null {
    return this._tabStateService;
  }
}