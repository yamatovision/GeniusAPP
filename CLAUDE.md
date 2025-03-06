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

現在は**フェーズ2: 設計フェーズツール**段階です。

1. **フェーズ1**: CLAUDE.md管理システム、チャットUI、ダッシュボード（完了）
2. **フェーズ2**: 要件定義・構造マネージャー、モックアップギャラリー、スコープ計画（進行中）
3. **フェーズ3**: スコープ実装アシスタント、デバッグサポート（予定）
4. **フェーズ4**: API連携・環境設定、デプロイ支援（予定）

## 開発ワークフロー

AppGeniusでは以下のような開発ワークフローを推奨しています：

1. **プロジェクト作成/読み込み**: ダッシュボードで新規プロジェクト作成または既存プロジェクト読み込み
   - 新規プロジェクト作成時には必要なフォルダ構造とテンプレートが自動生成される

2. **要件定義**: VSCodeでの要件定義をAIとの対話で作成
   - `requirements.md`が生成・更新される
   - 要件に基づき`mockups/`内に各ページのモックアップHTMLが自動生成される

3. **モックアップ開発**: モックアップギャラリーで視覚的に確認・改善
   - AIとの対話でモックアップを反復的に改善
   - 完成したモックアップごとに`docs/scopes/`内に対応する要件が生成される

4. **スコープ設計**: スコープマネージャーで実装単位を定義
   - `Scope_Manager_Prompt.md`の指示に基づいてAIがスコープを設計
   - `scope.md`（実装スコープの定義）を生成
   - `structure.md`（ディレクトリ構造）を生成

5. **実装フェーズ**: スコープ実装アシスタントでコード生成
   - スコープ単位にClaudeCodeへの実装指示を生成
   - 各スコープを優先順位に沿って順番に実装
   - 実装状況を`CURRENT_STATUS.md`に自動反映

6. **デバッグ・デプロイ**: 完成したアプリケーションのテストとデプロイ
   - エラー検出と修正支援
   - デプロイガイダンス

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
- [スコープマネージャープロンプト](./docs/Scope_Manager_Prompt.md) - スコープ設計AIプロンプト
- [スコープ実装アシスタントプロンプト](./docs/Scope_Implementation_Assistant_Prompt.md) - 実装アシスタントAIプロンプト
- [個別スコープ要件](./docs/scopes/) - 各ページ/機能ごとの詳細要件

## プロジェクト構造

新規プロジェクト作成時に以下の構造が自動生成されます：
```
CLAUDE.md                        # プロジェクト中心情報
docs/
  api.md                         # API定義
  CURRENT_STATUS.md              # 進捗状況
  env.example                    # 環境変数例
  requirements.md                # 要件定義
  requirementsadvicer.md         # 要件定義アドバイザー
  Scope_Manager_Prompt.md        # スコープ設計AIプロンプト
  Scope_Implementation_Assistant_Prompt.md # 実装アシスタントAIプロンプト
  scope.md                       # 実装スコープ定義
  scopes/                        # 個別ページの要件
  structure.md                   # ディレクトリ構造
mockups/                         # モックアップファイル
reference/                       # 参照情報
```

## 開発コマンド

```bash
# VSCode拡張 開発
cd AppGenius
npm install
npm run watch  # 開発モード
npm run package  # パッケージング
```

## プロジェクトパスの取り扱い

AppGeniusの各コンポーネントはプロジェクトごとに独立したファイルを管理します。以下の点に注意してください：

1. **パスの受け渡し**: UI要素間で必ずプロジェクトパスを引数として渡すこと
   ```typescript
   // 正しいパスの渡し方
   vscode.commands.executeCommand('appgenius-ai.openXXX', projectPath);
   ```

2. **パス参照の優先順位**:
   - コマンド引数で渡されたパス
   - アクティブプロジェクトのパス
   - ワークスペースのルートパス

3. **固定パスの禁止**: ハードコードされたパスを使用しないこと
   ```typescript
   // 悪い例
   const appGeniusPath = '/Users/xxx/AppGenius';
   
   // 良い例
   const basePath = this._projectPath || '';
   ```

