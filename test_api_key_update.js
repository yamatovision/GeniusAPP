/**
 * ユーザーのAPIキー値を直接更新するスクリプト
 * 例: node test_api_key_update.js <ユーザーID> <APIキー値>
 */
const mongoose = require('mongoose');
const SimpleUser = require('./portal/backend/models/simpleUser.model');
const SimpleApiKey = require('./portal/backend/models/simpleApiKey.model');

// データベース接続設定
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';

async function main() {
  try {
    // コマンドライン引数からユーザーIDとAPIキー値を取得
    const args = process.argv.slice(2);
    let userId = args[0];
    let apiKeyValue = args[1];
    
    // 引数がない場合は、対話形式で入力を求める
    if (!userId || !apiKeyValue) {
      console.log('使用方法: node test_api_key_update.js <ユーザーID> <APIキー値>');
      console.log('または、メールアドレスでユーザーを検索する場合: node test_api_key_update.js --email <メールアドレス> <APIキー値>');
      process.exit(1);
    }
    
    // メールアドレスによる検索オプション
    let useEmail = false;
    if (userId === '--email' && args[1] && args[2]) {
      useEmail = true;
      userId = args[1];
      apiKeyValue = args[2];
    }
    
    // MongoDBに接続
    console.log('MongoDBに接続中...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDBに接続しました');
    
    // ユーザーの検索
    console.log('ユーザーを検索中...');
    let user;
    
    if (useEmail) {
      // メールアドレスでユーザーを検索
      user = await SimpleUser.findOne({ email: userId });
    } else {
      // IDでユーザーを検索
      user = await SimpleUser.findById(userId);
    }
    
    if (!user) {
      console.error('ユーザーが見つかりませんでした');
      process.exit(1);
    }
    
    console.log(`ユーザーが見つかりました: ${user.name} (${user._id}), メール: ${user.email}`);
    
    // 現在のAPIキー情報を表示
    console.log('現在のAPIキー情報:');
    console.log(`APIキーID: ${user.apiKeyId || 'なし'}`);
    console.log(`APIキー値: ${user.apiKeyValue || 'なし'}`);
    
    // APIキーIDがある場合、存在確認
    if (user.apiKeyId) {
      const apiKey = await SimpleApiKey.findOne({ id: user.apiKeyId });
      if (apiKey) {
        console.log(`APIキーテーブルの情報 - ID: ${apiKey.id}, 値: ${apiKey.keyValue}, ステータス: ${apiKey.status}`);
      } else {
        console.log('APIキーIDに対応するAPIキーが見つかりませんでした');
      }
    }
    
    // APIキー値を直接更新
    console.log(`APIキー値を更新します: ${apiKeyValue.substring(0, 10)}...`);
    
    user.apiKeyValue = apiKeyValue;
    await user.save();
    
    console.log('APIキー値の更新が完了しました');
    console.log(`ユーザー: ${user.name} (${user._id})`);
    console.log(`新しいAPIキー値: ${user.apiKeyValue.substring(0, 10)}...`);
    
    // 切断
    await mongoose.disconnect();
    console.log('MongoDBから切断しました');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch(console.error);