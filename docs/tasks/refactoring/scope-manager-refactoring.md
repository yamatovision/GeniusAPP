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
- `private async _refreshProjects()`: プロジェクト一覧を更新

### 4. ファイル操作

- `private async _handleRefreshFileBrowser()`: ファイルブラウザ更新
- `private async _handleListDirectory(dirPath?)`: ディレクトリ内容のリストアップ
- `private async _handleOpenFileInEditor(filePath)`: ファイルをエディタで開く
- `private async _handleNavigateDirectory(dirPath)`: ディレクトリに移動
- `private async _handleOpenFile(filePath)`: ファイルを開いてプレビュー表示
- `private async _handleGetMarkdownContent(filePath)`: マークダウンファイル内容を取得
- `private async _loadProgressFile()`: 進捗ファイルを読み込む
- `private async _updateDirectoryStructure()`: ディレクトリ構造を更新
- `private async _setupFileWatcher()`: ファイル監視を設定
- `private async _initializeFileBrowser()`: ファイルブラウザを初期化

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

## 既存・新規サービスとの連携

既に分離されている既存サービスを拡張し、新サービスを新たに追加します：

### 既存サービス（拡張）
- `FileSystemService` - ファイル操作機能を拡張
- `ProjectService` - プロジェクト管理機能を拡張
- `SharingService` - ファイル共有機能を拡張
- `AuthenticationHandler` - 認証処理を拡張

### 新規サービス（新規作成）
- `UIStateService` - UI状態管理（一部実装済み）
- `MessageDispatchService` - メッセージ送受信処理
- `TabStateService` - タブ管理
- `MarkdownService` - マークダウン処理
- `ClaudeCodeIntegrationService` - ClaudeCodeとの連携

## サービス間の関係

