# AppGenius - 実装状況 (2025/03/18更新)

## 全体進捗
- 完成予定ファイル数: 82
- 作成済みファイル数: 41
- 進捗率: 50%
- 最終更新日: 2025/03/18

## スコープ状況

### 完了済みスコープ
- [x] スコープ名1 (100%)
- [x] スコープ名2 (100%)

### 進行中スコープ
- [ ] スコープ名3 (50%)
- [ ] UIリファクタリング (20%) - スコープマネージャーと簡易ダッシュボードの役割入れ替え

### 未着手スコープ
- [ ] スコープ名4 (0%)
- [ ] スコープ名5 (0%)

## 最終的なディレクトリ構造(予測)
```
project-root/
└── [ディレクトリ構造]
```

## 現在のディレクトリ構造
```
project-root/
└── [ディレクトリ構造]
```

## スコープ名1 
- [x] src/ui/auth/AuthStatusBar.ts
- [x] src/services/AuthEventBus.ts
- [x] src/core/auth/authCommands.ts
- [ ] src/ui/promptLibrary/PromptLibraryPanel.ts
- [ ] src/ui/promptLibrary/PromptEditor.ts
- [ ] src/ui/promptLibrary/CategoryManager.ts
- [ ] src/ui/promptLibrary/PromptImportExport.ts
- [ ] src/commands/promptLibraryCommands.ts

## スコープ名2
- [x] src/ui/auth/AuthStatusBar.ts
- [x] src/services/AuthEventBus.ts
- [x] src/core/auth/authCommands.ts
- [ ] src/ui/promptLibrary/PromptLibraryPanel.ts
- [ ] src/ui/promptLibrary/PromptEditor.ts

## スコープ名3

- [ ] src/ui/promptLibrary/PromptLibraryPanel.ts
- [ ] src/ui/promptLibrary/PromptEditor.ts

## UIリファクタリング - スコープマネージャーと簡易ダッシュボードの役割変更

### スコープマネージャーを新ダッシュボードに変更
- [ ] src/ui/scopeManager/ScopeManagerPanel.ts - 機能変更（要件定義、モックアップギャラリー、環境変数、デバッグ探偵へのリンク）
- [ ] media/scopeManager.js - UI更新とイベントハンドラー追加
- [ ] media/scopeManager.css - スタイル調整

### 簡易ダッシュボードの役割縮小
- [ ] src/ui/dashboard/DashboardPanel.ts - 機能をプロジェクト管理のみに制限
- [ ] media/dashboard.js - 不要な機能の削除
- [ ] media/dashboard.css - スタイル調整

### コマンド接続の更新
- [ ] src/extension.ts - コマンド定義の確認

### WebView呼び出し関係の整理
- [ ] src/commands/claudeCodeCommands.ts - 必要に応じて参照先パネルを変更
