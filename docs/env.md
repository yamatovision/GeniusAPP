# 環境変数設定リスト

このドキュメントでは、AppGeniusプロジェクト全体で使用される環境変数の一覧と設定方法について説明します。

## 概要

AppGeniusは複数のコンポーネント（ポータル、VSCode拡張、ClaudeCode連携）で構成されており、各コンポーネントには独自の環境変数設定が必要です。このドキュメントでは、各コンポーネントの環境変数と設定方法を説明します。

## 環境変数の設定方法

環境変数は以下のいずれかの方法で設定できます：

1. `.env` ファイルを各コンポーネントのルートディレクトリに配置
2. 開発環境の環境変数として直接設定
3. デプロイ環境（クラウドサービスなど）の環境変数として設定

## 中央Webアプリケーション環境変数

### データベース設定
- [x] `DB_HOST` - データベースホスト名（例: "localhost" または Cloud SQL接続文字列）
- [x] `DB_PORT` - データベースポート番号（例: "5432"）
- [x] `DB_NAME` - データベース名（例: "appgenius_db"）
- [x] `DB_USER` - データベースユーザー名
- [x] `DB_PASSWORD` - データベースパスワード
- [x] `DB_SSL` - SSL接続の有効化（true/false）

### JWT認証設定
- [x] `JWT_SECRET` - JWT署名用のシークレットキー（ランダムな文字列、32文字以上推奨）
- [x] `JWT_EXPIRY` - JWTトークン有効期限（例: "1h"）
- [x] `REFRESH_TOKEN_SECRET` - リフレッシュトークン用シークレットキー（JWT_SECRETとは異なる値を使用）
- [x] `REFRESH_TOKEN_EXPIRY` - リフレッシュトークン有効期限（例: "14d"）
- [x] `PASSWORD_SALT_ROUNDS` - パスワードハッシュのソルトラウンド数（例: 10）

### サーバー設定
- [x] `PORT` - APIサーバーポート番号（例: "3000"）
- [x] `NODE_ENV` - 実行環境（"development", "production", "test"）
- [x] `CORS_ORIGIN` - CORS許可オリジン（例: "http://localhost:3001" または "*"）
- [x] `LOG_LEVEL` - ログレベル（"error", "warn", "info", "debug", "verbose"）
- [x] `CORS_METHODS` - CORSで許可するHTTPメソッド（例: "GET,POST,PUT,DELETE"）

### レート制限
- [x] `RATE_LIMIT_WINDOW` - レート制限のウィンドウ時間（ミリ秒）
- [x] `RATE_LIMIT_MAX` - ウィンドウ時間内の最大リクエスト数

### SDK設定
- [x] `SDK_CLIENT_ID` - VSCode拡張用クライアントID
- [x] `SDK_CLIENT_SECRET` - VSCode拡張用クライアントシークレット
- [x] `SDK_TOKEN_EXPIRY` - SDKトークン有効期限（例: "30d"）

## VSCode拡張機能環境変数

### API接続設定
- [x] `PORTAL_API_URL` - プロンプトポータルAPI URL（例: "http://localhost:3000/api"）
- [x] `CLIENT_ID` - クライアントID（APIアクセス用）
- [x] `CLIENT_SECRET` - クライアントシークレット（APIアクセス用）

### 認証設定
- [x] `TOKEN_STORAGE_PATH` - トークン保存パス（通常は自動設定）
- [x] `CHECK_INTERVAL` - 認証チェック間隔（秒単位、最大300秒=5分）

### プロンプト設定
- [x] `PROMPT_CACHE_SIZE` - キャッシュするプロンプトの最大数（例: "100"）
- [x] `ENABLE_OFFLINE_MODE` - オフラインモード有効化フラグ（"true" または "false"）
- [x] `PROMPT_CACHE_TTL` - プロンプトキャッシュのTTL（秒）

## ClaudeCode連携設定

