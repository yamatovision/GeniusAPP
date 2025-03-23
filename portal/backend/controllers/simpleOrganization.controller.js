/**
 * シンプルな組織管理コントローラー
 * 組織の作成、取得、更新、削除を行います
 */
const SimpleOrganization = require('../models/simpleOrganization.model');
const SimpleUser = require('../models/simpleUser.model');
const SimpleApiKey = require('../models/simpleApiKey.model');

/**
 * 組織一覧を取得
 * @route GET /api/simple/organizations
 */
exports.getOrganizations = async (req, res) => {
  try {
    const userId = req.userId;
    
    // ユーザーのロールを確認
    const user = await SimpleUser.findById(userId);
    
    let organizations;
    
    // SuperAdminはすべての組織を取得可能
    if (user && user.isSuperAdmin()) {
      organizations = await SimpleOrganization.find({ status: 'active' });
    } else {
      // 一般ユーザーは自分が作成した組織または所属している組織のみ取得可能
      const userOrg = await SimpleOrganization.find({
        $or: [
          { createdBy: userId },
          { _id: user.organizationId }
        ],
        status: 'active'
      });
      organizations = userOrg;
    }
    
    return res.status(200).json({
      success: true,
      data: organizations
    });
  } catch (error) {
    console.error('組織一覧取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: '組織一覧の取得中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 特定の組織を取得
 * @route GET /api/simple/organizations/:id
 */
exports.getOrganization = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.params.id;
    
    // 組織データを取得
    const organization = await SimpleOrganization.findById(organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: '組織が見つかりません'
      });
    }
    
    // ユーザーのロールと権限を確認
    const user = await SimpleUser.findById(userId);
    
    // アクセス権があるかチェック（SuperAdmin、作成者、または所属メンバー）
    if (!user.isSuperAdmin() && 
        organization.createdBy.toString() !== userId.toString() && 
        user.organizationId?.toString() !== organizationId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'この組織へのアクセス権限がありません'
      });
    }
    
    // APIキー情報を取得（必要に応じて）
    const apiKeys = await SimpleApiKey.find({
      id: { $in: organization.apiKeyIds }
    });
    
    // 組織に所属するユーザー一覧を取得
    const members = await SimpleUser.find({
      organizationId: organization._id
    }, '-password -refreshToken');
    
    return res.status(200).json({
      success: true,
      data: {
        organization,
        apiKeys,
        members
      }
    });
  } catch (error) {
    console.error('組織取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: '組織の取得中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 新しい組織を作成
 * @route POST /api/simple/organizations
 */
exports.createOrganization = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, workspaceName } = req.body;
    
    // 必須フィールドの検証
    if (!name || !workspaceName) {
      return res.status(400).json({
        success: false,
        message: '組織名とワークスペース名は必須です'
      });
    }
    
    // ユーザーがアクティブかどうか確認
    const user = await SimpleUser.findById(userId);
    
    if (!user || user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'アクティブなユーザーアカウントが必要です'
      });
    }
    
    // 組織名の重複チェック
    const existingOrg = await SimpleOrganization.findOne({ name });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: 'この組織名は既に使用されています'
      });
    }
    
    // 新しい組織を作成
    const newOrganization = new SimpleOrganization({
      name,
      description,
      workspaceName,
      createdBy: userId,
      apiKeyIds: [],
      status: 'active'
    });
    
    // 保存
    await newOrganization.save();
    
    // 組織を作成したユーザーの組織IDを更新
    user.organizationId = newOrganization._id;
    if (!user.isAdmin()) {
      user.role = 'Admin'; // 組織作成者は自動的に管理者に
    }
    await user.save();
    
    return res.status(201).json({
      success: true,
      message: '組織が正常に作成されました',
      data: newOrganization
    });
  } catch (error) {
    console.error('組織作成エラー:', error);
    return res.status(500).json({
      success: false,
      message: '組織の作成中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 組織を更新
 * @route PUT /api/simple/organizations/:id
 */
exports.updateOrganization = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.params.id;
    const { name, description, workspaceName, status } = req.body;
    
    // 更新対象の組織を取得
    const organization = await SimpleOrganization.findById(organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: '組織が見つかりません'
      });
    }
    
    // ユーザーの権限チェック
    const user = await SimpleUser.findById(userId);
    
    // SuperAdminまたは組織の作成者のみ更新可能
    if (!user.isSuperAdmin() && organization.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'この組織を更新する権限がありません'
      });
    }
    
    // 組織名の重複チェック（異なる組織で同じ名前を使用していないか）
    if (name && name !== organization.name) {
      const existingOrg = await SimpleOrganization.findOne({ name });
      if (existingOrg && existingOrg._id.toString() !== organizationId) {
        return res.status(400).json({
          success: false,
          message: 'この組織名は既に使用されています'
        });
      }
    }
    
    // フィールドを更新
    if (name) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (workspaceName) organization.workspaceName = workspaceName;
    
    // ステータス更新はSuperAdminのみ可能
    if (status && user.isSuperAdmin()) {
      organization.status = status;
    }
    
    // 保存
    await organization.save();
    
    return res.status(200).json({
      success: true,
      message: '組織が正常に更新されました',
      data: organization
    });
  } catch (error) {
    console.error('組織更新エラー:', error);
    return res.status(500).json({
      success: false,
      message: '組織の更新中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 組織にAPIキーを追加
 * @route POST /api/simple/organizations/:id/apikeys
 */
exports.addApiKey = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.params.id;
    const { keyValue } = req.body;
    
    if (!keyValue) {
      return res.status(400).json({
        success: false,
        message: 'APIキー値は必須です'
      });
    }
    
    // 組織を取得
    const organization = await SimpleOrganization.findById(organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: '組織が見つかりません'
      });
    }
    
    // ユーザーの権限チェック
    const user = await SimpleUser.findById(userId);
    
    // SuperAdminまたは組織の作成者のみAPIキー追加可能
    if (!user.isSuperAdmin() && organization.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'この組織にAPIキーを追加する権限がありません'
      });
    }
    
    // 新しいAPIキーを作成
    const newApiKey = new SimpleApiKey({
      id: `key_${Date.now()}`, // 単純なユニークID
      keyValue,
      organizationId: organization._id,
      status: 'active'
    });
    
    // 保存
    await newApiKey.save();
    
    // 組織のAPIキーリストに追加
    organization.apiKeyIds.push(newApiKey.id);
    await organization.save();
    
    return res.status(201).json({
      success: true,
      message: 'APIキーが正常に追加されました',
      data: {
        apiKey: newApiKey,
        organization
      }
    });
  } catch (error) {
    console.error('APIキー追加エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'APIキーの追加中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 組織のAPIキーを削除
 * @route DELETE /api/simple/organizations/:id/apikeys/:keyId
 */
exports.removeApiKey = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.params.id;
    const keyId = req.params.keyId;
    
    // 組織を取得
    const organization = await SimpleOrganization.findById(organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: '組織が見つかりません'
      });
    }
    
    // ユーザーの権限チェック
    const user = await SimpleUser.findById(userId);
    
    // SuperAdminまたは組織の作成者のみAPIキー削除可能
    if (!user.isSuperAdmin() && organization.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'この組織からAPIキーを削除する権限がありません'
      });
    }
    
    // APIキーが組織に属しているか確認
    if (!organization.apiKeyIds.includes(keyId)) {
      return res.status(404).json({
        success: false,
        message: '指定されたAPIキーがこの組織に見つかりません'
      });
    }
    
    // APIキーを削除
    await SimpleApiKey.deleteOne({ id: keyId });
    
    // 組織のAPIキーリストから削除
    organization.apiKeyIds = organization.apiKeyIds.filter(id => id !== keyId);
    await organization.save();
    
    // このAPIキーを使用していたユーザーのAPIキー参照をクリア
    await SimpleUser.updateMany(
      { apiKeyId: keyId },
      { $set: { apiKeyId: null } }
    );
    
    return res.status(200).json({
      success: true,
      message: 'APIキーが正常に削除されました',
      data: organization
    });
  } catch (error) {
    console.error('APIキー削除エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'APIキーの削除中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 組織を削除（無効化）
 * @route DELETE /api/simple/organizations/:id
 */
exports.deleteOrganization = async (req, res) => {
  try {
    const userId = req.userId;
    const organizationId = req.params.id;
    
    // 組織を取得
    const organization = await SimpleOrganization.findById(organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: '組織が見つかりません'
      });
    }
    
    // ユーザーの権限チェック
    const user = await SimpleUser.findById(userId);
    
    // SuperAdminまたは組織の作成者のみ削除可能
    if (!user.isSuperAdmin() && organization.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'この組織を削除する権限がありません'
      });
    }
    
    // 組織を無効化（完全削除ではなく）
    organization.status = 'disabled';
    await organization.save();
    
    // 関連するAPIキーも無効化
    await SimpleApiKey.updateMany(
      { organizationId: organization._id },
      { $set: { status: 'disabled' } }
    );
    
    // この組織に属するユーザーの組織参照をクリア
    await SimpleUser.updateMany(
      { organizationId: organization._id },
      { $set: { organizationId: null, apiKeyId: null } }
    );
    
    return res.status(200).json({
      success: true,
      message: '組織が正常に削除されました'
    });
  } catch (error) {
    console.error('組織削除エラー:', error);
    return res.status(500).json({
      success: false,
      message: '組織の削除中にエラーが発生しました',
      error: error.message
    });
  }
};