# ScopeManagerPanel 分割リファクタリング計画

## 1. 現状分析

### 1.1 現在の責任領域

- UI 管理: WebView パネル生成と初期化、HTML コンテンツ提供
- 認証・権限管理: 認証状態確認、権限チェック、トークン有効期限監視
- プロジェクト管理: プロジェクト作成、読み込み、選択、削除
- ファイルシステム操作: ディレクトリ構造取得、ファイル読み書き、監視
- マークダウン処理: CURRENT_STATUS.md の読み込みと表示
- 共有機能: テキスト・画像の共有、共有履歴管理
- ClaudeCode 連携: プロンプトの取得と ClaudeCode の起動
- モックアップギャラリー: モックアップ表示と管理

### 1.2 問題点

- 過剰な責任: 単一クラスに多すぎる責任と機能が集中している
- 高い複雑性: 約 2,100 行のコードで、理解と保守が難しい
- 重複ロジック: 似たような処理が複数の場所に散らばっている
- 密結合: 複数のサービスや API への強い依存関係がある
- 状態管理の分散: 状態がクラス全体に分散し、一貫性の維持が困難
- テストの困難さ: 単体テストが困難な大きなクラスになっている

### 1.3 依存関係

- 内部依存: クラス内のメソッド間の相互依存が多数ある
- 外部依存:
  - VS Code API (vscode)
  - ファイルシステム (fs, path)
  - Logger
  - FileOperationManager
  - ClaudeCodeLauncherService
  - ClaudeCodeIntegrationService
  - AppGeniusEventBus
  - AuthenticationService / SimpleAuthManager
  - ClaudeCodeApiClient
  - PromptServiceClient
  - ClaudeCodeSharingService
  - AuthGuard
- 外部からの参照:
  - extension.ts - createOrShow メソッドを呼び出し

## 2. 分割計画

### 2.1 新ファイル構造

/ui/scopeManager/
  |- ScopeManagerPanel.ts           # メインパネルクラス(コントローラー)
  |- viewModel/
  |  |- ScopeManagerViewModel.ts    # 状態管理・ビジネスロジック集約
  |  |- WebViewMessageHandler.ts    # WebView メッセージ処理
  |- services/
  |  |- FileSystemService.ts        # ファイル操作・監視
  |  |- ProjectService.ts           # プロジェクト管理
  |  |- SharingService.ts           # 共有機能
  |  |- AuthenticationHandler.ts    # 認証・権限管理
  |- utils/
     |- WebViewGenerator.ts         # WebView HTML 生成

### 2.2 依存関係図

                      ┌─────────────────────┐
                      │  ScopeManagerPanel  │
                      └──────────┬──────────┘
                                 │
                      ┌──────────┴──────────┐
                      │ ScopeManagerViewModel│
                      └──────────┬──────────┘
                                 │
       ┌──────────────┬──────────┼──────────┬──────────────┐
       │              │          │          │              │
  ┌────┴─────┐  ┌─────┴────┐ ┌───┴────┐ ┌───┴────┐  ┌─────┴─────┐
  │FileSystem│  │Project   │ │Sharing │ │Auth    │  │WebView    │
  │Service   │  │Service   │ │Service │ │Handler │  │Generator  │
  └──────────┘  └──────────┘ └────────┘ └────────┘  └───────────┘

## 3. 段階的実装計画

### 3.1 フェーズ1: 基本インターフェース定義

1. 各サービスのインターフェースを定義
2. ScopeManagerViewModel の基本クラスを作成
3. プロジェクト全体の TypeScript コンパイルが通るか確認

### 3.2 フェーズ2: WebViewMessageHandler の実装

1. WebView メッセージ処理をコマンドパターンで実装
2. メッセージハンドラーを ScopeManagerPanel から切り離し
3. テスト用プロキシ層を実装して挙動を確認

### 3.3 フェーズ3: FileSystemService の実装

1. ファイル操作関連のメソッドを移行
2. ディレクトリ構造の取得ロジックを移行
3. ファイル監視機能を移行

### 3.4 フェーズ4: ProjectService の実装

1. プロジェクト関連のメソッドを移行
2. ProjectManagementService との連携部分を整理
3. プロジェクト状態の永続化を改善

### 3.5 フェーズ5: 共有・認証関連サービスの実装

1. SharingService の実装
2. AuthenticationHandler の実装
3. WebViewGenerator の実装

### 3.6 フェーズ6: ScopeManagerViewModel の完成

1. すべてのビジネスロジックを移行
2. 状態管理を一元化
3. イベント管理を整理

### 3.7 フェーズ7: ScopeManagerPanel のシンプル化

1. コントローラーとしての役割に限定
2. 残りのコードをリファクタリング
3. パフォーマンスの最適化

## 4. インターフェース設計

### 4.1 FileSystemService インターフェース

```typescript
export interface IFileSystemService {
  // ファイル操作
  readMarkdownFile(filePath: string): Promise<string>;
  createDefaultStatusFile(projectPath: string): Promise<void>;

  // ディレクトリ操作
  getDirectoryStructure(projectPath: string): Promise<string>;
  ensureDirectoryExists(dirPath: string): Promise<void>;

  // ファイル監視
  setupFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable;

  // イベント
  onStatusFileChanged: vscode.Event<string>;
}
```

### 4.2 ProjectService インターフェース

