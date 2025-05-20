# 収益性試算関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-18  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）の収益性試算に関するAPI仕様を定義します。建築可能ボリュームに基づいた収益性の試算、複数シナリオの管理と比較、財務指標の算出など、投資判断を支援する機能を提供します。

収益性試算機能は、ボリュームチェック結果に基づき、アセットタイプ（マンション、オフィス等）別の収益モデルを適用し、長期的な投資収益性を予測・分析するためのインターフェースを提供します。異なるパラメータによる複数シナリオを作成・比較することで、最適な投資判断をサポートします。

## 2. リソース概要

### 2.1 収益性試算結果 (ProfitabilityResult)

収益性試算結果リソースは以下の主要属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| propertyId | ID | 関連物件ID |
| volumeCheckId | ID | 関連ボリュームチェックID |
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
| profitabilityIndex | number | 収益性指数（オプション） |
| annualFinancials | AnnualFinancials[] | 年間収支予測 |
| createdAt | Date | 作成日時 |

### 2.2 財務パラメータ (FinancialParams)

収益性試算のための財務パラメータ：

| 属性 | 型 | 説明 |
|-----|-----|------|
| rentPerSqm | number | 賃料単価（円/㎡） |
| occupancyRate | number | 稼働率（%） |
| managementCostRate | number | 管理コスト率（%） |
| constructionCost | number | 建設単価（円/㎡） |
| rentalPeriod | number | 運用期間（年） |
| capRate | number | 還元利回り（%） |

### 2.3 年間収支 (AnnualFinancials)

各年の収支予測：

| 属性 | 型 | 説明 |
|-----|-----|------|
| year | number | 年数 |
| rentalIncome | number | 賃料収入（円） |
| operatingExpenses | number | 運営費用（円） |
| netOperatingIncome | number | 純収益（円） |
| cumulativeIncome | number | 累計収益（円） |

### 2.4 シナリオ (Scenario)

複数の試算条件をシナリオとして管理：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| propertyId | ID | 関連物件ID |
| volumeCheckId | ID | 関連ボリュームチェックID |
| name | string | シナリオ名 |
| params | ScenarioParams | シナリオパラメータ |
| profitabilityResult | ProfitabilityResult | 収益性試算結果（オプション） |
| createdAt | Date | 作成日時 |

### 2.5 シナリオパラメータ (ScenarioParams)

シナリオ管理のためのパラメータ：

| 属性 | 型 | 説明 |
|-----|-----|------|
| name | string | シナリオ名 |
| assetType | AssetType | アセットタイプ |
| rentPerSqm | number | 賃料単価（円/㎡） |
| occupancyRate | number | 稼働率（%） |
| managementCostRate | number | 管理コスト率（%） |
| constructionCost | number | 建設単価（円/㎡） |
| rentalPeriod | number | 運用期間（年） |
| capRate | number | 還元利回り（%） |

## 3. エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/analysis/profitability` | POST | 必須 | 収益性試算実行 |
| `/api/analysis/profitability/{id}` | GET | 必須 | 収益性試算結果取得 |
| `/api/analysis/profitability/{id}` | DELETE | 必須 | 収益性試算結果削除 |
| `/api/analysis/profitability/{id}/export` | GET | 必須 | 収益性試算結果PDF出力 |
| `/api/analysis/profitability/compare` | POST | 必須 | 複数シナリオ比較 |
| `/api/analysis/scenarios` | GET | 必須 | シナリオ一覧取得 |
| `/api/analysis/scenarios` | POST | 必須 | シナリオ作成 |
| `/api/analysis/scenarios/{id}` | GET | 必須 | シナリオ詳細取得 |
| `/api/analysis/scenarios/{id}` | PUT | 必須 | シナリオ更新 |
| `/api/analysis/scenarios/{id}` | DELETE | 必須 | シナリオ削除 |

## 4. エンドポイント詳細

### 4.1 収益性試算実行 - POST /api/analysis/profitability

ボリュームチェック結果とパラメータに基づいて収益性試算を実行します。

#### リクエスト

