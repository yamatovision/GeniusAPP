# デプロイ情報

## プロンプト管理システムのデプロイ構成

AppGeniusのプロンプト管理システムは以下の3つの主要コンポーネントから構成されています：

1. **中央プロンプト管理Webポータル** - Node.js/Expressバックエンド + Reactフロントエンド
2. **VSCode拡張機能** - TypeScriptで実装された拡張機能
3. **ClaudeCode CLI連携** - CLIとの認証・API連携

以下にそれぞれのコンポーネントのデプロイ方法を説明します。

## 1. 中央プロンプト管理Webポータル

### デプロイオプション

**Option A: クラウドサービス（推奨）**
- [Vercel](https://vercel.com/) - フロントエンド
- [Cloud Run](https://cloud.google.com/run) または [Railway](https://railway.app/) または [Render](https://render.com/) - バックエンド
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - データベース

**Option B: セルフホスティング**
- VPS（DigitalOcean, AWS EC2, など）- フロントエンド・バックエンド
- MongoDB Community Edition - データベース

### デプロイ手順（Vercel + Cloud Run + MongoDB Atlas）

#### MongoDB Atlas セットアップ
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)でアカウント作成
2. 新規クラスターを作成
3. ネットワークアクセスをWhitelistに追加（Railway/Vercelからのアクセスを許可）
4. データベースユーザーを作成
5. 接続文字列を取得（`DB_URI`として保存）

#### バックエンド（Cloud Run）
1. [Google Cloud](https://cloud.google.com/)でアカウント作成
2. 新規プロジェクト作成
3. Cloud Run APIとContainer Registryを有効化
4. Dockerfileをプロジェクトのportalディレクトリに作成:
   ```dockerfile
   FROM node:16-alpine
   
   WORKDIR /app
   
   # 依存パッケージのコピーとインストール
   COPY package*.json ./
   RUN npm install
   
   # アプリケーションのコピー
   COPY . .
   
   # ポートの公開
   EXPOSE 8080
   
   # 環境変数の設定
   ENV PORT=8080
   ENV NODE_ENV=production
   
   # アプリケーションの起動
   CMD ["node", "server.js"]
   ```

5. .dockerignoreファイルの作成:
   ```
   node_modules
   npm-debug.log
   frontend/
   .env
   .git
   *.md
   ```

6. Google Cloud SDKをインストールしてログイン:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

7. イメージをビルドしてデプロイ:
   ```bash
   # イメージビルド
   docker build -t gcr.io/YOUR_PROJECT_ID/appgenius-portal-backend .
   
   # GCRにプッシュ
   docker push gcr.io/YOUR_PROJECT_ID/appgenius-portal-backend
   
   # Cloud Runにデプロイ
   gcloud run deploy appgenius-portal-backend \
     --image gcr.io/YOUR_PROJECT_ID/appgenius-portal-backend \
     --platform managed \
     --region asia-northeast1 \
     --allow-unauthenticated \
     --memory 512Mi \
     --set-env-vars="MONGODB_URI=YOUR_MONGODB_URI,JWT_SECRET=YOUR_JWT_SECRET,CORS_ORIGIN=YOUR_VERCEL_URL"
   ```

8. 発行されたURLを取得（`API_URL`として保存）

#### フロントエンド（Vercel）
1. [Vercel](https://vercel.com/)でアカウント作成
2. 新規プロジェクト作成
3. GitHubリポジトリと連携
4. プロジェクト設定:
   - Framework Preset: "Create React App"
   - Root Directory: `portal/frontend`
   - Build Command: `npm install && npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`

5. 環境変数の設定:
   - `REACT_APP_API_URL` - Cloud RunのバックエンドURLを設定（例: https://appgenius-portal-backend-xxxxx.a.run.app/api）
   - `REACT_APP_VERSION` - アプリケーションバージョン

6. デプロイを実行
7. 発行されたURLを取得（プロンプト管理システムのアクセスURL）
8. Cloud Runバックエンドの環境変数`CORS_ORIGIN`にVercelのURLを設定して再デプロイ

### セルフホスティング手順

#### 前提条件
- Node.js 14.x以上
- MongoDB 4.4以上
- nginx（推奨）

#### バックエンド
1. ソースコードをサーバーにクローン
2. 環境変数の設定:
   ```bash
   cd portal/backend
   cp .env.example .env
   # .envファイルを編集して必要な値を設定
   ```

3. 依存関係のインストールとビルド:
   ```bash
   npm install
   npm run build
   ```

4. PM2でプロセス管理（推奨）:
   ```bash
   npm install -g pm2
   pm2 start server.js --name prompt-portal-api
   pm2 save
   pm2 startup
   ```

#### フロントエンド
1. 依存関係のインストールとビルド:
   ```bash
   cd portal/frontend
   npm install
   REACT_APP_API_URL=http://your-api-url npm run build
   ```

2. nginxでファイル配信:
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     root /path/to/portal/frontend/build;
     index index.html;
     
     location / {
       try_files $uri $uri/ /index.html;
     }
     
     location /api {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

3. nginxを再起動:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 2. VSCode拡張機能

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
  "appgenius.portalApiUrl": "https://your-portal-api.com",
  "appgenius.clientId": "your-client-id",
  "appgenius.clientSecret": "your-client-secret",
  "appgenius.enableOfflineMode": true,
  "appgenius.promptCacheSize": 100
}
```

これらの設定はVSCodeの設定UIから行うか、`.vscode/settings.json`に直接追加できます。

## 3. ClaudeCode CLI連携

### 前提条件
- ClaudeCode CLIが既にインストールされていること
- VSCode拡張機能が正しく設定されていること

### 設定
ClaudeCode CLIとの連携では、以下の設定が必要です:

1. VSCode拡張の設定で`appgenius.claudeIntegrationEnabled`を`true`に設定
2. VSCode拡張の設定で`appgenius.claudeCodePath`にClaudeCode CLIの実行可能ファイルへのパスを設定

### トークン同期
VSCode拡張が取得した認証トークンはOS固有のセキュアストレージに保存され、ClaudeCode CLIはそれを読み取ります:

- Windows: Windowsの資格情報マネージャー
- macOS: Keychain
- Linux: libsecretを使用

認証トークンは自動的に同期されますが、問題がある場合は以下を実行します:

```bash
# トークン同期を手動で実行
claude auth sync-vscode
```

## 環境変数一覧

各デプロイ環境で必要な環境変数の完全なリストは[env.md](./env.md)を参照してください。

## デプロイチェックリスト

### バックエンド
- [ ] MongoDB接続確認
- [ ] 認証機能の動作確認
- [ ] CORS設定の確認
- [ ] エンドポイントのセキュリティ確認
- [ ] パフォーマンステスト
- [ ] エラーログ設定

### フロントエンド
- [ ] APIエンドポイントの設定確認
- [ ] ビルド最適化の確認
- [ ] レスポンシブデザインの確認
- [ ] ブラウザ互換性確認

### VSCode拡張
- [ ] パッケージングの確認
- [ ] ポータル接続の確認
- [ ] ClaudeCode連携の確認
- [ ] オフラインモードの確認

## トラブルシューティング

### バックエンド接続問題
- CORS設定を確認
- ファイアウォール設定を確認
- MongoDB接続文字列の正確性を確認

### 認証エラー
- JWTシークレットが正しく設定されているか確認
- トークン有効期限設定を確認
- リフレッシュトークンのローテーションを確認

### VSCode拡張の問題
- 拡張設定の確認
- セキュアストレージへのアクセス権を確認
- ログファイルを確認（`~/.vscode/extensions/appgenius-*/logs/`）

## リソース監視

デプロイ後のシステムパフォーマンスを監視するために、以下のメトリクスを追跡することを推奨します:

- API応答時間
- データベースクエリパフォーマンス
- メモリ使用量
- CPU使用率
- エラー率
- アクティブユーザー数
- 同時接続数

Cloud Providerの組み込みモニタリングツールやNew RelicやDatadogなどのサードパーティツールを活用できます。

## バックアップ戦略

データ損失を防ぐために以下のバックアップ戦略を実装することを推奨します:

- データベースの日次バックアップ
- 重要な設定ファイルのバックアップ
- 環境変数の安全な保存
- GitHub ActionsやCircle CIなどを使用した自動バックアップ

## セキュリティ対策

デプロイ時に以下のセキュリティ対策を実施してください:

- すべての通信でHTTPSを使用
- 強力なJWTシークレットを使用（ランダム生成）
- 適切なCORS設定
- レート制限の実装
- 入力検証の徹底
- 定期的なセキュリティアップデート