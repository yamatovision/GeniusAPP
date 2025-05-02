# ProjectServiceへの機能移行計画（改訂版）

## 1. 現状分析

### 1.1 ScopeManagerPanelとProjectServiceの機能分担

現在、プロジェクト管理に関する機能の一部はProjectServiceに移行されていますが、ScopeManagerPanelにもプロジェクト関連のコードが残っています。

#### 既にProjectServiceに実装されている機能:
- プロジェクト一覧の取得 (`getAllProjects`)
- アクティブプロジェクトの取得と設定 (`getActiveProject`, `setActiveProject`)
- プロジェクト作成 (`createProject`)
- 既存プロジェクト読み込み (`loadExistingProject`)
- プロジェクト選択 (`selectProject`) 
- プロジェクト削除 (`removeProject`)
- プロジェクトパス設定 (`setProjectPath`)
- ステータスファイルパスの取得 (`getStatusFilePath`)
- タブ状態保存 (`saveTabState`)

#### ScopeManagerPanelに残っている関連機能:
- `_handleCreateProject`: ProjectServiceを呼び出しているが、UI更新ロジックも含んでいる
- `_handleLoadExistingProject`: ProjectServiceを呼び出しているが、UIダイアログとUI更新ロジックを含む
- `_handleSelectProject`: ProjectServiceを呼び出しているが、UI更新ロジックを含む
- `_handleRemoveProject`: ProjectServiceを呼び出しているが、UI更新と状態変更ロジックも含む
- `_refreshProjects`: プロジェクト一覧の取得と表示更新
- `_handleEnsureActiveProject`: アクティブプロジェクトの検証と更新処理
- `_setupProjectServiceEventListeners`: プロジェクト関連イベントのリスナー設定とUI更新
- `_activeProject` インスタンス変数: 現在のアクティブプロジェクトをキャッシュしている

## 2. 移行方針の明確化

### 2.1 責任分担の原則

1. **ProjectService**: プロジェクト管理のビジネスロジックと状態管理
2. **ScopeManagerPanel**: UI表示と更新、ユーザー操作の受付

### 2.2 移行対象と残すべき機能の識別

#### ProjectServiceへの移行対象:
- プロジェクトのビジネスロジック
- プロジェクト状態の管理
- 状態変更に関するイベント発火

#### ScopeManagerPanelに残す機能:
- UI表示・更新ロジック
- イベントリスナー（`_setupProjectServiceEventListeners`）
- 複数サービス間の連携（`setProjectPath`）
- UIキャッシュとしての`_activeProject`（ただし値の管理はProjectServiceに委譲）

## 3. 移行対象の特定

以下のメソッドと機能をProjectServiceに移行・統合します：

1. **UI操作と結果通知のロジック分離**
   - 現状: プロジェクト関連UIロジックとプロジェクトデータ操作ロジックが混在
   - 問題点: UI操作とプロジェクト管理ロジックの責任が明確に分離されていない
   - 対策: UI通知用イベントとコールバック方式の採用

2. **アクティブプロジェクト状態管理の統合**
   - 現状: ScopeManagerPanelとProjectServiceで重複して管理
   - 問題点: 状態同期のロジックが複雑化し、不整合が発生する可能性がある
   - 対策: ProjectServiceでの一元管理と状態変更通知の統合

3. **プロジェクト操作専用メソッドの拡張**
   - 現状: 基本操作はProjectServiceに移行済みだが、より高レベルの操作がScopeManagerPanelに残っている
   - 問題点: 同じ責任を持つ処理が複数の場所に分散している
   - 対策: ProjectServiceに追加のヘルパーメソッドを実装

## 4. 詳細な移行計画

### 4.1 ProjectServiceインターフェース更新

```typescript
export interface IProjectService {
  // 既存メソッド...
  
  // 新規メソッド
  // プロジェクト管理の拡張機能
  ensureActiveProject(name: string, path: string, activeTab?: string): Promise<boolean>;
  refreshProjectsList(): Promise<IProjectInfo[]>;
  
  // UI状態管理サポート
  syncProjectUIState(projectPath: string): Promise<{ 
    allProjects: IProjectInfo[];
    activeProject: IProjectInfo | null;
    statusFilePath: string;
    statusFileExists: boolean;
  }>;
  
  // イベント拡張
  onProjectUIStateUpdated: vscode.Event<{
    allProjects: IProjectInfo[];
    activeProject: IProjectInfo | null;
    statusFilePath: string;
    statusFileExists: boolean;
  }>;
}
```

