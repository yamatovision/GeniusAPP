/**
 * アプリケーションエントリーポイント
 */
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { connectToDatabase } from './db/connection';
import config from './config';
import routes from './routes';
import { 
  notFoundHandler, 
  errorHandler,
  checkPublicEndpoint
} from './common/middlewares';
import logger from './common/utils/logger';

// Expressアプリケーションの作成
const app: Application = express();

// ミドルウェアの設定
app.use(helmet()); // セキュリティヘッダーの設定
app.use(cors(config.app.cors)); // CORS設定
app.use(express.json()); // JSONリクエストボディのパース
app.use(express.urlencoded({ extended: true })); // URL-encodedリクエストボディのパース
app.use(cookieParser(config.auth.session.secret)); // Cookieのパース
app.use(morgan(config.app.logging.format)); // HTTPリクエストのロギング

// 認証チェックミドルウェア（パブリックエンドポイントはスキップ）
app.use(checkPublicEndpoint);

// ルートの適用
app.use(routes);

// 404ハンドラー（未定義のルートに対して）
app.use(notFoundHandler);

// エラーハンドラー
app.use(errorHandler);

// アプリケーションの起動
const startServer = async () => {
  try {
    // データベース接続
    await connectToDatabase();
    
    // サーバーの起動
    const PORT = config.app.app.port;
    app.listen(PORT, () => {
      logger.info(`サーバーが起動しました: http://localhost:${PORT}`);
      logger.info(`環境: ${config.app.app.env}`);
    });
  } catch (error: any) {
    logger.error('サーバー起動エラー:', { error: error.message });
    process.exit(1);
  }
};

// テスト環境でない場合のみサーバー起動
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app; // テスト用にエクスポート