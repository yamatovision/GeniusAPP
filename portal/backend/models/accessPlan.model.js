/**
 * アクセスプランモデル
 * APIアクセスレベルと対応するプラン制限を管理
 */
const mongoose = require('mongoose');

// アクセスプランスキーマ定義
const AccessPlanSchema = new mongoose.Schema({
  // プラン名称
  name: {
    type: String,
    required: [true, 'プラン名は必須です'],
    unique: true,
    trim: true
  },

  // アクセスレベル
  accessLevel: {
    type: String,
    enum: ['basic', 'advanced', 'premium'],
    required: [true, 'アクセスレベルは必須です']
  },

  // 月間トークン上限
  monthlyTokenLimit: {
    type: Number,
    required: [true, '月間トークン上限は必須です'],
    min: [1000, '月間トークン上限は1000以上である必要があります']
  },

  // 日次トークン上限（nullの場合は制限なし）
  dailyTokenLimit: {
    type: Number,
    default: null
  },

  // 同時接続数上限
  concurrentRequestLimit: {
    type: Number,
    default: 5
  },

  // モデル使用制限
  allowedModels: {
    type: [String],
    default: ['sonnet']
  },

  // プラン説明
  description: {
    type: String,
    default: ''
  },

  // 有効フラグ
  isActive: {
    type: Boolean,
    default: true
  },

  // 作成ユーザー
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // 更新ユーザー
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  // タイムスタンプフィールド（作成日時・更新日時）
  timestamps: true
});

// デフォルトプランを取得
AccessPlanSchema.statics.getDefaultPlans = function() {
  return [
    {
      name: 'ベーシック',
      accessLevel: 'basic',
      monthlyTokenLimit: 100000,  // 10万トークン/月
      dailyTokenLimit: 10000,     // 1万トークン/日
      concurrentRequestLimit: 2,
      allowedModels: ['sonnet'],
      description: '基本的なAPI機能のみ利用可能なプラン'
    },
    {
      name: 'アドバンスト',
      accessLevel: 'advanced',
      monthlyTokenLimit: 500000,  // 50万トークン/月
      dailyTokenLimit: 50000,     // 5万トークン/日
      concurrentRequestLimit: 5,
      allowedModels: ['sonnet', 'opus'],
      description: '拡張API機能が利用可能なプラン'
    },
    {
      name: 'プレミアム',
      accessLevel: 'premium',
      monthlyTokenLimit: 2000000, // 200万トークン/月
      dailyTokenLimit: null,      // 日次制限なし
      concurrentRequestLimit: 10,
      allowedModels: ['sonnet', 'opus', 'haiku'],
      description: '全機能が利用可能なプラン'
    }
  ];
};

// アクセスレベルからプランを取得
AccessPlanSchema.statics.findByAccessLevel = function(accessLevel) {
  return this.findOne({ accessLevel, isActive: true });
};

// モデルをエクスポート
const AccessPlan = mongoose.model('AccessPlan', AccessPlanSchema);
module.exports = AccessPlan;