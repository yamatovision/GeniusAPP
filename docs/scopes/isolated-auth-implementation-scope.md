# 分離認証モード実装スコープ

## 概要
現在、AppGeniusの分離認証モード（APPGENIUS_USE_ISOLATED_AUTH=true）が正しく機能していないため、ClaudeCode CLIとの認証同期に問題が発生しています。環境変数が有効になっていても専用の認証ファイルが生成されず、拡張機能とCLI間で認証情報が正しく共有されていません。このスコープでは、分離認証モードを正しく実装し、拡張機能とCLI間でのシームレスな認証共有を実現します。

## 成功基準
- 分離認証モードが正しく機能し、AppGenius専用の認証ファイルが生成・使用される
- 環境変数APPGENIUS_USE_ISOLATED_AUTHが適切に検出・処理される
- VSCode拡張とClaudeCode CLI間で認証情報が正しく共有される
- 認証ファイルが適切なディレクトリとパーミッションで作成される
- デバッグログが十分な情報を提供し、問題診断を容易にする
- 認証切り替え時のユーザー体験が改善される

## 対象ファイル

### 認証同期処理
- `src/services/ClaudeCodeAuthSync.ts`
  - 分離認証モード処理の実装
  - 環境変数チェックの強化
  - ファイル生成ロジックの修正
  - 詳細なデバッグログの追加

- `src/services/ClaudeCodeLauncherService.ts`
  - 分離認証モードとの連携強化
  - 環境変数処理の改善
  - 認証状態チェックの強化

### 認証サービス連携
- `src/core/auth/AuthenticationService.ts`
  - 認証モード切り替えのサポート
  - 認証ステータスの正確な追跡
  - 認証切り替え時のユーザー通知改善

- `src/core/auth/TokenManager.ts`
  - トークン管理の改善
  - 異なる認証モード間の整合性確保

### デバッグとエラーハンドリング
- `src/utils/logger.ts`
  - 認証関連の詳細なログ出力
  - 問題診断のためのコンテキスト情報拡充

- `test_script/fix_isolated_auth.js`
  - 分離認証モードのトラブルシューティングスクリプト作成
  - 診断情報の収集と分析機能

## 実装計画

### ステップ1: 問題分析と診断（1日）
1. 現在の分離認証モードの実装を詳細に調査
2. 認証ファイル生成の失敗原因を特定
3. 環境変数検出の問題を調査
4. 実際の認証フローをステップバイステップで分析
5. 実環境での問題再現と条件の特定

### ステップ2: 分離認証モード処理の修正（2日）
1. ClaudeCodeAuthSync.tsの認証同期処理の修正
2. 環境変数チェックロジックの強化
3. 認証ファイル生成パスの確認と修正
4. ディレクトリ存在確認と自動作成の実装
5. 詳細なデバッグログの追加

### ステップ3: 認証サービス連携の改善（1日）
1. AuthenticationServiceとTokenManagerの連携強化
2. 認証モード切り替え時の処理改善
3. ユーザーへの明確なフィードバック実装
4. ClaudeCodeLauncherServiceとの連携修正

### ステップ4: テストとトラブルシューティング（1日）
1. テストスクリプトの作成
2. 様々な環境設定でのテスト
3. エラーケースの体系的検証
4. トラブルシューティングガイドの作成

## 技術的アプローチ
1. 環境変数APPGENIUS_USE_ISOLATED_AUTHの検出ロジックを強化し、vscode.env.appNameを使用した代替検出も実装
2. 認証ファイル保存パスを適切に構築し、必要に応じてディレクトリを自動作成
3. ファイルシステム操作にはfs-extra等を使用し、エラーハンドリングを強化
4. 詳細なデバッグログを追加し、認証処理の各ステップを追跡可能に
5. 認証切り替え時のユーザーへの通知を改善し、明確なフィードバックを提供

## 実装詳細

