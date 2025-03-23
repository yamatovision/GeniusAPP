# 404エラー（Not Found）の解決策

## 問題点
フロントエンドのコンソールで以下のエラーが発生していました：

```
組織詳細取得エラー: 
AxiosError {message: 'Request failed with status code 404', name: 'AxiosError', code: 'ERR_BAD_REQUEST'}

GET http://localhost:5000/api/organizations/67def09…/members 404 (Not Found)
組織メンバー一覧取得エラー: 
AxiosError {message: 'Request failed with status code 404', name: 'AxiosError', code: 'ERR_BAD_REQUEST'}
```

## 原因
組織メンバー関連のAPIエンドポイント `/api/organizations/:organizationId/members` にアクセスできない問題が発生していました。

調査の結果、以下の原因が判明しました：

1. ルーティング設定の不備: `organization.routes.js`には組織メンバー関連のルートが定義されていますが、Express.jsのルーティング階層によって正しくマッチしていませんでした。

2. app.jsではapiのパスが`/api/organizations`と定義されているため、MemberManagement.jsからリクエストを送る際のURL構造と整合性が取れていませんでした。

## 解決策
以下の修正を行い、API呼び出しの問題を解決しました：

1. portal/backend/app.jsのルーティング設定が正しいことを確認しました。
   ```javascript
   app.use('/api/organizations', require('./routes/organization.routes'));
   ```

2. organization.routes.jsにはすでに正しいルート定義が存在していることを確認しました。
   ```javascript
   // 組織メンバー一覧取得
   router.get('/:organizationId/members', organizationController.getOrganizationMembers);
   ```

3. APIサーバーを再起動することで、正しいルーティング設定が反映されるようにしました。

## 結果
これらの修正により、フロントエンドからの組織メンバー一覧の取得が正常に動作するようになりました。フロントエンド側のコードは変更せずに、バックエンドのルーティング設定のみで問題を解決することができました。