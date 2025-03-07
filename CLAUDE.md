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

## ツールキット連携情報

AppGeniusのツールキットは以下の主要コンポーネントと連携メカニズムで構成されています。
詳細は `TOOLKIT.md` を参照してください。

### 主要コンポーネント
- ClaudeCodeLauncherService: ClaudeCodeとVSCode間の連携
- ScopeManagerPanel: スコープ管理とCURRENT_STATUS.md連携
- 環境変数アシスタント: 設定の一元管理
- デバッグ探偵: エラー検出・解決支援

### 連携メカニズム
- ファイル結合方式: 複数ファイルをAIに提供
- ステータス同期: CURRENT_STATUS.md更新による進捗管理
- プロジェクトパス管理: 絶対パスによる一貫した参照
- イベント通知: AppGeniusEventBusによる状態同期

### 技術的メモ
- ClaudeCode呼び出し時は結合ファイル方式を優先する
- パスは必ず絶対パスで管理し、相対パスは使用しない
- イベント駆動型アーキテクチャの採用によりコンポーネント間の疎結合を維持

## 開発フェーズ

現在は**フェーズ3-4: 実装・デバッグフェーズおよびAPI連携・環境設定フェーズ**段階です。

1. **フェーズ1**: CLAUDE.md管理システム、チャットUI、ダッシュボード（完了）
2. **フェーズ2**: 要件定義・構造マネージャー、モックアップギャラリー、スコープ計画（完了）
3. **フェーズ3**: スコープ実装アシスタント、デバッグサポート（完了）
4. **フェーズ4**: API連携・環境設定、デプロイ支援（進行中）

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

6. **環境変数設定フェーズ**: 環境変数アシスタントでプロジェクト設定を管理
   - AIによるプロジェクト分析と必要な環境変数の特定
   - CLAUDE.md内での環境変数情報の一元管理
   - カテゴリ別（データベース、API、セキュリティなど）の環境変数整理
   - 設定状況の視覚的管理（設定済み・要設定・未設定）
   - セキュリティに配慮した.envファイル生成

7. **デバッグフェーズ**: デバッグ探偵でエラー検出と解決
   - エラーセッションの作成と管理
   - エラーログの収集と分析
   - AIを活用した問題診断と解決策の提案
   - 知見データベースによる共通問題の解決
   - 修正適用後の確認テスト実行

8. **デプロイフェーズ**: 完成したアプリケーションのデプロイ
   - デプロイ環境の設定支援
   - デプロイスクリプト生成
   - 本番環境での動作確認ガイダンス

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
- [デバッグ探偵プロンプト](./docs/DebagDetector.md) - デバッグ支援AIプロンプト
- [環境変数アシスタント要件](./docs/scopes/environmentVariablesAssistant-requirements.md) - 環境変数管理アシスタント
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

## ClaudeCodeに複数ファイルを渡す方法

ClaudeCodeに複数ファイルを渡す必要がある場合（例：プロンプトファイルとステータスファイル）、以下の方法を使用できます：

1. **結合ファイル方式**（推奨）
   ```typescript
   // 一時的な結合ファイルを作成して両方の内容を含める
   const tempDir = path.join(projectPath, 'temp');
   if (!fs.existsSync(tempDir)) {
     fs.mkdirSync(tempDir, { recursive: true });
   }
   
   // 一時ファイル名を生成
   const combinedFilePath = path.join(tempDir, `combined_prompt_${Date.now()}.md`);
   
   // ファイル内容を結合
   const promptContent = fs.readFileSync(promptFilePath, 'utf8');
   const secondContent = fs.readFileSync(secondFilePath, 'utf8');
   
   // 結合ファイルを作成（セクション見出しなどで構造化）
   const combinedContent = 
     promptContent + 
     '\n\n# 追加情報\n\n' +
     secondContent;
   
   fs.writeFileSync(combinedFilePath, combinedContent, 'utf8');
   
   // ClaudeCodeの起動
   const launcher = ClaudeCodeLauncherService.getInstance();
   await launcher.launchClaudeCodeWithPrompt(
     projectPath,
     combinedFilePath,
     { title: 'ClaudeCode - 処理名' }
   );
   ```

2. **変数置換方式**（テンプレート固定の場合）
   ```typescript
   // テンプレートファイルの内容を読み込む
   let templateContent = fs.readFileSync(templatePath, 'utf8');
   
   // 変数を置換
   templateContent = templateContent
     .replace(/{{VARIABLE1}}/g, value1)
     .replace(/{{VARIABLE2}}/g, value2)
     .replace(/{{FILEPATH}}/g, filePath);
   
   // 一時的なテンプレートファイルを作成
   fs.writeFileSync(tempFilePath, templateContent, 'utf8');
   
   // Claude CLIで実行
   terminal.sendText(`claude ${escapedTempFilePath}`);
   ```

