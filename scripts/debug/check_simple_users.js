/**
 * SimpleUsersコレクションのリフレッシュトークン状態を確認
 */
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB接続URI
const MONGODB_URI = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

// SimpleUserスキーマの定義
const SimpleUserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  status: String,
  organizationId: String,
  apiKeyId: String,
  apiKeyValue: String,
  refreshToken: String,
  deleted: Boolean,
}, { 
  timestamps: true,
  collection: 'simpleusers'  // 明示的にコレクション名を指定
});

const SimpleUser = mongoose.model('SimpleUser', SimpleUserSchema);

async function checkSimpleUsers() {
  try {
    console.log('MongoDBに接続中...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB接続成功');

    // 全SimpleUserを取得
    const users = await SimpleUser.find({});
    console.log(`\n=== SimpleUsersコレクション ===`);
    console.log(`総ユーザー数: ${users.length}`);

    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name} (${user.email})`);
      console.log(`   ID: ${user._id}`);
      console.log(`   ステータス: ${user.status}`);
      console.log(`   ロール: ${user.role}`);
      console.log(`   削除フラグ: ${user.deleted || false}`);
      console.log(`   リフレッシュトークン: ${user.refreshToken ? '存在' : '❌ なし'}`);
      
      if (user.refreshToken) {
        console.log(`   トークン長: ${user.refreshToken.length}`);
        console.log(`   トークン先頭: ${user.refreshToken.substring(0, 30)}...`);
        
        // JWTトークンのデコード
        try {
          const parts = user.refreshToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            const expDate = new Date(payload.exp * 1000);
            const now = new Date();
            
            console.log(`   ペイロード:`, JSON.stringify(payload, null, 4));
            console.log(`   有効期限: ${expDate.toISOString()}`);
            console.log(`   期限切れ: ${expDate < now ? '✅ はい' : '❌ いいえ'}`);
            console.log(`   残り時間: ${Math.floor((expDate - now) / 1000 / 60 / 60)}時間`);
          }
        } catch (e) {
          console.log('   トークンデコードエラー:', e.message);
        }
      }
      
      console.log(`   最終更新: ${user.updatedAt}`);
    });

    // アクティブユーザーでリフレッシュトークンがないユーザー
    const activeWithoutToken = await SimpleUser.find({
      status: 'active',
      $or: [
        { refreshToken: null },
        { refreshToken: '' },
        { refreshToken: { $exists: false } }
      ]
    });

    if (activeWithoutToken.length > 0) {
      console.log('\n⚠️  アクティブユーザーでリフレッシュトークンなし:');
      activeWithoutToken.forEach(user => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    }

    // 引数でメールアドレスが指定された場合
    const targetEmail = process.argv[2];
    if (targetEmail) {
      console.log(`\n=== 特定ユーザーの詳細: ${targetEmail} ===`);
      const user = await SimpleUser.findOne({ email: targetEmail });
      if (user) {
        console.log(JSON.stringify(user.toObject(), null, 2));
      } else {
        console.log('ユーザーが見つかりません');
      }
    }

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB接続終了');
  }
}

console.log('使用方法: node check_simple_users.js [email]');
checkSimpleUsers();