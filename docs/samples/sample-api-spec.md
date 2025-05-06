# ダッシュボード API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-16  
**作成者**: APIデザイナー (#4)  
**ステータス**: 確定  

## 1. 概要

ダッシュボードAPIは、アプリケーションのダッシュボード機能に必要なデータを提供します。ユーザーの権限に基づいたデータアクセス、メトリクスの集計、アクティビティ履歴の取得、およびダッシュボードレイアウトのカスタマイズ機能をサポートします。

## 2. ベースURL

```
https://api.appgenius.com/api/v1
```

## 3. 認証

すべてのエンドポイントはJWTベースの認証を必要とします。認証トークンは以下のヘッダーで送信する必要があります：

```
Authorization: Bearer [JWT_TOKEN]
```

## 4. エンドポイント一覧

| 方法 | パス | 説明 | 権限 |
|-----|-----|------|------|
| GET | /dashboard/metrics | ダッシュボードメトリクスの取得 | ユーザー |
| GET | /dashboard/activities | 最近のアクティビティ履歴の取得 | ユーザー |
| GET | /dashboard/layout | ユーザーのダッシュボードレイアウト取得 | ユーザー |
| PUT | /dashboard/layout | ユーザーのダッシュボードレイアウト更新 | ユーザー |
| GET | /dashboard/metrics/:type | 特定タイプのメトリクス詳細取得 | ユーザー |
| GET | /dashboard/team-metrics | チームメトリクスの取得 | チームリーダー |

## 5. エンドポイント詳細

### 5.1 GET /dashboard/metrics

#### 説明
ユーザーのダッシュボードに表示する主要メトリクスデータを取得します。ユーザーの権限に基づいてデータがフィルタリングされます。

#### リクエストパラメータ
| パラメータ | 型 | 必須 | 説明 |
|----------|-----|-----|------|
| period | string | いいえ | データ期間 ("day", "week", "month"). デフォルトは "week" |
| timezone | string | いいえ | タイムゾーン (例: "Asia/Tokyo"). デフォルトはUTC |

#### リクエスト例
```http
GET /api/v1/dashboard/metrics?period=week&timezone=Asia%2FTokyo HTTP/1.1
Host: api.appgenius.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### レスポンス
**型定義**: [DashboardMetricsResponse](/shared/index.ts#L520-L545)

```json
{
  "data": {
    "summary": {
      "activeProjects": 12,
      "completedTasks": 45,
      "pendingApprovals": 3,
      "upcomingDeadlines": 7
    },
    "trends": {
      "projectProgress": [
        { "date": "2025-05-10", "value": 45 },
        { "date": "2025-05-11", "value": 47 },
        { "date": "2025-05-12", "value": 52 },
        { "date": "2025-05-13", "value": 58 },
        { "date": "2025-05-14", "value": 62 },
        { "date": "2025-05-15", "value": 65 },
        { "date": "2025-05-16", "value": 68 }
      ],
      "taskCompletion": [
        { "date": "2025-05-10", "value": 5 },
        { "date": "2025-05-11", "value": 8 },
        { "date": "2025-05-12", "value": 6 },
        { "date": "2025-05-13", "value": 10 },
        { "date": "2025-05-14", "value": 7 },
        { "date": "2025-05-15", "value": 9 },
        { "date": "2025-05-16", "value": 0 }
      ]
    },
    "distribution": {
      "projectStatus": [
        { "label": "計画中", "value": 3 },
        { "label": "進行中", "value": 8 },
        { "label": "レビュー中", "value": 1 },
        { "label": "完了", "value": 4 }
      ],
      "taskPriority": [
        { "label": "低", "value": 12 },
        { "label": "中", "value": 23 },
        { "label": "高", "value": 10 }
      ]
    }
  },
  "status": "success",
  "meta": {
    "period": "week",
    "timezone": "Asia/Tokyo",
    "lastUpdated": "2025-05-16T10:30:45.123Z"
  }
}
```

#### エラーレスポンス
| ステータスコード | 説明 | 対応方法 |
|----------------|------|---------|
| 401 | 認証エラー | 有効なJWTトークンを提供してください |
| 403 | 権限エラー | 必要な権限がありません |
| 404 | リソースなし | 指定されたデータが存在しません |
| 400 | パラメータエラー | 正しいパラメータ形式で再試行してください |
| 500 | サーバーエラー | サポートに連絡してください |

### 5.2 GET /dashboard/activities

#### 説明
ユーザーまたはチームの最近のアクティビティ履歴を取得します。

#### リクエストパラメータ
| パラメータ | 型 | 必須 | 説明 |
|----------|-----|-----|------|
| limit | number | いいえ | 返却するアクティビティの最大数. デフォルトは20、最大50 |
| type | string | いいえ | アクティビティタイプでフィルタリング ("task", "comment", "approval", "all"). デフォルトは "all" |
| teamId | string | いいえ | 特定チームのアクティビティのみ取得. 省略するとユーザー関連のすべてのアクティビティ |

#### リクエスト例
```http
GET /api/v1/dashboard/activities?limit=10&type=task HTTP/1.1
Host: api.appgenius.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### レスポンス
**型定義**: [ActivitiesResponse](/shared/index.ts#L550-L580)

```json
{
  "data": {
    "activities": [
      {
        "id": "act-123456",
        "type": "task",
        "action": "completed",
        "entityId": "task-789012",
        "entityTitle": "ダッシュボードAPIの実装",
        "timestamp": "2025-05-16T09:45:30.123Z",
        "user": {
          "id": "user-123",
          "name": "山田太郎",
          "avatarUrl": "https://example.com/avatars/user-123.jpg"
        }
      },
      {
        "id": "act-123455",
        "type": "task",
        "action": "assigned",
        "entityId": "task-789013",
        "entityTitle": "チャートコンポーネントの実装",
        "timestamp": "2025-05-16T08:30:15.456Z",
        "user": {
          "id": "user-456",
          "name": "佐藤花子",
          "avatarUrl": "https://example.com/avatars/user-456.jpg"
        },
        "targetUser": {
          "id": "user-123",
          "name": "山田太郎",
          "avatarUrl": "https://example.com/avatars/user-123.jpg"
        }
      }
      // ... 追加のアクティビティ
    ],
    "unreadCount": 5
  },
  "status": "success",
  "meta": {
    "limit": 10,
    "total": 42,
    "hasMore": true
  }
}
```

#### エラーレスポンス
| ステータスコード | 説明 | 対応方法 |
|----------------|------|---------|
| 401 | 認証エラー | 有効なJWTトークンを提供してください |
| 403 | 権限エラー | 必要な権限がありません |
| 400 | パラメータエラー | 正しいパラメータ形式で再試行してください |
| 500 | サーバーエラー | サポートに連絡してください |

### 5.3 GET /dashboard/layout

#### 説明
ユーザーのカスタマイズされたダッシュボードレイアウト設定を取得します。

#### リクエストパラメータ
なし

#### リクエスト例
```http
GET /api/v1/dashboard/layout HTTP/1.1
Host: api.appgenius.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### レスポンス
**型定義**: [DashboardLayoutResponse](/shared/index.ts#L620-L640)

```json
{
  "data": {
    "layout": {
      "id": "layout-123456",
      "userId": "user-123",
      "widgets": [
        {
          "id": "widget-1",
          "type": "summary",
          "position": { "x": 0, "y": 0, "w": 6, "h": 2 },
          "settings": { "showLabels": true }
        },
        {
          "id": "widget-2",
          "type": "chart",
          "position": { "x": 6, "y": 0, "w": 6, "h": 4 },
          "settings": { 
            "chartType": "line", 
            "dataSource": "projectProgress",
            "colorScheme": "blue"
          }
        },
        {
          "id": "widget-3",
          "type": "activities",
          "position": { "x": 0, "y": 2, "w": 6, "h": 4 },
          "settings": { "limit": 5, "showAvatars": true }
        }
      ],
      "theme": "light",
      "lastModified": "2025-05-15T14:30:22.123Z"
    }
  },
  "status": "success"
}
```

#### エラーレスポンス
| ステータスコード | 説明 | 対応方法 |
|----------------|------|---------|
| 401 | 認証エラー | 有効なJWTトークンを提供してください |
| 404 | レイアウトなし | デフォルトレイアウトが返されます |
| 500 | サーバーエラー | サポートに連絡してください |

### 5.4 PUT /dashboard/layout

#### 説明
ユーザーのダッシュボードレイアウト設定を更新します。

#### リクエスト
**型定義**: [UpdateDashboardLayoutRequest](/shared/index.ts#L645-L660)

```http
PUT /api/v1/dashboard/layout HTTP/1.1
Host: api.appgenius.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "widgets": [
    {
      "id": "widget-1",
      "type": "summary",
      "position": { "x": 0, "y": 0, "w": 12, "h": 2 },
      "settings": { "showLabels": false }
    },
    {
      "id": "widget-2",
      "type": "chart",
      "position": { "x": 0, "y": 2, "w": 6, "h": 4 },
      "settings": { 
        "chartType": "bar", 
        "dataSource": "taskCompletion",
        "colorScheme": "green"
      }
    },
    {
      "id": "widget-3",
      "type": "activities",
      "position": { "x": 6, "y": 2, "w": 6, "h": 4 },
      "settings": { "limit": 10, "showAvatars": true }
    }
  ],
  "theme": "dark"
}
```

#### レスポンス
**型定義**: [DashboardLayoutResponse](/shared/index.ts#L620-L640)

```json
{
  "data": {
    "layout": {
      "id": "layout-123456",
      "userId": "user-123",
      "widgets": [
        // 更新後のウィジェット配列
      ],
      "theme": "dark",
      "lastModified": "2025-05-16T11:45:30.123Z"
    }
  },
  "status": "success"
}
```

#### エラーレスポンス
| ステータスコード | 説明 | 対応方法 |
|----------------|------|---------|
| 401 | 認証エラー | 有効なJWTトークンを提供してください |
| 400 | 無効なレイアウト | レイアウト形式を確認して再試行してください |
| 422 | 不正なウィジェット設定 | ウィジェット設定を確認して再試行してください |
| 500 | サーバーエラー | サポートに連絡してください |

## 6. データモデル

### 6.1 DashboardMetrics

**型定義**: [DashboardMetrics](/shared/index.ts#L520-L545)

| フィールド | 型 | 説明 |
|----------|-----|------|
| summary | Object | ダッシュボードサマリー指標 |
| summary.activeProjects | number | アクティブなプロジェクト数 |
| summary.completedTasks | number | 完了したタスク数 |
| summary.pendingApprovals | number | 保留中の承認数 |
| summary.upcomingDeadlines | number | 近日中の期限数 |
| trends | Object | 時系列トレンドデータ |
| trends.projectProgress | Array<{date: string, value: number}> | プロジェクト進捗の時系列データ |
| trends.taskCompletion | Array<{date: string, value: number}> | タスク完了の時系列データ |
| distribution | Object | 分布データ |
| distribution.projectStatus | Array<{label: string, value: number}> | プロジェクトステータス分布 |
| distribution.taskPriority | Array<{label: string, value: number}> | タスク優先度分布 |

### 6.2 Activity

**型定義**: [Activity](/shared/index.ts#L550-L570)

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | string | アクティビティID |
| type | string | アクティビティタイプ (task, comment, approval等) |
| action | string | 実行されたアクション (created, updated, completed等) |
| entityId | string | 関連エンティティのID |
| entityTitle | string | 関連エンティティのタイトル |
| timestamp | string | アクティビティのタイムスタンプ (ISO形式) |
| user | UserSummary | アクションを実行したユーザー |
| targetUser | UserSummary | 対象ユーザー (該当する場合) |

### 6.3 DashboardLayout

**型定義**: [DashboardLayout](/shared/index.ts#L620-L640)

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | string | レイアウトID |
| userId | string | ユーザーID |
| widgets | Array<Widget> | ウィジェット配列 |
| theme | string | テーマ設定 ("light" or "dark") |
| lastModified | string | 最終更新日時 (ISO形式) |

### 6.4 Widget

**型定義**: [Widget](/shared/index.ts#L645-L660)

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | string | ウィジェットID |
| type | string | ウィジェットタイプ (summary, chart, activities等) |
| position | {x: number, y: number, w: number, h: number} | グリッド上の位置と大きさ |
| settings | Object | ウィジェット固有の設定 |

## 7. 共通レスポンス構造

**型定義**: [ApiResponse<T>](/shared/index.ts#L210-L225)

```json
{
  "data": T,
  "status": "success" | "error",
  "message": "文字列メッセージ",
  "meta": {
    // メタデータ（ページネーション情報など）
  },
  "errors": [
    {
      "code": "エラーコード",
      "message": "エラーメッセージ",
      "field": "関連フィールド（オプショナル）"
    }
  ]
}
```

## 8. エラーコード一覧

| コード | 説明 |
|-------|------|
| AUTH_REQUIRED | 認証が必要です |
| INVALID_TOKEN | 無効または期限切れのトークンです |
| PERMISSION_DENIED | アクセス権限がありません |
| RESOURCE_NOT_FOUND | 要求されたリソースが見つかりません |
| INVALID_PARAMETERS | 無効なパラメータが提供されました |
| INVALID_LAYOUT | ダッシュボードレイアウトが無効です |
| SERVER_ERROR | サーバーエラーが発生しました |

## 9. レート制限

APIリクエストは以下のレート制限が適用されます：

- 標準ユーザー: 1分あたり60リクエスト
- プレミアムユーザー: 1分あたり120リクエスト

レート制限に関する情報は各レスポンスのヘッダーに含まれます：

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1621875600
```

## 10. 変更履歴

| 日付 | バージョン | 変更者 | 変更内容 |
|------|----------|-------|---------|
| 2025-05-16 | 1.0.0 | APIデザイナー (#4) | 初期バージョン作成 |