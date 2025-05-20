# AppGenius 理想的ドキュメント構造と開発フロー整備計画ああ
## 1. 基本情報

- **進捗状況**: 進行中 (79% 完了)
- **完了タスク数**: 19/24
- **進捗率**: 79.2%
- **最終更新日**: 2025-05-13
- **最終更新内容**: ドキュメント管理構造の改善とプロンプト追加

## 2. 実装概要

AppGeniusの開発プロセスを効率化するため、最適化されたドキュメント構造と開発フローを確立します。シンプルで論理的なドキュメントの階層構造を設計し、モックアップを中心としたAIエージェント協働システムを整備します。これにより、非技術者でも理解しやすい開発プロセスと、AIエージェント間の円滑な連携を実現します。

この計画は、後続のAIエージェントシステム完成計画（2025-05-20開始予定）の基盤となるものです。ドキュメント構造と開発フローの整備を通じて、各AIエージェントの能力を最大化し、相互連携を強化するための準備を行います。

## 3. 現在のディレクトリ構造

```
project/
├── docs/                           # ドキュメントのルートディレクトリ
│   ├── requirements.md             # プロジェクト全体の要件定義書
│   ├── SCOPE_PROGRESS.md           # スコープ進捗状況とタスクリスト（中心的文書）
│   │
│   ├── plans/                      # すべての計画ドキュメント
│   │   ├── planning/               # 計画段階、まだ実装に着手していないもの
│   │   │   ├── ext-docs-auto-refresh-20250514.md     # 自動更新機能の計画
│   │   │   └── portal-2025-05-13.md                  # ポータル機能の改善計画
│   │   └── in-progress/            # 実装中の計画ドキュメント
│   │
│   ├── architecture/               # アーキテクチャ関連ドキュメント
│   │   ├── agent-communication-protocol.md  # エージェント間通信プロトコル
│   │   ├── document-references.md           # ドキュメント参照関係定義
│   │   ├── file-naming-metadata-standards.md  # ファイル命名規約
│   │   ├── reference-map.md                 # ドキュメント参照マップ
│   │   └── reference-validation.md          # 参照検証ガイドライン
│   │
│   ├── api/                        # API仕様書
│   │   ├── api-key-fix-guide.md            # APIキー修正ガイド
│   │   ├── api_key_fix_verification.md     # APIキー修正確認手順
│   │   └── url-guidelines.md               # URL設計ガイドライン
│   │
│   ├── deployment/                 # デプロイ関連
│   │   ├── deploy-history.md               # デプロイ履歴
│   │   └── deploy.md                       # デプロイ手順書
│   │
│   ├── refactoring/                # リファクタリング計画
│   │   ├── AppGenius-BlueLamp-2025-05-14.md         # BlueLamp実装計画
│   │   ├── AppGenius-BlueLamp-Minimal-2025-05-14.md # 最小BlueLamp実装
│   │   ├── AuthStatusBar-2025-05-14.md              # 認証状態バー改善
│   │   ├── AuthStatusBar-Fix-2025-05-14.md          # 認証状態バー修正
│   │   ├── AuthStatusBar-Solution-2025-05-14.md     # 認証状態バー解決策
│   │   ├── ClaudeCodeAuthSync-2025-05-13.md         # Claude同期改善
│   │   ├── PanelService-2025-05-14.md               # パネルサービス改善
│   │   ├── archive/                                  # 完了したリファクタリング
│   │   │   └── completed/                           # 完了サブフォルダ
│   │   │       └── auth-directory-2025-05-13.md     # 認証ディレクトリ整理
│   │   ├── auth-cleanup-2025-05-13.md               # 認証関連コード整理
│   │   ├── auth-directory-2025-05-13.md             # 認証ディレクトリ構成
│   │   ├── backend-url-migration-2025-05-14.md      # バックエンドURL移行
│   │   ├── promptmanager-removal-plan.md            # プロンプトマネージャー削除
│   │   ├── requirementsParser-2025-05-13.md         # 要件パーサー改善
│   │   ├── src-cleanup-2025-05-13.md                # ソースコード整理
│   │   ├── src-cleanup-2025-05-14.md                # ソースコード整理続き
│   │   └── src-structure-2025-05-13.md              # ソース構造改善
│   │
│   ├── archive/                    # アーカイブ
│   │   ├── completed/                              # 完了した計画
│   │   │   └── mediaフォルダ_リファクタリング計画_完了.md  # メディアフォルダ計画
│   │   ├── dashboard_routing_fix_guide.md          # ダッシュボード修正
│   │   ├── fix-guide.md                            # 一般修正ガイド
│   │   ├── markdown_parser_analysis.md             # マークダウンパーサー分析
│   │   └── markdown_viewer_requirements_analysis.md # マークダウンビューワー分析
│   │
│   ├── templates/                  # テンプレート
│   │   ├── CLAUDETEMPLATE.md                      # Claude用テンプレート
│   │   ├── README.md                              # テンプレート説明
│   │   ├── SCOPE_PROGRESS_TEMPLATE.md             # 進捗テンプレート
│   │   ├── claude-template.md                     # 別のClaude用テンプレート
│   │   ├── markdown-template-guide.md             # マークダウン書式ガイド
│   │   ├── prompts/                               # プロンプトテンプレート
│   │   │   ├── api-designer-template.md           # APIデザイナーテンプレート
│   │   │   ├── data-model-architect-template.md   # データモデルテンプレート
│   │   │   ├── mockup-creator-template.md         # モックアップテンプレート
│   │   │   ├── project-analysis-template.md       # プロジェクト分析テンプレート
│   │   │   ├── project-analyst-template.md        # プロジェクト分析者テンプレート
│   │   │   ├── requirements-creator-template.md   # 要件定義テンプレート
│   │   │   └── scope-planner-template.md          # スコープ計画テンプレート
│   │   ├── samples/                               # サンプル
│   │   │   └── initial-scope-progress-template.md  # 初期進捗テンプレート
│   │   └── scope-progress-template.md              # スコープ進捗テンプレート
│   │
│   └── prompts/                    # プロンプト定義
│       ├── core/                                    # コアプロンプト
│       │   ├── 01-requirements-creator.md           # 要件定義作成
│       │   ├── 02-system-architecture.md            # システムアーキテクチャ
│       │   ├── 03-mockup-creator-analyzer.md        # モックアップ作成
│       │   ├── 04-data-model-assistant.md           # データモデル作成
│       │   ├── 05-tukkomi.md                        # ツッコミ
│       │   ├── 06-env-assistant.md                  # 環境構築
│       │   ├── 07-auth-system-assistant.md          # 認証システム
│       │   ├── 08-deploy-assistant.md               # デプロイ
│       │   ├── 09-git-manager.md                    # Git管理
│       │   ├── 10-implementation-task-analyzer.md   # 実装タスク分析
│       │   ├── 11-scope-implementer.md              # スコープ実装
│       │   ├── 12-test-manager.md                   # テスト管理
│       │   ├── 13-debug-detective.md                # デバッグ
│       │   ├── 14-feature-implementation-assistant.md # 機能実装
│       │   └── 15-refactoring-expert.md             # リファクタリング
│       ├── specialized/                             # 特化型プロンプト
│       │   ├── debug_detective.md                   # デバッグ探偵
│       │   ├── environment_manager.md               # 環境管理
│       │   ├── feature-extension-planner-ja.md      # 機能拡張計画
│       │   ├── github-upload-manager-ja.md          # GitHub管理（日本語）
│       │   ├── github_upload_manager.md             # GitHub管理
│       │   ├── improved_refactoring_manager.md      # 改良リファクタリング
│       │   ├── mockup_analyzer.md                   # モックアップ分析
│       │   └── verification_assistant.md            # 検証支援
│       └── templates/                               # テンプレートディレクトリ
│
├── mockups/                        # モックアップのルートディレクトリ
│   ├── README.md                               # モックアップ説明
│   ├── bot-creator-minimal.html                # ボット作成（最小）
│   ├── career_compass.html                     # キャリアコンパス
│   ├── claude-code-sharing.md                  # コード共有
│   ├── dashboard-hub-spoke.html                # ハブスポークダッシュボード
│   ├── enhanced-scope-manager.html             # 強化スコープマネージャー
│   ├── file-browser-with-markdown.html         # マークダウンブラウザ
│   ├── fortune_daily.html                      # デイリーフォーチュン
│   ├── manager_dashboard.html                  # マネージャーダッシュボード
│   ├── mockup_1741743381502/                   # 日付付きモックアップ
│   │   └── index.html                          # モックアップインデックス
│   ├── scope-manager-with-prompts-copy.html    # プロンプト付きスコープマネージャー
│   ├── scope-manager-with-tools.html           # ツール付きスコープマネージャー
│   ├── simplified-dashboard.html               # シンプルダッシュボード
│   ├── vscode-auth-mockup.html                 # VSCode認証モックアップ
│   └── モックアップ_2025-03-12_1033.html      # 日本語モックアップ
│
├── media/                          # メディアファイル
│   ├── assets/                                 # 静的アセット
│   │   ├── icon.svg                            # アイコン
│   │   ├── logos/                              # ロゴ
│   │   │   ├── bluelamp-logo.png               # BlueLampロゴ
│   │   │   └── bluelamp-logo3.png              # BlueLampロゴ3
│   │   └── sherlock.svg                        # シャーロックアイコン
│   ├── components/                             # コンポーネント
│   │   ├── auth/                               # 認証コンポーネント
│   │   │   ├── index.html                      # 認証インデックス
│   │   │   ├── script.js                       # 認証スクリプト
│   │   │   └── style.css                       # 認証スタイル
│   │   ├── dialogManager/                      # ダイアログマネージャー
│   │   │   ├── dialogManager.css               # ダイアログスタイル
│   │   │   └── dialogManager.js                # ダイアログスクリプト
│   │   ├── markdownViewer/                     # マークダウンビューワー
│   │   │   ├── markdownViewer.css              # マークダウンスタイル
│   │   │   └── markdownViewer.js               # マークダウンスクリプト
│   │   ├── mockupGallery/                      # モックアップギャラリー
│   │   │   ├── mockupGallery.css               # ギャラリースタイル
│   │   │   └── mockupGallery.js                # ギャラリースクリプト
│   │   ├── projectNavigation/                  # プロジェクトナビゲーション
│   │   │   ├── projectNavigation.css           # ナビゲーションスタイル
│   │   │   └── projectNavigation.js            # ナビゲーションスクリプト
│   │   ├── promptCards/                        # プロンプトカード
│   │   │   ├── promptCards.css                 # カードスタイル
│   │   │   └── promptCards.js                  # カードスクリプト
│   │   ├── sharingPanel/                       # 共有パネル
│   │   │   └── sharingPanel.js                 # 共有スクリプト
│   │   └── tabManager/                         # タブマネージャー
│   │       ├── tabManager.css                  # タブスタイル
│   │       └── tabManager.js                   # タブスクリプト
│   ├── core/                                   # コア機能
│   │   ├── messageDispatcher.js                # メッセージディスパッチャー
│   │   └── stateManager.js                     # 状態管理
│   ├── fileViewer/                             # ファイルビューワー
│   │   ├── fileViewer.css                      # ビューワースタイル
│   │   └── fileViewer.js                       # ビューワースクリプト
│   ├── noProjectView/                          # プロジェクト未選択時ビュー
│   │   ├── noProjectView.css                   # スタイル
│   │   └── noProjectView.html                  # HTML
│   ├── scopeManager.css                        # スコープマネージャースタイル
│   ├── scopeManager.js                         # スコープマネージャースクリプト
│   ├── styles/                                 # スタイル定義
│   │   ├── components.css                      # コンポーネントスタイル
│   │   ├── design-system.css                   # デザインシステム
│   │   ├── reset.css                           # リセットCSS
│   │   └── vscode.css                          # VSCodeテーマ
│   └── utils/                                  # ユーティリティ
│       ├── messageHandler.js                   # メッセージハンドラー
│       ├── serviceConnector.js                 # サービスコネクター
│       ├── simpleMarkdownConverter.js          # マークダウン変換
│       └── uiHelpers.js                        # UI支援関数
│
├── src/                            # ソースコード
│   ├── api/                                    # API関連
│   │   └── claudeCodeApiClient.ts              # Claude Code API
│   ├── commands/                               # コマンド
│   │   ├── claudeCodeCommands.ts               # Claude Codeコマンド
│   │   └── fileViewerCommands.ts               # ファイルビューワーコマンド
│   ├── config/                                 # 設定
│   │   └── apiConfig.ts                        # API設定
│   ├── core/                                   # コア機能
│   │   └── auth/                               # 認証
│   │       ├── AuthState.ts                    # 認証状態
│   │       ├── PermissionManager.ts            # 権限管理
│   │       ├── SimpleAuthManager.ts            # シンプル認証
│   │       ├── SimpleAuthService.ts            # 認証サービス
│   │       ├── authCommands.ts                 # 認証コマンド
│   │       └── roles.ts                        # ロール定義
│   ├── extension.ts                            # エクステンションメイン
│   ├── services/                               # サービス
│   │   ├── AppGeniusEventBus.ts                # イベントバス
│   │   ├── ClaudeCodeIntegrationService.ts     # Claude連携
│   │   ├── ClaudeCodeLauncherService.ts        # Claude起動
│   │   ├── ClaudeCodeSharingService.ts         # Claude共有
│   │   ├── ProjectManagementService.ts         # プロジェクト管理
│   │   ├── PromptServiceClient.ts              # プロンプトサービス
│   │   ├── launcher/                           # 起動関連
│   │   │   ├── CoreLauncherService.ts          # コア起動サービス
│   │   │   ├── LauncherTypes.ts                # 起動タイプ
│   │   │   ├── SpecializedLaunchHandlers.ts    # 特化起動ハンドラ
│   │   │   ├── TerminalProvisionService.ts     # ターミナル準備
│   │   │   └── index.ts                        # インデックス
│   │   └── mockupStorageService.ts             # モックアップ保存
│   ├── types/                                  # 型定義
│   │   ├── SharingTypes.ts                     # 共有関連型
│   │   └── index.ts                            # 型インデックス
│   ├── ui/                                     # UI関連
│   │   ├── auth/                               # 認証UI
│   │   │   ├── AuthGuard.ts                    # 認証ガード
│   │   │   ├── AuthStatusBar.ts                # 認証ステータスバー
│   │   │   ├── LoginWebviewPanel.ts            # ログインパネル
│   │   │   ├── LogoutNotification.ts           # ログアウト通知
│   │   │   └── ProtectedPanel.ts               # 保護パネル
│   │   ├── fileViewer/                         # ファイルビューワーUI
│   │   │   └── FileViewerPanel.ts              # ビューワーパネル
│   │   ├── mockupGallery/                      # モックアップギャラリー
│   │   │   └── MockupGalleryPanel.ts           # ギャラリーパネル
│   │   ├── noProjectView/                      # プロジェクト未選択UI
│   │   │   ├── NoProjectViewPanel.ts           # パネル
│   │   │   └── noProjectView.css               # スタイル
│   │   ├── scopeManager/                       # スコープマネージャー
│   │   │   ├── ScopeManagerPanel.ts            # マネージャーパネル
│   │   │   ├── services/                       # サービス
│   │   │   │   ├── AuthenticationHandler.ts    # 認証ハンドラー
│   │   │   │   ├── FileSystemService.ts        # ファイルシステム
│   │   │   │   ├── FileWatcherService.ts       # ファイル監視
│   │   │   │   ├── ProjectService.ts           # プロジェクト
│   │   │   │   ├── ServiceFactory.ts           # サービスファクトリー
│   │   │   │   ├── SharingService.ts           # 共有
│   │   │   │   ├── TabStateService.ts          # タブ状態
│   │   │   │   ├── UIStateService.ts           # UI状態
│   │   │   │   ├── implementations/            # 実装
│   │   │   │   │   ├── FileSystemServiceImpl.ts  # ファイルシステム実装
│   │   │   │   │   ├── FileWatcherServiceImpl.ts # ファイル監視実装
│   │   │   │   │   ├── MessageDispatchServiceImpl.ts # メッセージ実装
│   │   │   │   │   ├── ProjectServiceImpl.ts   # プロジェクト実装
│   │   │   │   │   └── TabStateServiceImpl.ts  # タブ状態実装
│   │   │   │   ├── interfaces/                 # インターフェース
│   │   │   │   │   ├── IFileSystemService.ts   # ファイルシステム
│   │   │   │   │   ├── IFileWatcherService.ts  # ファイル監視
│   │   │   │   │   ├── IMessageDispatchService.ts # メッセージ
│   │   │   │   │   ├── IPanelService.ts        # パネル
│   │   │   │   │   ├── IProjectService.ts      # プロジェクト
│   │   │   │   │   ├── ISharingService.ts      # 共有
│   │   │   │   │   ├── ITabStateService.ts     # タブ状態
│   │   │   │   │   ├── IUIStateService.ts      # UI状態
│   │   │   │   │   ├── IWebViewCommunication.ts # Web通信
│   │   │   │   │   ├── common.ts               # 共通
│   │   │   │   │   └── index.ts                # インデックス
│   │   │   │   └── messageHandlers/            # メッセージハンドラー
│   │   │   │       ├── MockupMessageHandler.ts # モックアップ
│   │   │   │       ├── ProjectMessageHandler.ts # プロジェクト
│   │   │   │       ├── ScopeManagerMessageHandler.ts # スコープ
│   │   │   │       ├── SharingMessageHandler.ts # 共有
│   │   │   │       ├── index.ts                # インデックス
│   │   │   │       └── types.ts                # タイプ
│   │   │   ├── templates/                      # テンプレート
│   │   │   │   ├── HtmlTemplateGenerator.ts    # HTML生成
│   │   │   │   └── ScopeManagerTemplate.ts     # スコープテンプレート
│   │   │   └── types/                          # 型定義
│   │   │       └── ScopeManagerTypes.ts        # スコープ型
│   │   └── statusBar.ts                        # ステータスバー
│   └── utils/                                  # ユーティリティ
│       ├── AuthStorageManager.ts               # 認証保存
│       ├── ClaudeMdService.ts                  # ClaudeMd
│       ├── ErrorHandler.ts                     # エラー処理
│       ├── MarkdownManager.ts                  # マークダウン管理
│       ├── MessageBroker.ts                    # メッセージ仲介
│       ├── PlatformManager.ts                  # プラットフォーム
│       ├── ScopeExporter.ts                    # スコープエクスポート
│       ├── TempFileManager.ts                  # 一時ファイル
│       ├── fileOperationManager.ts             # ファイル操作
│       └── logger.ts                           # ロガー
│
├── portal/                         # ポータル関連
│   ├── backend/                               # バックエンド
│   │   ├── app.js                             # アプリケーション
│   │   ├── config/                            # 設定
│   │   ├── controllers/                       # コントローラー
│   │   ├── middlewares/                       # ミドルウェア
│   │   ├── models/                            # モデル
│   │   ├── routes/                            # ルート
│   │   ├── services/                          # サービス
│   │   ├── tests/                             # テスト
│   │   └── utils/                             # ユーティリティ
│   ├── frontend/                              # フロントエンド
│   │   ├── public/                            # 公開ファイル
│   │   └── src/                               # ソースコード
│   │       ├── App.js                         # アプリケーション
│   │       ├── auth/                          # 認証
│   │       ├── components/                    # コンポーネント
│   │       ├── config/                        # 設定
│   │       ├── contexts/                      # コンテキスト
│   │       ├── index.js                       # インデックス
│   │       ├── services/                      # サービス
│   │       └── utils/                         # ユーティリティ
│   └── scripts/                               # スクリプト
│       ├── check-apikeys.js                   # APIキー確認
│       ├── create-simple-admin.js             # 管理者作成
│       ├── data/                              # データ
│       └── import-anthropic-api-keys.js       # APIキーインポート
│
├── test/                           # テスト
│   ├── integration/                           # 統合テスト
│   │   └── auth/                              # 認証テスト
│   ├── mocks/                                 # モック
│   │   ├── fs.mock.js                         # ファイルシステムモック
│   │   ├── fs.mock.ts                         # ファイルシステムモック
│   │   ├── vscode.mock.js                     # VSCodeモック
│   │   └── vscode.mock.ts                     # VSCodeモック
│   ├── plan/                                  # テスト計画
│   │   ├── acceptance-test-plan.md            # 受け入れテスト計画
│   │   ├── integration-test-plan.md           # 統合テスト計画
│   │   └── module-test-plan.md                # モジュールテスト計画
│   ├── temp_results/                          # 一時結果
│   │   ├── api_tests_results.txt              # APIテスト結果
│   │   ├── performance_tests_results.txt      # パフォーマンステスト結果
│   │   ├── security_tests_results.txt         # セキュリティテスト結果
│   │   └── unit_tests_results.txt             # ユニットテスト結果
│   ├── tsconfig.json                          # TypeScript設定
│   ├── unit/                                  # ユニットテスト
│   │   ├── auth/                              # 認証テスト
│   │   └── scopeManager/                      # スコープテスト
│   └── verification/                          # 検証テスト
│       ├── api_tests.js                       # APIテスト
│       ├── manual/                            # 手動テスト
│       │   ├── auth_verification.md           # 認証検証
│       │   ├── cross_browser_verification.md  # ブラウザ検証
│       │   ├── dashboard_verification.md      # ダッシュボード検証
│       │   └── ui_verification.md             # UI検証
│       ├── performance_tests.js               # パフォーマンステスト
│       ├── report_generator.js                # レポート生成
│       ├── security_tests.js                  # セキュリティテスト
│       └── unit_tests.js                      # ユニットテスト
│
└── scripts/                        # スクリプト
    ├── debug/                                 # デバッグ
    │   ├── claude_code_counter_debug.ts       # カウンターデバッグ
    │   ├── claude_code_counter_event_listener.js # イベントリスナー
    │   ├── claude_code_counter_event_listener.ts # イベントリスナー
    │   ├── debug_api_key_save.js              # キー保存デバッグ
    │   ├── debug_claude_counter.js            # カウンターデバッグ
    │   └── debug_storage.js                   # ストレージデバッグ
    └── utils/                                 # ユーティリティ
        ├── api_auth_fix.patch.js              # 認証修正パッチ
        ├── api_endpoint_test.js               # エンドポイントテスト
        ├── check_api_keys.js                  # APIキー確認
        ├── check_api_keys_with_orgs.js        # 組織付きキー確認
        ├── check_claudecode_counter.js        # カウンター確認
        ├── check_recent_api_keys.js           # 最近のキー確認
        ├── check_simple_user_data.js          # ユーザーデータ確認
        ├── check_simpleuser.js                # シンプルユーザー確認
        ├── check_user_api_key.js              # ユーザーキー確認
        ├── check_user_role.js                 # ユーザーロール確認
        ├── connect_mongosh.js                 # MongoDBシェル接続
        ├── dashboard_quickfix.js              # ダッシュボード修正
        ├── dashboard_routing_fix.js           # ルーティング修正
        ├── fix_api_keys.js                    # APIキー修正
        ├── fix_claudecode_counter_implementation.js # カウンター実装修正
        ├── import_single_api_key.js           # 単一キーインポート
        ├── portal_routing_fix.patch.js        # ポータル修正パッチ
        ├── update_api_key_value.js            # キー値更新
        ├── update_direct_api_key.js           # 直接キー更新
        └── view_anthropic_keys.js             # Anthropic Key表示
```

