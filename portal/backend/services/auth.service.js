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
    // メールアドレスでユーザーを検索
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // アカウントが有効か確認
    if (!user.isActive) {
      throw new Error('アカウントが無効化されています');
    }

    // パスワードを検証
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new Error('パスワードが正しくありません');
    }

    // トークン生成
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    
    // 最終ログイン日時を更新
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