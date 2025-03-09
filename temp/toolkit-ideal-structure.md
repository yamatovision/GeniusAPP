# AppGenius ツールキット - 理想的なファイル・フォルダ構成

AppGeniusツールキットの理想的なファイル・フォルダ構成を以下にまとめます。この構成は、プロジェクト初期化時に自動的に生成され、VSCodeとClaudeCodeの連携を最適化するためのものです。

## 基本構造

```
ProjectName/
├── CLAUDE.md                     # プロジェクト中心情報（単一の真実源）
├── TOOLKIT.md                    # ツールキット連携・構成情報
├── docs/                         # ドキュメントとテンプレート
│   ├── CURRENT_STATUS.md         # 進捗状況と実装状態
│   ├── requirements.md           # 全体要件定義
│   ├── structure.md              # ディレクトリ構造 
│   ├── api.md                    # API定義
│   ├── data_models.md            # データモデル定義（単一の真実源）
│   ├── env.md                    # 環境変数リスト
│   ├── deploy.md                 # デプロイ情報
│   ├── scope.md                  # 実装スコープと優先順位
│   ├── scopes/                   # 個別スコープ要件
│   │   └── page-requirements.md  # 各ページの詳細要件
│   ├── templates/                # システムテンプレート
│   │   ├── CLAUDETEMPLATE.md     # CLAUDE.md用テンプレート
│   │   └── CURRENT_STATUSTEMPLATE.md # 進捗状況テンプレート
│   └── prompts/                  # AIアシスタントプロンプト
│       ├── requirementsadvicer.md       # 要件定義アドバイザー
│       ├── mockup_analysis_template.md  # モックアップ解析
│       ├── Scope_Manager_Prompt.md      # スコープ管理
│       ├── Scope_Implementation_Assistant_Prompt.md # 実装アシスタント
│       ├── DebugDetective.md            # デバッグ探偵
│       └── environmentVariablesAssistant-requirements.md # 環境変数アシスタント
├── mockups/                      # モックアップファイル
│   ├── metadata.json             # モックアップ管理情報
│   └── *.html                    # 各ページのモックアップ
├── logs/                         # ログと診断情報
│   ├── appgenius-debug.log       # AppGenius診断ログ
│   └── debug/                    # デバッグ情報
│       ├── sessions/             # エラーセッション情報
│       ├── knowledge/            # デバッグ知識ベース
│       └── archived/             # アーカイブされた情報
├── .claude_data/                 # ClaudeCodeとの連携データ（.gitignore対象）
│   ├── dom_structure.json        # UI構造情報（環境変数アシスタント用）
│   ├── env_variables.json        # 環境変数情報
│   ├── actions.json              # ClaudeCode操作指示
│   └── screenshots/              # UI状態のスクリーンショット
├── temp/                         # 一時ファイル（.gitignore対象）
│   └── combined_*.md             # ClaudeCode用結合ファイル 
└── .env                          # 環境変数（.gitignore対象）
```

## 核心ドキュメント説明

### 1. CLAUDE.md - プロジェクト中心情報

プロジェクト全体の情報を一元管理する「単一の真実源」。VSCodeとClaudeCodeの両方がこのファイルを参照することで情報の一貫性を確保します。

**主要セクション**:
- プロジェクト概要とコンセプト
- 技術スタック情報
- データモデル管理原則
- 開発フェーズと進捗
- 開発ワークフロー
- ドキュメントリンク
- ファイル構造
- 環境変数情報
- 開発コマンド

### 2. docs/CURRENT_STATUS.md - 進捗管理

プロジェクト実装の進捗状況を詳細に管理するファイル。スコープごとの完了状態、実装されたファイル、環境変数設定状況などを追跡します。

**主要セクション**:
- 全体進捗（ファイル数と進捗率）
- スコープ状況（完了済み/進行中/未着手）
- 現在のディレクトリ構造
- 実装予定ファイルのチェックリスト
- 環境変数設定状況
- 次のスコープ情報

### 3. docs/data_models.md - データモデル定義

すべてのデータモデルを一元管理する「単一の真実源」。モデルの属性、関係性、制約など、データ構造に関するすべての情報を管理します。

**主要セクション**:
- エンティティ一覧
- データモデルの詳細定義
- モデル間の関係性
- 変更履歴
- スコープとの対応関係

### 4. docs/api.md - API設計

すべてのAPIエンドポイントの詳細を管理します。フロントエンドとバックエンドの連携に必要な情報を提供します。

**主要セクション**:
- 認証方式
- リソースごとのエンドポイント
- リクエスト/レスポンス形式
- エラーコード
- API変更履歴

### 5. docs/structure.md - ディレクトリ構造

プロジェクトのフォルダ・ファイル構造を定義します。スコープマネージャーが最終的な構造を確立します。

**主要セクション**:
- フロントエンド構造
- バックエンド構造
- 共通コンポーネント
- ページごとのコンポーネント

### 6. docs/env.md - 環境変数リスト

必要なすべての環境変数とその説明を管理します。設定状況を記録し、環境変数アシスタントと連携します。

**形式**:
```
# 環境変数リスト

## バックエンド
[ ] `DB_HOST` - データベースに接続するための名前やアドレス
[✓] `PORT` - サーバーポート番号

## フロントエンド
[ ] `NEXT_PUBLIC_API_URL` - バックエンドAPIのURL
```

## アシスタントプロンプト説明

### 1. requirementsadvisor.md - 要件定義アドバイザー

プロジェクト要件の整理と明確化を支援します。非技術者でも要件定義を作成・改善できるようガイドします。

