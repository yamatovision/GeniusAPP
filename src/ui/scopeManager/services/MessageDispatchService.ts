import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface Message {
  command: string;
  [key: string]: any;
}

export interface IMessageDispatchService {
  sendMessage(panel: vscode.WebviewPanel, message: Message): void;
  registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void;
  handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void>;
}

export class MessageDispatchService implements IMessageDispatchService {
  private handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>> = new Map();
  
  private static _instance: MessageDispatchService;
  
  public static getInstance(): MessageDispatchService {
    if (!MessageDispatchService._instance) {
      MessageDispatchService._instance = new MessageDispatchService();
    }
    return MessageDispatchService._instance;
  }
  
  private constructor() {}
  
  /**
   * WebViewパネルにメッセージを送信
   * @param panel VSCodeのWebViewパネル
   * @param message 送信するメッセージオブジェクト
   */
  public sendMessage(panel: vscode.WebviewPanel, message: Message): void {
    try {
      panel.webview.postMessage(message);
      Logger.debug(`MessageDispatchService: メッセージを送信しました: ${message.command}`);
    } catch (error) {
      Logger.error(`MessageDispatchService: メッセージ送信に失敗しました: ${(error as Error).message}`, error as Error);
    }
  }
  
  /**
   * メッセージハンドラを登録
   * @param command コマンド名
   * @param handler ハンドラ関数
   */
  public registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void {
    this.handlers.set(command, handler);
    Logger.debug(`MessageDispatchService: ハンドラを登録しました: ${command}`);
  }
  
  /**
   * WebViewからのメッセージを処理
   * @param message 受信したメッセージ
   * @param panel VSCodeのWebViewパネル
   */
  public async handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.debug(`MessageDispatchService: メッセージを受信しました: ${message.command}`);
      
      const handler = this.handlers.get(message.command);
      if (handler) {
        await handler(message, panel);
      } else {
        Logger.warn(`MessageDispatchService: ハンドラが未登録のコマンドです: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`MessageDispatchService: メッセージ処理でエラーが発生しました: ${(error as Error).message}`, error as Error);
      
      // エラーメッセージをWebViewに返す
      this.sendMessage(panel, {
        command: 'showError',
        message: `操作中にエラーが発生しました: ${(error as Error).message}`
      });
    }
  }
  
  /**
   * エラーメッセージを表示
   * @param panel VSCodeのWebViewパネル
   * @param message エラーメッセージ
   */
  public showError(panel: vscode.WebviewPanel, message: string): void {
    this.sendMessage(panel, {
      command: 'showError',
      message
    });
  }
  
  /**
   * 成功メッセージを表示
   * @param panel VSCodeのWebViewパネル
   * @param message 成功メッセージ
   */
  public showSuccess(panel: vscode.WebviewPanel, message: string): void {
    this.sendMessage(panel, {
      command: 'showSuccess',
      message
    });
  }
}