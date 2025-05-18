const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * プロンプトバージョンモデル
 * プロンプトの各バージョンの内容を管理します
 */
const PromptVersionSchema = new Schema({
  promptId: {
    type: Schema.Types.ObjectId,
    ref: 'Prompt',
    required: true
  },
  content: {
    type: String,
    required: [true, 'バージョン内容は必須です'],
    maxlength: [30000, 'バージョン内容は30000文字以内で指定してください']
  },
  description: {
    type: String,
    maxlength: [500, '説明は500文字以内で指定してください'],
    default: ''
  },
  versionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  performance: {
    successRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    avgResponseTime: {
      type: Number,
      default: null
    },
    sampleSize: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => ({})
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
PromptVersionSchema.index({ promptId: 1, versionNumber: 1 }, { unique: true });
PromptVersionSchema.index({ promptId: 1, createdAt: -1 });
PromptVersionSchema.index({ createdBy: 1 });

/**
 * 特定プロンプトの最新バージョンを取得するための静的メソッド
 * @param {String} promptId - プロンプトID
 * @returns {Promise} - 最新バージョン
 */
PromptVersionSchema.statics.getLatestVersion = async function(promptId) {
  return this.findOne({ promptId })
    .sort({ versionNumber: -1 })
    .exec();
};

/**
 * 新しいバージョン番号を生成するための静的メソッド
 * @param {String} promptId - プロンプトID
 * @returns {Promise<Number>} - 次のバージョン番号
 */
PromptVersionSchema.statics.getNextVersionNumber = async function(promptId) {
  const latestVersion = await this.findOne({ promptId })
    .sort({ versionNumber: -1 })
    .select('versionNumber')
    .exec();
  
  return latestVersion ? latestVersion.versionNumber + 1 : 1;
};

/**
 * パフォーマンス統計を更新するメソッド
 * @param {String} versionId - バージョンID
 * @param {Object} stats - 更新する統計情報
 * @returns {Promise} - 更新結果
 */
PromptVersionSchema.statics.updatePerformance = async function(versionId, stats) {
  const version = await this.findById(versionId);
  if (!version) return null;
  
  const currentStats = version.performance;
  const currentSampleSize = currentStats.sampleSize || 0;
  const newSampleSize = currentSampleSize + 1;
  
  // 新しい値と既存の値を加重平均で計算
  const updatedStats = {
    'performance.successRate': stats.success !== undefined
      ? ((currentStats.successRate || 0) * currentSampleSize + (stats.success ? 100 : 0)) / newSampleSize
      : currentStats.successRate,
    'performance.avgResponseTime': stats.responseTime !== undefined
      ? ((currentStats.avgResponseTime || 0) * currentSampleSize + stats.responseTime) / newSampleSize
      : currentStats.avgResponseTime,
    'performance.sampleSize': newSampleSize
  };
  
  return this.findByIdAndUpdate(
    versionId,
    { $set: updatedStats },
    { new: true }
  );
};

const PromptVersion = mongoose.model('PromptVersion', PromptVersionSchema);

module.exports = PromptVersion;