/**
 * 物件コントローラー
 * 物件関連のAPI制御を担当
 */
import { Response } from 'express';
import { RequestWithUser } from '../../types';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import propertyService from './properties.service';
import historyService from './history.service';
import { PropertyCreateData, PropertyUpdateData, Point, HistoryAction } from '../../types';
import { sendSuccess, sendError } from '../../common/utils/response';
import logger from '../../common/utils/logger';

// アップロードファイルの一時保存先
const uploadDir = path.join(__dirname, '../../../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDir);
  },
  filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

// アップロードミドルウェア
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB上限
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // 許可するファイル形式
    const allowedTypes = [
      'application/pdf',
      'application/dxf',
      'application/acad',
      'application/x-dxf',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('サポートされていないファイル形式です'));
    }
  }
});

/**
 * 物件一覧を取得
 */
export const getProperties = async (req: RequestWithUser, res: Response) => {
  try {
    console.log('getProperties コントローラーが呼ばれました');
    
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('バリデーションエラー:', errors.array());
      return sendError(res, 'バリデーションエラー', 400, 'VALIDATION_ERROR', errors.array());
    }
    
    // クエリパラメータを取得
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const name = req.query.name as string;
    const address = req.query.address as string;
    const areaMin = req.query.area_min ? parseFloat(req.query.area_min as string) : undefined;
    const areaMax = req.query.area_max ? parseFloat(req.query.area_max as string) : undefined;
    const zoneType = req.query.zoneType as string;
    const status = req.query.status as string;
    const sort = req.query.sort as string;
    const fields = req.query.fields as string;
    const expand = req.query.expand as string;
    
    // 認証済みユーザーから組織IDを取得
    const organizationId = req.user!.organizationId;
    console.log('認証済みユーザー情報:', {
      userId: req.user!.id,
      organizationId: organizationId
    });
    
    // 応答タイムアウト設定
    const timeoutMs = 5000; // 5秒
    
    // タイムアウト処理
    const responseTimeout = setTimeout(() => {
      console.warn('物件一覧取得タイムアウト - 空の結果を返します');
      return sendSuccess(res, [], 200, {
        total: 0,
        page: page || 1,
        limit: limit || 20,
        totalPages: 0,
        timeout: true
      });
    }, timeoutMs);
    
    // 物件一覧を取得
    const { properties, meta } = await propertyService.getProperties(organizationId, {
      page,
      limit,
      name,
      address,
      area: areaMin || areaMax ? { min: areaMin, max: areaMax } : undefined,
      zoneType,
      status,
      sort,
      fields,
      expand
    } as any);
    
    // タイムアウトをクリア
    clearTimeout(responseTimeout);
    
    // レスポンス返却
    return sendSuccess(res, properties, 200, meta);
  } catch (error) {
    console.error('getProperties コントローラーエラー:', error);
    logger.error('Error in getProperties controller:', error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 物件詳細を取得
 */
export const getPropertyById = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'バリデーションエラー', 400, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyId = req.params.id;
    const organizationId = req.user!.organizationId;
    const fields = req.query.fields as string;
    const expand = req.query.expand as string;
    
    // 物件詳細を取得
    const property = await propertyService.getPropertyById(propertyId, organizationId, {
      fields,
      expand
    });
    
    if (!property) {
      return sendError(res, '指定された物件が見つかりません', 404, 'RESOURCE_NOT_FOUND');
    }
    
    // レスポンス返却
    return sendSuccess(res, property);
  } catch (error) {
    logger.error(`Error in getPropertyById controller for property ${req.params.id}:`, error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 新規物件を作成
 */
export const createProperty = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, '入力データが不正です', 422, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyData: PropertyCreateData = req.body;
    const organizationId = req.user!.organizationId;
    const userId = req.user!.id;
    
    // 物件を作成
    const property = await propertyService.createProperty(propertyData, organizationId, userId);
    
    // レスポンス返却
    return sendSuccess(res, property, 201);
  } catch (error) {
    logger.error('Error in createProperty controller:', error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 物件を更新
 */
export const updateProperty = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, '入力データが不正です', 422, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyId = req.params.id;
    const propertyData: PropertyUpdateData = req.body;
    const organizationId = req.user!.organizationId;
    const userId = req.user!.id;
    
    // 物件を更新
    const property = await propertyService.updateProperty(
      propertyId,
      propertyData,
      organizationId,
      userId
    );
    
    if (!property) {
      return sendError(res, '指定された物件が見つかりません', 404, 'RESOURCE_NOT_FOUND');
    }
    
    // レスポンス返却
    return sendSuccess(res, property);
  } catch (error) {
    logger.error(`Error in updateProperty controller for property ${req.params.id}:`, error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 物件を部分更新
 */
export const patchProperty = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, '入力データが不正です', 422, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyId = req.params.id;
    const propertyData: Partial<PropertyUpdateData> = req.body;
    const organizationId = req.user!.organizationId;
    const userId = req.user!.id;
    
    // 物件を部分更新
    const property = await propertyService.patchProperty(
      propertyId,
      propertyData,
      organizationId,
      userId
    );
    
    if (!property) {
      return sendError(res, '指定された物件が見つかりません', 404, 'RESOURCE_NOT_FOUND');
    }
    
    // 更新されたフィールドのみを含むレスポンス
    const response = {
      id: property._id,
      ...propertyData,
      updatedAt: property.updatedAt
    };
    
    // レスポンス返却
    return sendSuccess(res, response);
  } catch (error) {
    logger.error(`Error in patchProperty controller for property ${req.params.id}:`, error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 物件を削除
 */
export const deleteProperty = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'バリデーションエラー', 400, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyId = req.params.id;
    const organizationId = req.user!.organizationId;
    const userId = req.user!.id;
    
    // 物件を削除
    const isDeleted = await propertyService.deleteProperty(
      propertyId,
      organizationId,
      userId
    );
    
    if (!isDeleted) {
      return sendError(res, '指定された物件が見つかりません', 404, 'RESOURCE_NOT_FOUND');
    }
    
    // レスポンス返却
    return sendSuccess(res, {
      id: propertyId,
      deleted: true
    });
  } catch (error) {
    logger.error(`Error in deleteProperty controller for property ${req.params.id}:`, error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 敷地形状を更新
 */
export const updatePropertyShape = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, '入力データが不正です', 422, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyId = req.params.id;
    const shapeData: { points: Point[], width?: number, depth?: number, sourceFile?: string } = req.body;
    const organizationId = req.user!.organizationId;
    const userId = req.user!.id;
    
    // 敷地形状を更新
    const property = await propertyService.updatePropertyShape(
      propertyId,
      shapeData,
      organizationId,
      userId
    );
    
    if (!property) {
      return sendError(res, '指定された物件が見つかりません', 404, 'RESOURCE_NOT_FOUND');
    }
    
    // レスポンス返却
    return sendSuccess(res, {
      id: property._id,
      shapeData: property.shapeData,
      updatedAt: property.updatedAt
    });
  } catch (error) {
    logger.error(`Error in updatePropertyShape controller for property ${req.params.id}:`, error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};

/**
 * 物件履歴を取得
 */
export const getPropertyHistory = async (req: RequestWithUser, res: Response) => {
  try {
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'バリデーションエラー', 400, 'VALIDATION_ERROR', errors.array());
    }
    
    const propertyId = req.params.id;
    const organizationId = req.user!.organizationId;
    
    // 物件が存在し、自組織のものかを確認
    const property = await propertyService.getPropertyById(propertyId, organizationId, {});
    
    if (!property) {
      return sendError(res, '指定された物件が見つかりません', 404, 'RESOURCE_NOT_FOUND');
    }
    
    // クエリパラメータを取得
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const actionParam = req.query.action as string | undefined;
    
    // actionパラメータをHistoryActionに変換
    let action: HistoryAction | undefined;
    if (actionParam) {
      if (Object.values(HistoryAction).includes(actionParam as HistoryAction)) {
        action = actionParam as HistoryAction;
      }
    }
    
    // 履歴を取得
    const { history, meta } = await historyService.getPropertyHistory(propertyId, {
      page,
      limit,
      action
    });
    
    // レスポンス返却
    return sendSuccess(res, history, 200, meta);
  } catch (error) {
    logger.error(`Error in getPropertyHistory controller for property ${req.params.id}:`, error);
    return sendError(res, 'サーバーエラーが発生しました', 500, 'SERVER_ERROR');
  }
};