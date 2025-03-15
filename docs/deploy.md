# AppGenius デプロイ情報（2025/03/15更新）

## プロンプト管理システムのデプロイ構成

AppGeniusのプロンプト管理システムは以下の3つの主要コンポーネントから構成されています：

1. **中央プロンプト管理Webポータル** - Node.js/Expressバックエンド + Reactフロントエンド
2. **VSCode拡張機能** - TypeScriptで実装された拡張機能
3. **ClaudeCode CLI連携** - CLIとの認証・API連携

以下にそれぞれのコンポーネントのデプロイ方法を説明します。

## 1. 中央プロンプト管理Webポータル

### デプロイ環境とURL

**本番環境**
- バックエンド: https://geniemon-portal-backend-production.up.railway.app
- フロントエンド: https://geniemon.vercel.app
- データベース: MongoDB Atlas

### バックエンドデプロイ（Railway）

Railway.appはGitHubリポジトリのサブディレクトリ（portal）を自動的にデプロイできるPaaSサービスです。

#### GitHub Actionsによる自動デプロイ設定

1. **必要なファイル**
   - リポジトリルートに`.railway/railway.json`
   - `portal`ディレクトリに`railway.toml`
   - `.github/workflows/railway-deploy.yml`

2. **Railway.appの設定**
   - [Railway.app](https://railway.app/)でアカウント作成
   - 新規プロジェクト作成（「Empty Project」を選択）
   - 「Settings」→「Source Repo」でGitHubリポジトリ連携
   - リポジトリ: yamatovision/GeniusAPP
   - Root Directory: portal

3. **環境変数の設定**
   - Railway.appのプロジェクト設定で以下の環境変数を設定:
     ```
     NODE_ENV=production
     MONGODB_URI=mongodb+srv://lisence:FhpQAu5UPwjm0L1J@motherprompt-cluster.np3xp.mongodb.net/GENIEMON?retryWrites=true&w=majority&appName=MotherPrompt-Cluster
     JWT_SECRET=appgenius_jwt_secret_key_for_production
     JWT_EXPIRY=1h
     REFRESH_TOKEN_SECRET=appgenius_refresh_token_secret_key_for_production
     REFRESH_TOKEN_EXPIRY=14d
     PASSWORD_SALT_ROUNDS=10
     CORS_ORIGIN=https://geniemon.vercel.app
     CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
     ```

4. **GitHub Secrets設定**
   - GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」で以下を設定:
     - `RAILWAY_TOKEN`: Railway.appで生成したAPIトークン
     - `RAILWAY_PROJECT_ID`: プロジェクトID（URLから取得: https://railway.app/project/<project-id>）

5. **ドメイン設定**
   - Railway.appの「Settings」→「Networking」→「Generate Domain」をクリック
   - 生成されたドメインをメモ（フロントエンド設定で使用）

#### デプロイ検証
- GitHub Actionsタブでワークフローの実行を確認
- 生成されたURLにアクセスして動作確認（例: https://geniemon-portal-backend-production.up.railway.app）

### フロントエンドデプロイ（Vercel）

1. **Vercelアカウント設定**
   - [Vercel](https://vercel.com/)でアカウント作成
   - GitHubリポジトリ連携

2. **プロジェクト作成**
   - 「New Project」→「Import Git Repository」
   - リポジトリ: yamatovision/GeniusAPP
   - Frame Preset: Create React App
   - Root Directory: portal/frontend
   - 「Deploy」ボタンをクリック

3. **環境変数設定**
   - Vercelプロジェクト設定の「Environment Variables」:
     - `REACT_APP_API_URL`: Railway.appのバックエンドURL + /api（例: https://geniemon-portal-backend-production.up.railway.app/api）

4. **APIリライト設定（vercel.json）**
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://geniemon-portal-backend-production.up.railway.app/api/:path*"
       }
     ],
     "env": {
       "REACT_APP_API_URL": "https://geniemon-portal-backend-production.up.railway.app/api"
     },
     "github": {
       "enabled": true
     }
   }
   ```

5. **ドメイン設定**
   - デフォルトで生成される https://geniemon.vercel.app を使用
   - カスタムドメインが必要な場合は「Settings」→「Domains」から設定

## 2. 開発環境構築

### ローカル開発環境の起動

#### バックエンド
```bash
# portal ディレクトリに移動
cd /path/to/AppGenius/portal

# 依存関係をインストール
npm install

# .env ファイルをコピーし編集
cp .env.example .env

# 開発モードで実行
npm run dev
```

#### フロントエンド
```bash
# portal/frontend ディレクトリに移動
cd /path/to/AppGenius/portal/frontend

# 依存関係をインストール
npm install

