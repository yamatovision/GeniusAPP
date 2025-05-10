# プロジェクトパス管理リファクタリング: 改訂実装計画

## 概要

「削除と単純化」を基本方針として、プロジェクトパス管理の単一情報源化と重複コードの徹底排除を目指します。新規ファイルの作成を避け、既存の中心的サービスを拡張することで、より効率的な実装を実現します。

## 方針変更ポイント

1. 新規ファイル作成（ProjectManager.ts, ProjectPathUtils.ts）を行わず、既存の`ProjectManagementService`を拡張
2. WebView側でも新規ファイル（projectClient.js）を作成せず、既存の`stateManager.js`を拡張
3. 状態の「単一の真実源」をサーバー側の`ProjectManagementService`に一元化

## 削除対象の特定

### 1. 冗長な状態管理

#### 1.1 `ProjectServiceImpl`内の重複状態

```typescript
// 削除対象の内部状態管理
private _projectPath: string = '';
private _progressFilePath: string = '';
private _currentProjects: IProjectInfo[] = [];
private _activeProject: IProjectInfo | null = null;

// 削除対象のゲッター/セッター
public getActiveProjectPath(): string {
  return this._projectPath;
}

public getProgressFilePath(): string {
  // 冗長なロジック
}
```

#### 1.2 `stateManager.js`の冗長な状態

```javascript
// 削除対象のプロジェクト関連状態
this.state = {
  activeProjectName: null,  // 削除
  activeProjectPath: null,  // 削除
  lastSyncedProjectId: null,  // 削除
  
  // UIの状態のみ保持
  activeTab: 'scope-progress'  // 維持
};

// 削除対象メソッド
syncProjectState(project) { /* 削除 */ }
restoreProjectState() { /* 削除 */ }
```

### 2. 分散したパス操作ロジック

#### 2.1 `FileSystemServiceImpl`のパス操作

```typescript
// 削除対象の重複パス操作
getProgressFilePath(projectPath: string): string {
  return path.join(projectPath, 'docs', 'SCOPE_PROGRESS.md');
}

// 他のパス操作メソッドも同様に削除
```

#### 2.2 WebViewコンポーネントのパス操作

```javascript
// fileBrowser.js、tabManager.js、projectNavigation.jsなど
// 削除: ハードコードされたパス構築ロジック
const progressFilePath = `${project.path}/docs/SCOPE_PROGRESS.md`;
```

## 実装タスクリスト

### フェーズ1: サーバー側の拡張と整理

#### 1.1 `ProjectManagementService`の拡張

**優先度: 最高**

- [ ] **タスク1.1.1:** プロジェクトパス関連のメソッドを追加
  ```typescript
  // ProjectManagementService.ts に追加
  
  // プロジェクトパス関連メソッド
  public getActiveProjectPath(): string {
    const activeProject = this.getActiveProject();
    return activeProject ? activeProject.path : '';
  }
  
  // ファイルタイプに応じたパス取得メソッド（拡張可能）
  public getProjectFilePath(fileType: string, projectId?: string): string {
    const project = projectId ? this.getProject(projectId) : this.getActiveProject();
    if (!project) return '';
    
    // 名前でスイッチするのではなく、マッピング辞書を使用
    const pathMappings: Record<string, string> = {
      'progress': path.join(project.path, 'docs', 'SCOPE_PROGRESS.md'),
      'requirements': path.join(project.path, 'docs', 'requirements.md'),
      'mockups': path.join(project.path, 'mockups'),
      'docs': path.join(project.path, 'docs'),
    };
    
    return pathMappings[fileType] || '';
  }
  
  // パス正規化ユーティリティ
  public normalizePath(inputPath: string): string {
    // パス正規化の実装
    return path.normalize(inputPath).replace(/\\/g, '/');
  }
  
  // プロジェクト内のパスかチェック
  public isPathInProject(testPath: string, projectId?: string): boolean {
    const projectPath = projectId 
      ? this.getProject(projectId)?.path 
      : this.getActiveProjectPath();
      
    if (!projectPath || !testPath) return false;
    return this.normalizePath(testPath).startsWith(this.normalizePath(projectPath));
  }
  ```

- [ ] **タスク1.1.2:** WebViewメッセージング対応メソッドを追加
  ```typescript
  // ProjectManagementService.ts に追加
  
  // WebViewメッセージ処理メソッド
  public handleProjectMessage(message: any): any {
    const { command, projectId } = message;
    
    switch (command) {
      case 'getActiveProject':
        return this.getActiveProject();
        
      case 'getActiveProjectPath':
        return this.getActiveProjectPath();
        
      case 'getProjectFilePath':
        return this.getProjectFilePath(message.fileType, projectId);
        
      case 'listProjectFiles':
        const dirPath = message.directory || this.getProjectFilePath('docs', projectId);
        // ファイルリスト取得処理...
        return fileList;
        
      // 他のコマンド...
    }
  }
  ```

