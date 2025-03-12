# AppGenius - 実装状況 (2025/03/12更新)

## 関連ドキュメント参照
- [ディレクトリ構造](./structure.md) - プロジェクト全体のファイル構造と命名規則
- [データモデル](./data_models.md) - エンティティ一覧と関係性
- [API設計](./api.md) - エンドポイントとデータフロー
- [環境変数リスト](./env.md) - 必要な環境変数と設定方法
- [デプロイ情報](./deploy.md) - デプロイ手順と環境設定
- [要件定義](./requirements.md) - プロジェクト要件定義

## 認証システム設計原則
本プロジェクトでは以下の設計原則に基づく認証アーキテクチャを採用しています:

### 1. 管理者/一般ユーザー分離アーキテクチャ
- **中央管理Webポータル**: 管理者専用のプロンプト管理環境
- **VSCode拡張認証**: すべてのユーザー向け認証と権限確認
- **ClaudeCode連携**: VSCode認証と連携したClaudeCode APIアクセス制御
- **権限ベースのアクセス制御**: 管理者と一般ユーザーの権限分離

### 2. レイヤー分離アーキテクチャ
- **Controller層**: リクエスト/レスポンス処理、入力検証、HTTPステータス管理
- **Service層**: ビジネスロジック、トークン生成/検証、ユーザー操作
- **Data Access層**: データベース操作、モデル定義
- **Middleware層**: リクエスト認証、権限検証
- **Client層**: 状態管理、トークン保存、UI連携

### 3. JWTベースの認証フロー
- アクセストークン（1時間）とリフレッシュトークン（2週間）の分離
- APIリクエストには常にアクセストークンのみを使用
- 期限切れ時の透過的なトークンリフレッシュ機構
- システム間でのトークン同期と検証

### 4. 中央管理型アクセス制御
- 管理者によるアクセス権限変更が全システムに即時反映
- アクセス失効時のVSCode・ClaudeCode両方での即時ブロック
- 最大5分間隔での認証状態自動チェック
- 無効ユーザーの強制ログアウト機能

## 全体進捗
- 完成予定ファイル数: 68
- 作成済みファイル数: 15
- 進捗率: 22%
- 最終更新日: 2025/03/12

## スコープ状況

### 完了済みスコープ
- [x] 初期セットアップ (100%)
- [x] 認証Webアプリ基盤 (100%)

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
- [ ] 管理ポータルUI (0%)
- [ ] VSCode認証連携 (0%)
- [ ] プロンプト管理モデル (0%)
- [ ] プロンプト管理UI (0%)
- [ ] ClaudeCode連携 (0%)
- [ ] VSCode-プロンプト表示 (0%)
- [ ] ユーザー管理機能 (0%)
- [ ] 環境変数設定 (0%)
- [ ] システム統合テスト (0%)

#### スコープ1: 認証Webアプリ基盤 (完了)
**スコープID**: auth-web-base
**説明**: 管理者専用プロンプト管理Webアプリケーションの認証基盤構築

**含まれる機能**:
1. ユーザーデータモデルの実装
2. 管理者ログイン機能
3. JWTトークン発行と検証
4. リフレッシュトークン管理

**実装完了ファイル**:
- [x] portal/backend/config/db.config.js
- [x] portal/backend/config/auth.config.js
- [x] portal/backend/models/user.model.js
- [x] portal/backend/middlewares/auth.middleware.js
- [x] portal/backend/controllers/auth.controller.js
- [x] portal/backend/routes/auth.routes.js
- [x] portal/backend/services/auth.service.js
- [x] portal/server.js
- [x] portal/backend/.env.example
- [x] portal/package.json

#### スコープ2: 管理ポータルUI
**スコープID**: admin-portal-ui
**説明**: 管理者向けプロンプト管理ポータルのUI実装

**含まれる機能**:
1. 管理者ログインフォーム
2. ダッシュボード画面
3. 認証状態管理
4. トークン自動更新

**実装予定ファイル**:
- [ ] portal/frontend/src/components/auth/Login.js
- [ ] portal/frontend/src/components/dashboard/Dashboard.js
- [ ] portal/frontend/src/services/auth.service.js
- [ ] portal/frontend/src/utils/auth-header.js
- [ ] portal/frontend/src/App.js
- [ ] portal/frontend/src/index.js
- [ ] portal/frontend/public/index.html

#### スコープ3: VSCode認証連携
**スコープID**: vscode-auth
**説明**: VSCode拡張の認証機能と中央システムとの連携

**含まれる機能**:
1. VSCode内ログインUI
2. 認証トークン管理
3. セキュアストレージ
4. 認証状態の永続化
5. 一般ユーザー/管理者権限分離

