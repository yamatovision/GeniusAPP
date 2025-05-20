/**
 * ユーザーコントローラー
 */
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as userService from './users.service';
import { sendSuccess, sendError, ErrorCodes } from '../../common/utils/response';

/**
 * 自組織ユーザー一覧を取得
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
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
    const organizationId = (req as any).user.organizationId;
    
    // クエリパラメータ
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const sort = req.query.sort as string | undefined;
    const search = req.query.search as string | undefined;
    
    // ユーザー一覧を取得
    const result = await userService.getOrganizationUsers(organizationId, {
      page,
      limit,
      sort,
      search,
    });
    
    // 結果を返す
    return sendSuccess(res, result.items, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    // エラーハンドリング
    console.error('ユーザー一覧取得エラー:', error);
    
    // エラーコードが付与されたエラーの場合
    if (error.code) {
      return sendError(res, error.message, error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, 'ユーザー一覧の取得中にエラーが発生しました', 500);
  }
};

/**
 * 特定ユーザーの情報を取得
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
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
    const userId = req.params.id;
    
    // ユーザー情報取得（組織情報も含める）
    const user = await userService.getUserById(userId, true);
    
    // 組織IDが一致するか確認（アクセス制御）
    if (user.organizationId.toString() !== requestUserOrgId) {
      return sendError(
        res,
        'このユーザー情報にアクセスする権限がありません',
        403,
        ErrorCodes.PERMISSION_DENIED
      );
    }
    
    // 結果を返す
    return sendSuccess(res, user);
  } catch (error: any) {
    // エラーハンドリング
    console.error('ユーザー情報取得エラー:', error);
    
    // エラーコードが付与されたエラーの場合
    if (error.code) {
      const statusCode = error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500;
      return sendError(res, error.message, statusCode, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, 'ユーザー情報の取得中にエラーが発生しました', 500);
  }
};

/**
 * ユーザー情報を更新
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
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

    // リクエストユーザーのIDを取得
    const requestUserId = (req as any).user.id;
    const userId = req.params.id;
    
    // 自分自身のみ更新可能
    if (userId !== requestUserId) {
      return sendError(
        res,
        'このユーザー情報を更新する権限がありません',
        403,
        ErrorCodes.PERMISSION_DENIED
      );
    }
    
    // 更新用データ
    const updateData = {
      name: req.body.name,
      email: req.body.email,
    };
    
    // ユーザー情報更新
    const updatedUser = await userService.updateUser(userId, updateData);
    
    // 結果を返す（更新されたフィールドのみ）
    const result = {
      id: updatedUser.id,
      updatedAt: updatedUser.updatedAt,
    };
    
    if (updateData.name !== undefined) {
      (result as any).name = updatedUser.name;
    }
    
    if (updateData.email !== undefined) {
      (result as any).email = updatedUser.email;
    }
    
    return sendSuccess(res, result);
  } catch (error: any) {
    // エラーハンドリング
    console.error('ユーザー情報更新エラー:', error);
    
    // メールアドレス重複エラー
    if (error.code === ErrorCodes.RESOURCE_ALREADY_EXISTS) {
      return sendError(res, 'このメールアドレスは既に使用されています', 409, 'DUPLICATE_EMAIL');
    }
    
    // その他のエラーコードが付与されたエラーの場合
    if (error.code) {
      const statusCode = error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500;
      return sendError(res, error.message, statusCode, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, 'ユーザー情報の更新中にエラーが発生しました', 500);
  }
};

/**
 * 自身のプロフィールを取得
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // リクエストユーザーのIDを取得
    const userId = (req as any).user.id;
    
    // ユーザー情報取得（組織情報も含める）
    const user = await userService.getUserById(userId, true);
    
    // 結果を返す
    return sendSuccess(res, user);
  } catch (error: any) {
    // エラーハンドリング
    console.error('プロフィール取得エラー:', error);
    
    // エラーコードが付与されたエラーの場合
    if (error.code) {
      const statusCode = error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500;
      return sendError(res, error.message, statusCode, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, 'プロフィールの取得中にエラーが発生しました', 500);
  }
};

/**
 * 自身のプロフィールを更新
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
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

    // リクエストユーザーのIDを取得
    const userId = (req as any).user.id;
    
    // 更新用データ
    const updateData = {
      name: req.body.name,
      email: req.body.email,
      preferences: req.body.preferences,
    };
    
    // プロフィール更新
    const updatedUser = await userService.updateUserProfile(userId, updateData);
    
    // 結果を返す（更新されたフィールドのみ）
    const result = {
      id: updatedUser.id,
      updatedAt: updatedUser.updatedAt,
    };
    
    if (updateData.name !== undefined) {
      (result as any).name = updatedUser.name;
    }
    
    if (updateData.email !== undefined) {
      (result as any).email = updatedUser.email;
    }
    
    if (updateData.preferences !== undefined) {
      (result as any).preferences = updateData.preferences;
    }
    
    return sendSuccess(res, result);
  } catch (error: any) {
    // エラーハンドリング
    console.error('プロフィール更新エラー:', error);
    
    // メールアドレス重複エラー
    if (error.code === ErrorCodes.RESOURCE_ALREADY_EXISTS) {
      return sendError(res, 'このメールアドレスは既に使用されています', 409, 'DUPLICATE_EMAIL');
    }
    
    // その他のエラーコードが付与されたエラーの場合
    if (error.code) {
      const statusCode = error.code === ErrorCodes.RESOURCE_NOT_FOUND ? 404 : 500;
      return sendError(res, error.message, statusCode, error.code, error.details);
    }
    
    // 一般的なエラー
    return sendError(res, 'プロフィールの更新中にエラーが発生しました', 500);
  }
};