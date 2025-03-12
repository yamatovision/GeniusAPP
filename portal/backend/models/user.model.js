/**
 * ユーザーモデル
 * 認証システムのユーザー情報を管理するMongoDBモデル
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const authConfig = require('../config/auth.config');

// ユーザースキーマ定義
const UserSchema = new mongoose.Schema({
  // ユーザー名（必須、最大100文字）
  name: {
    type: String,
    required: [true, 'ユーザー名は必須です'],
    trim: true,
    maxlength: [100, 'ユーザー名は100文字以内である必要があります']
  },
  
  // メールアドレス（必須、一意、有効なメール形式）
  email: {
    type: String,
    required: [true, 'メールアドレスは必須です'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      '有効なメールアドレスを入力してください'
    ]
  },
  
  // パスワード（ハッシュ済み、必須、最小8文字）
  password: {
    type: String,
    required: [true, 'パスワードは必須です'],
    minlength: [8, 'パスワードは8文字以上である必要があります']
  },
  
  // ユーザー権限（'user'または'admin'）
  role: {
    type: String,
    enum: {
      values: [authConfig.roles.USER, authConfig.roles.ADMIN],
      message: '権限は"user"または"admin"である必要があります'
    },
    default: authConfig.roles.USER
  },
  
  // リフレッシュトークン（ログイン状態管理用）
  refreshToken: {
    type: String,
    default: null
  },
  
  // アカウント有効フラグ
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 最終ログイン日時
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  // タイムスタンプフィールド（作成日時・更新日時）
  timestamps: true,
  
  // JSONシリアライズ時にパスワードとリフレッシュトークンを除外
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      return ret;
    }
  }
});

// パスワードの保存前に自動ハッシュ化
UserSchema.pre('save', async function(next) {
  // パスワードが変更された場合のみハッシュ化
  if (!this.isModified('password')) return next();
  
  try {
    // bcryptを使用したパスワードハッシュ化
    const salt = await bcrypt.genSalt(authConfig.saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// パスワード検証メソッド
UserSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// メールアドレスでユーザーを検索するスタティックメソッド
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// リフレッシュトークンを更新するメソッド
UserSchema.methods.updateRefreshToken = function(token) {
  this.refreshToken = token;
  return this.save();
};

// リフレッシュトークンを検証するスタティックメソッド
UserSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({ refreshToken: token });
};

// ユーザーモデルをエクスポート
const User = mongoose.model('User', UserSchema);
module.exports = User;