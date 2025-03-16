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

**VSCode Marketplaceへの公開（詳細手順）**:

### 拡張機能の公開と更新の詳細手順

#### 1. 公開準備

1. **package.jsonの確認と更新**:
   以下のフィールドが正しく設定されていることを確認:
   ```json
   {
     "name": "appgenius-ai",              // 一意の識別子
     "displayName": "AppGenius AI",        // マーケットプレイスでの表示名
     "description": "AI駆動の完全自動開発環境をVSCodeで提供",  // 説明文
     "version": "1.0.0",                  // セマンティックバージョニング
     "publisher": "mikoto",               // パブリッシャーID（重要）
     "repository": {                       // GitHubリポジトリ情報
       "type": "git",
       "url": "https://github.com/yamatovision/GeniusAPP.git"
     },
     "license": "MIT",                    // ライセンス情報
     "categories": [                       // カテゴリ（検索で使用）
       "Other", 
       "AI", 
       "Programming Languages"
     ],
     "activationEvents": [                 // 最適化されたアクティベーション
       "onStartupFinished",
       "onCommand:appgenius.claudeCode.launchFromUrl",
       // その他の必要なイベント
     ]
   }
   ```

2. **必要なファイルの準備**:
   - **README.md**: マーケットプレイスに表示される詳細情報
     - 機能の説明
     - インストール方法
     - 使用方法
     - スクリーンショット
     - カスタマイズオプション
   
   - **CHANGELOG.md**: リリースノート - 各バージョンで何が変わったかを記録
     ```markdown
     # Change Log

     ## [1.0.0] - 2025-03-16

     ### 追加
     - 要件定義モード：AIとの自然な対話を通じて要件をヒアリングし、構造化
     - モックアップ生成：HTML/CSSの自動生成とブラウザでの自動プレビュー
     - 実装モード：プロジェクト分析、コード生成・修正、テストコード生成、Git操作をサポート
     - その他の機能項目...

     ### 変更
     - 初回リリースのため変更はありません

     ### 修正
     - 初回リリースのため修正はありません
     ```

   - **LICENSE**: ライセンスファイル（MIT推奨）
   
   - **.vscodeignore**: パッケージサイズ削減のための除外リスト
     ```
     .vscode/**
     .vscode-test/**
     out/test/**
     src/**
     .gitignore
     node_modules/**
     logs/**
     test/**
     portal/**
     AI/**
     参考/**
     .env
     *.vsix
     # その他不要なファイル
     ```

3. **アイコンの追加**（オプション）:
   - 128x128ピクセルのアイコンを用意
   - package.jsonに追加:
     ```json
     "icon": "media/icon.png",
     ```

#### 2. Microsoft/Azure アカウントとパブリッシャー設定

