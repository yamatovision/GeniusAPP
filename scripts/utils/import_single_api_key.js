/**
 * 単一のAnthropicAPIキーをデータベースに簡単に追加するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

// コマンドライン引数を取得
const apiKey = process.argv[2];
const keyName = process.argv[3] || "New API Key";

// 引数チェック
if (!apiKey) {
  console.error("エラー: APIキーが指定されていません。");
  console.log("使用方法: node import_single_api_key.js <APIキー> [キー名]");
  process.exit(1);
}

// MongoDB接続設定
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';

// APIキースキーマ定義
const AnthropicApiKeySchema = new mongoose.Schema({
  apiKeyId: String,
  keyHint: String,
  apiKeyFull: String,
  name: String,
  status: String,
  workspaceId: String,
  lastUsedAt: Date,
  lastSyncedAt: Date
}, { timestamps: true });

// 実行関数
async function importSingleApiKey() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(mongoURI, dbConfig.options);
    console.log("接続成功!");
    
    // モデル作成
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    
    // APIキーIDとヒントを作成
    const keyId = `key_${Date.now()}`;
    const keyHint = apiKey.substring(0, 10) + "..." + apiKey.substring(apiKey.length - 4);
    
    // 既存のAPIキーを確認
    const existingKeys = await AnthropicApiKey.find({ 
      apiKeyFull: apiKey 
    });
    
    if (existingKeys.length > 0) {
      console.log(`警告: 同じAPIキーが既に ${existingKeys.length} 件存在します。`);
      existingKeys.forEach(key => {
        console.log(`  - ID: ${key.apiKeyId}, 名前: ${key.name}`);
      });
      
      // 既存キーの更新
      console.log("最初の既存キーを更新します...");
      const keyToUpdate = existingKeys[0];
      keyToUpdate.name = keyName;
      keyToUpdate.lastSyncedAt = new Date();
      await keyToUpdate.save();
      console.log(`更新しました: ${keyToUpdate.apiKeyId}`);
      
      return;
    }
    
    // 新しいAPIキーを作成
    const newApiKey = new AnthropicApiKey({
      apiKeyId: keyId,
      keyHint: keyHint,
      apiKeyFull: apiKey,
      name: keyName,
      status: 'active',
      lastSyncedAt: new Date()
    });
    
    // データベースに保存
    await newApiKey.save();
    console.log("APIキーを追加しました:");
    console.log(`  ID: ${keyId}`);
    console.log(`  名前: ${keyName}`);
    console.log(`  キー: ${apiKey}`);
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB接続を切断しました");
  }
}

// スクリプト実行
importSingleApiKey().catch(console.error);