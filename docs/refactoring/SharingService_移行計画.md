# SharingServiceへの機能移行計画

## 1. 現状分析

### 1.1 ScopeManagerPanelとSharingServiceの機能分担

現在、共有機能関連の一部はSharingServiceに移行されていますが、ScopeManagerPanelにも共有機能関連のコードが残っています。

#### 既にSharingServiceに実装されている機能:
- テキスト共有 (`shareText`)
- 画像共有 (`shareImage`) 
- 共有履歴管理 (`getHistory`, `deleteFromHistory`, `recordAccess`)
- コマンド生成 (`generateCommand`)
- プロジェクトベースパス設定 (`setProjectBasePath`)

#### ScopeManagerPanelに残っている関連機能:
- `_handleShareText`: SharingServiceを呼び出しているが、UI更新ロジックを含む
- `_handleShareImage`: SharingServiceを呼び出しているが、UI更新ロジックを含む
- `_handleGetHistory`: 履歴取得と表示更新ロジック
- `_handleDeleteFromHistory`: 履歴削除と更新ロジック
- `_handleCopyCommand`: クリップボードコピー機能と通知ロジックを含む
- `_handleReuseHistoryItem`: 履歴アイテム再利用と表示更新ロジック
- `_tempShareDir` インスタンス変数: 一時ディレクトリパスを保持

## 2. 移行対象の特定

以下のメソッドと機能をSharingServiceに移行・統合します：

1. **共有機能とUI更新の分離**
   - 現状: 共有機能の実行とUI更新が同じメソッドに混在
   - 問題点: 共有ロジックとUI表示ロジックの責任が分離されていない
   - 対策: UI通知用イベントとコールバック方式の採用

2. **クリップボード操作の統合**
   - 現状: クリップボード操作がScopeManagerPanelにある
   - 問題点: 共有関連の操作が分散している
   - 対策: クリップボード操作もSharingServiceに統合

3. **一時ディレクトリ管理の移行**
   - 現状: 一時ディレクトリ設定がScopeManagerPanelにある
   - 問題点: ファイル管理とプロジェクトパス管理が分散している
   - 対策: 一時ディレクトリ管理をSharingServiceに集約

## 3. 詳細な移行計画

### 3.1 SharingServiceインターフェース更新

```typescript
export interface ISharingService {
  // 既存メソッド...
  
  // 新規メソッド
  // 共有操作の拡張
  shareTextWithNotification(text: string, options?: FileSaveOptions): Promise<ShareResult>;
  shareImageWithNotification(imageData: string, fileName: string, options?: FileSaveOptions): Promise<ShareResult>;
  
  // クリップボード操作
  copyCommandToClipboard(fileId: string): Promise<ShareResult>;
  copyTextToClipboard(text: string): Promise<boolean>;
  
  // 一時ディレクトリ管理
  ensureTempDirectory(projectPath: string): Promise<string>;
  getTempDirectory(): string;
  
  // 履歴操作の拡張
  reuseHistoryItem(fileId: string): Promise<ShareResult>;
  
  // イベント
  onShareCompleted: vscode.Event<ShareResult>;
  onHistoryUpdated: vscode.Event<SharedFile[]>;
}

// 共有結果用インターフェース
export interface ShareResult {
  success: boolean;
  file?: SharedFile;
  command?: string;
  error?: string;
  type?: 'text' | 'image';
}
```

### 3.2 SharingServiceへの実装追加

1. **イベントエミッターの追加**

```typescript
private _onShareCompleted = new vscode.EventEmitter<ShareResult>();
public readonly onShareCompleted = this._onShareCompleted.event;

private _onHistoryUpdated = new vscode.EventEmitter<SharedFile[]>();
public readonly onHistoryUpdated = this._onHistoryUpdated.event;
```

2. **`shareTextWithNotification`メソッドの実装**

