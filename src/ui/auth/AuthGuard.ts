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
  /**
   * 特定機能へのアクセス権限をチェック
   * アクセス不可の場合は適切なメッセージを表示
   * 
   * @param feature チェックする機能
   * @returns アクセス可能かどうか
   */
  public static checkAccess(feature: Feature): boolean {
    try {
      Logger.debug(`AuthGuard: ${feature}へのアクセス権限をチェックします`);
      
      const permissionManager = PermissionManager.getInstance();
      return permissionManager.checkAccessWithFeedback(feature);
    } catch (error) {
      Logger.error(`AuthGuard: アクセス権チェック中にエラーが発生しました`, error as Error);
      return false;
    }
  }

  /**
   * 管理者権限が必要な機能へのアクセスをチェック
   * 
   * @param feature チェックする機能
   * @returns アクセス可能かどうか
   */
  public static checkAdminAccess(feature: Feature): boolean {
    try {
      const permissionManager = PermissionManager.getInstance();
      const isAdmin = permissionManager.isAdmin();
      
      if (!isAdmin) {
        vscode.window.showErrorMessage(`この機能は管理者のみ使用できます`);
        return false;
      }
      
      return permissionManager.checkAccessWithFeedback(feature);
    } catch (error) {
      Logger.error(`AuthGuard: 管理者権限チェック中にエラーが発生しました`, error as Error);
      return false;
    }
  }

  /**
   * ログイン状態をチェック
   * ログインしていない場合はログインを促す
   * 
   * @returns ログイン済みかどうか
   */
  public static checkLoggedIn(): boolean {
    try {
      const permissionManager = PermissionManager.getInstance();
      const isLoggedIn = permissionManager.isLoggedIn();
      
      if (!isLoggedIn) {
        vscode.window.showInformationMessage('この機能を使用するにはログインが必要です', 'ログイン')
          .then(selection => {
            if (selection === 'ログイン') {
              vscode.commands.executeCommand('appgenius.login');
            }
          });
      }
      
      return isLoggedIn;
    } catch (error) {
      Logger.error(`AuthGuard: ログイン状態チェック中にエラーが発生しました`, error as Error);
      return false;
    }
  }
}