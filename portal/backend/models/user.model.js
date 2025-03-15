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
  
  // ユーザー権限（'user'、'admin'、'unpaid'、'unsubscribed'）
  role: {
    type: String,
    enum: {
      values: [
        authConfig.roles.USER, 
        authConfig.roles.ADMIN, 
        authConfig.roles.UNPAID, 
        authConfig.roles.INACTIVE
      ],
      message: '権限は"user"、"admin"、"unpaid"または"unsubscribed"である必要があります'
    },
    default: authConfig.roles.USER
  },
  
  // リフレッシュトークン（ログイン状態管理用）
  refreshToken: {
    type: String,
    default: null
  },
  
  // 最終ステータス変更日時
  statusChangedAt: {
    type: Date,
    default: null
  },
  
  // 最終ログイン日時
  lastLogin: {
    type: Date,
    default: null
  },
  
  // トークン使用プラン情報
  plan: {
    // プランタイプ（basic/standard/premium/custom）
    type: {
      type: String,
      enum: ['basic', 'standard', 'premium', 'custom'],
      default: 'basic'
    },
    // トークン上限
    tokenLimit: {
      type: Number,
      default: 100000 // デフォルト: 10万トークン
    },
    // 最終リセット日
    lastResetDate: {
      type: Date,
      default: Date.now
    },
    // 次回リセット日
    nextResetDate: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date;
      }
    }
  },
  
  // API使用制限情報
  usageLimits: {
    // 日次トークン制限（nullの場合は制限なし）
    tokensPerDay: {
      type: Number,
      default: null
    },
    // 月次トークン制限（nullの場合はplanの制限を使用）
    tokensPerMonth: {
      type: Number,
      default: null
    }
  },
  
  // APIアクセス制御情報
  apiAccess: {
    // API使用許可フラグ
    enabled: {
      type: Boolean,
      default: true
    },
    // アクセスレベル（'basic', 'advanced', 'full'）
    accessLevel: {
      type: String,
      enum: ['basic', 'advanced', 'full'],
      default: 'basic'
    },
    // 最終APIアクセス日時
    lastAccessAt: {
      type: Date,
      default: null
    }
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
  try {
    console.log("ユーザーモデル: パスワード検証開始");
    if (!password) {
      console.error("ユーザーモデル: パスワードが空です");
      return false;
    }
    
    if (!this.password) {
      console.error("ユーザーモデル: ユーザーのパスワードハッシュが存在しません");
      return false;
    }
    
    const result = await bcrypt.compare(password, this.password);
    console.log("ユーザーモデル: パスワード検証結果:", result ? "一致" : "不一致");
    return result;
  } catch (error) {
    console.error("ユーザーモデル: パスワード検証中のエラー:", error);
    throw error;
  }
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