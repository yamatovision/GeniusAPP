# 管理者API設計ドキュメント

このドキュメントは、DailyFortuneアプリケーションの管理者向けAPIエンドポイントの設計と使用方法を説明します。

## 1. 概要

管理者API（`/api/v1/admin/*`）は以下の機能を提供します：

1. ユーザー管理（作成/一覧/更新/削除）
2. 権限管理（ロール変更）
3. プラン管理（プラン変更）
4. 運勢更新設定管理
5. 運勢更新ログ管理

これらのAPIは権限レベルに応じてアクセス制限されます：
- SuperAdmin: すべてのAPIにアクセス可能
- Admin: 一部の限定的なAPIのみアクセス可能
- User: アクセス不可

## 2. 認証・認可

すべての管理者APIには認証が必要です。Firebase IDトークンをAuthorizationヘッダーに含める必要があります。

```
Authorization: Bearer <firebase-id-token>
```

権限チェックは各エンドポイントで行われ、必要な権限がない場合は403エラーを返します。

## 3. ユーザー管理API

### 3.1 全ユーザーリスト取得

```
GET /api/v1/admin/users
```

**クエリパラメータ**:
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20）
- `role`: フィルタリングするロール（例: "SuperAdmin", "Admin", "User"）
- `plan`: フィルタリングするプラン（例: "elite", "lite"）
- `search`: 検索キーワード（名前またはメールアドレス）

**レスポンス**:
```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "displayName": "ユーザー名",
      "role": "Admin",
      "plan": "elite",
      "organizationId": "org-id",
      "teamId": "team-id",
      "isActive": true,
      "createdAt": "2025-04-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

### 3.2 新規ユーザー作成

```
POST /api/v1/admin/users
```

**リクエストボディ**:
```json
{
  "email": "new-user@example.com",
  "password": "securePassword123",
  "displayName": "新規ユーザー",
  "role": "Admin",
  "plan": "elite",
  "organizationId": "org-id",
  "teamId": "team-id"
}
```

**レスポンス**:
```json
{
  "id": "user-id",
  "email": "new-user@example.com",
  "displayName": "新規ユーザー",
  "role": "Admin",
  "plan": "elite",
  "organizationId": "org-id",
  "teamId": "team-id",
  "isActive": true,
  "createdAt": "2025-04-07T00:00:00.000Z"
}
```

### 3.3 ユーザー権限変更

```
PUT /api/v1/admin/users/:userId/role
```

**リクエストボディ**:
```json
{
  "role": "Admin"
}
```

**レスポンス**:
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "displayName": "ユーザー名",
  "role": "Admin",
  "updatedAt": "2025-04-07T00:00:00.000Z"
}
```

### 3.4 ユーザープラン変更

```
PUT /api/v1/admin/users/:userId/plan
```

**リクエストボディ**:
```json
{
  "plan": "elite"
}
```

**レスポンス**:
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "displayName": "ユーザー名",
  "plan": "elite",
  "updatedAt": "2025-04-07T00:00:00.000Z"
}
```

### 3.5 ユーザー削除

```
DELETE /api/v1/admin/users/:userId
```

**レスポンス**:
```json
{
  "message": "ユーザーを削除しました",
  "deletedUserId": "user-id"
}
```

## 4. 運勢更新設定API

### 4.1 運勢更新設定取得

```
GET /api/v1/admin/settings/fortune-update
```

**レスポンス**:
```json
{
  "key": "fortune_update_time",
  "value": "03:00",
  "description": "毎日の運勢更新実行時間",
  "updatedAt": "2025-04-01T00:00:00.000Z",
  "updatedBy": "admin-id"
}
```

### 4.2 運勢更新設定更新

```
PUT /api/v1/admin/settings/fortune-update
```

**リクエストボディ**:
```json
{
  "value": "04:00",
  "description": "毎日の運勢更新実行時間を更新"
}
```

**レスポンス**:
```json
{
  "key": "fortune_update_time",
  "value": "04:00",
  "description": "毎日の運勢更新実行時間を更新",
  "updatedAt": "2025-04-07T00:00:00.000Z",
  "updatedBy": "admin-id"
}
```

## 5. 運勢更新ログAPI

### 5.1 運勢更新ログ一覧取得

```
GET /api/v1/admin/fortune-updates/logs
```

**クエリパラメータ**:
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20）
- `status`: フィルタリングするステータス（例: "completed", "failed"）
- `startDate`: フィルター開始日（YYYY-MM-DD形式）
- `endDate`: フィルター終了日（YYYY-MM-DD形式）

**レスポンス**:
```json
{
  "logs": [
    {
      "id": "log-id",
      "date": "2025-04-07T00:00:00.000Z",
      "status": "completed",
      "startTime": "2025-04-07T03:00:00.000Z",
      "endTime": "2025-04-07T03:05:30.000Z",
      "totalUsers": 120,
      "successCount": 120,
      "failedCount": 0,
      "isAutomaticRetry": false,
      "createdAt": "2025-04-07T03:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 30,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

### 5.2 運勢更新ログ詳細取得

```
GET /api/v1/admin/fortune-updates/logs/:logId
```

**レスポンス**:
```json
{
  "id": "log-id",
  "date": "2025-04-07T00:00:00.000Z",
  "status": "completed",
  "startTime": "2025-04-07T03:00:00.000Z",
  "endTime": "2025-04-07T03:05:30.000Z",
  "totalUsers": 120,
  "successCount": 120,
  "failedCount": 0,
  "errors": [],
  "isAutomaticRetry": false,
  "createdBy": "system",
  "createdAt": "2025-04-07T03:00:00.000Z",
  "updatedAt": "2025-04-07T03:05:30.000Z"
}
```

### 5.3 手動運勢更新実行

```
POST /api/v1/admin/fortune-updates/manual-run
```

**リクエストボディ**:
```json
{
  "targetDate": "2025-04-07",
  "targetUserIds": ["user1", "user2"]  // オプション。指定しない場合は全ユーザー
}
```

**レスポンス**:
```json
{
  "message": "運勢更新ジョブを開始しました",
  "jobId": "job-id",
  "startTime": "2025-04-07T10:15:30.000Z",
  "status": "running"
}
```

## 6. データフロー図

### 6.1 ユーザー作成フロー
```
SuperAdmin → POST /admin/users → 
  1. Firebase Authenticationでユーザー作成
  2. MongoDB Userコレクションにデータ保存
  3. 権限とプラン設定
  4. チーム関連情報設定（必要な場合）
```

### 6.2 運勢更新フロー
```
定期実行 → Cron Job → 
  1. DailyFortuneUpdateLog作成（status: scheduled）
  2. ユーザーごとに運勢データ生成
  3. DailyFortuneコレクション更新
  4. DailyFortuneUpdateLog更新（status: completed）
```

## 7. エラー処理

すべてのAPIは一貫したエラーレスポンス形式を持ちます：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {} // オプションの追加情報
  }
}
```

共通エラーコード：
- `UNAUTHORIZED`: 認証されていません（401）
- `FORBIDDEN`: 権限がありません（403）
- `NOT_FOUND`: リソースが見つかりません（404）
- `VALIDATION_ERROR`: 入力検証エラー（400）
- `INTERNAL_SERVER_ERROR`: サーバー内部エラー（500）