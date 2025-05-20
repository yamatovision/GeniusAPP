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

// ==========================================================
// 共通型定義
// ==========================================================

/**
 * 基本ID型
 */
export type ID = string;

/**
 * タイムスタンプ関連
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ページネーション
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * 共通レスポンス形式
 */
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

// ==========================================================
// 認証・ユーザー関連
// ==========================================================

/**
 * ユーザーロール
 */
export enum UserRole {
  USER = 'user',
}

/**
 * ユーザー
 */
export interface User extends Timestamps {
  id: ID;
  email: string;
  name: string;
  role: UserRole;
  organizationId: ID;
}

/**
 * ログイン情報
 */
export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 認証トークン
 */
export interface AuthToken {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * 認証レスポンス
 */
export interface AuthResponse {
  user: User;
  token: AuthToken;
}

/**
 * パスワードリセット要求
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * パスワードリセット確認
 */
export interface PasswordResetConfirm {
  token: string;
  password: string;
}

/**
 * ユーザー登録データ
 */
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

// ==========================================================
// 組織関連
// ==========================================================

/**
 * サブスクリプションタイプ
 */
export enum SubscriptionType {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
}

/**
 * 組織
 */
export interface Organization extends Timestamps {
  id: ID;
  name: string;
  subscription: SubscriptionType;
}

// ==========================================================
// 物件関連
// ==========================================================

/**
 * 用途地域
 */
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

/**
 * 防火地域区分
 */
export enum FireZone {
  FIRE = 'fire',         // 防火地域
  SEMI_FIRE = 'semi-fire', // 準防火地域
  NONE = 'none',         // 指定なし
}

/**
 * 日影規制
 */
export enum ShadowRegulation {
  TYPE1 = 'type1',  // 規制タイプ1（4時間/2.5時間）
  TYPE2 = 'type2',  // 規制タイプ2（5時間/3時間）
  NONE = 'none',    // 規制なし
}

/**
 * 物件ステータス
 */
export enum PropertyStatus {
  NEW = 'new',           // 新規
  NEGOTIATING = 'negotiating', // 交渉中
  CONTRACTED = 'contracted',   // 契約済み
  COMPLETED = 'completed',     // 完了
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

/**
 * 物件基本情報
 */
export interface PropertyBase {
  name: string;           // 物件名
  address: string;        // 住所
  area: number;           // 敷地面積（㎡）
  zoneType: ZoneType;     // 用途地域
  fireZone: FireZone;     // 防火地域区分
  buildingCoverage: number; // 建蔽率（%）
  floorAreaRatio: number;   // 容積率（%）
}

/**
 * 物件詳細情報
 */
export interface PropertyDetail extends PropertyBase {
  shadowRegulation?: ShadowRegulation; // 日影規制
  heightLimit?: number;              // 高さ制限（m）
  roadWidth?: number;                // 前面道路幅員（m）
  allowedBuildingArea?: number;      // 許容建築面積（㎡）
  price?: number;                    // 想定取得価格（円）
  notes?: string;                    // 備考・メモ
}

/**
 * 物件登録データ
 */
export interface PropertyCreateData extends PropertyDetail {
  status?: PropertyStatus;
}

/**
 * 物件
 */
export interface Property extends PropertyDetail, Timestamps {
  id: ID;
  organizationId: ID;
  status: PropertyStatus;
  shapeData?: ShapeData;
}

/**
 * 物件更新データ
 */
export interface PropertyUpdateData extends Partial<PropertyDetail> {
  status?: PropertyStatus;
}

// ==========================================================
// 形状データ関連
// ==========================================================

/**
 * 座標点
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 敷地形状データ
 */
export interface ShapeData {
  points: Point[];
  width?: number;  // 敷地間口（m）
  depth?: number;  // 敷地奥行（m）
  sourceFile?: string; // 元ファイル名
}

// ==========================================================
// アセットタイプ関連
// ==========================================================

/**
 * アセットタイプ
 */
export enum AssetType {
  MANSION = 'mansion',             // マンション
  OFFICE = 'office',               // オフィス
  WOODEN_APARTMENT = 'wooden-apartment', // 木造アパート
  HOTEL = 'hotel',                 // ホテル
}

/**
 * アセットタイプ情報
 */
export interface AssetTypeInfo {
  id: AssetType;
  name: string;
  defaultFloorHeight: number;    // デフォルト階高（m）
  commonAreaRatio: number;       // 共用部率（%）
  standardConsumptionRate: number; // 標準的な容積消化率（%）
}

// ==========================================================
// ボリュームチェック関連
// ==========================================================

/**
 * 建築パラメータ
 */
export interface BuildingParams {
  assetType: AssetType;
  floorHeight: number;       // 階高（m）
  commonAreaRatio: number;   // 共用部率（%）
  roadWidth?: number;        // 前面道路幅員（m）
  floors: number;            // 階数
}

/**
 * 階別情報
 */
export interface Floor {
  level: number;         // 階数
  area: number;          // 床面積（㎡）
  commonArea?: number;   // 共用部面積（㎡）
  privateArea?: number;  // 専有部面積（㎡）
}

/**
 * ボリュームチェック結果
 */
export interface VolumeCheckResult {
  id: ID;
  propertyId: ID;
  assetType: AssetType;
  buildingArea: number;      // 建築面積（㎡）
  totalFloorArea: number;    // 延床面積（㎡）
  buildingHeight: number;    // 建物高さ（m）
  consumptionRate: number;   // 容積消化率（%）
  floors: Floor[];           // 階別情報
  createdAt: Date;
  model3dData?: {
    url: string;
    format: string;
  };
}

// ==========================================================
// 収益性試算関連
// ==========================================================

/**
 * 財務パラメータ
 */
export interface FinancialParams {
  rentPerSqm: number;        // 賃料単価（円/㎡）
  occupancyRate: number;     // 稼働率（%）
  managementCostRate: number; // 管理コスト率（%）
  constructionCost: number;  // 建設単価（円/㎡）
  rentalPeriod: number;      // 運用期間（年）
  capRate: number;           // 還元利回り（%）
}

/**
 * 年間収支
 */
export interface AnnualFinancials {
  year: number;
  rentalIncome: number;   // 賃料収入（円）
  operatingExpenses: number; // 運営費用（円）
  netOperatingIncome: number; // 純収益（円）
  cumulativeIncome: number;  // 累計収益（円）
}

/**
 * 収益性試算結果
 */
export interface ProfitabilityResult {
  id: ID;
  propertyId: ID;
  volumeCheckId: ID;
  assetType: AssetType;
  parameters: FinancialParams;
  
