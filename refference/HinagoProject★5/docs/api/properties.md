# 物件関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-15  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）の物件管理に関するAPI仕様を定義します。物件情報の登録、更新、取得、敷地形状の管理、関連文書の管理など、物件に関連する全ての操作が含まれます。

物件は、ボリュームチェックシステムの基本となるリソースであり、建築可能ボリュームの計算やシミュレーションの対象となります。物件データはユーザーの組織内でのみ共有され、組織間ではデータが分離されます。

## 2. リソース概要

### 2.1 物件リソース (Property)

物件リソースは以下の主要属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| name | string | 物件名 |
| address | string | 住所 |
| area | number | 敷地面積（㎡） |
| zoneType | ZoneType | 用途地域 |
| fireZone | FireZone | 防火地域区分 |
| shadowRegulation | ShadowRegulation | 日影規制 |
| buildingCoverage | number | 建蔽率（%） |
| floorAreaRatio | number | 容積率（%） |
| heightLimit | number | 高さ制限（m） |
| roadWidth | number | 前面道路幅員（m） |
| allowedBuildingArea | number | 許容建築面積（㎡） |
| price | number | 想定取得価格（円） |
| status | PropertyStatus | 物件ステータス |
| notes | string | 備考・メモ |
| organizationId | ID | 所属組織ID |
| shapeData | ShapeData | 敷地形状データ |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### 2.2 敷地形状データ (ShapeData)

敷地形状データは以下の属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| points | Point[] | 境界点座標の配列 |
| width | number | 敷地間口（m） |
| depth | number | 敷地奥行（m） |
| sourceFile | string | 元ファイル名 |

### 2.3 座標点 (Point)

敷地の境界点座標を表します：

| 属性 | 型 | 説明 |
|-----|-----|------|
| x | number | X座標 |
| y | number | Y座標 |

### 2.4 物件ステータス (PropertyStatus)

物件の現在の状態を表す列挙型：

| 値 | 説明 |
|---|------|
| NEW | 新規登録 |
| NEGOTIATING | 交渉中 |
| CONTRACTED | 契約済み |
| COMPLETED | 完了 |

## 3. エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/properties` | GET | 必須 | 物件一覧取得 |
| `/api/properties` | POST | 必須 | 新規物件登録 |
| `/api/properties/{id}` | GET | 必須 | 物件詳細取得 |
| `/api/properties/{id}` | PUT | 必須 | 物件情報更新 |
| `/api/properties/{id}` | PATCH | 必須 | 物件情報部分更新 |
| `/api/properties/{id}` | DELETE | 必須 | 物件削除 |
| `/api/properties/upload-survey` | POST | 必須 | 測量図アップロード |
| `/api/properties/{id}/shape` | PUT | 必須 | 敷地形状更新 |
| `/api/properties/{id}/documents` | GET | 必須 | 物件関連文書一覧取得 |
| `/api/properties/{id}/documents` | POST | 必須 | 物件関連文書追加 |
| `/api/properties/{id}/history` | GET | 必須 | 物件履歴取得 |

## 4. エンドポイント詳細

### 4.1 物件一覧取得 - GET /api/properties

