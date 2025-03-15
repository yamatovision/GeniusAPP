/**
 * MongoDB内にテストユーザーを作成するスクリプト
 * 使用方法:
 * node create-mongodb-user.js [メールアドレス] [パスワード]
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

// パスワード保存前にハッシュ化
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

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

    // 作成するユーザー情報 (コマンドライン引数またはデフォルト値)
    const emailToCreate = process.argv[2] || 'lisence@mikoto.co.jp';
    const passwordToCreate = process.argv[3] || 'Mikoto@123';
    
    console.log(`ユーザー作成/更新: ${emailToCreate}`);

    // ユーザーが既に存在するか確認
    let user = await User.findOne({ 
      email: { $regex: new RegExp('^' + emailToCreate + '$', 'i') }
    });

    if (user) {
      console.log('既存ユーザーが見つかりました。パスワードを更新します。');
      user.password = passwordToCreate;
      user.isActive = true;
      await user.save();
      console.log(`ユーザー "${user.email}" (${user._id}) のパスワードを更新しました。`);
    } else {
      // 新規ユーザー作成
      console.log('新規ユーザーを作成します...');
      user = new User({
        name: 'テストユーザー',
        email: emailToCreate,
        password: passwordToCreate,
        role: 'admin',
        isActive: true,
        plan: {
          type: 'premium',
          tokenLimit: 1000000,
          lastResetDate: new Date(),
          nextResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日後
        }
      });
      
      await user.save();
      console.log(`新規ユーザー "${user.email}" (${user._id}) を作成しました。`);
    }
    
    console.log('\n=== ユーザー情報 ===');
    console.log(`ID: ${user._id}`);
    console.log(`名前: ${user.name}`);
    console.log(`メール: ${user.email}`);
    console.log(`権限: ${user.role}`);
    console.log(`アクティブ: ${user.isActive}`);
    console.log(`作成日: ${user.createdAt}`);
    console.log(`更新日: ${user.updatedAt}`);
    
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