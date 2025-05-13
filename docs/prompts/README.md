# AppGenius AIプロンプト一覧

このディレクトリには、AppGenisプロジェクトで使用するAIプロンプト集が含まれています。
各プロンプトは特定の開発タスクに特化し、AIに対して最適な指示を与えるように設計されています。

## ディレクトリ構造

- `/prompts/core/` - 基本的な開発フローに沿った順番付きプロンプト（01-15）
- `/prompts/specialized/` - 特殊用途のプロンプト
- `/prompts/templates/` - プロンプト作成用テンプレート

## コアプロンプト（開発フローに沿った順番）

### 要件定義・設計フェーズ
1. [要件定義](./core/01-requirements-creator.md) - ビジネス要件を具体的な機能要件に変換
2. [システムアーキテクチャ](./core/02-system-architecture.md) - 全体設計と技術スタック選定
3. [モックアップ作成](./core/03-mockup-creator-analyzer.md) - 視覚的なUI設計と実装ガイド生成
4. [データモデル統合](./core/04-data-model-assistant.md) - 一貫性のあるデータモデル設計
5. [データモデル精査](./core/05-tukkomi.md) - モデル設計の批判的レビューと改善提案

### 環境構築・基盤構築フェーズ
6. [環境変数設定](./core/06-env-assistant.md) - 環境変数の設定と管理
7. [認証システム構築](./core/07-auth-system-assistant.md) - 認証機能の実装
8. [デプロイ設定](./core/08-deploy-assistant.md) - クラウドデプロイと監視設定
9. [Git管理](./core/09-git-manager.md) - コード管理とバージョン管理

### 実装・テスト・保守フェーズ
10. [実装タスク分析](./core/10-implementation-task-analyzer.md) - 実装順序と依存関係の最適化
11. [スコープ実装](./core/11-scope-implementer.md) - 設計情報からの高品質コード生成
12. [テスト管理](./core/12-test-manager.md) - 効率的なテスト実装
13. [デバッグ探偵](./core/13-debug-detective.md) - エラー原因の分析と解決
14. [追加機能実装](./core/14-feature-implementation-assistant.md) - 機能追加要望の分析と実装
15. [リファクタリング](./core/15-refactoring-expert.md) - 技術的負債削減とコード改善

## 特化型プロンプト

- [デバッグ探偵（詳細版）](./specialized/debug_detective.md) - 複雑なバグを解析するための探偵アプローチ
- [環境変数マネージャー](./specialized/environment_manager.md) - 環境変数の管理と問題解決
- [GitHub管理](./specialized/github_upload_manager.md) - GitHubリポジトリ関連のタスク管理
- [リファクタリングマネージャー](./specialized/improved_refactoring_manager.md) - 大規模リファクタリングの計画と実行
- [モックアップ分析](./specialized/mockup_analyzer.md) - UIモックアップの解析とフィードバック
- [検証アシスタント](./specialized/verification_assistant.md) - 実装の検証と品質保証
- [機能拡張プランナー](./specialized/feature-extension-planner-ja.md) - 機能拡張の計画と設計（日本語）

## プロンプト開発ガイドライン

プロンプト作成時は以下のガイドラインを参考にしてください：

1. **明確な目的**: プロンプトの目的と期待される出力を明確に定義
2. **コンテキスト提供**: AI が効果的に応答できるよう十分な背景情報を提供
3. **一貫した構造**: テンプレートを使って一貫した構造を維持
4. **具体的な指示**: 抽象的な指示ではなく、具体的なタスクを指定
5. **エッジケースの考慮**: 例外的なケースや制約条件も考慮したプロンプト設計
6. **フィードバックループ**: 実際の使用結果に基づいてプロンプトを改善

詳細なガイドラインは[プロンプト最適化ガイド](./prompt_excellence_guide.md)を参照してください。

## プロンプトテンプレート

新しいプロンプトを作成する際は、`/prompts/templates/` にあるテンプレートを使用してください：

- [要件作成テンプレート](./templates/requirements-creator-template.md)
- [プロジェクト分析テンプレート](./templates/project-analysis-template.md)
- [API設計テンプレート](./templates/api-designer-template.md)
- [データモデル設計テンプレート](./templates/data-model-architect-template.md)
- [モックアップ作成テンプレート](./templates/mockup-creator-template.md)