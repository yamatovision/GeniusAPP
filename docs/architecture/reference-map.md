# ドキュメント参照関係マップ

## 1. 概要

このドキュメントはAppGeniusプロジェクトにおける主要ドキュメント間の参照関係を視覚的に示し、ドキュメント間のナビゲーションを容易にするためのガイドです。この参照マップを活用することで、AIエージェントと開発者は必要な情報に効率的にアクセスできます。

## 2. 中心ドキュメントと参照フロー

```
                                                 ┌─────────────────┐
                                            ┌───▶│  mockups/      │
                                            │    │  - index.html   │
                                            │    │  - pages/*.html │
                                            │    │  - components/* │
                                            │    └─────────────────┘
                                            │             ▲
                                            │             │
┌─────────────────┐                         │             │
│ requirements.md │◀────┐                   │             │
└────────┬────────┘     │                   │             │
         │              │                   │    ┌────────┴────────┐
         ▼              │                   └────┤                 │
┌─────────────────┐     │                        │ SCOPE_PROGRESS.md
│ architecture/   │     │                   ┌────┤                 │
│ - tech-stack.md │     │                   │    └────────┬────────┘
│ - dir-structure │     │                   │             │
│ - data-model.md │◀────┼───────────────────┘             │
└────────┬────────┘     │                                 │
         │              │                                 │
         ▼              │                                 │
┌─────────────────┐     │                                 │
│ api/            │     │                                 │
│ - index.md      │     │                                 │
│ - auth.md       │◀────┘                                 ▼
│ - users.md      │                              ┌─────────────────┐
│ - feature.md    │                              │ deployment/     │
└────────┬────────┘                              │ - deploy.md     │
         │                                       │ - env-template.md
         │                                       └─────────────────┘
         ▼                                           
┌─────────────────┐                                   
│ shared/index.ts │                                   
│ - データモデル型定義 │                                   
│ - API型定義      │                                   
└─────────────────┘                                   
```

## 3. ドキュメント依存関係表

