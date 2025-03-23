/**
 * API使用量サービス
 * API使用量の記録、集計、制限などの機能を提供します
 */
const User = require('../models/user.model');
const ApiUsage = require('../models/apiUsage.model');
const authConfig = require('../config/auth.config');

/**
 * API使用を記録
 * @param {String} userId - ユーザーID
 * @param {Object} usageData - 使用量データ
 * @returns {Promise<Object>} 記録結果
 */
exports.recordUsage = async (userId, usageData) => {
  try {
    const {
      apiType,
      endpoint,
      inputTokens,
      outputTokens,
      success,
      errorCode,
      errorMessage,
      requestData,
      projectId,
      metadata
    } = usageData;
    
    // 必須フィールドチェック
    if (!userId || !apiType || !endpoint) {
      throw new Error('必須パラメータが不足しています');
    }
    
    // 総トークン数の計算
    const totalTokens = (inputTokens || 0) + (outputTokens || 0);
    
    // リクエスト情報の抽出と整形（機密情報の除去）
    let requestInfo = {};
    if (requestData) {
      // モデル情報の抽出
      if (requestData.model) {
        requestInfo.model = requestData.model;
      }
      
      // プロンプトのプレビュー抽出（最初の50文字のみ）
      if (requestData.messages && Array.isArray(requestData.messages)) {
        const firstUserMessage = requestData.messages.find(m => m.role === 'user');
        if (firstUserMessage && firstUserMessage.content) {
          requestInfo.promptPreview = firstUserMessage.content.substring(0, 50);
        }
      } else if (requestData.prompt) {
        requestInfo.promptPreview = requestData.prompt.substring(0, 50);
      }
      
      // ヘッダー情報からAPI鍵など機密情報を除去
      if (requestData.headers) {
        // セーフなヘッダーのみをコピー
        const safeHeaders = {};
        const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
        
        Object.keys(requestData.headers).forEach(key => {
          if (!sensitiveHeaders.includes(key.toLowerCase())) {
            safeHeaders[key] = requestData.headers[key];
          }
        });
        
        requestInfo.headers = safeHeaders;
      }
    }
    
    // 使用量レコードの作成
    const apiUsage = new ApiUsage({
      userId,
      projectId,
      timestamp: new Date(),
      apiType,
      endpoint,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      totalTokens,
      success: success !== false, // デフォルトはtrue
      errorCode,
      errorMessage,
      request: requestInfo,
      metadata
    });
    
    // DBに保存
    await apiUsage.save();
    
    return apiUsage;
  } catch (error) {
    console.error('API使用量記録エラー:', error);
    throw error;
  }
};

/**
 * ユーザーの現在の使用量を取得
 * @param {String} userId - ユーザーID
 * @returns {Promise<Object>} 使用量情報
 */
exports.getCurrentUsage = async (userId) => {
  try {
    // ユーザー情報の取得
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // 現在の日時
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 日次使用量
    const dailyUsage = await ApiUsage.getDailyUsage(userId, today);
    
    // 月次使用量
    const monthlyUsage = await ApiUsage.getMonthlyUsage(userId, now.getFullYear(), now.getMonth() + 1);
    
    // 使用制限情報
    let limits = {
      daily: user.usageLimits?.tokensPerDay || null,
      monthly: user.usageLimits?.tokensPerMonth || 100000
    };
    
    // 次回リセット日は毎月始め
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: 'basic'
      },
      usage: {
        daily: {
          totalTokens: dailyUsage.totalTokens,
          inputTokens: dailyUsage.totalInputTokens,
          outputTokens: dailyUsage.totalOutputTokens,
          requestCount: dailyUsage.requestCount
        },
        monthly: {
          totalTokens: monthlyUsage.totalTokens,
          inputTokens: monthlyUsage.totalInputTokens,
          outputTokens: monthlyUsage.totalOutputTokens,
          requestCount: monthlyUsage.requestCount
        }
      },
      limits,
      resetDate,
      remaining: {
        daily: limits.daily ? limits.daily - dailyUsage.totalTokens : null,
        monthly: limits.monthly - monthlyUsage.totalTokens
      }
    };
  } catch (error) {
    console.error('使用量取得エラー:', error);
    throw error;
  }
};

/**
 * ユーザーの使用履歴を取得
 * @param {String} userId - ユーザーID
 * @param {Object} options - 取得オプション
 * @returns {Promise<Array>} 使用履歴
 */
exports.getUsageHistory = async (userId, options = {}) => {
  try {
    const {
      start,
      end,
      limit = 100,
      page = 1,
      sort = 'desc',
      apiType
    } = options;
    
    // クエリ条件の構築
    const query = { userId };
    
    // 日付範囲フィルター
    if (start || end) {
      query.timestamp = {};
      if (start) query.timestamp.$gte = new Date(start);
      if (end) query.timestamp.$lte = new Date(end);
    }
    
    // API種別フィルター
    if (apiType) {
      query.apiType = apiType;
    }
    
    // ソート順
    const sortOrder = sort === 'asc' ? 1 : -1;
    
    // データ取得
    const skip = (page - 1) * limit;
    const history = await ApiUsage.find(query)
      .sort({ timestamp: sortOrder })
      .skip(skip)
      .limit(limit);
    
    // 総件数取得
    const total = await ApiUsage.countDocuments(query);
    
    return {
      history,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('使用履歴取得エラー:', error);
    throw error;
  }
};

/**
 * ユーザーの使用制限を更新
 * @param {String} userId - ユーザーID
 * @param {Object} limits - 更新する制限値
 * @returns {Promise<Object>} 更新結果
 */
exports.updateUserLimits = async (userId, limits) => {
  try {
    // ユーザー情報の取得
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // トークン使用量制限の設定
    if (limits.tokenLimit) {
      if (!user.usageLimits) {
        user.usageLimits = {};
      }
      user.usageLimits.tokensPerMonth = limits.tokenLimit;
    }
    
    // 日次・月次の使用量制限
    if (!user.usageLimits) {
      user.usageLimits = {};
    }
    
    if (limits.tokensPerDay !== undefined) {
      user.usageLimits.tokensPerDay = limits.tokensPerDay;
    }
    
    if (limits.tokensPerMonth !== undefined) {
      user.usageLimits.tokensPerMonth = limits.tokensPerMonth;
    }
    
    // APIアクセス設定
    if (!user.apiAccess) {
      user.apiAccess = { enabled: true };
    }
    
    if (limits.apiAccess !== undefined) {
      user.apiAccess.enabled = limits.apiAccess;
    }
    
    if (limits.accessLevel) {
      user.apiAccess.accessLevel = limits.accessLevel;
    }
    
    // 変更を保存
    await user.save();
    
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      usageLimits: user.usageLimits,
      apiAccess: user.apiAccess
    };
  } catch (error) {
    console.error('使用制限更新エラー:', error);
    throw error;
  }
};

/**
 * 全ユーザーの月次使用量をリセット
 * 毎月1日などに定期実行することを想定
 * @returns {Promise<Object>} リセット結果
 */
exports.resetMonthlyUsage = async () => {
  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // 使用量統計をリセットする処理があればここに実装
    
    return {
      message: "毎月の使用量は自動的にリセットされます",
      resetDate: now,
      nextResetDate: nextMonth
    };
  } catch (error) {
    console.error('月次使用量リセットエラー:', error);
    throw error;
  }
};