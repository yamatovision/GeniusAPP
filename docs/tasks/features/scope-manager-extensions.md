# 機能変更計画書: スコープマネージャー拡張機能

## 1. ユーザーの要望

スコープマネージャーに以下の2つの機能を追加することが要望されています：

1. プロジェクト状況タブの隣に要件定義を表示するタブを追加する
2. docsフォルダのファイルを好きなように1つ表示させられるファイルブラウザ機能を追加する

モックアップとして「enhanced-scope-manager.html」が用意されており、これをベースに実装を行います。

## 実装状況（2025/05/08追記）

以下の実装が完了しました：

1. **FileSystemServiceの拡張（完了）**
   - `listDirectory`: ディレクトリ内のファイル一覧を取得するメソッドを追加
   - `readFile`: 任意のファイルを読み込むメソッドを追加
   - `getFileType`: ファイル種別を判定するメソッドを追加
   - 関連するイベントとイベントハンドラを追加

2. **型定義の追加（完了）**
   - `IProjectDocument`: ファイル情報を表す型
   - `ITabState`: タブ状態を表す型
   - `IFileBrowserState`: ファイルブラウザの状態を表す型

3. **FileBrowserコンポーネントの作成（完了）**
   - `fileBrowser.js`: ファイル一覧表示と操作のJSコンポーネント
   - `fileBrowser.css`: ファイルブラウザのスタイル定義

4. **TabManagerの拡張（完了）**
   - 新しいタブの選択イベント処理を追加
   - タブ切り替え時の初期化処理を追加

5. **ScopeManager.jsの修正（完了）**
   - FileBrowserコンポーネントのインポートと初期化
   - メッセージハンドラの追加

## 実装残課題

1. **HTMLテンプレートの修正（未完了）**
   - ScopeManagerPanel.tsの`_getHtmlForWebview`メソッドのHTMLテンプレート修正
   - 要件定義タブのコンテンツエリア追加
   - ファイルブラウザタブのコンテンツエリア追加
   - CSS・JSの読み込み設定

2. **ScopeManagerPanel.tsの機能追加（未完了）**
   - 要件定義ファイルを読み込むハンドラの実装
   - ファイルブラウザを操作するハンドラの実装
   - 新しいファイルを開くハンドラの実装

3. **リファクタリング検討事項**
   - ScopeManagerPanel.tsがサイズが大きすぎるため編集が困難
   - コンポーネント分割など、リファクタリングを検討すべき

## 2. 現状と課題

現在のスコープマネージャーは、主にプロジェクト状況（SCOPE_PROGRESS.md）を表示する機能に特化しており、以下の制限があります：

- 表示できるファイルはSCOPE_PROGRESS.mdかCURRENT_STATUS.mdのみ
- プロジェクトの要件定義ファイル（requirements.md）を表示するための専用タブがない
- プロジェクト内の他のdocsファイルを参照するためのインターフェースがない

これらの制限により、ユーザーはプロジェクトに関連する重要なドキュメントを効率的に閲覧・管理できない状況となっています。

## 3. 理想的なデータモデル設計

新しい機能に対応するため、以下のデータモデルの拡張を提案します：

```typescript
// スコープマネージャーで管理するファイル型の拡張
interface IProjectDocument {
  path: string;        // ファイルの絶対パス
  name: string;        // ファイル名
  type: string;        // ファイルの種類（markdown、json、その他など）
  lastModified: Date;  // 最終更新日時
  parentFolder?: string; // 親フォルダパス（階層表示用）
}

// タブ状態のデータモデル拡張
interface ITabState {
  id: string;          // タブID（current-status, requirements, file-browser等）
  title: string;       // タブタイトル
  active: boolean;     // アクティブ状態
  data?: any;          // タブに関連する追加データ
}

// ファイルブラウザの状態
interface IFileBrowserState {
  currentPath: string;  // 現在のパス
  selectedFile: string; // 選択されているファイル
  fileList: IProjectDocument[]; // ファイル一覧
  expandedFolders: string[]; // 展開されているフォルダのパス
}
```

## 4. API設計

以下のAPIエンドポイントを拡張または追加します：

### FileSystemService拡張

1. **ディレクトリ閲覧API**
   ```typescript
   // docsディレクトリ内のファイル・フォルダを再帰的に取得
   public async listDirectory(directoryPath: string, recursive?: boolean): Promise<IProjectDocument[]>
   ```

2. **ファイル読み込みAPI**
   ```typescript
   // 任意のファイルを読み込む（現在の readMarkdownFile を拡張）
   public async readFile(filePath: string, fileType?: string): Promise<string>
   ```

3. **ファイル種類判別API**
   ```typescript
   // ファイルの拡張子からファイルタイプを判別
   public getFileType(filePath: string): string
   ```

## 5. UI/UX設計方針

### タブ設計
1. タブコンポーネントに「要件定義」タブと「ファイル」タブを追加
2. タブ間の切り替えは既存のtabManager.jsの機能を拡張して実装
3. 各タブの状態は状態管理オブジェクトで保持し、WebViewとVSCodeの間で同期

### 要件定義タブ
1. デフォルトで「docs/requirements.md」を表示
2. プロジェクト状況タブと同様のインターフェースで表示
3. 編集・更新ボタンを提供

