import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface ITabStateService {
  saveTabState(projectId: string, tabId: string): Promise<void>;
  getActiveTab(projectId: string): string | undefined;
  onTabStateChanged: vscode.Event<{ projectId: string, tabId: string }>;
}

export class TabStateService implements ITabStateService {
  private _onTabStateChanged = new vscode.EventEmitter<{ projectId: string, tabId: string }>();
  public readonly onTabStateChanged = this._onTabStateChanged.event;
  
  private _projectTabStates: Map<string, string> = new Map();
  
  private static _instance: TabStateService;
  
  public static getInstance(): TabStateService {
    if (!TabStateService._instance) {
      TabStateService._instance = new TabStateService();
    }
    return TabStateService._instance;
  }
  
  private constructor() {}
  
  public async saveTabState(projectId: string, tabId: string): Promise<void> {
    try {
      // 現在と同じ場合は処理をスキップ
      if (this._projectTabStates.get(projectId) === tabId) {
        return;
      }
      
      // タブ状態を保存
      this._projectTabStates.set(projectId, tabId);
      
      // プロジェクトのメタデータに保存
      // (ここでProjectServiceに連携)
      
      // イベントを発火
      this._onTabStateChanged.fire({ projectId, tabId });
      
      Logger.info(`TabStateService: タブ状態を保存しました: プロジェクト=${projectId}, タブID=${tabId}`);
    } catch (error) {
      Logger.error(`TabStateService: タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  public getActiveTab(projectId: string): string | undefined {
    return this._projectTabStates.get(projectId);
  }
}