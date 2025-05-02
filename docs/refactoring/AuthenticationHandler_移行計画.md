# AuthenticationHandlerへの機能移行計画

## 1. 現状分析

### 1.1 ScopeManagerPanelとAuthenticationHandlerの機能分担

現在、認証関連の機能の一部はAuthenticationHandlerに移行されていますが、ScopeManagerPanelにも認証関連のコードが残っています。

#### 既にAuthenticationHandlerに実装されている機能:
- 認証状態チェック (`checkLoggedIn`, `checkPermission`)
- ログイン画面表示 (`showLoginScreen`)
- トークン有効期限監視 (`setupTokenExpirationMonitor`)
- 認証状態変更イベント (`onAuthStateChanged`)

#### ScopeManagerPanelに残っている関連機能:
- `_setupTokenExpirationMonitor`: AuthenticationHandlerのメソッドを呼び出しているが、コールバック処理を含む
- 認証状態変更イベントのハンドリング (コンストラクタ内)
- 権限チェックロジック (`createOrShow`メソッド内)
- `_authHandler` インスタンス変数: AuthenticationHandlerへの参照を保持

## 2. 移行対象の特定

以下のメソッドと機能をAuthenticationHandlerに移行・統合します：

1. **認証チェックと画面表示ロジックの統合**
   - 現状: `createOrShow`メソッド内に認証チェックロジックと表示制御が混在
   - 問題点: 認証処理とUI表示ロジックが分離されていない
   - 対策: AuthenticationHandlerに認証チェックと適切なUI表示を一括して行うメソッドを追加

2. **トークン有効期限監視の強化**
   - 現状: ScopeManagerPanelが個別にコールバックを設定している
   - 問題点: 各パネルで同様のロジックを実装する必要がある
   - 対策: AuthenticationHandlerに標準的なUIハンドリング機能を統合

3. **認証状態変更時の処理統一**
   - 現状: 認証状態変更時の処理がScopeManagerPanelに実装されている
   - 問題点: 認証状態変更時の処理がコンポーネントごとに異なる可能性がある
   - 対策: AuthenticationHandlerで標準的な処理を提供し、必要に応じてカスタムロジックを受け入れる設計に

## 3. 詳細な移行計画

### 3.1 AuthenticationHandlerインターフェース更新

```typescript
export interface IAuthenticationHandler {
  // 既存メソッド...
  
  // 新規メソッド
  // 認証チェックと画面表示の統合
  validateAccessAndShowPanel(
    extensionUri: vscode.Uri,
    feature: Feature,
    onSuccess: () => void,
    customErrorMessage?: string
  ): boolean;
  
  // トークン監視の改善
  setupStandardTokenMonitor(
    panel: vscode.WebviewPanel | vscode.WebviewView,
    extensionUri: vscode.Uri,
    feature: Feature
  ): vscode.Disposable;
  
  // イベント拡張
  configureAuthStateChangeHandling(
    panel: vscode.WebviewPanel | vscode.WebviewView,
    extensionUri: vscode.Uri,
    feature: Feature,
    onPermissionsChanged?: (hasPermission: boolean) => void
  ): vscode.Disposable;
}
```

### 3.2 AuthenticationHandlerへの実装追加

1. **`validateAccessAndShowPanel`メソッドの実装**

```typescript
/**
 * 認証と権限を検証し、結果に応じて適切なUI処理を実行
 * @param extensionUri 拡張機能のURI
 * @param feature アクセスに必要な機能（権限）
 * @param onSuccess 認証成功時のコールバック
 * @param customErrorMessage 権限エラー時のカスタムメッセージ
 * @returns アクセスが許可されたか
 */
public validateAccessAndShowPanel(
  extensionUri: vscode.Uri,
  feature: Feature,
  onSuccess: () => void,
  customErrorMessage?: string
): boolean {
  // 認証チェック：ログインしていない場合はログイン画面に直接遷移
  if (!this.checkLoggedIn()) {
    Logger.info(`認証チェック: 未認証のためログイン画面に誘導します`);
    // ログイン画面を表示
    this.showLoginScreen(extensionUri);
    return false;
  }

  // 権限チェック：必要な権限がない場合はアクセスを拒否
  if (!this.checkPermission(feature)) {
    Logger.warn(`認証チェック: 権限不足のためアクセスを拒否します - ${Feature[feature]}`);
    vscode.window.showWarningMessage(
      customErrorMessage || `この機能へのアクセス権限がありません。`
    );
    return false;
  }

  // すべてのチェックに合格したら成功コールバックを実行
  onSuccess();
  return true;
}
```

