// フロントエンド用型定義ファイル

/**
 * ===== 型定義同期ガイドライン =====
 * 型ファイルは下記2つの同期された型ファイルが存在します。  
 *  - **フロントエンド**: `frontend/src/types/index.ts`
 *　 - **バックエンド**: `backend/src/types/index.ts`
 * 【基本原則】この/types/index.tsを更新したら、もう一方の/types/index.tsも必ず同じ内容に更新する
 * 
 * 【変更の責任】
 * - 型定義を変更した開発者は、両方のファイルを即座に同期させる責任を持つ
 * - 1つのtypes/index.tsの更新は禁止。必ず1つを更新したらもう一つも更新その場で行う
 * 
 * 【絶対に守るべき原則】
 * 1. フロントエンドとバックエンドで異なる型を作らない
 * 2. 同じデータ構造に対して複数の型を作らない
 * 3. 新しいプロパティは必ずオプショナルとして追加
 * 4. APIパスは必ずこのファイルで一元管理する
 * 5. コード内でAPIパスをハードコードしない
 * 6. 2つの同期されたtypes/index.tsを単一の真実源とする
 * 7. パスパラメータを含むエンドポイントは関数として提供する
 */

// =============================================================================
// 基本型定義
// =============================================================================

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
  error?: string;
  meta?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// 認証・ユーザー関連
// =============================================================================

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface UserBase {
  surname: string;
  firstName: string;
  nickname?: string;
  birthday: string;
  email: string;
  profileCompleted?: boolean;
}

export interface UserCreate extends Partial<UserBase> {
  email: string;
  password?: string;
  role?: UserRole;
}

export interface User extends UserBase, Timestamps {
  id: ID;
  role: UserRole;
  status?: UserStatus;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  surname: string;
  firstName: string;
  birthday: string;
  role?: UserRole;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  surname: string;
  firstName: string;
  birthday: string;
  role?: UserRole;
}

export interface UserUpdateRequest {
  surname?: string;
  firstName?: string;
  nickname?: string;
  birthday?: string;
  email?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  todayNewUsers: number;
}

export interface UserExportData {
  profile: User;
  partners: Partner[];
  messages: Message[];
  settings: UserSettings;
  exportedAt: Date;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti?: string; // JWT ID for uniqueness
}

// フロントエンド用認証インターフェース
export interface AuthContext {
  user?: JWTPayload;
  isAuthenticated: boolean;
}

// =============================================================================
// パートナー関連
// =============================================================================

export enum Gender {
  BOYFRIEND = 'boyfriend',
  GIRLFRIEND = 'girlfriend',
}

export enum PersonalityType {
  GENTLE = 'gentle',
  COOL = 'cool',
  CHEERFUL = 'cheerful',
  TSUNDERE = 'tsundere',
  SWEET = 'sweet',
  RELIABLE = 'reliable',
  CLINGY = 'clingy',
  GENIUS = 'genius',
  CHILDHOOD = 'childhood',
  SPORTS = 'sports',
  ARTIST = 'artist',
  COOKING = 'cooking',
  MYSTERIOUS = 'mysterious',
  PRINCE = 'prince',
  OTAKU = 'otaku',
  YOUNGER = 'younger',
  BAND = 'band',
}

export enum SpeechStyle {
  POLITE = 'polite',
  CASUAL = 'casual',
  SWEET = 'sweet',
  DIALECT = 'dialect',
  COOL_TONE = 'cool_tone',
  KEIGO = 'keigo',
  TAME = 'tame',
  KANSAI = 'kansai',
  OJOUSAMA = 'ojousama',
}

export type HairStyle = 'short' | 'medium' | 'long';
export type EyeColor = 'brown' | 'black' | 'blue' | 'green';
export type BodyType = 'slim' | 'average' | 'athletic';
export type ClothingStyle = 'casual' | 'formal' | 'sporty' | 'elegant';

export interface AppearanceSettings {
  hairStyle: HairStyle;
  hairColor?: string; // 髪色プロパティを追加
  eyeColor: EyeColor;
  bodyType: BodyType;
  clothingStyle: ClothingStyle;
  generatedImageUrl?: string;
}

