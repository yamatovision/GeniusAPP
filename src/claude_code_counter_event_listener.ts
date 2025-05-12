/**
 * ClaudeCode起動カウントイベントリスナーを登録する関数
 * extension.tsの末尾に以下のコードを追加してください
 */

import { AppGeniusEventBus, AppGeniusEventType } from './services/AppGeniusEventBus';
import { SimpleAuthService } from './core/auth/SimpleAuthService';
import { ClaudeCodeApiClient } from './api/claudeCodeApiClient';
import { Logger } from './utils/logger';
import * as vscode from 'vscode';

export function registerClaudeCodeLaunchCountEventListener(context: vscode.ExtensionContext) {
  try {
    // ClaudeCode起動カウントイベントを監視してバックエンドに通知
    const claudeCodeLaunchCountListener = AppGeniusEventBus.getInstance().onEventType(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      async (event) => {
        try {
          // イベントデータからユーザーIDを取得
          let userId = null;
          
          // 方法1: イベントデータに直接ユーザーIDが含まれている場合
          if (event.data && event.data.userId) {
            userId = event.data.userId;
            // このユーザーIDを直接使用してカウンターを更新
            Logger.info(`【デバッグ】ClaudeCode起動カウンター: イベントデータのユーザーIDでAPI呼び出し: ユーザーID=${userId}`);
            const claudeCodeApiClient = ClaudeCodeApiClient.getInstance();
            const result = await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userId);
            if (result) {
              Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userId}, 新しい値=${result.data?.claudeCodeLaunchCount || 'N/A'}`);
            } else {
              Logger.warn(`ClaudeCode起動カウンターの更新に失敗しました: ユーザーID ${userId}`);
            }
            return; // イベントデータからユーザーIDが取得できた場合は、ここで処理を終了
          }
          
          // ユーザーIDが取得できない場合はいったん諦める - エラーのログ抑制のため
          if (!userId) {
            Logger.info('ClaudeCode起動カウンター: ユーザーIDが取得できないため、カウント処理をスキップします');
            return;
          }
        } catch (error) {
          // エラーも抑制して静かに失敗する
          Logger.debug('ClaudeCode起動カウンター更新処理中にエラーが発生しましたが無視します', error as Error);
        }
      }
    );
    
    // コンテキストに登録して適切に破棄できるようにする
    context.subscriptions.push(claudeCodeLaunchCountListener);
    Logger.info('ClaudeCode起動カウントイベントリスナーが登録されました');
  } catch (error) {
    Logger.error('ClaudeCode起動カウントイベントリスナーの登録に失敗しました:', error as Error);
  }
}