ユーザーの所属組織の物件一覧を取得します。フィルタリング、ソート、ページネーションに対応しています。

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| page | number | いいえ | ページ番号（デフォルト: 1） |
| limit | number | いいえ | 1ページあたりの結果数（デフォルト: 20、最大: 100） |
| sort | string | いいえ | ソート条件（例: `updatedAt:desc,name:asc`） |
| name | string | いいえ | 物件名による部分一致フィルタ |
| address | string | いいえ | 住所による部分一致フィルタ |
| status | string | いいえ | ステータスによるフィルタ（カンマ区切りで複数指定可） |
| area_min | number | いいえ | 最小敷地面積によるフィルタ |
| area_max | number | いいえ | 最大敷地面積によるフィルタ |
| zoneType | string | いいえ | 用途地域によるフィルタ（カンマ区切りで複数指定可） |
| fields | string | いいえ | 取得するフィールドの指定（カンマ区切り） |
| expand | string | いいえ | 展開して取得する関連データ（現在対応: `shapeData`） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": [
    {
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
    },
    // 他の物件...
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**エラー**: 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "認証が必要です"
  }
}
```

#### 実装ノート

- レスポンスは組織ID一致で自動フィルタリングされる（認証ユーザーの組織のみ）
- `fields`パラメータが指定された場合、指定されたフィールドのみが返却される
- `expand=shapeData`を指定するとshapeDataが含まれる
- レート制限: 60回/分/ユーザー

---

### 4.2 新規物件登録 - POST /api/properties

新しい物件情報を登録します。

#### リクエスト

```json
{
  "name": "博多駅前オフィスビル計画",
  "address": "福岡市博多区博多駅前2-2-2",
  "area": 750.25,
  "zoneType": "category9",
  "fireZone": "fire",
  "buildingCoverage": 80,
  "floorAreaRatio": 600,
  "shadowRegulation": "none",
  "heightLimit": 60,
  "roadWidth": 12.5,
  "price": 300000000,
  "status": "new",
  "notes": "再開発エリア内の好立地案件"
}
```

#### バリデーションルール

- `name`: 必須、1文字以上100文字以下
- `address`: 必須、1文字以上200文字以下
- `area`: 必須、正の数値
- `zoneType`: 必須、ZoneType列挙型の有効な値
- `fireZone`: 必須、FireZone列挙型の有効な値
- `buildingCoverage`: 必須、0～100の整数
- `floorAreaRatio`: 必須、0～1000の整数
- `shadowRegulation`: オプション、ShadowRegulation列挙型の有効な値
- `heightLimit`: オプション、正の数値
- `roadWidth`: オプション、正の数値
- `price`: オプション、正の整数
- `status`: オプション、PropertyStatus列挙型の有効な値（デフォルト: NEW）
- `notes`: オプション、1000文字以下

#### レスポンス

**成功**: 201 Created
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
    "shadowRegulation": "none",
    "heightLimit": 60,
    "roadWidth": 12.5,
    "price": 300000000,
    "status": "new",
    "notes": "再開発エリア内の好立地案件",
    "organizationId": "org_123456",
    "createdAt": "2025-05-15T10:15:00Z",
    "updatedAt": "2025-05-15T10:15:00Z"
  }
}
```

