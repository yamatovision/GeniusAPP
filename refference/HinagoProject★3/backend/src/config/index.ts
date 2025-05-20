/**
 * 設定ファイルをまとめてエクスポート
 */
import appConfig from './app.config';
import authConfig from './auth.config';
import dbConfig from './db.config';

export const config = {
  app: appConfig,
  auth: authConfig,
  db: dbConfig,
  geocoding: {
    apiKey: process.env.GEOCODING_API_KEY || '',
    provider: process.env.GEOCODING_PROVIDER || 'google'
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分
    max: 100 // リクエスト数
  },
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  }
};

export default config;