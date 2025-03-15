/**
 * ローカルMongoDBからAtlas MongoDBにプロンプトデータを移行するスクリプト
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB接続情報
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/appgenius';
const ATLAS_MONGODB_URI = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

// プロンプトモデルの定義
const PromptSchema = new mongoose.Schema({
  title: String,
  description: String,
  content: String,
  type: String,
  category: String,
  tags: [String],
  ownerId: mongoose.Schema.Types.ObjectId,
  isPublic: Boolean,
  usageCount: Number,
  publicToken: String,
  templateVariables: [{ name: String, description: String }],
  lastUpdated: Date
}, { timestamps: true });

async function main() {
  try {
    console.log('ローカルMongoDBからプロンプトデータを移行します...');
    
    // バックアップファイルの日時パート作成
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupDir = path.join(__dirname, '../backups');
    
    // バックアップディレクトリが存在しない場合は作成
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // バックアップファイル名設定
    const backupFile = path.join(backupDir, `prompts-backup-${timestamp}.json`);
    
    // ステップ1: ローカルMongoDBに接続
    console.log('ローカルMongoDBに接続中...');
    const localConnection = await mongoose.createConnection(LOCAL_MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('ローカルMongoDBに接続しました');
    
    // ローカルDBのプロンプトモデル
    const LocalPrompt = localConnection.model('Prompt', PromptSchema);
    
    // ステップ2: ローカルDBからプロンプトをすべて取得
    console.log('ローカルDBからプロンプトデータを取得中...');
    const localPrompts = await LocalPrompt.find({});
    console.log(`${localPrompts.length}件のプロンプトデータを取得しました`);
    
    // データをバックアップ
    fs.writeFileSync(backupFile, JSON.stringify(localPrompts, null, 2));
    console.log(`プロンプトデータをバックアップしました: ${backupFile}`);
    
    if (localPrompts.length === 0) {
      console.log('ローカルDBにプロンプトデータがありません。処理を終了します。');
      await localConnection.close();
      return;
    }
    
    // ステップ3: Atlas MongoDBに接続
    console.log('Atlas MongoDBに接続中...');
    const atlasConnection = await mongoose.createConnection(ATLAS_MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Atlas MongoDBに接続しました');
    
    // Atlas DBのプロンプトモデル
    const AtlasPrompt = atlasConnection.model('Prompt', PromptSchema);
    
    // ステップ4: Atlas DBのプロンプトをすべて取得（重複チェック用）
    console.log('Atlas DBのプロンプトデータを確認中...');
    const atlasPrompts = await AtlasPrompt.find({});
    console.log(`Atlas DBには既に${atlasPrompts.length}件のプロンプトデータがあります`);
    
    // ステップ5: ローカルDBのプロンプトをAtlas DBに追加（重複は避ける）
    console.log('プロンプトデータを移行中...');
    let addedCount = 0;
    let skippedCount = 0;
    
    // 処理を一つずつ行う（並列処理だと問題が起きる可能性があるため）
    for (const localPrompt of localPrompts) {
      // タイトルと所有者で重複チェック
      const duplicatePrompt = atlasPrompts.find(p => 
        p.title === localPrompt.title && 
        p.ownerId.toString() === localPrompt.ownerId.toString()
      );
      
      if (duplicatePrompt) {
        console.log(`スキップ: "${localPrompt.title}" (重複)`);
        skippedCount++;
      } else {
        try {
          // 新しいドキュメントとして追加
          const newPrompt = new AtlasPrompt({
            ...localPrompt.toObject(),
            _id: new mongoose.Types.ObjectId() // 新しいIDを生成
          });
          
          await newPrompt.save();
          console.log(`追加: "${localPrompt.title}"`);
          addedCount++;
        } catch (error) {
          console.error(`エラー: "${localPrompt.title}" の追加に失敗しました`, error);
        }
      }
    }
    
    console.log('\n移行結果:');
    console.log(`- 処理されたプロンプト数: ${localPrompts.length}`);
    console.log(`- 追加されたプロンプト数: ${addedCount}`);
    console.log(`- スキップされたプロンプト数: ${skippedCount}`);
    
    // 接続終了
    await localConnection.close();
    await atlasConnection.close();
    console.log('MongoDB接続を終了しました');
    
  } catch (error) {
    console.error('移行中にエラーが発生しました:', error);
  }
}

main();