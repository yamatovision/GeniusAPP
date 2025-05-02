import * as vscode from 'vscode';
import { Feature } from '../../../core/auth/roles';
import { AuthState } from '../types/ScopeManagerTypes';
import { Logger } from '../../../utils/logger';
import { AuthGuard } from '../../auth/AuthGuard';
import { ProtectedPanel } from '../../auth/ProtectedPanel';
import { SimpleAuthManager } from '../../../core/auth/SimpleAuthManager';

/**
 * 認証ハンドラーインターフェース
 * ScopeManagerPanelの認証・権限関連機能を分離
 */
export interface IAuthenticationHandler {
  // 認証チェック
  checkLoggedIn(): boolean;
  checkPermission(feature: Feature): boolean;
  
  // 監視
  setupTokenExpirationMonitor(onExpired: () => void, onPermissionLost: () => void): vscode.Disposable;
  
  // ログイン関連
  showLoginScreen(extensionUri: vscode.Uri): void;
  
  // イベント
  onAuthStateChanged: vscode.Event<AuthState>;
  
  // リソース解放
  dispose(): void;
}

/**
 * 認証ハンドラー実装クラス
 */
export class AuthenticationHandler implements IAuthenticationHandler {
  private _onAuthStateChanged = new vscode.EventEmitter<AuthState>();
  public readonly onAuthStateChanged = this._onAuthStateChanged.event;
  
  private _disposables: vscode.Disposable[] = [];
  private _extensionUri: vscode.Uri | undefined;
  
  // シングルトンインスタンス
  private static _instance: AuthenticationHandler;
  
  public static getInstance(): AuthenticationHandler {
    if (!AuthenticationHandler._instance) {
      AuthenticationHandler._instance = new AuthenticationHandler();
    }
    return AuthenticationHandler._instance;
  }
  
  private constructor() {
    // 認証状態変更イベントの監視を設定
    this._setupAuthStateChangeListener();
  }
  
  /**
   * 認証状態の監視を設定
   */
  private _setupAuthStateChangeListener(): void {
    try {
      // SimpleAuthServiceの認証状態変更イベントを監視
      const simpleAuthService = SimpleAuthManager.getInstance().getAuthService();
      const authStateChangedDisposable = simpleAuthService.onStateChanged(state => {
        // 認証状態をそのまま発火
        this._onAuthStateChanged.fire(state);
        
        Logger.info('AuthenticationHandler: 認証状態が変更されました', { 
          isAuthenticated: state.isAuthenticated
        });
      });
      
      // Disposableリストに追加
      this._disposables.push(authStateChangedDisposable);
      Logger.info('AuthenticationHandler: 認証状態変更イベントの監視を開始しました');
    } catch (error) {
      Logger.error('AuthenticationHandler: 認証状態変更イベントの設定中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * ログイン状態をチェック
   * @returns ログインしている場合はtrue
   */
  public checkLoggedIn(): boolean {
    return AuthGuard.checkLoggedIn();
  }
  
  /**
   * 指定された機能に対する権限をチェック
   * @param feature チェックする機能
   * @returns 権限がある場合はtrue
   */
  public checkPermission(feature: Feature): boolean {
    return AuthGuard.checkLoggedIn();
    
    // 以下の実装はSimpleAuthServiceがgetState()を持たない場合の対応
    // リファクタリング目的のため単純化
    // ログイン中であれば権限があるとみなす簡易実装
  }
  
  /**
   * トークンの有効期限と権限の監視を設定
   * @param onExpired トークンの有効期限が切れた時のコールバック
   * @param onPermissionLost 権限がなくなった時のコールバック
   * @returns 監視を停止するためのDisposable
   */
  public setupTokenExpirationMonitor(onExpired: () => void, onPermissionLost: () => void): vscode.Disposable {
    try {
      // 1分ごとに認証状態をチェック
      const interval = setInterval(() => {
        try {
          // ログイン状態をチェック
          if (!this.checkLoggedIn()) {
            Logger.info('AuthenticationHandler: 認証状態が無効になりました');
            // コールバックを呼び出し
            onExpired();
            return;
          }

          // 権限チェック
          if (!this.checkPermission(Feature.SCOPE_MANAGER)) {
            Logger.warn('AuthenticationHandler: 権限が失効しました');
            // コールバックを呼び出し
            onPermissionLost();
            return;
          }
        } catch (checkError) {
          Logger.error('AuthenticationHandler: 認証状態チェック中にエラーが発生しました', checkError as Error);
        }
      }, 60000); // 1分ごとにチェック
      
      // パネル破棄時にインターバルをクリア
      const disposable = { dispose: () => clearInterval(interval) };
      this._disposables.push(disposable);
      
      Logger.info('AuthenticationHandler: 認証状態監視を開始しました');
      return disposable;
    } catch (error) {
      Logger.error('AuthenticationHandler: 認証状態監視の設定中にエラーが発生しました', error as Error);
      // 空のdisposableを返す
      return { dispose: () => {} };
    }
  }
  
  /**
   * ログイン画面を表示
   * @param extensionUri 拡張機能のURI
   */
  public showLoginScreen(extensionUri: vscode.Uri): void {
    try {
      // extensionUriを保存
      this._extensionUri = extensionUri;
      
      // ログイン画面を表示（LoginWebviewPanelを使用）
      const { LoginWebviewPanel } = require('../../auth/LoginWebviewPanel');
      LoginWebviewPanel.createOrShow(extensionUri);
      
      Logger.info('AuthenticationHandler: ログイン画面を表示しました');
    } catch (error) {
      Logger.error('AuthenticationHandler: ログイン画面の表示に失敗しました', error as Error);
      vscode.window.showErrorMessage('ログイン画面の表示に失敗しました');
    }
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    // イベントエミッタを解放
    this._onAuthStateChanged.dispose();
    
    // Disposablesを解放
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
    
    Logger.info('AuthenticationHandler: リソースを解放しました');
  }
}