# 認証システムリファクタリング

## 概要

AppGeniusの認証システムを再構築し、より堅牢でシンプルな実装を実現するためのリファクタリングを行いました。このドキュメントでは、リファクタリングの詳細と新しい認証システムの使用方法を説明します。

## 実装進捗

現在の進捗: **60%**

完了したコンポーネント:
- ✅ `SimpleAuthService.ts` - シンプル認証サービス
- ✅ `SimpleAuthManager.ts` - シンプル認証マネージャー
- ✅ `ClaudeCodeAuthSync.ts` - SimpleAuthServiceを使用するよう更新
- ✅ `PermissionManager.ts` - 両認証サービスに対応
- ✅ `extension.ts` - 新しい認証システムを優先使用するよう更新

今後の課題:
- 🔄 バックエンドAPI連携（APIリクエスト、トークン検証・更新）
- 🔄 フロントエンドコンポーネント連携
- 🔄 認証UI改善
- 🔄 テスト強化

## アーキテクチャ

新しい認証システムは以下のコンポーネントで構成されています：

1. **SimpleAuthService** - 認証の核となるコンポーネント
   - トークン管理
   - 認証状態管理
   - API通信

2. **SimpleAuthManager** - UIと認証サービスを接続
   - 認証UI管理
   - イベント連携
   - ステータスバー表示

3. **PermissionManager** - 両認証システムに対応
   - 機能アクセス権限管理
   - 権限チェック機能提供

4. **AuthGuard** - UIコンポーネント向け権限チェック
   - 権限に基づくアクセス制御
   - フィードバック機能

## 通常ユースケース

1. **認証初期化**:
```typescript
// 初期化 (extension.ts)
const simpleAuthManager = SimpleAuthManager.getInstance(context);
const simpleAuthService = simpleAuthManager.getAuthService();
```

2. **認証チェック**:
```typescript
// 認証済みかチェック
if (simpleAuthService.isAuthenticated()) {
  // 認証済みのときの処理
}

// 権限チェック
const permissionManager = PermissionManager.getInstance(simpleAuthService);
if (permissionManager.canAccess(Feature.ADMIN_DASHBOARD)) {
  // アクセス可能な場合の処理
}
```

3. **UIからの権限チェック**:
```typescript
// UIコンポーネントからのチェック
if (AuthGuard.checkAccess(Feature.DASHBOARD)) {
  // ダッシュボードを表示
}
```

## 移行ガイド

既存のコードが旧認証システムを使用している場合は、以下のように移行します：

1. `AuthenticationService` → `SimpleAuthService`
2. 認証チェック: `authService.isAuthenticated()` → `simpleAuthService.isAuthenticated()`
3. トークン取得: `tokenManager.getToken()` → `simpleAuthService.getAccessToken()`
4. 認証ヘッダー: 生成ロジック → `simpleAuthService.getAuthHeader()`

## 認証テスト

認証システムのテストは以下のスクリプトで行えます：

- `test_simple_auth.js` - バックエンドAPIテスト
- `test_simple_auth_extension.js` - VSCode拡張機能テスト

```bash
node test_simple_auth.js
node test_simple_auth_extension.js
```

## 注意事項

- 現在は両方の認証システムが共存していますが、将来的には完全に新システムへ移行する予定です
- すべてのUIコンポーネントは、認証チェックに`AuthGuard`クラスのメソッドを使用するようにしてください
- 直接`SimpleAuthService`を使用するのではなく、`PermissionManager`経由でアクセス権限を確認してください
- 認証エラーのハンドリングは`SimpleAuthManager`に一元化されています

## トラブルシューティング

1. **認証状態が保持されない**
   - `SimpleAuthService`のトークン保存メソッドを確認
   - SecretStorageのアクセス権限を確認

2. **認証チェックが常に失敗する**
   - トークンの有効期限を確認
   - ネットワーク接続を確認
   - サーバー側の認証エンドポイントを確認

3. **権限が正しく反映されない**
   - ユーザーロールとパーミッションマップを確認
   - `PermissionManager`の初期化順序を確認

## 貢献

このリファクタリングは進行中です。改善提案がある場合は、以下を実施してください：

1. コード確認とテスト
2. 問題や提案を報告
3. ドキュメント更新

## 関連ドキュメント

- [認証システム詳細設計](./scopes/auth-system-refactoring-scope.md)
- [認証アーキテクチャ](./auth_architecture.md)
- [開発状況](./CURRENT_STATUS.md)