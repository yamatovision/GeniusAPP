import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';

export interface Message {
  command: string;
  [key: string]: any;
}

export interface IMessageDispatchService {
  // 基本メッセージング機能
  sendMessage(panel: vscode.WebviewPanel, message: Message): void;
  registerHandler(command: string, handler: (message: Message, panel: vscode.WebviewPanel) => Promise<void>): void;
  handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void>;
  
  // 拡張機能: 標準メッセージ
  showError(panel: vscode.WebviewPanel, message: string): void;
  showSuccess(panel: vscode.WebviewPanel, message: string): void;
  
  // WebViewからのメッセージ処理設定
  setupMessageReceiver(panel: vscode.WebviewPanel): vscode.Disposable;
  
  // イベント
  onMessageProcessed: vscode.Event<{command: string, success: boolean}>;
}

export class MessageDispatchService implements IMessageDispatchService {
  private handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>> = new Map();
  private _disposables: vscode.Disposable[] = [];
  
  // イベントエミッター
  private _onMessageProcessed = new vscode.EventEmitter<{command: string, success: boolean}>();
  public readonly onMessageProcessed = this._onMessageProcessed.event;
  
  private static _instance: MessageDispatchService;
  
  public static getInstance(): MessageDispatchService {
    if (!MessageDispatchService._instance) {
      MessageDispatchService._instance = new MessageDispatchService();
    }
    return MessageDispatchService._instance;
  }
  
  private constructor() {
    Logger.info('MessageDispatchService: 初期化完了');
  }
  
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
   * 複数のメッセージハンドラを一括登録
   * @param handlers コマンド名とハンドラ関数のマップ
   */
  public registerHandlers(handlers: Map<string, (message: Message, panel: vscode.WebviewPanel) => Promise<void>>): void {
    handlers.forEach((handler, command) => {
      this.registerHandler(command, handler);
    });
    Logger.info(`MessageDispatchService: ${handlers.size}個のハンドラを一括登録しました`);
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
        this._onMessageProcessed.fire({ command: message.command, success: true });
      } else {
        Logger.warn(`MessageDispatchService: ハンドラが未登録のコマンドです: ${message.command}`);
        this._onMessageProcessed.fire({ command: message.command, success: false });
      }
    } catch (error) {
      Logger.error(`MessageDispatchService: メッセージ処理でエラーが発生しました: ${(error as Error).message}`, error as Error);
      
      // エラーメッセージをWebViewに返す
      this.showError(panel, `操作中にエラーが発生しました: ${(error as Error).message}`);
      this._onMessageProcessed.fire({ command: message.command, success: false });
    }
  }
  
  /**
   * WebViewからのメッセージ受信処理を設定
   * @param panel VSCodeのWebViewパネル
   * @returns 登録したイベントリスナーのDisposable
   */
  public setupMessageReceiver(panel: vscode.WebviewPanel): vscode.Disposable {
    const disposable = panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message, panel);
      },
      null,
      this._disposables
    );
    
    Logger.info('MessageDispatchService: WebViewからのメッセージ受信処理を設定しました');
    return disposable;
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
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    this._onMessageProcessed.dispose();
    
    // Disposableなリソースを解放
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    // 登録されたハンドラをクリア
    this.handlers.clear();
    
    Logger.info('MessageDispatchService: リソースを解放しました');
  }
}