# リファクタリング計画: PanelService実装 2025-05-14

## 1. 現状分析

### 1.1 対象概要
現在のScopeManagerPanelクラスは約1,650行以上のコードを含む巨大なクラスとなっており、WebViewパネルの管理、UIロジック、ビジネスロジック、メッセージングなど、複数の責務が混在しています。IPanelServiceインターフェースは定義されていますが、実装はまだ存在せず、ServiceFactoryではダミー実装が提供されています。このリファクタリングでは、実際のPanelServiceImplを実装し、ScopeManagerPanelの肥大化した責務を分離します。

### 1.2 問題点と課題
- ScopeManagerPanelクラスが肥大化し、約1,650行におよぶ
- UIロジックとビジネスロジックが混在している
- メッセージハンドリングが複雑で理解しづらい
- パネル管理とデータ処理の関心が分離されていない
- テスト容易性が低く、単体テストが困難
- コード重複と責務の混在による保守性の低下

### 1.3 関連ファイル一覧
- `src/ui/scopeManager/ScopeManagerPanel.ts` - 約1,650行の巨大なクラス
- `src/ui/scopeManager/services/interfaces/IPanelService.ts` - パネルサービスのインターフェース
- `src/ui/scopeManager/services/ServiceFactory.ts` - サービス取得とダミー実装の提供
- `src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts` - メッセージングサービス実装

### 1.4 依存関係図
```
ScopeManagerPanel
   |
   ├── ServiceFactory ── getPanelService() -> ダミー実装
   |    └── MessageDispatchServiceImpl
   |         └── IPanelService (依存)
   |
   ├── _panel (vscode.WebviewPanel)
   ├── _fileSystemService
   ├── _projectService
   ├── _sharingService
   └── その他のサービス
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- ScopeManagerPanelの約40-65%の行数削減（約600-950行の削減）
- 関心の分離によるコード品質向上
- テスト容易性の向上
- ビジネスロジックとUIの分離
- 将来的な機能拡張の基盤確立

### 2.2 維持すべき機能
- 既存のWebViewパネル機能と操作性
- メッセージハンドリングの完全性
- イベント処理の動作
- バックエンドサービスとの連携

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
```
ScopeManagerPanel (UI層)
   |
   ├── PanelServiceImpl (パネル管理層)
   |    ├── IMessageDispatchService (メッセージング層)
   |    ├── IProjectService (ビジネスロジック層)
   |    └── IFileSystemService (データアクセス層)
   |
   └── ServiceFactory
```

### 3.2 核心的な改善ポイント
- **単一責任の原則の適用**: ScopeManagerPanelはUI表示の責務のみを持つ
- **PanelServiceImplによるパネル管理**: WebViewパネルの作成、表示、メッセージング処理を担当
- **サービス間の明確な依存関係**: 各サービスが明確に定義された役割と責務を持つ
- **イベント駆動アーキテクチャ**: 標準化されたイベント処理による疎結合な設計

### 3.3 新しいファイル構造
```
src/ui/scopeManager/
  ├── ScopeManagerPanel.ts (縮小版)
  └── services/
      ├── implementations/
      │   ├── PanelServiceImpl.ts (新規)
      │   ├── MessageDispatchServiceImpl.ts
      │   └── その他の実装クラス
      ├── interfaces/
      │   ├── IPanelService.ts
      │   └── その他のインターフェース
      └── ServiceFactory.ts (更新版)
