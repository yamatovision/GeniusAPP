# AppGenius修正プラン 2025-05-15

## 概要

このドキュメントは、現在のAppGeniusエクステンションで発生している複数のエラーに対する修正プランを詳細に記述したものです。具体的には以下の3つの問題に対応します：

1. MessageDispatchServiceImplのハンドラ未登録コマンド問題
2. FileViewerPanelのWebView disposed問題
3. SimpleAuthServiceのトークンリフレッシュエラー問題

## 1. MessageDispatchServiceImpl - ハンドラ未登録コマンド問題

### 発生しているエラー
```
[2025-05-14T22:02:27.050Z] [WARN] MessageDispatchServiceImpl: ハンドラが未登録のコマンド: launchPromptFromURL
[2025-05-14T22:11:08.830Z] [WARN] MessageDispatchServiceImpl: ハンドラが未登録のコマンド: launchPromptFromURL
[2025-05-14T23:27:11.012Z] [WARN] MessageDispatchServiceImpl: ハンドラが未登録のコマンド: selectProject
[2025-05-15T00:07:00.383Z] [WARN] MessageDispatchServiceImpl: ハンドラが未登録のコマンド: openOriginalMockupGallery
[2025-05-15T00:50:24.376Z] [WARN] MessageDispatchServiceImpl: ハンドラが未登録のコマンド: shareText
```

### 原因
- `launchPromptFromURL`や`selectProject`などのコマンドがメインのMessageDispatchServiceImplに登録されておらず、代わりにScopeManagerMessageHandlerなどの別クラスで処理されている
- メッセージディスパッチの二重構造になっており、一部のコマンドがメインシステムに登録されていない
- 現在の実装では、これらのWARNログは実際の機能に影響を与えていない（コマンドは別のハンドラで正常に処理されている）

### 修正案（削除ベース）
この問題はWARNログの出力だけであり、実際の機能に影響はないため、不要なログ出力を抑制する方法で解決します。

1. **警告ログの出力条件変更**:
   ```typescript
   // MessageDispatchServiceImpl.tsのhandleMessageメソッド内を修正
   public async handleMessage(message: Message, panel: vscode.WebviewPanel): Promise<void> {
     try {
       // コマンド名のみログ出力
       Logger.debug(`MessageDispatchServiceImpl: 受信: ${message.command}`);

       // ScopeManagerPanelで直接処理される特殊なコマンドのリスト
       const specialCommands = [
         'getHistory',
         'refreshFileBrowser',
         'deleteFromHistory',
         'copyCommand',
         'copyToClipboard',
         // 警告が出ているコマンドを追加
         'launchPromptFromURL',
         'selectProject',
         'openOriginalMockupGallery',
         'shareText',
         'loadExistingProject' // その他の警告が出ているコマンド
       ];

       // 特殊コマンドの場合は警告を出さずに無視
       if (specialCommands.includes(message.command)) {
         // ScopeManagerPanelで直接処理されるコマンドなので何もしない
         return;
       }

       // 以下は既存のコード
       // ...
   ```

2. **不要なファイルの削除は不要**: 
   実際の機能動作に問題はないため、メッセージ処理関連のファイルを削除する必要はありません。

## 2. FileViewerPanel - WebView disposed問題

### 発生しているエラー
```
[2025-05-15T01:42:10.660Z] [ERROR] FileViewerPanel: WebViewへのメッセージ送信に失敗しました: startLoading
[2025-05-15T01:42:10.661Z] [ERROR] Error details: Webview is disposed
[2025-05-15T01:42:10.662Z] [ERROR] Stack trace: Error: Webview is disposed
    at uG.c (file:///Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/api/node/extensionHostProcess.js:170:20838)
    at get webview (file:///Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/api/node/extensionHostProcess.js:170:20005)
    at h._sendMessageToWebview (/Users/tatsuya/.vscode/extensions/mikoto.bluelamp-1.0.2/dist/extension.js:2:57832)
    at h._refreshFileList (/Users/tatsuya/.vscode/extensions/mikoto.bluelamp-1.0.2/dist/extension.js:2:53754)
    at h._onProjectChanged (/Users/tatsuya/.vscode/extensions/mikoto.bluelamp-1.0.2/dist/extension.js:2:50613)
```

