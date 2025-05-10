# AppGenius プロジェクト状態管理リファクタリング計画書

## 1. 現状分析と課題

### 1.1 重複状態管理の問題点

詳細な調査の結果、以下の重複状態管理の問題が特定されました：

1. **同一情報の複数箇所での管理**
   - プロジェクトパス：最低4箇所で個別に管理（ProjectManagementService, ProjectServiceImpl, stateManager.js, fileBrowser.js）
   - アクティブプロジェクト情報：3箇所で重複管理（ProjectManagementService, ProjectServiceImpl, stateManager.js）
   - ファイルパス構築ロジック：各コンポーネントで独自実装（FileSystemServiceImpl, fileBrowser.js, tabManager.js）

2. **状態同期の不完全性**
   - プロジェクト切り替え時に一部の状態だけが更新され、古い参照が残存
   - キャッシュなどの補助的な状態がクリアされない
   - 各コンポーネントがそれぞれ独自のタイミングで更新処理を実行

3. **信頼できる情報源の曖昧さ**
   - バックエンド/VSCode拡張（ProjectManagementService）とフロントエンド/WebView（stateManager.js）のどちらが信頼すべき情報源か明確でない
   - 呼び出しの流れが複雑で追跡困難（特にメッセージングを介した非同期処理）

## 2. シングルソースオブトゥルース（単一の真実源）の確立

### 2.1 信頼できる情報源の明確化

| 情報カテゴリ | 現在の管理場所 | 主な情報源として指定 | 削除/委譲対象 |
|------------|--------------|-------------------|------------|
| プロジェクト情報 | ProjectManagementService<br>ProjectServiceImpl<br>stateManager.js | **ProjectManagementService** | ProjectServiceImplの内部状態<br>stateManager.jsの重複状態 |
| ファイルパス | FileSystemServiceImpl<br>fileBrowser.js<br>tabManager.js | **ProjectManagementService** | FileSystemServiceImplの直接構築<br>WebView側の各構築ロジック |
| UI状態 | stateManager.js<br>tabManager.js<br>各UIコンポーネント | **stateManager.js** | コンポーネント内部の重複状態<br>直接DOM操作による状態管理 |
| キャッシュ | FileSystemServiceImpl<br>fileBrowser.js | **明示的な設計なし→新設計** | 分散したキャッシュロジック |

### 2.2 状態管理の責任分担

1. **バックエンド（VSCode拡張）側**
   - `ProjectManagementService`: **すべてのプロジェクト情報とファイルパス管理を一元化**
     - プロジェクト情報（基本データ、パス、ID）の管理
     - ファイルパス構築の中央管理（getProjectFilePath メソッド）
     - イベント発行とメッセージング機能の提供

2. **フロントエンド（WebView）側**
   - `stateManager.js`: **WebView側の状態管理を一元化**
     - VSCode拡張からの情報受信と保持
     - UI状態の一元管理（タブ、表示内容など）
     - 各UIコンポーネントへの状態変更通知

## 3. 具体的な削除・委譲対象

### 3.1 削除対象の重複状態

1. **ProjectServiceImpl** から削除：
   ```typescript
   // 削除対象の内部状態変数
   private _projectPath: string = '';
   private _progressFilePath: string = '';
   private _currentProjects: IProjectInfo[] = [];
   private _activeProject: IProjectInfo | null = null;
   
   // 削除対象のメソッド
   public getActiveProjectPath(): string
   public getProgressFilePath(): string
   public getRequirementsFilePath(): string
   public setActiveProject(projectId: string): Promise<void>
   ```

2. **FileSystemServiceImpl** から削除：
   ```typescript
   // 削除対象のパス構築メソッド
   public getProgressFilePath(projectPath?: string): string
   private _readDirectoryStructure(dirPath: string): Promise<any>
   ```

3. **stateManager.js** から削除：
   ```javascript
   // 削除対象の重複状態
   this.state = {
     activeProjectName: null,     // 削除
     activeProjectPath: null,     // 削除（リネーム: currentProjectPath → activeProjectPath）
     lastSyncedProjectId: null,   // 削除
   };
   
   // 削除対象のメソッド
   syncProjectState(project) { /* 削除 */ }
   restoreProjectState() { /* 削除 */ }
   ```

