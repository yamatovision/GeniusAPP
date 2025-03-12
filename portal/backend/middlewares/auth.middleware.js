/**
 * 認証ミドルウェア
 * JWTトークンの検証、ユーザー権限のチェックなどを行います
 */
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');
const User = require('../models/user.model');

/**
 * JWTトークンを検証するミドルウェア
 * リクエストヘッダーからトークンを取得し、有効性を確認します
 */
exports.verifyToken = (req, res, next) => {
  // Authorizationヘッダーからトークンを取得
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: '認証が必要です'
      }
    });
  }

  // Bearer プレフィックスを削除してトークンを取得
  const token = authHeader.split(' ')[1];

  try {
    // トークンを検証
    const decoded = jwt.verify(token, authConfig.jwtSecret, {
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience
    });
    
    // デコードされたユーザーIDをリクエストオブジェクトに追加
    req.userId = decoded.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'トークンの有効期限が切れています'
        }
      });
    }
    
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: '無効なトークンです'
      }
    });
  }
};

/**
 * リフレッシュトークンを検証するミドルウェア
 */
exports.verifyRefreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'リフレッシュトークンが必要です'
      }
    });
  }

  try {
    // リフレッシュトークンを検証
    const decoded = jwt.verify(refreshToken, authConfig.refreshTokenSecret);
    
    // トークンに関連付けられたユーザーを検索
    const user = await User.findByRefreshToken(refreshToken);
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: '無効なリフレッシュトークンです'
        }
      });
    }
    
    // ユーザーのアクティブ状態をチェック
    if (!user.isActive) {
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'アカウントが無効化されています'
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
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'リフレッシュトークンの有効期限が切れています'
        }
      });
    }
    
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: '無効なリフレッシュトークンです'
      }
    });
  }
};

/**
 * 管理者権限を検証するミドルウェア
 * verifyTokenミドルウェアの後に使用する必要があります
 */
exports.isAdmin = async (req, res, next) => {
  try {
    // ユーザーを検索
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    // 管理者権限をチェック
    if (user.role !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * ユーザー情報をリクエストに追加するミドルウェア
 * verifyTokenミドルウェアの後に使用すると便利です
 */
exports.loadUser = async (req, res, next) => {
  try {
    // ユーザーを検索してリクエストに追加
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    // ユーザーのアクティブ状態をチェック
    if (!user.isActive) {
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'アカウントが無効化されています'
        }
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました',
        details: error.message
      }
    });
  }
};