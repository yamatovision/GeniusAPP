/**
 * API Proxyルート定義
 * ClaudeCode APIプロキシのエンドポイントを設定
 */
const express = require('express');
const apiProxyController = require('../controllers/apiProxyController');
const authMiddleware = require('../middlewares/auth.middleware');
const usageLimitMiddleware = require('../middlewares/usage-limit.middleware');

const router = express.Router();

// すべてのエンドポイントで認証が必要
router.use(authMiddleware.verifyToken);

// ユーザーロールチェック（admin/userのみアクセス可能、unsubscribeはアクセス不可）
router.use(usageLimitMiddleware.checkUserRole);

// トークン使用制限チェック
router.use(usageLimitMiddleware.checkTokenLimit);

// Claude API プロキシエンドポイント
router.post('/claude/chat', apiProxyController.proxyClaudeChat);
router.post('/claude/completions', apiProxyController.proxyClaudeCompletions);

// 使用量情報取得エンドポイント
router.get('/usage/me', apiProxyController.getCurrentUsage);
router.get('/usage/limits', apiProxyController.getUsageLimits);
router.get('/usage/history', apiProxyController.getUsageHistory);

// 管理者向けエンドポイント
router.get('/admin/usage/:userId', authMiddleware.isAdmin, apiProxyController.getUserUsage);
router.put('/admin/limits/:userId', authMiddleware.isAdmin, apiProxyController.updateUserLimits);

// API状態確認エンドポイント
router.get('/status', apiProxyController.getApiStatus);

module.exports = router;