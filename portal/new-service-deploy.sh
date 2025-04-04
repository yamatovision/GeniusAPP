#\!/bin/bash
set -e

# 変数設定
SERVICE_NAME=appgenius-portal-test
REGION=asia-northeast1
IMAGE_NAME=gcr.io/yamatovision-blue-lamp/appgenius-portal-backend:new-service-fix

# Cloud Runにデプロイ
echo "新しいサービスとしてCloud Runにデプロイしています..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/yamatovision-blue-lamp/appgenius-portal-backend:multi-arch-fix \
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
