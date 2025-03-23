/**
 * MongoDBへの接続テスト
 */
const { MongoClient } = require('mongodb');

// MongoDB Atlas URI (envファイルから取得)
const MONGODB_URI = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

async function testMongoDBConnection() {
  let client;
  
  try {
    console.log('MongoDBに接続しています...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('接続成功！');
    
    // データベース取得
    const db = client.db('GENIEMON');
    
    // コレクション一覧を取得
    const collections = await db.listCollections().toArray();
    console.log('\nコレクション一覧:');
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
    });
    
    // license@mikoto.co.jpのユーザーを検索
    console.log('\nlicense@mikoto.co.jp のユーザーを検索...');
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    console.log(`ユーザー総数: ${userCount}`);
    
    const user = await usersCollection.findOne({ email: 'license@mikoto.co.jp' });
    if (user) {
      console.log(`ユーザーが見つかりました: ${user.name} (ID: ${user._id})`);
      
      // このユーザーのトークン使用履歴があるか確認
      if (collections.some(col => col.name === 'apiusages')) {
        const apiUsagesCollection = db.collection('apiusages');
        const usageCount = await apiUsagesCollection.countDocuments({ userId: user._id.toString() });
        
        console.log(`\nトークン使用履歴の数: ${usageCount}`);
        
        if (usageCount > 0) {
          // 最新の使用履歴を取得
          const latestUsages = await apiUsagesCollection
            .find({ userId: user._id.toString() })
            .sort({ timestamp: -1 })
            .limit(5)
            .toArray();
          
          console.log('\n最新のトークン使用履歴:');
          latestUsages.forEach((usage, index) => {
            console.log(`\n[${index + 1}] ${new Date(usage.timestamp).toISOString()}`);
            console.log(`  エンドポイント: ${usage.endpoint}`);
            console.log(`  トークン: ${usage.totalTokens}`);
            if (usage.metadata) {
              console.log(`  コンテキスト: ${usage.metadata.context || 'なし'}`);
              console.log(`  モデル: ${usage.metadata.modelId || 'なし'}`);
            }
          });
          
          // 月間使用量の集計
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          const monthlyUsage = await apiUsagesCollection.aggregate([
            {
              $match: {
                userId: user._id.toString(),
                timestamp: { $gte: firstDayOfMonth }
              }
            },
            {
              $group: {
                _id: null,
                totalTokens: { $sum: '$totalTokens' },
                count: { $sum: 1 }
              }
            }
          ]).toArray();
          
          if (monthlyUsage.length > 0) {
            console.log(`\n今月の合計: ${monthlyUsage[0].totalTokens} トークン (${monthlyUsage[0].count}回の記録)`);
          } else {
            console.log('\n今月の使用履歴はありません');
          }
        } else {
          console.log('\nこのユーザーの使用履歴は見つかりませんでした');
        }
      } else {
        console.log('\napiusages コレクションが見つかりませんでした');
      }
    } else {
      console.log('\nlicense@mikoto.co.jp のユーザーは見つかりませんでした');
      
      // 代わりに他のユーザーを探す
      const someUser = await usersCollection.findOne({});
      if (someUser) {
        console.log(`他のユーザーが見つかりました: ${someUser.email}`);
      }
    }
  } catch (error) {
    console.error('MongoDBへの接続中にエラーが発生しました:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nMongoDBとの接続を閉じました');
    }
  }
}

// スクリプトを実行
testMongoDBConnection().catch(console.error);