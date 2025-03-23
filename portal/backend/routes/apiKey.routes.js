const express = require('express');
const apiKeyController = require('../controllers/apiKey.controller');
const { verifyToken, isAdmin, isSuperAdmin } = require('../middlewares/auth.middleware');
const router = express.Router();

/**
 * APIキー管理ルート
 * 組織のAPIキープール管理とユーザーへの割り当て機能を提供
 */

// APIキープール管理API（SuperAdmin用）
router.post('/organizations/:id/api-keys/pool', [verifyToken, isSuperAdmin], apiKeyController.addApiKeyToPool);
router.get('/organizations/:id/api-keys/pool', [verifyToken], apiKeyController.getApiKeyPool);
router.delete('/organizations/:id/api-keys/pool/:keyId', [verifyToken, isSuperAdmin], apiKeyController.removeApiKeyFromPool);

// CSVインポート機能
router.post('/organizations/:id/api-keys/import', [verifyToken, isSuperAdmin], apiKeyController.importApiKeysFromCSV);

// 一括割り当て機能
router.post('/organizations/:id/api-keys/assign-bulk', [verifyToken], apiKeyController.bulkAssignApiKeys);

// ユーザーAPIキー管理API
router.get('/organizations/:id/api-keys/usage', [verifyToken], apiKeyController.getUsersApiKeyUsage);
router.patch('/organizations/:id/users/:userId/api-key', [verifyToken], apiKeyController.updateUserApiKeyStatus);
router.post('/organizations/:id/users/:userId/reassign-key', [verifyToken], apiKeyController.reassignUserApiKey);
router.get('/users/:userId/api-key/details', [verifyToken], apiKeyController.getUserApiKeyDetails);

module.exports = router;