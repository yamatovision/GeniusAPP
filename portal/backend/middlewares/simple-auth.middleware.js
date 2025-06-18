/**
 * シンプル認証ミドルウェア
 * JWTトークンの検証、ユーザー権限のチェックなどを行います
 * 
 * 従来のauth.middlewareとは完全に分離した独立した実装です
 */
const jwt = require('jsonwebtoken');
// 通常の認証設定ではなく、専用の設定ファイルを使用
const simpleAuthConfig = require('../config/simple-auth.config');
const SimpleUser = require('../models/simpleUser.model');
// 認証ヘルパーを追加
const authHelper = require('../utils/simpleAuth.helper');
// セッション管理サービスを追加
const SessionService = require('../services/session.service');

/**
 * JWTトークンを検証するミドルウェア
 * リクエストヘッダーからトークンを取得し、有効性を確認します
 */
// 検証結果のキャッシュ（トークン→{result, timestamp}のマップ）
const tokenVerificationCache = new Map();
// キャッシュの有効期間（5秒）
const CACHE_TTL = 5000;

exports.verifySimpleToken = async (req, res, next) => {
  // Authorizationヘッダーからトークンを取得
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('verifySimpleToken: 認証ヘッダーなし', authHeader);
    return res.status(401).json({
      success: false,
      message: '認証が必要です'
    });
  }

  // Bearer プレフィックスを削除してトークンを取得
  const token = authHeader.split(' ')[1];
  
  // キャッシュを確認
  const now = Date.now();
  const cachedVerification = tokenVerificationCache.get(token);
  
  if (cachedVerification && (now - cachedVerification.timestamp < CACHE_TTL)) {
    // キャッシュが有効期間内なら、結果を再利用
    req.userId = cachedVerification.userId;
    req.userRole = cachedVerification.userRole;
    return next();
  }
  
  // デバッグ: トークンの内容をデコード（署名検証なし）
  try {
    const decoded = jwt.decode(token);
    if (decoded) {
      // ログ出力を削減
      console.log('verifySimpleToken: トークン検証');
    }
  } catch (decodeErr) {
    console.error('verifySimpleToken: トークンデコードエラー', decodeErr);
  }

  try {
    // ヘルパー関数を使用して検証（既存トークンとの互換性を持たせない、完全に独立した検証）
    const decoded = authHelper.verifyAccessToken(token);
    
    // デコードされたユーザーIDをリクエストオブジェクトに追加
    req.userId = decoded.id;
    req.userRole = decoded.role || 'User';
    req.sessionId = decoded.sessionId || null;
    
    // ユーザーのアカウントステータスを確認（必要に応じて）
    if (decoded.accountStatus === 'suspended') {
      return res.status(401).json({
        success: false,
        message: 'アカウントが一時停止されています。管理者にお問い合わせください。',
        error: {
          code: 'ACCOUNT_SUSPENDED',
          details: { accountStatus: 'suspended' }
        }
      });
    }
    
    // セッションが含まれている場合は、セッションの有効性を確認
    if (decoded.sessionId) {
      const isValidSession = await SessionService.validateSession(decoded.id, decoded.sessionId);
      
      if (!isValidSession) {
        // キャッシュから削除
        tokenVerificationCache.delete(token);
        
        // CORS対応ヘッダー設定
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
        
        return res.status(401).json({
          success: false,
          message: '別の場所からログインされたため、セッションが終了しました',
          error: {
            code: 'SESSION_TERMINATED',
            details: { sessionInvalid: true }
          }
        });
      }
      
      // セッションアクティビティを更新（非同期で実行）
      SessionService.updateSessionActivity(decoded.id).catch(err => {
        console.error('セッションアクティビティ更新エラー:', err);
      });
    }
    
    // 検証結果をキャッシュに保存
    tokenVerificationCache.set(token, {
      userId: decoded.id,
      userRole: decoded.role || 'User',
      timestamp: now
    });
    
    next();
  } catch (error) {
    console.error('verifySimpleToken: トークン検証失敗', error);
    
    if (error.name === 'TokenExpiredError') {
      // CORS対応ヘッダー設定
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
      
      return res.status(401).json({
        success: false,
        message: 'トークンの有効期限が切れています',
        error: {
          code: 'TOKEN_EXPIRED',
          details: { expiredAt: error.expiredAt }
        }
      });
    }
    
    if (error.name === 'JsonWebTokenError' && error.message.includes('signature')) {
      // CORS対応ヘッダー設定
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
      
      return res.status(401).json({
        success: false,
        message: '認証システムが更新されました。再ログインしてください。',
        requireRelogin: true,
        error: {
          code: 'SYSTEM_UPDATED',
          details: { requireRelogin: true }
        }
      });
    }
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    return res.status(401).json({
      success: false,
      message: '無効なトークンです',
      error: {
        code: 'INVALID_TOKEN',
        details: { errorName: error.name, errorMessage: error.message }
      }
    });
  }
};

/**
 * リフレッシュトークンを検証するミドルウェア
 */
exports.verifySimpleRefreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'リフレッシュトークンが必要です'
    });
  }

  try {
    // ヘルパー関数を使用してリフレッシュトークンを検証
    const decoded = authHelper.verifyRefreshToken(refreshToken);
    
    // トークンに関連付けられたユーザーを検索
    const user = await SimpleUser.findOne({ refreshToken });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '無効なリフレッシュトークンです'
      });
    }
    
    // ユーザーのステータスを確認
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    // アカウントが一時停止されているか確認
    if (user.accountStatus === 'suspended') {
      return res.status(401).json({
        success: false,
        message: 'アカウントが一時停止されています。管理者にお問い合わせください。',
        error: {
          code: 'ACCOUNT_SUSPENDED',
          details: { accountStatus: 'suspended' }
        }
      });
    }
    
    // ユーザー情報をリクエストに追加
    req.userId = user._id;
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'リフレッシュトークンの有効期限が切れています'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: '無効なリフレッシュトークンです'
    });
  }
};

/**
 * 管理者権限を検証するミドルウェア
 * verifySimpleTokenミドルウェアの後に使用する必要があります
 */
exports.isSimpleAdmin = async (req, res, next) => {
  try {
    // JWTトークンから取得したロールを使用する
    if (req.userRole === 'Admin' || req.userRole === 'SuperAdmin') {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: '管理者権限が必要です'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * スーパー管理者権限を検証するミドルウェア
 * verifySimpleTokenミドルウェアの後に使用する必要があります
 */
exports.isSimpleSuperAdmin = async (req, res, next) => {
  try {
    // JWTトークンから取得したロールを使用する
    if (req.userRole === 'SuperAdmin') {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'スーパー管理者権限が必要です'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ユーザー情報をリクエストに追加するミドルウェア
 * verifySimpleTokenミドルウェアの後に使用すると便利です
 */
exports.loadSimpleUser = async (req, res, next) => {
  try {
    // データベースからユーザー情報を取得
    const user = await SimpleUser.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // ユーザー情報をリクエストオブジェクトに設定
    req.user = user;
    next();
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザー情報取得中にエラーが発生しました',
      error: error.message
    });
  }
};