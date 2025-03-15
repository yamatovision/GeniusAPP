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
const app = express();
const port = process.env.PORT || 8080;

// ミドルウェア設定
app.use(cors({
  origin: ['https://geniemon.vercel.app', 'https://geniemon-yamatovisions-projects.vercel.app', 'http://localhost:3000', process.env.CORS_ORIGIN || '*'],
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

// テスト用認証エンドポイント
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// マスターアカウント情報
const masterAccount = {
  username: "admin",
  password: bcrypt.hashSync("AppGenius2025", 10),
  name: "管理者",
  email: "admin@appgenius.dev",
  role: "admin"
};

// 追加アカウント
const additionalAccount = {
  username: "lisence@mikoto.co.jp",
  password: bcrypt.hashSync("Mikoto@123", 10),
  name: "Mikoto",
  email: "lisence@mikoto.co.jp",
  role: "admin"
};

// ログインAPI
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // フロントエンドからはemailとして送信されるのでusernameとして扱う
  const username = email;
  
  console.log("ログイン試行:", username);
  
  // マスターアカウントチェック
  if (username === masterAccount.username && bcrypt.compareSync(password, masterAccount.password)) {
    // JWTトークン生成
    const token = jwt.sign(
      { id: "master-001", username, role: masterAccount.role },
      process.env.JWT_SECRET || "appgenius_jwt_secret_dev",
      { expiresIn: process.env.JWT_EXPIRY || "1h" }
    );
    
    // リフレッシュトークン生成
    const refreshToken = jwt.sign(
      { id: "master-001", username },
      process.env.REFRESH_TOKEN_SECRET || "appgenius_refresh_token_secret_dev",
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "14d" }
    );
    
    res.json({
      message: "ログインに成功しました",
      user: {
        id: "master-001",
        username: masterAccount.username,
        name: masterAccount.name,
        email: masterAccount.email,
        role: masterAccount.role
      },
      accessToken: token,
      refreshToken: refreshToken
    });
  } 
  // 追加アカウントチェック
  else if (username === additionalAccount.username && bcrypt.compareSync(password, additionalAccount.password)) {
    // JWTトークン生成
    const token = jwt.sign(
      { id: "mikoto-001", username, role: additionalAccount.role },
      process.env.JWT_SECRET || "appgenius_jwt_secret_dev",
      { expiresIn: process.env.JWT_EXPIRY || "1h" }
    );
    
    // リフレッシュトークン生成
    const refreshToken = jwt.sign(
      { id: "mikoto-001", username },
      process.env.REFRESH_TOKEN_SECRET || "appgenius_refresh_token_secret_dev",
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "14d" }
    );
    
    res.json({
      message: "ログインに成功しました",
      user: {
        id: "mikoto-001",
        username: additionalAccount.username,
        name: additionalAccount.name,
        email: additionalAccount.email,
        role: additionalAccount.role
      },
      accessToken: token,
      refreshToken: refreshToken
    });
  } else {
    // ログイン失敗
    res.status(401).json({
      message: "ユーザー名またはパスワードが正しくありません"
    });
  }
});

// 現在のユーザー情報取得API
app.get('/api/auth/users/me', (req, res) => {
  // 認証ヘッダーを取得
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "認証が必要です" });
  }
  
  // トークン取得
  const token = authHeader.split(' ')[1];
  
  try {
    // トークン検証
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "appgenius_jwt_secret_dev"
    );
    
    // ユーザー情報返却
    if (decoded.id === "master-001") {
      res.json({
        user: {
          id: decoded.id,
          username: decoded.username,
          name: masterAccount.name,
          email: masterAccount.email,
          role: decoded.role
        }
      });
    } else if (decoded.id === "mikoto-001") {
      res.json({
        user: {
          id: decoded.id,
          username: decoded.username,
          name: additionalAccount.name,
          email: additionalAccount.email,
          role: decoded.role
        }
      });
    } else {
      res.status(404).json({ message: "ユーザーが見つかりません" });
    }
  } catch (err) {
    res.status(401).json({ message: "トークンが無効です" });
  }
});

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