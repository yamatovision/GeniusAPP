/**
 * ユーザー管理コントローラ
 * ユーザーの一覧取得、詳細表示、作成、更新、削除などの操作を提供
 */
const User = require('../models/user.model');
const authConfig = require('../config/auth.config');
const { ValidationError } = require('mongoose').Error;

// ユーザー一覧を取得
exports.getUsers = async (req, res) => {
  try {
    // クエリパラメータから取得（ページネーション、検索など）
    const { page = 1, limit = 10, search = '', role, forOrganization, organizationId } = req.query;
    
    // 組織管理者向け権限チェック
    if (forOrganization === 'true' && organizationId) {
      const Organization = require('../models/organization.model');
      const organization = await Organization.findById(organizationId);
      
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }
      
      // 組織管理者かどうかを確認
      const isOrgAdmin = organization.isAdmin(req.userId);
      
      if (isOrgAdmin) {
        // 組織メンバーIDのリスト取得
        const memberIds = organization.members.map(m => 
          m.userId instanceof mongoose.Types.ObjectId ? m.userId : m.userId._id
        );
        
        // メンバーの詳細情報を取得
        let membersQuery = { _id: { $in: memberIds } };
        
        // 検索条件を適用
        if (search) {
          membersQuery.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ];
        }
        
        // 役割でフィルタリング（組織内での役割ではなくグローバルな役割）
        if (role) {
          membersQuery.role = role;
        }
        
        try {
          // ユーザー総数をカウント
          const total = await User.countDocuments(membersQuery);
          
          // ユーザー一覧を取得
          const users = await User.find(membersQuery)
            .select('-password -refreshToken')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .exec();
          
          // 組織内の役割情報を付加
          const usersWithRoles = users.map(user => {
            const member = organization.members.find(m => 
              (m.userId._id || m.userId).toString() === user._id.toString()
            );
            
            const userData = user.toObject();
            userData.organizationRole = member ? member.role : null;
            
            return userData;
          });
          
          // レスポンスの構築
          return res.status(200).json({
            users: usersWithRoles,
            pagination: {
              total,
              page: parseInt(page),
              pages: Math.ceil(total / limit),
              limit: parseInt(limit)
            },
            organization: {
              id: organization._id,
              name: organization.name
            }
          });
        } catch (dbError) {
          console.error("組織メンバー取得エラー:", dbError);
          return res.status(500).json({ error: '組織メンバー情報の取得に失敗しました' });
        }
      } else {
        return res.status(403).json({
          error: {
            code: 'PERMISSION_DENIED',
            message: 'この組織のユーザー一覧を取得する権限がありません'
          }
        });
      }
    }
    
    // 通常のユーザー一覧取得（スーパー管理者のみ）
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: 'スーパー管理者権限が必要です'
        }
      });
    }
    
    try {
      // 検索条件の構築
      const query = {};
      
      // 検索語句がある場合は名前とメールアドレスで部分一致検索
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      // 権限で絞り込み（指定がある場合）
      if (role && (role === authConfig.roles.USER || role === authConfig.roles.ADMIN)) {
        query.role = role;
      }
      
      // ユーザー総数をカウント
      const total = await User.countDocuments(query);
      
      // ユーザー一覧を取得（パスワードとリフレッシュトークンは除外）
      const users = await User.find(query)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec();
      
      // レスポンスの構築
      return res.status(200).json({
        users,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      });
    } catch (dbError) {
      console.error("MongoDB取得エラー:", dbError);
      
      try {
        // データベースからの取得に失敗した場合は、単純なfindを試す
        const actualUsers = await User.find().select('-password -refreshToken');
        
        // ページネーション計算
        const total = actualUsers.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedUsers = actualUsers.slice(startIndex, endIndex);
        
        // レスポンスの構築
        return res.status(200).json({
          users: paginatedUsers,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            limit: parseInt(limit)
          }
        });
      } catch (fallbackError) {
        // フォールバックも失敗した場合は元のエラーを投げる
        throw dbError;
      }
    }
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました',
        details: error.message
      }
    });
  }
};

