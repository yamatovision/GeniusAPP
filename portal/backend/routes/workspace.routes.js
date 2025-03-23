/**
 * ワークスペース関連のAPIルート定義
 */
const express = require('express');
const workspaceController = require('../controllers/workspace.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authMiddleware.verifyToken);

// 特定のワークスペースを取得
router.get('/:workspaceId', workspaceController.getWorkspace);

// ワークスペース情報を更新
router.put('/:workspaceId', workspaceController.updateWorkspace);

// ワークスペースをアーカイブ（論理削除）
router.delete('/:workspaceId', workspaceController.archiveWorkspace);

// ワークスペースメンバー一覧取得
router.get('/:workspaceId/members', workspaceController.getWorkspaceMembers);

// ワークスペースにメンバーを追加
router.post('/:workspaceId/members', workspaceController.addWorkspaceMember);

// ワークスペースメンバーの役割を更新
router.put('/:workspaceId/members/:memberId', workspaceController.updateWorkspaceMemberRole);

// ワークスペースからメンバーを削除
router.delete('/:workspaceId/members/:memberId', workspaceController.removeWorkspaceMember);

// ワークスペースの使用量統計を取得
router.get('/:workspaceId/usage', workspaceController.getWorkspaceUsage);

// ワークスペースのAPIキー情報を取得
router.get('/:workspaceId/api-key', workspaceController.getWorkspaceApiKey);

module.exports = router;