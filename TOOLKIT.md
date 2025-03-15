# AppGenius ツールキット

このドキュメントはAppGeniusツールキットのファイル構成、AIアシスタント連携、およびワークフローを定義します。「非技術者でもアプリケーション開発ができる」環境を実現するための構成です。

## 理想的なファイル・フォルダ構成

```
ProjectName/
├── CLAUDE.md                     # プロジェクト中心情報（単一の真実源）
├── docs/                         # ドキュメントとプロンプト
│   ├── CURRENT_STATUS.md         # 進捗状況と実装状態
│   ├── requirements.md           # 全体要件定義
│   ├── structure.md              # ディレクトリ構造 
│   ├── api.md                    # API定義
│   ├── data_models.md            # データモデル定義（単一の真実源）
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

## AI アシスタント構成

AppGeniusプラットフォームは4つの主要AIアシスタントと連携システムで構成されています：

### 1. 要件定義アドバイザー (requirements_advisor.md)
**役割**: プロジェクトの要件を整理し、基本設計情報を提供
**主な責務**:
- 要件の明確化と具体化
- 基本的なデータモデルの特定
- 主要APIエンドポイントの特定
- 初期ディレクトリ構造の提案

### 2. モックアップ解析アシスタント (mockup_analyzer.md)
**役割**: モックアップからページごとの詳細要件を抽出・整理
**主な責務**:
- UI要素の詳細分析
- データ構造とAPI連携の特定
- 実装ファイルリストの作成
- 各設計ドキュメントへの追加提案

### 3. スコープマネージャー (scope_manager.md)
**役割**: 前工程の情報を統合し、実装単位（スコープ）を設計
**主な責務**:
- ディレクトリ構造の統合と詳細化
- データモデルの一元管理と詳細化
- API設計の完成
- 環境変数リストの整理
- 認証システムアーキテクチャの設計
- スコープの定義と優先順位付け
- CURRENT_STATUS.mdの初期化
- UI先行開発・API後続統合モデルの確立

### 4. スコープ実装アシスタント (scope_implementer.md)
**役割**: 定義されたスコープに基づいてコードを実装
**主な責務**:
- スコープに含まれる各ファイルの実装
- APIエンドポイントの実装
- データモデルの使用（必要に応じて拡張提案）
- CURRENT_STATUS.mdの更新
- 環境変数使用状況の記録
- 次のスコープ情報の更新

### 連携システム
- **デバッグ探偵 (debug_detective.md)**: エラー検出と解決のアシスタント
- **環境変数アシスタント (environment_manager.md)**: 環境設定の管理と最適化

## 核心ドキュメント構成

以下の4つの核心ドキュメントが各アシスタント間で連携し、情報が段階的に詳細化されます：

### 1. ディレクトリ構造 (structure.md)
- **要件定義アドバイザー**: 基本構造のみを定義
- **モックアップ解析アシスタント**: 各ページの具体的なファイルを追加
- **スコープマネージャー**: 完全な構造を統合・確立

### 2. データモデル (data_models.md)
- **要件定義アドバイザー**: 主要エンティティの特定
- **モックアップ解析アシスタント**: UIから属性と関係を詳細化
- **スコープマネージャー**: 初期データモデルを統合し全体設計を管理
- **スコープ実装アシスタント**: 実装時に必要なデータモデルの拡張・詳細化（data_models.mdを更新）

### 3. API設計 (api.md)
- **要件定義アドバイザー**: 主要エンドポイントの特定
- **モックアップ解析アシスタント**: 具体的なAPIパラメータと形式の定義
- **スコープマネージャー**: 一貫性のあるAPI設計の確立
- **スコープ実装アシスタント**: API実装と仕様との整合性確保

### 4. 環境変数リスト (env.md)
- **要件定義アドバイザー**: 基本的な環境変数の特定
- **モックアップ解析アシスタント**: 具体的な接続設定などの追加
- **スコープマネージャー**: 環境変数の統合と分類
- **環境変数アシスタント**: 実際の値の設定と検証

## 核心ドキュメント詳細

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
- 関連ドキュメント参照（ディレクトリ構造、データモデル、API設計、環境変数リスト、デプロイ情報）
- 認証システム設計原則（レイヤー分離アーキテクチャ、単一責任の原則、JWTベースの認証フロー、ユーザー関連操作の標準化、エラーハンドリングの一貫性）
- 全体進捗（ファイル数と進捗率）
- スコープ状況（完了済み/進行中/未着手）
- 現在のディレクトリ構造
- 実装完了ファイルと実装中ファイル
- 引継ぎ情報（現在のスコープ詳細）
- 次回実装予定（次のスコープ詳細）
- 環境変数設定状況（カテゴリ別、スコープ別）
- データモデル使用状況（データモデル管理ポリシー、スコープ別使用状況）
- 発生した問題と解決策

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

### データベース設定
[ ] DB_HOST - データベースホスト名
[ ] DB_PORT - データベースポート
[ ] DB_NAME - データベース名
[ ] DB_USER - データベースユーザー名
[ ] DB_PASSWORD - データベースパスワード

### API設定
[ ] API_BASE_URL - API基本URL
[ ] API_KEY - APIキー
[ ] API_VERSION - APIバージョン

### サーバー設定
[x] PORT - アプリケーションポート
[x] NODE_ENV - 実行環境（development/production/test）

### 認証設定
[!] JWT_SECRET - JWT認証用シークレットキー（使用確認済み、設定要）
[ ] SESSION_SECRET - セッション用シークレットキー

### スコープ別必要環境変数

#### スコープ1: [スコープ名]
必要な環境変数:
[x] [環境変数名] - [説明]
[x] [環境変数名] - [説明]

#### スコープ3: [スコープ名] (現在進行中)
必要な環境変数:
[!] [環境変数名] - [説明] (使用確認済み、仮の値で実装中)
[ ] [環境変数名] - [説明]
```