## 4. 参照ドキュメントと成果物

### 設計・プロンプト関連
- **改善版開発方法論**: [improved_developmentway.md](/docs/refactoring/improved_developmentway.md)
- **開発方法論2.0**: [developmentway2.md](/docs/prompts/developmentway2.md)
- **開発会話記録**: [developmentConversation](/docs/prompts/developmentConversation)
- **AIエージェントシステム完成計画書**: [agent-system-enhancement-plan.md](/docs/prompts/agent-system-enhancement-plan.md)
- **AIエージェントプロンプト作成ガイド**: [prompt_excellence_guide.md](/docs/prompts/prompt_excellence_guide.md)
- **エージェントプロンプトテンプレート集**: [templates/](/docs/prompts/templates/)
  - [モックアップクリエイター](/docs/prompts/templates/mockup-creator-template.md)
  - [データモデルアーキテクト](/docs/prompts/templates/data-model-architect-template.md)
  - [APIデザイナー](/docs/prompts/templates/api-designer-template.md)
  - [スコーププランナー](/docs/prompts/templates/scope-planner-template.md)
  - [プロジェクト分析エージェント](/docs/prompts/templates/project-analysis-template.md)
  - [プロジェクト分析エージェント](/docs/prompts/templates/project-analyst-template.md)

