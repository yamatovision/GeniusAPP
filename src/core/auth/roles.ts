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
  // 基本機能
  BASIC_USER = 'basic_user',
  
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