/**
 * 認証ルーター
 * 認証関連のエンドポイントを定義します
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// 認証エンドポイント
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authMiddleware.verifyRefreshToken, authController.refreshToken);
router.post('/logout', authController.logout);

// ユーザー情報エンドポイント
router.get('/users/me', authMiddleware.verifyToken, authMiddleware.loadUser, authController.getCurrentUser);
router.put('/users/me', authMiddleware.verifyToken, authMiddleware.loadUser, authController.updateCurrentUser);

// ヘルスチェックエンドポイント
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'available',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;