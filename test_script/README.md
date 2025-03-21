# AppGenius テストスクリプト

このディレクトリには、AppGenius拡張機能の診断とテストを行うためのスクリプトが含まれています。

## 利用可能なスクリプト

### トークン使用量と認証

- **check_token_usage.js**: トークン使用量記録機能をテストします
- **fix_isolated_auth.js**: 分離認証モードを修復するヘルパースクリプト
- **token_usage_check_guide.md**: トークン使用量チェックと認証モードのトラブルシューティングガイド

### API テスト

- **debug_usage_endpoint.js**: 使用量エンドポイントのデバッグツール
- **test_api.js**: API接続テスト
- **test_prompt_usage.js**: プロンプト使用量記録テスト
- **test_usage_direct.js**: 直接APIを使用した使用量テスト
- **test_usage_endpoint.js**: 使用量エンドポイントのテスト

## 使用方法

### 分離認証モードの修復

分離認証モードが正しく機能していない場合（AppGenius専用の認証ファイルが生成されていない場合）は、次のスクリプトを実行してください：

```bash
node test_script/fix_isolated_auth.js
```

このスクリプトは標準のClaudeCode CLI認証情報を読み取り、AppGenius専用の分離認証ファイルを作成します。

### トークン使用量のテスト

トークン使用量記録機能をテストするには、次のスクリプトを実行してください：

```bash
# 必要なパッケージをインストール（初回のみ）
npm install axios

# テストスクリプトを実行
node test_script/check_token_usage.js
```

## 認証情報ファイルのパス

- AppGenius専用 (分離認証モード):
  - macOS: ~/Library/Application Support/appgenius/claude-auth.json
  - Windows: %APPDATA%\appgenius\claude-auth.json
  - Linux: ~/.config/appgenius/claude-auth.json

- Claude CLI標準:
  - macOS: ~/Library/Application Support/claude-cli/auth.json
  - Windows: %APPDATA%\claude-cli\auth.json
  - Linux: ~/.config/claude-cli/auth.json

## テスト結果の例

正常に動作している場合、以下のような出力が表示されます:

```
=== AppGenius トークン使用量テスト ===
現在の日時: 2025/3/21 12:13:05

=== AppGenius専用認証情報 ===
✅ 認証情報ファイル検出: /Users/username/Library/Application Support/appgenius/claude-auth.json
📄 Source: appgenius-extension
🔐 AccessToken: eyJhbGci...-qv4
⏰ ExpiresAt: 2025/3/21 13:34:56
🕒 SyncedAt: 2025/3/21 12:34:56
🔄 IsolatedAuth: はい

=== Claude CLI標準認証情報 ===
✅ 認証情報ファイル検出: /Users/username/Library/Application Support/claude-cli/auth.json
📄 Source: vscode-extension
🔐 AccessToken: eyJhbGci...-qv4
⏰ ExpiresAt: 2025/3/21 13:34:56
🕒 SyncedAt: 2025/3/21 12:34:56
🔄 IsolatedAuth: いいえ

=== AppGenius専用認証情報でのトークン使用量テスト ===
🔄 トークン使用量記録のテストを開始...
📡 APIエンドポイント: https://geniemon-portal-backend-production.up.railway.app/api/proxy/usage/record
✅ トークン使用量記録成功: Status 200
📊 レスポンス: { success: true }

=== Claude CLI標準認証情報でのトークン使用量テスト ===
🔄 トークン使用量記録のテストを開始...
📡 APIエンドポイント: https://geniemon-portal-backend-production.up.railway.app/api/proxy/usage/record
✅ トークン使用量記録成功: Status 200
📊 レスポンス: { success: true }

=== テスト完了 ===
```

## トラブルシューティング

- **認証情報ファイルがないエラー**: 分離認証モードを修復するには `fix_isolated_auth.js` を実行してください
- **トークン期限切れエラー**: VSCodeでAppGenius拡張機能に再ログインしてください
- **APIエンドポイント接続エラー**: ネットワーク接続とプロキシ設定を確認してください
- **ディレクトリ作成エラー**: 適切なパーミッションがあることを確認してください

詳細なトラブルシューティング情報は `token_usage_check_guide.md` を参照してください。