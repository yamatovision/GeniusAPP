/**
 * ClaudeCode起動カウンターの直接データベースチェック
 * MongoDB接続を使って、直接データベースからClaudeCode起動カウンターの状態を確認します
 */

const mongoose = require('mongoose');
const readline = require('readline');

// データベース接続情報
const MONGODB_URI = 'mongodb://localhost:27017/appgenius';

// ユーザー入力を受け付ける関数
const getUserInput = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// MongoDB接続
const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB接続成功');
  } catch (error) {
    console.error('MongoDB接続エラー:', error.message);
    throw error;
  }
};

// メイン処理
const main = async () => {
  try {
    // データベースに接続
    await connectToDatabase();
    
    // ユーザーIDまたはメールアドレスの入力を受け付ける
    const userIdentifier = await getUserInput('ユーザーIDまたはメールアドレスを入力してください: ');
    
    // SimpleUserモデルを取得（モデルが登録されていない場合は定義する）
    let SimpleUser;
    try {
      SimpleUser = mongoose.model('SimpleUser');
    } catch (error) {
      // モデルが定義されていない場合、スキーマを定義して登録
      const simpleUserSchema = new mongoose.Schema({
        name: String,
        email: String,
        password: String,
        role: String,
        organizationId: mongoose.Schema.Types.ObjectId,
        apiKeyId: String,
        apiKeyValue: String,
        claudeCodeLaunchCount: Number,
        refreshToken: String,
        status: String
      }, { timestamps: true });
      
      SimpleUser = mongoose.model('SimpleUser', simpleUserSchema);
    }
    
    // ユーザーを検索（IDまたはメールアドレスで）
    const query = mongoose.Types.ObjectId.isValid(userIdentifier)
      ? { _id: userIdentifier }
      : { email: userIdentifier.toLowerCase() };
    
    const user = await SimpleUser.findOne(query);
    
    if (!user) {
      console.log('指定されたユーザーが見つかりませんでした');
      return;
    }
    
    // ユーザー情報とカウンター値を表示
    console.log('---ユーザー情報---');
    console.log(`名前: ${user.name}`);
    console.log(`メール: ${user.email}`);
    console.log(`役割: ${user.role}`);
    console.log(`ID: ${user._id}`);
    console.log(`組織ID: ${user.organizationId || 'なし'}`);
    
    // カウンター情報
    console.log('\n---ClaudeCode起動カウンター情報---');
    console.log(`カウンター値: ${user.claudeCodeLaunchCount || 0}`);
    console.log(`カウンターのデータ型: ${typeof user.claudeCodeLaunchCount}`);
    
    // カウンター値プロパティの有無を確認
    const hasCounterProperty = user.hasOwnProperty('claudeCodeLaunchCount');
    console.log(`カウンタープロパティの存在: ${hasCounterProperty ? 'あり' : 'なし'}`);
    
    // カウンター値の変更履歴（updatedAtを使用）
    console.log(`最終更新日時: ${user.updatedAt}`);
    
    // カウンターの手動インクリメントの確認
    const incrementCounter = await getUserInput('\nカウンターをインクリメントしますか？ (y/n): ');
    
    if (incrementCounter.toLowerCase() === 'y') {
      // カウンターをインクリメント
      if (typeof user.claudeCodeLaunchCount !== 'number') {
        user.claudeCodeLaunchCount = 1;
      } else {
        user.claudeCodeLaunchCount += 1;
      }
      
      await user.save();
      console.log(`カウンターをインクリメントしました。新しい値: ${user.claudeCodeLaunchCount}`);
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  } finally {
    // MongoDBの接続を閉じる
    await mongoose.connection.close();
    console.log('MongoDB接続を閉じました');
    process.exit(0);
  }
};

// スクリプト実行
main();