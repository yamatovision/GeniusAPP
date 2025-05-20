/**
 * 物件関連バリデーション
 */
import { body, param, query } from 'express-validator';
import { ZoneType, FireZone, ShadowRegulation, PropertyStatus } from '../../types';

/**
 * 物件一覧取得バリデーション
 */
export const getPropertiesValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('ページ番号は1以上の整数である必要があります'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('1ページあたりの件数は1〜100の間である必要があります'),
  query('name').optional().isString().withMessage('物件名は文字列である必要があります'),
  query('address').optional().isString().withMessage('住所は文字列である必要があります'),
  query('area_min').optional().isFloat({ min: 0 }).withMessage('最小面積は0以上の数値である必要があります'),
  query('area_max').optional().isFloat({ min: 0 }).withMessage('最大面積は0以上の数値である必要があります'),
  query('zoneType').optional().isString().withMessage('用途地域は有効な文字列である必要があります'),
  query('status').optional().isString().withMessage('ステータスは有効な文字列である必要があります'),
  query('sort').optional().isString().withMessage('ソート条件は文字列である必要があります'),
  query('fields').optional().isString().withMessage('フィールド指定は文字列である必要があります'),
  query('expand').optional().isString().withMessage('展開指定は文字列である必要があります'),
];

/**
 * 物件詳細取得バリデーション
 */
export const getPropertyValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
  query('fields').optional().isString().withMessage('フィールド指定は文字列である必要があります'),
  query('expand').optional().isString().withMessage('展開指定は文字列である必要があります'),
];

/**
 * 物件作成バリデーション
 */
export const createPropertyValidator = [
  body('name').notEmpty().withMessage('物件名は必須です')
    .isLength({ max: 100 }).withMessage('物件名は100文字以内である必要があります'),
  
  body('address').notEmpty().withMessage('住所は必須です')
    .isLength({ max: 200 }).withMessage('住所は200文字以内である必要があります'),
  
  body('area').notEmpty().withMessage('敷地面積は必須です')
    .isFloat({ min: 0 }).withMessage('敷地面積は0より大きい数値である必要があります'),
  
  body('zoneType').notEmpty().withMessage('用途地域は必須です')
    .isIn(Object.values(ZoneType)).withMessage('有効な用途地域を選択してください'),
  
  body('fireZone').notEmpty().withMessage('防火地域区分は必須です')
    .isIn(Object.values(FireZone)).withMessage('有効な防火地域区分を選択してください'),
  
  body('shadowRegulation').optional()
    .isIn(Object.values(ShadowRegulation)).withMessage('有効な日影規制を選択してください'),
  
  body('buildingCoverage').notEmpty().withMessage('建蔽率は必須です')
    .isInt({ min: 0, max: 100 }).withMessage('建蔽率は0〜100の整数である必要があります'),
  
  body('floorAreaRatio').notEmpty().withMessage('容積率は必須です')
    .isInt({ min: 0, max: 1000 }).withMessage('容積率は0〜1000の整数である必要があります'),
  
  body('heightLimit').optional()
    .isFloat({ min: 0 }).withMessage('高さ制限は0より大きい数値である必要があります'),
  
  body('roadWidth').optional()
    .isFloat({ min: 0 }).withMessage('前面道路幅員は0より大きい数値である必要があります'),
  
  body('price').optional()
    .isInt({ min: 0 }).withMessage('想定取得価格は0以上の整数である必要があります'),
  
  body('status').optional()
    .isIn(Object.values(PropertyStatus)).withMessage('有効な物件ステータスを選択してください'),
  
  body('notes').optional()
    .isLength({ max: 1000 }).withMessage('備考・メモは1000文字以内である必要があります'),
  
  body('shapeData').optional(),
  body('shapeData.points').optional().isArray().withMessage('境界点座標は配列である必要があります'),
  body('shapeData.points.*.x').optional().isNumeric().withMessage('X座標は数値である必要があります'),
  body('shapeData.points.*.y').optional().isNumeric().withMessage('Y座標は数値である必要があります'),
  body('shapeData.width').optional().isFloat({ min: 0 }).withMessage('敷地間口は0より大きい数値である必要があります'),
  body('shapeData.depth').optional().isFloat({ min: 0 }).withMessage('敷地奥行は0より大きい数値である必要があります'),
];

/**
 * 物件更新バリデーション
 */
export const updatePropertyValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
  ...createPropertyValidator.map(validator => validator.optional()),  // 全フィールドをオプショナルに
];

/**
 * 物件部分更新バリデーション
 */
export const patchPropertyValidator = updatePropertyValidator;

/**
 * 物件削除バリデーション
 */
export const deletePropertyValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
];

/**
 * 敷地形状更新バリデーション
 */
export const updatePropertyShapeValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
  body('points').isArray({ min: 3 }).withMessage('敷地形状には少なくとも3つの点が必要です'),
  body('points.*.x').isNumeric().withMessage('X座標は数値である必要があります'),
  body('points.*.y').isNumeric().withMessage('Y座標は数値である必要があります'),
  body('width').optional().isFloat({ min: 0 }).withMessage('敷地間口は0より大きい数値である必要があります'),
  body('depth').optional().isFloat({ min: 0 }).withMessage('敷地奥行は0より大きい数値である必要があります'),
];

/**
 * 物件関連文書一覧取得バリデーション
 */
export const getPropertyDocumentsValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
  query('page').optional().isInt({ min: 1 }).withMessage('ページ番号は1以上の整数である必要があります'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('1ページあたりの件数は1〜100の間である必要があります'),
  query('documentType').optional().isString().withMessage('文書タイプは有効な文字列である必要があります'),
  query('sort').optional().isString().withMessage('ソート条件は文字列である必要があります'),
];

/**
 * 物件関連文書追加バリデーション
 */
export const addPropertyDocumentValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
  body('documentType').isString().withMessage('文書タイプは必須です'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('説明は500文字以内である必要があります'),
];

/**
 * 物件履歴取得バリデーション
 */
export const getPropertyHistoryValidator = [
  param('id').isMongoId().withMessage('有効な物件IDを指定してください'),
  query('page').optional().isInt({ min: 1 }).withMessage('ページ番号は1以上の整数である必要があります'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('1ページあたりの件数は1〜100の間である必要があります'),
  query('action').optional().isString().withMessage('アクションタイプは有効な文字列である必要があります'),
];

/**
 * 測量図アップロードバリデーション
 */
export const uploadSurveyValidator = [
  body('propertyId').optional().isMongoId().withMessage('有効な物件IDを指定してください'),
];