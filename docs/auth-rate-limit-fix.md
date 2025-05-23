# 認証レート制限の最適化

## 問題概要

ログインプロセス中に `429 Too Many Requests` エラーが頻繁に発生し、ユーザーがログインできなくなる問題が報告されました。これはバックエンドのレート制限設定が厳しすぎることが原因でした。

## 修正内容

### 1. バックエンドのレート制限設定の調整

`rate-limit.middleware.js` ファイルで以下の変更を行いました：

- 一般的なIPベースのレート制限を60リクエスト/分から100リクエスト/分に増加
- 認証エンドポイントのレート制限ウィンドウを15秒から60秒に延長
- 認証エンドポイントの最大リクエスト数を5から20に増加
- ログインエンドポイント(`/auth/login`)の最大リクエスト数を5から15に増加
- レート制限時の再試行時間を短縮（最大30秒）

### 2. フロントエンドのエラーハンドリングの改善

`Login.js` コンポーネントで以下の変更を行いました：

- レート制限エラー発生時の最大待機時間を60秒に制限
- より親切なエラーメッセージを表示（何が起こっているかをユーザーに明確に伝える）
- デバッグ用のログ出力を追加

### 3. 認証チェックの最適化

`simpleAuth.service.js` で以下の変更を行いました：

- 認証チェックの最小間隔を30秒から60秒に延長

## 対処効果

- ログイン処理のレート制限問題を緩和
- 複数リクエストが同時に発生した場合でも、ユーザーがより早くログインできるように
- エラーメッセージがより分かりやすくなり、ユーザーにとっての透明性が向上
- サーバーへの無駄なリクエストが減少（認証チェック間隔を延長することで）

## 実装した変更ファイル

1. `/portal/backend/middlewares/rate-limit.middleware.js`
2. `/portal/frontend/src/components/auth/Login.js`
3. `/portal/frontend/src/services/simple/simpleAuth.service.js`

## テスト方法

レート制限のテストスクリプト `test_script/test_auth_rate_limit.js` を実行して、修正後の動作を確認できます。このスクリプトは以下をテストします：

1. 連続ログインリクエストでレート制限が発生するかどうか
2. レート制限後、適切な待機時間後に再試行が成功するかどうか

```bash
node test_script/test_auth_rate_limit.js
```

## 追加のモニタリング

今後もレート制限エラーが頻発する場合は、以下の調査が必要です：

1. クライアント側での不必要な認証リクエストの発生源の特定
2. ネットワークやブラウザの自動リトライによる過剰リクエストの有無
3. 必要に応じたさらなるレート制限パラメータの調整