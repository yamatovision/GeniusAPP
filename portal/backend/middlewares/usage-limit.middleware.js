/**
 * 使用量制限ミドルウェア
 * APIリクエスト時にユーザーの使用量制限をチェックします
 */
const User = require('../models/user.model');
const ApiUsage = require('../models/apiUsage.model');
const authConfig = require('../config/auth.config');

/**
 * トークン使用量制限チェック
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 * @param {Function} next - 次のミドルウェア関数
 */
exports.checkTokenLimit = async (req, res, next) => {
  try {
    // ユーザーIDを取得（認証ミドルウェアで設定済み）
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
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }

    // APIアクセス有効かどうかチェック
    if (user.apiAccess && user.apiAccess.enabled === false) {
      return res.status(403).json({
        error: {
          code: 'API_ACCESS_DISABLED',
          message: 'APIアクセスが無効化されています'
        }
      });
    }

    // 現在の日時を取得
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // プラン情報が存在しない場合のデフォルト値
    if (!user.plan) {
      user.plan = {
        type: 'basic',
        tokenLimit: 100000,
        lastResetDate: today,
        nextResetDate: new Date(today.getFullYear(), today.getMonth() + 1, 1)
      };
      await user.save();
    }

    // 日次使用量を取得
    const dailyUsage = await ApiUsage.getDailyUsage(userId, today);
    
    // 月次使用量を取得
    const monthlyUsage = await ApiUsage.getMonthlyUsage(userId, now.getFullYear(), now.getMonth() + 1);

    // 日次制限をチェック（設定されている場合）
    if (user.usageLimits && user.usageLimits.tokensPerDay) {
      if (dailyUsage.totalTokens >= user.usageLimits.tokensPerDay) {
        return res.status(429).json({
          error: {
            code: 'DAILY_LIMIT_EXCEEDED',
            message: '日次トークン使用量の上限に達しました',
            details: {
              limit: user.usageLimits.tokensPerDay,
              used: dailyUsage.totalTokens,
              resetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
            }
          }
        });
      }
    }

    // 月次制限をチェック（実際のプラン制限またはtokensPerMonthのいずれか小さい方）
    const monthlyLimit = user.usageLimits && user.usageLimits.tokensPerMonth
      ? Math.min(user.plan.tokenLimit, user.usageLimits.tokensPerMonth)
      : user.plan.tokenLimit;

    if (monthlyUsage.totalTokens >= monthlyLimit) {
      return res.status(429).json({
        error: {
          code: 'MONTHLY_LIMIT_EXCEEDED',
          message: '月次トークン使用量の上限に達しました',
          details: {
            limit: monthlyLimit,
            used: monthlyUsage.totalTokens,
            resetAt: user.plan.nextResetDate.toISOString()
          }
        }
      });
    }

    // リクエストに使用量情報を付加（次のミドルウェアやコントローラで使用可能）
    req.usageInfo = {
      dailyUsage,
      monthlyUsage,
      limits: {
        daily: user.usageLimits?.tokensPerDay || null,
        monthly: monthlyLimit
      },
      plan: user.plan
    };

    // 進行を許可
    next();
  } catch (error) {
    console.error('使用量制限チェック中のエラー:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '使用量制限チェック中にエラーが発生しました',
        details: error.message
      }
    });
  }
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }

    // ロールに基づいたアクセス制御
    switch (user.role) {
      case authConfig.roles.ADMIN:
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
 * リクエストからトークン使用量を予測
 * @param {Object} req - リクエストオブジェクト
 * @returns {Object} 予測トークン使用量
 */
exports.estimateTokenUsage = (req) => {
  try {
    let inputTokens = 0;
    let model = null;

    // リクエストタイプに基づいて処理
    if (req.path.includes('/chat')) {
      // Chat APIの場合
      const { messages, model: requestModel } = req.body;
      model = requestModel;

      // 簡易的なトークン数推定（実際にはもっと複雑）
      if (Array.isArray(messages)) {
        inputTokens = messages.reduce((total, msg) => {
          return total + (msg.content?.length / 4 || 0);
        }, 0);
      }
    } else if (req.path.includes('/completions')) {
      // Completions APIの場合
      const { prompt, model: requestModel } = req.body;
      model = requestModel;

      // 簡易的なトークン数推定
      if (typeof prompt === 'string') {
        inputTokens = prompt.length / 4;
      }
    }

    // 切り上げて整数に
    inputTokens = Math.ceil(inputTokens);

    return {
      estimatedInputTokens: inputTokens,
      model
    };
  } catch (error) {
    console.error('トークン使用量予測エラー:', error);
    return {
      estimatedInputTokens: 0,
      model: null
    };
  }
};