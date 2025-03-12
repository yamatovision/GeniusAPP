# ディレクトリ構造

## 既存ディレクトリ構造

```
AppGenius/
├── src/
│   ├── core/                          # コア機能モジュール
│   │   ├── aiService.ts               # AI API連携
│   │   ├── aiDevelopmentService.ts    # AI開発支援機能
│   │   ├── projectAnalyzer.ts         # プロジェクト分析
│   │   ├── codeGenerator.ts           # コード生成
│   │   └── gitManager.ts              # Git操作
│   │
│   ├── modes/                         # 動作モード
│   │   ├── designMode/                # モックアップデザイン
│   │   ├── implementationMode/        # コード実装
│   │   └── requirementMode/           # 要件定義
│   │
│   ├── services/                      # 各種サービス
│   │   ├── AppGeniusEventBus.ts       # イベント管理
│   │   ├── AppGeniusStateManager.ts   # 状態管理
│   │   ├── ClaudeCodeLauncherService.ts # ClaudeCode連携
│   │   └── ProjectManagementService.ts  # プロジェクト管理
│   │
│   ├── ui/                            # UI関連
│   │   ├── claudeMd/                  # CLAUDE.md編集
│   │   ├── dashboard/                 # ダッシュボード
│   │   ├── debugDetective/            # デバッグ支援
│   │   └── ...                        # 他のUI関連フォルダ
│   │
│   └── utils/                         # ユーティリティ
│       ├── ClaudeMdService.ts         # CLAUDE.md管理
│       ├── logger.ts                  # ロギング
│       └── ...                        # 他のユーティリティ
│
├── docs/                             # ドキュメント
│   ├── data_models.md                # データモデル定義
│   ├── requirements.md               # 要件定義
│   └── ...                           # その他ドキュメント
│
└── ...                               # その他ファイル
```

## 認証・プロンプト管理システムの完全構造

