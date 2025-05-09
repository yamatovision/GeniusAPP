import * as vscode from 'vscode';
import { IService } from './common';
import { IMessageDispatchService } from './IMessageDispatchService';

/**
 * タブ状態管理サービスインターフェース
 * スコープマネージャーのタブ状態管理に関する責務を担当
 */
export interface ITabStateService extends IService {
  // タブ操作
  selectTab(tabId: string): Promise<void>;
  updateTabContent(tabId: string, content: string): void;
  saveTabState(tabId: string): Promise<void>;
  getActiveTab(): string;
  
  // メッセージハンドラー登録
  registerMessageHandlers(messageService: IMessageDispatchService): void;
  
  // イベント
  onTabChanged: vscode.Event<string>;
}