4. **fileBrowser.js** から削除：
   ```javascript
   // 削除対象の内部パス管理
   _directoryCache = new Map();
   currentPath = null;
   _defaultDirectory = 'docs';
   
   // 削除対象のパス処理メソッド
   _normalizePath(path)
   _extractPathFromStructure(structureJson)
   ```

5. **tabManager.js** から削除：
   ```javascript
   // 削除対象のパス構築
   const progressFilePath = `${stateManager.getState().activeProjectPath}/docs/SCOPE_PROGRESS.md`;
   // ↑ すべて stateManager.getProjectFilePath('progress') に置き換え
   ```

### 3.2 委譲先の実装（追加/修正するコード）

1. **ProjectManagementService** に追加：
   ```typescript
   // プロジェクト情報の一元管理
   public getActiveProjectPath(): string {
     const activeProject = this.getActiveProject();
     return activeProject ? activeProject.path : '';
   }
   
   // 統一されたパス取得メソッド
   public getProjectFilePath(fileType: string, projectId?: string): string {
     const project = projectId ? this.getProject(projectId) : this.getActiveProject();
     if (!project) return '';
     
     // シンプルなマッピング辞書
     const pathMappings: Record<string, string> = {
       'progress': path.join(project.path, 'docs', 'SCOPE_PROGRESS.md'),
       'requirements': path.join(project.path, 'docs', 'requirements.md'),
       'mockups': path.join(project.path, 'mockups'),
       'docs': path.join(project.path, 'docs'),
       // 他のファイルタイプも必要に応じて追加
     };
     
     return pathMappings[fileType] || '';
   }
   
   // プロジェクト切り替え通知メソッド
   private notifyProjectChange(project: Project): void {
     // イベントバスを通じて通知
     this._eventBus.emit(AppGeniusEventType.PROJECT_CHANGED, project, 'ProjectManagementService');
     
     // VSCode UI側にメッセージ送信
     this._messageBroker.sendMessage({
       command: 'projectChanged',
       project: project
     });
   }
   ```

2. **stateManager.js** に追加：
   ```javascript
   // プロジェクト切り替え処理の一元化
   async selectProject(projectId) {
     try {
       // VSCode拡張側に切り替えリクエスト
       const project = await this.sendRequest('selectProject', { projectId });
       if (project) {
         // プロジェクト切り替え時の状態リセットを明示的に実行
         this._resetState(project.path);
         
         // プロジェクト更新イベントを発行
         document.dispatchEvent(new CustomEvent('project-updated', {
           detail: { project, forceRefresh: true }
         }));
         
         return true;
       }
       return false;
     } catch (error) {
       console.error('プロジェクト切り替え失敗:', error);
       return false;
     }
   }
   
   // 状態リセット処理の一元化
   _resetState(newProjectPath) {
     console.log(`StateManager: 状態リセット - 新プロジェクトパス: ${newProjectPath}`);
     
     // プロジェクト特有の状態をリセット
     const cleanState = {
       // プロジェクト関連
       activeProjectPath: newProjectPath,
       lastRequestedProgressFile: null,
       
       // ファイルコンテンツ
       scopeProgressContent: null,
       scopeProgressMarkdown: null,
       requirementsContent: null,
       
       // キャッシュデータ
       fileCache: {},
     };
     
     // 状態更新を通知
     this.setState(cleanState, true);
     
     // プロジェクト切り替えイベントを発行
     document.dispatchEvent(new CustomEvent('project-switching', {
       detail: { projectPath: newProjectPath }
     }));
   }
   ```

3. **FileSystemServiceImpl** に追加：
   ```typescript
   // ProjectManagementServiceへの委譲メソッド
   public getProgressFilePath(projectPath?: string): string {
     // 直接パスが指定された場合のみ独自実装を使用
     if (projectPath) {
       return path.join(projectPath, 'docs', 'SCOPE_PROGRESS.md');
     }
     
     // それ以外はProjectManagementServiceに委譲
     return this._projectManagementService.getProjectFilePath('progress');
   }
   ```

