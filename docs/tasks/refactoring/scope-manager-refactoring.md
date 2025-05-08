# スコープマネージャー リファクタリング計画

## 目的

ScopeManagerPanel.tsが機能追加により肥大化し、管理や拡張が困難になっているため、単一責任の原則に基づいて複数のサービスに分割し、保守性と拡張性を向上させる。

## 現状の課題

1. **ファイルサイズの肥大化**: ScopeManagerPanel.tsが大きすぎてコード理解や修正が困難
2. **責務の混在**: UI管理、認証、プロジェクト管理、ファイル操作などの複数の責務が混在
3. **テスト困難性**: 機能が密結合しており、ユニットテストが困難
4. **機能追加の複雑さ**: 新機能追加のたびにファイルが更に肥大化

## リファクタリングの原則

1. **段階的移行**: 一度に全機能を移行せず、サービスごとに段階的に実装
2. **単一責任**: 各サービスは明確に定義された単一の責務を持つ
3. **インターフェース駆動設計**: 各サービスはインターフェースを介して連携
4. **並行実行期間**: 新旧コードを一定期間共存させ、安全に移行

## ScopeManagerPanel.tsの責務分析

現在、ScopeManagerPanel.tsには以下の責務が混在しています：

1. **UI管理**
   - WebViewパネルの作成・更新・表示
   - エラーや成功メッセージの表示

2. **認証処理**
   - 認証状態の確認
   - 認証失敗時のリダイレクト

3. **プロジェクト管理**
   - プロジェクトの選択・作成・読み込み・削除

4. **ファイル操作**
   - マークダウンファイルの読み込み
   - ディレクトリ構造の取得
   - ファイル監視

5. **状態管理**
   - タブ状態の保存・復元
   - プロジェクト状態の同期

6. **メッセージ処理**
   - WebViewからのメッセージ受信と処理
   - WebViewへのメッセージ送信

7. **ファイル共有**
   - テキスト・画像の共有
   - 共有履歴の管理

8. **モックアップ管理**
   - モックアップギャラリーの表示
   - モックアップファイルの管理

## ScopeManagerPanel.tsのメソッド一覧

詳細な分析の結果、以下のメソッドが確認されました：

### 1. 初期化と基本構造

- `public static createOrShow(extensionUri, context, projectPath?)`: パネルの作成・表示
- `constructor(panel, extensionUri, context, projectPath?)`: コンストラクタ
- `private _setupTokenExpirationMonitor()`: トークン期限監視設定
- `private _setupProjectServiceEventListeners()`: プロジェクトサービスのイベント監視設定
- `private _getNonce()`: セキュリティノンス生成
- `private _update()`: WebViewの内容更新
- `private _getHtmlForWebview(webview, activeTabId)`: WebView用HTML生成
- `public dispose()`: リソースの解放

### 2. UI管理と表示

- `private _showError(message)`: エラーメッセージを表示
- `private _showSuccess(message)`: 成功メッセージを表示
- `private async _handleShowDirectoryStructure()`: ディレクトリ構造を表示

### 3. プロジェクト管理

- `public async setProjectPath(projectPath)`: プロジェクトパスを設定
- `private async _handleCreateProject(projectName, description)`: 新規プロジェクト作成
- `private async _handleLoadExistingProject()`: 既存プロジェクト読み込み
- `private async _handleSelectProject(projectName, projectPath, activeTab?)`: プロジェクト選択
- `private async _handleRemoveProject(projectName, projectPath, projectId?)`: プロジェクト登録解除
- `private async _handleEnsureActiveProject(projectName, projectPath, activeTab?)`: プロジェクト同期確認

### 4. ファイル操作

- `private async _handleRefreshFileBrowser()`: ファイルブラウザ更新
- `private async _handleListDirectory(dirPath?)`: ディレクトリ内容のリストアップ
- `private async _handleOpenFileInEditor(filePath)`: ファイルをエディタで開く
- `private async _handleNavigateDirectory(dirPath)`: ディレクトリに移動
- `private async _handleOpenFile(filePath)`: ファイルを開いてプレビュー表示
- `private async _handleGetMarkdownContent(filePath)`: マークダウンファイル内容を取得

### 5. タブとコンテンツ管理

- `private async _handleInitialize()`: 初期化処理
- `private async _handleLoadRequirementsFile()`: 要件定義ファイル読み込み
- `private async _handleLoadFileToTab(tabId, filePath)`: タブにファイルを読み込み
- `private async _handleSaveTabState(tabId)`: タブ状態を保存

### 6. 共有機能

