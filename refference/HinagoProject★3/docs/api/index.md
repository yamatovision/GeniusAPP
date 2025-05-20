# API設計仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-15  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）のRESTful API設計の基本原則と共通仕様を定義します。フロントエンドとバックエンドを結ぶ一貫性のあるAPIインターフェースを提供し、開発効率とシステムの拡張性を高めます。

## 2. 基本設計原則

### 2.1 REST原則

1. **リソース指向設計**: データエンティティをリソースとして表現し、URLで一意に識別
2. **適切なHTTPメソッド**: 各操作に適したHTTPメソッドを使用
   - GET: リソース取得（安全・冪等）
   - POST: リソース作成・処理実行
   - PUT: リソース完全置換（全フィールド必須）
   - PATCH: リソース部分更新（変更フィールドのみ）
   - DELETE: リソース削除
3. **ステートレス通信**: 各リクエストは自己完結型で、サーバー側でセッション状態を持たない
4. **適切なステータスコード**: 処理結果を適切なHTTPステータスコードで表現

### 2.2 URL設計規則

1. **リソース命名規則**:
   - コレクションは複数形: `/users`, `/properties`
   - APIルートパスには常に `/api` プレフィックスを付与
   - シンプルで直感的な名詞形式

2. **階層的リソース設計**:
   - 親子関係は適切なネストで表現: `/api/properties/{id}/documents`
   - ネストは最大2階層までとし、過度な階層化を避ける

3. **バージョニング**:
   - 初期バージョンではURLパスによるバージョン明示は行わない
   - 大規模なAPIの破壊的変更がある場合に `/api/v2/` のようなバージョニングを検討

4. **一貫性のあるパラメータ命名**:
   - パスパラメータ: リソース識別子 `/api/properties/{id}`
   - クエリパラメータ: フィルタリング、ページネーション等 `?status=active&page=1`

### 2.3 クエリパラメータ規則

1. **フィルタリング**:
   - シンプルなフィルタ: `?status=active`
   - 複数値フィルタ: `?status=active,pending`
   - 範囲フィルタ: `?price_min=1000&price_max=5000`

2. **ページネーション**:
   - ページベース: `?page=1&limit=20`（デフォルト）
   - オフセットベース: `?offset=0&limit=20`（特殊ケース用）

3. **ソート**:
   - 単一フィールド: `?sort=updatedAt:desc`
   - 複数フィールド: `?sort=updatedAt:desc,name:asc`

4. **検索**:
   - 基本検索: `?search=keyword`
   - フィールド指定検索: `?search_name=keyword`

5. **フィールド選択**:
   - 含めるフィールド: `?fields=id,name,status`
   - 除外フィールド: `?exclude=createdAt,updatedAt`

### 2.4 データフォーマット

1. **JSONが基本**:
   - リクエスト/レスポンスともにJSONをデフォルトフォーマットとする
   - `Content-Type: application/json`ヘッダの使用

2. **命名規則**:
   - JSONプロパティはキャメルケース: `firstName`, `createdAt`
   - クエリパラメータはスネークケース: `?sort_by=name`
   - パスパラメータはシンプルな識別子: `{id}`

3. **日付と時刻**:
   - ISO 8601形式: `2025-05-15T09:30:00Z`
   - タイムゾーンはUTC（Z）を基本とする

4. **数値**:
   - 整数または浮動小数点数としてそのまま表現
   - 通貨等の固定小数点数は文字列として送信しない（数値として送信）

5. **null値とオプショナルフィールド**:
   - 値がない場合は `null`
   - オプショナルフィールドが指定されていない場合は省略（`undefined`ではなく省略）

## 3. リクエスト設計

### 3.1 HTTPメソッドの使用

| HTTPメソッド | 用途 | 特性 | 例 |
|------------|------|-----|-----|
| GET | リソース取得 | 安全・冪等 | `GET /api/properties` |
| POST | リソース作成 | 非冪等 | `POST /api/properties` |
| PUT | リソース置換 | 冪等 | `PUT /api/properties/{id}` |
| PATCH | リソース部分更新 | 非冪等 | `PATCH /api/properties/{id}` |
| DELETE | リソース削除 | 冪等 | `DELETE /api/properties/{id}` |

### 3.2 リクエストヘッダ

