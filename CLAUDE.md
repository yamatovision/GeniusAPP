# ${PROJECT_NAME}

このファイルはプロジェクトの中心的なドキュメントです。VSCode拡張とClaudeCode
の両方がこのファイルを参照することで、開発情報を一元管理します。

## System Instructions
必ず日本語で応答してください。ファイルパスの確認や処理内容の報告もすべて日本
語で行ってください。英語での応答は避けてください。

## 【重要原則】データモデル管理について

本プロジェクトでは「単一の真実源」原則を採用しています。

- 全データモデルとAPIパスは `shared/index.ts` で一元管理
- 初期データモデルはスコープマネージャーが設計
- 実装フェーズでは、スコープ実装アシスタントが必要に応じてデータモデルを拡張・詳細化
- データモデルやAPIパス変更時は `shared/index.ts` を必ず更新し、変更履歴を記録
- 大規模な構造変更は事前に他のスコープへの影響を確認

この原則に従わず別々の場所でモデル定義を行うと、プロジェクト全体の一貫性が
損なわれる問題が発生します。

## プロジェクト概要

${PROJECT_NAME}は非技術者がClaudeCodeを活用して開発できるアプリケーションです。AIチャットを中心とした開発フローと、コンテンツの適切な保存・管理機能を提供します。

**主要コンセプト**:
- AIとの対話を中心とした開発体験
- 生成コンテンツの自動保存と管理
- CLAUDE.mdを中心とした設計情報管理
- VSCodeで設計・ClaudeCodeで実装の連携

## 技術スタック

### フロントエンド
- [フレームワーク/ライブラリ名]: [バージョン]
- [フレームワーク/ライブラリ名]: [バージョン]

### バックエンド
- [フレームワーク/ライブラリ名]: [バージョン]
- [フレームワーク/ライブラリ名]: [バージョン]

### データベース
- [データベース名]: [バージョン]

### インフラ・デプロイ
- [ホスティングサービス/インフラ]
- [CI/CDツール]

## 開発フェーズ

現在の開発状況と進捗は [開発状況](./docs/CURRENT_STATUS.md) で管理しています。

## 開発ワークフロー

このプロジェクトではClaudeCodeを使って以下の開発ワークフローを採用しています：

1. **要件定義**: 全体の要件定義とページごとの要件定義
2. **モックアップ**: すべてのページのモックアップ
3. **ディレクトリ構造**: 完成図のディレクトリ構造を出す
4. **スコープ**: ClaudeCode 20万トークン以内で実装できるスコープ管理と実装
5. **デバッグ**: エラーが起きた時のデバック
6. **環境変数**: envファイルの管理
7. **デプロイ**: デプロイプロセスの概要

## 開発アシスタント
- **requirements_advisor.md**
  - 全体の要件定義をより明確にするアシスタント
  - 初期データモデル要件を特定

- **mockup_analyzer.md**
  - 個別のモックアップをブラッシュアップする
  - ページごとの詳細な要件定義を書く
  - UIから必要なデータモデル属性を特定して提案

- **scope_manager.md**
  - CURRENT_STATUS.mdを更新してフェーズごとにスコープ管理できるようにする
  - ディレクトリ構造を確定させる
  - APIをまとめる
  - 環境変数をまとめる
  - data_models.mdを管理し、単一の真実源として維持する
  - データモデルの変更を承認・実施する責任者
  - スコープごとに使用するデータモデルを明示

- **scope_implementer.md**
  - CURRENT_STATUS.mdをベースにスコープごとの実装を担当
  - data_models.mdからモデル定義を利用（変更は不可）
  - モデル変更が必要な場合は変更提案のみ行う

- **debug_detective.md**
  - デバックを担当
  - データモデル関連の問題を診断

- **environment_manager.md**
  - 環境変数を担当
  - データベース接続情報を管理

## ドキュメントリンク

