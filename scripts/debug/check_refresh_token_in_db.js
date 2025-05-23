const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../portal/.env') });

async function checkRefreshTokens() {
  try {
    // MongoDB接続 - ハードコードされた本番環境の接続文字列を使用
    const mongoUri = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';
    
    console.log('MongoDB接続開始...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      maxPoolSize: 10
    });
    console.log('MongoDB接続成功');

    // SimpleUserモデルを接続後に定義
    const SimpleUser = require('../../portal/backend/models/simpleUser.model');
    
    // すべてのユーザーのリフレッシュトークン状態を確認
    const users = await SimpleUser.find({}, 'name email refreshToken status updatedAt');
    
    console.log('\n=== ユーザーとリフレッシュトークンの状態 ===');
    console.log(`総ユーザー数: ${users.length}`);
    console.log('');

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   ステータス: ${user.status}`);
      console.log(`   リフレッシュトークン: ${user.refreshToken ? '存在 (長さ: ' + user.refreshToken.length + ')' : '❌ なし'}`);
      if (user.refreshToken) {
        console.log(`   トークン先頭: ${user.refreshToken.substring(0, 20)}...`);
        
        // JWTトークンのデコード（検証なし）
        try {
          const parts = user.refreshToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            const expDate = new Date(payload.exp * 1000);
            const now = new Date();
            
            console.log(`   有効期限: ${expDate.toISOString()}`);
            console.log(`   期限切れ: ${expDate < now ? '✅ はい' : '❌ いいえ'}`);
            console.log(`   発行者: ${payload.iss || 'なし'}`);
            console.log(`   対象者: ${payload.aud || 'なし'}`);
          }
        } catch (e) {
          console.log('   トークンデコードエラー:', e.message);
        }
      }
      console.log(`   最終更新: ${user.updatedAt}`);
      console.log('');
    });

    // アクティブユーザーでリフレッシュトークンがないユーザーを確認
    const usersWithoutToken = await SimpleUser.find({
      status: 'active',
      refreshToken: { $in: [null, ''] }
    });

    if (usersWithoutToken.length > 0) {
      console.log('\n⚠️  警告: アクティブユーザーでリフレッシュトークンがない:');
      usersWithoutToken.forEach(user => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    }

    // 引数でメールアドレスが指定された場合、そのユーザーの詳細を表示
    const targetEmail = process.argv[2];
    if (targetEmail) {
      console.log('\n=== 特定ユーザーの詳細 ===');
      const targetUser = await SimpleUser.findOne({ email: targetEmail });
      if (targetUser) {
        console.log('ユーザー情報:');
        console.log(JSON.stringify({
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          status: targetUser.status,
          organizationId: targetUser.organizationId,
          apiKeyId: targetUser.apiKeyId,
          apiKeyValue: targetUser.apiKeyValue ? '存在' : 'なし',
          refreshToken: targetUser.refreshToken ? '存在' : 'なし',
          createdAt: targetUser.createdAt,
          updatedAt: targetUser.updatedAt
        }, null, 2));
      } else {
        console.log(`ユーザー ${targetEmail} が見つかりません`);
      }
    }

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB接続終了');
  }
}

// 使用方法を表示
console.log('使用方法: node check_refresh_token_in_db.js [email]');
console.log('例: node check_refresh_token_in_db.js user@example.com\n');

checkRefreshTokens();