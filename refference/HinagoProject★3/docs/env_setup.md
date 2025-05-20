# HinagoProject 環境変数・アカウント設定ガイド

**バージョン**: 1.0.0  
**作成日**: 2025-05-17  
**ステータス**: ドラフト  

## 1. 概要

本ドキュメントはHinagoProject（ボリュームチェックシステム）の開発・デプロイに必要な環境変数とアカウント設定をまとめたものです。プロジェクトを正常に動作させるためには、以下に記載された環境変数の設定と外部サービスアカウントの準備が必要です。

## 2. 環境変数一覧

### 2.1 すぐに設定可能なもの（開発環境の固定値）

#### バックエンド基本設定
| 環境変数名 | 説明 | デフォルト値 | 必須 |
|-----------|------|------------|------|
| `NODE_ENV` | 実行環境（development/production/test） | development | ✅ |
| `PORT` | バックエンドサーバーのポート番号 | 5000 | ✅ |
| `FRONTEND_URL` | フロントエンドのURL（CORS設定用） | http://localhost:3000 | ✅ |
| `API_PREFIX` | APIのパスプレフィックス | /api | ✅ |
| `LOG_LEVEL` | ログレベル（debug/info/warn/error） | debug | ✅ |

#### 認証関連
| 環境変数名 | 説明 | デフォルト値 | 必須 |
|-----------|------|------------|------|
| `ACCESS_TOKEN_EXPIRY` | アクセストークンの有効期間（秒） | 900 | ✅ |
| `REFRESH_TOKEN_EXPIRY` | リフレッシュトークンの有効期間（秒） | 604800 | ✅ |
| `REFRESH_TOKEN_EXPIRY_REMEMBER` | 「ログイン状態を保持」時のリフレッシュトークン有効期間（秒） | 2592000 | ✅ |
| `PASSWORD_SALT_ROUNDS` | パスワードハッシュ化のソルトラウンド | 12 | ✅ |

#### ファイルアップロード設定
| 環境変数名 | 説明 | デフォルト値 | 必須 |
|-----------|------|------------|------|
| `MAX_FILE_SIZE` | アップロード可能な最大ファイルサイズ（バイト） | 10485760 | ✅ |
| `ALLOWED_FILE_TYPES` | アップロード可能なファイル形式 | image/jpeg,image/png,application/pdf,application/dxf,application/dwg | ✅ |
| `UPLOAD_TEMP_DIR` | 一時アップロードディレクトリ | /tmp/uploads | ✅ |

### 2.2 ユーザーから値を取得する必要があるもの

#### データベース接続
| 環境変数名 | 説明 | 例 | 必須 |
|-----------|------|-----|------|
| `MONGODB_URI` | MongoDB接続URI | mongodb+srv://username:password@cluster0.mongodb.net/hinago | ✅ |
| `MONGODB_DB_NAME` | 使用するデータベース名 | hinago | ✅ |
| `MONGODB_USER` | MongoDB接続ユーザー名 | hinago_app | ✅ |
| `MONGODB_PASSWORD` | MongoDB接続パスワード | [秘密] | ✅ |

#### セキュリティ
| 環境変数名 | 説明 | 例 | 必須 |
|-----------|------|-----|------|
| `JWT_SECRET` | JWT署名用シークレットキー | [ランダム生成された文字列] | ✅ |
| `COOKIE_SECRET` | クッキー署名用シークレットキー | [ランダム生成された文字列] | ✅ |
| `CRYPTO_SECRET` | 機密データ暗号化用キー | [ランダム生成された文字列] | ✅ |

#### ファイルストレージ（AWS S3）
| 環境変数名 | 説明 | 例 | 必須 |
|-----------|------|-----|------|
| `AWS_REGION` | AWSリージョン | ap-northeast-1 | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS認証用アクセスキーID | AKIAIOSFODNN7EXAMPLE | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS認証用シークレットキー | [秘密] | ✅ |
| `AWS_S3_BUCKET` | ファイル保存用S3バケット名 | hinago-files | ✅ |
| `AWS_S3_URL` | S3バケットURL | https://hinago-files.s3.ap-northeast-1.amazonaws.com | ✅ |

