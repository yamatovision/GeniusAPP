# AppGenius 開発ガイド

このファイルはプロジェクトの中心的なドキュメントです。VSCode拡張とClaudeCodeの両方がこのファイルを参照することで、開発情報を一元管理します。

## System Instructions
必ず日本語で応答してください。ファイルパスの確認や処理内容の報告もすべて日本語で行ってください。英語での応答は避けてください。

## プロジェクト概要

AppGeniusは非技術者がClaudeCodeを活用してアプリケーション開発を行えるようにするツールです。AIチャットを中心とした開発フローと、コンテンツの適切な保存・管理機能を提供します。VSCode上で設計と準備を行い、ClaudeCodeで実装を行うシームレスな開発体験を提供します。

**主要コンセプト**:
- 「おばちゃんでもアプリが作れる」を実現するUI/UX
- AIとの対話を中心とした開発体験
- 生成コンテンツの自動保存と管理
- CLAUDE.mdを中心とした設計情報管理
- VSCodeで設計・ClaudeCodeで実装の連携

## 開発フェーズ

現在は**フェーズ1: 基盤構築**段階です。

1. **フェーズ1**: CLAUDE.md管理システム、チャットUI、ダッシュボード
2. **フェーズ2**: 要件定義・構造マネージャー、モックアップギャラリー、スコープ計画
3. **フェーズ3**: 実装支援、デバッグサポート
4. **フェーズ4**: API連携・環境設定、デプロイ支援

## 開発ワークフロー

AppGeniusでは以下のような開発ワークフローを推奨しています：

1. **要件定義**: VSCodeでの要件定義をAIとの対話で作成
2. **モックアップ作成**: 要件に基づいたモックアップHTMLを生成
3. **モックアップの反復的改善**: AIとの対話でモックアップを視覚的に改善
4. **バックエンド要件抽出**: モックアップからAPI・データ要件を抽出
5. **スコープ設定**: 20万トークン以内の適切な実装単位に分割
6. **ClaudeCodeでの実装**: スコープ単位での実装（VSCodeから起動）
7. **進捗の可視化**: CLAUDE.mdでの自動チェックリスト更新

特に、モックアップはユーザーが視覚的に確認できるため、要件の具体化に役立ちます。また、ClaudeCodeはCLAUDE.mdの情報を自動的に読み込み、実装を効率的に進めます。

## ドキュメントリンク

### 設計情報
- [要件定義](./docs/requirements.md) - プロジェクトの詳細要件
- [ディレクトリ構造](./docs/structure.md) - プロジェクトのフォルダ構成
- [モックアップ](./mockups/) - UIデザインとプロトタイプ
- [実装スコープ](./docs/scope.md) - 実装する機能の詳細と優先順位
- [API設計](./docs/api.md) - APIエンドポイントの定義
- [環境設定](./docs/env.example) - 必要な環境変数の設定例

### 技術情報
- [開発状況](./docs/CURRENT_STATUS.md) - 現在の開発状況と進捗

## 開発コマンド

```bash
# VSCode拡張 開発
cd AppGenius
npm install
npm run watch  # 開発モード
npm run package  # パッケージング
```

## コーディング規約
- クラス名: PascalCase
- メソッド名: camelCase
- プライベート変数: _camelCase
- 定数: UPPER_CASE
- インターフェース名: IPascalCase
- 型名: TPascalCase
## 進捗状況

## 進捗状況
- 完成予定ファイル数: 48
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: 2025-03-06

## ファイル状況

### 完了済みファイル


