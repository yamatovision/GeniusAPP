import { Feature } from '../core/auth/roles';
import { AuthGuard } from '../ui/auth/AuthGuard';
import { Logger } from '../utils/logger';

/**
 * 権限チェックを行うデコレータ
 * クラスメソッドに適用すると、実行前に権限チェックが行われる
 * 
 * @param feature 必要な機能権限
 */
export function RequirePermission(feature: Feature) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      Logger.debug(`RequirePermission: ${feature}の権限チェックを実行`);
      
      if (!AuthGuard.checkAccess(feature)) {
        Logger.warn(`RequirePermission: ${feature}へのアクセスが拒否されました`);
        return; // 権限がない場合は処理を中断
      }
      
      // 権限がある場合は元のメソッドを実行
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * 管理者権限チェックを行うデコレータ
 * クラスメソッドに適用すると、実行前に管理者権限チェックが行われる
 */
export function RequireAdmin() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      Logger.debug(`RequireAdmin: 管理者権限チェックを実行`);
      
      if (!AuthGuard.checkAdminAccess(Feature.USER_MANAGEMENT)) {
        Logger.warn(`RequireAdmin: 管理者権限へのアクセスが拒否されました`);
        return; // 管理者権限がない場合は処理を中断
      }
      
      // 権限がある場合は元のメソッドを実行
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * ログイン状態チェックを行うデコレータ
 * クラスメソッドに適用すると、実行前にログイン状態チェックが行われる
 */
export function RequireLogin() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      Logger.debug(`RequireLogin: ログイン状態チェックを実行`);
      
      if (!AuthGuard.checkLoggedIn()) {
        Logger.warn(`RequireLogin: ログインしていないためアクセスが拒否されました`);
        return; // ログインしていない場合は処理を中断
      }
      
      // ログインしている場合は元のメソッドを実行
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}
