const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

/**
 * 招待モデル
 * 組織への招待とAPIキー自動割り当て機能をサポート
 */
const InvitationSchema = new Schema({
  // 招待先メールアドレス
  email: {
    type: String,
    required: [true, 'メールアドレスは必須です'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      '有効なメールアドレスを入力してください'
    ]
  },

  // 招待元組織ID
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },

  // 招待者ID
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 招待先ユーザーの役割
  role: {
    type: String,
    enum: ['member', 'admin'],
    default: 'member'
  },

  // 招待トークン（ユニーク）
  token: {
    type: String,
    required: true,
    unique: true
  },

  // 招待状態
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired'],
    default: 'pending'
  },

  // 招待の有効期限
  expiresAt: {
    type: Date,
    required: true
  },
  
  // カスタムメッセージ
  message: {
    type: String,
    maxlength: [500, 'メッセージは500文字以内で指定してください']
  },
  
  // 予約済みAPIキーID
  reservedApiKeyId: {
    type: String
  }
}, {
  timestamps: true
});

// インデックス
InvitationSchema.index({ email: 1, organizationId: 1 }, { unique: true });
InvitationSchema.index({ token: 1 }, { unique: true });
InvitationSchema.index({ expiresAt: 1 });
InvitationSchema.index({ status: 1 });

// 有効期限切れかどうかをチェックするメソッド
InvitationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date() || this.status === 'expired';
};

// 招待トークンを生成するスタティックメソッド
InvitationSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// 招待をキャンセルするメソッド
InvitationSchema.methods.cancel = function() {
  this.status = 'expired';
  return this.save();
};

// 招待を受け入れるメソッド
InvitationSchema.methods.accept = function() {
  this.status = 'accepted';
  return this.save();
};

// トークンから招待を検索するスタティックメソッド
InvitationSchema.statics.findByToken = function(token) {
  return this.findOne({ token, status: 'pending' });
};

// トークンと有効期限で招待を検索するスタティックメソッド
InvitationSchema.statics.findValidByToken = function(token) {
  return this.findOne({
    token,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

const Invitation = mongoose.model('Invitation', InvitationSchema);
module.exports = Invitation;