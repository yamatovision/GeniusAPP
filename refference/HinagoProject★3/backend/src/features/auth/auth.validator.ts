/**
 * 認証リクエストのバリデーション
 */
import { body } from 'express-validator';
import { 
  validateEmail, 
  validatePassword, 
  validateRequiredString 
} from '../../common/validators';

/**
 * ログインリクエストのバリデーション
 */
export const validateLogin = [
  validateEmail(),
  validatePassword(),
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('ログイン状態の保持はブール値である必要があります'),
];

/**
 * ユーザー登録リクエストのバリデーション
 */
export const validateRegister = [
  validateEmail(),
  validatePassword(),
  validateRequiredString('name', { min: 1, max: 50 }),
  validateRequiredString('organizationName', { min: 1, max: 100 }),
];

/**
 * パスワードリセット要求のバリデーション
 */
export const validatePasswordResetRequest = [
  validateEmail(),
];

/**
 * パスワードリセット確認のバリデーション
 */
export const validatePasswordResetConfirm = [
  body('token')
    .isString()
    .withMessage('トークンは文字列である必要があります')
    .trim()
    .notEmpty()
    .withMessage('トークンは必須です'),
  validatePassword(),
];

/**
 * トークン更新リクエストのバリデーション
 */
export const validateRefreshToken = [
  body('refreshToken')
    .isString()
    .withMessage('リフレッシュトークンは文字列である必要があります')
    .trim()
    .notEmpty()
    .withMessage('リフレッシュトークンは必須です'),
];