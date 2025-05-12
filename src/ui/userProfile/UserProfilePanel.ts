import * as vscode from 'vscode';
import { SimpleAuthService } from '../../core/auth/SimpleAuthService';

/**
 * ユーザープロファイルパネルクラス
 * VSCode内でユーザー情報の表示と基本的な編集を行うパネル
 */
export class UserProfilePanel {
  /**
   * トラックされている現在のパネル。
   * ユーザープロファイルパネルは一度に1つだけ存在する。
   */
  public static currentPanel: UserProfilePanel | undefined;

  /**
   * 対応するwebviewパネルのトラッキング
   */
  private readonly _panel: vscode.WebviewPanel;
  
  /**
   * パネルの廃棄を処理するためのリソース廃棄機構
   */
  private _disposables: vscode.Disposable[] = [];

  /**
   * 認証サービス
   */
  private _authService: SimpleAuthService;

  /**
   * 新しいパネルの作成または既存パネルを表示するスタティックメソッド
   */
  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 既にパネルが存在する場合は表示する
    if (UserProfilePanel.currentPanel) {
      UserProfilePanel.currentPanel._panel.reveal(column);
      return;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      'userProfile',
      'ユーザープロファイル',
      column || vscode.ViewColumn.One,
      {
        // Webviewに制限をかけて安全性を確保
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webviews', 'userProfile')
        ],
        retainContextWhenHidden: true
      }
    );

    UserProfilePanel.currentPanel = new UserProfilePanel(panel, extensionUri);
  }

  /**
   * コンストラクタ - privateにして直接newできないようにする
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;

    // SimpleAuthServiceを初期化
    try {
      const context = (global as any).appgeniusContext;
      if (context) {
        this._authService = SimpleAuthService.getInstance(context);
      } else {
        throw new Error('コンテキストが見つかりません');
      }
    } catch (error) {
      console.error('SimpleAuthServiceの初期化に失敗しました:', error);
      throw error;
    }

    // webviewの内容を設定
    this._initWebview(extensionUri);

    // パネルが破棄されたときにクリーンアップを行う
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // webviewのメッセージハンドラーを設定
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // 初期データの読み込み
    this._loadUserProfile();
  }

  /**
   * Webviewの初期化
   */
  private _initWebview(extensionUri: vscode.Uri): void {
    this._panel.webview.html = this._getHtmlForWebview(extensionUri);
  }

  /**
   * ユーザープロファイルの読み込み
   */
  private async _loadUserProfile(): Promise<void> {
    try {
      // ユーザーの認証状態を確認
      const isAuthenticated = this._authService.isAuthenticated();
      
      if (!isAuthenticated) {
        // 認証されていない場合
        this._panel.webview.postMessage({
          type: 'authStatus',
          isAuthenticated: false
        });
        return;
      }
      
      // ユーザー情報を取得
      const userInfo = this._authService.getCurrentUser();
      
      // データをWebviewに送信
      this._panel.webview.postMessage({
        type: 'userProfile',
        isAuthenticated: true,
        userInfo
      });
    } catch (error) {
      console.error('ユーザープロファイルの読み込みに失敗しました:', error);
      
      // エラーメッセージをWebviewに送信
      this._panel.webview.postMessage({
        type: 'error',
        message: '情報の取得に失敗しました: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }

  /**
   * プロフィール更新処理
   */
  private async _updateProfile(profileData: any): Promise<void> {
    try {
      // 注: SimpleAuthServiceにはupdateProfileメソッドが存在しないため、
      // このメソッドは実際には機能しません。将来的な実装のためのスタブです。

      // 成功メッセージをWebviewに送信（テスト用）
      this._panel.webview.postMessage({
        type: 'success',
        message: 'プロファイル更新機能は現在利用できません'
      });

      // プロファイル情報を再取得
      this._loadUserProfile();
    } catch (error) {
      console.error('プロファイル更新エラー:', error);

      // エラーメッセージをWebviewに送信
      this._panel.webview.postMessage({
        type: 'error',
        message: 'プロファイルの更新に失敗しました: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }

  /**
   * パスワード変更処理
   */
  private async _changePassword(passwordData: { currentPassword: string; newPassword: string }): Promise<void> {
    try {
      // 注: SimpleAuthServiceにはchangePasswordメソッドが存在しないため、
      // このメソッドは実際には機能しません。将来的な実装のためのスタブです。

      // 成功メッセージをWebviewに送信（テスト用）
      this._panel.webview.postMessage({
        type: 'success',
        message: 'パスワード変更機能は現在利用できません'
      });
    } catch (error) {
      console.error('パスワード変更エラー:', error);

      // エラーメッセージをWebviewに送信
      this._panel.webview.postMessage({
        type: 'error',
        message: 'パスワードの変更に失敗しました: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }

  /**
   * Webviewからのメッセージハンドリング
   */
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'init':
        // 初期データの再読み込み
        await this._loadUserProfile();
        break;
        
      case 'updateProfile':
        // プロファイル更新
        if (message.profileData) {
          await this._updateProfile(message.profileData);
        }
        break;
        
      case 'changePassword':
        // パスワード変更
        if (message.passwordData) {
          await this._changePassword(message.passwordData);
        }
        break;
        
      case 'login':
        // ログイン処理
        vscode.commands.executeCommand('appgenius.login');
        break;
    }
  }

  /**
   * パネル廃棄時の処理
   */
  public dispose(): void {
    UserProfilePanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Webview用のHTML生成
   */
  private _getHtmlForWebview(extensionUri: vscode.Uri): string {
    // スタイルシートとスクリプトのURIを取得
    const styleUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'webviews', 'userProfile', 'style.css')
    );
    const scriptUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'webviews', 'userProfile', 'script.js')
    );

    // コンテンツセキュリティポリシーの設定
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>ユーザープロファイル</title>
    </head>
    <body>
      <div class="container">
        <div id="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>読み込み中...</p>
        </div>
        
        <div id="unauthenticated" class="auth-message" style="display: none;">
          <h2>ログインが必要です</h2>
          <p>プロファイル情報を表示するには、ログインしてください。</p>
          <button id="loginBtn" class="primary-button">ログイン</button>
        </div>
        
        <div id="profileContainer" style="display: none;">
          <div class="profile-header">
            <h2>ユーザープロファイル</h2>
            <div class="user-role" id="userRole"></div>
          </div>
          
          <div id="alertContainer" class="alert-container" style="display: none;"></div>
          
          <div class="tabs">
            <div class="tab-header">
              <button id="profileTab" class="tab-button active">プロファイル情報</button>
              <button id="passwordTab" class="tab-button">パスワード変更</button>
            </div>
            
            <div id="profileTabContent" class="tab-content active">
              <form id="profileForm">
                <div class="form-group">
                  <label for="name">名前</label>
                  <input type="text" id="name" name="name" class="form-control">
                </div>
                
                <div class="form-group">
                  <label for="email">メールアドレス</label>
                  <input type="email" id="email" name="email" class="form-control">
                </div>
                
                <div class="form-footer">
                  <button type="submit" class="primary-button">保存</button>
                </div>
              </form>
            </div>
            
            <div id="passwordTabContent" class="tab-content">
              <form id="passwordForm">
                <div class="form-group">
                  <label for="currentPassword">現在のパスワード</label>
                  <input type="password" id="currentPassword" name="currentPassword" class="form-control">
                </div>
                
                <div class="form-group">
                  <label for="newPassword">新しいパスワード</label>
                  <input type="password" id="newPassword" name="newPassword" class="form-control">
                  <div class="form-text">パスワードは8文字以上である必要があります</div>
                </div>
                
                <div class="form-group">
                  <label for="confirmPassword">パスワード（確認）</label>
                  <input type="password" id="confirmPassword" name="confirmPassword" class="form-control">
                </div>
                
                <div class="form-footer">
                  <button type="submit" class="primary-button">パスワードを変更</button>
                </div>
              </form>
            </div>
          </div>
          
          <div class="profile-info">
            <h3>アカウント情報</h3>
            <div class="info-grid">
              <div class="info-label">ユーザーID:</div>
              <div class="info-value" id="userId"></div>
              
              <div class="info-label">登録日:</div>
              <div class="info-value" id="createdAt"></div>
              
              <div class="info-label">最終ログイン:</div>
              <div class="info-value" id="lastLogin"></div>
            </div>
          </div>
        </div>
      </div>
      
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  /**
   * CSP用のランダムなnonceを生成
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}