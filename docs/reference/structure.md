# ディレクトリ構造

```
ailp/
├── .env.local                    # 環境変数
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── public/                       # 静的ファイル
│   ├── assets/                   # 画像、アイコンなど
│   └── favicon.ico
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # 認証関連ページ
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/          # ダッシュボード関連ページ
│   │   │   ├── dashboard/
│   │   │   ├── lp/[id]/
│   │   │   ├── lp/new/
│   │   │   ├── tests/[id]/
│   │   │   └── members/
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/
│   │   │   ├── lp/
│   │   │   ├── tests/
│   │   │   ├── members/
│   │   │   └── ai/
│   │   └── layout.tsx            # ルートレイアウト
│   ├── components/               # 共通コンポーネント
│   │   ├── ui/                   # 基本UI要素
│   │   ├── layout/               # レイアウト関連
│   │   ├── auth/                 # 認証関連
│   │   ├── dashboard/            # ダッシュボード関連
│   │   ├── lp-builder/          # LP作成関連
│   │   ├── test-results/        # テスト結果関連
│   │   └── members/             # 会員管理関連
│   ├── lib/                     # ユーティリティ
│   │   ├── api/                 # API呼び出し関数
│   │   ├── auth/                # 認証関連
│   │   ├── db/                  # データベース関連
│   │   ├── ai/                  # AI関連処理
│   │   └── utils/               # 共通ユーティリティ
│   ├── store/                   # 状態管理
│   ├── styles/                  # グローバルスタイル
│   ├── types/                   # 型定義
│   ├── hooks/                   # カスタムフック
│   └── server/                  # サーバーサイド処理
│       ├── db/                  # データベースモデル
│       ├── api/                 # APIのバックエンド処理
│       └── ai/                  # AIサービス連携
└── prisma/                      # Prismaの設定
    ├── schema.prisma            # データベーススキーマ
    └── migrations/              # マイグレーションファイル
```

## ディレクトリ構造の概要

### フロントエンド

- **app/**: Next.jsのApp Routerを使用したページ定義
  - **(auth)/**: 認証関連のページ（ログイン、登録など）
  - **(dashboard)/**: ダッシュボード関連のページ（LP管理、テスト結果など）
  - **api/**: バックエンドAPIエンドポイント（サーバーサイド）

- **components/**: 再利用可能なReactコンポーネント
  - **ui/**: ボタン、カード、モーダルなどの基本UI要素
  - **layout/**: ヘッダー、フッター、サイドバーなどのレイアウト要素
  - **auth/**: 認証関連のコンポーネント
  - **dashboard/**: ダッシュボード関連のコンポーネント
  - **lp-builder/**: LP作成・編集関連のコンポーネント
  - **test-results/**: テスト結果表示関連のコンポーネント
  - **members/**: 会員管理関連のコンポーネント

- **styles/**: グローバルスタイルとテーマ定義

### バックエンド

- **server/**: サーバーサイドのロジック
  - **db/**: データベース操作ロジック
  - **api/**: APIエンドポイントの処理ロジック
  - **ai/**: AI連携サービスのロジック

### ユーティリティとヘルパー

- **lib/**: 共通ユーティリティと関数
  - **api/**: API関数（フロントエンドからのAPI呼び出し）
  - **auth/**: 認証関連のユーティリティ
  - **db/**: データベース関連のユーティリティ
  - **ai/**: AI連携関連のユーティリティ
  - **utils/**: その他の共通ユーティリティ

- **hooks/**: カスタムReactフック
- **types/**: TypeScript型定義
- **store/**: グローバル状態管理

### データベース

- **prisma/**: Prisma ORMの設定
  - **schema.prisma**: データベーススキーマ定義
  - **migrations/**: データベースマイグレーションファイル