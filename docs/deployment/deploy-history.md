# デプロイ履歴

## 2025-05-15: バックエンド・フロントエンドの統合デプロイ

### 1. デプロイ内容と変更点
- 対象コンポーネント: バックエンド（Google Cloud Run）とフロントエンド（Vercel）
- 主な変更点:
  - プロンプト保存の最大長制限を10000文字から30000文字に拡張
  - バックエンドのソースコードからの直接デプロイ手順を追加
  - フロントエンドの明示的なエイリアス設定手順の追加
  - deploy.md文書の更新とバックエンドデプロイ手順の詳細化

### 2. 実施内容
- バックエンドモデル変更:
  - prompt.model.jsとpromptVersion.model.jsのmaxlength制限を30000文字に拡張
  - Cloud Run ソースデプロイ機能を使用してソースコードから直接デプロイ
  - デプロイコマンド: `gcloud run deploy bluelamp --source . --platform managed --region asia-northeast1 ...`
- フロントエンドデプロイとエイリアス設定:
  - 新環境変数設定でフロントエンドをビルド
  - Vercelへのデプロイと明示的なエイリアス設定
  - エイリアスコマンド: `vercel alias set <デプロイURL> geniemon.vercel.app`
- ドキュメント更新:
  - deploy.mdの更新: バックエンドとフロントエンドのデプロイ手順詳細化
  - 新しいデプロイ方法の追加（ソースからの直接デプロイ）

## 2025-05-14: バックエンドURL移行リファクタリングの実施

### 1. リファクタリング内容と変更点
- 対象コンポーネント: VSCode拡張とバックエンド連携
- 主な変更点:
  - バックエンドURL参照を中央設定ファイル（src/config/apiConfig.ts）で一元管理
  - SimpleAuthService.tsをapiConfig.tsを使用するよう変更
  - ClaudeCodeApiClientもapiConfig.tsを使用するよう修正
  - フロントエンド用共通設定ファイル（portal/frontend/src/config/apiConfig.js）の導入
  - デプロイ関連ドキュメントの更新
  - 標準バックエンドURLとして「https://bluelamp-235426778039.asia-northeast1.run.app」を使用

### 2. 実施内容
- 新規設定ファイルの作成:
  - src/config/apiConfig.ts
  - portal/frontend/src/config/apiConfig.js
- 既存ファイルの修正:
  - SimpleAuthService.ts - バックエンドURL参照の変更
  - ClaudeCodeApiClient.ts - バックエンドURL参照の変更
  - deploy.mdとdeploy-history.md - 最新情報へ更新

## 2025-05-14: バックエンドのブルーランプリブランディングと新サービスデプロイ

### 1. デプロイ内容と変更点
- デプロイコンポーネント: バックエンド（Google Cloud Run）
- 主な変更点: 
  - 「AppGenius」から「ブルーランプ」へのリブランディングの一環としてバックエンドサービス名も更新
  - 新サービス名「bluelamp」でGoogle Cloud Runにデプロイ
  - 標準バックエンドURLを「https://bluelamp-235426778039.asia-northeast1.run.app」に変更

### 2. 実施内容
- 新しいサービス「bluelamp」のデプロイ：
  - 既存の「appgenius-portal-test」の設定（メモリ、CPU、環境変数）を引き継ぎ
  - API_HOSTを新サービス名に更新
  - 同じDockerイメージを使用（gcr.io/yamatovision-blue-lamp/appgenius-portal-backend:latest）

### 3. デプロイコマンドと結果
```bash
# 新サービスのデプロイ
gcloud run deploy bluelamp \
  --image gcr.io/yamatovision-blue-lamp/appgenius-portal-backend:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1000m \
  --port 5000 \
  --set-env-vars="NODE_ENV=production,API_HOST=bluelamp-235426778039.asia-northeast1.run.app" \
  --timeout 300s
```
- URL: https://bluelamp-235426778039.asia-northeast1.run.app
- 確認した機能: APIエンドポイント（/api）の応答確認

### 4. 移行計画
- 2025-05-14から2025-05-21まで両方のサービスを並行運用
- 2025-05-21以降は新サービス（bluelamp）のみを標準とする
- 各クライアントアプリケーションの設定を段階的に新URLに更新

