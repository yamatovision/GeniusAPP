AppGenius ClaudeCode プロキシシステム実装引継ぎマニュアル

  1. 実装概要

  目的: ユーザー認証状態とロールに基づいて、ClaudeCode API利用を制限
  するシステムを実装しました。管理者がポータルでユーザーごとにAPI利
  用権限をON/OFFでき、利用量を追跡できるようになっています。

  主な機能:
  -
  未認証ユーザーとunsubscribeロールのユーザーはClaudeCodeを使用不可
  - 管理者はユーザーのAPIアクセス権限を管理可能
  - ユーザー・管理者がトークン使用量を確認可能

  2. 変更ファイル一覧

  2.1 VSCode拡張側

  - /src/services/ClaudeCodeIntegrationService.ts -
  ClaudeCode利用制御を追加

  2.2 ポータル（バックエンド）側

  - /portal/backend/middlewares/usage-limit.middleware.js -
  ロールベースのアクセス制御を追加
  - /portal/backend/models/apiUsage.model.js -
  トークン使用量取得関数を追加
  - /portal/backend/controllers/user.controller.js -
  APIアクセス設定・トークン使用量表示機能を追加
  - /portal/backend/routes/user.routes.js -
  API権限制御エンドポイント追加
  - /portal/backend/routes/api-proxy.routes.js -
  APIプロキシルート設定

  3. テスト環境構築手順

  3.1 MongoDB接続準備

  1. MongoDB接続用の環境変数を設定（.envファイル）
  MONGODB_URI=mongodb://localhost:27017/appgenius

  2. テスト用ユーザーの作成
  cd portal
  node scripts/create-test-user.js --role=admin
  --email=admin@example.com
  node scripts/create-test-user.js --role=user
  --email=user@example.com
  node scripts/create-test-user.js --role=unsubscribe
  --email=unsubscribed@example.com

  3.2 APIプロキシシステム設定

  1. Anthropic APIキーを設定
  ANTHROPIC_API_KEY=your_api_key_here

  2. サーバーを起動
  cd portal
  npm run dev

  4. 機能テスト手順

  4.1 認証連携テスト

  1. VSCode拡張でログイン
    - adminユーザーでログイン → ClaudeCode起動可能なことを確認
    - userユーザーでログイン → ClaudeCode起動可能なことを確認
    - unsubscribedユーザーでログイン →
  ClaudeCode起動不可なことを確認
    - ログアウト → ClaudeCode起動不可なことを確認
  2. API権限設定テスト
    - 管理者アカウントでポータルにログイン
    - ユーザー管理画面でユーザーを選択
    - APIアクセス設定をOFF →
  VSCode拡張でそのユーザーがClaudeCodeを起動できないことを確認
    - APIアクセス設定をON →
  VSCode拡張でそのユーザーがClaudeCodeを起動できることを確認

  4.2 トークン使用量追跡テスト

  1. ClaudeCodeを使用してAPIリクエストを発生させる
  2. ポータル管理画面で対象ユーザーのトークン使用量を確認
  3. 使用量が正しく記録・更新されていることを確認

  5. エンドポイント仕様

  6. 既知の問題と改善点

  1. テスト環境のモック改善
    - 実際のMongoDBを使用したテストを実装する必要があります
    - テスト用DBインスタンスの自動セットアップ機能があると便利です
  2. 使用量制限の強化
    - 使用量上限に達した場合のUI通知機能が必要
    - 日次・月次など期間別の使用量グラフ表示があると便利
  3. 権限システムのさらなる強化
    - より細かな機能単位でのアクセス制御
    - 複数のロールタイプの追加対応

  7. テストコマンド

  # 基本テスト（実際のDBに接続して実行）
  cd portal
  npm run test:api

  # APIプロキシシステムのテスト
  NODE_ENV=test npm run test:proxy

  # VSCode拡張のクリーンビルド
  cd ..
  npm run clean
  npm run compile

  8. デバッグ方法

  問題が発生した場合は以下の点を確認してください：

  1. MongoDB接続が正常に機能しているか
  cd portal
  node scripts/check-mongodb-user.js
  2. ログファイルでエラーを確認
  cat portal/logs/error.log
  3. ポータルAPI応答を確認（認証後）
  curl -H "Authorization: Bearer {your_token}"
  http://localhost:3000/api/users/token-usage

  APIアクセス設定やトークン使用量追跡で問題が発生した場合は、まず認
  証状態を確認し、APIエンドポイントの応答を直接テストすることでデバ
  ッグを進めてください。