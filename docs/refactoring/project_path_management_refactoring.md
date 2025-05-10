# プロジェクトパス管理システムのリファクタリング計画

## 現状分析

現在のAppGeniusにおけるプロジェクトパス管理には、複数の情報源と管理方法が混在しており、これがUI挙動の不整合やバグの原因となっています。

### 現在の情報源

1. **サーバー側（VSCode拡張側）**
   - `ProjectManagementService`: プロジェクト情報の永続化と管理
   - `ProjectServiceImpl`: 個別のプロジェクト情報とパス管理

2. **クライアント側（WebView）**
   - `stateManager.js`: WebView間で共有される状態管理
   - 各コンポーネント内の独自状態管理:
     - `projectNavigation.js`: プロジェクト一覧表示と選択
     - `fileBrowser.js`: ファイル一覧表示とパス管理
     - `tabManager.js`: タブ状態管理とプロジェクトパス参照
     - `scopeManager.js`: 進捗状況表示とパス管理

### 問題点

1. **複数の真実源**
   - サーバー側とクライアント側で状態が二重管理されている
   - クライアント側でもコンポーネントごとに独自の状態管理が存在

2. **同期の複雑さ**
   - プロジェクト切り替え時に複数の同期処理が発生
   - 同期タイミングの問題によるバグ発生リスク

3. **パス処理の非統一性**
   - パス結合や正規化のロジックが分散
   - 絶対パスと相対パスの変換が複数の場所に存在

4. **コンポーネント間の密結合**
   - 他コンポーネントの内部実装に依存したコード

## リファクタリング目標

「単一の真実源」の原則に基づき、プロジェクト情報の管理を一元化し、シンプルかつ堅牢なシステムを構築します。

## リファクタリング計画

### 1. サーバー側（VSCode拡張側）の改善

#### 1.1 `ProjectManagementService`の強化

```typescript
// 単一の真実源としての役割強化
export class ProjectManagementService {
  // 既存コード...

  // 共通のプロジェクトパス取得メソッド
  public getActiveProjectPath(): string {
    const activeProject = this.getActiveProject();
    return activeProject ? activeProject.path : '';
  }
  
  // プロジェクト関連のパス取得メソッド集約
  public getProjectDocumentsPath(projectId?: string): string {
    const project = projectId ? this.getProject(projectId) : this.getActiveProject();
    return project ? path.join(project.path, 'docs') : '';
  }
  
  public getProjectScopeProgressPath(projectId?: string): string {
    const docsPath = this.getProjectDocumentsPath(projectId);
    return docsPath ? path.join(docsPath, 'SCOPE_PROGRESS.md') : '';
  }
  
  // その他必要なプロジェクトパス関連メソッド
}
```

#### 1.2 `ProjectServiceImpl`の役割再定義

```typescript
export class ProjectServiceImpl implements IProjectService {
  // メソッドをProjectManagementServiceに委譲
  public getActiveProjectPath(): string {
    return this._projectManagementService.getActiveProjectPath();
  }
  
  public getProgressFilePath(): string {
    return this._projectManagementService.getProjectScopeProgressPath();
  }
  
  // UIとのインターフェースに特化
  // 内部実装はすべてProjectManagementServiceに委譲
}
```

### 2. クライアント側（WebView）の改善

#### 2.1 WebViewとVSCode拡張間の通信標準化

```typescript
// 標準化されたメッセージングインターフェース
const ProjectCommands = {
  GET_ACTIVE_PROJECT: 'getActiveProject',
  GET_PROJECT_PATH: 'getProjectPath',
  SELECT_PROJECT: 'selectProject',
  GET_PROJECT_FILES: 'getProjectFiles'
};

// 実装例
function getActiveProjectPath() {
  return new Promise((resolve) => {
    const requestId = Date.now().toString();
    pendingRequests.set(requestId, resolve);
    
    vscode.postMessage({
      command: ProjectCommands.GET_PROJECT_PATH,
      requestId
    });
  });
}
```

#### 2.2 クライアント側の状態管理簡素化

`stateManager.js`の役割をUIキャッシュに限定し、真のプロジェクト情報はVSCode側に問い合わせる形に変更：

```javascript
// stateManager.js 改善版
class StateManager {
  constructor() {
    this.uiState = { activeTab: 'scope-progress' };
    this.cache = { projectPath: null };
  }
  
  // キャッシュされたプロジェクトパスを取得するが、
  // 常に最初に実際のパスと比較して必要なら更新
  async getProjectPath() {
    // 毎回VSCode側に問い合わせる
    const response = await this.sendRequest('getProjectPath');
    
    // キャッシュを更新
    if (response && this.cache.projectPath !== response) {
      this.cache.projectPath = response;
    }
    
    return this.cache.projectPath;
  }
  
  // UIの表示状態のみを管理
  setActiveTab(tabId) {
    this.uiState.activeTab = tabId;
    // タブIDをVSCode側に保存（プロジェクトメタデータとして）
    this.sendMessage('saveTabState', { tabId });
  }
}
```

#### 2.3 各コンポーネントの改善

**projectNavigation.js**:
- プロジェクト選択時に直接VSCodeにリクエストを送信
- プロジェクト一覧表示もVSCodeからの一元的なデータ取得に変更

**fileBrowser.js**:
- ディレクトリリストの取得をすべてVSCode側に委譲
- パス管理のロジックを削除し、コマンド送信に特化

**tabManager.js**:
- プロジェクトパスの参照は常にVSCode側に問い合わせる
- タブ選択状態のみをローカルで管理

### 3. 実装計画

#### フェーズ1: サーバー側の整理

1. `ProjectManagementService`にパス取得メソッドを集約
2. `ProjectServiceImpl`を仲介役として再定義
3. 共通のパス管理ユーティリティを作成

#### フェーズ2: 通信インターフェースの標準化

1. クライアント-サーバー間の標準メッセージフォーマット定義
2. 非同期リクエスト-レスポンスシステムの構築

#### フェーズ3: クライアント側実装の置き換え

1. 各コンポーネント内のパス管理コードを標準インターフェースに置き換え
2. クライアント側の冗長な状態管理を削除

#### フェーズ4: テストと最適化

1. 全機能のエンドツーエンドテスト
2. エッジケースの検証
3. パフォーマンス最適化（必要に応じてキャッシュ戦略導入）

## 期待される効果

1. **コードの簡素化**: データフローが明確になり、コードの理解と保守が容易に
2. **バグの削減**: 二重管理によるデータ不整合の問題が解消
3. **拡張性の向上**: 新機能追加時も統一されたインターフェースで実装可能
4. **一貫性のあるUX**: すべてのコンポーネントが同じプロジェクト情報に基づいて動作

## リスクと軽減策

1. **後方互換性**: 既存の実装に依存したコードに影響が出る可能性
   - 軽減策: 段階的な移行と十分なテスト

2. **パフォーマンス**: サーバーへの問い合わせが増える可能性
   - 軽減策: 適切なキャッシュ戦略の導入

3. **実装の複雑さ**: リファクタリング自体が複雑になる可能性
   - 軽減策: 明確なフェーズ分けと各フェーズ後のテスト