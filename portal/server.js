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

// ログインAPI
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log("ログイン試行:", email);
    
    // まずMongoDBからユーザーを探す
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      console.log("ユーザーがDBに見つかりました:", user.email);
      
      // パスワードチェック
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (isPasswordValid) {
        console.log("パスワード検証成功");
        
        // JWTトークン生成
        const token = jwt.sign(
          { id: user._id.toString(), role: user.role },
          authConfig.jwtSecret,
          { expiresIn: authConfig.jwtExpiry }
        );
        
        // リフレッシュトークン生成
        const refreshToken = jwt.sign(
          { id: user._id.toString() },
          authConfig.refreshTokenSecret,
          { expiresIn: authConfig.refreshTokenExpiry }
        );
        
        // ユーザーのリフレッシュトークンを更新
        user.refreshToken = refreshToken;
        user.lastLogin = new Date();
        await user.save();
        
        return res.json({
          message: "ログインに成功しました",
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
          },
          accessToken: token,
          refreshToken: refreshToken
        });
      } else {
        console.log("パスワード検証失敗");
      }
    } else {
      console.log("ユーザーがDBに見つかりませんでした");
    }
    
    // MongoDB認証に失敗した場合はエラー
    return res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "メールアドレスまたはパスワードが正しくありません"
      }
    });
  } catch (error) {
    console.error("ログインエラー:", error);
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "サーバーエラーが発生しました",
        details: error.message
      }
    });
  }
});

// 現在のユーザー情報取得API
app.get('/api/auth/users/me', async (req, res) => {
  try {
    // 認証ヘッダーを取得
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: {
          code: "AUTH_REQUIRED",
          message: "認証が必要です"
        }
      });
    }
    
    // トークン取得
    const token = authHeader.split(' ')[1];
    
    // トークン検証
    const decoded = jwt.verify(token, authConfig.jwtSecret);
    
    // MongoDBからユーザー情報を取得
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({ 
        error: {
          code: "USER_NOT_FOUND",
          message: "ユーザーが見つかりません"
        }
      });
    }
    
    // ユーザー情報を返却
    res.json({
      user: user
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: "TOKEN_EXPIRED",
          message: "トークンの有効期限が切れています"
        }
      });
    }
    
    return res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "トークンが無効です",
        details: error.message
      }
    });
  }
});

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