#### メール送信（AWS SES）
| 環境変数名 | 説明 | 例 | 必須 |
|-----------|------|-----|------|
| `MAIL_FROM` | 送信元メールアドレス | noreply@example.com | ✅ |
| `MAIL_FROM_NAME` | 送信者名 | Hinago System | ✅ |
| `AWS_SES_REGION` | AWS SESリージョン | ap-northeast-1 | ✅ |

#### 地図・位置情報サービス
| 環境変数名 | 説明 | 例 | 必須 |
|-----------|------|-----|------|
| `GEOCODING_API_KEY` | ジオコーディングAPI用キー | [APIプロバイダによる] | ✅ |
| `GEOCODING_PROVIDER` | ジオコーディングプロバイダ | google | ✅ |

#### 3Dモデル生成・表示
| 環境変数名 | 説明 | 例 | 必須 |
|-----------|------|-----|------|
| `MODEL_STORAGE_PATH` | 3Dモデル保存パス（S3内） | models/ | ✅ |
| `MODEL_CACHE_EXPIRY` | 3Dモデルキャッシュ期間（秒） | 86400 | ❌ |

### 2.3 環境別設定サンプル

#### 開発環境 (.env.development)
```
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
API_PREFIX=/api
LOG_LEVEL=debug

MONGODB_URI=mongodb://localhost:27017/hinago_dev
MONGODB_DB_NAME=hinago_dev

JWT_SECRET=dev_jwt_secret_key
COOKIE_SECRET=dev_cookie_secret_key
CRYPTO_SECRET=dev_crypto_secret_key

ACCESS_TOKEN_EXPIRY=900
REFRESH_TOKEN_EXPIRY=604800
REFRESH_TOKEN_EXPIRY_REMEMBER=2592000
PASSWORD_SALT_ROUNDS=12

MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf,application/dxf,application/dwg
UPLOAD_TEMP_DIR=/tmp/uploads

# 開発環境では以下はモックサービスまたはローカルストレージを使用
AWS_S3_BUCKET=
AWS_S3_URL=
GEOCODING_API_KEY=
```

#### 本番環境 (.env.production)
```
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://app.hinago-project.com
API_PREFIX=/api
LOG_LEVEL=info

MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/hinago_prod
MONGODB_DB_NAME=hinago_prod

JWT_SECRET=[ランダム生成された値]
COOKIE_SECRET=[ランダム生成された値]
CRYPTO_SECRET=[ランダム生成された値]

ACCESS_TOKEN_EXPIRY=900
REFRESH_TOKEN_EXPIRY=604800
REFRESH_TOKEN_EXPIRY_REMEMBER=2592000
PASSWORD_SALT_ROUNDS=12

MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf,application/dxf,application/dwg
UPLOAD_TEMP_DIR=/tmp/uploads

AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=[アクセスキー]
AWS_SECRET_ACCESS_KEY=[シークレットキー]
AWS_S3_BUCKET=hinago-files-prod
AWS_S3_URL=https://hinago-files-prod.s3.ap-northeast-1.amazonaws.com

MAIL_FROM=noreply@hinago-project.com
MAIL_FROM_NAME=Hinago System
AWS_SES_REGION=ap-northeast-1

GEOCODING_API_KEY=[APIキー]
GEOCODING_PROVIDER=google

MODEL_STORAGE_PATH=models/
MODEL_CACHE_EXPIRY=86400
```

## 3. 外部サービスアカウント

### 3.1 必須アカウント

#### MongoDB Atlas
* **用途**: データベースホスティング
* **必要なアカウントタイプ**: チーム/組織アカウント
* **必要なプラン**: 
  * 開発/テスト環境: Free Tier (M0 Sandbox) または共有インスタンス (M2/M5)
  * 本番環境: 専用インスタンス (M10以上)
