# AppGenius ポータル

AppGeniusの中央プロンプト管理ウェブサイト

## デプロイ方法

このプロジェクトは2つのデプロイオプションがあります：

1. **Railway** - バックエンド (GitHub Actions で自動デプロイ)
2. **Vercel** - フロントエンド (GitHub連携で自動デプロイ)

### 前提条件
- GitHubリポジトリにコードがアップロード済み
- MongoDB Atlasアカウント（既存のURIが使用可能）
- Railwayアカウント（バックエンド用）
- Vercelアカウント（フロントエンド用）

## Railway へのバックエンドデプロイ（GitHub Actions CI/CD）

### 1. セットアップ

リポジトリには既に以下のファイルが設定されています：
- `.railway/railway.json` - Railway設定ファイル
- `portal/railway.toml` - サブディレクトリ設定
- `.github/workflows/railway-deploy.yml` - GitHub Actions設定

### 2. Railway トークン設定

1. Railwayダッシュボードで「Settings」→「Teams & Authentication」を開く
2. 「Generate new token」をクリックしてAPIトークンを生成
3. GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」を開く
4. 「New repository secret」をクリック
5. 名前: `RAILWAY_TOKEN`、値: 生成したトークンを入力して保存

### 3. Railwayプロジェクト作成

1. Railwayダッシュボードで「New Project」をクリック
2. 「Empty Project」を選択して新しいプロジェクトを作成
3. プロジェクト設定で以下の環境変数を設定:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster`
   - `JWT_SECRET`: `appgenius_jwt_secret_key_for_production`
   - `JWT_EXPIRY`: `1h`
   - `REFRESH_TOKEN_SECRET`: `appgenius_refresh_token_secret_key_for_production`
   - `REFRESH_TOKEN_EXPIRY`: `14d`
   - `PASSWORD_SALT_ROUNDS`: `10`
   - `CORS_ORIGIN`: `https://geniemon.vercel.app`
   - その他必要な環境変数

### 4. 自動デプロイの確認

1. コードを変更してGitHubのmainブランチにプッシュ
2. GitHubリポジトリの「Actions」タブでワークフローの実行を確認
3. デプロイが完了したらRailwayダッシュボードでURLを確認

## Vercelへのフロントエンドデプロイ

#### CLIを使う方法（お勧め）

1. Vercel CLIをインストール:
   ```bash
   npm i -g vercel
   ```

2. プロジェクトルートディレクトリ（portal）で認証:
   ```bash
   vercel login
   ```

3. 初回デプロイ（設定ウィザード）:
   ```bash
   vercel
   ```
   - プロジェクト名: 任意（例: geniemon-portal）
   - 既存のプロジェクトにリンク: No
   - ディレクトリ設定を確認: Yes
   - 環境変数を設定（後のステップでも変更可能）

4. 環境変数の設定:
   ```bash
   vercel env add MONGODB_URI
   ```
   - プロンプトに従って値を入力:
     - `mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster`
   
   同様に以下の環境変数も追加:
   - JWT_SECRET: appgenius_jwt_secret_key_for_production
   - JWT_EXPIRY: 1h
   - REFRESH_TOKEN_SECRET: appgenius_refresh_token_secret_key_for_production
   - REFRESH_TOKEN_EXPIRY: 14d
   - PASSWORD_SALT_ROUNDS: 10
   - CORS_ORIGIN: *

5. 本番環境へデプロイ:
   ```bash
   vercel --prod
   ```

#### Webインターフェースを使う方法

1. Vercelアカウントでログイン: https://vercel.com/
2. 「New Project」をクリック
3. GitHubリポジトリと連携
4. ルートディレクトリを`portal`に設定
5. フレームワークプリセット: Other
6. ビルド設定は自動検出される（vercel.jsonが優先される）
7. 環境変数の設定:
   - MONGODB_URI: MongoDB Atlas接続文字列
   - JWT_SECRET: appgenius_jwt_secret_key_for_production
   - JWT_EXPIRY: 1h
   - REFRESH_TOKEN_SECRET: appgenius_refresh_token_secret_key_for_production
   - REFRESH_TOKEN_EXPIRY: 14d
   - PASSWORD_SALT_ROUNDS: 10
   - CORS_ORIGIN: *

8. 「Deploy」ボタンをクリック

### 3. 本番環境設定

1. デプロイ完了後、Vercelダッシュボードから「Settings」→「Environment Variables」で環境変数を確認/修正

2. フロントエンドのAPI URLを更新:
   フロントエンドコードの`/services/auth.service.js`などで、
   ```js
   const API_URL = process.env.REACT_APP_API_URL || '/api/auth';
   ```
   のように、相対パスを使用するように修正（既に修正済み）

## 接続確認

1. Vercelでデプロイしたサイトにアクセス
2. ログイン機能を試して、バックエンドとの接続を確認
3. スムーズにデータのやり取りができることを確認

## トラブルシューティング

- **デプロイエラー**: Vercelダッシュボードの「Deployments」で詳細ログを確認
- **API接続エラー**: ブラウザのDevToolsでネットワークリクエストを確認
- **データベース接続失敗**: MongoDB Atlasの接続文字列とアクセス許可設定を確認