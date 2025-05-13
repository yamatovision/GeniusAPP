/**
 * ClaudeCode起動カウンターのデバッグ用ユーティリティ
 * これは既存のコードに変更を加えずにカウンターの動作をテストするためのファイルです
 */

import { AppGeniusEventBus, AppGeniusEventType } from './src/services/AppGeniusEventBus';
import { SimpleAuthService } from './src/core/auth/SimpleAuthService';
import { ClaudeCodeApiClient } from './src/api/claudeCodeApiClient';
import { Logger } from './src/utils/logger';
import * as vscode from 'vscode';

/**
 * ClaudeCode起動カウンターのテストを行う
 * このメソッドはテスト用にClaudeCode起動カウントイベントを発行します
 */
export async function testClaudeCodeLaunchCounter() {
  try {
    Logger.info('【ClaudeCode起動カウンター】テスト: イベントを発行します');
    
    // イベントの発行
    const eventBus = AppGeniusEventBus.getInstance();
    eventBus.emit(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      { testMode: true, timestamp: Date.now() },
      'ClaudeCodeLauncherTester'
    );
    
    Logger.info('【ClaudeCode起動カウンター】テスト: イベントを発行しました。リスナーの処理を確認してください。');
    
    // 任意の情報を通知
    vscode.window.showInformationMessage('ClaudeCode起動カウンターのテストイベントを発行しました。出力パネルを確認してください。');
    
    return true;
  } catch (error) {
    Logger.error('【ClaudeCode起動カウンター】テストエラー:', error as Error);
    vscode.window.showErrorMessage(`ClaudeCode起動カウンターのテストに失敗しました: ${(error as Error).message}`);
    return false;
  }
}

/**
 * ユーザー情報を直接取得してカウンターを更新
 * このメソッドは認証サービスとAPIクライアントを直接呼び出して、カウンターを更新します
 */
export async function directUpdateClaudeCodeLaunchCounter() {
  try {
    Logger.info('【ClaudeCode起動カウンター】直接更新: 開始');
    
    // 現在ログイン中のユーザーIDを取得
    const authService = SimpleAuthService.getInstance();
    Logger.info('【ClaudeCode起動カウンター】直接更新: 認証サービスからユーザー情報を取得中...');
    const userData = await authService.getCurrentUser();
    
    if (userData && userData.id) {
      Logger.info(`【ClaudeCode起動カウンター】直接更新: ユーザー情報取得成功: ${userData.name || 'Unknown'} (ID: ${userData.id})`);
      
      // APIクライアント経由でカウンターを更新
      Logger.info(`【ClaudeCode起動カウンター】直接更新: APIを呼び出します: ユーザーID ${userData.id}`);
      const claudeCodeApiClient = ClaudeCodeApiClient.getInstance();
      const result = await claudeCodeApiClient.incrementClaudeCodeLaunchCount(userData.id);
      
      if (result && result.success) {
        const newCount = result.data?.claudeCodeLaunchCount || 'N/A';
        Logger.info(`【ClaudeCode起動カウンター】直接更新: 成功: 新しいカウント値 = ${newCount}`);
        vscode.window.showInformationMessage(`ClaudeCode起動カウンターが ${newCount} に更新されました`);
        return true;
      } else {
        Logger.warn(`【ClaudeCode起動カウンター】直接更新: API呼び出しは成功しましたが、レスポンスが期待と異なります:`, result);
        vscode.window.showWarningMessage('ClaudeCode起動カウンターの更新に問題があります。出力パネルを確認してください。');
        return false;
      }
    } else {
      Logger.warn('【ClaudeCode起動カウンター】直接更新: ユーザー情報が取得できませんでした');
      vscode.window.showErrorMessage('ユーザー情報が取得できなかったため、カウンター更新をスキップします');
      return false;
    }
  } catch (error) {
    Logger.error('【ClaudeCode起動カウンター】直接更新エラー:', error as Error);
    vscode.window.showErrorMessage(`ClaudeCode起動カウンターの直接更新に失敗しました: ${(error as Error).message}`);
    return false;
  }
}