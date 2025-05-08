import * as vscode from 'vscode';
import { IService, Message } from './common';

/**
 * メッセージディスパッチサービスインターフェース
 * WebViewとバックエンドサービス間のメッセージルーティングを担当
 */
export interface IMessageDispatchService extends IService {
  // 基本メッセージング機能
  sendMessage(panel: vscode.WebviewPanel, message: Message): void;
  registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void;
  registerHandlers(handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>>): void;
  handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void>;
  
  // 標準ハンドラー登録
  registerProjectHandlers(): void;
  registerFileHandlers(): void;
  registerSharingHandlers(): void;
  
  // 拡張機能: 標準メッセージ
  showError(panel: vscode.WebviewPanel, message: string): void;
  showSuccess(panel: vscode.WebviewPanel, message: string): void;
  
  // WebViewからのメッセージ処理設定
  setupMessageReceiver(panel: vscode.WebviewPanel): vscode.Disposable;
  
  // 依存サービスの設定
  setDependencies(services: {
    sharingService?: any;
    projectService?: any;
    fileSystemService?: any;
    uiStateService?: any;
    panelService?: any;
  }): void;
  
  // 共有関連の標準メソッド
  getHistory(panel: vscode.WebviewPanel): Promise<boolean>;
  deleteFromHistory(panel: vscode.WebviewPanel, fileId: string): Promise<void>;
  copyCommand(panel: vscode.WebviewPanel, fileId: string): Promise<void>;
  copyToClipboard(panel: vscode.WebviewPanel, text: string): Promise<void>;
  
  // プロジェクト管理メッセージハンドラー
  selectProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, activeTab?: string): Promise<boolean | void>;
  createProject(panel: vscode.WebviewPanel, projectName: string, description: string): Promise<boolean | void>;
  removeProject(panel: vscode.WebviewPanel, projectName: string, projectPath: string, projectId?: string): Promise<boolean | void>;
  
  // イベント
  onMessageProcessed: vscode.Event<{command: string, success: boolean}>;
}