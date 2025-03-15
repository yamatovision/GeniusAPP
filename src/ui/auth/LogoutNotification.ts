import * as vscode from 'vscode';
import { AuthenticationService } from '../../core/auth/AuthenticationService';

/**
 * LogoutNotification - ログアウト関連の通知を管理するクラス
 * 
 * 強制ログアウトなどの通知や、再ログインプロンプトの表示を担当します。
 */
export class LogoutNotification {
  private static instance: LogoutNotification;
  private _authService: AuthenticationService;
  private _disposables: vscode.Disposable[] = [];
  
  // ログアウト理由の定義
  private readonly LOGOUT_REASONS = {
    EXPIRED: 'トークンの期限が切れました',
    REVOKED: '管理者によってアクセスが無効化されました',
    ACCOUNT_DISABLED: 'アカウントが無効化されました',
    SECURITY: 'セキュリティ上の理由によりログアウトされました',
    USER_REQUESTED: 'ユーザーによるログアウトリクエスト',
    UNKNOWN: '不明な理由によりログアウトされました'
  };

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    
    // 認証状態変更イベントをリッスン
    this._disposables.push(
      this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this))
    );
  }

  /**
   * LogoutNotificationのシングルトンインスタンスを取得
   */
  public static getInstance(): LogoutNotification {
    if (!LogoutNotification.instance) {
      LogoutNotification.instance = new LogoutNotification();
    }
    return LogoutNotification.instance;
  }

  /**
   * 認証状態変更のハンドラー
   */
  private _handleAuthStateChange(isAuthenticated: boolean): void {
    // ログアウト時（認証状態がtrueからfalseに変わった時）に通知
    if (!isAuthenticated) {
      // フラグをチェックして、意図的なログアウトか強制ログアウトかを判断
      // 実際の実装では、ログアウト理由をサーバーから受け取るロジックが必要
    }
  }

  /**
   * ログアウト通知を表示
   * @param reason ログアウト理由のコード
   */
  public showLogoutNotification(reason: string = 'UNKNOWN'): void {
    const reasonMessage = this.LOGOUT_REASONS[reason] || this.LOGOUT_REASONS.UNKNOWN;
    
    // ログアウト通知を表示
    vscode.window.showWarningMessage(
      `AppGenius: ${reasonMessage}`,
      'ログインページを開く'
    ).then(selection => {
      if (selection === 'ログインページを開く') {
        vscode.commands.executeCommand('appgenius.login');
      }
    });
  }

  /**
   * 強制ログアウト通知を表示
   * @param message カスタムメッセージ
   */
  public showForcedLogoutNotification(message: string): void {
    vscode.window.showErrorMessage(
      `AppGenius: ${message}`,
      'ログインページを開く',
      '詳細を確認'
    ).then(selection => {
      if (selection === 'ログインページを開く') {
        vscode.commands.executeCommand('appgenius.login');
      } else if (selection === '詳細を確認') {
        // ヘルプページやドキュメントを開くなどの処理
        vscode.env.openExternal(vscode.Uri.parse('https://example.com/appgenius/help'));
      }
    });
  }

  /**
   * セッション有効期限切れ通知を表示
   */
  public showSessionExpiredNotification(): void {
    vscode.window.showInformationMessage(
      'AppGenius: セッションの有効期限が切れました。再度ログインしてください。',
      'ログイン'
    ).then(selection => {
      if (selection === 'ログイン') {
        vscode.commands.executeCommand('appgenius.login');
      }
    });
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}