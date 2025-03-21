# トークン使用量・認証同期チェックガイド

このガイドは、AppGeniusとPortalバックエンド間のトークン使用量記録と認証同期に関する問題を診断・解決するためのものです。

## 問題の背景

1. VSCodeでログインすると、AppGenius拡張機能は認証情報をClaudeCodeと共有します
2. 分離認証モード（APPGENIUS_USE_ISOLATED_AUTH=true）を使用する場合、認証情報は専用ディレクトリに保存されるはずです
3. しかし、テストの結果、分離認証情報が作成されていない可能性があります

## チェック方法

### 認証ファイルの確認

1. VSCodeでAppGenius拡張機能に再ログイン
2. 以下のコマンドで認証ファイルを確認
   ```bash
   # macOS
   ls -l ~/Library/"Application Support"/appgenius/ ~/Library/"Application Support"/claude-cli/
   ```

3. 特に `appgenius` ディレクトリ内に `claude-auth.json` があるか確認

### 分離認証モードの有効化確認

1. VSCodeで拡張機能を実行
2. コマンドパレットから「Developer: Toggle Developer Tools」を選択
3. コンソールで環境変数を確認する:
   ```javascript
   process.env.APPGENIUS_USE_ISOLATED_AUTH
   ```

### トークン使用量テスト実行

```bash
cd "/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius"
node test_script/check_token_usage.js
```

## 修正方針

1. `ClaudeCodeAuthSync.ts` の `_syncTokensToClaudeCode` メソッドが環境変数を正しく処理しているか確認
2. 環境変数が設定されている場合、`syncTokensToAppGeniusAuth()` が確実に呼ばれるようにする
3. `ClaudeCodeLauncherService.ts` の `launchClaudeCode` 内での認証切り替え部分を確認

## トラブルシューティング

問題が解決しない場合:

1. 開発者ツールでログを確認する
2. `src/core/auth/TokenManager.ts` が正しく動作しているか確認
3. VSCode拡張機能のストレージへのアクセス権限を確認

---

## 修正手順

1. VSCodeでAppGenius拡張機能に再ログイン
2. コマンドパレットから「AppGenius: ダッシュボードを開く」を選択
3. 分離認証設定を確認し、必要に応じて有効化
4. AppGeniusからClaudeCodeを起動（分離認証モードが機能しているか確認）
5. 各種ファイルの存在を確認して問題を特定

最後に、`test_script/check_token_usage.js` スクリプトを実行して確認します。