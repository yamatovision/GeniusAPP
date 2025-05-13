/**
 * AnthropicApiKeyの情報を取得するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

// APIキーモデルのスキーマを定義
const AnthropicApiKeySchema = new mongoose.Schema({
  apiKeyId: String,
  keyHint: String,
  name: String,
  status: String,
  workspaceId: String,
  lastUsedAt: Date,
  lastSyncedAt: Date
}, { timestamps: true });

async function main() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log("接続成功!");
    
    // モデルを作成
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    
    // すべてのAPIキーを取得
    const apiKeys = await AnthropicApiKey.find().lean();
    
    console.log(`=== 合計 ${apiKeys.length} 件のAPIキーが見つかりました ===\n`);
    
    // APIキーの詳細情報を表示
    apiKeys.forEach((key, index) => {
      console.log(`[${index + 1}] API Key: ${key.name || '名前なし'}`);
      console.log(`  - ID: ${key.apiKeyId}`);
      console.log(`  - Hint: ${key.keyHint}`);
      console.log(`  - Status: ${key.status}`);
      console.log(`  - Workspace: ${key.workspaceId || 'なし'}`);
      console.log(`  - 最終使用日時: ${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'なし'}`);
      console.log(`  - 最終同期日時: ${key.lastSyncedAt ? new Date(key.lastSyncedAt).toLocaleString() : 'なし'}`);
      console.log(`  - 作成日時: ${key.createdAt ? new Date(key.createdAt).toLocaleString() : 'なし'}`);
      console.log(`  - 更新日時: ${key.updatedAt ? new Date(key.updatedAt).toLocaleString() : 'なし'}`);
      console.log('---------------------------------------------');
    });
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB接続を切断しました");
  }
}

main().catch(console.error);