const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * プロンプト使用履歴モデル
 * プロンプトの使用履歴と統計情報を管理します
 */
const PromptUsageSchema = new Schema({
  promptId: {
    type: Schema.Types.ObjectId,
    ref: 'Prompt',
    required: true
  },
  versionId: {
    type: Schema.Types.ObjectId,
    ref: 'PromptVersion',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  context: {
    type: String,
    maxlength: [1000, 'コンテキストは1000文字以内で指定してください'],
    default: ''
  },
  inputTokens: {
    type: Number,
    default: 0
  },
  outputTokens: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: Number, // ミリ秒
    default: 0
  },
  userFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    comment: {
      type: String,
      maxlength: 500,
      default: ''
    },
    tags: [{
      type: String,
      enum: ['正確', '不正確', '役立つ', '役立たない', 'クリエイティブ', '過剰', '簡潔'],
    }]
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => ({})
  },
  isSuccess: {
    type: Boolean,
    default: true
  },
  errorType: {
    type: String,
    enum: ['なし', 'APIエラー', 'タイムアウト', 'コンテンツポリシー違反', 'その他'],
    default: 'なし'
  },
  usedAt: {
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
PromptUsageSchema.index({ promptId: 1, usedAt: -1 });
PromptUsageSchema.index({ versionId: 1 });
PromptUsageSchema.index({ userId: 1 });
PromptUsageSchema.index({ projectId: 1 });
PromptUsageSchema.index({ usedAt: 1 });
PromptUsageSchema.index({ isSuccess: 1 });

/**
 * プロンプト使用統計を取得するための静的メソッド
 * @param {String} promptId - プロンプトID
 * @param {Object} timeRange - 時間範囲（開始日、終了日）
 * @returns {Promise} - 使用統計
 */
PromptUsageSchema.statics.getUsageStats = async function(promptId, timeRange = {}) {
  const matchQuery = { promptId: new mongoose.Types.ObjectId(promptId) };
  
  if (timeRange.start) {
    matchQuery.usedAt = matchQuery.usedAt || {};
    matchQuery.usedAt.$gte = new Date(timeRange.start);
  }
  
  if (timeRange.end) {
    matchQuery.usedAt = matchQuery.usedAt || {};
    matchQuery.usedAt.$lte = new Date(timeRange.end);
  }
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalUsage: { $sum: 1 },
        successCount: {
          $sum: { $cond: [{ $eq: ['$isSuccess', true] }, 1, 0] }
        },
        totalInputTokens: { $sum: '$inputTokens' },
        totalOutputTokens: { $sum: '$outputTokens' },
        avgResponseTime: { $avg: '$responseTime' },
        avgRating: { $avg: '$userFeedback.rating' }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalUsage: 0,
      successCount: 0,
      successRate: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgResponseTime: 0,
      avgRating: 0
    };
  }
  
  const result = stats[0];
  result.successRate = result.totalUsage > 0 
    ? (result.successCount / result.totalUsage) * 100 
    : 0;
    
  delete result._id;
  return result;
};

/**
 * バージョンごとの使用統計を取得するための静的メソッド
 * @param {String} promptId - プロンプトID
 * @returns {Promise} - バージョンごとの統計
 */
PromptUsageSchema.statics.getVersionStats = async function(promptId) {
  return this.aggregate([
    { $match: { promptId: new mongoose.Types.ObjectId(promptId) } },
    {
      $group: {
        _id: '$versionId',
        totalUsage: { $sum: 1 },
        successCount: {
          $sum: { $cond: [{ $eq: ['$isSuccess', true] }, 1, 0] }
        },
        avgResponseTime: { $avg: '$responseTime' },
        avgRating: { $avg: '$userFeedback.rating' }
      }
    },
    {
      $lookup: {
        from: 'promptversions',
        localField: '_id',
        foreignField: '_id',
        as: 'version'
      }
    },
    {
      $unwind: '$version'
    },
    {
      $project: {
        versionId: '$_id',
        versionNumber: '$version.versionNumber',
        totalUsage: 1,
        successCount: 1,
        successRate: {
          $multiply: [
            { $divide: ['$successCount', { $max: ['$totalUsage', 1] }] },
            100
          ]
        },
        avgResponseTime: 1,
        avgRating: 1
      }
    },
    {
      $sort: { versionNumber: -1 }
    }
  ]);
};