**実装予定ファイル**:
- [ ] src/core/auth/AuthenticationService.ts
- [ ] src/core/auth/TokenManager.ts
- [ ] src/utils/SecureStorageManager.ts
- [ ] src/ui/auth/LoginWebviewPanel.ts
- [ ] src/ui/auth/AuthStatusBar.ts
- [ ] webviews/auth/index.html
- [ ] webviews/auth/style.css
- [ ] webviews/auth/script.js

#### スコープ4: プロンプト管理モデル
**スコープID**: prompt-models
**説明**: プロンプト管理のデータモデルとAPI実装

**含まれる機能**:
1. プロンプトモデル実装
2. バージョン管理モデル
3. プロジェクト関連モデル
4. プロンプトAPIの実装

**実装予定ファイル**:
- [ ] portal/backend/models/prompt.model.js
- [ ] portal/backend/models/promptVersion.model.js
- [ ] portal/backend/models/project.model.js
- [ ] portal/backend/models/promptUsage.model.js
- [ ] portal/backend/controllers/prompt.controller.js
- [ ] portal/backend/controllers/project.controller.js
- [ ] portal/backend/routes/prompt.routes.js
- [ ] portal/backend/routes/project.routes.js
- [ ] portal/backend/services/prompt.service.js
- [ ] portal/backend/services/project.service.js

#### スコープ5: プロンプト管理UI
**スコープID**: prompt-admin-ui
**説明**: 管理者向けプロンプト管理UIの実装

**含まれる機能**:
1. プロンプト一覧表示
2. プロンプト編集機能
3. プロジェクト管理UI
4. バージョン管理UI
5. 公開設定管理

**実装予定ファイル**:
- [ ] portal/frontend/src/components/prompts/PromptList.js
- [ ] portal/frontend/src/components/prompts/PromptForm.js
- [ ] portal/frontend/src/components/prompts/PromptVersion.js
- [ ] portal/frontend/src/components/projects/ProjectList.js
- [ ] portal/frontend/src/components/projects/ProjectForm.js
- [ ] portal/frontend/src/services/prompt.service.js
- [ ] portal/frontend/src/services/project.service.js
- [ ] portal/frontend/src/pages/Prompts.js
- [ ] portal/frontend/src/pages/Projects.js

#### スコープ6: ClaudeCode連携
**スコープID**: claudecode-integration
**説明**: ClaudeCode CLIとの認証連携と API制御

**含まれる機能**:
1. 認証情報の共有
2. API呼び出し制御
3. アクセス失効の即時反映
4. 使用状況追跡

**実装予定ファイル**:
- [ ] src/services/ClaudeCodeLauncherService.ts
- [ ] src/utils/ClaudeAuthSyncManager.ts
- [ ] src/utils/ApiAccessController.ts
- [ ] src/utils/UsageTracker.ts

#### スコープ7: VSCode-プロンプト表示
**スコープID**: vscode-prompt-view
**説明**: VSCode拡張での公開プロンプト表示機能

**含まれる機能**:
1. プロンプト一覧表示
2. ローカルキャッシュ
3. お気に入り管理
4. オフライン対応

**実装予定ファイル**:
- [ ] src/services/PromptViewService.ts
- [ ] src/utils/PromptCacheManager.ts
- [ ] src/ui/promptViewer/PromptViewerPanel.ts
- [ ] src/ui/promptViewer/PromptListView.ts
- [ ] webviews/prompt-viewer/index.html
- [ ] webviews/prompt-viewer/style.css
- [ ] webviews/prompt-viewer/script.js

#### スコープ8: ユーザー管理機能
**スコープID**: user-management
**説明**: 管理者向けユーザー管理機能の実装

**含まれる機能**:
1. ユーザー一覧表示
2. ユーザー追加・編集
3. 権限管理
4. アクセス制限設定

**実装予定ファイル**:
- [ ] portal/backend/controllers/admin.controller.js
- [ ] portal/backend/routes/admin.routes.js
- [ ] portal/backend/services/admin.service.js
- [ ] portal/frontend/src/components/admin/UserManagement.js
- [ ] portal/frontend/src/components/admin/UserForm.js
- [ ] portal/frontend/src/services/admin.service.js
- [ ] portal/frontend/src/pages/Admin.js

#### スコープ9: 環境変数設定
**スコープID**: env-setup
**説明**: 全システムの環境変数設定と検証

**含まれる機能**:
1. 環境変数設定ファイル作成
2. 接続テスト
3. セキュリティ確認
4. デプロイ設定

