# 進捗ファイル監視機能チェックリスト

## 1. 初期化と設定
- [ ] `FileWatcherServiceImpl.setupProjectFileWatchers` - プロジェクトのファイル監視の初期設定
- [ ] `FileWatcherServiceImpl.setupProgressFileWatcher` - 進捗ファイル監視設定
- [ ] `FileSystemServiceImpl.getProgressFilePath` - 進捗ファイルのパスを取得
- [ ] `FileSystemServiceImpl.setupProjectFileWatcher` - 具体的なファイル監視設定

## 2. 初期読み込み
- [ ] `MessageDispatchServiceImpl.initialize` ハンドラーでの進捗ファイル読み込み
- [ ] `FileWatcherServiceImpl.initializeInitialFileContent` - 初期内容読み込み（特にアクティブタブ判定）
- [ ] `FileSystemServiceImpl.loadProgressFile` - 実際のファイル読み込み処理
- [ ] `scopeManager.js` - `progressContent`要素初期化

## 3. 監視と更新
- [ ] `FileSystemServiceImpl.setupEnhancedFileWatcher` - 進捗ファイル変更監視
- [ ] `scopeManager.js` - `markdown-updated`イベントリスナー
- [ ] `scopeManager.js` - `updateMarkdownContent`ハンドラーでの`forScopeProgress`処理

## 4. データ表示
- [ ] `scopeManager.js` - タブステート確認と条件付き表示
- [ ] `markdownViewer.updateContent` - 実際のコンテンツ表示

## 5. エラーハンドリング
- [ ] ファイル不在時の作成処理（`createProgressFile`）
- [ ] ファイル監視中のエラー処理
- [ ] ファイル読み込み失敗時のエラー処理