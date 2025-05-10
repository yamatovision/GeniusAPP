# ファイルブラウザ＆マークダウンビューワー 実装計画書

## 1. 概要

このドキュメントは、AppGeniusに統合するファイルブラウザとマークダウンビューワーの実装計画を詳細に記述します。既存のモックアップをベースとして、実際に動作する機能にするための要件と技術的アプローチを定義します。既存の`mockupGallery`や`markdownConverter`の実装方法を踏襲し、コードベースとの整合性を確保します。

## 2. 現状分析

### 2.1 モックアップの評価

現在のモックアップ (`mockups/file-browser-with-markdown.html`) は以下の機能を含んでいます：

- ファイルツリー表示と階層ナビゲーション
- ルートディレクトリに戻るためのホームボタン
- ファイル検索フィルタリング
- マークダウンコンテンツの表示
- レスポンシブデザイン（パネル開閉機能）
- 各種ファイルタイプのアイコン表示

**長所**:
- UI/UXデザインが完成度高く、直感的
- パスナビゲーターとルートディレクトリへの移動が実装済み
- 静的HTMLでありながら、JavaScript機能でインタラクティブ性を確保
- マークダウン表示のスタイルが洗練されている

**短所**:
- 実際のファイルシステム連携がモックデータ
- VSCode拡張としての統合が未実装
- エラーハンドリングが実装されていない
- パフォーマンス最適化（大量ファイル処理時）が考慮されていない

### 2.2 既存の関連コンポーネント

#### 2.2.1 モックアップギャラリー (`MockupGalleryPanel.ts`)

- ProtectedPanel を継承したWebViewパネル
- VSCodeとWebView間のメッセージング基盤
- プロジェクトパス管理とファイル監視機構
- UIイベント処理（パネル開閉、ファイル選択など）

#### 2.2.2 マークダウンコンバーター (`markdownConverter.js` / `simpleMarkdownConverter.js`)

- マークダウンテキストをHTMLに変換するロジック
- 見出し、コードブロック、テーブル、インラインコードなどの対応
- 各要素のスタイリング調整機能
- シンタックスハイライト対応

### 2.3 推奨アプローチ

**既存モックアップとコンポーネントを活用した実装**を推奨します。理由：

1. モックアップの基本デザインとUIは高品質で再利用可能
2. `MockupGalleryPanel.ts`のコードパターンはVSCode WebViewパネル実装の良いテンプレート
3. `markdownConverter.js`のパースロジックは要件に合致したマークダウン変換を提供
4. 既存コードと同じパターンで実装することで一貫性を維持できる

## 3. 実装要件

### 3.1 機能要件

1. **ファイルシステム統合**
   - VSCode Workspace APIを使用した実際のファイル/フォルダ情報の読み取り
   - `ProjectServiceImpl`と連携したプロジェクトパス管理
   - ルートディレクトリとの階層ナビゲーション
   - ファイル監視と自動更新

2. **マークダウン処理**
   - `simpleMarkdownConverter.js`と同等のマークダウン変換ロジック
   - シンタックスハイライト対応
   - リンク処理（内部リンク解決）
   - 画像表示サポート

3. **UIコンポーネント**
   - ファイルツリー表示（ネスト対応）
   - パスナビゲーター（ホームボタンでルートに戻る機能あり）
   - ファイル検索・フィルタリング
   - パネルのリサイズと表示/非表示切替

4. **VSCode連携**
   - WebViewパネルとしての統合
   - VSCode APIを使用したファイルシステムアクセス
   - VSCodeコマンド連携（ファイルを開く、編集するなど）
   - VSCodeテーマとの統合

### 3.2 非機能要件

1. **パフォーマンス**
   - 大量ファイル（1000+）の効率的な読み込みと表示
   - 大きなマークダウンファイル（100KB+）の処理最適化
   - 遅延読み込みとキャッシング

2. **セキュリティ**
   - ファイルアクセス権限の適切な管理
   - ユーザー入力の検証とサニタイズ

3. **ユーザビリティ**
   - 直感的なナビゲーション
   - キーボードショートカットサポート
   - アクセシビリティ対応

4. **拡張性**
   - 設定オプションによるカスタマイズ
   - 将来的な機能拡張に対応した設計

## 4. 技術アーキテクチャ

### 4.1 全体アーキテクチャ

