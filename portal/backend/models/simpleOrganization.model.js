/**
 * シンプルな組織モデル
 * ワークスペース情報も含んだシンプルな組織管理
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SimpleOrganizationSchema = new Schema({
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
  
  // ワークスペース名（1:1対応のため組織モデルに統合）
  workspaceName: {
    type: String,
    required: [true, 'ワークスペース名は必須です'],
    trim: true,
    maxlength: [100, 'ワークスペース名は100文字以内で指定してください']
  },
  
  // 作成者ID
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'SimpleUser',
    required: true
  },
  
  // 組織に紐づくAPIキーIDのリスト
  apiKeyIds: [{
    type: String,
    ref: 'SimpleApiKey'
  }],
  
  // 組織のステータス
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  }
}, {
  timestamps: true
});

// インデックス
SimpleOrganizationSchema.index({ name: 1 }, { unique: true });
SimpleOrganizationSchema.index({ createdBy: 1 });
SimpleOrganizationSchema.index({ status: 1 });

// APIキーを追加するメソッド
SimpleOrganizationSchema.methods.addApiKey = function(apiKeyId) {
  if (!this.apiKeyIds.includes(apiKeyId)) {
    this.apiKeyIds.push(apiKeyId);
  }
  return this.save();
};

// APIキーを削除するメソッド
SimpleOrganizationSchema.methods.removeApiKey = function(apiKeyId) {
  this.apiKeyIds = this.apiKeyIds.filter(id => id !== apiKeyId);
  return this.save();
};

const SimpleOrganization = mongoose.model('SimpleOrganization', SimpleOrganizationSchema);
module.exports = SimpleOrganization;