## 4. 技術的実装ステップ

### 4.1 バックエンド（VSCode拡張）側の実装

1. **ProjectManagementService の拡張 (優先度: 最高)**
   - 中央パス管理関数の実装
   - 通知メカニズムの強化
   - ProjectServiceImpl との依存関係の逆転

2. **ProjectServiceImpl の修正 (優先度: 高)**
   - 内部状態の削除
   - ProjectManagementService への委譲実装
   - 既存メソッドの互換性維持

3. **FileSystemServiceImpl の修正 (優先度: 中)**
   - パス管理の委譲実装
   - 存在チェックなどの基本機能は維持

4. **メッセージディスパッチャーの強化 (優先度: 中)**
   - プロジェクト切り替えメッセージの改善
   - イベント順序の管理と保証

### 4.2 フロントエンド（WebView）側の実装

1. **stateManager.js の強化 (優先度: 最高)**
   - 状態リセットロジックの実装
   - プロジェクト切り替えフローの中央管理
   - キャッシュ管理の一元化

2. **各コンポーネントの修正 (優先度: 高)**
   - fileBrowser.js: 内部状態の削除と委譲
   - tabManager.js: パス参照の委譲
   - その他コンポーネント: 状態参照の一貫化

3. **イベント伝搬の最適化 (優先度: 中)**
   - 標準化されたイベント名と構造
   - 一貫した伝搬順序の確立

## 5. 移行戦略

### 5.1 直接削除アプローチ

以下の順序で重複コードを直接削除し、委譲パターンに置き換えます：

1. **フェーズ1: 中央管理機能の実装**
   - ProjectManagementService と stateManager.js に新機能を即時実装
   - 既存コードで冗長な部分をすぐに削除する

2. **フェーズ2: 重複コードの削除と委譲の同時実施**
   - 重複コードを削除しながら、新しい中央管理機能への参照に置き換え
   - 全ての変更を一度に適用（ビッグバンアプローチ）

3. **フェーズ3: リファクタリング検証**
   - リファクタリング後の動作確認
   - 問題があれば直ちに修正

### 5.2 主なリスクと対策

| リスク | 発生確率 | 影響度 | 対策 |
|-------|---------|-------|-----|
| 参照切れによる機能停止 | 高 | 高 | 全体的な動作テストの徹底実施 |
| プロジェクト切り替え時の整合性問題 | 高 | 高 | 明示的なリセット処理の実装 |
| 予期せぬ副作用 | 中 | 高 | 包括的なテストケースの準備 |

## 6. 実装タスクリスト

### 6.1 ProjectManagementService の強化

- [ ] **タスク6.1.1:** 統一パス取得メソッドの実装
- [ ] **タスク6.1.2:** プロジェクト切り替え通知メカニズムの強化
- [ ] **タスク6.1.3:** 状態保持の最適化（必要最小限の情報のみ保持）

### 6.2 ProjectServiceImpl の修正

- [ ] **タスク6.2.1:** 内部状態変数の削除
- [ ] **タスク6.2.2:** 全メソッドのProjectManagementServiceへの委譲
- [ ] **タスク6.2.3:** 既存コードの参照箇所の修正

### 6.3 stateManager.js の強化

- [ ] **タスク6.3.1:** プロジェクト固有の状態リセットメカニズムの追加
- [ ] **タスク6.3.2:** パス管理の中央化（パス構築ロジックの削除）
- [ ] **タスク6.3.3:** イベント発行メカニズムの標準化

### 6.4 UI コンポーネントの修正

- [ ] **タスク6.4.1:** fileBrowser.js の内部キャッシュ削除
- [ ] **タスク6.4.2:** tabManager.js のパス参照修正
- [ ] **タスク6.4.3:** 各コンポーネントの状態取得統一

## 7. 期待される成果

1. **単一の真実源の確立**
   - プロジェクト情報: ProjectManagementService
   - UI状態: stateManager.js

