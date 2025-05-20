# 機能拡張計画: テスト品質エンジニアプロンプトの追加 [2025-05-20]

## 1. 拡張概要

開発プロセスの品質保証を強化するため、バックエンド実装とフロントエンド実装の間にテスト品質エンジニアプロンプトを追加します。これにより、実装後のテスト工程が明確化され、品質向上につながります。

## 2. 詳細仕様

### 2.1 現状と課題

現在のプロンプト構成では、バックエンド実装（★8）の後にフロントエンド実装（★9）が続き、テスト工程が明示的に分離されていません。これにより、テスト品質の標準化や品質保証プロセスが不明確になる可能性があります。

### 2.2 拡張内容

1. バックエンド実装（★8）とフロントエンド実装（★9）の間に「★9テスト 総合、単体テストで品質保証」プロンプトを挿入します。
2. 指定されたURL（http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/5a3f08098fd5b7846602e9b5446b7d44）のプロンプト内容を使用します。
3. プロンプトカードに新しいテスト品質エンジニアプロンプトを追加します。
4. フロントエンド実装以降のプロンプト番号を1つずつ後ろにずらします（★9→★10, ★10→★11, ...）。

### 3 ディレクトリ構造

変更が必要なファイルの構造は以下の通りです：

```
docs/
  prompts/
    ★9vertical-slice-frontend-implementation-agent.md → ★10vertical-slice-frontend-implementation-agent.md
    ★10deploy_assistant.md → ★11deploy_assistant.md
    ★11gitmanager.md → ★12gitmanager.md
    ★12TypeScreptManager.md → ★13TypeScreptManager.md
    ★13debug_detective.md → ★14debug_detective.md
    ★14feature_implementation_assistant.md → ★15feature_implementation_assistant.md
    ★15refactoring_expert.md → ★16refactoring_expert.md
    ★9テスト品質エンジニア.md (新規追加)
media/
  components/
    promptCards/
      promptCards.js (更新)
```

## 4. 技術的影響分析

### 4.1 影響範囲

- **フロントエンド**: プロンプトカードUIコンポーネント
- **プロンプト定義**: プロンプトファイルとその番号付け
- **データモデル**: プロンプト情報マッピングの更新
- **その他**: なし

### 4.2 変更が必要なファイル

```
- /docs/prompts/★9vertical-slice-frontend-implementation-agent.md: ファイル名と内容の★番号を10に変更
- /docs/prompts/★10deploy_assistant.md: ファイル名と内容の★番号を11に変更
- /docs/prompts/★11gitmanager.md: ファイル名と内容の★番号を12に変更
- /docs/prompts/★12TypeScreptManager.md: ファイル名と内容の★番号を13に変更
- /docs/prompts/★13debug_detective.md: ファイル名と内容の★番号を14に変更
- /docs/prompts/★14feature_implementation_assistant.md: ファイル名と内容の★番号を15に変更
- /docs/prompts/★15refactoring_expert.md: ファイル名と内容の★番号を16に変更
- /docs/prompts/★9テスト品質エンジニア.md: 新規作成
- /media/components/promptCards/promptCards.js: プロンプトURLとプロンプト情報の更新
```

## 5. タスクリスト

```
- [ ] **T1**: テスト品質エンジニアの新規プロンプトファイル(★9テスト品質エンジニア.md)の作成
- [ ] **T2**: フロントエンド実装プロンプトのファイル名を★10に変更
- [ ] **T3**: デプロイアシスタントプロンプトのファイル名を★11に変更
- [ ] **T4**: Gitマネージャープロンプトのファイル名を★12に変更
- [ ] **T5**: TypeScriptマネージャープロンプトのファイル名を★13に変更
- [ ] **T6**: デバッグ探偵プロンプトのファイル名を★14に変更
- [ ] **T7**: 機能実装アシスタントプロンプトのファイル名を★15に変更
- [ ] **T8**: リファクタリングエキスパートプロンプトのファイル名を★16に変更
- [ ] **T9**: promptCards.jsの更新：新しいプロンプトURLの追加とプロンプト情報の更新
- [ ] **T10**: 各プロンプトファイル内の番号参照を更新
```

### 6 テスト計画

1. プロンプトカードUIが正しく表示されることを確認
   - すべてのプロンプトカードが正しい順序で表示されるか
   - 新しいテスト品質エンジニアのカードが正しい位置に表示されるか
   - カードのアイコン、タイトル、説明が正しいか

2. プロンプト起動機能が正常に動作することを確認
   - 各カードをクリックした際に正しいプロンプトが起動するか
   - 特に新しいテスト品質エンジニアのプロンプトが正しく起動するか

## 7. SCOPE_PROGRESSへの統合

[SCOPE_PROGRESS.md]に単体タスクとして統合します。

```markdown
- [ ] **T-TEST-1**: テスト品質エンジニアプロンプトの追加と番号の整理
  - 目標: 2025-05-21
  - 参照: [/docs/plans/planning/ext-prompt-cards-update-20250520.md]
  - 内容: バックエンド実装とフロントエンド実装の間にテスト品質エンジニアプロンプトを追加し、後続のプロンプト番号を調整する
```

## 8. 備考

この更新により、開発プロセスにおけるテスト工程が明確化され、品質保証がより強調されます。プロンプト番号の変更はUIおよびユーザーエクスペリエンスに最小限の影響しか与えません。