2. **`setupStandardTokenMonitor`メソッドの実装**

```typescript
/**
 * 標準的なトークン監視を設定
 * トークン有効期限が切れた場合や権限が失われた場合に適切な処理を行う
 * @param panel 監視対象のパネル
 * @param extensionUri 拡張機能のURI
 * @param feature 必要な機能（権限）
 * @returns Disposable - 監視を停止するためのオブジェクト
 */
public setupStandardTokenMonitor(
  panel: vscode.WebviewPanel | vscode.WebviewView, 
  extensionUri: vscode.Uri,
  feature: Feature
): vscode.Disposable {
  return this.setupTokenExpirationMonitor(
    // トークンの有効期限切れ時
    () => {
      Logger.info(`${Feature[feature]}: 認証状態が無効になったため、パネルを閉じます`);
      // パネルを閉じる
      panel.dispose();
      // ログイン画面に直接遷移
      this.showLoginScreen(extensionUri);
    },
    // 権限喪失時
    () => {
      Logger.warn(`${Feature[feature]}: 権限が失効したため、パネルを閉じます`);
      // パネルを閉じる
      panel.dispose();
      vscode.window.showWarningMessage(`${Feature[feature]}へのアクセス権限がなくなりました。`);
    }
  );
}
```

3. **`configureAuthStateChangeHandling`メソッドの実装**

```typescript
/**
 * 認証状態変更時の標準的な処理を設定
 * @param panel 対象のパネル
 * @param extensionUri 拡張機能のURI
 * @param feature 必要な機能（権限）
 * @param onPermissionsChanged 権限変更時の追加コールバック
 * @returns Disposable - 監視を停止するためのオブジェクト
 */
public configureAuthStateChangeHandling(
  panel: vscode.WebviewPanel | vscode.WebviewView,
  extensionUri: vscode.Uri,
  feature: Feature,
  onPermissionsChanged?: (hasPermission: boolean) => void
): vscode.Disposable {
  try {
    // 認証状態変更イベントをリッスン
    const authStateChangedDisposable = this.onAuthStateChanged(state => {
      // 認証状態が未認証になった、または権限がなくなった場合
      if (!state.isAuthenticated || !this.checkPermission(feature)) {
        Logger.info(`${Feature[feature]}: 認証状態が変更されたため、パネルを閉じます`);
        // パネルを閉じる
        panel.dispose();
        
        if (!state.isAuthenticated) {
          // ログイン画面に誘導
          this.showLoginScreen(extensionUri);
        }
        
        // 権限変更時の追加コールバックがあれば実行
        if (onPermissionsChanged) {
          onPermissionsChanged(false);
        }
      } else if (onPermissionsChanged) {
        // 認証状態はOKだが権限変更コールバックがある場合は実行
        onPermissionsChanged(true);
      }
    });
    
    Logger.info(`${Feature[feature]}: 認証状態変更イベントの監視を開始しました`);
    return authStateChangedDisposable;
  } catch (error) {
    Logger.error('認証状態変更イベントの監視設定中にエラーが発生しました', error as Error);
    // エラー時は空のdisposableを返す
    return { dispose: () => {} };
  }
}
```

### 3.3 ScopeManagerPanelの修正

1. **`createOrShow`メソッドの修正**

