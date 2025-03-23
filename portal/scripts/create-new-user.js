/**
 * 新しいSimpleUserを作成するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SimpleUser = require('../backend/models/simpleUser.model');
const dbConfig = require('../backend/config/db.config');

async function createNewUser() {
  try {
    // MongoDBに接続
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log('MongoDB に接続しました');
    
    // 新しいユーザーを作成
    const newUser = new SimpleUser({
      name: '達也さん',
      email: 'metavicer@gmail.com',
      password: 'Mikoto@123',
      role: 'SuperAdmin',
      status: 'active'
    });
    
    // 保存
    await newUser.save();
    console.log('新しいユーザーが作成されました:');
    console.log(`- ID: ${newUser._id}`);
    console.log(`- 名前: ${newUser.name}`);
    console.log(`- メール: ${newUser.email}`);
    console.log(`- 権限: ${newUser.role}`);
    
    // 切断
    await mongoose.connection.close();
    console.log('MongoDB 接続を閉じました');
  } catch (error) {
    console.error('エラー:', error);
    await mongoose.connection.close();
  }
}

createNewUser();