const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * ワークスペースモデル
 * Anthropic APIでのワークスペース管理を行うための情報を保持
 */
const WorkspaceSchema = new Schema({
  // ワークスペース名
  name: {
    type: String,
    required: [true, 'ワークスペース名は必須です'],
    trim: true,
    maxlength: [100, 'ワークスペース名は100文字以内で指定してください']
  },

  // 組織ID
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  // Anthropicワークスペースの実際のID
  anthropicWorkspaceId: {
    type: String
  },

  // 説明
  description: {
    type: String,
    maxlength: [500, '説明は500文字以内で指定してください'],
    default: ''
  },

  // Anthropicで予算設定されるため、AppGeniusでの管理は不要

  // APIキー情報
  apiKey: {
    // APIキーID（Anthropicで管理されるID）
    keyId: {
      type: String
    },
    // 名称
    name: {
      type: String
    },
    // ステータス
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    // 作成日
    createdAt: {
      type: Date
    }
  },

  // メンバー
  members: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['workspace_admin', 'workspace_developer', 'workspace_user'],
      default: 'workspace_user'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],


  // アーカイブフラグ
  isArchived: {
    type: Boolean,
    default: false
  },

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
WorkspaceSchema.index({ organizationId: 1, name: 1 }, { unique: true });
WorkspaceSchema.index({ 'members.userId': 1 });

// ワークスペースメンバーかどうかをチェックするメソッド
WorkspaceSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.userId.toString() === userId.toString()
  );
};

// ワークスペースの管理者かどうかをチェックするメソッド
WorkspaceSchema.methods.isAdmin = function(userId) {
  return this.members.some(member => 
    member.userId.toString() === userId.toString() && 
    member.role === 'workspace_admin'
  );
};

// メンバーの役割を取得するメソッド
WorkspaceSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(member => 
    member.userId.toString() === userId.toString()
  );
  return member ? member.role : null;
};


const Workspace = mongoose.model('Workspace', WorkspaceSchema);
module.exports = Workspace;