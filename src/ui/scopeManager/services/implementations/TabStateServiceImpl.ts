import * as vscode from 'vscode';
import { Logger } from '../../../../utils/logger';
import { ITabStateService } from '../interfaces/ITabStateService';
import { IMessageDispatchService } from '../interfaces/IMessageDispatchService';
import { IProjectService } from '../interfaces/IProjectService';
import { IFileSystemService } from '../interfaces/IFileSystemService';
import { AppGeniusEventBus } from '../../../../services/AppGeniusEventBus';

/**
 * タブ状態管理サービスの実装
 * タブの選択状態や表示状態などのUIに関わる状態を管理
 */
export class TabStateServiceImpl implements ITabStateService {
  // イベント発行用
  private _onTabChanged = new vscode.EventEmitter<string>();
  public readonly onTabChanged = this._onTabChanged.event;
  
  // イベントバス
  private _eventBus: AppGeniusEventBus;
  
  // シングルトンインスタンス
  private static _instance: TabStateServiceImpl;
  
  // 依存サービス（インターフェース経由で参照）
  private _projectService?: IProjectService;
  private _fileSystemService?: IFileSystemService;
  
  /**
   * シングルトンインスタンスを取得
   * @param projectService オプションのProjectServiceインスタンス
   * @param fileSystemService オプションのFileSystemServiceインスタンス
   * @returns TabStateServiceImplのインスタンス
   */
  public static getInstance(
    projectService?: IProjectService,
    fileSystemService?: IFileSystemService
  ): TabStateServiceImpl {
    if (!TabStateServiceImpl._instance) {
      TabStateServiceImpl._instance = new TabStateServiceImpl(
        projectService,
        fileSystemService
      );
    } else if (projectService || fileSystemService) {
      // インスタンスが既存で、依存サービスが提供された場合は更新
      if (projectService) {
        TabStateServiceImpl._instance._projectService = projectService;
      }
      if (fileSystemService) {
        TabStateServiceImpl._instance._fileSystemService = fileSystemService;
      }
    }
    return TabStateServiceImpl._instance;
  }
  
  /**
   * コンストラクタ
   * @param projectService オプションのProjectServiceインスタンス
   * @param fileSystemService オプションのFileSystemServiceインスタンス
   */
  private constructor(
    projectService?: IProjectService,
    fileSystemService?: IFileSystemService
  ) {
    this._projectService = projectService;
    this._fileSystemService = fileSystemService;
    this._eventBus = AppGeniusEventBus.getInstance();
    
    Logger.info('TabStateServiceImpl: 初期化完了');
  }
  
  /**
   * プロジェクトサービスを設定
   * @param projectService ProjectServiceインスタンス
   */
  public setProjectService(projectService: IProjectService): void {
    this._projectService = projectService;
    Logger.debug('TabStateServiceImpl: ProjectServiceが設定されました');
  }
  
  /**
   * ファイルシステムサービスを設定
   * @param fileSystemService FileSystemServiceインスタンス
   */
  public setFileSystemService(fileSystemService: IFileSystemService): void {
    this._fileSystemService = fileSystemService;
    Logger.debug('TabStateServiceImpl: FileSystemServiceが設定されました');
  }
  