export interface PartnerBase {
  name: string;
  gender: Gender;
  personalityType: PersonalityType;
  speechStyle: SpeechStyle;
  systemPrompt: string;
  avatarDescription: string;
  appearance: AppearanceSettings;
  hobbies: string[];
  intimacyLevel: number;
}

export interface PartnerCreate extends PartnerBase {
  userId: ID;
  createdViaOnboarding?: boolean;
}

export interface Partner extends PartnerBase, Timestamps {
  id: ID;
  userId: ID;
  baseImageUrl?: string;
  personality?: PersonalityType; // テスト互換性のためのエイリアス
}

export interface PartnerUpdate {
  name?: string;
  personalityType?: PersonalityType;
  speechStyle?: SpeechStyle;
  systemPrompt?: string;
  avatarDescription?: string;
  appearance?: Partial<AppearanceSettings>;
  hobbies?: string[];
}

export interface PartnerCreateRequest extends PartnerBase {
  userId?: ID;
}

export interface PartnerUpdateRequest extends PartnerUpdate {}

export interface PromptValidationRequest {
  systemPrompt: string;
}

export interface PromptValidationResponse {
  isValid: boolean;
  warnings: string[];
  score?: number;
}

export interface PromptPreviewRequest {
  systemPrompt: string;
  testMessage?: string;
}

export interface PromptPreviewResponse {
  response: string;
  isValid: boolean;
}

// =============================================================================
// オンボーディング関連
// =============================================================================

export interface PartnerData {
  gender: Gender;
  name: string;
  personality: PersonalityType;
  speechStyle: SpeechStyle;
  prompt: string;
  nickname: string;
  appearance: AppearanceSettings;
  appearanceSettings?: AppearanceSettings; // 互換性のための追加プロパティ
}


export interface OnboardingProgress extends Timestamps {
  id: ID;
  userId: ID;
  currentStep: number;
  completedSteps: number[];
  userData: {
    surname: string;
    firstName: string;
    birthday: string;
  };
  partnerData: PartnerData;
  personalityAnswers: PersonalityQuestion[];
  completed: boolean;
}

export interface PersonalityQuestion {
  id: string;
  question: string;
  answer?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
}

export interface PresetPersonality {
  id: string;
  name: string;
  personality: PersonalityType;
  speechStyle: SpeechStyle;
  description: string;
  icon: string;
  prompt: string;
  systemPrompt: string;
  recommended?: boolean;
}

export interface OnboardingStartRequest {
  gender: Gender;
  name: string;
  age?: number;
}

export interface OnboardingUpdateRequest {
  step: number;
  userData?: {
    surname: string;
    firstName: string;
    birthday: string;
  };
  partnerData?: Partial<PartnerData>;
  personalityAnswers?: PersonalityQuestion[];
}

export interface OnboardingCompleteRequest {
  finalPartnerData: PartnerData;
}

export interface PersonalityPreset {
  id: string;
  name: string;
  description: string;
  personality: PersonalityType;
  speechStyle: SpeechStyle;
  systemPrompt: string;
  icon?: string;
  recommended?: boolean;
}

export interface RecommendedPresetsRequest {
  personalityAnswers: PersonalityQuestion[];
  preferences?: {
    ageRange?: string;
    interests?: string[];
    communicationStyle?: string;
  };
}

// =============================================================================
// メッセージ・会話関連
// =============================================================================

export enum MessageSender {
  USER = 'user',
  PARTNER = 'partner',
}

export interface MessageBase {
  content: string;
  sender: MessageSender;
}

export interface MessageCreate extends MessageBase {
  partnerId: ID;
}

export interface Message extends MessageBase, Timestamps {
  id: ID;
  partnerId: ID;
  emotion?: string;
  context?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  emotion?: string;
  intimacyLevel: number;
  newMessages?: Message[];
}

export interface SendMessageRequest {
  message: string;
  partnerId: ID;
  context?: Record<string, any>;
}

export interface ChatMessageRequest {
  message: string;
  partnerId: ID;
  context?: Record<string, any>;
}

