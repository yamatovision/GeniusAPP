/**
 * AppGenius Portal Express App設定ファイル
 * 
 * テスト用途でサーバー設定とExpress appを分離します
 */

// 環境変数ロード
require('dotenv').config();

// 必要なモジュール
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const authConfig = require('./config/auth.config');

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

// server.jsでログ表示用にorigins情報を保存
app.set('corsOrigins', allowedOrigins);

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
      { path: "/api/prompts", description: "プロンプト管理API" },
      { path: "/api/proxy", description: "APIプロキシ" },
      { path: "/api/projects", description: "プロジェクト管理API" },
      { path: "/api/plans", description: "アクセスプラン管理API" }
    ]
  });
});

// ルートの設定
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/prompts', require('./routes/prompt.routes'));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/proxy', require('./routes/api-proxy.routes'));
app.use('/api/plans', require('./routes/accessPlan.routes'));

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).json({
    error: 'サーバーエラーが発生しました',
    message: err.message
  });
});

module.exports = app;