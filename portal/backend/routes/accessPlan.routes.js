/**
 * アクセスプラン管理ルート
 * APIアクセスレベルとプラン設定の管理API
 */
const express = require('express');
const router = express.Router();
const accessPlanController = require('../controllers/accessPlan.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// すべてのルートで認証チェック
router.use(authMiddleware.verifyToken);

// プラン一覧を取得（管理者向け）
router.get('/', accessPlanController.getAllPlans);

// プラン詳細を取得
router.get('/:id', accessPlanController.getPlan);

// プランを作成（管理者向け）
router.post('/', accessPlanController.createPlan);

// プランを更新（管理者向け）
router.put('/:id', accessPlanController.updatePlan);

// プランを削除（管理者向け）
router.delete('/:id', accessPlanController.deletePlan);

// デフォルトプランを初期化（管理者向け）
router.post('/initialize', accessPlanController.initializeDefaultPlans);

// ユーザーにプランを割り当て（管理者向け）
router.post('/users/:userId', accessPlanController.setUserPlan);

module.exports = router;