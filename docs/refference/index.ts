/**
 * @file マスター型定義ファイル
 * 
 * このファイルはプロジェクト全体の型定義の「単一の真実源」です。
 * フロントエンドとバックエンドの両方で使用される全ての型定義を一元管理します。
 * 
 * 重要:
 * - このファイルを変更する際は、関連する全てのコンポーネントへの影響を考慮してください
 * - 新しい型を追加する場合は、適切なセクションに配置し、必要に応じてコメントを追加してください
 * - 型の変更履歴を docs/data_models.md に記録してください
 * 
 * 使用例:
 * ```typescript
 * import { IUser, ApiResponse, UserRole } from '@shared/index';
 * ```
 */

import { Request, RequestHandler } from 'express';

// 型定義をインポート・再エクスポート
export * from './types/enums';
export * from './types';

// モデルとその型をまとめてエクスポート
export * from './models';

// 後方互換性のための型エイリアスをエクスポート
export type { CalculationHistory } from './models/CalculationHistory';
export type { Notification } from './models/Notification';
export type { UnreadNotificationCount } from './models/Notification';


/**
 * ===== 型定義ガイドライン =====
 * 
 * 【重要：新しい型を追加する前に】
 * 1. 必ず既存の型定義を確認すること
 *    - 同じような型が既に定義されていないか
 *    - 特に Post, Response, Request の接尾辞がついた型は要確認
 * 
 * 2. 既存の型の拡張で実現できないか検討すること
 *    - extends や Omit, Pick を活用
 *    - 共通部分が多い場合は基底型からの拡張を検討
 * 
 * 3. 型を拡張する場合の注意点
 *    - 必ず任意のプロパティ（?）として追加
 *    - 既存の実装に影響を与えないようにする
 *    例）
 *    interface BaseType {
 *      required: string;
 *      optional?: string;  // 新規追加は必ず任意に
 *    }
 * 
 * 4. 新しい型を作成する場合の命名規則
 *    - データモデル: [Model]Type または I[Model]
 *    - リクエスト: [Model]Request
 *    - レスポンス: [Model]Response
 *    - 設定: [Feature]Settings
 *    例）PostType, IPost, CreatePostRequest, PostResponse, GeneratorSettings
 * 
 * 5. 型の重複を避けるために
 *    - 共通のプロパティは基底型として切り出す
 *    - 複数の場所で使用される型は、この共通定義に集約する
 *    - APIレスポンスは ApiResponse<T> を使用する
 * 
 * 6. 型名を変更または非推奨にする場合
 *    - 元の型を型エイリアスとして保持し、@deprecatedコメントを追加する
 *    - 新しい型にコメントで移行理由を記載する
 *    - shared/index.tsで明示的に古い型エイリアスをエクスポートする
 *    例：モデルファイル内では「@deprecated IUserを使用してください」とコメントし、
 *    「export type User = IUser;」と定義。
 *    shared/index.ts内では「export type { User } from './models/User';」と
 *    明示的にエクスポートする。
 * 
 * 【重要：複数のサービスで同じ型名を使用している場合】
 * 1. 各サービスでの型の使用状況を調査
 *    - 必須のプロパティを特定
 *    - サービス固有のプロパティを特定
 * 
 * 2. 型の統合方針
 *    - 共通で使用するプロパティは必須項目として定義
 *    - サービス固有のプロパティは全てオプショナル（?）にする
 *    - 既存の実装を壊さないよう注意
 * 
 * 3. 統合例
 *    避けるべき実装: 
 *    - ServiceAPost と ServiceBPost のように別々のインターフェースを定義
 *    
 *    正しい実装:
 *    - 共通インターフェースを作成し、共通プロパティは必須に
 *    - サービス固有のプロパティはオプショナル（?）にする
 *    - メタデータのような拡張可能な構造を用意する
 * 
 * 4. 移行のポイント
 *    - 一度に全ての変更を行わない
 *    - まず共通の型を定義
 *    - 段階的に各サービスの実装を更新
 *    - 既存の機能を壊さないよう注意
 * 
 * 【絶対に守るべき原則】
 * 1. フロントエンドとバックエンドで異なる型を作らない
 * 2. 同じデータ構造に対して複数の型を作らない
 * 3. 新しいプロパティは必ずオプショナルとして追加
 * 4. データの形は1箇所でのみ定義し、それを共有する
 */

