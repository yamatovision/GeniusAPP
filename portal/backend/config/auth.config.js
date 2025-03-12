/**
 * 認証設定ファイル
 * JWT認証のシークレットキーとトークン有効期限設定を管理します
 */
require('dotenv').config();

module.exports = {
  // JWT認証用シークレットキー
  jwtSecret: process.env.JWT_SECRET || 'appgenius-jwt-secret-key',
  
  // JWTアクセストークンの有効期限（環境変数またはデフォルト値）
  jwtExpiry: process.env.JWT_EXPIRY || '1h',
  
  // リフレッシュトークン用シークレット
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'appgenius-refresh-token-secret-key',
  
  // リフレッシュトークンの有効期限（環境変数またはデフォルト値）
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '14d',

  // パスワードハッシュのソルトラウンド数
  saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),

  // ユーザーロール定義
  roles: {
    ADMIN: 'admin',
    USER: 'user'
  },

  // JWT設定
  jwtOptions: {
    issuer: 'appgenius-prompt-portal',
    audience: 'appgenius-users'
  },

  // CORS設定
  corsOptions: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true
  }
};