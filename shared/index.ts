/**
 * ===== 統合型定義・APIパスガイドライン =====
 * 
 * 【重要】このファイルはフロントエンド（client）からは直接インポートして使用します。
 * バックエンド（server）では、このファイルをリファレンスとして、
 * server/src/types/index.ts に必要な型定義をコピーして使用してください。
 * これはデプロイ時の問題を回避するためのアプローチです。
 * 
 * 【絶対に守るべき原則】
 * 1. フロントエンドとバックエンドで異なる型を作らない
 * 2. 同じデータ構造に対して複数の型を作らない
 * 3. 新しいプロパティは必ずオプショナルとして追加
 * 4. データの形はこのファイルで一元的に定義し、バックエンドはこれをコピーして使用
 * 5. APIパスは必ずこのファイルで一元管理する
 * 6. コード内でAPIパスをハードコードしない
 * 7. パスパラメータを含むエンドポイントは関数として提供する
 */

// ===== APIパス定義 =====

// Base paths
export const API_BASE = '/api';
export const API_SIMPLE_BASE = `${API_BASE}/simple`;

// Authentication endpoints
export const API_PATHS = {
  // Simple Auth
  SIMPLE_AUTH: {
    LOGIN: `${API_SIMPLE_BASE}/auth/login`,
    LOGOUT: `${API_SIMPLE_BASE}/auth/logout`,
    REGISTER: `${API_SIMPLE_BASE}/auth/register`,
    REFRESH_TOKEN: `${API_SIMPLE_BASE}/auth/refresh-token`,
    CHECK: `${API_SIMPLE_BASE}/auth/check`,
    // 新規追加: 強制ログインエンドポイント
    FORCE_LOGIN: `${API_SIMPLE_BASE}/auth/force-login`,
  },
  
  // User endpoints
  SIMPLE_USER: {
    BASE: `${API_SIMPLE_BASE}/users`,
    ANTHROPIC_API_KEY: `${API_SIMPLE_BASE}/user/anthropic-api-key`,
    getById: (id: string) => `${API_SIMPLE_BASE}/users/${id}`,
    update: (id: string) => `${API_SIMPLE_BASE}/users/${id}`,
    delete: (id: string) => `${API_SIMPLE_BASE}/users/${id}`,
  },
  
  // Organization endpoints
  SIMPLE_ORGANIZATION: {
    BASE: `${API_SIMPLE_BASE}/organizations`,
    getById: (id: string) => `${API_SIMPLE_BASE}/organizations/${id}`,
    update: (id: string) => `${API_SIMPLE_BASE}/organizations/${id}`,
    delete: (id: string) => `${API_SIMPLE_BASE}/organizations/${id}`,
  },
} as const;

// ===== 型定義 =====

// セッション情報
export interface ActiveSession {
  sessionId: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ユーザー型（既存の型を拡張）
export interface SimpleUser {
  _id: string;
  name: string;
  email: string;
  role: 'SuperAdmin' | 'Admin' | 'User';
  organizationId?: string;
  apiKeyId?: string;
  apiKeyValue?: string;
  claudeCodeLaunchCount?: number;
  refreshToken?: string;
  status: 'active' | 'disabled';
  activeSession?: ActiveSession; // 新規追加
  createdAt: Date;
  updatedAt: Date;
}

// 認証レスポンス
export interface AuthResponse {
  user: SimpleUser;
  accessToken: string;
  refreshToken: string;
  apiKey?: string;
}

// 強制ログインリクエスト
export interface ForceLoginRequest {
  email: string;
  password: string;
  forceLogin: boolean;
}

// 強制ログインレスポンス
export interface ForceLoginResponse extends AuthResponse {
  previousSessionTerminated?: boolean;
}

// セッション確認レスポンス
export interface SessionCheckResponse {
  hasActiveSession: boolean;
  sessionInfo?: {
    loginTime: Date;
    lastActivity: Date;
    ipAddress?: string;
  };
}

// エラーレスポンス
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

// セッション無効化エラー
export const SESSION_ERROR_CODES = {
  SESSION_TERMINATED: 'SESSION_TERMINATED',
  INVALID_SESSION: 'INVALID_SESSION',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type SessionErrorCode = typeof SESSION_ERROR_CODES[keyof typeof SESSION_ERROR_CODES];