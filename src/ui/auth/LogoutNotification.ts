import * as vscode from 'vscode';
import { SimpleAuthService } from '../../core/auth/SimpleAuthService';

/**
 * LogoutNotification - ログアウト関連の通知を管理するクラス
 * 
 * 強制ログアウトなどの通知や、再ログインプロンプトの表示を担当します。
 */
export class LogoutNotification {
  private static instance: LogoutNotification;
  private _authService: SimpleAuthService;
  private _disposables: vscode.Disposable[] = [];
  
  // ログアウト理由の定義
  private readonly LOGOUT_REASONS = {
    EXPIRED: 'トークンの期限が切れました',
    REVOKED: '管理者によってアクセスが無効化されました',
    ACCOUNT_DISABLED: 'アカウントが無効化されました',
    ACCOUNT_DELETED: 'アカウントが削除されました',
    SECURITY: 'セキュリティ上の理由によりログアウトされました',
    USER_REQUESTED: 'ユーザーによるログアウトリクエスト',
    TIMEOUT: 'サーバー接続がタイムアウトしました',
    UNKNOWN: '不明な理由によりログアウトされました'
  };

  /**
   * コンストラクタ
   */
  private constructor() {
    // SimpleAuthServiceの初期化
    try {
      const context = (global as any).appgeniusContext;
      if (context) {
        this._authService = SimpleAuthService.getInstance(context);

        // 認証状態変更イベントをリッスン
        this._disposables.push(
          this._authService.onStateChanged(state => {
            this._handleAuthStateChange(state.isAuthenticated);
          })
        );
      }
    } catch (error) {
      console.error('SimpleAuthServiceの初期化に失敗しました', error);
    }
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
  public showLogoutNotification(reason: 'EXPIRED' | 'TIMEOUT' | 'ACCOUNT_DELETED' | 'MANUAL' = 'MANUAL'): void {
    try {
      let message = 'ログアウトしました';
      let detail = '';

      switch (reason) {
        case 'EXPIRED':
          message = 'セッションの有効期限が切れました';
          detail = '再度ログインしてください。';
          break;
        case 'TIMEOUT':
          message = 'サーバー接続がタイムアウトしました';
          detail = 'ネットワーク接続を確認し、再度ログインしてください。';
          break;
        case 'ACCOUNT_DELETED':
          message = 'アカウントが削除されました';
          detail = 'このアカウントは管理者によって削除されました。別のアカウントでログインするか、管理者に連絡してください。';
          break;
        case 'MANUAL':
        default:
          message = 'ログアウトしました';
          detail = '再度ログインするには認証してください。';
          break;
      }

      // ログアウト通知を表示
      vscode.window.showWarningMessage(
        `AppGenius: ${message}`,
        { detail: detail, modal: reason === 'ACCOUNT_DELETED' },
        'ログインページを開く'
      ).then(selection => {
        if (selection === 'ログインページを開く') {
          vscode.commands.executeCommand('appgenius.login');
        }
      });
    } catch (error) {
      // エラーハンドリング
      console.error('ログアウト通知の表示中にエラーが発生しました', error);
      // フォールバックとして基本的な通知を表示
      vscode.window.showWarningMessage(
        `AppGenius: ログアウトしました`,
        'ログインページを開く'
      ).then(selection => {
        if (selection === 'ログインページを開く') {
          vscode.commands.executeCommand('appgenius.login');
        }
      });
    }
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