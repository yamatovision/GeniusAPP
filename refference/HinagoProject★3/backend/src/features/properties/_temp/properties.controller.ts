/**
 * 物件コントローラー
 * 物件関連のAPI制御を担当
 */
import { Request, Response } from 'express';
import { RequestWithUser } from '../../types';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import propertyService from '../properties.service';
import historyService from '../history.service';
import { PropertyCreateData, PropertyUpdateData, Point } from '../../types';
import { sendSuccess, sendError, ApiResponse } from '../../common/utils/response';
import logger from '../../common/utils/logger';

// createResponse 関数の定義
const createResponse = <T>(
  success: boolean,
  data?: T,
  error?: {
    code: string;
    message: string;
    details?: any;
  },
  meta?: any
): ApiResponse<T> => {
  const response: ApiResponse<T> = {
    success
  };

  if (data !== undefined && data !== null) {
    response.data = data;
  }

  if (error) {
    response.error = error;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};

// アップロードファイルの一時保存先
const uploadDir = path.join(__dirname, '../../../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
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
  fileFilter: (_req, file, cb) => {
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
    // バリデーションエラーのチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: errors.array()
      }));
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
    });
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, properties, null, meta));
  } catch (error) {
    logger.error('Error in getProperties controller:', error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(400).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: errors.array()
      }));
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
      return res.status(404).json(createResponse(false, null, {
        code: 'RESOURCE_NOT_FOUND',
        message: '指定された物件が見つかりません'
      }));
    }
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, property));
  } catch (error) {
    logger.error(`Error in getPropertyById controller for property ${req.params.id}:`, error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(422).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: '入力データが不正です',
        details: errors.array()
      }));
    }
    
    const propertyData: PropertyCreateData = req.body;
    const organizationId = req.user!.organizationId;
    const userId = req.user!.id;
    
    // 物件を作成
    const property = await propertyService.createProperty(propertyData, organizationId, userId);
    
    // レスポンス返却
    return res.status(201).json(createResponse(true, property));
  } catch (error) {
    logger.error('Error in createProperty controller:', error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(422).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: '入力データが不正です',
        details: errors.array()
      }));
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
      return res.status(404).json(createResponse(false, null, {
        code: 'RESOURCE_NOT_FOUND',
        message: '指定された物件が見つかりません'
      }));
    }
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, property));
  } catch (error) {
    logger.error(`Error in updateProperty controller for property ${req.params.id}:`, error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(422).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: '入力データが不正です',
        details: errors.array()
      }));
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
      return res.status(404).json(createResponse(false, null, {
        code: 'RESOURCE_NOT_FOUND',
        message: '指定された物件が見つかりません'
      }));
    }
    
    // 更新されたフィールドのみを含むレスポンス
    const response = {
      id: property._id,
      ...propertyData,
      updatedAt: property.updatedAt
    };
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, response));
  } catch (error) {
    logger.error(`Error in patchProperty controller for property ${req.params.id}:`, error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(400).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: errors.array()
      }));
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
      return res.status(404).json(createResponse(false, null, {
        code: 'RESOURCE_NOT_FOUND',
        message: '指定された物件が見つかりません'
      }));
    }
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, {
      id: propertyId,
      deleted: true
    }));
  } catch (error) {
    logger.error(`Error in deleteProperty controller for property ${req.params.id}:`, error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(422).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: '入力データが不正です',
        details: errors.array()
      }));
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
      return res.status(404).json(createResponse(false, null, {
        code: 'RESOURCE_NOT_FOUND',
        message: '指定された物件が見つかりません'
      }));
    }
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, {
      id: property._id,
      shapeData: property.shapeData,
      updatedAt: property.updatedAt
    }));
  } catch (error) {
    logger.error(`Error in updatePropertyShape controller for property ${req.params.id}:`, error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
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
      return res.status(400).json(createResponse(false, null, {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: errors.array()
      }));
    }
    
    const propertyId = req.params.id;
    const organizationId = req.user!.organizationId;
    
    // 物件が存在し、自組織のものかを確認
    const property = await propertyService.getPropertyById(propertyId, organizationId, {});
    
    if (!property) {
      return res.status(404).json(createResponse(false, null, {
        code: 'RESOURCE_NOT_FOUND',
        message: '指定された物件が見つかりません'
      }));
    }
    
    // クエリパラメータを取得
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const action = req.query.action as string | undefined;
    
    // 履歴を取得
    const { history, meta } = await historyService.getPropertyHistory(propertyId, {
      page,
      limit,
      action
    });
    
    // レスポンス返却
    return res.status(200).json(createResponse(true, history, null, meta));
  } catch (error) {
    logger.error(`Error in getPropertyHistory controller for property ${req.params.id}:`, error);
    return res.status(500).json(createResponse(false, null, {
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }));
  }
};