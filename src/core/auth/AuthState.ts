import { Role } from './roles';

/**
 * 認証状態を表す不変オブジェクト
 */
export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly userId?: string;
  readonly username?: string;
  readonly role: Role;
  readonly permissions: string[];
  readonly expiresAt?: number;
  readonly timestamp: number;
}

/**
 * 認証状態のビルダー
 */
export class AuthStateBuilder {
  private _isAuthenticated: boolean = false;
  private _userId?: string;
  private _username?: string;
  private _role: Role = Role.GUEST;
  private _permissions: string[] = [];
  private _expiresAt?: number;
  
  public setAuthenticated(isAuthenticated: boolean): AuthStateBuilder {
    this._isAuthenticated = isAuthenticated;
    return this;
  }
  
  public setUserId(userId?: string): AuthStateBuilder {
    this._userId = userId;
    return this;
  }
  
  public setUsername(username?: string): AuthStateBuilder {
    this._username = username;
    return this;
  }
  
  public setRole(role: Role): AuthStateBuilder {
    this._role = role;
    return this;
  }
  
  public setPermissions(permissions: string[]): AuthStateBuilder {
    this._permissions = [...permissions];
    return this;
  }
  
  public setExpiresAt(expiresAt?: number): AuthStateBuilder {
    this._expiresAt = expiresAt;
    return this;
  }
  
  public build(): AuthState {
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
  public static fromState(state: AuthState): AuthStateBuilder {
    return new AuthStateBuilder()
      .setAuthenticated(state.isAuthenticated)
      .setUserId(state.userId)
      .setUsername(state.username)
      .setRole(state.role)
      .setPermissions(state.permissions)
      .setExpiresAt(state.expiresAt);
  }
  
  /**
   * ゲスト状態のビルダーを作成
   */
  public static guest(): AuthStateBuilder {
    return new AuthStateBuilder()
      .setAuthenticated(false)
      .setRole(Role.GUEST)
      .setPermissions([]);
  }
}

/**
 * 認証状態を比較
 * @returns 変更点の配列（変更がない場合は空配列）
 */
export function compareAuthStates(oldState: AuthState, newState: AuthState): string[] {
  const changes: string[] = [];
  
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