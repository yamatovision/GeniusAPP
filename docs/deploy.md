# デプロイ情報

このファイルは環境ごとのデプロイ設定と手順を管理します。

## 環境別設定

### ローカル開発環境

- **環境変数設定方法**: `.env.local`ファイルに保存
- **必須環境変数**:
  - `DATABASE_URL` = "postgres://postgres:password@localhost:5432/mydatabase"
  - `PORT` = "3000"
  - `NODE_ENV` = "development"
  - `NEXT_PUBLIC_API_URL` = "http://localhost:3000/api"

- **起動コマンド**:
  ```bash
  npm run dev
  ```

### 開発環境 (Development)

- **環境変数設定方法**: Vercel/Netlifyプロジェクト設定またはCI/CD設定
- **必須環境変数**:
  - `DATABASE_URL` = 開発用DBの接続文字列
  - `NODE_ENV` = "development"
  - `NEXT_PUBLIC_API_URL` = "https://dev-api.example.com"

- **デプロイトリガー**: `develop`ブランチへのプッシュ
- **デプロイコマンド**:
  ```bash
  npm run build
  ```

### ステージング環境 (Staging)

- **環境変数設定方法**: Vercel/Netlifyプロジェクト設定またはCI/CD設定
- **必須環境変数**:
  - `DATABASE_URL` = ステージング用DBの接続文字列
  - `NODE_ENV` = "production"
  - `NEXT_PUBLIC_API_URL` = "https://staging-api.example.com"

- **デプロイトリガー**: `staging`ブランチへのプッシュ
- **デプロイコマンド**:
  ```bash
  npm run build
  ```

### 本番環境 (Production)

- **環境変数設定方法**: Vercel/Netlifyプロジェクト設定またはCI/CD設定
- **必須環境変数**:
  - `DATABASE_URL` = 本番用DBの接続文字列
  - `NODE_ENV` = "production"
  - `NEXT_PUBLIC_API_URL` = "https://api.example.com"

- **デプロイトリガー**: `main`ブランチへのプッシュまたはリリースタグ
- **デプロイコマンド**:
  ```bash
  npm run build
  ```

## デプロイ手順

1. 必要なファイルの変更を`git commit`でコミット
2. 適切なブランチ（`develop`, `staging`, `main`）に`git push`
3. CI/CDパイプラインが自動的にビルドとデプロイを実行
4. デプロイステータスを確認
5. デプロイ完了後、アプリケーションの動作確認

## 環境変数の追加方法

1. `env.md`に新しい環境変数を追加
2. 各環境の設定に環境変数を追加
3. 必要に応じてCI/CD設定を更新
4. プロジェクトメンバーに変更を通知

## データベースマイグレーション

本番環境へのデプロイ前に以下のマイグレーション手順を実行:

```bash
# マイグレーション実行コマンドの例（実際のコマンドに置き換え）
npx prisma migrate deploy
```

## ロールバック手順

問題が発生した場合のロールバック手順:

1. 前回の正常なコミットへの再デプロイを実行
2. 必要に応じてデータベースのロールバックを実行
3. 問題の分析と修正

## セキュリティ注意事項

- 本番環境の秘密鍵やアクセストークンはソースコードリポジトリには保存しない
- デプロイ環境の環境変数設定UI上でのみ設定する
- 認証情報はプロジェクト管理者のみがアクセス可能な場所に保管