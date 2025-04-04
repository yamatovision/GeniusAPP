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

# GCPプロジェクトの設定
echo "GCPプロジェクトを設定中..."
gcloud config set project $PROJECT_ID

# サーバースクリプトを修正バージョンに置き換え
echo "サーバーコードを置き換え中..."
cp server.js.fix server.js

# Dockerイメージをビルド
echo "Dockerイメージをビルド中..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
docker build -t $IMAGE_NAME . --no-cache

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
  --set-env-vars=NODE_ENV=production,API_HOST=appgenius-portal-backend-235426778039.asia-northeast1.run.app,SKIP_DB_CONNECTION=false

# デプロイ完了後のサービスURLを表示
echo "バックエンドのデプロイが完了しました！"
echo "サービスURL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')"
echo "このURLをVercelの環境変数REACT_APP_API_URLに設定してください。"

echo "==================== デプロイ診断情報 ===================="
echo "サービスのログを確認するには以下のコマンドを実行してください:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=50"