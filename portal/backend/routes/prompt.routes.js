const express = require('express');
const router = express.Router();
const promptController = require('../controllers/prompt.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * プロンプト関連のAPI定義
 */

// 公開プロンプト取得（認証不要）
router.get('/public/:token', promptController.getPublicPrompt);

// 認証必須のルートにミドルウェアを適用
router.use(authMiddleware.verifyToken);

// カテゴリーとタグのメタデータ取得
router.get('/metadata/categories-tags', promptController.getCategoriesAndTags);

// VSCode拡張用のプロンプト内容を取得するエンドポイント
router.get('/:id/content', promptController.getPromptContent);

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

// プロンプト複製
router.post('/:id/clone', promptController.clonePrompt);

// 共有リンク生成
router.post('/:id/share', promptController.createShareLink);

module.exports = router;