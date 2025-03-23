/**
 * ワークスペースコントローラー
 * ワークスペースの作成、取得、更新、削除などの機能を提供
 */
const Workspace = require('../models/workspace.model');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const ApiUsage = require('../models/apiUsage.model');
const anthropicAdminService = require('../services/anthropicAdminService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * 指定された組織のワークスペース一覧を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getWorkspaces = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: 管理者または組織のメンバーのみアクセス可能
    const isAdmin = req.userRole === 'admin';
    const isMember = organization.isMember(req.userId);
    
    if (!isAdmin && !isMember) {
      return res.status(403).json({ error: 'この組織のワークスペース一覧にアクセスする権限がありません' });
    }
    
    // アーカイブフラグによるフィルタリング
    const includeArchived = req.query.includeArchived === 'true';
    const query = { organizationId };
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    
    // ワークスペース一覧を取得
    const workspaces = await Workspace.find(query)
      .populate('members.userId', 'username email');
    
    // 各ワークスペースの使用量データを追加
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const workspacesWithUsage = await Promise.all(workspaces.map(async (workspace) => {
      const wsObj = workspace.toObject();
      
      // 今月の使用量を取得
      const usage = await ApiUsage.getWorkspaceTokenUsage(workspace._id, {
        start: startOfMonth,
        end: now
      });
      
      // 予算使用率を計算
      const budgetUsage = workspace.monthlyBudget > 0 ? 
        (usage.totalTokens / workspace.monthlyBudget) * 100 : 0;
      
      // 使用量情報を追加
      return {
        ...wsObj,
        usage: {
          totalTokens: usage.totalTokens,
          budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
        }
      };
    }));
    
    return res.status(200).json(workspacesWithUsage);
  } catch (error) {
    logger.error('ワークスペース一覧取得エラー:', error);
    return res.status(500).json({ error: 'ワークスペース情報の取得に失敗しました' });
  }
};

