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
    const { page = 1, limit = 10, search = '', role } = req.query;
    
    // 管理者権限チェック - JWTから直接取得したroleを使用
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
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
    // 管理者権限チェック - JWTから直接取得したroleを使用
    if (req.userRole !== authConfig.roles.ADMIN) {
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

// ユーザーのトークン使用量を取得
exports.getUserTokenUsage = async (req, res) => {
  try {
    const userId = req.params.id || req.userId;
    
    // 他のユーザーの使用量を取得する場合は管理者権限が必要
    if (userId !== req.userId && req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({ 
        error: {
          code: 'PERMISSION_DENIED',
          message: '他のユーザーの使用量を確認する権限がありません'
        } 
      });
    }
    
    // クエリパラメータから期間を取得
    const { period, interval = 'day' } = req.query;
    
    // 期間指定
    let timeRange = {};
    const now = new Date();
    
    switch (period) {
      case 'today':
        timeRange.start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        timeRange.start = yesterday;
        timeRange.end = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        timeRange.start = lastWeek;
        break;
      case 'month':
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        timeRange.start = lastMonth;
        break;
      case 'year':
        const lastYear = new Date(now);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        timeRange.start = lastYear;
        break;
      case 'custom':
        if (req.query.start) timeRange.start = new Date(req.query.start);
        if (req.query.end) timeRange.end = new Date(req.query.end);
        break;
      default: // 'all' またはデフォルト
        // 期間指定なし（全期間）
        break;
    }
    
    const PromptUsage = require('../models/promptUsage.model');
    const ApiUsage = require('../models/apiUsage.model');
    
    // 統計データ取得
    const [overallStats, timeSeriesData, apiUsageStats] = await Promise.all([
      // プロンプト使用量全体統計
      PromptUsage.getUserTokenUsage(userId, timeRange),
      // 時系列データ
      PromptUsage.getUserTimeSeriesStats(userId, interval),
      // API使用量（Claude API経由の利用）
      ApiUsage.getUserTokenUsage(userId, timeRange)
    ]);
    
    // ユーザー情報も取得
    const user = await User.findById(userId).select('name email role plan apiAccess usageLimits').lean();
    
    // 合計使用量を計算
    const totalStats = {
      totalTokens: (overallStats?.totalTokens || 0) + (apiUsageStats?.totalTokens || 0),
      inputTokens: (overallStats?.inputTokens || 0) + (apiUsageStats?.inputTokens || 0),
      outputTokens: (overallStats?.outputTokens || 0) + (apiUsageStats?.outputTokens || 0),
      requests: (overallStats?.count || 0) + (apiUsageStats?.count || 0)
    };
    
    res.json({
      user,
      overall: totalStats,
      bySource: {
        promptUsage: overallStats,
        apiUsage: apiUsageStats
      },
      timeSeries: timeSeriesData,
      limits: {
        daily: user?.usageLimits?.tokensPerDay || null,
        monthly: user?.usageLimits?.tokensPerMonth || user?.plan?.tokenLimit || 100000,
        nextReset: user?.plan?.nextResetDate
      }
    });
  } catch (error) {
    console.error('ユーザートークン使用量取得エラー:', error);
    res.status(500).json({ message: 'トークン使用量の取得中にエラーが発生しました' });
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