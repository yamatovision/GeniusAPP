# プロジェクト名

このファイルはプロジェクトの中心的なドキュメントです。VSCode拡張とClaudeCode
の両方がこのファイルを参照することで、開発情報を一元管理します。

## System Instructions
必ず日本語で応答してください。ファイルパスの確認や処理内容の報告もすべて日本
語で行ってください。英語での応答は避けてください。

## プロジェクト概要

[プロジェクトの概要と目的を簡潔に記述してください。1-2段落程度が理想的です。]

**主要コンセプト**:
- [主要コンセプト1]
- [主要コンセプト2]
- [主要コンセプト3]
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

1. **要件定義**: [全体の要件定義とページごとの要件定義]
2. **モックアップ**: [すべてのページのモックアップ]
3. **ディレクトリ構造**: [完成図のディレクトリ構造を出す]
4. **スコープ**: [ClaudeCode 20万トークン以内で実装できるスコープ管理と実装]
5. **デバッグ**: [エラーが起きた時のデバック]
6. **環境変数**: [envファイルの管理]
7. **デプロイ**: [デプロイプロセスの概要]

## 開発アシスタント
- **requirementsadvicer.md**
  - 全体の要件定義をより明確にするアシスタント

- **mockup_analysis_template.md**
  - 個別のモックアップをブラッシュアップする
  - ページごとの詳細な要件定義を書く

- **Scope_Manager_Prompt.md**
  - CURRENT_STATUS.mdを更新してフェーズごとにスコープ管理できるようにする
  - ディレクトリ構造を確定させる
  - APIをまとめる
  - 環境変数をまとめる

- **Scope_Implementation_Assistant_Prompt.md**
  - CURRENT_STATUS.mdをベースにスコープごとの実装を担当

- **DebagDetector.md**
  - デバックを担当

- **environmentVariablesAssistant-requirements.md**
  - 環境変数を担当

## ドキュメントリンク

### 設計情報
- [要件定義](./Requirements/requirements.md) - プロジェクトの詳細要件
- [ディレクトリ構造](./docs/structure.md) - プロジェクトのフォルダ構成
- [モックアップ](./mockups/) - UIデザインとプロトタイプ
- [実装スコープ](./docs/scope.md) - 実装する機能の詳細と優先順位
- [API設計](./docs/api.md) - APIエンドポイントの定義

### 技術情報
- [開発状況](./docs/CURRENT_STATUS.md) - 現在の開発状況と進捗
- [環境変数](./docs/CURRENT_STATUS.md#環境変数設定状況) - 必要な環境変数の設定リスト
- [コマンド一覧](#開発コマンド) - よく使うコマンドのリスト

## プロジェクト構造

```
[プロジェクト名]/
├── CLAUDE.md                     # プロジェクト中心情報
├── CURRENT_STATUS.md             # 開発状況と進捗
├── .env                          # 環境変数（.gitignoreに追加）
├── Assistant/                    # AIアシスタントプロンプト
│   ├── requirementsadvicer.md    # 要件定義アドバイザー
│   ├── mockup_analysis_template.md # モックアップ解析テンプレート
│   ├── Scope_Manager_Prompt.md   # スコープ管理プロンプト
│   ├── Scope_Implementation_Assistant_Prompt.md # 実装支援プロンプト
│   ├── DebagDetector.md          # デバッグ探偵プロンプト
│   └── environmentVariablesAssistant-requirements.md # 環境変数要件
├── mockups/                      # モックアップファイル
│   └── *.html                    # 各ページのモックアップ
├── Requirements/                 # 要件定義
│   ├── requirements.md           # 全体要件定義
│   └── scopes/                   # 個別要件定義
│       └── *-requirements.md     # 各ページの詳細要件
├── docs/                         # プロジェクト定義
│   ├── api.md                    # API定義
│   ├── scope.md                  # スコープ定義
│   └── structure.md              # ディレクトリ構造
├── debug/                        # デバッグ情報
│   ├── archived/                 # アーカイブされた情報
│   ├── knowledge/                # 知識ベース
│   └── sessions/                 # セッション情報
└── reference/                    # 参照情報
```

## 環境変数管理

プロジェクトで使用する環境変数はCURRENT_STATUS.mdで状況を管理します。
実際の値は`.env`ファイルに設定してください。環境変数に関する詳細情報は、
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