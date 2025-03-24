# 認証状態同期問題の修正ガイド

## 問題の概要

ログインしたあと、認証状態が各コンポーネント間で正しく同期されず、スコープマネージャーを開こうとすると「サーバー接続に問題があります。再ログインしてください」というエラーが発生します。再ログインしても問題が解決しません。

根本的な原因は、SimpleAuthServiceのインスタンスが異なるモジュール間で共有されていないことです。ログイン成功時のインスタンスとスコープマネージャーが使用するインスタンスが異なるため、認証状態が同期されていません。

## 修正ファイル

以下のファイルを作成または修正しました：

1. **src/ext-fix.ts** - SimpleAuthServiceのグローバル変数管理ユーティリティ
2. **src/api/scopeManagerTestAPI.ts** - スコープマネージャー用API接続テスト関数
3. **src/extension-modified.ts** - グローバル変数でSimpleAuthServiceを共有するよう修正されたextension.ts
4. **src/scope-manager-fix.md** - ScopeManagerPanel.tsの修正手順

## 修正の適用手順

修正を適用するには、以下の手順に従ってください：

### 1. extension.tsの修正

`src/extension-modified.ts`のファイル内容を`src/extension.ts`に上書きするか、以下の変更を手動で行います：

- グローバル変数の定義に`_appgenius_simple_auth_service`を追加
- SimpleAuthServiceを初期化した後、グローバル変数に保存するコードを追加

```typescript
// シンプル認証サービスの取得
const simpleAuthService = simpleAuthManager.getAuthService();
// グローバル変数に保存（拡張機能全体で参照できるように）
global._appgenius_simple_auth_service = simpleAuthService;
Logger.info('SimpleAuthService accessed and stored in global variable successfully');
```

### 2. ext-fix.tsの追加

`src/ext-fix.ts`ファイルはそのまま使用します（必要になった場合のためのユーティリティ）。

### 3. scopeManagerTestAPI.tsの追加

`src/api/scopeManagerTestAPI.ts`ファイルをそのまま追加します。これはスコープマネージャーのAPI接続テスト機能を実装します。

### 4. ScopeManagerPanel.tsの修正

`src/scope-manager-fix.md`の指示に従って、ScopeManagerPanel.tsを修正します：

- _testAPIConnection関数を追加/修正してscopeManagerTestAPIを使用するように変更
- API接続失敗時の処理を改善し、再ログイン提案を追加
- ClaudeCodeAuthSyncを安全に初期化するコードを追加

### 5. SimpleAuthService.tsの修正（既に適用済み）

グローバル変数に自身を保存するコードを追加し、ログ出力を強化しました。

## 検証方法

修正を適用した後、以下の手順で動作を確認してください：

1. VSCodeを再起動
2. AppGenius拡張機能にログイン
3. ダッシュボードからスコープマネージャーを開く（正常に開くことを確認）
4. スコープマネージャーから実装アシスタントを起動（正常に起動することを確認）

## トラブルシューティング

もし修正を適用しても問題が解決しない場合：

1. ログを確認して認証状態が正しく設定されているか確認
2. VSCodeのデベロッパーツールでグローバル変数_appgenius_simple_auth_serviceが正しく設定されているか確認
3. ファイル修正が正しく適用されているか確認

## 技術的説明

この修正は、SimpleAuthServiceのインスタンスをグローバル変数を通じて共有することで、異なるモジュール間で同じ認証状態を参照できるようにします。これにより、認証状態の同期問題を解決し、一度ログインすれば全てのコンポーネントで正しく認証状態が反映されるようになります。