**エラー**: バリデーションエラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": {
      "area": "0より大きい数値を入力してください",
      "zoneType": "有効な用途地域を選択してください"
    }
  }
}
```

#### 実装ノート

- 物件はユーザーの所属組織に自動的に関連付けられる
- `allowedBuildingArea`は`area`と`buildingCoverage`から自動計算
- 登録された物件は履歴にCREATEアクションとして記録
- 住所から自動的に緯度経度情報の取得を試みる（成功時はレスポンスに含める）
- レート制限: 30回/分/ユーザー

---

### 4.3 物件詳細取得 - GET /api/properties/{id}

指定されたIDの物件詳細情報を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| fields | string | いいえ | 取得するフィールドの指定（カンマ区切り） |
| expand | string | いいえ | 展開して取得する関連データ（カンマ区切り、対応: `shapeData`, `documents`) |

#### レスポンス

**成功**: 200 OK
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
    "shadowRegulation": "type2",
    "heightLimit": 31,
    "roadWidth": 8,
    "allowedBuildingArea": 400.4,
    "price": 250000000,
    "status": "active",
    "notes": "地下鉄駅徒歩3分の好立地",
    "organizationId": "org_123456",
    "shapeData": {
      "points": [
        { "x": 0, "y": 0 },
        { "x": 20, "y": 0 },
        { "x": 20, "y": 25 },
        { "x": 0, "y": 25 }
      ],
      "width": 20,
      "depth": 25,
      "sourceFile": "測量図_天神1-1-1.pdf"
    },
    "createdAt": "2025-05-01T10:00:00Z",
    "updatedAt": "2025-05-15T09:30:00Z"
  }
}
```

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定された物件が見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "この物件にアクセスする権限がありません"
  }
}
```

#### 実装ノート

- 組織IDが一致する物件のみアクセス可能
- `fields`パラメータが指定された場合、指定されたフィールドのみが返却
- `expand`パラメータが指定された場合、指定された関連データが含まれる
- レート制限: 60回/分/ユーザー

---

### 4.4 物件情報更新 - PUT /api/properties/{id}

指定されたIDの物件情報を完全に更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### リクエスト

```json
{
  "name": "福岡タワーマンション計画（改定）",
  "address": "福岡市中央区天神1-1-1",
  "area": 500.5,
  "zoneType": "category8",
  "fireZone": "semi-fire",
  "buildingCoverage": 80,
  "floorAreaRatio": 400,
  "shadowRegulation": "type2",
  "heightLimit": 31,
  "roadWidth": 8,
  "price": 280000000,
  "status": "negotiating",
  "notes": "地下鉄駅徒歩3分の好立地。価格交渉中。"
}
```

#### バリデーションルール

新規物件登録と同じバリデーションルールが適用されます。

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "name": "福岡タワーマンション計画（改定）",
    "address": "福岡市中央区天神1-1-1",
    "area": 500.5,
    "zoneType": "category8",
    "fireZone": "semi-fire",
    "buildingCoverage": 80,
    "floorAreaRatio": 400,
    "shadowRegulation": "type2",
    "heightLimit": 31,
    "roadWidth": 8,
    "allowedBuildingArea": 400.4,
    "price": 280000000,
    "status": "negotiating",
    "notes": "地下鉄駅徒歩3分の好立地。価格交渉中。",
    "organizationId": "org_123456",
    "updatedAt": "2025-05-15T11:20:00Z"
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラー、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 更新された物件は履歴にUPDATEアクションとして記録
- 住所が変更された場合は緯度経度情報の再取得を試みる
- `allowedBuildingArea`は`area`と`buildingCoverage`から自動再計算
- 組織IDの変更は許可されない
- レート制限: 30回/分/ユーザー

---

### 4.5 物件情報部分更新 - PATCH /api/properties/{id}

指定されたIDの物件情報の一部を更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### リクエスト

```json
{
  "status": "negotiating",
  "price": 280000000,
  "notes": "地下鉄駅徒歩3分の好立地。価格交渉中。"
}
```

#### バリデーションルール

指定されたフィールドに対して新規物件登録と同じバリデーションルールが適用されます。

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "status": "negotiating",
    "price": 280000000,
    "notes": "地下鉄駅徒歩3分の好立地。価格交渉中。",
    "updatedAt": "2025-05-15T11:20:00Z"
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラー、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 更新された物件は履歴にUPDATEアクションとして記録
- レスポンスには更新されたフィールドと`id`、`updatedAt`のみが含まれる
- 組織IDの変更は許可されない
- レート制限: 30回/分/ユーザー

---

### 4.6 物件削除 - DELETE /api/properties/{id}

指定されたIDの物件を削除します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "deleted": true
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 物件の削除は論理削除（ソフトデリート）として実装
- 削除された物件は履歴にDELETEアクションとして記録
- 関連するボリュームチェック結果、シナリオ、文書は削除されない
- 削除された物件は一覧取得では表示されなくなる
- レート制限: 10回/分/ユーザー

---

### 4.7 測量図アップロード - POST /api/properties/upload-survey

測量図をアップロードし、敷地形状を自動抽出します。

#### リクエスト

マルチパートフォームデータとして以下を送信：

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| file | File | はい | 測量図ファイル（PDF, DWG, DXF, JPEG, PNG） |
| propertyId | string | いいえ | 関連付ける物件ID（指定しない場合は形状データのみ返却） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "shapeData": {
      "points": [
        { "x": 0, "y": 0 },
        { "x": 20, "y": 0 },
        { "x": 20, "y": 25 },
        { "x": 0, "y": 25 }
      ],
      "width": 20,
      "depth": 25,
      "sourceFile": "測量図_天神1-1-1.pdf"
    },
    "property": {
      "id": "property_123",
      "updatedAt": "2025-05-15T11:30:00Z"
    }
  }
}
```

**エラー**: ファイル形式エラー - 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "サポートされていないファイル形式です。PDF, DWG, DXF, JPEG, PNGのいずれかをアップロードしてください。"
  }
}
```

**エラー**: 形状抽出エラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "SHAPE_EXTRACTION_FAILED",
    "message": "敷地形状の自動抽出に失敗しました。別のファイル形式を試すか、形状を手動で設定してください。"
  }
}
```

#### 実装ノート

- サポートするファイル形式: PDF, DWG, DXF, JPEG, PNG
- 最大ファイルサイズ: 10MB
- DWG/DXF形式の場合は座標データから直接形状を抽出
- PDF/画像の場合はOCRと画像認識技術を使用して形状を抽出
- `propertyId`が指定された場合、該当物件の`shapeData`を更新
- 物件更新時は履歴にUPDATEアクションとして記録
- 認識精度が不十分な場合は手動調整が必要
- レート制限: 20回/時間/ユーザー

---

### 4.8 敷地形状更新 - PUT /api/properties/{id}/shape

指定されたIDの物件の敷地形状データを手動で更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### リクエスト

```json
{
  "points": [
    { "x": 0, "y": 0 },
    { "x": 20, "y": 0 },
    { "x": 20, "y": 25 },
    { "x": 0, "y": 25 }
  ],
  "width": 20,
  "depth": 25,
  "sourceFile": "手動入力"
}
```

#### バリデーションルール

