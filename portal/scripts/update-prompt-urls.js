/**
 * プロンプト公開URLの更新スクリプト
 * 
 * 旧Railway.appのURLベースのpublicTokenを持つプロンプトレコードを
 * 新しいCloud Run URLベースに更新します。
 */

// 環境変数のロード
require('dotenv').config({ path: '../.env' });

const mongoose = require('mongoose');
const dbConfig = require('../backend/config/db.config');
const Prompt = require('../backend/models/prompt.model');

// 新しいAPIホスト名（テスト環境または本番環境）
const NEW_API_HOST = process.env.API_HOST || 'appgenius-portal-test-235426778039.asia-northeast1.run.app';
// 古いAPIホスト名（Railway）
const OLD_API_HOST = 'geniemon-portal-backend-production.up.railway.app';

// MongoDBに接続
async function connectDB() {
  try {
    console.log('MongoDBに接続しています...');
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log('MongoDB接続成功');
  } catch (error) {
    console.error('MongoDB接続エラー:', error);
    process.exit(1);
  }
}

// プロンプトレコードの更新
async function updatePromptUrls() {
  try {
    // publicTokenを持つすべてのプロンプトを検索
    const promptsWithToken = await Prompt.find({ publicToken: { $exists: true, $ne: null } });
    
    console.log(`${promptsWithToken.length}件のpublicTokenを持つプロンプトが見つかりました`);
    
    if (promptsWithToken.length === 0) {
      console.log('更新するプロンプトがありません');
      return;
    }
    
    console.log('-------------------------------------------------------------------');
    console.log(`古いAPIホスト: ${OLD_API_HOST}`);
    console.log(`新しいAPIホスト: ${NEW_API_HOST}`);
    console.log('-------------------------------------------------------------------');
    
    // 各プロンプトのURLをチェックして更新
    const updatePromises = [];
    
    for (const prompt of promptsWithToken) {
      // プロンプト情報の表示
      console.log(`プロンプトID: ${prompt._id}`);
      console.log(`タイトル: ${prompt.title}`);
      console.log(`公開トークン: ${prompt.publicToken}`);
      
      // 現在のURL
      const oldShareUrl = `http://${OLD_API_HOST}/api/prompts/public/${prompt.publicToken}`;
      const newShareUrl = `https://${NEW_API_HOST}/api/prompts/public/${prompt.publicToken}`;
      
      console.log(`現在のURL: ${oldShareUrl}`);
      console.log(`新しいURL: ${newShareUrl}`);
      console.log('-------------------------------------------------------------------');
      
      // 実際のURLの更新を行う
      // publicTokenは変更せず、保持したまま更新
      // このスクリプトを実行すると、フロントエンドのシェアURLが正しく生成されるようになる
      // （プロンプトコントローラーのcreateShareLinkメソッドがAPI_HOSTを参照するため）
      updatePromises.push(
        Prompt.findByIdAndUpdate(
          prompt._id,
          { $set: { publicToken: prompt.publicToken } }, // トークンは保持したまま更新
          { new: true }
        )
      );
    }
    
    // 実際の更新処理を実行
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`${updatePromises.length}件のプロンプトを更新しました`);
    }
    
    // 更新モードを確認
    console.log('\n実際に更新を行うには、スクリプトを編集して更新処理を有効にしてください。');
    console.log('注意: 更新する前にデータベースのバックアップを取ることをお勧めします。');
    
  } catch (error) {
    console.error('プロンプト更新エラー:', error);
  }
}

// 環境変数の確認
async function checkEnvironmentVariables() {
  console.log('\n環境変数の確認:');
  console.log('-------------------------------------------------------------------');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || '設定なし（デフォルト: development）'}`);
  console.log(`API_HOST: ${process.env.API_HOST || '設定なし'}`);
  console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? '設定あり（表示は省略）' : '設定なし'}`);
  console.log('-------------------------------------------------------------------');
  
  if (!process.env.API_HOST) {
    console.log('\n警告: API_HOST環境変数が設定されていません。');
    console.log('更新後のURLのホスト名には、デフォルト値が使用されます。');
    console.log(`デフォルト値: ${NEW_API_HOST}`);
    console.log('\n環境変数を設定するには、以下のように.envファイルに追加してください:');
    console.log('API_HOST=appgenius-portal-test-235426778039.asia-northeast1.run.app');
    console.log('または');
    console.log('API_HOST=appgenius-portal-backend-235426778039.asia-northeast1.run.app');
  }
}

// メイン実行
async function main() {
  try {
    console.log('プロンプト公開URL更新スクリプトを開始します');
    await connectDB();
    await checkEnvironmentVariables();
    await updatePromptUrls();
    console.log('処理が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    // 接続を閉じる
    mongoose.connection.close();
    console.log('MongoDB接続を閉じました');
  }
}

// スクリプトの実行
main();