export interface ChatMessageResponse {
  response: string;
  emotion?: string;
  intimacyLevel: number;
  newMessages?: Message[];
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TypingNotificationRequest {
  partnerId: ID;
  isTyping: boolean;
}

export interface EmotionState {
  current: string;
  intensity: number;
  previousEmotions: string[];
}

export interface ChatMessageRequest {
  message: string;
  partnerId: ID;
  context?: Record<string, any>;
}

export interface ChatMessageResponse {
  response: string;
  emotion?: string;
  intimacyLevel: number;
  newMessages?: Message[];
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TypingNotificationRequest {
  partnerId: ID;
  isTyping: boolean;
}

export interface EmotionState {
  current: string;
  intensity: number;
  previousEmotions: string[];
}

// =============================================================================
// 記憶・関係性管理
// =============================================================================

export enum MemoryType {
  CONVERSATION = 'conversation',
  EPISODE = 'episode',
  RELATIONSHIP = 'relationship',
  EMOTION = 'emotion',
  PREFERENCE = 'preference',
}

export interface Memory extends Timestamps {
  id: ID;
  partnerId: ID;
  type: MemoryType;
  content: string;
  vector?: number[];
  importance: number;
  emotionalWeight: number;
  tags: string[];
  relatedPeople?: string[];
}

export interface RelationshipMetrics {
  id: ID;
  partnerId: ID;
  intimacyLevel: number; // 0-100
  trustLevel: number; // 0-100
  emotionalConnection: number; // 0-100
  conversationFrequency: number;
  lastInteraction: Date;
  sharedMemories: number;
}

export interface EpisodeMemory {
  id: ID;
  partnerId: ID;
  title: string;
  description: string;
  emotionalWeight: number;
  tags: string[];
  participants: string[];
  date: Date;
}

export interface RelationshipMap {
  id: ID;
  partnerId: ID;
  personName: string;
  relationship: string;
  emotionalStatus: string;
  importance: number;
  recentEvents: string[];
  ongoingIssues: string[];
  lastMentioned: Date;
}

export interface OngoingTopic {
  id: ID;
  partnerId: ID;
  topic: string;
  relatedPeople: string[];
  status: 'active' | 'resolved' | 'dormant';
  emotionalWeight: number;
  updates: Array<{
    date: Date;
    content: string;
  }>;
  nextCheckIn: Date;
}

// メモリシステム追加型定義
export interface MemorySummaryRequest {
  partnerId: ID;
  conversationData: Array<{
    sender: MessageSender;
    content: string;
    timestamp: Date;
  }>;
  timeframe?: string;
}

export interface MemorySearchRequest {
  partnerId: ID;
  query: string;
  memoryType?: MemoryType;
  limit?: number;
  offset?: number;
}

export interface MemorySearchResponse {
  memories: Memory[];
  total: number;
  relevanceScores: number[];
}

export interface ContinuousTopic {
  id: ID;
  partnerId: ID;
  topic: string;
  relatedPeople: string[];
  status: 'active' | 'resolved' | 'dormant';
  emotionalWeight: number;
  updates: Array<{
    date: Date;
    content: string;
  }>;
  nextCheckIn: Date;
}

// =============================================================================
// 設定関連
// =============================================================================

export interface NotificationSettings {
  id?: ID;
  userId: ID;
  morningGreeting: boolean;
  morningTime: string; // HH:MM format
  reminderMessages: boolean;
  specialDays: boolean;
}

export interface UserSettings {
  id: ID;
  userId: ID;
  theme: string;
  backgroundImage: string;
  soundEnabled: boolean;
  autoSave: boolean;
  dataRetentionDays: number;
}

export interface SettingsResponse {
  success: boolean;
  data: {
    notifications: NotificationSettings;
    userSettings: UserSettings;
  };
}

export interface SettingsUpdateRequest {
  notifications?: Partial<Omit<NotificationSettings, 'id' | 'userId'>>;
  userSettings?: Partial<Omit<UserSettings, 'id' | 'userId'>>;
}

// 通知スケジュール関連
export interface NotificationScheduleRequest {
  type: 'morning_greeting' | 'reminder' | 'special_day' | 'custom';
  scheduledTime: Date | string;
  message?: string;
  partnerId?: ID;
  recurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
}

export interface NotificationScheduleResponse {
  id: string;
  userId: ID;
  partnerId?: ID;
  type: 'morning_greeting' | 'reminder' | 'special_day' | 'custom';
  scheduledTime: Date;
  message?: string;
  recurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
}

export interface NotificationStatsResponse {
  totalUsers: number;
  morningGreetingEnabled: number;
  reminderEnabled: number;
  specialDaysEnabled: number;
  popularMorningTimes: Array<{ time: string; count: number }>;
}

// =============================================================================
// 画像生成関連
// =============================================================================

export interface ImageGenerationRequest {
  partnerId: ID;
  context: string;
  emotion?: string;
  background?: string;
  clothing?: string;
  prompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  guidanceScale?: number;
}

export interface GeneratedImage {
  id: ID;
  partnerId: ID;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  context: string;
  consistencyScore: number;
  leonardoGenerationId?: string;
  modelUsed?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackgroundOption {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  isDefault: boolean;
}

export interface BackgroundImage {
  id: string;
  name: string;
  url: string;
  category: string;
  isDefault: boolean;
  thumbnail?: string;
}

// =============================================================================
// 認証関連の追加型定義
// =============================================================================

export const API_AUTH_CONFIG = {
  PUBLIC_ENDPOINTS: [
    '/api/auth/login',
    '/api/auth/refresh',
  ],
  ROLE_PROTECTED_ENDPOINTS: {
    [UserRole.ADMIN]: [
      '/api/admin',
    ]
  }
};

// =============================================================================
// APIパス定義
// =============================================================================

export const API_PATHS = {
  // 認証関連
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    CHANGE_PASSWORD: '/api/auth/change-password',
    ME: '/api/auth/me',
  },
  
