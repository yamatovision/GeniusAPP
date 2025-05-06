# 現在の実装スコープ: [機能名/ページ名]

## 1. 基本情報

- **スコープID**: SCOPE-123
- **優先度**: 高
- **担当**: スコープ実装アシスタント (#11)
- **ステータス**: 実装中 (60% 完了)
- **開始日**: 2025-05-05
- **目標完了日**: 2025-05-10
- **前提条件**: 認証システム実装完了

## 2. 実装概要

[この機能の目的と重要性の簡潔な説明。実装することで得られる価値を明確に]

## 3. 参照ドキュメント

- **要件定義**: [requirements.md#section-123](/docs/requirements.md#section-123)
- **モックアップ**: [admin-dashboard.html](/mockups/admin-dashboard.html)
- **API仕様**: [admin.md](/docs/api/admin.md)
- **型定義**: [Dashboard/AdminUser型](/shared/index.ts#L150-L190)
- **実装ガイド**: [admin-dashboard.md](/docs/implementation/admin-dashboard.md)

## 4. 依存関係

- **前提となる機能**: 認証システム、ユーザー管理
- **影響を与える機能**: レポート機能、通知システム
- **外部サービス依存**: Firebase Authentication

## 5. データフロー

```
[ユーザー認証] → [権限確認] → [ダッシュボードデータ取得] → [UI表示]
                              ↑
                    [外部APIデータ同期]
```

## 6. タスクリスト

### バックエンド実装

- [x] **BE-1**: ダッシュボードデータ取得APIエンドポイント実装 
  - 完了日: 2025-05-06
  - 参照: [dashboard.controller.ts](/server/src/controllers/dashboard.controller.ts)
  - 型定義: [DashboardResponse](/shared/index.ts#L520-L545)
  - テスト: [dashboard.test.ts](/server/src/tests/api/dashboard.test.ts)

- [ ] **BE-2**: データ集計サービス実装 (進行中)
  - 担当: データモデル統合 (#4)
  - 目標: 2025-05-07
  - 参照: [aggregation.service.ts](/server/src/services/aggregation.service.ts)
  - 型定義: [AggregationResult](/shared/index.ts#L550-L570)

- [ ] **BE-3**: 権限ベースのデータフィルタリング実装
  - 依存: BE-1, BE-2
  - 目標: 2025-05-08
  - 型定義: [UserRole](/shared/index.ts#L136-L140)

### フロントエンド実装

- [ ] **FE-1**: ダッシュボードコンポーネント作成
  - 目標: 2025-05-08
  - 参照: モックアップセクション #3.2
  - 型定義: [DashboardProps](/shared/index.ts#L580-L590)

- [ ] **FE-2**: APIとの連携実装
  - 依存: BE-1, FE-1
  - 目標: 2025-05-09
  - 型定義: [ApiResponse<DashboardResponse>](/shared/index.ts#L219)

- [ ] **FE-3**: インタラクティブチャート実装
  - 依存: FE-2
  - 目標: 2025-05-09
  - 型定義: [ChartData](/shared/index.ts#L600-L615)

### テストとドキュメント

- [ ] **TEST-1**: 全APIエンドポイントの統合テスト
  - 依存: すべてのBEタスク
  - 目標: 2025-05-10

- [ ] **DOC-1**: APIドキュメント更新
  - 依存: すべてのBEタスク
  - 目標: 2025-05-10

## 7. 実装上の注意点

- 権限チェックを各APIエンドポイントで徹底すること
- データ集計は非同期処理で実行し、UI応答性を維持すること
- チャートコンポーネントはモバイル対応を考慮すること
- バックエンド/フロントエンド間の型の整合性を保つため、必ず`shared/index.ts`の型定義を参照すること
- API実装時にはレスポンス型が`shared/index.ts`の定義と一致するよう検証すること

## 8. 実装状況の更新履歴

- **2025-05-06**: BE-1完了、BE-2開始
- **2025-05-05**: スコープ実装開始