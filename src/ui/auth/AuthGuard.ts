import * as vscode from 'vscode';
import { PermissionManager } from '../../core/auth/PermissionManager';
import { Feature } from '../../core/auth/roles';
import { Logger } from '../../utils/logger';

/**
 * AuthGuard - UIコンポーネントのアクセス制御を担当
 * 
 * Webviewパネルやコマンド実行前に権限チェックを行い、
 * アクセス権限がない場合は適切なフィードバックを提供します。
 * 単一責任原則に基づき、権限チェックと関連フィードバックをここに集約します。
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
            vscode.commands.executeCommand('appgenius.login');
          }
        });
    }
    
    return isLoggedIn;
  }
  
  /**
   * 単純化された権限チェック - AuthUtils.tsから移行
   * @param feature 確認する機能
   * @returns アクセス権がある場合はtrue、ない場合はfalse
   */
  public static checkPermission(feature: Feature): boolean {
    try {
      // 権限チェック
      const hasAccess = this._permissionManager.canAccess(feature);
      
      if (!hasAccess) {
        Logger.warn(`権限チェック失敗: 機能=${feature}`);
        
        // ユーザーにメッセージを表示
        vscode.window.showWarningMessage(`この機能を使用するにはログインが必要です。`);
        
        // ログインを促す
        this.promptLogin();
      }
      
      return hasAccess;
    } catch (error) {
      Logger.error(`権限チェックエラー: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * ログインを促す - AuthUtils.tsから移行
   */
  public static promptLogin(): void {
    try {
      vscode.commands.executeCommand('appgenius.login');
    } catch (error) {
      Logger.error(`ログイン促進エラー: ${(error as Error).message}`);
    }
  }
}