// =========== 基本型 ===========
/** MongoDBのObjectId型（文字列として扱う） */
export type ObjectId = string;

/** 全てのMongooseドキュメントの基本型 */
export interface BaseDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  // Mongoose共通メソッド
  toObject(): any;
  toJSON(): any;
  save(): Promise<any>; // 汎用的なsaveメソッドを追加
  isModified?(path: string): boolean; // isModifiedメソッドを任意プロパティとして追加
  id?: string; // idアクセスプロパティを任意プロパティとして追加
}

/** 座標型 [経度, 緯度] */
export type Coordinates = [number, number];

/** 経費項目型 */
export interface Expense {
  name: string;
  amount: number;
  isPercentage: boolean;
}

// =========== 列挙型 ===========
/** ユーザーロール定義 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER = 'USER'
}

/** ビジネスタイプ */
export enum BusinessType {
  RESTAURANT = 'restaurant',
  RETAIL = 'retail',
  SERVICE = 'service',
  MANUFACTURING = 'manufacturing',
  TECHNOLOGY = 'technology',
  OTHER = 'other'
}

/** データソース定義 */
export enum DataSource {
  INTERNAL = 'internal',
  BIZBUYSELL = 'bizbuysell',
  BUSINESSESFORSALE = 'businessesforsale'
}

/** 問い合わせステータス */
export enum InquiryStatus {
  SENT = 'sent',
  RECEIVED = 'received',
  REPLIED = 'replied',
  CLOSED = 'closed'
}

/** 通知タイプ */
export enum NotificationType {
  LISTING_UPDATE = 'listing_update',
  FAVORITE_PRICE_CHANGE = 'favorite_price_change',
  INQUIRY_REPLY = 'inquiry_reply',
  SYSTEM = 'system'
}

/** API標準エラーコード */
// ApiErrorCodeは上部のimportを通じて利用可能

/** リスティングステータス */
export enum ListingStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SOLD = 'sold',
  INACTIVE = 'inactive'
}

// =========== APIレスポンス型 ===========
/** ページネーション情報 */
export interface PaginationInfo {
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
}

/** API成功レスポンス型 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationInfo;
}

/** APIエラー詳細 */
export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

/** APIエラーレスポンス型 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: ApiErrorDetail[];
}

/** API統合レスポンス型（成功またはエラー） */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** APIレスポンス型ガード関数 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * 成功レスポンスを作成
 */
export function createSuccessResponse<T>(data: T, message?: string, pagination?: PaginationInfo): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data
  };
  
  if (message) response.message = message;
  if (pagination) response.meta = pagination;
  
  return response;
}

/**
 * エラーレスポンスを作成
 */
export function createErrorResponse(
  message: string,
  code?: string,
  errors?: ApiErrorDetail[]
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    success: false,
    message
  };
  
  if (code) response.code = code;
  if (errors && errors.length > 0) response.errors = errors;
  
  return response;
}

/**
 * エラー詳細を作成
 */
export function createErrorDetail(code: string, message: string, field?: string): ApiErrorDetail {
  return { code, message, field };
}

// =========== サービス結果型 ===========
/** サービスレイヤーの結果型 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  errors?: Array<{
    code: string;
    field?: string;
    message: string;
  }>;
}

// =========== 認証関連型 ===========
/** JWT認証ペイロード */
export interface AuthPayload {
  _id: string;
  email: string;
  role: UserRole;
}

/** トークンペア */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** トークンレスポンス */
export interface TokenResponse {
  tokens: TokenPair;
  expiresAt?: Date;
}

