# AppGenius ツールキットリファクタリング - 引き継ぎ資料

## 完了済み作業

1. **ファイル名の標準化**:
   - `docs/prompts/` ディレクトリを作成し、プロンプトファイルを集約
   - 標準命名規則の適用:
     - `requirementsadvicer.md` → `requirements_advisor.md` 
     - `Scope_Manager_Prompt.md` → `scope_manager.md`
     - `Scope_Implementation_Assistant_Prompt.md` → `scope_implementer.md` 
     - `DebagDetector.md` → `debug_detective.md`
     - `environmentVariablesAssistant-requirements.md` → `environment_manager.md`
     - `mockup_analysis_template.md` → `mockup_analyzer.md`

2. **ディレクトリ構造の更新**:
   - `.claude_ui_data/` → `.claude_data/` に名称変更
   - `scope.md` の削除（CURRENT_STATUS.mdに統合）

3. **ドキュメント更新**:
   - `TOOLKIT.md` の内容を全面更新
   - リファクタリング内容をコミット/プッシュ完了

4. **Template更新の準備**:
   - `ProjectManagementService.ts` の以下の部分を部分的に更新
     - `.claude_data/` ディレクトリ生成部分
     - `docs/prompts/` ディレクトリ生成
     - 各プロンプトファイルの保存先パス更新

## 未完了作業

1. **`ProjectManagementService.ts` 残りの更新**:
   - 残りの参照パス更新と内容変更
   - 特に `ドキュメントリンク` セクションの更新が必要

2. **`ClaudeMdService.ts` の更新**:
   - `getDefaultTemplate()` メソッドの完全更新
   - 特に以下の部分:
     - `ドキュメントリンク` セクション
     - `プロジェクト構造` セクション
     - アシスタント参照パス更新

3. **テスト**:
   - 実際に新規プロジェクトを作成して構造の確認
   - CLAUDE.mdの内容確認
   - 各プロンプトファイルが正しく配置されているか確認

## 更新すべきファイル

1. **`/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/services/ProjectManagementService.ts`**:
   - 765-785行: ドキュメントリンクセクション
   - 特に旧プロンプトへの参照を新パスに更新

2. **`/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/utils/ClaudeMdService.ts`**:
   - 767-783行: ドキュメントリンクセクション
   - 新しいプロジェクト構造セクションの追加

## 技術的注意点

1. **パス参照の一貫性**:
   - すべての参照を `docs/prompts/` パターンに統一
   - 絶対パスと相対パスの混在に注意

2. **プロジェクト構造の表現**:
   - 新しいフォルダ構造を正確に反映する
   - 不要なファイル/フォルダ（scope.md など）を削除

3. **コード更新時の注意点**:
   - テンプレート文字列内のエスケープシーケンス (`\` など) に注意
   - 長い文字列置換は部分的に実施する方が安全

## 既存コードの重要な側面

1. **ディレクトリ自動生成**:
   - `ProjectManagementService.ts` の `ensureDirectoryExists` メソッド
   - ディレクトリ構造の自動作成

2. **テンプレート生成**:
   - `ClaudeMdService.ts` の `getDefaultTemplate` メソッド
   - CLAUDE.md の基本内容定義

3. **プロンプトファイル保存**:
   - 各プロンプトファイルの保存先パスとファイル名

## 最終目標

このリファクタリングの完了により、新規プロジェクト作成時に以下の構造が自動生成されるようになります:

```
ProjectName/
├── CLAUDE.md                     # プロジェクト中心情報（単一の真実源）
├── docs/                         # ドキュメントとプロンプト
│   ├── CURRENT_STATUS.md         # 進捗状況と実装状態
│   ├── requirements.md           # 全体要件定義
│   ├── structure.md              # ディレクトリ構造 
│   ├── api.md                    # API定義
│   ├── data_models.md            # データモデル定義
│   ├── env.md                    # 環境変数リスト
│   ├── deploy.md                 # デプロイ情報
│   ├── scopes/                   # 個別スコープ要件
│   └── prompts/                  # AIアシスタントプロンプト
│       ├── requirements_advisor.md       # 要件定義アドバイザー
│       ├── mockup_analyzer.md            # モックアップ解析
│       ├── scope_manager.md              # スコープ管理
│       ├── scope_implementer.md          # 実装アシスタント
│       ├── debug_detective.md            # デバッグ探偵
│       └── environment_manager.md        # 環境変数アシスタント
├── mockups/                      # モックアップファイル
├── .claude_data/                 # ClaudeCodeとの連携データ
└── .env                          # 環境変数
```

これにより、ファイル構造と命名規則の標準化が実現し、より整理された開発環境となります。