### 原因
- パネルが既に破棄されている状態で`_sendMessageToWebview`メソッドが呼び出されている
- 特にプロジェクト変更時に、パネルの状態チェックが不十分
- エラーハンドリングがきちんと行われておらず、例外が発生している

### 修正案（削除と例外処理の強化）
このエラーも実際の動作に深刻な影響は与えていませんが、エラーログが多数出力される問題を解決します。

1. **メッセージ送信の安全性強化**:
   ```typescript
   // FileViewerPanel.tsの_sendMessageToWebviewメソッドを修正
   private _sendMessageToWebview(message: any): void {
     try {
       // 破棄されたパネルへのアクセス判定を改善
       if (!this._panel || !this._panel.webview) {
         // パネルが既に破棄されている場合は静かに終了
         return;
       }
       
       // Webviewのアクセス可能性を検証する安全なチェック
       try {
         // webviewプロパティにアクセスしてチェック（例外が発生する場合は既に破棄されている）
         const title = this._panel.title;
         this._panel.webview.postMessage(message);
       } catch (webviewError) {
         // ログレベルをERRORからINFOに下げて、メッセージだけを簡潔に記録
         Logger.info(`FileViewerPanel: パネルが既に破棄されています (${message.command})`);
       }
     } catch (error) {
       // 重大なエラーのみをERRORレベルで記録
       if ((error as Error).message !== 'Webview is disposed') {
         Logger.error(`FileViewerPanel: メッセージ送信中に予期せぬエラー: ${message.command}`, error as Error);
       } else {
         // 既知のWebview disposedエラーは情報レベルで記録
         Logger.info(`FileViewerPanel: パネルが破棄されています (${message.command})`);
       }
     }
   }
   ```

2. **イベントリスナーの適切なクリーンアップ追加**:
   ```typescript
   // FileViewerPanel.tsのdisposeメソッドを強化
   public dispose(): void {
     try {
       // プロジェクト変更リスナーを明示的に削除
       if (this._projectService) {
         // リスナー解除メソッドが存在する場合は呼び出す
         if (typeof this._projectService.offProjectSelected === 'function') {
           this._projectService.offProjectSelected(this._onProjectChanged.bind(this));
         }
       }
       
       // 既存の処理...
       FileViewerPanel._currentPanel = undefined;
       this._panel.dispose();
       
       if (this._fileWatcher) {
         this._fileWatcher.dispose();
         this._fileWatcher = null;
       }
       
       // その他のリソースクリーンアップ...
     } catch (error) {
       // disposeプロセス自体のエラーはログに記録するのみ
       Logger.warn('FileViewerPanel: リソース解放中にエラーが発生しました', error as Error);
     } finally {
       // 必ず実行される処理
       Logger.info('FileViewerPanel: すべてのリソースを解放しました');
     }
   }
   ```

3. **_onProjectChangedメソッドの安全対策**:
   ```typescript
   private _onProjectChanged(projectPath: string): void {
     try {
       // パネルが既に破棄されている場合は何もしない（静かに終了）
       if (!this._panel) {
         return;
       }
       
       if (projectPath === this._currentProjectPath) {
         return;
       }
       
       // ファイルリスト更新も安全に実行
       this._safeRefreshFileList(projectPath);
       
       // 以下は既存コード...
     } catch (error) {
       // エラーログのみ
       Logger.info(`FileViewerPanel: プロジェクト変更処理中にエラー: ${(error as Error).message}`);
     }
   }
   
   // 安全なファイルリスト更新メソッド
   private _safeRefreshFileList(path?: string): void {
     try {
       this._refreshFileList(path);
     } catch (error) {
       // エラーログのみ
       Logger.info('FileViewerPanel: ファイルリスト更新中にエラーが発生しました');
     }
   }
   ```

4. **削除すべきコード: ファイル内の重複メソッド**
   FileViewerPanel.tsファイル内に重複している処理やイベントリスナーのクリーンアップが不完全なコードがあれば、それらは削除します。特にイベントリスナーの登録と解除の対が適切に行われていないコードが問題の原因である可能性があります。

