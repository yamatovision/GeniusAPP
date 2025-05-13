# リファクタリング計画: ScopeManagerサービス最適化 2025-05-14

## 1. 現状分析

### 1.1 対象概要
ScopeManagerのservicesディレクトリは複数バージョンのサービス管理システムが共存しており、リファクタリングによる機能向上のために設計された複数の実装クラスが存在します。現在は新実装が標準となっているため、旧システムと移行用のコードを整理する必要があります。

### 1.2 問題点と課題
- 複数のサービスレジストリ実装（`ServiceRegistry.ts`と`ServiceRegistry2.ts`）が共存
- サービスファクトリの重複（`ServiceFactory.ts`と`ServiceFactory2.ts`）
- 実装切り替え機能（`activateNewImplementations.ts`）が残っているが不要
- コードの複雑性と不要なファイルによる保守負担の増加
- 開発者の混乱を招く可能性

### 1.3 関連ファイル一覧
- `ServiceFactory.ts` - 現在使用中のファクトリークラス
- `ServiceFactory2.ts` - 拡張設計のみで実際には使用されていない
- `ServiceRegistry.ts` - 古い実装で直接のインポートが見つからない
- `ServiceRegistry2.ts` - 新しいレジストリ設計だが実際には使用されていない
- `activateNewImplementations.ts` - 実装切り替えシステムだが現在は不要

### 1.4 依存関係図
```
ScopeManagerPanel.ts
   └── ServiceFactory.ts
       └── 各種サービス実装（FileSystemServiceImpl.tsなど）

// 未使用の依存関係
activateNewImplementations.ts
   ├── ServiceFactory.ts
   └── ServiceRegistry2.ts
       └── ServiceFactory.ts
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- コードベースの簡素化による保守性向上
- 不要なファイルの削除による明確なコード構造
- 新しい実装クラス（XxxServiceImpl）のみが使用されることの保証
- 将来的な拡張時の複雑さ軽減

### 2.2 維持すべき機能
- `ServiceFactory`を通じた各種サービスのアクセス
- 既存の依存関係が壊れないこと
- サービスのシングルトンインスタンス管理

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
- `ServiceFactory`を中心としたシンプルなサービス管理
- 各サービスの直接的な実装クラスへのアクセス
- 不要な抽象化レイヤーの削除

### 3.2 核心的な改善ポイント
- 不要なファイルの削除によるコードベースの簡素化
- 明確なサービス提供パスの確立
- 将来の変更に対して容易に対応できる構造の確立

### 3.3 新しいディレクトリ構造
```
src/ui/scopeManager/services/
  ├── AuthenticationHandler.ts
  ├── FileSystemService.ts         (インターフェース定義)
  ├── FileWatcherService.ts        (インターフェース定義)
  ├── MarkdownService.ts
  ├── ProjectService.ts            (インターフェース定義)
  ├── ServiceFactory.ts            (メインファクトリー)
  ├── SharingService.ts
  ├── TabStateService.ts
  ├── UIStateService.ts
  ├── implementations/             (実装クラスディレクトリ)
  ├── interfaces/                  (インターフェース定義)
  └── messageHandlers/             (メッセージハンドラー)
```

## 4. 実装計画

### フェーズ1: ServiceFactory2.tsの削除
- **目標**: 使用されていない拡張ファクトリーの削除
- **影響範囲**: 実質的に影響なし（どこからも参照されていない）
- **タスク**:
  1. **T1.1**: ファイル削除前の依存関係チェック
     - 対象: 全プロジェクト
     - 実装: コードベース全体でインポート検索を行う
  2. **T1.2**: ServiceFactory2.tsファイルの削除
     - 対象: `/src/ui/scopeManager/services/ServiceFactory2.ts`
     - 実装: ファイルの削除
- **検証ポイント**:
  - 削除後にアプリケーションが正常に動作するか
  - ビルドエラーが発生しないか

### フェーズ2: activateNewImplementations.tsの削除
- **目標**: 使用されていない実装切り替え機能の削除
- **影響範囲**: 実質的に影響なし（どこからも参照されていない）
- **タスク**:
  1. **T2.1**: ファイル削除前の依存関係チェック
     - 対象: 全プロジェクト
     - 実装: コードベース全体でインポート検索を行う
  2. **T2.2**: activateNewImplementations.tsファイルの削除
     - 対象: `/src/ui/scopeManager/services/activateNewImplementations.ts`
     - 実装: ファイルの削除
- **検証ポイント**:
  - 削除後にアプリケーションが正常に動作するか
  - ビルドエラーが発生しないか

### フェーズ3: ServiceRegistry2.tsの削除
- **目標**: 不要な拡張レジストリの削除
- **影響範囲**: 実質的に影響なし（activateNewImplementations.tsからのみ参照）
- **タスク**:
  1. **T3.1**: ファイル削除前の依存関係チェック
     - 対象: 全プロジェクト
     - 実装: コードベース全体でインポート検索を行う
  2. **T3.2**: ServiceRegistry2.tsファイルの削除
     - 対象: `/src/ui/scopeManager/services/ServiceRegistry2.ts`
     - 実装: ファイルの削除
- **検証ポイント**:
  - 削除後にアプリケーションが正常に動作するか
  - ビルドエラーが発生しないか

### フェーズ4: ServiceRegistry.tsの削除
- **目標**: 古いレジストリ実装の削除
- **影響範囲**: 実質的に影響なし（直接のインポートが見つからない）
- **タスク**:
  1. **T4.1**: ファイル削除前の依存関係チェック
     - 対象: 全プロジェクト
     - 実装: コードベース全体でインポート検索を行う
  2. **T4.2**: ServiceRegistry.tsファイルの削除
     - 対象: `/src/ui/scopeManager/services/ServiceRegistry.ts`
     - 実装: ファイルの削除
- **検証ポイント**:
  - 削除後にアプリケーションが正常に動作するか
  - ビルドエラーが発生しないか

## 5. 期待される効果

### 5.1 コード削減
- 合計4つのファイル（約600行以上）の削除
- 不要なコードの削減率：約15%（services ディレクトリ内）

### 5.2 保守性向上
- サービス取得の流れが明確化
- デバッグ時のコードトレースが容易に
- 複数実装があることによる混乱の防止

### 5.3 拡張性改善
- 新しいサービス追加時の明確な実装パターン
- 将来的なリファクタリングの基盤確立

## 6. リスクと対策

### 6.1 潜在的リスク
- 想定外の依存関係が存在する可能性
- 実行時に動的に利用されている可能性
- ServiceFactoryの設計変更による互換性の問題

### 6.2 対策
- 各ファイル削除前に念入りな依存関係チェック
- 段階的な削除と各段階での動作確認
- 問題発生時に備えたリバーションプラン
- VSCode拡張機能の手動テストの実施

## 7. 備考
- 今回の変更は純粋なコード整理であり、機能的な変更は含まない
- すでに新実装（XxxServiceImpl）が標準で使用されているため、移行作業は不要
- 将来的には`ServiceFactory`を介したサービス取得パターンに統一することが望ましい