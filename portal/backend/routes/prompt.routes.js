const express = require('express');
const router = express.Router();
const promptController = require('../controllers/prompt.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const Prompt = require('../models/prompt.model');

/**
 * プロンプト関連のAPI定義
 * 権限チェックについての考え方:
 * 
 * 1. 管理者は常にすべての操作が可能
 * 2. 所有者は自分のプロンプトに対してすべての操作が可能
 * 3. 公開プロンプトは全ユーザーが閲覧可能
 * 4. プロジェクトメンバーはプロジェクト内のプロンプトを閲覧可能
 * 5. プロジェクト編集者はプロジェクト内のプロンプトを編集可能
 * 6. プロジェクト管理者（owner）はプロジェクト内の全ての操作が可能
 */

// ====================================
// プロンプト権限チェックミドルウェア
// ====================================

// プロンプト読み込み関数（権限チェックミドルウェアで使用）
const loadPrompt = async (id) => {
  return await Prompt.findById(id).populate('ownerId', 'name email');
};

// 閲覧権限チェック（所有者/管理者/公開/プロジェクトメンバー可）
const checkViewAccess = authMiddleware.checkAccess({
  resourceType: 'プロンプト',
  checkPublic: true,
  checkProjectMember: true,
  resourceLoader: loadPrompt,
  errorMessage: 'このプロンプトを閲覧する権限がありません'
});

// 編集権限チェック（所有者/管理者/プロジェクト編集者可）
const checkEditAccess = authMiddleware.checkAccess({
  resourceType: 'プロンプト',
  checkProjectEditor: true,
  resourceLoader: loadPrompt,
  errorMessage: 'このプロンプトを編集する権限がありません'
});

// 管理権限チェック（所有者/管理者のみ可）
const checkManageAccess = authMiddleware.checkAccess({
  resourceType: 'プロンプト',
  resourceLoader: loadPrompt,
  errorMessage: 'このプロンプトを管理する権限がありません'
});

// 統計閲覧権限チェック（所有者/管理者/プロジェクト管理者可）
const checkStatsAccess = authMiddleware.checkAccess({
  resourceType: 'プロンプト',
  checkProjectAdmin: true,
  resourceLoader: loadPrompt,
  errorMessage: 'このプロンプトの使用統計を閲覧する権限がありません'
});

// ====================================
// ルート定義
// ====================================

// 公開プロンプト取得（認証不要）
router.get('/public/:token', promptController.getPublicPrompt);

// 認証必須のルートにミドルウェアを適用
router.use(authMiddleware.verifyToken);

// カテゴリーとタグのメタデータ取得（認証のみ）
router.get('/metadata/categories-tags', promptController.getCategoriesAndTags);

// プロンプト一覧取得（認証のみ）
router.get('/', promptController.getAllPrompts);

// 新規プロンプト作成（認証のみ）
router.post('/', promptController.createPrompt);

// プロンプト詳細取得（閲覧権限）
router.get('/:id', checkViewAccess, (req, res) => {
  // リソースは req.resource として利用可能
  res.json(req.resource);
});

// VSCode拡張用のプロンプト内容を取得（閲覧権限）
router.get('/:id/content', checkViewAccess, promptController.getPromptContent);

// プロンプト更新（編集権限）
router.put('/:id', checkEditAccess, promptController.updatePrompt);

// プロンプト削除（管理権限）
router.delete('/:id', checkManageAccess, promptController.deletePrompt);

// プロンプトバージョン一覧取得（閲覧権限）
router.get('/:id/versions', checkViewAccess, promptController.getPromptVersions);

// プロンプト新バージョン作成（編集権限）
router.post('/:id/versions', checkEditAccess, promptController.createPromptVersion);

// プロンプトバージョン詳細取得（閲覧権限）
router.get('/:id/versions/:versionId', checkViewAccess, promptController.getPromptVersionById);

// プロンプト使用統計取得（統計閲覧権限）
router.get('/:id/stats', checkStatsAccess, promptController.getPromptUsageStats);

// プロンプト使用記録（閲覧権限）
router.post('/:id/usage', checkViewAccess, promptController.recordPromptUsage);

// ユーザーフィードバック登録（認証のみ）
router.post('/usage/:usageId/feedback', promptController.recordUserFeedback);

// プロンプト複製（閲覧権限）
router.post('/:id/clone', checkViewAccess, promptController.clonePrompt);

// 共有リンク生成（管理権限）
router.post('/:id/share', checkManageAccess, promptController.createShareLink);

module.exports = router;