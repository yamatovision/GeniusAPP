/**
 * API Proxyルート定義
 * ClaudeCode APIプロキシのエンドポイントを設定
 */
const express = require('express');
const apiProxyController = require('../controllers/apiProxyController');
const authMiddleware = require('../middlewares/simple-auth.middleware');
const usageLimitMiddleware = require('../middlewares/usage-limit.middleware');

const router = express.Router();

// すべてのエンドポイントで認証が必要
router.use(authMiddleware.verifySimpleToken);

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

// トークン使用記録エンドポイント（複数の代替パスを提供して互換性を確保）
router.post('/usage/record', apiProxyController.recordTokenUsage);
router.post('/usage/me/record', apiProxyController.recordTokenUsage);
router.post('/claude/usage', apiProxyController.recordTokenUsage);

// 管理者向けエンドポイント
router.get('/admin/usage/:userId', authMiddleware.isSimpleAdmin, apiProxyController.getUserUsage);
router.put('/admin/limits/:userId', authMiddleware.isSimpleAdmin, apiProxyController.updateUserLimits);

// API状態確認エンドポイント
router.get('/status', apiProxyController.getApiStatus);

module.exports = router;