### タスク計画関連
- **進捗管理ファイル名統一計画**: [status_to_progress_migration_plan.md](/docs/tasks/refactoring/status_to_progress_migration_plan.md)

### テンプレート・ガイドライン
- **要件定義テンプレート**: [ideal_requirements_template.md](/docs/prompts/ideal_requirements_template.md)
- **スコープ進捗文書テンプレート**: [improved_scope_progress_template.md](/docs/prompts/improved_scope_progress_template.md)
- **Markdownテンプレートガイド**: [markdown-template-guide.md](/docs/templates/markdown-template-guide.md)
- **サンプルドキュメント**: 
  - [サンプル現況文書](/docs/samples/sample-current-status.md)
  - [サンプルAPI仕様書](/docs/samples/sample-api-spec.md)
  - [初期スコープ進捗テンプレート](/docs/samples/initial-scope-progress-template.md)
  - [サンプル技術スタック](/docs/samples/sample-tech-stack.md)

### アーキテクチャ関連
- **ドキュメント参照関係の設計**: [document-references.md](/docs/architecture/document-references.md)
- **ドキュメント参照マップ**: [reference-map.md](/docs/architecture/reference-map.md)
- **参照検証ガイドライン**: [reference-validation.md](/docs/architecture/reference-validation.md)
- **エージェント通信プロトコル**: [agent-communication-protocol.md](/docs/architecture/agent-communication-protocol.md)
- **ファイル命名規約**: [file-naming-metadata-standards.md](/docs/architecture/file-naming-metadata-standards.md)