```json
{
  "propertyId": "property_123",
  "volumeCheckId": "vc_123",
  "assetType": "mansion",
  "financialParams": {
    "rentPerSqm": 3500,
    "occupancyRate": 95,
    "managementCostRate": 20,
    "constructionCost": 350000,
    "rentalPeriod": 30,
    "capRate": 4.5
  }
}
```

#### バリデーションルール

- `propertyId`: 必須、有効な物件ID
- `volumeCheckId`: 必須、有効なボリュームチェックID
- `assetType`: 必須、AssetType列挙型の有効な値
- `financialParams`: 必須、財務パラメータオブジェクト
  - `rentPerSqm`: 必須、1,000～10,000の範囲内の数値
  - `occupancyRate`: 必須、50～100の範囲内の数値
  - `managementCostRate`: 必須、5～50の範囲内の数値
  - `constructionCost`: 必須、100,000～1,000,000の範囲内の数値
  - `rentalPeriod`: 必須、10～50の範囲内の整数
  - `capRate`: 必須、1～10の範囲内の数値

#### レスポンス

**成功**: 201 Created
```json
{
  "success": true,
  "data": {
    "id": "pr_123",
    "propertyId": "property_123",
    "volumeCheckId": "vc_123",
    "assetType": "mansion",
    "parameters": {
      "rentPerSqm": 3500,
      "occupancyRate": 95,
      "managementCostRate": 20,
      "constructionCost": 350000,
      "rentalPeriod": 30,
      "capRate": 4.5
    },
    "landPrice": 250000000,
    "constructionCost": 1512000000,
    "miscExpenses": 88200000,
    "totalInvestment": 1850200000,
    "annualRentalIncome": 143640000,
    "annualOperatingExpenses": 28728000,
    "annualMaintenance": 15120000,
    "annualPropertyTax": 18502000,
    "annualNOI": 81290000,
    "noiYield": 4.39,
    "irr": 5.76,
    "paybackPeriod": 21.8,
    "npv": 127456789,
    "profitabilityIndex": 1.07,
    "annualFinancials": [
      {
        "year": 1,
        "rentalIncome": 143640000,
        "operatingExpenses": 62350000,
        "netOperatingIncome": 81290000,
        "cumulativeIncome": 81290000
      },
      // 他の年の予測...
    ],
    "createdAt": "2025-05-15T14:30:00Z"
  }
}
```

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定された物件またはボリュームチェック結果が見つかりません"
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
      "financialParams.rentPerSqm": "賃料単価は1,000円/㎡～10,000円/㎡の範囲内で指定してください"
    }
  }
}
```

**エラー**: 計算エラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "CALCULATION_ERROR",
    "message": "収益性試算の計算中にエラーが発生しました",
    "details": {
      "reason": "指定されたパラメータでは正確な計算ができません"
    }
  }
}
```

#### 実装ノート

- 物件データとボリュームチェック結果から投資・収益モデルを構築
- 土地価格は物件の登録情報から取得（未設定の場合は推定値を使用）
- 建設費は建築面積×階数×建設単価で計算
- 諸経費は建設費の一定割合（通常5～10%）
- 賃料収入は延床面積×専有率×賃料単価×稼働率
- 各種財務指標（IRR、NPV、投資回収期間）を計算
- 年間収支予測はシミュレーション期間（rentalPeriod）の各年について生成
- レート制限: 10回/分/ユーザー

---

### 4.2 収益性試算結果取得 - GET /api/analysis/profitability/{id}

