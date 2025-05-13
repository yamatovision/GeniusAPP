/**
 * APIキー保存プロセスのデバッグスクリプト
 * 
 * Anthropic APIキー検証と保存の流れを再現して、どこで問題が発生しているか確認します
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');
const axios = require('axios');

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

// APIキーをインポートまたは更新するメソッドを追加
AnthropicApiKeySchema.statics.importKey = async function(apiKeyData) {
  console.log('importKey called with:', JSON.stringify(apiKeyData, null, 2));
  
  // 必須パラメータのチェック
  if (!apiKeyData.id) {
    throw new Error('APIキーIDが必要です');
  }
  
  try {
    // 既存のAPIキーを探す
    const existingKey = await this.findOne({ apiKeyId: apiKeyData.id });
    
    if (existingKey) {
      console.log(`既存のAPIキー ${apiKeyData.id} を更新します`);
      // 既存キーを更新
      if (apiKeyData.apiKeyFull) {
        console.log(`完全なAPIキー値を設定: ${apiKeyData.apiKeyFull.substring(0, 10)}...`);
        existingKey.apiKeyFull = apiKeyData.apiKeyFull;
      } else {
        console.log('WARNING: apiKeyFullが提供されていません');
      }
      existingKey.name = apiKeyData.name;
      existingKey.lastSyncedAt = new Date();
      const result = await existingKey.save();
      console.log('更新結果:', result);
      return result;
    } else {
      console.log(`新規APIキー ${apiKeyData.id} を作成します`);
      // apiKeyFullが必須パラメータになっているか確認
      if (!apiKeyData.apiKeyFull) {
        console.log('ERROR: 新規キー作成時にapiKeyFullが必要です');
        throw new Error('APIキーの完全な値が必要です');
      }
      
      // 新規APIキーを作成
      const newKey = {
        apiKeyId: apiKeyData.id,
        apiKeyFull: apiKeyData.apiKeyFull,
        name: apiKeyData.name,
        status: 'active',
        lastSyncedAt: new Date()
      };
      
      console.log('作成するキー:', JSON.stringify(newKey, null, 2));
      const result = await this.create(newKey);
      console.log('作成結果:', result);
      return result;
    }
  } catch (error) {
    console.error('APIキーのインポート中にエラーが発生しました:', error);
    throw error;
  }
};

// APIキー値を処理する関数
function formatApiKeyHint(keyValue) {
  if (!keyValue) return { hint: '', full: '' };
  
  // 完全なキー値を返す
  return {
    hint: keyValue,
    full: keyValue
  };
}

// ダミーのAnthropicAdminServiceを作成
const anthropicAdminService = {
  async verifyApiKey(adminKey, keyToVerify) {
    console.log(`verifyApiKey called with: adminKey=${adminKey ? '設定済み' : 'なし'}, keyToVerify=${keyToVerify}`);
    
    // 実際のAPIキーの代わりにテスト用の応答を返す
    // 本来はAnthropicのAPIに問い合わせるが、テスト用にモック
    return {
      id: 'apikey_test123',
      name: 'Tatsuya2',
      status: 'active'
    };
  }
};

// テスト用のAPIキー
const TEST_API_KEY = 'sk-ant-api03-tatsuya2-test-key';

async function main() {
  try {
    console.log("MongoDBに接続しています...");
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log("接続成功!");
    
    // モデルを登録
    const AnthropicApiKey = mongoose.model('AnthropicApiKey', AnthropicApiKeySchema);
    
    console.log("=== APIキー保存プロセスのデバッグ ===");
    
    // 1. formatApiKeyHint関数のテスト
    console.log("\n1. formatApiKeyHint関数のテスト:");
    const keyInfo = formatApiKeyHint(TEST_API_KEY);
    console.log("結果:", keyInfo);
    
    // 2. verifyApiKey関数のテスト
    console.log("\n2. verifyApiKey関数のテスト:");
    try {
      const apiKeyInfoResponse = await anthropicAdminService.verifyApiKey(
        process.env.ANTHROPIC_ADMIN_KEY || 'dummy-admin-key',
        TEST_API_KEY
      );
      console.log("検証結果:", apiKeyInfoResponse);
      
      // 3. APIキーの保存テスト
      if (apiKeyInfoResponse && apiKeyInfoResponse.id) {
        console.log("\n3. APIキー保存テスト:");
        
        // APIキーIDとして実際のAnthropicのIDを使用
        const apiKeyId = apiKeyInfoResponse.id;
        const keyName = apiKeyInfoResponse.name || 'API Key';
        
        console.log(`APIキーID: ${apiKeyId}`);
        console.log(`APIキー名: ${keyName}`);
        
        // 既存のキーを確認
        let apiKeyDoc = await AnthropicApiKey.findOne({ apiKeyId });
        
        if (apiKeyDoc) {
          console.log("既存のAPIキーが見つかりました。更新します...");
          // 既存のキーを更新
          apiKeyDoc.name = keyName;
          apiKeyDoc.apiKeyFull = keyInfo.full;
          apiKeyDoc.lastSyncedAt = new Date();
          const savedKey = await apiKeyDoc.save();
          console.log("更新結果:", savedKey);
        } else {
          console.log("新規APIキーを作成します...");
          // 新規キーを作成
          apiKeyDoc = new AnthropicApiKey({
            apiKeyId: apiKeyId,
            apiKeyFull: keyInfo.full,
            name: keyName,
            status: 'active',
            lastSyncedAt: new Date()
          });
          const savedKey = await apiKeyDoc.save();
          console.log("保存結果:", savedKey);
        }
        
        // 4. 保存結果の確認
        console.log("\n4. 保存結果の確認:");
        const savedApiKey = await AnthropicApiKey.findOne({ apiKeyId }).lean();
        console.log("保存されたAPIキー:", savedApiKey);
        
        // フィールドごとに確認
        console.log("apiKeyId:", savedApiKey.apiKeyId);
        console.log("name:", savedApiKey.name);
        console.log("apiKeyFull:", savedApiKey.apiKeyFull ? `${savedApiKey.apiKeyFull.substring(0, 10)}...` : 'なし');
        console.log("apiKeyFull完全な値:", savedApiKey.apiKeyFull);
      }
      
    } catch (error) {
      console.error("APIキー検証プロセスでエラー:", error);
    }
    
    // 5. すべてのAPIキーの確認
    console.log("\n5. すべてのAPIキーの確認:");
    const allKeys = await AnthropicApiKey.find().lean();
    console.log(`合計 ${allKeys.length} 件のAPIキーが登録済み`);
    
    allKeys.forEach((key, index) => {
      console.log(`\n[${index + 1}] APIキー:`);
      console.log("  ID:", key.apiKeyId);
      console.log("  名前:", key.name);
      console.log("  apiKeyFull:", key.apiKeyFull ? `${key.apiKeyFull.substring(0, 10)}...` : 'なし');
      console.log("  作成日時:", key.createdAt);
    });
    
    // テスト用のAPIキーを削除
    console.log('\n最後にテスト用のAPIキーを削除します...');
    await AnthropicApiKey.deleteOne({ apiKeyId: 'apikey_test123' });
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB接続を切断しました");
  }
}

main().catch(console.error);