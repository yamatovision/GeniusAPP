const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * プロジェクトモデル
 * プロンプトを整理するプロジェクト単位の情報を管理します
 */
const ProjectSchema = new Schema({
  name: {
    type: String,
    required: [true, 'プロジェクト名は必須です'],
    trim: true,
    maxlength: [100, 'プロジェクト名は100文字以内で指定してください']
  },
  description: {
    type: String,
    maxlength: [500, '説明は500文字以内で指定してください'],
    default: ''
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: 'default_project'
  },
  color: {
    type: String,
    default: '#4A90E2'
  },
  settings: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => ({})
  },
  members: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  promptCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// インデックス作成
ProjectSchema.index({ name: 1, ownerId: 1 }, { unique: true });
ProjectSchema.index({ 'members.userId': 1 });
ProjectSchema.index({ isArchived: 1 });
ProjectSchema.index({ lastActivity: -1 });

/**
 * ユーザーのプロジェクトを検索するための静的メソッド
 * @param {String} userId - ユーザーID
 * @param {Object} filters - 検索フィルター
 * @param {Object} options - 検索オプション（ソート、ページネーションなど）
 * @returns {Promise} - 検索結果と総件数
 */
ProjectSchema.statics.findUserProjects = async function(userId, filters = {}, options = {}) {
  // ユーザーが所有または参加しているプロジェクトを検索
  const combinedFilters = {
    $or: [
      { ownerId: userId },
      { 'members.userId': userId }
    ],
    ...filters
  };
  
  const query = this.find(combinedFilters);
  
  // ソート
  if (options.sort) {
    query.sort(options.sort);
  } else {
    query.sort({ lastActivity: -1 });
  }
  
  // ページネーション
  if (options.page && options.limit) {
    const page = parseInt(options.page, 10) || 1;
    const limit = parseInt(options.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    query.skip(skip).limit(limit);
  }
  
  // 関連データの取得
  if (options.populate && options.populate.includes('owner')) {
    query.populate('ownerId', 'name email');
  }
  
  if (options.populate && options.populate.includes('members')) {
    query.populate('members.userId', 'name email');
  }
  
  // 実行と合計カウント取得
  const [projects, total] = await Promise.all([
    query.exec(),
    this.countDocuments(combinedFilters)
  ]);
  
  return { projects, total };
};

/**
 * プロンプト数を更新するメソッド
 * @param {String} projectId - プロジェクトID
 * @param {Number} increment - 増減値（デフォルトは1）
 * @returns {Promise} - 更新結果
 */
ProjectSchema.statics.updatePromptCount = async function(projectId, increment = 1) {
  return this.findByIdAndUpdate(
    projectId,
    {
      $inc: { promptCount: increment },
      lastActivity: new Date()
    },
    { new: true }
  );
};

/**
 * プロジェクトにメンバーを追加するメソッド
 * @param {String} projectId - プロジェクトID
 * @param {String} userId - ユーザーID
 * @param {String} role - ロール（editor/viewer）
 * @returns {Promise} - 更新結果
 */
ProjectSchema.statics.addMember = async function(projectId, userId, role = 'viewer') {
  return this.findByIdAndUpdate(
    projectId,
    {
      $addToSet: {
        members: {
          userId,
          role,
          joinedAt: new Date()
        }
      },
      lastActivity: new Date()
    },
    { new: true }
  );
};

/**
 * プロジェクトメンバーのロールを更新するメソッド
 * @param {String} projectId - プロジェクトID
 * @param {String} userId - ユーザーID
 * @param {String} role - 新しいロール
 * @returns {Promise} - 更新結果
 */
ProjectSchema.statics.updateMemberRole = async function(projectId, userId, role) {
  return this.findOneAndUpdate(
    {
      _id: projectId,
      'members.userId': userId
    },
    {
      $set: { 'members.$.role': role },
      lastActivity: new Date()
    },
    { new: true }
  );
};

/**
 * プロジェクトからメンバーを削除するメソッド
 * @param {String} projectId - プロジェクトID
 * @param {String} userId - ユーザーID
 * @returns {Promise} - 更新結果
 */
ProjectSchema.statics.removeMember = async function(projectId, userId) {
  return this.findByIdAndUpdate(
    projectId,
    {
      $pull: { members: { userId } },
      lastActivity: new Date()
    },
    { new: true }
  );
};

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project;