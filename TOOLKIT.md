# AppGenius ツールキット管理

このファイルはAppGeniusのツールキット、依存関係、連携の仕組みを管理します。

## ツールキット構成

### コアコンポーネント
- ClaudeCodeLauncherService: ClaudeCodeとの連携
- ScopeManagerPanel: スコープ管理UIとAPI統合管理
- EnvironmentVariablesAssistantPanel: 環境変数管理UI
- DebugDetectivePanel: デバッグ探偵UI
- MockupGalleryPanel: モックアップとAPI抽出UI

### 依存関係図
```mermaid
graph TD
    A[CLAUDE.md] --> B[ClaudeCodeLauncherService]
    A --> C[ScopeManagerPanel]
    C --> D[CURRENT_STATUS.md]
    C --> B
    E[スコープ実装プロンプト] --> B
    F[環境変数アシスタント] --> D
    G[デバッグ探偵] --> A
    H[モックアップギャラリー] --> I[docs/api.md]
    C --> I
    B <--> I
    F <--> J[.env]
```

### 最新バージョン状態
- ClaudeCodeLauncherService: v1.2.0 (2025-03-07)
- ScopeManagerPanel: v1.2.0 (2025-03-07)
- EnvironmentVariablesAssistantPanel: v1.0.2 (2025-03-05)
- DebugDetectivePanel: v1.0.1 (2025-03-04)
- MockupGalleryPanel: v1.1.0 (2025-03-07)

## 連携メカニズム

### ファイル結合方式
```typescript
// 結合ファイル作成方法
const combinedFilePath = path.join(tempDir, `combined_prompt_${Date.now()}.md`);
const combinedContent = promptContent + '\n\n# 追加情報\n\n' + secondContent;
fs.writeFileSync(combinedFilePath, combinedContent, 'utf8');
```

### コマンド起動方式
```typescript
// ClaudeCode起動コマンド
terminal.sendText(`claude ${escapedPromptFilePath}${additionalParams}`);
```

## コンポーネント詳細

### ClaudeCodeLauncherService
**役割**: VSCodeからClaudeCodeを起動し、実装スコープに基づいて開発を進めるための連携サービス
**主要機能**:
- `launchClaudeCode`: スコープ情報を基にClaudeCodeを起動
- `launchClaudeCodeWithMockup`: モックアップを解析するためにClaudeCodeを起動
- `launchClaudeCodeWithPrompt`: 指定したプロンプトファイルでClaudeCodeを起動
**依存**: AppGeniusEventBus, PlatformManager, ScopeExporter, MessageBroker

### ScopeManagerPanel
**役割**: CURRENT_STATUS.mdファイルと連携して実装スコープと環境変数の管理を行うUIパネル
**主要機能**:
- `_loadStatusFile`: CURRENT_STATUS.mdファイルを読み込む
- `_updateStatusFile`: CURRENT_STATUS.mdファイルを更新（環境変数含む）
- `_handleStartImplementation`: 実装開始処理
- `_parseStatusFile`: 環境変数とスコープ関連付け情報の解析
**依存**: FileOperationManager, ClaudeCodeLauncherService

### EnvironmentVariablesAssistantPanel
**役割**: 環境変数の管理と設定を支援するUIパネル
**主要機能**:
- 環境変数のカテゴリ別管理
- .envと.env.exampleファイルの生成
- CLAUDE.mdへの環境変数情報追加
**依存**: FileOperationManager, ClaudeCodeLauncherService

### DebugDetectivePanel
**役割**: エラー検出と解決を支援するUIパネル
**主要機能**:
- エラーセッションの作成と管理
- エラーログの収集と分析
- AIを活用した問題診断と解決策の提案
**依存**: KnowledgeBaseManager, ErrorSessionManager

## ファイル連携構造

AppGeniusのファイル連携構造は以下の通りです：

### 理想的なディレクトリ構造
```
Root/
├── CLAUDE.md                     # プロジェクト中心情報
├── CURRENT_STATUS.md             # 現在の進捗状況
├── .env                          # 環境変数（.gitignoreに追加）
├── Assistant/                    # AIアシスタントプロンプト
│   ├── requirementsadvicer.md    # 要件定義アドバイザー
│   ├── mockup_analysis_template.md # モックアップ解析テンプレート
│   ├── Scope_Manager_Prompt.md   # スコープ管理プロンプト
│   ├── Scope_Implementation_Assistant_Prompt.md # 実装支援プロンプト
│   ├── DebugDetector.md          # デバッグ探偵プロンプト
│   └── environmentVariablesAssistant-requirements.md # 環境変数要件
├── mockups/                      # モックアップファイル
│   ├── *.html                    # 各ページのモックアップ
│   └── metadata.json             # モックアップ管理情報
├── Requirements/                 # 要件定義
│   ├── requirements.md           # 全体要件定義
│   └── scopes/                   # 個別要件定義
│       ├── *-requirements.md     # 各ページの詳細要件
│       └── *.md                  # その他の要件ドキュメント
├── docs/                         # プロジェクト定義
│   ├── api.md                    # API定義
│   ├── scope.md                  # スコープ定義
│   └── structure.md              # ディレクトリ構造
├── logs/                         # ログファイル
│   └── debug/                    # デバッグ情報
│       ├── archived/             # アーカイブされた情報
│       ├── knowledge/            # 知識ベース
│       └── sessions/             # セッション情報
└── reference/                    # 参照情報
```

