FROM node:18-alpine

WORKDIR /app

# Alpine Linuxでのビルドに必要なパッケージをインストール
RUN apk add --no-cache python3 make g++

# 依存関係ファイルをコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptのコンパイル
RUN npm run build

# ポートを公開
EXPOSE 8080

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=8080

# アプリケーションの起動
CMD ["node", "dist/app.js"]