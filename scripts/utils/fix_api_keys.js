/**
 * APIキーの完全な値をモデルに保存するための修正スクリプト
 * 
 * このスクリプトは既存のAnthropicApiKeyモデルのレコードを更新し、
 * APIキーの完全な値をapiKeyFullフィールドに保存します。
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

// AnthropicApiKeyモデルのスキーマを定義
const AnthropicApiKeySchema = new mongoose.Schema({
  apiKeyId: String,
  keyHint: String,
  apiKeyFull: String, // 完全なAPIキー値
  name: String,
  status: String,
  workspaceId: String,
  lastUsedAt: Date,
  lastSyncedAt: Date
}, { 
  timestamps: true,
  collection: 'anthropicapikeys'
});

// SimpleUserモデルのスキーマを定義
const SimpleUserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  organizationId: mongoose.Schema.Types.ObjectId,
  organizationIds: [String],
  apiKeyId: String,
  apiKeyValue: String, // APIキー値
  status: String,
  refreshToken: String
}, { 
  timestamps: true,
  collection: 'simpleusers'
});

async function main() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("接続成功!");
    
    // モデルを作成
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
    
    // すべてのAPIキーを取得
    const apiKeys = await AnthropicApiKey.find().lean();
    console.log(`=== 合計 ${apiKeys.length} 件のAPIキーが見つかりました ===\n`);
    
    // すべてのユーザーを取得
    const users = await SimpleUser.find({
      apiKeyId: { $ne: null },
      apiKeyValue: { $ne: null }
    }).lean();
    console.log(`=== APIキー値を持つユーザー: ${users.length} 件見つかりました ===\n`);
    
    // APIキー値を持つユーザーから値を収集
    const apiKeyValues = {};
    users.forEach(user => {
      if (user.apiKeyId && user.apiKeyValue) {
        apiKeyValues[user.apiKeyId] = user.apiKeyValue;
      }
    });
    
    console.log(`=== ユーザーから収集したAPIキー値: ${Object.keys(apiKeyValues).length} 件 ===\n`);
    
    // APIキー更新カウンター
    let updatedCount = 0;
    let unmodifiedCount = 0;
    let errorCount = 0;
    
    // 各APIキーを処理
    for (const apiKey of apiKeys) {
      try {
        // 既にapiKeyFullフィールドが設定されていて、長さが40文字以上ある場合はスキップ
        if (apiKey.apiKeyFull && apiKey.apiKeyFull.length >= 40) {
          console.log(`[スキップ] APIキー ${apiKey.apiKeyId} は既に完全な値が設定されています`);
          unmodifiedCount++;
          continue;
        }
        
        let fullApiKey = null;
        
        // 1. ユーザーから収集したAPIキー値を使用
        if (apiKeyValues[apiKey.apiKeyId]) {
          fullApiKey = apiKeyValues[apiKey.apiKeyId];
          console.log(`[情報] APIキー ${apiKey.apiKeyId} の値をユーザーから取得しました`);
        }
        
        if (fullApiKey) {
          // 更新を実行
          await AnthropicApiKey.updateOne(
            { apiKeyId: apiKey.apiKeyId },
            { 
              $set: { 
                apiKeyFull: fullApiKey,
                lastSyncedAt: new Date()
              } 
            }
          );
          
          updatedCount++;
          console.log(`[成功] APIキー ${apiKey.apiKeyId} を更新しました`);
          
          // 更新後のデータを確認
          const updatedApiKey = await AnthropicApiKey.findOne({ apiKeyId: apiKey.apiKeyId });
          if (updatedApiKey.apiKeyFull) {
            console.log(`更新されたAPIキー長さ: ${updatedApiKey.apiKeyFull.length}`);
          }
        } else {
          console.log(`[警告] APIキー ${apiKey.apiKeyId} の完全な値を取得できませんでした`);
          errorCount++;
        }
      } catch (err) {
        console.error(`[エラー] APIキー ${apiKey.apiKeyId} の処理中にエラーが発生しました:`, err);
        errorCount++;
      }
    }
    
    console.log("\n=== 処理結果 ===");
    console.log(`更新成功: ${updatedCount} 件`);
    console.log(`変更なし: ${unmodifiedCount} 件`);
    console.log(`エラー: ${errorCount} 件`);
    console.log(`合計: ${apiKeys.length} 件`);
    
    // 確認のため、apiKeyFullが設定されたAPIキーの数を表示
    const completeKeys = await AnthropicApiKey.countDocuments({ 
      apiKeyFull: { $ne: null, $ne: "" }
    });
    console.log(`\n完全なAPIキー値が設定されたレコード数: ${completeKeys} / ${apiKeys.length}`);
    
    if (completeKeys === 0) {
      console.log("\n[警告] 完全なAPIキー値が設定されたレコードがありません。");
      console.log("次の手順を検討してください:");
      console.log("1. 有効なAPIキーを再度追加し、そのキー値をapiKeyFullフィールドに保存する");
      console.log("2. ユーザーに直接APIキー値を紐づける");
    }
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB接続を切断しました");
  }
}

main().catch(console.error);