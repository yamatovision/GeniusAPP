/**
 * adminConfig.routes.js
 * システム管理設定に関するルート定義
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middlewares/auth.middleware');
const adminConfigController = require('../controllers/adminConfig.controller');

// CSVアップロード用のmulter設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB制限
  },
  fileFilter: (req, file, cb) => {
    // CSVファイルのみ許可
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('CSVファイルのみアップロード可能です'), false);
    }
  }
});

// ヘッダー設定
router.use(function(req, res, next) {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, Content-Type, Accept"
  );
  next();
});

// システム設定を取得 (SuperAdmin専用)
router.get(
  "/admin/system-config",
  [authMiddleware.verifyToken],
  adminConfigController.getSystemConfig
);

// Admin APIキーを更新 (SuperAdmin専用)
router.post(
  "/admin/system-config/admin-api-key",
  [authMiddleware.verifyToken],
  adminConfigController.updateAdminApiKey
);

// システム説明を更新 (SuperAdmin専用)
router.post(
  "/admin/system-config/description",
  [authMiddleware.verifyToken],
  adminConfigController.updateSystemDescription
);

// Anthropicコンソール設定を更新 (SuperAdmin専用)
router.post(
  "/admin/system-config/anthropic-console",
  [authMiddleware.verifyToken],
  adminConfigController.updateAnthropicConsoleUrl
);

// Admin APIキーをチェック (SuperAdmin専用)
router.get(
  "/admin/system-config/check-api-key",
  [authMiddleware.verifyToken],
  adminConfigController.checkAdminApiKey
);

// CSV使用量データのインポート (SuperAdmin専用)
router.post(
  "/admin/organizations/:organizationId/import-usage-csv",
  [authMiddleware.verifyToken, authMiddleware.isSuperAdmin],
  upload.single('file'),
  adminConfigController.importCsvUsageData
);

module.exports = router;