```
AppGenius/
├── src/                                    # VSCode拡張のソースコード
│   ├── core/                               # コア機能
│   │   ├── aiService.ts                    # AI API連携 (既存)
│   │   ├── aiDevelopmentService.ts         # AI開発支援 (既存)
│   │   ├── auth/                           # 認証機能 (新規)
│   │   │   ├── AuthenticationService.ts    # 認証サービス
│   │   │   └── TokenManager.ts             # トークン管理
│   │   └── ...                             # その他既存ファイル
│   │
│   ├── services/                           # 各種サービス
│   │   ├── AppGeniusEventBus.ts            # イベント管理 (既存)
│   │   ├── AppGeniusStateManager.ts        # 状態管理 (既存)
│   │   ├── ClaudeCodeLauncherService.ts    # ClaudeCode連携 (更新)
│   │   ├── PromptViewService.ts            # プロンプト表示 (新規)
│   │   └── ...                             # その他既存ファイル
│   │
│   ├── ui/                                 # UI関連
│   │   ├── auth/                           # 認証UI (新規)
│   │   │   ├── LoginWebviewPanel.ts        # ログインWebビュー
│   │   │   └── AuthStatusBar.ts            # 認証状態表示
│   │   ├── promptViewer/                   # プロンプト表示UI (新規)
│   │   │   ├── PromptViewerPanel.ts        # プロンプト表示パネル
│   │   │   └── PromptListView.ts           # プロンプト一覧
│   │   └── ...                             # その他既存フォルダ
│   │
│   └── utils/                              # ユーティリティ
│       ├── SecureStorageManager.ts         # セキュア保存 (新規)
│       ├── PromptCacheManager.ts           # キャッシュ管理 (新規)
│       ├── ClaudeAuthSyncManager.ts        # 認証同期 (新規)
│       ├── ApiAccessController.ts          # API制御 (新規)
│       └── ...                             # その他既存ファイル
│
├── webviews/                               # Webビューファイル (新規)
│   ├── auth/                               # 認証Webビュー
│   │   ├── index.html                      # HTMLテンプレート
│   │   ├── style.css                       # スタイル
│   │   └── script.js                       # クライアントスクリプト
│   │
│   └── prompt-viewer/                      # プロンプト表示Webビュー
│       ├── index.html                      # HTMLテンプレート
│       ├── style.css                       # スタイル
│       └── script.js                       # クライアントスクリプト
│
├── portal/                                 # プロンプト管理ポータル (新規)
│   ├── frontend/                           # フロントエンド (管理者専用)
│   │   ├── public/                         # 静的ファイル
│   │   │   ├── index.html                  # メインHTML
│   │   │   ├── favicon.ico                 # ファビコン
│   │   │   └── assets/                     # アセット
│   │   │       └── images/                 # 画像
│   │   │
│   │   └── src/                            # ソースコード
│   │       ├── components/                 # UIコンポーネント
│   │       │   ├── common/                 # 共通コンポーネント
│   │       │   │   ├── Header.js           # ヘッダー
│   │       │   │   ├── Sidebar.js          # サイドバー
│   │       │   │   └── Footer.js           # フッター
│   │       │   │
│   │       │   ├── auth/                   # 認証コンポーネント
│   │       │   │   ├── Login.js            # ログイン
│   │       │   │   └── Register.js         # 登録
│   │       │   │
│   │       │   ├── prompts/                # プロンプト管理
│   │       │   │   ├── PromptList.js       # 一覧
│   │       │   │   ├── PromptForm.js       # 編集フォーム
│   │       │   │   └── PromptVersion.js    # バージョン管理
│   │       │   │
│   │       │   ├── projects/               # プロジェクト管理
│   │       │   │   ├── ProjectList.js      # 一覧
│   │       │   │   └── ProjectForm.js      # 編集フォーム
│   │       │   │
│   │       │   └── admin/                  # 管理者機能
│   │       │       ├── UserManagement.js   # ユーザー管理
│   │       │       ├── UserForm.js         # ユーザー編集
│   │       │       └── UsageStats.js       # 使用統計
│   │       │
│   │       ├── pages/                      # ページコンポーネント
│   │       │   ├── Dashboard.js            # ダッシュボード
│   │       │   ├── Prompts.js              # プロンプト管理
│   │       │   ├── Projects.js             # プロジェクト管理
│   │       │   └── Admin.js                # 管理者ページ
│   │       │
│   │       ├── services/                   # APIサービス
│   │       │   ├── auth.service.js         # 認証
│   │       │   ├── prompt.service.js       # プロンプト
│   │       │   ├── project.service.js      # プロジェクト
│   │       │   └── admin.service.js        # 管理
│   │       │
│   │       ├── utils/                      # ユーティリティ
│   │       │   ├── auth-header.js          # 認証ヘッダー
│   │       │   └── storage.js              # ローカルストレージ
│   │       │
│   │       ├── App.js                      # メインアプリ
│   │       └── index.js                    # エントリーポイント
│   │
│   ├── backend/                            # バックエンド
│   │   ├── config/                         # 設定
│   │   │   ├── db.config.js                # データベース
│   │   │   └── auth.config.js              # 認証
│   │   │
│   │   ├── controllers/                    # コントローラー
│   │   │   ├── auth.controller.js          # 認証
│   │   │   ├── prompt.controller.js        # プロンプト
│   │   │   ├── project.controller.js       # プロジェクト
│   │   │   ├── user.controller.js          # ユーザー
│   │   │   └── admin.controller.js         # 管理者
│   │   │
│   │   ├── middlewares/                    # ミドルウェア
│   │   │   ├── auth.middleware.js          # 認証
│   │   │   ├── admin.middleware.js         # 管理者確認
│   │   │   └── validation.middleware.js    # 検証
│   │   │
│   │   ├── models/                         # データモデル
│   │   │   ├── user.model.js               # ユーザー
│   │   │   ├── prompt.model.js             # プロンプト
│   │   │   ├── promptVersion.model.js      # バージョン
│   │   │   ├── project.model.js            # プロジェクト
│   │   │   └── promptUsage.model.js        # 使用履歴
│   │   │
│   │   ├── routes/                         # ルート定義
│   │   │   ├── auth.routes.js              # 認証
│   │   │   ├── prompt.routes.js            # プロンプト
│   │   │   ├── project.routes.js           # プロジェクト
│   │   │   ├── user.routes.js              # ユーザー
│   │   │   └── admin.routes.js             # 管理者
│   │   │
│   │   ├── services/                       # ビジネスロジック
│   │   │   ├── auth.service.js             # 認証
│   │   │   ├── prompt.service.js           # プロンプト
│   │   │   ├── project.service.js          # プロジェクト
│   │   │   ├── user.service.js             # ユーザー
│   │   │   └── admin.service.js            # 管理者
│   │   │
│   │   ├── tests/                          # テスト
│   │   │   ├── auth.test.js                # 認証
│   │   │   ├── prompt.test.js              # プロンプト
│   │   │   └── integration.test.js         # 統合
│   │   │
│   │   └── server.js                       # サーバーエントリーポイント
│   │
│   └── sdk/                                # 連携SDK
│       ├── index.js                        # SDK入口
│       ├── auth.js                         # 認証
│       ├── prompts.js                      # プロンプト
│       └── projects.js                     # プロジェクト
│
├── .vscode/                                # VSCode設定
│   └── settings.json                       # 環境変数設定含む
│
└── docs/                                   # ドキュメント
    ├── CURRENT_STATUS.md                   # 実装状況
    ├── structure.md                        # ディレクトリ構造 (本ファイル)
    ├── api.md                              # API設計
    ├── data_models.md                      # データモデル
    ├── env.md                              # 環境変数
    └── ...                                 # その他ドキュメント
```

