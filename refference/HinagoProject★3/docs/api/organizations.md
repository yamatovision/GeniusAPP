# 組織関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-18  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）の組織管理に関するAPI仕様を定義します。組織情報の取得、更新などの操作を提供します。

組織はシステムにおけるデータアクセスの基本単位であり、ユーザーは一つの組織に所属します。組織に関連するリソース（物件、分析結果など）は組織内のユーザー間で共有されますが、異なる組織間ではデータが分離されます。

## 2. リソース概要

### 2.1 組織リソース (Organization)

組織リソースは以下の主要属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| name | string | 組織名 |
| subscription | SubscriptionType | サブスクリプションタイプ |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### 2.2 サブスクリプションタイプ (SubscriptionType)

組織のサブスクリプションレベルを表す列挙型：

| 値 | 説明 |
|---|------|
| FREE | 無料プラン |
| BASIC | 基本プラン |
| PREMIUM | プレミアムプラン |

## 3. エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/organizations/{id}` | GET | 必須 | 自組織情報取得 |
| `/api/organizations/{id}` | PUT | 必須 | 自組織情報更新 |

## 4. エンドポイント詳細

### 4.1 自組織情報取得 - GET /api/organizations/{id}

指定されたIDの組織情報を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 組織ID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "org_123456",
    "name": "山田不動産開発",
    "subscription": "free",
    "createdAt": "2025-05-01T09:00:00Z",
    "updatedAt": "2025-05-01T09:00:00Z",
    "stats": {
      "userCount": 5,
      "propertyCount": 12,
      "storageUsed": 256000000,
      "storageLimit": 5368709120
    },
    "limits": {
      "maxUsers": 10,
      "maxProperties": 50,
      "maxStorage": 5368709120,
      "features": ["basic_volume_check", "property_management"]
    }
  }
}
```

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定された組織が見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "この組織情報にアクセスする権限がありません"
  }
}
```

#### 実装ノート

- 自身の所属組織のみアクセス可能
- レスポンスには組織の基本情報に加えて、使用状況統計と制限情報も含まれる
- `stats`は現在の使用状況を表し、`limits`はサブスクリプションタイプに応じた制限値を表す
- レート制限: 60回/分/ユーザー

---

### 4.2 自組織情報更新 - PUT /api/organizations/{id}

指定されたIDの組織情報を更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 組織ID |

#### リクエスト

```json
{
  "name": "山田不動産開発株式会社"
}
```

#### バリデーションルール

- `name`: 必須、1文字以上100文字以下

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "org_123456",
    "name": "山田不動産開発株式会社",
    "updatedAt": "2025-05-15T14:30:00Z"
  }
}
```

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定された組織が見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "この組織情報を更新する権限がありません"
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
      "name": "組織名は1文字以上100文字以下で入力してください"
    }
  }
}
```

#### 実装ノート

- 自身の所属組織のみ更新可能
- 現在のエンドポイントでは組織名のみ更新可能
- サブスクリプションタイプの変更は管理者による承認が必要なため別の管理プロセスで行われる
- レスポンスには更新されたフィールドと`id`、`updatedAt`のみが含まれる
- レート制限: 10回/分/ユーザー

## 5. サブスクリプション機能と制限

各サブスクリプションタイプに応じた機能制限は以下の通りです：

### 5.1 無料プラン (FREE)

| 制限項目 | 値 | 説明 |
|---------|-----|------|
| maxUsers | 5 | 最大ユーザー数 |
| maxProperties | 10 | 最大物件数 |
| maxStorage | 1 GB | 最大ストレージ容量 |
| features | ["basic_volume_check", "property_management"] | 利用可能機能 |

### 5.2 基本プラン (BASIC)

| 制限項目 | 値 | 説明 |
|---------|-----|------|
| maxUsers | 20 | 最大ユーザー数 |
| maxProperties | 50 | 最大物件数 |
| maxStorage | 5 GB | 最大ストレージ容量 |
| features | ["basic_volume_check", "property_management", "profitability_analysis"] | 利用可能機能 |

### 5.3 プレミアムプラン (PREMIUM)

| 制限項目 | 値 | 説明 |
|---------|-----|------|
| maxUsers | 無制限 | 最大ユーザー数 |
| maxProperties | 無制限 | 最大物件数 |
| maxStorage | 50 GB | 最大ストレージ容量 |
| features | ["advanced_volume_check", "property_management", "profitability_analysis", "scenario_comparison", "pdf_reports", "api_access"] | 利用可能機能 |

## 6. 機能一覧

| 機能ID | 説明 | 必要サブスクリプション |
|-------|------|-------------------|
| basic_volume_check | 基本的なボリュームチェック機能 | FREE以上 |
| property_management | 物件管理機能 | FREE以上 |
| profitability_analysis | 収益性試算機能 | BASIC以上 |
| advanced_volume_check | 高度なボリュームチェック機能（3Dモデル等） | PREMIUM |
| scenario_comparison | 複数シナリオの比較機能 | PREMIUM |
| pdf_reports | PDF詳細レポート出力 | PREMIUM |
| api_access | API外部アクセス機能 | PREMIUM |

## 7. データモデルとの整合性

このAPIは`shared/index.ts`で定義されている以下のデータモデルと整合しています：

- `Organization`: 組織情報
- `SubscriptionType`: サブスクリプションタイプ列挙型

## 8. サンプルコード

### 8.1 組織情報取得

```typescript
// フロントエンドでの組織情報取得例
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// 自組織情報取得
const fetchOrganization = async (organizationId: string) => {
  try {
    const response = await axios.get(
      API_PATHS.ORGANIZATIONS.DETAIL(organizationId)
    );
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('組織情報の取得に失敗しました', error);
    throw error;
  }
};
```

### 8.2 組織情報更新

```typescript
// フロントエンドでの組織情報更新例
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// 組織情報更新
const updateOrganization = async (
  organizationId: string,
  name: string
) => {
  try {
    const response = await axios.put(
      API_PATHS.ORGANIZATIONS.DETAIL(organizationId),
      { name }
    );
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('組織情報の更新に失敗しました', error);
    throw error;
  }
};

// 使用例
const updateOrgName = async (orgId: string) => {
  await updateOrganization(orgId, '山田不動産開発株式会社');
};
```

## 9. セキュリティ考慮事項

### 9.1 アクセス制御

- 全てのエンドポイントはユーザー認証が必要
- ユーザーは自身の所属組織の情報のみ閲覧・更新可能
- 組織間のデータは厳格に分離され、他組織のデータにはアクセス不可

### 9.2 入力バリデーション

- 全てのユーザー入力は厳格にバリデーション
- 組織名の長さ制限と文字種チェック

### 9.3 レート制限

- 情報取得は60回/分/ユーザーに制限
- 情報更新は10回/分/ユーザーに制限

## 10. エラーハンドリング

一般的な組織関連のエラーコード：

| エラーコード | 説明 |
|------------|------|
| `RESOURCE_NOT_FOUND` | 指定された組織が存在しない |
| `PERMISSION_DENIED` | 操作に必要な権限がない |
| `VALIDATION_ERROR` | 入力データが検証基準を満たしていない |
| `SUBSCRIPTION_LIMIT_REACHED` | サブスクリプションの制限に達した |

## 11. キャッシング戦略

特定のエンドポイントにはキャッシング戦略が適用されます：

| エンドポイント | キャッシュTTL | 条件 |
|--------------|-------------|------|
| GET /api/organizations/{id} | 5分 | If-Modified-Since, ETagがサポート |