  // ユーザー関連
  USERS: {
    BASE: '/api/users',
    GET: (userId: string) => `/api/users/${userId}`,
    UPDATE: (userId: string) => `/api/users/${userId}`,
    PROFILE: '/api/users/profile',
    PASSWORD: '/api/users/password',
    EXPORT: '/api/users/export',
    STATS: '/api/users/stats',
    CHECK_EMAIL: '/api/users/check-email',
    DEACTIVATE: (userId: string) => `/api/users/${userId}/deactivate`,
    ACTIVATE: (userId: string) => `/api/users/${userId}/activate`,
  },
  
  // 管理者関連
  ADMIN: {
    BASE: '/api/admin',
    USERS: {
      BASE: '/api/admin/users',
      DEACTIVATE: (userId: string) => `/api/users/${userId}/deactivate`,
      ACTIVATE: (userId: string) => `/api/users/${userId}/activate`,
    },
  },
  
  // パートナー関連
  PARTNERS: {
    BASE: '/api/partners',
    CREATE: '/api/partners',
    LIST: '/api/partners',
    GET: '/api/partners',
    DETAIL: (partnerId: string) => `/api/partners/${partnerId}`,
    UPDATE: (partnerId: string) => `/api/partners/${partnerId}`,
    DELETE: (partnerId: string) => `/api/partners/${partnerId}`,
    BY_USER: (userId: string) => `/api/users/${userId}/partners`,
    VALIDATE_PROMPT: '/api/partners/validate-prompt',
    PREVIEW: '/api/partners/preview',
    APPLY_PRESET: '/api/partners/apply-preset',
  },
  
  // オンボーディング関連
  ONBOARDING: {
    BASE: '/api/onboarding',
    START: '/api/onboarding/start',
    PROGRESS: (userId: string) => `/api/onboarding/${userId}/progress`,
    COMPLETE: (userId: string) => `/api/onboarding/${userId}/complete`,
    PERSONALITY_QUESTIONS: '/api/onboarding/personality-questions',
    PRESETS: '/api/onboarding/presets',
    RECOMMENDED_PRESETS: '/api/onboarding/recommended-presets',
    GENERATE_NAMES: '/api/onboarding/generate-names',
    GENERATE_NICKNAMES: '/api/onboarding/generate-nicknames',
  },
  
  // チャット・メッセージ関連
  CHAT: {
    BASE: '/api/chat',
    SEND_MESSAGE: '/api/chat/message',
    MESSAGES: (partnerId: string) => `/api/chat/${partnerId}/messages`,
    GENERATE_IMAGE: '/api/chat/generate-image',
    TYPING: (partnerId: string) => `/api/chat/${partnerId}/typing`,
    EMOTION: '/api/chat/emotion',
  },
  
