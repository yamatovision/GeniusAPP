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
 * 認証サービスの状態に基づいて、
 * ユーザーが特定の機能にアクセスできるかどうかをチェックします。
 * SimpleAuthServiceとAuthenticationServiceの両方に対応しています。
 */
export class PermissionManager {
  private static instance: PermissionManager;
  private _authService: AuthenticationService | SimpleAuthService;
  private _isSimpleAuth: boolean;
  private _onPermissionsChanged = new vscode.EventEmitter<void>();
  
  // 公開イベント
  public readonly onPermissionsChanged = this._onPermissionsChanged.event;
  
  /**
   * コンストラクタ
   */
  private constructor(authService: AuthenticationService | SimpleAuthService) {
    this._authService = authService;
    
    // SimpleAuthServiceかどうかを判定
    this._isSimpleAuth = 'getAccessToken' in authService;
    
    // 認証状態変更イベントをリッスン
    this._authService.onStateChanged(this._handleAuthStateChanged.bind(this));
    
    Logger.info(`PermissionManager: 初期化完了 (SimpleAuth: ${this._isSimpleAuth})`);
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
   * 認証状態変更ハンドラー
   */
  private _handleAuthStateChanged(): void {
    // 権限変更イベントを発行
    this._onPermissionsChanged.fire();
    Logger.debug('PermissionManager: 権限変更イベントを発行しました');
  }
  
  /**
   * 特定機能へのアクセス権限を確認
   */
  public canAccess(feature: Feature): boolean {
    try {
      // 現在の認証状態を取得
      const state = this._authService.getCurrentState();
      
      // 詳細なログ出力
      Logger.info(`PermissionManager: 権限チェック - 機能=${feature}, 認証状態=${state.isAuthenticated}, ユーザー=${state.username || 'なし'}, ロール=${state.role}, ユーザーID=${state.userId || 'なし'}`);
      
      // すべての権限情報を出力
      if (state.permissions) {
        Logger.info(`PermissionManager: ユーザー権限一覧=${JSON.stringify(state.permissions)}`);
      }
      
      // 認証されていない場合はゲストロールとして扱う
      const role = state.isAuthenticated ? state.role : Role.GUEST;
      
      // 管理者は常にアクセス可能
      if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
        Logger.info(`PermissionManager: 管理者権限があるため${feature}へのアクセスを許可します`);
        return true;
      }
      
      // 現在のロールでアクセス可能な機能リストをチェック
      const allowedFeatures = RoleFeatureMap[role] || [];
      Logger.info(`PermissionManager: ロール=${role}のアクセス可能な機能=${JSON.stringify(allowedFeatures)}`);
      
      const hasAccess = allowedFeatures.includes(feature);
      
      if (!hasAccess) {
        Logger.warn(`PermissionManager: ロール=${role}は機能=${feature}へのアクセス権限がありません`);
      } else {
        Logger.info(`PermissionManager: ロール=${role}は機能=${feature}へのアクセス権限があります`);
      }
      
      return hasAccess;
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
    const hasAccess = this.canAccess(feature);
    
    if (!hasAccess) {
      const action = this.getAccessDeniedAction(feature);
      
      // メッセージ表示とアクション
      if (action.action === 'login') {
        vscode.window.showInformationMessage(action.message, 'ログイン')
          .then(selection => {
            if (selection === 'ログイン' && action.command) {
              vscode.commands.executeCommand(action.command);
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
        command: 'appgenius.login'
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
    const state = this._authService.getCurrentState();
    return state.isAuthenticated && state.role === Role.ADMIN;
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