/** 認証レスポンス */
export interface AuthResponse {
  user: SafeUser;  // パスワードを含まない安全な型
  tokens: TokenPair;
  message?: string;
}

/** パスワード変更DTO */
export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

/** パスワードリセットDTO */
export interface ResetPasswordDTO {
  token: string;
  newPassword: string;
}

/** メール確認レスポンスデータ */
export interface VerifyEmailResponseData {
  message: string;
}

/** パスワード忘れレスポンスデータ */
export interface ForgotPasswordResponseData {
  message: string;
  resetToken?: string;
}

/** パスワードリセットレスポンスデータ */
export interface ResetPasswordResponseData {
  message: string;
}

/** ログイン認証情報 */
export interface LoginUserDTO {
  emailOrUsername: string;
  password: string;
}

/** 後方互換性のためのエイリアス */
export type LoginCredentials = LoginUserDTO;

/** ユーザー登録データ */
export interface RegisterUserDTO {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/** 後方互換性のためのエイリアス */
export type RegisterData = RegisterUserDTO;

/** ユーザープロフィール更新DTO */
export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  language?: string;
  profileImage?: string;
}

// =========== ユーザーモデル ===========
/** ユーザーインターフェース */
export interface IUser {
  _id: ObjectId;
  username: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isEmailVerified: boolean;
  profileImage?: string;
  language?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongooseユーザードキュメント型 */
export interface UserDocument extends BaseDocument {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isEmailVerified: boolean;
  profileImage?: string;
  language?: string;
  lastLogin?: Date;
  // 認証関連の追加フィールド
  verificationToken?: string;
  verificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Mongooseメソッド
  comparePassword(password: string): Promise<boolean>;
  isModified(path: string): boolean;
  save(): Promise<UserDocument>;
  // IDアクセス用プロパティ
  id: string;
}

/** 後方互換性用エイリアス */
export type User = IUser;

/** ユーザー作成DTO */
export interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

/** ユーザー更新DTO */
export interface UpdateUserDTO {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  profileImage?: string;
  language?: string;
}

/** フロントエンド用安全なユーザー型（パスワード除外） */
export type SafeUser = Omit<IUser, 'password'>;

// =========== リスティングモデル ===========
/**
 * 案件インターフェース
 * リスティングの基本情報とビジネス関連データを含む
 */
export interface IListing {
  _id: ObjectId;
  externalId: string;
  source: DataSource;
  title: string;
  titleJa?: string;
  description: string;
  descriptionJa?: string;
  price: number;
  businessType: string;
  subType?: string;
  
  // 所在地情報
  location: {
    state: string;
    city: string;
    address?: string;
    zipCode?: string;
    coordinates?: Coordinates;
  };
  
  // 財務情報
  financials?: {
    annualRevenue?: number;
    cashFlow?: number;
    inventory?: number;
    realEstate?: boolean;
  };
  
  // ビジネス詳細
  businessDetails?: {
    established?: number;
    employees?: number;
    reasonForSelling?: string;
    reasonForSellingJa?: string;
  };
  
