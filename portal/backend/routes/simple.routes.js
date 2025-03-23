/**
 * シンプルなルーター
 * シンプル版のAPIエンドポイントをすべて定義
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const rateLimitMiddleware = require('../middlewares/rate-limit.middleware');

// コントローラー
const simpleAuthController = require('../controllers/simpleAuth.controller');
const simpleUserController = require('../controllers/simpleUser.controller');
const simpleOrganizationController = require('../controllers/simpleOrganization.controller');

// ===== 認証系エンドポイント =====
router.post('/auth/register', rateLimitMiddleware.authRateLimit, simpleAuthController.register);
router.post('/auth/login', rateLimitMiddleware.authRateLimit, simpleAuthController.login);
router.post('/auth/refresh-token', rateLimitMiddleware.authRateLimit, simpleAuthController.refreshToken);
router.post('/auth/logout', rateLimitMiddleware.authRateLimit, simpleAuthController.logout);
router.get('/auth/check', authMiddleware.verifyToken, simpleAuthController.checkAuth);

// ===== ユーザー系エンドポイント =====
router.get('/users', authMiddleware.verifyToken, simpleUserController.getUsers);
router.get('/users/profile', authMiddleware.verifyToken, simpleUserController.getUserProfile);
router.get('/users/:id', authMiddleware.verifyToken, simpleUserController.getUser);
router.post('/users', authMiddleware.verifyToken, simpleUserController.createUser);
router.put('/users/:id', authMiddleware.verifyToken, simpleUserController.updateUser);
router.delete('/users/:id', authMiddleware.verifyToken, simpleUserController.deleteUser);
router.put('/users/change-password', authMiddleware.verifyToken, simpleUserController.changePassword);

// ===== 組織系エンドポイント =====
router.get('/organizations', authMiddleware.verifyToken, simpleOrganizationController.getOrganizations);
router.get('/organizations/:id', authMiddleware.verifyToken, simpleOrganizationController.getOrganization);
router.post('/organizations', authMiddleware.verifyToken, simpleOrganizationController.createOrganization);
router.put('/organizations/:id', authMiddleware.verifyToken, simpleOrganizationController.updateOrganization);
router.delete('/organizations/:id', authMiddleware.verifyToken, simpleOrganizationController.deleteOrganization);

// ===== APIキー系エンドポイント =====
router.post('/organizations/:id/apikeys', authMiddleware.verifyToken, simpleOrganizationController.addApiKey);
router.delete('/organizations/:id/apikeys/:keyId', authMiddleware.verifyToken, simpleOrganizationController.removeApiKey);

module.exports = router;