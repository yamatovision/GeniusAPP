import * as vscode from 'vscode';
import { Feature } from '../../core/auth/roles';
import { AuthGuard } from './AuthGuard';
import { Logger } from '../../utils/logger';

/**
 * 権限保護されたパネルの基底クラス
 * 
 * このクラスを継承することで、パネル表示前に自動的に権限チェックが行われます。
 * 各UIパネルクラスはこの基底クラスを継承し、必要な権限（_feature）を指定します。
 */
export abstract class ProtectedPanel {
  // 継承先で設定する必要がある権限情報
  protected static readonly _feature: Feature = null;
  
  // 明示的にコンストラクタを提供
  constructor() {
    // 基底クラスのコンストラクタ - 何もしない
  }
  
  /**
   * パネルを作成または表示
   * 権限チェックを行い、権限がある場合のみパネルを表示
   */
  public static createOrShow(...args: any[]): void {
    const className = this.constructor.name || 'ProtectedPanel';
    const featureToCheck = this._feature;
    
    try {
      Logger.debug(`${className}: 権限チェックを実行します (${featureToCheck})`);
      
      // 権限チェック - AuthGuardが定義されていない場合はスキップ
      if (featureToCheck && AuthGuard) {
        if (!AuthGuard.checkAccess(featureToCheck)) {
          Logger.warn(`${className}: ${featureToCheck}へのアクセスが拒否されました`);
          return; // 権限がない場合は処理を中断
        }
      } else {
        // 権限チェックをスキップ
        Logger.debug(`${className}: 権限チェックをスキップします（開発モード）`);
      }
      
      Logger.debug(`${className}: 権限チェックOK - パネルを表示します`);
      
      // 権限がある場合はパネルを表示
      this._createOrShowPanel(...args);
    } catch (error) {
      Logger.error(`${className}の表示エラー: ${error}`);
      vscode.window.showErrorMessage(`パネル表示中にエラーが発生しました: ${error}`);
    }
  }
  
  /**
   * 実際のパネル作成・表示ロジック
   * サブクラスで実装
   */
  protected static abstract _createOrShowPanel(...args: any[]): void;
}