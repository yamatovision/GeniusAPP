#!/bin/bash
set -e

# 変数設定
SERVICE_NAME=appgenius-portal-test
REGION=asia-northeast1

# 既存のイメージを再利用したデプロイ（Dockerが必要ない方法）
echo "既存のイメージを使用してCloud Runにデプロイしています..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/yamatovision-blue-lamp/appgenius-portal-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1000m \
  --port 5000 \
  --max-instances 100 \
  --concurrency 80 \
  --timeout 5m

echo "デプロイが完了しました。"
echo "サービスURL: https://appgenius-portal-test-235426778039.asia-northeast1.run.app"
