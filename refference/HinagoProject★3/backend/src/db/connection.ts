/**
 * MongoDBデータベース接続
 */
import mongoose from 'mongoose';
import config from '../config';
import logger from '../common/utils/logger';

// 接続オプション
const connectionOptions: mongoose.ConnectOptions = {
  ...config.db.mongodb.options,
  ...config.db.connection,
};

/**
 * データベース接続処理
 */
export const connectToDatabase = async (): Promise<void> => {
  try {
    // 接続セットアップ
    logger.info('MongoDBに接続しています...');
    
    // 接続開始
    await mongoose.connect(config.db.mongodb.uri, connectionOptions);
    
    // 接続イベントのリスナー設定
    mongoose.connection.on('connected', () => {
      logger.info('MongoDBに接続しました');
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB接続エラー', { error: err.message });
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDBから切断されました');
    });
    
    // プロセス終了時にMongoDBとの接続を切断
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDBとの接続を閉じました');
      process.exit(0);
    });
    
    logger.info('MongoDBの接続設定が完了しました');
  } catch (error: any) {
    logger.error('MongoDBへの接続に失敗しました', { error: error.message });
    throw error;
  }
};

/**
 * データベース切断処理
 */
export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDBとの接続を閉じました');
  } catch (error: any) {
    logger.error('MongoDBとの切断に失敗しました', { error: error.message });
    throw error;
  }
};

export default { connectToDatabase, disconnectFromDatabase };