/**
 * 物件関連ルート
 */
import { Router } from 'express';
import { validate } from '../../common/middlewares';
import * as propertyController from './properties.controller';
import { 
  testEndpoint, 
  testPropertiesList,
  testPropertyDetail,
  testCreateProperty,
  testUpdateProperty,
  testDeleteProperty,
  testUpdateShape,
  testGetHistory
} from './test-controller';
import {
  getPropertiesValidator,
  getPropertyValidator,
  createPropertyValidator,
  updatePropertyValidator,
  patchPropertyValidator,
  deletePropertyValidator,
  updatePropertyShapeValidator,
  getPropertyHistoryValidator,
  uploadSurveyValidator
} from './properties.validator';

// ルーターの初期化
const router = Router();

/**
 * 簡易テストエンドポイント
 * GET /api/properties/test
 */
router.get(
  '/test',
  testEndpoint
);

/**
 * 物件一覧の取得
 * GET /api/properties
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.get(
  '/',
  testPropertiesList
  // getPropertiesValidator,
  // validate,
  // propertyController.getProperties
);

/**
 * 新規物件の作成
 * POST /api/properties
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.post(
  '/',
  createPropertyValidator,
  validate,
  testCreateProperty
  // propertyController.createProperty
);

/**
 * 物件詳細の取得
 * GET /api/properties/:id
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.get(
  '/:id',
  getPropertyValidator,
  validate,
  testPropertyDetail
  // propertyController.getPropertyById
);

/**
 * 物件の更新
 * PUT /api/properties/:id
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.put(
  '/:id',
  updatePropertyValidator,
  validate,
  testUpdateProperty
  // propertyController.updateProperty
);

/**
 * 物件の部分更新
 * PATCH /api/properties/:id
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.patch(
  '/:id',
  patchPropertyValidator,
  validate,
  testUpdateProperty
  // propertyController.patchProperty
);

/**
 * 物件の削除
 * DELETE /api/properties/:id
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.delete(
  '/:id',
  deletePropertyValidator,
  validate,
  testDeleteProperty
  // propertyController.deleteProperty
);

/**
 * 敷地形状の更新
 * PUT /api/properties/:id/shape
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.put(
  '/:id/shape',
  updatePropertyShapeValidator,
  validate,
  testUpdateShape
  // propertyController.updatePropertyShape
);

/**
 * 物件履歴の取得
 * GET /api/properties/:id/history
 * 
 * 注意: テスト用に通常コントローラーではなくテスト用コントローラーを使用
 */
router.get(
  '/:id/history',
  getPropertyHistoryValidator,
  validate,
  testGetHistory
  // propertyController.getPropertyHistory
);

/**
 * 測量図のアップロード
 * POST /api/properties/upload-survey
 */
router.post(
  '/upload-survey',
  propertyController.upload.single('file'),
  uploadSurveyValidator,
  validate,
  // 実装予定: propertyController.uploadSurvey
);

export default router;