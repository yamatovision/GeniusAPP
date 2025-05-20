# API エンドポイント一覧

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-15  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）のすべてのAPIエンドポイントの概要を提供します。各リソースタイプごとに利用可能なエンドポイントと、その認証要件、基本的な機能説明をまとめています。詳細な仕様については、各リソース別APIドキュメントを参照してください。

## 2. ベースURL

```
https://api.example.com/api
```

## 3. 認証

ほとんどのエンドポイントでは認証が必要です。認証はJWTベアラートークンを使用します。

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

以下のエンドポイントは認証が不要です：
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/refresh`
- `/api/auth/password-reset/request`
- `/api/auth/password-reset/confirm`

## 4. エンドポイント一覧

### 4.1 認証管理 (Auth)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/auth/register` | POST | 不要 | 新規ユーザー登録 | コレクション操作 |
| `/api/auth/login` | POST | 不要 | ユーザーログイン | アクション |
| `/api/auth/logout` | POST | 必須 | ユーザーログアウト | アクション |
| `/api/auth/refresh` | POST | 不要 | アクセストークン更新 | アクション |
| `/api/auth/password-reset/request` | POST | 不要 | パスワードリセット要求 | アクション |
| `/api/auth/password-reset/confirm` | POST | 不要 | パスワードリセット確認 | アクション |
| `/api/auth/me` | GET | 必須 | 現在のユーザー情報取得 | リソース取得 |

### 4.2 ユーザー管理 (Users)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/users` | GET | 必須 | 自組織ユーザー一覧取得 | コレクション読取 |
| `/api/users/{id}` | GET | 必須 | 特定ユーザー情報取得 | リソース読取 |
| `/api/users/{id}` | PUT | 必須 | ユーザー情報更新（自身のみ） | リソース更新 |
| `/api/users/profile` | GET | 必須 | 自身のプロフィール取得 | リソース読取 |
| `/api/users/profile` | PUT | 必須 | 自身のプロフィール更新 | リソース更新 |

### 4.3 組織管理 (Organizations)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/organizations/{id}` | GET | 必須 | 自組織情報取得 | リソース読取 |
| `/api/organizations/{id}` | PUT | 必須 | 自組織情報更新 | リソース更新 |

### 4.4 物件管理 (Properties)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/properties` | GET | 必須 | 物件一覧取得（フィルタ可） | コレクション読取 |
| `/api/properties` | POST | 必須 | 新規物件登録 | コレクション作成 |
| `/api/properties/{id}` | GET | 必須 | 物件詳細取得 | リソース読取 |
| `/api/properties/{id}` | PUT | 必須 | 物件情報更新 | リソース更新 |
| `/api/properties/{id}` | PATCH | 必須 | 物件情報部分更新 | リソース部分更新 |
| `/api/properties/{id}` | DELETE | 必須 | 物件削除 | リソース削除 |
| `/api/properties/upload-survey` | POST | 必須 | 測量図アップロード | アクション |
| `/api/properties/{id}/shape` | PUT | 必須 | 敷地形状更新 | サブリソース更新 |
| `/api/properties/{id}/documents` | GET | 必須 | 物件関連文書一覧取得 | サブコレクション読取 |
| `/api/properties/{id}/documents` | POST | 必須 | 物件関連文書追加 | サブコレクション作成 |
| `/api/properties/{id}/history` | GET | 必須 | 物件履歴取得 | サブコレクション読取 |

### 4.5 文書管理 (Documents)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/documents/{id}` | GET | 必須 | 文書取得 | リソース読取 |
| `/api/documents/{id}` | PUT | 必須 | 文書更新 | リソース更新 |
| `/api/documents/{id}` | DELETE | 必須 | 文書削除 | リソース削除 |
| `/api/documents/{id}/download` | GET | 必須 | 文書ダウンロード | アクション |

### 4.6 ボリュームチェック (Volume Check)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/analysis/volume-check` | POST | 必須 | ボリュームチェック実行 | アクション |
| `/api/analysis/volume-check/{id}` | GET | 必須 | ボリュームチェック結果取得 | リソース読取 |
| `/api/analysis/volume-check/{id}` | DELETE | 必須 | ボリュームチェック結果削除 | リソース削除 |
| `/api/properties/{id}/volume-checks` | GET | 必須 | 物件のボリュームチェック一覧取得 | サブコレクション読取 |
| `/api/analysis/volume-check/{id}/export` | GET | 必須 | ボリュームチェック結果PDF出力 | アクション |
| `/api/analysis/volume-check/{id}/model` | GET | 必須 | 3Dモデルデータ取得 | サブリソース読取 |

