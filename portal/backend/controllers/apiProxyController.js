/**
 * APIプロキシコントローラー
 * Claude API呼び出しのプロキシと使用量管理のためのコントローラー
 */
const anthropicProxyService = require('../services/anthropicProxyService');
const apiUsageService = require('../services/apiUsageService');
const User = require('../models/user.model');

/**
 * Claude Chat APIをプロキシ
 * @route POST /api/proxy/claude/chat
 */
exports.proxyClaudeChat = async (req, res) => {
  try {
    // ユーザーID（認証ミドルウェアで設定済み）
    const userId = req.userId;
    
    // リクエスト本体
    const requestData = req.body;
    
    // プロジェクトID（オプション）
    const projectId = req.query.projectId || null;
    
    // プロキシオプション
    const proxyOptions = {
      projectId,
      headers: {
        'X-Client-IP': req.ip,
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
        'User-Agent': req.headers['user-agent']
      },
      includeHeaders: false, // 機密情報保護のために制限
      metadata: {
        source: 'vscode-extension',
        clientVersion: req.headers['x-client-version'],
        userAgent: req.headers['user-agent']
      }
    };
    
    // APIリクエストを転送
    const response = await anthropicProxyService.proxyClaudeChat(userId, requestData, proxyOptions);
    
    // 成功レスポンス
    return res.status(200).json(response);
  } catch (error) {
    // エラー処理
    console.error('Chat APIプロキシエラー:', error);
    
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || '予期しないエラーが発生しました';
    
    return res.status(statusCode).json({
      error: {
        code: statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'API_ERROR',
        message: errorMessage,
        details: error.error
      }
    });
  }
};

/**
 * Claude Completions APIをプロキシ
 * @route POST /api/proxy/claude/completions
 */
exports.proxyClaudeCompletions = async (req, res) => {
  try {
    // ユーザーID（認証ミドルウェアで設定済み）
    const userId = req.userId;
    
    // リクエスト本体
    const requestData = req.body;
    
    // プロジェクトID（オプション）
    const projectId = req.query.projectId || null;
    
    // プロキシオプション
    const proxyOptions = {
      projectId,
      headers: {
        'X-Client-IP': req.ip,
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
        'User-Agent': req.headers['user-agent']
      },
      includeHeaders: false, // 機密情報保護のために制限
      metadata: {
        source: 'vscode-extension',
        clientVersion: req.headers['x-client-version'],
        userAgent: req.headers['user-agent']
      }
    };
    
    // APIリクエストを転送
    const response = await anthropicProxyService.proxyClaudeCompletions(userId, requestData, proxyOptions);
    
    // 成功レスポンス
    return res.status(200).json(response);
  } catch (error) {
    // エラー処理
    console.error('Completions APIプロキシエラー:', error);
    
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || '予期しないエラーが発生しました';
    
    return res.status(statusCode).json({
      error: {
        code: statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'API_ERROR',
        message: errorMessage,
        details: error.error
      }
    });
  }
};

/**
 * 現在の使用量情報を取得
 * @route GET /api/usage/me
 */