### 未完了ファイル
- [ ] AppGenius//.vscode/                      # VSCode設定
- [ ] AppGenius//launch.json               # デバッグ設定
- [ ] AppGenius//tasks.json                # タスク設定
- [ ] AppGenius//docs/                         # ドキュメント/requirements.md           # 要件定義
- [ ] AppGenius//docs/                         # ドキュメント/structure.md              # ディレクトリ構造
- [ ] AppGenius//docs/                         # ドキュメント/scope.md                  # 実装スコープ
- [ ] AppGenius//docs/                         # ドキュメント/api.md                    # API設計
- [ ] AppGenius//docs/                         # ドキュメント/env.example               # 環境変数例
- [ ] AppGenius//docs/                         # ドキュメント/CURRENT_STATUS.md         # 現在の開発状況
- [ ] AppGenius//mockups/                      # モックアップと生成物/metadata.json             # モックアップ管理情報
- [ ] AppGenius//mockups/                      # モックアップと生成物/*.html                    # 各モックアップファイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.css                     # 各UI要素のスタイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.js                      # フロントエンドスクリプト
- [ ] AppGenius//media/                        # アセットとスタイル/icon.svg                  # アイコン等
- [ ] AppGenius//src/                          # VSCode拡張ソース/extension.ts              # エントリーポイント
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/aiService.ts          # AI連携
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/codeGenerator.ts      # コード生成
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/gitManager.ts         # Git操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/projectAnalyzer.ts    # プロジェクト分析
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/requirementsParser.ts # 要件解析
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusEventBus.ts  # イベント管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusStateManager.ts # 状態管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/ProjectManagementService.ts # プロジェクト管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/mockupStorageService.ts  # モックアップ保存
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/referenceStorageService.ts # リファレンス管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/dashboard/            # ダッシュボード/DashboardPanel.ts # ダッシュボードパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/requirementManager/   # 要件定義マネージャー/RequirementManagerPanel.ts # 要件パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupGallery/        # モックアップギャラリー/MockupGalleryPanel.ts # モックアップパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupEditor/         # モックアップエディタ/SimpleMockupEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/scopeManager/         # スコープマネージャー/ScopeManagerPanel.ts # スコープパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/developmentAssistant/ # 開発アシスタント/DevelopmentAssistantPanel.ts # 開発パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/referenceManager/     # リファレンスマネージャー/ReferenceManagerPanel.ts # リファレンスパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/claudeMd/             # CLAUDE.mdエディタ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/ClaudeMdEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/sidebarProvider.ts    # サイドバープロバイダ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/statusBar.ts          # ステータスバー
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/CommandHandler.ts     # コマンドハンドラ
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ClaudeMdService.ts    # CLAUDE.md管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/MessageBroker.ts      # メッセージ処理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ScopeExporter.ts      # スコープエクスポート
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/configManager.ts      # 設定管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/fileManager.ts        # ファイル操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/logger.ts             # ロギング
- [ ] AppGenius//CLAUDE.md                     # プロジェクト中心ドキュメント
- [ ] AppGenius//package.json                  # パッケージ設定
- [ ] AppGenius//tsconfig.json                 # TypeScript設定
- [ ] AppGenius//webpack.config.js             # Webpack設定
- [ ] AppGenius//README.md                     # プロジェクト概要




## 進捗状況
- 完成予定ファイル数: 48
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: 2025-03-06

## ファイル状況

### 完了済みファイル