**状態マーカーの意味**:
- [ ] - 未設定の環境変数
- [x] - 設定済みの環境変数
- [!] - 使用中または仮実装の環境変数（要確認）

## ファイル連携メカニズム

### 1. 中央ポータル連携方式（安全版）

最も推奨される連携方式。中央ポータルからプロンプトを取得し、必要に応じて追加情報を結合してClaudeCodeに提供します。セキュリティ対策として一時ファイルは使用後に自動削除されます。

```typescript
// 中央ポータル連携方式の実装例
async function launchWithSecurePrompt(promptUrl, projectPath, additionalContent) {
  try {
    // ポータルからプロンプト情報を取得
    const integrationService = ClaudeCodeIntegrationService.getInstance();
    
    // 追加コンテンツがある場合はそれも含めて起動
    const result = await integrationService.launchWithPublicUrl(
      promptUrl,           // 中央ポータルのプロンプトURL
      projectPath,         // プロジェクトパス
      additionalContent    // 追加情報（エラーログなど）
    );
    
    return result;
  } catch (error) {
    Logger.error('プロンプト起動エラー:', error);
    return false;
  }
}

// ClaudeCodeIntegrationService内の実装
public async launchWithPublicUrl(promptUrl, projectPath, additionalContent) {
  // プロンプト取得、一時ファイル作成
  const promptFilePath = path.join(os.tmpdir(), `prompt_${Date.now()}.md`);
  
  // 内容にadditionalContentを追加して保存
  // ...
  
  // 一時ファイルを安全に扱う設定でClaudeCodeを起動
  return await this._launcher.launchClaudeCodeWithPrompt(
    projectPath,
    promptFilePath,
    { 
      title: `ClaudeCode - ${prompt.title}`,
      deletePromptFile: true  // セキュリティ対策：使用後に自動削除
    }
  );
}
```

この方式は以下の利点があります：
1. **セキュリティ**: プロンプトファイルが一時的にのみ存在し、使用後自動削除
2. **一元管理**: プロンプト内容が中央ポータルで管理され、常に最新
3. **柔軟性**: 追加情報（エラーログなど）を動的に結合可能
4. **共有**: チーム間でプロンプトを共有しやすい

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

## 開発ワークフロー

AppGeniusのツールキットを使用した開発ワークフローは以下の通りです：

1. **プロジェクト初期化**:
   - ProjectManagementService.createProject()
   - createInitialDocuments()
   - ClaudeMdService.generateClaudeMd()

