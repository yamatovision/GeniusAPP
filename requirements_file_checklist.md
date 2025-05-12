# 要件定義ファイル監視機能チェックリスト

## 1. 初期化と設定
- [x] `FileWatcherServiceImpl.setupProjectFileWatchers` - プロジェクトのファイル監視の初期設定
- [x] `FileWatcherServiceImpl.setupRequirementsFileWatcher` - 要件定義ファイル監視設定 (対応済み: 余分なコードを削除して進捗ファイル監視と同一構造に修正)
- [x] `FileSystemServiceImpl.getRequirementsFilePath` - 要件定義ファイルのパスを取得 (対応済み: 非同期処理と複雑なロジックを削除し同期関数に変更)
- [x] `FileSystemServiceImpl.setupRequirementsFileWatcher` - 具体的なファイル監視設定 (対応済み: 複雑な実装を進捗ファイル監視と同じ構造に修正)

## 2. 初期読み込み
- [x] `MessageDispatchServiceImpl.initialize` ハンドラーでの要件定義ファイル読み込み (対応済み: 進捗ファイルと同じ構造で要件定義ファイルもロードするよう追加)
- [x] `FileWatcherServiceImpl.initializeInitialFileContent` - 初期内容読み込み（特にアクティブタブ判定） (✓ 元から対称性が保たれていた)
- [x] `FileSystemServiceImpl.loadRequirementsFileNow` - 実際のファイル読み込み処理 (対応済み: 複雑な検索ロジックを削除し、シンプルな実装に修正)
- [x] `scopeManager.js` - `requirementsContent`要素初期化 (✓ 元から対称性が保たれていた)

## 3. 監視と更新
- [x] `FileSystemServiceImpl.setupEnhancedFileWatcher` - 要件定義ファイル変更監視 (✓ 元から対称性が保たれていた)
- [x] `scopeManager.js` - `requirementsFileChanged`イベント処理 (✓ 特殊実装だが機能的に問題なし)
- [x] `scopeManager.js` - `updateMarkdownContent`ハンドラーでの`forRequirements`処理 (✓ 元から対称性が保たれていた)

## 4. データ表示
- [x] `scopeManager.js` - タブステート確認と条件付き表示 (✓ 元から対称性が保たれていた)
- [x] `markdownViewer.updateContent` - 実際のコンテンツ表示 (✓ 元から対称性が保たれていた)

## 5. エラーハンドリング
- [x] ファイル不在時の処理 (対応済み: 複雑な検索ロジックを削除し、同期関数の固定パスに置き換え)
- [x] ファイル監視中のエラー処理 (✓ 元から対称性が保たれていた)
- [x] ファイル読み込み失敗時のエラー処理 (✓ 元から対称性が保たれていた)

## 6. ファイル更新データフローの検証
- [x] ファイル変更検出 (VSCodeイベント) - 両方のファイル検出が正常に機能
- [x] 変更通知と内容読み込み - 変更検出後の通知フローを確認
- [x] WebView側での処理 - イベントによるコンテンツ取得と状態更新
- [x] コンテンツ更新処理 - タブ状態に応じた表示ロジック
- [x] コンテンツ表示 - 正しいコンテナへのレンダリング

## 最新のログ比較分析

### 進捗ファイル(SCOPE_PROGRESS.md)更新時のログ
```
[2025-05-12T00:43:09.251Z] [INFO] 【重要】FileSystemService: ファイル変更イベント検出: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md, 監視対象ファイル=SCOPE_PROGRESS.md
[2025-05-12T00:43:09.252Z] [INFO] 【デバッグ詳細】イベント: path=/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md, baseFileName=SCOPE_PROGRESS.md, isRequirements=false
[2025-05-12T00:43:09.252Z] [INFO] FileSystemService: ファイル情報 - 最終更新: Mon May 12 2025 09:43:09 GMT+0900 (日本標準時), サイズ: 43489バイト
[2025-05-12T00:43:09.253Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md (サイズ: 24451 バイト)
[2025-05-12T00:43:09.253Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.253Z] [INFO] FileSystemService: ファイル読み込み成功 - 長さ: 24451文字
[2025-05-12T00:43:09.253Z] [INFO] FileSystemService: イベント発火完了 - onProgressFileChanged
[2025-05-12T00:43:09.254Z] [INFO] ★★★ FileSystemService(Enhanced): ファイル変更検出: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.254Z] [INFO] ファイル拡張子: .md, ベース名: SCOPE_PROGRESS.md
[2025-05-12T00:43:09.254Z] [INFO] ファイル情報: サイズ=43489バイト, 最終更新=2025-05-12T00:43:09.059Z
[2025-05-12T00:43:09.255Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md (サイズ: 24451 バイト)
[2025-05-12T00:43:09.255Z] [INFO] FileSystemService: コールバック実行完了 - onFileChanged
[2025-05-12T00:43:09.255Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.255Z] [INFO] ★★★ ファイル読み込み成功: 24451文字
[2025-05-12T00:43:09.255Z] [INFO] FileWatcherService: 進捗ファイル変更を検出: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.255Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md (サイズ: 24451 バイト)
[2025-05-12T00:43:09.256Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.256Z] [INFO] FileSystemServiceを使用してマークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.761Z] [INFO] FileSystemService(Enhanced): 遅延読み込み(500ms後): /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.762Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md (サイズ: 24451 バイト)
[2025-05-12T00:43:09.763Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.764Z] [INFO] FileWatcherService: 進捗ファイル変更を検出: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.764Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md (サイズ: 24451 バイト)
[2025-05-12T00:43:09.765Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
[2025-05-12T00:43:09.766Z] [INFO] FileSystemServiceを使用してマークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
```

