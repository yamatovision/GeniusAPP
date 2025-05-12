#!/bin/bash
set -e

# 変数設定
SERVICE_NAME=appgenius-portal-test
REGION=asia-northeast1
IMAGE_NAME=gcr.io/yamatovision-blue-lamp/appgenius-portal-test:url-fix

# マルチプラットフォームビルダーを準備
echo "マルチプラットフォームビルダーを準備しています..."
docker buildx create --use --name multi-arch-builder || true

# シンプルなDockerfileを作成
cat > Dockerfile.multi << 'DOCKERFILE'
FROM --platform=linux/amd64 node:16

WORKDIR /app

COPY package*.json ./
COPY server.js ./

RUN npm install

COPY backend ./backend

# 環境変数を設定
ENV PORT=5000
ENV NODE_ENV=production
ENV API_HOST=appgenius-portal-test-235426778039.asia-northeast1.run.app
ENV DB_SERVER_TIMEOUT_MS=30000
ENV DB_SOCKET_TIMEOUT_MS=45000
ENV DB_CONNECT_TIMEOUT_MS=30000
ENV DB_MAX_POOL_SIZE=10
ENV CORS_ORIGIN=https://geniemon.vercel.app,https://geniemon-yamatovisions-projects.vercel.app,https://geniemon-git-main-yamatovisions-projects.vercel.app

# ポート5000を開放
EXPOSE 5000

CMD [ "npm", "start" ]
DOCKERFILE

# AMD64向けにビルドとプッシュを一度にする
echo "AMD64アーキテクチャ向けにビルドしています..."
docker buildx build --platform linux/amd64 \
  -t $IMAGE_NAME \
  -f Dockerfile.multi \
  --push .

# Cloud Runにデプロイ
echo "Cloud Runにデプロイしています..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
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
