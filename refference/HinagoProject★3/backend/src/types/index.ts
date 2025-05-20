/**
 * このファイルはshared/index.tsをリファレンスとして、バックエンドで必要な型定義を実装します。
 * ここではバックエンド固有の拡張も行います。
 */

// 以下は外部インポートではなく、ローカルで定義します
// import { ZoneType, PropertyStatus } from '../../../shared/index';
import { Request } from 'express';

// 共通型定義
export type ID = string;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

// 認証・ユーザー関連
export enum UserRole {
  USER = 'user',
}

export interface User extends Timestamps {
  id: ID;
  email: string;
  name: string;
  role: UserRole;
  organizationId: ID;
  password: string; // DBモデル用（API応答には含めない）
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthToken {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: AuthToken;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

// 組織関連
export enum SubscriptionType {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export interface Organization extends Timestamps {
  id: ID;
  name: string;
  subscription: SubscriptionType;
}

// トークン保存用モデル (MongoDBモデル用)
export interface RefreshToken extends Timestamps {
  id: ID;
  userId: ID;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
}

// バックエンド専用 - リクエスト拡張
export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
  };
}

// 物件関連
export enum ZoneType {
  CATEGORY1 = 'category1',  // 第一種低層住居専用地域
  CATEGORY2 = 'category2',  // 第二種低層住居専用地域
  CATEGORY3 = 'category3',  // 第一種中高層住居専用地域
  CATEGORY4 = 'category4',  // 第二種中高層住居専用地域
  CATEGORY5 = 'category5',  // 第一種住居地域
  CATEGORY6 = 'category6',  // 第二種住居地域
  CATEGORY7 = 'category7',  // 準住居地域
  CATEGORY8 = 'category8',  // 近隣商業地域
  CATEGORY9 = 'category9',  // 商業地域
  CATEGORY10 = 'category10', // 準工業地域
  CATEGORY11 = 'category11', // 工業地域
  CATEGORY12 = 'category12', // 工業専用地域
}

export enum FireZone {
  FIRE = 'fire',         // 防火地域
  SEMI_FIRE = 'semi-fire', // 準防火地域
  NONE = 'none',         // 指定なし
}

export enum ShadowRegulation {
  TYPE1 = 'type1',  // 規制タイプ1（4時間/2.5時間）
  TYPE2 = 'type2',  // 規制タイプ2（5時間/3時間）
  NONE = 'none',    // 規制なし
}

export enum PropertyStatus {
  NEW = 'new',           // 新規
  NEGOTIATING = 'negotiating', // 交渉中
  CONTRACTED = 'contracted',   // 契約済み
  COMPLETED = 'completed',     // 完了
}

export interface Point {
  x: number;
  y: number;
}

export interface PropertyBase {
  name: string;           // 物件名
  address: string;        // 住所
  area: number;           // 敷地面積（㎡）
  zoneType: ZoneType;     // 用途地域
  fireZone: FireZone;     // 防火地域区分
  buildingCoverage: number; // 建蔽率（%）
  floorAreaRatio: number;   // 容積率（%）
}

export interface PropertyDetail extends PropertyBase {
  shadowRegulation?: ShadowRegulation; // 日影規制
  heightLimit?: number;              // 高さ制限（m）
  roadWidth?: number;                // 前面道路幅員（m）
  allowedBuildingArea?: number;      // 許容建築面積（㎡）
  price?: number;                    // 想定取得価格（円）
  notes?: string;                    // 備考・メモ
}

export interface PropertyCreateData extends PropertyDetail {
  status?: PropertyStatus;
}

export interface PropertyUpdateData extends Partial<PropertyDetail> {
  status?: PropertyStatus;
}

/**
 * 物件フィルター
 */
export interface PropertyFilter {
  name?: string;
  address?: string;
  area?: {
    min?: number;
    max?: number;
  };
  zoneType?: ZoneType;
  status?: PropertyStatus;
}

export interface ShapeData {
  points: Point[];
  width?: number;  // 敷地間口（m）
  depth?: number;  // 敷地奥行（m）
  sourceFile?: string; // 元ファイル名
}

export enum HistoryAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

// APIパス定義
export const API_PATHS = {
  // 認証関連
  AUTH: {
    BASE: '/api/auth',
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    PASSWORD_RESET_REQUEST: '/api/auth/password-reset/request',
    PASSWORD_RESET_CONFIRM: '/api/auth/password-reset/confirm',
    ME: '/api/auth/me'
  },
  
  // ユーザー関連
  USERS: {
    BASE: '/api/users',
    DETAIL: (userId: string) => `/api/users/${userId}`,
    PROFILE: '/api/users/profile',
  },
  
  // 組織関連
  ORGANIZATIONS: {
    BASE: '/api/organizations',
    DETAIL: (orgId: string) => `/api/organizations/${orgId}`,
  },
  
  // 物件関連
  PROPERTIES: {
    BASE: '/api/properties',
    DETAIL: (propertyId: string) => `/api/properties/${propertyId}`,
    DOCUMENTS: (propertyId: string) => `/api/properties/${propertyId}/documents`,
    HISTORY: (propertyId: string) => `/api/properties/${propertyId}/history`,
    UPLOAD_SURVEY: '/api/properties/upload-survey',
    SHAPE: (propertyId: string) => `/api/properties/${propertyId}/shape`,
    VOLUME_CHECKS: (propertyId: string) => `/api/properties/${propertyId}/volume-checks`,
  }
};

// 認証設定
export const API_AUTH_CONFIG = {
  // 認証が不要なパブリックエンドポイント
  PUBLIC_ENDPOINTS: [
    API_PATHS.AUTH.LOGIN,
    API_PATHS.AUTH.REGISTER,
    API_PATHS.AUTH.REFRESH,
    API_PATHS.AUTH.PASSWORD_RESET_REQUEST,
    API_PATHS.AUTH.PASSWORD_RESET_CONFIRM,
  ],
  
  // アクセストークン設定
  TOKEN_CONFIG: {
    ACCESS_TOKEN_EXPIRY: 15 * 60, // 15分（秒単位）
    REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7日（秒単位）
    REFRESH_TOKEN_EXPIRY_REMEMBER: 30 * 24 * 60 * 60, // 30日（秒単位）
  }
};