## 命名規則

### VSCode拡張側

- **クラス**: PascalCase (例: `AuthenticationService`, `PromptViewerPanel`)
- **インターフェース**: 'I' + PascalCase (例: `IAuthenticator`, `ITokenManager`)
- **タイプエイリアス**: 'T' + PascalCase (例: `TAuthResponse`, `TPromptData`)
- **メソッド**: camelCase (例: `authenticateUser()`, `refreshToken()`)
- **変数**: camelCase (例: `currentUser`, `tokenExpiry`)
- **定数**: UPPER_SNAKE_CASE (例: `API_ENDPOINT`, `DEFAULT_TIMEOUT`)
- **プライベートプロパティ**: '_' + camelCase (例: `_authToken`, `_isAuthenticated`)
- **イベント**: 動詞 + 名詞の camelCase (例: `onUserLoggedIn`, `onTokenExpired`)

### Webポータル側

#### フロントエンド (React)

- **コンポーネント**: PascalCase (例: `LoginForm`, `PromptList`)
- **コンポーネントファイル**: PascalCase.js/jsx (例: `Login.js`, `PromptForm.jsx`)
- **ユーティリティ/サービス**: camelCase.js (例: `authService.js`, `storageUtils.js`)
- **スタイル**: kebab-case.css (例: `login-form.css`, `prompt-list.css`)
- **フック**: use + PascalCase (例: `useAuth`, `usePromptList`)
- **コンテキスト**: PascalCase + Context (例: `AuthContext`, `PromptContext`)

#### バックエンド (Node.js/Express)

- **ファイル**: kebab-case.js または camelCase.js (例: `auth-controller.js` または `authController.js`)
- **クラス**: PascalCase (例: `UserService`, `AuthController`)
- **関数**: camelCase (例: `validateToken()`, `createPrompt()`)
- **変数**: camelCase (例: `userId`, `newPrompt`)
- **定数**: UPPER_SNAKE_CASE (例: `DB_CONFIG`, `TOKEN_SECRET`)
- **ルートパス**: kebab-case (例: `/api/auth/login`, `/api/prompts`)

## データフロー

### 認証フロー

```
+---------------------+       +----------------------+      +------------------+
|                     |       |                      |      |                  |
| VSCode拡張          |<----->| プロンプトポータル     |<---->| データベース      |
| (LoginWebviewPanel) |       | (auth.controller.js) |      | (user.model.js) |
|                     |       |                      |      |                  |
+---------------------+       +----------------------+      +------------------+
        ^                              ^
        |                              |
        v                              v
+---------------------+       +----------------------+
|                     |       |                      |
| セキュアストレージ    |       | JWT認証トークン       |
| (TokenManager)      |       | (auth.service.js)    |
|                     |       |                      |
+---------------------+       +----------------------+
        ^
        |
        v
+---------------------+
|                     |
| ClaudeCode連携      |
| (AuthSyncManager)   |
|                     |
+---------------------+
```

### プロンプト表示フロー

```
+---------------------+       +----------------------+      +------------------+
|                     |       |                      |      |                  |
| VSCode拡張          |<----->| プロンプトポータル     |<---->| データベース      |
| (PromptViewerPanel) |       | (prompt.controller.js)|      | (prompt.model.js)|
|                     |       |                      |      |                  |
+---------------------+       +----------------------+      +------------------+
        ^                              ^
        |                              |
        v                              v
+---------------------+       +----------------------+
|                     |       |                      |
| ローカルキャッシュ    |       | アクセス権限チェック   |
| (PromptCacheManager)|       | (auth.middleware.js) |
|                     |       |                      |
+---------------------+       +----------------------+
        ^
        |
        v
+---------------------+
|                     |
| CLAUDE.md連携       |
| (ClaudeMdService)   |
|                     |
+---------------------+
```

## 実装順序の推奨

1. **管理者向けバックエンド認証基盤** - ユーザーモデルとJWT認証を実装
2. **管理者向けフロントエンドUI** - ダッシュボードと管理画面を実装
3. **VSCode認証連携** - VSCode拡張の認証機能を実装
4. **バックエンドプロンプトモデル** - プロンプト関連データモデルとAPIを実装
5. **管理者向けプロンプト管理UI** - ポータルのプロンプト管理画面を実装
6. **VSCodeプロンプト表示機能** - VSCode拡張のプロンプト表示機能を実装
7. **ClaudeCode連携** - ClaudeCodeとの認証/APIアクセス連携を実装
8. **ユーザー管理機能** - 管理者向けユーザー管理画面を実装
9. **環境変数設定** - 全システムの環境変数を設定
10. **統合テスト** - 全体の結合テストを実施