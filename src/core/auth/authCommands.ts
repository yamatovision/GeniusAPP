import * as vscode from 'vscode';
import { AuthenticationService } from './AuthenticationService';
import { LoginWebviewPanel } from '../../ui/auth/LoginWebviewPanel';
import { AuthStatusBar } from '../../ui/auth/AuthStatusBar';
import { UsageIndicator } from '../../ui/auth/UsageIndicator';
import { LogoutNotification } from '../../ui/auth/LogoutNotification';

/**
 * registerAuthCommands - 認証関連のコマンドを登録する関数
 * 
 * VSCode拡張機能内で認証関連のコマンドを登録し、ユーザーが認証操作を行えるように
 * します。
 * 
 * @param context VSCode拡張のコンテキスト
 */
export function registerAuthCommands(context: vscode.ExtensionContext): void {
  const authService = AuthenticationService.getInstance();
  
  // ログインコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.login', () => {
      LoginWebviewPanel.createOrShow(context.extensionUri);
    })
  );
  
  // ログアウトコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.logout', async () => {
      const answer = await vscode.window.showWarningMessage(
        'AppGeniusからログアウトしますか？',
        'ログアウト',
        'キャンセル'
      );
      
      if (answer === 'ログアウト') {
        await authService.logout();
        vscode.window.showInformationMessage('AppGeniusからログアウトしました');
      }
    })
  );
  
  // 使用量詳細表示コマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.showUsageDetails', () => {
      // 使用量詳細画面を表示するロジック
      // 今後実装予定
      vscode.window.showInformationMessage('使用量詳細機能は現在実装中です');
    })
  );
  
  // 認証状態表示を初期化
  initAuthStatusBar(context);
  
  // 使用量表示を初期化
  initUsageIndicator(context);
  
  // ログアウト通知を初期化
  initLogoutNotification(context);
}

/**
 * 認証ステータスバーの初期化
 */
function initAuthStatusBar(context: vscode.ExtensionContext): void {
  const statusBar = AuthStatusBar.getInstance();
  context.subscriptions.push(statusBar);
}

/**
 * 使用量インジケーターの初期化
 */
function initUsageIndicator(context: vscode.ExtensionContext): void {
  const usageIndicator = UsageIndicator.getInstance();
  context.subscriptions.push(usageIndicator);
}

/**
 * ログアウト通知の初期化
 */
function initLogoutNotification(context: vscode.ExtensionContext): void {
  const logoutNotification = LogoutNotification.getInstance();
  context.subscriptions.push(logoutNotification);
}