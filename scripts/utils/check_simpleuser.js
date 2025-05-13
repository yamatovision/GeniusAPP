const { MongoClient, ObjectId } = require('mongodb');

// AtlasのMongoDB接続文字列を使用
const uri = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

async function main() {
  console.log('MongoDB接続を開始します...');
  
  const searchType = process.argv[2];
  const searchValue = process.argv[3];
  
  if (!searchType || !searchValue) {
    console.log('使用方法:');
    console.log('  node check_simpleuser.js email [メールアドレス]');
    console.log('  node check_simpleuser.js apikey [APIキーID]');
    return;
  }
  
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB接続に成功しました');
    
    const db = client.db();
    
    // コレクションの存在確認
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('利用可能なコレクション:', collectionNames.join(', '));
    
    if (searchType === 'email') {
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
      
      // ユーザーをメールアドレスで検索
      const user = await userCollection.findOne({ email: searchValue });
      
      if (user) {
        console.log(`ユーザーが見つかりました: ${user._id}`);
        // パスワードやトークンを隠す
        const safeUser = { ...user };
        if (safeUser.password) safeUser.password = '********';
        if (safeUser.refreshToken) safeUser.refreshToken = '********';
        console.log(JSON.stringify(safeUser, null, 2));
      } else {
        console.log(`ユーザーは見つかりませんでした: ${searchValue}`);
      }
    } else if (searchType === 'apikey') {
      // APIキーコレクションを探す
      const apiKeyCollectionName = collectionNames.find(name => 
        name.toLowerCase().includes('apikey') || 
        name.toLowerCase().includes('simpleapikeys')
      );
      
      if (!apiKeyCollectionName) {
        console.log('APIキーコレクションが見つかりませんでした');
        return;
      }
      
      const apiKeyCollection = db.collection(apiKeyCollectionName);
      
      // APIキーをIDで検索
      const apiKey = await apiKeyCollection.findOne({ id: searchValue });
      
      if (apiKey) {
        console.log(`APIキーが見つかりました: ${apiKey._id}`);
        // APIキー情報を表示（キー値を一部隠す）
        const safeApiKey = { ...apiKey };
        if (safeApiKey.keyValue) {
          const keyLength = safeApiKey.keyValue.length;
          safeApiKey.keyValue = safeApiKey.keyValue.substring(0, 5) + '...' + 
                               safeApiKey.keyValue.substring(keyLength - 4, keyLength);
        }
        console.log(JSON.stringify(safeApiKey, null, 2));
      } else {
        console.log(`APIキーは見つかりませんでした: ${searchValue}`);
        
        // すべてのAPIキーを表示
        console.log('すべてのAPIキーをリストします:');
        const allApiKeys = await apiKeyCollection.find({}).limit(10).toArray();
        console.log(`APIキー数: ${allApiKeys.length}`);
        
        allApiKeys.forEach(key => {
          let displayValue = '非表示';
          if (key.keyValue) {
            const keyLength = key.keyValue.length;
            displayValue = key.keyValue.substring(0, 3) + '...' + 
                          key.keyValue.substring(keyLength - 3, keyLength);
          }
          console.log(`APIキー: ${key.id || 'ID未設定'} / 状態: ${key.status || '不明'} / 値: ${displayValue}`);
        });
      }
    } else {
      console.log(`無効な検索タイプ: ${searchType}. 'email'または'apikey'を指定してください。`);
    }
    
    await client.close();
    console.log('MongoDB接続を閉じました');
  } catch (err) {
    console.error('エラーが発生しました:', err);
  }
}

main();
