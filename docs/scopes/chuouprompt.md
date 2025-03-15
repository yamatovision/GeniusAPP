# 中央プロンプト管理システム 要件定義書

## 1. 機能概要

### 目的と主な機能
中央プロンプト管理システムは、AppGeniusエコシステム内でプロンプトを一元管理し、ユーザーアクセスを制御するWebアプリケーションです。このシステムにより、プロンプトの作成・管理・共有が効率化され、ClaudeCodeとの連携が強化されます。

### 全体要件との関連性
- VSCodeの拡張機能やClaudeCodeとは独立したシステムとして動作
- ClaudeCodeはこのシステムからのプロンプト情報URLを参照する形で連携
- ユーザー認証状態によりAppGeniusおよびClaudeCodeへのアクセス制御が可能

### 想定ユーザー
- 管理者：システム全体の管理、ユーザー管理、全プロンプト管理
- 一般ユーザー：AppGenius VSCode拡張およびClaudeCodeの利用者

### 主要ユースケース
1. 管理者がシステムにログインしてプロンプトを管理
2. 管理者がプロンプトの公開リンクを発行
3. 管理者がユーザーの作成・編集・削除を行う
4. ClaudeCodeがURLを介してプロンプト情報を取得

## 2. UI要素の詳細

### 各画面の構成要素

#### ログイン画面
- メールアドレス入力フィールド
- パスワード入力フィールド
- ログインボタン
- パスワードリセットリンク
- 新規登録リンク（将来的な拡張用）

#### ダッシュボード
- サイドバーナビゲーション（ダッシュボード、プロンプト、ユーザー）
- ヘッダー（検索バー、ユーザーメニュー）
- 統計表示（総プロンプト数、登録ユーザー数）

#### プロンプト管理画面
- プロンプト一覧表示
- 新規プロンプト追加ボタン
- 各プロンプトの編集、公開リンク発行、削除ボタン
- プロンプト追加・編集ダイアログ
- 公開リンク表示・コピーダイアログ

#### ユーザー管理画面
- ユーザー一覧表示（名前、メールアドレス、ステータス、最終ログイン）
- 新規ユーザー追加ボタン
- 各ユーザーの編集、削除ボタン
- ユーザー追加・編集ダイアログ

### 入力フィールドと検証ルール

#### ログインフォーム
- メールアドレス：有効なメール形式
- パスワード：8文字以上

#### プロンプト追加・編集ダイアログ
- タイトル：必須、最大100文字
- カテゴリ：必須
- プロンプト内容：必須、最大100,000文字

#### ユーザー追加・編集ダイアログ
- 名前：必須、最大50文字
- メールアドレス：必須、有効なメール形式
- パスワード：新規作成時のみ必須、8文字以上
- ステータス：必須、選択肢（管理者、アクティブ、退会）

### ボタンとアクション
- 「ログイン」：認証を行いダッシュボードに遷移
- 「新規プロンプト」：プロンプト追加ダイアログを表示
- 「編集」：プロンプト/ユーザー編集ダイアログを表示
- 「リンク」：プロンプトの公開リンクダイアログを表示
- 「削除」：プロンプト/ユーザーの削除確認ダイアログを表示
- 「保存」：追加/編集内容を保存
- 「キャンセル」：ダイアログを閉じる

### レスポンシブ対応の要件
- モバイル、タブレット、デスクトップでの表示に対応
- 狭い画面ではサイドバーを折りたたみ可能に
- テーブル表示は狭い画面ではカード表示に切り替え

### 既存UIコンポーネントの再利用
- Material UIコンポーネントを活用
- コンポーネント：Card, Dialog, Table, TextField, Button, Chip

## 3. データ構造と連携

### 扱うデータの種類と形式

#### ユーザーデータ
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "passwordHash": "string",
  "status": "enum(admin, active, inactive)",
  "lastLogin": "datetime",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### プロンプトデータ