  // 記憶・関係性関連
  MEMORY: {
    BASE: '/api/memory',
    BY_PARTNER: (partnerId: string) => `/api/memory/${partnerId}`,
    SUMMARY: '/api/memory/summary',
    SEARCH: '/api/memory/search',
    RELATIONSHIPS: (partnerId: string) => `/api/memory/${partnerId}/relationships`,
    ONGOING_TOPICS: (partnerId: string) => `/api/memory/${partnerId}/topics`,
    TOPICS: (partnerId: string) => `/api/memory/${partnerId}/topics`,
    EPISODE: (partnerId: string) => `/api/memory/${partnerId}/episodes`,
    EPISODES: (partnerId: string) => `/api/memory/${partnerId}/episodes`,
  },
  
  // 画像生成関連
  IMAGES: {
    BASE: '/api/images',
    GENERATE: '/api/images/generate',
    AVATAR: '/api/images/avatar',
    BACKGROUNDS: '/api/images/backgrounds',
    GENERATE_CHAT: '/api/images/generate-chat',
    HISTORY: (partnerId: string) => `/api/images/history/${partnerId}`,
    STATS: (partnerId: string) => `/api/images/stats/${partnerId}`,
    DELETE: (imageId: string) => `/api/images/${imageId}`,
    MODELS: '/api/images/models',
  },
  
  // 通知関連
  NOTIFICATIONS: {
    BASE: '/api/notifications',
    SETTINGS: '/api/notifications/settings',
    SCHEDULE: '/api/notifications/schedule',
    STATS: '/api/notifications/stats',
  },
  
  // 設定関連
  SETTINGS: {
    BASE: '/api/settings',
    BACKGROUNDS: '/api/settings/backgrounds',
  },
  
  // データ管理関連
  DATA: {
    EXPORT_ALL: (userId: string) => `/api/data/${userId}/export-all`,
    EXPORT_CHAT: (userId: string) => `/api/data/${userId}/export-chat`,
    IMPORT: (userId: string) => `/api/data/${userId}/import`,
    DELETE_ALL: (userId: string) => `/api/data/${userId}/delete-all`,
  },
} as const;

// =============================================================================
// フォーム・バリデーション関連
// =============================================================================

export interface FormValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => boolean | string;
}

export interface FormValidationRules {
  [key: string]: FormValidationRule;
}

export const USER_VALIDATION_RULES: FormValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 8,
    maxLength: 100,
  },
  surname: {
    required: true,
    minLength: 1,
    maxLength: 10,
  },
  firstName: {
    required: true,
    minLength: 1,
    maxLength: 10,
  },
  birthday: {
    required: true,
  },
};

export const PARTNER_VALIDATION_RULES: FormValidationRules = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 20,
  },
  systemPrompt: {
    required: true,
    minLength: 50,
    maxLength: 1000,
  },
};

// =============================================================================
// エラーハンドリング
// =============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  validationErrors?: ValidationError[];
}

// =============================================================================
// 定数定義
// =============================================================================

export const CONSTANTS = {
  MAX_MESSAGE_LENGTH: 1000,
  MAX_SYSTEM_PROMPT_LENGTH: 1000,
  MAX_PARTNER_NAME_LENGTH: 20,
  MAX_USER_NAME_LENGTH: 10,
  DEFAULT_PAGINATION_LIMIT: 20,
  MAX_INTIMACY_LEVEL: 100,
  MIN_INTIMACY_LEVEL: 0,
  DEFAULT_NOTIFICATION_TIME: '07:00',
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  MAX_IMAGE_SIZE_MB: 5,
} as const;

