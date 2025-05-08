import * as vscode from 'vscode';
import { IService, Message } from './common';
import { MessageDispatchService } from '../MessageDispatchService';
import { IProjectService } from './IProjectService';
import { PanelMessage } from '../../types/ScopeManagerTypes';

/**
 * パネルサービスインターフェース
 * WebViewパネルとその表示状態管理に関する責務を担当
 */
export interface IPanelService extends IService {
  // 基本的なパネル操作
  getPanel(): vscode.WebviewPanel | undefined;
  sendMessage(message: Message | PanelMessage): void;
  broadcastMessage?(message: PanelMessage): void;
  isPanelVisible?(): boolean;
  createPanel?(column?: vscode.ViewColumn): void;
  showPanel?(column?: vscode.ViewColumn): void;
  updatePanelContent?(): void;
  updatePanel?(projectInfo?: any, activeTabId?: string): void;
  disposePanel?(): void;
  
  // WebView表示の更新
  updateMarkdownContent?(content: string): void;
  showSuccess?(message: string): void;
  showError?(message: string): void;
  updateSharingHistory?(history: any[]): void;
  
  // 初期化と同期
  initializePanel?(projectPath?: string): Promise<void>;
  
  // 依存サービス設定
  setProjectService?(projectService: IProjectService): void;
  setMessageService?(messageService: MessageDispatchService): void;
  
  // イベント
  onMessageReceived: vscode.Event<any>;
  onPanelDisposed: vscode.Event<void>;
  onPanelCreated?: vscode.Event<vscode.WebviewPanel>;
  
  // サービス間連携用 - プロジェクト同期関数
  syncActiveProject?(project: any): Promise<void>;
}