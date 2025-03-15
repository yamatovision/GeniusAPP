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
console.log("Port:", process.env.PORT || 8080);

// 必要なモジュール
const http = require("http");
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dbConfig = require('./backend/config/db.config');
const app = express();

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
const port = process.env.PORT || 8080;

// ミドルウェア設定
// 環境変数のCORS_ORIGINをカンマ区切りで配列に変換
const corsOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
  ['*'];

// 環境変数の値と明示的な許可リストをマージ
const allowedOrigins = [
  'https://geniemon.vercel.app', 
  'https://geniemon-yamatovisions-projects.vercel.app', 
  'http://localhost:3000', 
  'http://localhost:3001',
  ...corsOrigins
].filter(origin => origin !== '*'); // 重複を許容し、'*'は明示的リストがある場合は除外

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // origin が undefined の場合はサーバー間リクエスト
    if (!origin) return callback(null, true);
    
    // 明示的な許可リストに含まれているか、corsOriginsに'*'が含まれている場合は許可
    if (allowedOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  methods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 簡易ルート
app.get('/', (req, res) => {
  console.log("Request received:", req.url);
  res.json({
    message: "Hello from AppGenius Portal API",
    status: "OK",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// API基本経路
app.get('/api', (req, res) => {
  res.json({
    message: "AppGenius Portal API",
    version: "1.0.0",
    endpoints: [
      { path: "/api/auth", description: "認証API" },
      { path: "/api/users", description: "ユーザー管理API" },
      { path: "/api/prompts", description: "プロンプト管理API" }
    ]
  });
});

// APIルート登録
// プロンプト管理API
const promptRoutes = require('./backend/routes/prompt.routes');
app.use('/api/prompts', promptRoutes);

// ユーザー管理API
const userRoutes = require('./backend/routes/user.routes');
app.use('/api/users', userRoutes);

// 認証ルート
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./backend/models/user.model');
const authConfig = require('./backend/config/auth.config');

// 注: この部分を削除しました。ユーザー認証は /api/auth 経由で auth.routes.js ファイルで定義されたルートのみを使用します。
// 重複ルートはエラーの原因となります。

// 他の認証関連ルート
const authRoutes = require('./backend/routes/auth.routes');
app.use('/api/auth', authRoutes);

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).json({
    error: 'サーバーエラーが発生しました',
    message: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// サーバー起動
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`AppGenius Portal API running at http://0.0.0.0:${port}/`);
});