/**
 * AnthropicApiKeyの実際の値を確認するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

// MongoDB接続設定
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';

// 実行関数
async function viewApiKeys() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(mongoURI, dbConfig.options);
    console.log("接続成功!");
    
    // AnthropicApiKeyスキーマ定義
    const AnthropicApiKeySchema = new mongoose.Schema({
      apiKeyId: String,
      keyHint: String,
      apiKeyFull: String,
      name: String,
      status: String,
      workspaceId: String,
      lastUsedAt: Date,
      lastSyncedAt: Date
    }, { 
      timestamps: true,
      collection: 'anthropicapikeys'
    });
    
    // SimpleOrganizationスキーマ定義
    const SimpleOrganizationSchema = new mongoose.Schema({
      name: String,
      description: String,
      workspaceName: String,
      workspaceId: String,
      apiKeyIds: [String],
      members: [{ userId: String, role: String }],
      active: Boolean,
      availableApiKeys: [{
        keyId: String,
        apiKey: String,
        apiKeyFull: String,
        name: String,
        description: String
      }]
    });
    
    // モデル作成
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    
    // APIキーを取得 - 最新のものから順に
    console.log("=== AnthropicApiKey モデルから取得したAPIキー ===");
    const apiKeys = await AnthropicApiKey.find().sort({ createdAt: -1 }).lean();
    
    console.log(`合計: ${apiKeys.length}件`);
    
    apiKeys.forEach((key, index) => {
      console.log(`[${index + 1}] Key Name: ${key.name || 'None'}`);
      console.log(`  ID: ${key.apiKeyId}`);
      console.log(`  作成日時: ${key.createdAt}`);
      console.log(`  Hint: ${key.keyHint || 'None'}`);
      
      // APIキーの完全な値が保存されているか確認
      if (key.apiKeyFull) {
        console.log(`  Full Key: 保存済み (長さ: ${key.apiKeyFull.length}文字)`);
        console.log(`  先頭10文字: ${key.apiKeyFull.substring(0, 10)}...`);
        console.log(`  末尾4文字: ...${key.apiKeyFull.substring(key.apiKeyFull.length - 4)}`);
      } else {
        console.log(`  Full Key: 未保存`);
      }
      
      console.log(`  Status: ${key.status || 'None'}`);
      console.log('--------------------------------------');
    });
    
    // データベースの検索結果を直接確認
    console.log("\n=== MongoDB コレクションの直接検索 ===");
    const db = mongoose.connection.db;
    const collection = db.collection('anthropicapikeys');
    const latestKeys = await collection.find().sort({ createdAt: -1 }).limit(5).toArray();
    
    console.log(`最新の ${latestKeys.length} 件のAPIキー:`);
    latestKeys.forEach((key, index) => {
      console.log(`[${index + 1}] ID: ${key.apiKeyId || 'None'}`);
      console.log(`  Name: ${key.name || 'None'}`);
      console.log(`  作成日時: ${key.createdAt}`);
      console.log(`  apiKeyFull フィールド: ${key.apiKeyFull ? '存在する' : '存在しない'}`);
      if (key.apiKeyFull) {
        console.log(`  apiKeyFull 長さ: ${key.apiKeyFull.length}文字`);
        console.log(`  apiKeyFull 先頭10文字: ${key.apiKeyFull.substring(0, 10)}...`);
      }
      console.log(`  すべてのフィールド: ${Object.keys(key).join(', ')}`);
      console.log("--------------------------------------");
    });
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB接続を切断しました");
  }
}

// スクリプト実行
viewApiKeys().catch(console.error);