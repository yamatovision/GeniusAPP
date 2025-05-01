# ScopeManagerPanelリファクタリングプラン - 削除と単純化

## 1. リファクタリングの概要

### 主な問題点
- 単一クラスに多すぎる責任が集中している
- 状態管理が複雑で散在している
- 非同期処理の取り扱いが不統一
- 重複したコードが多い
- メソッドが肥大化している

### リファクタリングの目標
- 関心事の分離による単一責任の確立
- 状態管理の一元化と簡素化
- 非同期処理の統一的な取り扱い
- コード量の削減と再利用性の向上
- インターフェースの簡略化

### 期待される効果
- コードの可読性と保守性の向上
- バグの発生確率の低減
- 機能拡張の容易化
- パフォーマンスの向上
- テスト容易性の向上

## 2. 削除計画

### 完全に削除できるコード
- 旧バージョンとの互換性のためだけのレガシーメソッド（例：`_handleOpenOriginalMockupGallery`）
- 未使用の変数やインポート（`_docsDirWatcher`など）
- 冗長なログ出力
- 過剰なエラーハンドリング

### 簡素化できる冗長な処理
- プロジェクト関連処理の重複コード
- 共有機能の複雑な実装
- 遅延処理（`setTimeout`の使用）を適切な非同期処理に置き換え

## 3. 責任分離計画

### 新たに作成するクラス/サービス

1. **ScopeManagerViewModel**
   - WebView状態の管理
   - UIイベントの処理
   - データ表示のフォーマット

2. **ProjectService**
   - プロジェクト作成・読み込み・選択処理
   - プロジェクト状態管理
   - プロジェクト一覧管理

3. **FileSystemService**
   - ファイルの読み書き
   - ディレクトリ構造の取得
   - ファイル監視

4. **SharingService**
   - テキスト・画像の共有
   - 共有履歴の管理
   - コマンド生成

5. **WebViewMessageHandler**
   - WebViewメッセージの処理ルーティング
   - コマンドディスパッチ

6. **AuthenticationHandler**
   - 認証状態監視
   - 権限チェック

### 各クラスの役割と責任

#### ScopeManagerPanel
- WebViewパネルの初期化と表示
- イベントのルーティングと委譲
- リソースの破棄と管理

#### ScopeManagerViewModel
- WebViewに表示するデータの管理
- UI状態の変更通知
- ユーザーインタラクションの処理

### メソッドの移動先

| 現在のメソッド | 移動先クラス |
|--------------|------------|
| `_handleCreateProject`, `_handleLoadExistingProject`, `_handleSelectProject`, `_handleRemoveProject` | `ProjectService` |
| `_updateDirectoryStructure`, `_setupFileWatcher`, `_loadStatusFile`, `_handleGetMarkdownContent` | `FileSystemService` |
| `_handleShareText`, `_handleShareImage`, `_handleGetHistory` | `SharingService` |
| WebViewメッセージ受信処理 | `WebViewMessageHandler` |
| `_setupTokenExpirationMonitor` | `AuthenticationHandler` |
| `_getHtmlForWebview`, `_update` | `ScopeManagerPanel`（簡素化） |

## 4. 実装計画と移行ステップ

### ステップ1: 基盤となるサービスクラスの作成
1. 各サービスクラスをシングルトンパターンで実装
2. インターフェースを定義して依存性を明確化
3. サービス間の通信をイベントバスで実現

### ステップ2: 状態管理の一元化
1. ViewModelパターンを導入し、UIの状態とビジネスロジックを分離
2. リアクティブな状態更新メカニズムを実装

### ステップ3: 段階的なメソッド移行
1. 最も独立性の高いメソッドから移行を開始（共有機能など）
2. 各移行後に機能をテスト
3. 依存関係が複雑なメソッドは最後に移行

### ステップ4: インターフェース調整と非同期処理の改善
1. 非同期処理を一貫したパターンに統一
2. エラーハンドリングを一元化
3. WebViewとの通信プロトコルを簡素化

### ステップ5: 最終クリーンアップ
1. 未使用コードの削除
2. クラス間の結合度のチェックと調整
3. パフォーマンス最適化

