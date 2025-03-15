# 認証・アクセス制御強化スコープ

## 目的

このスコープは、AppGeniusのセキュリティを強化し、中央ポータルで管理されているユーザー認証・権限情報をVSCode拡張機能と連携させることを目的としています。ユーザーの役割（管理者、一般ユーザーなど）に基づいて、UIコンポーネントや機能へのアクセスを適切に制御する仕組みを実装します。

## 背景

現在のAppGeniusシステムでは、以下の課題があります：

1. VSCode拡張の各UIコンポーネント（ダッシュボード、デバッグ探偵など）は認証状態に関わらず誰でも表示・操作可能
2. ポータルシステムで管理されているユーザー権限（管理者/一般ユーザーなど）がVSCode拡張側で活用されていない
3. 機能へのアクセス制御が不十分で、権限のないユーザーでも全機能にアクセス可能
4. ClaudeCode APIプロキシは認証連携されているが、UIコンポーネントとの連携が不十分

## 主要なタスク

### 1. コア認証・権限システム実装

- **権限管理の基盤構築**
  - 権限レベルと機能アクセスの定義モデル作成
  - 権限チェック機能の実装
  - ユーザー役割と権限のマッピング

- **認証サービスの強化**
  - ユーザー役割・権限情報の取得機能強化
  - 認証状態変更の通知機能強化
  - トークンの安全な管理と更新機能の改善

- **UI操作権限の制御基盤**
  - UIコンポーネントのアクセス制御フレームワーク
  - 権限不足時の代替UI表示機能
  - ユーザー体験を損なわない権限チェック実装

### 2. VSCode拡張コマンド制御

- **拡張機能コマンドの権限チェック**
  - 各コマンド実行前の権限確認機能実装
  - 権限不足時の適切なエラーメッセージ表示
  - 共通権限チェック関数の実装

- **認証状態の視覚的フィードバック**
  - ステータスバーでの認証状態・ユーザー情報表示強化
  - 権限に基づくUIの動的変更
  - ログイン推奨メッセージの表示

### 3. Webviewパネルへの統合

- **各Webviewパネルの認証・権限チェック実装**
  - ダッシュボードパネルの権限チェック
  - デバッグ探偵パネルの権限チェック
  - スコープマネージャーパネルの権限チェック
  - 環境変数アシスタントパネルの権限チェック

- **パネル内部の機能制限**
  - 権限レベルに応じた機能の表示・非表示制御
  - 管理者専用機能の保護
  - 権限不足時のユーザーガイダンス

### 4. セキュリティ監査・ログ強化

- **セキュリティ監査機能**
  - 認証・権限関連アクションのログ記録
  - 不審なアクセスパターンの検出
  - セキュリティイベントの監視と通知

- **ログ強化**
  - セキュリティ関連イベントの詳細ログ
  - プライバシーに配慮したログ記録
  - ログの中央ポータルへの送信

## 実装対象ファイル

### 1. 新規ファイル

- **`/src/core/auth/PermissionManager.ts`** - 権限管理のコアロジック
  ```typescript
  // 権限レベル、機能アクセス定義、権限チェック機能を提供
  export class PermissionManager {
    // ユーザー権限の検証
    public hasPermission(feature: Feature, requiredAccess: AccessLevel): boolean;
    // 権限不足時の代替アクション提供
    public getAlternativeAction(feature: Feature): ActionInfo;
    // 現在のユーザー権限セットの取得
    public getCurrentPermissions(): Permission[];
  }
  ```

- **`/src/core/auth/UIAccessControl.ts`** - UI要素へのアクセス制御
  ```typescript
  // UI要素の表示・非表示、操作可否を制御
  export class UIAccessControl {
    // UI要素の表示可否を判定
    public canShowUIElement(elementId: string): boolean;
    // 機能の実行可否を判定
    public canExecuteFeature(featureId: string): boolean;
    // 管理者専用UI要素かを判定
    public isAdminOnlyElement(elementId: string): boolean;
  }
  ```

- **`/src/ui/auth/PermissionGuard.ts`** - UIコンポーネントのガード機能
  ```typescript
  // Webviewパネル表示前の権限チェック
  export class PermissionGuard {
    // パネル表示の可否を判定
    public static canShowPanel(panelType: string): boolean;
    // アクション実行の可否を判定
    public static canExecuteAction(action: string): boolean;
    // 権限不足時の処理
    public static handleInsufficientPermission(panelType: string): void;
  }
  ```

- **`/src/utils/SecurityAuditor.ts`** - セキュリティ監査機能
  ```typescript
  // セキュリティイベントの監査・ログ記録
  export class SecurityAuditor {
    // 認証イベントの記録
    public logAuthEvent(event: AuthEvent): void;
    // 権限チェックイベントの記録
    public logPermissionCheck(result: PermissionCheckResult): void;
    // 不審なアクティビティの検出
    public detectSuspiciousActivity(): SuspiciousActivityReport;
  }
  ```

### 2. 更新ファイル

- **`/src/core/auth/AuthenticationService.ts`**
  - ユーザー役割・権限情報の取得機能追加
  - PermissionManagerとの連携
  - 認証状態変更通知の強化

