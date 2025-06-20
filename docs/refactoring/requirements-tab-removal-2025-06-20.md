# リファクタリング計画: 要件定義タブ削除 2025-06-20

## 1. 現状分析

### 1.1 対象概要
要件定義タブは、AppGenius時代にアプリ開発の要件定義書（requirements.md）を表示・編集するために実装された機能です。LP作成専用ソフトウェアへの移行に伴い、この機能は不要となったため安全に削除する必要があります。

### 1.2 問題点と課題
- LP作成においては要件定義タブは不要
- UI上でタブは既に非表示になっているが、バックエンドの処理ロジックが残存
- 複数のファイルに散在する関連コードが技術的負債となっている
- ファイル監視やメッセージハンドリングなど、不要な処理がリソースを消費

### 1.3 関連ファイル一覧
#### バックエンド（TypeScript）
- `src/ui/scopeManager/ScopeManagerPanel.ts`
- `src/ui/scopeManager/templates/ScopeManagerTemplate.ts`
- `src/ui/scopeManager/services/TabStateService.ts`
- `src/ui/scopeManager/services/implementations/FileWatcherServiceImpl.ts`
- `src/ui/scopeManager/services/implementations/FileSystemServiceImpl.ts`
- `src/ui/scopeManager/services/interfaces/IFileSystemService.ts`
- `src/ui/scopeManager/services/interfaces/IFileWatcherService.ts`

#### フロントエンド（JavaScript）
- `media/components/tabManager/tabManager.js`
- `media/components/markdownViewer/markdownViewer.js`
- `media/core/stateManager.js`