**実装予定ファイル**:
- [ ] portal/backend/.env.example
- [ ] portal/frontend/.env.example
- [ ] .vscode/settings.json (環境変数設定部分)

#### スコープ10: システム統合テスト
**スコープID**: integration-test
**説明**: 全システムの統合テストと品質保証

**含まれる機能**:
1. 認証フローテスト
2. プロンプト同期テスト
3. ClaudeCode連携テスト
4. エラー処理テスト

**実装予定ファイル**:
- [ ] portal/backend/tests/auth.test.js
- [ ] portal/backend/tests/prompt.test.js
- [ ] portal/frontend/src/tests/auth.test.js
- [ ] src/test/auth.test.ts
- [ ] src/test/prompt-sync.test.ts
- [ ] src/test/claudecode.test.ts

## 現在のディレクトリ構造
```
AppGenius/ (既存)
├── src/ (VSCode拡張)
│   ├── core/
│   │   └── auth/ (新規追加)
│   ├── services/
│   ├── ui/
│   │   ├── auth/ (新規追加)
│   │   └── promptViewer/ (新規追加)
│   └── utils/
│
├── webviews/ (新規追加)
│   ├── auth/
│   └── prompt-viewer/
│
└── portal/ (新規追加)
    ├── frontend/
    │   ├── public/
    │   └── src/
    │       ├── components/
    │       ├── services/
    │       └── pages/
    ├── backend/
    │   ├── config/
    │   │   ├── db.config.js
    │   │   └── auth.config.js
    │   ├── controllers/
    │   │   └── auth.controller.js
    │   ├── middlewares/
    │   │   └── auth.middleware.js
    │   ├── models/
    │   │   └── user.model.js
    │   ├── routes/
    │   │   └── auth.routes.js
    │   ├── services/
    │   │   └── auth.service.js
    │   ├── .env.example
    │   └── tests/
    ├── server.js
    └── package.json
```

## 実装完了ファイル
- ✅ docs/structure.md (初期セットアップ)
- ✅ docs/data_models.md (初期セットアップ)
- ✅ docs/api.md (初期セットアップ)
- ✅ docs/env.md (初期セットアップ)
- ✅ docs/CURRENT_STATUS.md (初期セットアップ)
- ✅ portal/backend/config/db.config.js (認証Webアプリ基盤)
- ✅ portal/backend/config/auth.config.js (認証Webアプリ基盤)
- ✅ portal/backend/models/user.model.js (認証Webアプリ基盤)
- ✅ portal/backend/middlewares/auth.middleware.js (認証Webアプリ基盤)
- ✅ portal/backend/controllers/auth.controller.js (認証Webアプリ基盤)
- ✅ portal/backend/routes/auth.routes.js (認証Webアプリ基盤)
- ✅ portal/backend/services/auth.service.js (認証Webアプリ基盤)
- ✅ portal/server.js (認証Webアプリ基盤)
- ✅ portal/backend/.env.example (認証Webアプリ基盤)
- ✅ portal/package.json (認証Webアプリ基盤)

## 実装中ファイル
（実装中のファイルはまだありません）

## 引継ぎ情報

### 現在のスコープ: 認証Webアプリ基盤 (完了)
**スコープID**: auth-web-base  
**説明**: 管理者専用プロンプト管理Webアプリケーションの認証基盤構築

**含まれる機能**:
1. ユーザーデータモデルの実装
2. 管理者ログイン機能
3. JWTトークン発行と検証
4. リフレッシュトークン管理

**実装完了ファイル**: 
- [x] portal/backend/config/db.config.js
- [x] portal/backend/config/auth.config.js
- [x] portal/backend/models/user.model.js
- [x] portal/backend/middlewares/auth.middleware.js
- [x] portal/backend/controllers/auth.controller.js
- [x] portal/backend/routes/auth.routes.js
- [x] portal/backend/services/auth.service.js
- [x] portal/server.js
- [x] portal/backend/.env.example
- [x] portal/package.json

## 次回実装予定

### 次のスコープ: 管理ポータルUI
**スコープID**: admin-portal-ui  
**説明**: 管理者向けプロンプト管理ポータルのUI実装  

**含まれる機能**:
1. 管理者ログインフォーム
2. ダッシュボード画面
3. 認証状態管理
4. トークン自動更新

**依存するスコープ**:
- 認証Webアプリ基盤 (auth-web-base)

**実装予定ファイル**:
- [ ] portal/frontend/src/components/auth/Login.js
- [ ] portal/frontend/src/components/dashboard/Dashboard.js
- [ ] portal/frontend/src/services/auth.service.js
- [ ] portal/frontend/src/utils/auth-header.js
- [ ] portal/frontend/src/App.js
- [ ] portal/frontend/src/index.js
- [ ] portal/frontend/public/index.html