| ヘッダ名 | 説明 | 例 |
|--------|------|-----|
| `Content-Type` | リクエストボディのMIMEタイプ | `application/json` |
| `Accept` | 希望するレスポンスのMIMEタイプ | `application/json` |
| `Authorization` | 認証トークン | `Bearer eyJhbGciOiJIUzI1NiIsInR...` |

### 3.3 バリデーション

1. **入力バリデーション**:
   - すべてのリクエストデータは厳格にバリデーション
   - 型チェック、範囲チェック、フォーマットチェック
   - 必須フィールドの存在確認

2. **エラー応答**:
   - バリデーションエラーは422 Unprocessable Entityで応答
   - エラー詳細を含むJSON形式でレスポンス
   - 対象フィールドとエラー理由を明示

3. **セキュリティ対策**:
   - 入力値のサニタイゼーション
   - インジェクション攻撃対策
   - 過剰データ制限

## 4. レスポンス設計

### 4.1 共通レスポンス形式

すべてのAPI応答は、成功・エラーにかかわらず一貫した形式で返却します：

```typescript
// 成功レスポンス
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
}

// エラーレスポンス
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// API共通レスポンス型
type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

### 4.2 成功レスポンス例

#### 単一リソース取得
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "name": "福岡タワーマンション計画",
    "address": "福岡市中央区天神1-1-1",
    "area": 500.5,
    "zoneType": "category8",
    "createdAt": "2025-05-15T09:30:00Z",
    "updatedAt": "2025-05-15T09:30:00Z"
  }
}
```

#### リソースコレクション取得
```json
{
  "success": true,
  "data": [
    {
      "id": "property_123",
      "name": "福岡タワーマンション計画",
      "address": "福岡市中央区天神1-1-1",
      "status": "new"
    },
    {
      "id": "property_124",
      "name": "博多駅前オフィスビル計画",
      "address": "福岡市博多区博多駅前2-2-2",
      "status": "negotiating"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### リソース作成
```json
{
  "success": true,
  "data": {
    "id": "property_125",
    "name": "新規プロジェクト",
    "address": "福岡市東区香椎浜2-3-4",
    "createdAt": "2025-05-15T10:15:30Z",
    "updatedAt": "2025-05-15T10:15:30Z"
  }
}
```

#### リソース更新
```json
{
  "success": true,
  "data": {
    "id": "property_123",
    "name": "福岡タワーマンション計画（改定）",
    "address": "福岡市中央区天神1-1-1",
    "updatedAt": "2025-05-15T11:20:45Z"
  }
}
```

#### リソース削除
```json
{
  "success": true,
  "data": {
    "id": "property_124",
    "deleted": true
  }
}
```

### 4.3 エラーレスポンス例

#### バリデーションエラー (422 Unprocessable Entity)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": {
      "name": "必須項目です",
      "area": "0より大きい数値を入力してください"
    }
  }
}
```

#### 認証エラー (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "認証が必要です"
  }
}
```

#### 権限エラー (403 Forbidden)
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "この操作を実行する権限がありません"
  }
}
```

#### リソース未検出 (404 Not Found)
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定されたリソースが見つかりません"
  }
}
```

#### サーバーエラー (500 Internal Server Error)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "内部サーバーエラーが発生しました"
  }
}
```

### 4.4 HTTPステータスコード

| コード | 説明 | 使用例 |
|-------|-----|--------|
| 200 OK | リクエスト成功 | GET, PUT, PATCH成功時 |
| 201 Created | リソース作成成功 | POST成功時 |
| 204 No Content | 成功（返すコンテンツなし） | DELETE成功時（オプション） |
| 400 Bad Request | 不正なリクエスト | リクエスト構文エラー時 |
| 401 Unauthorized | 認証エラー | 認証情報不足・無効時 |
| 403 Forbidden | 権限エラー | 十分な権限がない時 |
| 404 Not Found | リソース未検出 | 存在しないリソース要求時 |
| 409 Conflict | リソース競合 | 一意制約違反時 |
| 422 Unprocessable Entity | バリデーションエラー | 入力値が処理条件を満たさない時 |
| 429 Too Many Requests | レート制限超過 | API呼び出し回数制限超過時 |
| 500 Internal Server Error | サーバーエラー | 予期しないサーバーエラー時 |

## 5. 認証と認可

### 5.1 認証メカニズム

認証システム設計書に基づき、JWT（JSON Web Token）ベースの認証を採用します：

