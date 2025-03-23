/**
 * ユーザーデータの確認スクリプト
 * 特定のメールアドレスを持つユーザーを検索し、詳細情報を表示します
 */
require('dotenv').config();
const mongoose = require('mongoose');

// データベース接続情報
const dbConfig = {
  url: 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
};

// ユーザースキーマの簡易的な定義（元のモデルと互換性を持たせる）
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  accountStatus: String,
  // 他のフィールドも必要に応じて追加
}, { strict: false });

async function findUserByEmail(email) {
  try {
    console.log(`データベースに接続しています...`);
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log(`MongoDB に接続しました`);

    // ユーザーモデルを定義
    const User = mongoose.model('User', userSchema);

    // 指定されたメールアドレスのユーザーを検索
    console.log(`${email} のユーザー情報を検索しています...`);
    const user = await User.findOne({ email: email });

    if (user) {
      console.log('ユーザーが見つかりました:');
      console.log('ID:', user._id);
      console.log('名前:', user.name);
      console.log('メール:', user.email);
      console.log('ロール:', user.role);
      console.log('アカウント状態:', user.accountStatus);
      console.log('全データ:', JSON.stringify(user.toObject(), null, 2));
    } else {
      console.log(`メールアドレス ${email} のユーザーは見つかりませんでした`);
    }

    // DB接続を閉じる
    await mongoose.disconnect();
    console.log('データベース接続を閉じました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// コマンドライン引数からメールアドレスを取得、または指定されていない場合はデフォルト値を使用
const emailToSearch = process.argv[2] || 'lisence@mikoto.co.jp';
findUserByEmail(emailToSearch);