### 1.4 依存関係図
```
要件定義タブクリック
    ↓
tabManager.js (loadRequirementsFileメッセージ送信)
    ↓
ScopeManagerPanel.ts (メッセージ受信)
    ↓
TabStateService.loadRequirementsFile()
    ↓
FileSystemService.findRequirementsFile()
    ↓
FileWatcherService (ファイル監視設定)
    ↓
markdownViewer.js (コンテンツ表示)
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- コード行数の削減: 約300-400行（推定）
- 要件定義ファイル検索・監視処理の削除による軽量化
- メッセージハンドリングの簡素化
- 保守性の向上とコード理解の向上

### 2.2 維持すべき機能
- 進捗状況タブの表示・更新機能
- ファイルタブ（マークダウンビューワー）機能
- ClaudeCode連携タブ機能
- LPレプリカタブ機能
- プロジェクト管理機能

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
- 要件定義タブ関連の全処理を削除
- タブマネージャーを4タブ構成に簡素化
- ファイルシステムサービスから要件定義関連メソッドを削除
- メッセージハンドリングから不要なケースを削除

### 3.2 核心的な改善ポイント
- 単一責任の原則に基づく機能の整理
- 不要なファイル監視処理の削除
- インターフェース定義の簡素化

### 3.3 新しいディレクトリ構造
変更なし（削除のみのため）

## 4. 実装計画

### フェーズ1: HTMLテンプレート清掃
- **目標**: UIから要件定義タブ関連要素を完全削除
- **影響範囲**: ScopeManagerTemplate.ts
- **タスク**:
  1. **T1.1**: `_generateRequirementsTabContent`メソッドの削除
     - 対象: src/ui/scopeManager/templates/ScopeManagerTemplate.ts:271-282
     - 実装: メソッド全体を削除
  2. **T1.2**: HTMLテンプレートから要件定義タブコンテンツ生成呼び出しを削除
     - 対象: HTMLテンプレート生成箇所
     - 実装: `${this._generateRequirementsTabContent(activeTabId)}`削除
- **検証ポイント**:
  - UIに要件定義タブが表示されないことを確認
  - 他のタブが正常に表示されることを確認

### フェーズ2: フロントエンド処理削除
- **目標**: JavaScript側の要件定義タブ処理を削除
- **影響範囲**: tabManager.js, stateManager.js
- **タスク**:
  1. **T2.1**: tabManager.jsから要件定義タブクリック処理を削除
     - 対象: media/components/tabManager/tabManager.js:129-132, 384-426
     - 実装: 要件定義タブ関連の条件分岐とloadRequirementsFileメッセージ送信を削除
  2. **T2.2**: `_getFilePathFromTabId`メソッドから要件定義関連処理を削除
     - 対象: media/components/tabManager/tabManager.js:220-225
     - 実装: requirements条件分岐を削除
  3. **T2.3**: stateManager.jsから要件定義関連状態管理を削除
     - 対象: 要件定義コンテンツやフラグの状態管理部分
     - 実装: requirementsContent, requirementsNeedsUpdate等の削除
- **検証ポイント**:
  - 他のタブクリック時に正常動作することを確認
  - JavaScript エラーが発生しないことを確認

### フェーズ3: バックエンドサービス層清掃
- **目標**: サービス層から要件定義関連メソッドを削除
- **影響範囲**: TabStateService.ts, FileSystemServiceImpl.ts, FileWatcherServiceImpl.ts
- **タスク**:
  1. **T3.1**: TabStateService.loadRequirementsFileメソッドの削除
     - 対象: src/ui/scopeManager/services/TabStateService.ts:137-164
     - 実装: メソッド全体とインターフェース定義を削除
  2. **T3.2**: FileSystemServiceから要件定義ファイル関連メソッドを削除
     - 対象: findRequirementsFile, getRequirementsFilePath, setupRequirementsWatcher
     - 実装: メソッド実装とインターフェース定義を削除
  3. **T3.3**: FileWatcherServiceから要件定義ファイル監視を削除
     - 対象: loadRequirementsFileNow, 要件定義ファイル監視設定
     - 実装: メソッドと監視設定処理を削除
- **検証ポイント**:
  - TypeScriptコンパイルエラーがないことを確認
  - 他のファイル監視機能が正常動作することを確認

### フェーズ4: メッセージハンドラー清掃
- **目標**: loadRequirementsFileメッセージハンドラーを削除
- **影響範囲**: ScopeManagerPanel.ts, MessageDispatchServiceImpl.ts
- **タスク**:
  1. **T4.1**: ScopeManagerPanelからloadRequirementsFileメッセージハンドラーを削除
     - 対象: メッセージ処理switch文またはハンドラー登録箇所
     - 実装: 該当するcase文またはハンドラー登録を削除
  2. **T4.2**: MessageDispatchServiceImplから関連処理を削除（存在する場合）
     - 対象: loadRequirementsFile関連のメッセージルーティング
     - 実装: 関連するルーティング処理を削除
- **検証ポイント**:
  - 他のメッセージが正常に処理されることを確認
  - 未処理メッセージによるエラーが発生しないことを確認

### フェーズ5: インターフェース定義清掃
- **目標**: 不要なインターフェース定義を削除
- **影響範囲**: IFileSystemService.ts, IFileWatcherService.ts, ITabStateService等
- **タスク**:
  1. **T5.1**: IFileSystemServiceから要件定義関連メソッド定義を削除
     - 対象: findRequirementsFile, getRequirementsFilePath等の宣言
     - 実装: インターフェースから該当メソッドシグネチャを削除
  2. **T5.2**: IFileWatcherServiceから要件定義関連メソッド定義を削除
     - 対象: loadRequirementsFileNow等の宣言
     - 実装: インターフェースから該当メソッドシグネチャを削除
  3. **T5.3**: その他のインターフェースから要件定義関連定義を削除
     - 対象: 要件定義関連の型定義やプロパティ
     - 実装: 不要な定義の削除
- **検証ポイント**:
  - TypeScriptの型チェックが通ることを確認
  - インターフェース実装が正しいことを確認

## 5. 期待される効果

### 5.1 コード削減
- 推定削除行数: 300-400行
- 削除される主要機能: ファイル検索、ファイル監視、メッセージハンドリング、UI処理
- 削除されるメソッド数: 約10-15個

### 5.2 保守性向上
- 責任の分離: LP作成に不要な機能の削除
- コード理解の向上: 関心の分離による単純化
- バグ発生リスクの軽減: 不要な処理パスの削除

### 5.3 拡張性改善
- シンプルなタブ構成によるメンテナンスの容易化
- 新機能追加時の影響範囲の限定化
- テスト対象の削減

## 6. リスクと対策

### 6.1 潜在的リスク
- 他の機能が要件定義タブに依存している可能性
- ファイルシステムサービスの機能削除による影響
- メッセージハンドリングの削除による予期しない動作

### 6.2 対策
- 段階的な削除による影響確認
- 各フェーズ後の動作テスト実施
- TypeScriptコンパイルチェックによる依存関係確認
- 代替手段としてのマークダウンビューワー機能の確保

## 7. 備考

### 7.1 削除時の注意点
- 要件定義ファイル（requirements.md）自体は削除しない
- ユーザーが要件定義ファイルを参照したい場合は、マークダウンビューワーを使用可能
- プロジェクト管理機能には影響しない

### 7.2 将来的な考慮事項
- LP作成専用機能への特化が完了後、更なるコード整理を検討
- UI/UXの更なる改善を検討

### 7.3 代替機能
- 要件定義ファイルの閲覧: ファイルタブ（マークダウンビューワー）を使用
- ファイル編集: VSCodeの標準エディター機能を使用