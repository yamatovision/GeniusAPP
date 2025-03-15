# 環境変数設定完成スコープ

## 目的

このスコープは、AppGenius VSCode拡張と中央ポータルの連携に必要な環境変数の設定を完成させ、さまざまなコンポーネント間のシームレスな統合を実現することを目的としています。特に、クライアントIDとシークレットの発行・設定、ClaudeCode連携用環境変数の設定、そして環境変数の検証機能に焦点を当てます。

## 背景

プロジェクトはすでに以下の部分が実装されています：

- 環境変数アシスタントの基本UI（EnvironmentVariablesAssistantPanel.ts）
- 環境変数管理サービス（EnvironmentVariablesService.ts）
- 多くの基本的な環境変数の設定（DB接続、JWT関連、ポート設定など）

しかし、完全な連携のために必要な以下の環境変数はまだ設定されていません：
- VSCode認証用: CLIENT_ID, CLIENT_SECRET
- クライアントSDK用: SDK_CLIENT_ID, SDK_CLIENT_SECRET, SDK_TOKEN_EXPIRY
- ClaudeCode連携用: CLAUDE_CODE_PATH, CLAUDE_INTEGRATION_ENABLED, CLAUDE_MD_PATH
- プロンプトキャッシュ用: PROMPT_CACHE_SIZE, ENABLE_OFFLINE_MODE, PROMPT_CACHE_TTL

## 主要なタスク

### 1. クライアントID/シークレットの設定

- **クライアントIDとシークレットの生成機能**
  - 安全なIDとシークレットの自動生成
  - 有効期限と権限の適切な設定
  - 生成された値の安全な保存
  - 生成フローのユーザー体験最適化

- **SDK関連環境変数の設定UI**
  - SDK_CLIENT_ID, SDK_CLIENT_SECRET入力UI
  - SDK_TOKEN_EXPIRYの設定と説明
  - 設定値の検証機能
  - 設定状態の視覚的フィードバック

- **認証設定の自動連携**
  - 設定された値の認証サービスへの自動適用
  - ポータルとの接続テスト
  - 問題発生時の診断と修正提案
  - 設定変更時の再接続処理

### 2. ClaudeCode連携環境変数の設定

- **ClaudeCodeパス自動検出**
  - 各OS（Windows、macOS、Linux）でのClaudeCode実行ファイル検出
  - バージョン検証と互換性チェック
  - PATH環境変数からの検出
  - 手動入力のサポート

- **ClaudeCode連携設定UI**
  - CLAUDE_INTEGRATION_ENABLEDトグル
  - CLAUDE_CODE_PATHの入力と検証
  - CLAUDE_MD_PATHの設定と説明
  - 設定状態の視覚的表示

- **連携動作確認**
  - ClaudeCodeへのテスト呼び出し
  - 応答の検証
  - エラー時の詳細診断
  - 設定修正の提案

### 3. プロンプトキャッシュ設定

- **キャッシュ設定UI**
  - PROMPT_CACHE_SIZEスライダー
  - ENABLE_OFFLINE_MODEトグル
  - PROMPT_CACHE_TTL設定
  - 推奨値の提示

- **キャッシュ動作設定**
  - ストレージ使用量の計算と表示
  - キャッシュクリア機能
  - 同期スケジュール設定
  - キャッシュ状態の診断

### 4. 環境変数検証と自動テスト

- **環境変数検証機能**
  - すべての設定値の形式と内容の検証
  - 関連する値間の整合性チェック
  - セキュリティリスクの検出
  - 推奨設定との比較

- **自動接続テスト**
  - データベース接続テスト
  - 認証APIテスト
  - プロンプトAPIテスト
  - ClaudeCode連携テスト

- **問題解決アシスタント**
  - エラーの明確な説明
  - 解決手順の提案
  - 自動修正オプション
  - トラブルシューティングガイド

## 実装対象ファイル

1. **新規ファイル**
   - `/src/services/EnvironmentVariablesValidator.ts` - 環境変数検証サービス
   - `/src/services/ConnectionTester.ts` - 接続テストサービス
   - `/webviews/environmentVariables/clientSetup.js` - クライアントID設定UI
   - `/webviews/environmentVariables/claudeCodeSetup.js` - ClaudeCode設定UI
   - `/webviews/environmentVariables/testResults.js` - テスト結果表示UI

2. **更新ファイル**
   - `/src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts` - 機能拡張
   - `/src/services/EnvironmentVariablesService.ts` - サービス機能強化
   - `/webviews/environmentVariables/index.html` - UI拡張
   - `/webviews/environmentVariables/script.js` - 機能追加
   - `/webviews/environmentVariables/style.css` - スタイル更新
   - `/docs/env.md` - 環境変数ドキュメント更新

## アクセプタンス基準

1. **環境変数設定**
   - すべての必要な環境変数が設定可能になっている
   - 設定値が適切に検証される
   - 設定状態が視覚的に明確に表示される
   - 設定エラーに対する明確なフィードバックが提供される

2. **クライアントID/シークレット**
   - 安全なクライアントIDとシークレットが生成できる
   - 生成された値が正しく保存される
   - ポータルとの認証連携が動作する
   - 有効期限と権限が適切に設定される

3. **ClaudeCode連携**
   - ClaudeCodeのパスが自動検出される
   - 連携設定が正しく機能する
   - CLAUDE.mdパスが適切に設定される
   - 設定後に実際の連携が動作する

4. **検証とテスト**
   - すべての設定値が自動的に検証される
   - 接続テストが正確に実行される
   - テスト結果が明確に表示される
   - 問題が検出された場合に解決手順が提示される

## ユーザーストーリー

1. **開発者として、**
   - 認証連携に必要なクライアントIDとシークレットを簡単に設定できる
   - ClaudeCodeとの連携設定を直感的に行える
   - 設定に問題があった場合、明確なエラーメッセージと解決策を得られる
   - すべての環境変数の設定状態を一目で把握できる

2. **プロジェクト管理者として、**
   - チームのためのクライアントIDとシークレットを安全に管理できる
   - 環境変数の設定状態を定期的に検証できる
   - すべての連携が正しく機能していることを確認できる
   - 環境設定に関する問題をすばやく特定し解決できる

3. **非技術者として、**
   - 難解な環境変数設定を、ガイド付きのUI経由で完了できる
   - 専門的な知識なしで接続テストを実行できる
   - 何が問題かを明確に理解し、解決策を見つけられる
   - 環境設定の全体像を視覚的に把握できる

## 実装の注意点

1. **セキュリティ**
   - 生成されたシークレットの安全な保存
   - 環境変数ファイルの適切なアクセス制御
   - 機密情報の表示時のマスキング
   - 安全なデフォルト値の提供

2. **ユーザビリティ**
   - 技術用語を最小限に抑えた明確な説明
   - ステップバイステップのガイダンス
   - 直感的なUI要素とフィードバック
   - エラーメッセージの平易な表現

3. **クロスプラットフォーム**
   - Windows、macOS、Linuxでの動作確認
   - OS固有のパス規則への対応
   - 異なる環境での自動検出戦略
   - プラットフォーム固有の問題への対処

4. **テスト戦略**
   - 異なる設定組み合わせのテスト
   - エラー状態からの回復テスト
   - パフォーマンス（特に自動検出）の検証
   - 実際の連携シナリオでのエンドツーエンドテスト

## 見積もり

- 工数: 3人日
- 優先度: 高（認証連携スコープと並行）