| ドキュメント | 参照先 | 参照元 | 主な目的 |
|-------------|-------|--------|---------|
| requirements.md | mockups/, architecture/, api/ | SCOPE_PROGRESS.md, すべてのドキュメント | プロジェクト全体の要件定義 |
| SCOPE_PROGRESS.md | requirements.md, mockups/, architecture/, api/, deployment/ | 実装タスク | 現在のスコープと実装タスク管理 |
| mockups/*.html | requirements.md | requirements.md, SCOPE_PROGRESS.md, api/ | 視覚的なUI設計 |
| architecture/tech-stack.md | requirements.md | SCOPE_PROGRESS.md, deployment/ | 技術選定の理由と詳細 |
| architecture/data-model.md | requirements.md, mockups/ | api/, SCOPE_PROGRESS.md | データ構造の概要と関係性の説明 |
| shared/index.ts | architecture/data-model.md | api/*.md, 実装コード | データモデル型定義の単一の真実源 |
| api/*.md | requirements.md, shared/index.ts | SCOPE_PROGRESS.md, 実装コード | APIエンドポイント仕様 |
| deployment/deploy.md | architecture/tech-stack.md | SCOPE_PROGRESS.md | デプロイ手順と環境設定 |

## 4. ドキュメントタイプと参照パターン

### 4.1 計画ドキュメント
- **requirements.md** → すべてのドキュメント（要件の真実源）
- **architecture/tech-stack.md** → 実装・デプロイ関連ドキュメント（技術選定の真実源）
- **architecture/directory-structure.md** → 実装関連ドキュメント（構造の真実源）

### 4.2 設計ドキュメント
- **mockups/*.html** → requirements.md, data-model.md, api/*.md（UI設計の真実源）
- **architecture/data-model.md** → api/*.md, 実装コード（データ構造の真実源）
- **api/*.md** → 実装コード（API仕様の真実源）

### 4.3 実装ドキュメント
- **SCOPE_PROGRESS.md** → 上記すべて（現在のタスクの真実源）
- **shared/index.ts** → 型定義とデータモデル（型定義の真実源）
- **deployment/*.md** → 実装・設定コード（デプロイ情報の真実源）

## 5. ドキュメント内部構造と参照セクション

### 5.1 requirements.md 構造
```
# プロジェクト要件定義
├── 1. 概要
├── 2. 機能要件
│   ├── 2.1 機能カテゴリ
│   │   ├── 2.1.1 機能詳細
│   │   │   └── 関連ドキュメント（参照セクション）
├── 3. 非機能要件
└── 4. 実装ステータス（SCOPE_PROGRESS.mdへの参照）
```

### 5.2 SCOPE_PROGRESS.md（スコープ進捗文書）構造
```
# スコープ進捗状況
├── 1. 基本情報
├── 2. 実装概要
├── 3. 参照ドキュメント（重要な参照セクション）
├── 4. 依存関係
├── 5. データフロー
├── 6. タスクリスト
│   ├── バックエンド実装
│   ├── フロントエンド実装
│   └── テストとドキュメント
├── 7. 実装上の注意点
└── 8. 実装状況の更新履歴
```

### 5.3 api/*.md 構造
```
# API仕様書
├── メタデータ（参照セクション）
├── エンドポイント一覧
└── 各エンドポイント詳細
    ├── リクエスト形式 → shared/index.ts (型定義への参照)
    ├── レスポンス形式 → shared/index.ts (型定義への参照)
    ├── エラーレスポンス → shared/index.ts (ApiErrorResponse)
    └── 認証要件
```

### 5.4 shared/index.ts 構造
```
# 型定義ファイル
├── ファイルヘッダーコメント（目的と使用方法）
├── インポート
├── 基本型定義
├── 列挙型定義
├── APIレスポンス型定義
├── サービス結果型定義
├── 認証関連型定義
├── モデル型定義（ユーザー、リスティングなど）
└── 変更履歴コメント
```

## 6. エージェント別参照ガイド

各AIエージェントが最も頻繁に参照すべきドキュメントとセクションを示します。

### 6.1 プロジェクトファウンデーション
- **主要参照**: requirements.md（全体）
- **二次参照**: architecture/tech-stack.md, mockups/index.html
- **作成ドキュメント**: requirements.md, architecture/tech-stack.md, architecture/directory-structure.md

### 6.2 モックアップクリエイター
- **主要参照**: requirements.md#2-機能要件
- **二次参照**: architecture/tech-stack.md
- **作成ドキュメント**: mockups/*.html

### 6.3 データモデルアーキテクト
- **主要参照**: requirements.md, mockups/*.html
- **二次参照**: architecture/tech-stack.md
- **作成ドキュメント**: architecture/data-model.md, shared/index.ts

### 6.4 APIデザイナー
- **主要参照**: mockups/*.html, shared/index.ts
- **二次参照**: requirements.md, architecture/data-model.md
- **作成ドキュメント**: api/*.md

### 6.5 スコーププランナー
- **主要参照**: requirements.md, mockups/*.html, api/*.md
- **二次参照**: architecture/directory-structure.md, shared/index.ts
- **作成ドキュメント**: SCOPE_PROGRESS.md

### 6.6 フロントエンド実装エージェント
- **主要参照**: SCOPE_PROGRESS.md, mockups/*.html, api/*.md
- **二次参照**: shared/index.ts, architecture/tech-stack.md
- **作成ドキュメント**: 実装コード

### 6.7 バックエンド実装エージェント
- **主要参照**: SCOPE_PROGRESS.md, api/*.md, shared/index.ts
- **二次参照**: architecture/tech-stack.md, architecture/data-model.md
- **作成ドキュメント**: 実装コード

### 6.8 環境&デプロイエージェント
- **主要参照**: architecture/tech-stack.md
- **二次参照**: SCOPE_PROGRESS.md
- **作成ドキュメント**: deployment/deploy.md, deployment/env-template.md

## 7. 参照関係の更新と維持

このドキュメント参照マップは以下のタイミングで更新します：

1. 新しい主要ドキュメントタイプの追加時
2. ドキュメント間の参照パターンに変更があった時
3. ドキュメント構造に大きな変更があった時
4. 新しいエージェントが追加された時

参照マップの維持責任者は「ドキュメントアーキテクト」または「メタドキュメント管理者」とし、全体の一貫性を確保します。