### 要件定義ファイル(requirements.md)更新時のログ
```
[2025-05-12T00:43:48.785Z] [INFO] 【重要】FileSystemService: 要件定義ファイル変更イベント検出: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md, 監視対象ファイル=requirements.md
[2025-05-12T00:43:48.786Z] [INFO] FileSystemService: 要件定義ファイル情報 - 最終更新: Mon May 12 2025 09:43:48 GMT+0900 (日本標準時), サイズ: 26109バイト
[2025-05-12T00:43:48.787Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md (サイズ: 14333 バイト)
[2025-05-12T00:43:48.787Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md
[2025-05-12T00:43:48.788Z] [INFO] FileSystemService: 要件定義ファイル読み込み成功 - 長さ: 14333文字
[2025-05-12T00:43:48.788Z] [INFO] FileWatcherService: 要件定義ファイル変更を検出: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md
[2025-05-12T00:43:48.788Z] [DEBUG] ファイルを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md (サイズ: 14333 バイト)
[2025-05-12T00:43:48.788Z] [INFO] FileSystemService: 要件定義ファイル変更通知完了
[2025-05-12T00:43:48.789Z] [INFO] FileSystemService: マークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md
[2025-05-12T00:43:48.790Z] [INFO] FileSystemServiceを使用してマークダウンコンテンツを読み込みました: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md
```

## ログの比較分析と違い

1. **進捗ファイルの遅延読み込み処理の有無**:
   - 進捗ファイルには500ms後の遅延読み込み処理が実行されている
   ```
   [2025-05-12T00:43:09.761Z] [INFO] FileSystemService(Enhanced): 遅延読み込み(500ms後): /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
   ```
   - 要件定義ファイルにはこの遅延読み込み処理のログが見当たらない

2. **イベント名の違い**:
   - 進捗ファイル: `onProgressFileChanged`、`FileSystemService: イベント発火完了`
   - 要件定義ファイル: `FileSystemService: 要件定義ファイル変更通知完了`

3. **追加のデバッグ情報**:
   - 進捗ファイル: `[INFO] 【デバッグ詳細】イベント: path=...`というデバッグ詳細情報がある
   - 要件定義ファイル: このデバッグ詳細がない

4. **コールバック処理の記述**:
   - 進捗ファイル: `FileSystemService: コールバック実行完了 - onFileChanged`というログがある
   - 要件定義ファイル: このコールバック実行完了のログがない

5. **メッセージの送信**:
   - 進捗ファイルのログには`progressFileChanged`メッセージの送信ログは見当たらない
   - 要件定義ファイルには`requirementsFileChanged`メッセージがWebViewに送られた形跡がないが、MessageDispatchServiceImplでは送信するようになっていた

## 潜在的な問題点と修正提案

1. **遅延読み込み処理の統一**:
   - 要件定義ファイルにも同様の遅延読み込み処理を実装するべき
   - 両方のファイル変更処理で同じタイミングパターンを使用することで安定性が向上する

2. **WebView側のメッセージ処理確認**:
   - ブラウザコンソールでWebViewがrequirementsFileChangedメッセージを受信しているか確認
   - メッセージを受信していれば、コンテナ指定の問題が考えられる
   - メッセージを受信していなければ、requirementsFileChangedメッセージが送信されていない可能性

3. **scopeManager.jsでのメッセージハンドリング強化**:
   - コンソールログをさらに追加して、メッセージの受信と処理フローを詳細に確認
   - タブのアクティブ状態とコンテナの対応関係を明確にデバッグ

## 次のステップ

1. 要件定義ファイルの監視処理に遅延読み込みを追加
2. webviewコンソールでメッセージ受信状況を確認
3. 両方のファイル種類で同じ動作をするよう最終調整

## 未修正の可能性がある点

1. 遅延読み込み処理が要件定義ファイルに適用されていない
2. WebView側でのrequirementsFileChangedメッセージ受信確認が必要
3. MessageDispatchServiceImplからのメッセージ送信が実際に行われているか確認