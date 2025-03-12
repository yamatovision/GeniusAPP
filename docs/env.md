# 環境変数設定リスト

## プロンプト管理ポータル・バックエンド

### データベース設定
- [ ] `DB_HOST` - データベースホスト名またはIPアドレス
- [ ] `DB_PORT` - データベース接続ポート
- [ ] `DB_NAME` - データベース名
- [ ] `DB_USER` - データベース接続ユーザー名
- [ ] `DB_PASSWORD` - データベース接続パスワード
- [ ] `DB_SSL` - SSL接続の有効化（true/false）

### サーバー設定
- [ ] `PORT` - APIサーバーが使用するポート番号（デフォルト: 3000）
- [ ] `NODE_ENV` - 実行環境（development/production/test）
- [ ] `API_URL` - API基本URL（外部公開URL）
- [ ] `LOG_LEVEL` - ログレベル（error/warn/info/debug/trace）

### 認証設定
- [ ] `JWT_SECRET` - JWT認証用シークレットキー
- [ ] `JWT_EXPIRY` - JWTトークン有効期限（例: "1h"）
- [ ] `REFRESH_TOKEN_SECRET` - リフレッシュトークン用シークレット
- [ ] `REFRESH_TOKEN_EXPIRY` - リフレッシュトークン有効期限（例: "7d"）
- [ ] `PASSWORD_SALT_ROUNDS` - パスワードハッシュのソルトラウンド数（例: 10）

### CORS設定
- [ ] `CORS_ORIGIN` - CORSで許可するオリジン（例: "http://localhost:3001"）
- [ ] `CORS_METHODS` - CORSで許可するHTTPメソッド（例: "GET,POST,PUT,DELETE"）

### レート制限
- [ ] `RATE_LIMIT_WINDOW` - レート制限のウィンドウ時間（ミリ秒）
- [ ] `RATE_LIMIT_MAX` - ウィンドウ時間内の最大リクエスト数

### SDK設定
- [ ] `SDK_CLIENT_ID` - VSCode拡張用クライアントID
- [ ] `SDK_CLIENT_SECRET` - VSCode拡張用クライアントシークレット
- [ ] `SDK_TOKEN_EXPIRY` - SDKトークン有効期限（例: "30d"）

## プロンプト管理ポータル・フロントエンド

### API接続
- [ ] `REACT_APP_API_URL` - バックエンドAPIのURL
- [ ] `REACT_APP_VERSION` - フロントエンドバージョン

### 認証設定
- [ ] `REACT_APP_AUTH_STORAGE_KEY` - 認証情報保存キー名
- [ ] `REACT_APP_TOKEN_REFRESH_INTERVAL` - トークン自動更新間隔（ミリ秒）

### 機能フラグ
- [ ] `REACT_APP_ENABLE_ANALYTICS` - 分析機能の有効化（true/false）
- [ ] `REACT_APP_ENABLE_NOTIFICATIONS` - 通知機能の有効化（true/false）

## VSCode拡張 & ClaudeCode連携

### 認証設定
- [ ] `PORTAL_API_URL` - プロンプトポータルAPIのURL
- [ ] `CLIENT_ID` - ポータル接続用クライアントID
- [ ] `CLIENT_SECRET` - ポータル接続用クライアントシークレット
- [ ] `TOKEN_STORAGE_PATH` - トークン保存パス（デフォルト: .vscode/.appgenius）

### キャッシュ設定
- [ ] `PROMPT_CACHE_SIZE` - キャッシュするプロンプトの最大数
- [ ] `PROMPT_CACHE_TTL` - プロンプトキャッシュのTTL（秒）
- [ ] `ENABLE_OFFLINE_MODE` - オフラインモード有効化（true/false）

### ClaudeCode連携
- [ ] `CLAUDE_CODE_PATH` - ClaudeCode実行可能ファイルのパス
- [ ] `CLAUDE_INTEGRATION_ENABLED` - ClaudeCode連携の有効化（true/false）
- [ ] `CLAUDE_MD_PATH` - CLAUDE.mdファイルの相対パス（デフォルト: "./CLAUDE.md"）

## スコープ別環境変数リスト

### スコープ1: プロンプト管理ポータル - バックエンド基盤
- [ ] `DB_HOST` - データベースホスト名
- [ ] `DB_PORT` - データベースポート
- [ ] `DB_NAME` - データベース名
- [ ] `DB_USER` - データベースユーザー名
- [ ] `DB_PASSWORD` - データベースパスワード
- [ ] `JWT_SECRET` - JWT認証用シークレットキー
- [ ] `JWT_EXPIRY` - JWTトークン有効期限
- [ ] `REFRESH_TOKEN_SECRET` - リフレッシュトークン用シークレット
- [ ] `REFRESH_TOKEN_EXPIRY` - リフレッシュトークン有効期限
- [ ] `PORT` - APIサーバーポート
- [ ] `CORS_ORIGIN` - CORS許可オリジン

### スコープ3: プロンプト管理ポータル - フロントエンド基盤
- [ ] `REACT_APP_API_URL` - バックエンドAPIのURL
- [ ] `REACT_APP_AUTH_STORAGE_KEY` - 認証情報保存キー名

### スコープ5: VSCode拡張 - 認証連携
- [ ] `PORTAL_API_URL` - ポータルAPI URL
- [ ] `CLIENT_ID` - クライアントID
- [ ] `CLIENT_SECRET` - クライアントシークレット
- [ ] `TOKEN_STORAGE_PATH` - トークン保存パス

### スコープ7: ClaudeCode統合
- [ ] `CLAUDE_CODE_PATH` - ClaudeCode実行可能ファイルのパス
- [ ] `CLAUDE_INTEGRATION_ENABLED` - ClaudeCode連携の有効化
- [ ] `CLAUDE_MD_PATH` - CLAUDE.mdファイルの相対パス

## 環境変数設定手順

1. `.env.example`ファイルをコピーして`.env`ファイルを作成
2. 各環境に応じた値を設定
3. バックエンド起動時に環境変数が読み込まれることを確認
4. フロントエンドビルド時に環境変数が埋め込まれることを確認
5. VSCode拡張設定で必要な環境変数を設定

## 環境変数管理のベストプラクティス

1. **機密情報の保護**: `.env`ファイルは`.gitignore`に追加し、リポジトリにコミットしないこと
2. **環境ごとの設定**: 開発/テスト/本番環境ごとに別々の`.env`ファイルを用意すること
3. **最小権限の原則**: 各環境変数には必要最小限の権限のみを与えること
4. **環境変数の文書化**: すべての環境変数の目的と形式を文書化すること
5. **デフォルト値の提供**: 可能な場合は安全なデフォルト値を提供すること
6. **定期的な更新**: セキュリティ上の理由から定期的にシークレットを更新すること

## トラブルシューティング

### よくある問題

1. **環境変数が読み込まれない**
   - `.env`ファイルが正しい場所にあることを確認
   - `dotenv`パッケージが正しく設定されていることを確認

2. **データベース接続エラー**
   - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORDの値が正しいことを確認
   - データベースサーバーが稼働中であることを確認

3. **認証関連のエラー**
   - JWT_SECRET, REFRESH_TOKEN_SECRETが設定されていることを確認
   - トークンの有効期限が適切に設定されていることを確認