```typescript
export interface IProjectService {
  // プロジェクト操作
  createProject(name: string, description: string): Promise<string>;
  loadExistingProject(projectPath: string): Promise<IProjectInfo>;
  selectProject(name: string, path: string, activeTab?: string): Promise<void>;
  removeProject(name: string, path: string, id?: string): Promise<boolean>;

  // プロジェクト情報
  getActiveProject(): IProjectInfo | null;
  getAllProjects(): IProjectInfo[];

  // タブ状態管理
  saveTabState(projectId: string, tabId: string): Promise<void>;

  // イベント
  onProjectSelected: vscode.Event<IProjectInfo>;
  onProjectCreated: vscode.Event<IProjectInfo>;
  onProjectRemoved: vscode.Event<IProjectInfo>;
}
```

### 4.3 SharingService インターフェース

```typescript
export interface ISharingService {
  // 共有機能
  shareText(text: string, options?: FileSaveOptions): Promise<SharedFile>;
  shareImage(imageData: string, fileName: string): Promise<SharedFile>;

  // 履歴管理
  getHistory(): SharedFile[];
  deleteFromHistory(fileId: string): boolean;
  recordAccess(fileId: string): void;

  // コマンド生成
  generateCommand(file: SharedFile): string;

  // クリーンアップ
  cleanupExpiredFiles(): void;

  // イベント
  onHistoryUpdated: vscode.Event<SharedFile[]>;
}
```

### 4.4 AuthenticationHandler インターフェース

```typescript
export interface IAuthenticationHandler {
  // 認証チェック
  checkLoggedIn(): boolean;
  checkPermission(feature: Feature): boolean;

  // 監視
  setupTokenExpirationMonitor(onExpired: () => void): vscode.Disposable;

  // イベント
  onAuthStateChanged: vscode.Event<AuthState>;
}
```

### 4.5 ScopeManagerViewModel インターフェース

```typescript
export interface IScopeManagerViewModel {
  // 状態
  readonly projectPath: string;
  readonly statusFilePath: string;
  readonly directoryStructure: string;
  readonly activeProject: IProjectInfo | null;
  readonly projects: IProjectInfo[];

  // 初期化
  initialize(): Promise<void>;

  // プロジェクト操作
  setProjectPath(projectPath: string): Promise<void>;
  createProject(name: string, description: string): Promise<void>;
  loadExistingProject(): Promise<void>;
  selectProject(name: string, path: string, activeTab?: string): Promise<void>;
  removeProject(name: string, path: string, id?: string): Promise<void>;

  // ファイル操作
  getMarkdownContent(filePath: string): Promise<string>;
  showDirectoryStructure(): Promise<string>;

  // タブ操作
  saveTabState(tabId: string): Promise<void>;

  // 共有機能
  shareText(text: string, suggestedFilename?: string): Promise<SharedFile>;
  shareImage(imageData: string, fileName: string): Promise<SharedFile>;
  getHistory(): SharedFile[];
  deleteFromHistory(fileId: string): Promise<void>;

  // ClaudeCode 連携
  launchPromptFromURL(url: string, index: number, name?: string): Promise<void>;

  // モックアップ
  openMockupGallery(filePath?: string): Promise<void>;

  // イベント
  onStateChanged: vscode.Event<ScopeManagerStateChangeEvent>;
  onError: vscode.Event<string>;
  onSuccess: vscode.Event<string>;
}
```

## 5. 検証計画

1. 初期表示確認
  - ScopeManagerPanel が正常に表示されるか
  - 認証・権限チェックが正常に機能するか
2. プロジェクト機能テスト
  - 新規プロジェクト作成
  - 既存プロジェクト読み込み
  - プロジェクト間の切り替え
  - プロジェクト削除
3. ファイル操作テスト
  - CURRENT_STATUS.md の表示
  - ディレクトリ構造の表示
  - ファイル変更の監視と更新
4. 共有機能テスト
  - テキスト共有
  - 画像共有
  - 履歴表示と管理
5. ClaudeCode 連携テスト
  - プロンプト URL からの ClaudeCode 起動
6. 認証・権限テスト
  - 認証状態変更時の挙動
  - 権限失効時の挙動

## 6. 期待される効果

- コード可読性: クラスのサイズが小さくなり、責任範囲が明確になる
- メンテナンス性: 独立したモジュールにより、変更の影響範囲が限定される
- 拡張性: 機能追加が容易になり、新機能の実装がシンプルに
- パフォーマンス: 必要なモジュールのみを読み込むことで起動が高速化
- テスト容易性: 各モジュールが独立してテスト可能になる
- コラボレーション: 複数の開発者が並行して作業しやすくなる

## 7. リスクと対策

1. 既存機能の互換性
  - 対策: 段階的リファクタリングと環境変数による切り替え
  - 対策: 各フェーズの完了後に包括的テストを実施
2. 未知の依存関係
  - 対策: 依存関係を明示的に宣言し、DI パターンを活用
  - 対策: リファクタリング中に発見された依存関係を文書化
3. パフォーマンス低下
  - 対策: パフォーマンスのボトルネックを特定してプロファイリング
  - 対策: 必要に応じて遅延読み込みや最適化を実施
4. 学習コスト
  - 対策: 詳細な文書化とコードコメントの充実
  - 対策: 段階的な導入と関係者へのトレーニング

このリファクタリング計画に従って実装を進めることで、ScopeManagerPanel の保守性と拡張性を大幅に向上させることができます。各フェーズを慎重に進め、継続的なテストを行うことで、リスクを最小限に抑えながら改善を実現します。