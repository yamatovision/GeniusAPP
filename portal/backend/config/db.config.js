/**
 * データベース設定ファイル
 * 環境変数から接続情報を読み込み、Mongooseの接続設定を提供します
 */
require('dotenv').config();

module.exports = {
  // MongoDB接続URL
  url: process.env.MONGODB_URI || 
       `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=admin`,
  
  // データベース接続オプション
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  },

  // 接続設定
  connect: async (mongoose) => {
    try {
      if (process.env.SKIP_DB_CONNECTION === 'true') {
        console.log("データベース接続をスキップしました（開発モード）");
        return true;
      }
      
      await mongoose.connect(module.exports.url, module.exports.options);
      console.log("MongoDB データベースに接続しました");
      return true;
    } catch (err) {
      console.error("MongoDB 接続エラー:", err);
      if (process.env.NODE_ENV === 'development') {
        console.warn("開発モードでデータベース接続エラーが発生しましたが、サーバーは起動します");
        return true;
      }
      return false;
    }
  },

  // 接続切断
  disconnect: async (mongoose) => {
    try {
      if (process.env.SKIP_DB_CONNECTION === 'true') {
        console.log("データベース接続をスキップしているため、切断処理も不要です");
        return true;
      }
      
      await mongoose.disconnect();
      console.log("MongoDB データベース接続を切断しました");
      return true;
    } catch (err) {
      console.error("MongoDB 切断エラー:", err);
      return false;
    }
  }
};