### エージェント定義ドキュメント
- **要件定義エージェント「レコンX」**: [★1requirements_creator.md](/docs/prompts/★1requirements_creator.md)
- **リファクタリングスペシャリスト「カットマスター3.0」**: [★15refactoring_expert.md](/docs/prompts/★15refactoring_expert.md)

## 4. 依存関係

- **前提となる機能**: 既存のAIエージェントシステム
- **影響を与える機能**: プロジェクト全体の開発プロセス、ドキュメント管理、AI支援開発
- **外部サービス依存**: Claude API

## 5. 変更フロー

```
[現状分析] → [理想的ドキュメント構造の設計] → [開発プロセスの順序策定] → [エージェント構成の最適化] → [テンプレート・ガイドライン作成] → [統合テスト] → [フィードバック反映] → [AIエージェントシステム強化]
```

## 6. タスクリスト

### A. ドキュメント構造設計フェーズ

- [x] **A-1**: 理想的なドキュメントディレクトリ構造の設計
- [x] **A-2**: ドキュメント作成・更新順序の策定
- [x] **A-3**: ドキュメント間の参照関係の設計

### B. エージェント構成最適化フェーズ

- [x] **B-1**: 理想的なAIエージェント構成の設計
- [x] **B-2**: エージェント間の情報フロー設計
- [x] **B-3**: エージェントプロンプトテンプレートの作成


