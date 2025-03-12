# プロンプト管理システム API設計

## 認証API

### 認証
- `POST /api/auth/register`
  - 説明: ユーザー登録
  - リクエスト: `{ name: string, email: string, password: string }`
  - レスポンス: `{ accessToken: string, refreshToken: string, user: User }`
  - ステータスコード: 201 (作成成功)、400 (無効なリクエスト)

- `POST /api/auth/login`
  - 説明: ユーザーログイン
  - リクエスト: `{ email: string, password: string }`
  - レスポンス: `{ accessToken: string, refreshToken: string, user: User }`
  - ステータスコード: 200 (成功)、401 (認証失敗)

- `POST /api/auth/refresh-token`
  - 説明: アクセストークンの更新
  - リクエスト: `{ refreshToken: string }`
  - レスポンス: `{ accessToken: string }`
  - ステータスコード: 200 (成功)、401 (無効なトークン)

- `POST /api/auth/logout`
  - 説明: ログアウト処理
  - リクエスト: `{ refreshToken: string }`
  - レスポンス: `{ message: string }`
  - ステータスコード: 200 (成功)

### ユーザー管理
- `GET /api/users/me`
  - 説明: 現在のユーザー情報取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - レスポンス: `{ user: User }`
  - ステータスコード: 200 (成功)、401 (認証失敗)

- `PUT /api/users/me`
  - 説明: ユーザー情報更新
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - リクエスト: `{ name?: string, email?: string, password?: string }`
  - レスポンス: `{ user: User }`
  - ステータスコード: 200 (成功)、400 (無効なリクエスト)

## プロンプト管理API

### プロンプト
- `GET /api/prompts`
  - 説明: プロンプト一覧取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - クエリパラメータ: `{ page?: number, limit?: number, search?: string, category?: string, tags?: string[], sort?: string }`
  - レスポンス: `{ prompts: Prompt[], total: number, page: number, limit: number }`
  - ステータスコード: 200 (成功)

- `GET /api/prompts/:id`
  - 説明: 特定プロンプト取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `id`
  - レスポンス: `{ prompt: Prompt }`
  - ステータスコード: 200 (成功)、404 (不明なID)

- `POST /api/prompts`
  - 説明: プロンプト作成
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - リクエスト: `{ title: string, content: string, type: string, category?: string, tags?: string[], projectId?: string, isPublic?: boolean }`
  - レスポンス: `{ prompt: Prompt }`
  - ステータスコード: 201 (作成成功)、400 (無効なリクエスト)

- `PUT /api/prompts/:id`
  - 説明: プロンプト更新
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `id`
  - リクエスト: `{ title?: string, content?: string, type?: string, category?: string, tags?: string[], isPublic?: boolean }`
  - レスポンス: `{ prompt: Prompt }`
  - ステータスコード: 200 (成功)、404 (不明なID)

- `DELETE /api/prompts/:id`
  - 説明: プロンプト削除
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `id`
  - レスポンス: `{ message: string }`
  - ステータスコード: 200 (成功)、404 (不明なID)

### プロンプトバージョン
- `GET /api/prompts/:promptId/versions`
  - 説明: プロンプトバージョン一覧取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `promptId`
  - レスポンス: `{ versions: PromptVersion[] }`
  - ステータスコード: 200 (成功)、404 (不明なプロンプトID)

- `GET /api/prompts/:promptId/versions/:versionNumber`
  - 説明: 特定バージョン取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `promptId`, `versionNumber`
  - レスポンス: `{ version: PromptVersion }`
  - ステータスコード: 200 (成功)、404 (不明なID)

- `POST /api/prompts/:promptId/versions`
  - 説明: 新バージョン作成
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `promptId`
  - リクエスト: `{ content: string, description?: string }`
  - レスポンス: `{ version: PromptVersion }`
  - ステータスコード: 201 (作成成功)、400 (無効なリクエスト)

### プロジェクト
- `GET /api/projects`
  - 説明: プロジェクト一覧取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - レスポンス: `{ projects: Project[] }`
  - ステータスコード: 200 (成功)

- `GET /api/projects/:id`
  - 説明: 特定プロジェクト取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `id`
  - レスポンス: `{ project: Project }`
  - ステータスコード: 200 (成功)、404 (不明なID)

- `POST /api/projects`
  - 説明: プロジェクト作成
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - リクエスト: `{ name: string, description?: string }`
  - レスポンス: `{ project: Project }`
  - ステータスコード: 201 (作成成功)、400 (無効なリクエスト)

- `PUT /api/projects/:id`
  - 説明: プロジェクト更新
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `id`
  - リクエスト: `{ name?: string, description?: string }`
  - レスポンス: `{ project: Project }`
  - ステータスコード: 200 (成功)、404 (不明なID)