```typescript
/**
 * 実際のパネル作成・表示ロジック
 * ProtectedPanelから呼び出される
 */
public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string): ScopeManagerPanel | undefined {
  // 認証ハンドラーを取得
  const authHandler = AuthenticationHandler.getInstance();
  
  // 認証と権限を検証（失敗時は早期リターン）
  const accessGranted = authHandler.validateAccessAndShowPanel(
    extensionUri,
    ScopeManagerPanel._feature,
    () => {
      // ここでは何もしない（成功時は以下の処理を継続）
    },
    'スコープマネージャーへのアクセス権限がありません。'
  );
  
  if (!accessGranted) {
    return undefined;
  }

  // -- 以下は既存の処理（認証チェック部分を削除） --
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  // すでにパネルが存在する場合は、それを表示
  if (ScopeManagerPanel.currentPanel) {
    ScopeManagerPanel.currentPanel._panel.reveal(column);
    
    // プロジェクトパスが指定されている場合は更新
    if (projectPath) {
      Logger.info(`既存のスコープマネージャーパネルを使用して、プロジェクトパスを更新: ${projectPath}`);
      ScopeManagerPanel.currentPanel.setProjectPath(projectPath);
    }
    
    return ScopeManagerPanel.currentPanel;
  }

  // 新しいパネルを作成
  const panel = vscode.window.createWebviewPanel(
    ScopeManagerPanel.viewType,
    'AppGenius スコープマネージャー',
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'media'),
        vscode.Uri.joinPath(extensionUri, 'dist'),
        vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
      ]
    }
  );
  
  Logger.info(`新しいスコープマネージャーパネルを作成: プロジェクトパス=${projectPath || '未指定'}`);
  ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, context, projectPath);
  return ScopeManagerPanel.currentPanel;
}
```

2. **コンストラクタの修正**

```typescript
/**
 * コンストラクタ
 */
private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string) {
  super();
  
  this._panel = panel;
  this._extensionUri = extensionUri;
  this._extensionPath = context.extensionPath; // 拡張機能のファイルシステムパスを保存
  this._fileManager = FileOperationManager.getInstance();
  this._promptServiceClient = PromptServiceClient.getInstance();
  
  // FileSystemServiceのインスタンスを取得
  this._fileSystemService = FileSystemService.getInstance();
  
  // ProjectServiceのインスタンスを取得
  this._projectService = ProjectService.getInstance(this._fileSystemService);
  
  // ProjectServiceのイベントリスナーを設定
  this._setupProjectServiceEventListeners();
  
  // 共有サービスを初期化
  this._sharingService = SharingService.getInstance(context);
  
  // 認証ハンドラーを初期化
  this._authHandler = AuthenticationHandler.getInstance();
  
  // 一時ディレクトリはプロジェクトパス設定時に作成されるため、ここでは初期化のみ
  this._tempShareDir = '';
  
  // 認証状態の監視を設定（AuthenticationHandlerの標準機能を使用）
  this._disposables.push(
    this._authHandler.setupStandardTokenMonitor(
      this._panel,
      this._extensionUri,
      ScopeManagerPanel._feature
    )
  );
  
  // 認証状態変更イベントの監視を設定（AuthenticationHandlerの標準機能を使用）
  this._disposables.push(
    this._authHandler.configureAuthStateChangeHandling(
      this._panel,
      this._extensionUri,
      ScopeManagerPanel._feature
    )
  );
  
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
  
  // アクティブプロジェクトを取得
  const activeProject = this._projectService.getActiveProject();
    
  // アクティブプロジェクトが指定されていない場合は、引数または現在のアクティブプロジェクトを使用
  if (!projectPath && activeProject && activeProject.path) {
    projectPath = activeProject.path;
    Logger.info(`アクティブプロジェクトパスを使用: ${projectPath}`);
  }
  
  // プロジェクトパスが指定されている場合は設定
  if (projectPath) {
    this.setProjectPath(projectPath);
  }
  
  // WebViewの内容を設定
  this._update();
  
  // パネルが破棄されたときのクリーンアップ
  this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  
  // パネルの状態が変更されたときに更新
  this._panel.onDidChangeViewState(
    _e => {
      if (this._panel.visible) {
        this._update();
      }
    },
    null,
    this._disposables
  );
  
  // WebViewからのメッセージを処理
  this._panel.webview.onDidReceiveMessage(
    async message => {
      // 既存のメッセージ処理コード...
    },
    null,
    this._disposables
  );
}
```

3. **`_setupTokenExpirationMonitor`メソッドの削除**

このメソッドは不要になるため削除します。

### 3.4 ProtectedPanelクラスの強化（オプション）

より一般的なソリューションとして、ProtectedPanelクラスを強化することも検討します：

