# AppGenius プロジェクトディレクトリ構造

このファイルはAppGeniusプロジェクトの改善されたディレクトリ構造を定義します。現在の実装を活かしつつ、要件に基づいて最適化された構造です。

```
AppGenius/
├── .vscode/                      # VSCode設定
│   ├── launch.json               # デバッグ設定
│   └── tasks.json                # タスク設定
├── docs/                         # ドキュメント
│   ├── requirements.md           # 要件定義
│   ├── structure.md              # ディレクトリ構造
│   ├── scope.md                  # 実装スコープ
│   ├── api.md                    # API設計
│   ├── env.example               # 環境変数例
│   ├── CURRENT_STATUS.md         # 現在の開発状況
│   ├── Scope_Manager_Prompt.md   # スコープ設計AIプロンプト
│   ├── Scope_Implementation_Assistant_Prompt.md # 実装アシスタントAIプロンプト
│   └── scopes/                   # 個別ページ・機能の要件定義
├── mockups/                      # モックアップと生成物
│   ├── metadata.json             # モックアップ管理情報
│   └── *.html                    # 各モックアップファイル
├── media/                        # アセットとスタイル
│   ├── *.css                     # 各UI要素のスタイル
│   ├── *.js                      # フロントエンドスクリプト
│   └── icon.svg                  # アイコン等
├── src/                          # VSCode拡張ソース
│   ├── extension.ts              # エントリーポイント
│   ├── core/                     # コアロジック
│   │   ├── aiService.ts          # AI連携
│   │   ├── codeGenerator.ts      # コード生成
│   │   ├── gitManager.ts         # Git操作
│   │   ├── projectAnalyzer.ts    # プロジェクト分析
│   │   └── requirementsParser.ts # 要件解析
│   ├── modes/                    # 動作モード（既存構造を維持）
│   │   ├── designMode/           # デザインモード
│   │   ├── developmentMode/      # 開発モード
│   │   ├── implementationMode/   # 実装モード
│   │   └── requirementMode/      # 要件モード
│   ├── services/                 # サービス層
│   │   ├── AppGeniusEventBus.ts  # イベント管理
│   │   ├── AppGeniusStateManager.ts # 状態管理
│   │   ├── ProjectManagementService.ts # プロジェクト管理
│   │   ├── mockupStorageService.ts  # モックアップ保存
│   │   └── referenceStorageService.ts # リファレンス管理
│   ├── ui/                       # UI関連
│   │   ├── components/           # 共通UIコンポーネント
│   │   ├── webview/              # WebView関連
│   │   │   ├── components/       # WebViewコンポーネント
│   │   │   ├── scripts/          # WebViewスクリプト
│   │   │   └── styles/           # WebViewスタイル
│   │   ├── dashboard/            # ダッシュボード
│   │   │   └── DashboardPanel.ts # ダッシュボードパネル
│   │   ├── requirementManager/   # 要件定義マネージャー
│   │   │   └── RequirementManagerPanel.ts # 要件パネル
│   │   ├── mockupGallery/        # モックアップギャラリー
│   │   │   └── MockupGalleryPanel.ts # モックアップパネル
│   │   ├── mockupEditor/         # モックアップエディタ
│   │   │   └── SimpleMockupEditorPanel.ts # エディタパネル
│   │   ├── scopeManager/         # スコープマネージャー
│   │   │   └── ScopeManagerPanel.ts # スコープパネル
│   │   ├── scopeImplementationAssistant/ # スコープ実装アシスタント
│   │   │   └── ScopeImplementationAssistantPanel.ts # 実装アシスタントパネル
│   │   ├── referenceManager/     # リファレンスマネージャー
│   │   │   └── ReferenceManagerPanel.ts # リファレンスパネル
│   │   ├── claudeMd/             # CLAUDE.mdエディタ
│   │   │   └── ClaudeMdEditorPanel.ts # エディタパネル
│   │   ├── sidebarProvider.ts    # サイドバープロバイダ
│   │   ├── statusBar.ts          # ステータスバー
│   │   └── CommandHandler.ts     # コマンドハンドラ
│   └── utils/                    # ユーティリティ
│       ├── ClaudeMdService.ts    # CLAUDE.md管理
│       ├── MessageBroker.ts      # メッセージ処理
│       ├── ScopeExporter.ts      # スコープエクスポート
│       ├── configManager.ts      # 設定管理
│       ├── fileManager.ts        # ファイル操作
│       └── logger.ts             # ロギング
├── test/                         # テストコード
│   ├── integration/              # 統合テスト
│   └── unit/                     # ユニットテスト
├── CLAUDE.md                     # プロジェクト中心ドキュメント
├── package.json                  # パッケージ設定
├── tsconfig.json                 # TypeScript設定
├── webpack.config.js             # Webpack設定
└── README.md                     # プロジェクト概要
```

## プロジェクト構造の主な改善点

1. **現在の実装を維持**: 既存の `modes/` ディレクトリ構造を維持し、機能を追加
2. **UI構造の整理**: `ui/` ディレクトリをより論理的に構造化し、各機能ごとにサブディレクトリを整理
3. **requirementManager の追加**: 要件定義管理用のディレクトリを追加
4. **scopeManager の追加**: スコープ管理用のディレクトリを追加
5. **components の整理**: 共通コンポーネントを `ui/components/` に集約
6. **CLI 部分の削除**: 不要なCLI関連ファイルを削除
7. **webview の整理**: WebView関連ファイルを適切に構造化

## ディレクトリと責任の分離

### core/
中核機能とビジネスロジックを格納。AIサービス、コード生成、プロジェクト分析など基本機能を提供。

### modes/
開発プロセスの各段階（設計、開発、実装、要件）に関する機能を格納。既存の構造を維持して拡張。

### services/
横断的なサービスを提供。イベント管理、状態管理、ストレージサービスなど。

### ui/
ユーザーインターフェースに関する全てのコンポーネントを整理。各機能別にサブディレクトリを設け、関連するパネルやコンポーネントを格納。

### utils/
ユーティリティ機能。ファイル操作、ロギング、設定管理などの共通機能を提供。

## 移行戦略

1. まず、既存のファイルの移動なしで新しいファイルの作成場所を決定
2. 必要に応じて、既存ファイルを適切な場所に段階的に移動
3. `CLAUDE.md` の実装対象ファイルセクションを更新し、新構造を反映

## 注意点

- ファイル移動時は import パスの更新に注意
- テスト時は機能への影響を最小限に抑える
- コミット単位は小さく、影響範囲を限定する