## 2025-05-14: VSCode拡張機能の名称変更とリブランディング

### 1. デプロイ内容と変更点
- デプロイコンポーネント: VSCode拡張機能
- 主な変更点: 
  - 「AppGenius」から「ブルーランプ」へのリブランディング
  - VS Marketplaceへの新アプリケーションとしての公開
  - ブルーランプロゴの追加と表示名の変更

### 2. 修正内容
- `package.json`ファイルの変更：
  ```json
  {
    "name": "bluelamp",             // 内部名称を変更（新アプリとして公開）
    "displayName": "ブルーランプ",   // 表示名の変更
    "version": "1.0.1",            // バージョンリセットと更新
    "icon": "media/assets/logos/bluelamp-logo.png" // ロゴ追加
  }
  ```
- `CHANGELOG.md`の更新：リブランディングの履歴を追加
- ドキュメント更新：deploy.mdをブルーランプ名称に更新

### 3. デプロイコマンドと結果
```bash
# ビルドとパッケージング
cd /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius
npm run compile
npx vsce package

# VSCode Marketplaceへの公開
vsce publish -p <personal-access-token>
```
- URL: https://marketplace.visualstudio.com/items?itemName=mikoto.bluelamp
- 確認した機能: インストール、UI表示、ロゴ表示

## 2025-05-12: Vercelデプロイ設定の修正（追加修正）

### 1. デプロイ内容と発見した環境差異
- デプロイコンポーネント: フロントエンド（Vercel）
- 主な変更点: バックエンドURL参照の統一とCORS問題の解決
- 発見した環境差異:
  - バックエンドURLの不一致：
    - `.env.production`: `https://geniemon-portal-backend-235426778039.asia-northeast1.run.app`
    - `vercel.json`: `https://appgenius-portal-test-235426778039.asia-northeast1.run.app`
  - CORS問題：フロントエンドからのAPIリクエストが異なるバックエンドURLを参照

### 2. 修正内容
- `.env.production`ファイルのバックエンドURL参照を修正：
  ```
  REACT_APP_API_URL=https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api
  ```
- すべての環境設定ファイルでバックエンドURLを統一

### 3. デプロイコマンドと結果
```bash
# 環境変数を修正後、ビルドとデプロイ
cd portal/frontend
npm run build
vercel --prod
```
- 新URL: https://frontend-35f5rei6b-yamatovisions-projects.vercel.app
- エイリアスURL: https://geniemon.vercel.app
- 確認した機能: ログイン、ダッシュボード表示、バックエンドAPI接続

## 2025-05-12: Vercelデプロイ設定の修正（初期対応）

### 1. デプロイ内容と発見した環境差異
- デプロイコンポーネント: フロントエンド（Vercel）
- 主な変更点: URLリダイレクト問題の修正
- 発見した環境差異:
  - 本来のURL: https://geniemon.vercel.app
  - 直近のデプロイURL: https://frontend-oe537eibu-yamatovisions-projects.vercel.app/login

### 2. 修正内容
- vercel.jsonにalias設定を追加: `"alias": ["geniemon.vercel.app"]`
- 目的: フロントエンドの正しいドメイン（geniemon.vercel.app）への関連付けを強制

### 3. デプロイコマンドと結果
```bash
# vercel.jsonを修正後、Vercelダッシュボードからデプロイ
cd portal/frontend
npm run deploy:vercel
```
- URL: https://geniemon.vercel.app
- 確認した機能: ログイン、ダッシュボード表示

## バックエンドデプロイ情報
- バックエンドURL: https://appgenius-portal-test-235426778039.asia-northeast1.run.app
- 環境変数:
  - PORT: 5000/8080（Dockerfileによって異なる）
  - NODE_ENV: production
  - API_HOST: appgenius-portal-test-235426778039.asia-northeast1.run.app
  - CORS_ORIGIN: 複数のフロントエンドドメインを許可

## 環境間の差異対策
- フロントエンド：vercel.jsonを使用してバックエンドAPIへの接続設定
- バックエンド：CORSを適切に設定し、複数のフロントエンドドメインからのアクセスを許可
- 開発環境とテスト環境の区別：環境変数とAPIホスト設定