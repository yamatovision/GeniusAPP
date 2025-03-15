const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * プロンプトモデル - シンプル化したバージョン
 * プロンプトの基本情報のみを管理します
 */
const PromptSchema = new Schema({
  title: {
    type: String,
    required: [true, 'プロンプトタイトルは必須です'],
    trim: true,
    maxlength: [200, 'タイトルは200文字以内で指定してください']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '説明は500文字以内で指定してください']
  },
  content: {
    type: String,
    required: [true, 'プロンプト内容は必須です'],
    maxlength: [10000, 'プロンプト内容は10000文字以内で指定してください']
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
  isPublic: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  // シンプルな統計情報
  usageCount: {
    type: Number,
    default: 0
  },
  // 公開URLのためのトークン
  publicToken: {
    type: String,
    unique: true,
    sparse: true // nullの場合はユニーク制約を適用しない
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
PromptSchema.index({ title: 1, ownerId: 1 }, { unique: false }); // uniqueの制約を明示的に削除
PromptSchema.index({ tags: 1 });
PromptSchema.index({ isPublic: 1 });
PromptSchema.index({ usageCount: -1 });

/**
 * プロンプトを検索するためのシンプル化されたメソッド
 * @param {Object} filters - 検索フィルター
 * @param {Object} options - 検索オプション（ソート、ページネーションなど）
 * @returns {Promise} - 検索結果と総件数
 */
PromptSchema.statics.findPrompts = async function(filters = {}, options = {}) {
  try {
    console.log('検索フィルター:', filters);
    console.log('検索オプション:', options);
    
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
    if (options.populate) {
      // ownerIdのポピュレート（ユーザー情報）
      if (options.populate.includes('owner') || options.populate.includes('ownerId')) {
        query.populate('ownerId', 'name email');
      }
    }
    
    // 実行と合計カウント取得
    const [prompts, total] = await Promise.all([
      query.exec(),
      this.countDocuments(filters)
    ]);
    
    console.log(`検索結果: ${prompts.length}件（合計${total}件）`);
    return { prompts, total };
  } catch (error) {
    console.error('検索エラー:', error);
    throw error;
  }
};

/**
 * プロンプトの使用回数を更新するシンプルなメソッド
 * @param {String} promptId - プロンプトID
 * @returns {Promise} - 更新結果
 */
PromptSchema.statics.incrementUsage = async function(promptId) {
  try {
    return this.findByIdAndUpdate(
      promptId,
      { $inc: { usageCount: 1 } },
      { new: true }
    );
  } catch (error) {
    console.error('使用カウント更新エラー:', error);
    throw error;
  }
};

const Prompt = mongoose.model('Prompt', PromptSchema);

module.exports = Prompt;