```typescript
/**
 * テキストを共有して結果を通知
 * @param text 共有するテキスト
 * @param options 共有オプション
 * @returns 共有結果
 */
public async shareTextWithNotification(text: string, options?: FileSaveOptions): Promise<ShareResult> {
  try {
    // オプションが指定されていなければデフォルト設定
    const shareOptions: FileSaveOptions = options || {
      type: 'text',
      expirationHours: 24  // デフォルト有効期限
    };
    
    // 共有タイプを指定
    shareOptions.type = 'text';
    
    // 既存のshareTextメソッドを呼び出し
    const file = await this.shareText(text, shareOptions);
    
    // コマンドを生成
    const command = this.generateCommand(file);
    
    // 結果を作成
    const result: ShareResult = {
      success: true,
      file,
      command,
      type: 'text'
    };
    
    // イベントを発火
    this._onShareCompleted.fire(result);
    
    // 履歴更新イベントも発火
    const history = this.getHistory();
    this._onHistoryUpdated.fire(history);
    
    return result;
  } catch (error) {
    // エラー結果を作成
    const errorResult: ShareResult = {
      success: false,
      error: (error as Error).message,
      type: 'text'
    };
    
    // エラーイベントも発火
    this._onShareCompleted.fire(errorResult);
    
    Logger.error('テキスト共有エラー', error as Error);
    throw error;
  }
}
```

3. **`shareImageWithNotification`メソッドの実装**

```typescript
/**
 * 画像を共有して結果を通知
 * @param imageData 画像データ（Base64）
 * @param fileName ファイル名
 * @param options 共有オプション
 * @returns 共有結果
 */
public async shareImageWithNotification(
  imageData: string, 
  fileName: string, 
  options?: FileSaveOptions
): Promise<ShareResult> {
  try {
    // 既存のshareImageメソッドを呼び出し
    const file = await this.shareImage(imageData, fileName, options);
    
    // コマンドを生成
    const command = this.generateCommand(file);
    
    // 結果を作成
    const result: ShareResult = {
      success: true,
      file,
      command,
      type: 'image'
    };
    
    // イベントを発火
    this._onShareCompleted.fire(result);
    
    // 履歴更新イベントも発火
    const history = this.getHistory();
    this._onHistoryUpdated.fire(history);
    
    return result;
  } catch (error) {
    // エラー結果を作成
    const errorResult: ShareResult = {
      success: false,
      error: (error as Error).message,
      type: 'image'
    };
    
    // エラーイベントも発火
    this._onShareCompleted.fire(errorResult);
    
    Logger.error('画像共有エラー', error as Error);
    throw error;
  }
}
```

4. **クリップボード操作メソッドの実装**

```typescript
/**
 * 共有ファイルのコマンドをクリップボードにコピー
 * @param fileId ファイルID
 * @returns コピー結果
 */
public async copyCommandToClipboard(fileId: string): Promise<ShareResult> {
  try {
    // ファイルを履歴から検索
    const history = this.getHistory();
    const file = history.find(item => item.id === fileId);
    
    if (!file) {
      throw new Error(`ファイルが見つかりません: ${fileId}`);
    }
    
    // コマンドを生成
    const command = this.generateCommand(file);
    
    // VSCodeのクリップボード機能を使用
    await vscode.env.clipboard.writeText(command);
    
    // アクセスカウントを増やす
    this.recordAccess(fileId);
    
    // 結果を作成
    const result: ShareResult = {
      success: true,
      file,
      command,
      type: file.type as 'text' | 'image'
    };
    
    // イベントを発火（コピー完了通知用）
    this._onShareCompleted.fire(result);
    
    return result;
  } catch (error) {
    const errorResult: ShareResult = {
      success: false,
      error: (error as Error).message
    };
    
    Logger.error(`コマンドコピー実行中にエラーが発生しました: ${fileId}`, error as Error);
    return errorResult;
  }
}

/**
 * テキストをクリップボードにコピー
 * @param text コピーするテキスト
 * @returns 成功したかどうか
 */
public async copyTextToClipboard(text: string): Promise<boolean> {
  try {
    // VSCodeのクリップボード機能を使用
    await vscode.env.clipboard.writeText(text);
    return true;
  } catch (error) {
    Logger.error('テキストコピーエラー', error as Error);
    return false;
  }
}
```