```typescript
/**
 * 権限保護されたパネルの基底クラス
 */
export abstract class ProtectedPanel {
  protected static readonly _feature: Feature;
  protected _authHandler: IAuthenticationHandler;
  
  constructor() {
    this._authHandler = AuthenticationHandler.getInstance();
  }
  
  /**
   * 認証状態の監視を設定（サブクラスで呼び出す）
   */
  protected setupAuthProtection(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri
  ): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    
    // 具体的な機能を取得
    const feature = (this.constructor as typeof ProtectedPanel)._feature;
    
    // トークン監視を設定
    disposables.push(
      this._authHandler.setupStandardTokenMonitor(
        panel,
        extensionUri,
        feature
      )
    );
    
    // 認証状態変更イベントの監視を設定
    disposables.push(
      this._authHandler.configureAuthStateChangeHandling(
        panel,
        extensionUri,
        feature
      )
    );
    
    return disposables;
  }
  
  /**
   * パネルのアクセス検証を行う（静的メソッド）
   */
  protected static validateAccess(
    extensionUri: vscode.Uri,
    authHandler: IAuthenticationHandler
  ): boolean {
    // 具体的な機能を取得
    const feature = this._feature;
    
    return authHandler.validateAccessAndShowPanel(
      extensionUri,
      feature,
      () => {}, // 成功時は何もしない
      `${Feature[feature]}へのアクセス権限がありません。`
    );
  }
  
  /**
   * リソースを解放（サブクラスでオーバーライド）
   */
  public abstract dispose(): void;
}
```

## 4. 移行手順

1. **AuthenticationHandlerインターフェースの更新**
   - 新しいメソッドを追加

2. **AuthenticationHandler実装の更新**
   - 新しいメソッドを実装

3. **ScopeManagerPanelの修正**
   - `createOrShow`メソッドを修正
   - コンストラクタを修正
   - `_setupTokenExpirationMonitor`メソッドを削除

4. **（オプション）ProtectedPanelの強化**
   - 共通の認証機能を実装

5. **動作確認**
   - ログイン・ログアウトサイクル
   - 権限変更時の動作
   - パネル表示と破棄の動作

## 5. リスク分析と対策

### 5.1 リスク
1. **認証状態の不整合**: AuthenticationHandlerの状態とScopeManagerPanelの状態が同期しないリスク
2. **多重処理**: 複数のイベントが同時に発火して重複処理が発生するリスク
3. **UI遷移問題**: 認証状態変更時の画面遷移が適切に行われないリスク
4. **権限変更検知の遅延**: 権限変更がリアルタイムに反映されないリスク

### 5.2 対策
1. **状態同期メカニズム**: AuthenticationHandlerの状態を一元管理し、変更通知を確実に行う
2. **イベント最適化**: イベント伝播を最適化し、不要な処理を回避
3. **UI状態監視**: UI状態を常に監視し、適切な画面遷移を保証
4. **即時反映**: 権限変更を即座に反映するメカニズムを実装

## 6. 期待される効果

1. **コードの整理**: ScopeManagerPanelの認証関連コードが削減
2. **責任の明確化**: 認証関連の責任がAuthenticationHandlerに集約
3. **保守性の向上**: 認証機能の変更時に修正すべき場所が一カ所に
4. **一貫性のある動作**: 同じ認証ロジックが全体で使われる
5. **再利用性の向上**: 他のコンポーネントでも同じ認証ロジックを容易に利用可能
6. **テスト容易性**: 分離された認証サービスは単体テストが容易

## 7. 実装後の検証

移行完了後、以下の観点で検証を行います：

1. **認証フロー検証**
   - ログイン状態でのアクセス
   - 未ログイン状態でのアクセス（ログイン画面リダイレクト）
   - 権限不足時のアクセス拒否
   - セッション期限切れ時の処理

2. **状態変更検証**
   - ログアウト時の動作
   - 権限変更時の動作
   - トークン期限切れ時の動作

3. **エラー処理検証**
   - 認証サービス障害時の処理
   - トークン検証エラー時の処理
   - イベント処理エラー時の回復処理

4. **UI統合検証**
   - 認証関連メッセージの表示
   - 画面遷移の適切さ
   - ユーザーエクスペリエンスの一貫性