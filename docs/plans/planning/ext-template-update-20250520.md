# 機能拡張計画: テンプレートファイル自動更新機能 [2025-05-20]

## 1. 拡張概要

プロジェクト新規作成時および既存プロジェクト読み込み時に、最新のテンプレート（SCOPE_PROGRESS_TEMPLATE.mdとCLAUDETEMPLATE.md）に基づいてSCOPE_PROGRESS.mdとCLAUDE.mdファイルを自動的に更新する機能を実装します。これにより、すべてのプロジェクトで最新のフォーマットと内容を維持できます。

## 2. 詳細仕様

### 2.1 現状と課題

現在、プロジェクト新規作成時にはSCOPE_PROGRESS.mdとCLAUDE.mdファイルが作成されますが、古いテンプレートに基づく内容が使用されている場合や、既存プロジェクト読み込み時に古いフォーマットのままになる問題があります。テンプレートファイルが更新されても、既存プロジェクトには反映されません。

### 2.2 拡張内容

1. 新規プロジェクト作成時に、最新のSCOPE_PROGRESS_TEMPLATE.mdとCLAUDETEMPLATE.mdの内容を使用してファイルを作成する機能を実装します。
2. 既存プロジェクト読み込み時に、SCOPE_PROGRESS.mdとCLAUDE.mdファイルが存在しない場合は最新のテンプレートに基づいて作成し、存在する場合はそのまま使用するようにします。
3. テンプレート内容を取得するための専用メソッドを実装し、常に最新のテンプレートファイルを参照するようにします。

### 3 ディレクトリ構造

変更が必要なファイルの構造は以下の通りです：

```
src/
  ui/
    scopeManager/
      services/
        implementations/
          FileSystemServiceImpl.ts (更新)
          ProjectServiceImpl.ts (更新)
    noProjectView/
      NoProjectViewPanel.ts (更新)
  utils/
    ClaudeMdService.ts (更新)
```

## 4. 技術的影響分析

### 4.1 影響範囲

- **バックエンド**: プロジェクト管理サービス、ファイルシステムサービス
- **フロントエンド**: プロジェクト作成・読み込みUI
- **その他**: テンプレートファイル参照ロジック

### 4.2 変更が必要なファイル

```
- src/ui/scopeManager/services/implementations/FileSystemServiceImpl.ts: _createProgressTemplate メソッドの更新
- src/utils/ClaudeMdService.ts: getDefaultTemplate メソッドの更新
- src/ui/scopeManager/services/implementations/ProjectServiceImpl.ts: createProject および loadExistingProject メソッドの更新
- src/ui/noProjectView/NoProjectViewPanel.ts: _handleCreateProject および _handleLoadExistingProject メソッドの更新
```

## 5. タスクリスト

```
- [ ] **T1**: FileSystemServiceImpl.ts の _createProgressTemplate メソッドを更新し、テンプレートファイルから内容を動的に読み込むよう変更
- [ ] **T2**: ClaudeMdService.ts の getDefaultTemplate メソッドを更新し、テンプレートファイルから内容を動的に読み込むよう変更
- [ ] **T3**: ProjectServiceImpl.ts の createProject メソッドを更新し、SCOPE_PROGRESS.md と CLAUDE.md ファイルを最新テンプレートで作成
- [ ] **T4**: ProjectServiceImpl.ts の loadExistingProject メソッドを更新し、必要に応じてテンプレートファイルを最新化
- [ ] **T5**: NoProjectViewPanel.ts のプロジェクト作成・読み込み処理も同様に更新
- [ ] **T6**: 実装のテスト：新規プロジェクト作成時と既存プロジェクト読み込み時の両方でテスト
```

### 6 テスト計画

1. 新規プロジェクト作成テスト
   - 新規プロジェクトを作成し、生成された SCOPE_PROGRESS.md と CLAUDE.md が最新のテンプレートに基づいているか確認
   - プロジェクト名やその他の変数が正しく置換されているか確認

2. 既存プロジェクト読み込みテスト
   - SCOPE_PROGRESS.md と CLAUDE.md が存在しない既存フォルダをプロジェクトとして読み込み、適切にファイルが生成されるか確認
   - すでにこれらのファイルが存在する場合、元の内容が維持されるか確認

## 7. SCOPE_PROGRESSへの統合

[SCOPE_PROGRESS.md]に単体タスクとして統合します。

```markdown
- [ ] **T-TEMPLATE-1**: テンプレートファイル自動更新機能の実装
  - 目標: 2025-05-22
  - 参照: [/docs/plans/planning/ext-template-update-20250520.md](/docs/plans/planning/ext-template-update-20250520.md)
  - 内容: プロジェクト新規作成・読み込み時に最新のSCOPE_PROGRESS_TEMPLATEとCLAUDETEMPLATEに基づいてファイルを更新する機能を実装
```

## 8. 備考

この変更はプロジェクト作成と読み込みのタイミングでのみ影響し、既存の動作を妨げることはありません。テンプレート内容の更新は、専用のメソッドを通じて行われるため、将来的なテンプレートの更新にも柔軟に対応できます。既存プロジェクトにおける既存ファイルは尊重され、上書きされません。