/**
 * SimpleUser SuperAdmin作成スクリプト
 * 
 * 使用方法:
 * node create-simple-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../backend/config/db.config');
const SimpleUser = require('../backend/models/simpleUser.model');
const authConfig = require('../backend/config/auth.config');

// データベース接続
mongoose.connect(db.url, db.options)
  .then(() => console.log('MongoDB に接続しました'))
  .catch(err => {
    console.error('MongoDB 接続エラー:', err);
    process.exit(1);
  });

async function createSimpleSuperAdmin() {
  try {
    // SuperAdmin設定
    const superAdminConfig = {
      name: 'Tatsuya',
      email: 'lisence@mikoto.co.jp',
      password: 'Mikoto@123',
      role: 'SuperAdmin',
      status: 'active'
    };

    // 既存のアカウントを確認
    const existingUser = await SimpleUser.findOne({ email: superAdminConfig.email });

    if (existingUser) {
      console.log('このメールアドレスは既に使用されています');
      
      // 既存ユーザーをSuperAdminに昇格
      if (existingUser.role !== 'SuperAdmin') {
        existingUser.role = 'SuperAdmin';
        await existingUser.save();
        console.log('既存ユーザーをSuperAdminに昇格しました');
      } else {
        console.log('ユーザーは既にSuperAdminです');
      }
    } else {
      // 新規作成
      const superAdmin = new SimpleUser(superAdminConfig);
      await superAdmin.save();
      console.log('SimpleUser SuperAdminユーザーを作成しました:');
      console.log(`- 名前: ${superAdminConfig.name}`);
      console.log(`- メール: ${superAdminConfig.email}`);
      console.log(`- 権限: ${superAdminConfig.role}`);
    }

    // データベース接続を閉じる
    mongoose.connection.close();
  } catch (error) {
    console.error('SuperAdmin作成エラー:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

createSimpleSuperAdmin();