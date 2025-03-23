const express = require('express');
const invitationController = require('../controllers/invitation.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');
const router = express.Router();

/**
 * 招待管理ルート
 * 組織メンバー招待の作成、表示、承諾、キャンセル機能を提供
 */

// 組織の招待管理API
router.post('/organizations/:id/invitations', [verifyToken], invitationController.createInvitation);
router.get('/organizations/:id/invitations', [verifyToken], invitationController.getOrganizationInvitations);
router.delete('/organizations/:id/invitations/:invitationId', [verifyToken], invitationController.cancelInvitation);

// 招待承諾API
router.get('/invitations/:token', invitationController.verifyInvitation);
router.post('/invitations/:token/register', invitationController.acceptInvitationNewUser);
router.post('/invitations/:token/login', invitationController.acceptInvitationExistingUser);

module.exports = router;