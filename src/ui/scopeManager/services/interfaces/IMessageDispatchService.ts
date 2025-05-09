import * as vscode from 'vscode';
import { IService, Message } from './common';

/**
 * メッセージディスパッチサービスインターフェース
 * WebViewとバックエンドサービス間のメッセージルーティングを担当
 * 
 * 注意: このインターフェースは簡素化され、ほとんどの機能は各専門サービスに移行されました。
 * クライアントは直接必要なサービス（IFileSystemService, IProjectService, ISharingServiceなど）
 * を使用することが推奨されます。
 */
export interface IMessageDispatchService extends IService {
  // 基本メッセージング機能
  sendMessage(panel: vscode.WebviewPanel, message: Message): void;
  registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void;
  registerHandlers(handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>>): void;
  handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void>;
  
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
  
  // 拡張機能: 標準メッセージ
  showError(panel: vscode.WebviewPanel, message: string): void;
  showSuccess(panel: vscode.WebviewPanel, message: string): void;
  
  // ハンドラー登録関数
  registerProjectHandlers(): void;
  registerFileHandlers(): void;
  registerSharingHandlers(): void;
  
  // イベント
  onMessageProcessed: vscode.Event<{command: string, success: boolean}>;
}