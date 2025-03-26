import { AuthStore } from './AuthStore';
import { Role, Feature, RoleFeatureMap } from '../roles';
import { Logger } from '../../../utils/logger';
import * as vscode from 'vscode';

/**
 * PermissionService - 権限判断を担当するシンプルなサービス
 * 
 * 認証状態に基づいて、特定の機能へのアクセス権があるかを判断する
 */
export class PermissionService {
  private static instance: PermissionService;
  private _authStore: AuthStore;
  private _onPermissionsChanged = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onPermissionsChanged = this._onPermissionsChanged.event;
  
  /**
   * コンストラクタ
   */
  private constructor(authStore: AuthStore) {
    this._authStore = authStore;
    
    // 認証状態変更を購読
    this._authStore.subscribe(this._handleAuthStateChanged.bind(this));
  }
  
  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(authStore?: AuthStore): PermissionService {
    if (!PermissionService.instance) {
      if (!authStore) throw new Error('初期化にはAuthStoreが必要です');
      PermissionService.instance = new PermissionService(authStore);
    }
    return PermissionService.instance;
  }
  
  /**
   * 認証状態変更ハンドラー
   */
  private _handleAuthStateChanged(state: any): void {
    try {
      // 詳細ログ出力
      Logger.info(`PermissionService: 認証状態変更を検知 - 認証=${state.isAuthenticated}, ユーザー=${state.username || 'なし'}, ロール=${state.role}`);
      
      // 権限変更イベントを発行
      this._onPermissionsChanged.fire();
    } catch (error) {
      Logger.error('PermissionService: 状態変更ハンドリング中にエラー', error as Error);
    }
  }
  
  /**
   * 機能へのアクセス権限を確認
   */
  public canAccess(feature: Feature): boolean {
    try {
      // 現在の認証状態を取得
      const state = this._authStore.getState();
      
      // 詳細なログ出力
      Logger.info(`PermissionService: 権限チェック - 機能=${feature}, 認証=${state.isAuthenticated}, ユーザー=${state.username || 'なし'}, ロール=${state.role}`);
      
      // 認証されていない場合はゲストロールとして扱う
      const role = state.isAuthenticated ? state.role : Role.GUEST;
      
      // 管理者は常にアクセス可能
      if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
        return true;
      }
      
      // 現在のロールでアクセス可能な機能リストをチェック
      const allowedFeatures = RoleFeatureMap[role] || [];
      const hasAccess = allowedFeatures.includes(feature);
      
      if (!hasAccess) {
        Logger.warn(`PermissionService: ${role}は${feature}へのアクセス権限がありません`);
      }
      
      return hasAccess;
    } catch (error) {
      Logger.error(`PermissionService: 権限チェック中にエラー`, error as Error);
      return false;
    }
  }
  
  /**
   * 指定された機能へのアクセス権限をチェックし、
   * 権限がなければエラーメッセージを表示
   */
  public checkAccessWithFeedback(feature: Feature): boolean {
    const hasAccess = this.canAccess(feature);
    
    if (!hasAccess) {
      const action = this.getAccessDeniedAction(feature);
      
      // メッセージ表示とアクション
      if (action.action === 'login') {
        vscode.window.showInformationMessage(action.message, 'ログインページを開く')
          .then(selection => {
            if (selection === 'ログインページを開く' && action.command) {
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
  public getAccessDeniedAction(feature: Feature): any {
    const state = this._authStore.getState();
    const featureName = feature; // 表示名があれば使用
    
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
    const state = this._authStore.getState();
    return state.isAuthenticated && 
           (state.role === Role.ADMIN || state.role === Role.SUPER_ADMIN);
  }
  
  /**
   * 現在ログイン中かどうかを確認
   */
  public isLoggedIn(): boolean {
    return this._authStore.getState().isAuthenticated;
  }
  
  /**
   * 現在のロールを取得
   */
  public getCurrentRole(): Role {
    return this._authStore.getState().role;
  }
}