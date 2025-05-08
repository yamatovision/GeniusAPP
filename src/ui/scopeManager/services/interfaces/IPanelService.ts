import * as vscode from 'vscode';
import { IService } from './common';
import { IProjectInfo } from '../../types/ScopeManagerTypes';

/**
 * パネルサービスインターフェース
 * WebViewパネルの管理と操作を担当
 */
export interface IPanelService extends IService {
  /**
   * パネルを作成
   * @param column 表示列
   */
  createPanel(column?: vscode.ViewColumn): void;
  
  /**
   * パネルを表示
   * @param column 表示列
   */
  showPanel(column?: vscode.ViewColumn): void;
  
  /**
   * パネルの内容を更新
   */
  updatePanelContent(): void;
  
  /**
   * パネルを破棄
   */
  disposePanel(): void;
  
  /**
   * メッセージを送信
   * @param message 送信するメッセージ
   */
  sendMessage(message: any): void;
  
  /**
   * メッセージをブロードキャスト
   * @param message 送信するメッセージ
   */
  broadcastMessage(message: any): void;
  
  /**
   * パネル作成イベント
   */
  onPanelCreated: vscode.Event<vscode.WebviewPanel>;
  
  /**
   * パネル破棄イベント
   */
  onPanelDisposed: vscode.Event<void>;
  
  /**
   * メッセージ受信イベント
   */
  onMessageReceived: vscode.Event<any>;
  
  /**
   * パネルが表示されているかどうか
   */
  isPanelVisible(): boolean;
  
  /**
   * パネルを取得
   * @returns WebViewパネルインスタンス
   */
  getPanel(): vscode.WebviewPanel | undefined;
  
  /**
   * リソースを解放
   */
  dispose(): void;
  
  /**
   * ProjectServiceを設定
   * @param projectService プロジェクトサービス
   */
  setProjectService(projectService: any): void;
  
  /**
   * FileSystemServiceを設定
   * @param fileSystemService ファイルシステムサービス
   */
  setFileSystemService(fileSystemService: any): void;
  
  /**
   * MessageServiceを設定
   * @param messageService メッセージサービス
   */
  setMessageService(messageService: any): void;
  
  /**
   * TabStateServiceを設定
   * @param tabStateService タブ状態サービス
   */
  setTabStateService(tabStateService: any): void;
  
  /**
   * パネルを初期化
   * @param projectPath プロジェクトパス
   */
  initializePanel(projectPath?: string): Promise<void>;
  
  /**
   * アクティブプロジェクトを同期
   * @param project プロジェクト情報
   */
  syncActiveProject(project: IProjectInfo): Promise<void>;
}