5. **一時ディレクトリ管理メソッドの実装**

```typescript
private _tempShareDir: string = '';

/**
 * 一時ディレクトリを確保
 * @param projectPath プロジェクトパス
 * @returns 一時ディレクトリのパス
 */
public async ensureTempDirectory(projectPath: string): Promise<string> {
  try {
    if (!projectPath) {
      throw new Error('プロジェクトパスが指定されていません');
    }
    
    // 一時ディレクトリを設定
    this._tempShareDir = path.join(projectPath, '.appgenius_temp');
    
    // ディレクトリを確保
    if (!fs.existsSync(this._tempShareDir)) {
      fs.mkdirSync(this._tempShareDir, { recursive: true });
    }
    
    return this._tempShareDir;
  } catch (error) {
    Logger.error(`一時ディレクトリの確保に失敗しました: ${projectPath}`, error as Error);
    throw error;
  }
}

/**
 * 現在の一時ディレクトリを取得
 * @returns 一時ディレクトリのパス
 */
public getTempDirectory(): string {
  return this._tempShareDir;
}
```

6. **`reuseHistoryItem`メソッドの実装**

```typescript
/**
 * 履歴アイテムを再利用
 * @param fileId ファイルID
 * @returns 再利用結果
 */
public async reuseHistoryItem(fileId: string): Promise<ShareResult> {
  try {
    // ファイルを履歴から検索
    const history = this.getHistory();
    const file = history.find(item => item.id === fileId);
    
    if (!file) {
      throw new Error(`ファイルが見つかりません: ${fileId}`);
    }
    
    // コマンドを生成
    const command = this.generateCommand(file);
    
    // アクセスカウントを増やす
    this.recordAccess(fileId);
    
    // 結果を作成
    const result: ShareResult = {
      success: true,
      file,
      command,
      type: file.type as 'text' | 'image'
    };
    
    // イベントを発火
    this._onShareCompleted.fire(result);
    
    return result;
  } catch (error) {
    const errorResult: ShareResult = {
      success: false,
      error: (error as Error).message
    };
    
    Logger.error(`履歴アイテム再利用中にエラーが発生しました: ${fileId}`, error as Error);
    return errorResult;
  }
}
```

### 3.3 ScopeManagerPanelの修正

1. **`_handleShareText`メソッドの修正**

```typescript
/**
 * テキストを共有サービスで共有
 */
private async _handleShareText(text: string, suggestedFilename?: string): Promise<void> {
  try {
    // 共有オプションを設定
    const options: FileSaveOptions = {
      type: 'text',
      expirationHours: 24
    };
    
    // 提案されたファイル名があれば使用
    if (suggestedFilename) {
      options.title = suggestedFilename;
      options.metadata = { suggestedFilename };
    }
    
    // 通知付き共有メソッドを使用
    await this._sharingService.shareTextWithNotification(text, options);
    
    // イベントでUIが更新されるため、ここでの追加処理は不要
  } catch (error) {
    Logger.error('テキスト共有エラー', error as Error);
    this._showError(`テキストの共有に失敗しました: ${(error as Error).message}`);
  }
}
```

2. **`_handleShareImage`メソッドの修正**

```typescript
/**
 * 画像を共有サービスで共有
 */
private async _handleShareImage(imageData: string, fileName: string): Promise<void> {
  try {
    // 通知付き共有メソッドを使用
    await this._sharingService.shareImageWithNotification(imageData, fileName);
    
    // UIをリセット
    this._panel.webview.postMessage({
      command: 'resetDropZone',
      force: true,
      timestamp: new Date().getTime()
    });
    
    // 念のため再度リセット
    setTimeout(() => {
      this._panel.webview.postMessage({
        command: 'resetDropZone',
        force: true,
        timestamp: new Date().getTime() + 100
      });
    }, 100);
    
    // 他のUI更新はイベントリスナーで行われる
  } catch (error) {
    this._showError(`画像の共有に失敗しました: ${(error as Error).message}`);
  }
}
```

