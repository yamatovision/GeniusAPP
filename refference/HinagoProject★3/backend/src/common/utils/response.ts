/**
 * API レスポンスフォーマットユーティリティ
 */
import { Response } from 'express';
import { ApiResponse } from '../../types';

// 成功レスポンスヘルパー
export const sendSuccess = <T>(
  res: Response, 
  data: T, 
  statusCode = 200, 
  meta?: ApiResponse<T>['meta']
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

// エラーレスポンスヘルパー
export const sendError = (
  res: Response, 
  message: string, 
  statusCode = 500, 
  code = 'INTERNAL_SERVER_ERROR', 
  details?: any
): Response => {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error!.details = details;
  }

  return res.status(statusCode).json(response);
};

// エラーコード定義
export const ErrorCodes = {
  // 認証エラー
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  
  // 権限エラー
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // リソースエラー
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  
  // 入力エラー
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  
  // データベースエラー
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // サーバーエラー
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // ビジネスロジックエラー
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  
  // ファイルエラー
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
};