```
+------------------------------------------+
| VSCode拡張                               |
|                                          |
|  +------------------------------------+  |
|  | WebViewパネル                      |  |
|  |                                    |  |
|  |  +-------------+  +-------------+  |  |
|  |  | ファイル    |  | マークダウン |  |  |
|  |  | ブラウザ    |  | ビューワー   |  |  |
|  |  +-------------+  +-------------+  |  |
|  |                                    |  |
|  +------------------------------------+  |
|                     ^                    |
|                     |                    |
|                     v                    |
|  +------------------------------------+  |
|  | MarkdownViewerPanel.ts             |  |
|  +------------------------------------+  |
|                     ^                    |
|                     |                    |
|                     v                    |
|  +------------------------------------+  |
|  | VSCode API / イベントシステム      |  |
|  +------------------------------------+  |
|                     ^                    |
|                     |                    |
|                     v                    |
|  +------------------------------------+  |
|  | FileSystemService / ProjectService |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
```

### 4.2 コンポーネント構成

1. **`MarkdownViewerPanel.ts`** (WebViewパネル制御)
   - `MockupGalleryPanel.ts`と同様のパターンで実装
   - WebViewパネルの作成と管理
   - メッセージング処理
   - ファイル監視と更新通知

2. **`markdownViewer.html`** (WebView内のHTML)
   - モックアップをベースとしたUI構造
   - パネル分割レイアウト
   - ファイルツリーとマークダウン表示領域

3. **`markdownViewer.js`** (WebView内のJavaScript)
   - UIイベントハンドリング
   - ファイルツリーの動的表示
   - VSCodeとの通信処理
   - `mockupGallery.js`のパターンに準拠

4. **`MarkdownViewerService.ts`** (バックエンド処理)
   - ファイルシステム操作
   - マークダウン変換処理
   - ファイル監視と通知

### 4.3 通信プロトコル

WebViewとVSCode拡張間の通信には以下のメッセージ構造を使用（`mockupGallery.js`と互換）：

```typescript
interface WebViewMessage {
  command: string;
  payload?: any;
}

// コマンド例
type Command =
  | 'loadFiles'          // ファイル一覧を取得
  | 'openFile'           // ファイルを開く
  | 'navigateToPath'     // 特定ディレクトリへ移動
  | 'fileUpdated'        // ファイル更新通知
  | 'refreshFileList'    // ファイルリスト更新
  | 'showError'          // エラー表示
```

## 5. 実装計画

### 5.1 フェーズ1: 基本構造とVSCode統合（3日）

1. **WebView基盤構築**
   - `MarkdownViewerPanel.ts` クラスを作成（`MockupGalleryPanel.ts`ベース）
   - WebViewパネルとVSCode連携基盤の実装
   - 基本的なメッセージング機能の実装

2. **ファイルシステムサービス**
   - `MarkdownViewerService.ts` の作成
   - VSCode APIを使用したファイルシステムアクセス
   - ディレクトリ一覧取得機能
   - ファイル監視機能

3. **WebView UI**
   - モックアップからUIを移植
   - WebView内のHTML/CSS/JSを実装
   - パネル開閉機能

### 5.2 フェーズ2: ファイルブラウザ実装（2日）

1. **ファイルツリー表示**
   - ディレクトリ階層表示
   - ファイルタイプごとのアイコン表示
   - ディレクトリのネスト表示
   - ファイル選択ロジック

2. **パスナビゲーター実装**
   - 現在のパス表示
   - パスコンポーネントによるナビゲーション
   - ルートディレクトリに戻る機能
   - ナビゲーションイベントハンドリング

3. **検索フィルタリング**
   - ファイル名検索機能
   - リアルタイムフィルタリング
   - フィルター結果表示

### 5.3 フェーズ3: マークダウンビューワー実装（2日）

1. **マークダウン表示**
   - `simpleMarkdownConverter.js`の統合
   - マークダウンレンダリング
   - シンタックスハイライト
   - スタイリング適用

2. **表示機能拡張**
   - 画像表示対応
   - テーブル表示
   - コードブロック表示
   - リンク処理

3. **UI操作機能**
   - 更新ボタン
   - 編集ボタン（VSCodeエディタで開く）
   - 表示制御

### 5.4 フェーズ4: パフォーマンスと品質向上（3日）

1. **パフォーマンス最適化**
   - 大量ファイル表示の最適化
   - 遅延読み込み実装
   - キャッシング対応

2. **エラーハンドリング**
   - 例外処理の強化
   - ユーザーへのエラー表示
   - リカバリーロジック

3. **テストとデバッグ**
   - 動作確認
   - エッジケーステスト
   - リファクタリング

## 6. ファイル構造