4. **パス情報のログ出力**: デバッグのため使用しているパスの情報をログに残すこと
   ```typescript
   Logger.info(`プロジェクトパスを使用: ${basePath}`);
   ```

現在、以下のコンポーネントはプロジェクトパスを適切に扱うよう修正されています：
- ダッシュボード (DashboardPanel)
- 要件定義エディタ (SimpleChatPanel)
- モックアップギャラリー (MockupGalleryPanel)
- 実装スコープ選択 (ImplementationSelectorPanel)

## コーディング規約
- クラス名: PascalCase
- メソッド名: camelCase
- プライベート変数: _camelCase
- 定数: UPPER_CASE
- インターフェース名: IPascalCase
- 型名: TPascalCase

## プロジェクトテンプレートキットの管理

### テンプレートキット概要

新規プロジェクト作成時に自動生成される以下のテンプレートキットは、開発ワークフローの土台となる重要な要素です：

```
CLAUDE.md                        # プロジェクト中心情報
docs/
  api.md                         # API定義
  CURRENT_STATUS.md              # 進捗状況
  env.example                    # 環境変数例
  requirements.md                # 要件定義
  requirementsadvicer.md         # 要件定義アドバイザー
  Scope_Manager_Prompt.md        # スコープ設計AIプロンプト
  Scope_Implementation_Assistant_Prompt.md # 実装アシスタントAIプロンプト
  scope.md                       # 実装スコープ定義
  scopes/                        # 個別ページの要件
  structure.md                   # ディレクトリ構造
mockups/                         # モックアップファイル
reference/                       # 参照情報
```

### テンプレート更新方法

テンプレートキットを更新する場合は、以下の手順に従ってください：

1. **テンプレート定義の更新**
   - `src/utils/ClaudeMdService.ts`の`getDefaultTemplate()`メソッドでCLAUDE.mdテンプレートを更新
   - `src/services/ProjectManagementService.ts`の`createInitialDocuments()`メソッドで各ドキュメントテンプレートを更新

2. **テスト方法**
   - ダッシュボードから新規プロジェクト作成を行い、生成されるファイルを確認
   - すべてのテンプレートが正しく生成されていることを確認

3. **更新時の注意点**
   - 既存プロジェクトへの影響を最小限に抑えるために、互換性を維持する
   - 大きな変更がある場合は、マイグレーションツールやガイダンスを提供する
   - プロンプトの変更は、AI応答の一貫性に影響するため慎重に行う

### テンプレート連携の仕組み

1. **プロジェクト作成時の流れ**
   - ダッシュボードパネルが`_handleCreateProject`メソッドを呼び出し
   - `ProjectManagementService`の`createProject`メソッドでプロジェクト構造作成
   - `createInitialDocuments`メソッドで各テンプレートファイルを生成
   - `ClaudeMdService`の`generateClaudeMd`でCLAUDE.mdを生成

2. **テンプレート間の連携**
   - CLAUDE.mdが中心となり、他のドキュメントへの参照を提供
   - 各AIプロンプトは対応するドキュメントを参照して機能を提供
   - 進捗状況はCURRENT_STATUS.mdに反映され、ダッシュボードに表示される
## 進捗状況
- 完成予定ファイル数: 48
- 作成済みファイル数: 11
- 進捗率: 23%
- 最終更新日: 2025-03-07

## ファイル状況

### 完了済みファイル
- [x] media/scopeManager.css
- [x] media/scopeManager.js
- [x] media/dashboard.css
- [x] media/dashboard.js
- [x] src/ui/scopeManager/ScopeManagerPanel.ts
- [x] src/services/ClaudeCodeLauncherService.ts
- [x] src/ui/mockupGallery/MockupGalleryPanel.ts
- [x] src/ui/dashboard/DashboardPanel.ts
- [x] CLAUDE.md
- [x] docs/CURRENT_STATUS.md
- [x] docs/Scope_Manager_Prompt.md

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