2. **重複コードの削減**
   - パス構築ロジックの削減率: 約80%
   - 状態管理重複の削減率: 約70%

3. **信頼性の向上**
   - プロジェクト切り替え時のエラー発生率: ほぼゼロに
   - 不整合状態の発生可能性: 大幅減少

4. **メンテナンス性の向上**
   - コード理解の容易さ増加
   - 機能追加時の変更箇所の明確化

## 8. コード修正例

### 8.1 ProjectServiceImpl の修正例

**修正前:**
```typescript
export class ProjectServiceImpl implements IProjectService {
  private _projectPath: string = '';
  private _progressFilePath: string = '';
  private _currentProjects: IProjectInfo[] = [];
  private _activeProject: IProjectInfo | null = null;
  
  public getActiveProjectPath(): string {
    return this._projectPath;
  }
  
  public getProgressFilePath(): string {
    if (this._progressFilePath) {
      return this._progressFilePath;
    }
    
    if (this._projectPath) {
      return path.join(this._projectPath, 'docs', 'SCOPE_PROGRESS.md');
    }
    
    return '';
  }
}
```

**修正後:**
```typescript
export class ProjectServiceImpl implements IProjectService {
  private _projectManagementService: ProjectManagementService;
  
  constructor() {
    this._projectManagementService = ProjectManagementService.getInstance();
  }
  
  public getActiveProjectPath(): string {
    return this._projectManagementService.getActiveProjectPath();
  }
  
  public getProgressFilePath(): string {
    return this._projectManagementService.getProjectFilePath('progress');
  }
}
```

### 8.2 stateManager.js の修正例

**修正前:**
```javascript
class StateManager {
  constructor() {
    this.state = {
      activeProjectName: null,
      activeProjectPath: null,
      lastSyncedProjectId: null,
      activeTab: 'scope-progress'
    };
  }
  
  syncProjectState(project) {
    if (!project) return;
    
    this.setState({
      activeProjectName: project.name,
      activeProjectPath: project.path,
      lastSyncedProjectId: project.id
    });
  }
  
  restoreProjectState() {
    // 複雑なプロジェクト状態の復元ロジック
  }
}
```

**修正後:**
```javascript
class StateManager {
  constructor() {
    this.state = {
      activeTab: 'scope-progress',
      activeProjectPath: null // 単一の参照ポイント
    };
  }
  
  _resetState(newProjectPath) {
    console.log(`StateManager: 状態リセット - 新プロジェクトパス: ${newProjectPath}`);
    
    // プロジェクト特有の状態をリセット
    const cleanState = {
      activeProjectPath: newProjectPath,
      lastRequestedProgressFile: null,
      scopeProgressContent: null,
      scopeProgressMarkdown: null,
      requirementsContent: null,
      fileCache: {},
    };
    
    this.setState(cleanState, true);
    
    document.dispatchEvent(new CustomEvent('project-switching', {
      detail: { projectPath: newProjectPath }
    }));
  }
  
  async getProjectPath() {
    try {
      if (this.state.activeProjectPath) {
        return this.state.activeProjectPath;
      }
      
      return await this.sendRequest('getActiveProjectPath');
    } catch (error) {
      console.error('Project path request failed:', error);
      return '';
    }
  }
}
```

## 9. タイムライン

| フェーズ | 予想所要時間 | 主要タスク |
|---------|-------------|----------|
| 分析・計画 | 4時間 | 重複コードの特定、影響範囲の分析 |
| 中央機能実装 | 8時間 | ProjectManagementServiceとstateManagerの強化 |
| 重複コード削除と委譲実装 | 12時間 | 各コンポーネントの修正と参照先変更 |
| テスト | 8時間 | 単体テスト、機能テスト、統合テスト |
| ドキュメント | 4時間 | 変更内容の文書化と今後の拡張ガイドライン |

**合計見積時間: 36時間**

---

この計画書は、重複状態管理の問題を直接的かつ抜本的に解決するためのアプローチを提供します。新旧コードの共存段階を省略し、一元管理への直接移行を前提としています。プロジェクト全体の保守性と拡張性を大幅に向上させる変更となります。