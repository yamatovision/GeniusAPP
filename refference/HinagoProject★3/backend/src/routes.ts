/**
 * アプリケーションルート定義
 */
import { Router } from 'express';
import authRoutes from './features/auth/auth.routes';
import userRoutes from './features/users/users.routes';
import organizationRoutes from './features/organizations/organizations.routes';
import propertyRoutes from './features/properties/properties.routes';
import config from './config';

const router = Router();

// APIバージョンプレフィックス
const apiPrefix = config.app.app.apiPrefix;

// 認証ルート
router.use(`${apiPrefix}/auth`, authRoutes);

// ユーザールート
router.use(`${apiPrefix}/users`, userRoutes);

// 組織ルート
router.use(`${apiPrefix}/organizations`, organizationRoutes);

// 物件ルート
router.use(`${apiPrefix}/properties`, propertyRoutes);

// TODO: 他のルートモジュールをここに追加

export default router;