3. **標準入力パイプ方式**（カスタマイズが必要）
   ```bash
   # 標準入力からデータを渡す例
   cat secondFile.md | claude promptFile.md
   ```

モックアップギャラリーや実装スコープ管理など、複数のコンポーネントで「結合ファイル方式」を使用しています。これにより、ClaudeCodeに複数のコンテキストを効果的に渡すことができます。

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

## 環境変数管理

環境変数の管理は、プロジェクトの設定と構成の核心部分です。プロジェクトの開発環境と本番環境の両方で適切な環境変数を設定することが重要です。

### 環境変数の追加方法

プロジェクトに新しい環境変数を追加する場合、以下の手順に従ってください：

1. 環境変数アシスタントを使用して必要な環境変数を特定
2. 環境変数情報をこのCLAUDE.mdファイルに追加
3. `.env`ファイルに実際の値を設定
4. `.env.example`ファイルにサンプル値またはプレースホルダーを設定

### 環境変数の管理方針

1. **実際の値を含む環境変数**：
   - `.env`ファイルに保存
   - バージョン管理システムからは除外（`.gitignore`に追加）
   - 機密情報は暗号化またはマスク処理

2. **サンプル値**：
   - `.env.example`ファイルに保存
   - バージョン管理システムに含めて共有可能
   - 実際の値の代わりにプレースホルダーを使用

3. **環境変数のカテゴリ化**：
   - 開発環境設定：アプリケーションの実行環境や基本設定
   - データベース設定：データベース接続や認証情報
   - API設定：外部APIとの連携設定
   - セキュリティ設定：認証や暗号化関連の設定
   - サードパーティサービス：外部サービス連携の設定

### 環境変数設定例

以下は一般的なプロジェクトで必要となる環境変数の例です：

#### 開発環境設定
```
# 実行環境（development/production/test）
NODE_ENV=development

# アプリケーションポート
PORT=3000

# デバッグモード
DEBUG=app:*
```

#### データベース設定
```
# データベース接続情報
DB_HOST=localhost
DB_PORT=5432
DB_USER=dbuser
DB_PASSWORD=********（実際の値に置き換え）
DB_NAME=myapp

# または接続文字列を使用
DATABASE_URL=postgresql://dbuser:********@localhost:5432/myapp
```

#### API設定
```
# API基本設定
API_BASE_URL=https://api.example.com
API_VERSION=v1
API_KEY=********（実際の値に置き換え）
```

#### セキュリティ設定
```
# セキュリティキー（ランダムで強力な値を使用）
JWT_SECRET=********（実際の値に置き換え）
SESSION_SECRET=********（実際の値に置き換え）
ENCRYPTION_KEY=********（実際の値に置き換え）
```

### 環境変数の設定方法

環境変数の設定には以下のアプローチを推奨します：

1. **環境変数アシスタントの活用**：
   - VSCode拡張の「環境変数アシスタント」機能を使用
   - AIによるプロジェクト分析で必要な環境変数を特定
   - CLAUDE.mdへの設定情報の追加

2. **スコープ実装アシスタントとの連携**：
   - 実装フェーズで必要な環境変数が特定された場合、スコープ実装アシスタントから環境変数アシスタントに情報を連携
   - 環境変数設定を実装手順の一部として組み込み

3. **環境変数のバリデーション**：
   - アプリケーション起動時に必要な環境変数の存在と形式を検証
   - 不足している環境変数がある場合は適切なエラーメッセージを表示
   
環境変数に関する詳細情報は、環境変数アシスタントを起動して確認することができます。

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
- 作成済みファイル数: 18
- 進捗率: 37.5%
- 最終更新日: 2025-03-07

## ファイル状況

### 完了済みファイル
- [x] media/scopeManager.css
- [x] media/scopeManager.js
- [x] media/dashboard.css
- [x] media/dashboard.js
- [x] media/developmentAssistant.css
- [x] media/developmentAssistant.js
- [x] src/ui/scopeManager/ScopeManagerPanel.ts
- [x] src/services/ClaudeCodeLauncherService.ts
- [x] src/ui/mockupGallery/MockupGalleryPanel.ts
- [x] src/ui/dashboard/DashboardPanel.ts
- [x] src/ui/developmentAssistant/DevelopmentAssistantPanel.ts
- [x] src/modes/developmentMode/developmentAssistant.ts
- [x] src/modes/implementationMode/scopeSelector.ts
- [x] src/modes/implementationMode/scopeSelector/
- [x] CLAUDE.md
- [x] docs/CURRENT_STATUS.md
- [x] docs/Scope_Manager_Prompt.md
- [x] docs/Scope_Implementation_Assistant_Prompt.md

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