- `points`: 必須、少なくとも3つの点を含む配列
- 各点は有効な`x`と`y`の座標値を持つ必要がある
- `width`: オプション、正の数値
- `depth`: オプション、正の数値
- `sourceFile`: オプション、文字列

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "shapeData": {
      "points": [
        { "x": 0, "y": 0 },
        { "x": 20, "y": 0 },
        { "x": 20, "y": 25 },
        { "x": 0, "y": 25 }
      ],
      "width": 20,
      "depth": 25,
      "sourceFile": "手動入力"
    },
    "updatedAt": "2025-05-15T11:40:00Z"
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラー、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 敷地形状の更新は物件履歴にUPDATEアクションとして記録
- 点の座標はシステム内の相対座標系で保存
- 既存の形状データがある場合は完全に置き換え
- レート制限: 30回/分/ユーザー

---

### 4.9 物件関連文書一覧取得 - GET /api/properties/{id}/documents

指定されたIDの物件に関連する文書一覧を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| page | number | いいえ | ページ番号（デフォルト: 1） |
| limit | number | いいえ | 1ページあたりの結果数（デフォルト: 20、最大: 100） |
| sort | string | いいえ | ソート条件（例: `updatedAt:desc,name:asc`） |
| documentType | string | いいえ | 文書タイプによるフィルタ（カンマ区切りで複数指定可） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_123",
      "propertyId": "property_123",
      "name": "測量図_天神1-1-1.pdf",
      "fileType": "application/pdf",
      "fileSize": 1245678,
      "fileUrl": "/api/documents/doc_123/download",
      "documentType": "survey-map",
      "description": "福岡市役所発行の公式測量図",
      "createdAt": "2025-05-01T10:30:00Z",
      "updatedAt": "2025-05-01T10:30:00Z"
    },
    // 他の文書...
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 文書データはストレージサービスに保存され、ダウンロード用のURLが提供される
- 文書タイプには `survey-map`（測量図）、`register`（登記簿謄本）、`contract`（契約書）、`photo`（写真）、`other`（その他）が含まれる
- レート制限: 60回/分/ユーザー

---

### 4.10 物件関連文書追加 - POST /api/properties/{id}/documents

指定されたIDの物件に関連する文書を追加します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### リクエスト

マルチパートフォームデータとして以下を送信：

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| file | File | はい | 文書ファイル |
| documentType | string | はい | 文書タイプ（`survey-map`, `register`, `contract`, `photo`, `other`） |
| description | string | いいえ | 文書の説明 |

#### レスポンス

**成功**: 201 Created
```json
{
  "success": true,
  "data": {
    "id": "doc_124",
    "propertyId": "property_123",
    "name": "登記簿謄本_天神1-1-1.pdf",
    "fileType": "application/pdf",
    "fileSize": 987654,
    "fileUrl": "/api/documents/doc_124/download",
    "documentType": "register",
    "description": "2025年5月取得の登記簿謄本",
    "createdAt": "2025-05-15T11:50:00Z",
    "updatedAt": "2025-05-15T11:50:00Z"
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラー、権限エラーの場合は前述のエラーレスポンスと同様。

**エラー**: ファイルサイズエラー - 413 Payload Too Large
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "ファイルサイズが上限（20MB）を超えています"
  }
}
```

#### 実装ノート

- 最大ファイルサイズ: 20MB
- サポートするファイル形式: PDF, DOCX, XLSX, JPEG, PNG, TIFF, DWG, DXF, ZIP
- 文書の追加は物件履歴にCREATEアクションとして記録
- 文書名はアップロードされたファイル名から自動設定
- 文書タイプによってサムネイル生成やプレビュー機能が適用
- レート制限: 30回/分/ユーザー

---

### 4.11 物件履歴取得 - GET /api/properties/{id}/history

指定されたIDの物件の変更履歴を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 物件ID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| page | number | いいえ | ページ番号（デフォルト: 1） |
| limit | number | いいえ | 1ページあたりの結果数（デフォルト: 20、最大: 100） |
| action | string | いいえ | アクションタイプによるフィルタ（`create`, `update`, `delete`） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": "hist_123",
      "propertyId": "property_123",
      "userId": "user_123",
      "action": "update",
      "description": "物件状態を「新規」から「交渉中」に変更",
      "details": {
        "previous": { "status": "new" },
        "current": { "status": "negotiating" }
      },
      "createdAt": "2025-05-15T11:20:00Z"
    },
    {
      "id": "hist_122",
      "propertyId": "property_123",
      "userId": "user_123",
      "action": "update",
      "description": "敷地形状を更新",
      "details": {
        "shapeUpdated": true
      },
      "createdAt": "2025-05-15T11:10:00Z"
    },
    // 他の履歴...
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 履歴は時系列逆順（最新の変更が先頭）で返却
- 機微情報（価格変更等）は適切に抽象化して記録
- ユーザー情報は操作を行ったユーザーのIDを記録
- レート制限: 60回/分/ユーザー

