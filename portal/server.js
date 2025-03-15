#!/usr/bin/env node

/**
 * AppGenius Portal バックエンドサーバー
 */

// 環境変数ロード
require('dotenv').config();

// デバッグ情報
console.log("Starting AppGenius Portal backend server...");
console.log("Node version:", process.version);
console.log("Environment:", process.env.NODE_ENV || 'development');
console.log("Port:", process.env.PORT || 5000);

// 必要なモジュール
const http = require("http");
const mongoose = require('mongoose');
const dbConfig = require('./backend/config/db.config');

// Expressアプリのインポート
const app = require('./backend/app');

// MongoDBに接続
(async () => {
  try {
    if (process.env.SKIP_DB_CONNECTION === 'true') {
      console.log("データベース接続をスキップしました（開発モード）");
    } else {
      await mongoose.connect(dbConfig.url, dbConfig.options);
      console.log("MongoDB データベースに接続しました");
    }
  } catch (err) {
    console.error("MongoDB 接続エラー:", err);
    console.warn("開発モードでデータベース接続エラーが発生しましたが、サーバーは起動します");
  }
})();

// CORSの設定はbackend/app.jsで行われています
console.log('Allowed CORS origins:', app.get('corsOrigins'));

// サーバー作成と起動
const server = http.createServer(app);
const port = process.env.PORT || 5000;

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// エラーハンドラ
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // 特定のリスニングエラーを人間が読める形式に
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// Listening ハンドラ
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  console.log('AppGenius Portal サーバーが起動しました: ' + bind);
}