- [x] `CLAUDE_CODE_PATH` - ClaudeCode実行ファイルパス（例: "/usr/local/bin/claude"）
- [x] `CLAUDE_INTEGRATION_ENABLED` - ClaudeCode連携の有効化フラグ（"true" または "false"）
- [x] `CLAUDE_MD_PATH` - CLAUDE.mdファイルの相対パス（例: "./CLAUDE.md"）

## フロントエンド設定

### React環境変数
- [x] `REACT_APP_API_URL` - バックエンドAPIのURL（例: "http://localhost:3000/api"）
- [x] `REACT_APP_AUTH_STORAGE_KEY` - 認証情報保存用キー（例: "appgenius_auth"）
- [x] `REACT_APP_VERSION` - フロントエンドのバージョン（例: "1.0.0"）
- [x] `REACT_APP_TOKEN_REFRESH_INTERVAL` - トークン自動更新間隔（ミリ秒）

### 認証設定
- [x] `REACT_APP_AUTH_TOKEN_EXPIRY` - トークン有効期限（秒）
- [x] `REACT_APP_AUTH_REFRESH_EXPIRY` - リフレッシュトークン有効期限（秒）
- [x] `REACT_APP_IDLE_TIMEOUT` - アイドルタイムアウト（秒）

### UI設定
- [x] `REACT_APP_PAGINATION_LIMIT` - ページネーション項目数（例: "10"）
- [x] `REACT_APP_NAME` - アプリケーション名（例: "AppGenius Portal"）
- [x] `REACT_APP_ENABLE_ADMIN_FEATURES` - 管理者機能有効化フラグ（"true" または "false"）
- [x] `REACT_APP_ENABLE_USER_REGISTRATION` - ユーザー登録有効化フラグ（"true" または "false"）
- [x] `REACT_APP_ENABLE_USAGE_MONITORING` - 使用量モニタリング有効化フラグ（"true" または "false"）
- [x] `REACT_APP_LOG_LEVEL` - ログレベル（"error", "warn", "info", "debug", "verbose"）
- [x] `REACT_APP_ENABLE_ANALYTICS` - 分析機能の有効化（true/false）
- [x] `REACT_APP_ENABLE_NOTIFICATIONS` - 通知機能の有効化（true/false）

## スコープ別環境変数リスト

### スコープ1: 認証Webアプリ基盤
- [x] `DB_HOST` - データベースホスト名
- [x] `DB_PORT` - データベースポート
- [x] `DB_NAME` - データベース名
- [x] `DB_USER` - データベースユーザー名
- [x] `DB_PASSWORD` - データベースパスワード
- [x] `JWT_SECRET` - JWT認証用シークレットキー
- [x] `JWT_EXPIRY` - JWTトークン有効期限
- [x] `REFRESH_TOKEN_SECRET` - リフレッシュトークン用シークレット
- [x] `REFRESH_TOKEN_EXPIRY` - リフレッシュトークン有効期限
- [x] `PORT` - APIサーバーポート
- [x] `CORS_ORIGIN` - CORS許可オリジン

### スコープ2: 管理ポータルUI
- [x] `REACT_APP_API_URL` - バックエンドAPIのURL
- [x] `REACT_APP_AUTH_STORAGE_KEY` - 認証情報保存キー名
- [x] `REACT_APP_VERSION` - フロントエンドのバージョン
- [x] `REACT_APP_AUTH_TOKEN_EXPIRY` - トークン有効期限（秒）
- [x] `REACT_APP_AUTH_REFRESH_EXPIRY` - リフレッシュトークン有効期限（秒）
- [x] `REACT_APP_IDLE_TIMEOUT` - アイドルタイムアウト（秒）
- [x] `REACT_APP_NAME` - アプリケーション名

### スコープ3: VSCode認証連携
- [x] `PORTAL_API_URL` - ポータルAPI URL
- [x] `CLIENT_ID` - クライアントID
- [x] `CLIENT_SECRET` - クライアントシークレット
- [x] `TOKEN_STORAGE_PATH` - トークン保存パス
- [x] `CHECK_INTERVAL` - 認証チェック間隔

