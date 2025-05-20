# データモデル設計書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-17  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントではHinagoProject（ボリュームチェックシステム）のデータモデル設計を定義します。すべての型定義は `shared/index.ts` で一元管理され、フロントエンドとバックエンドで共有されます。

## 2. エンティティ関連図

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

## 3. データモデル詳細

### 3.1 認証・ユーザー関連

#### 3.1.1 ユーザー (User)

ユーザーはシステムへのアクセス権を持つ個人を表します。各ユーザーは1つの組織に所属します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| email | string | メールアドレス | 一意、必須 |
| name | string | 氏名 | 必須 |
| role | UserRole | ユーザーロール | 必須 |
| organizationId | ID | 所属組織ID | 外部キー、必須 |
| password | string | ハッシュ化されたパスワード | 必須（APIレスポンスには含まれない） |
| createdAt | Date | 作成日時 | 自動生成 |
| updatedAt | Date | 更新日時 | 自動更新 |

```typescript
export enum UserRole {
  USER = 'user',
  // 将来的な拡張: ADMIN = 'admin', MANAGER = 'manager', READ_ONLY = 'read_only'
}

export interface User extends Timestamps {
  id: ID;
  email: string;
  name: string;
  role: UserRole;
  organizationId: ID;
}
```

#### 3.1.2 組織 (Organization)

組織はユーザーのグループであり、データアクセスの基本単位です。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| name | string | 組織名 | 必須 |
| subscription | SubscriptionType | サブスクリプションタイプ | 必須 |
| createdAt | Date | 作成日時 | 自動生成 |
| updatedAt | Date | 更新日時 | 自動更新 |

```typescript
export enum SubscriptionType {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export interface Organization extends Timestamps {
  id: ID;
  name: string;
  subscription: SubscriptionType;
}
```

### 3.2 物件関連

#### 3.2.1 物件 (Property)

物件は土地情報と関連データを保持する中心エンティティです。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| organizationId | ID | 所有組織ID | 外部キー、必須 |
| name | string | 物件名 | 必須 |
| address | string | 住所 | 必須 |
| area | number | 敷地面積（㎡） | 必須、正数 |
| zoneType | ZoneType | 用途地域 | 必須 |
| fireZone | FireZone | 防火地域区分 | 必須 |
| buildingCoverage | number | 建蔽率（%） | 必須、0-100 |
| floorAreaRatio | number | 容積率（%） | 必須、0-1300 |
| shadowRegulation | ShadowRegulation | 日影規制 | オプション |
| heightLimit | number | 高さ制限（m） | オプション |
| roadWidth | number | 前面道路幅員（m） | オプション |
| allowedBuildingArea | number | 許容建築面積（㎡） | 計算値 |
| price | number | 想定取得価格（円） | オプション |
| status | PropertyStatus | 物件ステータス | 必須 |
| notes | string | 備考・メモ | オプション |
| shapeData | ShapeData | 敷地形状データ | オプション |
| createdAt | Date | 作成日時 | 自動生成 |
| updatedAt | Date | 更新日時 | 自動更新 |

```typescript
export enum ZoneType {
  CATEGORY1 = 'category1',  // 第一種低層住居専用地域
  CATEGORY2 = 'category2',  // 第二種低層住居専用地域
  CATEGORY3 = 'category3',  // 第一種中高層住居専用地域
  CATEGORY4 = 'category4',  // 第二種中高層住居専用地域
  CATEGORY5 = 'category5',  // 第一種住居地域
  CATEGORY6 = 'category6',  // 第二種住居地域
  CATEGORY7 = 'category7',  // 準住居地域
  CATEGORY8 = 'category8',  // 近隣商業地域
  CATEGORY9 = 'category9',  // 商業地域
  CATEGORY10 = 'category10', // 準工業地域
  CATEGORY11 = 'category11', // 工業地域
  CATEGORY12 = 'category12', // 工業専用地域
}

export enum FireZone {
  FIRE = 'fire',         // 防火地域
  SEMI_FIRE = 'semi-fire', // 準防火地域
  NONE = 'none',         // 指定なし
}

export enum ShadowRegulation {
  TYPE1 = 'type1',  // 規制タイプ1（4時間/2.5時間）
  TYPE2 = 'type2',  // 規制タイプ2（5時間/3時間）
  NONE = 'none',    // 規制なし
}

export enum PropertyStatus {
  NEW = 'new',           // 新規
  NEGOTIATING = 'negotiating', // 交渉中
  CONTRACTED = 'contracted',   // 契約済み
  COMPLETED = 'completed',     // 完了
}

export interface Property extends PropertyDetail, Timestamps {
  id: ID;
  organizationId: ID;
  status: PropertyStatus;
  shapeData?: ShapeData;
}
```

