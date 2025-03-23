# 認証システムの完全リファクタリング スコープ

## 概要
AppGeniusの認証システムを、シンプルで堅牢なアーキテクチャに完全リファクタリングするためのスコープです。現在の複雑な認証システムを、よりシンプルで保守性の高いSimple認証システムへと置き換え、VSCode拡張機能とClaudeCodeとの連携を強化します。また、不要なコードを徹底的に削除し、必要最小限のコード構成を目指します。

## 背景
現在の認証システムには以下の課題があります：
- 従来の認証システムとSimple認証システムが混在して複雑化
- ClaudeCodeの認証連携における技術的な制限
- 不要なコード・モデルが多数存在
- 認証フローが不安定で、頻繁にログアウトが発生

これらの課題を解決するために、シンプルなデータモデルと明確な認証フローに基づく新しい認証システムを構築する必要があります。

## 目的
1. 認証システムをシンプルな構造に再設計
2. VSCodeとClaudeCodeとの認証連携を改善
3. 冗長なコードとモデルを整理し、メンテナンス性を向上
4. 安定した認証状態を維持できるようにする
5. 不要なコードを徹底的に削除し、コードベースをスリム化

## 改善点
1. データモデルのシンプル化
   - User、Organization、ApiKeyの3モデル構成に簡素化
   - 不要なリレーションと中間テーブルの削除

2. 認証フローの改善
   - 分離認証モードを標準化
   - トークン管理の堅牢化
   - エラーハンドリングの強化

3. ユーザー体験の向上
   - 認証プロセスの簡素化
   - 直感的なUI/UXの実現
   - 安定した認証状態の維持

4. 徹底的なコード削減
   - 使用されていないコンポーネントの削除
   - 複雑な処理の単純化
   - 機能の統合によるコード量削減

## 機能要件

### 新認証システムの青写真

1. **プロンプト管理画面**
   - 既存のPortalの複雑な機能をそのまま継承
   - プロンプトの作成、編集、バージョン管理、共有機能

2. **組織設定画面**
   - 組織名の作成
   - 登録済み組織一覧のダッシュボード
   - 組織の作成・編集・削除機能

3. **組織詳細画面**
   - AdminキーによるワークスペースIの作成機能
   - APIキー登録機能（組織が使用できるすべてのAPIキーを登録）
   - SuperAdmin向けのユーザー管理画面へのリンク

4. **ユーザー管理画面**
   - ユーザー登録（名前、メール、パスワード）
   - 余剰APIキーとの自動紐付け
   - ユーザーリストの表示（Active/Inactive状態）
   - ユーザーの削除・編集・新規追加機能

### 権限管理設計

1. **SuperAdmin権限**
   - プロンプト管理、組織設定、組織詳細、ユーザー管理の全ての画面にアクセス可能
   - すべての組織のデータを閲覧・編集可能

2. **Admin権限**
   - 自分の組織のユーザー管理画面のみにアクセス可能
   - プロンプト管理は閲覧のみ可能

3. **User権限**
   - 割り当てられたAPIキーでのみ機能を利用可能
   - 閲覧権限のみ

## 実装計画

### フェーズ1: アーカイブと整理（1-2日）
- 旧認証システムをportal/archivedに移動
- 新データモデルに干渉する可能性のあるコードを特定
- 不要なコードの徹底的な洗い出しと削除計画作成

#### フェーズ1の詳細実施計画（2025/03/23追加）

1. **アーカイブ準備**
   - アーカイブディレクトリ構造の作成（`portal/archived/auth/`以下に各種ディレクトリ）
   - 現行認証システムの全体的な依存関係図の作成と影響範囲の特定
   - 認証フロー検証用のテストスクリプトの準備

2. **認証コードの詳細分析**
   - 現行認証システムと「Simple認証システム」の並存状況の分析
   - 不要/重複していると思われるコードの特定
   - 認証フローの全体像と依存関係のマッピング
   - VSCode拡張機能とClaudeCode CLI間の認証連携の分析

3. **アーカイブの実施**
   - バックエンド旧認証ファイルの移動とクラス名の変更（Legacy接頭辞を追加）
   - フロントエンド旧認証ファイルの移動
   - VSCode拡張機能の旧認証ファイルのコピー（元ファイルは後のフェーズで削除）
   - 移行に必要な重要なロジックを抽出して保存

4. **削除計画の詳細化**
   - バックエンド削除候補の特定と影響分析
   - フロントエンド削除候補の特定と影響分析
   - VSCode拡張削除候補の段階的移行計画の作成
   - 依存関係に基づいた削除順序の決定

### フェーズ2: バックエンド再構築（3-4日）
- simpleUser、simpleOrganization、simpleApiKeyモデルを基盤に
- 認証フロー（ログイン/ログアウト/リフレッシュ）の完成
- VSCode拡張機能との連携APIエンドポイント追加
- 権限管理システムの実装（SuperAdmin/Admin/User）

### フェーズ3: フロントエンド再構築（3-4日）
- シンプルな管理UIの構築（組織作成→APIキー管理→ユーザー管理）
- 組織設定画面、組織詳細画面、ユーザー管理画面の実装
- 権限に基づいたUI要素の表示制御
- VSCode拡張機能との連携クライアント実装

### フェーズ4: VSCode連携（2-3日）
- ClaudeCodeAuthSyncの完全な分離認証モード対応
- シンプルな認証状態管理への移行
- 認証情報の同期機能の改善

### フェーズ5: コード削減と最適化（2日）
- 不要なコンポーネントの削除
- 重複コードの統合
- パフォーマンス最適化

