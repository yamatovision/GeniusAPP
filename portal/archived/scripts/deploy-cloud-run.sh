#!/bin/bash
set -e  # エラー発生時に停止

# 変数設定
PROJECT_ID="yamatovision-blue-lamp"
SERVICE_NAME="geniemon-portal-backend"
REGION="asia-northeast1"  # 東京リージョン

echo "==================== デプロイを開始します ===================="
echo "プロジェクト: $PROJECT_ID"
echo "サービス名: $SERVICE_NAME"
echo "リージョン: $REGION"

# GCPプロジェクトの設定
echo "GCPプロジェクトを設定中..."
gcloud config set project $PROJECT_ID

# Dockerイメージをビルド
echo "Dockerイメージをビルド中..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
docker build -t $IMAGE_NAME . --no-cache

# ローカルテスト
echo "ローカルでコンテナをテスト中..."
docker run --rm -p 8081:8080 -e PORT=8080 $IMAGE_NAME &
CONTAINER_PID=$!
sleep 5
curl -v http://localhost:8081 || echo "ローカルテスト失敗"
kill $CONTAINER_PID || true

# イメージをGCRにプッシュ
echo "イメージをContainer Registryにプッシュ中..."
docker push $IMAGE_NAME

echo "Cloud Runにデプロイ中..."
# デバッグモードでコンテナの内部状態を確認
echo "コンテナの内部状態を確認中..."
gcloud beta run services update $SERVICE_NAME \
  --region=$REGION \
  --command="sh" \
  --args="-c,ls -la && env && node -v" \
  --timeout=5m \
  --quiet || echo "コンテナ内部確認がスキップされました"

# 簡易版デプロイ（トラブルシューティング用）
echo "簡易版デプロイを実行中..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 10m \
  --set-env-vars=NODE_ENV=production,SKIP_DB_CONNECTION=true

# デプロイ完了後のサービスURLを表示
echo "バックエンドのデプロイが完了しました！"
echo "サービスURL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')"
echo "このURLをVercelの環境変数REACT_APP_API_URLに設定してください。"

echo "==================== デプロイ診断情報 ===================="
echo "サービスのログを確認するには以下のコマンドを実行してください:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=50"