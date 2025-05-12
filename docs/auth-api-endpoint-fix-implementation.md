# 認証APIエンドポイント修正実装報告

## 修正内容の実施

認証APIエンドポイントとコマンド二重登録の問題について、以下の修正を実施しました：

### 1. コマンド二重登録の修正

`src/extension.ts` ファイルの該当部分を変更し、SimpleAuthコマンドが重複して登録されないようにしました：

```diff
- // 認証コマンドの登録
- registerAuthCommands(context);
- Logger.info('Auth commands registered successfully');
+ // 認証コマンドの登録（二重登録を防ぐバージョンを使用）
+ const { registerAuthCommandsWithoutSimple } = require('./core/auth/authCommands');
+ registerAuthCommandsWithoutSimple(context);
+ Logger.info('Auth commands registered successfully (without SimpleAuth commands)');
```

この変更により、`SimpleAuthManager` の初期化時に既に登録されている `appgenius.simpleAuth.showMenu` コマンドが二重登録されなくなります。

### 2. APIエンドポイントURLの確認

以下のファイルのAPIベースURLを確認し、すでに本番環境URLに設定されていることを確認しました：

**`src/core/auth/new/AuthService.ts`**:
```javascript
// APIベースURL - 常に本番環境を使用
private readonly API_BASE_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/simple';
```

**`src/api/claudeCodeApiClient.ts`**:
```javascript
// 常に本番環境URLを使用（環境変数よりも優先）
this._baseUrl = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';
```

## 実施した手順

1. `extension.ts` ファイルの該当部分を手動で修正
2. `npm run compile` コマンドで拡張機能を再コンパイル
3. VSCodeを再起動して変更を適用

## 期待される結果

この修正により、以下の問題が解決されるはずです：

1. 起動時の `command 'appgenius.simpleAuth.showMenu' already exists` エラーが発生しなくなる
2. すべての認証APIリクエストが正しく本番環境URLに送信される
3. 認証フローが正常に完了するようになる

## 検証方法

1. VSCodeを再起動して、起動ログに認証サービス初期化エラーが表示されないことを確認
2. AppGeniusにログインして、認証フローが正常に完了することを確認
3. ログで API リクエストが正しいURLに送信されていることを確認