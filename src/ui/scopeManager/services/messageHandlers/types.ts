import * as vscode from 'vscode';

/**
 * メッセージハンドラーインターフェース
 * ScopeManagerPanelのメッセージ処理責務を分離するためのインターフェース
 */
export interface IMessageHandler {
  /**
   * このハンドラーが処理できるコマンドかどうかを判定
   * @param command コマンド名
   * @returns このハンドラーで処理可能な場合はtrue
   */
  canHandle(command: string): boolean;

  /**
   * メッセージを処理する
   * @param message 受信したメッセージオブジェクト
   * @param panel WebviewPanel
   * @param context コンテキスト情報
   * @returns 処理が成功した場合はtrue、このハンドラーでは処理できない場合はfalse
   */
  handleMessage(
    message: any,
    panel: vscode.WebviewPanel, 
    context: {
      projectPath: string,
      showError: (message: string) => void,
      showSuccess: (message: string) => void,
      [key: string]: any
    }
  ): Promise<boolean>;
}