# ScopeManagerPanel リファクタリング計画（削減と単純化バージョン）

## 1. 現状分析

### 1.1 コードの状態と問題点

- **サイズと複雑性**: ScopeManagerPanel.tsは約1,700行のコードで複雑度が高い
- **責任範囲の過剰**: UIレンダリング、ファイル操作、認証、プロジェクト管理など多数の責任が集中
- **サービス分離の不完全さ**: 既に4つのサービスに一部機能を移行しているが、ScopeManagerPanel本体が依然として肥大
- **実装の不整合**: 古いコードと新しい分離アーキテクチャが混在
- **コード重複**: 同様の処理パターンがメソッド間で繰り返されている
- **イベント処理の冗長性**: イベント伝播とメッセージ受信処理の重複

### 1.2 既存のサービス分離状況

既に4つのサービスが作成され、一部機能が移行されています：

1. **FileSystemService**: ファイル操作機能を担当
   - 現状：基本機能は実装済み、ScopeManagerPanelからの呼び出しに一部不整合あり
   
2. **ProjectService**: プロジェクト管理機能を担当
   - 現状：主要機能は実装済み、一部メソッドがScopeManagerPanelに残存

3. **SharingService**: ファイル共有機能を担当
   - 現状：基本的な実装は完了、ClaudeCodeSharingServiceへの委譲構造

4. **AuthenticationHandler**: 認証・権限管理を担当
   - 現状：基本機能は実装済み、シングルトンパターンで実装

## 2. 削減と単純化の計画

### 2.1 不要コードの削除と削減対象

1. **未使用コードの削除**
   - 複数のコメントで「削除されました」と記載された古いメソッド参照
   - 「準備モードは廃止されました」と記載されたコード
   - 「未使用メソッドを削除」と記載されている箇所

2. **重複処理の統合**
   - ファイルウォッチャーセットアップの二重処理（_setupFileWatcher と FileSystemService）
   - プロジェクト情報更新処理の重複（_refreshProjects と ProjectService）
   - イベント処理の重複（_setupTokenExpirationMonitor と AuthenticationHandler）

3. **委譲パターンの徹底**
   - `_handleXXX` メソッドを極限まで削減し、サービス呼び出しに置き換え
   - WebViewとのメッセージ交換に特化した最小限のインターフェースに変更

### 2.2 責任の明確な分離

| 役割                   | 現状                 | 改善後の責任主体            |
|------------------------|----------------------|-----------------------------|
| UI管理・メッセージ処理   | ScopeManagerPanel   | ScopeManagerPanel (簡素化)  |
| ファイル操作           | 混在                 | FileSystemService（完全委譲）|
| プロジェクト管理       | 混在                 | ProjectService（完全委譲）   |
| 共有機能               | 混在                 | SharingService（完全委譲）   |
| 認証・権限             | 混在                 | AuthenticationHandler（完全委譲）|
| WebView状態管理        | ScopeManagerPanel   | 新規WebViewStateManager      |

## 3. リファクタリングステップ

### フェーズ1: 削除と整理（既存ファイル）

1. **ScopeManagerPanel.ts内の整理**
   - 未使用/冗長なコードの削除
   - 冗長なログ出力の削減
   - 既存サービス呼び出しの完全委譲化

2. **FileSystemService**
   - `_loadStatusFile`や`_updateDirectoryStructure`メソッドをFileSystemServiceに統合
   - ScopeManagerPanelから完全に切り離す

3. **ProjectService**
   - `_currentProjects`と`_activeProject`フィールドをScopeManagerPanelから削除
   - すべてのプロジェクト管理ロジックをProjectServiceに集約

### フェーズ2: WebView状態管理の分離（新規ファイル）

4. **WebViewStateManager**の作成
   - WebViewとのメッセージ処理と状態管理ロジックを分離
   - タブ状態の管理機能を集約
   - UI状態更新ロジックの一元管理

5. **MessageHandler**の実装
   - `_panel.webview.onDidReceiveMessage`ハンドラの整理
   - コマンドパターンを導入した明確なメッセージディスパッチ

