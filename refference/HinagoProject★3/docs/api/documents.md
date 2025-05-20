# 文書関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-18  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）の文書管理に関するAPI仕様を定義します。物件に関連する文書（測量図、登記簿謄本、契約書、写真など）のアップロード、取得、更新、削除などの操作を提供します。

文書管理機能は物件データと密接に連携し、物件に関連する重要な資料を体系的に管理するためのインターフェースを提供します。各文書はタイプ別に分類され、検索や管理が容易になります。

## 2. リソース概要

### 2.1 文書リソース (Document)

文書リソースは以下の主要属性を持ちます：

| 属性 | 型 | 説明 |
|-----|-----|------|
| id | ID | 一意識別子 |
| propertyId | ID | 関連物件ID |
| name | string | ファイル名 |
| fileType | string | ファイルタイプ |
| fileSize | number | ファイルサイズ（バイト） |
| fileUrl | string | ファイルURL |
| documentType | DocumentType | 文書タイプ |
| description | string | 説明（オプション） |
| createdAt | Date | 作成日時 |
| updatedAt | Date | 更新日時 |

### 2.2 文書タイプ (DocumentType)

文書の種類を表す列挙型：

| 値 | 説明 |
|---|------|
| SURVEY_MAP | 測量図 |
| REGISTER | 登記簿謄本 |
| CONTRACT | 契約書 |
| PHOTO | 写真 |
| OTHER | その他 |

## 3. エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/properties/{id}/documents` | GET | 必須 | 物件関連文書一覧取得 |
| `/api/properties/{id}/documents` | POST | 必須 | 物件関連文書追加 |
| `/api/documents/{id}` | GET | 必須 | 文書取得 |
| `/api/documents/{id}` | PUT | 必須 | 文書更新 |
| `/api/documents/{id}` | DELETE | 必須 | 文書削除 |
| `/api/documents/{id}/download` | GET | 必須 | 文書ダウンロード |

## 4. エンドポイント詳細

### 4.1 物件関連文書一覧取得 - GET /api/properties/{id}/documents

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

- 組織IDが一致する物件の文書のみアクセス可能
- `documentType`パラメータで文書タイプによるフィルタリングが可能
- レスポンスには各文書のメタデータが含まれるが、ファイル内容は含まれない
- `fileUrl`は文書ダウンロード用のエンドポイントへのパスを提供
- レート制限: 60回/分/ユーザー

---

### 4.2 物件関連文書追加 - POST /api/properties/{id}/documents

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

**エラー**: バリデーションエラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": {
      "documentType": "有効な文書タイプを選択してください"
    }
  }
}
```

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
- 文書ファイルは安全なストレージサービスに保存
- レート制限: 30回/分/ユーザー

---

### 4.3 文書取得 - GET /api/documents/{id}

指定されたIDの文書情報を取得します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 文書ID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "propertyId": "property_123",
    "name": "測量図_天神1-1-1.pdf",
    "fileType": "application/pdf",
    "fileSize": 1245678,
    "fileUrl": "/api/documents/doc_123/download",
    "documentType": "survey-map",
    "description": "福岡市役所発行の公式測量図",
    "createdAt": "2025-05-01T10:30:00Z",
    "updatedAt": "2025-05-01T10:30:00Z",
    "property": {
      "id": "property_123",
      "name": "福岡タワーマンション計画"
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
    "message": "指定された文書が見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "この文書にアクセスする権限がありません"
  }
}
```

#### 実装ノート

- 文書に関連する物件の組織IDが一致する場合のみアクセス可能
- レスポンスにはデフォルトで関連物件の基本情報（id, name）も含まれる
- レート制限: 60回/分/ユーザー

---

### 4.4 文書更新 - PUT /api/documents/{id}

指定されたIDの文書情報を更新します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 文書ID |

#### リクエスト

```json
{
  "documentType": "register",
  "description": "2025年5月更新の登記簿謄本"
}
```

#### バリデーションルール

- `documentType`: オプション、DocumentType列挙型の有効な値
- `description`: オプション、500文字以下の文字列

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "documentType": "register",
    "description": "2025年5月更新の登記簿謄本",
    "updatedAt": "2025-05-15T12:30:00Z"
  }
}
```

**エラー**: リソースが見つからない、バリデーションエラー、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- ファイル自体の更新はサポートされていない（新しいファイルをアップロードする場合は古いファイルを削除し、新規追加する必要がある）
- 更新可能な属性は`documentType`と`description`のみ
- 文書の更新は物件履歴にUPDATEアクションとして記録
- レスポンスには更新されたフィールドと`id`、`updatedAt`のみが含まれる
- レート制限: 30回/分/ユーザー

---

### 4.5 文書削除 - DELETE /api/documents/{id}

指定されたIDの文書を削除します。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 文書ID |

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "deleted": true
  }
}
```

