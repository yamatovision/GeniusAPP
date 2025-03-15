/**
 * AppGeniusの権限システム - ロール定義と機能マッピング
 */

/**
 * ユーザーのロール（権限レベル）
 */
export enum Role {
  GUEST = 'guest',         // 未認証状態
  USER = 'user',           // 一般ユーザー
  ADMIN = 'admin',         // 管理者
  UNSUBSCRIBE = 'unsubscribe' // 退会済みユーザー
}

/**
 * アプリケーション機能のカテゴリー
 */
export enum Feature {
  // 各UIパネル（メディアリソース）
  DASHBOARD = 'dashboard',
  DEBUG_DETECTIVE = 'debug_detective',
  SCOPE_MANAGER = 'scope_manager',
  ENV_ASSISTANT = 'env_assistant',
  REFERENCE_MANAGER = 'reference_manager',
  PROMPT_LIBRARY = 'prompt_library',
  MOCKUP_GALLERY = 'mockup_gallery',
  SIMPLE_CHAT = 'simple_chat',
  CLAUDE_CODE = 'claude_code',
  ENV_VARIABLES = 'env_variables',
  CLAUDE_MD_EDITOR = 'claude_md_editor',
  
  // 管理者専用機能
  USER_MANAGEMENT = 'user_management',
  API_MANAGEMENT = 'api_management',
  SYSTEM_SETTINGS = 'system_settings'
}

/**
 * 各ロールがアクセスできる機能のマッピング
 */
export const RoleFeatureMap: Record<Role, Feature[]> = {
  // ゲストは限定的な機能のみアクセス可能
  [Role.GUEST]: [
    Feature.DASHBOARD // ダッシュボードの閲覧のみ許可
  ],
  
  // 一般ユーザーは標準機能にアクセス可能
  [Role.USER]: [
    Feature.DASHBOARD,
    Feature.DEBUG_DETECTIVE,
    Feature.SCOPE_MANAGER,
    Feature.ENV_ASSISTANT,
    Feature.REFERENCE_MANAGER,
    Feature.PROMPT_LIBRARY,
    Feature.MOCKUP_GALLERY,
    Feature.SIMPLE_CHAT,
    Feature.CLAUDE_CODE,
    Feature.ENV_VARIABLES,
    Feature.CLAUDE_MD_EDITOR
  ],
  
  // 管理者はすべての機能にアクセス可能
  [Role.ADMIN]: [
    // ユーザーの全権限
    Feature.DASHBOARD,
    Feature.DEBUG_DETECTIVE,
    Feature.SCOPE_MANAGER,
    Feature.ENV_ASSISTANT,
    Feature.REFERENCE_MANAGER,
    Feature.PROMPT_LIBRARY,
    Feature.MOCKUP_GALLERY,
    Feature.SIMPLE_CHAT,
    Feature.CLAUDE_CODE,
    Feature.ENV_VARIABLES,
    Feature.CLAUDE_MD_EDITOR,
    
    // 管理者専用機能
    Feature.USER_MANAGEMENT,
    Feature.API_MANAGEMENT,
    Feature.SYSTEM_SETTINGS
  ],
  
  // 退会済みユーザーはアクセス不可
  [Role.UNSUBSCRIBE]: []
};

/**
 * 各機能の表示名
 */
export const FeatureDisplayNames: Record<Feature, string> = {
  [Feature.DASHBOARD]: 'ダッシュボード',
  [Feature.DEBUG_DETECTIVE]: 'デバッグ探偵',
  [Feature.SCOPE_MANAGER]: 'スコープマネージャー',
  [Feature.ENV_ASSISTANT]: '環境変数アシスタント',
  [Feature.REFERENCE_MANAGER]: 'リファレンスマネージャー',
  [Feature.PROMPT_LIBRARY]: 'プロンプトライブラリ',
  [Feature.MOCKUP_GALLERY]: 'モックアップギャラリー',
  [Feature.SIMPLE_CHAT]: '要件定義チャット',
  [Feature.CLAUDE_CODE]: 'Claude Code 連携',
  [Feature.ENV_VARIABLES]: '環境変数管理',
  [Feature.CLAUDE_MD_EDITOR]: 'Claude MDエディタ',
  [Feature.USER_MANAGEMENT]: 'ユーザー管理',
  [Feature.API_MANAGEMENT]: 'API管理',
  [Feature.SYSTEM_SETTINGS]: 'システム設定'
};