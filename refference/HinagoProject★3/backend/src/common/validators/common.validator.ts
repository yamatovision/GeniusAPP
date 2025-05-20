/**
 * 共通バリデーションルール
 */
import { body, param, query } from 'express-validator';

// ID パラメータのバリデーション
export const validateId = (fieldName = 'id') => {
  return param(fieldName)
    .isString()
    .trim()
    .notEmpty()
    .withMessage('IDは必須です')
    .isLength({ min: 24, max: 24 })
    .withMessage('IDは24文字でなければなりません');
};

// ページネーションクエリパラメータのバリデーション
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ページ番号は1以上の整数でなければなりません')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('1ページあたりの結果数は1から100の間でなければなりません')
    .toInt(),
];

// メールアドレスのバリデーション
export const validateEmail = (fieldName = 'email') => {
  return body(fieldName)
    .isEmail()
    .withMessage('有効なメールアドレスを入力してください')
    .normalizeEmail()
    .trim();
};

// パスワードのバリデーション
export const validatePassword = (fieldName = 'password') => {
  return body(fieldName)
    .isLength({ min: 8 })
    .withMessage('パスワードは8文字以上である必要があります')
    .matches(/[a-zA-Z]/).withMessage('パスワードは少なくとも1つのアルファベットを含む必要があります');
    // 数字チェックは削除しました
};

// 文字列の必須チェック
export const validateRequiredString = (fieldName: string, options?: { min?: number; max?: number }) => {
  let validator = body(fieldName)
    .isString()
    .withMessage(`${fieldName}は文字列である必要があります`)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName}は必須です`);

  if (options?.min !== undefined) {
    validator = validator.isLength({ min: options.min }).withMessage(`${fieldName}は${options.min}文字以上である必要があります`);
  }

  if (options?.max !== undefined) {
    validator = validator.isLength({ max: options.max }).withMessage(`${fieldName}は${options.max}文字以下である必要があります`);
  }

  return validator;
};

// 文字列の任意チェック
export const validateOptionalString = (fieldName: string, options?: { min?: number; max?: number }) => {
  let validator = body(fieldName)
    .optional()
    .isString()
    .withMessage(`${fieldName}は文字列である必要があります`)
    .trim();

  if (options?.min !== undefined) {
    validator = validator.isLength({ min: options.min }).withMessage(`${fieldName}は${options.min}文字以上である必要があります`);
  }

  if (options?.max !== undefined) {
    validator = validator.isLength({ max: options.max }).withMessage(`${fieldName}は${options.max}文字以下である必要があります`);
  }

  return validator;
};

// 数値の必須チェック
export const validateRequiredNumber = (fieldName: string, options?: { min?: number; max?: number }) => {
  let validator = body(fieldName)
    .isNumeric()
    .withMessage(`${fieldName}は数値である必要があります`)
    .toFloat();

  if (options?.min !== undefined) {
    validator = validator.isFloat({ min: options.min }).withMessage(`${fieldName}は${options.min}以上である必要があります`);
  }

  if (options?.max !== undefined) {
    validator = validator.isFloat({ max: options.max }).withMessage(`${fieldName}は${options.max}以下である必要があります`);
  }

  return validator;
};

// 数値の任意チェック
export const validateOptionalNumber = (fieldName: string, options?: { min?: number; max?: number }) => {
  let validator = body(fieldName)
    .optional()
    .isNumeric()
    .withMessage(`${fieldName}は数値である必要があります`)
    .toFloat();

  if (options?.min !== undefined) {
    validator = validator.isFloat({ min: options.min }).withMessage(`${fieldName}は${options.min}以上である必要があります`);
  }

  if (options?.max !== undefined) {
    validator = validator.isFloat({ max: options.max }).withMessage(`${fieldName}は${options.max}以下である必要があります`);
  }

  return validator;
};