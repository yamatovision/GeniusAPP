/**
 * シンプルなユーザー管理コントローラー
 * ユーザーの作成、取得、更新、削除を行います
 */
const SimpleUser = require('../models/simpleUser.model');
const SimpleOrganization = require('../models/simpleOrganization.model');
const SimpleApiKey = require('../models/simpleApiKey.model');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

/**
 * ユーザー一覧を取得
 * @route GET /api/simple/users
 */
exports.getUsers = async (req, res) => {
  try {
    const userId = req.userId;
    
    // ユーザーのロールを確認
    const currentUser = await SimpleUser.findById(userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    let users;
    
    // SuperAdminはすべてのユーザーを取得可能
    if (currentUser.isSuperAdmin()) {
      users = await SimpleUser.find({}, '-password -refreshToken');
    } 
    // Adminは自分の組織のユーザーのみ取得可能
    else if (currentUser.isAdmin() && currentUser.organizationId) {
      users = await SimpleUser.find(
        { organizationId: currentUser.organizationId },
        '-password -refreshToken'
      );
    } 
    // 一般ユーザーは自分の情報のみ取得可能
    else {
      users = [await SimpleUser.findById(userId, '-password -refreshToken')];
    }
    
    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザー一覧の取得中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 特定のユーザーを取得
 * @route GET /api/simple/users/:id
 */
exports.getUser = async (req, res) => {
  try {
    const requesterId = req.userId;
    const targetId = req.params.id;
    
    // リクエスト実行者の情報を取得
    const requester = await SimpleUser.findById(requesterId);
    
    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 対象ユーザーの情報を取得
    const targetUser = await SimpleUser.findById(targetId, '-password -refreshToken');
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '対象ユーザーが見つかりません'
      });
    }
    
    // アクセス権チェック
    // 1. SuperAdminは全てのユーザー情報にアクセス可能
    // 2. Adminは自分の組織のユーザー情報にアクセス可能
    // 3. 一般ユーザーは自分の情報のみアクセス可能
    const hasSuperAdminAccess = requester.isSuperAdmin();
    const hasAdminAccess = requester.isAdmin() && 
                          requester.organizationId && 
                          targetUser.organizationId && 
                          requester.organizationId.toString() === targetUser.organizationId.toString();
    const hasSelfAccess = requesterId === targetId;
    
    if (!hasSuperAdminAccess && !hasAdminAccess && !hasSelfAccess) {
      return res.status(403).json({
        success: false,
        message: 'このユーザー情報へのアクセス権限がありません'
      });
    }
    
    // 組織情報を取得（必要に応じて）
    let organization = null;
    if (targetUser.organizationId) {
      organization = await SimpleOrganization.findById(targetUser.organizationId);
    }
    
    // APIキー情報を取得（必要に応じて）
    let apiKey = null;
    if (targetUser.apiKeyId) {
      apiKey = await SimpleApiKey.findOne({ id: targetUser.apiKeyId });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        user: targetUser,
        organization,
        apiKey: apiKey ? {
          id: apiKey.id,
          status: apiKey.status,
          organizationId: apiKey.organizationId
        } : null
      }
    });
  } catch (error) {
    console.error('ユーザー取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザーの取得中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 新しいユーザーを作成
 * @route POST /api/simple/users
 */
exports.createUser = async (req, res) => {
  try {
    const requesterId = req.userId;
    const { name, email, password, role, organizationId, apiKeyId } = req.body;
    
    // 必須フィールドの検証
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名、メールアドレス、パスワードは必須です'
      });
    }
    
    // リクエスト実行者の権限チェック
    const requester = await SimpleUser.findById(requesterId);
    
    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // SuperAdminのみが他のSuperAdminを作成可能
    if (role === 'SuperAdmin' && !requester.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: 'SuperAdminユーザーを作成する権限がありません'
      });
    }
    
    // 組織管理者のみが自分の組織にユーザーを追加可能
    if (organizationId && !requester.isSuperAdmin()) {
      const organization = await SimpleOrganization.findById(organizationId);
      
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: '指定された組織が見つかりません'
        });
      }
      
      // 管理者で、かつ同じ組織に所属しているか確認
      if (!requester.isAdmin() || 
          requester.organizationId?.toString() !== organizationId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'この組織にユーザーを追加する権限がありません'
        });
      }
    }
    
    // メールアドレスの重複チェック
    const existingUser = await SimpleUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'このメールアドレスは既に使用されています'
      });
    }
    
    // APIキーの存在と有効性を確認
    if (apiKeyId) {
      const apiKey = await SimpleApiKey.findOne({ id: apiKeyId });
      
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: '指定されたAPIキーが見つかりません'
        });
      }
      
      if (apiKey.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: '指定されたAPIキーは無効です'
        });
      }
      
      // 組織が一致しているか確認
      if (organizationId && apiKey.organizationId &&
          apiKey.organizationId.toString() !== organizationId.toString()) {
        return res.status(400).json({
          success: false,
          message: '指定されたAPIキーは別の組織に属しています'
        });
      }
    }
    
    // 新しいユーザーを作成
    const newUser = new SimpleUser({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'User',
      organizationId: organizationId || null,
      apiKeyId: apiKeyId || null,
      status: 'active'
    });
    
    // 保存
    await newUser.save();
    
    // パスワードを含まない形で返す
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;
    
    return res.status(201).json({
      success: true,
      message: 'ユーザーが正常に作成されました',
      data: userResponse
    });
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザーの作成中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ユーザーを更新
 * @route PUT /api/simple/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const requesterId = req.userId;
    const targetId = req.params.id;
    const { name, email, password, role, organizationId, apiKeyId, status } = req.body;
    
    // 更新対象のユーザーを取得
    const targetUser = await SimpleUser.findById(targetId);
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // リクエスト実行者の権限チェック
    const requester = await SimpleUser.findById(requesterId);
    
    // アクセス権チェック
    const hasSuperAdminAccess = requester.isSuperAdmin();
    const hasAdminAccess = requester.isAdmin() && 
                          requester.organizationId && 
                          targetUser.organizationId && 
                          requester.organizationId.toString() === targetUser.organizationId.toString();
    const hasSelfAccess = requesterId === targetId;
    
    if (!hasSuperAdminAccess && !hasAdminAccess && !hasSelfAccess) {
      return res.status(403).json({
        success: false,
        message: 'このユーザーを更新する権限がありません'
      });
    }
    
    // SuperAdminのみが他のSuperAdminを更新可能
    if (role === 'SuperAdmin' && !requester.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: 'SuperAdminユーザーを更新する権限がありません'
      });
    }
    
    // ユーザーのロールをSuperAdmin以外に変更するには、自身がSuperAdminである必要がある
    if (targetUser.role === 'SuperAdmin' && role !== 'SuperAdmin' && !requester.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: 'SuperAdminユーザーのロールを変更する権限がありません'
      });
    }
    
    // 組織IDを変更する場合
    if (organizationId && organizationId !== targetUser.organizationId?.toString()) {
      // SuperAdminまたは管理者のみが組織を変更可能
      if (!hasSuperAdminAccess && !hasAdminAccess) {
        return res.status(403).json({
          success: false,
          message: 'ユーザーの組織を変更する権限がありません'
        });
      }
      
      // 組織の存在チェック
      const organization = await SimpleOrganization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: '指定された組織が見つかりません'
        });
      }
    }
    
    // APIキーを変更する場合
    if (apiKeyId && apiKeyId !== targetUser.apiKeyId) {
      // SuperAdminまたは管理者のみがAPIキーを変更可能
      if (!hasSuperAdminAccess && !hasAdminAccess) {
        return res.status(403).json({
          success: false,
          message: 'ユーザーのAPIキーを変更する権限がありません'
        });
      }
      
      // APIキーの存在と有効性を確認
      const apiKey = await SimpleApiKey.findOne({ id: apiKeyId });
      
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: '指定されたAPIキーが見つかりません'
        });
      }
      
      if (apiKey.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: '指定されたAPIキーは無効です'
        });
      }
      
      // 組織が一致しているか確認
      if (organizationId || targetUser.organizationId) {
        const orgId = organizationId || targetUser.organizationId;
        if (apiKey.organizationId &&
            apiKey.organizationId.toString() !== orgId.toString()) {
          return res.status(400).json({
            success: false,
            message: '指定されたAPIキーは別の組織に属しています'
          });
        }
      }
    }
    
    // メールアドレスの重複チェック
    if (email && email.toLowerCase() !== targetUser.email) {
      const existingUser = await SimpleUser.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'このメールアドレスは既に使用されています'
        });
      }
    }
    
    // フィールドを更新
    if (name) targetUser.name = name;
    if (email) targetUser.email = email.toLowerCase();
    if (password) targetUser.password = password;
    if (role && (hasSuperAdminAccess || (hasAdminAccess && role !== 'SuperAdmin'))) {
      targetUser.role = role;
    }
    if (organizationId && (hasSuperAdminAccess || hasAdminAccess)) {
      targetUser.organizationId = organizationId;
    }
    if (apiKeyId && (hasSuperAdminAccess || hasAdminAccess)) {
      targetUser.apiKeyId = apiKeyId;
    }
    if (status && (hasSuperAdminAccess || hasAdminAccess)) {
      targetUser.status = status;
    }
    
    // 保存
    await targetUser.save();
    
    // パスワードを含まない形で返す
    const userResponse = targetUser.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;
    
    return res.status(200).json({
      success: true,
      message: 'ユーザーが正常に更新されました',
      data: userResponse
    });
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザーの更新中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ユーザーを削除（無効化）
 * @route DELETE /api/simple/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const requesterId = req.userId;
    const targetId = req.params.id;
    
    // 削除対象のユーザーを取得
    const targetUser = await SimpleUser.findById(targetId);
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // リクエスト実行者の権限チェック
    const requester = await SimpleUser.findById(requesterId);
    
    // アクセス権チェック
    const hasSuperAdminAccess = requester.isSuperAdmin();
    const hasAdminAccess = requester.isAdmin() && 
                          requester.organizationId && 
                          targetUser.organizationId && 
                          requester.organizationId.toString() === targetUser.organizationId.toString();
    
    if (!hasSuperAdminAccess && !hasAdminAccess) {
      return res.status(403).json({
        success: false,
        message: 'このユーザーを削除する権限がありません'
      });
    }
    
    // SuperAdminの削除は他のSuperAdminのみが可能
    if (targetUser.role === 'SuperAdmin' && !requester.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: 'SuperAdminユーザーを削除する権限がありません'
      });
    }
    
    // 自分自身を削除することはできない
    if (targetId === requesterId) {
      return res.status(400).json({
        success: false,
        message: '自分自身を削除することはできません'
      });
    }
    
    // ユーザーを無効化（完全削除ではなく）
    targetUser.status = 'disabled';
    targetUser.refreshToken = null;
    await targetUser.save();
    
    return res.status(200).json({
      success: true,
      message: 'ユーザーが正常に削除されました'
    });
  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザーの削除中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ユーザープロフィールを取得
 * @route GET /api/simple/users/profile
 */
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    
    // ユーザー情報を取得
    const user = await SimpleUser.findById(userId, '-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 組織情報を取得（必要に応じて）
    let organization = null;
    if (user.organizationId) {
      organization = await SimpleOrganization.findById(user.organizationId);
    }
    
    // APIキー情報を取得（必要に応じて）
    let apiKey = null;
    if (user.apiKeyId) {
      apiKey = await SimpleApiKey.findOne({ id: user.apiKeyId });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        user,
        organization,
        apiKey: apiKey ? {
          id: apiKey.id,
          status: apiKey.status
        } : null
      }
    });
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'プロフィールの取得中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * パスワード変更
 * @route PUT /api/simple/users/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '現在のパスワードと新しいパスワードは必須です'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: '新しいパスワードは8文字以上である必要があります'
      });
    }
    
    // ユーザー情報を取得
    const user = await SimpleUser.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 現在のパスワードを検証
    const isPasswordValid = await user.validatePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '現在のパスワードが正しくありません'
      });
    }
    
    // 新しいパスワードを設定
    user.password = newPassword;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'パスワードが正常に変更されました'
    });
  } catch (error) {
    console.error('パスワード変更エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'パスワードの変更中にエラーが発生しました',
      error: error.message
    });
  }
};