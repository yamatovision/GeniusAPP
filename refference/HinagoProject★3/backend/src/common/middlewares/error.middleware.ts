/**
 * エラーハンドリングミドルウェア
 */
import { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCodes } from '../utils/response';
import logger from '../utils/logger';

// カスタムエラークラス
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;
  
  constructor(message: string, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Not Found エラーハンドラー
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `リクエストされたパス ${req.originalUrl} が見つかりません`,
    404,
    ErrorCodes.RESOURCE_NOT_FOUND
  );
  next(error);
};

// グローバルエラーハンドラー
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // エラーをログに記録
  logger.error(`Error: ${error.message}`, {
    stack: error.stack,
    path: req.path,
    method: req.method,
    statusCode: error.statusCode || 500,
    errorCode: error.code || ErrorCodes.INTERNAL_SERVER_ERROR,
  });
  
  // エラーコードとステータスコードの設定
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || ErrorCodes.INTERNAL_SERVER_ERROR;
  
  // 本番環境ではスタックトレースを送信しない
  const details = process.env.NODE_ENV === 'production' 
    ? error.details 
    : { ...error.details, stack: error.stack };
  
  // エラーレスポンスを送信
  return sendError(
    res,
    error.message || 'サーバーエラーが発生しました',
    statusCode,
    errorCode,
    details
  );
};