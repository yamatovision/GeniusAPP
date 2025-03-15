const express = require('express');
const router = express.Router();
const promptController = require('../controllers/prompt.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * プロンプト関連のAPI定義
 */

// 認証必須のルートにミドルウェアを適用
router.use(authMiddleware.verifyToken);

// プロンプト一覧取得
router.get('/', promptController.getAllPrompts);

// 新規プロンプト作成
router.post('/', promptController.createPrompt);

// プロンプト詳細取得
router.get('/:id', promptController.getPromptById);

// プロンプト更新
router.put('/:id', promptController.updatePrompt);

// プロンプト削除
router.delete('/:id', promptController.deletePrompt);

// プロンプトバージョン一覧取得
router.get('/:id/versions', promptController.getPromptVersions);

// プロンプト新バージョン作成
router.post('/:id/versions', promptController.createPromptVersion);

// プロンプトバージョン詳細取得
router.get('/:id/versions/:versionId', promptController.getPromptVersionById);

// プロンプト使用統計取得
router.get('/:id/stats', promptController.getPromptUsageStats);

// プロンプト使用記録
router.post('/:id/usage', promptController.recordPromptUsage);

// ユーザーフィードバック登録
router.post('/usage/:usageId/feedback', promptController.recordUserFeedback);

module.exports = router;