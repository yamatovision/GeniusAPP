/**
 * 組織コントローラー
 */
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as organizationService from './organizations.service';
import { sendSuccess, sendError, ErrorCodes } from '../../common/utils/response';

/**
 * 組織情報を取得
 */
export const getOrganizationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // バリデーションエラーチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(
        res,
        '入力データが不正です',
        422,
        ErrorCodes.VALIDATION_ERROR,
        errors.mapped()
      );
    }

    // リクエストユーザーから組織IDを取得
    const requestUserOrgId = (req as any).user.organizationId;
    const organizationId = req.params.id;
    
    // 自分の所属組織のみアクセス可能
    if (organizationId !== requestUserOrgId) {
      return sendError(
        res,
        'この組織情報にアクセスする権限がありません',
        403,
        ErrorCodes.PERMISSION_DENIED
      );
    }
    
    // 組織情報取得（統計情報も含める）
    const organization = await organizationService.getOrganizationById(organizationId, true);
    
    // 結果を返す
    return sendSuccess(res, organization);
  } catch (error: any) {
    // エラーハンドリング
    console.error('組織情報取得エラー:', error);
    
    // エラーコードが付与されたエラーの場合
    if (error.code) {
      const statusCode = error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500;
      return sendError(res, error.message, statusCode, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, '組織情報の取得中にエラーが発生しました', 500);
  }
};

/**
 * 組織情報を更新
 */
export const updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // バリデーションエラーチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(
        res,
        '入力データが不正です',
        422,
        ErrorCodes.VALIDATION_ERROR,
        errors.mapped()
      );
    }

    // リクエストユーザーから組織IDを取得
    const requestUserOrgId = (req as any).user.organizationId;
    const organizationId = req.params.id;
    
    // 自分の所属組織のみ更新可能
    if (organizationId !== requestUserOrgId) {
      return sendError(
        res,
        'この組織情報を更新する権限がありません',
        403,
        ErrorCodes.PERMISSION_DENIED
      );
    }
    
    // 更新用データ
    const updateData = {
      name: req.body.name,
    };
    
    // 組織情報更新
    const updatedOrganization = await organizationService.updateOrganization(organizationId, updateData);
    
    // 結果を返す（更新されたフィールドのみ）
    const result = {
      id: updatedOrganization.id,
      updatedAt: updatedOrganization.updatedAt,
    };
    
    if (updateData.name !== undefined) {
      (result as any).name = updatedOrganization.name;
    }
    
    return sendSuccess(res, result);
  } catch (error: any) {
    // エラーハンドリング
    console.error('組織情報更新エラー:', error);
    
    // 組織名重複エラー
    if (error.code === ErrorCodes.RESOURCE_ALREADY_EXISTS) {
      return sendError(res, 'この組織名は既に使用されています', 409, 'DUPLICATE_NAME');
    }
    
    // その他のエラーコードが付与されたエラーの場合
    if (error.code) {
      const statusCode = error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500;
      return sendError(res, error.message, statusCode, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, '組織情報の更新中にエラーが発生しました', 500);
  }
};