- **`/src/extension.ts`**
  - コマンド登録時の権限チェック追加
  - PermissionGuardの統合
  - 認証状態表示の強化

- **`/src/ui/dashboard/DashboardPanel.ts`**
  - createOrShowメソッドに権限チェック追加
  - パネル内の機能を権限に基づいて制限

- **`/src/ui/debugDetective/DebugDetectivePanel.ts`**
  - createOrShowメソッドに権限チェック追加
  - 管理者専用機能の保護

- **`/src/ui/scopeManager/ScopeManagerPanel.ts`**
  - createOrShowメソッドに権限チェック追加
  - 権限に基づいた機能制限

- **`/src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts`**
  - createOrShowメソッドに権限チェック追加
  - 管理者専用設定の保護

- **`/src/services/ClaudeCodeIntegrationService.ts`**
  - 認証・権限情報との連携強化
  - APIアクセス権限の制御強化

- **`/src/utils/logger.ts`**
  - セキュリティ関連ログの強化
  - 機密情報のマスキング機能

## 新規データモデル

```typescript
// PermissionLevel - 権限レベル
export enum PermissionLevel {
  GUEST = 'guest',      // 未認証または最小権限
  USER = 'user',        // 標準ユーザー
  POWER_USER = 'power', // パワーユーザー
  ADMIN = 'admin'       // 管理者
}

// Feature - 機能カテゴリー
export enum Feature {
  DASHBOARD = 'dashboard',
  DEBUG_DETECTIVE = 'debug_detective',
  SCOPE_MANAGER = 'scope_manager',
  ENV_ASSISTANT = 'env_assistant',
  REFERENCE_MANAGER = 'reference_manager',
  PROMPT_LIBRARY = 'prompt_library',
  MOCKUP_GALLERY = 'mockup_gallery',
  API_MANAGEMENT = 'api_management',
  USER_MANAGEMENT = 'user_management'
}

// Permission - 権限定義
export interface Permission {
  feature: Feature;     // 対象機能
  access: AccessLevel;  // アクセスレベル
}

// AccessLevel - アクセスレベル
export enum AccessLevel {
  NONE = 'none',        // アクセス不可
  VIEW = 'view',        // 閲覧のみ
  EXECUTE = 'execute',  // 実行可能
  MODIFY = 'modify',    // 変更可能
  FULL = 'full'         // フル権限
}

// UserRolePermissions - 役割ごとのデフォルト権限マップ
export const UserRolePermissions: Record<PermissionLevel, Permission[]> = {
  // 各役割に対する権限定義
};
```

## アクセプタンス基準

1. **認証連携**
   - ユーザーがログインした際、中央ポータルから役割・権限情報が正しく取得される
   - 認証状態の変更がリアルタイムでUIに反映される
   - ログアウト時に適切に権限が取り消される

2. **UI制御**
   - 未認証ユーザーは限定的な機能のみアクセス可能
   - 一般ユーザーは基本機能にアクセス可能
   - 管理者ユーザーはすべての機能にアクセス可能
   - 権限不足時に適切なエラーメッセージが表示される

3. **WebViewパネル制御**
   - 各パネルを表示する前に権限が確認される
   - 権限不足のパネルへのアクセス時、適切なフィードバックが提供される
   - パネル内の管理者専用機能が適切に保護される

4. **ログ・監査**
   - 認証・権限関連のアクションが適切にログに記録される
   - 不審なアクセスパターンが検出・通知される

## ユーザーストーリー

1. **一般ユーザーとして、**
   - ログイン後、自分に許可された機能のみ使用できる
   - 権限のない機能にアクセスしようとすると、権限が不足している旨の通知を受ける
   - アクセス可能な機能のリストを確認できる

2. **管理者ユーザーとして、**
   - すべてのUIコンポーネントと機能にアクセスできる
   - 設定の変更や管理機能を使用できる
   - ユーザーの権限を変更でき、その変更が即時に反映される

3. **未認証ユーザーとして、**
   - 基本的な情報閲覧機能のみ使用できる
   - 認証が必要な機能にアクセスしようとすると、ログインを促される
   - 認証状態を視覚的に確認できる

## 実装の注意点

1. **ユーザー体験**
   - 権限チェックは可能な限り非同期で行い、UIの応答性を維持する
   - 権限不足時は単に機能を無効化するだけでなく、代替手段やログイン促進を行う
   - 認証状態をわかりやすく表示し、ユーザーが現在の状態を把握できるようにする

2. **パフォーマンス**
   - 権限チェックのキャッシュを実装し、同じチェックを繰り返し行わないようにする
   - 認証情報の更新は必要な時のみ行い、不要なネットワークリクエストを避ける

3. **安全性**
   - クライアント側だけでなくサーバー側でも権限チェックを行う
   - 権限情報の改ざんを防止する仕組みを導入する
   - セキュリティ関連のイベントを詳細にログに記録する

## 見積もり

- 工数: 7人日
- 優先度: 高（認証システム強化とUIアクセス制御）