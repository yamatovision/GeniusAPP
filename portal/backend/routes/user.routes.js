/**
 * ユーザー管理API用ルート定義
 */
const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// 認証が必要なエンドポイント
router.use(authMiddleware.verifyToken);

// 現在のユーザー情報を取得
router.get('/profile', userController.getCurrentUser);

// プロフィール設定の更新
router.put('/profile', userController.updateProfile);

// 管理者向けエンドポイント
// すべてのユーザー一覧を取得（管理者のみ）
router.get('/', authMiddleware.isAdmin, userController.getUsers);

// 新規ユーザーを作成（管理者のみ）
router.post('/', authMiddleware.isAdmin, userController.createUser);

// ユーザー統計情報を取得（管理者のみ）
router.get('/stats', authMiddleware.isAdmin, userController.getUserStats);

// 特定のユーザー詳細を取得
// 注: 一般ユーザーは自分自身の情報のみ取得可能
router.get('/:id', (req, res, next) => {
  // 自分自身のIDまたは管理者の場合は許可
  if (req.userId === req.params.id || req.userRole === 'admin') {
    return userController.getUserById(req, res, next);
  }
  // それ以外は権限エラー
  return res.status(403).json({ message: '他のユーザー情報を取得する権限がありません' });
});

// ユーザー情報を更新
// 注: 一般ユーザーは自分自身の情報のみ更新可能
router.put('/:id', userController.updateUser);

// ユーザーを削除（管理者のみ）
router.delete('/:id', authMiddleware.isAdmin, userController.deleteUser);

// ユーザーのAPIアクセス設定を更新（管理者のみ）
router.put('/:id/api-access', authMiddleware.isAdmin, userController.toggleApiAccess);

// ユーザーを一時停止/復旧（管理者のみ）
router.put('/:id/suspend', authMiddleware.isAdmin, userController.suspendUser);

module.exports = router;