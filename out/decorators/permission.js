"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePermission = RequirePermission;
exports.RequireAdmin = RequireAdmin;
exports.RequireLogin = RequireLogin;
const roles_1 = require("../core/auth/roles");
const AuthGuard_1 = require("../ui/auth/AuthGuard");
const logger_1 = require("../utils/logger");
/**
 * 権限チェックを行うデコレータ
 * クラスメソッドに適用すると、実行前に権限チェックが行われる
 *
 * @param feature 必要な機能権限
 */
function RequirePermission(feature) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            logger_1.Logger.debug(`RequirePermission: ${feature}の権限チェックを実行`);
            if (!AuthGuard_1.AuthGuard.checkAccess(feature)) {
                logger_1.Logger.warn(`RequirePermission: ${feature}へのアクセスが拒否されました`);
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
function RequireAdmin() {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            logger_1.Logger.debug(`RequireAdmin: 管理者権限チェックを実行`);
            if (!AuthGuard_1.AuthGuard.checkAdminAccess(roles_1.Feature.USER_MANAGEMENT)) {
                logger_1.Logger.warn(`RequireAdmin: 管理者権限へのアクセスが拒否されました`);
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
function RequireLogin() {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            logger_1.Logger.debug(`RequireLogin: ログイン状態チェックを実行`);
            if (!AuthGuard_1.AuthGuard.checkLoggedIn()) {
                logger_1.Logger.warn(`RequireLogin: ログインしていないためアクセスが拒否されました`);
                return; // ログインしていない場合は処理を中断
            }
            // ログインしている場合は元のメソッドを実行
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}
//# sourceMappingURL=permission.js.map