/**
 * 認証ルート
 */
import { Router } from 'express';
import * as authController from './auth.controller';
import { requireAuth } from '../../common/middlewares';
import { validate } from '../../common/middlewares';
import {
  validateLogin,
  validateRegister,
  validatePasswordResetRequest,
  validatePasswordResetConfirm,
  validateRefreshToken,
} from './auth.validator';
import { API_PATHS } from '../../types';

const router = Router();

// 登録ルート
router.post(
  '/register',
  validate(validateRegister),
  authController.register
);

// ログインルート
router.post(
  '/login',
  validate(validateLogin),
  authController.login
);

// ログアウトルート
router.post(
  '/logout',
  requireAuth,
  authController.logout
);

// トークン更新ルート
router.post(
  '/refresh',
  validate(validateRefreshToken),
  authController.refreshToken
);

// パスワードリセット要求ルート
router.post(
  '/password-reset/request',
  validate(validatePasswordResetRequest),
  authController.requestPasswordReset
);

// パスワードリセット確認ルート
router.post(
  '/password-reset/confirm',
  validate(validatePasswordResetConfirm),
  authController.confirmPasswordReset
);

// 現在のユーザー情報取得ルート
router.get(
  '/me',
  requireAuth,
  authController.getCurrentUser
);

export default router;