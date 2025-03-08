# 環境変数リスト

このファイルはプロジェクトで使用する環境変数を管理します。チェックマーク [✓] は設定済みの変数を示します。

## バックエンド

[ ] `DATABASE_URL` - データベース接続文字列
[ ] `JWT_SECRET` - JWT認証用の秘密鍵
[ ] `PORT` - サーバーの実行ポート
[ ] `NODE_ENV` - 実行環境（development/production/test）
[ ] `API_KEY` - 外部APIサービスのアクセスキー
[ ] `SMTP_HOST` - メール送信サーバーのホスト名
[ ] `SMTP_PORT` - メール送信サーバーのポート番号

## フロントエンド

[ ] `NEXT_PUBLIC_API_URL` - バックエンドAPIのエンドポイントURL
[ ] `NEXT_PUBLIC_SITE_URL` - サイトのベースURL
[ ] `NEXT_PUBLIC_GA_ID` - Google Analyticsのトラッキングコード
[ ] `NEXT_PUBLIC_APP_VERSION` - アプリケーションのバージョン

## デプロイ環境別設定の詳細はdeploy.mdを参照してください