  // 連絡先情報
  contactInfo?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  
  images: string[];
  status: ListingStatus | string;
  isActive: boolean;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongooseリスティングドキュメント型 */
export interface ListingDocument extends Omit<IListing, '_id'>, BaseDocument {
  externalId: string;
  source: DataSource;
  title: string;
  titleJa?: string;
  description: string;
  descriptionJa?: string;
  price: number;
  businessType: string;
  subType?: string;
  location: {
    state: string;
    city: string;
    address?: string;
    zipCode?: string;
    coordinates?: Coordinates;
  };
  financials?: {
    annualRevenue?: number;
    cashFlow?: number;
    inventory?: number;
    realEstate?: boolean;
  };
  businessDetails?: {
    established?: number;
    employees?: number;
    reasonForSelling?: string;
    reasonForSellingJa?: string;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  images: string[];
  status: ListingStatus | string;
  isActive: boolean;
  lastUpdated: Date;
  save(): Promise<ListingDocument>; // 明示的な戻り値型を指定
}

/** 後方互換性用エイリアス */
export type Listing = IListing;

/** お気に入り情報を含むリスティングの拡張型 */
export interface ListingWithFavorite extends IListing {
  isFavorite: boolean;
}

/** 部分的なリスティング情報（概要情報など） */
export interface PartialListing {
  _id?: ObjectId;
  title: string;
  titleJa?: string;
  price: number;
  businessType: string;
  location: {
    state: string;
    city: string;
    address?: string;
    zipCode?: string;
    coordinates?: Coordinates;
  };
  images: string[];
  externalId?: string;
  source?: DataSource;
  description?: string;
  descriptionJa?: string;
  status?: ListingStatus | string;
  isActive?: boolean;
}

/** リスティング作成DTO */
export interface CreateListingDTO {
  externalId: string;
  source: DataSource;
  title: string;
  description: string;
  price: number;
  businessType: string;
  subType?: string;
  location: {
    state: string;
    city: string;
    address?: string;
    zipCode?: string;
    coordinates?: Coordinates;
  };
  financials?: {
    annualRevenue?: number;
    cashFlow?: number;
    inventory?: number;
    realEstate?: boolean;
  };
  businessDetails?: {
    established?: number;
    employees?: number;
    reasonForSelling?: string;
    reasonForSellingJa?: string;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  images?: string[];
  status?: ListingStatus | string;
  isActive?: boolean;
  lastUpdated?: Date;
}

/** リスティング更新DTO */
export interface UpdateListingDTO {
  title?: string;
  titleJa?: string;
  description?: string;
  descriptionJa?: string;
  price?: number;
  businessType?: string;
  subType?: string;
  location?: {
    state?: string;
    city?: string;
    address?: string;
    zipCode?: string;
    coordinates?: Coordinates;
  };
  financials?: {
    annualRevenue?: number;
    cashFlow?: number;
    inventory?: number;
    realEstate?: boolean;
  };
  businessDetails?: {
    established?: number;
    employees?: number;
    reasonForSelling?: string;
    reasonForSellingJa?: string;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  images?: string[];
  status?: ListingStatus | string;
  isActive?: boolean;
  lastUpdated?: Date;
}

/** 位置検索パラメータ */
export interface LocationSearchParams {
  state?: string;
  city?: string;
  radius?: number;
  coordinates?: Coordinates;
}

/** リスティング検索パラメータ */
export interface ListingSearchParams {
  // 位置関連パラメータ
  state?: string;
  city?: string;
  radius?: number;
  coordinates?: Coordinates;
  
  // ビジネス関連パラメータ
  businessType?: string | string[];
  subType?: string | string[];
  
  // 価格関連パラメータ（命名を統一）
  /** @recommended 価格下限 */
  priceMin?: number;
  /** @recommended 価格上限 */
  priceMax?: number;
  
  // 下位互換性のために残す
  /** @deprecated priceMinを使用してください */
  minPrice?: number;
  /** @deprecated priceMaxを使用してください */
  maxPrice?: number;
  
  // 検索関連パラメータ
  /** @recommended 検索キーワード */
  keywords?: string;
  /** @deprecated keywordsを使用してください */
  keyword?: string;
  query?: string;
  source?: string | string[];
  
  // フィルタリングパラメータ
  isActive?: boolean;
  
