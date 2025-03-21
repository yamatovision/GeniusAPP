# VSCode-認証連携テスト・完成スコープ

## 目的

このスコープは、VSCode拡張と中央認証ポータルの連携を完成させることを目的としています。基本的な認証機能と連携の土台はすでに実装されていますが、完全な連携、エラー処理の強化、ユーザー体験の改善、そして包括的なテストを行う必要があります。

## 背景

プロジェクトはすでに以下の部分が実装されています：
- 認証基盤（AuthenticationService, TokenManager）
- VSCode側の認証UI（LoginWebviewPanel, AuthStatusBar）
- ポータル側の認証API（auth.controller.js, auth.service.js）
- 基本的なトークン管理

このスコープでは、これらのコンポーネント間の連携を強化し、完全なエンドツーエンドのテストを行います。

## 主要なタスク

### 1. 認証連携の完成

- **AuthEventBusの実装完了と連携強化**
  - サービス間での認証状態変更イベントの適切な伝播
  - 認証状態の一貫性確保
  - ログイン/ログアウト時の全コンポーネント間の適切な同期

- **ClaudeCodeAuthSyncの実装完成**
  - VSCodeとClaudeCode CLI間での認証情報の共有
  - 認証状態の同期メカニズム
  - トークンの安全な共有方法

- **プロキシマネージャーの実装**
  - API呼び出しの安全な仲介
  - 適切なヘッダー処理
  - リクエスト/レスポンスの統一的な処理

### 2. 環境変数の設定と検証

- **クライアントID/シークレットの生成と設定**
  - 安全なクライアントID/シークレットの生成
  - VSCode拡張への設定プロセス
  - 設定値の検証

- **セキュリティ設定の強化**
  - アクセストークンとリフレッシュトークンの適切な有効期限設定
  - トークン保管方法の安全性確認
  - セキュリティ設定の文書化

### 3. エラー処理の強化

- **認証エラーハンドリングの改善**
  - トークン無効時の適切な処理
  - ネットワークエラーの安全な処理
  - ユーザーへの明確なフィードバック

- **リトライメカニズムの実装**
  - 一時的な接続問題の自動リカバリ
  - 指数バックオフによるリトライ
  - リフレッシュトークンを使った自動再認証

### 4. テスト実装

- **単体テスト**
  - AuthenticationServiceのテスト
  - TokenManagerのテスト
  - AuthEventBusのテスト

- **統合テスト**
  - VSCodeとポータル間の認証フローテスト
  - エラーシナリオのテスト
  - 認証状態同期のテスト

- **セキュリティテスト**
  - 脆弱性のチェック
  - アクセス制御の検証
  - トークン漏洩シナリオのテスト

## 実装対象ファイル

1. **新規ファイル**
   - `/src/services/AuthEventBus.ts` - 認証状態の変更を監視・通知するイベントバス
   - `/src/services/ClaudeCodeAuthSync.ts` - ClaudeCodeとの認証情報同期サービス
   - `/src/utils/ProxyManager.ts` - API通信のプロキシ管理
   - `/test/unit/auth/authenticationService.test.ts` - 認証サービスのテスト
   - `/test/integration/auth/authFlow.test.ts` - 認証フローの統合テスト

2. **更新ファイル**
   - `/src/core/auth/AuthenticationService.ts` - エラー処理とリトライロジックの追加
   - `/src/core/auth/TokenManager.ts` - セキュリティ強化とテスト容易性の改善
   - `/src/ui/auth/AuthStatusBar.ts` - エラー表示の改善
   - `/src/ui/auth/LoginWebviewPanel.ts` - ユーザーフィードバックの強化

## アクセプタンス基準

1. **認証フロー**
   - VSCode拡張からポータルに正常にログインできる
   - 認証状態がVSCode全体で一貫して維持される
   - トークン失効時に自動的にリフレッシュする
   - ログアウト時にすべてのトークンが正しく削除される

2. **エラー処理**
   - ネットワークエラー時に適切なメッセージが表示される
   - 無効な認証情報に対して明確なフィードバックがある
   - サーバーエラー時に適切なリカバリーが行われる

3. **セキュリティ**
   - トークンはセキュアに保存される
   - 機密情報はログに出力されない
   - アクセス制御が適切に実装されている

4. **テスト**
   - すべての単体テストが成功する
   - 統合テストで認証フローが検証できる
   - エッジケースとエラーケースがテストでカバーされている

## ユーザーストーリー

1. **開発者として、**
   - VSCode拡張にログインすると、即座に認証状態が反映されて機能が利用可能になる
   - トークンが期限切れになった場合でも、シームレスに再認証される
   - 認証エラーが発生した場合に明確な理由と対処法が示される

2. **管理者として、**
   - ユーザーの認証状態をリモートで変更すると、即座にVSCode拡張に反映される
   - 認証試行と成功/失敗の記録が適切に残る
   - セキュリティ設定を一元管理できる

## 実装の注意点

1. **セキュリティ**
   - トークンの保管には必ずVSCodeのSecrets APIを使用する
   - 通信は常にHTTPSで行う
   - 機密情報のログ出力を避ける

2. **エラー処理**
   - すべてのエラーに対して適切なユーザーフィードバックを提供する
   - デバッグ情報と利用者向け情報を適切に分離する
   - 回復可能なエラーは自動的にリトライする

3. **テスト**
   - モックを適切に使用して外部依存を分離する
   - エッジケースと異常系のテストを充実させる
   - テスト環境と本番環境の分離を確保する

## 見積もり

- 工数: 3人日
- 優先度: 高（他のスコープの前提条件）