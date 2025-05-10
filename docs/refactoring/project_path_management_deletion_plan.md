# プロジェクトパス管理の削減・削除計画

## 目的

このリファクタリングは「単一の真実源」原則に基づき、冗長なコード、重複した状態管理、複雑なパス処理ロジックを**完全に削除**することを目的とします。後方互換性は維持せず、問題の根本的解消を図ります。

## 削除対象

### 1. クライアント側の冗長な状態管理

#### 1.1 `stateManager.js`の削減

```javascript
// 削除対象: プロジェクト情報の保存と管理関連コード
constructor() {
  // 削除: 以下のプロジェクト関連の状態管理
  this.state = {
    activeProjectName: null,     // 削除
    activeProjectPath: null,     // 削除
    lastSyncedProjectId: null,   // 削除
    lastProjectSyncTime: null,   // 削除
    // UIの状態のみ保持
    activeTab: 'scope-progress'  // 維持
  };
}

// 削除対象メソッド群
syncProjectState(project) { /* 削除 */ }
restoreProjectState() { /* 削除 */ }
```

#### 1.2 各コンポーネントの内部状態削除

**projectNavigation.js**:
```javascript
// 削除: 内部プロジェクト状態管理
updateProjects(projects, activeProject) {
  // 削除: アクティブプロジェクト情報を状態に保存
  if (activeProject) {
    const state = stateManager.getState();
    state.activeProjectName = activeProject.name;
    state.activeProjectPath = activeProject.path;
    state.activeTab = activeProject.metadata?.activeTab || 'scope-progress';
    stateManager.setState(state);
  }
  
  // この関数の他の部分は表示ロジックのみ残す
}
```

**fileBrowser.js**:
```javascript
// 削除: 内部のパス管理
class FileBrowser {
  constructor() {
    // 削除
    this.currentPath = null;
    this._progressFilePath = '';
    this._directoryCache = new Map();
    
    // 維持: UI関連のみ
    this.selectedFile = null;
    this.fileList = [];
  }
  
  // 削除対象
  _requestDirectoryListing(path) { /* 削除 */ }
  _extractPathFromStructure(structureJson) { /* 削除 */ }
  _normalizePath(path) { /* 削除 */ }
  updateDirectoryStructure(structureJson) { /* 削除 */ }
  
  // 単純化
  prepareUI() {
    // パス管理なしでUIだけを準備
  }
}
```

**tabManager.js**:
```javascript
// 削除: プロジェクトパス参照
selectTab(tabId, saveToServer = true) {
  // 削除: 進捗状況ファイルパスの直接構築
  if (tabId === 'scope-progress') {
    // 削除/置換
    stateManager.sendMessage('getMarkdownContent', {
      filePath: `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`,
      forScopeProgress: true
    });
    
    // 新: VSCode側にタブ内容要求のみ送信
    // vscode.postMessage({
    //   command: 'getTabContent',
    //   tabId: 'scope-progress'
    // });
  }
}
```

### 2. サーバー側の重複コード

#### 2.1 `ProjectServiceImpl`の削除対象

```typescript
// 削除: 内部状態管理
export class ProjectServiceImpl implements IProjectService {
  // 削除
  private _projectPath: string = '';
  private _progressFilePath: string = '';
  private _currentProjects: IProjectInfo[] = [];
  private _activeProject: IProjectInfo | null = null;
  
  // 削除: 重複したパス処理ロジック
  public setProjectPath(projectPath: string): Promise<void> {
    // 削除
    this._projectPath = projectPath;
    this._progressFilePath = this._fileSystemService.getProgressFilePath(projectPath);
    // ...
  }
  
  // 削除: 冗長なゲッター/セッター
  public getProgressFilePath(): string {
    // 削除: 独自の内部状態に基づくパス取得
    if (this._projectPath) {
      return this._fileSystemService.getProgressFilePath(this._projectPath);
    }
    return this._progressFilePath;
  }
  
  // 削除: 独自の状態同期メソッド
  public async syncProjectUIState(projectPath: string): Promise<{...}> {
    // 削除: 内部状態との同期処理
  }
}
```

#### 2.2 `FileSystemService`のパス関連重複コード

```typescript
export class FileSystemServiceImpl implements IFileSystemService {
  // 削除: プロジェクトパス依存の処理
  getProgressFilePath(projectPath: string): string {
    // 削除: ProjectServiceと重複
    return path.join(projectPath, 'docs', 'SCOPE_PROGRESS.md');
  }
  
  // その他重複するパス処理メソッド
}
```

### 3. メッセージ処理の重複

