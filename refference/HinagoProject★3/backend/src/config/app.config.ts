/**
 * アプリケーション全体の設定ファイル
 */
import dotenv from 'dotenv';
import path from 'path';

// .envファイルを読み込む
dotenv.config();

const config = {
  // アプリケーション設定
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    apiPrefix: process.env.API_PREFIX || '/api',
  },
  
  // ロギング設定
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'dev',
    logDir: path.join(__dirname, '../../logs'),
  },
  
  // CORS設定
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [process.env.FRONTEND_URL || 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count', 'Content-Disposition'],
    maxAge: 86400, // 1日
  },
  
  // レート制限設定
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // デフォルト1分
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // デフォルト100リクエスト/分
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // アップロード設定
  upload: {
    tempDir: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // デフォルト10MB
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? 
      process.env.ALLOWED_FILE_TYPES.split(',') : 
      ['image/jpeg', 'image/png', 'application/pdf', 'application/dxf', 'application/dwg'],
  },
  
  // APIバージョン
  api: {
    version: 'v1',
  },
};

export default config;