/**
 * 時間ごとの使用統計を取得するための静的メソッド
 * @param {String} promptId - プロンプトID
 * @param {String} interval - 間隔（hour, day, week, month）
 * @param {Number} limit - 取得する結果数
 * @returns {Promise} - 時間ごとの統計
 */
PromptUsageSchema.statics.getTimeSeriesStats = async function(promptId, interval = 'day', limit = 30) {
  let dateFormat;
  
  switch (interval) {
    case 'hour':
      dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$usedAt' } };
      break;
    case 'day':
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$usedAt' } };
      break;
    case 'week':
      // MongoDBではweek numberを直接扱いにくいので年+週の形式で表現
      dateFormat = {
        $dateToString: {
          format: '%Y-W%U',
          date: '$usedAt'
        }
      };
      break;
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$usedAt' } };
      break;
    default:
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$usedAt' } };
  }
  
  return this.aggregate([
    { $match: { promptId: new mongoose.Types.ObjectId(promptId) } },
    {
      $group: {
        _id: dateFormat,
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: [{ $eq: ['$isSuccess', true] }, 1, 0] }
        },
        inputTokens: { $sum: '$inputTokens' },
        outputTokens: { $sum: '$outputTokens' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        count: 1,
        successCount: 1,
        successRate: {
          $multiply: [
            { $divide: ['$successCount', { $max: ['$count', 1] }] },
            100
          ]
        },
        inputTokens: 1,
        outputTokens: 1
      }
    },
    { $sort: { date: -1 } },
    { $limit: limit }
  ]);
};

/**
 * ユーザーごとのトークン使用統計を取得するための静的メソッド
 * @param {String} userId - ユーザーID
 * @param {Object} timeRange - 時間範囲（開始日、終了日）
 * @returns {Promise} - 使用統計
 */
PromptUsageSchema.statics.getUserTokenUsage = async function(userId, timeRange = {}) {
  const matchQuery = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (timeRange.start) {
    matchQuery.usedAt = matchQuery.usedAt || {};
    matchQuery.usedAt.$gte = new Date(timeRange.start);
  }
  
  if (timeRange.end) {
    matchQuery.usedAt = matchQuery.usedAt || {};
    matchQuery.usedAt.$lte = new Date(timeRange.end);
  }
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalInputTokens: { $sum: '$inputTokens' },
        totalOutputTokens: { $sum: '$outputTokens' },
        avgResponseTime: { $avg: '$responseTime' },
        successCount: {
          $sum: { $cond: [{ $eq: ['$isSuccess', true] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgResponseTime: 0,
      successCount: 0,
      successRate: 0
    };
  }
  
  const result = stats[0];
  result.successRate = result.totalRequests > 0 
    ? (result.successCount / result.totalRequests) * 100 
    : 0;
    
  delete result._id;
  return result;
};

/**
 * ユーザーの時間ごとの使用統計を取得するための静的メソッド
 * @param {String} userId - ユーザーID
 * @param {String} interval - 間隔（hour, day, week, month）
 * @param {Number} limit - 取得する結果数
 * @returns {Promise} - 時間ごとの統計
 */
PromptUsageSchema.statics.getUserTimeSeriesStats = async function(userId, interval = 'day', limit = 30) {
  let dateFormat;
  
  switch (interval) {
    case 'hour':
      dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$usedAt' } };
      break;
    case 'day':
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$usedAt' } };
      break;
    case 'week':
      dateFormat = {
        $dateToString: {
          format: '%Y-W%U',
          date: '$usedAt'
        }
      };
      break;
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$usedAt' } };
      break;
    default:
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$usedAt' } };
  }
  
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: dateFormat,
        count: { $sum: 1 },
        inputTokens: { $sum: '$inputTokens' },
        outputTokens: { $sum: '$outputTokens' },
        successCount: {
          $sum: { $cond: [{ $eq: ['$isSuccess', true] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        count: 1,
        inputTokens: 1,
        outputTokens: 1,
        successRate: {
          $multiply: [
            { $divide: ['$successCount', { $max: ['$count', 1] }] },
            100
          ]
        }
      }
    },
    { $sort: { date: -1 } },
    { $limit: limit }
  ]);
};

const PromptUsage = mongoose.model('PromptUsage', PromptUsageSchema);

module.exports = PromptUsage;