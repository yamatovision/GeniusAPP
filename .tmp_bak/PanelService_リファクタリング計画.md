# PanelService リファクタリング計画

## 1. 概要

ScopeManagerPanelクラスは現在リファクタリング途中であり、多くの責務が各種サービスに移行されつつありますが、WebViewパネルの管理に関する処理が統一されておらず、クラス全体に散在しています。本計画では、新たにPanelServiceを導入し、パネル操作を一元管理することで、ScopeManagerPanelをさらに整理し、責務を明確に分離します。

## 2. 現状の課題

1. **WebViewパネル操作の散在**:
   - パネルへのメッセージ送信が複数箇所に存在
   - HTML生成ロジックが単一のメソッドに集中し複雑化
   - UI更新処理が統一されていない

2. **非推奨メソッドの残存**:
   - 多くのメソッドが`@deprecated`とマークされているが削除されていない
   - 古いコードと新しいコードが混在している

3. **コンストラクタの複雑さ**:
   - 200行以上の巨大なコンストラクタ
   - 初期化処理が複雑で理解困難

4. **非同期処理の不統一**:
   - 一部でawaitが適切に使われていない
   - エラーハンドリングが統一されていない

5. **サービス間の依存関係が不明確**:
   - サービスの初期化順序が暗黙的
   - 循環参照のリスク

## 3. 目指す状態

1. **薄いコントローラー**:
   - ScopeManagerPanelが単なるエントリーポイントになる
   - 実際の処理はすべて適切なサービスに委譲

2. **明確な責務分離**:
   - PanelServiceがWebViewパネル操作を一元管理
   - 各サービスが単一の責務を持つ

3. **型安全なメッセージング**:
   - 型定義によるメッセージの安全性確保
   - コンパイル時のエラー検出

4. **統一されたエラー処理**:
   - すべてのエラーが一貫した方法で処理される
   - ユーザーへの適切なフィードバック

5. **明示的な依存関係管理**:
   - ServiceRegistryによるサービス初期化と依存関係の管理
   - 循環参照の防止

## 4. PanelServiceの設計

### 4.1 インターフェース

```typescript
/**
 * WebViewパネル管理サービスのインターフェース
 */
export interface IPanelService {
  // パネル操作
  createPanel(column?: vscode.ViewColumn): void;
  showPanel(column?: vscode.ViewColumn): void;
  updatePanelContent(): void;
  disposePanel(): void;
  
  // メッセージング
  sendMessage(message: PanelMessage): void;
  broadcastMessage(message: PanelMessage): void;
  
  // イベント
  onPanelCreated: vscode.Event<vscode.WebviewPanel>;
  onPanelDisposed: vscode.Event<void>;
  onMessageReceived: vscode.Event<Message>;
  
  // 状態
  isPanelVisible(): boolean;
  getPanel(): vscode.WebviewPanel | undefined;
  
  // リソース解放
  dispose(): void;
}

/**
 * パネルメッセージの型定義
 */
export interface PanelMessage {
  command: string;
  [key: string]: any;
}
```

### 4.2 実装クラス

```typescript
/**
 * WebViewパネル管理サービスの実装
 */
export class PanelService implements IPanelService {
  private static readonly viewType = 'scopeManager';
  private _panel: vscode.WebviewPanel | undefined;
  private _extensionUri: vscode.Uri;
  private _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  
  // イベントエミッター
  private _onPanelCreated = new vscode.EventEmitter<vscode.WebviewPanel>();
  private _onPanelDisposed = new vscode.EventEmitter<void>();
  private _onMessageReceived = new vscode.EventEmitter<Message>();
  
  // 公開イベント
  public readonly onPanelCreated = this._onPanelCreated.event;
  public readonly onPanelDisposed = this._onPanelDisposed.event;
  public readonly onMessageReceived = this._onMessageReceived.event;
  
  // 依存サービス
  private _uiStateService: IUIStateService;
  
  // シングルトンインスタンス
  private static _instance: PanelService;
  
  // 実装メソッド（省略）
}
```

## 5. ServiceRegistryの設計

