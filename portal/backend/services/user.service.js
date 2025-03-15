/**
 * ユーザー管理サービス
 * ユーザー関連の操作を行うサービス層
 */
const User = require('../models/user.model');
const authConfig = require('../config/auth.config');

/**
 * 指定したクエリに基づいてユーザー一覧を取得する
 */
exports.getUsers = async (query, options = {}) => {
  // デフォルトのオプション
  const { 
    page = 1, 
    limit = 10, 
    sort = { createdAt: -1 },
    select = '-password -refreshToken'
  } = options;
  
  try {
    // ページネーションを適用してユーザーリストを取得
    const users = await User.find(query)
      .select(select)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();
    
    // 総件数を取得
    const total = await User.countDocuments(query);
    
    return {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 指定したIDのユーザーを取得する
 */
exports.getUserById = async (userId, select = '-password -refreshToken') => {
  try {
    return await User.findById(userId).select(select);
  } catch (error) {
    throw error;
  }
};

/**
 * メールアドレスでユーザーを検索する
 */
exports.getUserByEmail = async (email, select = '-password -refreshToken') => {
  try {
    return await User.findOne({ 
      email: email.toLowerCase() 
    }).select(select);
  } catch (error) {
    throw error;
  }
};

/**
 * 新規ユーザーを作成する
 */
exports.createUser = async (userData) => {
  try {
    // 既存ユーザーの有無を確認
    const existingUser = await User.findOne({ 
      email: userData.email.toLowerCase() 
    });
    
    if (existingUser) {
      throw new Error('このメールアドレスは既に使用されています');
    }
    
    // 新規ユーザーを作成
    const newUser = new User({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role || authConfig.roles.USER
    });
    
    // ユーザーを保存
    await newUser.save();
    
    // パスワードとリフレッシュトークンを除いたユーザー情報を返す
    return newUser.toJSON();
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザー情報を更新する
 */
exports.updateUser = async (userId, userData, currentUser) => {
  try {
    // 更新対象のユーザーを取得
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // 権限チェック：自分自身または管理者のみ許可
    if (currentUser.userId !== userId && currentUser.role !== authConfig.roles.ADMIN) {
      throw new Error('他のユーザー情報を更新する権限がありません');
    }
    
    // メールアドレス変更時の重複チェック
    if (userData.email && userData.email !== user.email) {
      const existingUser = await User.findOne({ 
        email: userData.email.toLowerCase() 
      });
      
      if (existingUser) {
        throw new Error('このメールアドレスは既に使用されています');
      }
      
      user.email = userData.email;
    }
    
    // 各フィールドを更新（指定された場合のみ）
    if (userData.name) user.name = userData.name;
    if (userData.password) user.password = userData.password;
    
    // 管理者のみがロールと有効フラグを変更可能
    if (currentUser.role === authConfig.roles.ADMIN) {
      if (userData.role) user.role = userData.role;
      if (userData.isActive !== undefined) user.isActive = userData.isActive;
    }
    
    // ユーザー情報を保存
    await user.save();
    
    // パスワードとリフレッシュトークンを除いたユーザー情報を返す
    return user.toJSON();
  } catch (error) {
    throw error;
  }
};

/**
 * プロフィール情報を更新する
 */
exports.updateProfile = async (userId, profileData) => {
  try {
    // ユーザーを取得
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // メールアドレス変更時の重複チェック
    if (profileData.email && profileData.email !== user.email) {
      const existingUser = await User.findOne({ 
        email: profileData.email.toLowerCase() 
      });
      
      if (existingUser) {
        throw new Error('このメールアドレスは既に使用されています');
      }
      
      user.email = profileData.email;
    }
    
    // 名前の更新
    if (profileData.name) user.name = profileData.name;
    
    // パスワード変更の処理
    if (profileData.newPassword) {
      // 現在のパスワードを確認
      if (!profileData.currentPassword) {
        throw new Error('現在のパスワードを入力してください');
      }
      
      const isPasswordValid = await user.validatePassword(profileData.currentPassword);
      if (!isPasswordValid) {
        throw new Error('現在のパスワードが正しくありません');
      }
      
      // 新しいパスワードをセット
      user.password = profileData.newPassword;
    }
    
    // ユーザー情報を保存
    await user.save();
    
    // パスワードとリフレッシュトークンを除いたユーザー情報を返す
    return user.toJSON();
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザーを削除する
 */
exports.deleteUser = async (userId, currentUser) => {
  try {
    // 削除対象のユーザーを確認
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // 管理者権限チェック
    if (currentUser.role !== authConfig.roles.ADMIN) {
      throw new Error('ユーザーを削除する権限がありません');
    }
    
    // 管理者が自分自身を削除しようとしていないか確認
    if (userId === currentUser.userId) {
      throw new Error('自分自身を削除することはできません');
    }
    
    // ユーザーを削除
    await User.findByIdAndDelete(userId);
    
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザー統計情報を取得
 */
exports.getUserStats = async () => {
  try {
    // 総ユーザー数
    const totalUsers = await User.countDocuments();
    
    // ユーザー種別ごとの数
    const adminCount = await User.countDocuments({ role: authConfig.roles.ADMIN });
    const userCount = await User.countDocuments({ role: authConfig.roles.USER });
    
    // アクティブユーザー数
    const activeUsers = await User.countDocuments({ isActive: true });
    
    // 最近追加されたユーザー (過去30日間)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // 最近ログインしたユーザー (過去7日間)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLogins = await User.countDocuments({
      lastLogin: { $gte: sevenDaysAgo }
    });
    
    return {
      totalUsers,
      adminCount,
      userCount,
      activeUsers,
      newUsers,
      recentLogins
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 最終ログイン日時を更新する
 */
exports.updateLastLogin = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      lastLogin: new Date()
    });
    return true;
  } catch (error) {
    throw error;
  }
};