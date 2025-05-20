/**
 * データベース接続設定
 */
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

const config = {
  // MongoDB接続設定
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hinago_dev',
    dbName: process.env.MONGODB_DB_NAME || 'hinago_dev',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
    },
  },
  
  // テスト環境用設定
  test: {
    uri: process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/hinago-test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  
  // 接続設定
  connection: {
    connectTimeoutMS: 30000,
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  },
};

export default config;