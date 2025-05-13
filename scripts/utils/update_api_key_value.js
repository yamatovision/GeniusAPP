/**
 * ユーザーのAPIキー値を直接設定するスクリプト
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
  apiKeyId: String,
  apiKeyValue: String,
  status: String,
  refreshToken: String
}, { 
  timestamps: true,
  collection: 'simpleusers'
});

// APIキーモデルのスキーマを定義
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

async function main() {
  try {
    // ユーザーのメールアドレスとAPIキー値を設定
    const targetEmail = 'shiraishi.tatsuya@mikoto.co.jp';
    
    // tatsuya3のAPIキー値 (ユーザーが指定した値)
    const apiKeyValue = 'sk-ant-api03-tatsuya3';
    
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("接続成功!");
    
    // モデルを作成
    const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    
    // 1. ユーザーを検索
    const user = await SimpleUser.findOne({ email: targetEmail });
    if (!user) {
      console.log(`ユーザーが見つかりません: ${targetEmail}`);
      return;
    }
    
    console.log(`ユーザー情報:`);
    console.log(`- 名前: ${user.name}`);
    console.log(`- メール: ${user.email}`);
    console.log(`- ロール: ${user.role}`);
    console.log(`- APIキーID: ${user.apiKeyId || 'なし'}`);
    console.log(`- 現在のAPIキー値: ${user.apiKeyValue || 'なし'}`);
    
    // 2. APIキーIDが存在する場合は、AnthropicApiKeyモデルも更新
    if (user.apiKeyId) {
      const apiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId });
      if (apiKey) {
        console.log(`\nAnthropicApiKey情報:`);
        console.log(`- ID: ${apiKey.apiKeyId}`);
        console.log(`- 名前: ${apiKey.name || 'なし'}`);
        console.log(`- ヒント: ${apiKey.keyHint || 'なし'}`);
        console.log(`- 現在のapiKeyFull: ${apiKey.apiKeyFull || 'なし'}`);
        
        // AnthropicApiKeyモデルを更新
        apiKey.apiKeyFull = apiKeyValue;
        await apiKey.save();
        console.log(`\n✅ AnthropicApiKeyモデルにAPIキー値を更新しました`);
      } else {
        console.log(`\n❌ APIキーID ${user.apiKeyId} に一致するAnthropicApiKeyが見つかりません`);
        
        // 新規にAPIキーレコードを作成
        console.log(`\n新しいAnthropicApiKeyレコードを作成します...`);
        const newApiKey = new AnthropicApiKey({
          apiKeyId: user.apiKeyId,
          keyHint: user.apiKeyId.startsWith('sk-') ? 
            `${user.apiKeyId.substring(0, 15)}...${user.apiKeyId.substring(user.apiKeyId.length - 4)}` : 
            `api-key-hint-${user.apiKeyId.substring(0, 5)}`,
          apiKeyFull: apiKeyValue,
          name: `${user.name}'s API Key`,
          status: 'active',
          lastSyncedAt: new Date()
        });
        
        await newApiKey.save();
        console.log(`✅ 新しいAnthropicApiKeyレコードを作成しました`);
      }
    }
    
    // 3. ユーザーモデルを更新
    user.apiKeyValue = apiKeyValue;
    await user.save();
    console.log(`\n✅ ユーザーモデルにAPIキー値を直接設定しました`);
    
    console.log(`\n更新完了! APIキー値が正常にデータベースに保存されました。`);
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB接続を切断しました");
  }
}

// メイン処理を実行
main().catch(console.error);