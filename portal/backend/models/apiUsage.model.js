/**
 * API使用量モデル
 * ユーザーごとのAPI使用量を追跡するMongoDBモデル
 */
const mongoose = require('mongoose');

// API使用量スキーマ定義
const ApiUsageSchema = new mongoose.Schema({
  // ユーザーID（必須）
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ユーザーIDは必須です'],
    index: true
  },

  // 組織ID（オプション）
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },

  // ワークスペースID（オプション）
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },

  // プロジェクトID（オプション）
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },

  // タイムスタンプ
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // API種別（'chat', 'completions'など）
  apiType: {
    type: String,
    required: [true, 'API種別は必須です'],
    enum: ['chat', 'completions', 'other'],
    index: true
  },

  // エンドポイント
  endpoint: {
    type: String,
    required: [true, 'エンドポイントは必須です']
  },

  // 入力トークン数
  inputTokens: {
    type: Number,
    required: [true, '入力トークン数は必須です'],
    min: [0, '入力トークン数は0以上である必要があります']
  },

  // 出力トークン数
  outputTokens: {
    type: Number,
    required: [true, '出力トークン数は必須です'],
    min: [0, '出力トークン数は0以上である必要があります']
  },

  // 合計トークン数
  totalTokens: {
    type: Number,
    required: [true, '合計トークン数は必須です'],
    min: [0, '合計トークン数は0以上である必要があります']
  },

  // 成功フラグ
  success: {
    type: Boolean,
    required: [true, '成功フラグは必須です'],
    default: true
  },

  // エラーコード（失敗時のみ）
  errorCode: {
    type: String
  },

  // エラーメッセージ（失敗時のみ）
  errorMessage: {
    type: String
  },

  // リクエスト情報（簡略化）
  request: {
    // モデル名
    model: {
      type: String
    },
    // プロンプト（最初の50文字のみ保存）
    promptPreview: {
      type: String
    },
    // リクエストヘッダー（機密情報除去済み）
    headers: {
      type: Object
    }
  },

  // メタデータ（その他情報）
  metadata: {
    type: Object
  }
}, {
  // タイムスタンプ無効（独自のtimestampフィールドを使用）
  timestamps: false,
  
  // インデックス設定
  indexes: [
    // 日付範囲でのクエリを高速化
    { timestamp: 1 },
    // ユーザーごとの使用量検索を高速化
    { userId: 1, timestamp: 1 },
    // API種別ごとの使用量検索を高速化
    { apiType: 1, timestamp: 1 },
    // 複合インデックス（ユーザー + API種別 + 日付）
    { userId: 1, apiType: 1, timestamp: 1 }
  ]
});

// 日次使用量集計用のスタティックメソッド
ApiUsageSchema.statics.getDailyUsage = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await this.aggregate([
    {
      $match: {
        userId: userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: null,
        totalInputTokens: { $sum: "$inputTokens" },
        totalOutputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        requestCount: { $sum: 1 },
        successCount: { 
          $sum: { $cond: ["$success", 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalInputTokens: 1,
        totalOutputTokens: 1,
        totalTokens: 1,
        requestCount: 1,
        successCount: 1,
        successRate: { 
          $cond: [
            { $eq: ["$requestCount", 0] },
            1,
            { $divide: ["$successCount", "$requestCount"] }
          ]
        }
      }
    }
  ]);
  
  return result[0] || {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    successCount: 0,
    successRate: 1
  };
};

// 月次使用量集計用のスタティックメソッド
ApiUsageSchema.statics.getMonthlyUsage = async function(userId, year, month) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  
  const result = await this.aggregate([
    {
      $match: {
        userId: userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startOfMonth, $lte: endOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        totalInputTokens: { $sum: "$inputTokens" },
        totalOutputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        requestCount: { $sum: 1 },
        successCount: { 
          $sum: { $cond: ["$success", 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalInputTokens: 1,
        totalOutputTokens: 1,
        totalTokens: 1,
        requestCount: 1,
        successCount: 1,
        successRate: { 
          $cond: [
            { $eq: ["$requestCount", 0] },
            1,
            { $divide: ["$successCount", "$requestCount"] }
          ]
        }
      }
    }
  ]);
  
  return result[0] || {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    successCount: 0,
    successRate: 1
  };
};

// ユーザートークン使用量取得用のスタティックメソッド
ApiUsageSchema.statics.getUserTokenUsage = async function(userId, timeRange = {}) {
  // タイムスタンプフィルタの構築
  const timeFilter = {};
  if (timeRange.start) {
    timeFilter.$gte = new Date(timeRange.start);
  }
  if (timeRange.end) {
    timeFilter.$lte = new Date(timeRange.end);
  }
  
  // クエリの構築
  const matchQuery = {
    userId: userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId)
  };
  
  // タイムスタンプフィルタがある場合は追加
  if (Object.keys(timeFilter).length > 0) {
    matchQuery.timestamp = timeFilter;
  }
  
  // 集計クエリの実行
  const result = await this.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: null,
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ["$success", 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 1,
        count: 1,
        successCount: 1,
        successRate: { 
          $cond: [
            { $eq: ["$count", 0] },
            1,
            { $divide: ["$successCount", "$count"] }
          ]
        }
      }
    }
  ]);
  
  // 結果がなければデフォルト値を返す
  return result[0] || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    count: 0,
    successCount: 0,
    successRate: 1
  };
};

