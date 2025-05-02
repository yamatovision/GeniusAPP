# FileSystemServiceへの機能移行計画

## 1. 現状分析

### 1.1 ScopeManagerPanelとFileSystemServiceの機能分担

現在、ファイル操作に関する機能は一部がFileSystemServiceに移行されていますが、ScopeManagerPanelにもファイル操作関連のコードが残っています。

#### 既にFileSystemServiceに実装されている機能:
- マークダウンファイルの読み込み (`readMarkdownFile`)
- デフォルトステータスファイルの作成 (`createDefaultStatusFile`)
- ディレクトリ構造の取得 (`getDirectoryStructure`)
- ディレクトリの存在確認・作成 (`ensureDirectoryExists`)
- ファイル監視の基本機能 (`setupFileWatcher`, `setupEnhancedFileWatcher`)
- ファイル存在チェック (`fileExists`)

#### ScopeManagerPanelに残っている関連機能:
- `_loadStatusFile`: ステータスファイルの読み込みとテンプレート作成処理
- `_updateDirectoryStructure`: ディレクトリ構造の更新
- `_setupFileWatcher`: ファイル監視設定 (FileSystemServiceのメソッドは使用しているが、設定ロジックはここにある)
- `_getNonce`: nonce値の生成
- ファイル更新時のUI更新ロジック

## 2. 移行対象の特定

以下のメソッドと機能をFileSystemServiceに移行・統合します：

1. **`_loadStatusFile`** のロジック
   - 現状: ScopeManagerPanelで実装し、FileSystemServiceのメソッドを呼び出している
   - 問題点: FileSystemServiceの機能を分散して呼び出しており、重複処理がある

2. **`_updateDirectoryStructure`** のロジック
   - 現状: FileSystemServiceに `getDirectoryStructure` があるが、ScopeManagerPanelで呼び出し処理を行っている
   - 問題点: 同じ責任が二つの場所に分散している

3. **`_setupFileWatcher`** のロジック
   - 現状: FileSystemServiceに監視設定メソッドがあるが、ScopeManagerPanelでも設定ロジックがある
   - 問題点: ファイル監視の設定ロジックが重複している

## 3. 詳細な移行計画

### 3.1 FileSystemServiceインターフェース更新

```typescript
export interface IFileSystemService {
  // 既存メソッド...
  
  // 新規メソッド
  loadStatusFile(projectPath: string, outputCallback?: (content: string) => void): Promise<string>;
  updateDirectoryStructure(projectPath: string): Promise<string>;
  setupProjectFileWatcher(projectPath: string, outputCallback: (filePath: string) => void): vscode.Disposable;
  
  // イベント強化
  onDirectoryStructureUpdated: vscode.Event<string>;
}
```

### 3.2 FileSystemServiceへの実装追加

1. **`loadStatusFile`メソッドの実装**

```typescript
/**
 * ステータスファイルを読み込み、必要に応じて作成する
 * @param projectPath プロジェクトパス
 * @param outputCallback 出力コールバック - ファイル内容が変更された時に呼び出される
 * @returns ステータスファイルの内容
 */
public async loadStatusFile(projectPath: string, outputCallback?: (content: string) => void): Promise<string> {
  try {
    if (!projectPath) {
      throw new Error('プロジェクトパスが指定されていません');
    }

    // ステータスファイルの存在確認とパス生成
    const docsDir = path.join(projectPath, 'docs');
    const statusFilePath = path.join(docsDir, 'CURRENT_STATUS.md');
    
    // ディレクトリを確保
    await this.ensureDirectoryExists(docsDir);

    // ファイルの存在確認
    const fileExists = await this.fileExists(statusFilePath);

    // ステータスファイルが存在しない場合はテンプレートを作成
    if (!fileExists) {
      const projectName = path.basename(projectPath);
      await this.createDefaultStatusFile(projectPath, projectName);
      Logger.info(`ステータスファイルを作成しました: ${statusFilePath}`);
    }

    // ファイルを読み込む
    const content = await this.readMarkdownFile(statusFilePath);
    
    // コールバックがあれば呼び出す
    if (outputCallback) {
      outputCallback(content);
    }
    
    return content;
  } catch (error) {
    Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
    throw error;
  }
}
```