#### 1.2 `ProjectServiceImpl`の整理

**優先度: 高**

- [ ] **タスク1.2.1:** 内部状態変数を削除
  ```typescript
  // 以下の変数を削除
  private _projectPath: string = '';
  private _progressFilePath: string = '';
  private _currentProjects: IProjectInfo[] = [];
  private _activeProject: IProjectInfo | null = null;
  ```

- [ ] **タスク1.2.2:** すべてのメソッドを`ProjectManagementService`に委譲
  ```typescript
  // ProjectServiceImpl.ts 内のメソッド書き換え
  
  public getActiveProject(): IProjectInfo | null {
    return this._projectManagementService.getActiveProject();
  }
  
  public getActiveProjectPath(): string {
    return this._projectManagementService.getActiveProjectPath();
  }
  
  public getProgressFilePath(): string {
    return this._projectManagementService.getProjectFilePath('progress');
  }
  
  public setActiveProject(projectId: string): Promise<void> {
    return this._projectManagementService.setActiveProject(projectId);
  }
  ```

#### 1.3 `FileSystemServiceImpl`の整理

**優先度: 中**

- [ ] **タスク1.3.1:** パス関連メソッドを削除または委譲
  ```typescript
  // 以下のようなメソッドを削除または委譲
  
  // 削除: ProjectManagementServiceの同等メソッドを使用
  getProgressFilePath(projectPath: string): string {
    // 削除
  }
  
  // 変更: ProjectManagementServiceを使用
  async createProgressFile(projectPath: string): Promise<boolean> {
    const progressFilePath = this._projectManagementService.getProjectFilePath('progress');
    // 以降の処理...
  }
  ```

### フェーズ2: WebView側の拡張と整理

#### 2.1 `stateManager.js`の拡張と整理

**優先度: 高**

- [ ] **タスク2.1.1:** プロジェクト情報の状態を削除
  ```javascript
  // 削除対象の状態
  this.state = {
    activeProjectName: null,     // 削除
    activeProjectPath: null,     // 削除
    lastSyncedProjectId: null,   // 削除
    // UIの状態のみ保持
    activeTab: 'scope-progress'  // 維持
  };
  ```

- [ ] **タスク2.1.2:** VSCode拡張とのメッセージング関数を追加
  ```javascript
  // stateManager.js に追加
  
  // VSCode拡張に現在のプロジェクトパスを要求
  async getProjectPath() {
    const response = await this.sendRequest('getActiveProjectPath');
    return response || '';
  }
  
  // VSCode拡張にファイルパスを要求
  async getProjectFilePath(fileType) {
    const response = await this.sendRequest('getProjectFilePath', {
      fileType
    });
    return response || '';
  }
  
  // 進捗状況ファイルパスを取得
  async getScopeProgressPath() {
    return this.getProjectFilePath('progress');
  }
  
  // ドキュメントフォルダのパスを取得
  async getDocsPath() {
    return this.getProjectFilePath('docs');
  }
  
  // プロジェクト選択
  async selectProject(projectId) {
    return this.sendRequest('selectProject', { projectId });
  }
  ```

- [ ] **タスク2.1.3:** 削除対象の同期メソッド
  ```javascript
  // 削除対象メソッド
  syncProjectState(project) { /* 削除 */ }
  restoreProjectState() { /* 削除 */ }
  ```

#### 2.2 WebViewコンポーネントのリファクタリング

**優先度: 高**

- [ ] **タスク2.2.1:** `projectNavigation.js`の修正
  ```javascript
  // 削除: プロジェクト情報の内部保存
  updateProjects(projects, activeProject) {
    // 削除: プロジェクト情報をstateManagerに保存する処理
    
    // 維持: 表示処理のみ
  }
  
  // 修正: プロジェクト選択
  selectProject(projectId) {
    // 削除: 直接パスを構築する処理
    
    // 新: stateManagerを介した処理
    stateManager.selectProject(projectId)
      .then(() => {
        // UI更新
      });
  }
  ```

- [ ] **タスク2.2.2:** `fileBrowser.js`の修正
  ```javascript
  // 削除: 内部パス管理
  constructor() {
    // 削除
    this.currentPath = null;
    this._directoryCache = new Map();
    
    // 維持: UI関連のみ
  }
  
  // 修正: ディレクトリ一覧取得
  async _loadDirectory(dirPath) {
    // 削除: パス構築処理
    
    // 新: stateManagerを介した処理
    const files = await stateManager.sendRequest('listDirectory', {
      path: dirPath
    });
    
    // 以降の処理...
  }
  ```

