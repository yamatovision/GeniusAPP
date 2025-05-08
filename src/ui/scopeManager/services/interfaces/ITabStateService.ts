import * as vscode from 'vscode';
import { IService } from './common';
import { MessageDispatchService } from '../MessageDispatchService';

/**
 * タブ状態管理サービスインターフェース
 * スコープマネージャーのタブ状態管理に関する責務を担当
 */
export interface ITabStateService extends IService {
  // タブ操作
  selectTab(tabId: string): Promise<void>;
  updateTabContent(tabId: string, content: string): void;
  saveTabState(projectId: string, tabId: string): Promise<void>;
  
  // メッセージハンドラー登録
  registerMessageHandlers(messageService: MessageDispatchService): void;
  
  // イベント
  onTabChanged: vscode.Event<string>;
}