### ファイルブラウザタブ
1. パン粉リスト（breadcrumb）によるナビゲーション機能
2. フォルダとファイルのツリー表示
3. ファイル選択によるプレビュー機能
4. 選択したファイルをエディタで開く機能

## 6. 設計原則の適用

1. **単一責任原則**: ファイル操作、UI表示、状態管理の責務を明確に分離
2. **関心の分離**: ファイルブラウザとタブ管理は別のコンポーネントとして実装
3. **適切な抽象化**: FileSystemServiceを拡張して汎用的なファイル操作APIを提供

## 7. 修正が必要な関連ファイル一覧

### バックエンド（TypeScript）
- `/src/ui/scopeManager/ScopeManagerPanel.ts`: スコープマネージャーパネル拡張
- `/src/ui/scopeManager/services/FileSystemService.ts`: ファイルシステムサービス拡張
- `/src/ui/scopeManager/types/ScopeManagerTypes.ts`: 型定義の追加

### フロントエンド（JavaScript）
- `/media/components/tabManager/tabManager.js`: タブ管理機能拡張
- `/media/components/tabManager/tabManager.css`: タブ表示スタイル拡張
- `/media/scopeManager.js`: メインエントリポイント修正
- `/media/scopeManager.css`: スタイル拡張

### 新規作成ファイル
- `/media/components/fileBrowser/fileBrowser.js`: ファイルブラウザコンポーネント
- `/media/components/fileBrowser/fileBrowser.css`: ファイルブラウザスタイル

## 8. コンテキスト形成に役立つファイル一覧

- `/mockups/enhanced-scope-manager.html`: モックアップファイル（実装の参考）
- `/docs/requirements.md`: 要件定義ファイル（表示対象）
- `/docs/SCOPE_PROGRESS.md`: スコープ進捗ファイル（現行表示対象）

## 9. 修正するAIへの引き継ぎ事項

1. **FileSystemService拡張の重点事項**:
   - `listDirectory`メソッドは再帰的なディレクトリ走査をサポートすること
   - ファイルの種類判別は拡張子だけでなく、内容も考慮すること
   - ファイル操作は非同期で行い、UI更新と連携させること

2. **UI実装の重点事項**:
   - ファイルブラウザは展開・折りたたみ機能をサポートすること
   - ファイル選択時は右下にプレビューを表示すること
   - VSCodeのスタイリングに合わせること

3. **互換性への配慮**:
   - 既存の機能を壊さないよう、慎重に拡張すること
   - 将来的な機能拡張を考慮した柔軟な設計にすること

## 10. 修正を実行するためのタスクリスト

### Phase 1: バックエンド拡張
1. FileSystemServiceに新しいメソッドを追加
   - `listDirectory`メソッド実装
   - `readFile`メソッド拡張
   - `getFileType`メソッド実装

2. ScopeManagerPanelを拡張
   - 要件定義タブのサポート追加
   - ファイルブラウザ機能のサポート追加
   - メッセージハンドラの拡張

### Phase 2: フロントエンド実装
1. tabManager.jsの拡張
   - 新しいタブの追加
   - タブ切り替え処理の拡張

2. fileBrowser.jsの作成
   - フォルダツリー表示コンポーネント
   - ファイル選択・表示機能
   - プレビュー機能

3. HTMLテンプレートの修正
   - 新しいタブセクションの追加
   - ファイルブラウザUIの追加

### Phase 3: 統合とテスト
1. バックエンドとフロントエンドの統合
2. 各機能の動作確認
3. エッジケースの処理（ファイルが存在しない場合など）
4. パフォーマンス最適化

## 11. 技術的負債への対応

本実装により、以下の技術的負債を解消します：

1. **ファイル参照の制限**:
   - 現状ではSCOPE_PROGRESS.mdしか表示できない制限を解消
   - 多様なプロジェクトドキュメントを参照可能に

2. **UI/UXの改善**:
   - より直感的なファイル参照UIの提供
   - ユーザーの作業効率向上

将来的な改善点：
1. ファイル編集機能の強化
2. 複数ファイルの同時比較機能
3. ファイル検索機能の追加

## 12. リファクタリング検討事項（2025/05/08追記）

実装を進める中で、ScopeManagerPanel.tsが以下の問題を抱えていることが明らかになりました：

1. **ファイルサイズの肥大化**:
   - 現在のファイルサイズが大きすぎて編集や機能追加が困難
   - 新機能追加のたびにさらにファイルが膨れ上がる

2. **責務の多重化**:
   - UI表示、イベントハンドリング、ファイル操作等の責務が混在
   - 単一責任の原則に反している

3. **テスト困難性**:
   - 機能が密結合していてユニットテストが困難
   - 変更の影響範囲が大きく、バグのリスクが高い

### リファクタリング提案

1. **コンポーネント分割**:
   - UIコンポーネントごとに別ファイルに分割
   - UIとビジネスロジックの分離

2. **サービス層の強化**:
   - 既存のFileSystemServiceのようなサービス層で機能を分離
   - 各サービスの責務を明確化

3. **テンプレート管理の改善**:
   - HTMLテンプレートを別ファイルへ分離
   - コンポーネント単位でのテンプレート管理

この機能実装完了後、ScopeManagerPanel.tsのリファクタリングを含めた技術的負債解消プランを別途検討する価値があります。