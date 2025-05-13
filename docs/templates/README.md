# テンプレート集

このディレクトリには、AppGeniusプロジェクトで使用するさまざまなテンプレートが含まれています。統一されたテンプレートを使うことで、ドキュメントの一貫性と品質を確保します。

## 主要テンプレート

- [Markdownテンプレートガイド](./markdown-template-guide.md) - Markdownの書式とテンプレート作成ガイドライン
- [CLAUDEテンプレート](./claude-template.md) - プロジェクトのCLAUDE.md用テンプレート
- [スコープ進捗テンプレート](./scope-progress-template.md) - プロジェクトのスコープ進捗管理用テンプレート

## テンプレートカテゴリ

### プロンプトテンプレート

`/templates/prompts/` ディレクトリには、AIプロンプト用のテンプレートが含まれています：

- [要件作成テンプレート](./prompts/requirements-creator-template.md)
- [プロジェクト分析テンプレート](./prompts/project-analysis-template.md)
- [スコープ計画テンプレート](./prompts/scope-planner-template.md)
- [API設計テンプレート](./prompts/api-designer-template.md)
- [データモデル設計テンプレート](./prompts/data-model-architect-template.md)
- [モックアップ作成テンプレート](./prompts/mockup-creator-template.md)

### サンプルテンプレート

`/templates/samples/` ディレクトリには、実際の使用例を示すサンプルが含まれています：

- [初期スコープ進捗テンプレート](./samples/initial-scope-progress-template.md)

## テンプレートの使用方法

1. プロジェクトに適したテンプレートを選択します
2. ファイルをコピーして新しいドキュメントを作成します
3. プレースホルダー（`[項目名]`形式）を実際の内容で置き換えます
4. メタデータ（バージョン、日付、作成者など）を更新します
5. 不要なセクションを削除し、必要なセクションを追加します

## テンプレート命名規則

- すべてのテンプレートファイルには `-template` サフィックスを使用します
- 基本的にはハイフン区切りの小文字英字を使用します（例: `api-spec-template.md`）
- カテゴリごとにサブディレクトリに整理します