- [ ] **タスク2.2.3:** `tabManager.js`の修正
  ```javascript
  // 修正: タブ選択処理
  async selectTab(tabId) {
    // 削除: ハードコードされたパス構築
    
    // 新: stateManagerを介した処理
    if (tabId === 'scope-progress') {
      const progressPath = await stateManager.getScopeProgressPath();
      stateManager.sendMessage('getMarkdownContent', {
        filePath: progressPath,
        forScopeProgress: true
      });
    }
    
    // タブ状態更新
    this.activeTab = tabId;
    // 以降の処理...
  }
  ```

### フェーズ3: メッセージングの標準化

#### 3.1 メッセージ処理の集約

**優先度: 中**

- [ ] **タスク3.1.1:** MessageDispatchServiceのプロジェクト関連処理を改善
  ```typescript
  // MessageDispatchServiceImpl
  
  // 変更: プロジェクト関連メッセージの処理を集約
  case 'getActiveProject':
  case 'getActiveProjectPath':
  case 'getProjectFilePath':
  case 'selectProject':
  case 'listProjectFiles':
    // ProjectManagementServiceに集約
    return this._projectManagementService.handleProjectMessage(message);
  ```

#### 3.2 イベントシステムの簡素化

**優先度: 低**

- [ ] **タスク3.2.1:** プロジェクト関連イベントの統合
  ```typescript
  // 複数のイベントタイプを単一のPROJECT_CHANGEDに統合
  
  // 削除対象
  AppGeniusEventType.PROJECT_CREATED  // 統合
  AppGeniusEventType.PROJECT_REMOVED  // 統合
  AppGeniusEventType.PROJECT_SELECTED // 統合
  
  // 代替: 詳細はペイロードで区別
  eventBus.emit(AppGeniusEventType.PROJECT_CHANGED, {
    type: 'created', // 'removed', 'selected'などのタイプで区別
    projectId,
    // 他の情報...
  });
  ```

### フェーズ4: テストと統合

#### 4.1 単体テスト

**優先度: 高**

- [ ] **タスク4.1.1:** ProjectManagementService拡張機能のテスト作成
- [ ] **タスク4.1.2:** パス操作の正確性テスト
- [ ] **タスク4.1.3:** WebViewメッセージング処理のテスト

#### 4.2 統合テスト

**優先度: 最高**

- [ ] **タスク4.2.1:** プロジェクト一覧表示テスト
- [ ] **タスク4.2.2:** プロジェクト選択テスト
- [ ] **タスク4.2.3:** ファイル操作テスト
- [ ] **タスク4.2.4:** タブ管理テスト

### フェーズ5: コード削除と整理

**優先度: 中**

- [ ] **タスク5.1.1:** 使用されなくなったコードの削除確認
- [ ] **タスク5.1.2:** コメントの更新と機能説明の追加
- [ ] **タスク5.1.3:** 残存する重複コードの最終検証

## 変更対象コード一覧

### サーバー側（拡張）

1. `src/services/ProjectManagementService.ts`
   - パス管理メソッドの追加
   - WebViewメッセージ処理の集約

### サーバー側（削除・委譲）

1. `src/ui/scopeManager/services/ProjectServiceImpl.ts`
   - 内部状態変数の削除
   - パス管理を委譲

2. `src/ui/scopeManager/services/FileSystemServiceImpl.ts`
   - パス関連メソッドの委譲

3. `src/services/MessageDispatchServiceImpl.ts`
   - プロジェクト関連処理を集約

### クライアント側（拡張）

1. `media/state/stateManager.js`
   - パス関連メソッドの追加
   - プロジェクト関連APIの追加

### クライアント側（削除・委譲）

1. `media/components/projectNavigation/projectNavigation.js`
   - 独自状態管理の削除
   - stateManagerへの委譲

2. `media/components/fileBrowser/fileBrowser.js`
   - パスキャッシュの削除
   - パス構築・正規化の委譲

3. `media/components/tabManager/tabManager.js`
   - パス構築の委譲

## 測定可能な改善目標

1. **コードの削減**: プロジェクトパス関連コードを約40%削減
2. **状態管理の簡素化**: 状態管理箇所を8箇所から1箇所に削減
3. **バグ発生リスクの低減**: パスの扱いに関連するエッジケースを集中管理
4. **開発効率の向上**: 新機能開発時の実装時間を20%短縮

## 実装スケジュール目安

| フェーズ | 見積時間 | 依存関係 |
|---------|----------|----------|
| 1       | 6-8時間  | なし |
| 2       | 8-10時間 | フェーズ1完了後 |
| 3       | 2-3時間  | フェーズ1,2並行可 |
| 4       | 4-6時間  | フェーズ1-3完了後 |
| 5       | 2-3時間  | フェーズ4完了後 |

**合計見積時間: 22-30時間**

## ロールバック計画

変更を段階的に実施し、各ステップで機能テストを行います。問題発生時は、変更をコミットせずに元のコードに戻します。