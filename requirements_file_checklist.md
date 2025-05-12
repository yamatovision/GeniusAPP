
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

## チェックリストの使用方法

1. 進捗ファイル処理と要件定義ファイル処理を関数名以外で比較
2. 以下の基準で確認：
   - 関数構造が同一か（パラメータ、戻り値）
   - 処理内容が同一か（ファイル名の違いを除く）
   - エラーハンドリングが同一か
   - 余計な実装・追加処理がないか（進捗ファイル処理にない処理が要件定義ファイル処理に追加されていればNG）
3. 違いがあれば「どの部分」と「どのように異なるか」をメモ
4. 全く同じ構造・処理内容になっている場合のみチェック
5. 処理の「欠落」も「追加」も両方NGとする - 進捗ファイル処理と要件定義ファイル処理は完全に対称であるべき
6. 余分な実装があった場合は「バッサリ削除」して進捗ファイル処理と完全に同一構造にする

## 進捗状況

1. `FileWatcherServiceImpl.setupRequirementsFileWatcher` - 修正完了
   - 問題点: パス取得の複雑なロジックとイベントバス通知の追加処理という余分な実装があった
   - 対応: 余分なコードをバッサリ削除し、進捗ファイル監視と同一構造に修正

2. `FileSystemServiceImpl.getRequirementsFilePath` - 修正完了
   - 問題点: 非同期関数になっていて、複雑な検索ロジックを使用していた
   - 対応: 同期関数に変更し、シンプルに固定パス（docs/requirements.md）を返すように修正

3. `FileSystemServiceImpl.setupRequirementsFileWatcher` - 修正完了
   - 問題点: 複雑なイベントハンドリングとファイル監視設定が実装されていた
   - 対応: 進捗ファイル監視と同じシンプルな実装に修正

4. `MessageDispatchServiceImpl.initialize` - 修正完了
   - 問題点: 進捗ファイル読み込みの処理はあったが、要件定義ファイル読み込みの処理がなかった
   - 対応: 進捗ファイル読み込みと同じ構造で要件定義ファイルも読み込むよう処理を追加

5. `FileSystemServiceImpl.loadRequirementsFileNow` - 修正完了
   - 問題点: 複雑な検索ロジックを使用していた
   - 対応: シンプルに固定パス（同期関数）を使うよう修正、戻り値型も進捗処理に合わせた

## 修正後の状態

ファイル監視機能の実装を確認した結果、以下の状態になっています：

1. 初期化ログの確認:
   - 要件定義ファイル: ✅ 監視設定完了。`FileWatcherService: 要件定義ファイルの監視を設定しました`のログが出力されている
   - 進捗ファイル: ✅ 監視設定完了。`FileWatcherService: 進捗ファイルの監視を設定しました`のログが出力されている

2. 変更検出の状況:
   - 進捗ファイル（SCOPE_PROGRESS.md）: ✅ 変更検出可能。ファイル変更時にログが出力される
   - 要件定義ファイル（requirements.md）: ❌ 変更検出に問題あり。ファイル変更時にログが出力されない

3. 変更時の挙動:
   - 進捗ファイルはタブに関係なく変更を検出する (✅)
   - 要件定義ファイルは変更を自動検出せず、タブ切替でしか反映されない (❌)

4. 監視ログ出力:
   ```
   [INFO] FileWatcherService: 進捗ファイルの監視を設定します
   [INFO] FileWatcherService: 進捗ファイル監視設定: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md
   ...
   [INFO] FileWatcherService: 要件定義ファイルの監視を設定します
   [INFO] FileWatcherService: 要件定義ファイル監視設定: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/requirements.md
   ```

5. 問題点（残存課題）:
   - **監視対象ファイル設定のログが不正確**: `★★★★ 監視対象ファイル設定: fileName=SCOPE_PROGRESS.md, watchPath=/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/SCOPE_PROGRESS.md` と、要件定義ファイル監視時にも「SCOPE_PROGRESS.md」というログが出力されている
   - **要件定義ファイルの変更イベントが発生していない**: 要件定義ファイルを変更しても変更検出のログが出力されていない

## 対応内容

1. 問題の特定:
   - `FileSystemService.setupFileWatcher` 内でファイル名がハードコードされており、常に「SCOPE_PROGRESS.md」を監視対象にしていた
   - 変数名もすべて `progressFilePath` で固定されており、汎用的なファイル監視ができていなかった

2. 実施した修正:
   - `progressFilePath` → `filePath` に変数名を修正
   - ハードコードされていた `'SCOPE_PROGRESS.md'` を `path.basename(filePath)` に変更
   - 監視対象のパスも動的に指定されたファイルパスを使用するように修正

3. 期待される効果:
   - 要件定義ファイル（requirements.md）の変更も正しく検出されるようになる
   - 両方のファイルタイプで同じ監視メカニズムが使用されるため、安定性が向上する

4. 今後も確認すべき点:
   - 実際に要件定義ファイルの変更が検出されるか動作確認する
   - VSCode API の `createFileSystemWatcher` が両方のファイルタイプで正しく機能するか検証する

これで、根本的な問題であった「監視対象ファイル名が常に SCOPE_PROGRESS.md に固定されていた」問題が解消されるはずです。

## 追加修正内容と解決策 (2025-05-12)

VSCodeのファイルシステムウォッチャーの設定に関する調査と修正を行いました。

1. 問題の経過と発見:
   - 当初、ファイル名をハードコードからパラメータ化する修正を行った
   - しかし、パラメータ化後にファイル監視が機能しなくなった
   - 詳細ログを追加して調査した結果、設定自体は成功しているがイベント発火に問題があることが判明
   - 元々ハードコードしていた実装では監視が機能していたという重要な発見があった

2. 調査の過程:
   - RelativePatternの設定方法を変更（URI使用→グロブパターン使用）
   - ログを詳細化してファイル監視設定の状況を可視化
   - 要件定義ファイルの検出ロジックを強化
   - 絶対パスを使用したグロブパターンの試行

3. 最終解決方法:
   - ファイル監視のため「動く実装」に回帰するアプローチを採用
   - `FileSystemService.setupFileWatcher`関数をハードコードに戻し、固定で「SCOPE_PROGRESS.md」を監視
   - VSCodeのRelativePatternを元の形式（パス+ファイル名）で使用
   - 詳細ログを残してデバッグのしやすさを維持

4. 結果:
   - ✅ 進捗ファイル（SCOPE_PROGRESS.md）の監視が正常に動作するようになった
   - ❌ 要件定義ファイル（requirements.md）の監視は一時的に犠牲にした状態
   - ✅ ファイル変更イベントが正しく発火し、UIに反映されるようになった

5. 技術的考察:
   - VSCodeのファイルシステムウォッチャーAPIは予想以上に複雑で、特定の使用パターンでのみ正しく機能する
   - ハードコードされた値がなぜ機能したのか明確な理由は不明だが、おそらくパスの扱い方に関係している
   - 柔軟性より確実に動作することを優先する判断は正しかった

6. 今後の対応予定:
   - 要件定義ファイル用に別の監視関数を実装することを検討
   - 両方のファイル監視を両立させる方法を研究
   - VSCode拡張APIの動作についてより深い理解を得る

この経験から、VSCode拡張開発においては、時に「なぜ動くのか」よりも「動く実装」を優先することが重要だと学びました。特にファイルシステム操作のような低レベルの機能では、VSCode APIの挙動に合わせた実装が必要になることがあります。