### C. テンプレート・ガイドライン作成フェーズ

- [x] **C-1**: 要件定義書テンプレートの改善
- [x] **C-2**: 進捗管理文書テンプレートの改善
- [x] **C-3**: ファイル命名規約とメタデータ標準の作成

### D. ドキュメント実装・検証フェーズ

- [x] **D-1**: ドキュメントテンプレート実装
- [x] **D-2**: AIエージェントプロンプト作成ガイド
- [x] **D-3**: スコープ進捗管理テンプレート作成

### E. 統合・最終化フェーズ

- [x] **E-1**: プロジェクトファウンデーションのプロンプト整合性検証

- [ ] **E-2**: 2. モックアップクリエイターのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - UI/UX設計ガイドライン整合性確認
    - データモデルアーキテクトとの連携改善

- [ ] **E-3**: 3. データモデルアーキテクトのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - 型定義スタイル標準化
    - APIデザイナーとの情報連携強化

- [ ] **E-4**: 4. APIデザイナーのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - エンドポイント命名規則の標準化
    - 型定義参照スタイルの統一

- [ ] **E-5**: 5. 要件定義統合エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - 情報統合メカニズム改善
    - 実装優先順位決定基準明確化

- [ ] **E-6**: 6. 環境変数収集エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - セキュリティ対策強化
    - 環境別設定管理の標準化