## 5. データモデルとの整合性

このAPIは`shared/index.ts`で定義されている以下のデータモデルと整合しています：

- `Property`: 物件基本情報
- `PropertyBase`: 物件基本情報の基底インターフェース
- `PropertyDetail`: 物件詳細情報
- `PropertyCreateData`: 物件登録データ
- `PropertyUpdateData`: 物件更新データ
- `PropertyStatus`: 物件ステータス列挙型
- `ZoneType`: 用途地域列挙型
- `FireZone`: 防火地域区分列挙型
- `ShadowRegulation`: 日影規制列挙型
- `ShapeData`: 敷地形状データ
- `Point`: 座標点
- `PropertyFilter`: 物件フィルター

## 6. サンプルコード

### 6.1 物件一覧取得

```typescript
// フロントエンドでの物件一覧取得例
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// 物件一覧取得
const fetchProperties = async () => {
  try {
    const response = await axios.get(API_PATHS.PROPERTIES.BASE, {
      params: {
        status: 'new,negotiating',
        sort: 'updatedAt:desc',
        page: 1,
        limit: 20
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('物件一覧の取得に失敗しました', error);
    throw error;
  }
};
```

### 6.2 新規物件登録

```typescript
// フロントエンドでの新規物件登録例
import axios from 'axios';
import { API_PATHS, PropertyCreateData } from '@shared/index';

// 物件登録
const createProperty = async (propertyData: PropertyCreateData) => {
  try {
    const response = await axios.post(API_PATHS.PROPERTIES.BASE, propertyData);
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('物件登録に失敗しました', error);
    throw error;
  }
};
```

### 6.3 測量図アップロード

```typescript
// フロントエンドでの測量図アップロード例
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// 測量図アップロード
const uploadSurveyMap = async (file: File, propertyId: string) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('propertyId', propertyId);
    
    const response = await axios.post(
      API_PATHS.PROPERTIES.UPLOAD_SURVEY,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('測量図アップロードに失敗しました', error);
    throw error;
  }
};
```

## 7. セキュリティ考慮事項

### 7.1 アクセス制御

- 全てのエンドポイントはユーザー認証が必要
- 物件は組織IDに基づいてアクセス制御される
- 組織外のユーザーは物件データにアクセス不可

### 7.2 入力バリデーション

- 全てのユーザー入力は厳格にバリデーション
- SQLインジェクション、XSS対策としての入力サニタイズ
- ファイルアップロードは拡張子とMIMEタイプの両方で検証

### 7.3 レート制限

- すべてのエンドポイントには適切なレート制限を実装
- DDoS攻撃やブルートフォース攻撃を防止

### 7.4 データ保護

- 重要な物件情報はデータベースレベルで暗号化
- ファイルストレージはアクセス制御された安全な環境で保管
- 物理的な位置情報（緯度・経度）のアクセスは制限

## 8. エラーハンドリング

エラーレスポンスは一貫した形式で返却されます：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {
      // オプションの詳細情報
    }
  }
}
```

一般的なエラーコード：

| エラーコード | 説明 |
|------------|------|
| `VALIDATION_ERROR` | 入力データが検証基準を満たしていない |
| `RESOURCE_NOT_FOUND` | 要求されたリソースが存在しない |
| `PERMISSION_DENIED` | リソースにアクセスする権限がない |
| `INVALID_FILE_FORMAT` | サポートされていないファイル形式 |
| `FILE_TOO_LARGE` | ファイルサイズが上限を超えている |
| `SHAPE_EXTRACTION_FAILED` | 形状データの自動抽出に失敗 |

## 9. キャッシング戦略

特定のエンドポイントにはキャッシング戦略が適用されます：

| エンドポイント | キャッシュTTL | 条件 |
|--------------|-------------|------|
| GET /api/properties/{id} | 5分 | If-Modified-Since, ETagがサポート |
| GET /api/properties/{id}/documents | 5分 | If-Modified-Since, ETagがサポート |
| GET /api/properties/{id}/history | 15分 | If-Modified-Since, ETagがサポート |

キャッシュの無効化は以下の条件で行われます：
- 関連リソースが更新された場合
- 関連するサブリソースが追加・更新・削除された場合