### コンポーネントとファイルの対応

#### 要件定義コンポーネント
- 入力: `Assistant/requirementsadvicer.md`
- 出力: 
  - `Requirements/requirements.md`
  - `mockups/` (モックアップファイル)

#### モックアップギャラリー
- 入力:
  - `mockups/*.html`
  - `Assistant/mockup_analysis_template.md`
- 出力:
  - 更新された `mockups/*.html`
  - `Requirements/scopes/*-requirements.md`
  - `docs/api.md`（API定義の初期抽出）

#### スコープマネージャー
- 入力:
  - `Assistant/Scope_Manager_Prompt.md`
  - `Assistant/Scope_Implementation_Assistant_Prompt.md`
  - `docs/structure.md`
  - `docs/api.md`
- 出力/管理:
  - `CURRENT_STATUS.md`
  - `docs/scope.md`
  - `docs/api.md`（API定義の統合・更新）
  - `.env` (環境変数アシスタントと連携)

#### デバッグ探偵
- 入力:
  - `Assistant/DebugDetector.md`
- 出力/管理:
  - `logs/debug/knowledge/` (知識ベース)
  - `logs/debug/sessions/` (セッション情報)
  - `logs/debug/archived/` (アーカイブ)

#### 環境変数アシスタント
- 入力:
  - `Assistant/environmentVariablesAssistant-requirements.md`
  - `CURRENT_STATUS.md`（現在の設定状況）
- 出力/管理:
  - `.env`（実際の環境変数値）
  - `CURRENT_STATUS.md`の環境変数セクション更新

## 各コンポーネントの役割と生成物

### 要件定義
- **入力**: ユーザーの要求、既存プロジェクト情報
- **処理**: requirementsadvicer.mdの指示に基づきAIが要件を整理
- **出力**: requirements.md、初期モックアップHTML
- **書き込み責任**: requirements.mdの全体構造、シンプルなモックアップファイル

### モックアップギャラリー
- **入力**: モックアップHTMLファイル、ユーザーフィードバック
- **処理**: mockup_analysis_template.mdの指示に基づきAIがUIを分析・改善・API要件抽出
- **出力**: 改善されたモックアップHTML、個別要件定義ファイル、API定義初期データ
- **書き込み責任**: モックアップファイルの更新、*-requirements.mdファイルの生成、api.mdの初期抽出

### スコープマネージャー
- **入力**: scope.md、structure.md、CURRENT_STATUS.md、api.md、各ページ要件定義
- **処理**: Scope_Manager_Prompt.mdの指示に基づきAIがスコープと環境変数を定義・管理・API統合
- **出力**: 
  - 更新されたCURRENT_STATUS.md（環境変数セクションとスコープ別環境変数を含む）
  - scope.md（機能中心のスコープ定義）
  - api.md（API定義の統合）
- **書き込み責任**: 
  - CURRENT_STATUS.mdの進捗更新とスコープ別環境変数セクション管理
  - scope.mdのスコープ定義（実装対象機能を中心に）
  - api.mdの一元管理と整合性確保

### デバッグ探偵
- **入力**: エラーログ、コードスニペット
- **処理**: DebugDetector.mdの指示に基づきAIがエラーを分析
- **出力**: エラー解決策、セッション記録
- **書き込み責任**: logs/debug/内のセッションファイル、knowledge base

### 環境変数管理フロー
- **初期検出** (モックアップ分析 - mockup_analysis_template.md)
  - **入力**: モックアップ、ユーザーとの対話
  - **処理**: 要件定義から必要な環境変数を特定と説明付き定義
  - **出力**: 要件ドキュメントの「API・バックエンド連携」セクションに分かりやすい説明付き環境変数リスト

- **一元集約とスコープ関連付け** (スコープマネージャー - Scope_Manager_Prompt.md)
  - **入力**: 各要件ドキュメントから環境変数情報と説明を収集
  - **処理**: スコープと環境変数の関連付け、CURRENT_STATUS.mdに初期化
  - **出力**: CURRENT_STATUS.mdの環境変数セクションとスコープ別環境変数セクション（すべて未設定状態）

