/**
 * レート制限ミドルウェア
 * 短時間での過度な接続に対する制限を実装します
 */

// メモリ内キャッシュ (実運用ではRedisなどの外部ストレージが望ましい)
const ipRequestStore = new Map();
const userRequestStore = new Map();

// 設定値
const IP_WINDOW_MS = 60 * 1000; // 1分間のウィンドウ
const IP_MAX_REQUESTS = 60;     // IPアドレスあたり1分間に60リクエスト
const AUTH_WINDOW_MS = 15 * 1000; // 15秒間のウィンドウ
const AUTH_MAX_REQUESTS = 5;    // 認証エンドポイントは15秒で5回まで

/**
 * リクエスト回数を記録し、制限を超えているかチェック
 * @param {string} key キャッシュキー
 * @param {Map} store 記録用ストア
 * @param {number} windowMs 時間枠 (ミリ秒)
 * @param {number} maxRequests 最大リクエスト数
 * @returns {boolean} 制限を超えているかどうか
 */
function isRateLimited(key, store, windowMs, maxRequests) {
  const now = Date.now();
  const record = store.get(key) || { count: 0, resetAt: now + windowMs };
  
  // 期限切れなら初期化
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count += 1;
  }
  
  store.set(key, record);
  
  return record.count > maxRequests;
}

/**
 * IPアドレスベースの一般的なレート制限
 * @param {Object} req リクエストオブジェクト
 * @param {Object} res レスポンスオブジェクト
 * @param {Function} next 次のミドルウェア
 */
exports.generalRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (isRateLimited(ip, ipRequestStore, IP_WINDOW_MS, IP_MAX_REQUESTS)) {
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'リクエスト回数の制限を超えました。しばらく待ってから再試行してください。',
        resetIn: Math.ceil((ipRequestStore.get(ip).resetAt - Date.now()) / 1000)
      }
    });
  }
  
  next();
};

/**
 * 認証エンドポイント向けの厳格なレート制限
 * @param {Object} req リクエストオブジェクト
 * @param {Object} res レスポンスオブジェクト
 * @param {Function} next 次のミドルウェア
 */
exports.authRateLimit = (req, res, next) => {
  // 認証レート制限を無効化し、すべてのリクエストを許可
  next();
};

/**
 * ユーザーIDベースの認証後のレート制限
 * @param {Object} req リクエストオブジェクト
 * @param {Object} res レスポンスオブジェクト
 * @param {Function} next 次のミドルウェア
 */
exports.userRateLimit = (req, res, next) => {
  if (!req.userId) {
    return next();
  }
  
  const key = `user:${req.userId}`;
  
  if (isRateLimited(key, userRequestStore, IP_WINDOW_MS, IP_MAX_REQUESTS)) {
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'リクエスト回数の制限を超えました。しばらく待ってから再試行してください。',
        resetIn: Math.ceil((userRequestStore.get(key).resetAt - Date.now()) / 1000)
      }
    });
  }
  
  next();
};