## 環境変数設定状況

### 中央Webアプリケーション設定
- [ ] DB_HOST - データベースホスト名
- [ ] DB_PORT - データベースポート
- [ ] DB_NAME - データベース名
- [ ] DB_USER - データベースユーザー名
- [ ] DB_PASSWORD - データベースパスワード
- [ ] JWT_SECRET - JWT認証用シークレットキー
- [ ] JWT_EXPIRY - JWTトークン有効期限（1h）
- [ ] REFRESH_TOKEN_SECRET - リフレッシュトークン用シークレット
- [ ] REFRESH_TOKEN_EXPIRY - リフレッシュトークン有効期限（14d）
- [ ] PORT - APIサーバーポート
- [ ] CORS_ORIGIN - CORS許可オリジン

### VSCode拡張設定
- [ ] PORTAL_API_URL - プロンプトポータルAPI URL
- [ ] CLIENT_ID - クライアントID
- [ ] CLIENT_SECRET - クライアントシークレット
- [ ] TOKEN_STORAGE_PATH - トークン保存パス
- [ ] PROMPT_CACHE_SIZE - キャッシュするプロンプトの最大数
- [ ] ENABLE_OFFLINE_MODE - オフラインモード有効化
- [ ] CHECK_INTERVAL - 認証チェック間隔（最大5分）

### ClaudeCode連携設定
- [ ] CLAUDE_CODE_PATH - ClaudeCode実行ファイルパス
- [ ] CLAUDE_INTEGRATION_ENABLED - ClaudeCode連携の有効化
- [ ] CLAUDE_MD_PATH - CLAUDE.mdファイルの相対パス

### スコープ別必要環境変数

#### スコープ1: 認証Webアプリ基盤 (完了)
設定済み環境変数:
- [x] DB_HOST - データベースホスト名
- [x] DB_PORT - データベースポート
- [x] DB_NAME - データベース名
- [x] DB_USER - データベースユーザー名
- [x] DB_PASSWORD - データベースパスワード
- [x] JWT_SECRET - JWT認証用シークレットキー
- [x] JWT_EXPIRY - JWTトークン有効期限
- [x] REFRESH_TOKEN_SECRET - リフレッシュトークン用シークレット
- [x] REFRESH_TOKEN_EXPIRY - リフレッシュトークン有効期限
- [x] PORT - APIサーバーポート
- [x] CORS_ORIGIN - CORS許可オリジン
- [x] NODE_ENV - 実行環境
- [x] RATE_LIMIT_WINDOW - レート制限のウィンドウ時間
- [x] RATE_LIMIT_MAX - ウィンドウ時間内の最大リクエスト数
- [x] PASSWORD_SALT_ROUNDS - パスワードハッシュのソルトラウンド数

## データモデル使用状況

### データモデル管理ポリシー

- **正式な定義元**: `data_models.md` が唯一の真実源（Single Source of Truth）
- **実装同期**: バックエンドモデルの実装は`data_models.md`と同期されるべき
- **変更手順**: 
  1. 機能要件に基づきモデル設計
  2. `data_models.md`更新
  3. モデル実装
  4. CURRENT_STATUS.md更新
- **レビュー**: モデル変更はスコープ管理者によるレビューが必要

### スコープ別データモデル使用状況

#### スコープ1: 認証Webアプリ基盤
- User (ユーザーモデル)

#### スコープ4: プロンプト管理モデル
- Prompt (プロンプトモデル)
- PromptVersion (プロンプトバージョンモデル)
- Project (プロジェクトモデル)
- PromptUsage (プロンプト使用履歴)
- UserProject (ユーザープロジェクト関連)

## 実装アプローチ

1. **管理UI優先開発モデル**:
   - フェーズ1: 管理ポータルUIとAPI開発（並行）
   - フェーズ2: VSCodeユーザー認証連携
   - フェーズ3: VSCodeプロンプト表示機能
   - フェーズ4: ClaudeCode API連携

2. **Firebase/GCP + Vercelデプロイ戦略**:
   - Firebase Authentication: 認証基盤
   - Firestore: データベース
   - Cloud Functions/Cloud Run: バックエンドAPI 
   - Vercel: 管理ポータルホスティング

3. **ユーザー権限分離アーキテクチャ**:
   - 管理者: 中央管理ポータルに完全アクセス権限
   - 一般ユーザー: VSCode内認証、公開プロンプトのみ閲覧可能
   - エンドユーザー監視: アクセス失効時の最大5分以内での検出

## 発生した問題と解決策

（まだ問題は報告されていません）