```
ScopeManagerPanel (コーディネーター)
  ├── UIStateService (新規)
  ├── MessageDispatchService (新規)
  ├── TabStateService (新規)
  ├── MarkdownService (新規)
  ├── FileSystemService (既存・拡張)
  ├── ProjectService (既存・拡張)
  ├── SharingService (既存・拡張)
  ├── AuthenticationHandler (既存・拡張)
  └── ClaudeCodeIntegrationService (新規)
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
- `_showError` - エラーメッセージ表示
- `_showSuccess` - 成功メッセージ表示
- `_update` - WebView内容更新
- `_getHtmlForWebview` - WebView用HTML生成
- `_handleShowDirectoryStructure` - ディレクトリ構造表示

### 2. MessageDispatchService への移行メソッド
- WebViewからのメッセージ受信処理 - コンストラクタ内のonDidReceiveMessage
- WebViewへのメッセージ送信処理 - 各種postMessage呼び出し
- `_handleInitialize` - 初期化処理

### 3. TabStateService への移行メソッド
- `_handleSaveTabState` - タブ状態の保存
- `_handleLoadFileToTab` - タブにファイルを読み込み
- `_handleLoadRequirementsFile` - 要件定義タブの処理

### 4. MarkdownService への移行メソッド
- `_handleGetMarkdownContent` - マークダウン内容取得
- `_loadProgressFile` - 進捗ファイル読み込み
- マークダウン関連の更新処理

### 5. FileSystemService への移行・拡充メソッド
- `_updateDirectoryStructure` - ディレクトリ構造の更新
- `_setupFileWatcher` - ファイル監視設定
- `_handleListDirectory` - ディレクトリ内容のリスト化
- `_handleNavigateDirectory` - ディレクトリ移動
- `_handleOpenFile` - ファイルを開いてプレビュー表示
- `_handleOpenFileInEditor` - ファイルをエディタで開く
- `_handleRefreshFileBrowser` - ファイルブラウザ更新
- `_initializeFileBrowser` - ファイルブラウザ初期化

### 6. ProjectService への移行・拡充メソッド
- `setProjectPath` - プロジェクトパス設定
- `_handleCreateProject` - プロジェクト作成
- `_handleLoadExistingProject` - 既存プロジェクト読み込み
- `_handleSelectProject` - プロジェクト選択
- `_handleRemoveProject` - プロジェクト削除
- `_handleEnsureActiveProject` - プロジェクト同期確認
- `_refreshProjects` - プロジェクト一覧更新
- `_setupProjectServiceEventListeners` - プロジェクトイベント監視

### 7. SharingService への移行・拡充メソッド
- `_handleShareText` - テキスト共有
- `_handleShareImage` - 画像共有
- `_handleGetHistory` - 履歴取得
- `_handleDeleteFromHistory` - 履歴から削除
- `_handleCopyCommand` - コマンドコピー
- `_handleCopyToClipboard` - クリップボードへコピー
- `_handleReuseHistoryItem` - 履歴アイテム再利用

### 8. ClaudeCodeIntegrationService への移行メソッド
- `_handleLaunchPromptFromURL` - プロンプトURLからClaudeCode起動
- `_handleOpenMockupGallery` - モックアップギャラリーを開く
- `_handleOpenOriginalMockupGallery` - 旧メソッドでの互換性維持
- `_handleSelectMockup` - モックアップ選択
- `_handleOpenMockupInBrowser` - モックアップをブラウザで開く

### 9. AuthenticationHandler への移行・拡充メソッド
- `_setupTokenExpirationMonitor` - トークン監視設定
- 認証状態の監視と処理

## 詳細実装ステップ

### フェーズ1: 準備と分析 (2日)

1. [x] 全メソッドの依存関係とメソッド間の呼び出し関係の詳細分析
2. [x] 各メソッドの入出力と副作用の詳細な洗い出し
3. [x] 各サービスのインターフェース詳細設計
4. [x] リファクタリング中の品質保証計画作成
5. [x] 既存コードにリファクタリング対象メソッドへのマーキング（コメント追加）

### フェーズ2: UIStateServiceの実装 (2日)

1. [x] IUIStateServiceインターフェース詳細設計
   - [x] `updateUI()`メソッド設計
   - [x] `showError(message: string)`メソッド設計
   - [x] `showSuccess(message: string)`メソッド設計
   - [x] `showDirectoryStructure(structure: string)`メソッド設計
   - [x] `getWebviewContent(extensionUri: vscode.Uri): string`メソッド設計
   - [x] イベント定義の設計（`onWebviewReady`, `onUIStateChanged`）
2. [x] UIStateService実装クラス作成
   - [x] シングルトンパターンの実装
   - [x] 状態管理ロジックの実装
   - [x] イベントエミッターの実装
3. [x] ScopeManagerPanelからUI関連メソッドの移行:
   - [x] `_showError`の移行とテスト
   - [x] `_showSuccess`の移行とテスト
   - [ ] `_update`の移行とテスト◀︎実装が壊れやすいので一旦保留。
   - [ ] `_getHtmlForWebview`の移行とテスト◀︎実装が壊れやすいので一旦保留。
   - [x] `_handleShowDirectoryStructure`の移行とテスト
4. [x] ScopeManagerPanelでUIStateServiceを使用するよう修正
   - [x] コンストラクタでのサービス初期化処理の追加
   - [x] 移行したメソッド呼び出しをサービス経由に変更
5. [x] ScopeManagerPanelとUIStateServiceの連携テスト
   - [x] メッセージ表示機能のテスト
   - [ ] HTML生成機能のテスト
   - [x] ディレクトリ構造表示のテスト

### フェーズ3: MessageDispatchServiceの実装 (3日)

1. [x] IMessageDispatchServiceインターフェース詳細設計
   - [ ] `initialize(): Promise<void>`メソッド設計
   - [x] `registerMessageHandlers(): void`メソッド設計
   - [x] `handleMessage(message: any): Promise<void>`メソッド設計
   - [x] `sendMessage(command: string, payload: any): void`メソッド設計
   - [x] イベント定義の設計（`onMessageProcessed`）
   - [x] `setupMessageReceiver(panel: vscode.WebviewPanel): vscode.Disposable`メソッド設計
2. [x] MessageDispatchService実装クラス作成
   - [x] シングルトンパターンの実装
   - [x] メッセージハンドラーマップの実装
   - [x] メッセージディスパッチロジックの実装
   - [x] リソース解放処理の実装（dispose）
3. [x] 基本的なメッセージハンドラーの移行:
   - [x] 基本的なメッセージハンドラー（showError/showSuccess）の登録
   - [ ] WebViewからのメッセージ受信処理の完全な移行
   - [ ] コマンドタイプ別の処理振り分けロジックの移行
   - [ ] WebViewへのメッセージ送信処理の移行
   - [ ] `_handleInitialize`メソッドの移行
4. [x] ScopeManagerPanelで基本的なMessageDispatchServiceを使用するよう修正
   - [x] コンストラクタでのサービス初期化処理の追加
   - [x] 基本ハンドラーの登録処理の実装
   - [ ] `onDidReceiveMessage`の処理をサービスに完全に委譲する変更
5. [ ] ScopeManagerPanelとMessageDispatchServiceの連携テスト
   - [x] 基本的なメッセージ送信処理テスト
   - [ ] 全メッセージ受信処理テスト
   - [ ] 初期化処理テスト

### フェーズ4: TabStateServiceの実装 (2日)

1. [ ] ITabStateServiceインターフェース詳細設計
   - [ ] `saveTabState(tabId: string): Promise<void>`メソッド設計
   - [ ] `loadTabContent(tabId: string, filePath: string): Promise<void>`メソッド設計
   - [ ] `selectTab(tabId: string): Promise<void>`メソッド設計
   - [ ] `updateTabContent(tabId: string, content: string, filePath?: string): Promise<void>`メソッド設計
   - [ ] イベント定義の設計（`onTabStateChanged`）
2. [ ] TabStateService実装クラス作成
   - [ ] シングルトンパターンの実装
   - [ ] タブ状態管理ロジックの実装
   - [ ] タブ操作メソッドの実装
3. [ ] タブ関連メソッドの移行:
   - [ ] `_handleSaveTabState`の移行とテスト
   - [ ] `_handleLoadFileToTab`の移行とテスト
   - [ ] `_handleLoadRequirementsFile`のタブ切り替え部分の移行
   - [ ] タブの選択・切り替え処理の実装
4. [ ] ScopeManagerPanelでTabStateServiceを使用するよう修正
   - [ ] コンストラクタでのサービス初期化処理の追加
   - [ ] タブ関連メソッド呼び出しをサービス経由に変更
5. [ ] ScopeManagerPanelとTabStateServiceの連携テスト
   - [ ] タブ状態保存処理テスト
   - [ ] タブへのファイル読み込みテスト
   - [ ] タブ選択・切り替え処理テスト

### フェーズ5: MarkdownServiceの実装 (2日)

1. [ ] IMarkdownServiceインターフェース詳細設計
   - [ ] `loadMarkdownFile(filePath: string): Promise<string>`メソッド設計
   - [ ] `getMarkdownContent(filePath: string): Promise<void>`メソッド設計
   - [ ] `loadRequirementsFile(): Promise<void>`メソッド設計
   - [ ] `updateMarkdownContent(content: string, options?: any): Promise<void>`メソッド設計
   - [ ] イベント定義の設計（`onMarkdownUpdated`）
2. [ ] MarkdownService実装クラス作成
   - [ ] シングルトンパターンの実装
   - [ ] マークダウン処理ロジックの実装
   - [ ] ファイルタイプ判別ロジックの実装
3. [ ] マークダウン関連メソッドの移行:
   - [ ] `_handleGetMarkdownContent`の移行とテスト
   - [ ] `_loadProgressFile`の移行とテスト
   - [ ] `_handleLoadRequirementsFile`のマークダウン処理部分の移行
4. [ ] ScopeManagerPanelでMarkdownServiceを使用するよう修正
   - [ ] コンストラクタでのサービス初期化処理の追加
   - [ ] マークダウン関連メソッド呼び出しをサービス経由に変更
5. [ ] ScopeManagerPanelとMarkdownServiceの連携テスト
   - [ ] マークダウン読み込み処理テスト
   - [ ] マークダウン表示処理テスト
   - [ ] 進捗ファイル読み込みテスト

### フェーズ6: FileSystemServiceの拡張 (3日)

1. [ ] FileSystemServiceのインターフェース拡張設計
   - [ ] `updateDirectoryStructure(projectPath: string): Promise<string>`メソッド追加
   - [ ] `setupFileWatcher(projectPath: string, callback: Function): vscode.Disposable`メソッド追加
   - [ ] `listDirectory(dirPath: string): Promise<any[]>`メソッド追加
   - [ ] `openFile(filePath: string): Promise<void>`メソッド追加
   - [ ] `openFileInEditor(filePath: string): Promise<void>`メソッド追加
   - [ ] `initializeFileBrowser(projectPath: string): Promise<void>`メソッド追加
2. [ ] FileSystemServiceの実装クラス拡張
   - [ ] ファイルブラウザ関連メソッドの追加
   - [ ] ディレクトリ操作メソッドの追加
   - [ ] ファイル監視機能の追加
3. [ ] ファイル操作関連メソッドの移行:
   - [ ] `_updateDirectoryStructure`の移行とテスト
   - [ ] `_setupFileWatcher`の移行とテスト
   - [ ] `_handleListDirectory`の移行とテスト
   - [ ] `_handleNavigateDirectory`の移行とテスト
   - [ ] `_handleOpenFile`の移行とテスト
   - [ ] `_handleOpenFileInEditor`の移行とテスト
   - [ ] `_handleRefreshFileBrowser`の移行とテスト
   - [ ] `_initializeFileBrowser`の移行とテスト
4. [ ] ScopeManagerPanelでFileSystemServiceの拡張機能を使用するよう修正
   - [ ] ファイル操作関連メソッド呼び出しをサービス経由に変更
5. [ ] ScopeManagerPanelとFileSystemServiceの連携テスト
   - [ ] ディレクトリ構造取得テスト
   - [ ] ファイル監視機能テスト
   - [ ] ファイルブラウザ関連機能テスト

### フェーズ7: ProjectServiceの拡張 (3日)

1. [ ] ProjectServiceのインターフェース拡張設計
   - [ ] `createProject(name: string, description: string): Promise<string>`メソッド追加・拡張
   - [ ] `loadExistingProject(projectPath: string): Promise<IProjectInfo>`メソッド追加・拡張
   - [ ] `selectProject(name: string, path: string, activeTab?: string): Promise<void>`メソッド追加・拡張
   - [ ] `removeProject(name: string, path: string, id?: string): Promise<boolean>`メソッド追加・拡張
   - [ ] `refreshProjectsList(): Promise<IProjectInfo[]>`メソッド追加・拡張
   - [ ] `ensureActiveProject(name: string, path: string, activeTab?: string): Promise<boolean>`メソッド追加
2. [ ] ProjectServiceの実装クラス拡張
   - [ ] プロジェクト管理関連メソッドの追加・拡張
   - [ ] イベント通知機能の拡充
3. [ ] プロジェクト管理関連メソッドの移行:
   - [ ] `setProjectPath`の移行とテスト
   - [ ] `_handleCreateProject`の移行とテスト
   - [ ] `_handleLoadExistingProject`の移行とテスト
   - [ ] `_handleSelectProject`の移行とテスト
   - [ ] `_handleRemoveProject`の移行とテスト
   - [ ] `_handleEnsureActiveProject`の移行とテスト
   - [ ] `_refreshProjects`の移行とテスト
   - [ ] `_setupProjectServiceEventListeners`の移行とテスト
4. [ ] ScopeManagerPanelでProjectServiceの拡張機能を使用するよう修正
   - [ ] プロジェクト管理関連メソッド呼び出しをサービス経由に変更
5. [ ] ScopeManagerPanelとProjectServiceの連携テスト
   - [ ] プロジェクト作成・読み込みテスト
   - [ ] プロジェクト選択・削除テスト
   - [ ] プロジェクト一覧取得テスト

### フェーズ8: SharingServiceとClaudeCodeIntegrationServiceの拡張・実装 (3日)

1. [ ] SharingServiceのインターフェース拡張設計・ClaudeCodeIntegrationServiceの新規設計
   - [ ] SharingServiceの拡張メソッド詳細設計
   - [ ] ClaudeCodeIntegrationServiceの新規インターフェース設計
2. [ ] 実装クラスの拡張・新規作成
   - [ ] SharingServiceの機能拡張
   - [ ] ClaudeCodeIntegrationServiceの実装
3. [ ] 共有機能・ClaudeCode連携関連メソッドの移行:
   - [ ] `_handleShareText`、`_handleShareImage`等の共有関連メソッドの移行
   - [ ] `_handleLaunchPromptFromURL`等のClaudeCode連携メソッドの移行
   - [ ] モックアップ関連メソッドの移行
4. [ ] ScopeManagerPanelで各サービスを使用するよう修正
5. [ ] ScopeManagerPanelと各サービスの連携テスト

### フェーズ9: ScopeManagerPanelのリファクタリングと統合 (3日)

1. [ ] サービス間の連携ロジック実装
   - [ ] 各サービスのインスタンス管理構造の実装
   - [ ] サービス間の依存関係解決ロジックの実装
2. [ ] ScopeManagerPanelのコンストラクタを単純化
   - [ ] 各サービスの初期化ロジックを整理
   - [ ] 依存性注入パターンの導入検討
3. [ ] メッセージハンドリングの委譲
   - [ ] 受信メッセージを適切なサービスへ委譲する仕組みの実装
4. [ ] リソース管理の改善
   - [ ] `dispose()`メソッドの改善
   - [ ] 各サービスのリソース解放処理の整理
5. [ ] 不要になったメソッドとプロパティの削除
   - [ ] 既にサービスに移行済みのメソッドの削除
   - [ ] 使用されていないプロパティの削除

### フェーズ10: テストと最終調整 (3日)

1. [ ] すべてのサービスの統合テスト
   - [ ] サービス間連携テスト
   - [ ] エッジケースのテスト
2. [ ] エラー処理の改善
   - [ ] 各サービスのエラーハンドリング改善
   - [ ] エラー情報の統一的な処理方法の実装
3. [ ] 全機能の結合テスト
   - [ ] すべての機能が正常に動作することの確認
   - [ ] 機能間の連携が正常に動作することの確認
4. [ ] パフォーマンステスト
   - [ ] リファクタリング前後のパフォーマンス比較
   - [ ] ボトルネックの特定と最適化
5. [ ] メモリリーク確認
   - [ ] リソース解放が適切に行われていることの確認
   - [ ] メモリ使用量の監視と最適化

### フェーズ11: ドキュメント作成とクリーンアップ (1日)

1. [ ] 各サービスの使用方法ドキュメント作成
   - [ ] インターフェース仕様書の作成
   - [ ] 使用例の作成
2. [ ] コードコメント改善
   - [ ] クラス・メソッドの詳細なJSDoc/TSDocコメント追加
   - [ ] 複雑なロジックの説明コメント追加
3. [ ] 不要なコードの削除
   - [ ] コメントアウトされた未使用コードの削除
   - [ ] デバッグ用コードの削除
4. [ ] コードスタイルの統一
   - [ ] コードフォーマットの適用
   - [ ] 命名規則の統一

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

## 進捗状況と次のステップ

### 完了した作業
- **フェーズ1: 準備と分析** - 全ての項目が完了
- **フェーズ2: UIStateServiceの実装** - 主要部分が完了
  - UI関連のエラー表示・成功メッセージ表示のメソッドを移行済み
  - ScopeManagerPanelから呼び出す形でUIStateServiceを導入済み
  - 基本的なUI連携機能のテストを実施
- **フェーズ3: MessageDispatchServiceの実装** - 一部完了
  - 基本的なメッセージングインターフェースの実装と導入
  - 基本的なメッセージハンドラー（showError/showSuccess）の登録
  - インライン化によるコード整理（未使用/重複メソッドの削除と整理）
  - ScopeManagerPanelの行数を2236行から2138行に削減（-98行）

### 次に進めるべき作業
1. **フェーズ3の残り**:
   - より多くのメッセージハンドラーをMessageDispatchServiceに移行
   - インラインコードをさらに適切なサービスに移行
   - WebViewとのメッセージ処理の完全な分離を目指す

2. **フェーズ4: TabStateServiceの実装**:
   - タブ状態管理を分離し、独立したサービスとして実装
   - タブ関連のメッセージハンドラーを移行

3. **フェーズ5: MarkdownServiceの実装**:
   - マークダウン処理関連の機能を分離
   - コンテンツ表示関連の処理を統合

4. **次のリファクタリング進行方針**:
   - 引き続き段階的にリファクタリングを進める
   - 機能単位で移行し、移行後は必ずUIテストを実施して検証
   - 最終的にScopeManagerPanelを1600行以下にすることを目指す

### 現在の状況
- ScopeManagerPanelの現在の行数: 2138行（初期状態から98行削減）
- サービス分離: UIStateService、MessageDispatchServiceの基本実装を完了
- 削除したメソッド: 未使用・重複の`_handleShowDirectoryStructure`、`_updateDirectoryStructure`、`_handleRefreshFileBrowser`、`_handleNavigateDirectory`、`_handleListDirectory`、`_handleOpenFile`
- TypeScriptエラー: ScopeManagerPanel関連のエラーは解消済み
