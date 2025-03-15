FROM node:16

WORKDIR /app

# パッケージファイルをコピー
COPY package.json package-lock.json* ./

# 依存関係インストール
RUN npm install

# アプリケーションファイルをコピー
COPY . .

# 実行権限付与
RUN chmod +x /app/server.js

# ポート公開
EXPOSE 8080

# コマンド実行
CMD ["npm", "start"]