### 未完了ファイル
- [ ] AppGenius//.vscode/                      # VSCode設定
- [ ] AppGenius//launch.json               # デバッグ設定
- [ ] AppGenius//tasks.json                # タスク設定
- [ ] AppGenius//docs/                         # ドキュメント/requirements.md           # 要件定義
- [ ] AppGenius//docs/                         # ドキュメント/structure.md              # ディレクトリ構造
- [ ] AppGenius//docs/                         # ドキュメント/scope.md                  # 実装スコープ
- [ ] AppGenius//docs/                         # ドキュメント/api.md                    # API設計
- [ ] AppGenius//docs/                         # ドキュメント/env.example               # 環境変数例
- [ ] AppGenius//docs/                         # ドキュメント/CURRENT_STATUS.md         # 現在の開発状況
- [ ] AppGenius//mockups/                      # モックアップと生成物/metadata.json             # モックアップ管理情報
- [ ] AppGenius//mockups/                      # モックアップと生成物/*.html                    # 各モックアップファイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.css                     # 各UI要素のスタイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.js                      # フロントエンドスクリプト
- [ ] AppGenius//media/                        # アセットとスタイル/icon.svg                  # アイコン等
- [ ] AppGenius//src/                          # VSCode拡張ソース/extension.ts              # エントリーポイント
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/aiService.ts          # AI連携
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/codeGenerator.ts      # コード生成
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/gitManager.ts         # Git操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/projectAnalyzer.ts    # プロジェクト分析
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/requirementsParser.ts # 要件解析
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusEventBus.ts  # イベント管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusStateManager.ts # 状態管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/ProjectManagementService.ts # プロジェクト管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/mockupStorageService.ts  # モックアップ保存
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/referenceStorageService.ts # リファレンス管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/dashboard/            # ダッシュボード/DashboardPanel.ts # ダッシュボードパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/requirementManager/   # 要件定義マネージャー/RequirementManagerPanel.ts # 要件パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupGallery/        # モックアップギャラリー/MockupGalleryPanel.ts # モックアップパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupEditor/         # モックアップエディタ/SimpleMockupEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/scopeManager/         # スコープマネージャー/ScopeManagerPanel.ts # スコープパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/developmentAssistant/ # 開発アシスタント/DevelopmentAssistantPanel.ts # 開発パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/referenceManager/     # リファレンスマネージャー/ReferenceManagerPanel.ts # リファレンスパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/claudeMd/             # CLAUDE.mdエディタ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/ClaudeMdEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/sidebarProvider.ts    # サイドバープロバイダ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/statusBar.ts          # ステータスバー
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/CommandHandler.ts     # コマンドハンドラ
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ClaudeMdService.ts    # CLAUDE.md管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/MessageBroker.ts      # メッセージ処理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ScopeExporter.ts      # スコープエクスポート
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/configManager.ts      # 設定管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/fileManager.ts        # ファイル操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/logger.ts             # ロギング
- [ ] AppGenius//CLAUDE.md                     # プロジェクト中心ドキュメント
- [ ] AppGenius//package.json                  # パッケージ設定
- [ ] AppGenius//tsconfig.json                 # TypeScript設定
- [ ] AppGenius//webpack.config.js             # Webpack設定
- [ ] AppGenius//README.md                     # プロジェクト概要




## 進捗状況
- 完成予定ファイル数: 48
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: 2025-03-06

## ファイル状況

### 完了済みファイル


### 未完了ファイル
- [ ] AppGenius//.vscode/                      # VSCode設定
- [ ] AppGenius//launch.json               # デバッグ設定
- [ ] AppGenius//tasks.json                # タスク設定
- [ ] AppGenius//docs/                         # ドキュメント/requirements.md           # 要件定義
- [ ] AppGenius//docs/                         # ドキュメント/structure.md              # ディレクトリ構造
- [ ] AppGenius//docs/                         # ドキュメント/scope.md                  # 実装スコープ
- [ ] AppGenius//docs/                         # ドキュメント/api.md                    # API設計
- [ ] AppGenius//docs/                         # ドキュメント/env.example               # 環境変数例
- [ ] AppGenius//docs/                         # ドキュメント/CURRENT_STATUS.md         # 現在の開発状況
- [ ] AppGenius//mockups/                      # モックアップと生成物/metadata.json             # モックアップ管理情報
- [ ] AppGenius//mockups/                      # モックアップと生成物/*.html                    # 各モックアップファイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.css                     # 各UI要素のスタイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.js                      # フロントエンドスクリプト
- [ ] AppGenius//media/                        # アセットとスタイル/icon.svg                  # アイコン等
- [ ] AppGenius//src/                          # VSCode拡張ソース/extension.ts              # エントリーポイント
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/aiService.ts          # AI連携
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/codeGenerator.ts      # コード生成
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/gitManager.ts         # Git操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/projectAnalyzer.ts    # プロジェクト分析
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/requirementsParser.ts # 要件解析
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusEventBus.ts  # イベント管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusStateManager.ts # 状態管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/ProjectManagementService.ts # プロジェクト管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/mockupStorageService.ts  # モックアップ保存
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/referenceStorageService.ts # リファレンス管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/dashboard/            # ダッシュボード/DashboardPanel.ts # ダッシュボードパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/requirementManager/   # 要件定義マネージャー/RequirementManagerPanel.ts # 要件パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupGallery/        # モックアップギャラリー/MockupGalleryPanel.ts # モックアップパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupEditor/         # モックアップエディタ/SimpleMockupEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/scopeManager/         # スコープマネージャー/ScopeManagerPanel.ts # スコープパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/developmentAssistant/ # 開発アシスタント/DevelopmentAssistantPanel.ts # 開発パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/referenceManager/     # リファレンスマネージャー/ReferenceManagerPanel.ts # リファレンスパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/claudeMd/             # CLAUDE.mdエディタ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/ClaudeMdEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/sidebarProvider.ts    # サイドバープロバイダ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/statusBar.ts          # ステータスバー
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/CommandHandler.ts     # コマンドハンドラ
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ClaudeMdService.ts    # CLAUDE.md管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/MessageBroker.ts      # メッセージ処理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ScopeExporter.ts      # スコープエクスポート
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/configManager.ts      # 設定管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/fileManager.ts        # ファイル操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/logger.ts             # ロギング
- [ ] AppGenius//CLAUDE.md                     # プロジェクト中心ドキュメント
- [ ] AppGenius//package.json                  # パッケージ設定
- [ ] AppGenius//tsconfig.json                 # TypeScript設定
- [ ] AppGenius//webpack.config.js             # Webpack設定
- [ ] AppGenius//README.md                     # プロジェクト概要




