# src ディレクトリクリーンアップ計画 [2025-05-13]

## 1. 概要

現在の src ディレクトリから、理想的なディレクトリ構造に含まれないファイルや古いバックアップファイルの削除を行うためのリストです。このリストは `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/refactoring/src-structure-2025-05-13.md` の理想的な構造に従って作成されています。

## 2. 削除推奨ファイル

### 2.1 バックアップファイル (即時削除推奨)

バックアップファイルは既にGitで管理されているため、即時削除可能です。

```bash
# バックアップファイル
git rm src/extension.ts.auth_fix_backup
git rm src/extension.ts.bak
git rm src/extension.ts.pre_auth_fix
git rm src/extension.ts.saved
git rm src/extension.ts.update
git rm src/services/ProjectManagementService.ts.bak
git rm src/ui/auth/UsageIndicator.ts.backup
git rm src/ui/scopeManager/ScopeManagerPanel.ts.bak
git rm src/ui/scopeManager/services/FileSystemService.ts.bak
git rm src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts.info
```

### 2.2 不要なシステムファイル (即時削除推奨)

`.DS_Store`ファイルは即時削除可能です。また、.gitignoreに追加することで今後も追跡されないようにします。

```bash
# .DS_Storeファイル (gitで追跡されていない場合はrmコマンドで削除)
rm -f src/.DS_Store
rm -f src/core/.DS_Store
rm -f src/services/.DS_Store
rm -f src/ui/.DS_Store
rm -f src/ui/scopeManager/.DS_Store
rm -f src/ui/scopeManager/services/.DS_Store
rm -f src/ui/{webview/.DS_Store
```

### 2.3 プロンプトライブラリ関連 (未使用機能)

プロンプトライブラリ関連ファイルは現在使用されていないため削除推奨です。

```bash
# プロンプトライブラリ関連
git rm src/commands/promptLibraryCommands.ts
git rm -r src/ui/promptLibrary/
git rm -r src/services/prompt/
git rm src/services/PromptServiceClient.ts
```

### 2.4 不要なユーティリティ/ヘルパーファイル

理想構造に含まれない不要なユーティリティファイルです。

```bash
# 不要なユーティリティ
git rm src/ext-fix.ts
git rm src/claude_code_counter_event_listener.ts
git rm src/utils/ToolkitManager.ts
git rm src/utils/ToolkitUpdater.ts
git rm src/utils/ClaudeMdService.ts
git rm src/utils/configManager.ts
```

### 2.5 不要なUIコンポーネント

理想的な構造では不要になるUIコンポーネントです。

```bash
# 不要なUIコンポーネント
git rm src/ui/chatPanel.ts
git rm src/ui/ChatViewProvider.ts
git rm src/ui/CommandHandler.ts
git rm src/ui/ImplementationViewProvider.ts
git rm src/ui/sidebarProvider.ts
git rm src/ui/TerminalInterface.ts
git rm src/ui/userProfile/UserProfilePanel.ts
git rm -r src/ui/environmentVariables/
```

### 2.6 重複/古いサービス

新しい構造では整理統合されるため削除または置き換えが必要なサービスです。

```bash
# 重複/古いサービス
# ⚠️ 注意: ClaudeCodeLauncherService.tsは直接削除せず、代替実装に移行後に削除すること
# git rm src/services/ClaudeCodeLauncherService.ts
git rm src/services/ClaudeCodeIntegrationService.ts
git rm src/services/ClaudeCodeAuthSync.ts
git rm src/services/AppGeniusStateManager.ts
git rm src/services/ProjectManagementService.ts
git rm src/services/EnvironmentVariablesService.ts
git rm src/services/mockupStorageService.ts
# ⚠️ 注意: launcher/ディレクトリは必要なコンポーネントを含むため削除しない（CoreLauncherService.tsなど）
# git rm -r src/services/launcher/
git rm src/services/cli/CLIProgressService.ts
```

### 2.7 既に削除されたmodes関連ファイル (確認のみ)

以下のファイルはすでに削除されています。git statusでも`D`として表示されていることを確認しました。

- src/core/codeGenerator.ts
- src/core/gitManager.ts
- src/core/projectAnalyzer.ts
- src/modes/.DS_Store
- src/modes/designMode/designPhases.ts
- src/modes/designMode/mockupDesigner.ts
- src/modes/implementationMode/codeEditor.ts
- src/modes/implementationMode/implementationPhases.ts
- src/modes/implementationMode/scopeSelector.ts
- src/modes/implementationMode/testGenerator.ts
- src/modes/requirementMode/mockupGenerator.ts
- src/modes/requirementMode/requirementManager.ts
- src/scope-manager-fix.md

### 2.8 不要なコアファイル

適切な場所に移動すべきコアファイルです。

```bash
# core/ディレクトリから移動すべきファイル
git rm src/core/requirementsParser.ts  # services/requirementsParserService.tsに移動
git rm src/core/aiDevelopmentService.ts
git rm src/core/aiService.ts
```

## 3. 削除手順

1. バックアップを作成してから削除作業を行ってください
   ```bash
   git add .
   git commit -m "chore: バックアップコミット（削除作業前）"
   git checkout -b cleanup-src-directory
   ```

2. カテゴリごとにまとめて削除し、その都度動作確認を行うことを推奨します
   ```bash
   # 例: バックアップファイルを削除
   # (2.1のコマンドを実行)
   
   # 動作テスト
   npm run test
   
   # 問題なければコミット
   git commit -m "chore: バックアップファイルの削除"
   ```

3. 他のカテゴリも同様に削除とテストを繰り返してください

4. すべての削除が完了したら最終テストを行ってからマージしてください
   ```bash
   # 最終テスト
   npm run test
   
   # 問題なければメインブランチにマージ
   git checkout main
   git merge cleanup-src-directory
   ```

## 4. 注意事項

- 依存関係が複雑なファイルはすぐに削除せず、まずリファクタリングを行ってから削除してください
- 特に新しい認証システムへの移行は慎重に行ってください
- 削除前に必ずバックアップを作成し、復元手段を確保してください

## 5. 個別リファクタリング計画

各ファイルの詳細なリファクタリング計画は以下の別ファイルに記載しています：

- [requirementsParser.ts リファクタリング計画](requirementsParser-2025-05-13.md)

## 6. 削除済みコンポーネント

以下のコンポーネントは既に削除されました：

### 6.1 ProjectStateService
- 場所: `/src/services/projectState/ProjectStateService.ts`
- 削除理由: 使用されていない。NoProjectViewPanelがScopeManagerPanelに直接通信するように変更され、中間層として不要になった
- 移行先: ProjectServiceImpl + 直接VSCode設定への保存 (`NoProjectViewPanel.ts` 内で実装)
- 関連変更:
  - `extension.ts`から不要なインポート削除
  - `/src/services/projectState/` ディレクトリ削除
  - 削除日: 2025-05-13

### 6.2 ReferenceStorageService
- 場所: `/src/services/referenceStorageService.ts`
- 削除理由: 未使用。リファレンス管理機能はUI上で使われていない
- 移行先: なし（機能自体が未使用）
- 関連変更:
  - 削除日: 2025-05-13