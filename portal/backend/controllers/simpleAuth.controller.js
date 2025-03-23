/**
 * シンプルな認証コントローラー
 * ログイン、ログアウト、トークンリフレッシュの処理を行います
 */
const SimpleUser = require('../models/simpleUser.model');
const jwt = require('jsonwebtoken');
// 通常の認証設定ではなく、専用の設定ファイルを使用
const simpleAuthConfig = require('../config/simple-auth.config');
// 認証ヘルパーを追加
const authHelper = require('../utils/simpleAuth.helper');

/**
 * ユーザーログイン
 * @route POST /api/simple/auth/login
 */
exports.login = async (req, res) => {
  try {
    console.log("シンプル認証コントローラー: ログインリクエスト受信");
    console.log("リクエストボディ:", req.body);
    console.log("リクエストヘッダー:", {
      contentType: req.headers['content-type'],
      accept: req.headers['accept'],
      origin: req.headers['origin'],
      referer: req.headers['referer']
    });
    
    const { email, password } = req.body;
    
    // 必須パラメータの検証
    if (!email || !password) {
      console.log("シンプル認証コントローラー: 必須パラメータ欠如");
      return res.status(400).json({
        success: false,
        message: 'メールアドレスとパスワードは必須です'
      });
    }
    
    // ユーザーを検索
    console.log("シンプル認証コントローラー: ユーザー検索", email);
    const user = await SimpleUser.findByEmail(email);
    
    if (!user) {
      console.log("シンプル認証コントローラー: ユーザーが見つかりません");
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: ユーザー見つかりました", user.name);
    
    // アカウントが無効化されていないか確認
    if (user.status !== 'active') {
      console.log("シンプル認証コントローラー: アカウント無効", user.status);
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    // パスワードを検証
    console.log("シンプル認証コントローラー: パスワード検証開始");
    const isPasswordValid = await user.validatePassword(password);
    
    if (!isPasswordValid) {
      console.log("シンプル認証コントローラー: パスワード不一致");
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: パスワード検証に成功");
    
    // Simple認証専用のアクセストークンを生成
    console.log("シンプル認証コントローラー: トークン生成開始");
    console.log("シンプル認証コントローラー: シークレットキー", {
      secret: simpleAuthConfig.jwtSecret.substring(0, 5) + '...',
      issuer: simpleAuthConfig.jwtOptions.issuer,
      audience: simpleAuthConfig.jwtOptions.audience
    });
    
    // ヘルパー関数を使用してトークンを生成
    const accessToken = authHelper.generateAccessToken(user._id, user.role);
    
    // ヘルパー関数を使用してリフレッシュトークンを生成
    const refreshToken = authHelper.generateRefreshToken(user._id);
    
    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    await user.save();
    
    console.log("シンプル認証コントローラー: ログイン成功");
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
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
    console.log('refreshToken: リフレッシュトークン処理開始');
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      console.log('refreshToken: リフレッシュトークンがリクエストに含まれていません');
      return res.status(400).json({
        success: false,
        message: 'リフレッシュトークンは必須です'
      });
    }
    
    try {
      // ヘルパー関数を使用してリフレッシュトークンを検証
      console.log('refreshToken: トークン検証開始');
      const decoded = authHelper.verifyRefreshToken(refreshToken);
      console.log('refreshToken: トークン検証成功', { id: decoded.id });
      
      // ユーザーを検索
      console.log('refreshToken: ユーザー検索開始');
      const user = await SimpleUser.findOne({ 
        _id: decoded.id,
        refreshToken: refreshToken,
        status: 'active'
      });
      
      if (!user) {
        console.log('refreshToken: ユーザーが見つかりません');
        return res.status(401).json({
          success: false,
          message: '無効なリフレッシュトークンです'
        });
      }
      
      console.log('refreshToken: ユーザー見つかりました', { id: user._id, role: user.role });
      
      // ヘルパーを使用して新しいアクセストークンを生成
      console.log('refreshToken: 新しいアクセストークン生成');
      const newAccessToken = authHelper.generateAccessToken(user._id, user.role);
      
      // ヘルパーを使用して新しいリフレッシュトークンを生成
      console.log('refreshToken: 新しいリフレッシュトークン生成');
      const newRefreshToken = authHelper.generateRefreshToken(user._id);
      
      // 新しいリフレッシュトークンをユーザーに保存
      console.log('refreshToken: ユーザーにトークン保存');
      user.refreshToken = newRefreshToken;
      await user.save();
      
      // トークンの一部を出力
      console.log('refreshToken: 生成トークン', {
        accessToken: newAccessToken.substring(0, 15) + '...',
        refreshToken: newRefreshToken.substring(0, 15) + '...'
      });
      
      // CORS対応ヘッダー設定
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
      
      // レスポンス
      console.log('refreshToken: 成功レスポンス送信');
      return res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (jwtError) {
      // JWTエラー処理
      console.error('refreshToken: JWT検証エラー', jwtError);
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
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
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
    
    // ヘルパーを使用してアクセストークンを生成
    const accessToken = authHelper.generateAccessToken(newUser._id, newUser.role);
    
    // ヘルパーを使用してリフレッシュトークンを生成
    const refreshToken = authHelper.generateRefreshToken(newUser._id);
    
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
    
    // ユーザー情報を取得（シンプル実装）
    const user = await SimpleUser.findById(userId, '-password -refreshToken');
    
    // ユーザーが見つからない場合
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // 無効なアカウント
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    // 成功レスポンス
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
    return res.status(500).json({
      success: false,
      message: '認証チェック中にエラーが発生しました'
    });
  }
};