#### 3.2.2 敷地形状 (PropertyShape)

敷地形状は土地の境界点座標を保持します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| points | Point[] | 境界点座標の配列 | 必須、最低3点 |
| width | number | 敷地間口（m） | オプション |
| depth | number | 敷地奥行（m） | オプション |
| sourceFile | string | 元ファイル名 | オプション |

```typescript
export interface Point {
  x: number;
  y: number;
}

export interface ShapeData {
  points: Point[];
  width?: number;
  depth?: number;
  sourceFile?: string;
}
```

### 3.3 分析関連

#### 3.3.1 アセットタイプ (AssetType)

アセットタイプは建物種別と関連パラメータを定義します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | AssetType | アセットタイプID | 列挙型 |
| name | string | アセットタイプ名 | 必須 |
| defaultFloorHeight | number | デフォルト階高（m） | 必須 |
| commonAreaRatio | number | 共用部率（%） | 必須、0-100 |
| standardConsumptionRate | number | 標準的な容積消化率（%） | 必須、0-100 |

```typescript
export enum AssetType {
  MANSION = 'mansion',             // マンション
  OFFICE = 'office',               // オフィス
  WOODEN_APARTMENT = 'wooden-apartment', // 木造アパート
  HOTEL = 'hotel',                 // ホテル
}

export interface AssetTypeInfo {
  id: AssetType;
  name: string;
  defaultFloorHeight: number;
  commonAreaRatio: number;
  standardConsumptionRate: number;
}
```

#### 3.3.2 ボリュームチェック (VolumeCheck)

ボリュームチェックは建築可能ボリュームの計算結果を表します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| propertyId | ID | 物件ID | 外部キー、必須 |
| assetType | AssetType | アセットタイプ | 必須 |
| buildingArea | number | 建築面積（㎡） | 必須、正数 |
| totalFloorArea | number | 延床面積（㎡） | 必須、正数 |
| buildingHeight | number | 建物高さ（m） | 必須、正数 |
| consumptionRate | number | 容積消化率（%） | 必須、0-100 |
| floors | Floor[] | 階別情報 | 必須 |
| model3dData | Object | 3Dモデルデータ | オプション |
| createdAt | Date | 作成日時 | 自動生成 |

```typescript
export interface Floor {
  level: number;
  area: number;
  commonArea?: number;
  privateArea?: number;
}

export interface VolumeCheckResult {
  id: ID;
  propertyId: ID;
  assetType: AssetType;
  buildingArea: number;
  totalFloorArea: number;
  buildingHeight: number;
  consumptionRate: number;
  floors: Floor[];
  createdAt: Date;
  model3dData?: {
    url: string;
    format: string;
  };
}
```

#### 3.3.3 収益性試算 (ProfitabilityResult)

