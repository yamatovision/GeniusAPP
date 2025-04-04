#\!/bin/bash
set -e

# 既存のコンテナイメージのSHA
EXISTING_IMAGE=gcr.io/yamatovision-blue-lamp/appgenius-portal-backend@sha256:3f6c9a8435271707aca5c17942e0a70a7d4b7be3009380a818a4679248682418
SERVICE_NAME=appgenius-portal-backend
REGION=asia-northeast1

# Cloud Runでは実行中のサービスを更新しようとすると常に新しいレビジョンが作成される
# ポート設定など全ての必要なパラメータを明示的に指定する
echo "Cloud Runサービスを更新します..."
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --image $EXISTING_IMAGE \
  --update-env-vars API_HOST=appgenius-portal-backend-235426778039.asia-northeast1.run.app

echo "更新が完了しました。"
