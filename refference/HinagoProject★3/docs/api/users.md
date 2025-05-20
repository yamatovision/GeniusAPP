# ユーザー関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-18  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）のユーザー管理に関するAPI仕様を定義します。ユーザー情報の取得、更新、プロフィール管理などの操作を提供します。

ユーザー管理機能は組織を基盤としたアクセス制御と連携し、システム内での権限管理と個人設定の管理を可能にします。各ユーザーは一つの組織に所属し、その組織のリソースにのみアクセスできます。

## 2. リソース概要

### 2.1 ユーザーリソース (User)

ユーザーリソースは以下の主要属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| email | string | メールアドレス |
| name | string | 氏名 |
| role | UserRole | ユーザーロール |
| organizationId | ID | 所属組織ID |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### 2.2 ユーザーロール (UserRole)

ユーザーの役割と権限を表す列挙型：

| 値 | 説明 |
|---|------|
| USER | 標準ユーザー |

（注：将来的にADMIN、MANAGER等のロールが追加される可能性があります）

## 3. エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/users` | GET | 必須 | 自組織ユーザー一覧取得 |
| `/api/users/{id}` | GET | 必須 | 特定ユーザー情報取得 |
| `/api/users/{id}` | PUT | 必須 | ユーザー情報更新（自身のみ） |
| `/api/users/profile` | GET | 必須 | 自身のプロフィール取得 |
| `/api/users/profile` | PUT | 必須 | 自身のプロフィール更新 |

## 4. エンドポイント詳細

### 4.1 自組織ユーザー一覧取得 - GET /api/users

ユーザーの所属組織に属する全ユーザーの一覧を取得します。

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| page | number | いいえ | ページ番号（デフォルト: 1） |
| limit | number | いいえ | 1ページあたりの結果数（デフォルト: 20、最大: 100） |
| sort | string | いいえ | ソート条件（例: `name:asc`） |
| search | string | いいえ | ユーザー名またはメールアドレスによる検索 |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": "user_123456",
      "email": "user1@example.com",
      "name": "山田太郎",
      "role": "user",
      "organizationId": "org_123456",
      "createdAt": "2025-05-01T09:00:00Z",
      "updatedAt": "2025-05-01T09:00:00Z"
    },
    {
      "id": "user_123457",
      "email": "user2@example.com",
      "name": "佐藤花子",
      "role": "user",
      "organizationId": "org_123456",
      "createdAt": "2025-05-02T10:30:00Z",
      "updatedAt": "2025-05-02T10:30:00Z"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**エラー**: 認証エラー - 401 Unauthorized
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

- レスポンスには自身の所属組織に属するユーザーのみが含まれる
- パスワード関連の情報は返却されない
- `search`パラメータは部分一致で検索する
- レート制限: 60回/分/ユーザー

---

### 4.2 特定ユーザー情報取得 - GET /api/users/{id}

指定されたIDのユーザー情報を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | ユーザーID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "user_123456",
    "email": "user1@example.com",
    "name": "山田太郎",
    "role": "user",
    "organizationId": "org_123456",
    "createdAt": "2025-05-01T09:00:00Z",
    "updatedAt": "2025-05-01T09:00:00Z",
    "organization": {
      "id": "org_123456",
      "name": "山田不動産開発"
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
    "message": "指定されたユーザーが見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "このユーザー情報にアクセスする権限がありません"
  }
}
```

#### 実装ノート

- 自身の所属組織に属するユーザーのみアクセス可能
- レスポンスには組織の基本情報も含まれる
- パスワード関連の情報は返却されない
- レート制限: 60回/分/ユーザー

---

### 4.3 ユーザー情報更新 - PUT /api/users/{id}

指定されたIDのユーザー情報を更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | ユーザーID |

#### リクエスト

```json
{
  "name": "山田太郎（改名）",
  "email": "newemail@example.com"
}
```

#### バリデーションルール

- `name`: オプション、1文字以上50文字以下
- `email`: オプション、有効なメールアドレス形式、一意制約

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "user_123456",
    "name": "山田太郎（改名）",
    "email": "newemail@example.com",
    "updatedAt": "2025-05-15T13:30:00Z"
  }
}
```

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定されたユーザーが見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "このユーザー情報を更新する権限がありません"
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
      "email": "有効なメールアドレスを入力してください"
    }
  }
}
```

**エラー**: メールアドレス重複 - 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "このメールアドレスは既に使用されています"
  }
}
```