## 5. リファクタリング後のコード構造

### ディレクトリ構造
```
/ui/scopeManager/
  |- ScopeManagerPanel.ts        # メインパネルクラス（ViewModel利用）
  |- viewModel/
  |  |- ScopeManagerViewModel.ts # UI状態管理
  |  |- WebViewMessageHandler.ts # メッセージ処理
  |- services/
  |  |- ProjectService.ts        # プロジェクト管理
  |  |- FileSystemService.ts     # ファイル操作
  |  |- SharingService.ts        # 共有機能
  |  |- AuthenticationHandler.ts # 認証管理
  |- types/
  |  |- ScopeManagerTypes.ts     # 型定義
  |- utils/
     |- WebViewUtils.ts          # WebView共通機能
```

### 主要クラスの骨格コード例

#### ScopeManagerPanel（簡素化版）
```typescript
export class ScopeManagerPanel extends ProtectedPanel {
  public static currentPanel: ScopeManagerPanel | undefined;
  private static readonly viewType = 'scopeManager';
  protected static readonly _feature: Feature = Feature.SCOPE_MANAGER;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  
  private _viewModel: ScopeManagerViewModel;
  private _messageHandler: WebViewMessageHandler;

  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string): ScopeManagerPanel | undefined {
    // 認証・権限チェックのみ行い、ロジックはAuthHandlerに委譲
    if (!AuthenticationHandler.getInstance().checkAccess()) {
      return undefined;
    }

    // パネル作成または既存パネル取得のロジック
    // ...

    return ScopeManagerPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, projectPath?: string) {
    super();
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // ViewModelの初期化
    this._viewModel = new ScopeManagerViewModel(context);
    
    // メッセージハンドラの初期化
    this._messageHandler = new WebViewMessageHandler(this._panel.webview, this._viewModel);
    
    // プロジェクトパスの設定（あれば）
    if (projectPath) {
      this._viewModel.setProjectPath(projectPath);
    }
    
    // WebViewの初期化
    this._initializeWebView();
    
    // イベントリスナーの設定
    this._registerEventListeners();
  }

  private _initializeWebView(): void {
    this._panel.webview.html = WebViewUtils.getHtmlForWebview(
      this._panel.webview, 
      this._extensionUri,
      'scopeManager'
    );
  }

  private _registerEventListeners(): void {
    // パネル破棄イベント
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    // パネル表示状態変更イベント
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._viewModel.refreshState();
        }
      },
      null,
      this._disposables
    );
    
    // WebViewからのメッセージ受信イベント
    this._panel.webview.onDidReceiveMessage(
      message => this._messageHandler.handleMessage(message),
      null,
      this._disposables
    );
  }

  public dispose(): void {
    if (ScopeManagerPanel.currentPanel === this) {
      ScopeManagerPanel.currentPanel = undefined;
    }
    
    // パネル破棄
    this._panel.dispose();
    
    // ViewModelのクリーンアップ
    this._viewModel.dispose();
    
    // Disposableの破棄
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
```

#### ScopeManagerViewModel
```typescript
export class ScopeManagerViewModel implements vscode.Disposable {
  private _projectService: ProjectService;
  private _fileSystemService: FileSystemService;
  private _sharingService: SharingService;
  private _authHandler: AuthenticationHandler;
  
  private _eventEmitter = new vscode.EventEmitter<ViewModelEvent>();
  public readonly onStateChanged = this._eventEmitter.event;
  
  constructor(context: vscode.ExtensionContext) {
    this._projectService = ProjectService.getInstance();
    this._fileSystemService = FileSystemService.getInstance();
    this._sharingService = new SharingService(context);
    this._authHandler = AuthenticationHandler.getInstance();
    
    // 初期状態の設定
    this._initializeState();
    
    // 各種サービスからのイベント購読
    this._subscribeToEvents();
  }
  
  // 公開API - 状態更新
  public setProjectPath(projectPath: string): void {
    this._projectService.setCurrentProjectPath(projectPath);
    this._fileSystemService.initializeForProject(projectPath);
  }
  
  public refreshState(): void {
    this._notifyStateChanged('full-refresh');
  }
  
  // 内部状態管理メソッド
  private _initializeState(): void {
    // プロジェクト一覧の読み込みなど
  }
  
  private _subscribeToEvents(): void {
    // 各サービスからのイベントリスナー設定
  }
  
  private _notifyStateChanged(type: string, data?: any): void {
    this._eventEmitter.fire({ type, data });
  }
  
  public dispose(): void {
    this._projectService.cleanup();
    this._fileSystemService.cleanup();
    this._sharingService.cleanupExpiredFiles();
    this._eventEmitter.dispose();
  }
}
```

