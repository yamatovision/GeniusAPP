import * as vscode from 'vscode';
import { AuthenticationService, AuthEventType } from '../../core/auth/AuthenticationService';
import { SimpleAuthService } from '../../core/auth/SimpleAuthService';
import { Logger } from '../../utils/logger';

/**
 * AuthStatusBar - VSCodeのステータスバーに認証状態を表示するクラス
 * 
 * 現在のログイン状態やユーザー情報をステータスバーに表示し、
 * クリックするとログイン/ログアウト機能を提供します。
 * レガシー認証とSimple認証の両方をサポートします。
 */
export class AuthStatusBar {
  private static instance: AuthStatusBar;
  private _statusBarItem: vscode.StatusBarItem;
  private _authService: AuthenticationService;
  private _simpleAuthService: SimpleAuthService | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _isUpdating: boolean = false;
  private _useSimpleAuth: boolean = false;
  
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
    this._authService = AuthenticationService.getInstance();
    
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
    // レガシー認証サービスのイベントを監視
    this._disposables.push(
      this._authService.onStateChanged(state => {
        if (!this._useSimpleAuth) {
          this._updateAuthStatus();
        }
      }),
      
      this._authService.onLoginSuccess(() => {
        if (!this._useSimpleAuth) {
          this._useSimpleAuth = false;
          this._updateAuthStatus();
        }
      }),
      
      this._authService.onLogout(() => {
        if (!this._useSimpleAuth) {
          this._updateAuthStatus();
        }
      }),
      
      this._authService.onTokenRefreshed(() => {
        if (!this._useSimpleAuth) {
          this._showUpdatingStatus(true);
          setTimeout(() => {
            this._showUpdatingStatus(false);
            this._updateAuthStatus();
          }, 1000);
        }
      }),
      
      this._authService.onLoginFailed((error) => {
        if (!this._useSimpleAuth) {
          // 一時的にエラーアイコンを表示
          this._showErrorStatus(error.message);
          setTimeout(() => {
            this._updateAuthStatus();
          }, 3000);
        }
      })
    );
    
    // Simple認証サービスのイベントを監視
    if (this._simpleAuthService) {
      this._disposables.push(
        this._simpleAuthService.onStateChanged(state => {
          this._useSimpleAuth = state.isAuthenticated;
          this._updateAuthStatus();
        }),
        
        this._simpleAuthService.onLoginSuccess(() => {
          this._useSimpleAuth = true;
          this._updateAuthStatus();
        }),
        
        this._simpleAuthService.onLogout(() => {
          this._useSimpleAuth = false;
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
    // Simple認証が利用可能でログイン済みの場合はSimple認証を優先
    if (this._simpleAuthService && this._simpleAuthService.isAuthenticated()) {
      this._useSimpleAuth = true;
      this._updateStatusBarForSimpleAuth();
    } else if (this._authService.isAuthenticated()) {
      // レガシー認証でログイン済みの場合
      this._useSimpleAuth = false;
      this._updateStatusBarForLegacyAuth();
    } else {
      // 未ログイン状態
      this._updateStatusBarForLoggedOut();
    }
  }

  /**
   * Simple認証用のステータスバー表示更新
   */
  private _updateStatusBarForSimpleAuth(): void {
    if (this._isUpdating || !this._simpleAuthService) {
      return;
    }
    
    const state = this._simpleAuthService.getCurrentState();
    const hasApiKey = !!this._simpleAuthService.getApiKey();
    
    // APIキーを持っている場合は特別なアイコン表示
    const icon = hasApiKey ? this.ICON_API_KEY : this.ICON_LOGGED_IN;
    const displayName = state.username || 'ユーザー';
    
    this._statusBarItem.text = `${icon} ${displayName}`;
    
    // ツールチップにAPIキー情報を追加
    const apiKeyInfo = hasApiKey ? 'APIキー認証' : 'トークン認証';
    this._statusBarItem.tooltip = `AppGenius: ${displayName} としてログイン中 (Simple認証: ${apiKeyInfo})\nクリックしてログアウト`;
    
    this._statusBarItem.command = 'appgenius.logout';
    this._statusBarItem.backgroundColor = undefined;
  }

  /**
   * レガシー認証用のステータスバー表示更新
   */
  private _updateStatusBarForLegacyAuth(): void {
    if (this._isUpdating) {
      return;
    }
    
    const user = this._authService.getCurrentUser();
    
    if (user) {
      // ユーザー名を表示
      this._statusBarItem.text = `${this.ICON_LOGGED_IN} ${user.name || user.email}`;
      this._statusBarItem.tooltip = `AppGenius: ${user.name || user.email} としてログイン中\nクリックしてログアウト`;
    } else {
      // ユーザー情報がまだ読み込まれていない場合
      this._statusBarItem.text = `${this.ICON_LOGGED_IN} AppGenius`;
      this._statusBarItem.tooltip = `AppGenius: ログイン中\nクリックしてログアウト`;
    }
    
    this._statusBarItem.command = 'appgenius.logout';
    this._statusBarItem.backgroundColor = undefined;
  }

  /**
   * 未ログイン状態の表示更新
   */
  private _updateStatusBarForLoggedOut(): void {
    this._statusBarItem.text = `${this.ICON_LOGGED_OUT} 未ログイン`;
    this._statusBarItem.tooltip = 'AppGenius: クリックしてログイン';
    this._statusBarItem.command = 'appgenius.login';
    this._statusBarItem.backgroundColor = undefined;
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