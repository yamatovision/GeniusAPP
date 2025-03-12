# AppGenius認証・APIプロキシシステム 要件定義書

## 1. 機能概要

### 目的と主な機能
AppGenius VSCode拡張機能のための統合認証システムとAPIプロキシを構築し、中央プロンプト管理およびAPIアクセス制御を実現します。この統合システムにより、AppGenius VSCode拡張機能とClaudeCode CLIの利用認証を一元的に管理し、ユーザーの状態変更（退会・削除など）に応じた即時アクセス制御を行います。さらに、単一のAnthropicマスターAPIキーを使用して複数ユーザーのアクセスを管理し、プランベースの使用量制限や課金管理を実現します。また、プロンプト中央管理システムとの緊密な連携により、ユーザー権限に応じたプロンプトアクセス制御も提供します。

### 全体要件との関連性
- 中央プロンプト管理システムのユーザーアカウントと統合認証基盤
- VSCode拡張機能内の各機能へのアクセス制御
- ClaudeCode CLIとの認証情報共有と同期
- ユーザー状態変更時の強制ログアウト機能
- AnthropicのAPI使用量のプランベース管理と制限
- トークン使用状況の視覚的表示と監視
- プロンプトライブラリへの差別的アクセス制御
- APIアクセスの即時無効化機能

### 想定ユーザーと役割
- **一般ユーザー**（AppGenius VSCode拡張機能利用者）
  - 基本的なAPIアクセスとプロンプト利用
  - 使用量モニタリング
  - 個人設定の管理

- **上級ユーザー**（拡張プロンプト利用者）
  - 拡張プロンプトセットへのアクセス
  - 高度な機能の利用
  - 柔軟なトークン割り当て

- **管理者**（システム管理者）
  - ユーザー管理とアクセス制御
  - 使用量設定と監視
  - 課金管理とレポート生成
  - プランとトークン割り当て管理

### 主要ユースケース

#### エンドユーザー向け
1. ユーザーがVSCode拡張機能にログインし、認証情報を取得する
2. ユーザーがVSCode拡張機能内でClaudeAPIを利用し、リアルタイムの使用量を確認する
3. ユーザーがClaudeCode CLIを同じ認証情報で利用し、一貫した使用量カウントを得る
4. ユーザーが中央プロンプト管理システムとシームレスに連携する
5. ユーザーが権限レベルに応じたプロンプトカテゴリにアクセスする
6. ユーザーがトークン使用量の上限に近づくと通知を受け取る
7. ユーザーが自身の使用統計と履歴を確認する

#### 管理者向け
8. 管理者が新規ユーザーを登録し、初期プランとアクセス権限を設定する
9. 管理者がユーザーのプランとトークン制限を変更する
10. 管理者がユーザーのプロンプトアクセスレベルを変更する
11. 管理者がユーザーのAPI状態を変更し、即時アクセス制御を行う
12. 管理者がユーザーのトークン使用量をリセットする
13. 管理者が使用量レポートを生成し、コスト分析を行う
14. 管理者が異常な使用パターンの通知を受け取り、対処する

## 2. UI要素の詳細

### 各画面の構成要素

#### VSCode拡張機能認証画面
- Webビューベースのログインフォーム
- メールアドレス入力フィールド
- パスワード入力フィールド
- ログインボタン
- パスワードリセットリンク
- ログイン状態インジケーター

#### 認証状態表示
- VSCodeステータスバーでの認証状態表示
- 認証状態アイコン（ログイン中/未ログイン）
- ユーザー名表示
- 使用量表示（オプション）

#### 管理者ダッシュボード
- ユーザー一覧と状態表示
- アカウント有効/無効切り替え
- 使用量制限設定
- 使用状況レポート
- アクティビティログ

### 入力フィールドと検証ルール
- メールアドレス：有効なメール形式
- パスワード：8文字以上
- 入力フィールドのリアルタイムバリデーション

### ボタンとアクション
- 「ログイン」：認証情報を検証し、成功時にトークンを保存
- 「ログアウト」：認証情報を削除し、利用制限を有効化
- 「再ログイン」：強制ログアウト後の再認証フロー開始
- 「使用量確認」：現在の使用量と制限を表示

### レスポンシブ対応の要件
- VSCode拡張のWebビュー内での適切な表示
- 異なるテーマ（ライトモード/ダークモード）対応
- 様々な画面サイズに対応したレイアウト

