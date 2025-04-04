#!/bin/bash
set -e  # エラー発生時に停止

# 変数設定
PROJECT_ID="yamatovision-blue-lamp"
SERVICE_NAME="appgenius-portal-backend"
REGION="asia-northeast1"  # 東京リージョン

echo "==================== デプロイを開始します ===================="
echo "プロジェクト: $PROJECT_ID"
echo "サービス名: $SERVICE_NAME"
echo "リージョン: $REGION"

# Dockerfileを作成
cat > Dockerfile.amd64 << EOL
FROM --platform=linux/amd64 node:16-slim

WORKDIR /app

COPY package*.json ./
COPY server.js ./

RUN npm install

COPY backend ./backend

# Cloud Run固有の環境変数を設定
ENV NODE_ENV=production
ENV API_HOST=appgenius-portal-backend-235426778039.asia-northeast1.run.app

# ポートの設定
ENV PORT=8080
EXPOSE 8080

# 起動コマンド
CMD ["node", "server.js"]
EOL

# GCPプロジェクトの設定
echo "GCPプロジェクトを設定中..."
gcloud config set project $PROJECT_ID

# Dockerイメージをビルド
echo "Dockerイメージをビルド中..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:amd64"
docker build -t $IMAGE_NAME -f Dockerfile.amd64 . --no-cache

# イメージをGCRにプッシュ
echo "イメージをContainer Registryにプッシュ中..."
docker push $IMAGE_NAME

# Cloud Runにデプロイ
echo "Cloud Runにデプロイ中..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars NODE_ENV=production,API_HOST=appgenius-portal-backend-235426778039.asia-northeast1.run.app

# デプロイ完了後のサービスURLを表示
echo "バックエンドのデプロイが完了しました！"
echo "サービスURL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')"
echo "このURLをVercelの環境変数REACT_APP_API_URLに設定してください。"

echo "==================== デプロイ診断情報 ===================="
echo "サービスのログを確認するには以下のコマンドを実行してください:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=50"