1. **アクセストークン**:
   - Bearer認証方式で`Authorization`ヘッダーに付与
   - 有効期限: 15分
   - JWTペイロードにユーザーID、ロール、組織IDを含む

2. **リフレッシュトークン**:
   - 長期有効なトークン（7日または30日）
   - セキュアクッキーで管理
   - トークン更新時に検証

### 5.2 認可フロー

1. **アクセス制御基本原則**:
   - 組織ベースのアクセス制御
   - 同一組織内のリソース共有
   - 組織間のデータ分離

2. **認可チェックポイント**:
   - リクエスト受信時にトークン検証
   - リソースアクセス時に組織ID一致確認
   - 操作実行時に権限レベル確認

### 5.3 セキュリティ対策

1. **CSRF対策**:
   - Double Submit Cookie Patternの採用
   - APIキーによる検証

2. **レート制限**:
   - 同一IPからの試行を10回/分に制限
   - 認証エンドポイントに厳格な制限

3. **ブラウザセキュリティ対策**:
   - CORS設定の適切な構成
   - セキュリティヘッダーの設定（XSS対策等）

## 6. エラー処理

### 6.1 エラーコード体系

エラーコードは以下の形式で統一します：

1. **認証・認可関連**:
   - `AUTH_REQUIRED`: 認証が必要
   - `INVALID_TOKEN`: トークンが無効
   - `TOKEN_EXPIRED`: トークンの有効期限切れ
   - `PERMISSION_DENIED`: 権限不足

2. **リソース関連**:
   - `RESOURCE_NOT_FOUND`: リソースが存在しない
   - `RESOURCE_CONFLICT`: リソースの競合（一意制約違反等）
   - `INVALID_RESOURCE_ID`: 無効なリソースID

3. **入力検証関連**:
   - `VALIDATION_ERROR`: 入力値の検証エラー
   - `INVALID_INPUT`: 不正な入力形式

4. **システム関連**:
   - `INTERNAL_SERVER_ERROR`: 内部サーバーエラー
   - `SERVICE_UNAVAILABLE`: サービス利用不可
   - `RATE_LIMIT_EXCEEDED`: レート制限超過

### 6.2 エラーメッセージガイドライン

1. **明確で簡潔**:
   - 理解しやすい平易な言葉で説明
   - 専門用語の過度な使用を避ける

2. **状況に応じた詳細度**:
   - ユーザー起因のエラーは詳細な理由を提示
   - システムエラーは適切な抽象化（内部詳細の露出は回避）

3. **アクション指向**:
   - 可能な解決策を示唆
   - 次に何をすべきかを示す

## 7. パフォーマンスと最適化

### 7.1 ページネーション

1. **基本方式**:
   - `?page=1&limit=20`でのページベースページネーション
   - デフォルト値: page=1, limit=20
   - 最大limit: 100

2. **メタデータ**:
   - レスポンスのmetaセクションに以下を含める:
     - total: 全件数
     - page: 現在のページ
     - limit: 1ページあたりの件数
     - totalPages: 全ページ数

### 7.2 部分レスポンス

1. **フィールド選択**:
   - `?fields=id,name,status`で特定フィールドのみ取得
   - `?exclude=createdAt,updatedAt`で特定フィールドを除外

2. **展開制御**:
   - `?expand=organization`で関連データを展開取得
   - ネストしたデータ構造の制御

### 7.3 キャッシュ戦略

1. **HTTPキャッシュ**:
   - `Cache-Control`, `ETag`ヘッダーの適切な設定
   - GET要求の結果に対するキャッシュ指示

2. **条件付きリクエスト**:
   - `If-Modified-Since`や`If-None-Match`の処理
   - 304 Not Modifiedレスポンスの活用

### 7.4 バッチ処理

1. **一括操作エンドポイント**:
   - `POST /api/properties/batch`での複数リソース同時操作
   - 個別結果を含む構造化レスポンス

## 8. API進化と運用

### 8.1 バージョニング戦略

1. **初期方針**:
   - 破壊的変更を避け、バージョン表記なしで運用開始
   - 下位互換性のある拡張を優先

2. **将来的な手法**:
   - 必要に応じてURLパスでのバージョン導入: `/api/v2/properties`
   - 移行期間の確保と並行運用

### 8.2 廃止予定機能の通知

