# Geniemon Portal Frontend

AppGenius/Geniemonのポータルフロントエンド（React）

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm start
```

## ビルド

```bash
# 本番用ビルド
npm run build
```

## Vercelへのデプロイ手順

1. Vercelアカウントを作成し、CLIをインストール

```bash
npm install -g vercel
```

2. Vercelにログイン

```bash
vercel login
```

3. プロジェクト設定を確認

vercel.jsonとpackage.jsonに必要な設定が含まれていることを確認してください。

4. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：
- REACT_APP_API_URL: https://geniemon-portal-backend-235426778039.asia-northeast1.run.app/api

5. デプロイ実行

```bash
# 開発環境へのデプロイ（プレビュー）
vercel

# 本番環境へのデプロイ
npm run deploy:vercel
# または
vercel --prod
```

## 環境変数

- `REACT_APP_API_URL` - バックエンドAPIのベースURL
  - 本番環境: https://geniemon-portal-backend-235426778039.asia-northeast1.run.app/api
  - 開発環境: http://localhost:5000/api