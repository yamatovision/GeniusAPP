/**
 * シンプルな認証コントローラー
 * ログイン、ログアウト、トークンリフレッシュの処理を行います
 */
const SimpleUser = require('../models/simpleUser.model');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

/**
 * ユーザーログイン
 * @route POST /api/simple/auth/login
 */
exports.login = async (req, res) => {
  try {
    console.log("シンプル認証コントローラー: ログインリクエスト受信");
    const { email, password } = req.body;
    
    // 必須パラメータの検証
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'メールアドレスとパスワードは必須です'
      });
    }
    
    // ユーザーを検索
    const user = await SimpleUser.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    // アカウントが無効化されていないか確認
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    // パスワードを検証
    const isPasswordValid = await user.validatePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: パスワード検証に成功");
    
    // アクセストークンを生成
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtExpiration || '24h' }
    );
    
    // リフレッシュトークンを生成
    const refreshToken = jwt.sign(
      { id: user._id },
      authConfig.refreshTokenSecret,
      { expiresIn: authConfig.refreshTokenExpiration || '7d' }
    );
    
    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    await user.save();
    
    console.log("シンプル認証コントローラー: ログイン成功");
    
    // レスポンス
    return res.status(200).json({
      success: true,
      message: 'ログインに成功しました',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          apiKeyId: user.apiKeyId
        }
      }
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ログイン処理中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * トークンリフレッシュ
 * @route POST /api/simple/auth/refresh-token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'リフレッシュトークンは必須です'
      });
    }
    
    try {
      // リフレッシュトークンを検証
      const decoded = jwt.verify(refreshToken, authConfig.refreshTokenSecret);
      
      // ユーザーを検索
      const user = await SimpleUser.findOne({ 
        _id: decoded.id,
        refreshToken: refreshToken,
        status: 'active'
      });
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '無効なリフレッシュトークンです'
        });
      }
      
      // 新しいアクセストークンを生成
      const newAccessToken = jwt.sign(
        { id: user._id, role: user.role },
        authConfig.jwtSecret,
        { expiresIn: authConfig.jwtExpiration || '24h' }
      );
      
      // 新しいリフレッシュトークンを生成
      const newRefreshToken = jwt.sign(
        { id: user._id },
        authConfig.refreshTokenSecret,
        { expiresIn: authConfig.refreshTokenExpiration || '7d' }
      );
      
      // 新しいリフレッシュトークンをユーザーに保存
      user.refreshToken = newRefreshToken;
      await user.save();
      
      // レスポンス
      return res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (jwtError) {
      // JWTエラー処理
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'リフレッシュトークンの有効期限が切れています'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: '無効なリフレッシュトークンです'
      });
    }
  } catch (error) {
    console.error('トークンリフレッシュエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'トークンリフレッシュ中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ログアウト
 * @route POST /api/simple/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'リフレッシュトークンは必須です'
      });
    }
    
    // ユーザーを検索してリフレッシュトークンをクリア
    const user = await SimpleUser.findOne({ refreshToken });
    
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    
    return res.status(200).json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    console.error('ログアウトエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ログアウト処理中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ユーザー登録
 * @route POST /api/simple/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 必須パラメータの検証
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名、メールアドレス、パスワードは必須です'
      });
    }
    
    // パスワード強度の検証
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'パスワードは8文字以上である必要があります'
      });
    }
    
    // メールアドレスの重複チェック
    const existingUser = await SimpleUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'このメールアドレスは既に使用されています'
      });
    }
    
    // ユーザー数の確認（最初のユーザーはSuperAdminに設定）
    const userCount = await SimpleUser.countDocuments();
    const role = userCount === 0 ? 'SuperAdmin' : 'User';
    
    // 新しいユーザーを作成
    const newUser = new SimpleUser({
      name,
      email: email.toLowerCase(),
      password,
      role,
      status: 'active'
    });
    
    // 保存
    await newUser.save();
    
    // アクセストークンを生成
    const accessToken = jwt.sign(
      { id: newUser._id, role: newUser.role },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtExpiration || '24h' }
    );
    
    // リフレッシュトークンを生成
    const refreshToken = jwt.sign(
      { id: newUser._id },
      authConfig.refreshTokenSecret,
      { expiresIn: authConfig.refreshTokenExpiration || '7d' }
    );
    
    // リフレッシュトークンをユーザーに保存
    newUser.refreshToken = refreshToken;
    await newUser.save();
    
    // レスポンス
    return res.status(201).json({
      success: true,
      message: 'ユーザー登録に成功しました',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      }
    });
  } catch (error) {
    console.error('ユーザー登録エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザー登録中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 認証チェック
 * @route GET /api/simple/auth/check
 */
exports.checkAuth = async (req, res) => {
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
    
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          apiKeyId: user.apiKeyId
        }
      }
    });
  } catch (error) {
    console.error('認証チェックエラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証チェック中にエラーが発生しました',
      error: error.message
    });
  }
};