  // 初期投資
  landPrice: number;       // 土地価格（円）
  constructionCost: number; // 建設費（円）
  miscExpenses: number;    // 諸経費（円）
  totalInvestment: number;  // 総投資額（円）
  
  // 年間収支
  annualRentalIncome: number;    // 年間賃料収入（円）
  annualOperatingExpenses: number; // 年間運営費用（円）
  annualMaintenance: number;     // 年間修繕費（円）
  annualPropertyTax: number;     // 年間固定資産税（円）
  annualNOI: number;             // 年間純収益（円）
  
  // 財務指標
  noiYield: number;        // NOI利回り（%）
  irr: number;             // 内部収益率（%）
  paybackPeriod: number;   // 投資回収期間（年）
  npv: number;             // 正味現在価値（円）
  profitabilityIndex?: number;  // 収益性指数
  
  // キャッシュフロー
  annualFinancials: AnnualFinancials[];
  
  createdAt: Date;
}

/**
 * シナリオパラメータ
 */
export interface ScenarioParams extends FinancialParams {
  name: string;
  assetType: AssetType;
}

/**
 * シナリオ
 */
export interface Scenario {
  id: ID;
  propertyId: ID;
  volumeCheckId: ID;
  name: string;
  params: ScenarioParams;
  profitabilityResult?: ProfitabilityResult;
  createdAt: Date;
}

// ==========================================================
// 文書関連
// ==========================================================

/**
 * 文書タイプ
 */
export enum DocumentType {
  SURVEY_MAP = 'survey-map',   // 測量図
  REGISTER = 'register',      // 登記簿謄本
  CONTRACT = 'contract',      // 契約書
  PHOTO = 'photo',           // 写真
  OTHER = 'other',           // その他
}

/**
 * 文書
 */
export interface Document extends Timestamps {
  id: ID;
  propertyId: ID;
  name: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  documentType: DocumentType;
  description?: string;
}

// ==========================================================
// 履歴関連
// ==========================================================

/**
 * 履歴アクション
 */
export enum HistoryAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

/**
 * 履歴エントリ
 */
export interface HistoryEntry extends Timestamps {
  id: ID;
  propertyId: ID;
  userId: ID;
  action: HistoryAction;
  description: string;
  details?: Record<string, any>;
}

// ==========================================================
// APIパス定義
// ==========================================================

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
  },
  
  // 文書関連
  DOCUMENTS: {
    DETAIL: (documentId: string) => `/api/documents/${documentId}`,
    DOWNLOAD: (documentId: string) => `/api/documents/${documentId}/download`,
  },
  
  // 分析関連
  ANALYSIS: {
    // ボリュームチェック
    VOLUME_CHECK: {
      BASE: '/api/analysis/volume-check',
      DETAIL: (id: string) => `/api/analysis/volume-check/${id}`,
      EXPORT: (id: string) => `/api/analysis/volume-check/${id}/export`,
      MODEL: (id: string) => `/api/analysis/volume-check/${id}/model`,
    },
    // 収益性試算
    PROFITABILITY: {
      BASE: '/api/analysis/profitability',
      DETAIL: (id: string) => `/api/analysis/profitability/${id}`,
      EXPORT: (id: string) => `/api/analysis/profitability/${id}/export`,
      COMPARE: '/api/analysis/profitability/compare',
    },
    // シナリオ
    SCENARIOS: {
      BASE: '/api/analysis/scenarios',
      DETAIL: (id: string) => `/api/analysis/scenarios/${id}`,
    },
  },
  
  // ジオコーディング関連
  GEO: {
    GEOCODE: '/api/geocode',
  }
};

// ==========================================================
// 認証設定
// ==========================================================

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