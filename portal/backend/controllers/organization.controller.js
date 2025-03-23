/**
 * 組織コントローラー
 * 組織の作成、取得、更新、削除などの機能を提供
 * 
 * 1組織1ワークスペースルールの実装:
 * - 組織作成時に必ずデフォルトワークスペースを作成
 * - 組織のデフォルトワークスペースへの直接アクセスAPIを提供
 * - ワークスペース作成制限
 */
const Organization = require('../models/organization.model');
const Workspace = require('../models/workspace.model');
const User = require('../models/user.model');
const ApiUsage = require('../models/apiUsage.model');
const anthropicAdminService = require('../services/anthropicAdminService');
const authConfig = require('../config/auth.config');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const crypto = require('crypto');

// 環境変数から暗号化キーを取得
const getEncryptionSecret = () => {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET が設定されていません');
  }
  return secret;
};

/**
 * 組織一覧を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getOrganizations = async (req, res) => {
  try {
    // ユーザーのロールに基づいて取得範囲を制限
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    let query = {};
    
    // スーパー管理者でない場合は自分がメンバーとなっている組織のみ取得
    if (!isSuperAdmin) {
      query = { 'members.userId': req.userId };
    }
    
    // アーカイブフラグによるフィルタリング
    if (req.query.includeArchived !== 'true') {
      query.isArchived = { $ne: true };
    }
    
    // 組織データを取得
    const organizations = await Organization.find(query)
      .select({ adminApiKey: 0 }) // 機密情報は除外
      .populate('adminId', 'username email')
      .populate('members.userId', 'username email');
    
    // 各組織の使用量データを追加
    const organizationsWithUsage = await Promise.all(organizations.map(async (org) => {
      const orgObj = org.toObject();
      
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
        usage: {
          totalTokens: usage.totalTokens,
          budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
        }
      };
    }));
    
    return res.status(200).json(organizationsWithUsage);
  } catch (error) {
    logger.error('組織一覧取得エラー:', error);
    return res.status(500).json({ error: '組織情報の取得に失敗しました' });
  }
};

/**
 * 特定の組織を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId)
      .select({ adminApiKey: 0 }) // 機密情報は除外
      .populate('adminId', 'username email')
      .populate('members.userId', 'username email');
      
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織のメンバーのみアクセス可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isMember = organization.members.some(m => 
      m.userId._id.toString() === req.userId.toString()
    );
    
    if (!isSuperAdmin && !isMember) {
      return res.status(403).json({ error: 'この組織にアクセスする権限がありません' });
    }
    
    // 組織のワークスペース数を取得
    const workspaceCount = await Workspace.countDocuments({
      organizationId,
      isArchived: { $ne: true }
    });
    
    // 今月の使用量を取得
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usage = await ApiUsage.getOrganizationTokenUsage(organizationId, {
      start: startOfMonth,
      end: now
    });
    
    // 組織情報と追加データを返す
    const orgData = organization.toObject();
    const budgetUsage = organization.monthlyBudget > 0 ? 
      (usage.totalTokens / organization.monthlyBudget) * 100 : 0;
    
    return res.status(200).json({
      ...orgData,
      workspaceCount,
      usage: {
        totalTokens: usage.totalTokens,
        budgetPercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100),
        details: usage
      }
    });
  } catch (error) {
    logger.error('組織取得エラー:', error);
    return res.status(500).json({ error: '組織情報の取得に失敗しました' });
  }
};

/**
 * 新しい組織を作成
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.createOrganization = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 超管理者権限チェック - 組織作成は'super_admin'または'admin'のみ許可
    if (req.userRole !== authConfig.roles.SUPER_ADMIN && req.userRole !== authConfig.roles.ADMIN) {
      // ロールをデバッグ用に出力
      console.log('組織作成リクエスト - ユーザーロール:', req.userRole);
      console.log('必要なロール:', authConfig.roles.SUPER_ADMIN, 'または', authConfig.roles.ADMIN);
      return res.status(403).json({ error: '組織の作成にはスーパー管理者権限が必要です' });
    }
    
    // ユーザーIDをデバッグログに出力
    console.log('組織作成 - ユーザーID:', req.userId);
    
    // JSON注入対策: 安全なオブジェクトコピーを実施
    // Object.create(null)を使用して、プロトタイプのないクリーンなオブジェクトを作成
    const cleanBody = Object.create(null);
    
    // 許可する属性のみを明示的にコピー
    const allowedFields = ['name', 'description', 'adminUserId', 'adminEmail', 'adminName', 'monthlyBudget', 'adminApiKey', 'maxUsers'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        cleanBody[field] = req.body[field];
      }
    }
    
    // プロトタイプ攻撃の可能性を検出
    if (req.body.__proto__ || req.body.constructor || req.body.prototype) {
      console.warn('潜在的なプロトタイプ攻撃を検出:', JSON.stringify(req.body));
    }
    
    const { 
      name, 
      description, 
      adminUserId, 
      adminEmail,
      adminName,
      monthlyBudget, 
      adminApiKey, 
      maxUsers 
    } = cleanBody;
    
    // 必須パラメータのチェック
    if (!name) {
      return res.status(400).json({ error: '組織名は必須です' });
    }
    
    // 同名の組織が存在するかチェック
    const existingOrg = await Organization.findOne({ name });
    if (existingOrg) {
      return res.status(400).json({ error: '同じ名前の組織が既に存在します' });
    }
    
    // 管理者情報の特定と検証
    let adminId;
    let adminUser;
    
    // 優先順位: 1.adminUserId 2.adminEmail 3.カレントユーザーID
    if (adminUserId) {
      // adminUserIdが指定されている場合はそちらを優先
      adminUser = await User.findById(adminUserId);
      if (!adminUser) {
        return res.status(400).json({ error: '指定された管理者ユーザーが見つかりません' });
      }
      adminId = adminUser._id;
    } else if (adminEmail) {
      // adminEmailでユーザーを検索
      adminUser = await User.findOne({ email: adminEmail.toLowerCase() });
      
      if (adminUser) {
        // 既存ユーザーが見つかった場合
        adminId = adminUser._id;
      } else {
        // ユーザーが存在しない場合、新規作成（admin指定の場合のみ）
        if (adminName) {
          // 新規ユーザーを作成
          const newAdminPassword = crypto.randomBytes(8).toString('hex'); // ランダムパスワード生成
          adminUser = new User({
            name: adminName,
            email: adminEmail.toLowerCase(),
            password: newAdminPassword,
            role: 'user',
            accountStatus: 'active'
          });
          
          try {
            await adminUser.save({ session });
            
            // TODO: ユーザーに招待メールを送信（パスワード含む）
            logger.info(`新規管理者ユーザーを作成: ${adminEmail}`);
            
            adminId = adminUser._id;
          } catch (userCreateError) {
            logger.error('管理者ユーザー作成エラー:', userCreateError);
            return res.status(500).json({ error: '管理者ユーザーの作成に失敗しました' });
          }
        } else {
          return res.status(400).json({ error: '新規ユーザー作成には管理者名(adminName)が必要です' });
        }
      }
    } else {
      // どちらも指定がなければリクエスト元のユーザーをadminにしない
      // ※ここが変更点: SuperAdminを自動的に組織メンバーに追加しない
      return res.status(400).json({ error: '管理者ユーザーID(adminUserId)または管理者メール(adminEmail)が必要です' });
    }
    
    // NOTE: Admin APIキーはSystemConfigモデルで一元管理するため不要
    
    // 最大メンバー数のバリデーション
    const validatedMaxUsers = maxUsers ? parseInt(maxUsers, 10) : undefined;
    if (validatedMaxUsers !== undefined && (isNaN(validatedMaxUsers) || validatedMaxUsers < 1 || validatedMaxUsers > 10000)) {
      return res.status(400).json({ error: '最大メンバー数は1から10000の間で指定してください' });
    }
    
    // 組織オブジェクトの作成
    const organization = new Organization({
      name,
      description: description || '',
      adminId,
      monthlyBudget: monthlyBudget || 100000, // デフォルト10万トークン
      maxUsers: validatedMaxUsers || 5, // デフォルトは5人
      members: [
        { userId: adminId, role: 'admin' }
      ]
    });
    
    // 組織の保存
    await organization.save({ session });
    
    // デフォルトワークスペースの自動作成を停止
    // クライアントが明示的にワークスペース作成リクエストを送るようにする
    let workspace = null;
    
    // トランザクションのコミット
    await session.commitTransaction();
    session.endSession();
    
    // 機密情報を除いて返却
    const orgData = organization.toObject();
    delete orgData.adminApiKey;
    
    // パスワードを生成した場合は、パスワードリセット情報を追加
    let adminInfo = null;
    if (adminUser && adminEmail && adminName) {
      adminInfo = {
        isNewUser: true,
        email: adminEmail,
        // クライアントに直接パスワードを返さない。実際の実装ではメール送信など別の方法でパスワードを伝える
        passwordSent: true
      };
    }
    
    return res.status(201).json({
      organization: orgData,
      admin: adminInfo
    });
  } catch (error) {
    // トランザクションのロールバック
    await session.abortTransaction();
    session.endSession();
    
    logger.error('組織作成エラー:', error);
    return res.status(500).json({ error: '組織の作成に失敗しました' });
  }
};

/**
 * 組織情報を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // JSON注入対策: 安全なオブジェクトコピーを実施
    // Object.create(null)を使用して、プロトタイプのないクリーンなオブジェクトを作成
    const cleanBody = Object.create(null);
    
    // 許可する属性のみを明示的にコピー
    const allowedFields = ['name', 'description', 'monthlyBudget', 'adminApiKey', 'status', 'maxUsers'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        cleanBody[field] = req.body[field];
      }
    }
    
    // プロトタイプ攻撃の可能性を検出
    if (req.body.__proto__ || req.body.constructor || req.body.prototype) {
      console.warn('潜在的なプロトタイプ攻撃を検出:', JSON.stringify(req.body));
    }
    
    const { name, description, monthlyBudget, adminApiKey, status, maxUsers } = cleanBody;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織の管理者のみ更新可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織を更新する権限がありません' });
    }
    
    // 更新可能なフィールドを設定
    if (name) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (monthlyBudget) organization.monthlyBudget = monthlyBudget;
    if (status && ['active', 'suspended', 'pending'].includes(status)) {
      organization.status = status;
    }
    
    // 最大メンバー数を更新
    if (maxUsers !== undefined) {
      const validatedMaxUsers = parseInt(maxUsers, 10);
      if (isNaN(validatedMaxUsers) || validatedMaxUsers < 1 || validatedMaxUsers > 10000) {
        return res.status(400).json({ error: '最大メンバー数は1から10000の間で指定してください' });
      }
      
      // 現在のメンバー数より小さい値には設定できない
      const currentMemberCount = organization.members.length;
      if (validatedMaxUsers < currentMemberCount) {
        return res.status(400).json({ 
          error: `最大メンバー数は現在のメンバー数(${currentMemberCount}人)より小さくすることはできません` 
        });
      }
      
      organization.maxUsers = validatedMaxUsers;
    }
    
    // NOTE: Admin APIキーはSystemConfigモデルで一元管理するため不要
    
    // 組織情報を保存
    await organization.save();
    
    // 機密情報を除いてレスポンスを返却
    const orgData = organization.toObject();
    delete orgData.adminApiKey;
    
    return res.status(200).json(orgData);
  } catch (error) {
    logger.error('組織更新エラー:', error);
    return res.status(500).json({ error: '組織情報の更新に失敗しました' });
  }
};

/**
 * 組織を完全に削除（物理削除）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.deleteOrganization = async (req, res) => {
  console.log('DELETE組織リクエスト受信:', req.params);
  console.log('ユーザー情報:', { userId: req.userId, userRole: req.userRole });
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { organizationId } = req.params;
    
    console.log('組織を検索中:', organizationId);
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      console.log('組織が見つかりません:', organizationId);
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    console.log('組織が見つかりました:', organization.name);
    
    // 権限チェック: スーパー管理者または組織の管理者のみ削除可能
    const authConfig = require('../config/auth.config');
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    console.log('権限チェック:', { isSuperAdmin, isOrgAdmin, userRole: req.userRole });
    
    if (!isSuperAdmin && !isOrgAdmin) {
      console.log('権限がありません');
      return res.status(403).json({ error: '組織を削除する権限がありません' });
    }
    
    // まず関連するワークスペースを削除
    console.log('関連ワークスペースを削除中...');
    const workspaceResult = await Workspace.deleteMany({ organizationId }, { session });
    console.log('ワークスペース削除結果:', workspaceResult);
    
    // Workspaceに関連するデータも削除（ここでは省略しますが、本番環境では必要に応じて実装）
    
    // 組織を削除
    console.log('組織を削除中...');
    const organizationResult = await Organization.deleteOne({ _id: organizationId }, { session });
    console.log('組織削除結果:', organizationResult);
    
    // トランザクションのコミット
    console.log('トランザクションをコミットします');
    await session.commitTransaction();
    session.endSession();
    
    console.log('組織削除完了:', organizationId);
    return res.status(200).json({ 
      message: '組織が完全に削除されました',
      organizationId 
    });
  } catch (error) {
    // トランザクションのロールバック
    console.error('組織削除エラー発生、ロールバックします:', error);
    await session.abortTransaction();
    session.endSession();
    
    console.error('組織削除エラー:', error);
    return res.status(500).json({ 
      error: '組織の削除に失敗しました', 
      details: error.message
    });
  }
};

/**
 * 組織をアーカイブ（論理削除）
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.archiveOrganization = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { organizationId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者のみ削除可能
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: '組織をアーカイブする権限がありません' });
    }
    
    // 組織をアーカイブ
    organization.isArchived = true;
    organization.status = 'suspended';
    await organization.save({ session });
    
    // 関連するワークスペースもアーカイブ
    await Workspace.updateMany(
      { organizationId },
      { isArchived: true },
      { session }
    );
    
    // トランザクションのコミット
    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({ 
      message: '組織がアーカイブされました',
      organizationId: organization._id 
    });
  } catch (error) {
    // トランザクションのロールバック
    await session.abortTransaction();
    session.endSession();
    
    logger.error('組織アーカイブエラー:', error);
    return res.status(500).json({ error: '組織のアーカイブに失敗しました' });
  }
};

/**
 * 組織メンバー一覧を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getOrganizationMembers = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId)
      .populate('members.userId', 'username email accountStatus role');
    
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織のメンバーのみアクセス可能
    // ただし、一般メンバーには詳細情報へのアクセスを制限
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isMember = organization.isMember(req.userId);
    
    if (!isSuperAdmin && !isMember) {
      return res.status(403).json({ error: 'この組織のメンバー一覧にアクセスする権限がありません' });
    }
    
    // 一般メンバー向けには必要最低限の情報のみ返す
    if (!isSuperAdmin && !isOrgAdmin && isMember) {
      // 一般メンバー向けの最小限の情報
      const limitedMembers = organization.members.map(member => ({
        userId: {
          _id: member.userId._id,
          username: member.userId.username,
          email: member.userId.email
        },
        role: member.role,
        joinedAt: member.joinedAt
      }));
      
      return res.status(200).json(limitedMembers);
    }
    
    // 管理者向けには詳細情報を返す
    return res.status(200).json(organization.members);
  } catch (error) {
    logger.error('組織メンバー一覧取得エラー:', error);
    return res.status(500).json({ error: '組織メンバー情報の取得に失敗しました' });
  }
};

/**
 * 組織にメンバーを追加
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.addOrganizationMember = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { userId, role = 'member' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'ユーザーIDは必須です' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織の管理者のみメンバー追加可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織にメンバーを追加する権限がありません' });
    }
    
    // ユーザーの存在確認
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '指定されたユーザーが見つかりません' });
    }
    
    // 既にメンバーかどうかチェック
    if (organization.isMember(userId)) {
      return res.status(400).json({ error: '指定されたユーザーは既にこの組織のメンバーです' });
    }
    
    // メンバーを追加
    organization.members.push({
      userId,
      role: ['admin', 'member'].includes(role) ? role : 'member',
      joinedAt: new Date()
    });
    
    await organization.save();
    
    // 更新後のメンバーを返却
    const updatedMember = organization.members.find(m => 
      m.userId.toString() === userId.toString()
    );
    
    return res.status(201).json(updatedMember);
  } catch (error) {
    logger.error('組織メンバー追加エラー:', error);
    return res.status(500).json({ error: '組織へのメンバー追加に失敗しました' });
  }
};

/**
 * 組織メンバーの役割を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateOrganizationMemberRole = async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: '有効な役割を指定してください (admin または member)' });
    }
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織の管理者のみ役割更新可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織のメンバー役割を更新する権限がありません' });
    }
    
    // メンバーの存在確認
    const memberIndex = organization.members.findIndex(m => 
      m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: '指定されたメンバーがこの組織に見つかりません' });
    }
    
    // 自分自身の役割をmemberに変更しようとしている場合（組織の最後の管理者）
    if (
      memberId === req.userId.toString() &&
      role === 'member' &&
      organization.members[memberIndex].role === 'admin'
    ) {
      // 他に管理者がいるかチェック
      const otherAdmins = organization.members.filter(m => 
        m.userId.toString() !== req.userId.toString() && m.role === 'admin'
      );
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({ 
          error: '組織の最後の管理者は役割を変更できません。先に別の管理者を追加してください。' 
        });
      }
    }
    
    // メンバーの役割を更新
    organization.members[memberIndex].role = role;
    await organization.save();
    
    // Anthropicの組織メンバー役割も更新（Admin APIキーがある場合）
    if (organization.adminApiKey && role === 'admin') {
      try {
        // Admin APIキーを復号化
        const secret = getEncryptionSecret();
        const adminApiKey = anthropicAdminService.decryptAdminApiKey(organization.adminApiKey, secret);
        
        // Anthropicのメンバー一覧を取得して対象ユーザーを検索
        // 実際の実装では、Anthropic側のユーザーIDをデータベースに保存しておく必要あり
      } catch (error) {
        logger.warn('Anthropicメンバー役割更新エラー:', error);
        // このエラーはクライアントに返さない
      }
    }
    
    return res.status(200).json({ 
      message: 'メンバーの役割が更新されました',
      memberId,
      role
    });
  } catch (error) {
    logger.error('組織メンバー役割更新エラー:', error);
    return res.status(500).json({ error: 'メンバーの役割更新に失敗しました' });
  }
};

/**
 * 組織からメンバーを削除
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.removeOrganizationMember = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { organizationId, memberId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織の管理者のみメンバー削除可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織からメンバーを削除する権限がありません' });
    }
    
    // メンバーの存在確認
    const memberIndex = organization.members.findIndex(m => 
      m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: '指定されたメンバーがこの組織に見つかりません' });
    }
    
    // 自分自身を削除しようとしているケース（組織の最後の管理者）
    if (
      memberId === req.userId.toString() &&
      organization.members[memberIndex].role === 'admin'
    ) {
      // 他に管理者がいるかチェック
      const otherAdmins = organization.members.filter(m => 
        m.userId.toString() !== req.userId.toString() && m.role === 'admin'
      );
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({ 
          error: '組織の最後の管理者は削除できません。先に別の管理者を追加してください。' 
        });
      }
    }
    
    // メンバーを削除
    organization.members.splice(memberIndex, 1);
    await organization.save({ session });
    
    // 関連するワークスペースからもメンバーを削除
    await Workspace.updateMany(
      { organizationId },
      { $pull: { members: { userId: memberId } } },
      { session }
    );
    
    // トランザクションのコミット
    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({ 
      message: 'メンバーが組織から削除されました',
      memberId
    });
  } catch (error) {
    // トランザクションのロールバック
    await session.abortTransaction();
    session.endSession();
    
    logger.error('組織メンバー削除エラー:', error);
    return res.status(500).json({ error: 'メンバーの削除に失敗しました' });
  }
};

/**
 * 組織の使用量統計を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getOrganizationUsage = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { period = 'month', startDate, endDate } = req.query;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織のメンバーのみアクセス可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isMember = organization.isMember(req.userId);
    
    if (!isSuperAdmin && !isMember) {
      return res.status(403).json({ error: 'この組織の使用量情報にアクセスする権限がありません' });
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
    
    // 組織全体の使用量を取得
    const usage = await ApiUsage.getOrganizationTokenUsage(organizationId, timeRange);
    
    // ワークスペース別の使用量を取得
    const workspaceUsage = await ApiUsage.getOrganizationWorkspaceUsage(organizationId, timeRange);
    
    // 予算使用率を計算
    const budgetUsage = organization.monthlyBudget > 0 ? 
      (usage.totalTokens / organization.monthlyBudget) * 100 : 0;
    
    return res.status(200).json({
      organizationId,
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
        limit: organization.monthlyBudget,
        used: usage.totalTokens,
        usagePercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
      },
      workspaces: Array.isArray(workspaceUsage) ? workspaceUsage.map(ws => ({
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName || 'デフォルト',
        totalTokens: ws.totalTokens,
        inputTokens: ws.inputTokens || 0,
        outputTokens: ws.outputTokens || 0,
        percentage: Math.round((ws.totalTokens / Math.max(usage.totalTokens, 1)) * 1000) / 10
      })) : []
    });
  } catch (error) {
    logger.error('組織使用量取得エラー:', error);
    return res.status(500).json({ error: '使用量情報の取得に失敗しました' });
  }
};

/**
 * Anthropicから組織の情報を同期
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.syncWithAnthropic = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { syncWorkspaces = true, syncApiKeys = true } = req.body;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織の管理者のみ同期可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織の情報を同期する権限がありません' });
    }
    
    // Admin APIキーをSystemConfigから取得
    const systemConfig = await require('../models/systemConfig.model').findOne();
    if (!systemConfig || !systemConfig.adminApiKey) {
      return res.status(400).json({ error: 'システム設定にAdmin APIキーが設定されていません。管理者にご連絡ください。' });
    }
    
    // 同期結果を格納するオブジェクト
    const syncResults = {
      organization: organizationId,
      timestamp: new Date(),
      workspaces: null,
      apiKeys: null
    };
    
    // ワークスペースの同期
    if (syncWorkspaces) {
      try {
        // Admin APIキーを復号化
        const secret = systemConfig.encryptionSecret || getEncryptionSecret();
        const adminApiKey = systemConfig.decryptApiKey(systemConfig.adminApiKey, secret);
        
        syncResults.workspaces = await anthropicAdminService.syncOrganizationWorkspaces(organizationId, adminApiKey);
      } catch (error) {
        logger.error('ワークスペース同期エラー:', error);
        syncResults.workspaces = { error: error.message };
      }
    }
    
    // APIキーの同期
    if (syncApiKeys) {
      try {
        // Admin APIキーを復号化
        const secret = systemConfig.encryptionSecret || getEncryptionSecret();
        const adminApiKey = systemConfig.decryptApiKey(systemConfig.adminApiKey, secret);
        
        syncResults.apiKeys = await anthropicAdminService.syncOrganizationApiKeys(organizationId, adminApiKey);
      } catch (error) {
        logger.error('APIキー同期エラー:', error);
        syncResults.apiKeys = { error: error.message };
      }
    }
    
    return res.status(200).json(syncResults);
  } catch (error) {
    logger.error('Anthropic同期エラー:', error);
    return res.status(500).json({ error: 'Anthropicとの同期に失敗しました' });
  }
};

/**
 * 組織のAPIキー情報を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getOrganizationApiKeys = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 権限チェック: スーパー管理者または組織の管理者のみアクセス可能
    const isSuperAdmin = req.userRole === authConfig.roles.SUPER_ADMIN;
    const isOrgAdmin = organization.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'この組織のAPIキー情報にアクセスする権限がありません' });
    }
    
    // Admin APIキーをSystemConfigから取得
    const systemConfig = await require('../models/systemConfig.model').findOne();
    if (!systemConfig || !systemConfig.adminApiKey) {
      return res.status(200).json({
        hasAdminKey: false,
        apiKeys: []
      });
    }
    
    try {
      // Admin APIキーを復号化
      const secret = systemConfig.encryptionSecret || getEncryptionSecret();
      const adminApiKey = systemConfig.decryptApiKey(systemConfig.adminApiKey, secret);
      
      // Anthropicから直接APIキー一覧を取得
      const apiKeys = await anthropicAdminService.listApiKeys(adminApiKey);
      
      // ワークスペース情報を取得
      const workspaces = await Workspace.find({ organizationId });
      const workspaceMap = {};
      workspaces.forEach(ws => {
        if (ws.anthropicWorkspaceId) {
          workspaceMap[ws.anthropicWorkspaceId] = {
            id: ws._id,
            name: ws.name
          };
        }
      });
      
      // 機密情報を除外して返却
      const sanitizedKeys = apiKeys.data.map(key => ({
        id: key.id,
        name: key.name,
        status: key.status,
        created: key.created_at,
        workspaceId: key.workspace_id,
        workspace: key.workspace_id ? workspaceMap[key.workspace_id] : null,
        hint: key.partial_key_hint
      }));
      
      return res.status(200).json({
        hasAdminKey: true,
        totalCount: apiKeys.data.length,
        apiKeys: sanitizedKeys
      });
    } catch (error) {
      logger.error('APIキー一覧取得エラー:', error);
      return res.status(500).json({ error: 'APIキー情報の取得に失敗しました' });
    }
  } catch (error) {
    logger.error('組織APIキー取得エラー:', error);
    return res.status(500).json({ error: 'APIキー情報の取得に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースを取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getDefaultWorkspace = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    // 権限チェック: スーパー管理者または組織のメンバーのみアクセス可能
    const isSuperAdmin = req.userRole === 'admin';
    const isMember = organization.isMember(req.userId);
    
    if (!isSuperAdmin && !isMember) {
      return res.status(403).json({ error: 'この組織にアクセスする権限がありません' });
    }
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 今月の使用量を取得
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usage = await ApiUsage.getWorkspaceTokenUsage(defaultWorkspace._id, {
      start: startOfMonth,
      end: now
    });
    
    // 予算使用率を計算
    const budgetUsage = defaultWorkspace.monthlyBudget > 0 ? 
      (usage.totalTokens / defaultWorkspace.monthlyBudget) * 100 : 0;
    
    // ワークスペース情報と使用量データを返す
    const wsData = defaultWorkspace.toObject();
    
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
    logger.error('デフォルトワークスペース取得エラー:', error);
    return res.status(500).json({ error: 'ワークスペース情報の取得に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースのメンバー一覧を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getDefaultWorkspaceMembers = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースのメンバーのみアクセス可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceMember = defaultWorkspace.isMember(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceMember) {
      return res.status(403).json({ error: 'このワークスペースのメンバー一覧にアクセスする権限がありません' });
    }
    
    // ワークスペースメンバー情報を取得
    const workspaceWithMembers = await Workspace.findById(defaultWorkspace._id)
      .populate('members.userId', 'username email');
    
    // 組織メンバー一覧も取得（追加候補として）
    const orgMembers = organization.members.map(m => ({
      userId: m.userId._id || m.userId,
      username: m.userId.username,
      email: m.userId.email,
      role: m.role,
      isWorkspaceMember: workspaceWithMembers.members.some(wm => 
        wm.userId._id.toString() === (m.userId._id || m.userId).toString()
      )
    }));
    
    return res.status(200).json({
      workspaceMembers: workspaceWithMembers.members,
      organizationMembers: orgMembers
    });
  } catch (error) {
    logger.error('デフォルトワークスペースメンバー一覧取得エラー:', error);
    return res.status(500).json({ error: 'ワークスペースメンバー情報の取得に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースにメンバーを追加
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.addDefaultWorkspaceMember = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { userId, role = 'workspace_user' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'ユーザーIDは必須です' });
    }
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースの管理者のみメンバー追加可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = defaultWorkspace.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
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
    if (defaultWorkspace.isMember(userId)) {
      return res.status(400).json({ error: '指定されたユーザーは既にこのワークスペースのメンバーです' });
    }
    
    // 有効な役割かどうかチェック
    if (!['workspace_admin', 'workspace_developer', 'workspace_user'].includes(role)) {
      return res.status(400).json({ error: '無効な役割が指定されました' });
    }
    
    // メンバーを追加
    defaultWorkspace.members.push({
      userId,
      role,
      joinedAt: new Date()
    });
    
    await defaultWorkspace.save();
    
    // 更新後のメンバーを返却
    const updatedMember = defaultWorkspace.members.find(m => 
      m.userId.toString() === userId.toString()
    );
    
    return res.status(201).json(updatedMember);
  } catch (error) {
    logger.error('デフォルトワークスペースメンバー追加エラー:', error);
    return res.status(500).json({ error: 'ワークスペースへのメンバー追加に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースメンバーの役割を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateDefaultWorkspaceMemberRole = async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    const { role } = req.body;
    
    if (!role || !['workspace_admin', 'workspace_developer', 'workspace_user'].includes(role)) {
      return res.status(400).json({ error: '有効な役割を指定してください' });
    }
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースの管理者のみ役割更新可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = defaultWorkspace.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースのメンバー役割を更新する権限がありません' });
    }
    
    // メンバーの存在確認
    const memberIndex = defaultWorkspace.members.findIndex(m => 
      m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: '指定されたメンバーがこのワークスペースに見つかりません' });
    }
    
    // 自分自身の役割をworkspace_userに変更しようとしている場合（ワークスペースの最後の管理者）
    if (
      memberId === req.userId.toString() &&
      role !== 'workspace_admin' &&
      defaultWorkspace.members[memberIndex].role === 'workspace_admin'
    ) {
      // 他に管理者がいるかチェック
      const otherAdmins = defaultWorkspace.members.filter(m => 
        m.userId.toString() !== req.userId.toString() && m.role === 'workspace_admin'
      );
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({ 
          error: 'ワークスペースの最後の管理者は役割を変更できません。先に別の管理者を追加してください。' 
        });
      }
    }
    
    // メンバーの役割を更新
    defaultWorkspace.members[memberIndex].role = role;
    await defaultWorkspace.save();
    
    return res.status(200).json({ 
      message: 'メンバーの役割が更新されました',
      memberId,
      role
    });
  } catch (error) {
    logger.error('デフォルトワークスペースメンバー役割更新エラー:', error);
    return res.status(500).json({ error: 'メンバーの役割更新に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースからメンバーを削除
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.removeDefaultWorkspaceMember = async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースの管理者のみメンバー削除可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = defaultWorkspace.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースからメンバーを削除する権限がありません' });
    }
    
    // メンバーの存在確認
    const memberIndex = defaultWorkspace.members.findIndex(m => 
      m.userId.toString() === memberId
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ error: '指定されたメンバーがこのワークスペースに見つかりません' });
    }
    
    // 自分自身を削除しようとしているケース（ワークスペースの最後の管理者）
    if (
      memberId === req.userId.toString() &&
      defaultWorkspace.members[memberIndex].role === 'workspace_admin'
    ) {
      // 他に管理者がいるかチェック
      const otherAdmins = defaultWorkspace.members.filter(m => 
        m.userId.toString() !== req.userId.toString() && m.role === 'workspace_admin'
      );
      
      if (otherAdmins.length === 0) {
        return res.status(400).json({ 
          error: 'ワークスペースの最後の管理者は削除できません。先に別の管理者を追加してください。' 
        });
      }
    }
    
    // メンバーを削除
    defaultWorkspace.members.splice(memberIndex, 1);
    await defaultWorkspace.save();
    
    return res.status(200).json({ 
      message: 'メンバーがワークスペースから削除されました',
      memberId
    });
  } catch (error) {
    logger.error('デフォルトワークスペースメンバー削除エラー:', error);
    return res.status(500).json({ error: 'メンバーの削除に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースの使用量統計を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getDefaultWorkspaceUsage = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { period = 'month', startDate, endDate } = req.query;
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースのメンバーのみアクセス可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceMember = defaultWorkspace.isMember(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceMember) {
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
    const usage = await ApiUsage.getWorkspaceTokenUsage(defaultWorkspace._id, timeRange);
    
    // 予算使用率を計算
    const budgetUsage = defaultWorkspace.monthlyBudget > 0 ? 
      (usage.totalTokens / defaultWorkspace.monthlyBudget) * 100 : 0;
    
    return res.status(200).json({
      workspaceId: defaultWorkspace._id,
      workspaceName: defaultWorkspace.name,
      organizationId: organization._id,
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
        limit: defaultWorkspace.monthlyBudget,
        daily: defaultWorkspace.dailyBudget,
        used: usage.totalTokens,
        usagePercentage: Math.min(Math.round(budgetUsage * 10) / 10, 100)
      }
    });
  } catch (error) {
    logger.error('デフォルトワークスペース使用量取得エラー:', error);
    return res.status(500).json({ error: '使用量情報の取得に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースのAPIキー情報を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getDefaultWorkspaceApiKey = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースの管理者のみアクセス可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = defaultWorkspace.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースのAPIキー情報にアクセスする権限がありません' });
    }
    
    // ワークスペースのAPIキー情報を返す
    return res.status(200).json({
      workspaceId: defaultWorkspace._id,
      apiKey: defaultWorkspace.apiKey ? {
        id: defaultWorkspace.apiKey.keyId,
        name: defaultWorkspace.apiKey.name,
        status: defaultWorkspace.apiKey.status,
        created: defaultWorkspace.apiKey.createdAt
      } : null
    });
  } catch (error) {
    logger.error('デフォルトワークスペースAPIキー取得エラー:', error);
    return res.status(500).json({ error: 'APIキー情報の取得に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペース用に新しいAPIキーを生成
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.createDefaultWorkspaceApiKey = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'APIキー名は必須です' });
    }
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースの管理者のみAPIキー作成可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = defaultWorkspace.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースでAPIキーを作成する権限がありません' });
    }
    
    // ランダムなAPIキーを生成（本番環境では適切なキー生成ロジックを使用すること）
    const crypto = require('crypto');
    const apiKeyValue = `sk-${crypto.randomBytes(24).toString('hex')}`;
    const keyId = crypto.randomBytes(12).toString('hex');
    
    // 既存のAPIキーがあれば無効化
    if (defaultWorkspace.apiKey) {
      defaultWorkspace.apiKey.status = 'revoked';
    }
    
    // 新しいAPIキーを設定
    defaultWorkspace.apiKey = {
      keyId,
      name,
      status: 'active',
      createdAt: new Date()
    };
    
    await defaultWorkspace.save();
    
    return res.status(201).json({
      message: '新しいAPIキーが生成されました',
      key: apiKeyValue, // 実際の値は一度だけクライアントに返す
      id: keyId,
      name,
      created: defaultWorkspace.apiKey.createdAt
    });
  } catch (error) {
    logger.error('デフォルトワークスペースAPIキー生成エラー:', error);
    return res.status(500).json({ error: 'APIキーの生成に失敗しました' });
  }
};

/**
 * 組織のデフォルトワークスペースのAPIキーを無効化
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.revokeDefaultWorkspaceApiKey = async (req, res) => {
  try {
    const { organizationId, keyId } = req.params;
    
    // 組織とデフォルトワークスペースを同時に取得
    const result = await Organization.findWithDefaultWorkspace(organizationId);
    
    if (!result) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    const { organization, defaultWorkspace } = result;
    
    if (!defaultWorkspace) {
      return res.status(404).json({ error: 'デフォルトワークスペースが見つかりません' });
    }
    
    // 権限チェック: スーパー管理者、組織の管理者、またはワークスペースの管理者のみAPIキー無効化可能
    const isSuperAdmin = req.userRole === 'admin';
    const isOrgAdmin = organization.isAdmin(req.userId);
    const isWorkspaceAdmin = defaultWorkspace.isAdmin(req.userId);
    
    if (!isSuperAdmin && !isOrgAdmin && !isWorkspaceAdmin) {
      return res.status(403).json({ error: 'このワークスペースでAPIキーを無効化する権限がありません' });
    }
    
    // APIキーの存在確認
    if (!defaultWorkspace.apiKey || defaultWorkspace.apiKey.keyId !== keyId) {
      return res.status(404).json({ error: '指定されたAPIキーが見つかりません' });
    }
    
    // APIキーを無効化
    defaultWorkspace.apiKey.status = 'revoked';
    await defaultWorkspace.save();
    
    return res.status(200).json({
      message: 'APIキーが無効化されました',
      keyId
    });
  } catch (error) {
    logger.error('デフォルトワークスペースAPIキー無効化エラー:', error);
    return res.status(500).json({ error: 'APIキーの無効化に失敗しました' });
  }
};

/**
 * 新規ワークスペース作成を防止（1組織1ワークスペースルール）
 * ただし、ワークスペースがない場合は作成を許可
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.preventMultipleWorkspaces = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    
    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }
    
    // 既存のワークスペース数をチェック
    const workspaceCount = await Workspace.countDocuments({ 
      organizationId: organizationId,
      isArchived: { $ne: true }
    });
    
    if (workspaceCount > 0) {
      return res.status(400).json({ 
        error: '1組織1ワークスペースルールに従い、追加のワークスペースは作成できません。既存のワークスペースを使用してください。',
        rule: 'one_workspace_per_organization',
        suggestedAction: 'use_existing_workspace'
      });
    }
    
    // 組織にワークスペースがなければ、作成を許可
    console.log(`組織 ${organizationId} にワークスペースがないため、作成を許可します`);
    res.locals.allowWorkspaceCreation = true;
    
    // nextパラメータが提供されている場合のみ呼び出す
    if (typeof next === 'function') {
      return next();
    } else {
      // middlewareではなく直接呼び出された場合はリクエストを処理
      return res.status(200).json({
        message: 'ワークスペースの作成が許可されました',
        organizationId
      });
    }
  } catch (error) {
    console.error('ワークスペース作成制限エラー:', error);
    return res.status(500).json({ error: 'ワークスペース作成リクエストの処理に失敗しました' });
  }
};

/**
 * 既存ユーザーを組織構造に移行する
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.migrateUsersToOrganizations = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'マイグレーションの実行にはスーパー管理者権限が必要です' });
    }
    
    const { dryRun = true } = req.query;
    const isDryRun = dryRun === 'true' || dryRun === '1';
    
    // 既存の組織がないユーザーを取得
    const users = await User.find();
    const results = { migrated: [], skipped: [], total: users.length };
    
    // 各ユーザーについて処理
    for (const user of users) {
      // 既に組織に所属しているかチェック
      const existingMembership = await Organization.findOne({ 'members.userId': user._id });
      
      if (existingMembership) {
        results.skipped.push({
          userId: user._id,
          username: user.username,
          reason: '既に組織に所属しています'
        });
        continue;
      }
      
      if (!isDryRun) {
        // ユーザーの組織がなければ個人組織を作成
        const organization = new Organization({
          name: `${user.username || user.email}の組織`,
          description: '自動作成された個人組織',
          adminId: user._id,
          members: [{ userId: user._id, role: 'admin' }],
          monthlyBudget: 100000, // デフォルト10万トークン
          status: 'active'
        });
        
        await organization.save({ session });
        
        // デフォルトワークスペースを作成
        const workspace = new Workspace({
          name: 'デフォルトワークスペース',
          organizationId: organization._id,
          description: '自動作成されたデフォルトワークスペース',
          monthlyBudget: organization.monthlyBudget,
          members: [{ userId: user._id, role: 'workspace_admin' }]
        });
        
        await workspace.save({ session });
        
        results.migrated.push({
          userId: user._id,
          username: user.username,
          organizationId: organization._id,
          workspaceId: workspace._id
        });
      } else {
        // ドライラン時は実際の作成はせず、移行対象を記録
        results.migrated.push({
          userId: user._id,
          username: user.username,
          dryRun: true
        });
      }
    }
    
    // トランザクションの処理
    if (!isDryRun) {
      await session.commitTransaction();
      session.endSession();
    } else {
      await session.abortTransaction();
      session.endSession();
    }
    
    return res.status(200).json({
      dryRun: isDryRun,
      results
    });
  } catch (error) {
    // トランザクションのロールバック
    await session.abortTransaction();
    session.endSession();
    
    logger.error('ユーザー移行エラー:', error);
    return res.status(500).json({ error: 'ユーザーの組織への移行に失敗しました' });
  }
};

/**
 * 組織の月間警告フラグをリセット
 * 定期的なcronジョブから呼び出す想定
 */
exports.resetOrganizationWarnings = async () => {
  try {
    const now = new Date();
    const currentDay = now.getDate();
    
    // リセット日が今日と一致する組織を検索
    const organizations = await Organization.find({
      resetDay: currentDay,
      'warningsSent.0': { $exists: true }  // 何らかの警告フラグが設定されている
    });
    
    // 各組織の警告フラグをリセット
    for (const org of organizations) {
      org.warningsSent = [];
      await org.save();
      logger.info(`組織 ${org._id} (${org.name}) の警告フラグをリセットしました`);
    }
    
    return { resetCount: organizations.length };
  } catch (error) {
    logger.error('組織警告フラグリセットエラー:', error);
    throw error;
  }
};