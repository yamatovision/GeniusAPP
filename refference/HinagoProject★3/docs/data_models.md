# データモデル設計書

このドキュメントはHinagoProject（ボリュームチェックシステム）のデータモデル設計を定義します。
このデータモデル設計は「単一の真実源」原則に基づいており、すべての型定義は`shared/index.ts`で一元管理されます。

## 目次

1. [エンティティ関連図](#エンティティ関連図)
2. [主要エンティティ詳細](#主要エンティティ詳細)
3. [重要なデータ構造](#重要なデータ構造)
4. [API設計ガイドライン](#api設計ガイドライン)
5. [変更履歴](#変更履歴)

## エンティティ関連図

```
User (ユーザー) <--> Organization (組織)
        |                 |
        v                 v
      Property (物件)
        |
        +------------+------------+
        |            |            |
        v            v            v
  PropertyShape  VolumeCheck   Document
  (敷地形状)    (ボリュームチェック)  (文書)
                    |
                    v
                 Scenario
                (シナリオ)
                    |
                    v
              ProfitabilityResult
              (収益性試算結果)
```

## 主要エンティティ詳細

### User (ユーザー)

ユーザー情報と認証データを管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| id | ID | 一意識別子 |
| email | string | メールアドレス（ログインID） |
| name | string | ユーザー名 |
| role | UserRole | 権限（admin, manager, user） |
| organizationId | ID | 所属組織ID |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### Organization (組織)

企業アカウント情報を管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| id | ID | 一意識別子 |
| name | string | 組織名 |
| subscription | SubscriptionType | サブスクリプションタイプ |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### Property (物件)

物件の基本情報と法規制情報を管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
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
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### PropertyShape (敷地形状)

土地の形状データを管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| points | Point[] | 境界点座標の配列 |
| width | number | 敷地間口（m） |
| depth | number | 敷地奥行（m） |
| sourceFile | string | 元ファイル名 |

### VolumeCheck (ボリュームチェック)

建築可能なボリューム計算結果を管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| id | ID | 一意識別子 |
| propertyId | ID | 物件ID |
| assetType | AssetType | アセットタイプ |
| buildingArea | number | 建築面積（㎡） |
| totalFloorArea | number | 延床面積（㎡） |
| buildingHeight | number | 建物高さ（m） |
| consumptionRate | number | 容積消化率（%） |
| floors | Floor[] | 階別情報 |
| model3dData | any | 3Dモデルデータ |
| createdAt | Date | 作成日時 |

### Scenario (シナリオ)

収益性試算のシナリオ設定を管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| id | ID | 一意識別子 |
| propertyId | ID | 物件ID |
| volumeCheckId | ID | ボリュームチェックID |
| name | string | シナリオ名 |
| params | ScenarioParams | シナリオパラメータ |
| profitabilityResult | ProfitabilityResult | 収益性試算結果 |
| createdAt | Date | 作成日時 |

### ProfitabilityResult (収益性試算結果)

財務指標と収支分析結果を管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| id | ID | 一意識別子 |
| propertyId | ID | 物件ID |
| volumeCheckId | ID | ボリュームチェックID |
| assetType | AssetType | アセットタイプ |
| parameters | FinancialParams | 財務パラメータ |
| landPrice | number | 土地価格（円） |
| constructionCost | number | 建設費（円） |
| miscExpenses | number | 諸経費（円） |
| totalInvestment | number | 総投資額（円） |
| annualRentalIncome | number | 年間賃料収入（円） |
| annualOperatingExpenses | number | 年間運営費用（円） |
| annualMaintenance | number | 年間修繕費（円） |
| annualPropertyTax | number | 年間固定資産税（円） |
| annualNOI | number | 年間純収益（円） |
| noiYield | number | NOI利回り（%） |
| irr | number | 内部収益率（%） |
| paybackPeriod | number | 投資回収期間（年） |
| npv | number | 正味現在価値（円） |
| profitabilityIndex | number | 収益性指数 |
| annualFinancials | AnnualFinancials[] | 年間収支データ |
| createdAt | Date | 作成日時 |

### Document (文書)

物件関連の文書や図面を管理します。

| 属性名 | 型 | 説明 |
|--------|------|------|
| id | ID | 一意識別子 |
| propertyId | ID | 物件ID |
| name | string | ファイル名 |
| fileType | string | ファイルタイプ |
| fileSize | number | ファイルサイズ |
| fileUrl | string | ファイルURL |
| documentType | DocumentType | 文書タイプ |
| description | string | 説明 |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

## 重要なデータ構造

### Point (座標点)

敷地の境界点座標を表します。

```typescript
export interface Point {
  x: number;
  y: number;
}
```

### Floor (階別情報)

建物の各階の面積情報を表します。

```typescript
export interface Floor {
  level: number;         // 階数
  area: number;          // 床面積（㎡）
  commonArea?: number;   // 共用部面積（㎡）
  privateArea?: number;  // 専有部面積（㎡）
}
```

### BuildingParams (建築パラメータ)

ボリュームチェック計算のパラメータを表します。

```typescript
export interface BuildingParams {
  assetType: AssetType;
  floorHeight: number;       // 階高（m）
  commonAreaRatio: number;   // 共用部率（%）
  roadWidth?: number;        // 前面道路幅員（m）
  floors: number;            // 階数
}
```

### FinancialParams (財務パラメータ)

収益性試算のパラメータを表します。

```typescript
export interface FinancialParams {
  rentPerSqm: number;        // 賃料単価（円/㎡）
  occupancyRate: number;     // 稼働率（%）
  managementCostRate: number; // 管理コスト率（%）
  constructionCost: number;  // 建設単価（円/㎡）
  rentalPeriod: number;      // 運用期間（年）
  capRate: number;           // 還元利回り（%）
}
```

### AnnualFinancials (年間収支)

各年の収支情報を表します。

```typescript
export interface AnnualFinancials {
  year: number;
  rentalIncome: number;      // 賃料収入（円）
  operatingExpenses: number; // 運営費用（円）
  netOperatingIncome: number; // 純収益（円）
  cumulativeIncome: number;   // 累計収益（円）
}
```

## API設計ガイドライン

1. すべてのAPIパスは `shared/index.ts` 内の `API_PATHS` で一元管理されます
2. コード内でAPIパスをハードコードせず、必ず `API_PATHS` からインポートして使用します
3. パスパラメータを含むエンドポイントは関数として提供されます（例: `/api/properties/:id` → `API_PATHS.PROPERTIES.DETAIL(id)`）
4. バックエンド実装時は、クライアントサイドと同じリクエスト/レスポンス型を使用します
5. 成功時のレスポンスは `{ success: true, data: T }` の形式、エラー時は `{ success: false, error: string }` の形式で統一します

## 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|----------|----------|--------|
| 2025-05-15 | 1.0.0 | 初期データモデル設計 | データモデルアーキテクト |