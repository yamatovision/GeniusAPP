/**
 * ユーザーAPI ルーティング
 */
import { Router } from 'express';
import * as userController from './users.controller';
import { 
  getUsersValidation, 
  userIdParamValidation, 
  updateUserValidation, 
  updateProfileValidation 
} from './users.validator';
import { requireAuth } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';

const router = Router();

// 認証ミドルウェアを適用
router.use(requireAuth);

// 自組織ユーザー一覧を取得
router.get('/', validate(getUsersValidation), userController.getUsers);

// 自身のプロフィールを取得
router.get('/profile', userController.getProfile);

// 自身のプロフィールを更新
router.put('/profile', validate(updateProfileValidation), userController.updateProfile);

// 特定ユーザーの情報を取得
router.get('/:id', validate(userIdParamValidation), userController.getUserById);

// ユーザー情報を更新（自身のみ）
router.put('/:id', validate(updateUserValidation), userController.updateUser);

export default router;