3. **`_handleCopyCommand`メソッドの修正**

```typescript
/**
 * ファイルのコマンドをクリップボードにコピー
 */
private async _handleCopyCommand(fileId: string): Promise<void> {
  try {
    // SharingServiceのメソッドを使用
    const result = await this._sharingService.copyCommandToClipboard(fileId);
    
    if (result.success && result.file) {
      // 成功メッセージを送信
      this._panel.webview.postMessage({
        command: 'commandCopied',
        fileId: fileId,
        fileName: result.file.title || result.file.originalName || result.file.fileName
      });
      
      // VSCodeの通知も表示
      vscode.window.showInformationMessage(`コマンド "${result.command}" をコピーしました！`);
    } else {
      this._showError(result.error || 'コピーに失敗しました');
    }
  } catch (error) {
    Logger.error(`コピーコマンド実行中にエラーが発生しました: ${fileId}`, error as Error);
    this._showError(`コピーに失敗しました: ${(error as Error).message}`);
  }
}
```

4. **`_handleCopyToClipboard`メソッドの修正**

```typescript
/**
 * テキストをクリップボードにコピー
 */
private async _handleCopyToClipboard(text: string): Promise<void> {
  // SharingServiceのメソッドを使用
  await this._sharingService.copyTextToClipboard(text);
}
```

5. **`_handleReuseHistoryItem`メソッドの修正**

```typescript
/**
 * 履歴アイテムを再利用
 */
private async _handleReuseHistoryItem(fileId: string): Promise<void> {
  try {
    // SharingServiceのメソッドを使用
    const result = await this._sharingService.reuseHistoryItem(fileId);
    
    if (result.success && result.file) {
      // 結果を表示
      this._panel.webview.postMessage({
        command: 'showShareResult',
        data: {
          filePath: result.file.path,
          command: result.command,
          type: result.type
        }
      });
    } else {
      this._showError(result.error || '履歴アイテムの再利用に失敗しました');
    }
  } catch (error) {
    Logger.error(`履歴アイテム再利用中にエラーが発生しました: ${fileId}`, error as Error);
    this._showError(`履歴アイテムの再利用に失敗しました: ${(error as Error).message}`);
  }
}
```

6. **イベントリスナーの追加**

ScopeManagerPanelのコンストラクタに以下のコードを追加：

```typescript
// SharingServiceのイベントをリッスン
// 共有完了イベント
this._disposables.push(
  this._sharingService.onShareCompleted((result) => {
    if (result.success && result.file) {
      // 結果をUIに通知
      setTimeout(() => {
        this._panel.webview.postMessage({
          command: 'showShareResult',
          data: {
            filePath: result.file?.path,
            command: result.command,
            type: result.type,
            title: result.file?.title,
            originalName: result.file?.originalName
          }
        });
      }, 100);
    }
  })
);

// 履歴更新イベント
this._disposables.push(
  this._sharingService.onHistoryUpdated((history) => {
    // 履歴更新をUIに通知
    this._panel.webview.postMessage({
      command: 'updateSharingHistory',
      history: history || []
    });
  })
);
```

7. **`setProjectPath`メソッドの修正**

