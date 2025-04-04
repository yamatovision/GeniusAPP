#!/bin/bash
set -e  # エラー発生時に停止

# 変数設定
API_HOST="appgenius-portal-backend-235426778039.asia-northeast1.run.app"

echo "==================== プロンプト共有URL修正 ===================="
echo "API Host: $API_HOST"

# prompt.controller.jsを修正する
PROMPT_CONTROLLER_FILE="backend/controllers/prompt.controller.js"

# 元ファイルをバックアップ
cp $PROMPT_CONTROLLER_FILE ${PROMPT_CONTROLLER_FILE}.bak

# 置換を実行
echo "prompt.controller.jsを修正中..."
sed -i '' "s/geniemon-portal-backend-production.up.railway.app/${API_HOST}/g" $PROMPT_CONTROLLER_FILE

# 変更を確認
echo "変更内容の確認:"
grep -A3 -B2 "$API_HOST" $PROMPT_CONTROLLER_FILE

echo "==================== 修正完了 ===================="
echo "本番環境にこの変更をデプロイするには、修正ファイルをコミットし、他の問題を解決してからCloud Runデプロイを実行してください。"