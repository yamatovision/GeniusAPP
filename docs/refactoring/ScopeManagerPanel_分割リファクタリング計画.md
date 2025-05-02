# ScopeManagerPanel 分割リファクタリング計画（改訂版）

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

機能ごとに明確に分離した構造を採用します：

```
/ui/scopeManager/
  |- ScopeManagerPanel.ts           # メインパネルクラス（コントローラー役割のみ）
  |- services/
     |- FileSystemService.ts        # ファイル操作・監視機能
     |- ProjectService.ts           # プロジェクト管理機能
     |- SharingService.ts           # 共有機能
     |- AuthenticationHandler.ts    # 認証・権限管理機能
```

### 2.2 依存関係図

```
                 ┌──────────────────────┐
                 │   ScopeManagerPanel  │ ◄────┐
                 │ (UI Controller Only) │      │
                 └───────┬──────┬───────┘      │
                         │      │              │
                         ▼      ▼              │
          ┌──────────────┐    ┌──────────────┐ │
          │ FileSystem   │    │ Project      │ │
          │ Service      │    │ Service      │ │
          └──────────────┘    └──────────────┘ │
                                               │
                         ┌──────────────┐      │
                         │ Sharing      │      │
                         │ Service      │──────┘
                         └──────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Auth         │
                         │ Handler      │
                         └──────────────┘
```

この依存関係構造は:
- 各サービスが明確な機能責任を持つ
- ScopeManagerPanelが各サービスを利用する（単方向の依存）
- サービス間の相互依存を最小限に抑える

## 3. 段階的実装計画

### 3.1 フェーズ1: 基本サービスの実装と強化

1. 既に実装されているFileSystemServiceとProjectServiceの機能を完成させる
2. 各サービスでイベント発行の仕組みを充実させる
3. プロジェクト全体のTypeScriptコンパイルが通るか確認

### 3.2 フェーズ2: SharingServiceの実装

1. 共有機能（テキスト・画像共有）の実装
2. 履歴管理機能の実装
3. イベント通知の実装

### 3.3 フェーズ3: AuthenticationHandlerの実装

1. 認証・権限チェック機能の実装
2. トークン監視機能の実装
3. 認証状態イベントの実装

### 3.4 フェーズ4: ScopeManagerPanelの簡素化

1. WebViewとのメッセージ処理を整理し、サービスへの委譲を明確化
2. UIイベント処理だけに責任を限定する
3. 不要になったコードを削除

## 4. インターフェース設計

### 4.1 FileSystemService インターフェース

```typescript
export interface IFileSystemService {
  // ファイル操作
  readMarkdownFile(filePath: string): Promise<string>;
  createDefaultStatusFile(projectPath: string, projectName?: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  
  // ディレクトリ操作
  getDirectoryStructure(projectPath: string): Promise<string>;
  ensureDirectoryExists(dirPath: string): Promise<void>;
  
  // ファイル監視
  setupFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void): vscode.Disposable;
  setupEnhancedFileWatcher(statusFilePath: string, onFileChanged: (filePath: string) => void, 
                           options?: { delayedReadTime?: number }): vscode.Disposable;
  
  // イベント
  onStatusFileChanged: vscode.Event<string>;
  
  // リソース解放
  dispose(): void;
}
```

### 4.2 ProjectService インターフェース

```typescript
export interface IProjectService {
  // プロジェクト操作
  createProject(name: string, description: string): Promise<string>;
  loadExistingProject(): Promise<IProjectInfo>;
  selectProject(name: string, path: string, activeTab?: string): Promise<void>;
  removeProject(name: string, path: string, id?: string): Promise<boolean>;
  setProjectPath(projectPath: string): Promise<void>;
  
  // プロジェクト情報
  getActiveProject(): IProjectInfo | null;
  getAllProjects(): IProjectInfo[];
  getStatusFilePath(): string;
  
  // タブ状態管理
  saveTabState(projectId: string, tabId: string): Promise<void>;
  
  // イベント
  onProjectSelected: vscode.Event<IProjectInfo>;
  onProjectCreated: vscode.Event<IProjectInfo>;
  onProjectRemoved: vscode.Event<IProjectInfo>;
  onProjectsUpdated: vscode.Event<IProjectInfo[]>;
  
  // リソース解放
  dispose(): void;
}
```

### 4.3 SharingService インターフェース

```typescript
export interface ISharingService {
  // 共有機能
  shareText(text: string, options?: FileSaveOptions): Promise<SharedFile>;
  shareBase64Image(imageData: string, fileName: string): Promise<SharedFile>;
  setProjectBasePath(projectPath: string): void;
  
  // 履歴管理
  getHistory(): SharedFile[];
  deleteFromHistory(fileId: string): boolean;
  recordAccess(fileId: string): void;
  
  // コマンド生成
  generateCommand(file: SharedFile): string;
  
  // クリーンアップ
  cleanupExpiredFiles(): void;
  
  // リソース解放
  dispose(): void;
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
  
  // リソース解放
  dispose(): void;
}
```

## 5. ScopeManagerPanelの役割

ScopeManagerPanelはMVCパターンにおけるコントローラーとしての役割に特化します：

1. WebViewパネルの生成・表示・初期化
2. WebViewとのメッセージ送受信
3. 各種サービスの初期化と利用
4. UIイベントのサービスへの委譲
5. サービスからの結果をUIに反映

**重要**: 複雑なビジネスロジックは各サービスに委譲し、ScopeManagerPanelはUI管理に責任を限定します。

## 6. 検証計画

1. 機能テスト
   - 各サービスの個別機能が正常に動作するか
   - サービス間の連携が正常に機能するか
   - UIからの操作が正しくサービスに伝わるか

2. イベント処理テスト
   - サービスからのイベントがUIに反映されるか
   - UIからのイベントがサービスに伝わるか
   - 非同期処理が正常に完了するか

3. エラー処理テスト
   - 各種エラーが適切に処理されるか
   - エラーメッセージがUIに表示されるか

4. パフォーマンステスト
   - リファクタリング前後でパフォーマンスの変化はないか
   - 大量のデータ処理時に問題が発生しないか

## 7. 期待される効果

- **コード可読性の向上**: 各ファイルが1つの明確な責任を持ち、理解が容易になる
- **保守性の向上**: 機能修正が関連するサービスだけに限定される
- **テスト容易性**: 各サービスを個別にテスト可能
- **拡張性の向上**: 新機能追加時に適切なサービスを拡張するだけでよい
- **再利用性**: サービスは他のコンポーネントからも利用可能
- **チーム開発の効率向上**: 開発者がそれぞれ異なるサービスを担当可能

## 8. リスク対策

1. **機能の欠落**
   - リファクタリング前に全機能の動作確認を行う
   - 機能ごとに段階的にリファクタリングし、都度テストする

2. **非互換性の発生**
   - API設計段階で互換性を慎重に検討
   - 既存の呼び出し方法を維持するラッパーメソッドを用意

3. **パフォーマンス低下**
   - リファクタリング前後でパフォーマンス比較を行う
   - ボトルネックが見つかった場合は最適化を実施

4. **エラー処理の漏れ**
   - 一貫したエラー処理パターンを定義
   - すべての非同期処理で適切なエラーハンドリングを実装

このリファクタリング計画は、コードの責任範囲を明確に区分し、機能ごとに適切に分割することで、保守性と拡張性を大幅に向上させます。各機能が独立したサービスとして実装されることで、変更の影響範囲が限定され、より安全な開発が可能になります。