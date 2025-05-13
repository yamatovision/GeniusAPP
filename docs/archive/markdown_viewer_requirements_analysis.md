# SCOPE_PROGRESS.mdと要件定義ファイル(requirements.md)の更新検知の違いに関する調査レポート

## 発生している問題

SCOPE_PROGRESS.mdファイルが更新されるとリアルタイムでスコープマネージャーの表示が更新されるが、requirements.mdファイル（要件定義）の更新は自動的に反映されない。

## データフロー分析

### 1. SCOPE_PROGRESS.mdの更新検知と反映プロセス

1. **ファイル監視の設定**:
   - `ScopeManagerPanel._setupFileWatcher()`メソッドでファイル監視を設定
   - `FileSystemService.setupProjectFileWatcher()`を呼び出して実際の監視を実装
   - このメソッドは**SCOPE_PROGRESS.mdに特化した監視を行っている**

2. **監視設定の詳細 (FileSystemServiceImpl.ts)**:
   ```typescript
   // プロジェクトファイルの監視を設定
   public setupProjectFileWatcher(
     projectPath?: string,
     outputCallback?: (filePath: string) => void
   ): vscode.Disposable {
     // ...
     // 進捗ファイルのパスを構築
     const progressFilePath = this.getProgressFilePath(projectPath);
     
     // ファイルウォッチャーを設定
     const fileWatcher = this.setupEnhancedFileWatcher(
       progressFilePath,
       callback,
       { delayedReadTime: 500 }  // 500ms後に遅延読み込み
     );
     // ...
   }
   ```

3. **更新検知時の処理**:
   - VSCodeのFileSystemWatcherを使用してファイル変更を検知
   - ファイル変更時に`readMarkdownFile`を呼び出し
   - 内容を読み込んだあと`_onProgressFileChanged.fire(filePath)`でイベントを発火
   - スコープマネージャーの`_handleGetMarkdownContent`メソッドが呼び出される

4. **WebView更新**:
   - 内容が読み込まれると、WebViewに`updateMarkdownContent`メッセージを送信
   - メッセージには`forScopeProgress: true`フラグが含まれる
   - フロントエンド(scopeManager.js)がこのメッセージを受け取って表示を更新

5. **フロントエンドの処理 (scopeManager.js)**:
   ```javascript
   case 'updateMarkdownContent':
     // 進捗状況用のマークダウン更新は保存しておき、タブが選択された時に表示
     if (message.forScopeProgress) {
       // 最新のコンテンツを状態に保存（タブが非アクティブでも保存）
       stateManager.setState({ 
         scopeProgressContent: message.content 
       }, false);
       
       // タブがアクティブな場合のみ表示
       if (activeTabId === 'scope-progress') {
         console.log(`進捗状況タブが表示中なので内容を更新します`);
         markdownViewer.updateContent(message.content);
       }
       break;
     }
   ```

### 2. requirements.mdの更新検知の問題

1. **監視設定の不足**:
   - `setupProjectFileWatcher`は**SCOPE_PROGRESS.mdに特化**しており、要件定義ファイルの監視を設定していない
   - requirements.mdに対する専用の監視設定がない

2. **要件定義ファイルの検出機能**:
   - `findRequirementsFile`メソッドは要件定義ファイルを検索する機能を持つが、監視には利用されていない
   
3. **`requirements.md`の更新処理はあるが監視がない**:
   - フロントエンド(scopeManager.js)には要件定義の表示コードは実装されている
   ```javascript
   // 要件定義用のマークダウン更新も進捗状況と同様に常に保存する
   if (message.forRequirements) {
     // 最新のコンテンツを状態に保存（タブが非アクティブでも保存）
     stateManager.setState({
       requirementsContent: message.content,
       requirementsFilePath: message.filePath, // ファイルパスも保存
       requirementsLastUpdate: Date.now()      // タイムスタンプを保存
     }, false);

     // タブがアクティブな場合は表示を更新
     if (activeTabId === 'requirements') {
       console.log(`要件定義タブが表示中なので内容を更新します`);
       try {
         markdownViewer.updateContent(safeContent);
       } catch (err) {
         console.error('要件定義タブ更新中にエラーが発生しました:', err);
       }
     }
     break;
   }
   ```
   - しかし、このコードが実行されるためのファイル監視設定が不足している

4. **部分的な実装が存在する**:
   - ScopeManagerPanelの`_setupFileWatcher`メソッド内に、要件定義ファイルの監視設定の断片がある:
   ```typescript
   // 要件定義ファイルを探す
   const requirementsFilePath = await this._fileSystemService.findRequirementsFile(this._projectPath);
   if (requirementsFilePath) {
     Logger.info(`ScopeManagerPanel: 要件定義ファイルが見つかりました: ${requirementsFilePath}`);
     
     // 要件定義ファイル用のファイルウォッチャーを設定する部分
     const requirementsWatcher = this._fileSystemService.setupFileWatcher(
       requirementsFilePath,
       async (filePath) => {
         // 要件定義ファイル更新時の処理
         try {
           await this._handleGetMarkdownContent(filePath, { forRequirements: true });
         } catch (readError) {
           Logger.error(`ScopeManagerPanel: 要件定義ファイル読み込みエラー: ${readError}`);
         }
       }
     );
     watchers.push(requirementsWatcher);
   }
   ```
   - この部分を使って要件定義ファイルの監視を実装しようとした形跡がある

