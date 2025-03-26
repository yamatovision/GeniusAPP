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
// 古い認証設定をシンプル認証設定に置き換え (2025/3/23)
// const authConfig = require('./config/auth.config');
const authConfig = require('./config/simple-auth.config');

// レート制限ミドルウェアのインポート
const rateLimitMiddleware = require('./middlewares/rate-limit.middleware');

// ミドルウェア設定
// 環境変数のCORS_ORIGINをカンマ区切りで配列に変換
const corsOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
  ['*'];

// 環境変数の値と明示的な許可リストをマージ
const allowedOrigins = [
  'https://geniemon.vercel.app', 
  'https://geniemon-yamatovisions-projects.vercel.app',
  'https://geniemon-git-main-yamatovisions-projects.vercel.app', // 新しいVercelプレビュー環境
  'http://localhost:3000', 
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://localhost:5000',  // APIサーバー自身（開発時の直接アクセス用）
  'http://127.0.0.1:5000',
  'vscode-webview://*',     // VSCode Webview用
  ...corsOrigins
].filter(origin => origin !== '*'); // 重複を許容し、'*'は明示的リストがある場合は除外

// server.jsでログ表示用にorigins情報を保存
app.set('corsOrigins', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // origin が undefined の場合はサーバー間リクエスト
    if (!origin) return callback(null, true);
    
    // VSCode Webviewの場合は特別に許可
    if (origin.startsWith('vscode-webview:')) {
      return callback(null, true);
    }
    
    // 開発環境では全て許可（process.env.NODE_ENV === 'development'）
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // 明示的な許可リストに含まれているか、corsOriginsに'*'が含まれている場合は許可
    if (allowedOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`CORS policy violation for origin: ${origin}`);
      callback(new Error('CORS policy violation'));
    }
  },
  methods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS',
  credentials: true,
  exposedHeaders: ['Content-Length', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// グローバルなレート制限を適用
app.use(rateLimitMiddleware.generalRateLimit);

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
      { path: "/api/organizations", description: "組織管理API" },
      { path: "/api/workspaces", description: "ワークスペース管理API" },
      { path: "/api/admin", description: "管理者API" },
      { path: "/api/simple", description: "シンプル版API" }
    ]
  });
});

// ルートの設定
// 標準認証システムを無効化し、シンプル認証システムのみを使用する (2025/3/24)
// 以下のコメントアウトされた行はすべて標準認証システムに依存していたため無効化

// app.use('/api/auth', require('./routes/auth.routes')); // 標準認証ルート - 無効化
// app.use('/api/users', require('./routes/user.routes')); // 標準ユーザー管理 - 無効化
app.use('/api/prompts', require('./routes/prompt.routes')); // プロンプト管理は残す
// app.use('/api/projects', require('./routes/project.routes')); // 標準プロジェクト管理 - 無効化
app.use('/api/proxy', require('./routes/api-proxy.routes')); // APIプロキシは残す

// 組織・ワークスペース管理APIルート - 無効化
// app.use('/api/organizations', require('./routes/organization.routes'));
// app.use('/api/workspaces', require('./routes/workspace.routes'));
// app.use('/api/admin', require('./routes/admin.routes'));

// 組織ユーザー管理APIルート - 無効化
// app.use('/api', require('./routes/invitation.routes'));
// app.use('/api', require('./routes/apiKey.routes'));

// システム設定管理APIルート - 無効化
// app.use('/api', require('./routes/adminConfig.routes'));

// シンプル版API
app.use('/api/simple', require('./routes/simple.routes'));

// エラーログ
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  if (next) {
    next(err);
  }
});

// フロントエンドのファイルサービス（プロダクション環境用）
if (process.env.NODE_ENV === 'production') {
  // 静的ファイルを提供
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  // API以外のすべてのリクエストをindex.htmlにリダイレクト
  app.get(/^(?!\/api\/).+/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).json({
    error: 'サーバーエラーが発生しました',
    message: err.message
  });
});

module.exports = app;