```

## 4. 実装計画

### フェーズ1: PanelServiceImplの基本実装
- **目標**: IPanelServiceのコア機能を実装
- **影響範囲**: 新規ファイル作成のみ
- **タスク**:
  1. **T1.1**: PanelServiceImplクラスの基本構造作成
     - 対象: `/src/ui/scopeManager/services/implementations/PanelServiceImpl.ts`
     - 実装: シングルトンパターン、基本メソッド、イベントエミッター
  2. **T1.2**: WebViewパネル管理機能の実装
     - 対象: PanelServiceImpl
     - 実装: パネル作成、表示、破棄、メッセージ送信など
  3. **T1.3**: 依存サービス設定メソッドの実装
     - 対象: PanelServiceImpl
     - 実装: setProjectService, setFileSystemService, setMessageService など
- **検証ポイント**:
  - 基本的なパネル操作が可能か
  - 既存コードとの互換性は保たれているか

### フェーズ2: ServiceFactoryの更新
- **目標**: 新しいPanelServiceImplをServiceFactoryで提供
- **影響範囲**: ServiceFactory.ts
- **タスク**:
  1. **T2.1**: getPanelServiceメソッドの更新
     - 対象: `/src/ui/scopeManager/services/ServiceFactory.ts`
     - 実装: ダミー実装からPanelServiceImpl.getInstanceに変更
  2. **T2.2**: 依存関係設定コードの調整
     - 対象: ServiceFactory.ts
     - 実装: setupDependenciesメソッドの更新
- **検証ポイント**:
  - PanelServiceImplが正しく初期化されるか
  - 他のサービスとの依存関係が正しく設定されるか

### フェーズ3: ScopeManagerPanelからロジックを移行
- **目標**: UIとビジネスロジックの分離
- **影響範囲**: ScopeManagerPanel.ts, PanelServiceImpl.ts
- **タスク**:
  1. **T3.1**: パネル管理ロジックの移行
     - 対象: ScopeManagerPanel.ts -> PanelServiceImpl.ts
     - 実装: パネル作成・表示・更新・破棄のロジックを移行
  2. **T3.2**: メッセージング処理の移行
     - 対象: ScopeManagerPanel.ts -> PanelServiceImpl.ts
     - 実装: メッセージ送受信、ハンドラ登録などの処理を移行
  3. **T3.3**: イベントリスナー設定の移行
     - 対象: ScopeManagerPanel.ts -> PanelServiceImpl.ts
     - 実装: イベントリスナー設定と処理を移行
- **検証ポイント**:
  - 機能の継続性が維持されるか
  - コードの責務が適切に分離されているか
  - 重複コードが削減されているか

### フェーズ4: ScopeManagerPanelのリファクタリング
- **目標**: ScopeManagerPanelをUI層専用クラスに変更
- **影響範囲**: ScopeManagerPanel.ts
- **タスク**:
  1. **T4.1**: ServiceFactoryからのサービス取得に変更
     - 対象: ScopeManagerPanel.ts
     - 実装: 直接インスタンス化をServiceFactoryによる取得に変更
  2. **T4.2**: PanelServiceを使用するように修正
     - 対象: ScopeManagerPanel.ts
     - 実装: WebViewパネル操作をPanelServiceに委譲
  3. **T4.3**: 不要コードの削除
     - 対象: ScopeManagerPanel.ts
     - 実装: 移行済みの重複コード、未使用メソッドを削除
- **検証ポイント**:
  - 行数の大幅削減（40-65%程度）
  - 機能的な同等性
  - コードの可読性向上

### フェーズ5: テストと安定化
- **目標**: リファクタリングの品質確保
- **影響範囲**: 全体
- **タスク**:
  1. **T5.1**: 単体テストの作成
     - 対象: PanelServiceImpl.ts
     - 実装: 基本機能のテストケース実装
  2. **T5.2**: 統合テストの実施
     - 対象: 全体
     - 実装: 実際のVSCode拡張機能での動作確認
  3. **T5.3**: バグ修正と安定化
     - 対象: 必要に応じて
     - 実装: 発見された問題点の修正
- **検証ポイント**:
  - テスト成功率
  - ユーザー体験への影響がないこと

## 5. 期待される効果

### 5.1 コード削減
- ScopeManagerPanel: 約1,650行 → 約650-950行 (40-65%削減)
- 重複コードの排除: 約50-100行
- 総コード量: 増加 (PanelServiceImpl: 約400-600行)

### 5.2 保守性向上
- 単一責任の原則に基づく設計
- 各クラスのサイズと複雑性の低減
- 機能追加・変更時の影響範囲の局所化
- コードの可読性と理解のしやすさの向上

### 5.3 拡張性改善
- 新しいパネルタイプの追加容易性
- 共通パネル機能の再利用
- 標準化されたイベント処理
- 機能拡張のための明確なインターフェース

## 6. リスクと対策

### 6.1 潜在的リスク
- リファクタリング中の機能退行
- イベント処理のタイミングの変化
- パフォーマンスへの影響
- リファクタリングの複雑さによる時間的コスト

### 6.2 対策
- フェーズごとの段階的実装と検証
- 各フェーズ後の徹底したテスト実施
- GitHubチェックポイントの設定（フェーズごとのコミット）
- 問題発生時のロールバック計画

## 7. 備考
- このリファクタリングはScopeManagerPanelの肥大化対策と保守性向上が主目的
- 将来的には他のパネル（MockupGalleryPanelなど）も同様のアーキテクチャに移行することで、コード共通化の効果が期待できる
- 設計パターン（特にObserverパターン、Facade、Singleton）を積極的に活用
- テスト駆動開発（TDD）アプローチの検討も有効