#### WebViewMessageHandler
```typescript
export class WebViewMessageHandler {
  private _webview: vscode.Webview;
  private _viewModel: ScopeManagerViewModel;
  
  // 個別のハンドラーサービス
  private _projectHandler: ProjectMessageHandler;
  private _sharingHandler: SharingMessageHandler;
  private _fileHandler: FileMessageHandler;
  
  constructor(webview: vscode.Webview, viewModel: ScopeManagerViewModel) {
    this._webview = webview;
    this._viewModel = viewModel;
    
    // 個別ハンドラーの初期化
    this._projectHandler = new ProjectMessageHandler(viewModel, this);
    this._sharingHandler = new SharingMessageHandler(viewModel, this);
    this._fileHandler = new FileMessageHandler(viewModel, this);
    
    // ViewModelの状態変更イベントを購読してWebViewに通知
    this._viewModel.onStateChanged(e => this._handleStateChange(e));
  }
  
  // WebViewへのメッセージ送信
  public postMessage(message: any): void {
    this._webview.postMessage(message);
  }
  
  // WebViewからのメッセージ処理
  public async handleMessage(message: any): Promise<void> {
    try {
      const { command } = message;
      
      switch (command) {
        // プロジェクト関連コマンド
        case 'initialize':
        case 'loadExistingProject':
        case 'createProject':
        case 'selectProject':
        case 'removeProject':
          return this._projectHandler.handleMessage(message);
          
        // ファイル関連コマンド
        case 'showDirectoryStructure':
        case 'getMarkdownContent':
        case 'saveTabState':
          return this._fileHandler.handleMessage(message);
          
        // 共有関連コマンド
        case 'shareText':
        case 'shareImage':
        case 'getHistory':
        case 'deleteFromHistory':
        case 'copyCommand':
        case 'reuseHistoryItem':
          return this._sharingHandler.handleMessage(message);
          
        // その他のコマンド...
        default:
          Logger.warn(`不明なコマンド: ${command}`);
      }
    } catch (error) {
      Logger.error(`メッセージ処理エラー`, error as Error);
      this.showError(`操作に失敗しました: ${(error as Error).message}`);
    }
  }
  
  // ViewModelの状態変更を処理してWebViewに通知
  private _handleStateChange(event: ViewModelEvent): void {
    switch (event.type) {
      case 'project-changed':
        this.postMessage({
          command: 'updateProjects',
          projects: event.data.projects,
          activeProject: event.data.activeProject
        });
        break;
        
      case 'markdown-updated':
        this.postMessage({
          command: 'updateMarkdownContent',
          content: event.data.content
        });
        break;
        
      // その他のイベント...
    }
  }
  
  // ユーティリティメソッド
  public showError(message: string): void {
    this.postMessage({
      command: 'showError',
      message
    });
  }
  
  public showSuccess(message: string): void {
    this.postMessage({
      command: 'showSuccess',
      message
    });
  }
}
```

## 6. 期待される効果

- **コード量の削減**: 重複処理の排除と責任分離により、コード全体を20-30%削減
- **保守性の向上**: 単一責任の原則に従った設計により、変更の影響範囲が限定的に
- **テスト容易性**: 分離されたサービスは個別にテスト可能
- **拡張性**: 新機能追加時に既存コードへの影響を最小限に抑制
- **パフォーマンス**: 不要な処理の削減と最適化により、レスポンス向上

このリファクタリングプランは「削除と単純化」の原則に基づき、コード量を削減しながらも品質と保守性を高める設計を目指しています。段階的な実装により、既存機能を壊すリスクを最小限に抑えつつ、より堅牢なアーキテクチャへと移行できます。