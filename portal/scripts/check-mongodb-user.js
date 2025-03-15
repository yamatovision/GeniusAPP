/**
 * MongoDB内のユーザー情報を確認するスクリプト
 * 使用方法:
 * node check-mongodb-user.js [メールアドレス]
 */

// 必要なモジュール
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB接続URI
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

// ユーザーモデルの定義
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  refreshToken: String,
  isActive: Boolean,
  lastLogin: Date,
  plan: {
    type: { type: String },
    tokenLimit: Number,
    lastResetDate: Date,
    nextResetDate: Date
  }
}, { timestamps: true });

// パスワード検証メソッド
UserSchema.methods.validatePassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    console.error('パスワード検証エラー:', error);
    return false;
  }
};

const User = mongoose.model('User', UserSchema);

// メイン関数
async function main() {
  try {
    console.log('MongoDBに接続を試行中...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB接続に成功しました!');

    // 検索するメールアドレス (コマンドライン引数またはデフォルト値)
    const emailToCheck = process.argv[2] || 'lisence@mikoto.co.jp';
    console.log(`ユーザー検索中: ${emailToCheck}`);

    // ユーザーを検索
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + emailToCheck + '$', 'i') }
    });

    if (user) {
      console.log('=== ユーザーが見つかりました ===');
      console.log(`ID: ${user._id}`);
      console.log(`名前: ${user.name}`);
      console.log(`メール: ${user.email}`);
      console.log(`権限: ${user.role}`);
      console.log(`アクティブ: ${user.isActive}`);
      console.log(`最終ログイン: ${user.lastLogin || 'なし'}`);
      console.log(`作成日: ${user.createdAt}`);
      console.log(`パスワード設定済み: ${!!user.password}`);
      console.log(`リフレッシュトークン: ${user.refreshToken ? '設定済み' : '未設定'}`);

      // パスワードテスト
      if (user.password) {
        const testPassword = 'Mikoto@123';
        const isPasswordValid = await user.validatePassword(testPassword);
        console.log(`テストパスワード検証: ${isPasswordValid ? '成功' : '失敗'}`);
      }
    } else {
      console.log(`メールアドレス ${emailToCheck} のユーザーは見つかりませんでした`);
      
      // 全ユーザーのリストを表示
      console.log('\n=== 全ユーザーリスト ===');
      const allUsers = await User.find().select('email name role isActive');
      
      if (allUsers.length === 0) {
        console.log('データベースにユーザーが存在しません');
      } else {
        allUsers.forEach((u, i) => {
          console.log(`${i+1}. ${u.email} (${u.name}) - 権限: ${u.role}, アクティブ: ${u.isActive}`);
        });
      }
      
      // 新規ユーザー作成オプション
      console.log('\n新規ユーザーを作成するには以下を実行:');
      console.log('node scripts/create-mongodb-user.js');
    }
  } catch (error) {
    console.error('MongoDBエラー:', error);
  } finally {
    // 接続終了
    await mongoose.disconnect();
    console.log('MongoDB接続を終了しました');
  }
}

// スクリプト実行
main();