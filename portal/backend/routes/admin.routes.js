/**
 * 管理者用APIルート定義
 */
const express = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// すべてのルートで認証と管理者権限チェックを必須にする
router.use(authMiddleware.verifyToken);
router.use(authMiddleware.isAdmin);

// 管理者ダッシュボード統計を取得
router.get('/dashboard', adminController.getAdminDashboardStats);

// 全ての組織を取得
router.get('/organizations', adminController.getAllOrganizations);

// 全てのワークスペースを取得
router.get('/workspaces', adminController.getAllWorkspaces);

// 全ての使用状況を取得
router.get('/usage', adminController.getAllUsageStats);

// 全てのAPIキー情報を取得
router.get('/api-keys', adminController.getAllApiKeys);

// APIキーの状態を更新
router.put('/api-keys/:organizationId/:apiKeyId', adminController.updateApiKeyStatus);

module.exports = router;