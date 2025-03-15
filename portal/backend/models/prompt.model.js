const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * プロンプトモデル
 * プロンプトのメタデータと基本情報を管理します
 */
const PromptSchema = new Schema({
  title: {
    type: String,
    required: [true, 'プロンプトタイトルは必須です'],
    trim: true,
    maxlength: [200, 'タイトルは200文字以内で指定してください']
  },
  content: {
    type: String,
    required: [true, 'プロンプト内容は必須です'],
    maxlength: [10000, 'プロンプト内容は10000文字以内で指定してください']
  },
  type: {
    type: String,
    enum: ['system', 'user', 'assistant', 'function', 'template'],
    default: 'system'
  },
  category: {
    type: String,
    enum: ['開発', 'デザイン', '要件定義', 'デバッグ', 'その他'],
    default: 'その他'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  currentVersionId: {
    type: Schema.Types.ObjectId,
    ref: 'PromptVersion',
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: null
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
PromptSchema.index({ title: 1, ownerId: 1 }, { unique: true });
PromptSchema.index({ tags: 1 });
PromptSchema.index({ category: 1 });
PromptSchema.index({ isPublic: 1 });
PromptSchema.index({ usageCount: -1 });

/**
 * プロンプトを検索するための静的メソッド
 * @param {Object} filters - 検索フィルター
 * @param {Object} options - 検索オプション（ソート、ページネーションなど）
 * @returns {Promise} - 検索結果と総件数
 */
PromptSchema.statics.findPrompts = async function(filters = {}, options = {}) {
  const query = this.find(filters);
  
  // ソート
  if (options.sort) {
    query.sort(options.sort);
  } else {
    query.sort({ updatedAt: -1 });
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
  
  if (options.populate && options.populate.includes('project')) {
    query.populate('projectId', 'name');
  }
  
  // 実行と合計カウント取得
  const [prompts, total] = await Promise.all([
    query.exec(),
    this.countDocuments(filters)
  ]);
  
  return { prompts, total };
};

/**
 * プロンプトの使用回数を更新するメソッド
 * @param {String} promptId - プロンプトID
 * @returns {Promise} - 更新結果
 */
PromptSchema.statics.incrementUsage = async function(promptId) {
  return this.findByIdAndUpdate(
    promptId,
    {
      $inc: { usageCount: 1 },
      lastUsedAt: new Date()
    },
    { new: true }
  );
};

const Prompt = mongoose.model('Prompt', PromptSchema);

module.exports = Prompt;