- [ ] **E-7**: 7. 認証システムエージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - JWT実装パターン標準化
    - 権限管理アプローチ一貫性確保

- [ ] **E-8**: 8. スコーププランナーのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - タスク分解精度向上
    - SCOPE_PROGRESS.md形式標準化

- [ ] **E-9**: 9. フロントエンド実装エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - コーディングスタイル一貫性確保
    - API連携パターン最適化

- [ ] **E-10**: 10. バックエンド実装エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - データアクセスパターン標準化
    - ビジネスロジック分離原則明確化

- [ ] **E-11**: 11. テスト管理エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - テスト戦略立案アプローチ改善
    - 実装エージェントとの連携強化

- [ ] **E-12**: 12. デバッグ探偵のプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - 問題分析フレームワーク標準化
    - 根本原因特定手法強化

- [ ] **E-13**: 13. デプロイ設定エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - CI/CDパイプライン構成最適化
    - 環境差異対応メカニズム改善

- [ ] **E-14**: 14. GitHub管理エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - ブランチ戦略標準化
    - セキュリティ対策強化

- [ ] **E-15**: 15. プロジェクト分析エージェントのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - コード分析アプローチ体系化
    - 分析レポート形式標準化

- [ ] **E-16**: 16. リファクタリングスペシャリストのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - 技術的負債特定手法改善
    - コード最適化パターンのライブラリ化