### 4.2 ProjectServiceへの実装追加

1. **`ensureActiveProject`メソッドの実装**

```typescript
/**
 * 指定されたプロジェクトがアクティブであることを確認し、必要に応じて選択状態を更新
 * @param name プロジェクト名
 * @param path プロジェクトパス
 * @param activeTab アクティブタブID（オプション）
 * @returns 処理が成功したかどうか
 */
public async ensureActiveProject(name: string, path: string, activeTab?: string): Promise<boolean> {
  try {
    // 現在のアクティブプロジェクトを取得
    const activeProject = this.getActiveProject();
    
    // 指定されたプロジェクトが現在のアクティブプロジェクトと一致するか確認
    if (activeProject && activeProject.path === path) {
      Logger.info(`ProjectService: 既にアクティブなプロジェクトです: ${name}`);
      
      // タブ状態を更新する場合は、タブ状態を保存
      if (activeTab && activeProject.id) {
        await this.saveTabState(activeProject.id, activeTab);
        Logger.info(`ProjectService: タブ状態を更新しました: ${activeTab}`);
      }
      
      return true;
    } else {
      // アクティブプロジェクトが一致しない場合は、指定されたプロジェクトをアクティブに設定
      await this.selectProject(name, path, activeTab);
      Logger.info(`ProjectService: プロジェクトをアクティブに設定しました: ${name}`);
      
      return true;
    }
  } catch (error) {
    Logger.error('ProjectService: プロジェクトの同期に失敗しました', error as Error);
    return false;
  }
}
```

2. **`refreshProjectsList`メソッドの実装**

```typescript
private _onProjectUIStateUpdated = new vscode.EventEmitter<{
  allProjects: IProjectInfo[];
  activeProject: IProjectInfo | null;
  statusFilePath: string;
  statusFileExists: boolean;
}>();
public readonly onProjectUIStateUpdated = this._onProjectUIStateUpdated.event;

/**
 * プロジェクト一覧を更新して取得
 * @returns 更新されたプロジェクト一覧
 */
public async refreshProjectsList(): Promise<IProjectInfo[]> {
  try {
    // ProjectManagementServiceからプロジェクト一覧を再取得
    this._currentProjects = this._projectManagementService.getAllProjects();
    this._activeProject = this._projectManagementService.getActiveProject();
    
    Logger.info(`ProjectService: プロジェクト一覧を更新しました: ${this._currentProjects.length}件`);
    
    // 現在のプロジェクト状態を通知
    if (this._activeProject && this._activeProject.path) {
      const statusFilePath = this.getStatusFilePath();
      
      this._onProjectUIStateUpdated.fire({
        allProjects: this._currentProjects,
        activeProject: this._activeProject,
        statusFilePath: statusFilePath,
        statusFileExists: fs.existsSync(statusFilePath)
      });
    }
    
    return this._currentProjects;
  } catch (error) {
    Logger.error(`ProjectService: プロジェクト一覧の更新に失敗しました`, error as Error);
    return this._currentProjects;
  }
}
```

3. **`syncProjectUIState`メソッドの実装**

```typescript
/**
 * プロジェクトUI状態を同期
 * UI更新に必要な情報を一度に取得
 * @param projectPath 対象プロジェクトパス
 * @returns UI更新に必要な情報
 */
public async syncProjectUIState(projectPath: string): Promise<{
  allProjects: IProjectInfo[];
  activeProject: IProjectInfo | null;
  statusFilePath: string;
  statusFileExists: boolean;
}> {
  try {
    // プロジェクトパスが指定されている場合は、パスを更新
    if (projectPath && projectPath !== this._projectPath) {
      await this.setProjectPath(projectPath);
    }
    
    // 最新のプロジェクト一覧を取得
    const allProjects = this.getAllProjects();
    const activeProject = this.getActiveProject();
    const statusFilePath = this.getStatusFilePath();
    
    // 結果をまとめて返す
    const result = {
      allProjects: allProjects,
      activeProject: activeProject,
      statusFilePath: statusFilePath,
      statusFileExists: fs.existsSync(statusFilePath)
    };
    
    // イベントも発火
    this._onProjectUIStateUpdated.fire(result);
    
    return result;
  } catch (error) {
    Logger.error(`ProjectService: プロジェクトUI状態の同期に失敗しました`, error as Error);
    
    // エラー時も最低限の情報を返す
    return {
      allProjects: this._currentProjects,
      activeProject: this._activeProject,
      statusFilePath: this._statusFilePath,
      statusFileExists: false
    };
  }
}
```

