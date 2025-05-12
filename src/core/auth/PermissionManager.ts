import * as vscode from 'vscode';
import { AuthenticationService } from './AuthenticationService';
import { SimpleAuthService } from './SimpleAuthService';
import { Role, Feature, RoleFeatureMap, FeatureDisplayNames } from './roles';
import { Logger } from '../../utils/logger';

/**
 * アクセス拒否時のアクション情報
 */
export interface AccessDeniedAction {
  message: string;
  action?: 'login' | 'contact_admin';
  command?: string;
}

/**
 * PermissionManager - 機能へのアクセス権限をチェックするクラス
 *
 * 認証サービスと連携して機能へのアクセス権限を管理します。
 */
export class PermissionManager {
  private static instance: PermissionManager;
  private _authService: AuthenticationService | SimpleAuthService;
  private _onPermissionsChanged = new vscode.EventEmitter<void>();
  
  // 権限サービスへの参照（将来の拡張用）
  private _permissionService: any;
  
  // 公開イベント
  public readonly onPermissionsChanged = this._onPermissionsChanged.event;
  
  /**
   * コンストラクタ
   */
  private constructor(authService: AuthenticationService | SimpleAuthService) {
    this._authService = authService;
    
    // 認証状態変更イベントをリッスン
    this._authService.onStateChanged(() => {
      this._onPermissionsChanged.fire();
    });
    
    // 権限サービスの初期化 (将来の拡張のために残しておく)
    this._permissionService = undefined;
    Logger.info('PermissionManager: 基本認証システムを使用します');
  }
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(authService?: AuthenticationService | SimpleAuthService): PermissionManager {
    if (!PermissionManager.instance) {
      if (!authService) {
        throw new Error('PermissionManagerの初期化時には認証サービスが必要です');
      }
      PermissionManager.instance = new PermissionManager(authService);
    }
    return PermissionManager.instance;
  }
  
  /**
   * 特定機能へのアクセス権限を確認
   */
  public canAccess(feature: Feature): boolean {
    try {
      // 認証状態を取得
      const state = this._authService.getCurrentState();
      const role = state.isAuthenticated ? state.role : Role.GUEST;

      // 管理者は常にアクセス可能
      if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
        return true;
      }

      // 権限チェック
      const allowedFeatures = RoleFeatureMap[role] || [];
      return allowedFeatures.includes(feature);
    } catch (error) {
      Logger.error(`PermissionManager: 権限チェック中にエラーが発生しました`, error as Error);
      return false;
    }
  }
  
  /**
   * 指定された機能へのアクセス権限をチェックし、
   * 権限がなければエラーメッセージを表示
   */
  public checkAccessWithFeedback(feature: Feature): boolean {
    // アクセス権限をチェック
    const hasAccess = this.canAccess(feature);

    if (!hasAccess) {
      const action = this.getAccessDeniedAction(feature);

      // メッセージ表示とアクション
      if (action.action === 'login') {
        vscode.window.showInformationMessage(action.message, 'ログインページを開く')
          .then(selection => {
            if (selection === 'ログインページを開く' && action.command) {
              // ログインコマンドを実行
              vscode.commands.executeCommand('appgenius-ai.login');
            }
          });
      } else {
        vscode.window.showErrorMessage(action.message);
      }
    }

    return hasAccess;
  }
  
  /**
   * アクセス拒否時のアクション情報を取得
   */
  public getAccessDeniedAction(feature: Feature): AccessDeniedAction {
    const featureName = FeatureDisplayNames[feature] || feature;
    const state = this._authService.getCurrentState();
    
    // 認証されていない場合
    if (!state.isAuthenticated) {
      return {
        message: `「${featureName}」を使用するにはログインが必要です。`,
        action: 'login',
        command: 'appgenius-ai.login'
      };
    }
    
    // 認証されているが、権限がない場合
    return {
      message: `「${featureName}」へのアクセス権限がありません。`,
      action: 'contact_admin'
    };
  }
  
  /**
   * 現在のユーザーが管理者かどうかを確認
   */
  public isAdmin(): boolean {
    // 認証状態を取得
    const state = this._authService.getCurrentState();
    return state.isAuthenticated && (state.role === Role.ADMIN || state.role === Role.SUPER_ADMIN);
  }

  /**
   * 現在ログイン中かどうかを確認
   */
  public isLoggedIn(): boolean {
    return this._authService.isAuthenticated();
  }

  /**
   * 現在のロールを取得
   */
  public getCurrentRole(): Role {
    const state = this._authService.getCurrentState();
    return state.role;
  }
}