# ScopeManagerPanel.ts 修正指示

ScopeManagerPanel.tsファイルが大きすぎるため、直接編集できませんでした。以下の修正を適用してください：

## 1. スコープマネージャーパネルクラスにAPI接続テスト関数を追加

ScopeManagerPanel.tsファイルの中で、以下の関数を新しく定義するか、既存の関数を置き換えてください：

```typescript
/**
 * API接続をテストして認証状態と接続性を確認
 */
private async _testAPIConnection(): Promise<boolean> {
  try {
    // 外部モジュールを使用してAPI接続テストを実行
    const { testAPIConnection } = await import('../api/scopeManagerTestAPI');
    return testAPIConnection();
  } catch (error) {
    Logger.error('API接続テスト中にエラーが発生しました', error as Error);
    return false;
  }
}
```

## 2. スコープマネージャーパネル表示前の認証チェック修正

ScopeManagerPanel.createOrShow メソッド内で、以下のように認証チェックを修正してください：

```typescript
// API接続テスト（認証状態確認）
const isAPIConnected = await panel._testAPIConnection();
if (!isAPIConnected) {
  Logger.warn('API接続テストに失敗しました。スコープマネージャーは表示できません');
  vscode.window.showErrorMessage('サーバー接続に問題があります。再ログインしてください。');
  
  // 再ログイン用コマンドを提案
  const action = await vscode.window.showInformationMessage(
    'API接続に失敗しました。再ログインしますか？',
    '再ログイン'
  );
  
  if (action === '再ログイン') {
    // ログアウトしてから再ログイン画面を表示
    vscode.commands.executeCommand('appgenius-ai.logout').then(() => {
      setTimeout(() => {
        vscode.commands.executeCommand('appgenius-ai.login');
      }, 500);
    });
  }
  
  return null;
}
```

## 3. スコープパネルの実装アシスタント起動関数の修正

`_handleLaunchImplementationAssistant` メソッド内のClaudeCodeAuthSyncの取得部分を以下のように修正：

```typescript
// ClaudeCodeAuthSyncの取得（安全に）
let authSync;
try {
  const { ClaudeCodeAuthSync } = await import('../../services/ClaudeCodeAuthSync');
  
  // グローバルコンテキストを使用して初期化
  if (global.__extensionContext) {
    authSync = ClaudeCodeAuthSync.getInstance(global.__extensionContext);
  } else {
    // フォールバック
    const extension = vscode.extensions.getExtension('your-extension-id');
    if (extension) {
      authSync = ClaudeCodeAuthSync.getInstance(extension.exports.context);
    } else {
      throw new Error('拡張機能コンテキストが取得できません');
    }
  }
} catch (error) {
  Logger.error('ClaudeCodeAuthSyncの初期化エラー', error as Error);
  vscode.window.showErrorMessage('認証サービスの初期化に失敗しました。VSCodeを再起動してください。');
  return;
}
```

これらの修正を行うことで、認証状態が正しく反映され、スコープマネージャーからの実装アシスタント起動ができるようになります。