/**
 * シンプルなAPIキーモデル
 * Anthropic APIキーの管理を行うためのモデル
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SimpleApiKeySchema = new Schema({
  // システム内での一意識別子
  id: {
    type: String,
    required: true,
    unique: true
  },
  
  // Anthropicから取得したAPIキーの実際の値
  keyValue: {
    type: String,
    required: true
  },
  
  // 関連する組織ID（オプション）
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'SimpleOrganization',
    default: null
  },
  
  // APIキーのステータス
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },
  
  // 使用統計
  usage: {
    totalTokens: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// インデックス
SimpleApiKeySchema.index({ id: 1 }, { unique: true });
SimpleApiKeySchema.index({ organizationId: 1 });
SimpleApiKeySchema.index({ status: 1 });

const SimpleApiKey = mongoose.model('SimpleApiKey', SimpleApiKeySchema);
module.exports = SimpleApiKey;