- `private async _handleShareText(text, suggestedFilename?)`: テキスト共有
- `private async _handleShareImage(imageData, fileName)`: 画像共有
- `private async _handleGetHistory()`: 共有履歴取得
- `private async _handleDeleteFromHistory(fileId)`: 履歴から削除
- `private async _handleCopyCommand(fileId)`: ファイルのコマンドをコピー
- `private async _handleCopyToClipboard(text)`: テキストをクリップボードにコピー
- `private async _handleReuseHistoryItem(fileId)`: 履歴アイテムを再利用

### 7. ClaudeCode連携

- `private async _handleLaunchPromptFromURL(url, index, name?, splitTerminal?)`: プロンプトURLからClaudeCode起動

### 8. モックアップ管理

- `private async _handleOpenMockupGallery(filePath?)`: モックアップギャラリーを開く
- `private async _handleOpenOriginalMockupGallery(filePath?)`: 旧メソッドでの互換性維持
- `private async _handleSelectMockup(filePath)`: モックアップファイル選択
- `private async _handleOpenMockupInBrowser(filePath)`: モックアップをブラウザで開く

## 新サービス構造

これらの責務を以下の新しいサービスに分割します：

### 1. `UIStateService` - UI状態管理

```typescript
export interface IUIStateService {
  updateUI(): void;
  showDirectoryStructure(structure: string): void;
  showError(message: string): void;
  showSuccess(message: string): void;
  onWebviewReady: vscode.Event<void>;
}
```

### 2. `MessageDispatchService` - メッセージ処理

```typescript
export interface IMessageDispatchService {
  initialize(): Promise<void>;
  registerMessageHandlers(): void;
  handleMessage(message: any): Promise<void>;
  sendMessage(command: string, payload: any): void;
  onMessageReceived: vscode.Event<any>;
}
```

### 3. `TabStateService` - タブ管理

```typescript
export interface ITabStateService {
  saveTabState(tabId: string): Promise<void>;
  loadTabContent(tabId: string, filePath: string): Promise<void>;
  selectTab(tabId: string): Promise<void>;
  updateTabContent(tabId: string, content: string, filePath?: string): Promise<void>;
  onTabStateChanged: vscode.Event<{tabId: string, active: boolean}>;
}
```

### 4. `MarkdownService` - マークダウン処理

```typescript
export interface IMarkdownService {
  loadMarkdownFile(filePath: string): Promise<string>;
  getMarkdownContent(filePath: string): Promise<void>;
  loadRequirementsFile(): Promise<void>;
  updateMarkdownContent(content: string, options?: any): Promise<void>;
  onMarkdownUpdated: vscode.Event<{content: string, filePath: string}>;
}
```

## 既存サービスとの連携

既に分離されている以下のサービスとの連携を維持・強化します：

- `FileSystemService` - ファイル操作
- `ProjectService` - プロジェクト管理
- `SharingService` - ファイル共有
- `AuthenticationHandler` - 認証処理

## サービス間の関係

```
ScopeManagerPanel (コーディネーター)
  ├── UIStateService (新規)
  ├── MessageDispatchService (新規)
  ├── TabStateService (新規)
  ├── MarkdownService (新規)
  ├── FileSystemService (既存)
  ├── ProjectService (既存)
  ├── SharingService (既存)
  └── AuthenticationHandler (既存)
```

## リファクタリング後のScopeManagerPanel

```typescript
export class ScopeManagerPanel extends ProtectedPanel {
  // 最小限のプロパティと、サービスをまとめたオブジェクト
  private readonly _panel: vscode.WebviewPanel;
  private readonly _services: {
    ui: IUIStateService;
    message: IMessageDispatchService;
    tab: ITabStateService;
    markdown: IMarkdownService;
    file: IFileSystemService;
    project: IProjectService;
    sharing: ISharingService;
    auth: IAuthenticationHandler;
  };
  
  // 初期化と調整ロジックのみを担当
  private constructor(panel, extensionUri, context, projectPath?) {
    // サービスの初期化と接続
  }
  
  private _update(): void {
    // UIの更新のみを担当
    this._services.ui.updateUI();
  }
  
  public dispose(): void {
    // 各サービスのリソース解放
  }
}
```

## フロントエンド（scopeManager.js）との関係

scopeManager.jsは既にコンポーネント分割が進んでいるため、バックエンド（ScopeManagerPanel.ts）のリファクタリングに合わせてメッセージの送受信部分を適応させます。基本的にはscopeManager.jsはそのままの構成で、バックエンドからのメッセージ処理を調整します。

## 新サービスへの関数移行計画

### 1. UIStateService への移行メソッド
- `_showError`
- `_showSuccess`
- `_update`
- `_getHtmlForWebview`
- `_handleShowDirectoryStructure`

### 2. MessageDispatchService への移行メソッド
- WebViewからのメッセージ受信処理
- WebViewへのメッセージ送信処理
- `_handleInitialize`

### 3. TabStateService への移行メソッド
- `_handleSaveTabState`
- `_handleLoadFileToTab`
- タブの選択・切り替え処理

