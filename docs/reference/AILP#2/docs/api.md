# API設計

## エンドポイント一覧

### ユーザー管理

- `POST /api/auth/login`
  - 説明: ユーザーログイン
  - リクエスト: `{ email: string, password: string }`
  - レスポンス: `{ token: string, user: User }`

- `POST /api/auth/register`
  - 説明: ユーザー登録
  - リクエスト: `{ name: string, email: string, password: string }`
  - レスポンス: `{ token: string, user: User }`

### データ管理

- `GET /api/data`
  - 説明: データ一覧取得
  - リクエストパラメータ: `{ page: number, limit: number }`
  - レスポンス: `{ data: DataItem[], total: number }`

### テスト結果管理

- `GET /api/tests/{testId}`
  - 説明: 特定のテストの詳細情報を取得
  - レスポンス: `{ id: string, name: string, status: string, components: Component[], ... }`

- `GET /api/tests/{testId}/components`
  - 説明: テスト対象のコンポーネント一覧を取得
  - レスポンス: `{ components: Component[] }`

- `GET /api/tests/{testId}/components/{componentId}`
  - 説明: 特定コンポーネントの詳細情報を取得
  - レスポンス: `{ id: string, name: string, variantA: Variant, variantB: Variant, ... }`

- `GET /api/tests/{testId}/summary`
  - 説明: テスト結果の概要を取得
  - レスポンス: `{ totalVisitors: number, totalConversions: number, overallConversionRate: number, ... }`

- `PATCH /api/tests/{testId}/status`
  - 説明: テストのステータスを更新
  - リクエスト: `{ status: 'running' | 'stopped' | 'completed' }`
  - レスポンス: `{ id: string, status: string }`

- `POST /api/tests/{testId}/apply-winner`
  - 説明: 勝者バリアントを本番環境に適用
  - リクエスト: `{ componentId: string, variantId: string }`
  - レスポンス: `{ success: boolean, message: string, appliedAt: string }`

- `POST /api/tests/new`
  - 説明: 新しいテストを作成
  - リクエスト: `{ name: string, components: string[], ... }`
  - レスポンス: `{ id: string, name: string, ... }`

### 分析関連

- `GET /api/analysis/device-data/{componentId}`
  - 説明: デバイス別分析データを取得
  - レスポンス: `{ desktop: { variantA: {...}, variantB: {...} }, mobile: { variantA: {...}, variantB: {...} } }`

- `GET /api/analysis/cross-section`
  - 説明: 全セクション横断分析データを取得
  - レスポンス: `{ patterns: Pattern[], deviceInsights: {...} }`

- `GET /api/analysis/history-patterns`
  - 説明: 過去の成功パターンデータを取得
  - レスポンス: `{ patterns: [{ pattern: string, win: number, loss: number, conversionLift: number, ... }] }`

### アーカイブ関連

- `GET /api/archive/tests`
  - 説明: アーカイブされたテスト一覧を取得
  - リクエストパラメータ: `{ page: number, limit: number }`
  - レスポンス: `{ tests: Test[], total: number }`

- `GET /api/archive/tests/search`
  - 説明: テストアーカイブを検索
  - リクエストパラメータ: `{ keyword: string, components: string[], patterns: string[], ... }`
  - レスポンス: `{ tests: Test[], total: number }`

- `GET /api/archive/versions/{componentId}`
  - 説明: 特定コンポーネントの過去バージョンを取得
  - レスポンス: `{ versions: [{ date: string, variantA: {...}, variantB: {...}, winner: string, ... }] }`
