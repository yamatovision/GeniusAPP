# AppGenius - 開発状況 (2025/04/23更新)

## 開発ブランチと最新状態

現在の開発は `scope-manager-optimization` ブランチで進めています。このブランチは以下のコミットから作成されました:
- コミット: `21c8519` (2025/04/18) - "ScopeManagerPanel状態管理の最適化と余分なコードの削除"

このブランチは、最新の `main` ブランチから2つ前のコミットに戻り、そこから新たに作成したものです。
`main` ブランチの最新コミットには以下の変更が含まれていましたが、それらは現在のブランチには含まれていません:
- `359fb49` (2025/04/19) - "chore: .DS_Storeの更新を追加"
- `4e18056` (2025/04/19) - "chore: .gitignoreを更新して証明書ファイルと.DS_Storeを除外"

## AppGenius開発ガイド

このプロジェクトはAppGeniusを使用した複数AIアシスタントによる開発を行っています。AppGeniusは効率的な開発プロセスを提供し、各フェーズに特化したAIアシスタントが連携して高品質なソフトウェアを構築します。

### 開発フェーズと使用するアシスタント

1. **要件定義フェーズ**（★1: requirements_creator）
   - 要件を明確化し、詳細なドキュメントを作成
   - 必要なページや機能を洗い出し
   - `./docs/requirements.md`に保存

2. **システム設計フェーズ**（★2: system_architecture）
   - 全体アーキテクチャとディレクトリ構造の設計
   - 技術スタックの選定
   - `./docs/structure.md`に保存

3. **モックアップ作成フェーズ**（★3: mockup_creatorandanalyzer）
   - 視覚的なモックアップの作成
   - データモデルの分析
   - `./mockups/`ディレクトリに保存

4. **データモデル設計フェーズ**（★4: data_model_assistant_generic）
   - 統合データモデルの作成
   - 依存関係の最適化
   - `./docs/data_models.md`に保存

5. **実装フェーズ**（★11: scope_implementer）
   - 機能スコープごとの実装
   - テストとデバッグ
   - コードの品質確保

### スコープ管理の使い方

1. **スコープマネージャーを開く**: VSCode拡張機能からAppGenius > スコープマネージャーを選択
2. **機能の実装**: 
   - 進行中のスコープを選択して「実装を開始」ボタンをクリック
   - ClaudeCodeで実装作業を行う
3. **進捗の更新**: 
   - 完了したファイルのチェックボックスをオンにして進捗を更新
   - CURRENT_STATUS.mdも自動的に更新される

## 全体進捗

- 完成予定ファイル数: 14
- 作成済みファイル数: 3
- 進捗率: 21%
- 最終更新日: 2025/04/19

## 引き継ぎ事項

認証システム改善のシンプル化リファクタリングを開始しました。コアとなる以下のファイルを作成済みです：
1. 新しい認証サービス: `portal/frontend/src/auth/AuthService.js`
2. 認証コンテキスト: `portal/frontend/src/auth/AuthContext.js` 
3. 認証保護コンポーネント: `portal/frontend/src/auth/AuthGuard.js`

また、`App.js`ファイルを修正し、リダイレクト処理を適切に統一しました。今後は以下のタスクに取り組む必要があります：
- VS Code拡張側の認証連携
- LogoutNotificationの改善
- SimpleAppコンポーネントの修正
- simpleAuth.service.jsの削除

シンプル化アプローチの詳細については`docs/scopes/auth-system-improvements-scope.md`を参照してください。

## スコープ状況

### 進行中スコープ
- [ ] 認証システム改善 (21%) - 認証関連の複数の問題を解決

### 未着手スコープ
- [ ] 基本機能実装 (0%) - プロジェクトの基本機能を実装

### 完了済みスコープ
（まだ完了したスコープはありません）

## 最終的なディレクトリ構造(予測)
```
AppGenius/
├── src/
│   ├── core/
│   │   └── auth/
│   ├── services/
│   └── ui/
│       └── auth/
└── portal/
    ├── frontend/
    │   └── src/
    │       ├── components/
    │       │   └── auth/
    │       └── services/
    └── backend/
        └── services/
```

## 現在のディレクトリ構造
```
AppGenius/
├── CLAUDE.md
├── CURRENT_STATUS.md
├── docs/
│   ├── CURRENT_STATUS.md
│   └── scopes/
│       └── auth-system-improvements-scope.md
├── src/
│   └── core/
│       └── auth/
└── portal/
    ├── frontend/
    │   └── src/
    │       └── services/
    └── backend/
        └── services/
```