# 開発モードで実行
npm start
```

### テストユーザーアカウント
開発・テスト環境で以下の認証情報が使用できます:
- メールアドレス: lisence@mikoto.co.jp
- パスワード: Mikoto@123

## 3. VSCode拡張機能

### パッケージング・公開

**開発版使用（非公開）**:
1. プロジェクトをビルド:
   ```bash
   npm install
   npm run compile
   ```

2. VSIX形式でパッケージング:
   ```bash
   npm run package
   ```

3. 生成された.vsixファイルをVSCodeにインストール:
   - VSCodeで`Extensions` > `...` > `Install from VSIX...`
   - 生成された.vsixファイルを選択

**VSCode Marketplaceへの公開**:
1. [Visual Studio Code Publisher](https://marketplace.visualstudio.com/manage)でパブリッシャーアカウントを作成
2. パブリッシャーIDを取得
3. `package.json`の`publisher`フィールドを更新
4. トークンを取得し、`vsce`をインストール:
   ```bash
   npm install -g vsce
   vsce login [パブリッシャー名]
   ```

5. 拡張機能を公開:
   ```bash
   vsce publish
   ```

### 設定

VSCode拡張を使用するには以下の設定が必要です:

```json
{
  "appgenius.portalApiUrl": "https://geniemon-portal-backend-production.up.railway.app",
  "appgenius.clientId": "your-client-id",
  "appgenius.clientSecret": "your-client-secret",
  "appgenius.enableOfflineMode": true,
  "appgenius.promptCacheSize": 100
}
```

## 4. CI/CD パイプライン

### GitHub Actions ワークフロー

現在以下のワークフローが設定されています:

1. **Railway自動デプロイ**
   - ファイル: `.github/workflows/railway-deploy.yml`
   - トリガー: mainブランチへのportalディレクトリ関連の変更
   - 処理: Railway.appへの自動デプロイ

2. **Vercel自動デプロイ**
   - Vercelの組み込み機能で設定
   - トリガー: mainブランチへのportal/frontendディレクトリ関連の変更
   - 処理: Vercelへの自動デプロイ

### デプロイの流れ

1. GitHubのmainブランチへの変更をプッシュ
2. GitHub Actionsが自動的に実行され、Railway.appへバックエンドをデプロイ
3. Vercelが自動的にフロントエンドをデプロイ
4. デプロイ完了後、環境変数が適切に設定されていれば両者が連携して機能

## 5. 環境変数一覧

重要な環境変数の一覧です。詳細は[env.md](./env.md)を参照してください。

### バックエンド環境変数
| 変数名 | 説明 | 例 |
|--------|------|-----|
| NODE_ENV | 環境設定 | production |
| PORT | サーバーポート | 8080 |
| MONGODB_URI | MongoDB接続文字列 | mongodb+srv://... |
| JWT_SECRET | JWT署名用シークレット | appgenius_jwt_secret_key |
| JWT_EXPIRY | JWTトークン有効期限 | 1h |
| REFRESH_TOKEN_SECRET | リフレッシュトークン署名用シークレット | appgenius_refresh_token_secret |
| REFRESH_TOKEN_EXPIRY | リフレッシュトークン有効期限 | 14d |
| CORS_ORIGIN | CORSで許可するオリジン | https://geniemon.vercel.app |

### フロントエンド環境変数
| 変数名 | 説明 | 例 |
|--------|------|-----|
| REACT_APP_API_URL | バックエンドAPI URL | https://geniemon-portal-backend-production.up.railway.app/api |
| REACT_APP_VERSION | アプリバージョン | 1.0.0 |

## 6. トラブルシューティング

### デプロイ時の問題

#### Cloud Runからの移行とコンテナ問題
Cloud Runでの以下の問題により、Railway.appに移行しました:
- `Failed to load /usr/local/bin/docker-entrypoint.sh: exec format error`
- `Default STARTUP TCP probe failed for container on port 8080`

対応策:
- Railway.appはコンテナ起動の低レベル問題を自動で処理
- `cd`コマンドの使用を避ける（コンテナ環境ではサポートされない場合がある）
- Dockerfileよりも`railway.toml`で設定を行う

#### CORS関連の問題
- `Access-Control-Allow-Origin`ヘッダーが設定されていない場合、バックエンドの`cors`設定を確認
- バックエンドサーバーに以下の設定が必要:
  ```js
  app.use(cors({
    origin: ['https://geniemon.vercel.app', 'http://localhost:3000'],
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    credentials: true
  }));
  ```

#### 認証エラー
- フロントエンドとバックエンドのAPI要求/レスポンス形式の不一致
  - フロントエンド: `email`, `password`
  - バックエンド: `username`, `password`
- トークン命名の不一致
  - フロントエンド: `accessToken`
  - バックエンド: `token`

対応策:
- サーバーコードでAPIレスポンス形式を統一

#### Vercelビルドエラー
- 依存関係のエラーが出る場合（例: `Cannot find module 'yocto-queue'`）：
  - package.jsonに`engines`フィールドを追加し、Nodeバージョンを指定：
    ```json
    "engines": {
      "node": ">=16.x"
    }
    ```
  - vercel.jsonでビルドコマンドをクリーンインストールに設定：
    ```json
    "buildCommand": "npm ci && npm run build"
    ```
  - 不足しているパッケージを明示的に追加：
    ```bash
    npm install [不足パッケージ名] --save
    ```
  - キャッシュクリア：
    - Vercelのダッシュボードから「Settings」>「General」>「Build & Development Settings」>「Clear Cache and Rebuild」を実行

- Vercel環境変数に関する問題：
  - フロントエンドのビルド時に必要な環境変数はVercelダッシュボードで設定する必要がある
  - vercel.jsonの`env`セクションと重複していないか確認

## 7. モニタリングと運用

### 本番環境モニタリング
- Railway.appのダッシュボードでリアルタイムログと指標を確認
- バックエンドエラーログを`console.error`で出力（Railway.appで確認可能）

### バックアップ戦略
MongoDB Atlasで自動バックアップを設定:
1. Atlas管理コンソールにログイン
2. クラスター設定の「Backup」タブを選択
3. 「Edit Policy」から日次バックアップを有効化

### セキュリティ対策
デプロイ時に以下のセキュリティ対策を実施:
- すべての通信でHTTPSを使用
- 強力なJWTシークレットを使用（環境変数で設定）
- 適切なCORS設定
- 本番環境ではデバッグ情報を制限

## 8. 今後の改善点

### 短期的改善
- VSCode拡張のMarketplace公開準備
- セキュリティヘッダーの強化
- レート制限の実装
- エラーロギングの強化

### 長期的改善
- 自動バックアップ戦略の実装
- 脆弱性スキャンの統合
- パフォーマンスモニタリングの強化
- 障害復旧プロセスの文書化