- `DELETE /api/projects/:id`
  - 説明: プロジェクト削除
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `id`
  - レスポンス: `{ message: string }`
  - ステータスコード: 200 (成功)、404 (不明なID)

### プロジェクト・ユーザー関連
- `GET /api/projects/:projectId/users`
  - 説明: プロジェクトユーザー一覧取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `projectId`
  - レスポンス: `{ users: {userId: string, name: string, email: string, role: string}[] }`
  - ステータスコード: 200 (成功)、404 (不明なプロジェクトID)

- `POST /api/projects/:projectId/users`
  - 説明: プロジェクトにユーザー追加
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `projectId`
  - リクエスト: `{ email: string, role: string }`
  - レスポンス: `{ message: string }`
  - ステータスコード: 201 (追加成功)、400 (無効なリクエスト)

- `PUT /api/projects/:projectId/users/:userId`
  - 説明: プロジェクトユーザー権限更新
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `projectId`, `userId`
  - リクエスト: `{ role: string }`
  - レスポンス: `{ message: string }`
  - ステータスコード: 200 (成功)、404 (不明なID)

- `DELETE /api/projects/:projectId/users/:userId`
  - 説明: プロジェクトからユーザー削除
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `projectId`, `userId`
  - レスポンス: `{ message: string }`
  - ステータスコード: 200 (成功)、404 (不明なID)

### プロンプト使用履歴
- `POST /api/prompts/:promptId/usage`
  - 説明: プロンプト使用記録
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `promptId`
  - リクエスト: `{ versionId?: string, projectId?: string, context?: string }`
  - レスポンス: `{ usage: PromptUsage }`
  - ステータスコード: 201 (記録成功)

- `GET /api/prompts/:promptId/usage`
  - 説明: プロンプト使用履歴取得
  - ヘッダー: `Authorization: Bearer {accessToken}`
  - パスパラメータ: `promptId`
  - レスポンス: `{ usage: PromptUsage[] }`
  - ステータスコード: 200 (成功)、404 (不明なプロンプトID)

## VSCode/ClaudeCode連携API

### SDK認証
- `POST /api/sdk/auth`
  - 説明: SDK認証トークン取得
  - リクエスト: `{ clientId: string, clientSecret: string }`
  - レスポンス: `{ sdkToken: string, expiresIn: number }`
  - ステータスコード: 200 (成功)、401 (認証失敗)

- `POST /api/sdk/auth/user`
  - 説明: SDKユーザー認証
  - ヘッダー: `Authorization: Bearer {sdkToken}`
  - リクエスト: `{ email: string, password: string }`
  - レスポンス: `{ accessToken: string, refreshToken: string, user: User }`
  - ステータスコード: 200 (成功)、401 (認証失敗)

### プロンプト同期
- `GET /api/sdk/prompts/sync`
  - 説明: プロンプト同期情報取得
  - ヘッダー: `Authorization: Bearer {accessToken}`, `X-SDK-Token: {sdkToken}`
  - クエリパラメータ: `{ lastSyncTimestamp?: number }`
  - レスポンス: `{ prompts: Prompt[], deletedPromptIds: string[], timestamp: number }`
  - ステータスコード: 200 (成功)

### ヘルスチェック
- `GET /api/health`
  - 説明: APIヘルスチェック
  - レスポンス: `{ status: string, version: string }`
  - ステータスコード: 200 (成功)

## データタイプ定義

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface Prompt {
  id: string;
  title: string;
  content: string;
  type: string;
  category?: string;
  tags?: string[];
  ownerId: string;
  projectId?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  latestVersion?: PromptVersion;
}

interface PromptVersion {
  id: string;
  promptId: string;
  content: string;
  description?: string;
  versionNumber: number;
  createdBy: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface PromptUsage {
  id: string;
  promptId: string;
  versionId?: string;
  userId: string;
  projectId?: string;
  usedAt: string;
  context?: string;
}
```

## エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

## 主要エラーコード

- `AUTH_REQUIRED`: 認証が必要です
- `INVALID_TOKEN`: 無効なトークンです
- `TOKEN_EXPIRED`: トークンの有効期限が切れています
- `INVALID_CREDENTIALS`: 無効な認証情報です
- `RESOURCE_NOT_FOUND`: リソースが見つかりません
- `PERMISSION_DENIED`: アクセス権限がありません
- `VALIDATION_ERROR`: 入力検証エラーです
- `DUPLICATE_ENTRY`: 重複するエントリーです
- `SERVER_ERROR`: サーバーエラーが発生しました