/**
 * ロギングユーティリティ
 */
import winston from 'winston';
import config from '../../config';

// ロガーの設定
const logger = winston.createLogger({
  level: config.app.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hinago-backend' },
  transports: [
    // コンソールへの出力
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
  ],
});

// 開発環境以外では、ファイルへもログを出力
if (config.app.app.env !== 'development') {
  logger.add(
    new winston.transports.File({
      filename: `${config.app.logging.logDir}/error.log`,
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: `${config.app.logging.logDir}/combined.log`,
    })
  );
}

// リクエストIDを追加するためのラッパー関数
export const createRequestLogger = (requestId: string) => {
  return {
    info: (message: string, meta = {}) => {
      logger.info(message, { requestId, ...meta });
    },
    error: (message: string, meta = {}) => {
      logger.error(message, { requestId, ...meta });
    },
    warn: (message: string, meta = {}) => {
      logger.warn(message, { requestId, ...meta });
    },
    debug: (message: string, meta = {}) => {
      logger.debug(message, { requestId, ...meta });
    },
  };
};

export default logger;