```
src/
  ui/
    markdownViewer/
      MarkdownViewerPanel.ts      # WebViewパネル管理クラス
      content/
        markdownViewer.html       # WebView HTML (モックアップベース)
        markdownViewer.css        # スタイル定義
        markdownViewer.js         # フロントエンドロジック
    
  services/
    MarkdownViewerService.ts      # バックエンドサービス
    
  commands/
    markdownViewerCommands.ts     # VSCodeコマンド定義
  
  utils/
    fileUtils.ts                  # ファイル操作ユーティリティ
```

## 7. 詳細実装ガイド

### 7.1 ディレクトリパス管理

モックアップギャラリーの実装パターンをベースに、以下の方法でディレクトリパスを管理します：

```typescript
// ProjectServiceImplと連携したパス取得 (MockupGalleryPanelのパターンを踏襲)
private _getCurrentProjectPath(): string {
  if (this._projectServiceImpl) {
    try {
      const projectPath = this._projectServiceImpl.getActiveProjectPath();
      if (projectPath) {
        Logger.info(`ProjectServiceImplからプロジェクトパスを取得: ${projectPath}`);
        return projectPath;
      }
    } catch (error) {
      Logger.warn(`ProjectServiceImplからのパス取得に失敗: ${(error as Error).message}`);
    }
  }
  
  // フォールバック: VSCodeワークスペースを使用
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  
  return process.cwd(); // 最終フォールバック
}
```

### 7.2 マークダウンパーサー

`simpleMarkdownConverter.js`と互換性のあるパーサーを実装:

```typescript
// simpleMarkdownConverter.jsのロジックを活用
function convertMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // コードブロックとテーブルを一時的に置き換え
  const codeBlocks: string[] = [];
  const tables: string[] = [];
  
  // コードブロックを保護
  let html = markdown.replace(/```([\s\S]*?)```/g, (match, code) => {
    const id = `CODE_BLOCK_${codeBlocks.length}`;
    codeBlocks.push(code);
    return id;
  });
  
  // テーブルを保護...
  
  // 見出し処理
  html = html.replace(/^#### (.+)$/gm, '<h4 style="...">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="...">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="...">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="...">$1</h1>');
  
  // 他の変換処理...
  
  return html;
}
```

### 7.3 ファイル監視

ファイル監視機能の実装:

```typescript
private _setupFileWatcher(): void {
  try {
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
    }
    
    const projectPath = this._getCurrentProjectPath();
    
    const pattern = new vscode.RelativePattern(
      projectPath,
      '**/*.md' // マークダウンファイルを監視
    );
    
    this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    
    this._fileWatcher.onDidCreate(this._handleFileChange.bind(this));
    this._fileWatcher.onDidChange(this._handleFileChange.bind(this));
    this._fileWatcher.onDidDelete(this._handleFileChange.bind(this));
    
    this._disposables.push(this._fileWatcher);
    
    Logger.info('マークダウンファイルの監視を開始しました');
  } catch (error) {
    Logger.error(`ファイル監視の設定に失敗: ${(error as Error).message}`);
  }
}

private _handleFileChange(uri: vscode.Uri): void {
  // 変更されたファイルが現在表示中のファイルなら内容を更新
  if (this._currentFilePath === uri.fsPath) {
    this._reloadCurrentFile();
  }
  
  // ファイルツリーを更新
  this._refreshFileList();
}
```

## 8. 課題と解決策

### 8.1 大規模ディレクトリ対応

**課題**: 大量のファイル・フォルダがある場合のパフォーマンス低下

**解決策**:
- 仮想スクロール技術の導入
- 階層的な遅延ロード（展開時のみサブフォルダを読み込む）
- キャッシュ実装

### 8.2 特殊マークダウン構文対応

**課題**: VSCodeの拡張マークダウン構文への対応

**解決策**:
- `simpleMarkdownConverter.js`の拡張
- 特殊構文の検出と処理ロジック追加
- VSCodeのマークダウンエンジンとの連携

### 8.3 パスナビゲーション

**課題**: 深いディレクトリ階層でのナビゲーション問題

**解決策**:
- パスナビゲーター内のスクロール対応
- パス短縮表示（`...`で中間パスを省略）
- パス履歴機能（戻る/進むボタン）

## 9. 結論

既存のモックアップとコードパターンを活用して、実用的なファイルブラウザとマークダウンビューワーを実装することが最も効率的です。`MockupGalleryPanel.ts`のパターンと`simpleMarkdownConverter.js`のロジックを踏襲することで、コードベースの一貫性を保ちながら、高品質な機能を追加できます。

実装は約10日間で完了する見込みで、各フェーズで動作確認とテストを行いながら段階的に進めることで、高品質な成果物を提供します。