### フェーズ3: ScopeManagerPanelの最小化

6. **ScopeManagerPanel**の簡素化
   - WebViewパネル管理と初期化のみに責任を限定
   - すべてのビジネスロジックをサービスへ委譲
   - イベント管理の一元化

## 4. 具体的な実装詳細

### 4.1 WebViewStateManagerの設計

```typescript
export class WebViewStateManager {
  private _panel: vscode.WebviewPanel;
  private _projectService: IProjectService;
  private _fileSystemService: IFileSystemService;
  private _sharingService: ISharingService;
  private _disposables: vscode.Disposable[] = [];
  
  constructor(
    panel: vscode.WebviewPanel,
    projectService: IProjectService,
    fileSystemService: IFileSystemService,
    sharingService: ISharingService
  ) {
    this._panel = panel;
    this._projectService = projectService;
    this._fileSystemService = fileSystemService;
    this._sharingService = sharingService;
    
    // サービスからのイベントリスナーを設定
    this._setupEventListeners();
  }
  
  // プロジェクト状態をUIに反映
  public updateProjectState(projectInfo: IProjectInfo | null): void {
    if (!projectInfo) return;
    
    this._panel.webview.postMessage({
      command: 'updateProjects',
      projects: this._projectService.getAllProjects(),
      activeProject: projectInfo
    });
    
    this._panel.webview.postMessage({
      command: 'updateProjectName',
      projectName: projectInfo.name
    });
    
    this._panel.webview.postMessage({
      command: 'updateProjectPath',
      projectPath: projectInfo.path,
      statusFilePath: this._projectService.getStatusFilePath(),
      statusFileExists: fs.existsSync(this._projectService.getStatusFilePath())
    });
  }
  
  // マークダウン内容をUIに反映
  public updateMarkdownContent(content: string): void {
    this._panel.webview.postMessage({
      command: 'updateMarkdownContent',
      content: content,
      timestamp: Date.now(),
      priority: 'high'
    });
  }
  
  // 共有履歴をUIに反映
  public updateSharingHistory(history: SharedFile[]): void {
    this._panel.webview.postMessage({
      command: 'updateSharingHistory',
      history: history
    });
  }
  
  // エラーメッセージ表示
  public showError(message: string): void {
    this._panel.webview.postMessage({
      command: 'showError',
      message: message
    });
  }
  
  // 成功メッセージ表示
  public showSuccess(message: string): void {
    this._panel.webview.postMessage({
      command: 'showSuccess',
      message: message
    });
  }
  
  // イベントリスナーのセットアップ
  private _setupEventListeners(): void {
    // ProjectServiceイベント
    this._disposables.push(
      this._projectService.onProjectSelected(projectInfo => {
        this.updateProjectState(projectInfo);
      })
    );
    
    // その他のイベントリスナー...
  }
  
  public dispose(): void {
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}
```

### 4.2 MessageHandlerの設計