- [ ] **E-17**: 17. 段階的コード分割リファクタリングアドバイザーのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - 大規模ファイル分析手法改善
    - 並行動作保証メカニズム最適化

- [ ] **E-18**: 18. チェンジディレクターのプロンプト整合性検証
  - 目標: 2025-05-19
  - 内容:
    - 変更影響分析フレームワーク改善
    - AIエージェント間調整メカニズム強化

### F. 進捗管理ファイル名統一フェーズ
- **参照計画**: [status_to_progress_migration_plan.md](/docs/tasks/refactoring/status_to_progress_migration_plan.md)
- **実装状況**: フェーズ1（基本互換性対応）完了、フェーズ2（完全移行）進行中

### G. AIエージェント最適化フェーズ
- **参照資料**: 
  - [AIエージェントプロンプト作成ガイド](/docs/prompts/prompt_excellence_guide.md)
  - [エージェントプロンプトテンプレート集](/docs/prompts/templates/)
  - [AIエージェントシステム完成計画書](/docs/prompts/agent-system-enhancement-plan.md)
  - [サンプル進捗テンプレート](/docs/samples/initial-scope-progress-template.md)

- [ ] **G-1**: AIエージェント名の標準化と最適化
  - 目標: 2025-05-21
  - 内容:
    - 現在のエージェント名と番号付けの整合性確認
    - 分かりやすく覚えやすいエージェント名の検討
    - 担当業務を適切に反映した名称への変更
    - 番号付けの連番化と論理的整理
    
- [ ] **G-2**: 開発プロンプトカード表示方法の改善
  - 目標: 2025-05-21
  - 内容:
    - カード表示レイアウトのユーザビリティ向上
    - エージェント特性を視覚的に表現する工夫
    - サンプル成果物へのリンク追加
    - エージェント間連携フローの可視化

- [ ] **G-3**: テンプレートファイルへのエージェント名反映
  - 目標: 2025-05-21
  - 内容:
    - initial-scope-progress-template.mdの更新
    - SCOPE_PROGRESS_TEMPLATE.mdの更新
    - エージェント名と番号の一貫性確保
    - すべての参照ドキュメントでの用語統一

- [ ] **UI-14**: プロンプトカード表示テキスト更新
  - 目標: 2025-05-20
  - 参照: [/docs/refactoring/prompt-cards-update-20250518.md](/docs/refactoring/prompt-cards-update-20250518.md)
  - 内容: プロンプトカードの表示テキストとURLを最新情報に更新

- [ ] **T-TEST-1**: テスト品質エンジニアプロンプトの追加と番号の整理
  - 目標: 2025-05-21
  - 参照: [/docs/plans/planning/ext-prompt-cards-update-20250520.md](/docs/plans/planning/ext-prompt-cards-update-20250520.md)
  - 内容: バックエンド実装とフロントエンド実装の間にテスト品質エンジニアプロンプトを追加し、後続のプロンプト番号を調整する
    
- [ ] **T-PROMPT-1**: プロンプトカードの順序と名称変更
  - 目標: 2025-05-21
  - 参照: [/docs/plans/planning/ext-prompt-cards-update-20250520.md](/docs/plans/planning/ext-prompt-cards-update-20250520.md)
  - 内容: プロンプトカードの順序を変更し（★11: デバッグ探偵、★12: デプロイ、★13: GitHub、★14: 型エラー解決、★15: 機能追加、★16: リファクタリング）、一部の名称をより簡潔にする
    
- [ ] **T-TEMPLATE-1**: テンプレートファイル自動更新機能の実装
  - 目標: 2025-05-22
  - 参照: [/docs/plans/planning/ext-template-update-20250520.md](/docs/plans/planning/ext-template-update-20250520.md)
  - 内容: プロジェクト新規作成・読み込み時に最新のSCOPE_PROGRESS_TEMPLATEとCLAUDETEMPLATEに基づいてファイルを更新する機能を実装
    
- [ ] **UI-1**: ファイルビューワー自動更新機能の実装
  - 目標: 2025-05-17
  - 参照: [/docs/plans/planning/ext-docs-auto-refresh-20250514.md](/docs/plans/planning/ext-docs-auto-refresh-20250514.md)
  - 内容: ファイルビューワーに/docsディレクトリの自動監視・更新機能を追加

