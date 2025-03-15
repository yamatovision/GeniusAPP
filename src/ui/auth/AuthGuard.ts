import * as vscode from 'vscode';
import { PermissionManager } from '../../core/auth/PermissionManager';
import { Feature } from '../../core/auth/roles';
import { Logger } from '../../utils/logger';

/**
 * AuthGuard - UIコンポーネントのアクセス制御を担当
 * 
 * Webviewパネルやコマンド実行前に権限チェックを行い、
 * アクセス権限がない場合は適切なフィードバックを提供します。
 */
export class AuthGuard {
  private static _permissionManager = PermissionManager.getInstance();

  /**
   * 特定機能へのアクセス権限をチェック
   * アクセス不可の場合は適切なメッセージを表示
   * 
   * @param feature チェックする機能
   * @returns アクセス可能かどうか
   */
  public static checkAccess(feature: Feature): boolean {
    Logger.debug(`AuthGuard: ${feature}へのアクセス権限をチェックします`);
    
    return this._permissionManager.checkAccessWithFeedback(feature);
  }

  /**
   * 管理者権限が必要な機能へのアクセスをチェック
   * 
   * @param feature チェックする機能
   * @returns アクセス可能かどうか
   */
  public static checkAdminAccess(feature: Feature): boolean {
    const isAdmin = this._permissionManager.isAdmin();
    
    if (!isAdmin) {
      vscode.window.showErrorMessage(`この機能は管理者のみ使用できます`);
      return false;
    }
    
    return true;
  }

  /**
   * ログイン状態をチェック
   * ログインしていない場合はログインを促す
   * 
   * @returns ログイン済みかどうか
   */
  public static checkLoggedIn(): boolean {
    const isLoggedIn = this._permissionManager.isLoggedIn();
    
    if (!isLoggedIn) {
      vscode.window.showInformationMessage('この機能を使用するにはログインが必要です', 'ログイン')
        .then(selection => {
          if (selection === 'ログイン') {
            vscode.commands.executeCommand('appgenius.auth.login');
          }
        });
    }
    
    return isLoggedIn;
  }
}