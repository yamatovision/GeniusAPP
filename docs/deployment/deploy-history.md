# デプロイ履歴

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