// 組織のトークン使用量取得用のスタティックメソッド
ApiUsageSchema.statics.getOrganizationTokenUsage = async function(organizationId, timeRange = {}) {
  // タイムスタンプフィルタの構築
  const timeFilter = {};
  if (timeRange.start) {
    timeFilter.$gte = new Date(timeRange.start);
  }
  if (timeRange.end) {
    timeFilter.$lte = new Date(timeRange.end);
  }
  
  // クエリの構築
  const matchQuery = {
    organizationId: organizationId instanceof mongoose.Types.ObjectId ? 
      organizationId : new mongoose.Types.ObjectId(organizationId)
  };
  
  // タイムスタンプフィルタがある場合は追加
  if (Object.keys(timeFilter).length > 0) {
    matchQuery.timestamp = timeFilter;
  }
  
  // 集計クエリの実行
  const result = await this.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: null,
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ["$success", 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 1,
        count: 1,
        successCount: 1,
        successRate: { 
          $cond: [
            { $eq: ["$count", 0] },
            1,
            { $divide: ["$successCount", "$count"] }
          ]
        }
      }
    }
  ]);
  
  // 結果がなければデフォルト値を返す
  return result[0] || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    count: 0,
    successCount: 0,
    successRate: 1
  };
};

// ワークスペースのトークン使用量取得用のスタティックメソッド
ApiUsageSchema.statics.getWorkspaceTokenUsage = async function(workspaceId, timeRange = {}) {
  // タイムスタンプフィルタの構築
  const timeFilter = {};
  if (timeRange.start) {
    timeFilter.$gte = new Date(timeRange.start);
  }
  if (timeRange.end) {
    timeFilter.$lte = new Date(timeRange.end);
  }
  
  // クエリの構築
  const matchQuery = {
    workspaceId: workspaceId instanceof mongoose.Types.ObjectId ? 
      workspaceId : new mongoose.Types.ObjectId(workspaceId)
  };
  
  // タイムスタンプフィルタがある場合は追加
  if (Object.keys(timeFilter).length > 0) {
    matchQuery.timestamp = timeFilter;
  }
  
  // 集計クエリの実行
  const result = await this.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: null,
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ["$success", 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 1,
        count: 1,
        successCount: 1,
        successRate: { 
          $cond: [
            { $eq: ["$count", 0] },
            1,
            { $divide: ["$successCount", "$count"] }
          ]
        }
      }
    }
  ]);
  
  // 結果がなければデフォルト値を返す
  return result[0] || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    count: 0,
    successCount: 0,
    successRate: 1
  };
};

// 組織内のワークスペース別使用量取得
ApiUsageSchema.statics.getOrganizationWorkspaceUsage = async function(organizationId, timeRange = {}) {
  // タイムスタンプフィルタの構築
  const timeFilter = {};
  if (timeRange.start) {
    timeFilter.$gte = new Date(timeRange.start);
  }
  if (timeRange.end) {
    timeFilter.$lte = new Date(timeRange.end);
  }
  
  // クエリの構築
  const matchQuery = {
    organizationId: organizationId instanceof mongoose.Types.ObjectId ? 
      organizationId : new mongoose.Types.ObjectId(organizationId)
  };
  
  // タイムスタンプフィルタがある場合は追加
  if (Object.keys(timeFilter).length > 0) {
    matchQuery.timestamp = timeFilter;
  }
  
  // 集計クエリの実行
  const result = await this.aggregate([
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: "$workspaceId",
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ["$success", 1, 0] } }
      }
    },
    {
      $lookup: {
        from: "workspaces",
        localField: "_id",
        foreignField: "_id",
        as: "workspace"
      }
    },
    {
      $unwind: {
        path: "$workspace",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        workspaceId: "$_id",
        workspaceName: "$workspace.name",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 1,
        count: 1,
        successCount: 1,
        successRate: { 
          $cond: [
            { $eq: ["$count", 0] },
            1,
            { $divide: ["$successCount", "$count"] }
          ]
        }
      }
    },
    {
      $sort: { totalTokens: -1 }
    }
  ]);
  
  return Array.isArray(result) ? result : [];
};

// API使用量モデルをエクスポート
const ApiUsage = mongoose.model('ApiUsage', ApiUsageSchema);
module.exports = ApiUsage;