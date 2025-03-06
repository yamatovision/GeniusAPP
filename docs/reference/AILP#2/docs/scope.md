# 実装スコープ

## 完了

（まだ完了した項目はありません）

## 進行中

（実装中の項目がここに表示されます）

## 未着手

### スコープ1: 初期セットアップ/環境構築

**スコープID**: SETUP-01  
**説明**: プロジェクトの基盤となる環境を整備する  
**優先度**: 最高（他の機能の前提）  
**含まれる機能**:
1. Next.jsプロジェクトの初期化
2. Tailwind CSS、shadcn/uiの導入
3. Prismaの初期化
4. Supabaseとの連携設定
5. 共通UIコンポーネントのセットアップ
6. 環境変数の設定
7. 基本的なディレクトリ構造の構築

**関連ファイル**: 
- package.json
- tailwind.config.js
- prisma/schema.prisma
- src/lib/supabase.ts
- src/components/ui/*

### スコープ2: 認証システム

**スコープID**: AUTH-01  
**説明**: ユーザー認証機能の実装  
**優先度**: 高（他の機能へのアクセス制御の前提）  
**含まれる機能**:
1. ログイン画面の実装
2. ユーザー登録機能の実装
3. パスワードリセット機能の実装
4. ログイン状態の管理
5. 認証ミドルウェアの実装

**関連ファイル**:
- src/app/(auth)/login/page.tsx
- src/app/(auth)/register/page.tsx
- src/app/(auth)/forgot-password/page.tsx
- src/components/auth/*
- src/lib/auth/*
- src/app/api/auth/*
- src/middleware.ts

### スコープ3: ダッシュボード・LP管理

**スコープID**: DASHBOARD-01  
**説明**: LP一覧表示と基本的な管理機能の実装  
**優先度**: 高  
**含まれる機能**:
1. ダッシュボード画面の実装
2. LP一覧の表示
3. ステータス別フィルタリング
4. 検索機能
5. LP操作（新規作成、編集、複製、削除）
6. LP情報の表示（サムネイル、タイトル、説明、ステータス、作成日、コンバージョン率）

**関連ファイル**:
- src/app/(dashboard)/dashboard/page.tsx
- src/components/dashboard/*
- src/app/api/lp/*
- src/lib/api/lp.ts
- src/server/db/lp.ts
- src/server/api/lp.ts

### スコープ4: AI主導のLP作成機能

**スコープID**: LP-BUILDER-01  
**説明**: AIとの対話を通じたLP作成・編集機能の実装  
**優先度**: 高  
**含まれる機能**:
1. チャット形式のインターフェース
2. AIによるLP構造分析と自動セクション分割
3. AIによるHTMLコード生成
4. プレビュー表示機能
5. セクション単位の修正機能
6. デザインスタイル選択機能

**関連ファイル**:
- src/app/(dashboard)/lp/new/page.tsx
- src/app/(dashboard)/lp/[id]/page.tsx
- src/components/lp-builder/*
- src/app/api/ai/*
- src/lib/ai/*
- src/server/ai/*

### スコープ5: バリアントテスト機能

**スコープID**: AB-TEST-01  
**説明**: A/Bテストの設定、実行、トラッキング機能の実装  
**優先度**: 中  
**含まれる機能**:
1. テスト設定インターフェース
2. バリアントB生成機能
3. テスト実行エンジン
4. トラッキングシステム
5. A/Bテストのルーティング管理

**関連ファイル**:
- src/app/(dashboard)/lp/[id]/test/page.tsx
- src/components/ab-test/*
- src/app/api/tests/*
- src/lib/api/tests.ts
- src/server/db/tests.ts
- src/server/api/tests.ts

### スコープ6: テスト結果分析

**スコープID**: TEST-RESULTS-01  
**説明**: A/Bテストの結果分析と可視化ダッシュボードの実装  
**優先度**: 中  
**含まれる機能**:
1. テスト結果表示ダッシュボード
2. コンポーネント別の結果表示
3. デバイス別分析
4. 統計的有意差の計算・表示
5. AIによるインサイト生成
6. 勝者バリアントの適用

**関連ファイル**:
- src/app/(dashboard)/tests/[id]/page.tsx
- src/components/test-results/*
- src/app/api/analysis/*
- src/lib/api/analysis.ts
- src/server/db/analysis.ts
- src/server/api/analysis.ts

### スコープ7: 会員管理機能

**スコープID**: MEMBERS-01  
**説明**: 会員情報の管理機能の実装  
**優先度**: 低（管理者機能として後回しにできる）  
**含まれる機能**:
1. 会員一覧表示
2. 会員詳細情報表示・編集
3. ステータス管理（有効/お試し/無効/退会）
4. 試用期間管理
5. ウェブフック設定

**関連ファイル**:
- src/app/(dashboard)/members/page.tsx
- src/components/members/*
- src/app/api/members/*
- src/lib/api/members.ts
- src/server/db/members.ts
- src/server/api/members.ts

## 実装スケジュール

**フェーズ1** (40時間):
- スコープ1: 初期セットアップ/環境構築 (16時間)
- スコープ2: 認証システム (24時間)

**フェーズ2** (80時間):
- スコープ3: ダッシュボード・LP管理 (32時間)
- スコープ4: AI主導のLP作成機能 (48時間)

**フェーズ3** (80時間):
- スコープ5: バリアントテスト機能 (40時間)
- スコープ6: テスト結果分析 (40時間)

**フェーズ4** (32時間):
- スコープ7: 会員管理機能 (32時間)

**総作業時間の見積もり**: 232時間