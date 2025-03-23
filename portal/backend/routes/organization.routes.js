/**
 * 組織関連のAPIルート定義
 */
const express = require('express');
const organizationController = require('../controllers/organization.controller');
const workspaceController = require('../controllers/workspace.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// すべてのルートで認証を必須にする
router.use(authMiddleware.verifyToken);

// 組織一覧取得
router.get('/', organizationController.getOrganizations);

// 組織の作成
router.post('/', organizationController.createOrganization);

// 特定の組織を取得
router.get('/:organizationId', organizationController.getOrganization);

// 組織情報を更新
router.put('/:organizationId', organizationController.updateOrganization);

// 組織をアーカイブ（論理削除）
router.post('/:organizationId/archive', organizationController.archiveOrganization);

// 組織を完全に削除（物理削除）
router.delete('/:organizationId', organizationController.deleteOrganization);

// 組織メンバー一覧取得
router.get('/:organizationId/members', organizationController.getOrganizationMembers);

// 組織にメンバーを追加
router.post('/:organizationId/members', organizationController.addOrganizationMember);

// 組織メンバーの役割を更新
router.put('/:organizationId/members/:memberId', organizationController.updateOrganizationMemberRole);

// 組織からメンバーを削除
router.delete('/:organizationId/members/:memberId', organizationController.removeOrganizationMember);

// 組織の使用量統計を取得
router.get('/:organizationId/usage', organizationController.getOrganizationUsage);

// Anthropicから組織の情報を同期
router.post('/:organizationId/sync', organizationController.syncWithAnthropic);

// 組織のAPIキー情報を取得
router.get('/:organizationId/api-keys', organizationController.getOrganizationApiKeys);

// 組織のAPIキー情報取得（単数形バージョンも提供）
router.get('/:organizationId/apikey', organizationController.getOrganizationApiKeys);

// 既存ユーザーを組織構造に移行する (管理者のみ)
router.post('/migrate-users', organizationController.migrateUsersToOrganizations);

// 組織のワークスペース関連ルート

// 組織のワークスペース一覧を取得 (1組織1ワークスペースルールのため、内部では1つのみ返す)
router.get('/:organizationId/workspaces', workspaceController.getWorkspaces);

// 組織のデフォルトワークスペースを取得（簡略化されたパス）
router.get('/:organizationId/workspace', organizationController.getDefaultWorkspace);

// 組織のデフォルトワークスペースのメンバー管理
router.get('/:organizationId/workspace/members', organizationController.getDefaultWorkspaceMembers);
router.post('/:organizationId/workspace/members', organizationController.addDefaultWorkspaceMember);
router.put('/:organizationId/workspace/members/:memberId', organizationController.updateDefaultWorkspaceMemberRole);
router.delete('/:organizationId/workspace/members/:memberId', organizationController.removeDefaultWorkspaceMember);

// 組織のデフォルトワークスペースのAPIキー管理
router.get('/:organizationId/workspace/apikey', organizationController.getDefaultWorkspaceApiKey);
router.post('/:organizationId/workspace/apikey', organizationController.createDefaultWorkspaceApiKey);
router.delete('/:organizationId/workspace/apikey/:keyId', organizationController.revokeDefaultWorkspaceApiKey);

// 組織のデフォルトワークスペースの使用量
router.get('/:organizationId/workspace/usage', organizationController.getDefaultWorkspaceUsage);

// 新規ワークスペース作成（組織にワークスペースがない場合のみ許可）
router.post('/:organizationId/workspaces', organizationController.preventMultipleWorkspaces, workspaceController.createWorkspace);

module.exports = router;