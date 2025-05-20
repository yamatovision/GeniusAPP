// シンプルなMongoDB接続テスト
const { MongoClient } = require('mongodb');

async function main() {
  console.log('MongoDB接続テスト開始');
  
  // ローカルMongoDB接続URI
  const uri = "mongodb://localhost:27017/hinago-test";
  
  try {
    // クライアント接続
    console.log('接続先:', uri);
    const client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB接続成功');
    
    // データベース一覧を取得
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    console.log('利用可能なデータベース:');
    dbs.databases.forEach(db => {
      console.log(`- ${db.name}`);
    });
    
    // テスト用データベースを取得
    const testDb = client.db('hinago-test');
    
    // テストコレクションにサンプルデータを挿入
    const testCollection = testDb.collection('test_collection');
    const result = await testCollection.insertOne({
      name: 'テストドキュメント',
      createdAt: new Date()
    });
    console.log('ドキュメント挿入結果:', result);
    
    // データを取得
    const docs = await testCollection.find({}).toArray();
    console.log('取得されたドキュメント:', docs);
    
    // テストコレクションをクリア
    await testCollection.deleteMany({});
    
    // 接続を閉じる
    await client.close();
    console.log('MongoDB接続を閉じました');
    
  } catch (error) {
    console.error('MongoDB接続エラー:', error);
  }
}

main().catch(console.error);