## 進捗状況
- 完成予定ファイル数: 48
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: 2025-03-06

## ファイル状況

### 完了済みファイル


### 未完了ファイル
- [ ] AppGenius//.vscode/                      # VSCode設定
- [ ] AppGenius//launch.json               # デバッグ設定
- [ ] AppGenius//tasks.json                # タスク設定
- [ ] AppGenius//docs/                         # ドキュメント/requirements.md           # 要件定義
- [ ] AppGenius//docs/                         # ドキュメント/structure.md              # ディレクトリ構造
- [ ] AppGenius//docs/                         # ドキュメント/scope.md                  # 実装スコープ
- [ ] AppGenius//docs/                         # ドキュメント/api.md                    # API設計
- [ ] AppGenius//docs/                         # ドキュメント/env.example               # 環境変数例
- [ ] AppGenius//docs/                         # ドキュメント/CURRENT_STATUS.md         # 現在の開発状況
- [ ] AppGenius//mockups/                      # モックアップと生成物/metadata.json             # モックアップ管理情報
- [ ] AppGenius//mockups/                      # モックアップと生成物/*.html                    # 各モックアップファイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.css                     # 各UI要素のスタイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.js                      # フロントエンドスクリプト
- [ ] AppGenius//media/                        # アセットとスタイル/icon.svg                  # アイコン等
- [ ] AppGenius//src/                          # VSCode拡張ソース/extension.ts              # エントリーポイント
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/aiService.ts          # AI連携
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/codeGenerator.ts      # コード生成
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/gitManager.ts         # Git操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/projectAnalyzer.ts    # プロジェクト分析
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/requirementsParser.ts # 要件解析
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusEventBus.ts  # イベント管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusStateManager.ts # 状態管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/ProjectManagementService.ts # プロジェクト管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/mockupStorageService.ts  # モックアップ保存
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/referenceStorageService.ts # リファレンス管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/dashboard/            # ダッシュボード/DashboardPanel.ts # ダッシュボードパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/requirementManager/   # 要件定義マネージャー/RequirementManagerPanel.ts # 要件パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupGallery/        # モックアップギャラリー/MockupGalleryPanel.ts # モックアップパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupEditor/         # モックアップエディタ/SimpleMockupEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/scopeManager/         # スコープマネージャー/ScopeManagerPanel.ts # スコープパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/developmentAssistant/ # 開発アシスタント/DevelopmentAssistantPanel.ts # 開発パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/referenceManager/     # リファレンスマネージャー/ReferenceManagerPanel.ts # リファレンスパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/claudeMd/             # CLAUDE.mdエディタ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/ClaudeMdEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/sidebarProvider.ts    # サイドバープロバイダ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/statusBar.ts          # ステータスバー
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/CommandHandler.ts     # コマンドハンドラ
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ClaudeMdService.ts    # CLAUDE.md管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/MessageBroker.ts      # メッセージ処理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ScopeExporter.ts      # スコープエクスポート
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/configManager.ts      # 設定管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/fileManager.ts        # ファイル操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/logger.ts             # ロギング
- [ ] AppGenius//CLAUDE.md                     # プロジェクト中心ドキュメント
- [ ] AppGenius//package.json                  # パッケージ設定
- [ ] AppGenius//tsconfig.json                 # TypeScript設定
- [ ] AppGenius//webpack.config.js             # Webpack設定
- [ ] AppGenius//README.md                     # プロジェクト概要




