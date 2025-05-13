/**
 * AnthropicApiKeyと関連する組織情報を取得するスクリプト
 * 
 * 特定のユーザーの詳細情報も確認します
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('./portal/backend/config/db.config');

// APIキーモデルのスキーマを定義
const AnthropicApiKeySchema = new mongoose.Schema({
  apiKeyId: String,
  keyHint: String,
  apiKeyFull: String, // 完全なAPIキー値
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

// SimpleUserモデルのスキーマを定義
const SimpleUserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  organizationId: mongoose.Schema.Types.ObjectId, // 単一の組織ID
  organizationIds: [String], // 複数の組織ID（互換性のため）
  apiKeyId: String,
  apiKeyValue: String, // 直接保存されたAPIキー値
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
    const SimpleOrganization = mongoose.model('SimpleOrganization', SimpleOrganizationSchema);
    const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);
    
    // すべてのAPIキーを取得
    const apiKeys = await AnthropicApiKey.find().lean();
    console.log(`=== 合計 ${apiKeys.length} 件のAPIキーが見つかりました ===\n`);
    
    // すべての組織を取得
    const organizations = await SimpleOrganization.find().lean();
    console.log(`=== 合計 ${organizations.length} 件の組織が見つかりました ===\n`);
    
    // すべてのユーザーを取得
    const users = await SimpleUser.find().lean();
    console.log(`=== 合計 ${users.length} 件のユーザーが見つかりました ===\n`);
    
    // 特定のユーザーの詳細情報を取得
    console.log('=== 特定ユーザーの詳細情報 ===');
    const targetEmail = 'shiraishi.tatsuya@mikoto.co.jp';
    const targetUser = await SimpleUser.findOne({ email: targetEmail }).lean();
    
    if (targetUser) {
      console.log(`\n[詳細] ユーザー: ${targetUser.name} (${targetUser.email})`);
      console.log(`  ID: ${targetUser._id}`);
      console.log(`  ロール: ${targetUser.role}`);
      console.log(`  ステータス: ${targetUser.status || 'active'}`);
      console.log(`  APIキーID: ${targetUser.apiKeyId || 'なし'}`);
      console.log(`  APIキー値: ${targetUser.apiKeyValue ? targetUser.apiKeyValue.substring(0, 5) + '...' : 'なし'}`);
      
      // ユーザーの組織情報を取得
      if (targetUser.organizationId) {
        const userOrg = await SimpleOrganization.findById(targetUser.organizationId).lean();
        if (userOrg) {
          console.log(`\n  所属組織: ${userOrg.name}`);
          console.log(`    ID: ${userOrg._id}`);
          console.log(`    ステータス: ${userOrg.status || 'active'}`);
          console.log(`    APIキーIDs: ${userOrg.apiKeyIds ? userOrg.apiKeyIds.join(', ') : 'なし'}`);
          
          // 組織のAPIキー情報を取得
          if (userOrg.apiKeyIds && userOrg.apiKeyIds.length > 0) {
            console.log('    組織のAPIキー:');
            
            for (const keyId of userOrg.apiKeyIds) {
              const orgKey = await AnthropicApiKey.findOne({ apiKeyId: keyId }).lean();
              if (orgKey) {
                console.log(`      - ID: ${orgKey.apiKeyId}`);
                console.log(`        ヒント: ${orgKey.keyHint || 'なし'}`);
                console.log(`        フルキー: ${orgKey.apiKeyFull ? orgKey.apiKeyFull.substring(0, 5) + '...' : 'なし'}`);
                console.log(`        ステータス: ${orgKey.status || 'active'}`);
              } else {
                console.log(`      - ID: ${keyId} (データが見つかりません)`);
              }
            }
          }
        } else {
          console.log(`\n  所属組織: 組織ID ${targetUser.organizationId} のデータが見つかりません`);
        }
      } else if (targetUser.organizationIds && targetUser.organizationIds.length > 0) {
        // 古い形式の組織IDリストをチェック
        console.log(`\n  所属組織 (旧形式):`);
        for (const orgId of targetUser.organizationIds) {
          const oldOrg = await SimpleOrganization.findById(orgId).lean();
          if (oldOrg) {
            console.log(`    - ${oldOrg.name} (${oldOrg._id})`);
          } else {
            console.log(`    - 組織ID: ${orgId} (データが見つかりません)`);
          }
        }
      } else {
        console.log(`\n  所属組織: なし`);
      }
      
      // ユーザーのAPIキー情報を取得
      if (targetUser.apiKeyId) {
        const userKey = await AnthropicApiKey.findOne({ apiKeyId: targetUser.apiKeyId }).lean();
        if (userKey) {
          console.log(`\n  APIキー詳細:`);
          console.log(`    ID: ${userKey.apiKeyId}`);
          console.log(`    名前: ${userKey.name || 'なし'}`);
          console.log(`    ヒント: ${userKey.keyHint || 'なし'}`);
          console.log(`    フルキー: ${userKey.apiKeyFull ? userKey.apiKeyFull.substring(0, 5) + '...' : 'なし'}`);
          console.log(`    ステータス: ${userKey.status || 'active'}`);
          console.log(`    最終使用: ${userKey.lastUsedAt || 'なし'}`);
        } else {
          console.log(`\n  APIキー詳細: APIキーID ${targetUser.apiKeyId} のデータが見つかりません`);
        }
      }
      
      // APIキー取得の結果予測
      console.log('\n  APIキー取得の結果予測:');
      
      // 1. 直接ユーザーに設定されたAPIキー値
      if (targetUser.apiKeyValue) {
        console.log('    ✅ ユーザーにAPIキー値が直接設定されています。APIキー取得成功と予測されます。');
      } else if (targetUser.apiKeyId) {
        // 2. AnthropicApiKeyモデルから取得
        const userKey = await AnthropicApiKey.findOne({ apiKeyId: targetUser.apiKeyId }).lean();
        if (userKey && userKey.apiKeyFull) {
          console.log('    ✅ ユーザーのAPIキーIDに対応するAPIキー値がAnthropicApiKeyモデルに存在します。APIキー取得成功と予測されます。');
        } else if (userKey && userKey.keyHint) {
          console.log('    ❌ ユーザーのAPIキーIDに対応するAnthropicApiKeyモデルのレコードは存在しますが、apiKeyFull値がありません。APIキー取得は失敗すると予測されます。');
        } else {
          console.log('    ❌ ユーザーのAPIキーIDに対応するAnthropicApiKeyモデルのレコードが見つかりません。APIキー取得は失敗すると予測されます。');
        }
      } else {
        console.log('    ❌ ユーザーにAPIキーIDが設定されていません。APIキー取得は失敗すると予測されます。');
      }
    } else {
      console.log(`ユーザーが見つかりません: ${targetEmail}`);
    }
    
    console.log('=== APIキーが関連付けられている組織 ===');
    organizations.forEach((org, index) => {
      if (org.apiKeyIds && org.apiKeyIds.length > 0) {
        console.log(`[${index + 1}] 組織: ${org.name}`);
        console.log(`  - ワークスペース: ${org.workspaceName || 'なし'} (ID: ${org.workspaceId || 'なし'})`);
        console.log(`  - APIキーID: ${org.apiKeyIds.join(', ')}`);
        
        // APIキーの詳細を表示
        org.apiKeyIds.forEach(keyId => {
          const key = apiKeys.find(k => k.apiKeyId === keyId);
          if (key) {
            console.log(`    • APIキー: ${key.name || '名前なし'}`);
            console.log(`      - Hint: ${key.keyHint}`);
            console.log(`      - Status: ${key.status}`);
          } else {
            console.log(`    • APIキー: ID ${keyId} (データが見つかりません)`);
          }
        });
        
        // 組織のメンバーを表示
        if (org.members && org.members.length > 0) {
          console.log(`  - メンバー数: ${org.members.length}`);
          org.members.forEach(member => {
            const user = users.find(u => u._id.toString() === member.userId.toString());
            if (user) {
              console.log(`    • ${user.name} (${user.email}) - 役割: ${member.role}`);
              if (user.apiKeyId) {
                const userKey = apiKeys.find(k => k.apiKeyId === user.apiKeyId);
                console.log(`      - 個人APIキー: ${userKey ? userKey.keyHint : 'データなし'}`);
              }
            } else {
              console.log(`    • ユーザーID: ${member.userId} (データが見つかりません) - 役割: ${member.role}`);
            }
          });
        }
        
        console.log('---------------------------------------------');
      }
    });
    
    console.log('\n=== APIキーを持つユーザー ===');
    users.forEach((user, index) => {
      if (user.apiKeyId) {
        const key = apiKeys.find(k => k.apiKeyId === user.apiKeyId);
        console.log(`[${index + 1}] ユーザー: ${user.name} (${user.email})`);
        console.log(`  - 役割: ${user.role}`);
        console.log(`  - APIキーID: ${user.apiKeyId}`);
        if (key) {
          console.log(`  - APIキー詳細: ${key.name || '名前なし'} (${key.keyHint})`);
          console.log(`  - ステータス: ${key.status}`);
        } else {
          console.log(`  - APIキー詳細: データが見つかりません`);
        }
        
        // 所属組織を表示
        if (user.organizationIds && user.organizationIds.length > 0) {
          console.log(`  - 所属組織:`);
          user.organizationIds.forEach(orgId => {
            const org = organizations.find(o => o._id.toString() === orgId.toString());
            if (org) {
              console.log(`    • ${org.name} (ワークスペース: ${org.workspaceName || 'なし'})`);
            } else {
              console.log(`    • 組織ID: ${orgId} (データが見つかりません)`);
            }
          });
        }
        
        console.log('---------------------------------------------');
      }
    });
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB接続を切断しました");
  }
}

main().catch(console.error);