/**
 * 特定のワークスペースを取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.userId', 'username email');
      
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースのメンバーのみアクセス可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceMember = workspace.isMember(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceMember) {
      return res.status(403).json({ error: 'このワークスペースにアクセスする権限がありません' });
    }
    
    // 今月の使用量を取得
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usage = await ApiUsage.getWorkspaceTokenUsage(workspaceId, {
      start: startOfMonth,
      end: now
    });
    
    // 予算使用率を計算
    const budgetUsage = workspace.monthlyBudget > 0 ? 
      (usage.totalTokens / workspace.monthlyBudget) * 100 : 0;
    
    // ワークスペース情報と使用量データを返す
    const wsData = workspace.toObject();
    
    return res.status(200).json({
      ...wsData,
      organizationName: organization.name,
      usage: {
        totalTokens: usage.totalTokens,
        budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100),
        details: usage
      }
    });
  } catch (error) {
    logger.error('ワークスペース取得エラー:', error);
    return res.status(500).json({ error: 'ワークスペース情報の取得に失敗しました' });
  }
};

/**
 * 新しいワークスペースを作成
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.createWorkspace = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { organizationId } = req.params;
    const { name, description, monthlyBudget, syncWithAnthropic = false } = req.body;
    
    // 必須パラメータのチェック
    if (!name) {
      return res.status(400).json({ error: 'ワークスペース名は必須です' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: 管理者または組織の管理者のみワークスペース作成可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織にワークスペースを作成する権限がありません' });
    }
    
    // 同名のワークスペースが存在するかチェック
    const existingWorkspace = await Workspace.findOne({
      organizationId,
      name
    });
    
    if (existingWorkspace) {
      return res.status(400).json({ error: 'この組織には同じ名前のワークスペースが既に存在します' });
    }
    
    // ワークスペースオブジェクトの作成
    const workspace = new Workspace({
      name,
      organizationId,
      description: description || '',
      // 予算設定は不要
      members: [
        { userId: req.userId, role: 'workspace_admin' }
      ]
    });
    
    // Anthropicにもワークスペースを作成する場合
    if (syncWithAnthropic && organization.adminApiKey) {
      try {
        // 環境変数から暗号化キーを取得
        const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
        if (!encryptionSecret) {
          return res.status(500).json({ error: '暗号化キーが設定されていません' });
        }
        
        // Admin APIキーを復号化
        const adminApiKey = anthropicAdminService.decryptAdminApiKey(organization.adminApiKey, encryptionSecret);
        
        // Anthropicにワークスペースを作成
        const anthropicWorkspace = await anthropicAdminService.createWorkspace(adminApiKey, name);
        
        // 作成されたワークスペースIDを保存
        if (anthropicWorkspace && anthropicWorkspace.id) {
          workspace.anthropicWorkspaceId = anthropicWorkspace.id;
        }
      } catch (error) {
        logger.error('Anthropicワークスペース作成エラー:', error);
        // エラーでも処理は続行し、ローカルのみ作成
      }
    }
    
    // ワークスペースを保存
    await workspace.save({ session });
    
    // トランザクションのコミット
    await session.commitTransaction();
    session.endSession();
    
    return res.status(201).json(workspace);
  } catch (error) {
    // トランザクションのロールバック
    await session.abortTransaction();
    session.endSession();
    
    logger.error('ワークスペース作成エラー:', error);
    return res.status(500).json({ error: 'ワークスペースの作成に失敗しました' });
  }
};

/**
 * ワークスペース情報を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, monthlyBudget, dailyBudget } = req.body;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースの管理者のみ更新可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = workspace.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースを更新する権限がありません' });
    }
    
    // 更新可能なフィールドを設定
    if (name) {
      // 同名のワークスペースが存在するかチェック
      if (name !== workspace.name) {
        const existingWorkspace = await Workspace.findOne({
          organizationId: workspace.organizationId,
          name,
          _id: { $ne: workspaceId }
        });
        
        if (existingWorkspace) {
          return res.status(400).json({ error: 'この組織には同じ名前のワークスペースが既に存在します' });
        }
        
        workspace.name = name;
      }
    }
    
    if (description !== undefined) workspace.description = description;
    if (monthlyBudget) workspace.monthlyBudget = monthlyBudget;
    if (dailyBudget !== undefined) {
      workspace.dailyBudget = dailyBudget || null;
    }
    
    // ワークスペース情報を保存
    await workspace.save();
    
    // Anthropicのワークスペース名も更新する場合（名前変更時のみ）
    if (name && name !== workspace.name && workspace.anthropicWorkspaceId && organization.adminApiKey) {
      try {
        // この部分はAnthropicのAPIで名前変更が可能になった場合に実装
        // 現状のAdmin APIには名前変更の機能がないため省略
      } catch (error) {
        logger.warn('Anthropicワークスペース名更新エラー:', error);
        // このエラーはクライアントに返さない
      }
    }
    
    return res.status(200).json(workspace);
  } catch (error) {
    logger.error('ワークスペース更新エラー:', error);
    return res.status(500).json({ error: 'ワークスペース情報の更新に失敗しました' });
  }
};

/**
 * ワークスペースをアーカイブ（論理削除）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.archiveWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者または組織の管理者のみアーカイブ可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'このワークスペースをアーカイブする権限がありません' });
    }
    
    // ワークスペースをアーカイブ
    workspace.isArchived = true;
    await workspace.save();
    
    // Anthropicのワークスペースもアーカイブする場合
    if (workspace.anthropicWorkspaceId && organization.adminApiKey) {
      try {
        // 環境変数から暗号化キーを取得
        const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
        if (encryptionSecret) {
          // Admin APIキーを復号化
          const adminApiKey = anthropicAdminService.decryptAdminApiKey(organization.adminApiKey, encryptionSecret);
          
          // Anthropicのワークスペースをアーカイブ
          await anthropicAdminService.archiveWorkspace(adminApiKey, workspace.anthropicWorkspaceId);
        }
      } catch (error) {
        logger.warn('Anthropicワークスペースアーカイブエラー:', error);
        // このエラーはクライアントに返さない
      }
    }
    
    return res.status(200).json({ 
      message: 'ワークスペースがアーカイブされました',
      workspaceId: workspace._id 
    });
  } catch (error) {
    logger.error('ワークスペースアーカイブエラー:', error);
    return res.status(500).json({ error: 'ワークスペースのアーカイブに失敗しました' });
  }
};

/**
 * ワークスペースメンバー一覧を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.userId', 'username email');
    
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースのメンバーのみアクセス可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceMember = workspace.isMember(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceMember) {
      return res.status(403).json({ error: 'このワークスペースのメンバー一覧にアクセスする権限がありません' });
    }
    
    // 組織メンバー一覧も取得（追加候補として）
    const orgMembers = organization.members.map(m => ({
      userId: m.userId._id || m.userId,
      username: m.userId.username,
      email: m.userId.email,
      role: m.role,
      isWorkspaceMember: workspace.members.some(wm => 
        wm.userId._id.toString() === (m.userId._id || m.userId).toString()
      )
    }));
    
    return res.status(200).json({
      workspaceMembers: workspace.members,
      organizationMembers: orgMembers
    });
  } catch (error) {
    logger.error('ワークスペースメンバー一覧取得エラー:', error);
    return res.status(500).json({ error: 'ワークスペースメンバー情報の取得に失敗しました' });
  }
};

/**
 * ワークスペースにメンバーを追加
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.addWorkspaceMember = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { userId, role = 'workspace_user' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'ユーザーIDは必須です' });
    }
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースの管理者のみメンバー追加可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = workspace.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースにメンバーを追加する権限がありません' });
    }
    
    // ユーザーの存在確認
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '指定されたユーザーが見つかりません' });
    }
    
    // ユーザーが組織のメンバーであることを確認
    if (!organization.isMember(userId)) {
      return res.status(400).json({ error: '指定されたユーザーは組織のメンバーではありません。先に組織に追加してください。' });
    }
    
    // 既にワークスペースのメンバーかどうかチェック
    if (workspace.isMember(userId)) {
      return res.status(400).json({ error: '指定されたユーザーは既にこのワークスペースのメンバーです' });
    }
    
    // 有効な役割かどうかチェック
    if (!['workspace_admin', 'workspace_developer', 'workspace_user'].includes(role)) {
      return res.status(400).json({ error: '無効な役割が指定されました' });
    }
    
    // メンバーを追加
    workspace.members.push({
      userId,
      role,
      joinedAt: new Date()
    });
    
    await workspace.save();
    
    // Anthropicのワークスペースにもメンバーを追加する場合
    if (workspace.anthropicWorkspaceId && organization.adminApiKey) {
      try {
        // この部分はAnthropicのAPIで個別のユーザーがマッピングできるようになった場合に実装
        // 現状では省略
      } catch (error) {
        logger.warn('Anthropicワークスペースメンバー追加エラー:', error);
        // このエラーはクライアントに返さない
      }
    }
    
    // 更新後のメンバーを返却
    const updatedMember = workspace.members.find(m => 
      m.userId.toString() === userId.toString()
    );
    
    return res.status(201).json(updatedMember);
  } catch (error) {
    logger.error('ワークスペースメンバー追加エラー:', error);
    return res.status(500).json({ error: 'ワークスペースへのメンバー追加に失敗しました' });
  }
};

/**
 * ワークスペースメンバーの役割を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateWorkspaceMemberRole = async (req, res) => {
  try {
    const { workspaceId, memberId } = req.params;
    const { role } = req.body;
    
    if (!role || !['workspace_admin', 'workspace_developer', 'workspace_user'].includes(role)) {
      return res.status(400).json({ error: '有効な役割を指定してください' });
    }
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースの管理者のみ役割更新可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = workspace.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースのメンバー役割を更新する権限がありません' });
    }
    
    // メンバーの存在確認
    const memberIndex = workspace.members.findIndex(m => 
      m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: '指定されたメンバーがこのワークスペースに見つかりません' });
    }
    
    // 自分自身の役割をworkspace_userに変更しようとしている場合（ワークスペースの最後の管理者）
    if (
      memberId === req.userId.toString() &&
      role !== 'workspace_admin' &&
      workspace.members[memberIndex].role === 'workspace_admin'
    ) {
      // 他に管理者がいるかチェック
      const otherAdmins = workspace.members.filter(m => 
        m.userId.toString() !== req.userId.toString() && m.role === 'workspace_admin'
      );
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({ 
          error: 'ワークスペースの最後の管理者は役割を変更できません。先に別の管理者を追加してください。' 
        });
      }
    }
    
    // メンバーの役割を更新
    workspace.members[memberIndex].role = role;
    await workspace.save();
    
    // Anthropicのワークスペースメンバー役割も更新する場合
    if (workspace.anthropicWorkspaceId && organization.adminApiKey) {
      try {
        // この部分はAnthropicのAPIで個別のユーザーがマッピングできるようになった場合に実装
        // 現状では省略
      } catch (error) {
        logger.warn('Anthropicワークスペースメンバー役割更新エラー:', error);
        // このエラーはクライアントに返さない
      }
    }
    
    return res.status(200).json({ 
      message: 'メンバーの役割が更新されました',
      memberId,
      role
    });
  } catch (error) {
    logger.error('ワークスペースメンバー役割更新エラー:', error);
    return res.status(500).json({ error: 'メンバーの役割更新に失敗しました' });
  }
};

/**
 * ワークスペースからメンバーを削除
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.removeWorkspaceMember = async (req, res) => {
  try {
    const { workspaceId, memberId } = req.params;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースの管理者のみメンバー削除可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = workspace.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースからメンバーを削除する権限がありません' });
    }
    
    // メンバーの存在確認
    const memberIndex = workspace.members.findIndex(m => 
      m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: '指定されたメンバーがこのワークスペースに見つかりません' });
    }
    
    // 自分自身を削除しようとしているケース（ワークスペースの最後の管理者）
    if (
      memberId === req.userId.toString() &&
      workspace.members[memberIndex].role === 'workspace_admin'
    ) {
      // 他に管理者がいるかチェック
      const otherAdmins = workspace.members.filter(m => 
        m.userId.toString() !== req.userId.toString() && m.role === 'workspace_admin'
      );
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({ 
          error: 'ワークスペースの最後の管理者は削除できません。先に別の管理者を追加してください。' 
        });
      }
    }
    
    // メンバーを削除
    workspace.members.splice(memberIndex, 1);
    await workspace.save();
    
    // Anthropicのワークスペースからもメンバーを削除する場合
    if (workspace.anthropicWorkspaceId && organization.adminApiKey) {
      try {
        // この部分はAnthropicのAPIで個別のユーザーがマッピングできるようになった場合に実装
        // 現状では省略
      } catch (error) {
        logger.warn('Anthropicワークスペースメンバー削除エラー:', error);
        // このエラーはクライアントに返さない
      }
    }
    
    return res.status(200).json({ 
      message: 'メンバーがワークスペースから削除されました',
      memberId
    });
  } catch (error) {
    logger.error('ワークスペースメンバー削除エラー:', error);
    return res.status(500).json({ error: 'メンバーの削除に失敗しました' });
  }
};

/**
 * ワークスペースの使用量統計を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
/**
 * 新規ワークスペースを作成
 * organizationController.preventMultipleWorkspacesの後に実行され、
 * 組織にワークスペースがない場合のみ呼び出される
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.createWorkspace = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { 
      name = 'デフォルトワークスペース', 
      description = '組織のデフォルトワークスペース',
      monthlyBudget,
      syncWithAnthropic = false
    } = req.body;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: 管理者または組織の管理者のみワークスペース作成可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織にワークスペースを作成する権限がありません' });
    }
    
    // 最終確認: 組織にワークスペースがないことを確認
    const existingWorkspaceCount = await Workspace.countDocuments({
      organizationId,
      isArchived: { $ne: true }
    });
    
    if (existingWorkspaceCount > 0) {
      return res.status(400).json({
        error: '組織に既にアクティブなワークスペースが存在します',
        rule: 'one_workspace_per_organization'
      });
    }
    
    // 予算が指定されていない場合は組織の予算を使用
    const workspaceBudget = monthlyBudget || organization.monthlyBudget || 100000;
    
    // ワークスペースを作成
    const workspace = new Workspace({
      name,
      description,
      organizationId,
      monthlyBudget: workspaceBudget,
      members: [
        { userId: req.userId, role: 'workspace_admin', joinedAt: new Date() }
      ],
      syncWithAnthropic
    });
    
    await workspace.save();
    
    // 組織管理者も全員メンバーとして追加
    for (const member of organization.members) {
      if (member.role === 'admin' && member.userId.toString() !== req.userId.toString()) {
        workspace.members.push({
          userId: member.userId,
          role: 'workspace_admin',
          joinedAt: new Date()
        });
      }
    }
    
    await workspace.save();
    
    // AnthropicとのAPI連携があれば設定
    if (syncWithAnthropic && organization.adminApiKey) {
      try {
        // ここにAnthropicのAdmin APIでワークスペース作成ロジックが入る
        // 現在は実装しない
        console.log('Anthropicとの同期は現在実装されていません');
      } catch (error) {
        logger.warn('Anthropicワークスペース同期エラー:', error);
        // このエラーはクライアントには返さない
      }
    }
    
    return res.status(201).json({
      workspace,
      message: 'ワークスペースが作成されました'
    });
  } catch (error) {
    logger.error('ワークスペース作成エラー:', error);
    return res.status(500).json({ error: 'ワークスペースの作成に失敗しました' });
  }
};

exports.getWorkspaceUsage = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { period = 'month', startDate, endDate } = req.query;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースのメンバーのみアクセス可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceMember = workspace.isMember(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceMember) {
      return res.status(403).json({ error: 'このワークスペースの使用量情報にアクセスする権限がありません' });
    }
    
    // 期間の設定
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
    
    // ワークスペースの使用量を取得
    const usage = await ApiUsage.getWorkspaceTokenUsage(workspaceId, timeRange);
    
    // 日別の使用量集計
    const dailyUsage = await ApiUsage.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
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
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // ユーザー別の使用量集計
    const userUsage = await ApiUsage.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalTokens: { $sum: '$totalTokens' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          count: { $sum: 1 }
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
          count: 1,
          percentage: { 
            $cond: [
              { $eq: [usage.totalTokens, 0] },
              0,
              { $multiply: [{ $divide: ['$totalTokens', usage.totalTokens] }, 100] }
            ]
          }
        }
      },
      {
        $sort: { totalTokens: -1 }
      }
    ]);
    
    // 予算使用率を計算
    const budgetUsage = workspace.monthlyBudget > 0 ? 
      (usage.totalTokens / workspace.monthlyBudget) * 100 : 0;
    
    return res.status(200).json({
      workspaceId,
      workspaceName: workspace.name,
      organizationId: workspace.organizationId,
      organizationName: organization.name,
      period: {
        start: timeRange.start,
        end: timeRange.end
      },
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        requestCount: usage.count,
        successRate: usage.successRate
      },
      budget: {
        limit: workspace.monthlyBudget,
        daily: workspace.dailyBudget,
        used: usage.totalTokens,
        usagePercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
      },
      dailyUsage: dailyUsage.map(day => ({
        date: day._id,
        totalTokens: day.totalTokens,
        inputTokens: day.inputTokens,
        outputTokens: day.outputTokens,
        requestCount: day.count
      })),
      userUsage: userUsage.map(user => ({
        userId: user.userId,
        username: user.username || 'Unknown User',
        email: user.email,
        totalTokens: user.totalTokens,
        inputTokens: user.inputTokens,
        outputTokens: user.outputTokens,
        requestCount: user.count,
        percentage: Math.round(user.percentage * 10) / 10
      }))
    });
  } catch (error) {
    logger.error('ワークスペース使用量取得エラー:', error);
    return res.status(500).json({ error: '使用量情報の取得に失敗しました' });
  }
};

/**
 * ワークスペースのAPIキー情報を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getWorkspaceApiKey = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    // ワークスペースの存在確認
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'ワークスペースが見つかりません' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(workspace.organizationId);
    if (!organization) {
      return res.status(404).json({ error: '関連する組織が見つかりません' });
    }
    
    // 権限チェック: 管理者、組織の管理者、またはワークスペースの管理者のみアクセス可能
    const isAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = workspace.isAdmin(req.userId);
    
    if (!isAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースのAPIキー情報にアクセスする権限がありません' });
    }
    
    // Anthropicからワークスペースのキー情報を取得
    if (workspace.anthropicWorkspaceId && organization.adminApiKey) {
      try {
        // 環境変数から暗号化キーを取得
        const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
        if (!encryptionSecret) {
          return res.status(500).json({ error: '暗号化キーが設定されていません' });
        }
        
        // Admin APIキーを復号化
        const adminApiKey = anthropicAdminService.decryptAdminApiKey(organization.adminApiKey, encryptionSecret);
        
        // Anthropicからワークスペースのキー情報を取得
        const apiKeys = await anthropicAdminService.listApiKeys(adminApiKey, workspace.anthropicWorkspaceId);
        
        // アクティブなキーを検索
        const activeKey = apiKeys.data && apiKeys.data.find(k => k.status === 'active');
        
        // ワークスペースのキー情報を更新
        if (activeKey && (!workspace.apiKey || !workspace.apiKey.keyId || workspace.apiKey.keyId !== activeKey.id)) {
          workspace.apiKey = {
            keyId: activeKey.id,
            name: activeKey.name,
            status: activeKey.status,
            createdAt: new Date(activeKey.created_at)
          };
          await workspace.save();
        }
        
        return res.status(200).json({
          workspaceId,
          anthropicWorkspaceId: workspace.anthropicWorkspaceId,
          apiKey: {
            id: activeKey ? activeKey.id : workspace.apiKey?.keyId,
            name: activeKey ? activeKey.name : workspace.apiKey?.name,
            status: activeKey ? activeKey.status : workspace.apiKey?.status,
            created: activeKey ? activeKey.created_at : workspace.apiKey?.createdAt,
            hint: activeKey ? activeKey.partial_key_hint : null
          }
        });
      } catch (error) {
        logger.error('Anthropic APIキー取得エラー:', error);
        
        // エラーがあっても保存されている情報は返す
        return res.status(200).json({
          workspaceId,
          anthropicWorkspaceId: workspace.anthropicWorkspaceId,
          apiKey: workspace.apiKey ? {
            id: workspace.apiKey.keyId,
            name: workspace.apiKey.name,
            status: workspace.apiKey.status,
            created: workspace.apiKey.createdAt,
            syncError: 'Anthropicからの同期に失敗しました'
          } : null
        });
      }
    } else {
      // Anthropic連携がない場合は保存されている情報のみ返す
      return res.status(200).json({
        workspaceId,
        anthropicWorkspaceId: workspace.anthropicWorkspaceId,
        apiKey: workspace.apiKey ? {
          id: workspace.apiKey.keyId,
          name: workspace.apiKey.name,
          status: workspace.apiKey.status,
          created: workspace.apiKey.createdAt
        } : null
      });
    }
  } catch (error) {
    logger.error('ワークスペースAPIキー取得エラー:', error);
    return res.status(500).json({ error: 'APIキー情報の取得に失敗しました' });
  }
};