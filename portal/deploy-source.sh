#!/bin/bash
set -e

# 変数設定
SERVICE_NAME=bluelamp
REGION=asia-northeast1

# ソースコードからデプロイ（コード変更がある場合）
echo "ソースコードから直接Cloud Runにデプロイしています..."

# 環境変数ファイルの確認/作成
if [ ! -f .env ]; then
  echo "PORT=5000" > .env
  echo ".env ファイルを作成しました"
fi

# Cloud Runにソースコードからデプロイ
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1000m \
  --port 5000 \
  --concurrency 80 \
  --timeout 5m \
  --set-env-vars="NODE_ENV=production,API_HOST=bluelamp-235426778039.asia-northeast1.run.app"

echo "デプロイが完了しました。"
echo "サービスURL: https://bluelamp-235426778039.asia-northeast1.run.app"