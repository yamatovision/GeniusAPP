/**
 * ClaudeCode起動カウンター問題調査スクリプト
 * 
 * このスクリプトはフロントエンドからバックエンドまでのエンドツーエンドテストを行い、
 * ClaudeCode起動カウンターが機能していない問題の原因を特定します。
 */

const axios = require('axios');
const readline = require('readline');
const mongoose = require('mongoose');

// MongoDB接続情報
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
    console.log('✅ MongoDB接続成功');
  } catch (error) {
    console.error('❌ MongoDB接続エラー:', error.message);
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
    
    // SimpleUserモデルを取得
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
      console.log('❌ 指定されたユーザーが見つかりませんでした');
      return;
    }
    
    // ユーザー情報とカウンター値を表示
    console.log('\n📊 ===== ユーザー情報 =====');
    console.log(`名前: ${user.name}`);
    console.log(`メール: ${user.email}`);
    console.log(`役割: ${user.role}`);
    console.log(`ID: ${user._id}`);
    console.log(`組織ID: ${user.organizationId || 'なし'}`);
    
    // カウンター情報
    console.log('\n📊 ===== ClaudeCode起動カウンター情報 =====');
    console.log(`現在のカウンター値: ${user.claudeCodeLaunchCount || 0}`);
    console.log(`カウンターのデータ型: ${typeof user.claudeCodeLaunchCount}`);
    console.log(`カウンタープロパティの存在: ${user.hasOwnProperty('claudeCodeLaunchCount') ? 'あり' : 'なし'}`);
    console.log(`最終更新日時: ${user.updatedAt}`);
    
    // APIテスト準備
    console.log('\n📡 ===== API直接テスト =====');
    const apiTestOption = await getUserInput(
      'APIテストのタイプを選択してください:\n' +
      '1) 認証済みユーザーのアクセストークンでテスト\n' +
      '2) APIキーでテスト\n' +
      '3) 直接データベース更新でテスト\n' +
      '選択 (1-3): '
    );
    
    switch (apiTestOption) {
      case '1': {
        // アクセストークンを入力
        const token = await getUserInput('アクセストークンを入力してください: ');
        console.log('\n🔑 アクセストークンを使用したAPIテスト開始...');
        
        // APIエンドポイント
        const apiUrl = 'http://localhost:3000/api/simple/users/' + user._id + '/increment-claude-code-launch';
        console.log(`APIエンドポイント: ${apiUrl}`);
        
        try {
          // API呼び出し
          const response = await axios.post(
            apiUrl,
            {},
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('\n✅ APIレスポンス:');
          console.log('ステータス:', response.status, response.statusText);
          console.log('データ:', JSON.stringify(response.data, null, 2));
          
          // 更新後のユーザー情報を取得
          const updatedUser = await SimpleUser.findById(user._id);
          console.log('\n📊 更新後のカウンター値:', updatedUser.claudeCodeLaunchCount || 0);
        } catch (error) {
          console.error('❌ API呼び出しエラー:', error.message);
          
          if (error.response) {
            // サーバーからのレスポンスがある場合
            console.error('ステータス:', error.response.status);
            console.error('ヘッダー:', JSON.stringify(error.response.headers, null, 2));
            console.error('データ:', JSON.stringify(error.response.data, null, 2));
          } else if (error.request) {
            // リクエストは送信されたがレスポンスがない場合
            console.error('リクエストは送信されましたがレスポンスがありません');
          } else {
            // リクエスト設定中にエラーが発生した場合
            console.error('リクエスト設定エラー:', error.message);
          }
        }
        break;
      }
      
      case '2': {
        // APIキーを入力
        const apiKey = await getUserInput('APIキーを入力してください: ');
        console.log('\n🔑 APIキーを使用したAPIテスト開始...');
        
        // APIエンドポイント
        const apiUrl = 'http://localhost:3000/api/simple/users/' + user._id + '/increment-claude-code-launch';
        console.log(`APIエンドポイント: ${apiUrl}`);
        
        try {
          // API呼び出し
          const response = await axios.post(
            apiUrl,
            {},
            {
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('\n✅ APIレスポンス:');
          console.log('ステータス:', response.status, response.statusText);
          console.log('データ:', JSON.stringify(response.data, null, 2));
          
          // 更新後のユーザー情報を取得
          const updatedUser = await SimpleUser.findById(user._id);
          console.log('\n📊 更新後のカウンター値:', updatedUser.claudeCodeLaunchCount || 0);
        } catch (error) {
          console.error('❌ API呼び出しエラー:', error.message);
          
          if (error.response) {
            // サーバーからのレスポンスがある場合
            console.error('ステータス:', error.response.status);
            console.error('ヘッダー:', JSON.stringify(error.response.headers, null, 2));
            console.error('データ:', JSON.stringify(error.response.data, null, 2));
          } else if (error.request) {
            // リクエストは送信されたがレスポンスがない場合
            console.error('リクエストは送信されましたがレスポンスがありません');
          } else {
            // リクエスト設定中にエラーが発生した場合
            console.error('リクエスト設定エラー:', error.message);
          }
        }
        break;
      }
      
      case '3': {
        console.log('\n💾 直接データベース更新テスト');
        
        // 現在のカウンター値を記録
        const oldCount = user.claudeCodeLaunchCount || 0;
        console.log(`現在の値: ${oldCount}`);
        
        try {
          // カウンターをインクリメント
          if (typeof user.claudeCodeLaunchCount !== 'number') {
            user.claudeCodeLaunchCount = 1;
          } else {
            user.claudeCodeLaunchCount += 1;
          }
          
          await user.save();
          console.log(`✅ カウンター更新成功。新しい値: ${user.claudeCodeLaunchCount}`);
          
          // 更新を確認
          const updatedUser = await SimpleUser.findById(user._id);
          console.log(`✅ データベース再確認: 新しい値: ${updatedUser.claudeCodeLaunchCount || 0}`);
        } catch (error) {
          console.error('❌ データベース更新エラー:', error.message);
        }
        break;
      }
      
      default:
        console.log('無効なオプションが選択されました。テストを中止します。');
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  } finally {
    // MongoDBの接続を閉じる
    await mongoose.connection.close();
    console.log('\n✓ MongoDB接続を閉じました');
    
    console.log(`
====== 問題解決ガイド ======
1. アクセストークンが正しく設定されていない
   - AuthenticationServiceやSimpleAuthServiceを確認
   - フロントエンドでの認証ヘッダー設定を確認

2. イベントが発行されていない
   - extension.tsでリスナー登録確認
   - ClaudeCodeLauncherServiceのイベント発行確認

3. APIエンドポイントの問題
   - APIのルート設定確認
   - ミドルウェアの認証チェック
   - コントローラーの挙動確認

4. データベース更新の問題
   - データベース接続設定
   - モデルのスキーマ定義確認
   - saveメソッドの確認
    `);
    
    process.exit(0);
  }
};

// スクリプト実行
main();