const { MongoClient, ObjectId } = require('mongodb');

// AtlasのMongoDB接続文字列を使用
const uri = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

async function main() {
  console.log('MongoDB接続を開始します...');
  
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB接続に成功しました');
    
    const db = client.db();
    
    // SimpleUserコレクションの存在確認
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('利用可能なコレクション:', collectionNames.join(', '));
    
    // SimpleUserを検索
    const userCollectionName = collectionNames.find(name => 
      name.toLowerCase().includes('simpleuser') || 
      name.toLowerCase().includes('simpleusers')
    );
    
    if (!userCollectionName) {
      console.log('SimpleUserコレクションが見つかりませんでした');
      return;
    }
    
    const userCollection = db.collection(userCollectionName);
    
    // 特定のIDでユーザーを検索
    const specificUserId = '67df903de75d45af09e1c28f';
    let user;
    
    try {
      // ObjectIDとして検索
      user = await userCollection.findOne({ _id: new ObjectId(specificUserId) });
    } catch (e) {
      // 文字列IDとして検索
      user = await userCollection.findOne({ _id: specificUserId });
    }
    
    if (user) {
      console.log('指定したIDのユーザーが見つかりました:', specificUserId);
      // パスワードやトークンを隠す
      const safeUser = { ...user };
      if (safeUser.password) safeUser.password = '********';
      if (safeUser.refreshToken) safeUser.refreshToken = '********';
      console.log(JSON.stringify(safeUser, null, 2));
    } else {
      console.log('指定したIDのユーザーは見つかりませんでした:', specificUserId);
      
      // 全てのユーザーをリスト
      console.log('すべてのユーザーをリストします:');
      const users = await userCollection.find({}).limit(10).toArray();
      console.log(`ユーザー数: ${users.length}`);
      
      users.forEach(user => {
        const safeUser = { ...user };
        if (safeUser.password) safeUser.password = '********';
        if (safeUser.refreshToken) safeUser.refreshToken = '********';
        console.log(`ユーザー: ${safeUser._id} / ${safeUser.name} / ${safeUser.email} / ${safeUser.role}`);
      });
    }
    
    await client.close();
    console.log('MongoDB接続を閉じました');
  } catch (err) {
    console.error('エラーが発生しました:', err);
  }
}

main();