### 環境変数チェックと認証モード決定
```typescript
// 改善されたAPPGENIUS_USE_ISOLATED_AUTH環境変数チェック
private getIsolatedAuthEnabled(): boolean {
  const envVar = process.env.APPGENIUS_USE_ISOLATED_AUTH;
  
  // 明示的な環境変数設定を最優先
  if (envVar !== undefined) {
    const isEnabled = envVar.toLowerCase() === 'true';
    logger.info(`分離認証モード環境変数: ${envVar} (${isEnabled ? '有効' : '無効'})`);
    return isEnabled;
  }
  
  // VSCode環境の検出
  try {
    const isVSCodeEnv = !!vscode && !!vscode.env && !!vscode.env.appName;
    const appName = isVSCodeEnv ? vscode.env.appName : 'unknown';
    logger.info(`VSCode環境検出: ${isVSCodeEnv}, アプリ名: ${appName}`);
    
    // VSCode環境では分離認証をデフォルトで有効化
    if (isVSCodeEnv) {
      return true;
    }
  } catch (error) {
    logger.warn(`VSCode環境の検出中にエラー発生: ${error.message}`);
  }
  
  // デフォルトは無効
  return false;
}
```

### 認証ファイル作成の改善
```typescript
// 認証ファイル作成処理の改善
private async createIsolatedAuthFile(tokenData: TokenData): Promise<void> {
  try {
    // 認証ファイルパスの構築
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.appgenius');
    const authFilePath = path.join(configDir, 'auth.json');
    
    logger.info(`分離認証ファイルパス: ${authFilePath}`);
    
    // ディレクトリの存在確認と作成
    await fs.ensureDir(configDir);
    logger.info(`設定ディレクトリの確認完了: ${configDir}`);
    
    // トークンデータの保存
    const dataToSave = {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeJson(authFilePath, dataToSave, { spaces: 2 });
    logger.info(`分離認証ファイルの作成に成功しました: ${authFilePath}`);
    
    // パーミッション設定 (Unix系のみ)
    if (process.platform !== 'win32') {
      await fs.chmod(authFilePath, 0o600);
      logger.info('分離認証ファイルのパーミッションを設定しました: 0600');
    }
  } catch (error) {
    logger.error(`分離認証ファイルの作成に失敗しました: ${error.message}`);
    throw new Error(`分離認証設定の保存に失敗しました: ${error.message}`);
  }
}
```

### 認証同期処理の改善
```typescript
// 認証同期処理の改善
public async synchronizeAuth(): Promise<void> {
  try {
    const isIsolatedMode = this.getIsolatedAuthEnabled();
    logger.info(`認証同期を開始します。分離モード: ${isIsolatedMode ? '有効' : '無効'}`);
    
    // 認証状態の確認
    const authState = await this.authenticationService.getAuthState();
    if (!authState.isAuthenticated) {
      logger.warn('認証されていないため、同期をスキップします');
      return;
    }
    
    // トークンデータの取得
    const tokenData = await this.tokenManager.getTokenData();
    if (!tokenData) {
      logger.warn('トークンデータが取得できないため、同期をスキップします');
      return;
    }
    
    if (isIsolatedMode) {
      // 分離モードの認証ファイル作成
      await this.createIsolatedAuthFile(tokenData);
      this.notifyUser('ClaudeCode CLIに認証情報を同期しました (分離モード)');
    } else {
      // 標準モードの認証同期処理
      await this.syncWithClaudeCodeStandard(tokenData);
      this.notifyUser('ClaudeCode CLIに認証情報を同期しました (標準モード)');
    }
  } catch (error) {
    logger.error(`認証同期中にエラーが発生しました: ${error.message}`);
    this.notifyUser('認証同期に失敗しました。詳細はログを確認してください', 'error');
  }
}
```

## テスト計画
- 分離認証モードの有効/無効両方での動作確認
- 様々な環境設定（Windows/Mac/Linux）での検証
- ディレクトリ権限問題のシミュレーションとエラーハンドリング確認
- VSCode環境とCLI環境間の認証同期テスト
- エラーケースの系統的検証とログ出力確認

## リスクと対策
- **リスク**: 環境変数の検出失敗による誤った認証モード選択
  - **対策**: 複数の検出方法を実装し、詳細なログを出力
- **リスク**: ファイルシステム権限によるファイル作成の失敗
  - **対策**: 適切なエラーハンドリングとユーザーへの明確なフィードバック
- **リスク**: VSCode拡張とCLI間の認証情報の同期タイミング問題
  - **対策**: 認証状態の変更を検出し、適切なタイミングで同期を実行
- **リスク**: 認証ファイルのセキュリティリスク
  - **対策**: 適切なファイルパーミッションと敏感な情報の安全な保存

## 依存関係
- VSCode拡張API (vscode.env, vscode.SecretStorage)
- fs-extra (ディレクトリ作成とファイル操作)
- TokenManager と AuthenticationService
- Logger ユーティリティ