2. **要件定義フェーズ**:
   - 要件定義アドバイザーで基本要件を整理
   - 初期モックアップHTMLを生成
   - 初期設計ドキュメントを作成

3. **モックアップ分析フェーズ**:
   - モックアップギャラリーで各ページのUIを改善
   - 各ページごとに詳細要件を定義(`scopes/*-requirements.md`)
   - structure.md、data_models.md、api.md、env.mdを更新・詳細化

4. **スコープ管理フェーズ**:
   - スコープマネージャーが前工程の情報を統合
   - 最終的なstructure.md、data_models.md、api.md、env.mdを確立
   - 実装順序と依存関係を定義
   - CURRENT_STATUS.mdに初期状態を設定

5. **実装フェーズ**:
   - スコープ実装アシスタントが各スコープをClaudeCodeで実装
   - 進捗状況更新（CURRENT_STATUS.md）
   - 次のスコープの準備

6. **デバッグフェーズ**:
   - エラー発生時にデバッグ探偵が分析
   - 解決策を実装
   - 知識ベースに追加

7. **環境変数管理フェーズ**:
   - 環境変数アシスタントで環境設定
   - 接続テスト・検証
   - env.md更新

## 実装優先度

プロジェクト開始時に作成すべきファイルの優先順位：

### フェーズ1: 基本構造の確立（優先度: 最高）

1. **CLAUDE.md**: プロジェクト中心情報の単一の真実源
2. **docs/CURRENT_STATUS.md**: 進捗管理の中心
3. **docs/prompts/**: アシスタントプロンプト
   - requirements_advisor.md
   - mockup_analyzer.md
   - scope_manager.md
   - scope_implementer.md
   - debug_detective.md
   - environment_manager.md

### フェーズ2: 設計文書の準備（優先度: 高）

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

## 環境変数管理フロー

環境変数の状態は、env.mdおよびCURRENT_STATUS.mdにおいて以下の表記ルールで管理されます：

```markdown
# 環境変数設定状況

### データベース設定
[ ] DB_HOST - データベースホスト名
[ ] DB_PORT - データベースポート
[x] DB_NAME - データベース名
[!] DB_PASSWORD - データベースパスワード（仮の値で実装中）

### API設定
[ ] API_KEY - APIキー
```

状態の遷移:
1. **未設定** `[ ]` - スコープマネージャーが初期化。設定が必要
2. **設定完了** `[x]` - 環境変数アシスタントで設定・検証済み
3. **要確認** `[!]` - 使用中または仮実装の環境変数。本番環境への移行前に確認が必要

## ツールキットの更新方法

AppGeniusのツールキットを更新する際は、以下のファイルを編集する必要があります：

1. **ProjectManagementService.ts** - プロジェクト作成時の配布ファイルを定義
   - 場所: `/src/services/ProjectManagementService.ts`
   - 機能: 新規プロジェクト作成時に配布されるファイルの内容を定義
   - 主要メソッド: `createInitialDocuments()` - テンプレートファイルの作成処理

以下のファイルを更新すると、新規プロジェクト作成時に配布されるファイルが変更されます：
- CURRENT_STATUS.mdテンプレート
- 各種プロンプトファイル (scope_manager.md, requirements_advisor.md など)
- 基本的なディレクトリ構造
- その他の初期設定ファイル

2. **toolkit-version.json** - ツールキットのバージョン情報
   - バージョン番号や依存関係を更新することで、ダッシュボード表示を変更

3. **TOOLKIT.md** - ツールキットの構成ドキュメント
   - このファイルを更新し、新機能や変更点を反映

ツールキットの更新履歴と変更点はバージョン管理されます。重要な更新を行った場合は、toolkit-version.jsonのバージョン番号を上げることを忘れないでください。

## おわりに

この構成は、VSCodeでの設計作業とClaudeCodeでの実装を効果的に連携させ、「非技術者でもアプリケーション開発ができる」というAppGeniusの目標を実現します。CLAUDE.mdを中心とした「単一の真実源」原則と、明確に定義されたアシスタントの役割分担により、開発プロセス全体がスムーズに進行します。