### 設計情報
- [要件定義](./docs/requirements.md) - プロジェクトの詳細要件
- [ディレクトリ構造](./docs/structure.md) - プロジェクトのフォルダ構成
- [データモデルとAPIパス](./shared/index.ts) - データモデルとAPIパス定義（単一の真実源）
- [モックアップ](./mockups/) - UIデザインとプロトタイプ
- [実装スコープ](./docs/CURRENT_STATUS.md#スコープ状況) - 実装する機能の詳細と優先順位
- [API設計](./docs/api.md) - APIエンドポイントの定義
- [環境変数リスト](./docs/env.md) - 必要な環境変数の設定リスト

### 技術情報
- [開発状況](./docs/CURRENT_STATUS.md) - 現在の開発状況と進捗
- [環境変数](./docs/CURRENT_STATUS.md#環境変数設定状況) - 必要な環境変数の設定リスト
- [コマンド一覧](#開発コマンド) - よく使うコマンドのリスト

## プロジェクト構造

```
${PROJECT_NAME}/
├── CLAUDE.md                     # プロジェクト中心情報
├── shared/                       # 共通定義ファイル
│   └── index.ts                  # データモデルとAPIパス定義（単一の真実源）
├── docs/                         # ドキュメントとプロンプト
│   ├── CURRENT_STATUS.md         # 進捗状況と実装状態
│   ├── requirements.md           # 全体要件定義
│   ├── structure.md              # ディレクトリ構造 
│   ├── api.md                    # API定義
│   ├── env.md                    # 環境変数リスト
│   ├── deploy.md                 # デプロイ情報
│   ├── scopes/                   # 個別スコープ要件
│   │   └── page-requirements.md  # 各ページの詳細要件
│   └── prompts/                  # AIアシスタントプロンプト
│       ├── requirements_advisor.md       # 要件定義アドバイザー
│       ├── mockup_analyzer.md            # モックアップ解析
│       ├── scope_manager.md              # スコープ管理
│       ├── scope_implementer.md          # 実装アシスタント
│       ├── debug_detective.md            # デバッグ探偵
│       └── environment_manager.md        # 環境変数アシスタント
├── mockups/                      # モックアップファイル
│   └── *.html                    # 各ページのモックアップ
├── .claude_data/                 # ClaudeCodeとの連携データ
│   ├── dom_structure.json        # UI構造情報
│   ├── env_variables.json        # 環境変数情報
│   ├── actions.json              # ClaudeCode操作指示
│   └── screenshots/              # UI状態のスクリーンショット
└── .env                          # 環境変数（.gitignore対象）
```

## データモデル管理

### データモデル管理の原則
プロジェクトのデータモデルとAPIパスは `shared/index.ts` で一元管理します。このファイルが
「単一の真実源」として機能し、すべてのデータ定義とAPIパス定義はここから派生します。

1. **データモデル管理体制**:
   - 初期データモデルはスコープマネージャーが設計
   - スコープ実装アシスタントは実装時に必要に応じてモデルを拡張・詳細化
   - 大規模な構造変更は事前にスコープマネージャーと協議

2. **データモデル変更記録**:
   - すべてのモデル変更とAPIパス変更は `shared/index.ts` 内のコメントに変更履歴として記録
   - CURRENT_STATUS.mdにも変更内容を反映
   - 変更日、モデル名/APIパス名、変更内容、変更者、影響範囲を明記

3. **スコープとの連携**:
   - 各スコープが使用するデータモデルをCURRENT_STATUS.mdに明示
   - 影響範囲があるモデル変更は他のスコープ担当者に通知

重要：フロントエンド・バックエンド間でデータ構造の不一致が発生しないよう、常に
`shared/index.ts` から型定義とAPIパスを取得してください。

## 環境変数管理

プロジェクトで使用する環境変数は `docs/env.md` で一元管理し、CURRENT_STATUS.mdで
状況を追跡します。実際の値は`.env`ファイルに設定してください。環境変数に関する詳細情報は、
[環境変数設定状況](./docs/CURRENT_STATUS.md#環境変数設定状況)を参照してください。

## 開発コマンド

```bash
# 開発環境の起動
[コマンド]

# ビルド
[コマンド]

# テスト実行
[コマンド]

# デプロイ
[コマンド]
```

## 進捗状況
- 要件定義: 未完了
- モックアップ: 未完了
- ディレクトリ構造: 未完了
- 実装: 未開始
- テスト: 未開始
- デプロイ: 未開始

## 開発達成率
- 作成済みファイル: 0
- 計画済みファイル: 0
- 達成率: 0%

## 実装対象ファイル
_ディレクトリ構造が確定次第、このセクションに実装対象ファイルが自動的に追加されます_

## チェックリスト
- [ ] 要件定義の完了
- [ ] モックアップの作成
- [ ] ディレクトリ構造の確定
- [ ] API設計の完了
- [ ] 環境変数の設定
- [ ] 実装スコープの決定
- [ ] 実装の開始
- [ ] テストの実施
- [ ] デプロイの準備

## プロジェクト情報
- 作成日: 2025-03-12
- 作成者: AppGenius AI
- ステータス: 進行中