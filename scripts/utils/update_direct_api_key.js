/**
 * 特定のAPIキーIDのキー値を直接更新するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

// 更新対象のAPIキー情報
const TARGET_API_KEY_ID = 'apikey_01SaHN7TvQ443ZVjR73Ry5XV'; // tatsuya4のAPIキーID
const NEW_API_KEY_VALUE = 'sk-ant-api03-XXXXX'; // ダミー値に置き換え

// AnthropicApiKeyモデルのスキーマを定義
const AnthropicApiKeySchema = new mongoose.Schema({
  apiKeyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  apiKeyFull: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  workspaceId: {
    type: String,
    default: null
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// SimpleUserモデルのスキーマを定義
const SimpleUserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  organizationId: mongoose.Schema.Types.ObjectId,
  organizationIds: [String],
  apiKeyId: String,
  apiKeyValue: String,
  status: String,
  refreshToken: String
}, { timestamps: true });

async function main() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log("接続成功!");
    
    // モデルを作成
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
    
    // 1. APIキーの詳細を取得
    console.log(`\n1. APIキー ${TARGET_API_KEY_ID} の詳細を確認します...`);
    const apiKey = await AnthropicApiKey.findOne({ apiKeyId: TARGET_API_KEY_ID }).lean();
    
    if (!apiKey) {
      console.log(`⚠️ APIキー ${TARGET_API_KEY_ID} が見つかりません`);
      return;
    }
    
    console.log('APIキー情報:');
    console.log(`ID: ${apiKey.apiKeyId}`);
    console.log(`名前: ${apiKey.name}`);
    console.log(`完全な値: ${apiKey.apiKeyFull ? '設定済み' : 'なし'}`);
    
    // 2. APIキーの値を更新
    console.log(`\n2. APIキーの値を更新します...`);
    const updateResult = await AnthropicApiKey.updateOne(
      { apiKeyId: TARGET_API_KEY_ID },
      { 
        $set: { 
          apiKeyFull: NEW_API_KEY_VALUE,
          lastSyncedAt: new Date()
        } 
      }
    );
    
    console.log('更新結果:', updateResult);
    
    // 3. このAPIキーを使っているユーザーのapiKeyValueも更新
    console.log(`\n3. このAPIキーを使っているユーザーを更新します...`);
    const usersUpdateResult = await SimpleUser.updateMany(
      { apiKeyId: TARGET_API_KEY_ID },
      { $set: { apiKeyValue: NEW_API_KEY_VALUE } }
    );
    
    console.log('ユーザー更新結果:', usersUpdateResult);
    
    // 4. 更新結果の確認
    console.log(`\n4. 更新後のAPIキー情報を確認します...`);
    const updatedApiKey = await AnthropicApiKey.findOne({ apiKeyId: TARGET_API_KEY_ID }).lean();
    
    console.log('更新後のAPIキー情報:');
    console.log(`ID: ${updatedApiKey.apiKeyId}`);
    console.log(`名前: ${updatedApiKey.name}`);
    console.log(`完全な値: ${updatedApiKey.apiKeyFull ? updatedApiKey.apiKeyFull.substring(0, 15) + '...' : 'なし'}`);
    console.log(`完全な値の長さ: ${updatedApiKey.apiKeyFull ? updatedApiKey.apiKeyFull.length : 0}文字`);
    
    // 5. このAPIキーを使っているユーザーを確認
    console.log(`\n5. このAPIキーを使っているユーザーを確認します...`);
    const users = await SimpleUser.find({ apiKeyId: TARGET_API_KEY_ID }).lean();
    
    users.forEach((user, index) => {
      console.log(`\n[${index + 1}] ユーザー: ${user.name} (${user.email})`);
      console.log(`APIキーID: ${user.apiKeyId}`);
      console.log(`APIキー値: ${user.apiKeyValue ? user.apiKeyValue.substring(0, 15) + '...' : 'なし'}`);
      console.log(`APIキー値の長さ: ${user.apiKeyValue ? user.apiKeyValue.length : 0}文字`);
    });
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB接続を切断しました");
  }
}

main().catch(console.error);