```json
{
  "id": "string",
  "title": "string",
  "category": "string",
  "content": "string",
  "version": "string",
  "isPublic": "boolean",
  "publicToken": "string",
  "createdBy": "string (userId)",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 既存データモデルとの関連
プロジェクト初期段階のため、新規データモデルを定義します。

### データの永続化要件
- MongoDB等のNoSQLデータベースでデータを永続化
- プロンプト内容は完全なバックアップを確保
- ユーザー認証情報は暗号化して保存

## 4. API・バックエンド連携

### 必要なAPIエンドポイント

#### 認証関連
- `POST /api/auth/login` - ユーザーログイン
- `POST /api/auth/logout` - ログアウト
- `POST /api/auth/reset-password` - パスワードリセット

#### ユーザー管理
- `GET /api/users` - ユーザー一覧取得
- `POST /api/users` - ユーザー作成
- `GET /api/users/:id` - ユーザー詳細取得
- `PUT /api/users/:id` - ユーザー情報更新
- `DELETE /api/users/:id` - ユーザー削除

#### プロンプト管理
- `GET /api/prompts` - プロンプト一覧取得
- `POST /api/prompts` - プロンプト作成
- `GET /api/prompts/:id` - プロンプト詳細取得
- `PUT /api/prompts/:id` - プロンプト更新
- `DELETE /api/prompts/:id` - プロンプト削除
- `POST /api/prompts/:id/share` - 公開リンク生成
- `GET /api/prompts/public/:token` - 公開プロンプト取得（認証不要）

#### 統計情報
- `GET /api/stats` - 統計情報取得

### リクエスト/レスポンス形式
- リクエスト/レスポンスはJSON形式
- エラーレスポンスは以下の形式で統一
```json
{
  "error": true,
  "message": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

### 必要な環境変数リスト
- `DB_URI` - データベース接続URI
- `JWT_SECRET` - JWT認証用の秘密鍵
- `PORT` - サーバーポート番号
- `NODE_ENV` - 実行環境（development/production）
- `CORS_ORIGIN` - CORS許可オリジン
- `API_RATE_LIMIT` - APIレート制限

## 5. 実装ファイルリスト

### フロントエンド

#### ページコンポーネント
- `/src/pages/LoginPage.js` - ログインページ
- `/src/pages/DashboardPage.js` - ダッシュボードページ
- `/src/pages/PromptsPage.js` - プロンプト管理ページ
- `/src/pages/UsersPage.js` - ユーザー管理ページ

#### 共通コンポーネント
- `/src/components/Layout/SidebarNavigation.js` - サイドバーナビゲーション
- `/src/components/Layout/Header.js` - ヘッダーコンポーネント
- `/src/components/Prompts/PromptCard.js` - プロンプトカード
- `/src/components/Prompts/PromptDialog.js` - プロンプト追加・編集ダイアログ
- `/src/components/Prompts/ShareLinkDialog.js` - 公開リンクダイアログ
- `/src/components/Users/UserTable.js` - ユーザーテーブル
- `/src/components/Users/UserDialog.js` - ユーザー追加・編集ダイアログ

#### サービス
- `/src/services/authService.js` - 認証サービス
- `/src/services/promptService.js` - プロンプト管理サービス
- `/src/services/userService.js` - ユーザー管理サービス
- `/src/services/statsService.js` - 統計情報サービス

### バックエンド

#### 認証
- `/server/controllers/authController.js` - 認証コントローラー
- `/server/middleware/authMiddleware.js` - 認証ミドルウェア

#### ユーザー管理
- `/server/controllers/userController.js` - ユーザーコントローラー
- `/server/models/userModel.js` - ユーザーモデル

#### プロンプト管理
- `/server/controllers/promptController.js` - プロンプトコントローラー
- `/server/models/promptModel.js` - プロンプトモデル

#### サーバー設定
- `/server/config/db.js` - データベース接続設定
- `/server/config/corsOptions.js` - CORS設定
- `/server/routes/authRoutes.js` - 認証ルーティング
- `/server/routes/userRoutes.js` - ユーザールーティング
- `/server/routes/promptRoutes.js` - プロンプトルーティング
- `/server/routes/statsRoutes.js` - 統計情報ルーティング
- `/server/server.js` - メインサーバーファイル

### 各ファイルの役割と責任
- **ページコンポーネント**: 各機能の画面表示とユーザーインタラクション処理
- **共通コンポーネント**: 複数のページで再利用される UI コンポーネント
- **サービス**: フロントエンドからのAPI通信を担当
- **コントローラー**: APIエンドポイントのビジネスロジック処理
- **モデル**: データモデルの定義とデータベース操作
- **ミドルウェア**: リクエスト処理の前処理（認証確認など）
- **設定ファイル**: サーバーの各種設定

### 既存コンポーネントの再利用方法
フロントエンドはReactとMaterial UIを使用し、バックエンドはNode.js + Expressで構築。既存のシステムがない状態からの新規開発となるため、業界標準のライブラリとフレームワークを採用します。