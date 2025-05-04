"use strict";
/**
 * ClaudeCode起動カウントイベントリスナーを登録する関数
 * extension.tsの末尾に以下のコードを追加してください
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClaudeCodeLaunchCountEventListener = registerClaudeCodeLaunchCountEventListener;
const AppGeniusEventBus_1 = require("./src/services/AppGeniusEventBus");
const SimpleAuthService_1 = require("./src/core/auth/SimpleAuthService");
const claudeCodeApiClient_1 = require("./src/api/claudeCodeApiClient");
const logger_1 = require("./src/utils/logger");
function registerClaudeCodeLaunchCountEventListener(context) {
    try {
        // ClaudeCode起動カウントイベントを監視してバックエンドに通知
        const claudeCodeLaunchCountListener = AppGeniusEventBus_1.AppGeniusEventBus.getInstance().onEventType(AppGeniusEventBus_1.AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED, async (event) => {
            try {
                // イベントデータからユーザーIDを取得
                let userId = null;
                // 方法1: イベントデータに直接ユーザーIDが含まれている場合
                if (event.data && event.data.userId) {
                    userId = event.data.userId;
                    // このユーザーIDを直接使用してカウンターを更新
                    logger_1.Logger.info(`【デバッグ】ClaudeCode起動カウンター: イベントデータのユーザーIDでAPI呼び出し: ユーザーID=${userId}`);
                    const claudeCodeApiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
                    const result = await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userId);
                    if (result) {
                        logger_1.Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userId}, 新しい値=${result.data?.claudeCodeLaunchCount || 'N/A'}`);
                    }
                    else {
                        logger_1.Logger.warn(`ClaudeCode起動カウンターの更新に失敗しました: ユーザーID ${userId}`);
                    }
                    return; // イベントデータからユーザーIDが取得できた場合は、ここで処理を終了
                }
                // 方法2: 現在ログイン中のユーザーIDを取得（バックアップ方法）
                try {
                    const authService = SimpleAuthService_1.SimpleAuthService.getInstance();
                    const userData = await authService.getCurrentUser();
                    if (userData && userData.id) {
                        // バックエンドAPIを呼び出してカウンターをインクリメント
                        userId = userData.id;
                        logger_1.Logger.info(`【デバッグ】ClaudeCode起動カウンター: 認証サービスからのユーザーIDでAPI呼び出し: ユーザーID=${userId}`);
                        const claudeCodeApiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
                        const result = await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userId);
                        if (result) {
                            logger_1.Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userId}, 新しい値=${result.data?.claudeCodeLaunchCount || 'N/A'}`);
                        }
                        else {
                            logger_1.Logger.warn(`ClaudeCode起動カウンターの更新に失敗しました: ユーザーID ${userId}`);
                        }
                    }
                    else {
                        logger_1.Logger.warn('ClaudeCode起動カウンター更新: ユーザーIDが取得できませんでした');
                    }
                }
                catch (authError) {
                    logger_1.Logger.error('ClaudeCode起動カウンター更新: 認証サービスからのユーザーID取得エラー:', authError);
                }
            }
            catch (error) {
                logger_1.Logger.error('ClaudeCode起動カウンター更新エラー:', error);
            }
        });
        // コンテキストに登録して適切に破棄できるようにする
        context.subscriptions.push(claudeCodeLaunchCountListener);
        logger_1.Logger.info('ClaudeCode起動カウントイベントリスナーが登録されました');
    }
    catch (error) {
        logger_1.Logger.error('ClaudeCode起動カウントイベントリスナーの登録に失敗しました:', error);
    }
}
// extension.tsの末尾に以下を追加
/*
// ClaudeCode起動カウントイベントリスナーの登録
import { registerClaudeCodeLaunchCountEventListener } from './claude_code_counter_event_listener';
registerClaudeCodeLaunchCountEventListener(context);
*/ 
//# sourceMappingURL=claude_code_counter_event_listener.js.map