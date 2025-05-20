/**
 * 認証コントローラー
 */
import { Request, Response, NextFunction } from 'express';
import { RequestWithUser } from '../../types';
import { sendSuccess } from '../../common/utils';
import * as authService from './auth.service';
import logger from '../../common/utils/logger';

/**
 * ユーザー登録コントローラー
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body);
    
    // 成功レスポンスを返す
    return sendSuccess(res, result, 201);
  } catch (error) {
    logger.error('ユーザー登録エラー', { error });
    next(error);
  }
};

/**
 * ログインコントローラー
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    
    // 成功レスポンスを返す
    return sendSuccess(res, result);
  } catch (error) {
    logger.error('ログインエラー', { error });
    next(error);
  }
};

/**
 * ログアウトコントローラー
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // リクエストからリフレッシュトークンを取得
    const refreshToken = req.body.refreshToken;
    
    await authService.logout(refreshToken);
    
    // ログアウト成功レスポンスを返す
    return sendSuccess(res, { message: 'ログアウトしました' });
  } catch (error) {
    logger.error('ログアウトエラー', { error });
    next(error);
  }
};

/**
 * トークン更新コントローラー
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    
    // 成功レスポンスを返す
    return sendSuccess(res, { token: result });
  } catch (error) {
    logger.error('トークン更新エラー', { error });
    next(error);
  }
};

/**
 * パスワードリセット要求コントローラー
 */
export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.requestPasswordReset(req.body);
    
    // 成功レスポンスを返す（セキュリティのため、実際に送信されたかは明かさない）
    return sendSuccess(res, { message: 'パスワードリセット手順を記載したメールを送信しました' });
  } catch (error) {
    logger.error('パスワードリセット要求エラー', { error });
    next(error);
  }
};

/**
 * パスワードリセット確認コントローラー
 */
export const confirmPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.confirmPasswordReset(req.body);
    
    // 成功レスポンスを返す
    return sendSuccess(res, { message: 'パスワードが正常にリセットされました' });
  } catch (error) {
    logger.error('パスワードリセット確認エラー', { error });
    next(error);
  }
};

/**
 * 現在のユーザー情報取得コントローラー
 */
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  const reqWithUser = req as RequestWithUser;
  try {
    if (!reqWithUser.user || !reqWithUser.user.id) {
      return sendSuccess(res, null);
    }
    
    const user = await authService.getCurrentUser(reqWithUser.user.id);
    
    // 成功レスポンスを返す
    return sendSuccess(res, { user });
  } catch (error) {
    logger.error('ユーザー情報取得エラー', { error });
    next(error);
  }
};