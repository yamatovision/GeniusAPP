/**
 * プロンプトコレクションのインデックスを再構築するスクリプト
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('../backend/config/db.config');

// MongoDB接続
async function connectDB() {
  try {
    await mongoose.connect(dbConfig.url, dbConfig.options);
    console.log("MongoDB データベースに接続しました");
    return true;
  } catch (err) {
    console.error("MongoDB 接続エラー:", err);
    return false;
  }
}

// プロンプトコレクションのインデックスを再構築
async function rebuildIndexes() {
  try {
    // コレクション取得
    const promptsCollection = mongoose.connection.collection('prompts');
    
    // 既存のインデックスを取得
    const indexes = await promptsCollection.indexes();
    console.log("現在のインデックス:", indexes);
    
    // title_1_ownerId_1のユニークインデックスを削除（存在する場合）
    const uniqueIndex = indexes.find(idx => 
      idx.name === 'title_1_ownerId_1' && idx.unique === true
    );
    
    if (uniqueIndex) {
      console.log("ユニークインデックスを削除します...");
      await promptsCollection.dropIndex('title_1_ownerId_1');
      console.log("ユニークインデックスを削除しました");
    }
    
    // 新しいインデックスを作成（ユニーク制約なし）
    console.log("新しいインデックスを作成します...");
    await promptsCollection.createIndex({ title: 1, ownerId: 1 });
    console.log("インデックスを再作成しました");
    
    // 確認のため現在のインデックスを表示
    const updatedIndexes = await promptsCollection.indexes();
    console.log("更新後のインデックス:", updatedIndexes);
    
    return true;
  } catch (error) {
    console.error("インデックス再構築エラー:", error);
    return false;
  }
}

// スクリプト実行
(async () => {
  // DB接続
  const connected = await connectDB();
  if (!connected) {
    console.error("データベース接続に失敗したため、処理を中止します");
    process.exit(1);
  }
  
  // インデックス再構築
  const success = await rebuildIndexes();
  
  // 接続を閉じる
  await mongoose.disconnect();
  console.log("MongoDB 接続を閉じました");
  
  if (success) {
    console.log("インデックスの再構築が完了しました");
    process.exit(0);
  } else {
    console.error("インデックスの再構築に失敗しました");
    process.exit(1);
  }
})();