```typescript
export class MessageHandler {
  private _panel: vscode.WebviewPanel;
  private _projectService: IProjectService;
  private _fileSystemService: IFileSystemService;
  private _sharingService: ISharingService;
  private _authHandler: IAuthenticationHandler;
  private _stateManager: WebViewStateManager;
  
  constructor(
    panel: vscode.WebviewPanel,
    projectService: IProjectService,
    fileSystemService: IFileSystemService,
    sharingService: ISharingService,
    authHandler: IAuthenticationHandler,
    stateManager: WebViewStateManager
  ) {
    this._panel = panel;
    this._projectService = projectService;
    this._fileSystemService = fileSystemService;
    this._sharingService = sharingService;
    this._authHandler = authHandler;
    this._stateManager = stateManager;
    
    // メッセージハンドラーを設定
    this._setupMessageHandler();
  }
  
  private _setupMessageHandler(): void {
    this._panel.webview.onDidReceiveMessage(async message => {
      try {
        const handler = this._getMessageHandler(message.command);
        if (handler) {
          await handler(message);
        } else {
          console.warn(`未知のコマンドです: ${message.command}`);
        }
      } catch (error) {
        Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
        this._stateManager.showError(`操作に失敗しました: ${(error as Error).message}`);
      }
    });
  }
  
  private _getMessageHandler(command: string): ((message: any) => Promise<void>) | null {
    const handlers: {[key: string]: (message: any) => Promise<void>} = {
      'initialize': this._handleInitialize.bind(this),
      'getMarkdownContent': this._handleGetMarkdownContent.bind(this),
      'shareText': this._handleShareText.bind(this),
      'shareImage': this._handleShareImage.bind(this),
      'selectProject': this._handleSelectProject.bind(this),
      // 他のハンドラーを追加...
    };
    
    return handlers[command] || null;
  }
  
  // 各種ハンドラーメソッド...
  private async _handleInitialize(message: any): Promise<void> {
    // 初期化処理
    const allProjects = this._projectService.getAllProjects();
    const activeProject = this._projectService.getActiveProject();
    
    this._stateManager.updateProjectState(activeProject);
    
    // マークダウン内容を読み込む
    const statusFilePath = this._projectService.getStatusFilePath();
    if (statusFilePath && fs.existsSync(statusFilePath)) {
      const content = await this._fileSystemService.readMarkdownFile(statusFilePath);
      this._stateManager.updateMarkdownContent(content);
    }
    
    // 共有履歴を更新
    const history = this._sharingService.getHistory();
    this._stateManager.updateSharingHistory(history);
  }
  
  // その他のハンドラーメソッド...
}
```

### 4.3 簡素化されたScopeManagerPanel

```typescript
export class ScopeManagerPanel extends ProtectedPanel {
  public static currentPanel: ScopeManagerPanel | undefined;
  private static readonly viewType = 'scopeManager';
  protected static readonly _feature: Feature = Feature.SCOPE_MANAGER;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  
  // サービスへの参照
  private _fileSystemService: IFileSystemService;
  private _projectService: IProjectService;
  private _sharingService: ISharingService; 
  private _authHandler: IAuthenticationHandler;
  
  // 新しいコンポーネント
  private _stateManager: WebViewStateManager;
  private _messageHandler: MessageHandler;

  /**
   * 実際のパネル作成・表示ロジック
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string): ScopeManagerPanel | undefined {
    // 認証チェック
    const authHandler = AuthenticationHandler.getInstance();
    
    if (!authHandler.checkLoggedIn()) {
      Logger.info('スコープマネージャー: 未認証のためログイン画面に誘導します');
      authHandler.showLoginScreen(extensionUri);
      return undefined;
    }

    if (!authHandler.checkPermission(ScopeManagerPanel._feature)) {
      Logger.warn('スコープマネージャー: 権限不足のためアクセスを拒否します');
      vscode.window.showWarningMessage('スコープマネージャーへのアクセス権限がありません。');
      return undefined;
    }

    // パネル表示ロジック（既存実装を簡素化）
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ScopeManagerPanel.currentPanel) {
      ScopeManagerPanel.currentPanel._panel.reveal(column);
      
      if (projectPath) {
        ScopeManagerPanel.currentPanel.setProjectPath(projectPath);
      }
      
      return ScopeManagerPanel.currentPanel;
    }

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
    
    ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, context, projectPath);
    return ScopeManagerPanel.currentPanel;
  }

  /**
   * コンストラクタ - 大幅に簡素化
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string) {
    super();
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // 各サービスのインスタンスを取得
    this._fileSystemService = FileSystemService.getInstance();
    this._projectService = ProjectService.getInstance(this._fileSystemService);
    this._sharingService = SharingService.getInstance(context);
    this._authHandler = AuthenticationHandler.getInstance();
    
    // 新しいコンポーネントを初期化
    this._stateManager = new WebViewStateManager(
      panel,
      this._projectService,
      this._fileSystemService,
      this._sharingService
    );
    
    this._messageHandler = new MessageHandler(
      panel,
      this._projectService,
      this._fileSystemService,
      this._sharingService,
      this._authHandler,
      this._stateManager
    );
    
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
  }

  /**
   * プロジェクトパスを設定 - サービスに委譲
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    await this._projectService.setProjectPath(projectPath);
    this._sharingService.setProjectBasePath(projectPath);
    
    // 状態マネージャーを通じてUIを更新
    this._stateManager.updateProjectState(this._projectService.getActiveProject());
  }

  /**
   * WebViewを更新 - 大幅に簡素化
   */
  private _update(): void {
    // HTMLのみ更新し、その他の状態はMessageHandlerが初期化時に対応
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  /**
   * WebViewのHTMLを生成 - ほぼ変更なし
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // 既存の実装を維持
    // ...
  }

  /**
   * nonce値を生成 - 変更なし
   */
  private _getNonce(): string {
    // 既存の実装を維持
    // ...
  }

  /**
   * リソースを解放 - 簡素化
   */
  public dispose(): void {
    if (ScopeManagerPanel.currentPanel === this) {
      ScopeManagerPanel.currentPanel = undefined;
    }

    // パネル自体を破棄
    this._panel.dispose();
    
    // 各サービスを解放
    this._fileSystemService.dispose();
    this._sharingService.dispose();
    this._stateManager.dispose();
    
    // disposable なオブジェクトを破棄
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
```

