import * as vscode from 'vscode';
import { AuthStore } from './AuthStore';
import { AuthService } from './AuthService';
import { PermissionService } from './PermissionService';
import { Logger } from '../../../utils/logger';

/**
 * 新しい認証システムの統合モジュール
 * 
 * 認証システムの初期化と公開APIを提供
 */
export class AuthModule {
  private static instance: AuthModule;
  private _context: vscode.ExtensionContext;
  private _authStore: AuthStore;
  private _authService: AuthService;
  private _permissionService: PermissionService;
  
  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this._context = context;
    
    // 各コンポーネントを初期化
    this._authStore = AuthStore.getInstance(context);
    this._authService = AuthService.getInstance(this._authStore);
    this._permissionService = PermissionService.getInstance(this._authStore);
    
    // 起動時にセッション検証
    this._authService.verifySession().then(isAuthenticated => {
      Logger.info(`AuthModule: セッション検証完了 - 認証状態: ${isAuthenticated ? '認証済み' : '未認証'}`);
    });
    
    // コマンド登録
    this._registerCommands();
  }
  
  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(context?: vscode.ExtensionContext): AuthModule {
    if (!AuthModule.instance) {
      if (!context) throw new Error('初期化にはExtensionContextが必要です');
      AuthModule.instance = new AuthModule(context);
    }
    return AuthModule.instance;
  }
  
  /**
   * コマンド登録
   */
  private _registerCommands(): void {
    // ログインコマンド
    this._context.subscriptions.push(
      vscode.commands.registerCommand('appgenius.login', async () => {
        // ログインUIの表示と処理は既存の実装を使用
        vscode.commands.executeCommand('appgenius-ai.login');
      })
    );
    
    // 注: ログアウトコマンドはauthCommands.tsで既に登録されているため
    // ここでは登録しない。AuthenticationServiceのログアウト処理は
    // SimpleAuthServiceの状態変更リスナーを通じて行われる。
  }
  
  /**
   * 認証サービス取得
   */
  public getAuthService(): AuthService {
    return this._authService;
  }
  
  /**
   * 権限サービス取得
   */
  public getPermissionService(): PermissionService {
    return this._permissionService;
  }
  
  /**
   * 認証ストア取得
   */
  public getAuthStore(): AuthStore {
    return this._authStore;
  }
  
  /**
   * コマンド実行時に特定機能への権限チェックを行うデコレータ
   */
  public static withPermissionCheck(feature: string) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args: any[]) {
        // AuthModuleのインスタンスが存在することを確認
        if (!AuthModule.instance) {
          Logger.error(`AuthModule: 権限チェックを行うためのインスタンスがありません`);
          return;
        }
        
        // 権限チェック
        const permissionService = AuthModule.instance.getPermissionService();
        if (permissionService.canAccess(feature as any)) {
          return originalMethod.apply(this, args);
        } else {
          permissionService.checkAccessWithFeedback(feature as any);
          return;
        }
      };
      
      return descriptor;
    };
  }
}