- [x] **F-1**: FileSystemServiceの拡張実装
  - 完了日: 2025-05-19
  - 成果:
    - getProgressFilePath メソッド追加
    - 新旧ファイル名対応の優先順位ロジック実装
    - createProgressFile メソッド追加

- [x] **F-2**: ProjectServiceの更新
  - 完了日: 2025-05-19
  - 成果:
    - getProgressFilePath メソッド使用に変更
    - 新規プロジェクト作成時の対応変更
    - 既存プロジェクト読み込み対応

- [x] **F-3**: テンプレートファイルの更新
  - 完了日: 2025-05-19
  - 成果:
    - SCOPE_PROGRESS_TEMPLATE.mdの作成
    - ヘルパーメソッドの追加
    - CLAUDETEMPLATE.mdの参照パス更新

- [x] **DOC-1**: ドキュメント管理構造の改善
  - 完了日: 2025-05-13
  - 参照: [/docs/plans/planning/ext-example-usage-20250513.md](/docs/plans/planning/ext-example-usage-20250513.md)
  - 成果:
    - 計画ドキュメントの統一構造の確立
    - 機能拡張プランナープロンプトの作成
    - ドキュメントライフサイクル管理の標準化

- [x] **REF-1**: mediaフォルダのリファクタリング計画
  - 完了日: 2025-05-13
  - 参照: [/docs/refactoring/mediaフォルダ_リファクタリング計画.md](/docs/refactoring/mediaフォルダ_リファクタリング計画.md)
  - 成果:
    - 重複ファイルと不要ファイルの特定
    - ディレクトリ構造の最適化計画
    - コンポーネント間の依存関係分析
    - 段階的実装計画の策定

- [x] **REF-2**: docsフォルダのリファクタリング計画
  - 完了日: 2025-05-13
  - 参照: [/docs/refactoring/docsフォルダ_リファクタリング計画.md](/docs/refactoring/docsフォルダ_リファクタリング計画.md)
  - 成果:
    - ドキュメント管理構造の最適化計画
    - ディレクトリ構造の標準化と命名規則の統一
    - 重複・不要ドキュメントの整理方針
    - アーカイブと国際化対応の整備計画

- [ ] **F-4**: UI関連コードの完全移行とCURRENT_STATUS参照の削除
  - 目標: 2025-05-21
  - 内容:
    - ScopeManagerPanelから「current-status」参照の完全削除
    - フロントエンドのeventとstate名の更新（CURRENT_STATUS → SCOPE_PROGRESS）
    - UIのラベルとメッセージの用語統一（「ステータス」→「進捗」）
    - CURRENT_STATUSTEMPLATEの完全削除
    - 完全移行後の動作検証とリグレッションテスト

## 7. 実装上の注意点

### ドキュメント構造関連
- ドキュメントは「最大3階層」の制限を厳守し、ナビゲーションを容易にすること
- 各エージェントが必要な情報に効率的にアクセスできる構造を維持すること
- 非技術者にも理解しやすい視覚的要素や説明を取り入れること
- モックアップ中心アプローチを全プロセスにおいて徹底すること
- ドキュメントの生成と保守の労力を最小化する設計にすること
- データモデルの型定義は`shared/index.ts`を「単一の真実源」として参照すること
- APIドキュメントでは型定義への直接参照を必ず含めること

### ドキュメント管理ガイドライン
- 追加要件や計画ドキュメントは必ず日付を含む命名規則に従うこと
- ドキュメントは「計画段階→実装中→アーカイブ」の3ステージで管理すること
- 計画ドキュメントは下記の命名規則に従い、種類を明示すること:
  - `ext-[名称]-[YYYY-MM-DD].md` - 拡張計画（新機能、機能拡張）
  - `ref-[名称]-[YYYY-MM-DD].md` - リファクタリング計画
  - `fix-[名称]-[YYYY-MM-DD].md` - バグ修正計画
  - `env-[名称]-[YYYY-MM-DD].md` - 環境構成計画
- 実装完了したドキュメントは速やかにアーカイブに移動し、アクティブなドキュメントを最小限に保つこと
- すべての計画ドキュメントはSCOPE_PROGRESSに差し込みタスクとしての参照を含めること

### AIエージェント関連
- エージェント間の連携を最優先事項とし、情報の受け渡しが円滑に行われるよう設計すること
- コンテキストウィンドウの効率的な活用を常に意識し、冗長な情報を排除すること
- 各エージェントは独立して機能しつつも、全体として一貫性のある出力を生成できるよう設計すること
- エージェントの自己診断能力を強化し、エラー検出・修正を自律的に行えるようにすること
- 標準化と柔軟性のバランスを取り、特殊なケースにも対応できる拡張性を確保すること
- すべてのプロンプトは「単一の真実源」の原則に従い、整合性を維持すること
- プロンプト作成には「AIエージェントプロンプト作成の卓越ガイド」に従うこと