### 4.7 収益性試算 (Profitability)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/analysis/profitability` | POST | 必須 | 収益性試算実行 | アクション |
| `/api/analysis/profitability/{id}` | GET | 必須 | 収益性試算結果取得 | リソース読取 |
| `/api/analysis/profitability/{id}` | DELETE | 必須 | 収益性試算結果削除 | リソース削除 |
| `/api/analysis/scenarios` | GET | 必須 | シナリオ一覧取得 | コレクション読取 |
| `/api/analysis/scenarios` | POST | 必須 | シナリオ作成 | コレクション作成 |
| `/api/analysis/scenarios/{id}` | GET | 必須 | シナリオ詳細取得 | リソース読取 |
| `/api/analysis/scenarios/{id}` | PUT | 必須 | シナリオ更新 | リソース更新 |
| `/api/analysis/scenarios/{id}` | DELETE | 必須 | シナリオ削除 | リソース削除 |
| `/api/analysis/profitability/{id}/export` | GET | 必須 | 収益性試算結果PDF出力 | アクション |
| `/api/analysis/profitability/compare` | POST | 必須 | 複数シナリオ比較 | アクション |

### 4.8 地理情報連携 (Geo)

| エンドポイント | メソッド | 認証 | 説明 | リソース設計 |
|--------------|--------|------|------|------------|
| `/api/geocode` | GET | 必須 | 住所から緯度経度情報取得 | サービス |

## 5. 共通クエリパラメータ

多くのGET（一覧取得）エンドポイントでは、以下の共通クエリパラメータがサポートされています：

### 5.1 ページネーション

```
?page=1&limit=20
```

| パラメータ | デフォルト | 説明 |
|----------|-----------|------|
| `page` | 1 | ページ番号 |
| `limit` | 20 | 1ページあたりの結果数（最大100） |

### 5.2 ソート

```
?sort=updatedAt:desc,name:asc
```

| パラメータ | デフォルト | 説明 |
|----------|-----------|------|
| `sort` | - | ソートフィールドと方向（asc/desc） |

### 5.3 フィルタリング

```
?status=active,pending&createdAt_gte=2025-01-01
```

各リソースタイプで利用可能なフィルターパラメータは異なります。詳細は各リソース別APIドキュメントを参照してください。

一般的なフィルタリング規則：
- 等価比較: `field=value`
- 複数値: `field=value1,value2`
- 範囲比較: `field_gte=value`（以上）, `field_lte=value`（以下）
- 部分一致検索: `field_like=value`

### 5.4 フィールド選択

```
?fields=id,name,status
```

| パラメータ | デフォルト | 説明 |
|----------|-----------|------|
| `fields` | - | 返却するフィールドをカンマ区切りで指定 |

### 5.5 関連データ取得

```
?expand=organization,documents
```

| パラメータ | デフォルト | 説明 |
|----------|-----------|------|
| `expand` | - | 展開して取得する関連データをカンマ区切りで指定 |

## 6. リソース連携マッピング

以下は主要リソース間の関連とエンドポイント設計の対応を示します：

### 6.1 User → Organization 関連

- ユーザーは1つの組織に所属
- 組織情報は `/api/auth/me` で取得可能（`?expand=organization`）
- 組織内の全ユーザーは `/api/users` で取得可能

### 6.2 Organization → Property 関連

- 組織は複数の物件を所有
- 組織の全物件は `/api/properties` で取得可能（組織IDは認証から自動解決）

### 6.3 Property → Documents 関連

- 物件は複数の文書を持つ
- 物件の全文書は `/api/properties/{id}/documents` で取得可能

### 6.4 Property → VolumeCheck 関連

- 物件は複数のボリュームチェック結果を持つ
- 物件の全ボリュームチェックは `/api/properties/{id}/volume-checks` で取得可能

### 6.5 VolumeCheck → Scenario 関連

- ボリュームチェックは複数のシナリオを持つ
- ボリュームチェックのシナリオは `/api/analysis/scenarios?volumeCheckId={id}` で取得可能

### 6.6 Scenario → ProfitabilityResult 関連

- シナリオは1つの収益性試算結果を持つ
- シナリオの収益性試算結果はシナリオ詳細に含まれる（`?expand=profitabilityResult`）

## 7. ステータスコードとエラーレスポンス

全エンドポイントで一貫したステータスコードとエラーレスポンスパターンを使用します：

### 7.1 成功レスポンス

| コード | 説明 | 使用例 |
|-------|-----|--------|
| 200 OK | リクエスト成功 | GET, PUT, PATCH成功時 |
| 201 Created | リソース作成成功 | POST成功時 |
| 204 No Content | 成功（返すコンテンツなし） | DELETE成功時（オプション） |

### 7.2 クライアントエラー

| コード | 説明 | エラーコード例 |
|-------|-----|-------------|
| 400 Bad Request | 不正なリクエスト | `INVALID_REQUEST` |
| 401 Unauthorized | 認証エラー | `AUTH_REQUIRED`, `INVALID_TOKEN` |
| 403 Forbidden | 権限エラー | `PERMISSION_DENIED` |
| 404 Not Found | リソース未検出 | `RESOURCE_NOT_FOUND` |
| 409 Conflict | リソース競合 | `DUPLICATE_EMAIL`, `RESOURCE_CONFLICT` |
| 422 Unprocessable Entity | バリデーションエラー | `VALIDATION_ERROR` |
| 429 Too Many Requests | レート制限超過 | `RATE_LIMIT_EXCEEDED` |