1. **非推奨化プロセス**:
   - レスポンスヘッダーでの警告提供: `X-Deprecated: true`
   - ドキュメントでの明示的な非推奨表記
   - 猶予期間の確保（最低6ヶ月）

### 8.3 API文書化戦略

1. **ドキュメント体系**:
   - OpenAPI/Swagger仕様での機械可読文書
   - Markdownベースの人間可読文書
   - コード例とユースケース説明の提供

2. **更新ポリシー**:
   - コードと文書の一元管理
   - 変更時の文書自動更新メカニズム

## 9. エンドポイント設計方針

各リソースのエンドポイント設計は、以下の基本構造に従います。詳細は各リソース別APIドキュメントを参照してください。

### 9.1 基本構造

| エンドポイント | メソッド | 説明 |
|--------------|--------|------|
| `/api/{resource}` | GET | リソース一覧取得 |
| `/api/{resource}/{id}` | GET | 特定リソース取得 |
| `/api/{resource}` | POST | リソース作成 |
| `/api/{resource}/{id}` | PUT | リソース全体更新 |
| `/api/{resource}/{id}` | PATCH | リソース部分更新 |
| `/api/{resource}/{id}` | DELETE | リソース削除 |

### 9.2 リレーション表現

| エンドポイント | メソッド | 説明 |
|--------------|--------|------|
| `/api/{resource}/{id}/{relation}` | GET | 関連リソース一覧取得 |
| `/api/{resource}/{id}/{relation}/{relationId}` | GET | 特定関連リソース取得 |
| `/api/{resource}/{id}/{relation}` | POST | 関連リソース作成/追加 |
| `/api/{resource}/{id}/{relation}/{relationId}` | DELETE | 関連リソース削除/解除 |

### 9.3 アクション表現

カスタムアクションやプロセス実行のためのエンドポイントも提供します：

| エンドポイント | メソッド | 説明 |
|--------------|--------|------|
| `/api/{resource}/{id}/{action}` | POST | リソースに対するアクション実行 |
| `/api/{resource}/batch` | POST | 一括処理の実行 |
| `/api/{service}/{action}` | POST | 独立したサービスアクション実行 |

## 10. API実装ガイドライン

### 10.1 コード実装原則

1. **コントローラー設計**:
   - シンプルなルーティングとリクエスト検証のみ担当
   - ビジネスロジックをサービス層に委譲
   - 一貫したレスポンス形成

2. **サービス層**:
   - ビジネスロジックのカプセル化
   - トランザクション管理
   - ドメインルールの適用

3. **エラーハンドリング**:
   - グローバルエラーハンドラーの活用
   - 構造化された例外処理
   - 一貫したエラーレスポンス形成

### 10.2 セキュリティ実装

1. **入力サニタイゼーション**:
   - すべてのユーザー入力のサニタイズ
   - SQLインジェクション防止
   - XSS対策

2. **アクセス制御実装**:
   - ミドルウェアでの認証検証
   - リソースごとの権限チェック
   - 組織ID一致確認の徹底

## 11. APIドキュメント体系

本APIドキュメントは以下の構成で整備します：

1. **API概要** (index.md):
   - 基本設計原則と共通仕様

2. **認証API仕様** (auth.md):
   - 認証エンドポイント詳細

3. **エンドポイント一覧** (endpoints.md):
   - 全APIの概要一覧

4. **リソース別API仕様**:
   - users.md: ユーザー関連API
   - properties.md: 物件関連API
   - volume-check.md: ボリュームチェック関連API
   - profitability.md: 収益性試算関連API
   - documents.md: 文書関連API

5. **OpenAPI/Swagger仕様** (openapi.yaml):
   - 機械可読なAPI完全定義

## 12. 付録

### 12.1 API設計チェックリスト

- [ ] URLは直感的で一貫性があるか
- [ ] HTTPメソッドが適切に使用されているか
- [ ] レスポンス形式が統一されているか
- [ ] エラー処理が適切に定義されているか
- [ ] 認証・認可の仕組みが明確か
- [ ] バリデーションルールが定義されているか
- [ ] ページネーション方式が適切か
- [ ] キャッシュ戦略が考慮されているか
- [ ] スケーラビリティが確保されているか
- [ ] ドキュメントが充実しているか

### 12.2 リファレンス

1. RESTful APIガイドライン
2. JSON:API仕様
3. OAuth 2.0とOpenID Connect
4. HTTPステータスコード標準