```typescript
// 削除: 複数のメッセージハンドラーでの同様の処理
// extension.ts または MessageDispatchServiceImpl 内
async handleMessage(message: any): Promise<any> {
  switch (message.command) {
    // 削除: 重複するプロジェクトパス関連処理
    case 'getProjectPath':
    case 'getProjectInfo':
    case 'refreshProjectsList':
    case 'selectProject':
      // これらをProjectManagementServiceに完全集約
      break;
      
    // 削除: ファイルパス構築の重複コード
    case 'getMarkdownContent':
      // ファイルパス構築のロジックを削除
      break;
  }
}
```

### 4. 不要なイベント通信

```typescript
// 削除: AppGeniusEventBusの冗長な使用
this._disposables.push(
  eventBus.onEventType(AppGeniusEventType.PROJECT_UPDATED, async (event) => {
    // 削除: 複雑なイベント処理と状態同期
  })
);

// 削除: 複数の類似イベント
AppGeniusEventType.PROJECT_CREATED  // 統合
AppGeniusEventType.PROJECT_REMOVED  // 統合
AppGeniusEventType.PROJECT_SELECTED // 統合
// →単一のPROJECT_CHANGEDに統合
```

## 完全新規実装対象

### 1. `ProjectManager` - 単一の真実源

```typescript
// 新規: すべてのプロジェクト処理を一元管理
export class ProjectManager {
  private static instance: ProjectManager;
  private storage: ProjectStorage;
  
  // プロジェクト情報へのアクセスポイントを一元化
  public getActiveProject(): Project {
    return this.storage.getActiveProject();
  }
  
  // ファイルパス取得を集約
  public getProjectFilePath(fileType: 'progress' | 'requirements' | string, projectId?: string): string {
    const project = projectId ? this.getProject(projectId) : this.getActiveProject();
    if (!project) return '';
    
    switch (fileType) {
      case 'progress':
        return path.join(project.path, 'docs', 'SCOPE_PROGRESS.md');
      case 'requirements':
        return path.join(project.path, 'docs', 'requirements.md');
      // 他のファイルタイプも同様に
    }
  }
  
  // WebViewからのメッセージを直接処理
  public handleWebViewMessage(message: any): any {
    switch (message.command) {
      case 'getActiveProjectPath':
        return this.getActiveProject()?.path || '';
      case 'getProgressFilePath':
        return this.getProjectFilePath('progress');
      // 他のコマンドも同様に
    }
  }
}
```

### 2. 標準化されたWebView通信インターフェース

```typescript
// 新規: 単一のメッセージングプロトコル
export const ProjectAPICommands = {
  // プロジェクト情報取得
  GET_ACTIVE_PROJECT: 'getActiveProject',
  GET_PROJECT_PATH: 'getActiveProjectPath',
  GET_PROJECT_FILE: 'getProjectFile',
  
  // ファイルアクセス
  LIST_DIRECTORY: 'listDirectory',
  READ_FILE: 'readFile',
  
  // プロジェクト操作
  SELECT_PROJECT: 'selectProject',
  REMOVE_PROJECT: 'removeProject',
  CREATE_PROJECT: 'createProject'
};
```

## 削除によるメリット

1. **コードサイズの削減**: 冗長なコードの除去により、コードベース全体が30%以上削減
2. **バグの減少**: 複数の真実源による同期問題が根本的に解消
3. **メンテナンス性の向上**: 単一の責任源により変更が容易に
4. **パフォーマンスの向上**: 不要な状態同期処理の削減
5. **拡張性の向上**: 新機能追加が単一箇所での変更で済む

## 実装ステップ

1. **撤去フェーズ**
   - クライアント側の状態管理コード完全削除
   - 重複するパス管理ロジックの削除
   - 冗長なイベント処理の削除

2. **構築フェーズ**
   - `ProjectManager`の実装
   - 標準化されたメッセージングインターフェースの実装
   - WebView側の最小限のラッパー実装

3. **導入フェーズ**
   - 新しいAPIを使用するようにすべてのコンポーネントを更新
   - 各コンポーネントからプロジェクト状態管理コードを完全削除

## 注意事項

- **後方互換性なし**: 古いコードは完全に削除し、新しいアプローチに一斉移行します
- **完全なリプレース**: 部分的な修正ではなく、関連コードの完全な書き換えを行います
- **テスト重視**: 機能ごとに段階的にテストを行い、完全に機能することを確認します

## 削除による影響のないことの確認方法

各機能の実装後、以下を確認します：

1. プロジェクト一覧が正常に表示される
2. プロジェクト選択が正常に機能する
3. ファイルブラウザがプロジェクトのファイルを表示できる
4. タブ管理が正常に機能する
5. 進捗状況ファイルが正常に表示・編集できる