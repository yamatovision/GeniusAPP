/**
 * 認証サービス
 * ユーザー認証、トークン生成、検証などのビジネスロジックを提供します
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const authConfig = require('../config/auth.config');

/**
 * JWTアクセストークンを生成
 * @param {Object} user - ユーザーオブジェクト
 * @returns {String} 生成されたJWTトークン
 */
exports.generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      role: user.role 
    }, 
    authConfig.jwtSecret, 
    {
      expiresIn: authConfig.jwtExpiry,
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience
    }
  );
};

/**
 * リフレッシュトークンを生成
 * @param {Object} user - ユーザーオブジェクト
 * @returns {String} 生成されたリフレッシュトークン
 */
exports.generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id }, 
    authConfig.refreshTokenSecret, 
    { expiresIn: authConfig.refreshTokenExpiry }
  );
};

/**
 * ユーザー登録
 * @param {Object} userData - ユーザー登録データ
 * @returns {Object} 作成されたユーザーとトークン
 */
exports.register = async (userData) => {
  try {
    // メールアドレスが既に使用されていないか確認
    const existingUser = await User.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('このメールアドレスは既に使用されています');
    }

    // 新しいユーザーを作成
    const user = new User({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role || authConfig.roles.USER
    });

    // ユーザーを保存（パスワードは自動的にハッシュ化される）
    await user.save();

    // トークン生成
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    await user.save();

    // 更新日時を記録
    user.lastLogin = new Date();
    await user.save();

    return {
      user,
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザーログイン
 * @param {String} email - メールアドレス
 * @param {String} password - パスワード
 * @returns {Object} ユーザー情報とトークン
 */
exports.login = async (email, password) => {
  try {
    console.log("認証サービス: ログイン処理開始");
    
    // メールアドレスでユーザーを検索
    console.log(`認証サービス: メールアドレスでユーザー検索 - ${email}`);
    let user;
    try {
      user = await User.findByEmail(email);
      console.log("認証サービス: ユーザー検索結果:", user ? "ユーザー見つかりました" : "ユーザー見つかりません");
    } catch (dbError) {
      console.error("認証サービス: ユーザー検索中のDBエラー:", dbError);
      throw new Error(`データベース検索エラー: ${dbError.message}`);
    }
    
    if (!user) {
      console.log("認証サービス: ユーザーが見つかりません");
      throw new Error('ユーザーが見つかりません');
    }

    // ロールベースでのアカウント状態チェック
    console.log("認証サービス: アカウント状態チェック - ロール:", user.role);
    
    // 退会済みユーザーはログイン不可
    if (user.role === authConfig.roles.INACTIVE) {
      console.log("認証サービス: アカウントが無効化されています");
      throw new Error('アカウントが無効化されています。再登録が必要です。');
    }
    
    // 未払いユーザーはログイン自体は可能
    if (user.role === authConfig.roles.UNPAID) {
      console.log("認証サービス: 未払いアカウントです。ログインは許可しますが、APIアクセスは制限されます。");
    }

    // パスワードを検証
    console.log("認証サービス: パスワード検証開始");
    let isValidPassword;
    try {
      isValidPassword = await user.validatePassword(password);
      console.log("認証サービス: パスワード検証結果:", isValidPassword ? "成功" : "失敗");
    } catch (pwError) {
      console.error("認証サービス: パスワード検証エラー:", pwError);
      throw new Error(`パスワード検証エラー: ${pwError.message}`);
    }
    
    if (!isValidPassword) {
      console.log("認証サービス: パスワードが一致しません");
      throw new Error('パスワードが正しくありません');
    }

    // トークン生成
    console.log("認証サービス: トークン生成開始");
    try {
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);
      console.log("認証サービス: トークン生成成功");

      // リフレッシュトークンをユーザーに保存
      console.log("認証サービス: ユーザー情報更新");
      user.refreshToken = refreshToken;
      
      // 最終ログイン日時を更新
      user.lastLogin = new Date();
      
      try {
        await user.save();
        console.log("認証サービス: ユーザー情報更新成功");
      } catch (saveError) {
        console.error("認証サービス: ユーザー情報更新エラー:", saveError);
        throw new Error(`ユーザー保存エラー: ${saveError.message}`);
      }

      console.log("認証サービス: ログイン処理完了");
      return {
        user,
        accessToken,
        refreshToken
      };
    } catch (tokenError) {
      console.error("認証サービス: トークン生成/保存エラー:", tokenError);
      throw tokenError;
    }
  } catch (error) {
    console.error("認証サービス: ログイン処理失敗:", error);
    throw error;
  }
};

/**
 * アクセストークンをリフレッシュ
 * @param {String} refreshToken - リフレッシュトークン
 * @returns {Object} 新しいアクセストークン
 */
exports.refreshToken = async (refreshToken) => {
  try {
    // リフレッシュトークンを検証
    const decoded = jwt.verify(refreshToken, authConfig.refreshTokenSecret);
    
    // トークンに関連付けられたユーザーを検索
    const user = await User.findByRefreshToken(refreshToken);
    if (!user) {
      throw new Error('無効なリフレッシュトークンです');
    }
    
    // アカウントが有効か確認
    if (!user.isActive) {
      throw new Error('アカウントが無効化されています');
    }

    // 新しいアクセストークンを生成
    const accessToken = this.generateAccessToken(user);

    return {
      accessToken
    };
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザーログアウト
 * @param {String} refreshToken - リフレッシュトークン
 * @returns {Boolean} ログアウト成功フラグ
 */
exports.logout = async (refreshToken) => {
  try {
    // リフレッシュトークンでユーザーを検索
    const user = await User.findByRefreshToken(refreshToken);
    if (!user) {
      return false;
    }

    // リフレッシュトークンをクリア
    user.refreshToken = null;
    await user.save();

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザー情報更新
 * @param {String} userId - ユーザーID
 * @param {Object} updateData - 更新データ
 * @returns {Object} 更新されたユーザー
 */
exports.updateUser = async (userId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // 更新可能なフィールド
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;
    if (updateData.password) user.password = updateData.password;

    // 管理者のみがロールを更新可能
    if (updateData.role && updateData.isAdmin) {
      user.role = updateData.role;
    }

    await user.save();
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * パスワードリセット
 * @param {String} email - メールアドレス
 * @returns {Boolean} パスワードリセット成功フラグ
 */
exports.resetPassword = async (email) => {
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // パスワードリセットロジックを実装
    // 例: ランダムなパスワードを生成してメール送信

    return true;
  } catch (error) {
    throw error;
  }
};