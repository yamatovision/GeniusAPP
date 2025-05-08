import * as vscode from 'vscode';
import * as fs from 'fs';
import { Logger } from '../../../utils/logger';
import { ServiceFactory } from './ServiceFactory';
import { IMessageDispatchService } from './interfaces/IMessageDispatchService';
import { Message } from './interfaces/common';
import { FileSystemService } from './FileSystemService';
import { ProjectService } from './ProjectService';

export interface ITabStateService {
  // 基本タブ管理
  saveTabState(projectId: string, tabId: string): Promise<void>;
  getActiveTab(projectId: string): string | undefined;
  
  // ファイル読み込み関連
  loadFileToTab(panel: vscode.WebviewPanel, tabId: string, filePath: string): Promise<void>;
  loadRequirementsFile(panel: vscode.WebviewPanel): Promise<void>;
  
  // タブ内容更新
  updateTabContent(panel: vscode.WebviewPanel, tabId: string, content: string, filePath?: string): Promise<void>;
  
  // イベント
  onTabStateChanged: vscode.Event<{ projectId: string, tabId: string }>;
  
  // メッセージハンドラー登録
  registerMessageHandlers(messageService: IMessageDispatchService): void;
}

export class TabStateService implements ITabStateService {
  private _onTabStateChanged = new vscode.EventEmitter<{ projectId: string, tabId: string }>();
  public readonly onTabStateChanged = this._onTabStateChanged.event;
  
  private _projectTabStates: Map<string, string> = new Map();
  private _projectService: ProjectService;
  private _fileSystemService: FileSystemService;
  
  private static _instance: TabStateService;
  
  public static getInstance(): TabStateService {
    if (!TabStateService._instance) {
      TabStateService._instance = new TabStateService();
    }
    return TabStateService._instance;
  }
  
  private constructor() {
    this._projectService = ProjectService.getInstance();
    this._fileSystemService = FileSystemService.getInstance();
    Logger.info('TabStateService: 初期化完了');
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
      
      // タブ状態を保存
      this._projectTabStates.set(projectId, tabId);
      
      // プロジェクトのメタデータに保存
      await this._projectService.saveTabState(projectId, tabId);
      
      // イベントを発火
      this._onTabStateChanged.fire({ projectId, tabId });
      
      Logger.info(`TabStateService: タブ状態を保存しました: プロジェクト=${projectId}, タブID=${tabId}`);
    } catch (error) {
      Logger.error(`TabStateService: タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * プロジェクトの現在アクティブなタブを取得
   * @param projectId プロジェクトID
   * @returns アクティブなタブID
   */
  public getActiveTab(projectId: string): string | undefined {
    return this._projectTabStates.get(projectId);
  }
  
  /**
   * 指定したタブにファイルを読み込む
   * @param panel WebViewパネル
   * @param tabId タブID
   * @param filePath ファイルパス
   */
  public async loadFileToTab(panel: vscode.WebviewPanel, tabId: string, filePath: string): Promise<void> {
    try {
      Logger.info(`TabStateService: タブにファイルを読み込みます: タブID=${tabId}, ファイル=${filePath}`);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        const messageService = ServiceFactory.getMessageService();
        messageService.showError(panel, `ファイルが見つかりません: ${filePath}`);
        return;
      }
      
      // ファイルの内容を読み込む
      const content = await this._fileSystemService.readMarkdownFile(filePath);
      
      // タブ内容を更新
      await this.updateTabContent(panel, tabId, content, filePath);
      
      // アクティブなプロジェクトがあれば、そのタブ状態を保存
      const activeProject = this._projectService.getActiveProject();
      if (activeProject && activeProject.id) {
        await this.saveTabState(activeProject.id, tabId);
      }
    } catch (error) {
      Logger.error(`TabStateService: タブへのファイル読み込みに失敗しました: ${(error as Error).message}`, error as Error);
      const messageService = ServiceFactory.getMessageService();
      messageService.showError(panel, `ファイル読み込み中にエラーが発生しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 要件定義ファイルをタブに読み込む
   * @param panel WebViewパネル
   */
  public async loadRequirementsFile(panel: vscode.WebviewPanel): Promise<void> {
    try {
      const activeProject = this._projectService.getActiveProject();
      if (!activeProject || !activeProject.path) {
        const messageService = ServiceFactory.getMessageService();
        messageService.showError(panel, '要件定義ファイルを読み込むためのアクティブプロジェクトがありません');
        return;
      }
      
      // 要件定義ファイルのパスを決定
      const requirementsPath = await this._fileSystemService.findRequirementsFile(activeProject.path);
      if (!requirementsPath) {
        const messageService = ServiceFactory.getMessageService();
        messageService.showError(panel, '要件定義ファイルが見つかりません');
        return;
      }
      
      // 'requirements'タブに要件定義ファイルを読み込む
      await this.loadFileToTab(panel, 'requirements', requirementsPath);
    } catch (error) {
      Logger.error(`TabStateService: 要件定義ファイルの読み込みに失敗しました: ${(error as Error).message}`, error as Error);
      const messageService = ServiceFactory.getMessageService();
      messageService.showError(panel, `要件定義ファイル読み込み中にエラーが発生しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * タブの内容を更新する
   * @param panel WebViewパネル
   * @param tabId タブID
   * @param content タブの内容
   * @param filePath ファイルパス（オプション）
   */
  public async updateTabContent(panel: vscode.WebviewPanel, tabId: string, content: string, filePath?: string): Promise<void> {
    try {
      // タブ内の.markdown-contentにコンテンツを表示
      const messageService = ServiceFactory.getMessageService();
      messageService.sendMessage(panel, {
        command: 'updateTabContent',
        tabId: tabId,
        content: content,
        filePath: filePath
      });
      
      Logger.debug(`TabStateService: タブ内容を更新しました: タブID=${tabId}`);
    } catch (error) {
      Logger.error(`TabStateService: タブ内容の更新に失敗しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * メッセージハンドラーをMessageDispatchServiceに登録
   * @param messageService IMessageDispatchServiceのインスタンス
   */
  public registerMessageHandlers(messageService: IMessageDispatchService): void {
    // saveTabState ハンドラー
    messageService.registerHandler('saveTabState', async (message: Message, panel: vscode.WebviewPanel) => {
      const activeProject = this._projectService.getActiveProject();
      if (activeProject && activeProject.id && message.tabId) {
        await this.saveTabState(activeProject.id, message.tabId);
      }
    });
    
    // loadFileToTab ハンドラー
    messageService.registerHandler('loadFileToTab', async (message: Message, panel: vscode.WebviewPanel) => {
      if (message.tabId && message.filePath) {
        await this.loadFileToTab(panel, message.tabId, message.filePath);
      }
    });
    
    // loadRequirementsFile ハンドラー
    messageService.registerHandler('loadRequirementsFile', async (_: Message, panel: vscode.WebviewPanel) => {
      await this.loadRequirementsFile(panel);
    });
    
    Logger.info('TabStateService: メッセージハンドラーを登録しました');
  }
}