```typescript
/**
 * サービスレジストリ
 * サービス間の依存関係を管理
 */
export class ServiceRegistry {
  readonly messageService: IMessageDispatchService;
  readonly projectService: IProjectService;
  readonly fileSystemService: IFileSystemService;
  readonly panelService: IPanelService;
  readonly uiStateService: IUIStateService;
  readonly tabStateService: ITabStateService;
  readonly sharingService: ISharingService;
  readonly authHandler: IAuthenticationHandler;
  
  private constructor(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    // 依存関係順に初期化
    this.fileSystemService = FileSystemService.getInstance();
    this.authHandler = AuthenticationHandler.getInstance();
    this.projectService = ProjectService.getInstance(this.fileSystemService);
    this.uiStateService = UIStateService.getInstance();
    this.tabStateService = TabStateService.getInstance();
    this.sharingService = SharingService.getInstance(context);
    this.panelService = new PanelService(extensionUri, context, this.uiStateService);
    this.messageService = MessageDispatchService.getInstance();
    
    // サービス間の依存関係を設定
    this.setupDependencies();
  }
  
  private setupDependencies(): void {
    // 依存関係の設定
    this.messageService.setDependencies({
      sharingService: this.sharingService,
      projectService: this.projectService,
      fileSystemService: this.fileSystemService,
      uiStateService: this.uiStateService,
      panelService: this.panelService
    });
    
    // イベントリスナーの設定
    // ...
  }
  
  public static initialize(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ): ServiceRegistry {
    return new ServiceRegistry(extensionUri, context);
  }
}
```

## 6. 移行計画

### フェーズ1: PanelServiceの基礎実装 (所要時間: 4-6時間)

1. **ファイル構造作成**
   - [ ] `src/ui/scopeManager/services/PanelService.ts`ファイルを作成
   - [ ] インターフェース定義を実装
   - [ ] 基本的なクラス構造を実装

2. **基本機能の移行**
   - [ ] パネル作成・表示メソッドを実装
   - [ ] `_getHtmlForWebview`メソッドを移行
   - [ ] 基本的なメッセージ送信機能を実装

3. **テスト**
   - [ ] PanelServiceを単独で初期化テスト
   - [ ] パネル表示の基本機能テスト
   - [ ] **UI確認**: パネルが正しく表示されることを確認

### フェーズ2: MessageDispatchServiceとの統合 (所要時間: 3-4時間)

1. **メッセージング機能拡張**
   - [ ] 型安全なメッセージング実装
   - [ ] メッセージ受信ハンドラの実装
   - [ ] MessageDispatchServiceとの連携

2. **エラーハンドリング**
   - [ ] 統一されたエラー処理の実装
   - [ ] UI通知の一元化

3. **テスト**
   - [ ] メッセージ送受信テスト
   - [ ] エラー処理テスト
   - [ ] **UI確認**: エラーメッセージが正しく表示されることを確認

### フェーズ3: ServiceRegistryの実装 (所要時間: 4-5時間)

1. **ファイル構造作成**
   - [ ] `src/ui/scopeManager/services/ServiceRegistry.ts`ファイルを作成
   - [ ] 基本的なクラス構造を実装

2. **依存関係管理**
   - [ ] 初期化順序の実装
   - [ ] サービス間依存関係の設定
   - [ ] イベントリスナーの設定

3. **テスト**
   - [ ] サービスの初期化テスト
   - [ ] 依存関係の確認
   - [ ] **UI確認**: すべてのサービスが正しく機能することを確認

### フェーズ4: ScopeManagerPanelの改修 (所要時間: 5-7時間)

1. **ScopeManagerPanelの簡素化**
   - [ ] コンストラクタの簡素化
   - [ ] `createOrShow`メソッドの改修
   - [ ] WebViewパネル操作の委譲

2. **非推奨メソッドの削除**
   - [ ] すべての`@deprecated`メソッドを削除
   - [ ] 参照箇所の修正

3. **テスト**
   - [ ] 全体機能の動作確認
   - [ ] **UI確認**: リファクタリング前と同じ動作をすることを確認

### フェーズ5: 最終調整とドキュメント (所要時間: 2-3時間)

1. **コードクリーンアップ**
   - [ ] 不要なコメントやコードの削除
   - [ ] コードスタイルの統一

2. **ドキュメント作成**
   - [ ] JSDocの充実
   - [ ] README更新

3. **最終テスト**
   - [ ] すべての機能の総合テスト
   - [ ] エッジケースの確認
   - [ ] **UI確認**: すべての機能が正しく動作することを最終確認

## 7. UIテスト確認項目

各フェーズの「UI確認」ステップでは、以下の項目を確認してください：

### 基本機能

- [ ] **パネル表示**
  - [ ] ScopeManagerPanelが正しく表示される
  - [ ] ヘッダー、タブ、コンテンツエリアが正しく表示される
  - [ ] スタイルが正しく適用されている

- [ ] **タブ機能**
  - [ ] タブクリックで正しくコンテンツが切り替わる
  - [ ] タブ状態が保存・復元される
  - [ ] タブ内のコンテンツが正しく表示される

