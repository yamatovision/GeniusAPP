/**
 * バリデーションミドルウェア
 */
import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { sendError, ErrorCodes } from '../utils/response';

/**
 * express-validatorを使用したバリデーションミドルウェア
 * @param validations バリデーションルールの配列
 * @returns バリデーションミドルウェア
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // すべてのバリデーションルールを実行
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // バリデーション結果を取得
    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }
    
    // バリデーションエラーがある場合
    const formattedErrors: { [key: string]: string } = {};
    
    errors.array().forEach(error => {
      if (error.type === 'field') {
        formattedErrors[error.path] = error.msg;
      }
    });
    
    return sendError(
      res,
      '入力データが不正です',
      422,
      ErrorCodes.VALIDATION_ERROR,
      formattedErrors
    );
  };
};