#### 実装ノート

- 自身のユーザー情報のみ更新可能
- パスワード変更は専用のエンドポイント（認証APIの一部）を使用
- `role`の変更はこのエンドポイントでは許可されない
- 変更後のメールアドレスに確認メールが送信される
- レスポンスには更新されたフィールドと`id`、`updatedAt`のみが含まれる
- レート制限: 10回/分/ユーザー

---

### 4.4 自身のプロフィール取得 - GET /api/users/profile

認証されたユーザー自身のプロフィール情報を取得します。

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "user_123456",
    "email": "user1@example.com",
    "name": "山田太郎",
    "role": "user",
    "organizationId": "org_123456",
    "createdAt": "2025-05-01T09:00:00Z",
    "updatedAt": "2025-05-01T09:00:00Z",
    "organization": {
      "id": "org_123456",
      "name": "山田不動産開発",
      "subscription": "free"
    },
    "preferences": {
      "theme": "light",
      "notifications": {
        "email": true,
        "browser": true
      },
      "defaultViews": {
        "dashboard": "properties"
      }
    }
  }
}
```

**エラー**: 認証エラー - 401 Unauthorized
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

- このエンドポイントは`/api/auth/me`と類似するが、より詳細なユーザー設定情報を含む
- レスポンスには組織情報と詳細なユーザー設定が含まれる
- パスワード関連の情報は返却されない
- レート制限: 60回/分/ユーザー

---

### 4.5 自身のプロフィール更新 - PUT /api/users/profile

認証されたユーザー自身のプロフィール情報を更新します。

#### リクエスト

```json
{
  "name": "山田太郎（改名）",
  "email": "newemail@example.com",
  "preferences": {
    "theme": "dark",
    "notifications": {
      "email": false,
      "browser": true
    },
    "defaultViews": {
      "dashboard": "analysis"
    }
  }
}
```

#### バリデーションルール

- `name`: オプション、1文字以上50文字以下
- `email`: オプション、有効なメールアドレス形式、一意制約
- `preferences`: オプション、ユーザー設定オブジェクト
  - `theme`: オプション、`'light'`または`'dark'`
  - `notifications`: オプション、通知設定オブジェクト
  - `defaultViews`: オプション、デフォルトビュー設定オブジェクト

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "user_123456",
    "name": "山田太郎（改名）",
    "email": "newemail@example.com",
    "preferences": {
      "theme": "dark",
      "notifications": {
        "email": false,
        "browser": true
      },
      "defaultViews": {
        "dashboard": "analysis"
      }
    },
    "updatedAt": "2025-05-15T14:00:00Z"
  }
}
```

**エラー**: バリデーションエラー、メールアドレス重複の場合は前述のエラーレスポンスと同様。

#### 実装ノート

- このエンドポイントはユーザー情報と設定の両方を一度に更新可能
- メールアドレス変更時は確認メールが送信される
- `preferences`は部分的な更新をサポート（指定されたフィールドのみ更新）
- パスワード変更はこのエンドポイントではサポートされない（認証APIを使用）
- レスポンスには更新されたフィールドと`id`、`updatedAt`が含まれる
- レート制限: 10回/分/ユーザー

## 5. ユーザー設定

### 5.1 テーマ設定

| 値 | 説明 |
|---|------|
| light | ライトテーマ（デフォルト） |
| dark | ダークテーマ |