## 認証システム改善 - シンプル化リファクタリング
- [ ] portal/frontend/src/auth/AuthService.js
- [ ] portal/frontend/src/auth/AuthContext.js
- [ ] portal/frontend/src/auth/AuthGuard.js
- [ ] portal/frontend/src/App.js
- [ ] portal/frontend/src/components/Login.js
- [ ] portal/frontend/src/components/simple/SimpleApp.js
- [ ] portal/frontend/src/deep-link-handler.js
- [ ] src/core/auth/SimpleAuthService.ts
- [ ] src/services/ClaudeCodeAuthSync.ts
- [ ] src/ui/auth/LogoutNotification.ts

**実装メモ**
- 認証システムを「単一の信頼できる情報源」原則に基づき完全にリファクタリングします
- シンプル化アプローチで以下の主要な問題に対処します：
  1. 認証情報キャッシュの管理不備：AuthServiceで一元的なキャッシュ管理を実装
  2. ログアウト時の無限ループ：ログアウトとリダイレクトを明確に分離
  3. タブ間のセッション同期問題：カスタムイベントを使用した状態同期
  4. URL重複とセッション早期期限切れ：適切なURL処理とシンプルな認証検証サイクル

**実装計画タスク**
1. **認証コアサービスの作成**
   - 認証関連のロジックを一つのサービスに集約
   - キャッシュ管理とストレージの一元化
   - シンプルな認証APIのみを提供

2. **冗長なコードの削除**
   - 複数の場所で行われている認証管理を削除
   - 重複したリフレッシュサイクルの排除
   - URLパラメータ処理の重複を削除

3. **シンプルな保護コンポーネントの実装**
   - リダイレクト処理を一貫性のある方法で実装
   - React Routerの適切な使用
   - シンプルなAuthGuardの実装

4. **VS Code拡張側の認証連携**
   - 新しい認証システムとVS Code拡張の連携
   - LogoutNotificationの簡素化
   - ClaudeCodeAuthSyncの最適化

### 参考資料
- 詳細スコープ: docs/scopes/auth-system-improvements-scope.md

## 基本機能実装
- [ ] （まだ実装ファイルが定義されていません）

**実装メモ**
- このスコープでは基本的な機能を実装します
- スコープの詳細は今後更新されます

### 参考資料
- 要件定義書: docs/requirements.md（作成予定）
- システム設計: docs/structure.md（作成予定）

----

## パースルール

ScopeManagerPanelはCURRENT_STATUS.mdの内容を以下のルールでパースして表示します：

1. **スコープの検出**:
   - 「### 進行中スコープ」セクションから `- [ ] スコープ名 (進捗率%)` 形式のスコープを検出
   - 「### 未着手スコープ」セクションから `- [ ] スコープ名 (0%)` または `- [ ] スコープ名` 形式のスコープを検出
   - 「### 完了済みスコープ」セクションから `- [x] スコープ名 (100%)` 形式のスコープを検出

2. **ファイルリストの検出**:
   - 「## スコープ名」形式のセクションからそのスコープに関連するファイルリストを検出
   - `- [x] ファイルパス` は完了したファイル、`- [ ] ファイルパス` は未完了のファイルとして認識
   - **重要**: ファイルリストは「## スコープ名」の直下に配置する必要があります
   - **重要**: ファイルリストとスコープ名の間に他の見出し（###など）を入れるとパースされません
   - **重要**: カテゴリ分けする場合は、最初に少なくとも1つのファイルを直接リストした後、太字テキストでカテゴリを表示します

3. **進捗率の計算**:
   - 各スコープの進捗率はファイルリストの完了状態から自動計算される
   - 明示的に記載された進捗率（例：`スコープ名 (50%)`）も認識される

4. **セクション名の重要性**:
   - 「### 完了済みスコープ」「### 進行中スコープ」「### 未着手スコープ」の見出しは正確に記述する必要があります
   - 「## スコープ名」の見出しはスコープ名と完全に一致する必要があります

5. **パースに影響しない追加情報の記述方法**:
   - ファイルリストの後にメモや参考資料を追加する場合は「### 参考資料」のように見出しを使用できます
   - スコープ内でファイルをカテゴリに分ける場合は、見出し（###）ではなく**太字テキスト**を使用してください