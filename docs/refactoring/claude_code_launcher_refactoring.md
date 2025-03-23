# ClaudeCodeLauncherService リファクタリング計画

## 現状の問題
- 938行あるモノリシックなサービス (src/services/ClaudeCodeLauncherService.ts)
- 複数のアシスタント間で似た起動処理コードが散在
- 責務の混在（認証、ターミナル、プロンプト処理など）
- 類似コード（DRY原則違反）

## リファクタリング目標
- **コード品質向上**: 単一責任の原則に従った分割
- **可読性向上**: 関連コードをまとめて把握しやすく
- **テスト容易性**: 独立したモジュールでテストしやすく
- **変更容易性**: 一箇所の変更で全体に反映できる構造

## 分割計画
1. **CoreLauncherService.ts** (約350行)
   - シングルトンインスタンス管理
   - 基本的な状態管理、進捗監視
   - 共通インターフェース定義
   - イベント発行処理

2. **AuthSyncManager.ts** (約250行)
   - 認証関連処理の集約
   - トークン同期機能
   - CLI認証状態検出
   - 認証モード管理（分離認証対応）

3. **TerminalProvisionService.ts** (約200行)
   - ターミナル作成と設定（プラットフォーム固有ロジック）
   - 環境変数設定統一
   - コマンド構成と実行（共通パラメータ処理）

4. **SpecializedLaunchHandlers.ts** (約200行)
   - 各種アシスタント固有の起動ロジック
   - モックアップ解析ハンドラ
   - プロンプト処理
   - セキュリティ境界処理

## 実装ステップ
1. インターフェース定義と共通型の分離
2. 認証関連コードの抽出と共通化
3. ターミナル関連処理の分離
4. 特殊ケース処理の分離
5. 新しいクラス間の連携テスト

## 期待される効果
- 各アシスタントからの呼び出しがシンプルに
- 認証処理の変更が一箇所で完結
- ターミナル操作の統一
- バグ修正がすべての呼び出し箇所に反映

## 現状のコード調査結果

### 複数のアシスタントでの重複パターン
各アシスタント（環境変数アシスタント、デバッグ探偵など）が同様のパターンで起動処理を実装:

```typescript
// 環境変数アシスタントの例
private async _handleLaunchClaudeCodeAssistant(): Promise<boolean> {
  try {
    // 公開URLをポータルから取得
    const portalUrl = '...';
    
    // 環境変数情報の収集
    let environmentInfo = '';
    // ...収集処理...
    
    // ClaudeCodeIntegrationServiceを使用
    const integrationService = await import('../../services/ClaudeCodeIntegrationService')
      .then(module => module.ClaudeCodeIntegrationService.getInstance());
    
    // 公開URLからClaudeCodeを起動
    const success = await integrationService.launchWithPublicUrl(
      portalUrl, 
      this._projectPath,
      environmentInfo // 追加コンテンツ
    );
    
    // 成功/失敗の処理
    // ...
  } catch (error) {
    // エラーハンドリング
    // ...
  }
}
```

### AuthenticationService と ClaudeCodeLauncherService の連携の複雑さ
認証処理とトークン同期が複数の場所で重複:

```typescript
// ClaudeCodeLauncherService.ts内
const authSync = await import('../services/ClaudeCodeAuthSync').then(module => module.ClaudeCodeAuthSync.getInstance());
const authService = await import('../core/auth/AuthenticationService').then(module => module.AuthenticationService.getInstance());

// CLIログイン状態を確認
const isLoggedIn = authSync.isClaudeCliLoggedIn();

// 認証モードを確認
const authModeInfo = authService.getAuthModeInfo();
const useIsolatedAuth = authModeInfo.isIsolatedAuthEnabled;

// AppGenius専用の認証情報を保存
await authSync.syncTokensToAppGeniusAuth();
```

### ターミナル操作の重複
ターミナル作成と設定が複数箇所で重複:

```typescript
// ターミナルの作成
const terminal = vscode.window.createTerminal({
  name: 'ClaudeCode',
  cwd: this.projectPath,
  iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
});

// ターミナルの表示
terminal.show(true);

// macOSの場合は環境変数のソースを確保
if (process.platform === 'darwin') {
  terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
  terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
}

// Raw mode問題を回避するための環境変数設定
terminal.sendText('export NODE_NO_READLINE=1');
terminal.sendText('export TERM=xterm-256color');
```

これらの重複コードを適切に整理することで、保守性と可読性が大幅に向上します。