## 3. SimpleAuthService - トークンリフレッシュエラー問題

### 発生しているエラー
```
[2025-05-15T11:18:42.203Z] [ERROR] SimpleAuthService: リフレッシュAPIエラー - ステータス: 401
[2025-05-15T11:18:42.204Z] [ERROR] SimpleAuthService: エラー詳細: {"success":false,"message":"無効なリフレッシュトークンです"}
[2025-05-15T11:18:42.204Z] [WARN] SimpleAuthService: リフレッシュトークンが無効です。認証情報をクリアします。
[2025-05-15T11:18:42.336Z] [ERROR] SimpleAuthService: トークンリフレッシュエラー
[2025-05-15T11:18:42.336Z] [ERROR] Error details: Request failed with status code 401
```

### 原因
- リフレッシュトークンが無効になっており、認証サーバーが401エラーを返している
- リフレッシュトークンの有効期限が切れた場合の適切な処理が不足している
- エラーレベルが高すぎる場合がある

### 修正案（削除とエラーハンドリング強化）
この問題は正常な動作の一部（認証トークン期限切れなど）の場合もあるため、ユーザーエクスペリエンスを改善する方向で対処します。

1. **リフレッシュエラーログレベルの調整**:
   ```typescript
   // SimpleAuthService.tsの_refreshAccessTokenメソッド内を修正
   private async _refreshAccessToken(): Promise<boolean> {
     try {
       // 既存コード...
     } catch (apiError: any) {
       // エラーレスポンス詳細をログ出力
       if (apiError.response) {
         // 401エラーはWARNレベルに下げる（正常な期限切れの可能性）
         if (apiError.response.status === 401) {
           Logger.warn(`SimpleAuthService: リフレッシュAPIエラー - ステータス: ${apiError.response.status}`);
           // エラーの詳細はDEBUGレベルに下げる
           Logger.debug(`SimpleAuthService: エラー詳細: ${JSON.stringify(apiError.response.data || {})}`);
           
           // トークンをクリアし、再ログイン通知を表示
           Logger.warn('SimpleAuthService: リフレッシュトークンが無効です。認証情報をクリアします。');
           await this._clearTokens();
           
           // ユーザービリティ向上: 再ログイン通知を表示（既存のUI機能を最大限活用）
           try {
             vscode.window.showInformationMessage('ログインセッションの有効期限が切れました。再度ログインしてください。', 'ログイン')
               .then(selection => {
                 if (selection === 'ログイン') {
                   vscode.commands.executeCommand('appgenius-ai.login');
                 }
               });
           } catch (notifyError) {
             // 通知表示失敗はログのみ
             Logger.debug('SimpleAuthService: 再ログイン通知の表示に失敗しました');
           }
         } else {
           // その他のHTTPエラーはERRORレベルのまま
           Logger.error(`SimpleAuthService: リフレッシュAPIエラー - ステータス: ${apiError.response.status}`);
           Logger.error(`SimpleAuthService: エラー詳細: ${JSON.stringify(apiError.response.data || {})}`);
         }
       } else if (apiError.request) {
         // ネットワークエラーなどリクエスト失敗の場合
         Logger.warn('SimpleAuthService: リフレッシュAPIレスポンスなし (接続タイムアウトの可能性)');
       } else {
         // その他の一般的なエラー
         Logger.error(`SimpleAuthService: リフレッシュAPIリクエスト前エラー: ${apiError.message}`);
       }
       
       // 後続処理を削除せず、falseを返すだけにする
       return false;
     }
   }
   ```

2. **不要な実装や冗長なコードの削除**:
   ```typescript
   // 削除対象:
   
   // SimpleAuthService.tsのトークン検証でのデバッグログ削除
   // 不必要に冗長なコンソールログを削除
   console.log('SimpleAuthService: 認証状態検証開始 - 定期実行チェック');
   
   // デバッグモード関連の不要コード削除
   // 例: SimpleAuthService.tsの_loadTokens内のデバッグモード自動ログイン機能
   if (!this._accessToken) {
     Logger.warn('SimpleAuthService: デバッグモードでダミートークンを設定');
     this._accessToken = 'DEBUG_DUMMY_TOKEN';
     await this.storageManager.setAccessToken(this._accessToken, 86400); // 24時間有効
     
     // ... 他のデバッグモード処理 ...
   }
   ```

