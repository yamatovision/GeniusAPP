FROM node:16

WORKDIR /app

# サーバーファイルをコピー
COPY server.js .

# 実行権限付与
RUN chmod +x /app/server.js

# ポート設定はCloud Runが自動設定するPORT環境変数を使用するため省略

# ポート公開
EXPOSE 8080

# コマンド実行
CMD ["node", "server.js"]