### 4. MarkdownService への移行メソッド
- `_handleGetMarkdownContent`
- `_handleLoadRequirementsFile`
- マークダウン更新関連処理

### 5. 既存サービスへの機能拡充
- **FileSystemService**: ファイルブラウザ関連のメソッド
- **ProjectService**: プロジェクト管理関連のメソッド
- **SharingService**: 共有機能関連のメソッド
- **AuthenticationHandler**: 認証関連のメソッド

## 詳細実装ステップ

### フェーズ1: 準備と分析 (2日)

1. [ ] 全メソッドの依存関係を詳細に分析
2. [ ] 各サービスのインターフェース詳細設計
3. [ ] リファクタリング中の品質保証計画作成
4. [ ] 既存コードにコメント追加（リファクタリング対象マーキング）

### フェーズ2: UIStateServiceの実装 (2日)

1. [ ] IUIStateServiceインターフェース作成
2. [ ] UIStateService実装クラス作成
3. [ ] ScopeManagerPanelからUI関連メソッドの移行:
   - [ ] _showError
   - [ ] _showSuccess
   - [ ] _update
   - [ ] _getHtmlForWebview
   - [ ] _handleShowDirectoryStructure
4. [ ] ScopeManagerPanelとUIStateServiceの連携テスト

### フェーズ3: MessageDispatchServiceの実装 (3日)

1. [ ] IMessageDispatchServiceインターフェース作成
2. [ ] MessageDispatchService実装クラス作成
3. [ ] メッセージハンドラーの移行:
   - [ ] WebViewからのメッセージ受信処理
   - [ ] コマンドタイプ別の処理振り分け
   - [ ] WebViewへのメッセージ送信処理
   - [ ] _handleInitialize
4. [ ] ScopeManagerPanelとMessageDispatchServiceの連携テスト

### フェーズ4: TabStateServiceの実装 (2日)

1. [ ] ITabStateServiceインターフェース作成
2. [ ] TabStateService実装クラス作成
3. [ ] タブ関連メソッドの移行:
   - [ ] _handleSaveTabState
   - [ ] _handleLoadFileToTab
   - [ ] タブの選択処理
   - [ ] _handleLoadRequirementsFile（タブ切り替え部分）
4. [ ] ScopeManagerPanelとTabStateServiceの連携テスト

### フェーズ5: MarkdownServiceの実装 (2日)

1. [ ] IMarkdownServiceインターフェース作成
2. [ ] MarkdownService実装クラス作成
3. [ ] マークダウン関連メソッドの移行:
   - [ ] _handleGetMarkdownContent
   - [ ] _handleLoadRequirementsFile（マークダウン部分）
   - [ ] _loadStatusFile
4. [ ] ScopeManagerPanelとMarkdownServiceの連携テスト

### フェーズ6: ScopeManagerPanelの改修 (3日)

1. [ ] サービスの連携ロジック実装
2. [ ] コンストラクタの単純化
3. [ ] メッセージハンドリングの委譲
4. [ ] リソース管理の改善
5. [ ] 不要になったメソッドとプロパティの削除

### フェーズ7: 統合とテスト (3日)

1. [ ] すべてのサービスの統合
2. [ ] エラー処理の改善
3. [ ] 全機能のテスト
4. [ ] パフォーマンステスト
5. [ ] メモリリーク確認

### フェーズ8: ドキュメント作成とクリーンアップ (1日)

1. [ ] 各サービスの使用方法ドキュメント作成
2. [ ] コードコメント改善
3. [ ] 不要なコードの削除
4. [ ] コードスタイルの統一

## 検証方法

1. **機能テスト**: 各機能が正常に動作することを確認
2. **エラーハンドリング**: エラーケースでの動作確認
3. **パフォーマンス**: リファクタリング前後のパフォーマンス比較
4. **メモリ使用量**: リソースリークがないことを確認

## リスクと対策

1. **機能破壊リスク**: 
   - 対策: 段階的な移行と各フェーズでの詳細テスト

2. **パフォーマンス低下リスク**: 
   - 対策: パフォーマンスメトリクスの監視と最適化

3. **依存関係の複雑化リスク**: 
   - 対策: 明確なインターフェース定義と依存関係の文書化

## 期待される効果

1. **コードの保守性向上**: 単一責任の原則に従ったコード構造
2. **拡張性の向上**: 新機能追加が容易になる
3. **テスト容易性**: 各サービスの単体テストが可能に
4. **開発効率の向上**: 複数の開発者が並行して作業可能に

## 完了条件

1. 全ての機能が正常に動作すること
2. ScopeManagerPanelの行数が50%以上削減されていること
3. 各サービスが明確に文書化されていること
4. すべてのUI機能が正常に動作すること