## 5. 実装計画と検証

### 5.1 段階的実装計画

1. **準備段階**
   - リファクタリング前にユニットテストを作成
   - 既存の機能を確認するE2Eテストの実装

2. **実装段階1: 削除と整理**
   - 未使用メソッドの削除（テスト実行によって検証）
   - 重複コードの削除と既存サービス呼び出しへの変更
   - 段階ごとに機能テストを実施

3. **実装段階2: 新コンポーネントの追加**
   - WebViewStateManager実装
   - MessageHandler実装
   - 一部の機能を新コンポーネントに移行して段階的にテスト

4. **実装段階3: ScopeManagerPanel簡素化**
   - ScopeManagerPanelから全てのビジネスロジックを削除
   - コントローラー機能に特化したScopeManagerPanelに変更
   - 最終動作検証

### 5.2 検証計画

- **機能テスト**: すべての機能が正常に動作することを検証
- **パフォーマンステスト**: リファクタリング前後のパフォーマンス比較
- **コード量測定**: 総コード量の削減を測定
- **循環的複雑度測定**: メソッドごとの複雑度測定

## 6. 期待される効果

1. **コード量の削減**: ScopeManagerPanel本体を50%以上削減し、全体で~20%のコード量削減
2. **保守性の向上**: 責任の明確な分離により、拡張や修正が容易に
3. **テストの容易性**: 各コンポーネントの単体テストが可能に
4. **拡張性の向上**: 新機能追加時に適切なサービスだけを拡張すればよい
5. **バグの減少**: 複雑なコードによるバグリスクの低減
6. **開発効率の向上**: 機能ごとに分離されたコードで複数人での開発が容易に
7. **トレーサビリティの向上**: コードの変更履歴が機能単位で追跡可能に

## 7. リスク対策

1. **後方互換性**
   - すべてのパブリックAPIとイベントは互換性を維持
   - 既存のWebViewメッセージプロトコルを維持

2. **テスト漏れ**
   - リファクタリング前に包括的なE2Eテストを実施
   - 段階的なリファクタリングで問題を早期に検出

3. **パフォーマンス**
   - リファクタリング前後でパフォーマンス比較を行う
   - ボトルネックが見つかった場合は最適化対策を実施

## 8. 結論

このリファクタリング計画では、「削除と単純化」の原則に従い、ScopeManagerPanelの大幅な簡素化と責任の明確な分離を実現します。既に進行中のサービス分離を完成させるとともに、WebView状態管理とメッセージ処理の新しい抽象化レイヤーを導入することで、コードの可読性、保守性、拡張性を大幅に向上させます。また、冗長なコードや使われなくなった機能を削除することで、コードベース全体をスリム化します。