収益性試算は投資収益性の分析結果を表します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| propertyId | ID | 物件ID | 外部キー、必須 |
| volumeCheckId | ID | ボリュームチェックID | 外部キー、必須 |
| assetType | AssetType | アセットタイプ | 必須 |
| parameters | FinancialParams | 財務パラメータ | 必須 |
| landPrice | number | 土地価格（円） | 必須 |
| constructionCost | number | 建設費（円） | 必須 |
| miscExpenses | number | 諸経費（円） | 必須 |
| totalInvestment | number | 総投資額（円） | 必須 |
| annualRentalIncome | number | 年間賃料収入（円） | 必須 |
| annualOperatingExpenses | number | 年間運営費用（円） | 必須 |
| annualMaintenance | number | 年間修繕費（円） | 必須 |
| annualPropertyTax | number | 年間固定資産税（円） | 必須 |
| annualNOI | number | 年間純収益（円） | 必須 |
| noiYield | number | NOI利回り（%） | 必須 |
| irr | number | 内部収益率（%） | 必須 |
| paybackPeriod | number | 投資回収期間（年） | 必須 |
| npv | number | 正味現在価値（円） | 必須 |
| profitabilityIndex | number | 収益性指数 | オプション |
| annualFinancials | AnnualFinancials[] | 年間収支予測 | 必須 |
| createdAt | Date | 作成日時 | 自動生成 |

```typescript
export interface FinancialParams {
  rentPerSqm: number;
  occupancyRate: number;
  managementCostRate: number;
  constructionCost: number;
  rentalPeriod: number;
  capRate: number;
}

export interface AnnualFinancials {
  year: number;
  rentalIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  cumulativeIncome: number;
}

export interface ProfitabilityResult {
  id: ID;
  propertyId: ID;
  volumeCheckId: ID;
  assetType: AssetType;
  parameters: FinancialParams;
  
  // 初期投資
  landPrice: number;
  constructionCost: number;
  miscExpenses: number;
  totalInvestment: number;
  
  // 年間収支
  annualRentalIncome: number;
  annualOperatingExpenses: number;
  annualMaintenance: number;
  annualPropertyTax: number;
  annualNOI: number;
  
  // 財務指標
  noiYield: number;
  irr: number;
  paybackPeriod: number;
  npv: number;
  profitabilityIndex?: number;
  
  // キャッシュフロー
  annualFinancials: AnnualFinancials[];
  
  createdAt: Date;
}
```

#### 3.3.4 シナリオ (Scenario)

シナリオは複数の収益性試算パラメータセットを管理します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| propertyId | ID | 物件ID | 外部キー、必須 |
| volumeCheckId | ID | ボリュームチェックID | 外部キー、必須 |
| name | string | シナリオ名 | 必須 |
| params | ScenarioParams | シナリオパラメータ | 必須 |
| profitabilityResult | ProfitabilityResult | 収益性試算結果 | オプション |
| createdAt | Date | 作成日時 | 自動生成 |

```typescript
export interface ScenarioParams extends FinancialParams {
  name: string;
  assetType: AssetType;
}

export interface Scenario {
  id: ID;
  propertyId: ID;
  volumeCheckId: ID;
  name: string;
  params: ScenarioParams;
  profitabilityResult?: ProfitabilityResult;
  createdAt: Date;
}
```

### 3.4 文書関連

#### 3.4.1 文書 (Document)

文書は物件に関連するアップロードされたファイルを表します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| propertyId | ID | 物件ID | 外部キー、必須 |
| name | string | ファイル名 | 必須 |
| fileType | string | ファイルタイプ | 必須 |
| fileSize | number | ファイルサイズ（バイト） | 必須 |
| fileUrl | string | ファイルURL | 必須 |
| documentType | DocumentType | 文書タイプ | 必須 |
| description | string | 説明 | オプション |
| createdAt | Date | 作成日時 | 自動生成 |
| updatedAt | Date | 更新日時 | 自動更新 |

```typescript
export enum DocumentType {
  SURVEY_MAP = 'survey-map',   // 測量図
  REGISTER = 'register',      // 登記簿謄本
  CONTRACT = 'contract',      // 契約書
  PHOTO = 'photo',           // 写真
  OTHER = 'other',           // その他
}

export interface Document extends Timestamps {
  id: ID;
  propertyId: ID;
  name: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  documentType: DocumentType;
  description?: string;
}
```