  /**
   * タブを選択する
   * @param tabId 選択するタブのID
   */
  public async selectTab(tabId: string): Promise<void> {
    try {
      Logger.debug(`TabStateServiceImpl: タブを選択しています: ${tabId}`);
      
      // タブ状態を更新（内部でアクティブプロジェクトの確認と状態保存が行われる）
      await this.saveTabState(tabId);
      
      // タブ変更イベントを発行（レガシーサポート - いずれ削除予定）
      this._onTabChanged.fire(tabId);
      
      Logger.info(`TabStateServiceImpl: タブを選択しました: ${tabId}`);
    } catch (error) {
      Logger.error(`TabStateServiceImpl: タブ選択中にエラーが発生しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * タブの内容を更新する
   * @param tabId 更新するタブのID
   * @param content 新しい内容
   */
  public updateTabContent(tabId: string, content: string): void {
    try {
      Logger.debug(`TabStateServiceImpl: タブ内容を更新します: ${tabId}`);
      
      // グローバルイベントを発行してPanelServiceに通知
      this._eventBus.publish('tab-content-updated', {
        tabId: tabId,
        content: content
      }, 'TabStateServiceImpl');
      
      Logger.info(`TabStateServiceImpl: タブ内容を更新しました: ${tabId}`);
    } catch (error) {
      Logger.error(`TabStateServiceImpl: タブ内容の更新中にエラーが発生しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * タブ状態を保存する
   * @param tabId タブID
   */
  public async saveTabState(tabId: string): Promise<void> {
    try {
      // 現在のアクティブタブと比較（現在と同じ場合は処理をスキップ）
      const currentActiveTab = this.getActiveTab();
      if (currentActiveTab === tabId) {
        return;
      }
      
      // プロジェクトサービスからアクティブプロジェクト情報を取得
      if (!this._projectService) {
        Logger.warn('TabStateServiceImpl: ProjectServiceが設定されていません');
        return;
      }
      
      const activeProject = this._projectService.getActiveProject();
      if (!activeProject || !activeProject.id) {
        Logger.warn('TabStateServiceImpl: アクティブプロジェクトが見つかりません');
        return;
      }
      
      const projectId = activeProject.id;
      
      Logger.debug(`TabStateServiceImpl: タブ状態を保存します: プロジェクト=${projectId}, タブ=${tabId}`);
      
      // ProjectService経由でタブ状態を保存
      if (typeof this._projectService.saveTabState === 'function') {
        await this._projectService.saveTabState(projectId, tabId);
        
        // イベントを発行
        this._eventBus.emit(
          'project-updated',
          {
            id: projectId,
            type: 'updated',
            tabId: tabId,
            metadata: { activeTab: tabId },
            timestamp: Date.now()
          },
          'TabStateServiceImpl',
          projectId
        );
        
        Logger.info(`TabStateServiceImpl: タブ状態を保存しました: タブ=${tabId}`);
      } else {
        Logger.warn('TabStateServiceImpl: ProjectService.saveTabStateメソッドが実装されていません');
      }
    } catch (error) {
      Logger.error(`TabStateServiceImpl: タブ状態の保存中にエラーが発生しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 現在のアクティブプロジェクトのアクティブタブを取得する
   * @returns タブID（存在しない場合は'scope-progress'）
   */
  public getActiveTab(): string {
    // ProjectServiceが利用可能な場合はそこから取得
    if (this._projectService) {
      const project = this._projectService.getActiveProject();
      if (project && project.metadata && project.metadata.activeTab) {
        return project.metadata.activeTab;
      }
    }
    
    // ProjectServiceから取得できない場合はデフォルト値を返す
    return 'scope-progress';
  }
  
  /**
   * メッセージハンドラーを登録する
   * @param messageService IMessageDispatchServiceのインスタンス
   */
  public registerMessageHandlers(messageService: IMessageDispatchService): void {
    try {
      // selectTab ハンドラー
      messageService.registerHandler('selectTab', async (message) => {
        if (message.tabId) {
          await this.selectTab(message.tabId);
        }
      });
      
      // saveTabState ハンドラー
      messageService.registerHandler('saveTabState', async (message) => {
        if (message.tabId) {
          await this.saveTabState(message.tabId);
        }
      });
      
      // updateTabContent ハンドラー
      messageService.registerHandler('updateTabContent', async (message) => {
        if (message.tabId && message.content) {
          this.updateTabContent(message.tabId, message.content);
        }
      });
      
      Logger.info('TabStateServiceImpl: メッセージハンドラーを登録しました');
    } catch (error) {
      Logger.error(`TabStateServiceImpl: メッセージハンドラーの登録中にエラーが発生しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * リソースを解放する
   */
  public dispose(): void {
    // イベントエミッタを解放
    this._onTabChanged.dispose();
    
    // イベントリスナーを解除（AppGeniusEventBusのインスタンスは共有なので自身のリスナーのみを解除）
    // AppGeniusEventBusではunsubscribeメソッドが使用されるが、
    // 現在の実装では特定のリスナーだけを解除する機能がないため省略
    
    Logger.info('TabStateServiceImpl: リソースを解放しました');
  }
}