### フェーズ6: 検証とデプロイ（2日）
- 統合テスト（VSCode拡張→バックエンド→ClaudeCode）
- 認証フローの完全検証
- デプロイ準備と実行

## データモデル

### User
```
{
  id,               // システム内での一意識別子
  name,             // ユーザー名
  email,            // メールアドレス（ログインID）
  password,         // パスワード（ハッシュ化）
  role,             // 権限（SuperAdmin/Admin/User）
  organizationId,   // 所属組織
  apiKeyId,         // 紐づくAPIキーの内部ID
  refreshToken,     // リフレッシュトークン
  status            // アカウント状態（active/disabled）
}
```

### Organization
```
{
  id,               // システム内での一意識別子
  name,             // 組織名
  description,      // 組織説明
  workspaceName,    // ワークスペース名（1:1対応）
  apiKeyIds         // 組織に紐づくAPIキーのID配列
}
```

### ApiKey
```
{
  id,               // システム内での一意識別子
  keyValue          // Anthropicから取得したAPIキーの実際の値
}
```

## 技術選択
- 認証技術: 既存のJWTベースを維持（シンプル化）
- データベース: 現在のMongoDBを継続利用
- UI: ReactベースのSimpleフロントエンド

## 削除対象コード
- 古い認証システム関連のコード一式
- 未使用のコンポーネントとサービス
- 重複実装された認証関連機能
- 過剰に複雑化されたミドルウェア
- 古いUI要素とそれに関連するスタイルシート

### フェーズ1で明確になった削除候補詳細リスト（2025/03/23追加）

#### バックエンド削除候補
1. **auth.controller.js** - 旧認証システムのコントローラー（アーカイブ後に削除）
2. **auth.routes.js** - 旧認証ルート定義（アーカイブ後に削除）
3. **auth.middleware.js** - 旧認証ミドルウェア（アーカイブ後に削除）
4. **userRole.model.js** - 不要な中間テーブルモデル（直接削除可能）
5. **role.model.js** - 不要な役割モデル（直接削除可能）
6. **refreshToken.model.js** - 分離した不要なトークンモデル（直接削除可能）

#### フロントエンド削除候補
1. **components/auth/Login.js** - 旧ログインコンポーネント（アーカイブ後に削除）
2. **services/auth.service.js** - 旧認証サービス（アーカイブ後に削除）
3. **components/auth/Register.js** - 旧登録コンポーネント（アーカイブ後に削除）
4. **utils/auth-header.js** - 旧認証ヘッダーユーティリティ（SimpleAuth用に切り替え後削除）

#### VSCode拡張削除候補（フェーズ2で段階的に）
1. **AuthenticationService.ts** - 徐々にSimpleAuthServiceに機能を移行
2. **TokenManager.ts** - 徐々にSimpleAuthManagerに機能を移行

### 保持すべき重要なロジック
1. **認証状態管理のObserverパターン** - AuthenticationService.tsから
2. **トークン更新・検証ロジック** - TokenManager.tsから
3. **認証同期メカニズム** - ClaudeCodeAuthSync.tsから
4. **安全なストレージアクセス** - AuthStorageManager.tsから
5. **例外処理パターン** - auth.controller.jsから

## リスク対策
- 認証障害発生時のフォールバック機構を実装
- トークン保存の冗長化（複数の保存場所）
- 詳細なログ記録と障害追跡機能
- 段階的な切り替えで既存機能への影響を最小化

## 対象ファイル

### バックエンド
- portal/backend/models/simpleUser.model.js
- portal/backend/models/simpleOrganization.model.js
- portal/backend/models/simpleApiKey.model.js
- portal/backend/controllers/simpleAuth.controller.js
- portal/backend/controllers/simpleOrganization.controller.js
- portal/backend/controllers/simpleUser.controller.js
- portal/backend/middlewares/simple-auth.middleware.js
- portal/backend/routes/simple.routes.js
- portal/backend/utils/simpleAuth.helper.js
- portal/backend/config/simple-auth.config.js

### フロントエンド
- portal/frontend/src/components/simple/SimpleApp.js
- portal/frontend/src/components/simple/SimpleLogin.js
- portal/frontend/src/components/simple/SimpleRegister.js
- portal/frontend/src/components/simple/SimpleDashboard.js
- portal/frontend/src/components/simple/SimpleOrganizationForm.js
- portal/frontend/src/components/simple/SimpleOrganizationDetail.js
- portal/frontend/src/components/simple/SimpleUserManagement.js
- portal/frontend/src/services/simple/simpleAuth.service.js
- portal/frontend/src/services/simple/simpleOrganization.service.js
- portal/frontend/src/services/simple/simpleUser.service.js
- portal/frontend/src/services/simple/simpleApiKey.service.js
- portal/frontend/src/utils/simple-auth-header.js

### VSCode拡張
- src/core/auth/SimpleAuthService.ts
- src/core/auth/SimpleAuthManager.ts
- src/services/ClaudeCodeAuthSync.ts
- src/api/claudeCodeApiClient.ts

### 削除対象
- portal/backend/controllers/auth.controller.js（アーカイブ後）
- portal/backend/models/[古いモデル一式]（アーカイブ後）
- portal/frontend/src/components/auth/（アーカイブ後）
- 他、未使用または重複実装とされるコンポーネント

## テスト計画
- ユニットテスト: 認証コントローラー、トークン管理、権限チェック
- 統合テスト: ログイン→APIアクセス→トークンリフレッシュのフロー
- エンドツーエンドテスト: VSCode拡張→バックエンド→ClaudeCode連携
- パフォーマンステスト: 認証処理の応答時間計測

## 参考資料
- docs/ANSWER.md
- docs/scopes/isolated-auth-implementation-scope.md
- docs/auth_architecture.md