/**
 * テストユーザーを作成するシンプルなスクリプト
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB接続URI（Atlas MongoDB）
const MONGODB_URI = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

async function main() {
  try {
    console.log('Atlas MongoDBに接続しています...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('接続成功!');
    
    // ユーザースキーマ定義
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
    
    // パスワードハッシュ化
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
    
    // ユーザー検索
    const email = 'lisence@mikoto.co.jp';
    let user = await User.findOne({ email });
    
    if (user) {
      console.log('既存ユーザーを更新します');
      user.password = 'Mikoto@123';
      user.isActive = true;
      await user.save();
      console.log(`ユーザー ${user.email} (${user._id}) のパスワードを更新しました`);
    } else {
      console.log('新規ユーザーを作成します');
      user = new User({
        name: 'Test User',
        email: 'lisence@mikoto.co.jp',
        password: 'Mikoto@123',
        role: 'admin',
        isActive: true
      });
      await user.save();
      console.log(`新規ユーザー ${user.email} (${user._id}) を作成しました`);
    }
    
    // 全ユーザー表示
    console.log('\n全ユーザー:');
    const allUsers = await User.find().select('email name role isActive');
    allUsers.forEach((u, i) => {
      console.log(`${i+1}. ${u.email} (${u.name}) - ${u.role}, ${u.isActive ? 'アクティブ' : '非アクティブ'}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB接続を終了しました');
  }
}

main();