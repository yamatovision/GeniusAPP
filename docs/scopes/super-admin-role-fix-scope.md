# スーパー管理者ロール修正スコープ

## 背景

AppGeniusのポータルサイトでは、ユーザーロールとして `user`、`admin`、`super_admin` が定義されています。しかし、`super_admin` ロールを持つユーザーが認証時にJWTトークン内で誤って `admin` ロールとして扱われる問題がありました。これにより、スーパー管理者が組織を作成しようとすると403エラー（権限不足）が発生していました。

## 問題の詳細

1. バックエンドサービス (`auth.service.js`) において、`super_admin` ロールを持つユーザーのデータ保存時に、モデルバリデーションエラーを避けるために一時的に `admin` ロールに変更し、保存後にメモリ上で元に戻すワークアラウンドが実装されていました。

2. VSCode拡張機能の認証サービス (`AuthenticationService.ts`) においても、`super_admin` ロールが `Role.ADMIN` にマッピングされ、ロールの区別が失われていました。

3. これにより、バックエンドAPIの権限チェックで `req.userRole === authConfig.roles.SUPER_ADMIN` を検証する処理が失敗し、スーパー管理者の権限が必要な操作ができなくなっていました。

## 解決策

### バックエンド修正

1. `auth.service.js` からスーパー管理者ロールの一時変更ワークアラウンドを削除
   - ログイン処理と認証トークンリフレッシュ処理の両方から、super_adminをadminに変更する処理を削除
   - JWT生成時に元のロールをそのまま使用するように修正

2. 必要に応じて `organization.controller.js` などのコントローラーの権限チェックも確認

### VSCode拡張機能修正

1. `roles.ts` に `SUPER_ADMIN` ロールを追加
   - ロール列挙型に新しい値を追加
   - `RoleFeatureMap` に SUPER_ADMIN のアクセス可能機能を定義
   - `RoleDisplayNames` に SUPER_ADMIN の表示名を定義

2. `AuthenticationService.ts` でのロールマッピングを修正
   - `super_admin` が `Role.SUPER_ADMIN` に正しくマッピングされるように変更

### 検証ツール

1. ブラウザで実行可能な `check_user_role.js` スクリプト
   - ローカルストレージからJWTトークンを取得
   - トークンをデコードしてユーザーロールを確認
   - super_adminロールが正しく保持されているか検証

2. バックエンド検証用 `check_super_admin_role.js` スクリプト
   - データベースからユーザー情報を取得
   - 修正前後のトークン生成ロジックの違いを検証
   - 実際のユーザーロールとトークン内のロールを比較

## 期待される効果

1. スーパー管理者ユーザーが正しく認識され、組織作成などの管理者権限が必要な操作を実行できるようになる

2. 権限チェックが一貫して機能し、適切なユーザーのみが特定の操作を実行できるように

3. ロールに基づいたUIの表示が正確になり、スーパー管理者向けの機能が適切に表示される

## 実装完了確認事項

- [x] VSCode拡張機能の `roles.ts` に `SUPER_ADMIN` ロールを追加
- [x] `AuthenticationService.ts` のロールマッピングを修正
- [x] バックエンドの `auth.service.js` からsuper_adminロールのワークアラウンドを削除
- [x] ブラウザ用の検証スクリプト `check_user_role.js` の作成
- [x] バックエンド検証用スクリプト `check_super_admin_role.js` の作成
- [x] リファクタリング文書の更新

## 関連ファイル

1. `/src/core/auth/roles.ts` - ロール定義とマッピング
2. `/src/core/auth/AuthenticationService.ts` - VSCode拡張認証サービス
3. `/portal/backend/services/auth.service.js` - バックエンド認証サービス
4. `/portal/backend/controllers/organization.controller.js` - 組織管理コントローラ
5. `/check_user_role.js` - ブラウザ用検証スクリプト
6. `/test_script/check_super_admin_role.js` - バックエンド検証用スクリプト
7. `/docs/refactoring/AppGenius_リファクタリング優先順位.md` - リファクタリング文書

## 注意事項

このスコープで対応した問題は認証システム全体のリファクタリングの一部であり、引き続き認証サービスの責務分割や依存関係の最適化を検討する必要があります。