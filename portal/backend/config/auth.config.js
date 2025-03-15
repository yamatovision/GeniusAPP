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
    ADMIN: 'admin',      // 管理者
    USER: 'user',        // 通常ユーザー
    UNPAID: 'unpaid',    // 料金未払いユーザー(APIは利用禁止だがUIは見れる)
    INACTIVE: 'unsubscribed' // 退会済みユーザー
  },

  // JWT設定
  jwtOptions: {
    issuer: 'appgenius-prompt-portal',
    audience: 'appgenius-users'
  },

  // CORS設定
  corsOptions: {
    origin: function(origin, callback) {
      // 許可するオリジンのリスト
      const allowedOrigins = [
        'https://geniemon.vercel.app', 
        'https://geniemon-yamatovisions-projects.vercel.app', 
        'http://localhost:3000', 
        'http://localhost:3001'
      ];
      
      // process.env.CORS_ORIGINがあれば追加 (カンマ区切り)
      if (process.env.CORS_ORIGIN) {
        const additionalOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        allowedOrigins.push(...additionalOrigins);
      }
      
      // originがundefinedの場合（サーバー間リクエスト）または許可リストに含まれる場合は許可
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true
  }
};