1. **Microsoftアカウントでサインイン**:
   - Microsoftアカウントがない場合は[作成](https://account.microsoft.com/)

2. **Azure DevOps組織の作成**:
   - [Azure DevOps](https://dev.azure.com/)にアクセス
   - 新しい組織を作成（例：「mikotovscode」）
   - 新しいプロジェクトを作成（例：「VSCodeExtensions」）

3. **Personal Access Token (PAT) の生成**:
   - Azure DevOpsの右上のユーザーアイコンをクリック
   - 「Personal access tokens」を選択
   - 「+ New Token」をクリック
   - 名前: VSCode Extension Publishing
   - 組織: 「All accessible organizations」を選択
   - 有効期間: 180日（またはより長く）
   - スコープ: 「Full access」または「Marketplace > Manage」
   - 「Create」をクリック
   - **重要**: 表示されたトークンをメモ帳などに保存（一度しか表示されません）
   ```
   // 例（実際のトークンは異なります）:
   F4LrNfpoyecqo2Xy9RPwWKxhZPkHUPAJAzXorsiYpzGqC0EUXyuLJQQJ99BCACAAAAAAAAAAAA
   ```

4. **Visual Studio Marketplaceパブリッシャーの作成**:
   - [VS Marketplace Publisher](https://marketplace.visualstudio.com/manage)にアクセス
   - 「Create Publisher」ボタンをクリック
   - Publisher ID: mikoto（一意のID、公開後は変更不可）
   - Display Name: Mikoto Inc.（表示名）
   - 他の情報を入力
   - 「Create」をクリック

#### 3. 公開ツールのセットアップとパッケージング

1. **VSCEツールのインストール**:
   ```bash
   npm install -g @vscode/vsce
   ```

2. **拡張機能のビルド**:
   ```bash
   cd /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius
   npm install        # 依存関係を更新
   npm run compile    # TypeScriptをコンパイル
   ```

3. **パッケージング（公開前の確認用）**:
   ```bash
   vsce package
   ```
   - 生成された.vsixファイルのサイズを確認（1MB以下が理想的）
   - VSCodeでインストールしてテスト

#### 4. 拡張機能の公開

1. **PATを使用して公開**（最も簡単な方法）:
   ```bash
   vsce publish -p <your-personal-access-token>
   ```
   例:
   ```bash
   vsce publish -p F4LrNfpoyecqo2Xy9RPwWKxhZPkHUPAJAzXorsiYpzGqC0EUXyuLJQQJ99BCACAAAAAAAAAAAA
   ```

2. **または、ログインしてから公開**:
   ```bash
   vsce login mikoto
   # プロンプトでPATを入力
   vsce publish
   ```

3. **特定のバージョンタイプで公開**（オプション）:
   ```bash
   vsce publish [major|minor|patch]
   ```
   - `major`: 1.0.0 → 2.0.0（互換性のない変更）
   - `minor`: 1.0.0 → 1.1.0（後方互換性のある機能追加）
   - `patch`: 1.0.0 → 1.0.1（バグ修正）

4. **公開確認**:
   - 表示されたURL（例: https://marketplace.visualstudio.com/items?itemName=mikoto.appgenius-ai）にアクセス
   - 注: 反映まで数分から1時間かかることがあります

#### 5. 拡張機能の更新手順

1. **コード変更と準備**:
   - 機能の追加・修正
   - テストの実施

2. **バージョン番号の更新**:
   - package.jsonのversionフィールドを更新
     ```json
     "version": "1.0.1", // 元は "1.0.0"
     ```

3. **CHANGELOGの更新**:
   ```markdown
   ## [1.0.1] - 2025-03-20

   ### 追加
   - 新機能Aを追加
   - 新機能Bを追加

   ### 変更
   - 機能Cの動作を改善

   ### 修正
   - バグDを修正
   ```

4. **ビルドと公開**:
   ```bash
   npm run compile
   vsce publish -p <your-personal-access-token>
   ```

#### 6. 拡張機能の公開・管理のベストプラクティス

1. **トークン管理**:
   - PATは安全な場所に保存する
   - 有効期限が切れる前に更新する
   - 組織のセキュリティポリシーに従って管理する

2. **安全なPAT使用**:
   - 公開リポジトリにPATを保存しない
   - CI/CDで使用する場合は環境変数として設定

3. **更新頻度**:
   - 重大なバグ修正: すぐに公開（patch更新）
   - 小さな機能追加: 定期的に公開（minor更新）
   - 大きな変更: 計画的にリリース（major更新）

4. **パッケージサイズの最適化**:
   - .vscodeignoreを適切に設定
   - 不要なファイルや依存関係を削除
   - ビルド前にnpm pruneを実行

5. **拡張機能のプライベート公開**（組織内のみ）:
   ```bash
   vsce package
   # 生成された.vsixファイルを組織内で共有
   ```

6. **アンインストール/削除**（必要な場合）:
   - Marketplaceの管理ページから拡張機能を非公開にできます

#### 7. トラブルシューティング

- **認証エラー（401 Unauthorized）**:
  - PATが有効か確認
  - 正しいパブリッシャー名を使用しているか確認
  - PATに適切な権限（Marketplace > Manage）があるか確認

- **公開エラー（403 Forbidden）**:
  - 組織の権限を確認
  - 「All accessible organizations」のスコープでPATを再生成

- **パッケージサイズエラー**:
  - .vscodeignoreを更新して不要なファイルを除外
  - 大きなバイナリファイルやデータを削除

- **公開後にマーケットプレイスで見つからない**:
  - 反映には時間がかかる（最大1時間）
  - URLが正しいか確認

- **既存バージョンと同じバージョン番号で公開できない**:
  - package.jsonのversionを更新
  - CHANGELOG.mdも更新

- **最新バージョンが反映されない**:
  - VSCodeのキャッシュをクリア（VSCode再起動）
  - 拡張機能を手動で更新

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

## 6. デプロイ前の検証手順

### コミット前チェック

コードをコミット・プッシュする前に以下の検証を行うことで、デプロイエラーを未然に防ぐことができます：

1. **ESLintによる構文チェック**:
   ```bash
   # フロントエンドのJavaScript/JSXファイルのチェック
   cd portal/frontend
   npx eslint src/**/*.js src/**/*.jsx --no-ignore
   
   # バックエンドのJavaScriptファイルのチェック
   cd portal
   npx eslint backend/**/*.js --no-ignore
   ```

2. **ビルドテスト**:
   ```bash
   # フロントエンドのビルドテスト
   cd portal/frontend
   npm run build
   
   # バックエンドのビルドテスト（必要に応じて）
   cd portal
   npm run build
   ```

3. **型エラーチェック**:
   フロントエンドがTypeScriptを採用している場合や、今後TypeScriptに移行する場合：
   ```bash
   cd portal/frontend
   npx tsc --noEmit
   ```

4. **特定のファイルの構文チェック**:
   最近修正したファイルのみをチェックする場合：
   ```bash
   cd portal/frontend
   npx eslint src/components/dashboard/Dashboard.js src/services/prompt.service.js
   ```

### チェックの自動化

以下のgitフックを使用して自動化することもできます：

1. **pre-commit フック**:
   `.git/hooks/pre-commit`（または`.husky/pre-commit`）を作成して実行権限を付与：
   ```bash
   #!/bin/sh
   cd portal/frontend && npx eslint src/**/*.js src/**/*.jsx
   if [ $? -ne 0 ]; then
     echo "ESLintエラーがあります。修正してからコミットしてください。"
     exit 1
   fi
   ```

2. **husky + lint-staged の導入**:
   ```bash
   npm install --save-dev husky lint-staged
   ```
   
   `package.json`に以下を追加：
   ```json
   {
     "husky": {
       "hooks": {
         "pre-commit": "lint-staged"
       }
     },
     "lint-staged": {
       "portal/frontend/src/**/*.{js,jsx}": [
         "eslint --fix",
         "git add"
       ]
     }
   }
   ```

### 典型的なエラーと確認ポイント

以下のポイントを特に注意してチェックしましょう：

1. **構文エラー**:
   - カンマやセミコロンの誤用
   - 閉じられていない括弧やタグ
   - 無効なJSX構文

2. **安全でないプロパティアクセス**:
   - `object.property`の代わりに`object?.property`を使用
   - nullチェックとフォールバック値の追加（例: `value || defaultValue`）

3. **パッケージ依存関係**:
   - package.jsonに必要なすべての依存関係が含まれているか確認
   - バージョンの不整合がないか確認

## 7. トラブルシューティング

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