2. **`updateDirectoryStructure`メソッドの実装**

```typescript
private _onDirectoryStructureUpdated = new vscode.EventEmitter<string>();
public readonly onDirectoryStructureUpdated = this._onDirectoryStructureUpdated.event;

/**
 * プロジェクトのディレクトリ構造を更新
 * @param projectPath プロジェクトパス
 * @returns ディレクトリ構造を表す文字列
 */
public async updateDirectoryStructure(projectPath: string): Promise<string> {
  if (!projectPath) {
    return '';
  }
  
  try {
    // 既存のgetDirectoryStructureメソッドを使用
    const structure = await this.getDirectoryStructure(projectPath);
    
    // イベントを発火
    this._onDirectoryStructureUpdated.fire(structure);
    
    return structure;
  } catch (error) {
    Logger.error('ディレクトリ構造の更新中にエラーが発生しました', error as Error);
    return 'ディレクトリ構造の取得に失敗しました。';
  }
}
```

3. **`setupProjectFileWatcher`メソッドの実装**

```typescript
/**
 * プロジェクト用のファイル監視設定
 * docs/CURRENT_STATUS.mdファイルの変更を監視し、イベントとコールバックで通知
 * @param projectPath プロジェクトのルートパス
 * @param outputCallback ファイル変更時のコールバック
 * @returns Disposable - 監視を停止するためのオブジェクト
 */
public setupProjectFileWatcher(projectPath: string, outputCallback: (filePath: string) => void): vscode.Disposable {
  try {
    if (!projectPath) {
      throw new Error('プロジェクトパスが指定されていません');
    }
    
    // ステータスファイルのパスを構築
    const docsDir = path.join(projectPath, 'docs');
    const statusFilePath = path.join(docsDir, 'CURRENT_STATUS.md');
    
    // ディレクトリを確保
    this.ensureDirectoryExists(docsDir);
    
    // 拡張ファイル監視を設定（遅延読み込みオプション付き）
    const watcher = this.setupEnhancedFileWatcher(
      statusFilePath,
      async (filePath) => {
        // ファイル変更を検出したらコールバックを呼び出す
        Logger.info(`FileSystemService: ファイル変更を検出: ${filePath}`);
        outputCallback(filePath);
      },
      { delayedReadTime: 100 } // 100ms後に2回目の読み込みを実行
    );
    
    // イベントリスナーも設定
    const eventListener = this.setupStatusFileEventListener(
      projectPath,
      statusFilePath,
      async (filePath) => {
        // イベントバス経由の通知を受けた場合もコールバックを呼び出す
        Logger.info(`FileSystemService: イベントバス経由でファイル更新を検出: ${filePath}`);
        outputCallback(filePath);
      }
    );
    
    // 複合Disposableを返す
    return {
      dispose: () => {
        watcher.dispose();
        eventListener.dispose();
      }
    };
  } catch (error) {
    Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
    throw error;
  }
}
```

### 3.3 ScopeManagerPanelの修正

1. **`_loadStatusFile`メソッドの修正**

```typescript
private async _loadStatusFile(): Promise<void> {
  try {
    if (!this._projectPath) {
      return;
    }

    // FileSystemServiceの新しいメソッドを呼び出す
    await this._fileSystemService.loadStatusFile(this._projectPath, async (content) => {
      // マークダウン表示を更新
      await this._handleGetMarkdownContent(this._statusFilePath);
    });
  } catch (error) {
    Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
    this._showError(`ステータスファイルの読み込みに失敗しました: ${(error as Error).message}`);
  }
}
```

2. **`_updateDirectoryStructure`メソッドの修正**