// 特定のユーザー詳細を取得
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('ユーザー詳細取得エラー:', error);
    res.status(500).json({ message: 'ユーザー詳細の取得に失敗しました' });
  }
};

// 現在ログイン中のユーザー情報を取得
exports.getCurrentUser = async (req, res) => {
  try {
    // リクエストからユーザーIDを取得（認証ミドルウェアから）
    const userId = req.userId;
    
    const user = await User.findById(userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('現在のユーザー取得エラー:', error);
    res.status(500).json({ message: 'ユーザー情報の取得に失敗しました' });
  }
};

// 新規ユーザー作成 (管理者向け)
exports.createUser = async (req, res) => {
  try {
    // リクエストボディからユーザー情報を取得
    const { name, email, password, role } = req.body;
    
    // 既存のユーザーがいないか確認
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'このメールアドレスは既に使用されています' });
    }
    
    // 新規ユーザーを作成
    const newUser = new User({
      name,
      email,
      password,
      role: role && req.userRole === authConfig.roles.ADMIN ? role : authConfig.roles.USER
    });
    
    // ユーザーを保存
    await newUser.save();
    
    // パスワードとリフレッシュトークンを除いたユーザー情報を返す
    const userResponse = newUser.toJSON();
    
    res.status(201).json({
      message: 'ユーザーが正常に作成されました',
      user: userResponse
    });
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    
    // バリデーションエラーの場合は詳細を返す
    if (error instanceof ValidationError) {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'バリデーションエラー', errors });
    }
    
    res.status(500).json({ message: 'ユーザーの作成に失敗しました' });
  }
};

// ユーザー情報の更新
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 更新対象のユーザーを取得
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    // 権限チェック：自分自身または管理者のみ許可
    if (req.userId !== userId && req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({ message: '他のユーザー情報を更新する権限がありません' });
    }
    
    // リクエストボディから更新情報を取得
    const { name, email, password, role } = req.body;
    
    // メールアドレス変更時の重複チェック
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'このメールアドレスは既に使用されています' });
      }
      user.email = email;
    }
    
    // 各フィールドを更新（指定された場合のみ）
    if (name) user.name = name;
    if (password) user.password = password;
    
    // 管理者のみがロールを変更可能
    if (req.userRole === authConfig.roles.ADMIN) {
      if (role) user.role = role;
    }
    
    // ユーザー情報を保存
    await user.save();
    
    // パスワードとリフレッシュトークンを除いたユーザー情報を返す
    const userResponse = user.toJSON();
    
    res.status(200).json({
      message: 'ユーザー情報が正常に更新されました',
      user: userResponse
    });
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    
    // バリデーションエラーの場合は詳細を返す
    if (error instanceof ValidationError) {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'バリデーションエラー', errors });
    }
    
    res.status(500).json({ message: 'ユーザー情報の更新に失敗しました' });
  }
};

// ユーザーの削除 (管理者向け)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 削除対象のユーザーを確認
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({ message: 'ユーザーを削除する権限がありません' });
    }
    
    // 管理者が自分自身を削除しようとしていないか確認
    if (userId === req.userId) {
      return res.status(400).json({ message: '自分自身を削除することはできません' });
    }
    
    // ユーザーを削除
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({ message: 'ユーザーが正常に削除されました' });
  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    res.status(500).json({ message: 'ユーザーの削除に失敗しました' });
  }
};

// ユーザー統計情報を取得 (管理者向け)
exports.getUserStats = async (req, res) => {
  try {
    // スーパー管理者権限チェック - JWTから直接取得したroleを使用
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '統計情報を取得する権限がありません'
        }
      });
    }
    
    // 実際のMongoDBからデータを取得
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
      
      res.status(200).json({
        totalUsers,
        adminCount,
        userCount,
        activeUsers,
        newUsers,
        recentLogins
      });
    } catch (dbError) {
      console.error("MongoDB取得エラー:", dbError);
      try {
        // データベースアクセスに失敗した場合は基本的なクエリでデータを取得
        const totalUsers = await User.countDocuments();
        const adminCount = await User.countDocuments({ role: 'admin' });
        const userCount = totalUsers - adminCount;
        const activeUsers = await User.countDocuments({ isActive: true });
        const newUsers = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
        const recentLogins = await User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } });
        
        res.status(200).json({
          totalUsers,
          adminCount,
          userCount,
          activeUsers,
          newUsers,
          recentLogins
        });
      } catch (fallbackError) {
        // フォールバックも失敗した場合は元のエラーを投げる
        throw dbError;
      }
    }
  } catch (error) {
    console.error('ユーザー統計取得エラー:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました',
        details: error.message
      }
    });
  }
};

