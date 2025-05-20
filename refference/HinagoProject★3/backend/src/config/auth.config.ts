/**
 * 認証関連の設定ファイル
 */
import dotenv from 'dotenv';
import { API_AUTH_CONFIG } from '../types';

// .envファイルを読み込む
dotenv.config();

const config = {
  // JWT設定
  jwt: {
    secret: process.env.JWT_SECRET || 'development_jwt_secret', // 開発環境以外ではハードコードしない
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'development_refresh_secret', // 開発環境以外ではハードコードしない
    accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY || 
      String(API_AUTH_CONFIG.TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY), 10), // デフォルト15分
    refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY || 
      String(API_AUTH_CONFIG.TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY), 10), // デフォルト7日
    refreshTokenExpiryRemember: parseInt(process.env.REFRESH_TOKEN_EXPIRY_REMEMBER || 
      String(API_AUTH_CONFIG.TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_REMEMBER), 10), // デフォルト30日
    cookieSecure: process.env.NODE_ENV === 'production', // 本番環境ではSecureを有効に
    cookieHttpOnly: true,
    cookieSameSite: 'lax', // CSRFからの保護を提供するための設定
  },
  
  // パスワード設定
  password: {
    saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '12', 10), // bcryptのソルトラウンド
    minLength: 8, // パスワードの最小長
    resetTokenExpiry: 24 * 60 * 60 * 1000, // パスワードリセットトークンの有効期限（デフォルト24時間）
  },
  
  // セッション設定
  session: {
    secret: process.env.SESSION_SECRET || 'development_session_secret', // 開発環境以外ではハードコードしない
    name: 'hinago.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 本番環境ではSecureを有効に
      maxAge: 24 * 60 * 60 * 1000, // 1日
    },
  },
  
  // 認証レート制限（特にログイン試行回数制限）
  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15分間
    maxAttempts: 5, // 最大試行回数
    blockDuration: 15 * 60 * 1000, // ブロック期間（15分）
  },
  
  // パブリックエンドポイント（認証不要のパス）
  publicEndpoints: API_AUTH_CONFIG.PUBLIC_ENDPOINTS,
};

export default config;