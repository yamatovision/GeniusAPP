import * as vscode from 'vscode';
import { AuthenticationService } from './AuthenticationService';
import { SimpleAuthService } from './SimpleAuthService';
import { Role, Feature, RoleFeatureMap, FeatureDisplayNames } from './roles';
import { Logger } from '../../utils/logger';

// 新認証システムのインポート
import { PermissionService } from './new/PermissionService';

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
 * 新認証システムのラッパー。後方互換性のために提供されるが、内部的には
 * PermissionServiceを使用する。
 */
export class PermissionManager {
  private static instance: PermissionManager;
  private _authService: AuthenticationService | SimpleAuthService;
  private _onPermissionsChanged = new vscode.EventEmitter<void>();
  
  // 新認証システムへの参照
  private _permissionService: PermissionService | undefined;
  
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
    
    // 新認証システムの初期化
    try {
      this._permissionService = (global._appgenius_auth_module?.getPermissionService) ? 
                                global._appgenius_auth_module.getPermissionService() : undefined;
                               
      if (this._permissionService) {
        // 権限変更イベントを購読して既存システムと同期
        this._permissionService.onPermissionsChanged(() => {
          this._onPermissionsChanged.fire();
        });
      }
    } catch (error) {
      Logger.warn('PermissionManager: 新認証システムの初期化に失敗しました', error as Error);
    }
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
      // 新認証システムが利用可能な場合はそちらを使用
      if (this._permissionService) {
        return this._permissionService.canAccess(feature);
      }
      
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
    // 新認証システムが利用可能な場合はそちらを使用
    if (this._permissionService) {
      return this._permissionService.checkAccessWithFeedback(feature);
    }
    
    // 以下は従来の処理
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
    // 新認証システムが利用可能な場合はそちらを使用
    if (this._permissionService) {
      return this._permissionService.isAdmin();
    }
    
    // 認証状態を取得
    const state = this._authService.getCurrentState();
    return state.isAuthenticated && (state.role === Role.ADMIN || state.role === Role.SUPER_ADMIN);
  }
  
  /**
   * 現在ログイン中かどうかを確認
   */
  public isLoggedIn(): boolean {
    // 新認証システムが利用可能な場合はそちらを使用
    if (this._permissionService) {
      return this._permissionService.isLoggedIn();
    }
    
    return this._authService.isAuthenticated();
  }
  
  /**
   * 現在のロールを取得
   */
  public getCurrentRole(): Role {
    // 新認証システムが利用可能な場合はそちらを使用
    if (this._permissionService) {
      return this._permissionService.getCurrentRole();
    }
    
    const state = this._authService.getCurrentState();
    return state.role;
  }
}