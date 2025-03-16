import * as vscode from 'vscode';
import { AuthenticationService } from './AuthenticationService';
import { Role, Feature, RoleFeatureMap, FeatureDisplayNames } from './roles';
import { Logger } from '../../utils/logger';
import { AuthEventBus, AuthEventType } from '../../services/AuthEventBus';

/**
 * 権限チェック結果のインターフェース
 */
export interface PermissionCheckResult {
  allowed: boolean;
  currentRole: Role;
  feature: Feature;
  timestamp: number;
}

/**
 * アクセス拒否時のアクション情報
 */
export interface AccessDeniedAction {
  message: string;
  action?: 'login' | 'contact_admin' | 'upgrade';
  command?: string;
}

/**
 * PermissionManager - 権限管理の中核クラス
 * 
 * ユーザーの役割に基づいて機能へのアクセス権限を管理します。
 * シングルトンパターンで実装され、アプリケーション全体で一貫した権限チェックを提供します。
 */
export class PermissionManager {
  private static instance: PermissionManager;
  private _authService: AuthenticationService;
  private _authEventBus: AuthEventBus;
  private _currentRole: Role = Role.GUEST;
  private _permissionCheckCache: Map<string, PermissionCheckResult> = new Map();
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }
  
  /**
   * プライベートコンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    this._authEventBus = AuthEventBus.getInstance();
    this._initialize();
  }

  /**
   * 初期化処理
   */
  private _initialize(): void {
    // 認証状態変更のリスナー登録
    this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this));
    
    // 初期認証状態の確認
    this._updateRole(this._authService.isAuthenticated());
    
    Logger.info('PermissionManagerが初期化されました');
  }
  
  /**
   * 認証状態変更ハンドラー
   */
  private _handleAuthStateChange(isAuthenticated: boolean): void {
    this._updateRole(isAuthenticated);
    
    // 権限変更イベントを発行
    this._authEventBus.publish(AuthEventType.PERMISSIONS_CHANGED, {
      role: this._currentRole
    }, 'PermissionManager');
  }

  /**
   * 現在のロールを更新
   */
  private _updateRole(isAuthenticated: boolean): void {
    // キャッシュをクリア
    this._permissionCheckCache.clear();
    
    if (!isAuthenticated) {
      this._currentRole = Role.GUEST;
      Logger.debug('認証されていません。ゲストロールを設定します');
      return;
    }
    
    const user = this._authService.getCurrentUser();
    if (!user) {
      this._currentRole = Role.GUEST;
      Logger.debug('ユーザー情報が取得できません。ゲストロールを設定します');
      return;
    }
    
    // ユーザーのロールをマッピング
    switch (user.role) {
      case 'admin':
        this._currentRole = Role.ADMIN;
        break;
      case 'unsubscribe':
        this._currentRole = Role.UNSUBSCRIBE;
        break;
      case 'user':
      default:
        this._currentRole = Role.USER;
        break;
    }
    
    Logger.info(`ユーザーロールを更新しました: ${this._currentRole}`);
  }
  
  /**
   * 特定機能へのアクセス権限を確認
   * @param feature 確認する機能
   * @returns アクセス可能かどうか
   */
  public canAccess(feature: Feature): boolean {
    // キャッシュキー
    const cacheKey = `${feature}`;
    
    // キャッシュにある場合はそれを返す
    if (this._permissionCheckCache.has(cacheKey)) {
      return this._permissionCheckCache.get(cacheKey)!.allowed;
    }
    
    // 退会済みユーザーは常にアクセス不可
    if (this._currentRole === Role.UNSUBSCRIBE) {
      this._cacheResult(feature, false);
      return false;
    }
    
    // 管理者は常にアクセス可能
    if (this._currentRole === Role.ADMIN) {
      this._cacheResult(feature, true);
      return true;
    }
    
    // 現在のロールでアクセス可能な機能リストをチェック
    const allowedFeatures = RoleFeatureMap[this._currentRole] || [];
    const hasAccess = allowedFeatures.includes(feature);
    
    // 結果をキャッシュに保存
    this._cacheResult(feature, hasAccess);
    
    return hasAccess;
  }
  
  /**
   * 権限チェック結果をキャッシュに保存
   */
  private _cacheResult(feature: Feature, allowed: boolean): void {
    const result: PermissionCheckResult = {
      allowed,
      currentRole: this._currentRole,
      feature,
      timestamp: Date.now()
    };
    
    this._permissionCheckCache.set(`${feature}`, result);
  }
  
  /**
   * 現在のロールを取得
   */
  public getCurrentRole(): Role {
    return this._currentRole;
  }
  
  /**
   * 現在ログイン中かどうかを確認
   */
  public isLoggedIn(): boolean {
    return this._currentRole !== Role.GUEST;
  }
  
  /**
   * 現在のユーザーが管理者かどうかを確認
   */
  public isAdmin(): boolean {
    return this._currentRole === Role.ADMIN;
  }
  
  /**
   * アクセス拒否時のアクション情報を取得
   */
  public getAccessDeniedAction(feature: Feature): AccessDeniedAction {
    const featureName = FeatureDisplayNames[feature] || feature;
    
    // ロールに応じたメッセージとアクション
    switch (this._currentRole) {
      case Role.UNSUBSCRIBE:
        return {
          message: `退会済みのため「${featureName}」にアクセスできません。管理者に連絡してください。`,
          action: 'contact_admin'
        };
        
      case Role.GUEST:
        return {
          message: `「${featureName}」を使用するにはログインが必要です。`,
          action: 'login',
          command: 'appgenius.login'
        };
        
      default:
        return {
          message: `「${featureName}」へのアクセス権限がありません。`,
          action: 'contact_admin'
        };
    }
  }
  
  /**
   * 指定された機能へのアクセス権限をチェックし、
   * 権限がなければエラーメッセージを表示
   * 
   * @param feature チェックする機能
   * @returns アクセス可能かどうか
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
}