```typescript
/**
 * プロジェクトパスを設定 - 各サービスに委譲
 */
public async setProjectPath(projectPath: string): Promise<void> {
  try {
    this._projectPath = projectPath;
    
    // ProjectServiceにプロジェクトパスを設定
    await this._projectService.setProjectPath(projectPath);
    
    // ステータスファイルパスをProjectServiceから取得
    this._statusFilePath = this._projectService.getStatusFilePath();
    
    // 既存のファイルウォッチャーを破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    // SharingServiceに一時ディレクトリを設定
    this._tempShareDir = await this._sharingService.ensureTempDirectory(projectPath);
    
    // SharingServiceにプロジェクトパスを設定
    this._sharingService.setProjectBasePath(projectPath);
    
    // 関連サービスにプロジェクトパスを設定
    this._promptServiceClient.setProjectPath(projectPath);
    
    // ファイルウォッチャーとステータスファイルを設定
    this._setupFileWatcher();
    this._loadStatusFile();
    
    // WebViewにプロジェクト情報を送信
    this._panel.webview.postMessage({
      command: 'updateProjectPath',
      projectPath: this._projectPath,
      statusFilePath: this._statusFilePath,
      statusFileExists: fs.existsSync(this._statusFilePath)
    });
    
    // プロジェクト一覧を更新
    const allProjects = this._projectService.getAllProjects();
    const activeProject = this._projectService.getActiveProject();
    
    this._panel.webview.postMessage({
      command: 'updateProjects',
      projects: allProjects,
      activeProject: activeProject
    });
  } catch (error) {
    Logger.error(`プロジェクトパスの設定に失敗しました: ${error}`);
    throw error;
  }
}
```

## 4. 移行手順

1. **SharingServiceインターフェースの更新**
   - 新しいメソッドとイベントの追加
   - ShareResultインターフェースの追加

2. **SharingService実装の更新**
   - イベントエミッターの追加
   - 新しいメソッドの実装

3. **ScopeManagerPanelの修正**
   - 共有関連メソッドの修正
   - イベントリスナーの追加
   - 一時ディレクトリ管理の委譲

4. **動作確認**
   - テキスト共有
   - 画像共有
   - クリップボードコピー
   - 履歴管理

## 5. リスク分析と対策

### 5.1 リスク
1. **UI更新の遅延**: イベント駆動による更新に遅延が発生するリスク
2. **イベント同期問題**: 複数のイベントの順序が不適切になるリスク
3. **一時ファイル管理**: プロジェクト変更時に一時ファイルの管理が混乱するリスク
4. **エラー処理**: エラー状態の適切な伝播と回復が難しくなるリスク

### 5.2 対策
1. **更新最適化**: UI更新の遅延を最小限にするタイミング制御
2. **イベント順序制御**: イベント発火の順序を制御するメカニズム
3. **一時ファイル管理強化**: 一時ディレクトリのクリーンアップと管理メカニズム
4. **エラー伝播メカニズム**: 統一されたエラーハンドリングとUI通知

## 6. 期待される効果

1. **コードの整理**: ScopeManagerPanelの共有関連コードが削減
2. **責任の明確化**: 共有機能の責任がSharingServiceに集約
3. **保守性の向上**: 共有機能の変更時に修正すべき場所が一カ所に
4. **一貫性のある動作**: 同じ共有ロジックが全体で使われる
5. **再利用性の向上**: 他のコンポーネントでも同じ共有ロジックを容易に利用可能
6. **テスト容易性**: 分離された共有サービスは単体テストが容易

## 7. 実装後の検証

移行完了後、以下の観点で検証を行います：

1. **機能的検証**
   - テキスト共有が正常に動作するか
   - 画像共有が正常に動作するか
   - クリップボードコピーが正常に動作するか
   - 履歴管理が正常に動作するか

2. **性能検証**
   - 共有処理のレスポンス時間
   - UI更新の応答性
   - 大きなファイル共有時のパフォーマンス

3. **エラー処理検証**
   - 無効なデータ共有時の処理
   - ファイル操作エラー時の処理
   - ネットワークエラー時の処理

4. **コード量削減**
   - ScopeManagerPanelのコード行数削減
   - コード重複の排除
   - 循環的複雑度の減少

5. **UI検証**
   - 共有結果の表示
   - エラーメッセージの表示
   - 履歴の表示と操作