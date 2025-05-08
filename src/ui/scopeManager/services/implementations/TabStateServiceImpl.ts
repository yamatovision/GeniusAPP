import * as vscode from 'vscode';
import { Logger } from '../../../../utils/logger';
import { ITabStateService } from '../interfaces/ITabStateService';
import { MessageDispatchService } from '../MessageDispatchService';
import { IProjectService } from '../interfaces/IProjectService';
import { IFileSystemService } from '../interfaces/IFileSystemService';
import { EventBus } from '../../../../services/EventBus';

/**
 * タブ状態管理サービスの実装
 * タブの選択状態や表示状態などのUIに関わる状態を管理
 */
export class TabStateServiceImpl implements ITabStateService {
  // タブ状態の保存用マップ（プロジェクトIDからタブIDへのマッピング）
  private _projectTabStates: Map<string, string> = new Map();
  
  // イベント発行用
  private _onTabChanged = new vscode.EventEmitter<string>();
  public readonly onTabChanged = this._onTabChanged.event;
  
  // イベントバス
  private _eventBus: EventBus;
  
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
    this._eventBus = EventBus.getInstance();
    
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
      
      // 現在のアクティブプロジェクトを取得
      if (!this._projectService) {
        throw new Error('ProjectServiceが設定されていません');
      }
      
      const activeProject = this._projectService.getActiveProject();
      if (!activeProject || !activeProject.id) {
        Logger.warn('TabStateServiceImpl: アクティブプロジェクトがありません');
        return;
      }
      
      // タブ状態を更新
      await this.saveTabState(activeProject.id, tabId);
      
      // タブ変更イベントを発行
      this._onTabChanged.fire(tabId);
      
      // グローバルイベントも発行
      this._eventBus.emit('tab-changed', {
        projectId: activeProject.id,
        tabId: tabId
      });
      
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
      this._eventBus.emit('tab-content-updated', {
        tabId: tabId,
        content: content
      });
      
      Logger.info(`TabStateServiceImpl: タブ内容を更新しました: ${tabId}`);
    } catch (error) {
      Logger.error(`TabStateServiceImpl: タブ内容の更新中にエラーが発生しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * タブ状態を保存する
   * @param projectId プロジェクトID
   * @param tabId タブID
   */
  public async saveTabState(projectId: string, tabId: string): Promise<void> {
    try {
      // 現在と同じ場合は処理をスキップ
      if (this._projectTabStates.get(projectId) === tabId) {
        return;
      }
      
      Logger.debug(`TabStateServiceImpl: タブ状態を保存します: プロジェクト=${projectId}, タブ=${tabId}`);
      
      // タブ状態をメモリに保存
      this._projectTabStates.set(projectId, tabId);
      
      // プロジェクトサービスが利用可能な場合、メタデータに保存
      if (this._projectService) {
        if (typeof this._projectService.saveTabState === 'function') {
          await this._projectService.saveTabState(projectId, tabId);
        } else {
          Logger.warn('TabStateServiceImpl: ProjectService.saveTabStateメソッドが利用できません');
        }
      }
      
      // グローバルイベントを発行
      this._eventBus.emit('tab-state-saved', {
        projectId: projectId,
        tabId: tabId
      });
      
      Logger.info(`TabStateServiceImpl: タブ状態を保存しました: プロジェクト=${projectId}, タブ=${tabId}`);
    } catch (error) {
      Logger.error(`TabStateServiceImpl: タブ状態の保存中にエラーが発生しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 指定プロジェクトのアクティブタブを取得する
   * @param projectId プロジェクトID
   * @returns タブID（存在しない場合はundefined）
   */
  public getActiveTab(projectId: string): string | undefined {
    return this._projectTabStates.get(projectId);
  }
  
  /**
   * メッセージハンドラーを登録する
   * @param messageService MessageDispatchServiceのインスタンス
   */
  public registerMessageHandlers(messageService: MessageDispatchService): void {
    try {
      // selectTab ハンドラー
      messageService.registerHandler('selectTab', async (message) => {
        if (message.tabId) {
          await this.selectTab(message.tabId);
        }
      });
      
      // saveTabState ハンドラー
      messageService.registerHandler('saveTabState', async (message) => {
        if (!this._projectService) {
          Logger.warn('TabStateServiceImpl: ProjectServiceが設定されていません');
          return;
        }
        
        const activeProject = this._projectService.getActiveProject();
        if (activeProject && activeProject.id && message.tabId) {
          await this.saveTabState(activeProject.id, message.tabId);
        }
      });
      
      // updateTabContent ハンドラー
      messageService.registerHandler('updateTabContent', (message) => {
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
    
    // マップをクリア
    this._projectTabStates.clear();
    
    // イベントリスナーを解除（EventBusのインスタンスは共有なので自身のリスナーのみを解除）
    this._eventBus.off('tab-changed');
    this._eventBus.off('tab-content-updated');
    this._eventBus.off('tab-state-saved');
    
    Logger.info('TabStateServiceImpl: リソースを解放しました');
  }
}