## 進捗状況
- 完成予定ファイル数: 48
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: 2025-03-06

## ファイル状況

### 完了済みファイル


### 未完了ファイル
- [ ] AppGenius//.vscode/                      # VSCode設定
- [ ] AppGenius//launch.json               # デバッグ設定
- [ ] AppGenius//tasks.json                # タスク設定
- [ ] AppGenius//docs/                         # ドキュメント/requirements.md           # 要件定義
- [ ] AppGenius//docs/                         # ドキュメント/structure.md              # ディレクトリ構造
- [ ] AppGenius//docs/                         # ドキュメント/scope.md                  # 実装スコープ
- [ ] AppGenius//docs/                         # ドキュメント/api.md                    # API設計
- [ ] AppGenius//docs/                         # ドキュメント/env.example               # 環境変数例
- [ ] AppGenius//docs/                         # ドキュメント/CURRENT_STATUS.md         # 現在の開発状況
- [ ] AppGenius//mockups/                      # モックアップと生成物/metadata.json             # モックアップ管理情報
- [ ] AppGenius//mockups/                      # モックアップと生成物/*.html                    # 各モックアップファイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.css                     # 各UI要素のスタイル
- [ ] AppGenius//media/                        # アセットとスタイル/*.js                      # フロントエンドスクリプト
- [ ] AppGenius//media/                        # アセットとスタイル/icon.svg                  # アイコン等
- [ ] AppGenius//src/                          # VSCode拡張ソース/extension.ts              # エントリーポイント
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/aiService.ts          # AI連携
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/codeGenerator.ts      # コード生成
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/gitManager.ts         # Git操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/projectAnalyzer.ts    # プロジェクト分析
- [ ] AppGenius//src/                          # VSCode拡張ソース/core/                     # コアロジック/requirementsParser.ts # 要件解析
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusEventBus.ts  # イベント管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/AppGeniusStateManager.ts # 状態管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/ProjectManagementService.ts # プロジェクト管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/mockupStorageService.ts  # モックアップ保存
- [ ] AppGenius//src/                          # VSCode拡張ソース/services/                 # サービス層/referenceStorageService.ts # リファレンス管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/dashboard/            # ダッシュボード/DashboardPanel.ts # ダッシュボードパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/requirementManager/   # 要件定義マネージャー/RequirementManagerPanel.ts # 要件パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupGallery/        # モックアップギャラリー/MockupGalleryPanel.ts # モックアップパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/mockupEditor/         # モックアップエディタ/SimpleMockupEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/scopeManager/         # スコープマネージャー/ScopeManagerPanel.ts # スコープパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/developmentAssistant/ # 開発アシスタント/DevelopmentAssistantPanel.ts # 開発パネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/referenceManager/     # リファレンスマネージャー/ReferenceManagerPanel.ts # リファレンスパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/claudeMd/             # CLAUDE.mdエディタ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/ClaudeMdEditorPanel.ts # エディタパネル
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/sidebarProvider.ts    # サイドバープロバイダ
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/statusBar.ts          # ステータスバー
- [ ] AppGenius//src/                          # VSCode拡張ソース/ui/                       # UI関連/CommandHandler.ts     # コマンドハンドラ
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ClaudeMdService.ts    # CLAUDE.md管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/MessageBroker.ts      # メッセージ処理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/ScopeExporter.ts      # スコープエクスポート
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/configManager.ts      # 設定管理
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/fileManager.ts        # ファイル操作
- [ ] AppGenius//src/                          # VSCode拡張ソース/utils/                    # ユーティリティ/logger.ts             # ロギング
- [ ] AppGenius//CLAUDE.md                     # プロジェクト中心ドキュメント
- [ ] AppGenius//package.json                  # パッケージ設定
- [ ] AppGenius//tsconfig.json                 # TypeScript設定
- [ ] AppGenius//webpack.config.js             # Webpack設定
- [ ] AppGenius//README.md                     # プロジェクト概要


