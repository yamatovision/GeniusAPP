/**
 * 組織API ルーティング
 */
import { Router } from 'express';
import * as organizationController from './organizations.controller';
import { 
  organizationIdParamValidation, 
  updateOrganizationValidation 
} from './organizations.validator';
import { requireAuth } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';

const router = Router();

// 認証ミドルウェアを適用
router.use(requireAuth);

// 組織情報を取得
router.get('/:id', validate(organizationIdParamValidation), organizationController.getOrganizationById);

// 組織情報を更新
router.put('/:id', validate(updateOrganizationValidation), organizationController.updateOrganization);

export default router;