exports.getCurrentUsage = async (req, res) => {
  try {
    // ユーザーID（認証ミドルウェアで設定済み）
    const userId = req.userId;
    
    // 使用量情報を取得
    const usageInfo = await apiUsageService.getCurrentUsage(userId);
    
    // 成功レスポンス
    return res.status(200).json(usageInfo);
  } catch (error) {
    // エラー処理
    console.error('使用量取得エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '使用量情報の取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * 使用制限情報を取得
 * @route GET /api/usage/limits
 */
exports.getUsageLimits = async (req, res) => {
  try {
    // ユーザーID（認証ミドルウェアで設定済み）
    const userId = req.userId;
    
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
    
    // プラン情報を構築
    const planInfo = user.plan || {
      type: 'basic',
      tokenLimit: 100000,
      lastResetDate: new Date(),
      nextResetDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
    };
    
    // 使用制限情報を構築
    const limitsInfo = {
      plan: planInfo.type,
      tokenLimit: planInfo.tokenLimit,
      daily: user.usageLimits?.tokensPerDay || null,
      monthly: user.usageLimits?.tokensPerMonth || planInfo.tokenLimit,
      nextResetDate: planInfo.nextResetDate,
      apiAccess: user.apiAccess?.enabled !== false, // デフォルトはtrue
      accessLevel: user.apiAccess?.accessLevel || 'basic'
    };
    
    // 成功レスポンス
    return res.status(200).json(limitsInfo);
  } catch (error) {
    // エラー処理
    console.error('使用制限取得エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '使用制限情報の取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * 使用履歴を取得
 * @route GET /api/usage/history
 */
exports.getUsageHistory = async (req, res) => {
  try {
    // ユーザーID（認証ミドルウェアで設定済み）
    const userId = req.userId;
    
    // クエリパラメータを取得
    const {
      start, // 開始日時（ISO形式）
      end,   // 終了日時（ISO形式）
      limit = 100,  // 上限数
      page = 1,     // ページ番号
      sort = 'desc', // ソート順
      apiType       // API種別フィルター
    } = req.query;
    
    // 使用履歴を取得
    const usageHistory = await apiUsageService.getUsageHistory(userId, {
      start,
      end,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10),
      sort,
      apiType
    });
    
    // 成功レスポンス
    return res.status(200).json(usageHistory);
  } catch (error) {
    // エラー処理
    console.error('使用履歴取得エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '使用履歴の取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * 特定ユーザーの使用量を取得（管理者用）
 * @route GET /api/admin/usage/:userId
 */
exports.getUserUsage = async (req, res) => {
  try {
    // 対象ユーザーID
    const targetUserId = req.params.userId;
    
    // ユーザーが存在するか確認
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    // 使用量情報を取得
    const usageInfo = await apiUsageService.getCurrentUsage(targetUserId);
    
    // 成功レスポンス
    return res.status(200).json(usageInfo);
  } catch (error) {
    // エラー処理
    console.error('ユーザー使用量取得エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー使用量情報の取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * ユーザーの使用制限を更新（管理者用）
 * @route PUT /api/admin/limits/:userId
 */
exports.updateUserLimits = async (req, res) => {
  try {
    // 対象ユーザーID
    const targetUserId = req.params.userId;
    
    // 更新データ
    const updateData = req.body;
    
    // 更新を実行
    const result = await apiUsageService.updateUserLimits(targetUserId, updateData);
    
    // 成功レスポンス
    return res.status(200).json(result);
  } catch (error) {
    // エラー処理
    console.error('使用制限更新エラー:', error);
    
    if (error.message === 'ユーザーが見つかりません') {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '使用制限の更新中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * API状態を取得
 * @route GET /api/status
 */
exports.getApiStatus = async (req, res) => {
  try {
    // 環境変数から情報を取得
    const apiVersion = process.env.npm_package_version || '1.0.0';
    const apiMode = process.env.NODE_ENV || 'development';
    
    // Anthropic API設定の検証
    const apiConfigValid = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0;
    
    return res.status(200).json({
      status: 'available',
      version: apiVersion,
      mode: apiMode,
      features: {
        chat: apiConfigValid,
        completions: apiConfigValid,
        monitoring: true,
        usageTracking: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // エラー処理
    console.error('API状態取得エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'API状態の取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * トークン使用量を記録
 * @route POST /api/proxy/usage/record
 * @route POST /api/proxy/usage/me/record
 * @route POST /api/proxy/claude/usage
 */
exports.recordTokenUsage = async (req, res) => {
  try {
    // ユーザーID（認証ミドルウェアで設定済み）
    const userId = req.userId;
    
    // リクエスト本体からトークン情報を取得
    const { tokenCount, modelId, context } = req.body;
    
    // 入力検証
    if (tokenCount === undefined || modelId === undefined) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'tokenCountとmodelIdは必須です'
        }
      });
    }
    
    // API使用量を記録
    await apiUsageService.recordUsage(userId, {
      apiType: 'completions',
      endpoint: 'token-usage',
      inputTokens: 0,           // トークン記録自体は入力なし
      outputTokens: 0,          // トークン記録自体は出力なし
      totalTokens: tokenCount,  // 記録対象の総トークン数
      success: true,
      metadata: {
        modelId,
        context: context || 'vscode-extension',
        recordedAt: new Date().toISOString(),
        source: req.headers['user-agent'] || 'unknown'
      }
    });
    
    // 成功レスポンス
    return res.status(200).json({
      success: true,
      message: 'トークン使用量が正常に記録されました',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // エラー処理
    console.error('トークン使用量記録エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'トークン使用量の記録中にエラーが発生しました',
        details: error.message
      }
    });
  }
};