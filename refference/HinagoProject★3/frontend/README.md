# HinagoProject フロントエンド

## 概要

HinagoProjectのフロントエンド部分です。このフロントエンドは認証システムを実装した初期フェーズで、今後物件管理や建築ボリュームチェック機能などを実装していく予定です。

## 実装済み機能

- ユーザー認証（ログイン、登録、パスワードリセット）
- トークンベース認証管理
- 認証状態の永続化

## 技術スタック

- React 19
- TypeScript
- Material UI
- Vite (ビルドツール)
- Jest + React Testing Library (テスト)

## プロジェクト構造

```
/frontend/
├── public/              # 静的ファイル
├── src/
│   ├── common/          # 共通コンポーネント・ユーティリティ
│   │   ├── components/  # 汎用UIコンポーネント
│   │   ├── hooks/       # 共通Reactフック
│   │   └── utils/       # ユーティリティ関数
│   │
│   ├── features/        # 機能ごとにグループ化
│   │   ├── auth/        # 認証機能
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   └── api.ts
│   │
│   ├── app/             # アプリケーションのコア
│   │   ├── routes.tsx   # ルーティング
│   │   ├── providers.tsx # コンテキストプロバイダー
│   │   └── theme.ts     # テーマ設定
│   └── main.tsx         # エントリーポイント
│
├── tests/               # テスト
├── .env.development     # 開発環境変数
└── .env.production      # 本番環境変数
```

## 開発方法

### 環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## 利用可能なコマンド

```bash
# 開発サーバーの起動
npm run dev

# 本番用ビルド
npm run build

# ビルドしたファイルの動作確認
npm run serve

# テスト実行
npm test

# テストの監視モード
npm run test:watch

# テストカバレッジの出力
npm run test:coverage
```

## 今後の予定

- 物件管理機能の実装
- 敷地形状エディタの実装
- ボリュームチェック機能の実装
- 3Dビューアの実装
- 収益性試算機能の実装