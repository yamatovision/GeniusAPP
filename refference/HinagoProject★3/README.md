# HinagoProject - ボリュームチェックシステム

福岡市を中心に活動するディベロッパー企業向けの土地購入意思決定支援システムです。建築基準法や都市計画法に基づいた最大建築可能ボリュームの自動算出を中心に、3Dモデルによる視覚的な把握と容積消化率の最適化により、投資効率の高い判断を支援します。

## 機能一覧

- **建築基準法に基づく最大ボリュームチェック機能**: 敷地情報と法規制に基づいた最大建築可能ボリュームを自動算出 
- **測量図アップロードと土地形状読み込み機能**: 不整形な土地の形状を正確に反映し、現実的な建築可能ボリュームを算出
- **シンプルな箱型3Dモデル生成機能**: 算出された建築ボリュームを視覚的に表現し直感的な理解を促進
- **容積消化率の自動計算機能**: アセットタイプ（マンション、木造アパート等）に応じた容積消化率を算出
- **収益性試算機能**: 物件の投資利回り、IRR、NPVなどの財務指標を算出

## 技術スタック

### バックエンド
- **言語/フレームワーク**: Node.js + Express
- **データベース**: MongoDB
- **認証**: JWT + bcrypt
- **API形式**: RESTful API

### フロントエンド
- **言語/フレームワーク**: TypeScript + React
- **状態管理**: Redux Toolkit
- **UI**: Material-UI
- **3D**: Three.js
- **グラフ**: Chart.js

### デプロイ/インフラ
- **コンテナ化**: Docker
- **CI/CD**: GitHub Actions
- **デプロイ先**: AWS (ECS + MongoDB Atlas)
- **ストレージ**: S3
- **CDN**: CloudFront

## 開発環境のセットアップ

### 前提条件
- Node.js (v16以上)
- Yarn
- Docker + Docker Compose
- Git

### 初期セットアップ手順

1. リポジトリのクローン
   ```
   git clone <repository-url>
   cd HinagoProject
   ```

2. セットアップスクリプトの実行
   ```
   bash scripts/setup.sh
   ```
   このスクリプトは必要なディレクトリ構造と初期ファイルを作成します。

3. 環境変数の設定
   ```
   # .envファイルを編集
   nano .env
   ```
   必要な環境変数は`.env.example`を参照してください。

4. Docker環境の起動
   ```
   docker-compose up -d
   ```
   これによりMongoDB、バックエンド、フロントエンド、LocalStack(S3エミュレータ)が起動します。

5. アプリケーションへのアクセス
   - バックエンドAPI: http://localhost:3000/api
   - フロントエンド: http://localhost:3001

### 開発コマンド

#### バックエンド開発
```
cd backend
yarn dev        # 開発サーバーの起動
yarn build      # ビルド
yarn test       # テスト実行
```

#### フロントエンド開発
```
cd frontend
yarn start      # 開発サーバーの起動
yarn build      # ビルド
yarn test       # テスト実行
```

## プロジェクト構造

```
/HinagoProject/
├── docs/                   # プロジェクトドキュメント
│   ├── data_models.md      # データモデル設計書
│   ├── directory_structure.md # ディレクトリ構造設計書
│   ├── requirements.md     # 要件定義書
│   └── ...
├── mockups/                # UIモックアップ
├── shared/                 # 共有型定義とAPIパス
├── frontend/               # フロントエンドアプリケーション
├── backend/                # バックエンドアプリケーション
├── scripts/                # ビルドスクリプトや開発用ツール
├── .env.example            # 環境変数サンプル
└── docker-compose.yml      # Docker構成ファイル
```

## ドキュメント

詳細なドキュメントは以下を参照してください：

- [要件定義書](docs/requirements.md) - プロジェクトの目的と要件詳細
- [データモデル設計書](docs/data_models.md) - データベースのスキーマと型定義
- [ディレクトリ構造設計書](docs/directory_structure.md) - プロジェクトの構造とファイル配置
- [API設計仕様書](docs/api/index.md) - APIエンドポイントと使用方法

## 貢献ガイドライン

1. 開発は機能ごとの垂直スライス方式で行います
2. 共有型定義は`shared/index.ts`で一元管理します
3. コミット前に必ずlintとテストを実行してください
4. APIパスはハードコードせず、必ず`shared/index.ts`から参照してください

## ライセンス

Copyright © 2025 HinagoProject