// プロフィール設定の更新
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    
    // ユーザーを取得
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    // リクエストボディから更新情報を取得
    const { name, email, currentPassword, newPassword } = req.body;
    
    // メールアドレス変更時の重複チェック
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'このメールアドレスは既に使用されています' });
      }
      user.email = email;
    }
    
    // 名前の更新
    if (name) user.name = name;
    
    // パスワード変更の処理
    if (newPassword) {
      // 現在のパスワードを確認
      if (!currentPassword) {
        return res.status(400).json({ message: '現在のパスワードを入力してください' });
      }
      
      const isPasswordValid = await user.validatePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(400).json({ message: '現在のパスワードが正しくありません' });
      }
      
      // 新しいパスワードをセット
      user.password = newPassword;
    }
    
    // ユーザー情報を保存
    await user.save();
    
    // パスワードとリフレッシュトークンを除いたユーザー情報を返す
    const userResponse = user.toJSON();
    
    res.status(200).json({
      message: 'プロフィールが正常に更新されました',
      user: userResponse
    });
  } catch (error) {
    console.error('プロフィール更新エラー:', error);
    
    // バリデーションエラーの場合は詳細を返す
    if (error instanceof ValidationError) {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'バリデーションエラー', errors });
    }
    
    res.status(500).json({ message: 'プロフィールの更新に失敗しました' });
  }
};


// ユーザーのAPIアクセス設定を更新
exports.toggleApiAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled, accessLevel } = req.body;
    
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: 'APIアクセス設定を変更する権限がありません'
        }
      });
    }
    
    // ユーザーを取得
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    // APIアクセス設定を更新
    if (!user.apiAccess) {
      user.apiAccess = {};
    }
    
    // enabledフラグが指定されている場合は更新
    if (enabled !== undefined) {
      user.apiAccess.enabled = enabled;
    }
    
    // accessLevelが指定されている場合は更新（値チェック付き）
    if (accessLevel && ['basic', 'advanced', 'full'].includes(accessLevel)) {
      user.apiAccess.accessLevel = accessLevel;
    }
    
    // 最終アクセス更新日時を設定
    user.apiAccess.lastAccessAt = new Date();
    
    await user.save();
    
    return res.status(200).json({
      message: `APIアクセスが${user.apiAccess.enabled ? '有効' : '無効'}に設定されました`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        apiAccess: user.apiAccess
      }
    });
  } catch (error) {
    console.error('APIアクセス設定変更エラー:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'APIアクセス設定の変更中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

// ユーザーの一時停止/復旧（管理者向け）
exports.suspendUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { suspend } = req.body; // true: 一時停止, false: 復旧
    
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({ message: 'ユーザーを一時停止する権限がありません' });
    }
    
    // ユーザーを取得
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    // 自分自身を一時停止しようとしていないか確認
    if (userId === req.userId) {
      return res.status(400).json({ message: '自分自身を一時停止することはできません' });
    }
    
    // アカウントステータスを更新
    user.accountStatus = suspend ? 'suspended' : 'active';
    
    // 一時停止の場合、リフレッシュトークンを無効化（強制ログアウト）
    if (suspend) {
      user.refreshToken = undefined;
    }
    
    await user.save();
    
    return res.status(200).json({
      message: `ユーザーが${suspend ? '一時停止' : '復旧'}されました`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus
      }
    });
  } catch (error) {
    console.error('ユーザー一時停止エラー:', error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザーの一時停止/復旧中にエラーが発生しました',
        details: error.message
      }
    });
  }
};