```typescript
private async _updateDirectoryStructure(): Promise<void> {
  if (!this._projectPath) {
    return;
  }
  
  try {
    // FileSystemServiceの新しいメソッドを呼び出す
    this._directoryStructure = await this._fileSystemService.updateDirectoryStructure(this._projectPath);
  } catch (error) {
    Logger.error('ディレクトリ構造の取得中にエラーが発生しました', error as Error);
    this._directoryStructure = 'ディレクトリ構造の取得に失敗しました。';
  }
}
```

3. **`_setupFileWatcher`メソッドの修正**

```typescript
private async _setupFileWatcher(): Promise<void> {
  try {
    // 既存の監視があれば破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    if (!this._projectPath) {
      return;
    }
    
    // FileSystemServiceの新しいメソッドを呼び出す
    this._fileWatcher = this._fileSystemService.setupProjectFileWatcher(
      this._projectPath,
      async (filePath) => {
        // ファイル変更を検出したらマークダウンを更新
        Logger.info(`ScopeManagerPanel: ファイル変更を検出して内容を更新: ${filePath}`);
        await this._handleGetMarkdownContent(filePath);
      }
    );
    
    Logger.info('ScopeManagerPanel: ファイル監視設定完了');
  } catch (error) {
    Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
  }
}
```

### 3.4 イベントリスナーの追加

FileSystemServiceの新しいイベントをScopeManagerPanelでリッスンするコードを追加：

```typescript
// コンストラクタ内
constructor(...) {
  // 既存のコード...
  
  // FileSystemServiceのイベントリスナーを設定
  this._disposables.push(
    this._fileSystemService.onDirectoryStructureUpdated((structure) => {
      this._directoryStructure = structure;
      // ディレクトリ構造が表示されている場合は更新
      this._panel.webview.postMessage({
        command: 'updateDirectoryStructure',
        structure: structure
      });
    })
  );
}
```

## 4. 移行手順

1. **FileSystemServiceインターフェースの更新**
   - 新しいメソッドとイベントを追加

2. **FileSystemService実装の更新**
   - 新しいメソッドを実装
   - 新しいイベントエミッターを追加

3. **ScopeManagerPanelの修正**
   - 新しいFileSystemServiceメソッドを使うようにコードを修正
   - イベントリスナーを追加

4. **動作確認**
   - プロジェクト選択
   - ステータスファイル作成
   - ファイル監視
   - ディレクトリ構造表示

## 5. リスク分析と対策

### 5.1 リスク
1. **既存の機能停止**: 移行によって既存の機能が停止するリスク
2. **イベント重複**: イベント発火の重複や循環発生のリスク
3. **タイミングの問題**: 非同期処理の順序による予期せぬ動作

### 5.2 対策
1. **段階的移行**: 一つずつ機能を移行し、都度テスト
2. **ソース元の識別**: イベント発火時にソースを識別し、循環を防止
3. **ログ強化**: 移行中はログを強化し、動作を確認
4. **ロールバックポイント**: 問題発生時にすぐにロールバックできるポイントを設定

## 6. 期待される効果

1. **コードの整理**: ScopeManagerPanelのコード行数が減少
2. **責任の明確化**: ファイル操作の責任がFileSystemServiceに集約
3. **保守性の向上**: 機能変更時に修正すべき場所が一カ所に
4. **一貫性のある動作**: 同じファイル操作ロジックが全体で使われる
5. **テスト容易性**: 分離されたサービスは単体テストが容易

## 7. 実装後の検証

移行完了後、以下の観点で検証を行います：

1. **機能的検証**: 全ての機能が正常に動作するか
2. **性能検証**: パフォーマンスへの影響はないか
3. **エラー処理**: 異常系のハンドリングが適切か
4. **コード量**: ScopeManagerPanelのコード行数は減少したか
5. **メンテナビリティ**: コードの可読性と保守性は向上したか