### 既存UIコンポーネントの再利用
- VSCodeのWebビューAPI活用
- 既存のVSCode UI要素との統一感

## 3. データ構造と連携

### 扱うデータの種類と形式

#### ユーザー情報
```json
{
  "id": "string",
  "email": "string",
  "displayName": "string",
  "status": "enum(active, inactive, suspended)",
  "role": "enum(user, advanced, admin)",
  "apiStatus": "enum(enabled, disabled)",
  "promptAccessLevel": "enum(basic, advanced, all)",
  "plan": {
    "type": "enum(basic, standard, premium, custom)",
    "tokenLimit": "number",
    "tokenUsed": "number",
    "lastResetDate": "datetime",
    "nextResetDate": "datetime"
  },
  "createdAt": "datetime",
  "lastLoginAt": "datetime",
  "lastApiAccessAt": "datetime"
}
```

#### 認証トークン
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresAt": "datetime",
  "userId": "string"
}
```

#### API使用量データ
```json
{
  "userId": "string",
  "periodStart": "datetime",
  "periodEnd": "datetime",
  "tokenLimit": "number",
  "tokensUsed": "number",
  "usageHistory": [
    {
      "date": "datetime",
      "tokensUsed": "number",
      "requestCount": "number"
    }
  ]
}
```

#### ユーザー設定
```json
{
  "userId": "string",
  "tokenLimit": "number",
  "notifications": {
    "usageWarning": "boolean",
    "usageThreshold": "number", // 例: 0.8 (80%)
    "emailNotifications": "boolean"
  }
}
```

### 既存データモデルとの関連
- 中央プロンプト管理システムのユーザーモデルと連携
- プロジェクト設定情報との連携（プロジェクト権限）

### データの永続化要件
- ユーザー情報と認証状態のデータベース保存
- VSCodeのSecrets APIを使用した認証情報の安全な保存
- 使用量データの長期保存と集計機能
- データバックアップと復元メカニズム

## 4. API・バックエンド連携

### 必要なAPIエンドポイント

#### 認証関連
- `POST /api/auth/login` - ログイン認証
- `POST /api/auth/refresh` - トークンリフレッシュ
- `POST /api/auth/verify` - トークン検証
- `POST /api/auth/logout` - ログアウト

#### API利用関連
- `POST /api/claude/chat` - Claude APIプロキシエンドポイント
- `GET /api/usage/current` - 現在の使用量取得
- `GET /api/usage/history` - 使用履歴取得

#### 管理者機能
- `GET /api/admin/users` - ユーザー一覧取得
- `POST /api/admin/users` - ユーザー新規登録
- `GET /api/admin/users/{userId}` - ユーザー詳細取得
- `PUT /api/admin/users/{userId}/status` - ユーザー状態変更
- `PUT /api/admin/users/{userId}/api-status` - API状態変更
- `PUT /api/admin/users/{userId}/prompt-access` - プロンプトアクセス権限変更
- `PUT /api/admin/users/{userId}/plan` - プラン変更
- `PUT /api/admin/users/{userId}/token-limit` - トークン上限変更
- `POST /api/admin/users/{userId}/reset-usage` - 使用量リセット
- `GET /api/admin/usage/report` - 使用量レポート生成
- `GET /api/admin/usage/user/{userId}` - ユーザー別使用量詳細
- `GET /api/admin/plans` - 利用可能プラン一覧取得
- `POST /api/admin/plans` - 新規プラン作成
- `PUT /api/admin/plans/{planId}` - プラン更新

### リクエスト/レスポンス形式
- リクエスト/レスポンスはJSON形式
- エラーレスポンスは以下の形式で統一
```json
{
  "error": true,
  "message": "エラーメッセージ",
  "code": "ERROR_CODE",
  "action": "required_action"
}
```

### 必要な環境変数リスト
- `AUTH_API_ENDPOINT` - 認証APIのベースURL
- `AUTH_SECRET_KEY` - トークン生成用の秘密鍵
- `AUTH_TOKEN_EXPIRATION` - トークン有効期限（秒）
- `AUTH_REFRESH_TOKEN_EXPIRATION` - リフレッシュトークン有効期限（秒）

- `ANTHROPIC_API_KEY` - マスターAPIキー
- `ANTHROPIC_API_ENDPOINT` - Anthropic API エンドポイント
- `ANTHROPIC_API_VERSION` - 使用API バージョン

- `PROMPT_LIBRARY_ENDPOINT` - プロンプトライブラリAPIエンドポイント
- `PROMPT_LIBRARY_API_KEY` - プロンプトライブラリ連携キー

- `DEFAULT_TOKEN_LIMIT_BASIC` - 基本プランのデフォルトトークン制限値
- `DEFAULT_TOKEN_LIMIT_STANDARD` - 標準プランのデフォルトトークン制限値
- `DEFAULT_TOKEN_LIMIT_PREMIUM` - プレミアムプランのデフォルトトークン制限値
- `TOKEN_RESET_INTERVAL` - トークンリセット間隔（日数）

- `USAGE_WARNING_THRESHOLD` - 使用量警告閾値（%、例:80）
- `USAGE_CRITICAL_THRESHOLD` - 使用量危険閾値（%、例:95）
- `USAGE_NOTIFICATION_EMAIL` - 使用量通知メールアドレス

- `DB_CONNECTION_STRING` - データベース接続文字列
- `REDIS_CONNECTION_STRING` - キャッシュ用Redis接続文字列
- `LOG_LEVEL` - ログレベル設定

## 5. 実装詳細

### 認証フロー
1. VSCode拡張/ClaudeCode CLI起動時に認証状態を確認
2. 未認証の場合、ログインフォームを表示（VSCode）またはコマンドラインログインを促す（CLI）
3. 認証成功時、アクセストークンとリフレッシュトークンを安全に保存
4. 定期的なトークン検証と必要に応じたリフレッシュ
5. トークン失効時の自動再認証または強制ログアウト

### APIプロキシシステム
1. ユーザーはAnthropicと直接通信せず、すべてのAPIリクエストをプロキシサーバー経由
2. プロキシサーバーがユーザー認証と使用量チェックを実施
3. 認証/制限問題なしの場合、マスターAPIキーを使用してAnthropicに要求を転送
4. 使用量をカウントし、データベースに記録
5. 応答をユーザーに返送

### 強制ログアウトメカニズム
1. アクティブなUI操作時にトークン検証を実行（5分間隔）
2. API呼び出し前にトークン検証を実行
3. サーバーからのトークン無効化応答を検出
4. 無効化理由に応じたユーザーへの通知
5. ログアウト処理の実行とUI状態の更新
6. すべてのオープンWebビューと機能へのアクセスをブロック

### 使用量管理システム
1. 各APIリクエストの入出力トークン数を計算
2. ユーザーごとの使用量を集計
3. 設定された制限と比較し、超過時にはアクセスをブロック
4. 制限到達前（80%など）に警告通知
5. 管理者向けの使用量レポートと分析ダッシュボード

### エラーハンドリング
1. ネットワークエラー時の適切なフォールバック
2. 認証失敗時の具体的なエラーメッセージ表示
3. リトライメカニズムとエクスポネンシャルバックオフ
4. オフライン状態時の限定機能アクセス

## 6. 実装ファイルリスト

### VSCode拡張側

#### 認証コア
- `/src/core/auth/authService.ts` - 認証サービスの中核機能
- `/src/core/auth/tokenManager.ts` - トークン管理と検証
- `/src/core/auth/authStorage.ts` - 認証情報の安全な保存
- `/src/core/auth/permissionManager.ts` - 権限管理と機能制限

#### API連携
- `/src/api/claudeProxyClient.ts` - APIプロキシクライアント
- `/src/api/usageClient.ts` - 使用量API連携
- `/src/api/authClient.ts` - 認証API連携
- `/src/api/promptLibraryClient.ts` - プロンプトライブラリAPI連携

#### UI コンポーネント
- `/src/ui/auth/LoginWebviewPanel.ts` - ログインWebビュー
- `/src/ui/auth/AuthStatusBar.ts` - ステータスバー表示
- `/src/ui/auth/LogoutNotification.ts` - ログアウト通知
- `/src/ui/auth/UsageIndicator.ts` - 使用量表示コンポーネント
- `/src/ui/promptLibrary/PromptSelector.ts` - プロンプトライブラリ選択UI
- `/src/ui/promptLibrary/PromptBrowser.ts` - プロンプト閲覧インターフェース

#### 連携コンポーネント
- `/src/services/AuthEventBus.ts` - 認証イベント管理
- `/src/services/ClaudeCodeAuthSync.ts` - ClaudeCode連携
- `/src/middleware/authMiddleware.ts` - 認証状態確認ミドルウェア
- `/src/services/UsageMonitor.ts` - 使用量監視サービス
- `/src/services/PromptLibrarySync.ts` - プロンプトライブラリ同期サービス
- `/src/services/PromptRecommendationService.ts` - プロンプト推奨サービス

### バックエンド側

#### 認証API
- `/server/controllers/authController.js` - 認証コントローラー
- `/server/services/tokenService.js` - トークン生成・検証サービス
- `/server/services/userService.js` - ユーザー管理サービス

#### APIプロキシ
- `/server/controllers/claudeProxyController.js` - Claude APIプロキシ
- `/server/services/anthropicService.js` - Anthropic API連携
- `/server/services/usageService.js` - 使用量管理サービス
- `/server/services/promptLibraryService.js` - プロンプトライブラリサービス
- `/server/controllers/promptApiController.js` - プロンプトAPI連携コントローラー

#### 管理機能
- `/server/controllers/adminController.js` - 管理者機能コントローラー
- `/server/services/reportService.js` - レポート生成サービス
- `/server/services/limitService.js` - 使用制限管理サービス
- `/server/controllers/promptLibraryAdminController.js` - プロンプト管理コントローラー
- `/server/services/promptMetricsService.js` - プロンプト使用統計サービス

### 各ファイルの役割と責任

#### authService.ts
- 認証APIとの通信
- ログイン/ログアウトフロー管理
- 認証状態の一元管理

#### tokenManager.ts
- トークンの安全な保存と取得
- トークンの有効期限管理
- リフレッシュトークンによる自動更新

#### claudeProxyClient.ts
- Claude APIへのリクエスト送信
- 認証トークンの自動付与
- エラーハンドリングとリトライロジック

#### usageClient.ts
- 使用量情報の取得
- 使用履歴の分析
- 制限到達通知の処理

#### LoginWebviewPanel.ts
- VSCode内のログインUI表示
- フォーム入力とバリデーション
- 認証フローのUI部分

#### UsageIndicator.ts
- 現在の使用量と制限の表示
- 使用量警告の視覚化
- 使用量詳細への導線

#### claudeProxyController.js
- APIリクエストの検証と認証確認
- リクエストのAnthropicへの転送
- レスポンスの処理と使用量記録
- エラーハンドリングとレスポンス形成

#### usageService.js
- トークン使用量の計算
- 使用統計の集計
- 制限管理と超過チェック
- レポート生成機能

## 7. セキュリティ要件

### 認証情報の保護
- VSCode Secrets APIを活用した認証情報の暗号化保存
- メモリ上のトークンの安全な管理
- セッションタイムアウトと自動ログアウト
- マスターAPIキーのサーバーサイドのみでの保持

### 通信セキュリティ
- すべての通信でHTTPS使用
- API呼び出しでのJWTトークン検証
- リクエストの改ざん検出
- レート制限によるブルートフォース攻撃対策

### アクセス制御
- 最小権限の原則に基づく機能制限
- ユーザー状態に応じた動的アクセス制御
- アクセス試行のログ記録
- 異常なアクセスパターンの検出

### プライバシー保護
- 最小限のユーザー情報のみ保存
- 利用統計の匿名化
- データ削除リクエストへの対応
- 個人情報保護法への対応

## 8. APIプロキシ管理機能

### ユーザー管理
1. **登録管理**:
   - 新規ユーザー登録機能
   - 一括ユーザーインポート
   - ロールベースのアクセス制御
   - APIアクセス権限管理

2. **状態管理**:
   - アカウント有効/無効切り替え
   - API状態（有効/無効）管理
   - 一時停止機能
   - 削除とデータクリーンアップ

3. **プロンプトアクセス制御**:
   - 権限レベル設定（基本/拡張/全て）
   - ユーザーごとのプロンプトカテゴリーアクセス管理
   - 特定プロンプトへのアクセス制限

### 使用量管理
1. **プラン・制限設定**:
   - 複数のトークンプラン（基本/標準/プレミアム）
   - ユーザーごとのカスタムトークン制限設定
   - グループ/部門ごとの割り当て
   - 動的な制限調整機能

2. **使用量監視**:
   - リアルタイム使用量表示（グラフィカル表示）
   - 使用率警告表示（閾値超過時の色分け）
   - 使用統計とトレンド分析
   - 使用パターン検出

3. **使用量管理**:
   - 使用量手動リセット機能
   - 定期的な自動リセット（月次/年次）
   - 上限到達時の通知と対応設定

4. **通知システム**:
   - 使用量閾値到達時の通知（80%/90%/100%）
   - 自動レポート生成（日次/週次/月次）
   - 異常使用検出アラート
   - ユーザーへの通知配信

### 課金管理
1. **料金プラン**:
   - 複数基本プラン（基本/標準/プレミアム）
   - 基本料金 + 従量課金モデル
   - カスタム料金設定
   - プラン自動切り替え設定

2. **請求処理**:
   - 使用量に基づく請求書生成
   - ユーザー/部門ごとの使用量詳細レポート
   - 決済連携（オプション）
   - 請求履歴管理と分析

### 管理者ダッシュボード
1. **システム概要**:
   - アクティブユーザー数
   - 総使用量
   - 異常検出

2. **詳細分析**:
   - ユーザー別使用パターン
   - 時間帯別アクティビティ
   - コスト分析

## 9. プロンプト中央管理システムとの連携

### 認証連携
1. **統合認証基盤**:
   - プロンプト中央管理システムと共通のユーザーデータベース
   - シングルサインオン（SSO）による統合認証
   - 権限と役割の同期

2. **認証状態同期**:
   - ユーザー状態変更のリアルタイム反映
   - ログイン/ログアウト状態の同期
   - アカウント無効化の即時伝播

### プロンプトアクセス制御
1. **権限管理**:
   - プロンプトライブラリへのアクセス権限と認証の連携
   - ユーザー役割に基づくプロンプト閲覧/編集権限
   - 組織/チーム単位でのプロンプト共有権限

2. **使用制限連携**:
   - プロンプト使用量のAPIトークン制限との連動
   - 高品質プロンプトへの差別的アクセス管理
   - プロンプトカテゴリごとの使用制限設定

### 分析と統計
1. **統合使用分析**:
   - プロンプト使用状況とAPI使用量の相関分析
   - ユーザーごとの効率性指標（トークン/タスク比）
   - コスト最適化レポート

2. **共有ダッシュボード**:
   - 認証システムとプロンプト管理の統合ビュー
   - クロスプラットフォーム活動追跡
   - プロンプト効率と使用コストの関連表示

### データ連携
1. **プロンプトメタデータ同期**:
   - プロンプト利用状況データの共有
   - 使用トークン数とプロンプト最適化の連携
   - 使用パターンによるプロンプト改善提案

2. **認証トークンの共有**:
   - VSCode、CLI、Webプラットフォーム間のトークン共有
   - マルチデバイスでの認証状態維持
   - 認証情報の安全な同期メカニズム

### API統合
1. **内部API連携**:
   - プロンプト管理システムと認証システム間の内部API
   - 高速・低レイテンシの特権API呼び出し
   - セキュアな内部通信チャネル

2. **イベント連携**:
   - システム間イベント発行と購読の仕組み
   - リアルタイムイベント通知
   - 状態変更の双方向同期

## 10. テスト要件

### 単体テスト
- 認証サービスの各機能テスト
- トークン管理の安全性テスト
- API転送機能テスト
- 使用量計算テスト

### 統合テスト
- 認証フロー全体のテスト
- APIプロキシの完全フローテスト
- 使用量制限機能テスト
- 強制ログアウト機能テスト

### セキュリティテスト
- トークン盗難シナリオテスト
- 権限昇格攻撃テスト
- セッションハイジャック対策テスト
- データ暗号化テスト

### パフォーマンステスト
- 高負荷時のレスポンス時間測定
- 多数同時接続テスト
- 長期安定性テスト

## 10. デプロイメント要件

### サーバー環境
- クラウドベースの可用性の高いホスティング
- コンテナ化（Docker）によるスケーラビリティ確保
- ロードバランシングによる負荷分散
- バックアップと災害復旧計画

### スケーラビリティ
- 水平スケーリング対応アーキテクチャ
- データベース分離とシャーディング対応
- キャッシング層の実装
- CDNによる静的リソース配信

### モニタリング
- リアルタイムシステム監視
- エラーログと分析
- パフォーマンスメトリクス収集
- アラート設定とインシデント対応プロセス

## 11. 承認

- 日付：2025年3月12日
- バージョン：1.0
- 承認者：AppGenius プロジェクトマネージャー