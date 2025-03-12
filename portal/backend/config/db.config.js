/**
 * データベース設定ファイル
 * 環境変数から接続情報を読み込み、Mongooseの接続設定を提供します
 */
require('dotenv').config();

module.exports = {
  // MongoDB接続URL
  url: `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=admin`,
  
  // データベース接続オプション
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // 開発環境用のデバッグログ
    debug: process.env.NODE_ENV === 'development'
  },

  // 接続設定
  connect: async (mongoose) => {
    try {
      await mongoose.connect(module.exports.url, module.exports.options);
      console.log("MongoDB データベースに接続しました");
      return true;
    } catch (err) {
      console.error("MongoDB 接続エラー:", err);
      return false;
    }
  },

  // 接続切断
  disconnect: async (mongoose) => {
    try {
      await mongoose.disconnect();
      console.log("MongoDB データベース接続を切断しました");
      return true;
    } catch (err) {
      console.error("MongoDB 切断エラー:", err);
      return false;
    }
  }
};