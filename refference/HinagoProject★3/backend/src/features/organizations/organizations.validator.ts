/**
 * 組織関連バリデーター
 */
import { body, param } from 'express-validator';
import { SubscriptionType } from '../../types';

/**
 * 組織IDパラメータのバリデーションルール
 */
export const organizationIdParamValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('組織IDは必須です'),
];

/**
 * 組織情報更新時のバリデーションルール
 */
export const updateOrganizationValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('組織IDは必須です'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('組織名は1文字以上100文字以下である必要があります'),
];