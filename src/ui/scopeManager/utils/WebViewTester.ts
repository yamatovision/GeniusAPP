import * as vscode from 'vscode';
import { WebViewMessageHandler } from '../viewModel/WebViewMessageHandler';
import { Logger } from '../../../utils/logger';

/**
 * WebViewTester
 * WebViewMessageHandlerのテストをサポートするユーティリティクラス
 */
export class WebViewTester {
  private _handler: WebViewMessageHandler;
  private _mockPanel: vscode.WebviewPanel;
  private _receivedMessages: any[] = [];
  
  /**
   * WebViewTesterを作成
   */
  public static create(): WebViewTester {
    // パネルのモックを作成
    const mockPanel = {
      webview: {
        onDidReceiveMessage: (callback: (message: any) => void) => {
          return { dispose: () => {} };
        },
        postMessage: (message: any) => {
          Logger.info(`Mock webview received message: ${JSON.stringify(message)}`);
          return Promise.resolve(true);
        }
      },
      dispose: () => {}
    } as unknown as vscode.WebviewPanel;
    
    // WebViewMessageHandlerのインスタンスをリセット
    WebViewMessageHandler.resetInstance();
    
    // 新しいハンドラーを作成
    const handler = WebViewMessageHandler.getInstance(mockPanel);
    
    return new WebViewTester(handler, mockPanel);
  }
  
  private constructor(handler: WebViewMessageHandler, mockPanel: vscode.WebviewPanel) {
    this._handler = handler;
    this._mockPanel = mockPanel;
    
    // メッセージ受信をモック
    (this._mockPanel.webview.postMessage as any) = (message: any) => {
      this._receivedMessages.push(message);
      Logger.info(`WebViewTester: メッセージ送信をキャプチャ: ${JSON.stringify(message)}`);
      return Promise.resolve(true);
    };
  }
  
  /**
   * メッセージハンドラーを登録
   */
  public registerHandler(command: string, handler: (message: any) => Promise<void>): WebViewTester {
    this._handler.registerHandler(command, handler);
    return this;
  }
  
  /**
   * メッセージを処理
   */
  public async sendMessage(message: any): Promise<void> {
    await this._handler.handleMessage(message);
  }
  
  /**
   * 送信されたメッセージを取得
   */
  public getSentMessages(): any[] {
    return [...this._receivedMessages];
  }
  
  /**
   * 最後に送信されたメッセージを取得
   */
  public getLastSentMessage(): any {
    if (this._receivedMessages.length === 0) {
      return null;
    }
    return this._receivedMessages[this._receivedMessages.length - 1];
  }
  
  /**
   * 指定されたコマンドの送信されたメッセージを取得
   */
  public getSentMessagesByCommand(command: string): any[] {
    return this._receivedMessages.filter(msg => msg.command === command);
  }
  
  /**
   * 送信されたメッセージをクリア
   */
  public clearSentMessages(): void {
    this._receivedMessages = [];
  }
  
  /**
   * テスト用にシンプルなエコーハンドラーを登録
   */
  public setupEchoHandler(): WebViewTester {
    this.registerHandler('echo', async (message) => {
      this._handler.postMessage({
        command: 'echo_response',
        data: message.data
      });
    });
    return this;
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    WebViewMessageHandler.resetInstance();
  }
}