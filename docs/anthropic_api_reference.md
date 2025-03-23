# Anthropic API エンドポイント調査結果

## 問題概要

SimpleOrganizationDetailコンポーネントでワークスペース作成機能を実装する際に、Anthropic APIへのリクエストが「Not Found」エラーで失敗していました。原因はAPIエンドポイントのパスが正しくないことが確認されました。

## 対応状況（更新：2025/03/23）

✅ **修正完了**: simpleOrganization.controller.jsファイルを更新し、新しい正しいAPIエンドポイントを使用するように変更しました。

## エンドポイントテスト結果（更新：2025/03/23）

テスト結果は以下の通りです：

1. ✅ `https://api.anthropic.com/v1/organizations/workspaces` - **正常に動作**
2. ❌ `https://api.anthropic.com/v1/workspaces` - 404 Not Found
3. ❌ `https://api.anthropic.com/v1/admin/workspaces` - 404 Not Found

## 解決策

### 正しいエンドポイント

Anthropic APIの正しいワークスペース作成エンドポイントは以下の通りです：

```
POST /v1/organizations/workspaces
```

### 必要なヘッダー情報

```
Content-Type: application/json
X-API-Key: [ANTHROPIC_ADMIN_KEY]
anthropic-version: 2023-06-01
```

### リクエスト本文

```json
{
  "name": "ワークスペース名"
}
```

重要：APIの仕様が変更されており、以前は受け付けていた `description` フィールドは現在サポートされていません。

### 実装例

```javascript
const anthropicResponse = await axios.post(
  'https://api.anthropic.com/v1/organizations/workspaces',
  {
    name: workspaceName
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': adminApiKey,
      'anthropic-version': '2023-06-01'
    }
  }
);
```

## 補足情報

* Anthropic APIドキュメント: [https://docs.anthropic.com/claude/reference/](https://docs.anthropic.com/claude/reference/)
* Anthropic APIキーダッシュボード: [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

## 管理者APIキーの要件

ワークスペース作成機能を使用するには、管理者APIキー（`sk-ant-admin...` で始まるもの）を使用する必要があります。これは組織の管理者ロールを持つユーザーのみがAnthropicコンソールから取得できます。

## テスト確認結果

テストスクリプト `test_admin_key.js` を使用して、新しいエンドポイントでのワークスペース作成が正常に動作することを確認しました。ワークスペースが正常に作成され、APIから作成されたワークスペースのID、名前、作成日時などの情報が返されました。