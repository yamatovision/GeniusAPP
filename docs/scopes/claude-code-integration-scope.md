# ClaudeCode連携スコープ

## 目的

このスコープは、VSCode拡張とClaudeCode CLIとの連携を完成させることを目的としています。この連携により、VSCode拡張環境でClaudeCodeの機能を最大限に活用し、シームレスな開発体験を実現します。具体的には、認証情報の共有、コマンド実行インターフェース、CLAUDE.md同期、そして結果表示の改善に焦点を当てます。

## 背景

このプロジェクトはすでに以下の部分が実装されています：

- 基本的なVSCode拡張機能フレームワーク
- 認証基盤（AuthenticationService, TokenManager）
- VSCode側の認証UI（LoginWebviewPanel, AuthStatusBar）
- 環境変数アシスタント

ClaudeCodeとの連携はまだ完全には実装されておらず、このスコープで実装する必要があります。

## 主要なタスク

### 1. ClaudeCode統合サービスの実装

- **ClaudeCodeIntegrationServiceの実装**
  - ClaudeCode CLIの検出と起動
  - コマンド実行機能の提供
  - 結果取得とパース
  - エラーハンドリング

- **ClaudeCodeLauncherServiceの実装**
  - 適切な環境でのClaudeCode起動
  - 環境変数の適切な設定
  - パスの自動検出と設定
  - アップデート確認

- **CLAUDE.md同期メカニズム**
  - CLAUDE.md内容の双方向同期
  - 更新検出と通知
  - 編集機能

### 2. 環境変数設定の完成

- **ClaudeCode関連の環境変数設定**
  - CLAUDE_CODE_PATH設定
  - CLAUDE_INTEGRATION_ENABLED設定
  - CLAUDE_MD_PATH設定
  - 設定UXの改善

- **環境変数の検証と自動テスト**
  - ClaudeCodeへのアクセス検証
  - パス設定の正確性確認
  - エラー時の自動修正提案

### 3. UIインターフェースの実装

- **ClaudeCodeパネルの実装**
  - コマンド実行インターフェース
  - 結果表示ビュー
  - 履歴表示
  - レスポンシブデザイン

- **プロンプトセレクターの実装**
  - ポータルからのプロンプト選択UI
  - カスタムプロンプト作成
  - お気に入り管理
  - プロンプト検索

### 4. プロキシとセキュリティ管理

- **ProxyManagerの実装**
  - APIリクエストのプロキシ処理
  - 認証ヘッダー自動付与
  - リクエスト制限とキャッシュ
  - エラー処理と再試行

- **SecureStorageManagerの実装**
  - セキュアな設定・トークン保存
  - 暗号化の適用
  - 権限管理
  - セキュリティ監査

## 実装対象ファイル

1. **新規ファイル**
   - `/src/services/ClaudeCodeIntegrationService.ts` - ClaudeCode連携の中核
   - `/src/services/ClaudeCodeLauncherService.ts` - ClaudeCode起動機能
   - `/src/utils/ProxyManager.ts` - API通信のプロキシ管理
   - `/src/utils/SecureStorageManager.ts` - 安全な設定保存
   - `/src/ui/claudeCode/ClaudeCodePanel.ts` - ClaudeCode操作UI
   - `/src/ui/claudeCode/PromptSelector.ts` - プロンプト選択UI
   - `/webviews/claudeCode/index.html` - Webビュー HTML
   - `/webviews/claudeCode/script.js` - Webビュー JavaScript
   - `/webviews/claudeCode/style.css` - Webビュー CSS
   - `/test/unit/claudeCode/integration.test.ts` - 単体テスト

2. **更新ファイル**
   - `/src/extension.ts` - ClaudeCode機能の登録
   - `/src/services/AuthEventBus.ts` - 認証連携の強化
   - `/src/ui/CommandHandler.ts` - コマンド処理の拡張
   - `/docs/env.md` - 環境変数ドキュメントの更新

## アクセプタンス基準

1. **ClaudeCode連携**
   - VSCode内からClaudeCodeが正常に起動できる
   - コマンドを送信し、結果を表示できる
   - エラー時に適切なフィードバックがある
   - 起動失敗時に問題解決のガイダンスが表示される

2. **CLAUDE.md同期**
   - VSCode内でCLAUDE.mdを編集でき、その変更がClaudeCodeで認識される
   - ClaudeCodeによる変更がVSCode側に反映される
   - 競合が検出され、解決のガイダンスが提供される

3. **環境変数設定**
   - ClaudeCodeの場所が自動検出される
   - 環境変数がUI経由で設定できる
   - 設定は安全に保存され、起動時に読み込まれる
   - 無効な設定に対して明確なフィードバックがある

4. **UI体験**
   - ClaudeCodeパネルが使いやすく、直感的である
   - レスポンスが適切に表示され、長文も適切に処理される
   - 履歴が保存され、過去の会話を参照できる
   - ライト/ダークテーマに適切に対応している

## ユーザーストーリー

1. **開発者として、**
   - VSCode内からClaudeCodeを起動し、コマンドを実行できる
   - 認証状態が自動的にClaudeCodeと共有され、再ログインする必要がない
   - CLAUDE.mdをVSCodeで編集でき、その変更が即座にClaudeCodeに反映される
   - ポータルで管理されているプロンプトをVSCode内から簡単に選択し使用できる

2. **プロジェクト管理者として、**
   - チーム共有のCLAUDE.mdの一貫性を維持できる
   - プロンプトライブラリを一元管理し、チームメンバーに提供できる
   - 統合環境での利用状況を監視できる

## 実装の注意点

1. **パフォーマンス**
   - ClaudeCodeの起動は非同期で行い、UIをブロックしない
   - 大きなレスポンスも効率的に処理する
   - キャッシュを適切に使用して不要な再読み込みを避ける

2. **エラー処理**
   - ClaudeCodeが見つからない場合の明確なガイダンス
   - 実行エラー時の詳細な情報提供
   - 接続問題の適切な処理と自動リトライ

3. **開発環境**
   - 複数のOSプラットフォーム（Windows、macOS、Linux）対応
   - プロキシ環境での適切な動作
   - 異なるClaudeCodeバージョンとの互換性

## 見積もり

- 工数: 4人日
- 優先度: 高（認証連携スコープの後）