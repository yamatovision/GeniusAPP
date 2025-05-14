import * as vscode from 'vscode';
import { SimpleAuthService } from '../../core/auth/SimpleAuthService';
import { Logger } from '../../utils/logger';

/**
 * AuthStatusBar - VSCodeのステータスバーに認証状態を表示するクラス
 *
 * 現在のログイン状態やユーザー情報をステータスバーに表示し、
 * クリックするとログイン/ログアウト機能を提供します。
 * SimpleAuthServiceを使用した認証をサポートします。
 */
export class AuthStatusBar {
  private static instance: AuthStatusBar;
  private _statusBarItem: vscode.StatusBarItem;
  private _simpleAuthService: SimpleAuthService | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _isUpdating: boolean = false;
  
  // アイコン設定
  private readonly ICON_LOGGED_IN = '$(person-filled)';
  private readonly ICON_LOGGED_OUT = '$(person)';
  private readonly ICON_ERROR = '$(warning)';
  private readonly ICON_UPDATING = '$(sync~spin)';
  private readonly ICON_API_KEY = '$(key)';

  /**
   * コンストラクタ
   */
  private constructor() {
    // Simple認証サービスの初期化
    try {
      const context = (global as any).appgeniusContext;
      if (context) {
        this._simpleAuthService = SimpleAuthService.getInstance(context);
        Logger.debug('SimpleAuthServiceをStatusBarに初期化しました');
      }
    } catch (error) {
      Logger.debug('SimpleAuthServiceの初期化に失敗しました', error);
    }

    // ステータスバーアイテムの作成
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );

    // 認証イベント監視
    this._registerAuthEventListeners();

    // 初期状態の表示
    this._updateAuthStatus();
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
    // Simple認証サービスのイベントを監視
    if (this._simpleAuthService) {
      this._disposables.push(
        this._simpleAuthService.onStateChanged(state => {
          this._updateAuthStatus();
        }),

        this._simpleAuthService.onLoginSuccess(() => {
          this._updateAuthStatus();
        }),

        this._simpleAuthService.onLogout(() => {
          this._updateAuthStatus();
        }),

        this._simpleAuthService.onLoginFailed((error) => {
          // 一時的にエラーアイコンを表示
          this._showErrorStatus(error.message);
          setTimeout(() => {
            this._updateAuthStatus();
          }, 3000);
        })
      );
    }
  }

  /**
   * 認証状態を確認して表示を更新
   */
  private _updateAuthStatus(): void {
    // Simple認証が利用可能でログイン済みの場合
    if (this._simpleAuthService && this._simpleAuthService.isAuthenticated()) {
      this._updateStatusBarForSimpleAuth();
    } else {
      // 未ログイン状態
      this._updateStatusBarForLoggedOut();
    }
  }

  /**
   * 認証済み状態のステータスバー表示更新
   */
  private _updateStatusBarForSimpleAuth(): void {
    if (this._isUpdating || !this._simpleAuthService) {
      return;
    }

    const state = this._simpleAuthService.getCurrentState();

    // APIキー機能は廃止されたため、常に通常のログインアイコンを表示
    const icon = this.ICON_LOGGED_IN;
    const displayName = state.username || 'ユーザー';

    this._statusBarItem.text = `${icon} ${displayName}`;

    // ツールチップにAPIキー情報を追加
    const apiKeyInfo = 'トークン認証'; // APIキー機能は廃止されました
    this._statusBarItem.tooltip = `ブルーランプ: ${displayName} としてログイン中 (${apiKeyInfo})\nクリックしてログアウト`;

    this._statusBarItem.command = 'appgenius.logout';
    this._statusBarItem.backgroundColor = undefined;
  }


  /**
   * 未ログイン状態の表示更新
   */
  private _updateStatusBarForLoggedOut(): void {
    this._statusBarItem.text = `${this.ICON_LOGGED_OUT} 未ログイン`;
    this._statusBarItem.tooltip = 'ブルーランプ: クリックしてログイン';
    this._statusBarItem.command = 'appgenius.login';
    this._statusBarItem.backgroundColor = undefined;
  }
  
  /**
   * エラー状態を表示
   */
  private _showErrorStatus(errorMessage?: string): void {
    this._statusBarItem.text = `${this.ICON_ERROR} 認証エラー`;
    this._statusBarItem.tooltip = `ブルーランプ: 認証エラー\n${errorMessage || '認証中にエラーが発生しました'}`;
    this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }
  
  /**
   * 更新中状態を表示
   */
  private _showUpdatingStatus(isUpdating: boolean): void {
    this._isUpdating = isUpdating;
    
    if (isUpdating) {
      this._statusBarItem.text = `${this.ICON_UPDATING} 認証更新中...`;
      this._statusBarItem.tooltip = 'ブルーランプ: 認証情報を更新中...';
    } else {
      this._updateAuthStatus();
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