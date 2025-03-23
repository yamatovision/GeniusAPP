/**
 * 使用量制限ミドルウェア
 * 注意: このファイルは延命されました。予算制限機能は廃止され、Anthropicのコンソールで直接管理されるようになりました。
 */

/**
 * 予算チェックは廃止され、Anthropicのコンソールで直接行われるようになりました。
 * これは互換性のために残されたダミー実装です。
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 * @param {Function} next - 次のミドルウェア関数
 */
exports.checkTokenLimit = async (req, res, next) => {
  // 廃止された機能ですが、API互換性のためにミドルウェアは残しておきます
  next();
};

/**
 * ユーザーロールチェック
 * ユーザーのロールと権限に基づいてAPIアクセスを制限します
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 * @param {Function} next - 次のミドルウェア関数
 */
exports.checkUserRole = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'AUTH_REQUIRED',
          message: '認証が必要です'
        }
      });
    }

    // ユーザー情報を取得
    const User = require('../models/user.model');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }

    const authConfig = require('../config/auth.config');
    // ロールに基づいたアクセス制御
    switch (user.role) {
      case authConfig.roles.ADMIN:
      case authConfig.roles.SUPER_ADMIN:
        // 管理者は常にアクセス許可
        break;
        
      case authConfig.roles.USER:
        // 通常ユーザーはアクセス許可
        break;
        
      case authConfig.roles.UNPAID:
        // 未払いユーザーはAPIアクセス拒否
        return res.status(403).json({
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'お支払いが必要です。APIアクセスは制限されています。'
          }
        });
        
      case authConfig.roles.INACTIVE:
        // 退会済みユーザーはアクセス拒否
        return res.status(403).json({
          error: {
            code: 'SUBSCRIPTION_REQUIRED',
            message: 'アカウントが無効化されています。再度ご登録ください。'
          }
        });
        
      default:
        // その他の不明なロールはアクセス拒否
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'このAPIを利用する権限がありません'
          }
        });
    }

    next();
  } catch (error) {
    console.error('ロールチェック中のエラー:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ロールチェック中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * トークン使用量予測関数は廃止されました
 */
exports.estimateTokenUsage = (req) => {
  // 廃止された機能
  return {
    estimatedInputTokens: 0,
    model: null
  };
};