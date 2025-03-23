/**
 * APIプロキシコントローラー
 * Claude API呼び出しのプロキシと使用量管理のためのコントローラー
 * 組織/ワークスペース単位での呼び出しとトークン使用量記録をサポート
 */
const anthropicProxyService = require('../services/anthropicProxyService');
const apiUsageService = require('../services/apiUsageService');
const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const Workspace = require('../models/workspace.model');
const ApiUsage = require('../models/apiUsage.model');
const logger = require('../utils/logger');

/**
 * ユーザーの組織とワークスペース情報をリクエストから取得
 * @param {Request} req - リクエストオブジェクト
 * @returns {Object} 組織とワークスペースID
 */
async function getRequestContext(req) {
  // リクエストに明示的に指定されている場合はそれを使用
  const organizationId = req.query.organizationId || req.headers['x-organization-id'] || null;
  const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'] || null;
  
  return { organizationId, workspaceId };
}

/**
 * 使用量制限チェック
 * @param {string} userId - ユーザーID
 * @param {string} organizationId - 組織ID (オプション)
 * @param {string} workspaceId - ワークスペースID (オプション)
 * @returns {Promise<Object>} 制限情報
 */
async function checkUsageLimits(userId, organizationId, workspaceId) {
  try {
    // ユーザーの使用制限チェック
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // APIが無効化されている場合
    if (user.apiAccess?.enabled === false) {
      throw {
        statusCode: 403,
        message: 'このアカウントではAPIアクセスが無効になっています'
      };
    }
    
    // 組織制限チェック
    if (organizationId) {
      const organization = await Organization.findById(organizationId);
      if (organization) {
        // 組織の状態チェック
        if (organization.status !== 'active') {
          throw {
            statusCode: 403,
            message: `組織「${organization.name}」は現在「${organization.status}」状態のためAPIアクセスができません`
          };
        }
        
        // 予算超過チェック
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const usage = await apiUsageService.getOrganizationTokenUsage(organizationId, {
          start: startOfMonth,
          end: now
        });
        
        if (organization.monthlyBudget > 0 && usage.totalTokens >= organization.monthlyBudget) {
          throw {
            statusCode: 429,
            message: `組織「${organization.name}」の月間予算（${organization.monthlyBudget}トークン）を超過しています`
          };
        }
      }
    }
    
    // ワークスペース制限チェック
    if (workspaceId) {
      const workspace = await Workspace.findById(workspaceId);
      if (workspace) {
        // ワークスペースがアーカイブされている場合
        if (workspace.isArchived) {
          throw {
            statusCode: 403,
            message: `ワークスペース「${workspace.name}」はアーカイブされているためAPIアクセスができません`
          };
        }
        
        // 月間予算超過チェック
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthUsage = await apiUsageService.getWorkspaceTokenUsage(workspaceId, {
          start: startOfMonth,
          end: now
        });
        
        if (workspace.monthlyBudget > 0 && monthUsage.totalTokens >= workspace.monthlyBudget) {
          throw {
            statusCode: 429,
            message: `ワークスペース「${workspace.name}」の月間予算（${workspace.monthlyBudget}トークン）を超過しています`
          };
        }
        
        // 日次予算超過チェック
        if (workspace.dailyBudget) {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dayUsage = await apiUsageService.getWorkspaceTokenUsage(workspaceId, {
            start: startOfDay,
            end: now
          });
          
          if (dayUsage.totalTokens >= workspace.dailyBudget) {
            throw {
              statusCode: 429,
              message: `ワークスペース「${workspace.name}」の日次予算（${workspace.dailyBudget}トークン）を超過しています`
            };
          }
        }
      }
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('使用量制限チェックエラー:', error);
    if (error.statusCode) {
      throw error;
    }
    throw {
      statusCode: 500,
      message: `使用量制限チェック中にエラーが発生しました: ${error.message}`
    };
  }
}

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
    
    // 組織・ワークスペース情報の取得
    const { organizationId, workspaceId } = await getRequestContext(req);
    
    // 使用制限チェック
    await checkUsageLimits(userId, organizationId, workspaceId);
    
    // プロキシオプション
    const proxyOptions = {
      projectId,
      organizationId,
      workspaceId,
      startTime: Date.now(),
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
    logger.error('Chat APIプロキシエラー:', error);
    
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
    
    // 組織・ワークスペース情報の取得
    const { organizationId, workspaceId } = await getRequestContext(req);
    
    // 使用制限チェック
    await checkUsageLimits(userId, organizationId, workspaceId);
    
    // プロキシオプション
    const proxyOptions = {
      projectId,
      organizationId,
      workspaceId,
      startTime: Date.now(),
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
    logger.error('Completions APIプロキシエラー:', error);
    
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
    
    // 組織・ワークスペース情報の取得
    const { organizationId, workspaceId } = await getRequestContext(req);
    
    // 使用量情報を取得
    const usageInfo = await apiUsageService.getCurrentUsage(userId);
    
    // 組織情報が指定されていれば組織の使用量も取得
    if (organizationId) {
      try {
        const organization = await Organization.findById(organizationId);
        if (organization) {
          // 今月の使用量を取得
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const orgUsage = await ApiUsage.getOrganizationTokenUsage(organizationId, {
            start: startOfMonth,
            end: now
          });
          
          // 予算使用率を計算
          const budgetUsage = organization.monthlyBudget > 0 ? 
            (orgUsage.totalTokens / organization.monthlyBudget) * 100 : 0;
          
          // 組織情報を追加
          usageInfo.organization = {
            id: organization._id,
            name: organization.name,
            usage: {
              totalTokens: orgUsage.totalTokens,
              inputTokens: orgUsage.inputTokens,
              outputTokens: orgUsage.outputTokens,
              budget: organization.monthlyBudget,
              budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
            }
          };
        }
      } catch (error) {
        logger.warn('組織使用量取得エラー:', error);
        // エラーがあっても続行
      }
    }
    
    // ワークスペース情報が指定されていればワークスペースの使用量も取得
    if (workspaceId) {
      try {
        const workspace = await Workspace.findById(workspaceId);
        if (workspace) {
          // 今月の使用量を取得
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const wsUsage = await ApiUsage.getWorkspaceTokenUsage(workspaceId, {
            start: startOfMonth,
            end: now
          });
          
          // 予算使用率を計算
          const budgetUsage = workspace.monthlyBudget > 0 ? 
            (wsUsage.totalTokens / workspace.monthlyBudget) * 100 : 0;
          
          // ワークスペース情報を追加
          usageInfo.workspace = {
            id: workspace._id,
            name: workspace.name,
            usage: {
              totalTokens: wsUsage.totalTokens,
              inputTokens: wsUsage.inputTokens,
              outputTokens: wsUsage.outputTokens,
              budget: workspace.monthlyBudget,
              budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
            }
          };
        }
      } catch (error) {
        logger.warn('ワークスペース使用量取得エラー:', error);
        // エラーがあっても続行
      }
    }
    
    // 成功レスポンス
    return res.status(200).json(usageInfo);
  } catch (error) {
    // エラー処理
    logger.error('使用量取得エラー:', error);
    
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
    
    // 組織・ワークスペース情報の取得
    const { organizationId, workspaceId } = await getRequestContext(req);
    
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
    
    // 制限情報を構築
    const defaultLimits = {
      type: 'basic',
      tokenLimit: 100000
    };
    
    // 使用制限情報を構築
    const limitsInfo = {
      plan: defaultLimits.type,
      tokenLimit: defaultLimits.tokenLimit,
      daily: user.usageLimits?.tokensPerDay || null,
      monthly: user.usageLimits?.tokensPerMonth || defaultLimits.tokenLimit,
      nextResetDate: null,
      apiAccess: user.apiAccess?.enabled !== false, // デフォルトはtrue
      accessLevel: user.apiAccess?.accessLevel || 'basic'
    };
    
    // 組織の制限情報を追加
    if (organizationId) {
      try {
        const organization = await Organization.findById(organizationId);
        if (organization) {
          // 組織情報を追加
          limitsInfo.organization = {
            id: organization._id,
            name: organization.name,
            budget: {
              monthly: organization.monthlyBudget,
              resetDay: organization.resetDay || 1
            },
            status: organization.status
          };
          
          // 組織のAPIアクセス情報を追加（優先度は組織>ユーザー）
          if (organization.status !== 'active') {
            limitsInfo.apiAccess = false;
          }
        }
      } catch (error) {
        logger.warn('組織制限情報取得エラー:', error);
        // エラーがあっても続行
      }
    }
    
    // ワークスペースの制限情報を追加
    if (workspaceId) {
      try {
        const workspace = await Workspace.findById(workspaceId);
        if (workspace) {
          // ワークスペース情報を追加
          limitsInfo.workspace = {
            id: workspace._id,
            name: workspace.name,
            budget: {
              monthly: workspace.monthlyBudget,
              daily: workspace.dailyBudget
            },
            isArchived: workspace.isArchived
          };
          
          // ワークスペースがアーカイブされている場合はAPIアクセスを無効化
          if (workspace.isArchived) {
            limitsInfo.apiAccess = false;
          }
        }
      } catch (error) {
        logger.warn('ワークスペース制限情報取得エラー:', error);
        // エラーがあっても続行
      }
    }
    
    // 成功レスポンス
    return res.status(200).json(limitsInfo);
  } catch (error) {
    // エラー処理
    logger.error('使用制限取得エラー:', error);
    
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
    
    // 組織・ワークスペース情報の取得
    const { organizationId, workspaceId } = await getRequestContext(req);
    
    // クエリパラメータを取得
    const {
      start, // 開始日時（ISO形式）
      end,   // 終了日時（ISO形式）
      limit = 100,  // 上限数
      page = 1,     // ページ番号
      sort = 'desc', // ソート順
      apiType,      // API種別フィルター
      scope = 'user' // スコープ（user/organization/workspace）
    } = req.query;
    
    // スコープによって適切な履歴を取得
    let usageHistory;
    
    if (scope === 'organization' && organizationId) {
      // 組織の権限チェック
      const organization = await Organization.findById(organizationId);
      if (!organization || !organization.isMember(userId)) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'この組織の使用履歴を閲覧する権限がありません'
          }
        });
      }
      
      // 組織の使用履歴を取得
      const query = {
        organizationId,
        timestamp: {}
      };
      
      if (start) query.timestamp.$gte = new Date(start);
      if (end) query.timestamp.$lte = new Date(end);
      if (apiType) query.apiType = apiType;
      
      const sortOptions = { timestamp: sort === 'asc' ? 1 : -1 };
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      
      const history = await ApiUsage.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('userId', 'name email');
      
      const total = await ApiUsage.countDocuments(query);
      
      usageHistory = {
        history,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10))
        }
      };
    } else if (scope === 'workspace' && workspaceId) {
      // ワークスペースの権限チェック
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || !workspace.isMember(userId)) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'このワークスペースの使用履歴を閲覧する権限がありません'
          }
        });
      }
      
      // ワークスペースの使用履歴を取得
      const query = {
        workspaceId,
        timestamp: {}
      };
      
      if (start) query.timestamp.$gte = new Date(start);
      if (end) query.timestamp.$lte = new Date(end);
      if (apiType) query.apiType = apiType;
      
      const sortOptions = { timestamp: sort === 'asc' ? 1 : -1 };
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      
      const history = await ApiUsage.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('userId', 'name email');
      
      const total = await ApiUsage.countDocuments(query);
      
      usageHistory = {
        history,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10))
        }
      };
    } else {
      // ユーザー自身の使用履歴を取得（デフォルト）
      usageHistory = await apiUsageService.getUsageHistory(userId, {
        start,
        end,
        limit: parseInt(limit, 10),
        page: parseInt(page, 10),
        sort,
        apiType,
        organizationId, // オプショナルなフィルター
        workspaceId     // オプショナルなフィルター
      });
    }
    
    // 成功レスポンス
    return res.status(200).json(usageHistory);
  } catch (error) {
    // エラー処理
    logger.error('使用履歴取得エラー:', error);
    
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
    const { tokenCount, modelId, context, organizationId, workspaceId, projectId } = req.body;
    
    // 入力検証
    if (tokenCount === undefined || modelId === undefined) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'tokenCountとmodelIdは必須です'
        }
      });
    }
    
    // リクエストヘッダーから追加情報を取得
    const headerOrgId = req.headers['x-organization-id'];
    const headerWsId = req.headers['x-workspace-id'];
    const headerProjectId = req.headers['x-project-id'];
    
    // 優先順位: リクエストボディ > ヘッダー > クエリパラメータ
    const orgId = organizationId || headerOrgId || req.query.organizationId || null;
    const wsId = workspaceId || headerWsId || req.query.workspaceId || null;
    const pjId = projectId || headerProjectId || req.query.projectId || null;
    
    // API使用量を記録
    await apiUsageService.recordUsage(userId, {
      apiType: 'completions',
      endpoint: 'token-usage',
      inputTokens: 0,           // トークン記録自体は入力なし
      outputTokens: 0,          // トークン記録自体は出力なし
      totalTokens: tokenCount,  // 記録対象の総トークン数
      success: true,
      organizationId: orgId,
      workspaceId: wsId,
      projectId: pjId,
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
    logger.error('トークン使用量記録エラー:', error);
    
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'トークン使用量の記録中にエラーが発生しました',
        details: error.message
      }
    });
  }
};