* **主な設定項目**:
  * クラスター作成（リージョン: 東京）
  * データベースユーザー作成
  * ネットワークアクセス設定（IP許可リスト）
  * 接続文字列の取得
* **アカウント開設手順**:
  1. [MongoDB Atlasサイト](https://www.mongodb.com/cloud/atlas)にアクセス
  2. ユーザー登録（メール/パスワード、またはSSOで認証）
  3. 組織とプロジェクト作成
  4. クラスター作成
  5. セキュリティ設定（ネットワークアクセス制御、ユーザー作成）

#### AWS（Amazon Web Services）
* **用途**: ファイルストレージ(S3)、メール送信(SES)、インフラストラクチャ
* **必要なアカウントタイプ**: AWS標準アカウント
* **必要なサービス**:
  * Amazon S3 - ファイルストレージ
  * Amazon SES - メール送信
  * （本番デプロイ時） Amazon ECS/Fargate - コンテナホスティング
  * （本番デプロイ時） Amazon CloudFront - CDN
* **主な設定項目**:
  * S3バケット作成（パブリックアクセス設定、CORS設定）
  * IAMユーザー作成（APIアクセス用）
  * SESの設定（メール送信ドメイン確認）
  * 必要に応じてCloudFront分散設定
* **アカウント開設手順**:
  1. [AWSサイト](https://aws.amazon.com/)にアクセス
  2. 新規アカウント作成（クレジットカード情報必要）
  3. ルートユーザーセキュリティ強化（MFA設定推奨）
  4. IAMユーザー作成（APIアクセス用）
  5. 必要なサービスの有効化と設定

### 3.2 オプションアカウント

#### Google Cloud Platform（マップ・位置情報サービス用）
* **用途**: ジオコーディング、マップ表示
* **必要なサービス**: 
  * Google Maps JavaScript API
  * Google Maps Geocoding API
* **主な設定項目**:
  * プロジェクト作成
  * APIキー発行（アプリケーション制限と使用制限設定）
  * 課金アカウント設定（APIクォータ確保）
* **アカウント開設手順**:
  1. [Google Cloud Platform](https://cloud.google.com/)にアクセス
  2. Googleアカウントでログイン、またはアカウント作成
  3. プロジェクト作成
  4. 必要なAPIの有効化
  5. APIキーの発行と制限設定

#### Sentry（エラーモニタリング）
* **用途**: アプリケーションエラー監視・レポート
* **必要なプラン**: Developer（小規模開発）または Team（本番環境）
* **主な設定項目**:
  * プロジェクト作成（フロントエンド/バックエンド用）
  * DSN（クライアントキー）取得
  * 通知設定（Slack/EmailなどのIncoming Webhook設定）
* **アカウント開設手順**:
  1. [Sentryサイト](https://sentry.io/)にアクセス
  2. アカウント作成（メール、または GitHub/Google認証）
  3. 組織作成
  4. プロジェクト作成（JS/Node.js）
  5. DSN取得と統合設定

#### DataDog（本番環境向けモニタリング）
* **用途**: インフラストラクチャ・アプリケーションモニタリング
* **必要なプラン**: Pro（本番環境）
* **主な設定項目**:
  * エージェントインストール
  * API/APMキー取得
  * ダッシュボード・アラート設定
* **アカウント開設手順**:
  1. [DataDogサイト](https://www.datadoghq.com/)にアクセス
  2. アカウント作成
  3. 組織設定
  4. APIキー取得
  5. インテグレーション設定

## 4. デプロイ環境

### 4.1 推奨デプロイ環境

#### フロントエンド

| サービス | 説明 | 推奨度 | コスト目安 |
|---------|------|-------|----------|
| **AWS Amplify** | フロントエンド特化のホスティングサービス。GitHubと連携しCI/CDパイプラインを自動構築 | ★★★★★ | 低～中 |
| **AWS S3 + CloudFront** | 静的サイトホスティングとCDNの組み合わせ。高パフォーマンスと低コスト | ★★★★☆ | 低 |
| **Vercel** | Reactアプリケーション向けの最適化されたホスティング。簡単なデプロイと優れたパフォーマンス | ★★★★☆ | 無料～中 |
| **Netlify** | 静的サイトホスティングとサーバーレス機能。簡単なデプロイフロー | ★★★☆☆ | 無料～中 |

#### バックエンド

| サービス | 説明 | 推奨度 | コスト目安 |
|---------|------|-------|----------|
| **AWS ECS Fargate** | サーバーレスコンテナオーケストレーション。インフラ管理不要でDockerコンテナを実行 | ★★★★★ | 中 |
| **AWS Elastic Beanstalk** | PaaSサービス。アプリケーションコードをアップロードするだけでインフラを自動管理 | ★★★★☆ | 中 |
| **AWS EC2 + Auto Scaling** | 仮想サーバーとオートスケーリング。より細かい制御が必要な場合 | ★★★☆☆ | 中～高 |
| **Heroku** | 最も簡単に始められるPaaS。開発環境に適しているが、コストが高め | ★★★☆☆ | 中～高 |
| **GCP Cloud Run** | サーバーレスコンテナ実行環境。AWS ECS Fargateに類似 | ★★★☆☆ | 中 |

#### データベース

| サービス | 説明 | 推奨度 | コスト目安 |
|---------|------|-------|----------|
| **MongoDB Atlas** | マネージドMongoDBサービス。スケーラブルで高可用性 | ★★★★★ | 無料～高 |
| **AWS DocumentDB** | MongDBと互換性のあるAWSのドキュメントデータベース | ★★★☆☆ | 中～高 |
| **Cosmos DB (Azure)** | マイクロソフトのマルチモデルデータベース。MongoDB APIをサポート | ★★★☆☆ | 中～高 |

### 4.2 デプロイに必要な情報

#### ドメイン設定
* **カスタムドメイン**: 本番環境ではapp.hinago-project.comなどのカスタムドメインを推奨
* **サブドメイン**:
  * `app.` - メインアプリケーション
  * `api.` - APIエンドポイント（オプション）
  * `static.` - 静的アセット（オプション）
* **DNSレコード**:
  * フロントエンド向けAレコードまたはCNAMEレコード
  * APIサーバー向けAレコードまたはCNAMEレコード
  * 必要に応じてTXTレコード（メール送信認証用）

#### CORS設定
* **許可オリジン**: フロントエンドドメイン（例: https://app.hinago-project.com）
* **許可メソッド**: GET, POST, PUT, PATCH, DELETE, OPTIONS
* **許可ヘッダー**: Content-Type, Authorization, X-Requested-With, Accept
* **クレデンシャル**: true（Cookie認証のため）
* **最大有効期間**: 86400秒（24時間）

#### セキュリティ設定
* **HTTPSの強制**: すべての環境で必須
* **セキュリティヘッダー**:
  * Content-Security-Policy
  * X-Content-Type-Options
  * X-Frame-Options
  * X-XSS-Protection
* **Cookieセキュリティ**:
  * Secure属性: true
  * HttpOnly属性: true（JWTトークン用）
  * SameSite属性: Lax

#### CI/CD設定
* **ビルドパイプライン**:
  * フロントエンド: npm build + 静的アセット最適化
  * バックエンド: Dockerコンテナビルド
* **テスト自動化**:
  * ユニットテスト
  * 統合テスト
  * E2Eテスト（本番デプロイ前）
* **自動デプロイトリガー**:
  * 開発環境: 開発ブランチへのコミット時
  * ステージング環境: releaseブランチへのマージ時
  * 本番環境: mainブランチへのマージ＋手動承認後

## 5. 環境構築手順

### 5.1 ローカル開発環境セットアップ

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/your-org/hinago-project.git
   cd hinago-project
   ```

2. **環境変数ファイルの作成**
   ```bash
   cp .env.example .env.development.local
   # 必要な環境変数を編集
   ```

3. **MongoDB起動（Docker使用）**
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

4. **依存パッケージのインストール**
   ```bash
   npm install
   ```

5. **開発サーバー起動**
   ```bash
   # バックエンド
   cd backend
   npm run dev
   
   # フロントエンド（別ターミナルで）
   cd frontend
   npm run dev
   ```

### 5.2 外部サービス統合設定

#### MongoDB Atlas接続設定
1. クラスター作成
2. データベースユーザー作成（読み書き権限）
3. IPアクセス制限設定（開発環境IPを追加）
4. 接続文字列を`.env`ファイルに設定

#### AWS S3設定
1. S3バケット作成
2. 公開アクセス設定（必要に応じて）
3. CORSポリシーを設定:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://app.hinago-project.com"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
4. IAMユーザー作成（S3アクセス権限付与）
5. アクセスキーとシークレットキーを`.env`ファイルに設定

#### JWT設定
1. 強力なランダムシークレットを生成:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. 生成したシークレットを`JWT_SECRET`環境変数に設定

### 5.3 本番環境デプロイ準備

#### フロントエンドデプロイ（AWS Amplify）
1. AWS Amplifyコンソールでアプリ作成
2. GitHubリポジトリ連携設定
3. ビルド設定:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend/build
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
4. 環境変数設定（APIエンドポイントなど）
5. カスタムドメイン設定

#### バックエンドデプロイ（AWS ECS Fargate）
1. ECRリポジトリ作成
2. Dockerイメージビルド・プッシュ
3. ECSクラスター作成
4. タスク定義作成（環境変数含む）
5. サービス作成（ロードバランサー、オートスケーリング設定）
6. セキュリティグループ設定
7. AWS Parameter Storeに機密情報を保存
8. CI/CDパイプライン設定（GitHub Actions）

## 6. セキュリティ注意事項

1. **機密情報の管理**
   * 本番環境の機密情報（APIキー、パスワード）はAWS Parameter StoreやSecrets Managerで管理
   * ソースコードにハードコードしない
   * `.env`ファイルはGitで管理しない（`.gitignore`に追加済み）

2. **認証トークン**
   * アクセストークンは短命（15分程度）に設定
   * リフレッシュトークンはHTTPOnlyクッキーで保存
   * CSRF対策実装（Double Submit Cookie Pattern）

3. **データ保護**
   * 個人情報や機密データは保存時に暗号化
   * S3へのアップロードファイルはサーバーサイドで一時保存後、検証してから転送
   * ファイルタイプと容量制限を厳格に実施

4. **アクセス制御**
   * 最小権限原則に基づきIAMポリシー設定
   * リソースへのアクセスは組織IDで厳格に制限
   * APIアクセス制限（レート制限実装）

## 7. トラブルシューティング

### 7.1 一般的な問題と解決策

1. **MongoDB接続エラー**
   * ネットワークIPがアクセス許可リストに追加されているか確認
   * 認証情報（ユーザー名/パスワード）が正しいか確認
   * 接続文字列のフォーマットが正しいか確認

2. **AWSサービス接続エラー**
   * IAMユーザーに適切な権限が付与されているか確認
   * リージョン設定が正しいか確認
   * アクセスキー/シークレットキーが有効か確認

3. **ファイルアップロードエラー**
   * S3バケットCORS設定を確認
   * IAMユーザーにS3書き込み権限があるか確認
   * ファイルサイズ/タイプの制限を確認

### 7.2 ログ収集と監視

1. **開発環境**
   * コンソールログ確認
   * Winstonログファイル確認（logs/エラーログ）

2. **本番環境**
   * CloudWatch Logsでのログ確認
   * Sentryでのエラー監視
   * DataDogでのパフォーマンス監視（オプション）

## 8. 参考情報

* [MongoDB Atlas ドキュメント](https://docs.atlas.mongodb.com/)
* [AWS S3 ドキュメント](https://docs.aws.amazon.com/s3/)
* [AWS ECS ドキュメント](https://docs.aws.amazon.com/ecs/)
* [Google Maps API ドキュメント](https://developers.google.com/maps/documentation)
* [JWT 認証ベストプラクティス](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)