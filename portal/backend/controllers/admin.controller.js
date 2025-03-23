/**
 * 管理者コントローラー
 * 管理者向けの機能を提供（組織、ワークスペース、APIキーなどの高度な管理）
 */
const Organization = require('../models/organization.model');
const Workspace = require('../models/workspace.model');
const User = require('../models/user.model');
const ApiUsage = require('../models/apiUsage.model');
const anthropicAdminService = require('../services/anthropicAdminService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const authConfig = require('../config/auth.config');

/**
 * 管理者権限をチェックするヘルパー関数
 * @param {string} userRole - ユーザーロール
 * @returns {boolean} 管理者権限があるかどうか
 */
const checkAdminPermission = (userRole) => {
  return userRole === authConfig.roles.ADMIN || userRole === authConfig.roles.SUPER_ADMIN;
};

/**
 * 全ての組織を取得（管理者のみ）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getAllOrganizations = async (req, res) => {
  try {
    // 管理者権限チェック
    if (!checkAdminPermission(req.userRole)) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    
    // アーカイブフラグによるフィルタリング
    const includeArchived = req.query.includeArchived === 'true';
    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    
    // 組織一覧を取得
    const organizations = await Organization.find(query)
      .select({ adminApiKey: 0 }) // 機密情報は除外
      .populate('adminId', 'username email')
      .populate('members.userId', 'username email');
    
    // 簡易統計情報を追加
    const organizationsWithStats = await Promise.all(organizations.map(async (org) => {
      const orgObj = org.toObject();
      
      // ワークスペース数を取得
      const workspaceCount = await Workspace.countDocuments({
        organizationId: org._id,
        isArchived: { $ne: true }
      });
      
      // メンバー数を取得
      const memberCount = org.members.length;
      
      // 今月の使用量を取得
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const usage = await ApiUsage.getOrganizationTokenUsage(org._id, {
        start: startOfMonth,
        end: now
      });
      
      // 予算使用率を計算
      const budgetUsage = org.monthlyBudget > 0 ? 
        (usage.totalTokens / org.monthlyBudget) * 100 : 0;
      
      return {
        ...orgObj,
        stats: {
          workspaceCount,
          memberCount,
          usage: {
            totalTokens: usage.totalTokens,
            budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
          }
        }
      };
    }));
    
    return res.status(200).json(organizationsWithStats);
  } catch (error) {
    logger.error('全組織取得エラー:', error);
    return res.status(500).json({ error: '組織情報の取得に失敗しました' });
  }
};

/**
 * 全てのワークスペースを取得（管理者のみ）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getAllWorkspaces = async (req, res) => {
  try {
    // 管理者権限チェック
    if (!checkAdminPermission(req.userRole)) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    
    // アーカイブフラグによるフィルタリング
    const includeArchived = req.query.includeArchived === 'true';
    const query = {};
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    
    // 組織IDによるフィルタリング
    if (req.query.organizationId) {
      query.organizationId = req.query.organizationId;
    }
    
    // ワークスペース一覧を取得
    const workspaces = await Workspace.find(query)
      .populate('organizationId', 'name')
      .populate('members.userId', 'username email');
    
    // 簡易統計情報を追加
    const workspacesWithStats = await Promise.all(workspaces.map(async (workspace) => {
      const wsObj = workspace.toObject();
      
      // メンバー数を取得
      const memberCount = workspace.members.length;
      
      // 今月の使用量を取得
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const usage = await ApiUsage.getWorkspaceTokenUsage(workspace._id, {
        start: startOfMonth,
        end: now
      });
      
      // 予算使用率を計算
      const budgetUsage = workspace.monthlyBudget > 0 ? 
        (usage.totalTokens / workspace.monthlyBudget) * 100 : 0;
      
      return {
        ...wsObj,
        stats: {
          memberCount,
          usage: {
            totalTokens: usage.totalTokens,
            budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
          }
        }
      };
    }));
    
    return res.status(200).json(workspacesWithStats);
  } catch (error) {
    logger.error('全ワークスペース取得エラー:', error);
    return res.status(500).json({ error: 'ワークスペース情報の取得に失敗しました' });
  }
};

/**
 * 全ての使用状況を取得（管理者のみ）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getAllUsageStats = async (req, res) => {
  try {
    // 管理者権限チェック
    if (!checkAdminPermission(req.userRole)) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    
    // 期間の設定
    const { period = 'month', startDate, endDate } = req.query;
    const now = new Date();
    const timeRange = {};
    
    if (startDate) {
      timeRange.start = new Date(startDate);
    } else {
      // デフォルトの期間設定
      switch (period) {
        case 'day':
          timeRange.start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          timeRange.start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
          break;
        case 'month':
        default:
          timeRange.start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }
    
    if (endDate) {
      timeRange.end = new Date(endDate);
    } else {
      timeRange.end = now;
    }
    
    // 全体の使用量を取得
    const totalUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          requestCount: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalTokens: 1,
          inputTokens: 1,
          outputTokens: 1,
          requestCount: 1,
          successCount: 1,
          successRate: { 
            $cond: [
              { $eq: ['$requestCount', 0] },
              1,
              { $divide: ['$successCount', '$requestCount'] }
            ]
          }
        }
      }
    ]);
    
    // 組織別の使用量を取得
    const organizationUsage = await ApiUsage.aggregate([
      {
        $match: {
          organizationId: { $exists: true },
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: '$organizationId',
          totalTokens: { $sum: '$totalTokens' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          requestCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'organizations',
          localField: '_id',
          foreignField: '_id',
          as: 'organization'
        }
      },
      {
        $unwind: {
          path: '$organization',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          organizationId: '$_id',
          organizationName: '$organization.name',
          totalTokens: 1,
          inputTokens: 1,
          outputTokens: 1,
          requestCount: 1,
          budgetLimit: '$organization.monthlyBudget',
          budgetPercentage: { 
            $cond: [
              { $eq: ['$organization.monthlyBudget', 0] },
              0,
              { 
                $multiply: [
                  { $divide: ['$totalTokens', '$organization.monthlyBudget'] },
                  100
                ]
              }
            ]
          }
        }
      },
      {
        $sort: { totalTokens: -1 }
      }
    ]);
    
    // ユーザー別の使用量を取得
    const userUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalTokens: { $sum: '$totalTokens' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          requestCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          email: '$user.email',
          totalTokens: 1,
          inputTokens: 1,
          outputTokens: 1,
          requestCount: 1
        }
      },
      {
        $sort: { totalTokens: -1 }
      },
      {
        $limit: 100 // 上位100ユーザーのみ取得
      }
    ]);
    
    // 日別の使用量を取得
    const dailyUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          totalTokens: { $sum: '$totalTokens' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          requestCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    return res.status(200).json({
      period: {
        start: timeRange.start,
        end: timeRange.end
      },
      summary: totalUsage[0] || {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
        successCount: 0,
        successRate: 1
      },
      organizations: organizationUsage.map(org => ({
        id: org.organizationId,
        name: org.organizationName || 'Unknown Organization',
        totalTokens: org.totalTokens,
        inputTokens: org.inputTokens,
        outputTokens: org.outputTokens,
        requestCount: org.requestCount,
        budgetLimit: org.budgetLimit || 0,
        budgetPercentage: Math.min(Math.round(org.budgetPercentage * 10) / 10, 100)
      })),
      users: userUsage.map(user => ({
        id: user.userId,
        username: user.username || 'Unknown User',
        email: user.email,
        totalTokens: user.totalTokens,
        inputTokens: user.inputTokens,
        outputTokens: user.outputTokens,
        requestCount: user.requestCount
      })),
      daily: dailyUsage.map(day => ({
        date: day._id,
        totalTokens: day.totalTokens,
        inputTokens: day.inputTokens,
        outputTokens: day.outputTokens,
        requestCount: day.requestCount
      }))
    });
  } catch (error) {
    logger.error('全使用状況取得エラー:', error);
    return res.status(500).json({ error: '使用状況情報の取得に失敗しました' });
  }
};

/**
 * 全てのAPIキー情報を取得（管理者のみ）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getAllApiKeys = async (req, res) => {
  try {
    // 管理者権限チェック
    if (!checkAdminPermission(req.userRole)) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    
    // Admin APIキーを持つ組織を検索
    const organizations = await Organization.find({ 
      adminApiKey: { $exists: true, $ne: null }
    }).select('_id name adminApiKey');
    
    if (organizations.length === 0) {
      return res.status(200).json({
        message: 'Admin APIキーが設定された組織がありません',
        organizations: [],
        apiKeys: []
      });
    }
    
    // 環境変数から暗号化キーを取得
    const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      return res.status(500).json({ error: '暗号化キーが設定されていません' });
    }
    
    // 各組織からAPIキーを取得
    const apiKeysResults = [];
    
    for (const org of organizations) {
      try {
        // Admin APIキーを復号化
        const adminApiKey = anthropicAdminService.decryptAdminApiKey(org.adminApiKey, encryptionSecret);
        
        // Anthropicから直接APIキー一覧を取得
        const apiKeys = await anthropicAdminService.listApiKeys(adminApiKey);
        
        // ワークスペース情報を取得
        const workspaces = await Workspace.find({ 
          organizationId: org._id,
          anthropicWorkspaceId: { $exists: true, $ne: null }
        });
        
        const workspaceMap = {};
        workspaces.forEach(ws => {
          if (ws.anthropicWorkspaceId) {
            workspaceMap[ws.anthropicWorkspaceId] = {
              id: ws._id,
              name: ws.name
            };
          }
        });
        
        // 機密情報を除外して追加
        apiKeys.data.forEach(key => {
          apiKeysResults.push({
            id: key.id,
            name: key.name,
            status: key.status,
            created: key.created_at,
            workspaceId: key.workspace_id,
            workspace: key.workspace_id ? workspaceMap[key.workspace_id] : null,
            hint: key.partial_key_hint,
            organization: {
              id: org._id,
              name: org.name
            }
          });
        });
      } catch (error) {
        logger.error(`組織 ${org._id} (${org.name}) のAPIキー取得エラー:`, error);
        apiKeysResults.push({
          error: `組織 ${org.name} のAPIキー取得に失敗しました: ${error.message}`,
          organization: {
            id: org._id,
            name: org.name
          }
        });
      }
    }
    
    return res.status(200).json({
      organizations: organizations.map(org => ({
        id: org._id,
        name: org.name
      })),
      apiKeys: Array.isArray(apiKeysResults) ? apiKeysResults : []
    });
  } catch (error) {
    logger.error('全APIキー取得エラー:', error);
    return res.status(500).json({ error: 'APIキー情報の取得に失敗しました' });
  }
};

/**
 * APIキーの状態を更新（管理者のみ）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateApiKeyStatus = async (req, res) => {
  try {
    // 管理者権限チェック
    if (!checkAdminPermission(req.userRole)) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    
    const { organizationId, apiKeyId } = req.params;
    const { status, name } = req.body;
    
    if (!status && !name) {
      return res.status(400).json({ error: 'statusまたはnameは必須です' });
    }
    
    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: '無効なステータスです（active または inactive を指定してください）' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // Admin APIキーがない場合はエラー
    if (!organization.adminApiKey) {
      return res.status(400).json({ error: 'この組織にはAdmin APIキーが設定されていません' });
    }
    
    try {
      // 環境変数から暗号化キーを取得
      const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
      if (!encryptionSecret) {
        return res.status(500).json({ error: '暗号化キーが設定されていません' });
      }
      
      // Admin APIキーを復号化
      const adminApiKey = anthropicAdminService.decryptAdminApiKey(organization.adminApiKey, encryptionSecret);
      
      // 更新データを構築
      const updateData = {};
      if (status) updateData.status = status;
      if (name) updateData.name = name;
      
      // Anthropic APIを呼び出して更新
      const result = await anthropicAdminService.updateApiKey(adminApiKey, apiKeyId, updateData);
      
      // ワークスペースの情報も更新
      if (result.workspace_id) {
        const workspace = await Workspace.findOne({
          anthropicWorkspaceId: result.workspace_id
        });
        
        if (workspace && workspace.apiKey && workspace.apiKey.keyId === apiKeyId) {
          workspace.apiKey.status = result.status;
          if (name) workspace.apiKey.name = name;
          await workspace.save();
        }
      } else if (organization.apiKey === apiKeyId && status === 'inactive') {
        // 組織のデフォルトキーが無効化された場合
        organization.apiKey = null;
        await organization.save();
      }
      
      return res.status(200).json({
        message: 'APIキーが更新されました',
        apiKey: {
          id: result.id,
          name: result.name,
          status: result.status,
          updated: true
        }
      });
    } catch (error) {
      logger.error('APIキー更新エラー:', error);
      return res.status(500).json({ error: 'APIキーの更新に失敗しました' });
    }
  } catch (error) {
    logger.error('APIキー状態更新エラー:', error);
    return res.status(500).json({ error: 'APIキーの状態更新に失敗しました' });
  }
};

/**
 * 管理者ダッシュボード統計を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getAdminDashboardStats = async (req, res) => {
  try {
    // 管理者権限チェック
    if (!checkAdminPermission(req.userRole)) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    
    // 各種統計を集計
    const stats = {
      users: await User.countDocuments(),
      organizations: await Organization.countDocuments({ isArchived: { $ne: true } }),
      workspaces: await Workspace.countDocuments({ isArchived: { $ne: true } }),
      archivedOrganizations: await Organization.countDocuments({ isArchived: true }),
      archivedWorkspaces: await Workspace.countDocuments({ isArchived: true })
    };
    
    // 今日の使用量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' },
          requestCount: { $sum: 1 }
        }
      }
    ]);
    
    // 今月の使用量
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' },
          requestCount: { $sum: 1 }
        }
      }
    ]);
    
    // 過去7日間の日別使用量
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 6); // 今日を含めて7日間
    
    const dailyUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: last7Days }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          totalTokens: { $sum: '$totalTokens' },
          requestCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // 予算超過の組織を検出
    const organizationsWithBudget = await Organization.find({
      isArchived: { $ne: true },
      monthlyBudget: { $gt: 0 }
    });
    
    const budgetAlerts = [];
    
    for (const org of organizationsWithBudget) {
      const usage = await ApiUsage.getOrganizationTokenUsage(org._id, {
        start: startOfMonth
      });
      
      const usagePercentage = (usage.totalTokens / org.monthlyBudget) * 100;
      
      if (usagePercentage >= 90) {
        budgetAlerts.push({
          organizationId: org._id,
          organizationName: org.name,
          budget: org.monthlyBudget,
          used: usage.totalTokens,
          percentage: Math.round(usagePercentage * 10) / 10,
          severity: usagePercentage >= 100 ? 'critical' : 'warning'
        });
      }
    }
    
    // システム統計情報
    const systemStats = {
      apiUsageRecords: await ApiUsage.estimatedDocumentCount(),
      dbSize: await mongoose.connection.db.stats().then(stats => stats.dataSize / 1024 / 1024) // MBに変換
    };
    
    return res.status(200).json({
      counts: stats,
      usage: {
        today: todayUsage[0] ? {
          totalTokens: todayUsage[0].totalTokens,
          requestCount: todayUsage[0].requestCount
        } : {
          totalTokens: 0,
          requestCount: 0
        },
        month: monthUsage[0] ? {
          totalTokens: monthUsage[0].totalTokens,
          requestCount: monthUsage[0].requestCount
        } : {
          totalTokens: 0,
          requestCount: 0
        },
        daily: dailyUsage.map(day => ({
          date: day._id,
          totalTokens: day.totalTokens,
          requestCount: day.requestCount
        }))
      },
      alerts: {
        budgetAlerts: budgetAlerts.sort((a, b) => b.percentage - a.percentage),
        systemAlerts: [] // システムアラートがあれば追加
      },
      system: systemStats
    });
  } catch (error) {
    logger.error('管理者ダッシュボード統計取得エラー:', error);
    return res.status(500).json({ error: '統計情報の取得に失敗しました' });
  }
};