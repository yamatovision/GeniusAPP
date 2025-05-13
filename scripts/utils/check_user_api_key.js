/**
 * 特定ユーザーのAPIキー詳細確認スクリプト
 * 
 * 指定したユーザーのAPIキー情報をMongoDBから取得し、詳細を表示します
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

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

// AnthropicApiKeyモデルのスキーマを定義
const AnthropicApiKeySchema = new mongoose.Schema({
  apiKeyId: String,
  apiKeyFull: String,
  name: String,
  status: String,
  workspaceId: String,
  lastUsedAt: Date,
  lastSyncedAt: Date
}, { timestamps: true });

// 検索するユーザーの情報
const TARGET_EMAIL = 'shiraishi.tatsuya@mikoto.co.jp';

async function main() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log("接続成功!");
    
    // モデルを作成
    const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    
    console.log(`ユーザー検索: ${TARGET_EMAIL}`);
    
    // ユーザーを検索
    const user = await SimpleUser.findOne({ email: TARGET_EMAIL }).lean();
    
    if (!user) {
      console.log(`ユーザー ${TARGET_EMAIL} は見つかりませんでした`);
      return;
    }
    
    console.log("\n=== ユーザー情報 ===");
    console.log(`名前: ${user.name}`);
    console.log(`メール: ${user.email}`);
    console.log(`ロール: ${user.role}`);
    console.log(`APIキーID: ${user.apiKeyId || 'なし'}`);
    console.log(`APIキー値: ${user.apiKeyValue ? '設定済み' + (user.apiKeyValue.includes('tatsuya3') ? ' (tatsuya3を含む)' : '') : 'なし'}`);
    
    if (user.apiKeyValue) {
      console.log(`\nユーザーのapiKeyValue: ${user.apiKeyValue}`);
    }
    
    // APIキーIDがある場合はAnthropicApiKeyから詳細を取得
    if (user.apiKeyId) {
      const apiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId }).lean();
      
      console.log("\n=== AnthropicApiKey情報 ===");
      
      if (apiKey) {
        console.log(`APIキーID: ${apiKey.apiKeyId}`);
        console.log(`名前: ${apiKey.name || 'なし'}`);
        console.log(`完全なキー値: ${apiKey.apiKeyFull ? '設定済み' + (apiKey.apiKeyFull.includes('tatsuya3') ? ' (tatsuya3を含む)' : '') : 'なし'}`);
        
        if (apiKey.apiKeyFull) {
          console.log(`\nAnthropicApiKeyのapiKeyFull: ${apiKey.apiKeyFull}`);
        }
        
        console.log(`ステータス: ${apiKey.status || 'なし'}`);
        console.log(`最終使用: ${apiKey.lastUsedAt || 'なし'}`);
        console.log(`最終同期: ${apiKey.lastSyncedAt || 'なし'}`);
        console.log(`作成日時: ${apiKey.createdAt || 'なし'}`);
      } else {
        console.log(`APIキーID ${user.apiKeyId} に対応するAnthropicApiKeyレコードは見つかりませんでした`);
      }
    }
    
    // 'tatsuya4'を含むすべてのAPIキーを検索
    console.log("\n=== 'tatsuya4'を含むAPIキーの検索 ===");
    const tatsuya3Keys = await AnthropicApiKey.find({ 
      apiKeyFull: { $regex: 'tatsuya4', $options: 'i' } 
    }).lean();
    
    if (tatsuya3Keys.length > 0) {
      console.log(`${tatsuya3Keys.length}件の'tatsuya3'を含むAPIキーが見つかりました:`);
      
      tatsuya3Keys.forEach((key, i) => {
        console.log(`\n[${i + 1}] APIキー情報:`);
        console.log(`  APIキーID: ${key.apiKeyId}`);
        console.log(`  名前: ${key.name || 'なし'}`);
        console.log(`  キー値: ${key.apiKeyFull}`);
        console.log(`  ステータス: ${key.status || 'なし'}`);
        console.log(`  作成日時: ${key.createdAt || 'なし'}`);
      });
    } else {
      console.log("'tatsuya3'を含むAPIキーは見つかりませんでした");
    }
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB接続を切断しました");
  }
}

main().catch(console.error);