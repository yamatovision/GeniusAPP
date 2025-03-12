/**
 * AppGenius プロンプト管理ポータルサーバー
 * 認証システムとプロンプト管理機能を提供するバックエンドサーバー
 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// 環境変数の読み込み
dotenv.config();

// 設定ファイルの読み込み
const dbConfig = require('./backend/config/db.config');
const authConfig = require('./backend/config/auth.config');

// Express アプリケーションの作成
const app = express();

// リクエストボディのパース設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// セキュリティ設定
app.use(helmet());

// CORSの設定
app.use(cors(authConfig.corsOptions));

// リクエストログ設定
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 応答圧縮
app.use(compression());

// レート制限の設定
const apiLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000, // 15分間
  max: process.env.RATE_LIMIT_MAX || 100, // IP毎に100リクエストまで
  standardHeaders: true, // 標準ヘッダー付与
  legacyHeaders: false, // 古いヘッダーは使用しない
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエスト回数の上限に達しました。しばらく経ってから再試行してください。'
    }
  }
});

// レート制限を適用
app.use('/api/', apiLimiter);

// ルーターのマウント
const authRoutes = require('./backend/routes/auth.routes');
app.use('/api/auth', authRoutes);

// API ルートプレフィックス設定
app.get('/api', (req, res) => {
  res.json({
    message: 'AppGenius プロンプト管理ポータル API',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: [
      '/api/auth',
      '/api/users',
      '/api/prompts',
      '/api/projects'
    ]
  });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'AppGenius プロンプト管理ポータル バックエンドサーバー',
    status: 'running',
    documentation: '/api'
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
});

// 存在しないルートへのアクセス処理
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: '要求されたリソースが見つかりません'
    }
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    // データベース接続
    await dbConfig.connect(mongoose);
    
    // サーバー起動
    app.listen(PORT, () => {
      console.log(`サーバーが起動しました - ポート: ${PORT}`);
      console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
};

// プロセス終了時の処理
process.on('SIGINT', async () => {
  try {
    console.log('アプリケーションを終了しています...');
    await dbConfig.disconnect(mongoose);
    console.log('データベース接続を閉じました');
    process.exit(0);
  } catch (error) {
    console.error('アプリケーション終了中にエラーが発生しました:', error);
    process.exit(1);
  }
});

// サーバー起動
startServer();