### 5.2 通知設定

| キー | 型 | 説明 | デフォルト |
|-----|-----|------|-----------|
| email | boolean | メール通知の有効/無効 | true |
| browser | boolean | ブラウザプッシュ通知の有効/無効 | true |

### 5.3 デフォルトビュー設定

| キー | 値 | 説明 | デフォルト |
|-----|-----|------|-----------|
| dashboard | string | ダッシュボードの初期表示 | "properties" |

## 6. データモデルとの整合性

このAPIは`shared/index.ts`で定義されている以下のデータモデルと整合しています：

- `User`: ユーザー情報
- `UserRole`: ユーザーロール列挙型

## 7. サンプルコード

### 7.1 ユーザー一覧取得

```typescript
// フロントエンドでのユーザー一覧取得例
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// 自組織ユーザー一覧取得
const fetchUsers = async (search?: string) => {
  try {
    const params: any = {};
    if (search) {
      params.search = search;
    }
    
    const response = await axios.get(API_PATHS.USERS.BASE, { params });
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('ユーザー一覧の取得に失敗しました', error);
    throw error;
  }
};
```

### 7.2 プロフィール更新

```typescript
// フロントエンドでのプロフィール更新例
import axios from 'axios';
import { API_PATHS } from '@shared/index';

// ユーザープロフィール更新
const updateProfile = async (
  name?: string,
  email?: string,
  preferences?: any
) => {
  try {
    const data: any = {};
    
    if (name) data.name = name;
    if (email) data.email = email;
    if (preferences) data.preferences = preferences;
    
    const response = await axios.put(API_PATHS.USERS.PROFILE, data);
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('プロフィール更新に失敗しました', error);
    throw error;
  }
};

// 使用例
const updateUserProfile = async () => {
  await updateProfile(
    '山田太郎（改名）',
    undefined, // メールアドレスは変更しない
    {
      theme: 'dark',
      notifications: {
        email: false,
        browser: true
      }
    }
  );
};
```

## 8. セキュリティ考慮事項

### 8.1 アクセス制御

- 全てのエンドポイントはユーザー認証が必要
- ユーザーは自身の所属組織のユーザーのみ閲覧可能
- ユーザー情報の更新は自身のデータのみ可能
- パスワード関連の情報は絶対に返却されない

### 8.2 入力バリデーション

- 全てのユーザー入力は厳格にバリデーション
- メールアドレスは形式チェックと一意性チェック
- ユーザー名の長さ制限と文字種チェック
- 設定情報の構造とプロパティ値の検証

### 8.3 メール確認

- メールアドレス変更時は確認メールを送信
- 変更確認までは旧メールアドレスも有効
- 確認リンクには有効期限とユーザーIDを含む署名付きトークン

### 8.4 レート制限

- 情報取得は60回/分/ユーザーに制限
- 情報更新は10回/分/ユーザーに制限

## 9. エラーハンドリング

一般的なユーザー関連のエラーコード：

| エラーコード | 説明 |
|------------|------|
| `RESOURCE_NOT_FOUND` | 指定されたユーザーが存在しない |
| `PERMISSION_DENIED` | 操作に必要な権限がない |
| `VALIDATION_ERROR` | 入力データが検証基準を満たしていない |
| `DUPLICATE_EMAIL` | メールアドレスが既に使用されている |
| `EMAIL_CHANGE_CONFIRMATION_REQUIRED` | メールアドレス変更には確認が必要 |

## 10. キャッシング戦略

特定のエンドポイントにはキャッシング戦略が適用されます：

| エンドポイント | キャッシュTTL | 条件 |
|--------------|-------------|------|
| GET /api/users | 5分 | If-Modified-Since, ETagがサポート |
| GET /api/users/{id} | 5分 | If-Modified-Since, ETagがサポート |
| GET /api/users/profile | 1分 | If-Modified-Since, ETagがサポート |