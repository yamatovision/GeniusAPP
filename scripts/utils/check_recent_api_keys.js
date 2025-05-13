/**
 * 最近追加されたAPIキーを検索するスクリプト
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

// SimpleOrganizationモデルのスキーマを定義
const SimpleOrganizationSchema = new mongoose.Schema({
  name: String,
  description: String,
  workspaceName: String,
  workspaceId: String,
  apiKeyIds: [String],
  members: [{ 
    userId: String, 
    role: String 
  }],
  active: Boolean,
  status: String
}, { timestamps: true });

async function main() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log("接続成功!");
    
    // モデルを作成
    const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    const SimpleOrganization = mongoose.model('SimpleOrganization', SimpleOrganizationSchema);
    
    // 特定ユーザーの取得
    const targetEmail = 'shiraishi.tatsuya@mikoto.co.jp';
    const user = await SimpleUser.findOne({ email: targetEmail }).lean();
    
    if (!user) {
      console.log(`ユーザー ${targetEmail} は見つかりませんでした`);
      return;
    }
    
    console.log("\n=== ユーザー情報 ===");
    console.log(`名前: ${user.name}`);
    console.log(`メール: ${user.email}`);
    console.log(`ロール: ${user.role}`);
    console.log(`APIキーID: ${user.apiKeyId || 'なし'}`);
    
    // ユーザーのAPIキー詳細を確認
    if (user.apiKeyId) {
      console.log(`\n=== ユーザーのAPIキー詳細 ===`);
      console.log(`APIキーID: ${user.apiKeyId}`);
      console.log(`APIキー値: ${user.apiKeyValue || 'なし'}`);
      
      // AnthropicApiKeyモデルから情報取得
      const apiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId }).lean();
      
      if (apiKey) {
        console.log(`\n=== AnthropicApiKey情報 ===`);
        console.log(`APIキーID: ${apiKey.apiKeyId}`);
        console.log(`名前: ${apiKey.name || 'なし'}`);
        console.log(`APIキー完全値: ${apiKey.apiKeyFull || 'なし'}`);
        console.log(`ステータス: ${apiKey.status || 'なし'}`);
        console.log(`最終更新: ${apiKey.lastSyncedAt || 'なし'}`);
        console.log(`作成日時: ${apiKey.createdAt || 'なし'}`);
      } else {
        console.log(`\n⚠️ このAPIキーID (${user.apiKeyId}) はAnthropicApiKeyモデルに存在しません`);
      }
    }
    
    // 最近追加されたAPIキーを取得
    console.log("\n=== 最近追加された10件のAPIキー ===");
    const recentApiKeys = await AnthropicApiKey.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    recentApiKeys.forEach((key, index) => {
      console.log(`\n[${index + 1}] APIキー情報:`);
      console.log(`  APIキーID: ${key.apiKeyId}`);
      console.log(`  名前: ${key.name || 'なし'}`);
      console.log(`  完全な値: ${key.apiKeyFull || 'なし'}`);
      console.log(`  ステータス: ${key.status || 'なし'}`);
      console.log(`  作成日時: ${key.createdAt || 'なし'}`);
    });
    
    // ユーザーの所属組織のAPIキーも確認
    if (user.organizationId) {
      const organization = await SimpleOrganization.findById(user.organizationId).lean();
      
      if (organization) {
        console.log(`\n=== 所属組織 (${organization.name}) のAPIキー ===`);
        console.log(`組織ID: ${organization._id}`);
        console.log(`APIキーIDs: ${organization.apiKeyIds?.join(', ') || 'なし'}`);
        
        if (organization.apiKeyIds && organization.apiKeyIds.length > 0) {
          const orgApiKeys = await AnthropicApiKey.find({ 
            apiKeyId: { $in: organization.apiKeyIds } 
          }).lean();
          
          orgApiKeys.forEach((key, index) => {
            console.log(`\n[${index + 1}] 組織のAPIキー:`);
            console.log(`  APIキーID: ${key.apiKeyId}`);
            console.log(`  名前: ${key.name || 'なし'}`);
            console.log(`  完全な値: ${key.apiKeyFull || 'なし'}`);
            console.log(`  ステータス: ${key.status || 'なし'}`);
            console.log(`  作成日時: ${key.createdAt || 'なし'}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB接続を切断しました");
  }
}

main().catch(console.error);