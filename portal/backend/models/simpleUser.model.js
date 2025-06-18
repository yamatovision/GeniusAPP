/**
 * シンプルなユーザーモデル
 * 認証システムのユーザー情報を管理する最小限のモデル
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const authConfig = require('../config/auth.config');

const SimpleUserSchema = new mongoose.Schema({
  // ===== 基本情報 =====
  
  // ユーザー名
  name: {
    type: String,
    required: [true, 'ユーザー名は必須です'],
    trim: true,
    maxlength: [100, 'ユーザー名は100文字以内である必要があります']
  },
  
  // メールアドレス
  email: {
    type: String,
    required: [true, 'メールアドレスは必須です'],
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      '有効なメールアドレスを入力してください'
    ]
  },
  
  // パスワード
  password: {
    type: String,
    required: [true, 'パスワードは必須です'],
    minlength: [8, 'パスワードは8文字以上である必要があります']
  },
  
  // ===== ユーザー権限 =====
  
  // ユーザー権限（SuperAdmin/Admin/User）
  role: {
    type: String,
    enum: ['SuperAdmin', 'Admin', 'User'],
    default: 'User'
  },
  
  // ===== 組織・APIキー情報 =====
  
  // 所属組織ID
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimpleOrganization',
    default: null
  },
  
  // 紐づくAPIキーID
  apiKeyId: {
    type: String,
    ref: 'SimpleApiKey',
    default: null
  },
  
  // APIキー値（実際のAnthropicキー）
  apiKeyValue: {
    type: String,
    default: null
  },
  
  // ClaudeCode起動回数カウンター
  claudeCodeLaunchCount: {
    type: Number,
    default: 0
  },
  
  // ===== 認証情報 =====
  
  // リフレッシュトークン
  refreshToken: {
    type: String,
    default: null
  },
  
  // アクティブセッション情報
  activeSession: {
    sessionId: {
      type: String,
      default: null
    },
    loginTime: {
      type: Date,
      default: null
    },
    lastActivity: {
      type: Date,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    }
  },
  
  // アカウントステータス
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  }
}, {
  timestamps: true,
  
  // JSON出力から機密情報を除外
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      return ret;
    }
  }
});

// ===== インデックス =====
SimpleUserSchema.index({ email: 1 }, { unique: true });
SimpleUserSchema.index({ role: 1 });
SimpleUserSchema.index({ organizationId: 1 });
SimpleUserSchema.index({ status: 1 });

// ===== メソッド =====

// パスワードの保存前に自動ハッシュ化
SimpleUserSchema.pre('save', async function(next) {
  // パスワードが変更された場合のみハッシュ化
  if (!this.isModified('password')) return next();
  
  try {
    // bcryptを使用したパスワードハッシュ化
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// パスワード検証メソッド
SimpleUserSchema.methods.validatePassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    console.error("パスワード検証エラー:", error);
    throw error;
  }
};

// ユーザー権限チェックメソッド
SimpleUserSchema.methods.isSuperAdmin = function() {
  return this.role === 'SuperAdmin';
};

SimpleUserSchema.methods.isAdmin = function() {
  return this.role === 'Admin' || this.role === 'SuperAdmin';
};

// 認証用の静的メソッド
SimpleUserSchema.statics.findByEmail = function(email) {
  return this.findOne({ 
    email: email.toLowerCase(),
    status: 'active'
  });
};

SimpleUserSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({ 
    refreshToken: token,
    status: 'active'
  });
};

// リフレッシュトークン更新メソッド
SimpleUserSchema.methods.updateRefreshToken = function(token) {
  this.refreshToken = token;
  return this.save();
};

// 組織とAPIキー設定メソッド
SimpleUserSchema.methods.setOrganization = function(organizationId) {
  this.organizationId = organizationId;
  return this.save();
};

SimpleUserSchema.methods.setApiKey = function(apiKeyId) {
  this.apiKeyId = apiKeyId;
  return this.save();
};

// セッション管理メソッド
SimpleUserSchema.methods.hasActiveSession = function() {
  return !!(this.activeSession && this.activeSession.sessionId);
};

SimpleUserSchema.methods.setActiveSession = function(sessionId, ipAddress, userAgent) {
  this.activeSession = {
    sessionId: sessionId,
    loginTime: new Date(),
    lastActivity: new Date(),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  };
  return this.save();
};

SimpleUserSchema.methods.clearActiveSession = function() {
  this.activeSession = {
    sessionId: null,
    loginTime: null,
    lastActivity: null,
    ipAddress: null,
    userAgent: null
  };
  return this.save();
};

SimpleUserSchema.methods.updateSessionActivity = function() {
  if (this.activeSession && this.activeSession.sessionId) {
    this.activeSession.lastActivity = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
module.exports = SimpleUser;