const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * プロジェクト関連のAPI定義
 */

// 認証必須のルートにミドルウェアを適用
router.use(authMiddleware.verifyToken);

// プロジェクト一覧取得
router.get('/', projectController.getAllProjects);

// 新規プロジェクト作成
router.post('/', projectController.createProject);

// プロジェクト詳細取得
router.get('/:id', projectController.getProjectById);

// プロジェクト更新
router.put('/:id', projectController.updateProject);

// プロジェクト削除
router.delete('/:id', projectController.deleteProject);

// プロジェクトメンバー一覧取得
router.get('/:id/members', projectController.getProjectMembers);

// プロジェクトメンバー追加
router.post('/:id/members', projectController.addProjectMember);

// プロジェクトメンバー役割更新
router.put('/:id/members/:userId', projectController.updateMemberRole);

// プロジェクトメンバー削除
router.delete('/:id/members/:userId', projectController.removeProjectMember);

// プロジェクト内のプロンプト一覧取得
router.get('/:id/prompts', projectController.getProjectPrompts);

module.exports = router;