- [ ] **プロジェクト管理**
  - [ ] プロジェクト一覧が表示される
  - [ ] プロジェクト選択が機能する
  - [ ] プロジェクト作成・削除が機能する

- [ ] **マークダウン表示**
  - [ ] マークダウンが正しくレンダリングされる
  - [ ] チェックボックスが機能する
  - [ ] コードブロックが正しく表示される

- [ ] **ファイルブラウザ**
  - [ ] ファイル一覧が表示される
  - [ ] ディレクトリナビゲーションが機能する
  - [ ] ファイルプレビューが表示される

- [ ] **Claude連携**
  - [ ] テキスト・画像共有が機能する
  - [ ] 共有履歴が表示される
  - [ ] プロンプトカードが表示・機能する

### エラー処理

- [ ] **通信エラー**
  - [ ] 適切なエラーメッセージが表示される
  - [ ] UIがクラッシュせずに回復する

- [ ] **ファイル操作エラー**
  - [ ] 存在しないファイルへのアクセス時に適切なエラーが表示される
  - [ ] 書き込み権限がない場合に適切なエラーが表示される

- [ ] **認証エラー**
  - [ ] 認証切れ時に適切な処理が行われる
  - [ ] 権限がない機能へのアクセス時に適切なメッセージが表示される

### パフォーマンス

- [ ] **初期化速度**
  - [ ] パネル表示の初期化が適切な速度で行われる
  - [ ] 大きなプロジェクトでも応答性が良好

- [ ] **ファイル一覧表示速度**
  - [ ] 多数のファイルがある場合でも応答性が良好

- [ ] **マークダウンレンダリング速度**
  - [ ] 大きなマークダウンファイルでも適切に表示される

## 8. リスク管理

1. **UI変更の可能性**
   - **リスク**: リファクタリングによって意図しないUI変更が発生する可能性
   - **対策**: 各フェーズ後の詳細なUIテスト

2. **パフォーマンス低下**
   - **リスク**: サービス間通信のオーバーヘッドによるパフォーマンス低下
   - **対策**: パフォーマンス測定と必要に応じた最適化

3. **未知の依存関係**
   - **リスク**: リファクタリング過程で発見される未知の依存関係
   - **対策**: 段階的なアプローチと各フェーズでのテスト

4. **互換性問題**
   - **リスク**: 既存機能との互換性問題
   - **対策**: 経過措置としての互換性レイヤーの維持

## 9. 実施計画

- **総所要時間**: 約18-25時間
- **フェーズ分け**: 5フェーズに分けて実施
- **検証ポイント**: 各フェーズ後に詳細なUIテストを実施
- **リリース判断**: すべてのUIテスト項目をパスした後にマージ

## 10. タスクチェックリスト

### 準備作業

- [ ] 現状のコードをバックアップ
- [ ] 新しいブランチを作成: `git checkout -b panelservice-refactoring`
- [ ] 必要なディレクトリ構造を確認

### PanelService実装

- [ ] `PanelService.ts`ファイルの作成
- [ ] インターフェース定義の実装
- [ ] 基本クラス構造の実装
- [ ] パネル操作メソッドの実装
- [ ] HTML生成ロジックの移行
- [ ] メッセージング機能の実装
- [ ] 単体テスト

### ServiceRegistry実装

- [ ] `ServiceRegistry.ts`ファイルの作成
- [ ] サービス初期化ロジックの実装
- [ ] 依存関係設定の実装
- [ ] イベントリスナー設定の実装
- [ ] 単体テスト

### ScopeManagerPanel改修

- [ ] コンストラクタの簡素化
- [ ] `createOrShow`メソッドの改修
- [ ] PanelServiceへの委譲実装
- [ ] 非推奨メソッドの削除
- [ ] 参照箇所の修正
- [ ] 統合テスト

### ドキュメント化

- [ ] JSDocの追加
- [ ] READMEの更新
- [ ] リファクタリング実施報告書の作成

## 11. 完了基準

1. **コード品質**
   - SonarQubeやESLintによる静的解析でエラーがないこと
   - TypeScriptコンパイルエラーがないこと

2. **機能テスト**
   - すべてのUI機能が正常に動作すること
   - エッジケースでも適切に動作すること

3. **パフォーマンス**
   - リファクタリング前と比較して遜色ないパフォーマンスであること

4. **ドキュメント**
   - すべてのパブリックAPIに適切なJSDocが記述されていること
   - README等のドキュメントが更新されていること

5. **コードレビュー**
   - チームメンバーによるコードレビューをパスしていること

このリファクタリング計画に従って実装を進めることで、ScopeManagerPanelの保守性と拡張性を大幅に向上させ、今後の機能追加や修正がより容易になります。