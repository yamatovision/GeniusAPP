# AppGenius ツールキット管理

このファイルはAppGeniusのツールキット、依存関係、連携の仕組みを管理します。

## AI アシスタント構成

AppGeniusプラットフォームは4つの主要AIアシスタントと連携システムで構成されています：

### 1. 要件定義アシスタント
**役割**: プロジェクトの要件を整理し、基本設計情報を提供
**プロンプト**: `docs/requirementsadvicer.md`
**主な責務**:
- 基本要件の収集と整理
- 初期モックアップHTMLの生成
- 基本的なディレクトリ構造の概略設計
- 主要データモデルの特定
- 基本APIエンドポイントの特定
- 必要な環境変数の初期リスト化

### 2. モックアップ解析アシスタント
**役割**: UIモックアップから詳細要件を抽出し、実装情報を整理
**プロンプト**: `docs/mockup_analysis_template.md`
**主な責務**:
- モックアップUIの詳細分析と改善
- ページごとの詳細要件定義
- ディレクトリ構造の具体化（ページ関連ファイル）
- データモデルの詳細化
- APIエンドポイントの具体化
- 環境変数要件の詳細化

### 3. スコープマネージャー
**役割**: 前工程の情報を統合し、実装単位を設計
**プロンプト**: `docs/Scope_Manager_Prompt.md`
**主な責務**:
- 統合された詳細ディレクトリ構造の確立
- 完全なデータモデル定義の整備
- 一貫性のあるAPI設計の完成
- 環境変数リストの統合と整理
- 実装スコープの定義と優先順位付け
- 依存関係グラフの作成
- デプロイ情報の基本設定

### 4. スコープ実装アシスタント
**役割**: 定義されたスコープに基づいてコードを実装
**プロンプト**: `docs/Scope_Implementation_Assistant_Prompt.md`
**主な責務**:
- スコープに含まれる各ファイルの実装
- APIエンドポイントの実装
- データモデルの実装
- フロントエンド-バックエンド連携の実装
- 環境変数の使用と検証
- 単体テストの実装

### 連携システム
- **デバッグ探偵**: エラー検出と解決のアシスタント
- **環境変数アシスタント**: 環境設定の管理と最適化

## 核心ドキュメント構成

以下の4つの核心ドキュメントが各アシスタント間で連携し、情報が段階的に詳細化されます：

### 1. ディレクトリ構造 (structure.md)
- **要件定義アシスタント**: 基本構造のみを定義
- **モックアップ解析**: 各ページの具体的なファイルを追加
- **スコープマネージャー**: 完全な構造を統合・確立

### 2. データモデル (data_models.md)
- **要件定義アシスタント**: 主要エンティティの特定
- **モックアップ解析**: UIから属性と関係を詳細化
- **スコープマネージャー**: 完全なデータモデルを統合

### 3. API設計 (api.md)
- **要件定義アシスタント**: 主要エンドポイントの特定
- **モックアップ解析**: 具体的なAPIパラメータと形式の定義
- **スコープマネージャー**: 一貫性のあるAPI設計の確立

### 4. 環境変数リスト (env.md)
- **要件定義アシスタント**: 基本的な環境変数の特定
- **モックアップ解析**: 具体的な接続設定などの追加
- **スコープマネージャー**: 環境変数の統合と分類
- **環境変数アシスタント**: 実際の値の設定と検証

## 技術コンポーネント構成

### コアサービス
- ClaudeCodeLauncherService: ClaudeCodeとの連携
- ProjectManagementService: プロジェクト管理サービス
- AppGeniusEventBus: コンポーネント間イベント通信
- PlatformManager: プラットフォーム依存機能の抽象化

### UI パネル
- ScopeManagerPanel: スコープ管理UIとAPI統合管理
- EnvironmentVariablesAssistantPanel: 環境変数管理UI
- DebugDetectivePanel: デバッグ探偵UI
- MockupGalleryPanel: モックアップとAPI抽出UI

## ファイル連携構造

AppGeniusのファイル連携構造は以下の通りです：

```
Root/
├── CLAUDE.md                     # プロジェクト中心情報
├── CURRENT_STATUS.md             # 現在の進捗状況
├── .env                          # 環境変数（.gitignoreに追加）
├── docs/                         # プロジェクト定義とテンプレート
│   ├── requirementsadvicer.md    # 要件定義アドバイザー
│   ├── mockup_analysis_template.md # モックアップ解析テンプレート
│   ├── Scope_Manager_Prompt.md   # スコープ管理プロンプト
│   ├── Scope_Implementation_Assistant_Prompt.md # 実装支援プロンプト
│   ├── api.md                    # API定義
│   ├── data_models.md            # データモデル定義
│   ├── scope.md                  # スコープ定義
│   ├── structure.md              # ディレクトリ構造
│   ├── env.md                    # 環境変数リスト
│   └── deploy.md                 # デプロイ情報
├── mockups/                      # モックアップファイル
│   └── *.html                    # 各ページのモックアップ
└── scopes/                       # 個別スコープ要件
    └── *-requirements.md         # 各ページの詳細要件
```

## アシスタント連携フロー

### 要件定義フェーズ
1. 要件定義アシスタントが全体要件を整理
2. 基本モックアップHTMLを生成
3. 初期structure.md、data_models.md、api.md、env.mdを生成

### モックアップ分析フェーズ
1. モックアップギャラリーで各ページのUIを改善
2. 各ページごとに詳細要件を定義(`scopes/*-requirements.md`)
3. structure.md、data_models.md、api.md、env.mdを更新・詳細化

### スコープ管理フェーズ
1. スコープマネージャーが前工程の情報を統合
2. 最終的なstructure.md、data_models.md、api.md、env.mdを確立
3. scope.md、deploy.mdを作成
4. 実装順序と依存関係を定義
5. CURRENT_STATUS.mdに初期状態を設定

### 実装フェーズ
1. スコープ実装アシスタントが各スコープをClaudeCodeで実装
2. 環境変数アシスタントが実際の環境変数値を設定
3. デバッグ探偵がエラーを解決

## 環境変数管理フロー

環境変数の状態は、env.mdにおいて以下の表記ルールで管理されます：

```markdown
# 環境変数リスト

## バックエンド
[ ] `DB_HOST` - データベースに接続するための名前やアドレス
[✓] `PORT` - サーバーポート番号

## フロントエンド
[ ] `NEXT_PUBLIC_API_URL` - バックエンドAPIのURL
```

状態の遷移:
1. **初期状態** `[ ]` - スコープマネージャーが初期化
2. **設定完了** `[✓]` - 環境変数アシスタントで設定・検証済み

## アップグレード計画

### 短期改善計画 (2025-Q2)
1. ✅ 4つの核心ドキュメント構造の標準化 (2025-03-08)
2. ✅ AI連携フローの最適化 (2025-03-08)
3. フォルダ構造の整理と標準化
4. プロンプトの最適化と効率化

### 中期改善計画 (2025-Q3)
1. UI連携機能の強化
2. デバッグ知識ベースの拡充
3. スコープマネージャーUIの改善

### 長期改善計画 (2025-Q4)
1. プロジェクト間でのツールキット共有機能
2. AIプロンプト自動最適化システム
3. マルチプラットフォーム対応の強化