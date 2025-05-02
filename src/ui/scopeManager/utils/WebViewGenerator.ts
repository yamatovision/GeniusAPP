import * as vscode from 'vscode';

/**
 * WebViewGenerator
 * ScopeManagerPanelのWebView生成ロジックを分離
 */
export class WebViewGenerator {
  /**
   * WebViewのHTMLを生成
   */
  public static getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // TODO: ScopeManagerPanelから_getHtmlForWebviewの実装を移行
    throw new Error('Method not implemented.');
  }
  
  /**
   * nonce値を生成
   */
  public static getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}