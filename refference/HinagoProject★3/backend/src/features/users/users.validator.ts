/**
 * ユーザー関連バリデーター
 */
import { body, param, query } from 'express-validator';
import { UserRole } from '../../types';

/**
 * ユーザー一覧取得時のバリデーションルール
 */
export const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ページ番号は1以上の整数である必要があります')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('1ページあたりの結果数は1以上100以下の整数である必要があります')
    .toInt(),
  query('sort')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9_]+(:(asc|desc))?$/)
    .withMessage('ソート条件の形式が不正です（例: name:asc）'),
  query('search')
    .optional()
    .isString()
    .withMessage('検索キーワードは文字列である必要があります'),
];

/**
 * ユーザーIDパラメータのバリデーションルール
 */
export const userIdParamValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('ユーザーIDは必須です'),
];

/**
 * ユーザー情報更新時のバリデーションルール
 */
export const updateUserValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('ユーザーIDは必須です'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('名前は1文字以上50文字以下である必要があります'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('有効なメールアドレスを入力してください')
    .normalizeEmail(),
];

/**
 * ユーザープロフィール更新時のバリデーションルール
 */
export const updateProfileValidation = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('名前は1文字以上50文字以下である必要があります'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('有効なメールアドレスを入力してください')
    .normalizeEmail(),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('preferences はオブジェクトである必要があります'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('テーマは light または dark である必要があります'),
  body('preferences.notifications')
    .optional()
    .isObject()
    .withMessage('通知設定はオブジェクトである必要があります'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('email 通知設定は真偽値である必要があります'),
  body('preferences.notifications.browser')
    .optional()
    .isBoolean()
    .withMessage('browser 通知設定は真偽値である必要があります'),
  body('preferences.defaultViews')
    .optional()
    .isObject()
    .withMessage('defaultViews はオブジェクトである必要があります'),
  body('preferences.defaultViews.dashboard')
    .optional()
    .isString()
    .withMessage('dashboard の初期表示設定は文字列である必要があります'),
];