export const PERSONALITY_PRESETS: Record<PersonalityType, PresetPersonality> = {
  [PersonalityType.TSUNDERE]: {
    id: 'tsundere',
    name: 'ツンデレ系',
    personality: PersonalityType.TSUNDERE,
    speechStyle: SpeechStyle.CASUAL,
    description: '表面上はクールで素直になれないが、本当は優しくて思いやりがある',
    systemPrompt: `表面上はクールで素直になれないが、本当は優しくて思いやりがある。
照れると「べ、別にそんなつもりじゃないし！」などと言う。
優しさや愛情は遠回しに伝え、二人きりのときは少し甘え上手になる。`,
    prompt: '素直になれないが本当は優しいツンデレな性格',
    icon: '⚡',
  },
  [PersonalityType.SWEET]: {
    id: 'sweet',
    name: '甘々系',
    personality: PersonalityType.SWEET,
    speechStyle: SpeechStyle.SWEET,
    description: 'とても優しく、甘えん坊で、常に愛情表現が豊か',
    systemPrompt: `とても優しく、甘えん坊で、常に愛情表現が豊か。
「俺の大切な人」「ねぇ、今何してる？」など甘い言葉を多用し、
常にスキンシップを求め、愛情を言葉で伝えるのが好き。`,
    prompt: '愛情表現豊かで甘えん坊な性格',
    icon: '💖',
  },
  [PersonalityType.RELIABLE]: {
    id: 'reliable',
    name: '頼れる年上',
    personality: PersonalityType.RELIABLE,
    speechStyle: SpeechStyle.POLITE,
    description: '落ち着いていて、包容力があり、頼りになる年上の恋人',
    systemPrompt: `落ち着いていて、包容力があり、頼りになる年上の恋人。
私の悩みをよく聞き、的確なアドバイスをくれる。
経験に基づいた知恵を分け与え、成長を促す言葉をかける。`,
    prompt: '包容力があり頼りになる年上の性格',
    icon: '🌟',
  },
  [PersonalityType.GENTLE]: {
    id: 'gentle',
    name: '優しい恋人',
    personality: PersonalityType.GENTLE,
    speechStyle: SpeechStyle.POLITE,
    description: '思いやり深く、いつもあなたを支えてくれる理想的なパートナー',
    systemPrompt: `思いやり深く、いつもあなたを支えてくれる優しい恋人。
相手の気持ちを第一に考え、困った時は必ず力になってくれる。
穏やかで安心感があり、一緒にいると心が落ち着く存在。`,
    prompt: '思いやり深く優しい性格',
    icon: '💝',
  },
  [PersonalityType.COOL]: {
    id: 'cool',
    name: 'クール系',
    personality: PersonalityType.COOL,
    speechStyle: SpeechStyle.COOL_TONE,
    description: '落ち着いていて知的、冷静だが愛情深い',
    systemPrompt: `落ち着いていて知的な性格。普段はクールだが、愛情深い一面を持つ。
論理的で冷静な判断ができ、感情的になりすぎることは少ない。
でも、大切な人のことは誰よりも想っている。`,
    prompt: '知的でクールだが愛情深い性格',
    icon: '❄️',
  },
  [PersonalityType.CHEERFUL]: {
    id: 'cheerful',
    name: '明るい恋人',
    personality: PersonalityType.CHEERFUL,
    speechStyle: SpeechStyle.CASUAL,
    description: 'いつも前向きで、あなたを笑顔にしてくれる元気な存在',
    icon: '☀️',
    prompt: '明るく前向きで元気な性格',
    systemPrompt: `いつも明るく前向きで、周りを笑顔にする元気な性格。
どんな時でもポジティブに考え、相手を励ますのが得意。
一緒にいると自然と楽しい気持ちになれる、太陽のような存在。`,
  },
  [PersonalityType.CLINGY]: {
    id: 'clingy',
    name: '甘えん坊系',
    personality: PersonalityType.CLINGY,
    speechStyle: SpeechStyle.SWEET,
    description: 'いつもあなたのそばにいたい甘えん坊',
    icon: '🥰',
    prompt: 'いつもあなたのそばにいたい甘えん坊な性格',
    systemPrompt: 'いつもあなたのそばにいたい甘えん坊。常に愛情を求め、スキンシップを大切にする。',
  },
  [PersonalityType.GENIUS]: {
    id: 'genius',
    name: '天才系',
    personality: PersonalityType.GENIUS,
    speechStyle: SpeechStyle.COOL_TONE,
    description: '知的で頭脳明晰なパートナー',
    icon: '🧠',
    prompt: '知的で頭脳明晰、幅広い知識を持つ性格',
    systemPrompt: '知的で頭脳明晰、論理的思考で様々な知識を持つ天才的な性格。',
  },
  [PersonalityType.CHILDHOOD]: {
    id: 'childhood',
    name: '幼なじみ系',
    personality: PersonalityType.CHILDHOOD,
    speechStyle: SpeechStyle.CASUAL,
    description: '昔から知っている親しみやすい関係',
    icon: '👫',
    prompt: '昔から知っている親しみやすい幼なじみの性格',
    systemPrompt: '昔から知っている幼なじみ。気さくで親しみやすく、自然体で接する。',
  },
  [PersonalityType.SPORTS]: {
    id: 'sports',
    name: 'スポーツ系',
    personality: PersonalityType.SPORTS,
    speechStyle: SpeechStyle.CASUAL,
    description: '健康的で活発なスポーツ好き',
    icon: '⚽',
    prompt: '健康的で活発、スポーツを愛する性格',
    systemPrompt: '健康的で活動的、スポーツを愛し体を動かすことが好きな性格。',
  },
  [PersonalityType.ARTIST]: {
    id: 'artist',
    name: 'アーティスト系',
    personality: PersonalityType.ARTIST,
    speechStyle: SpeechStyle.COOL_TONE,
    description: '芸術的センスがあり感性豊か',
    icon: '🎨',
    prompt: '芸術的センスがあり、感性豊かな性格',
    systemPrompt: '芸術的センスに溢れ、美しいものを愛し創造性豊かな性格。',
  },
  [PersonalityType.COOKING]: {
    id: 'cooking',
    name: '料理上手系',
    personality: PersonalityType.COOKING,
    speechStyle: SpeechStyle.POLITE,
    description: '料理が得意で家庭的',
    icon: '👨‍🍳',
    prompt: '料理が得意で家庭的、優しい性格',
    systemPrompt: '料理上手で家庭的、相手のために美味しい料理を作ることを愛する性格。',
  },
  [PersonalityType.MYSTERIOUS]: {
    id: 'mysterious',
    name: 'ミステリアス系',
    personality: PersonalityType.MYSTERIOUS,
    speechStyle: SpeechStyle.COOL_TONE,
    description: '謎めいた魅力を持つ',
    icon: '🌙',
    prompt: '謎めいた魅力を持つミステリアスな性格',
    systemPrompt: '謎めいた魅力を持ち、深い秘密を抱えながらも魅力的な性格。',
  },
  [PersonalityType.PRINCE]: {
    id: 'prince',
    name: '王子様系',
    personality: PersonalityType.PRINCE,
    speechStyle: SpeechStyle.POLITE,
    description: '上品で紳士的、まるで王子様',
    icon: '👑',
    prompt: '上品で紳士的、まるで王子様のような性格',
    systemPrompt: '上品で紳士的、エレガントで礼儀正しい王子様のような性格。',
  },
  [PersonalityType.OTAKU]: {
    id: 'otaku',
    name: 'オタク系',
    personality: PersonalityType.OTAKU,
    speechStyle: SpeechStyle.CASUAL,
    description: '趣味に熱中する情熱的な性格',
    icon: '🎮',
    prompt: '趣味に熱中し、知識豊富で情熱的な性格',
    systemPrompt: '趣味に情熱的で、専門知識が豊富。好きなことには熱心に取り組む性格。',
  },
  [PersonalityType.YOUNGER]: {
    id: 'younger',
    name: '年下系',
    personality: PersonalityType.YOUNGER,
    speechStyle: SpeechStyle.CASUAL,
    description: '元気で可愛らしい年下の恋人',
    icon: '😊',
    prompt: '元気で可愛らしい、甘えたがりな年下の性格',
    systemPrompt: '元気で可愛らしく、甘えん坊で愛らしい年下の性格。',
  },
  [PersonalityType.BAND]: {
    id: 'band',
    name: 'バンド系',
    personality: PersonalityType.BAND,
    speechStyle: SpeechStyle.COOL_TONE,
    description: '音楽を愛するクールなミュージシャン',
    icon: '🎸',
    prompt: '音楽を愛し、クールでかっこいいミュージシャンの性格',
    systemPrompt: '音楽を愛し、クールでアーティスティックなミュージシャンの性格。',
  },
}

export default {
  API_PATHS,
  API_AUTH_CONFIG,
  CONSTANTS,
  PERSONALITY_PRESETS,
  USER_VALIDATION_RULES,
  PARTNER_VALIDATION_RULES,
};