### 4.3 ScopeManagerPanelの修正

1. **プロジェクト関連ハンドラーの修正**

```typescript
/**
 * 新規プロジェクト作成処理
 * ProjectServiceを使用して実装
 */
private async _handleCreateProject(projectName: string, description: string): Promise<void> {
  try {
    Logger.info(`新規プロジェクト作成: ${projectName}`);
    
    // ProjectServiceを使用してプロジェクトを作成
    const projectId = await this._projectService.createProject(projectName, description);
    
    Logger.info(`プロジェクト「${projectName}」の作成が完了しました: ID=${projectId}`);
    
    // プロジェクトの最新UI状態を取得して表示
    const activeProject = this._projectService.getActiveProject();
    
    // プロジェクトパスを更新
    if (activeProject && activeProject.path) {
      this.setProjectPath(activeProject.path);
    }
    
    // 成功メッセージを表示
    this._showSuccess(`プロジェクト「${projectName}」を作成しました`);
  } catch (error) {
    Logger.error(`プロジェクト作成中にエラーが発生しました: ${projectName}`, error as Error);
    this._showError(`プロジェクトの作成に失敗しました: ${(error as Error).message}`);
  }
}
```

2. **イベントリスナーの設定（_setupProjectServiceEventListeners は変更せず残す）**

変更なし - このメソッドはScopeManagerPanelに残し、ProjectServiceのイベントを購読してUI更新を行う役割を担います。

```typescript
// ProjectServiceのUI状態更新イベントをリッスン
this._disposables.push(
  this._projectService.onProjectUIStateUpdated((state) => {
    // プロジェクト一覧とアクティブプロジェクトをUIに通知
    this._panel.webview.postMessage({
      command: 'updateProjects',
      projects: state.allProjects,
      activeProject: state.activeProject
    });
    
    // プロジェクトパスを更新
    this._panel.webview.postMessage({
      command: 'updateProjectPath',
      projectPath: state.activeProject?.path || this._projectPath,
      statusFilePath: state.statusFilePath,
      statusFileExists: state.statusFileExists
    });
    
    // プロジェクト名を更新
    if (state.activeProject) {
      this._panel.webview.postMessage({
        command: 'updateProjectName',
        projectName: state.activeProject.name
      });
    }
    
    // ScopeManagerPanelのローカルキャッシュも更新
    this._activeProject = state.activeProject;
    
    Logger.info(`ScopeManagerPanel: プロジェクトUI状態更新イベントを処理しました`);
  })
);
```

3. **_activeProject変数の使用修正**

- ScopeManagerPanel内で_activeProjectを参照している箇所を、ProjectServiceのgetActiveProject()と併用するよう修正
- 値を書き込む処理はなくし、イベントリスナーでの更新のみ行う

```typescript
// 例: タブ状態保存時
private async _handleSaveTabState(tabId: string): Promise<void> {
  try {
    // _activeProjectではなく、ProjectServiceから直接取得
    const activeProject = this._projectService.getActiveProject();
    
    if (!tabId || !activeProject || !activeProject.id) {
      Logger.warn('タブ状態を保存できません: 有効なアクティブプロジェクトが存在しません');
      return;
    }
    
    // ProjectServiceを使用してタブ状態を保存
    await this._projectService.saveTabState(activeProject.id, tabId);
    
    // ローカルキャッシュも更新
    this._activeProject = this._projectService.getActiveProject();
    
    Logger.info(`タブ状態を保存しました: プロジェクト=${activeProject.name}, タブID=${tabId}`);
  } catch (error) {
    Logger.error(`タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
  }
}
```

4. **_handleEnsureActiveProjectの置き換え**

```typescript
// 現在のメソッド
private async _handleEnsureActiveProject(projectName: string, projectPath: string, activeTab?: string): Promise<void> {
  try {
    // ProjectServiceの新しいメソッドを使用
    await this._projectService.ensureActiveProject(projectName, projectPath, activeTab);
  } catch (error) {
    Logger.error('プロジェクトの同期に失敗しました', error as Error);
  }
}
```

5. **`setProjectPath`メソッドの変更**

このメソッドはScopeManagerPanelに残し、複数サービスの調整役として機能させる：

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
    
    // 一時ディレクトリを設定
    this._tempShareDir = path.join(projectPath, '.appgenius_temp');
    await this._fileSystemService.ensureDirectoryExists(this._tempShareDir);
    
    // 関連サービスにプロジェクトパスを設定
    this._promptServiceClient.setProjectPath(projectPath);
    this._sharingService.setProjectBasePath(projectPath);
    
    // ファイルウォッチャーとステータスファイルを設定
    this._setupFileWatcher();
    this._loadStatusFile();
    
    // ProjectServiceを使ってUI状態を同期
    const state = await this._projectService.syncProjectUIState(projectPath);
    
    // ローカルキャッシュも更新
    this._activeProject = state.activeProject;
    
    // この結果はイベントでも通知されるが、念のため明示的にも実行
    this._panel.webview.postMessage({
      command: 'updateProjectPath',
      projectPath: this._projectPath,
      statusFilePath: this._statusFilePath,
      statusFileExists: fs.existsSync(this._statusFilePath)
    });
  } catch (error) {
    Logger.error(`プロジェクトパスの設定に失敗しました: ${error}`);
    throw error;
  }
}
```

