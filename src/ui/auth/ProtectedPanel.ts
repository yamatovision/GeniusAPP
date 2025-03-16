import * as vscode from 'vscode';
import { Feature } from '../../core/auth/roles';
import { AuthGuard } from './AuthGuard';
import { Logger } from '../../utils/logger';

/**
 * シンプル化された権限保護パネル基底クラス
 * 
 * このクラスを継承することで、各UIパネルは統一した権限チェック機能を取得します。
 * 以前の複雑な静的継承パターンから、よりシンプルなアプローチに変更しました。
 */
export abstract class ProtectedPanel {
  /**
   * 特定の機能について権限チェックを行い、権限があればtrueを返します
   * 
   * @param feature チェックする機能
   * @param className 呈示用のクラス名（ログ出力用）
   * @returns 権限がある場合はtrue、ない場合はfalse
   */
  protected static checkPermissionForFeature(feature: Feature, className: string = 'ProtectedPanel'): boolean {
    Logger.debug(`${className}: 権限チェックを実行します (${feature})`);
    
    // AuthGuardの権限チェックを利用
    if (!AuthGuard.checkAccess(feature)) {
      Logger.warn(`${className}: ${feature}へのアクセスが拒否されました`);
      return false;
    }
    
    Logger.debug(`${className}: 権限チェックOK`);
    return true;
  }
}