# 機能拡張計画: 同時ログイン制限機能 2025-01-19

## 1. 拡張概要

BlueLampサービスにおいて、1つのIDで同時に複数箇所からログインすることを制限する機能を実装します。同一IDでの新規ログイン時には、既存セッションの存在を確認し、ユーザーの承認を得た上で既存セッションを強制終了して新規ログインを許可します。これにより、IDの不正使用を防ぎ、サービスの適切な利用を促進します。

## 2. 詳細仕様

### 2.1 現状と課題

現在のBlueLampの認証システムでは、JWTベースの「ソフトな同時ログイン制限」が実装されています。新規ログイン時に既存のリフレッシュトークンは無効化されますが、アクセストークン（24時間有効）は引き続き使用可能なため、実質的に24時間以内であれば複数箇所からの同時アクセスが可能です。これでは、1つのIDを複数人で同時使用することを完全に防ぐことができません。

### 2.2 拡張内容

同時ログイン制限機能により、以下の動作を実現します：

1. ログイン時に既存のアクティブセッションを確認
2. 既存セッションが存在する場合、確認ダイアログを表示：
   「このアカウントは別の場所で使用中です。こちらにログインすると、以前のセッションは自動的にログアウトされます。続けますか？」
3. ユーザーが承認した場合、既存セッションを即座に無効化して新規ログインを許可
4. ユーザーが拒否した場合、ログインをキャンセル
5. 既存セッションのアクセストークンも即座に無効化

## 3. ディレクトリ構造

```
portal/
├── backend/
│   ├── models/
│   │   └── simpleUser.model.js [変更]
│   ├── controllers/
│   │   └── simpleAuth.controller.js [変更]
│   ├── middlewares/
│   │   └── simple-auth.middleware.js [変更]
│   ├── utils/
│   │   └── simpleAuth.helper.js [変更]
│   └── services/
│       └── session.service.js [新規]
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── simple/
│   │   │       └── simpleAuth.service.js [変更]
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── Login.js [変更]
│   │   │   └── simple/
│   │   │       └── SimpleLogin.js [変更]
│   │   └── contexts/
│   │       └── AuthContext.js [変更]
└── shared/
    └── index.ts [新規/変更]
```

## 4. 技術的影響分析

### 4.1 影響範囲

- **フロントエンド**: ログインコンポーネント、認証コンテキスト、認証サービス
- **バックエンド**: 認証コントローラー、認証ミドルウェア、ユーザーモデル
- **データモデル**: ユーザーモデルにセッション管理フィールドの追加
- **その他**: JWTトークンの検証ロジック、セッション管理サービスの新規追加

### 4.2 変更が必要なファイル

```
- portal/backend/models/simpleUser.model.js: activeSessionフィールドの追加（セッションID、ログイン時刻、最終アクティビティ時刻）
- portal/backend/controllers/simpleAuth.controller.js: ログイン処理でセッション確認・管理ロジックの追加、強制ログアウト機能の実装
- portal/backend/middlewares/simple-auth.middleware.js: トークン検証時にセッション有効性チェックの追加
- portal/backend/utils/simpleAuth.helper.js: セッションID生成関数の追加
- portal/backend/services/session.service.js: セッション管理サービスの新規作成
- portal/frontend/src/services/simple/simpleAuth.service.js: 強制ログイン用のAPIメソッド追加
- portal/frontend/src/components/auth/Login.js: 同時ログイン確認ダイアログの実装
- portal/frontend/src/components/simple/SimpleLogin.js: 同時ログイン確認ダイアログの実装
- portal/frontend/src/contexts/AuthContext.js: セッション無効化の検知とハンドリング
- shared/index.ts: 新規APIエンドポイントの定義追加
```

## 5. タスクリスト

```
- [ ] **T1**: shared/index.tsにAPI定義を追加（強制ログインエンドポイント）
- [ ] **T2**: simpleUser.modelにactiveSessionフィールドを追加
- [ ] **T3**: session.serviceの作成（セッション管理ロジック）
- [ ] **T4**: simpleAuth.controllerのログイン処理を拡張（セッション確認・管理）
- [ ] **T5**: simpleAuth.controllerに強制ログインエンドポイントを追加
- [ ] **T6**: simple-auth.middlewareにセッション検証を追加
- [ ] **T7**: simpleAuth.helperにセッションID生成関数を追加
- [ ] **T8**: フロントエンドのsimpleAuth.serviceに強制ログインメソッドを追加
- [ ] **T9**: Loginコンポーネントに確認ダイアログを実装
- [ ] **T10**: SimpleLoginコンポーネントに確認ダイアログを実装
- [ ] **T11**: AuthContextにセッション無効化検知を実装
- [ ] **T12**: 統合テストの実施
```

### 6. テスト計画

以下のテストケースを実施します：

1. **基本的な同時ログイン制限**
   - デバイスAでログイン
   - デバイスBで同じIDでログイン試行
   - 確認ダイアログが表示されることを確認
   - 「続ける」を選択した場合、デバイスAのセッションが無効化されることを確認

2. **キャンセル動作**
   - 確認ダイアログで「キャンセル」を選択
   - ログインが中止され、既存セッションが維持されることを確認

3. **トークン無効化**
   - 強制ログアウトされたセッションのアクセストークンでAPIアクセス
   - 401エラーが返されることを確認

4. **リフレッシュトークン**
   - 強制ログアウトされたセッションでトークンリフレッシュ試行
   - エラーが返されることを確認

## 7. SCOPE_PROGRESSへの統合

[SCOPE_PROGRESS.md]に以下のタスクを追加：

```markdown
- [ ] **BLAUTH-001**: BlueLamp同時ログイン制限機能の実装
  - 目標: 2025-01-26
  - 参照: [/docs/plans/planning/ext-concurrent-login-restriction-2025-01-19.md]
  - 内容: 1つのBlueLamp IDで同時に複数箇所からログインすることを制限し、新規ログイン時には既存セッションの強制終了オプションを提供
```

## 8. 備考

- 将来的にはWebSocketを使用したリアルタイムセッション管理も検討可能
- セッションタイムアウト機能（一定時間操作がない場合の自動ログアウト）も追加可能
- ログイン履歴機能（いつ、どこからログインしたかの記録）も併せて実装することで、セキュリティを強化可能