**エラー**: リソースが見つからない、権限エラーの場合は前述のエラーレスポンスと同様。

#### 実装ノート

- 文書の削除は論理削除（ソフトデリート）として実装
- 削除された文書は物件履歴にDELETEアクションとして記録
- 削除された文書は一覧取得では表示されなくなる
- レート制限: 10回/分/ユーザー

---

### 4.6 文書ダウンロード - GET /api/documents/{id}/download

指定されたIDの文書ファイルをダウンロードします。

#### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|-----|------|------|
| id | string | はい | 文書ID |

#### レスポンス

**成功**: 200 OK
Content-Type: [文書のMIMEタイプ]
Content-Disposition: attachment; filename="[文書の名前]"

[ファイルの内容がバイナリで返却]

**エラー**: リソースが見つからない - 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定された文書が見つかりません"
  }
}
```

**エラー**: 権限エラー - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "この文書にアクセスする権限がありません"
  }
}
```

#### 実装ノート

- ファイルは適切なContent-Typeヘッダーと共に提供される
- Content-Dispositionヘッダーによりブラウザでダウンロードダイアログが表示される
- 文書に関連する物件の組織IDが一致する場合のみアクセス可能
- 画像ファイルの場合は適切なサイズへのリサイズ・圧縮版も提供可能
- レート制限: 60回/分/ユーザー

## 5. データモデルとの整合性

このAPIは`shared/index.ts`で定義されている以下のデータモデルと整合しています：

- `Document`: 文書情報
- `DocumentType`: 文書タイプ列挙型

## 6. サンプルコード

### 6.1 文書一覧取得

```typescript
// フロントエンドでの文書一覧取得例
import axios from 'axios';
import { API_PATHS, DocumentType } from '@shared/index';

// 物件に紐づく文書一覧取得
const fetchDocuments = async (propertyId: string, documentType?: DocumentType) => {
  try {
    const params: any = {};
    if (documentType) {
      params.documentType = documentType;
    }
    
    const response = await axios.get(
      API_PATHS.PROPERTIES.DOCUMENTS(propertyId),
      { params }
    );
    
    if (response.data.success) {
      return response.data.data;
    }
  } catch (error) {
    console.error('文書一覧の取得に失敗しました', error);
    throw error;
  }
};
```

### 6.2 文書アップロード

```typescript
// フロントエンドでの文書アップロード例
import axios from 'axios';
import { API_PATHS, DocumentType } from '@shared/index';

// 文書アップロード
const uploadDocument = async (
  propertyId: string,
  file: File,
  documentType: DocumentType,
  description?: string
) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    
    if (description) {
      formData.append('description', description);
    }
    
    const response = await axios.post(
      API_PATHS.PROPERTIES.DOCUMENTS(propertyId),
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
    console.error('文書アップロードに失敗しました', error);
    throw error;
  }
};
```

## 7. セキュリティ考慮事項

### 7.1 アクセス制御

- 全てのエンドポイントはユーザー認証が必要
- 文書は物件を介して組織IDに基づいてアクセス制御される
- 組織外のユーザーは文書にアクセス不可

### 7.2 入力バリデーション

- 全てのユーザー入力は厳格にバリデーション
- ファイルタイプはホワイトリストベースで検証
- ファイル名のサニタイズによるパス・トラバーサル攻撃の防止

### 7.3 ファイルセキュリティ

- アップロードされたファイルは安全なストレージサービスに保存
- 保存前にウイルススキャンを実施
- 一時的なプレサインドURLでのみアクセス可能
- セキュアなTLSによるファイル転送

### 7.4 レート制限

- すべてのエンドポイントには適切なレート制限を実装
- 特にアップロード操作には厳格な制限を適用

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
| `VIRUS_DETECTED` | ファイルからウイルスが検出された |

## 9. キャッシング戦略

特定のエンドポイントにはキャッシング戦略が適用されます：

| エンドポイント | キャッシュTTL | 条件 |
|--------------|-------------|------|
| GET /api/properties/{id}/documents | 5分 | If-Modified-Since, ETagがサポート |
| GET /api/documents/{id} | 5分 | If-Modified-Since, ETagがサポート |
| GET /api/documents/{id}/download | 1時間 | キャッシュコントロールヘッダーあり |