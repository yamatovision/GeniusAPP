/**
 * SystemConfigモデル
 * システム全体の設定を管理するモデル
 * Admin APIキーなどシステム全体で共有する設定を保存
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const SystemConfigSchema = new Schema({
  // 暗号化されたAdmin APIキー（システム全体で1つ）
  adminApiKey: { 
    type: String 
  },
  
  // APIキー暗号化用のシークレット
  encryptionSecret: {
    type: String
  },
  
  // システム設定の説明
  description: {
    type: String,
    default: 'システム全体の設定'
  },
  
  // AnthropicコンソールURL
  anthropicConsoleUrl: {
    type: String,
    default: 'https://console.anthropic.com'
  },
  
  // メタデータ（追加情報を柔軟に保存）
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => ({})
  }
}, {
  timestamps: true // 作成日時・更新日時を自動追加
});

/**
 * Admin APIキーを暗号化して保存
 * @param {string} apiKey - 暗号化するAPIキー
 * @param {string} secret - 暗号化シークレット
 * @returns {string} - 暗号化されたAPIキー
 */
SystemConfigSchema.methods.encryptApiKey = function(apiKey, secret) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  } catch (error) {
    console.error('Admin API Key暗号化エラー:', error);
    throw new Error('APIキーの暗号化に失敗しました');
  }
};

/**
 * 暗号化されたAdmin APIキーを復号化
 * @param {string} encryptedApiKey - 暗号化されたAPIキー
 * @param {string} secret - 復号化シークレット
 * @returns {string} - 復号化されたAPIキー
 */
SystemConfigSchema.methods.decryptApiKey = function(encryptedApiKey, secret) {
  try {
    const parts = encryptedApiKey.split(':');
    if (parts.length !== 3) {
      throw new Error('暗号化されたAPIキーの形式が無効です');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Admin API Key復号化エラー:', error);
    throw new Error('APIキーの復号化に失敗しました');
  }
};

/**
 * 暗号化シークレットを生成
 * @returns {string} - 生成された暗号化シークレット
 */
SystemConfigSchema.statics.generateEncryptionSecret = function() {
  return crypto.randomBytes(32).toString('hex');
};

const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);
module.exports = SystemConfig;