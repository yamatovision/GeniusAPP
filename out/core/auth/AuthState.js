"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthStateBuilder = void 0;
exports.compareAuthStates = compareAuthStates;
const roles_1 = require("./roles");
/**
 * 認証状態のビルダー
 */
class AuthStateBuilder {
    constructor() {
        this._isAuthenticated = false;
        this._role = roles_1.Role.GUEST;
        this._permissions = [];
    }
    setAuthenticated(isAuthenticated) {
        this._isAuthenticated = isAuthenticated;
        return this;
    }
    setUserId(userId) {
        this._userId = userId;
        return this;
    }
    setUsername(username) {
        this._username = username;
        return this;
    }
    setRole(role) {
        this._role = role;
        return this;
    }
    setPermissions(permissions) {
        this._permissions = [...permissions];
        return this;
    }
    setExpiresAt(expiresAt) {
        this._expiresAt = expiresAt;
        return this;
    }
    build() {
        return {
            isAuthenticated: this._isAuthenticated,
            userId: this._userId,
            username: this._username,
            role: this._role,
            permissions: [...this._permissions],
            expiresAt: this._expiresAt,
            timestamp: Date.now()
        };
    }
    /**
     * 現在の状態を基に新しいビルダーを作成
     */
    static fromState(state) {
        return new AuthStateBuilder()
            .setAuthenticated(state.isAuthenticated)
            .setUserId(state.userId)
            .setUsername(state.username)
            .setRole(state.role)
            .setPermissions(state.permissions)
            .setExpiresAt(state.expiresAt);
    }
    /**
     * 新しいビルダーインスタンスを作成（create メソッドを追加）
     */
    static create() {
        return new AuthStateBuilder();
    }
    /**
     * ゲスト状態のビルダーを作成
     */
    static guest() {
        return new AuthStateBuilder()
            .setAuthenticated(false)
            .setRole(roles_1.Role.GUEST)
            .setPermissions([]);
    }
}
exports.AuthStateBuilder = AuthStateBuilder;
/**
 * 認証状態を比較
 * @returns 変更点の配列（変更がない場合は空配列）
 */
function compareAuthStates(oldState, newState) {
    const changes = [];
    if (oldState.isAuthenticated !== newState.isAuthenticated) {
        changes.push('isAuthenticated');
    }
    if (oldState.userId !== newState.userId) {
        changes.push('userId');
    }
    if (oldState.username !== newState.username) {
        changes.push('username');
    }
    if (oldState.role !== newState.role) {
        changes.push('role');
    }
    // 権限の比較
    if (JSON.stringify(oldState.permissions.sort()) !== JSON.stringify(newState.permissions.sort())) {
        changes.push('permissions');
    }
    if (oldState.expiresAt !== newState.expiresAt) {
        changes.push('expiresAt');
    }
    return changes;
}
//# sourceMappingURL=AuthState.js.map