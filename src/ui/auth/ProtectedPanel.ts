import * as vscode from 'vscode';
import { Feature } from '../../core/auth/roles';
import { AuthGuard } from './AuthGuard';
import { Logger } from '../../utils/logger';
import { AuthenticationService } from '../../core/auth/AuthenticationService';
import { PermissionManager } from '../../core/auth/PermissionManager';

/**
 * 権限保護パネル基底クラス
 * 
 * このクラスを継承することで、各UIパネルは統一した権限チェック機能を取得します。
 * シンプルな責任範囲と明確な権限チェックプロセスを提供します。
 */
export abstract class ProtectedPanel {
  private static authListenersInitialized = false;
  
  constructor() {
    // クラスが初期化されたときに一度だけ認証リスナーを設定
    if (!ProtectedPanel.authListenersInitialized) {
      try {
        // 認証状態変更の監視を設定
        const authService = AuthenticationService.getInstance();
        const permissionManager = PermissionManager.getInstance();
        
        // 権限変更イベントをリッスン
        permissionManager.onPermissionsChanged(() => {
          Logger.debug('ProtectedPanel: 権限変更を検知しました。UIの更新が必要かもしれません。');
        });
        
        ProtectedPanel.authListenersInitialized = true;
        Logger.debug('ProtectedPanel: 認証リスナーを初期化しました');
      } catch (error) {
        Logger.error('ProtectedPanel: 認証リスナーの初期化に失敗しました', error as Error);
      }
    }
  }
  
  /**
   * 特定の機能について権限チェックを行い、権限があればtrueを返します
   * 
   * @param feature チェックする機能
   * @param className 呈示用のクラス名（ログ出力用）
   * @returns 権限がある場合はtrue、ない場合はfalse
   */
  protected static checkPermissionForFeature(feature: Feature, className: string = 'ProtectedPanel'): boolean {
    Logger.debug(`${className}: 権限チェックを実行します (${feature})`);
    
    try {
      // AuthGuardの権限チェックを利用
      if (!AuthGuard.checkAccess(feature)) {
        Logger.warn(`${className}: ${feature}へのアクセスが拒否されました`);
        return false;
      }
      
      Logger.debug(`${className}: 権限チェックOK`);
      return true;
    } catch (error) {
      Logger.error(`${className}: 権限チェック中にエラーが発生しました`, error as Error);
      vscode.window.showErrorMessage(`機能へのアクセスチェック中にエラーが発生しました。ログを確認してください。`);
      return false;
    }
  }
}