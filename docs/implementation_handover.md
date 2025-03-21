# 分離認証モード実装 - 引き継ぎ資料

## 現在の状態

分離認証モード（APPGENIUS_USE_ISOLATED_AUTH=true）のスコープを作成し、初期セットアップが完了しました。このスコープは、AppGenius拡張機能とClaudeCode CLI間の認証情報の共有を改善するものです。

### 実装状況

- 新しいスコープ `分離認証モード実装` がCURRENT_STATUS.mdに追加されました
- 詳細な実装計画を含むスコープ文書 `docs/scopes/isolated-auth-implementation-scope.md` が作成されました
- トラブルシューティング用スクリプト `test_script/fix_isolated_auth.js` が更新されました

### 確認済みの事項

- 環境変数 `APPGENIUS_USE_ISOLATED_AUTH=true` が正しく設定されていることを確認しました
- 分離認証用ディレクトリとファイルの構造を確認しました:
  - AppGenius認証ディレクトリ: `/Users/tatsuya/.appgenius`
  - AppGenius認証ファイル: `/Users/tatsuya/.appgenius/auth.json`
  - 代替認証ファイル: `/Users/tatsuya/Library/Application Support/appgenius/claude-auth.json`
  - ClaudeCode CLI認証ファイル: `/Users/tatsuya/Library/Application Support/claude-cli/auth.json`

### 発見した問題点

テストスクリプトを実行したところ、以下の問題が確認されました：

1. トークンの有効期限が切れている状態のため、API呼び出しが失敗しています
2. VSCodeでAppGenius拡張機能に再ログインしようとした際に、以下のエラーが発生しています:
   ```
   appgenius.global.tokenExpiry は登録済みの構成ではないため、ユーザー設定 に書き込むことができません
   ```
3. この問題により、AuthStorageManagerがトークン情報を保存できていません

## 引き継ぎタスク

以下のタスクを引き継いで実装を進めてください:

1. 設定登録の問題を解決:
   - `appgenius.global.tokenExpiry` 設定が正しく登録されるよう`package.json`の`contributes.configuration`セクションを修正

2. AuthStorageManagerの改善:
   - `src/utils/AuthStorageManager.ts`で設定が見つからない場合のフォールバック機能を実装
   - セキュア・ストレージに優先的に保存する機能を強化

3. 分離認証機能の実装:
   - `src/services/ClaudeCodeAuthSync.ts` - 分離認証モード処理の実装
   - `src/services/ClaudeCodeLauncherService.ts` - 分離認証モードとの連携強化
   - `src/core/auth/AuthenticationService.ts` - 認証モード切り替えのサポート
   - `src/core/auth/TokenManager.ts` - トークン管理の改善
   - `src/utils/logger.ts` - 認証関連の詳細なログ出力

4. 実装後のテスト:
   - VSCodeでAppGenius拡張機能に再ログイン
   - `test_script/fix_isolated_auth.js`を実行して認証ファイルの同期確認
   - `test_script/check_token_usage.js`を実行して、トークン使用量の記録が正常に行われることを確認

## 重要な参照ドキュメント

以下のドキュメントを参照してください:

1. **スコープ詳細文書**: 
   `/docs/scopes/isolated-auth-implementation-scope.md` - 実装計画と技術的アプローチの詳細

2. **CURRENT_STATUS**:
   `/docs/CURRENT_STATUS.md` - 現在の実装状況とファイルリスト

3. **テストスクリプト**:
   - `/test_script/fix_isolated_auth.js` - 分離認証モードのトラブルシューティング
   - `/test_script/check_token_usage.js` - トークン使用量の記録テスト

## 実装のポイント

1. **設定登録問題の修正**:
   - `package.json`の`contributes.configuration`セクションで`appgenius.global.tokenExpiry`が正しく登録されているか確認
   - 設定キーの名前や型が正しいことを確認

2. **AuthStorageManagerの強化**:
   - VSCodeの`SecretStorage`を優先的に使用し、グローバル設定はフォールバックとして使用
   - エラーハンドリングの改善とログ出力の強化

3. **ファイルシステム操作の改善**:
   - `fs-extra`パッケージを活用して、ディレクトリの自動作成などをサポート
   - ファイル操作のエラーハンドリングを強化

4. **環境変数の検出強化**:
   - VSCode環境での環境変数検出を改善
   - 複数の検出方法を実装してより確実に設定を反映

5. **ユーザーフィードバックの強化**:
   - 認証状態や問題の発生時に、ユーザーに明確なフィードバックを提供
   - トラブルシューティングのためのガイダンスを提供

## 関連するコードの場所

主な修正が必要なファイルとその役割：

```
src/utils/AuthStorageManager.ts      - 認証情報の保存を担当
src/core/auth/TokenManager.ts        - トークン管理の中心的クラス
src/services/ClaudeCodeAuthSync.ts   - CLIとの認証同期を担当
package.json                         - VSCode拡張の設定を定義
```

このタスクでは、VSCodeの設定システムとファイルシステムの連携を強化することが重要です。適切なエラーハンドリングと、ユーザーへの明確なフィードバックを提供してください。