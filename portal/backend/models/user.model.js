/**
 * ユーザーモデル
 * 認証システムのユーザー情報を管理するMongoDBモデル
 * 
 * リファクタリング:
 * - アカウント状態と権限の明確な分離
 * - 統一的な状態チェックメソッドの実装
 * - 組織・ワークスペース連携の強化
 * - SuperAdmin/企業管理者/一般ユーザーの階層構造をサポート
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const authConfig = require('../config/auth.config');

// ユーザースキーマ定義
const UserSchema = new mongoose.Schema({
  // ===== 基本情報 =====
  
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
    index: true, // 検索パフォーマンス向上のためのインデックス
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
  
  // ===== アカウント状態と権限（明確に分離） =====
  
  // アカウント状態（active/suspended/deactivated）
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated'],
    default: 'active',
    index: true // 検索パフォーマンス向上のためのインデックス
  },
  
  // ユーザー権限（権限のみを表す - user/admin/super_admin）
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user',
    index: true
  },
  
  // ===== 認証情報 =====
  
  // リフレッシュトークン（ログイン状態管理用）
  refreshToken: {
    type: String,
    default: null
  },
  
  // 以前のリフレッシュトークン（セキュリティ向上のためのトークンローテーション履歴）
  previousRefreshTokens: [{
    token: String,
    rotatedAt: Number, // Unix Timestamp
    userAgent: String,
    ipAddress: String
  }],
  
  // ===== 日時情報 =====
  
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
  
  // 最終トークンリフレッシュ日時
  lastTokenRefresh: {
    type: Date,
    default: null
  },
  
  // ===== 組織・ワークスペース関連 =====
  
  // 所属組織とワークスペース情報
  organizations: {
    // プライマリ組織ID（主に所属する組織）
    primary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null
    },
    // プライマリワークスペースID（主に使用するワークスペース）
    primaryWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null
    },
    // ユーザーの組織における役割（組織レベルでの権限）
    role: {
      type: String,
      enum: ['member', 'admin', 'owner'],
      default: 'member'
    }
  },
  
  // 企業管理者フラグ
  isOrganizationAdmin: {
    type: Boolean,
    default: false
  },
  
  // ===== 設定とプリファレンス =====
  
  // ユーザーのAPIキー情報
  apiKeyInfo: {
    keyId: String,         // AnthropicのAPIキーID
    lastUsed: Date,        // 最終使用日時
    status: {
      type: String,
      enum: ['active', 'disabled', 'revoked'],
      default: 'active'
    },
    organizationId: {      // 割り当て元組織
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization'
    },
    usageStats: {
      tokenCount: Number,  // 累計使用トークン数
      lastSynced: Date     // 最終同期日時
    }
  },
  
  // ユーザー設定
  preferences: {
    // UIテーマ
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    // 言語設定
    language: {
      type: String,
      default: 'ja'
    },
    // 通知設定
    notifications: {
      email: {
        enabled: { type: Boolean, default: true },
        types: { type: [String], default: ['security', 'usage_alerts'] }
      },
      inApp: {
        enabled: { type: Boolean, default: true },
        types: { type: [String], default: ['all'] }
      }
    }
  },
  
  // メタデータ（拡張用）
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => ({})
  }
}, {
  // タイムスタンプフィールド（作成日時・更新日時）
  timestamps: true,
  
  // JSONシリアライズ時に機密情報を除外
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      delete ret.previousRefreshTokens;
      return ret;
    }
  }
});

// ===== インデックス =====

// 複合インデックス（検索クエリの最適化）
UserSchema.index({ accountStatus: 1, role: 1 });
UserSchema.index({ 'organizations.primary': 1, accountStatus: 1 });

// ===== メソッド =====

// アカウント状態チェックメソッド
UserSchema.methods.isAccountActive = function() {
  return this.accountStatus === 'active';
};

// 管理者権限チェックメソッド
UserSchema.methods.isAdmin = function() {
  return this.role === 'admin' || this.role === 'super_admin';
};

// スーパー管理者権限チェックメソッド
UserSchema.methods.isSuperAdmin = function() {
  return this.role === 'super_admin';
};

// 組織管理者チェックメソッド
UserSchema.methods.isOrgAdmin = function(organizationId) {
  if (this.isOrganizationAdmin) return true;
  
  return organizationId && 
         this.organizations && 
         this.organizations.primary && 
         this.organizations.primary.toString() === organizationId.toString() && 
         this.organizations.role === 'admin';
};

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

// ステータス変更時に日時を更新
UserSchema.pre('save', function(next) {
  if (this.isModified('accountStatus')) {
    this.statusChangedAt = new Date();
  }
  next();
});

// パスワード検証メソッド（最適化）
UserSchema.methods.validatePassword = async function(password) {
  try {
    if (!password || !this.password) return false;
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    console.error("ユーザーモデル: パスワード検証中のエラー:", error);
    throw error;
  }
};

// 認証に使用する静的メソッド
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ 
    email: email.toLowerCase(),
    accountStatus: { $ne: 'deactivated' } // 無効化されていないアカウントのみ
  });
};

UserSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({ 
    refreshToken: token,
    accountStatus: { $ne: 'deactivated' } // 無効化されていないアカウントのみ
  });
};

// リフレッシュトークン管理メソッド
UserSchema.methods.updateRefreshToken = function(token, options = {}) {
  const { userAgent = '', ipAddress = '' } = options;
  
  // 前回のトークンを履歴に追加
  if (this.refreshToken && authConfig.tokenSettings?.rotation?.enabled) {
    if (!this.previousRefreshTokens) {
      this.previousRefreshTokens = [];
    }
    
    this.previousRefreshTokens.unshift({
      token: this.refreshToken,
      rotatedAt: Math.floor(Date.now() / 1000),
      userAgent: userAgent.substring(0, 255),
      ipAddress: ipAddress.substring(0, 45)
    });
    
    // 最大5件に制限
    if (this.previousRefreshTokens.length > 5) {
      this.previousRefreshTokens = this.previousRefreshTokens.slice(0, 5);
    }
  }
  
  // 新しいトークンを設定
  this.refreshToken = token;
  this.lastTokenRefresh = new Date();
  
  return this.save();
};

// 組織関連のヘルパーメソッド
UserSchema.methods.setPrimaryOrganization = async function(organizationId, role = 'member') {
  this.organizations = this.organizations || {};
  this.organizations.primary = organizationId;
  this.organizations.role = role;
  
  // 管理者ロールなら組織管理者フラグを設定
  if (role === 'admin' || role === 'owner') {
    this.isOrganizationAdmin = true;
  }
  
  return this.save();
};

UserSchema.methods.setPrimaryWorkspace = async function(workspaceId) {
  this.organizations = this.organizations || {};
  this.organizations.primaryWorkspace = workspaceId;
  return this.save();
};

// ユーザーモデルをエクスポート
const User = mongoose.model('User', UserSchema);
module.exports = User;