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
