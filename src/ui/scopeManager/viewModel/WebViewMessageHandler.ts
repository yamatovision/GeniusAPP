import * as vscode from 'vscode';
import { WebViewMessage, IWebViewMessageHandler } from '../types/ScopeManagerTypes';
import { Logger } from '../../../utils/logger';

/**
 * WebViewメッセージハンドラー実装クラス
 * ScopeManagerPanelのWebViewメッセージ処理を分離
 */
export class WebViewMessageHandler implements IWebViewMessageHandler {
  private _messageHandlers: Map<string, (message: WebViewMessage) => Promise<void>> = new Map();
  private _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  
  // シングルトンインスタンス
  private static _instance: WebViewMessageHandler | null = null;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(panel?: vscode.WebviewPanel): WebViewMessageHandler {
    if (!WebViewMessageHandler._instance && panel) {
      WebViewMessageHandler._instance = new WebViewMessageHandler(panel);
    } else if (!WebViewMessageHandler._instance && !panel) {
      throw new Error('WebViewMessageHandlerをインスタンス化するにはWebViewPanelが必要です');
    }
    return WebViewMessageHandler._instance!;
  }
  
  /**
   * インスタンスをリセット（主にテスト用）
   */
  public static resetInstance(): void {
    if (WebViewMessageHandler._instance) {
      WebViewMessageHandler._instance.dispose();
      WebViewMessageHandler._instance = null;
    }
  }
  
  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this.setupBaseHandlers();
  }
  
  /**
   * パネルを更新
   */
  public updatePanel(panel: vscode.WebviewPanel): void {
    this._panel = panel;
  }
  
  /**
   * メッセージハンドラーを登録
   */
  public registerHandler(command: string, handler: (message: WebViewMessage) => Promise<void>): void {
    if (this._messageHandlers.has(command)) {
      Logger.warn(`WebViewMessageHandler: コマンド '${command}' のハンドラーが上書きされます`);
    }
    this._messageHandlers.set(command, handler);
    Logger.info(`WebViewMessageHandler: コマンド '${command}' のハンドラーを登録しました`);
  }
  
  /**
   * 基本的なハンドラーを設定
   */
  private setupBaseHandlers(): void {
    // 基本的なシステムコマンドを登録
    this.registerHandler('ping', async () => {
      this.postMessage({ command: 'pong', timestamp: Date.now() });
    });
  }
  
  /**
   * メッセージを処理
   */
  public async handleMessage(message: WebViewMessage): Promise<void> {
    try {
      Logger.info(`WebViewMessageHandler: メッセージ受信 '${message.command}'`);
      
      const handler = this._messageHandlers.get(message.command);
      
      if (handler) {
        await handler(message);
      } else {
        Logger.warn(`WebViewMessageHandler: 未登録のメッセージコマンド: ${message.command}`);
        this.showError(`未登録のコマンド: ${message.command}`);
      }
    } catch (error) {
      Logger.error(`WebViewMessageHandler: メッセージ処理エラー: ${message.command}`, error as Error);
      this.showError(`操作に失敗しました: ${(error as Error).message}`);
      throw error; // 呼び出し元でもエラーをハンドリングできるように再スロー
    }
  }
  
  /**
   * メッセージ処理を設定
   */
  public setupMessageHandling(): vscode.Disposable {
    // WebViewからのメッセージを処理
    const messageListener = this._panel.webview.onDidReceiveMessage(
      async (message: WebViewMessage) => {
        try {
          await this.handleMessage(message);
        } catch (error) {
          // エラーはすでにhandleMessage内でログ出力されているため、ここでは何もしない
        }
      }
    );
    
    this._disposables.push(messageListener);
    return messageListener;
  }
  
  /**
   * WebViewにメッセージを送信
   */
  public postMessage(message: any): Thenable<boolean> {
    return this._panel.webview.postMessage(message);
  }
  
  /**
   * エラーメッセージを表示
   */
  public showError(message: string): void {
    this.postMessage({
      command: 'showError',
      message: message
    });
  }
  
  /**
   * 成功メッセージを表示
   */
  public showSuccess(message: string): void {
    this.postMessage({
      command: 'showSuccess',
      message: message
    });
  }
  
  /**
   * マークダウンコンテンツを更新
   */
  public updateMarkdownContent(content: string): void {
    this.postMessage({
      command: 'updateMarkdownContent',
      content: content
    });
  }
  
  /**
   * ディレクトリ構造を表示
   */
  public showDirectoryStructure(structure: string): void {
    this.postMessage({
      command: 'showDirectoryStructure',
      structure: structure
    });
  }
  
  /**
   * プロジェクト一覧を更新
   */
  public updateProjects(projects: any[], activeProject: any | null): void {
    this.postMessage({
      command: 'updateProjects',
      projects: projects,
      activeProject: activeProject
    });
  }
  
  /**
   * プロジェクトパスを更新
   */
  public updateProjectPath(projectPath: string, statusFilePath: string, statusFileExists: boolean): void {
    this.postMessage({
      command: 'updateProjectPath',
      projectPath: projectPath,
      statusFilePath: statusFilePath,
      statusFileExists: statusFileExists
    });
  }
  
  /**
   * プロジェクト名を更新
   */
  public updateProjectName(projectName: string): void {
    this.postMessage({
      command: 'updateProjectName',
      projectName: projectName
    });
  }
  
  /**
   * 共有履歴を更新
   */
  public updateSharingHistory(history: any[]): void {
    this.postMessage({
      command: 'updateSharingHistory',
      history: history
    });
  }
  
  /**
   * 共有結果を表示
   */
  public showShareResult(data: any): void {
    this.postMessage({
      command: 'showShareResult',
      data: data
    });
  }
  
  /**
   * ドロップゾーンをリセット
   */
  public resetDropZone(force: boolean = true): void {
    this.postMessage({
      command: 'resetDropZone',
      force: force,
      timestamp: new Date().getTime()
    });
  }
  
  /**
   * プロジェクト状態を同期
   */
  public syncProjectState(project: any): void {
    this.postMessage({
      command: 'syncProjectState',
      project: project
    });
  }
  
  /**
   * コマンドコピー完了通知
   */
  public commandCopied(fileId: string, fileName: string): void {
    this.postMessage({
      command: 'commandCopied',
      fileId: fileId,
      fileName: fileName
    });
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}