**主な責務**:
- 要件の明確化と具体化
- 基本的なデータモデルの特定
- 主要APIエンドポイントの特定
- 初期ディレクトリ構造の提案

### 2. mockup_analysis_template.md - モックアップ解析

モックアップからページごとの詳細要件を抽出し、必要なUI要素、データ構造、APIなどを特定します。

**主な責務**:
- UI要素の詳細分析
- データ構造とAPI連携の特定
- 実装ファイルリストの作成
- 各設計ドキュメントへの追加提案

### 3. Scope_Manager_Prompt.md - スコープマネージャー

前工程の情報を統合し、実装単位（スコープ）を設計します。4つの重要ドキュメントを完成させます。

**主な責務**:
- ディレクトリ構造の統合と詳細化
- データモデルの一元管理と詳細化
- API設計の完成
- 環境変数リストの整理
- スコープの定義と優先順位付け
- CURRENT_STATUS.mdの初期化

### 4. Scope_Implementation_Assistant_Prompt.md - 実装アシスタント

定義されたスコープに基づいてコードを実装し、進捗状況を更新します。

**主な責務**:
- スコープに含まれる各ファイルの実装
- APIエンドポイントの実装
- データモデルの使用（必要に応じて拡張提案）
- CURRENT_STATUS.mdの更新
- 環境変数使用状況の記録
- 次のスコープ情報の更新

### 5. DebugDetective.md - デバッグ探偵

エラーの根本原因を特定し、最適な解決策を提案します。コード全体の品質と整合性を向上させます。

**主な責務**:
- エラーの詳細分析と根本原因特定
- データモデル関連の問題診断
- 最適解決策の設計
- 実装と検証
- 同様の問題防止策の提案

### 6. environmentVariablesAssistant-requirements.md - 環境変数アシスタント

環境変数の検出、設定、検証を支援します。非技術者でも環境変数を適切に管理できるようにします。

**主な責務**:
- 必要な環境変数の自動検出
- 環境変数の設定支援
- 接続テストと検証
- env.mdの更新
- デプロイ情報連携

## ファイル連携メカニズム

### 1. 結合ファイル連携方式

最も推奨される連携方式。複数のファイルを一時的な結合ファイルにまとめてClaudeCodeに提供します。

```typescript
// 結合ファイル方式の実装例
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

### 2. UI情報連携方式 (環境変数アシスタント用)

環境変数アシスタント専用の連携方式。UIの状態情報をJSONファイルとして共有し、ClaudeCodeからの操作指示を実行します。

```typescript
// UI状態スナップショット
const domSnapshot = {
  timestamp: Date.now(),
  elements: captureUIElements(),
  activeElementId: document.activeElement?.getAttribute('data-claude-id'),
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  currentScreenshot: `screenshot_${Date.now()}.png`
};

// ファイルに保存
fs.writeFileSync('.claude_data/dom_structure.json', JSON.stringify(domSnapshot));

// 操作指示を監視
fs.watch('.claude_data/actions.json', (eventType) => {
  if (eventType === 'change') {
    const actions = JSON.parse(fs.readFileSync('.claude_data/actions.json', 'utf8'));
    executeActions(actions);
  }
});
```

## 実装優先度・計画

### フェーズ1: 基本構造の確立（優先度: 最高）

1. **CLAUDE.md**: プロジェクト中心情報の単一の真実源
2. **docs/CURRENT_STATUS.md**: 進捗管理の中心
3. **docs/templates/**: テンプレートファイル
4. **docs/prompts/**: アシスタントプロンプト

### フェーズ2: 設計文書の整備（優先度: 高）

1. **docs/requirements.md**: 要件定義
2. **docs/structure.md**: ディレクトリ構造
3. **docs/data_models.md**: データモデル定義
4. **docs/api.md**: API設計
5. **docs/env.md**: 環境変数リスト

### フェーズ3: 連携メカニズムの実装（優先度: 中）

1. 結合ファイル方式の実装
2. .claude_data/ ディレクトリの設定
3. UI情報連携の実装（環境変数アシスタント用）

### フェーズ4: 補完機能の追加（優先度: 低）

1. **logs/debug/**: デバッグ情報管理
2. **deploy.md**: デプロイ情報
3. テスト検証システム

## プロセスフロー

1. **プロジェクト初期化**:
   - ProjectManagementService.createProject()
   - createInitialDocuments()
   - ClaudeMdService.generateClaudeMd()

2. **要件定義**:
   - 要件定義アドバイザーで基本要件を整理
   - モックアップを生成
   - 初期設計ドキュメントを作成

3. **モックアップ分析**:
   - 各ページのモックアップを解析
   - 詳細要件を抽出
   - 設計ドキュメントを更新

4. **スコープ管理**:
   - スコープマネージャーでスコープを定義
   - 4つの核心ドキュメントを完成
   - CURRENT_STATUS.mdを初期化

5. **実装フェーズ**:
   - スコープ実装アシスタントでコード生成
   - 進捗状況更新
   - 次のスコープの準備

6. **デバッグフェーズ**:
   - エラー発生時にデバッグ探偵が分析
   - 解決策を実装
   - 知識ベースに追加

7. **環境変数管理**:
   - 環境変数アシスタントで環境設定
   - 接続テスト・検証
   - env.md更新

## おわりに

この理想的な構成は、VSCodeでの設計作業とClaudeCodeでの実装を効果的に連携させ、「非技術者でもアプリケーション開発ができる」というAppGeniusの目標を実現します。CLAUDE.mdを中心とした「単一の真実源」原則と、明確に定義されたアシスタントの役割分担により、開発プロセス全体がスムーズに進行します。