## 5. 移行手順

1. **ProjectServiceインターフェースの更新**
   - 新しいメソッドとイベントを追加

2. **ProjectService実装の更新**
   - 新しいメソッドを実装
   - 新しいイベントエミッターを追加

3. **ScopeManagerPanelの修正**
   - イベントリスナーを追加（コンストラクタ内）
   - プロジェクト関連ハンドラーを修正
   - _activeProject変数の使用を一貫性のある方法に修正

4. **動作確認**
   - プロジェクト選択
   - プロジェクト作成
   - プロジェクト削除
   - タブ選択状態の保存

## 6. リスク分析と対策

### 6.1 リスク
1. **UI状態同期の問題**: プロジェクト状態変更時にUIに反映されないリスク
2. **イベント循環**: イベントの連鎖により無限ループが発生するリスク
3. **操作ロック**: 非同期処理中にUIが応答しなくなるリスク
4. **エッジケース処理**: エラー時の状態回復が不完全になるリスク

### 6.2 対策
1. **イベントソース識別**: イベント発生元を記録し、循環参照を防止
2. **タイムアウト設定**: 長時間の処理にはタイムアウト処理を追加
3. **状態保全**: エラー時の状態復元メカニズムを実装
4. **デバウンス処理**: 連続したイベント処理の最適化

## 7. 期待される効果

1. **コードの整理**: ScopeManagerPanelのコード行数が減少
   - 推定削減行数: 約80-100行（約5-6%の削減）
   - ビジネスロジックが移行され、UI更新コードのみが残る

2. **責任の明確化**: 
   - ProjectService: プロジェクト管理ロジックと状態管理
   - ScopeManagerPanel: UI表示とユーザー操作処理
   - イベント連携によるUI更新

3. **保守性の向上**: 
   - 機能変更時に修正すべき場所が明確になる
   - ビジネスロジックの変更はProjectServiceのみを修正
   - UI表示の変更はScopeManagerPanelのみを修正

4. **一貫性のある動作**: 
   - 同じプロジェクト管理ロジックが全体で使われる
   - 状態同期が明示的かつ一貫した方法で行われる

5. **テスト容易性**: 
   - UI層とロジック層が分離されているため単体テストが容易
   - ProjectServiceはUI依存なしでテスト可能

## 8. 実装後の検証

移行完了後、以下の観点で検証を行います：

1. **機能的検証**: すべての機能が正常に動作するか
   - プロジェクト選択が正しく機能するか
   - プロジェクト作成が正しく機能するか
   - プロジェクト削除が正しく機能するか
   - タブ状態の保存が正しく機能するか

2. **性能検証**: パフォーマンスへの影響はないか
   - プロジェクト一覧表示のレスポンス時間
   - プロジェクト切り替え時の応答性
   - 同期処理の効率性

3. **エラー処理**: 異常系のハンドリングが適切か
   - 無効なプロジェクトパスのハンドリング
   - 存在しないプロジェクトの処理
   - ネットワークエラー時の回復処理

4. **コード量**: ScopeManagerPanelのコード行数は減少したか
   - 移行前後のLOC測定
   - 複雑度の測定

5. **メンテナビリティ**: コードの可読性と保守性は向上したか
   - 責任の明確さ
   - コードの結合度
   - コメントの適切さ