### スコープ6: ClaudeCode連携
- [x] `CLAUDE_CODE_PATH` - ClaudeCode実行可能ファイルのパス
- [x] `CLAUDE_INTEGRATION_ENABLED` - ClaudeCode連携の有効化
- [x] `CLAUDE_MD_PATH` - CLAUDE.mdファイルの相対パス

## 設定例

### .env.example (バックエンド)
```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=appgenius_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=true

# JWT
JWT_SECRET=your_very_long_and_secure_secret_key_here
JWT_EXPIRY=1h
REFRESH_TOKEN_SECRET=another_very_long_and_secure_secret_key_here
REFRESH_TOKEN_EXPIRY=14d
PASSWORD_SALT_ROUNDS=8

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3001
LOG_LEVEL=info
CORS_METHODS=GET,POST,PUT,DELETE

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# SDK
SDK_CLIENT_ID=appgenius_vscode_client_29a7fb3e
SDK_CLIENT_SECRET=sk_8f2d61ae94c7b5829e3a150d7692fd84
SDK_TOKEN_EXPIRY=30d
```

### .env.example (フロントエンド)
```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_AUTH_STORAGE_KEY=appgenius_auth
REACT_APP_VERSION=1.0.0
REACT_APP_AUTH_TOKEN_EXPIRY=3600
REACT_APP_AUTH_REFRESH_EXPIRY=1209600
REACT_APP_IDLE_TIMEOUT=1800
REACT_APP_PAGINATION_LIMIT=10
REACT_APP_NAME=AppGenius Portal
REACT_APP_ENABLE_ADMIN_FEATURES=true
REACT_APP_ENABLE_USER_REGISTRATION=false
REACT_APP_ENABLE_USAGE_MONITORING=true
REACT_APP_LOG_LEVEL=info
REACT_APP_TOKEN_REFRESH_INTERVAL=300000
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true
```

### .env.example (VSCode拡張/ClaudeCode連携)
```
# VSCode拡張
PORTAL_API_URL=http://localhost:3000/api
CLIENT_ID=appgenius_vscode_client_29a7fb3e
CLIENT_SECRET=sk_8f2d61ae94c7b5829e3a150d7692fd84
TOKEN_STORAGE_PATH=
CHECK_INTERVAL=300

# プロンプト設定
PROMPT_CACHE_SIZE=100
ENABLE_OFFLINE_MODE=false
PROMPT_CACHE_TTL=86400

# ClaudeCode連携
CLAUDE_CODE_PATH=/Users/tatsuya/.nvm/versions/node/v18.20.6/bin/claude
CLAUDE_INTEGRATION_ENABLED=true
CLAUDE_MD_PATH=./CLAUDE.md
```

## 環境変数管理のベストプラクティス

1. **機密情報の保護**: `.env`ファイルは`.gitignore`に追加し、リポジトリにコミットしないこと
2. **環境ごとの設定**: 開発/テスト/本番環境ごとに別々の`.env`ファイルを用意すること
3. **最小権限の原則**: 各環境変数には必要最小限の権限のみを与えること
4. **環境変数の文書化**: すべての環境変数の目的と形式を文書化すること
5. **デフォルト値の提供**: 可能な場合は安全なデフォルト値を提供すること
6. **定期的な更新**: セキュリティ上の理由から定期的にシークレットを更新すること

## 環境変数の優先順位

1. プロセス環境変数（`process.env.*`）
2. `.env.local` ファイル
3. `.env` ファイル
4. デフォルト値（コード内で設定）

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

### セキュリティ上の注意点

1. 本番環境の環境変数をソースコードにハードコーディングしない
2. シークレットキーやパスワードをGitリポジトリにコミットしない
3. 環境変数のバックアップを安全な場所に保管する
4. 定期的にシークレットキーをローテーションする

## 環境変数設定の更新履歴

| 日付 | 更新内容 | 担当者 |
|------|----------|--------|
| 2025/03/12 | 初期設定 | AppGenius プロジェクトマネージャー |
| 2025/03/14 | 全環境変数設定完了 | 環境変数設定アシスタント |