3. **最小限の変更でのエラーハンドリング改善**:
   ```typescript
   // SimpleAuthService.tsのverifyAuthStateメソッドを修正
   public async verifyAuthState(): Promise<boolean> {
     try {
       Logger.info('SimpleAuthService: 認証状態検証開始');
       
       // アクセストークンチェック
       if (!this._accessToken) {
         Logger.info('SimpleAuthService: アクセストークンなし');
         return false;
       }
       
       // トークン有効期限チェック
       if (this._tokenExpiry) {
         const now = Date.now();
         // 期限切れまでの残り時間
         const timeUntilExpiry = this._tokenExpiry - now;
         
         // 期限切れまたは5分以内に期限切れの場合
         if (timeUntilExpiry <= 5 * 60 * 1000) {
           // 有効期限メッセージを追加（ユーザービリティ向上）
           if (timeUntilExpiry <= 0) {
             Logger.info('SimpleAuthService: トークンは既に期限切れです');
           } else {
             // 残り時間が5分以内
             const minutesLeft = Math.floor(timeUntilExpiry / (1000 * 60));
             Logger.info(`SimpleAuthService: トークンの有効期限まで残り${minutesLeft}分以内です`);
           }
           
           // リフレッシュを試行
           Logger.info('SimpleAuthService: トークンリフレッシュを試行');
           const refreshed = await this._refreshAccessToken();
           
           if (!refreshed) {
             // 静かに失敗（エラーログではなく情報ログ）
             Logger.info('SimpleAuthService: リフレッシュに失敗しました - 再認証が必要です');
             return false;
           }
         }
       }
       
       // 残りの処理は既存コードのまま...
       return true;
     } catch (error) {
       // エラーレベルをERRORからWARNに引き下げ
       Logger.warn('SimpleAuthService: 認証状態検証中にエラーが発生しました', error as Error);
       return false;
     }
   }
   ```

4. **削除しないコード - 重要な機能**
   このようなエラー処理と認証フローは機能的に重要であるため、削除せずに適切に対応すべきです。以下の機能は削除するのではなく、エラーレベルと表示メッセージの調整で対応します：
   - リフレッシュトークンによる認証維持機能
   - 認証エラー時のセッションクリア処理
   - ユーザーへの認証失効通知

## 実装順序・テスト計画

1. **ハンドラ登録問題の修正**
   - MessageDispatchServiceImplに新しいハンドラー登録メソッドを追加
   - ServiceFactoryの呼び出しを更新
   - それぞれのコマンドのリダイレクト処理を実装

2. **FileViewerPanelの安全性強化**
   - _isPanelAliveメソッドのパネルチェック処理を強化
   - すべてのメッセージ送信・イベント処理前にパネル状態チェックを追加

3. **認証関連の改善**
   - トークン管理と初期化処理の安全性を向上
   - サーバー接続エラー時の堅牢性を追加
   - ユーザー通知機能の強化

## テスト計画

各修正後に以下の検証を行います：

1. **ハンドラ登録の検証**
   - `launchPromptFromURL`コマンドを実行し、正しくプロンプト起動が行われるか
   - `selectProject`コマンドでプロジェクト切り替えが正常に機能するか
   - その他の未登録コマンドが警告なく実行されるか

2. **FileViewerPanel検証**
   - 複数のパネルを開いて閉じる操作を繰り返し、エラーが発生しないか
   - プロジェクト変更時にエラーが発生しないか
   - 特にエラーログに "Webview is disposed" が出現しないか

3. **認証機能検証**
   - 認証サーバーが利用できない状態でもローカルトークンの有効判定が機能するか
   - リフレッシュトークンエラー時に適切な通知とログアウト処理が行われるか
   - 再ログイン操作が正常に機能するか

これらの改修により、AppGeniusエクステンションの安定性と信頼性が大幅に向上することが期待されます。