- **使用確認と進捗率連動** (スコープ実装アシスタント - Scope_Implementation_Assistant_Prompt.md)
  - **入力**: コード実装過程での環境変数使用、スコープ進捗情報
  - **処理**: 使用確認、ダミー値使用の記録、スコープ進捗率への反映
  - **出力**: 
    - CURRENT_STATUS.mdの環境変数に [!] マーク（使用確認済み）追加
    - スコープ進捗率の計算に環境変数設定状況を反映（未設定の環境変数がある場合は90%上限）

- **エラー検出と修正推奨** (デバッグ探偵 - DebugDetector.md)
  - **入力**: エラーログ、関連コード
  - **処理**: 環境変数関連エラーの検出と分析
  - **出力**: 環境変数設定変更の推奨

- **実値設定と完了連動** (環境変数アシスタント - EnvironmentVariablesAssistantPanel)
  - **入力**: CURRENT_STATUS.mdの環境変数状態とスコープ別環境変数情報、プロジェクトコード
  - **処理**: 実際の環境変数値の設定と検証、スコープ完了状態との連携
  - **出力**: 
    - .envファイル（実際の値）
    - CURRENT_STATUS.mdの設定完了更新（[x] マーク）
    - スコープの進捗率100%化（スコープに必要な全環境変数が設定済みの場合）

## 既知の課題と対策

1. **ファイル整理の一貫性**
   - 課題: 現在のファイル構造が最適化されていない
   - 対策: 理想的なディレクトリ構造へ段階的に移行

2. **命名規則の標準化**
   - 課題: ファイル名の命名規則にばらつきがある
   - 対策: 統一的な命名規則の策定と適用

3. **CLAUDE.md初期テンプレートの改善**
   - 課題: 初期テンプレートが十分に構造化されていない
   - 対策: より体系的なテンプレートの作成

4. **CURRENT_STATUS.md初期テンプレートの標準化**
   - 課題: 初期状態が定義されていない
   - 対策: 標準テンプレートの作成と適用

5. **環境変数管理の簡素化と一元化**
   - 課題: `.env.example`ファイルは不要と判断、CLAUDE.mdとの二重管理も非効率
   - 対策: 環境変数の状態管理をCURRENT_STATUS.mdに一元化し、.envファイルと連携

## 環境変数ステータスの表記ルール

CURRENT_STATUS.mdにおける環境変数の状態は、以下の表記ルールで管理されます：

```markdown
## 環境変数設定状況

- [ ] DB_HOST - データベースに接続するための名前やアドレス
- [!] API_KEY - 外部サービスへのアクセスキー（使用確認済み、仮の値で実装中）
- [x] PORT - アプリケーションが使用するポート番号（設定完了）

### スコープ別必要環境変数

#### スコープ1: 初期セットアップ
必要な環境変数:
- [ ] NODE_ENV - アプリケーションの動作モード（開発・本番）
- [x] PORT - アプリケーションが使用するポート番号

#### スコープ2: ユーザー認証
必要な環境変数:
- [!] JWT_SECRET - ユーザー認証に使う暗号化キー（使用確認済み）
- [ ] SESSION_SECRET - セッション管理に使う暗号化キー
```

状態の意味:
- `[ ]` - 未設定状態（初期状態）
- `[!]` - 使用確認済み・設定要（実装アシスタントが更新）
- `[x]` - 設定完了・検証済み（環境変数アシスタントが更新）

### 環境変数ステータス遷移

1. **初期状態** `[ ]` 
   - スコープマネージャーが要件定義から収集し初期化
   - スコープごとに必要な環境変数として関連付け
   - 設定が必要だが、まだ使用確認されていない状態

2. **使用確認済み** `[!]`
   - スコープ実装アシスタントが実装時に使用を確認
   - ダミー値で実装されているケースが多い
   - スコープの進捗率に影響（環境変数設定も進捗に反映）
   - 早急に実際の値設定が必要な状態

3. **設定完了** `[x]`
   - 環境変数アシスタントで実際の値を設定・検証済み
   - 関連するスコープの進捗率が100%に到達可能に
   - 本番環境でも動作する状態

## アップグレード計画

### 短期改善計画 (2025-Q2)
1. 理想的なディレクトリ構造への移行
2. 命名規則の標準化とドキュメント化
3. CLAUDE.md初期テンプレートの改善
4. CURRENT_STATUS.md初期テンプレートの標準化
5. API管理体制の確立（モックアップギャラリーでの抽出→スコープマネージャーでの統合）
6. 環境変数管理フローの完全実装（5段階の役割分担による管理）

### 中期改善計画 (2025-Q3)
1. 環境変数管理システムの強化
2. デバッグ知識ベースの拡充
3. スコープマネージャーUIの改善（実装済み - ファイル中心から機能中心へ）

### 長期改善計画 (2025-Q4)
1. プロジェクト間でのツールキット共有機能
2. AIプロンプト自動最適化システム
3. リファレンス管理システムの強化