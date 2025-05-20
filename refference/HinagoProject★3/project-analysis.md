# HinagoProject プロジェクト分析

## プロジェクト概要
HinagoProjectは福岡市を中心に活動するディベロッパー企業向けの土地購入意思決定支援システムです。建築基準法や都市計画法に基づいた最大建築可能ボリュームの自動算出を中心に、3Dモデルによる視覚的な把握と容積消化率の最適化により、投資効率の高い判断を支援します。

## 技術スタック

### バックエンド
- **言語/フレームワーク**: Node.js + Express
- **データベース**: MongoDB
- **認証**: JWT + bcrypt
- **API形式**: RESTful API
- **ドキュメント**: OpenAPI (Swagger)
- **テスト**: Jest + Supertest

### フロントエンド
- **言語/フレームワーク**: TypeScript + React
- **状態管理**: Redux Toolkit
- **ルーティング**: React Router
- **UI**: Material-UI
- **グラフ**: Chart.js
- **3D**: Three.js
- **テスト**: Jest + React Testing Library

### デプロイ/インフラ
- **コンテナ化**: Docker
- **CI/CD**: GitHub Actions
- **デプロイ先**: AWS (ECS + MongoDB Atlas)
- **ストレージ**: S3
- **CDN**: CloudFront
- **監視**: CloudWatch + Sentry

## 必要な環境変数

### バックエンド環境変数
```
# アプリケーション設定
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000/api
CORS_ORIGIN=http://localhost:3001

# データベース設定
MONGODB_URI=mongodb://localhost:27017/hinago-project
MONGODB_USER=
MONGODB_PASSWORD=

# 認証設定
JWT_SECRET=your-jwt-secret-key-here
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key-here
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
JWT_REFRESH_EXPIRE_REMEMBER=30d

# AWS S3設定（測量図や文書保存用）
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=hinago-project

# 外部API連携
GEOCODING_API_KEY=  # 住所から緯度経度取得用

# ロギング設定
LOG_LEVEL=debug

# セキュリティ設定
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

### フロントエンド環境変数
```
# アプリケーション設定
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_ENV=development

# 認証設定
REACT_APP_AUTH_STORAGE_KEY=hinago_auth

# 機能フラグ
REACT_APP_ENABLE_3D_VIEWER=true
REACT_APP_ENABLE_PROFITABILITY=true

# 外部サービス連携
REACT_APP_SENTRY_DSN=
REACT_APP_MAPBOX_TOKEN=  # 地図表示用
```

## プロジェクト構造
プロジェクトは機能中心のディレクトリ構造を採用しています：

1. **共通ドキュメント**: `/docs/` - 要件定義や設計ドキュメント
2. **モックアップ**: `/mockups/` - HTML形式のUIモックアップ
3. **共有リソース**: `/shared/` - フロントエンドとバックエンドで共有する型定義やAPIパス
4. **フロントエンド**: `/frontend/` - React + TypeScriptベースのSPA
5. **バックエンド**: `/backend/` - Node.js + Express + MongoDBベースのRESTful API

## 主要機能
1. **認証機能**: JWT認証によるユーザー認証と組織ベースのアクセス制御
2. **物件管理**: 不動産物件の登録・管理機能
3. **敷地形状管理**: 測量図アップロードと形状抽出機能
4. **ボリュームチェック**: 建築基準法を考慮した最大建築可能ボリュームの自動算出
5. **3Dビジュアライゼーション**: Three.jsを使用した建築ボリュームの3D表示
6. **収益性試算**: アセットタイプ別の収益性分析と複数シナリオ比較
7. **文書管理**: 物件関連文書の管理・共有機能

## 外部サービス依存性
1. **MongoDB Atlas**: データベースサービス
2. **AWS S3**: ファイルストレージ（測量図や文書の保存）
3. **ジオコーディングAPI**: 住所から緯度経度情報の取得
4. **Mapbox/Google Maps**: 地図表示サービス
5. **Sentry**: エラー監視サービス

## 開発・デプロイフロー
1. モノレポ構造でフロントエンド/バックエンド/共有リソースを管理
2. Dockerコンテナによる開発環境の統一
3. GitHub Actionsによる自動テストとCI/CD
4. AWS ECSへのデプロイ

## 推奨開発環境
- Node.js v16+
- MongoDB v5+
- Docker + Docker Compose
- VS Code (推奨エディタ)
- Git