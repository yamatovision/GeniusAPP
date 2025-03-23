import * as vscode from 'vscode';
import { AuthenticationService } from './AuthenticationService';
import { SimpleAuthManager } from './SimpleAuthManager'; // 新しい認証マネージャーを追加
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
  
  // 従来のログインコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.login', () => {
      LoginWebviewPanel.createOrShow(context.extensionUri);
    })
  );
  
  // 従来のログアウトコマンド
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
  
  // 新しいシンプル認証コマンド
  registerSimpleAuthCommands(context);
  
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

/**
 * シンプル認証コマンドを登録
 * 
 * 新しく実装したシンプル認証システム用のコマンドを登録します。
 * これらのコマンドは従来の認証システムとは独立して動作します。
 */
function registerSimpleAuthCommands(context: vscode.ExtensionContext): void {
  // コマンド登録
  context.subscriptions.push(
    // シンプル認証メニュー表示
    vscode.commands.registerCommand('appgenius.simpleAuth.showMenu', () => {
      SimpleAuthManager.getInstance().getAuthService().verifyAuthState();
    }),
    
    // シンプル認証ログイン
    vscode.commands.registerCommand('appgenius.simpleAuth.login', async () => {
      // SimpleAuthManagerの内部ロジックでログインUIを表示
      await vscode.commands.executeCommand('appgenius.simpleAuth.showMenu');
    }),
    
    // シンプル認証ログアウト
    vscode.commands.registerCommand('appgenius.simpleAuth.logout', async () => {
      const simpleAuthManager = SimpleAuthManager.getInstance();
      await simpleAuthManager.getAuthService().logout();
    }),
    
    // 簡易テスト - 認証サービスの動作確認
    vscode.commands.registerCommand('appgenius.simpleAuth.test', async () => {
      try {
        const simpleAuthManager = SimpleAuthManager.getInstance();
        const authService = simpleAuthManager.getAuthService();
        const isAuthenticated = authService.isAuthenticated();
        
        vscode.window.showInformationMessage(
          `シンプル認証テスト: 認証状態=${isAuthenticated ? '認証済み' : '未認証'}`
        );
        
        if (isAuthenticated) {
          const state = authService.getCurrentState();
          vscode.window.showInformationMessage(
            `ユーザー: ${state.username}, ロール: ${state.role}`
          );
        }
        
        // 認証状態検証
        const isValid = await authService.verifyAuthState();
        vscode.window.showInformationMessage(
          `サーバー検証結果: ${isValid ? '有効' : '無効'}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`テストエラー: ${(error as Error).message}`);
      }
    })
  );
}