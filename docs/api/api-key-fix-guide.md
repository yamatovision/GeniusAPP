# APIキー連携機能の修正ガイド

## 問題の概要

AppGenius拡張機能で、以下の2つの問題が発生していました：

1. **APIキー取得の問題**: 
   - バックエンドの `/api/simple/user/apikey` エンドポイントにアクセスする際に404エラーが返されることがある
   - 認証チェックとプロフィールエンドポイントはAPIキーIDは返すが、実際のキー値を含んでいないことがある
   - SimpleAuthServiceがAPIキーを取得できない場合、認証はできてもClaudeCode CLIとの連携が機能しない

2. **APIキー同期の問題**:
   - AppGenius拡張機能からClaude Code CLIにAPIキーが正しく同期されない
   - auth.jsonファイルに `"accessToken": "[object Promise]"` というテキストが保存される
   - そのため、Anthropic APIの使用履歴に記録されない

## 修正内容

### 第一段階の修正（APIキー取得の改善）

1. `SimpleAuthService.ts`の`getApiKey()`メソッドを非同期（async/await）に変更
2. ハードコードされたAPIキーを削除し、サーバーからAPIキーを動的に取得するよう修正
3. APIキー取得に関連するコンポーネント間の連携を更新

### 第二段階の修正（APIキー同期の修正）- 今回の修正

問題の根本原因は、`ClaudeCodeAuthSync._syncTokensToClaudeCode()` メソッドにありました。このメソッドでは、`SimpleAuthService.getApiKey()` が返すPromiseオブジェクトを適切に「待機」せずに使用していたため、Promiseオブジェクト自体が文字列化されて `[object Promise]` というテキストがauth.jsonに保存されていました。

以下の修正を行いました：

1. APIキーの取得処理を改善し、確実に値を取得してから保存するよう修正
2. 不要な二重取得処理を削除し、初回の取得結果を再利用するようにコードを簡素化
3. authTokenオブジェクトの生成方法を修正し、常に文字列が保存されるようにコード改善

## 動作確認方法

修正後、以下の手順で動作を確認してください：

1. VSCodeを再起動前に既存の認証ファイルを削除：
   ```bash
   rm ~/.appgenius/auth.json
   rm ~/Library/Application\ Support/appgenius/claude-auth.json
   ```

2. VSCodeを再起動
3. AppGenius拡張機能にログイン
4. ClaudeCode機能を使用（スコープマネージャー→実装アシスタント起動など）

5. 修正されたauth.jsonファイルを確認：
   ```bash
   node test_api_key_storage.js
   ```

正常に修正されていれば、auth.jsonファイルの `accessToken` フィールドには `[object Promise]` ではなく、実際のAPIキー（`sk-`で始まる文字列）が保存されています。

## 技術的詳細

主な修正ポイント：

1. **`ClaudeCodeAuthSync.ts`の修正**
   - `_syncTokensToClaudeCode()` メソッドの非同期処理を改善
   - APIキーを非同期に適切に取得し、その結果を確実に文字列として保存
   - 複数回の取得処理を統合し、一度取得したAPIキーを再利用

## 長期的な改善案

1. バックエンドAPIのレスポンス形式を統一し、一貫性を持たせる
2. APIキー取得エンドポイントの応答性と可用性を向上させる
3. キャッシュや冗長機能を強化して、一時的なネットワーク問題に対する耐性を向上させる
4. 非同期処理のエラーハンドリングを強化し、Promise処理の安全性を向上

## エラー診断情報

問題が再度発生した場合は、以下のログメッセージを参照して原因を特定できます：

- `SimpleAuthService: サーバーからのAPIキー取得に失敗しました` - APIキー取得エンドポイントへのアクセスに失敗
- `SimpleAuthService: サーバーからのレスポンスにAPIキーが含まれていません` - レスポンスフォーマットの問題
- `SimpleAuthService: APIキー取得APIの応答が正しくありません` - 一般的なAPI応答エラー
- `ClaudeCode CLI同期: APIキー取得中にエラーが発生しました` - ClaudeCodeAuthSyncでのAPIキー取得失敗
- `【認証情報】警告: 保存されるaccessTokenが空または無効です` - auth.jsonへの保存時に問題が発生

これらのエラーが発生した場合は、バックエンドのAPIエンドポイントが正しく動作しているか、また非同期処理が適切に行われているか確認してください。