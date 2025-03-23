/**
 * ユーザーモデルスキーマの定義を確認するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');

// データベース接続情報
const MONGODB_URI = 'mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster';

async function checkModelSchema() {
  try {
    console.log('MongoDBに接続を試行中...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB接続に成功しました!');

    // User.roleのバリデーション制約を確認
    const User = mongoose.model('User');
    const userSchema = User.schema;
    
    console.log('\n=== Userモデルスキーマ ===');
    
    // roleフィールドの定義を取得
    const roleSchema = userSchema.paths.role;
    if (roleSchema) {
      console.log('roleフィールドの定義:');
      console.log('- タイプ:', roleSchema.instance);
      console.log('- 必須:', roleSchema.isRequired ? 'はい' : 'いいえ');
      
      // enumの制約を表示
      if (roleSchema.enumValues && roleSchema.enumValues.length > 0) {
        console.log('- 許可値 (enum):', roleSchema.enumValues);
      } else {
        console.log('- 許可値 (enum): 制約なし');
      }
      
      // デフォルト値
      if (roleSchema.defaultValue) {
        console.log('- デフォルト値:', roleSchema.defaultValue);
      }
      
      // バリデーションメッセージの確認
      if (roleSchema.validators && roleSchema.validators.length > 0) {
        console.log('- バリデータ:');
        roleSchema.validators.forEach((validator, i) => {
          console.log(`  ${i+1}. タイプ: ${validator.type}, メッセージ: ${validator.message}`);
        });
      }
    } else {
      console.log('roleフィールドが見つかりません');
    }
    
    // テスト実行: 意図的にinvalidなデータでエラーメッセージを確認
    console.log('\n=== バリデーションテスト ===');
    
    try {
      const testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'invalid_role' // 不正なロール
      });
      
      await testUser.validate();
      console.log('バリデーション成功（予期しない結果）');
    } catch (validationError) {
      console.log('バリデーションエラー（期待される結果）:');
      if (validationError.errors && validationError.errors.role) {
        console.log('- ロールエラー:', validationError.errors.role.message);
        console.log('- ロールの完全なエラー情報:', JSON.stringify(validationError.errors.role, null, 2));
      } else {
        console.log('- 詳細エラー:', validationError.message);
      }
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB接続を終了しました');
  }
}

checkModelSchema();