### 3.5 履歴関連

#### 3.5.1 履歴 (History)

履歴は物件に対する変更履歴を記録します。

| フィールド名 | 型 | 説明 | 制約 |
|------------|---|-----|-----|
| id | ID | 一意識別子 | 主キー |
| propertyId | ID | 物件ID | 外部キー、必須 |
| userId | ID | 実行ユーザーID | 外部キー、必須 |
| action | HistoryAction | 実行アクション | 必須 |
| description | string | 変更内容説明 | 必須 |
| details | Object | 変更詳細 | オプション |
| createdAt | Date | 作成日時 | 自動生成 |
| updatedAt | Date | 更新日時 | 自動更新 |

```typescript
export enum HistoryAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export interface HistoryEntry extends Timestamps {
  id: ID;
  propertyId: ID;
  userId: ID;
  action: HistoryAction;
  description: string;
  details?: Record<string, any>;
}
```

## 4. 共通型定義

### 4.1 基本型定義

```typescript
// 基本ID型
export type ID = string;

// タイムスタンプ関連
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// ページネーション
export interface PaginationParams {
  page: number;
  limit: number;
}

// 共通レスポンス形式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    [key: string]: any;
  };
}
```

## 5. データモデル検証ルール

### 5.1 入力検証ルール

各モデルの主要フィールドに対する検証ルールを定義します：

| モデル | フィールド | 検証ルール |
|-------|-----------|-----------|
| User | email | 有効なメールアドレス形式、一意性 |
| User | password | 最小8文字、英数字・記号の組み合わせ |
| Property | name | 1-100文字 |
| Property | area | 正数、最大99999 |
| Property | buildingCoverage | 0-100の整数 |
| Property | floorAreaRatio | 0-1300の整数 |
| VolumeCheck | buildingArea | 正数、物件面積以下 |
| VolumeCheck | floors | 少なくとも1階以上 |
| ProfitabilityResult | parameters | すべての財務パラメータは正数 |
| Document | fileSize | 最大100MB |

## 6. データベース実装

プロジェクトではMongoDBを採用し、以下の設計原則に従います：

### 6.1 コレクション設計

| コレクション名 | 説明 | インデックス |
|--------------|-----|------------|
| users | ユーザー情報 | email (unique), organizationId |
| organizations | 組織情報 | name |
| properties | 物件情報 | organizationId, status |
| volumeChecks | ボリュームチェック結果 | propertyId, assetType |
| scenarios | シナリオ情報 | propertyId, volumeCheckId |
| profitabilityResults | 収益性試算結果 | propertyId, volumeCheckId |
| documents | 文書情報 | propertyId, documentType |
| historyEntries | 変更履歴 | propertyId, userId, createdAt |

### 6.2 リレーション管理

MongoDBはNoSQLデータベースですが、関連性の高いデータについては以下の原則で管理します：

1. **参照による関連** (デフォルト):
   - ほとんどの関連は外部キー（ID参照）で管理
   - 別コレクションにデータを分離し、関連IDで参照

2. **埋め込みによる関連** (特定ケースのみ):
   - ShapeDataは物件ドキュメントに直接埋め込み
   - 小規模で密接に関連するデータのみ埋め込み

## 7. 変更管理方針

データモデルに変更が必要な場合は、以下の原則に従います：

1. **下位互換性の維持**:
   - 新しいフィールドは必ずオプショナル（?:）として追加
   - 既存フィールドの削除は段階的に実施（まずオプショナルに変更し、その後に削除）

2. **型定義の一元管理**:
   - すべての型定義変更は `shared/index.ts` で一元的に実施
   - バックエンドへの反映は手動コピーで実施

3. **変更履歴の記録**:
   - 本ドキュメントの最終更新日を必ず更新
   - 変更内容を変更履歴セクションに記録

## 8. 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|----------|----------|-------|
| 2025-05-17 | 1.0.0 | 初期バージョン作成 | 初期作成者 |