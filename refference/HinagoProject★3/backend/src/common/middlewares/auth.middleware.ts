/**
 * 認証ミドルウェア
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestWithUser } from '../../types';
import { sendError, ErrorCodes } from '../utils/response';
import config from '../../config';
import logger from '../utils/logger';

/**
 * JWTトークンを検証するミドルウェア
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const reqWithUser = req as RequestWithUser;
  // Authorization ヘッダーからトークンを取得
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(
      res,
      '認証が必要です',
      401,
      ErrorCodes.AUTH_REQUIRED
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // トークンを検証
    const decoded = jwt.verify(token, config.auth.jwt.secret) as any;
    
    // リクエストオブジェクトにユーザー情報を追加
    (req as RequestWithUser).user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId
    };
    
    next();
  } catch (error: any) {
    logger.error('Token verification failed', { error: error.message });
    
    if (error.name === 'TokenExpiredError') {
      return sendError(
        res,
        'トークンの有効期限が切れています',
        401,
        ErrorCodes.TOKEN_EXPIRED
      );
    }
    
    return sendError(
      res,
      'トークンが無効です',
      401,
      ErrorCodes.INVALID_TOKEN
    );
  }
};

/**
 * パブリックエンドポイントをチェックするミドルウェア
 * パブリックパスの場合は認証チェックをスキップする
 */
export const checkPublicEndpoint = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  
  // パブリックエンドポイントかどうかをチェック
  const isPublicEndpoint = config.auth.publicEndpoints.some(endpoint => {
    // 完全一致のチェック
    return path === endpoint;
  });
  
  if (isPublicEndpoint) {
    return next();
  }
  
  // パブリックでない場合は認証ミドルウェアを実行
  return requireAuth(req, res, next);
};