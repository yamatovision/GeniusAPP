/**
 * 認証設定ファイル
 * JWT認証のシークレットキーとトークン有効期限設定を管理します
 * 
 * 改善点:
 * - トークン有効期限の延長でVSCode再起動時の頻繁なログアウトを防止
 * - JWTオプションの強化でセキュリティと安定性を向上
 */
require('dotenv').config();

module.exports = {
  // JWT認証用シークレットキー
  jwtSecret: process.env.JWT_SECRET || 'appgenius-jwt-secret-key',
  
  // JWTアクセストークンの有効期限（環境変数またはデフォルト値）
  // 72時間に延長して頻繁なリフレッシュを大幅に減らす
  jwtExpiry: process.env.JWT_EXPIRY || '72h',
  
  // リフレッシュトークン用シークレット
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'appgenius-refresh-token-secret-key',
  
  // リフレッシュトークンの有効期限（環境変数またはデフォルト値）
  // 90日に延長してVSCode再起動でもログイン状態を長期間維持
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '90d',

  // パスワードハッシュのソルトラウンド数
  saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),

  // ユーザーロール定義
  roles: {
    ADMIN: 'admin',          // 管理者
    SUPER_ADMIN: 'super_admin',  // システム管理者（全企業管理可能）
    USER: 'user',            // 通常ユーザー
    UNPAID: 'unpaid',        // 料金未払いユーザー(APIは利用禁止だがUIは見れる)
    INACTIVE: 'unsubscribed' // 退会済みユーザー（非推奨、新モデルではdeactivatedを使用）
  },
  
  // アカウント状態定義
  accountStatus: {
    ACTIVE: 'active',        // 有効なアカウント
    SUSPENDED: 'suspended',  // 一時停止されたアカウント
    DEACTIVATED: 'deactivated' // 削除/無効化されたアカウント
  },
  
  // 組織内ロール定義
  organizationRoles: {
    OWNER: 'owner',          // 組織オーナー
    ADMIN: 'admin',          // 組織管理者
    MEMBER: 'member'         // 一般メンバー
  },

  // JWT設定
  jwtOptions: {
    issuer: 'appgenius-simple-auth',
    audience: 'appgenius-simple-users',
    notBefore: 0, // トークン発行後すぐに有効 (秒単位)
    allowInsecureKeySizes: false, // 安全でないキーサイズを拒否
    allowInvalidAsymmetricSignatures: false // 無効な非対称署名を拒否
  },

  // クライアント固有の設定
  clients: {
    vscode: {
      id: 'appgenius_vscode_client_29a7fb3e',
      secret: 'appgenius_refresh_token_secret_key_for_production',
      // VSCode拡張用の特別設定
      tokenRotation: true, // リフレッシュトークンローテーションを有効化
      extendedSessionDuration: true // セッション期間延長を有効化
    }
  },

  // トークン設定
  tokenSettings: {
    // トークンローテーション設定
    rotation: {
      enabled: true, // リフレッシュトークンのローテーションを有効化
      reuseWindow: 60 // 古いトークンの再利用可能時間 (秒) - グレースピリオド
    },
    // トークン有効性設定
    validation: {
      jwtClockTolerance: 30, // 時刻ずれの許容値 (秒)
      refreshGracePeriod: 86400 // リフレッシュトークン有効期限切れ後の猶予期間 (秒) - 1日
    }
  },

  // CORS設定
  corsOptions: {
    origin: function(origin, callback) {
      // 許可するオリジンのリスト
      const allowedOrigins = [
        'https://geniemon.vercel.app', 
        'https://geniemon-yamatovisions-projects.vercel.app', 
        'http://localhost:3000', 
        'http://localhost:3001',
        'vscode-webview://*/geniemon-extension' // VSCode WebView用
      ];
      
      // process.env.CORS_ORIGINがあれば追加 (カンマ区切り)
      if (process.env.CORS_ORIGIN) {
        const additionalOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        allowedOrigins.push(...additionalOrigins);
      }
      
      // originがundefinedの場合（サーバー間リクエスト）または許可リストに含まれる場合は許可
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || 
          allowedOrigins.some(allowed => origin && origin.startsWith(allowed.replace('*', '')))) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    methods: process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
    maxAge: 86400 // プリフライトリクエスト結果のキャッシュ時間 (秒) - 24時間
  }
};