### 7.3 サーバーエラー

| コード | 説明 | エラーコード例 |
|-------|-----|-------------|
| 500 Internal Server Error | サーバーエラー | `INTERNAL_SERVER_ERROR` |
| 503 Service Unavailable | サービス利用不可 | `SERVICE_UNAVAILABLE` |

## 8. バージョン管理

現在のAPIバージョンは v1 ですが、URLパスにはバージョン番号を含めていません。将来的な破壊的変更が必要になった場合は、新しいバージョン（例: `/api/v2/...`）が導入される予定です。

## 9. レート制限

すべてのAPIエンドポイントには適切なレート制限が設定されています：

| エンドポイントグループ | 制限 | 適用範囲 |
|--------------------|------|---------|
| 認証関連 | 詳細は認証API仕様書参照 | IP/ユーザー |
| 一般リソース読取 | 60回/分 | ユーザー |
| リソース作成/更新 | 30回/分 | ユーザー |
| 分析計算処理 | 10回/分 | ユーザー |

レート制限超過時は429ステータスコードと次のようなレスポンスが返されます：

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト制限を超えました。しばらく待ってから再試行してください",
    "details": {
      "retryAfter": 60
    }
  }
}
```

## 10. API実装ステータス

| APIグループ | ステータス | 予定リリース |
|-----------|----------|------------|
| 認証管理 | 設計完了 | v1.0.0 |
| ユーザー管理 | 設計完了 | v1.0.0 |
| 組織管理 | 設計完了 | v1.0.0 |
| 物件管理 | 設計完了 | v1.0.0 |
| 文書管理 | 設計完了 | v1.0.0 |
| ボリュームチェック | 設計完了 | v1.0.0 |
| 収益性試算 | 設計完了 | v1.0.0 |
| 地理情報連携 | 設計完了 | v1.0.0 |

## 11. サンプルリクエスト・レスポンス

詳細なサンプルリクエストとレスポンスについては、各リソース別APIドキュメントを参照してください。基本的なパターンは以下の通りです：

### 11.1 リソース一覧取得例

**リクエスト**:
```
GET /api/properties?status=active&sort=updatedAt:desc&page=1&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "property_123",
      "name": "福岡タワーマンション計画",
      "address": "福岡市中央区天神1-1-1",
      "status": "active",
      "updatedAt": "2025-05-15T09:30:00Z"
    },
    // 他の物件...
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### 11.2 リソース詳細取得例

**リクエスト**:
```
GET /api/properties/property_123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "name": "福岡タワーマンション計画",
    "address": "福岡市中央区天神1-1-1",
    "area": 500.5,
    "zoneType": "category8",
    "fireZone": "semi-fire",
    "buildingCoverage": 80,
    "floorAreaRatio": 400,
    "status": "active",
    "createdAt": "2025-05-01T10:00:00Z",
    "updatedAt": "2025-05-15T09:30:00Z"
  }
}
```

### 11.3 リソース作成例

**リクエスト**:
```
POST /api/properties
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "博多駅前オフィスビル計画",
  "address": "福岡市博多区博多駅前2-2-2",
  "area": 750.25,
  "zoneType": "category9",
  "fireZone": "fire",
  "buildingCoverage": 80,
  "floorAreaRatio": 600
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "property_124",
    "name": "博多駅前オフィスビル計画",
    "address": "福岡市博多区博多駅前2-2-2",
    "area": 750.25,
    "zoneType": "category9",
    "fireZone": "fire",
    "buildingCoverage": 80,
    "floorAreaRatio": 600,
    "status": "new",
    "createdAt": "2025-05-15T10:15:00Z",
    "updatedAt": "2025-05-15T10:15:00Z"
  }
}
```

## 12. API検証ツール

### 12.1 Swagger UI

API仕様の詳細な検証とテストには、以下のSwagger UIを利用できます：

- 開発環境: `http://localhost:3000/api/docs`
- ステージング環境: `https://staging-api.example.com/api/docs`

### 12.2 Postmanコレクション

Postmanを使用したテスト用に、以下のコレクションが利用可能です：

- [Postmanコレクションのダウンロード](https://example.com/api/postman-collection)

## 13. 認証情報とサンプルデータ

### 13.1 テスト用認証情報

開発・テスト環境では、以下のテストアカウントが利用可能です：

| メールアドレス | パスワード | 説明 |
|--------------|-----------|------|
| `demo@example.com` | `Password123!` | デモユーザーアカウント |
| `test@example.com` | `Password123!` | テストユーザーアカウント |

### 13.2 サンプルデータ

開発・テスト環境には、以下のサンプルデータが含まれています：

- 10件のサンプル物件
- 各物件に関連する文書
- 各物件のボリュームチェック結果
- 各ボリュームチェックに関連するシナリオ