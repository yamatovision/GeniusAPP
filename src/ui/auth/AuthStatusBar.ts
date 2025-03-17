import * as vscode from 'vscode';
import { AuthenticationService, AuthEventType } from '../../core/auth/AuthenticationService';
import { Logger } from '../../utils/logger';

/**
 * AuthStatusBar - VSCodeのステータスバーに認証状態を表示するクラス
 * 
 * 現在のログイン状態やユーザー情報をステータスバーに表示し、
 * クリックするとログイン/ログアウト機能を提供します。
 */
export class AuthStatusBar {
  private static instance: AuthStatusBar;
  private _statusBarItem: vscode.StatusBarItem;
  private _authService: AuthenticationService;
  private _disposables: vscode.Disposable[] = [];
  private _isUpdating: boolean = false;
  
  // アイコン設定
  private readonly ICON_LOGGED_IN = '$(person-filled)';
  private readonly ICON_LOGGED_OUT = '$(person)';
  private readonly ICON_ERROR = '$(warning)';
  private readonly ICON_UPDATING = '$(sync~spin)';

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    
    // ステータスバーアイテムの作成
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    
    // 認証イベント監視
    this._registerAuthEventListeners();
    
    // 初期状態の表示
    this._updateStatusBar(this._authService.isAuthenticated());
    this._statusBarItem.show();
    
    Logger.debug('認証ステータスバーを初期化しました');
  }

  /**
   * AuthStatusBarのシングルトンインスタンスを取得
   */
  public static getInstance(): AuthStatusBar {
    if (!AuthStatusBar.instance) {
      AuthStatusBar.instance = new AuthStatusBar();
    }
    return AuthStatusBar.instance;
  }
  
  /**
   * 認証イベントリスナーを登録
   */
  private _registerAuthEventListeners(): void {
    // 認証サービスのイベントを監視
    this._disposables.push(
      this._authService.onStateChanged(state => {
        this._updateStatusBar(state.isAuthenticated);
      }),
      
      this._authService.onLoginSuccess(() => {
        this._updateStatusBar(true);
      }),
      
      this._authService.onLogout(() => {
        this._updateStatusBar(false);
      }),
      
      this._authService.onTokenRefreshed(() => {
        this._showUpdatingStatus(true);
        setTimeout(() => {
          this._showUpdatingStatus(false);
          this._updateStatusBar(this._authService.isAuthenticated());
        }, 1000);
      }),
      
      this._authService.onLoginFailed((error) => {
        // 一時的にエラーアイコンを表示
        this._showErrorStatus(error.message);
        setTimeout(() => {
          this._updateStatusBar(this._authService.isAuthenticated());
        }, 3000);
      })
    );
  }

  /**
   * ステータスバーの表示を更新
   */
  private async _updateStatusBar(isAuthenticated: boolean): Promise<void> {
    if (this._isUpdating) {
      return;
    }
    
    if (isAuthenticated) {
      const user = this._authService.getCurrentUser();
      if (user) {
        // ユーザー名を表示
        this._statusBarItem.text = `${this.ICON_LOGGED_IN} ${user.name || user.email}`;
        this._statusBarItem.tooltip = `AppGenius: ${user.name || user.email} としてログイン中\nクリックしてログアウト`;
        this._statusBarItem.command = 'appgenius.logout';
        this._statusBarItem.backgroundColor = undefined;
      } else {
        // ユーザー情報がまだ読み込まれていない場合
        this._statusBarItem.text = `${this.ICON_LOGGED_IN} AppGenius`;
        this._statusBarItem.tooltip = `AppGenius: ログイン中\nクリックしてログアウト`;
        this._statusBarItem.command = 'appgenius.logout';
        this._statusBarItem.backgroundColor = undefined;
      }
    } else {
      // 未ログイン状態
      this._statusBarItem.text = `${this.ICON_LOGGED_OUT} 未ログイン`;
      this._statusBarItem.tooltip = 'AppGenius: クリックしてログイン';
      this._statusBarItem.command = 'appgenius.login';
      this._statusBarItem.backgroundColor = undefined;
    }
  }
  
  /**
   * エラー状態を表示
   */
  private _showErrorStatus(errorMessage?: string): void {
    this._statusBarItem.text = `${this.ICON_ERROR} 認証エラー`;
    this._statusBarItem.tooltip = `AppGenius: 認証エラー\n${errorMessage || '認証中にエラーが発生しました'}`;
    this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }
  
  /**
   * 更新中状態を表示
   */
  private _showUpdatingStatus(isUpdating: boolean): void {
    this._isUpdating = isUpdating;
    
    if (isUpdating) {
      this._statusBarItem.text = `${this.ICON_UPDATING} 認証更新中...`;
      this._statusBarItem.tooltip = 'AppGenius: 認証情報を更新中...';
    } else {
      this._updateStatusBar(this._authService.isAuthenticated());
    }
  }

  /**
   * ステータスバーの表示/非表示を切り替え
   */
  public toggleVisibility(visible: boolean): void {
    if (visible) {
      this._statusBarItem.show();
    } else {
      this._statusBarItem.hide();
    }
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    this._statusBarItem.dispose();
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}