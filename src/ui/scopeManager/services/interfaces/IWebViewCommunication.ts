import * as vscode from 'vscode';
import { Message } from './common';

/**
 * WebViewとの通信機能を提供するインターフェース
 * 各サービスに組み込むことで、クライアントが直接サービスとコミュニケーションできるようになります
 */
export interface IWebViewCommunication {
  /**
   * サービスに関連するWebViewメッセージハンドラを登録
   * @param messageDispatchService メッセージディスパッチサービス
   */
  registerMessageHandlers(messageDispatchService: any): void;
  
  /**
   * WebViewにメッセージを送信
   * @param panel WebViewパネル
   * @param message 送信するメッセージ
   */
  sendToWebView(panel: vscode.WebviewPanel, message: Message): void;
  
  /**
   * WebViewにエラーメッセージを表示
   * @param panel WebViewパネル
   * @param message エラーメッセージ
   */
  showError(panel: vscode.WebviewPanel, message: string): void;
  
  /**
   * WebViewに成功メッセージを表示
   * @param panel WebViewパネル
   * @param message 成功メッセージ
   */
  showSuccess(panel: vscode.WebviewPanel, message: string): void;
}