"use strict";
/**
 * AppGeniusの権限システム - シンプルな役割と機能の定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleDisplayNames = exports.FeatureDisplayNames = exports.RoleFeatureMap = exports.Feature = exports.Role = void 0;
/**
 * ユーザーの役割（権限レベル）
 */
var Role;
(function (Role) {
    Role["GUEST"] = "guest";
    Role["USER"] = "user";
    Role["ADMIN"] = "admin";
    Role["SUPER_ADMIN"] = "super_admin"; // スーパー管理者
})(Role || (exports.Role = Role = {}));
/**
 * アプリケーション機能
 */
var Feature;
(function (Feature) {
    // 各UIパネル
    Feature["DASHBOARD"] = "dashboard";
    Feature["DEBUG_DETECTIVE"] = "debug_detective";
    Feature["SCOPE_MANAGER"] = "scope_manager";
    Feature["ENV_ASSISTANT"] = "env_assistant";
    Feature["REFERENCE_MANAGER"] = "reference_manager";
    Feature["PROMPT_LIBRARY"] = "prompt_library";
    Feature["MOCKUP_GALLERY"] = "mockup_gallery";
    Feature["SIMPLE_CHAT"] = "simple_chat";
    Feature["CLAUDE_CODE"] = "claude_code";
    Feature["ENV_VARIABLES"] = "env_variables";
    // 管理者専用機能
    Feature["USER_MANAGEMENT"] = "user_management";
    Feature["SYSTEM_SETTINGS"] = "system_settings";
})(Feature || (exports.Feature = Feature = {}));
/**
 * 各ロールがアクセスできる機能の定義
 */
exports.RoleFeatureMap = {
    // ゲストは限定的な機能のみアクセス可能
    [Role.GUEST]: [
        Feature.DASHBOARD
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
        Feature.ENV_VARIABLES
    ],
    // 管理者はすべての機能にアクセス可能
    [Role.ADMIN]: [
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
        Feature.USER_MANAGEMENT,
        Feature.SYSTEM_SETTINGS
    ],
    // スーパー管理者は管理者と同じ機能にアクセス可能（組織管理などのバックエンド権限が異なる）
    [Role.SUPER_ADMIN]: [
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
        Feature.USER_MANAGEMENT,
        Feature.SYSTEM_SETTINGS
    ]
};
/**
 * 各機能の表示名
 */
exports.FeatureDisplayNames = {
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
    [Feature.USER_MANAGEMENT]: 'ユーザー管理',
    [Feature.SYSTEM_SETTINGS]: 'システム設定'
};
/**
 * 役割の表示名
 */
exports.RoleDisplayNames = {
    [Role.GUEST]: 'ゲスト',
    [Role.USER]: '一般ユーザー',
    [Role.ADMIN]: '管理者',
    [Role.SUPER_ADMIN]: 'スーパー管理者'
};
//# sourceMappingURL=roles.js.map