import * as vscode from 'vscode';

/**
 * WebViewのHTMLテンプレート生成を担当するユーティリティクラス
 */
export class HtmlTemplateGenerator {
  /**
   * nonce値を生成するユーティリティメソッド
   */
  public static generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * CSP (Content Security Policy) ヘッダを生成
   * @param webview VSCode Webviewインスタンス
   * @param nonce 生成されたnonce値
   */
  public static generateCSP(webview: vscode.Webview, nonce: string): string {
    return `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com;
      font-src https://fonts.gstatic.com;
      script-src 'nonce-${nonce}';
      img-src ${webview.cspSource} data:;
      connect-src ${webview.cspSource};
    `;
  }
}