5. **新しいメソッドが未使用**:
   - FileSystemServiceImplには`setupRequirementsFileWatcher`というメソッドが定義されているが、使用されていない
   - これは明らかに要件定義ファイル監視のために追加された未完了のコードである

## 問題点の特定

問題の根本原因は以下の点にある:

1. **選択的な監視設定**:
   - `setupProjectFileWatcher`メソッドはSCOPE_PROGRESS.mdのみを監視対象としている
   - requirements.mdに対する同等の監視設定が実装されていない

2. **イベント処理の不完全な実装**:
   - AppGeniusEventBusには`REQUIREMENTS_UPDATED`イベントタイプが定義されているが、効果的に使用されていない

3. **不完全な実装の混在**:
   - 要件定義ファイルの監視コードが部分的に実装されているが完全には機能していない
   - `_setupFileWatcher`メソッド内に要件定義ファイル監視のコードが存在するが、効果的に使用されていない

4. **設計上の不整合**:
   - SCOPE_PROGRESS.mdの監視は明示的に実装されているが、requirements.mdは例外的な扱いになっている
   - requirements.mdが明示的に監視対象として指定されていない

## 改善案

以下の変更により、requirements.mdファイルの更新も自動的に反映されるようになると考えられます:

1. **両ファイルの共通監視設定**:
   - `setupProjectFileWatcher`メソッドを拡張して、SCOPE_PROGRESS.mdと要件定義ファイルの両方を監視対象に含める

2. **FileSystemServiceImpl**の更新:
   ```typescript
   public setupProjectFileWatcher(
     projectPath?: string,
     outputCallback?: (filePath: string) => void
   ): vscode.Disposable {
     // ...
     const watchers: vscode.Disposable[] = [];
     
     // 進捗ファイルの監視
     const progressFilePath = this.getProgressFilePath(projectPath);
     const progressWatcher = this.setupEnhancedFileWatcher(
       progressFilePath,
       callback,
       { delayedReadTime: 500 }
     );
     watchers.push(progressWatcher);
     
     // 要件定義ファイルの監視を追加
     this.findRequirementsFile(projectPath).then(requirementsFilePath => {
       if (requirementsFilePath) {
         const requirementsWatcher = this.setupEnhancedFileWatcher(
           requirementsFilePath,
           (filePath) => {
             // 要件定義ファイル変更時の処理
             callback(filePath);
             
             // 要件定義ファイル専用イベントも発火
             const eventBus = AppGeniusEventBus.getInstance();
             eventBus.emit(AppGeniusEventType.REQUIREMENTS_UPDATED, {
               path: filePath
             }, 'FileSystemService');
           },
           { delayedReadTime: 500 }
         );
         watchers.push(requirementsWatcher);
         Logger.info(`FileSystemService: 要件定義ファイルの監視を設定しました: ${requirementsFilePath}`);
       }
     });
     
     // 複合ウォッチャーを返す
     return {
       dispose: () => {
         watchers.forEach(w => w.dispose());
       }
     };
   }
   ```

3. **ScopeManagerPanel**での処理の追加:
   - `_handleGetMarkdownContent`メソッドに要件定義ファイル用の処理を追加
   ```typescript
   // isRequirementsFileの判定を追加
   const isRequirementsFile = filePath.endsWith('requirements.md');
   
   // WebViewにマークダウン内容を送信
   this._panel.webview.postMessage({
     command: 'updateMarkdownContent',
     content: content,
     timestamp: Date.now(),
     priority: 'high',
     forScopeProgress: isScopeProgressFile, 
     forRequirements: isRequirementsFile || options.forRequirements, // 要件定義フラグを設定
     forceRefresh: options.forceRefresh
   });
   ```

4. **イベントリスナーの追加**:
   - `REQUIREMENTS_UPDATED`イベントをリッスンして要件定義タブを更新するコードを追加

これらの変更により、両方のファイルが同様の方法で監視され、更新が反映されるようになります。

## まとめ

SCOPE_PROGRESS.mdファイルの更新はリアルタイムで反映されますが、requirements.mdの更新は反映されません。この違いは、明示的なファイル監視設定の有無から生じています。FileSystemServiceImplの`setupProjectFileWatcher`メソッドがSCOPE_PROGRESS.mdのみを監視対象としているため、requirements.mdの変更は検知されません。

ファイル監視の設定を拡張して要件定義ファイルも監視対象に含めることで、この問題を解決できます。提案した改善案の実装により、両方のマークダウンファイルが同様の方法で監視され、更新が自動的に反映されるようになるでしょう。