/**
 * シンプル認証システム設定ファイル
 * 
 * 通常の認証システムとは完全に分離した設定を提供します
 * このファイルはシングルトンとして実装されています
 */
require('dotenv').config();

// 固定文字列のシークレットキーを使用（開発環境用）
// 本番環境では実際のシークレットキーを環境変数から取得すべき
const SIMPLE_JWT_SECRET = 'simple-auth-jwt-fixed-secret-key-for-development';
const SIMPLE_REFRESH_TOKEN_SECRET = 'simple-auth-refresh-fixed-secret-key-for-development';

// 固定のJWTオプション
const JWT_OPTIONS = {
  issuer: 'appgenius-simple-auth',
  audience: 'appgenius-simple-users',
  notBefore: 0,
  allowInsecureKeySizes: false,
  allowInvalidAsymmetricSignatures: false
};

// 設定オブジェクト
const simpleAuthConfig = {
  // 固定されたシークレットキーを使用
  jwtSecret: SIMPLE_JWT_SECRET,
  
  // トークンの有効期限
  jwtExpiration: process.env.SIMPLE_JWT_EXPIRY || '24h',
  
  // 固定されたリフレッシュトークンシークレット
  refreshTokenSecret: SIMPLE_REFRESH_TOKEN_SECRET,
  
  // リフレッシュトークンの有効期限
  refreshTokenExpiration: process.env.SIMPLE_REFRESH_TOKEN_EXPIRY || '7d',

  // パスワードハッシュのソルトラウンド数
  saltRounds: parseInt(process.env.SIMPLE_PASSWORD_SALT_ROUNDS || '10', 10),

  // 固定のJWTオプション
  jwtOptions: JWT_OPTIONS,
  
  // トークン設定
  tokenSettings: {
    validation: {
      jwtClockTolerance: 30,
      refreshGracePeriod: 86400
    }
  }
};

// デバッグ情報
console.log('Simple認証設定ロード:', {
  secretKey: simpleAuthConfig.jwtSecret.substring(0, 5) + '...',
  issuer: simpleAuthConfig.jwtOptions.issuer
});

// シングルトンとしてエクスポート
module.exports = simpleAuthConfig;