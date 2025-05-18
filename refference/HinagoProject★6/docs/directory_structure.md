# 機能中心ディレクトリ構造設計

このドキュメントはHinagoProject（ボリュームチェックシステム）の機能中心ディレクトリ構造を定義します。
機能中心のディレクトリ構造は、技術的な層（controllers, services）ではなく、ビジネス機能（auth, users, properties）でディレクトリを分割することで、非技術者にも理解しやすく、開発者にとっても関連コードの発見が容易になるように設計されています。

## 目次

1. [全体構造](#全体構造)
2. [バックエンド構造](#バックエンド構造)
3. [フロントエンド構造](#フロントエンド構造)
4. [共有リソース構造](#共有リソース構造)
5. [パッケージ管理](#パッケージ管理)

## 全体構造

プロジェクトのルートディレクトリには以下のディレクトリとファイルが含まれます。

```
/HinagoProject/
├── docs/                   # プロジェクトドキュメント
│   ├── data_models.md      # データモデル設計書
│   ├── directory_structure.md # ディレクトリ構造設計書
│   ├── requirements.md     # 要件定義書
│   └── SCOPE_PROGRESS.md   # スコープ進捗管理
│
├── mockups/                # UIモックアップ
│   ├── dashboard.html      # ダッシュボード画面
│   ├── login.html          # ログイン画面
│   ├── profitability-analysis.html # 収益性試算画面
│   ├── property-detail.html # 物件詳細画面
│   ├── property-register.html # 物件登録画面
│   └── volume-check.html   # ボリュームチェック画面
│
├── shared/                 # フロントエンドとバックエンドで共有
│   ├── index.ts            # 共有型定義とAPIパス
│   └── constants.ts        # 共有定数
│
├── frontend/               # フロントエンドアプリケーション
│
├── backend/                # バックエンドアプリケーション
│
├── scripts/                # ビルドスクリプトや開発用ツール
│
├── .env.example            # 環境変数サンプル
├── .gitignore              # Gitの除外設定
├── package.json            # ルートパッケージ設定
├── README.md               # プロジェクト概要
├── tsconfig.json           # TypeScript設定
└── CLAUDE.md               # Claude指示ファイル
```

## バックエンド構造

バックエンドは機能単位で整理され、各機能ディレクトリには関連するすべてのロジックが含まれます。

```
/backend/
├── src/
│   ├── common/            # 全機能で共有する共通コード
│   │   ├── middlewares/   # 共通ミドルウェア
│   │   │   ├── auth.middleware.ts  # 認証ミドルウェア
│   │   │   ├── error.middleware.ts # エラーハンドリングミドルウェア
│   │   │   └── validation.middleware.ts # バリデーションミドルウェア
│   │   │
│   │   ├── utils/         # ユーティリティ関数
│   │   │   ├── logger.ts  # ロギングユーティリティ
│   │   │   └── response.ts # レスポンス整形ユーティリティ
│   │   │
│   │   └── validators/    # 共通バリデーター
│   │       └── common.validator.ts
│   │
│   ├── features/          # 機能ごとにグループ化
│   │   ├── auth/          # 認証機能
│   │   │   ├── auth.controller.ts  # 認証コントローラー
│   │   │   ├── auth.service.ts     # 認証サービス
│   │   │   ├── auth.routes.ts      # 認証ルート
│   │   │   └── auth.validator.ts   # 認証バリデーター
│   │   │
│   │   ├── users/         # ユーザー管理機能
│   │   │   ├── users.controller.ts # ユーザーコントローラー
│   │   │   ├── users.service.ts    # ユーザーサービス
│   │   │   ├── users.routes.ts     # ユーザールート
│   │   │   └── users.validator.ts  # ユーザーバリデーター
│   │   │
│   │   ├── properties/    # 物件管理機能
│   │   │   ├── properties.controller.ts # 物件コントローラー
│   │   │   ├── properties.service.ts    # 物件サービス
│   │   │   ├── properties.routes.ts     # 物件ルート
│   │   │   ├── properties.validator.ts  # 物件バリデーター
│   │   │   └── documents/            # 物件関連文書サブ機能
│   │   │       ├── documents.controller.ts
│   │   │       └── documents.service.ts
│   │   │
│   │   ├── volume-check/  # ボリュームチェック機能
│   │   │   ├── volume-check.controller.ts
│   │   │   ├── volume-check.service.ts
│   │   │   ├── volume-check.routes.ts
│   │   │   └── calculator/           # 計算エンジンサブ機能
│   │   │       ├── volume.calculator.ts
│   │   │       └── regulation.calculator.ts
│   │   │
│   │   └── profitability/ # 収益性試算機能
│   │       ├── profitability.controller.ts
│   │       ├── profitability.service.ts
│   │       ├── profitability.routes.ts
│   │       ├── scenarios.controller.ts
│   │       └── scenarios.service.ts
│   │
│   ├── config/           # アプリケーション設定
│   │   ├── db.config.ts  # データベース設定
│   │   ├── app.config.ts # アプリケーション設定
│   │   └── auth.config.ts # 認証設定
│   │
│   ├── db/               # データベース関連
│   │   ├── models/       # データベースモデル
│   │   ├── migrations/   # マイグレーションスクリプト
│   │   ├── seeds/        # シードデータ
│   │   └── connection.ts # データベース接続
│   │
│   ├── types/            # 型定義（shared/index.tsからコピー）
│   │   └── index.ts      # バックエンド用型定義
│   │
│   ├── routes.ts         # ルートインデックス
│   └── app.ts            # アプリケーションエントリーポイント
│
├── tests/                # テスト
│   ├── unit/             # ユニットテスト
│   └── integration/      # 統合テスト
│
├── .env                  # 環境変数
├── nodemon.json          # Nodemon設定
├── package.json          # パッケージ設定
└── tsconfig.json         # TypeScript設定
```

## フロントエンド構造

フロントエンドも同様に機能単位で整理され、各機能ディレクトリには関連するUIコンポーネント、ロジック、スタイルが含まれます。

```
/frontend/
├── public/              # 静的ファイル
│   ├── index.html       # HTMLエントリーポイント
│   ├── favicon.ico      # ファビコン
│   └── assets/          # 公開アセット
│       ├── images/      # 画像
│       └── fonts/       # フォント
│
├── src/
│   ├── common/            # 共通コンポーネント・ユーティリティ
│   │   ├── components/    # 汎用UIコンポーネント
│   │   │   ├── Button/    # ボタンコンポーネント
│   │   │   ├── Card/      # カードコンポーネント
│   │   │   ├── Input/     # 入力コンポーネント
│   │   │   ├── Select/    # セレクトコンポーネント
│   │   │   ├── Table/     # テーブルコンポーネント
│   │   │   └── Layout/    # レイアウトコンポーネント
│   │   │
│   │   ├── hooks/         # 共通Reactフック
│   │   │   ├── useAuth.ts # 認証フック
│   │   │   ├── useFetch.ts # データ取得フック
│   │   │   └── useForm.ts  # フォーム管理フック
│   │   │
│   │   └── utils/         # ユーティリティ関数
│   │       ├── api.ts     # API連携ユーティリティ
│   │       ├── formatter.ts # データフォーマッター
│   │       └── validation.ts # バリデーションユーティリティ
│   │
│   ├── features/          # 機能ごとにグループ化
│   │   ├── auth/          # 認証機能
│   │   │   ├── components/  # 認証関連コンポーネント
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── PasswordReset.tsx
│   │   │   ├── hooks/       # 認証関連フック
│   │   │   │   └── useLogin.ts
│   │   │   ├── pages/       # 画面コンポーネント
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── RegisterPage.tsx
│   │   │   └── api.ts       # API連携コード
│   │   │
│   │   ├── dashboard/      # ダッシュボード機能
│   │   │   ├── components/  # ダッシュボード関連コンポーネント
│   │   │   ├── hooks/       # ダッシュボード関連フック
│   │   │   ├── pages/       # 画面コンポーネント
│   │   │   │   └── DashboardPage.tsx
│   │   │   └── api.ts       # API連携コード
│   │   │
│   │   ├── properties/     # 物件管理機能
│   │   │   ├── components/  # 物件関連コンポーネント
│   │   │   │   ├── PropertyForm.tsx
│   │   │   │   ├── PropertyList.tsx
│   │   │   │   └── SurveyMapUploader.tsx
│   │   │   ├── hooks/       # 物件関連フック
│   │   │   ├── pages/       # 画面コンポーネント
│   │   │   │   ├── PropertyListPage.tsx
│   │   │   │   ├── PropertyRegisterPage.tsx
│   │   │   │   └── PropertyDetailPage.tsx
│   │   │   └── api.ts       # API連携コード
│   │   │
│   │   ├── volume-check/   # ボリュームチェック機能
│   │   │   ├── components/  # ボリュームチェック関連コンポーネント
│   │   │   │   ├── AssetTypeSelector.tsx
│   │   │   │   ├── BuildingParamsForm.tsx
│   │   │   │   ├── Model3DViewer.tsx
│   │   │   │   └── VolumeResults.tsx
│   │   │   ├── hooks/       # ボリュームチェック関連フック
│   │   │   ├── pages/       # 画面コンポーネント
│   │   │   │   └── VolumeCheckPage.tsx
│   │   │   └── api.ts       # API連携コード
│   │   │
│   │   └── profitability/  # 収益性試算機能
│   │       ├── components/  # 収益性試算関連コンポーネント
│   │       │   ├── FinancialParamsForm.tsx
│   │       │   ├── ProfitabilityResults.tsx
│   │       │   ├── ScenarioManager.tsx
│   │       │   └── charts/  # チャートコンポーネント
│   │       │       ├── CashFlowChart.tsx
│   │       │       └── SensitivityChart.tsx
│   │       ├── hooks/       # 収益性試算関連フック
│   │       ├── pages/       # 画面コンポーネント
│   │       │   └── ProfitabilityPage.tsx
│   │       └── api.ts       # API連携コード
│   │
│   ├── app/               # アプリケーションのコア
│   │   ├── routes.tsx     # ルーティング
│   │   ├── providers.tsx  # コンテキストプロバイダー
│   │   ├── store.ts       # 状態管理（Reduxなど）
│   │   └── theme.ts       # テーマ設定
│   │
│   ├── styles/            # グローバルスタイル
│   │   ├── globals.css    # グローバルCSS
│   │   └── variables.css  # CSSカスタムプロパティ
│   │
│   ├── config/            # アプリケーション設定
│   │   └── app.config.ts  # 環境に応じた設定
│   │
│   └── index.tsx          # エントリーポイント
│
├── .env                  # 環境変数
├── package.json          # パッケージ設定
└── tsconfig.json         # TypeScript設定
```

## 共有リソース構造

フロントエンドとバックエンドで共有するリソースは、共通のフォーマットでトップレベルに配置します。

```
/shared/
├── index.ts            # 共有型定義とAPIパス（単一の真実源）
├── constants.ts        # 共有定数
└── validation/         # 共有バリデーションスキーマ（オプション）
    ├── property.schema.ts
    └── user.schema.ts
```

## パッケージ管理

プロジェクトは、フロントエンドとバックエンドを別々のパッケージとして管理しながらも、共通の依存関係を持つモノレポ構造を採用します。

### ルートpackage.json

```json
{
  "name": "hinago-project",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "frontend",
    "backend",
    "shared"
  ],
  "scripts": {
    "start": "concurrently \"yarn start:frontend\" \"yarn start:backend\"",
    "start:frontend": "cd frontend && yarn start",
    "start:backend": "cd backend && yarn start",
    "build": "yarn build:shared && concurrently \"yarn build:frontend\" \"yarn build:backend\"",
    "build:frontend": "cd frontend && yarn build",
    "build:backend": "cd backend && yarn build",
    "build:shared": "cd shared && yarn build",
    "test": "concurrently \"yarn test:frontend\" \"yarn test:backend\"",
    "test:frontend": "cd frontend && yarn test",
    "test:backend": "cd backend && yarn test",
    "lint": "concurrently \"yarn lint:frontend\" \"yarn lint:backend\" \"yarn lint:shared\"",
    "lint:frontend": "cd frontend && yarn lint",
    "lint:backend": "cd backend && yarn lint",
    "lint:shared": "cd shared && yarn lint"
  },
  "devDependencies": {
    "concurrently": "^7.6.0",
    "typescript": "^4.9.5"
  }
}
```

この機能中心のディレクトリ構造は、以下の利点を提供します：

1. **ビジネス機能がすぐに把握できる**: ディレクトリ名が技術的でなくビジネス機能に基づいているため、非技術者も含めたプロジェクト関係者が全体像を把握しやすい
2. **関連コードの共存**: 機能に関連するすべてのコードが1つの場所にまとまっているため、変更が必要な場合に探しやすい
3. **モジュール境界の明確化**: 機能ごとに明確な境界があり、責任の分離がしやすい
4. **拡張性の向上**: 新しい機能を追加する際に、既存の機能に影響を与えずに追加できる
5. **テストのしやすさ**: 機能単位でテストが構成しやすく、関連するテストケースが集約される