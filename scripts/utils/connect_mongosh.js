/**
 * mongoshに接続するためのスクリプト
 * Mongoシェルに接続し、コレクションを確認するためのガイドを表示します
 */
require('dotenv').config();
const { exec } = require('child_process');
const dbConfig = require('./portal/backend/config/db.config');

// MongoDB接続URI
const mongoURI = process.env.MONGODB_URI || dbConfig.url || 'mongodb://localhost:27017/appgenius';

console.log("=== MongoDB接続情報 ===");
console.log(`接続先URI: ${mongoURI}`);
console.log("\n以下のコマンドでMongoshに接続できます:");
console.log(`mongosh "${mongoURI}"`);

console.log("\n=== 接続後に使えるコマンド例 ===");
console.log("// データベースの一覧を表示");
console.log("show dbs");
console.log("\n// 現在のデータベースのコレクション一覧を表示");
console.log("show collections");
console.log("\n// AnthropicAPIキーコレクションを検索");
console.log("db.anthropicapikeys.find().sort({createdAt: -1}).limit(5).pretty()");
console.log("\n// 特定ユーザーの検索");
console.log("db.simpleusers.findOne({email: 'shiraishi.tatsuya@mikoto.co.jp'})");
console.log("\n// 最新のAnthropicAPIキーを検索し、apiKeyFullフィールドを確認");
console.log("db.anthropicapikeys.find({}, {apiKeyId: 1, name: 1, apiKeyFull: 1, createdAt: 1}).sort({createdAt: -1}).limit(5).pretty()");

// 自動接続を試みる（許可されている場合）
try {
  console.log("\n=== 自動接続を試みます ===");
  exec(`mongosh "${mongoURI}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`mongosh実行エラー: ${error.message}`);
      console.log("mongoshが正しくインストールされているか確認してください。");
      console.log("または、上記のコマンドを手動で実行してください。");
      return;
    }
    if (stderr) {
      console.error(`mongoshエラー出力: ${stderr}`);
      return;
    }
    console.log(stdout);
  });
} catch (e) {
  console.log("自動接続できませんでした。上記のコマンドを手動で実行してください。");
}