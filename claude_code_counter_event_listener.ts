/**
 * ClaudeCode起動カウントイベントリスナーを登録する関数
 * extension.tsの末尾に以下のコードを追加してください
 */

import { AppGeniusEventBus, AppGeniusEventType } from './src/services/AppGeniusEventBus';
import { SimpleAuthService } from './src/core/auth/SimpleAuthService';
import { ClaudeCodeApiClient } from './src/api/claudeCodeApiClient';
import { Logger } from './src/utils/logger';
import * as vscode from 'vscode';

export function registerClaudeCodeLaunchCountEventListener(context: vscode.ExtensionContext) {
  try {
    // ClaudeCode起動カウントイベントを監視してバックエンドに通知
    const claudeCodeLaunchCountListener = AppGeniusEventBus.getInstance().onEventType(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      async (event) => {
        try {
          // 現在ログイン中のユーザーIDを取得
          const authService = SimpleAuthService.getInstance();
          const userData = await authService.getCurrentUser();
          
          if (userData && userData.id) {
            // バックエンドAPIを呼び出してカウンターをインクリメント
            const claudeCodeApiClient = ClaudeCodeApiClient.getInstance();
            await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userData.id);
            Logger.info(`ClaudeCode起動カウンターが更新されました: ユーザーID ${userData.id}`);
          }
        } catch (error) {
          Logger.error('ClaudeCode起動カウンター更新エラー:', error as Error);
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

// extension.tsの末尾に以下を追加
/*
// ClaudeCode起動カウントイベントリスナーの登録
import { registerClaudeCodeLaunchCountEventListener } from './claude_code_counter_event_listener';
registerClaudeCodeLaunchCountEventListener(context);
*/