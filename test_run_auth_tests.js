/**
 * 認証システム統合テスト実行ツール
 * 
 * このスクリプトは、VSCodeのエクステンションホスト内で認証システムテストを実行するためのものです。
 * VSCodeのコマンドパレットから「AppGenius: Auth Verification Tests」を実行することで、
 * 認証関連の統合テストを実行します。
 * 
 * 実行方法:
 * 1. VSCodeでこのファイルを開く
 * 2. このファイルを実行する（F5キーなど）
 * 3. VSCodeのコマンドパレットから「AppGenius: Auth Verification Tests」を選択
 */

const vscode = require('vscode');

// コマンド登録を実行するためのファンクション
async function activateAuthTests(context) {
  // テスト実行コマンドを登録
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.runAuthVerificationTests', async () => {
      try {
        // 情報表示
        vscode.window.showInformationMessage('認証システム統合テストを開始します...');
        
        // テスト内容の選択を表示
        const testOption = await vscode.window.showQuickPick(
          [
            { label: 'SimpleAuth 基本テスト', description: '認証サービスの基本機能をテスト', id: 'simpleAuth.test' },
            { label: 'AuthGuard 連携テスト', description: '権限チェック機能をテスト', id: 'authGuard.test' },
            { label: 'コマンド登録テスト', description: '認証コマンドの登録状態をテスト', id: 'commands.test' },
            { label: 'すべてのテストを実行', description: '全ての認証テストを順に実行', id: 'all' }
          ],
          { placeHolder: '実行するテストを選択してください' }
        );
        
        if (!testOption) {
          return;
        }
        
        // 選択されたテストを実行
        switch (testOption.id) {
          case 'simpleAuth.test':
            await vscode.commands.executeCommand('appgenius.simpleAuth.test');
            break;
            
          case 'authGuard.test':
            await runAuthGuardTests();
            break;
            
          case 'commands.test':
            await runCommandsTest();
            break;
            
          case 'all':
            await vscode.commands.executeCommand('appgenius.simpleAuth.test');
            await runAuthGuardTests();
            await runCommandsTest();
            break;
        }
        
        vscode.window.showInformationMessage('認証システム統合テストが完了しました');
      } catch (error) {
        vscode.window.showErrorMessage(`テスト実行中にエラーが発生しました: ${error.message}`);
      }
    })
  );
  
  // テスト実行完了通知
  vscode.window.showInformationMessage(
    'Auth Verification Tests がインストールされました。コマンドパレットから「Auth Verification Tests」を実行してください。'
  );
}

// AuthGuardテストを実行
async function runAuthGuardTests() {
  try {
    // 出力チャネルを準備
    const outputChannel = vscode.window.createOutputChannel('AuthGuard Tests');
    outputChannel.show();
    outputChannel.appendLine('===== AuthGuard統合テスト開始 =====');
    
    // ここでAuthGuardの機能をテスト
    const simpleAuth = await vscode.commands.executeCommand('appgenius.getSimpleAuthService');
    outputChannel.appendLine(`SimpleAuthService取得: ${simpleAuth ? '成功' : '失敗'}`);
    
    // 各機能へのアクセスをテスト
    const features = [
      'dashboard',
      'scope_manager',
      'debug_detective',
      'claude_code',
      'user_management'  // 管理者専用機能
    ];
    
    outputChannel.appendLine('\nFeature Access Tests:');
    for (const feature of features) {
      const result = await vscode.commands.executeCommand('appgenius.testFeatureAccess', feature);
      outputChannel.appendLine(`- ${feature}: ${result ? 'アクセス可能' : 'アクセス不可'}`);
    }
    
    // ログイン状態チェック
    const loginState = await vscode.commands.executeCommand('appgenius.checkAuthStatus');
    outputChannel.appendLine(`\nログイン状態: ${loginState ? 'ログイン済み' : '未ログイン'}`);
    
    outputChannel.appendLine('\n===== AuthGuard統合テスト完了 =====');
  } catch (error) {
    vscode.window.showErrorMessage(`AuthGuardテスト実行中にエラー: ${error.message}`);
  }
}

// コマンド登録テストを実行
async function runCommandsTest() {
  try {
    // 出力チャネルを準備
    const outputChannel = vscode.window.createOutputChannel('Auth Commands Tests');
    outputChannel.show();
    outputChannel.appendLine('===== 認証コマンド登録テスト開始 =====');
    
    // 登録されているはずのコマンド一覧
    const AUTH_COMMANDS = [
      'appgenius.login',
      'appgenius.logout',
      'appgenius.simpleAuth.test',
      'appgenius.simpleAuth.login',
      'appgenius.simpleAuth.logout',
      'appgenius.simpleAuth.showMenu'
    ];
    
    // 登録されているコマンド一覧を取得
    const allCommands = await vscode.commands.getCommands();
    
    outputChannel.appendLine('\n認証関連コマンドの登録状況:');
    for (const command of AUTH_COMMANDS) {
      const isRegistered = allCommands.includes(command);
      outputChannel.appendLine(`- ${command}: ${isRegistered ? '登録済み' : '未登録'}`);
    }
    
    outputChannel.appendLine('\n===== 認証コマンド登録テスト完了 =====');
  } catch (error) {
    vscode.window.showErrorMessage(`コマンドテスト実行中にエラー: ${error.message}`);
  }
}

// テストコマンドをエクスポート
module.exports = {
  activateAuthTests
};