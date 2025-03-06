# AILP#2 開発ガイド

このファイルはプロジェクトの中心的なドキュメントです。各セクションは対応するファイルへのリンクとなっています。

## 要件定義

[要件定義ファイル](./docs/requirements.md) - プロジェクトの機能要件と非機能要件

## 実装スコープ
- [実装スコープファイル](./docs/scope.md) - 実装する機能の詳細と優先順位
- [LP作成ページの要件定義](./docs/scopes/LP作成ページ2-requirements.md) - LP作成ページの詳細要件
- [テスト結果画面の要件定義](./docs/scopes/テスト結果-requirements.md) - テスト結果画面の詳細要件
- [管理ページの要件定義](./docs/scopes/管理ページ-requirements.md) - 管理ページの詳細要件
- [ログイン機能の要件定義](./docs/scopes/モックアップログイン-requirements.md) - ログイン機能の詳細要件
- [会員管理の要件定義](./docs/scopes/会員管理-requirements.md) - 会員管理機能の詳細要件

## モックアップ
[モックアップフォルダ](./mockups/) - UIデザインとプロトタイプ

## ディレクトリ構造
[ディレクトリ構造ファイル](./docs/structure.md) - プロジェクトのフォルダ構成

## API設計
[API設計ファイル](./docs/api.md) - APIエンドポイントの定義

## 環境設定
[環境変数サンプル](./docs/env.example) - 必要な環境変数の設定例

## ビルドコマンド
```bash
# 開発時のビルド
npm install
npm run dev

# 本番用ビルド
npm run build
```

## コーディング規約
- クラス名: PascalCase
- メソッド名: camelCase
- プライベート変数: _camelCase
- 定数: UPPER_CASE
- インターフェース名: IPascalCase
- 型名: TPascalCase

## 重要な実装ポイント

### AIとの連携
- セクション分割処理: ユーザー入力を複数のセクションに分割してAIに処理させる
- 並列処理: 複数セクションを同時に処理し、生成時間を短縮
- コードブロック抽出: AIからのレスポンスからHTMLコードのみを抽出
- トンマナの統一: 全てのセクションで一貫したデザインを適用

### パフォーマンス最適化
- キャッシュ戦略: 類似リクエストの結果を再利用
- 画像処理: 非同期処理とCDN配置
- レート制限対策: AIサービスの呼び出し制限に対応するキューイング

## Project Scope: 多変量テストLP作成システム

### General Information
- **Name**: 多変量テストLP作成システム
- **Description**: 技術レベルの高くないユーザーが、多変量テスト（A/Bテスト）を実施できるランディングページ作成・管理システム
- **Project Path**: /Users/tatsuya/Desktop/システム開発/AILP#2

### Current Implementation Status
- **Setup**: 未完了
- **Authentication**: 未完了
- **Dashboard**: 未完了
- **LP Builder**: 未完了
- **A/B Testing**: 未完了
- **Test Results**: 未完了
- **Members Management**: 未完了

### Next Implementation Items
1. **初期セットアップ/環境構築** (ID: SETUP-01)
   - Next.js、Tailwind CSS、Prisma、Supabase等の初期設定
   - 基本コンポーネントのセットアップ
   - データベーススキーマの定義

2. **認証システム** (ID: AUTH-01)
   - ログイン/登録画面の実装
   - Supabase認証の連携
   - ミドルウェアによる認証ルートの保護

3. **ダッシュボード・LP管理** (ID: DASHBOARD-01)
   - LP一覧表示
   - フィルタリング・検索機能
   - LP操作（新規作成、編集、複製、削除）

### Related Files
For **SETUP-01**:
- package.json
- tailwind.config.js
- next.config.js
- prisma/schema.prisma
- src/lib/supabase.ts
- src/components/ui/* (基本UIコンポーネント)
- .env.local.example

For **AUTH-01**:
- src/app/(auth)/login/page.tsx
- src/app/(auth)/register/page.tsx
- src/app/(auth)/forgot-password/page.tsx
- src/components/auth/*
- src/lib/auth/*
- src/middleware.ts

For **DASHBOARD-01**:
- src/app/(dashboard)/dashboard/page.tsx
- src/components/dashboard/*
- src/app/api/lp/*
- src/lib/api/lp.ts
- src/server/db/lp.ts

## 進捗状況
- 要件定義: 完了
- モックアップ: 完了
- ディレクトリ構造: 完了
- API設計: 部分的に完了
- 実装スコープ: 完了
- 実装: 未開始
- テスト: 未開始
- デプロイ: 未開始

## 開発達成率
- 作成済みファイル: 5 (LP作成ページ要件定義、テスト結果画面要件定義、管理ページ要件定義、ログイン機能要件定義、会員管理要件定義)
- ディレクトリ構造設計: 完了
- 実装スコープ設計: 完了
- 達成率: 40%

## チェックリスト
- [x] 要件定義の完了
- [x] LP作成ページモックアップの改修
- [x] LP作成ページ要件定義の作成
- [x] テスト結果画面モックアップの改修
- [x] テスト結果画面要件定義の作成
- [x] 管理ページモックアップの改修
- [x] 管理ページ要件定義の作成
- [x] ログインページモックアップの改修
- [x] ログイン機能要件定義の作成
- [x] 会員管理モックアップの作成
- [x] 会員管理要件定義の作成
- [x] ディレクトリ構造の確定
- [ ] API設計の完了
- [ ] 環境変数の設定
- [x] 実装スコープの決定
- [ ] 実装の開始
  - [ ] スコープ1: 初期セットアップ/環境構築
  - [ ] スコープ2: 認証システム
  - [ ] スコープ3: ダッシュボード・LP管理
  - [ ] スコープ4: AI主導のLP作成機能
  - [ ] スコープ5: バリアントテスト機能
  - [ ] スコープ6: テスト結果分析
  - [ ] スコープ7: 会員管理機能
- [ ] テストの実施
- [ ] デプロイの準備

## プロジェクト情報
- 作成日: 2025-03-06
- 更新日: 2025-03-07
- 最終スコープ更新日: 2025-03-07
- 作成者: AppGenius AI
- ステータス: 開発準備完了