const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 組織モデル
 * Anthropic APIでの組織管理を行うための情報を保持
 */
const OrganizationSchema = new Schema({
  // 組織名
  name: {
    type: String,
    required: [true, '組織名は必須です'],
    trim: true,
    maxlength: [100, '組織名は100文字以内で指定してください']
  },

  // 組織の説明
  description: {
    type: String,
    maxlength: [500, '説明は500文字以内で指定してください'],
    default: ''
  },

  // 管理者ID
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // デフォルトワークスペースID (1組織1ワークスペースルール用)
  defaultWorkspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace'
  },

  // Anthropic組織ID（オプション）
  anthropicOrgId: {
    type: String
  },

  // NOTE: Admin APIキーはSystemConfigモデルで一元管理するため削除
  // 代わりにAPIキープールを使用

  // 標準APIキー
  apiKey: {
    type: String
  },

  // 使用予算制限（月額）
  monthlyBudget: {
    type: Number,
    default: 100000 // デフォルト10万トークン
  },

  // リセット日（毎月の課金日）
  resetDay: {
    type: Number,
    default: 1,
    min: 1,
    max: 31
  },

  // アーカイブフラグ
  isArchived: {
    type: Boolean,
    default: false
  },

  // ステータス
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active'
  },

  // メンバー
  members: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // 警告通知履歴
  warningsSent: [{
    type: String,
    enum: ['80percent', '90percent', '100percent']
  }],
  
  // 最大ユーザー数
  maxUsers: {
    type: Number,
    default: 5,  // デフォルトは5ユーザー
    min: 1,
    max: 10000
  },

  // APIキープール（割り当て前のキー）
  availableApiKeys: [{
    keyId: String,      // Anthropic管理ID
    apiKey: String,     // 暗号化したAPIキー
    name: String,       // キー名（識別用）
    description: String // 説明
  }],

  // 保留中の招待
  pendingInvites: [{
    email: String,
    role: String,
    invitedBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User'
    },
    token: String,
    expiresAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // メタデータ
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => ({})
  }
}, {
  timestamps: true
});

// インデックス
OrganizationSchema.index({ name: 1 }, { unique: true });
OrganizationSchema.index({ 'members.userId': 1 });
OrganizationSchema.index({ isArchived: 1 });
OrganizationSchema.index({ 'pendingInvites.email': 1 });
OrganizationSchema.index({ 'pendingInvites.token': 1 });

// 組織メンバーかどうかをチェックするメソッド
OrganizationSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.userId.toString() === userId.toString()
  );
};

// 組織の管理者かどうかをチェックするメソッド
OrganizationSchema.methods.isAdmin = function(userId) {
  return this.members.some(member => 
    member.userId.toString() === userId.toString() && 
    member.role === 'admin'
  );
};

// メンバーの役割を取得するメソッド
OrganizationSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(member => 
    member.userId.toString() === userId.toString()
  );
  return member ? member.role : null;
};

// 月の予算使用状況をリセットするメソッド
OrganizationSchema.methods.resetMonthlyWarnings = function() {
  this.warningsSent = [];
  return this.save();
};

// 新しいAPIキーをプールに追加するメソッド
OrganizationSchema.methods.addApiKeyToPool = function(apiKeyData) {
  if (!this.availableApiKeys) {
    this.availableApiKeys = [];
  }
  
  this.availableApiKeys.push(apiKeyData);
  return this.save();
};

// プールからAPIキーを割り当てるメソッド
OrganizationSchema.methods.assignApiKeyFromPool = function() {
  if (!this.availableApiKeys || this.availableApiKeys.length === 0) {
    return null;
  }
  
  // 最初のキーを取得
  const apiKey = this.availableApiKeys[0];
  
  // プールから削除
  this.availableApiKeys.splice(0, 1);
  
  return apiKey;
};

// ユーザー追加可能かチェックするメソッド
OrganizationSchema.methods.canAddMoreUsers = function() {
  const currentMemberCount = this.members.length;
  const pendingInviteCount = this.pendingInvites ? this.pendingInvites.length : 0;
  
  return (currentMemberCount + pendingInviteCount) < this.maxUsers;
};

// デフォルトワークスペースを設定するメソッド
OrganizationSchema.methods.setDefaultWorkspace = function(workspaceId) {
  this.defaultWorkspaceId = workspaceId;
  return this.save();
};

// 組織作成時にデフォルトワークスペースIDを自動設定するフック（pre-save）
OrganizationSchema.pre('save', async function(next) {
  // 新規作成時、かつデフォルトワークスペースIDが未設定の場合
  if (this.isNew && !this.defaultWorkspaceId) {
    // この段階ではまだワークスペースが作成されていないので
    // ワークスペース作成後に手動で設定する必要があります
    console.log('新規組織作成: デフォルトワークスペースを後で設定してください');
  }
  next();
});

// 組織とデフォルトワークスペースを同時に取得するための静的メソッド
OrganizationSchema.statics.findWithDefaultWorkspace = async function(organizationId) {
  try {
    const organization = await this.findById(organizationId);
    if (!organization) {
      return null;
    }
    
    if (!organization.defaultWorkspaceId) {
      // デフォルトワークスペースが設定されていない場合、
      // 関連するワークスペースを検索して最初のものを設定
      const Workspace = mongoose.model('Workspace');
      const workspace = await Workspace.findOne({ organizationId: organization._id });
      
      if (workspace) {
        organization.defaultWorkspaceId = workspace._id;
        await organization.save();
      } else {
        return { organization, defaultWorkspace: null };
      }
    }
    
    // デフォルトワークスペースを取得
    const Workspace = mongoose.model('Workspace');
    const defaultWorkspace = await Workspace.findById(organization.defaultWorkspaceId);
    
    return { organization, defaultWorkspace };
  } catch (error) {
    console.error('組織とデフォルトワークスペースの取得エラー:', error);
    throw error;
  }
};

const Organization = mongoose.model('Organization', OrganizationSchema);
module.exports = Organization;