/**
 * 認証ミドルウェア
 * JWTトークンの検証、ユーザー権限のチェックなどを行います
 * 
 * ユーザーロール/権限:
 * - admin: システム全体の管理者。すべての操作に対する権限を持つ
 * - user: 一般ユーザー。自分のリソースとパブリックリソースにアクセス可能
 * - project.owner: プロジェクトの所有者。プロジェクト内のすべての操作が可能
 * - project.editor: プロジェクト編集者。編集権限を持つ
 * - project.member: プロジェクトメンバー。閲覧のみ可能
 */
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');
const User = require('../models/user.model');

/**
 * JWTトークンを検証するミドルウェア
 * リクエストヘッダーからトークンを取得し、有効性を確認します
 */
exports.verifyToken = (req, res, next) => {
  console.log('verifyToken: ミドルウェア開始');
  
  // Authorizationヘッダーからトークンを取得
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('verifyToken: 認証ヘッダーなし', authHeader);
    return res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: '認証が必要です'
      }
    });
  }

  // Bearer プレフィックスを削除してトークンを取得
  const token = authHeader.split(' ')[1];
  console.log('verifyToken: トークン抽出', token.substring(0, 10) + '...');

  // テスト環境ではモックトークンを許可
  if (process.env.NODE_ENV === 'test' && token.startsWith('mock_token_')) {
    try {
      // テストトークンからモックIDとロールを抽出
      const parts = token.split('_');
      req.userRole = parts[2]; // 'user' or 'admin'
      req.userId = parts[3]; // 'user123' など
      console.log('verifyToken: テストトークン検証成功', { userRole: req.userRole, userId: req.userId });
      return next();
    } catch (err) {
      console.error('テストトークン解析エラー:', err);
      // 通常の検証にフォールバック
    }
  }

  try {
    console.log('verifyToken: トークン検証開始', { secret: authConfig.jwtSecret ? 'あり' : 'なし' });
    
    // トークンを検証（時計ずれの許容設定を追加）
    const clockTolerance = authConfig.tokenSettings?.validation?.jwtClockTolerance || 30; // 30秒のデフォルト許容値
    const decoded = jwt.verify(token, authConfig.jwtSecret, { 
      clockTolerance,
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience
    });
    
    console.log('verifyToken: トークン検証成功', decoded);
    
    // デコードされたユーザーIDをリクエストオブジェクトに追加
    req.userId = decoded.id;
    req.userRole = decoded.role || 'user';
    console.log('verifyToken: 検証データ設定完了', { userId: req.userId, userRole: req.userRole });
    next();
  } catch (error) {
    console.error('verifyToken: トークン検証失敗', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'トークンの有効期限が切れています',
          requireRefresh: true, // クライアントにリフレッシュが必要なことを通知
          debug: { expiredAt: error.expiredAt }
        }
      });
    }
    
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: '無効なトークンです',
        debug: { errorName: error.name, errorMessage: error.message }
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
    const decoded = jwt.verify(refreshToken, authConfig.refreshTokenSecret, {
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience,
      clockTolerance: authConfig.tokenSettings?.validation?.jwtClockTolerance || 30
    });
    
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
    
    // ユーザーのロールを確認
    if (user.role === authConfig.roles.INACTIVE) {
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
    // JWTトークンから取得したロールを使用する
    if (req.userRole === authConfig.roles.ADMIN || req.userRole === authConfig.roles.SUPER_ADMIN) {
      return next();
    }
    
    return res.status(403).json({
      error: {
        code: 'PERMISSION_DENIED',
        message: '管理者権限が必要です'
      }
    });
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
 * スーパー管理者権限を検証するミドルウェア
 * verifyTokenミドルウェアの後に使用する必要があります
 */
exports.isSuperAdmin = async (req, res, next) => {
  try {
    // JWTトークンから取得したロールを使用する
    if (req.userRole === authConfig.roles.SUPER_ADMIN) {
      return next();
    }
    
    return res.status(403).json({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'スーパー管理者権限が必要です'
      }
    });
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
    // データベースからユーザー情報を取得
    const User = require('../models/user.model');
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    // ユーザー情報をリクエストオブジェクトに設定
    req.user = user;
    next();
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー情報取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * 汎用的な権限チェックヘルパー
 * 様々なタイプのアクセス権限チェックを一元化します
 * 
 * @param {Object} options - チェックオプション
 * @param {Object} options.resource - チェック対象のリソース（プロンプトなど）
 * @param {string} options.userId - リクエスト元ユーザーID
 * @param {string} options.userRole - リクエスト元ユーザーロール
 * @param {boolean} [options.checkPublic=false] - 公開リソースへのアクセスを許可するか
 * @param {boolean} [options.checkProjectMember=false] - プロジェクトメンバーのアクセスを許可するか
 * @param {boolean} [options.checkProjectEditor=false] - プロジェクト編集者のアクセスを許可するか
 * @param {boolean} [options.checkProjectAdmin=false] - プロジェクト管理者のアクセスを許可するか
 * @returns {Object} 権限チェック結果 { hasAccess, reason }
 */
exports.checkResourceAccess = async (options) => {
  const {
    resource,
    userId,
    userRole,
    checkPublic = false,
    checkProjectMember = false,
    checkProjectEditor = false,
    checkProjectAdmin = false
  } = options;
  
  // 結果オブジェクト
  const result = {
    hasAccess: false,
    reason: null
  };
  
  // システム管理者は常にアクセス可能
  if (userRole === 'admin') {
    result.hasAccess = true;
    result.reason = 'ADMIN_ACCESS';
    return result;
  }
  
  // リソース所有者チェック
  let isOwner = false;
  if (resource.ownerId) {
    // ownerId が単純な文字列か、オブジェクトかによって処理を分ける
    if (typeof resource.ownerId === 'string') {
      isOwner = resource.ownerId === userId;
    } else if (resource.ownerId._id) {
      isOwner = resource.ownerId._id.toString() === userId;
    } else if (resource.ownerId.toString) {
      isOwner = resource.ownerId.toString() === userId;
    }
  }
  
  if (isOwner) {
    result.hasAccess = true;
    result.reason = 'OWNER_ACCESS';
    return result;
  }
  
  // 公開リソースチェック
  if (checkPublic && resource.isPublic) {
    result.hasAccess = true;
    result.reason = 'PUBLIC_ACCESS';
    return result;
  }
  
  // プロジェクト関連のチェック
  if (resource.projectId && (checkProjectMember || checkProjectEditor || checkProjectAdmin)) {
    try {
      const Project = require('../models/project.model');
      const project = await Project.findById(resource.projectId);
      
      if (project) {
        const member = project.members.find(m => m.userId.toString() === userId);
        
        if (member) {
          if (checkProjectMember) {
            result.hasAccess = true;
            result.reason = 'PROJECT_MEMBER_ACCESS';
            return result;
          }
          
          if (checkProjectEditor && ['owner', 'editor'].includes(member.role)) {
            result.hasAccess = true;
            result.reason = 'PROJECT_EDITOR_ACCESS';
            return result;
          }
          
          if (checkProjectAdmin && member.role === 'owner') {
            result.hasAccess = true;
            result.reason = 'PROJECT_ADMIN_ACCESS';
            return result;
          }
        }
      }
    } catch (error) {
      console.error('プロジェクト権限チェックエラー:', error);
    }
  }
  
  return result;
};

/**
 * 権限チェックミドルウェアを生成するファクトリ関数
 * 
 * @param {Object} options - チェックオプション
 * @returns {Function} 権限チェックミドルウェア
 */
exports.checkAccess = (options) => {
  const {
    resourceType = 'プロンプト',
    checkPublic = false,
    checkProjectMember = false,
    checkProjectEditor = false,
    checkProjectAdmin = false,
    resourceIdParam = 'id',
    resourceLoader,
    errorMessage
  } = options;
  
  return async (req, res, next) => {
    try {
      // リソースID取得
      const resourceId = req.params[resourceIdParam];
      if (!resourceId || resourceId === 'undefined' || resourceId === 'null') {
        return res.status(400).json({ message: `有効な${resourceType}IDが指定されていません` });
      }
      
      // リソース読み込み
      let resource;
      if (typeof resourceLoader === 'function') {
        resource = await resourceLoader(resourceId, req);
      } else {
        return next(new Error('resourceLoader function is required'));
      }
      
      if (!resource) {
        return res.status(404).json({ message: `${resourceType}が見つかりません` });
      }
      
      // 権限チェック
      const accessResult = await this.checkResourceAccess({
        resource,
        userId: req.userId,
        userRole: req.userRole,
        checkPublic,
        checkProjectMember,
        checkProjectEditor,
        checkProjectAdmin
      });
      
      if (accessResult.hasAccess) {
        // 権限があればリソースをリクエストに追加して次へ
        req.resource = resource;
        return next();
      }
      
      // 権限なしの場合はエラー
      return res.status(403).json({ 
        message: errorMessage || `この${resourceType}にアクセスする権限がありません`,
        reason: accessResult.reason
      });
    } catch (error) {
      console.error('権限チェックエラー:', error);
      return res.status(500).json({
        error: {
          code: 'SERVER_ERROR',
          message: 'サーバーエラーが発生しました',
          details: error.message
        }
      });
    }
  };
};