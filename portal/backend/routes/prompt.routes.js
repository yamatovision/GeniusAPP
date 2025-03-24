const express = require('express');
const router = express.Router();
const promptController = require('../controllers/prompt.controller');
// 標準認証ミドルウェアを削除し、シンプル認証ミドルウェアを使用
// const authMiddleware = require('../middlewares/auth.middleware');
const simpleAuthMiddleware = require('../middlewares/simple-auth.middleware');
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
// 簡略化されたプロンプト権限チェックミドルウェア
// ====================================

// プロンプト読み込み関数（シンプル版）
const loadPrompt = async (id) => {
  return await Prompt.findById(id).populate('ownerId', 'name email');
};

// シンプル版の権限チェック - すべてのアクセスを許可
const checkViewAccess = async (req, res, next) => {
  try {
    const prompt = await loadPrompt(req.params.id);
    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: 'プロンプトが見つかりません'
      });
    }
    
    // プロンプトをリクエストに追加して次へ
    req.resource = prompt;
    next();
  } catch (error) {
    console.error('プロンプト読み込みエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

// 編集権限と管理権限も同様に簡略化（シンプル認証ではより単純な権限モデルを使用）
const checkEditAccess = checkViewAccess;
const checkManageAccess = checkViewAccess;

// 統計閲覧権限の定義は削除 - 使用統計機能は廃止済み

// ====================================
// ルート定義
// ====================================

// 公開プロンプト取得（認証不要）
router.get('/public/:token', promptController.getPublicPrompt);

// 認証必須のルートにシンプル認証ミドルウェアを適用
router.use(simpleAuthMiddleware.verifySimpleToken);

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

// プロンプト使用記録API（閲覧権限） - 後方互換性のために維持
router.post('/:id/usage', checkViewAccess, promptController.recordPromptUsage);

// プロンプト複製（閲覧権限）
router.post('/:id/clone', checkViewAccess, promptController.clonePrompt);

// 共有リンク生成（管理権限）
router.post('/:id/share', checkManageAccess, promptController.createShareLink);

module.exports = router;