  // ページングとソート
  page?: number;
  limit?: number;
  /** @recommended ソートフィールド */
  sortBy?: string;
  /** @recommended ソート順序 ('asc'|'desc') */
  sortOrder?: 'asc' | 'desc';
  /** @deprecated sortOrderを使用してください */
  sortDirection?: 'asc' | 'desc';
  /** @deprecated sortByとsortOrderを使用してください */
  sort?: string;
}

// =========== 検索履歴モデル ===========
/** 検索履歴インターフェース */
export interface ISearchHistory {
  _id: ObjectId;
  userId: ObjectId;
  searchParams: ListingSearchParams;
  name?: string;
  resultCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongoose検索履歴ドキュメント型 */
export interface SearchHistoryDocument extends Omit<ISearchHistory, '_id'>, BaseDocument {
  userId: ObjectId;
  searchParams: ListingSearchParams;
  name?: string;
  resultCount?: number;
  lastAccessedAt?: Date;
  save(): Promise<SearchHistoryDocument>;
}

/** 検索履歴作成DTO */
export interface CreateSearchHistoryDTO {
  userId: string;
  searchParams: ListingSearchParams;
  name?: string;
  resultCount?: number;
}

/** 検索履歴更新DTO */
export interface UpdateSearchHistoryDTO {
  name?: string;
  searchParams?: ListingSearchParams;
}

/** 下位互換性のためのエイリアス */
export type SearchParams = ListingSearchParams;

/** 近接検索パラメータ */
export interface NearbySearchParams extends LocationSearchParams {
  lat: number;
  lng: number;
  radius?: number;
}

/** 位置情報検索結果 */
export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

/** 地理的境界ボックス */
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// =========== お気に入りモデル ===========
/** お気に入りインターフェース */
export interface IFavorite {
  _id: ObjectId;
  userId: ObjectId;
  listingId: ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongooseお気に入りドキュメント型 */
export interface FavoriteDocument extends Omit<IFavorite, '_id'>, BaseDocument {
  userId: ObjectId;
  listingId: ObjectId;
  notes?: string;
  save(): Promise<FavoriteDocument>; // 明示的な戻り値型を指定
}

/** お気に入り作成DTO */
export interface CreateFavoriteDTO {
  userId: string;
  listingId: string;
  notes?: string;
}

/** お気に入り更新DTO */
export interface UpdateFavoriteDTO {
  notes?: string;
}

// =========== 問い合わせモデル ===========
/** 問い合わせインターフェース */
export interface IInquiry {
  _id: ObjectId;
  userId: ObjectId;
  listingId: ObjectId;
  subject: string;
  message: string;
  status: InquiryStatus;
  replies?: Array<{
    from: 'user' | 'owner';
    message: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongoose問い合わせドキュメント型 */
export interface InquiryDocument extends Omit<IInquiry, '_id'>, BaseDocument {
  userId: ObjectId;
  listingId: ObjectId;
  subject: string;
  message: string;
  status: InquiryStatus;
  replies?: Array<{
    from: 'user' | 'owner';
    message: string;
    timestamp: Date;
  }>;
  save(): Promise<InquiryDocument>; // 明示的な戻り値型を指定
}

/** リスティング情報付き問い合わせ型 */
export interface InquiryWithListing extends IInquiry {
  listing: IListing;
}

/** お気に入り情報にリスティング情報を含む拡張型 */
export interface FavoriteWithListing extends IFavorite {
  listing: IListing | PartialListing;
}

/** 問い合わせ作成DTO */
export interface CreateInquiryDTO {
  userId: string;
  listingId: string;
  subject: string;
  message: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** 問い合わせ返信作成DTO */
export interface CreateReplyDTO {
  inquiryId: string;
  from: 'user' | 'owner';
  message: string;
}

// =========== 通知モデル ===========
/** 通知インターフェース */
export interface INotification {
  _id: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  referenceId?: ObjectId;
  referenceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongoose通知ドキュメント型 */
export interface NotificationDocument extends Omit<INotification, '_id'>, BaseDocument {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  referenceId?: ObjectId;
  referenceType?: string;
  save(): Promise<NotificationDocument>; // 明示的な戻り値型を指定
}

/** 通知作成DTO */
export interface CreateNotificationDTO {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}

/** 通知更新DTO */
export interface UpdateNotificationDTO {
  isRead?: boolean;
  title?: string;
  message?: string;
}

// =========== 計算履歴モデル ===========
/** 計算履歴インターフェース */
export interface ICalculationHistory {
  _id: ObjectId;
  userId: ObjectId;
  listingId?: ObjectId;
  basePrice: number;
  expenses: Expense[];
  totalAmount: number;
  name?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  calculationConfig?: {
    downPayment?: number;
    downPaymentType?: 'percentage' | 'amount';
    interestRate?: number;
    loanTerm?: number;
    monthlyPayment?: number;
    additionalInvestment?: number;
    monthlyRevenue?: number;
    monthlyExpenses?: number;
  };
  results?: {
    monthlyPayment?: number;
    totalInterest?: number;
    totalCost?: number;
    roi?: number;
    breakEven?: number;
  };
}

/** Mongoose計算履歴ドキュメント型 */
export interface CalculationHistoryDocument extends BaseDocument {
  userId: ObjectId;
  listingId?: ObjectId;
  basePrice: number;
  expenses: Expense[];
  totalAmount: number;
  name?: string;
  notes?: string;
  save(): Promise<CalculationHistoryDocument>; // 明示的な戻り値型を指定
}

/** 計算履歴作成DTO */
export interface CreateCalculationHistoryDTO {
  userId: string;
  listingId: string;
  name?: string;
  calculationConfig?: {
    downPayment: number;
    downPaymentType?: 'percentage' | 'amount';
    interestRate: number;
    loanTerm: number;
    monthlyPayment?: number;
    additionalInvestment?: number;
    monthlyRevenue?: number;
    monthlyExpenses?: number;
  };
  results: {
    monthlyPayment: number;
    totalInterest: number;
    totalCost: number;
    roi?: number;
    breakEven?: number;
  };
}

/** リスティング情報を含む計算結果 */
export interface CalculationWithListing extends ICalculationHistory {
  listing?: {
    title: string;
    titleJa?: string;
    price: number;
    businessType: string;
    location: {
      state: string;
      city: string;
    }
  }
}

// =========== ユーザーアクティビティログ ===========
/** ログ対象アクティビティタイプ */
export enum ActivityType {
  LOGIN = 'login',
  REGISTER = 'register',
  SEARCH = 'search',
  VIEW_LISTING = 'view_listing',
  ADD_FAVORITE = 'add_favorite',
  REMOVE_FAVORITE = 'remove_favorite',
  SEND_INQUIRY = 'send_inquiry',
  UPDATE_PROFILE = 'update_profile',
  RUN_CALCULATION = 'run_calculation',
  ADMIN_ACTION = 'admin_action'
}

/** ユーザーアクティビティログインターフェース */
export interface IUserActivityLog {
  _id: ObjectId;
  userId: ObjectId;
  activityType: ActivityType;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

/** Mongooseユーザーアクティビティログドキュメント型 */
export interface UserActivityLogDocument extends BaseDocument {
  userId: ObjectId;
  activityType: ActivityType;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

/** ログアクティビティパラメータ */
export interface LogActivityParams {
  userId: string;
  activityType: ActivityType;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

// =========== Express拡張型 ===========
// Express.Requestの拡張は実際の使用場所で定義すべきですが、
// 一貫性のために基本型をここに記載します

/** 認証済みリクエスト - Express.Requestを拡張 */
export interface AuthenticatedRequest extends Request {
  user?: UserDocument;  // UserDocumentを使用
}

/**
 * RequestHandlerタイプキャスト用ヘルパー
 * Express.jsのRequestHandlerと互換性を持つよう変換するためのユーティリティ型
 * @example 
 * router.get('/profile', authenticate as unknown as RequestHandlerAuth, controller.getProfile as unknown as RequestHandlerAuth);
 */
export type RequestHandlerAuth = RequestHandler;

/**
 * Express.jsルーティングのタイプキャスト用ヘルパー
 * 実行時の型互換性のためのユーティリティ関数
 * @example 
 * const handler = asRequestHandler(authenticate);
 */
export function asRequestHandler(handler: any): RequestHandler {
  return handler as unknown as RequestHandler;
}

// =========== 位置情報関連型 ===========
/** 近接検索パラメータ */
export interface NearbySearchParams extends LocationSearchParams {
  lat: number;
  lng: number;
  radius?: number;
}

/** ジオコーディング結果 */
export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

/** 境界ボックス */
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// =========== フォーム関連型 ===========
/** フォーム状態 */
export interface FormState<T> {
  values: T;
  errors: Record<keyof T, string | null>;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValid?: boolean;
  isDirty?: boolean;
  submitCount?: number;
  dirtyFields?: Partial<Record<keyof T, boolean>>;
  submitError?: string | null;
}

// =========== テスト用モック型 ===========
/** ユーザーモック作成パラメータ */
export interface MockUserParams {
  role?: UserRole;
  isEmailVerified?: boolean;
  withPassword?: boolean;
}

/** リスティングモック作成パラメータ */
export interface MockListingParams {
  source?: DataSource;
  isActive?: boolean;
  withImages?: boolean;
  status?: ListingStatus;
}

/**
 * 型定義変更履歴
 * 
 * 形式:
 * [YYYY/MM/DD] 変更者: 変更内容 - 影響範囲
 * 
 * [2025/03/14] リファクタリングマネージャー: 初期マスターファイル作成 - 全体
 * [2025/03/13] 認証・ユーザー機能チーム: 認証関連型の修正 - 認証フロー全体
 *   - AuthPayload.roleをstring型からUserRole列挙型に変更
 *   - TokenPair型を新規追加
 *   - TokenResponse型の構造を修正（tokens: TokenPair形式に変更）
 *   - LoginUserDTO、RegisterUserDTOをメイン型として定義し、後方互換性用のエイリアス追加
 *   - UpdateProfileDTO型を追加
 *   - IUser.roleをstring型からUserRole列挙型に変更
 *   - AuthenticatedRequestをExpressのRequestから拡張するよう修正
 * [2025/03/15] リスティングモデル担当: リスティングと検索パラメータの型を統合 - 検索機能全体
 *   - IListingインターフェースを拡張し、ネストされた型構造を採用
 *   - ListingSearchParamsを拡張し、複数の類似の型を統合
 *   - 下位互換性のための代替プロパティ名を追加（priceMin/minPrice、keywords/keyword）
 *   - Coordinates型をグローバルに利用できるよう移動
 *   - ServiceResult型を追加し、APIErrorCodeと統合
 *   - ISearchHistory.searchParamsをListingSearchParams型に統一
 * [2025/03/16] 共有型定義マネージャー: MongoDB型の改善と欠損型の追加 - 型安全性全体
 *   - BaseDocumentインターフェースを拡張し、save()、isModified()、idプロパティを追加
 *   - Expense型を追加・共有型として整備
 *   - CalculationWithListing型を追加
 *   - 全てのMongooseドキュメント型をOmit<T, '_id'>とBaseDocumentから拡張するよう統一
 *   - 各Mongooseドキュメント型にsave()メソッドを明示的な戻り値型付きで追加
 *   - PartialListing型を追加して部分的なリスティング情報の型安全性を確保
 *   - FavoriteWithListing.listingがPartialListingも受け入れるよう改善
 *   - CreateInquiryDTOにcontactEmailとcontactPhoneを追加
 * [2025/03/17] 認証システム調整者: 認証関連型の完全化 - 認証フロー全体
 *   - FormState型にisValid, isDirty, submitCount, dirtyFields, submitErrorプロパティを追加
 *   - AuthContextTypeをhooks/useAuth.tsとcontext/AuthContext.tsxで一致するよう統一
 *   - UpdateProfileDTOにemail, usernameフィールドを追加（プロフィール更新機能の拡張に対応）
 * [2025/03/17] 型安全性向上チーム: 名前変更による後方互換性問題の修正
 *   - CalculationHistory, Notification, UnreadNotificationCountを明示的にエクスポート
 *   - 旧型名を新型名へのエイリアスとして保持しながら、shared/index.tsで明示的にエクスポート
 *   - 型名のリファクタリングパターンとして、「アラートステッカー」コメントと「型エイリアス」の組み合わせを採用
 */