指定されたIDの収益性試算結果を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 収益性試算結果ID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| fields | string | いいえ | 取得するフィールドの指定（カンマ区切り） |
| include_annual | boolean | いいえ | 年間収支予測を含めるか（デフォルト: false） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "pr_123",
    "propertyId": "property_123",
    "volumeCheckId": "vc_123",
    "assetType": "mansion",
    "parameters": {
      "rentPerSqm": 3500,
      "occupancyRate": 95,
      "managementCostRate": 20,
      "constructionCost": 350000,
      "rentalPeriod": 30,
      "capRate": 4.5
    },
    "landPrice": 250000000,
    "constructionCost": 1512000000,
    "miscExpenses": 88200000,
    "totalInvestment": 1850200000,
    "annualRentalIncome": 143640000,
    "annualOperatingExpenses": 28728000,
    "annualMaintenance": 15120000,
    "annualPropertyTax": 18502000,
    "annualNOI": 81290000,
    "noiYield": 4.39,
    "irr": 5.76,
    "paybackPeriod": 21.8,
    "npv": 127456789,
    "profitabilityIndex": 1.07,
    "createdAt": "2025-05-15T14:30:00Z",
    "property": {
      "id": "property_123",
      "name": "福岡タワーマンション計画",
      "address": "福岡市中央区天神1-1-1"
    },
    "volumeCheck": {
      "id": "vc_123",
      "assetType": "mansion",
      "totalFloorArea": 4320.0
    }
  }
}
```

**成功（年間収支予測を含む）**: 200 OK
```json
{
  "success": true,
  "data": {
    // 上記と同じ内容に加えて
    "annualFinancials": [
      {
        "year": 1,
        "rentalIncome": 143640000,
        "operatingExpenses": 62350000,
        "netOperatingIncome": 81290000,
        "cumulativeIncome": 81290000
      },
      // 他の年の予測...
    ]
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- `fields`パラメータが指定された場合、指定されたフィールドのみが返却される
- `include_annual=true`の場合、年間収支予測も含まれる（データ量が大きい場合があるため）
- デフォルトでは物件と関連ボリュームチェックの基本情報も含まれる
- レート制限: 60回/分/ユーザー

---

### 4.3 収益性試算結果削除 - DELETE /api/analysis/profitability/{id}

指定されたIDの収益性試算結果を削除します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 収益性試算結果ID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "pr_123",
    "deleted": true
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 収益性試算結果の削除は論理削除（ソフトデリート）として実装
- 関連するシナリオとの紐付けは解除されるが、シナリオ自体は削除されない
- 削除された試算結果は一覧取得では表示されなくなる
- レート制限: 10回/分/ユーザー

---

### 4.4 収益性試算結果PDF出力 - GET /api/analysis/profitability/{id}/export

指定されたIDの収益性試算結果をPDF形式で出力します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 収益性試算結果ID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| template | string | いいえ | PDFテンプレート（`simple`, `detailed`, `presentation`） |
| include_charts | boolean | いいえ | グラフ・チャートを含めるか（デフォルト: true） |

#### レスポンス

**成功**: 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="profitability_result_{id}.pdf"

[PDFファイルの内容がバイナリで返却]

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- PDF生成はサーバーサイドで実行され、ダウンロード形式で提供
- PDF内容は物件情報、ボリュームチェック結果、財務パラメータ、財務指標、グラフを含む
- テンプレートに応じてレイアウトやフォーマットが変更
- グラフにはキャッシュフロー推移、累積投資回収曲線、感度分析などが含まれる
- レポートヘッダーには組織情報（名称等）が含まれる
- レート制限: 20回/時間/ユーザー

---

### 4.5 複数シナリオ比較 - POST /api/analysis/profitability/compare

複数のシナリオ（または収益性試算結果）を比較します。

#### リクエスト

```json
{
  "scenarioIds": ["scenario_123", "scenario_124"],
  "profitabilityIds": ["pr_123", "pr_124"],
  "compareFields": ["noiYield", "irr", "paybackPeriod", "npv"]
}
```

#### バリデーションルール

- `scenarioIds`: オプション、シナリオIDの配列
- `profitabilityIds`: オプション、収益性試算結果IDの配列
- `compareFields`: オプション、比較対象フィールドの配列（デフォルトは主要財務指標）
- `scenarioIds`と`profitabilityIds`の少なくとも一方は必須

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "id": "pr_123",
        "name": "ベースシナリオ",
        "assetType": "mansion",
        "totalInvestment": 1850200000,
        "annualNOI": 81290000,
        "noiYield": 4.39,
        "irr": 5.76,
        "paybackPeriod": 21.8,
        "npv": 127456789
      },
      {
        "id": "pr_124",
        "name": "高賃料シナリオ",
        "assetType": "mansion",
        "totalInvestment": 1850200000,
        "annualNOI": 92875000,
        "noiYield": 5.02,
        "irr": 6.38,
        "paybackPeriod": 19.5,
        "npv": 248700000
      }
    ],
    "differentials": {
      "noiYield": [0, 0.63],
      "irr": [0, 0.62],
      "paybackPeriod": [0, -2.3],
      "npv": [0, 121243211]
    },
    "chartData": {
      // グラフ描画用のデータ
    }
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
      "general": "scenarioIdsまたはprofitabilityIdsのいずれかを指定してください"
    }
  }
}
```

#### 実装ノート

- シナリオIDが指定された場合は、関連する収益性試算結果を使用（未実行の場合は実行）
- 直接収益性試算結果IDを指定することも可能
- レスポンスには各シナリオの主要指標とその差異、グラフ描画用データが含まれる
- 差異の基準（ベース）は最初のシナリオ/結果
- 複数のアセットタイプが混在する場合も比較可能（適切な注記付き）
- レート制限: 30回/分/ユーザー

---

### 4.6 シナリオ一覧取得 - GET /api/analysis/scenarios

シナリオの一覧を取得します。

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| propertyId | string | いいえ | 物件IDによるフィルタ |
| volumeCheckId | string | いいえ | ボリュームチェックIDによるフィルタ |
| page | number | いいえ | ページ番号（デフォルト: 1） |
| limit | number | いいえ | 1ページあたりの結果数（デフォルト: 20、最大: 100） |
| sort | string | いいえ | ソート条件（例: `createdAt:desc,name:asc`） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": "scenario_123",
      "propertyId": "property_123",
      "volumeCheckId": "vc_123",
      "name": "ベースシナリオ",
      "params": {
        "name": "ベースシナリオ",
        "assetType": "mansion",
        "rentPerSqm": 3500,
        "occupancyRate": 95,
        "managementCostRate": 20,
        "constructionCost": 350000,
        "rentalPeriod": 30,
        "capRate": 4.5
      },
      "createdAt": "2025-05-15T14:00:00Z",
      "profitabilityResult": {
        "id": "pr_123",
        "noiYield": 4.39,
        "irr": 5.76
      }
    },
    {
      "id": "scenario_124",
      "propertyId": "property_123",
      "volumeCheckId": "vc_123",
      "name": "高賃料シナリオ",
      "params": {
        "name": "高賃料シナリオ",
        "assetType": "mansion",
        "rentPerSqm": 4000,
        "occupancyRate": 95,
        "managementCostRate": 20,
        "constructionCost": 350000,
        "rentalPeriod": 30,
        "capRate": 4.5
      },
      "createdAt": "2025-05-15T14:15:00Z",
      "profitabilityResult": {
        "id": "pr_124",
        "noiYield": 5.02,
        "irr": 6.38
      }
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### 実装ノート

- `propertyId`と`volumeCheckId`の両方が指定された場合は、両方の条件に一致するシナリオのみ返却
- レスポンスにはシナリオの基本情報と、収益性試算結果がある場合はその主要指標も含める
- 詳細な収益性試算結果は含まれない（個別取得APIを使用）
- 組織IDが一致する物件のシナリオのみアクセス可能
- レート制限: 60回/分/ユーザー

---

### 4.7 シナリオ作成 - POST /api/analysis/scenarios

新しいシナリオを作成します。

#### リクエスト

```json
{
  "propertyId": "property_123",
  "volumeCheckId": "vc_123",
  "params": {
    "name": "楽観的シナリオ",
    "assetType": "mansion",
    "rentPerSqm": 4000,
    "occupancyRate": 98,
    "managementCostRate": 18,
    "constructionCost": 350000,
    "rentalPeriod": 30,
    "capRate": 4.2
  },
  "executeAnalysis": true
}
```

#### バリデーションルール

- `propertyId`: 必須、有効な物件ID
- `volumeCheckId`: 必須、有効なボリュームチェックID
- `params`: 必須、シナリオパラメータオブジェクト
  - `name`: 必須、1～50文字の文字列
  - `assetType`: 必須、AssetType列挙型の有効な値
  - `rentPerSqm`: 必須、1,000～10,000の範囲内の数値
  - `occupancyRate`: 必須、50～100の範囲内の数値
  - `managementCostRate`: 必須、5～50の範囲内の数値
  - `constructionCost`: 必須、100,000～1,000,000の範囲内の数値
  - `rentalPeriod`: 必須、10～50の範囲内の整数
  - `capRate`: 必須、1～10の範囲内の数値
- `executeAnalysis`: オプション、ブール値（デフォルト: false）

#### レスポンス

**成功**: 201 Created
```json
{
  "success": true,
  "data": {
    "id": "scenario_125",
    "propertyId": "property_123",
    "volumeCheckId": "vc_123",
    "name": "楽観的シナリオ",
    "params": {
      "name": "楽観的シナリオ",
      "assetType": "mansion",
      "rentPerSqm": 4000,
      "occupancyRate": 98,
      "managementCostRate": 18,
      "constructionCost": 350000,
      "rentalPeriod": 30,
      "capRate": 4.2
    },
    "createdAt": "2025-05-15T15:00:00Z",
    "profitabilityResult": {
      "id": "pr_125",
      "noiYield": 5.29,
      "irr": 6.72
    }
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- `executeAnalysis=true`の場合は、シナリオ作成と同時に収益性試算も実行される
- 作成されたシナリオIDは物件のメタデータに記録され、前回利用したシナリオとして参照可能
- レスポンスには収益性試算結果がある場合はその主要指標も含めるが、詳細は含まれない
- レート制限: 30回/分/ユーザー

---

### 4.8 シナリオ詳細取得 - GET /api/analysis/scenarios/{id}

指定されたIDのシナリオ詳細を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | シナリオID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| expand | string | いいえ | 展開して取得する関連データ（カンマ区切り、対応: `profitabilityResult`） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "scenario_123",
    "propertyId": "property_123",
    "volumeCheckId": "vc_123",
    "name": "ベースシナリオ",
    "params": {
      "name": "ベースシナリオ",
      "assetType": "mansion",
      "rentPerSqm": 3500,
      "occupancyRate": 95,
      "managementCostRate": 20,
      "constructionCost": 350000,
      "rentalPeriod": 30,
      "capRate": 4.5
    },
    "createdAt": "2025-05-15T14:00:00Z",
    "property": {
      "id": "property_123",
      "name": "福岡タワーマンション計画"
    },
    "volumeCheck": {
      "id": "vc_123",
      "assetType": "mansion",
      "totalFloorArea": 4320.0
    }
  }
}
```

**成功（収益性試算結果を含む）**: 200 OK
```json
{
  "success": true,
  "data": {
    // 上記と同じ内容に加えて
    "profitabilityResult": {
      "id": "pr_123",
      "landPrice": 250000000,
      "constructionCost": 1512000000,
      "miscExpenses": 88200000,
      "totalInvestment": 1850200000,
      "annualRentalIncome": 143640000,
      "annualOperatingExpenses": 28728000,
      "annualMaintenance": 15120000,
      "annualPropertyTax": 18502000,
      "annualNOI": 81290000,
      "noiYield": 4.39,
      "irr": 5.76,
      "paybackPeriod": 21.8,
      "npv": 127456789,
      "profitabilityIndex": 1.07,
      "createdAt": "2025-05-15T14:30:00Z"
    }
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- `expand=profitabilityResult`の場合、収益性試算結果の詳細も含める
- デフォルトでは物件と関連ボリュームチェックの基本情報も含める
- 収益性試算が未実行の場合は`profitabilityResult`が`null`となる
- 年間収支予測データは含まれない（個別取得APIを使用）
- レート制限: 60回/分/ユーザー

---

### 4.9 シナリオ更新 - PUT /api/analysis/scenarios/{id}

指定されたIDのシナリオを更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | シナリオID |

#### リクエスト

```json
{
  "params": {
    "name": "楽観的シナリオ（改定）",
    "assetType": "mansion",
    "rentPerSqm": 4200,
    "occupancyRate": 98,
    "managementCostRate": 18,
    "constructionCost": 350000,
    "rentalPeriod": 30,
    "capRate": 4.2
  },
  "executeAnalysis": true
}
```

#### バリデーションルール

シナリオ作成と同じバリデーションルールが適用されます。

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "scenario_123",
    "params": {
      "name": "楽観的シナリオ（改定）",
      "assetType": "mansion",
      "rentPerSqm": 4200,
      "occupancyRate": 98,
      "managementCostRate": 18,
      "constructionCost": 350000,
      "rentalPeriod": 30,
      "capRate": 4.2
    },
    "updatedAt": "2025-05-15T16:00:00Z",
    "profitabilityResult": {
      "id": "pr_126",
      "noiYield": 5.65,
      "irr": 7.12
    }
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラー、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- `executeAnalysis=true`の場合は、シナリオ更新と同時に新しい収益性試算も実行される
- 更新前の収益性試算結果との関連付けは解除されるが、試算結果自体は削除されない
- 新しい試算結果が生成された場合は、そのIDと主要指標がレスポンスに含まれる
- レスポンスには更新されたフィールドと`id`、`updatedAt`が含まれる
- レート制限: 30回/分/ユーザー

---

### 4.10 シナリオ削除 - DELETE /api/analysis/scenarios/{id}

指定されたIDのシナリオを削除します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | シナリオID |

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| delete_results | boolean | いいえ | 関連する収益性試算結果も削除するか（デフォルト: false） |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "scenario_123",
    "deleted": true,
    "resultsDeleted": false
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- シナリオの削除は論理削除（ソフトデリート）として実装
- `delete_results=true`の場合は、関連する収益性試算結果も論理削除される
- 削除されたシナリオは一覧取得では表示されなくなる
- レート制限: 10回/分/ユーザー

## 5. 財務指標の計算方法

### 5.1 NOI利回り（Net Operating Income Yield）

年間純収益（NOI）を総投資額で割った値：

```
NOI利回り(%) = (年間純収益 ÷ 総投資額) × 100
```

### 5.2 内部収益率（IRR: Internal Rate of Return）

プロジェクトの将来キャッシュフローの現在価値の合計がゼロになる割引率：

```
NPV = Σ[CFt ÷ (1 + IRR)^t] - 初期投資 = 0
```

ここで、CFtは期間tのキャッシュフロー。IRRは反復計算で求められます。

### 5.3 投資回収期間（Payback Period）

初期投資額を回収するまでに必要な年数：

```
投資回収期間 = 初期投資額 ÷ 年間平均純収益
```

より精緻な計算では、累積キャッシュフローが初期投資額を超える時点を特定します。

### 5.4 正味現在価値（NPV: Net Present Value）

将来キャッシュフローの現在価値から初期投資額を差し引いた値：

```
NPV = Σ[CFt ÷ (1 + r)^t] - 初期投資
```

ここで、rは割引率（通常は資本コスト）。

### 5.5 収益性指数（Profitability Index）

投資1単位あたりの現在価値リターン：

```
収益性指数 = (将来キャッシュフローの現在価値の合計 ÷ 初期投資額)
```

## 6. データモデルとの整合性

このAPIは`shared/index.ts`で定義されている以下のデータモデルと整合しています：

- `ProfitabilityResult`: 収益性試算結果
- `FinancialParams`: 財務パラメータ
- `AnnualFinancials`: 年間収支
- `Scenario`: シナリオ
- `ScenarioParams`: シナリオパラメータ

## 7. サンプルコード

### 7.1 収益性試算実行

```typescript
// フロントエンドでの収益性試算実行例
import axios from 'axios';
import { API_PATHS, AssetType, FinancialParams } from '@shared/index';

// 収益性試算実行
const performProfitabilityAnalysis = async (
  propertyId: string,
  volumeCheckId: string,
  assetType: AssetType,
  financialParams: FinancialParams
) => {
  try {
    const response = await axios.post(API_PATHS.ANALYSIS.PROFITABILITY.BASE, {
      propertyId,
      volumeCheckId,
      assetType,
      financialParams
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('収益性試算の実行に失敗しました', error);
    throw error;
  }
};

// 使用例
const runProfitabilityAnalysis = async () => {
  const result = await performProfitabilityAnalysis(
    'property_123',
    'vc_123',
    AssetType.MANSION,
    {
      rentPerSqm: 3500,
      occupancyRate: 95,
      managementCostRate: 20,
      constructionCost: 350000,
      rentalPeriod: 30,
      capRate: 4.5
    }
  );
  
  console.log(`NOI利回り: ${result.noiYield}%`);
  console.log(`IRR: ${result.irr}%`);
  console.log(`投資回収期間: ${result.paybackPeriod}年`);
};
```

### 7.2 シナリオ管理

```typescript
// フロントエンドでのシナリオ管理例
import axios from 'axios';
import { API_PATHS, AssetType, ScenarioParams } from '@shared/index';

// シナリオ作成
const createScenario = async (
  propertyId: string,
  volumeCheckId: string,
  params: ScenarioParams,
  executeAnalysis: boolean = false
) => {
  try {
    const response = await axios.post(API_PATHS.ANALYSIS.SCENARIOS.BASE, {
      propertyId,
      volumeCheckId,
      params,
      executeAnalysis
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('シナリオ作成に失敗しました', error);
    throw error;
  }
};

// シナリオ一覧取得
const fetchScenarios = async (propertyId: string, volumeCheckId: string) => {
  try {
    const response = await axios.get(API_PATHS.ANALYSIS.SCENARIOS.BASE, {
      params: {
        propertyId,
        volumeCheckId
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('シナリオ一覧の取得に失敗しました', error);
    throw error;
  }
};

// シナリオ比較
const compareScenarios = async (scenarioIds: string[]) => {
  try {
    const response = await axios.post(API_PATHS.ANALYSIS.PROFITABILITY.COMPARE, {
      scenarioIds,
      compareFields: ['noiYield', 'irr', 'paybackPeriod', 'npv']
    });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('シナリオ比較に失敗しました', error);
    throw error;
  }
};
```

## 8. セキュリティ考慮事項

### 8.1 アクセス制御

- 全てのエンドポイントはユーザー認証が必要
- 収益性試算結果は組織IDに基づいてアクセス制御される
- 異なる組織のシナリオや試算結果にはアクセス不可

### 8.2 入力バリデーション

- 全てのユーザー入力は厳格にバリデーション
- 特に財務パラメータは現実的な範囲でのみ受け付け
- 極端な値による計算リソース消費の防止

### 8.3 計算リソース保護

- 複雑な計算はジョブキューで非同期処理
- 計算時間の上限設定（30秒）
- 同時実行数の制限（組織あたり3件）

### 8.4 レート制限

- 収益性試算実行は10回/分/ユーザーに制限
- PDF出力は20回/時間/ユーザーに制限
- シナリオ比較は30回/分/ユーザーに制限

## 9. エラーハンドリング

一般的な収益性試算関連のエラーコード：

| エラーコード | 説明 |
|------------|------|
| `CALCULATION_ERROR` | 収益性試算計算中のエラー |
| `INVALID_PARAMETERS` | 財務パラメータが不正 |
| `SCENARIO_CREATE_ERROR` | シナリオ作成時のエラー |
| `PDF_GENERATION_ERROR` | PDF生成時のエラー |
| `COMPARISON_ERROR` | シナリオ比較時のエラー |

## 10. キャッシング戦略

特定のエンドポイントにはキャッシング戦略が適用されます：

| エンドポイント | キャッシュTTL | 条件 |
|--------------|-------------|------|
| GET /api/analysis/profitability/{id} | 15分 | ETagがサポート |
| GET /api/analysis/scenarios | 5分 | ETagがサポート |
| GET /api/analysis/scenarios/{id} | 5分 | ETagがサポート |