# API URL構造ガイドライン

## 概要

このドキュメントは、フロントエンドとバックエンド間のAPI通信におけるURL構造に関するガイドラインです。これに従うことで、URLの重複や不一致によるエラーを防止できます。

## 基本構造

### バックエンド構造

バックエンドのAPI構造は以下のようになっています：

```
/api                  # APIルートパス
  ├── /auth           # 通常の認証API
  ├── /users          # ユーザー管理API
  ├── /prompts        # プロンプト管理API
  ├── /projects       # プロジェクト管理API
  ├── /organizations  # 組織管理API
  ├── /workspaces     # ワークスペース管理API
  ├── /admin          # 管理者API
  └── /simple         # シンプル版API
      ├── /auth       # シンプル認証API
      ├── /users      # シンプルユーザー管理API
      └── ...
```

### フロントエンドでのURL指定方法

フロントエンドからのAPIリクエストは、次の3つの要素によって成り立っています：

1. **プロキシ設定**: `package.json`の`"proxy": "http://localhost:5000"`
2. **Axiosベース設定**: `axios.defaults.baseURL`の設定
3. **サービスファイル内のパス**: 各サービスファイルで使用するエンドポイントパス

## 共通ルール

1. **サービスファイル内でのAPIパス指定時**:
   - **`/api`プレフィックスを含めない**
   - 直接エンドポイントから始める（例: `/simple/auth/login`）

2. **URL設計の一貫性を保つ**:
   - バックエンドのルート定義と一致するパスにする
   - 複数のサービス間で同じエンドポイントに異なるパスを使用しない

3. **トラブルシューティング**:
   - API呼び出しエラーが発生した場合、まずURLの構造を確認する
   - ネットワークタブで実際のリクエストURLを確認し、意図したURLと一致しているか確認する

## 実装例

### 悪い例

```javascript
// API基本URL
const API_URL = '/api';  // <- これが問題
const SIMPLE_API_URL = `${API_URL}/simple`;

// ログイン実行
const response = await axios.post(`${SIMPLE_API_URL}/auth/login`, ...);
```

この実装では、`/api`が重複する可能性があります。package.jsonのプロキシ設定と`axios.defaults.baseURL`の組み合わせにより、すでに`/api`が追加される環境では、最終的なURLが`/api/api/simple/auth/login`になってしまいます。

### 良い例

```javascript
// API基本URL - /apiプレフィックスを省略
const SIMPLE_API_URL = '/simple';

// ログイン実行
const response = await axios.post(`${SIMPLE_API_URL}/auth/login`, ...);
```

この実装では、環境設定に関わらず適切なURLが生成されます。

## 注意事項

- ローカル開発環境と本番環境で異なる振る舞いをする可能性がある点に注意してください
- API URLのデバッグには、ブラウザの開発者ツールのネットワークタブを活用してください
- URLパスの変更は既存機能に影響を与える可能性があるため、慎重に行ってください

## 問題解決フロー

API通信の問題が発生した場合：

1. 実際に送信されているリクエストURLを確認する
2. バックエンドのルート定義と一致しているか確認する
3. サービスファイル内のURLパス定義を確認する
4. 必要に応じて`/api`プレフィックスを削除または追加する