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

### セキュリティと認証に関する注意
- **モック禁止**: いかなる機能も絶対にモック化しないでください。実際のデータベースとAPIを常に使用してください。
- **認証機能のモック禁止**: 認証機能は必ず実際のSupabase認証を使用し、モックを作成しないこと
- セキュアなセッション管理: 認証情報は適切に保護し、セッショントークンの管理を徹底すること
- 統一されたリダイレクト処理: リダイレクト処理は一貫した方法で実装し、複数の手法を混在させないこと

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

## データベース接続に関する重要な注意

### Supabase接続設定

このプロジェクトではSupabaseのPostgreSQLデータベースを使用しています。接続時には以下の点に注意してください：

1. **パスワードの扱い**: パスワードに特殊文字（`@`など）が含まれる場合、環境変数では URLエンコードしない形式で記述する必要があります。
   - 正しい例: `Password@123`
   - 間違った例: `Password%40123` (URLエンコードされている)

2. **接続種類別のURL形式と推奨設定**:
   - **トランザクションプーラー接続** (最も推奨): 
     ```
     DATABASE_URL=postgresql://postgres.qdjikxdmpctkfpvkqaof:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
     ```
     **重要**: `?pgbouncer=true` のようなパラメータを追加しないでください。Prismaとの互換性に問題が生じます。
   - **セッションプーラー接続**: 
     ```
     DATABASE_URL=postgresql://postgres.qdjikxdmpctkfpvkqaof:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
     ```
   - **直接接続** (バックアップとして設定): 
     ```
     DIRECT_URL=postgresql://postgres:PASSWORD@db.qdjikxdmpctkfpvkqaof.supabase.co:5432/postgres
     ```

3. **トランザクションプーラー推奨理由**:
   - IPv4ネットワークとの互換性あり
   - 多数のクライアント接続に対応
   - 短時間の接続に最適化
   - ポート番号が6543であることに注意（セッションプーラーは5432）

4. **必須の環境変数設定**:
   ```
   # プールされた接続をDATABASE_URLとして使用（パラメータなしで設定）
   DATABASE_URL=postgresql://postgres.qdjikxdmpctkfpvkqaof:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   # 直接接続
   DIRECT_URL=postgresql://postgres:PASSWORD@db.qdjikxdmpctkfpvkqaof.supabase.co:5432/postgres
   # プリペアードステートメントを無効化（重要）
   PRISMA_CLIENT_NO_PREPARED_STATEMENTS=true
   ```

5. **Prismaクライアントの正しい初期化方法**:
   ```typescript
   // src/lib/db/prisma.ts
   import { PrismaClient } from '@prisma/client';

   const globalForPrisma = global as unknown as { prisma: PrismaClient };

   // データベース接続設定を明示的に指定
   const prismaClientSingleton = () => {
     return new PrismaClient({
       log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
       datasources: {
         db: {
           url: process.env.DATABASE_URL
         }
       },
       // 追加の推奨設定（より寛容な設定）
       errorFormat: 'pretty'
       // 注意: rejectOnNotFoundは新しいPrismaバージョンでは非推奨/サポートされていません
     });
   };

   export const prisma = globalForPrisma.prisma || prismaClientSingleton();

   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
   ```
   **重要**: `datasources.db.url`を明示的に指定すると、接続エラーを回避できます。

6. **接続テスト**: データベース接続に問題がある場合は以下のテストスクリプトを使用してください：
   ```bash
   # 詳細な接続診断
   node temp/detailed-connection-diagnostics.js
   
   # PrismaClientを使用した接続テスト
   node temp/test-db-connection-v2.js
   ```

7. **接続エラーの一般的な解決方法**:
   - DATABASE_URLをトランザクションプーラー（ポート6543）に変更する
   - 接続文字列に `?pgbouncer=true` などのパラメータが含まれている場合は削除する
   - 必ずDIRECT_URLも設定する（Prismaマイグレーション用）
   - PRISMA_CLIENT_NO_PREPARED_STATEMENTS=trueを設定する
   - Prismaクライアントで`datasources.db.url`を明示的に指定する
   - パスワード内の特殊文字が正しく扱われているか確認する
   - 接続プールの最大接続数を確認する

### データベース構築

テーブルを構築するには以下のコマンドを実行します：
```bash
npx prisma db push
```

### トラブルシューティング

- **接続エラー**: 「Can't reach database server」エラーが発生した場合は、まず接続文字列とパスワードの形式を確認してください。URL内のパラメータ（`?pgbouncer=true`など）は削除してください。
- **MaxClientsInSessionMode**: セッションプーラーの最大接続数に達した場合は、一部の接続を閉じるか、少し時間をおいて再試行してください。トランザクションプーラー（ポート6543）の使用を検討してください。
- **RLS(Row Level Security)警告**: Supabaseのセキュリティ設定で必要に応じてRLSを有効にしてください。
- **Prisma接続エラー**: Prismaを使用する場合は特に`?pgbouncer=true`などのパラメータを使わないようにし、PRISMA_CLIENT_NO_PREPARED_STATEMENTSをtrueに設定してください。

## データベースモデルの使用に関する注意事項

### 中央モデル定義ファイルの利用

本プロジェクトでは、モデル名の混乱を避けるため、中央モデル定義ファイル `/src/lib/db/models.ts` を使用しています。このファイルでは実際のPrismaモデル名とアプリケーション内部で使用する名前のマッピングを定義しています。

```typescript
// models.ts - 中央データベースモデル定義ファイル
import { prisma } from './prisma';

// モデル定義（実際のテーブル名と内部使用名のマッピング）
export const LP = prisma.lpProject;                 // LPプロジェクトモデル
export const LPComponent = prisma.lpComponentNew;   // LPコンポーネントモデル (新)
export const ComponentVariant = prisma.lpComponentVariant; // コンポーネントバリアント
export const TestSetting = prisma.testSetting;      // テスト設定モデル
// ... 他のモデルも同様に定義

// エラーハンドリング共通関数
export function handleDbError(error: unknown, message: string): Error {
  console.error(`Database error - ${message}:`, error);
  return new Error(message);
}
```

### モデル使用時の推奨事項

1. **直接の Prisma モデルアクセスを避ける**: 
   ```typescript
   // 非推奨
   const lps = await prisma.lpProject.findMany({ ... });
   
   // 推奨
   import { LP } from '@/lib/db/models';
   const lps = await LP.findMany({ ... });
   ```

2. **エラーハンドリングの統一**: 
   ```typescript
   // 非推奨
   try {
     const result = await LP.findMany({ ... });
     return result;
   } catch (error) {
     console.error('エラー:', error);
     throw new Error('データベースエラーが発生しました');
   }
   
   // 推奨
   import { LP, handleDbError } from '@/lib/db/models';
   try {
     const result = await LP.findMany({ ... });
     return result;
   } catch (error) {
     throw handleDbError(error, 'データの取得に失敗しました');
   }
   ```

3. **オプショナル値の安全な取り扱い**:
   ```typescript
   // データ作成時のオプショナルフィールド
   await LP.create({
     data: {
       userId,
       title,
       description: description || undefined,  // null ではなく undefined を使用
       status: status || 'draft',
       designSystem: designSystem || undefined,
     }
   });
   ```

### マイグレーション時の注意

既存の`LP`モデルと新しい`LpProject`モデルなど、複数の似たモデルが存在する場合、マイグレーション時には特に注意してください。

1. マイグレーション前に必ずバックアップを取る
2. `npx prisma db push --force-reset` は本番環境では絶対に使用しない
3. データの移行計画を立ててから実行する

### チーム開発のためのベストプラクティス

1. **タスク分割**:
   - データモデルごとにタスクを分割する（例：LP、Component、Variant）
   - 各AIはそれぞれのモデルに関連する操作に集中する

2. **PRのガイドライン**:
   - データベースモデルの変更を含むPRは小さく保つ
   - スキーマ変更とそれを使用するコードは同じPRに含める
   - 変更の理由と影響範囲を明示的に記載する

3. **コードレビュー基準**:
   - 中央定義モデルの使用を確認する
   - エラーハンドリングの一貫性をチェックする
   - オプショナルフィールドが正しく処理されていることを確認する

4. **コミュニケーション**:
   - モデル変更を行う場合は事前に他のAIに知らせる
   - 問題発生時には変更箇所を明確に特定できるよう進める

### モデル使用時の推奨事項

1. **直接の Prisma モデルアクセスを避ける**: 
   ```typescript
   // 非推奨
   const lps = await prisma.lpProject.findMany({ ... });
   
   // 推奨
   import { LP } from '@/lib/db/models';
   const lps = await LP.findMany({ ... });
   ```

2. **エラーハンドリングの統一**: 
   ```typescript
   // 非推奨
   try {
     const result = await LP.findMany({ ... });
     return result;
   } catch (error) {
     console.error('エラー:', error);
     throw new Error('データベースエラーが発生しました');
   }
   
   // 推奨
   import { LP, handleDbError } from '@/lib/db/models';
   try {
     const result = await LP.findMany({ ... });
     return result;
   } catch (error) {
     throw handleDbError(error, 'データの取得に失敗しました');
   }
   ```

3. **オプショナル値の安全な取り扱い**:
   ```typescript
   // データ作成時のオプショナルフィールド
   await LP.create({
     data: {
       userId,
       title,
       description: description || undefined,  // null ではなく undefined を使用
       status: status || 'draft',
       designSystem: designSystem || undefined,
     }
   });
   ```

### マイグレーション時の注意

既存の`LP`モデルと新しい`LpProject`モデルなど、複数の似たモデルが存在する場合、マイグレーション時には特に注意してください。

1. マイグレーション前に必ずバックアップを取る
2. `npx prisma db push --force-reset` は本番環境では絶対に使用しない
3. データの移行計画を立ててから実行する

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

## テスト用アカウント情報
- メールアドレス: test123@mailinator.com
- パスワード: password123
- 用途: 開発環境でのUI/UX確認用
## スコープ

### スコープ: 要件定義からの抽出 2025-03-06

- ID: scope-1741276315960-414f90ba
- 説明: 要件定義から自動抽出された実装項目のスコープ
- 状態: ✅ 実装予定
- 工数見積: 未見積
- 開始日: 2025-03-06

#### 実装項目

- [ ] ユーザー登録機能
  - ID: AUTH-001
  - 説明: 新規ユーザーが名前、メールアドレス、パスワードを入力して登録できる機能
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし

- [ ] ログイン機能
  - ID: AUTH-002
  - 説明: メールアドレスとパスワードによる認証とログイン状態保持オプション
  - 優先度: high
  - 複雑度: medium
  - 依存関係: AUTH-001

- [ ] パスワードリセット機能
  - ID: AUTH-003
  - 説明: ユーザーがパスワードを忘れた場合にリセットできる機能
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: AUTH-001

- [ ] LP一覧表示機能
  - ID: DASH-001
  - 説明: 作成したLPをサムネイル、タイトル、説明文、ステータス、作成日、コンバージョン率と共に表示
  - 優先度: high
  - 複雑度: medium
  - 依存関係: AUTH-002

- [ ] フィルタリング機能
  - ID: DASH-002
  - 説明: LPをステータス別にフィルタリングし、タイトルや説明文での検索が可能
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: DASH-001

- [ ] LP操作機能
  - ID: DASH-003
  - 説明: 新規LP作成、既存LP編集、LP複製、LP削除などの基本操作
  - 優先度: high
  - 複雑度: medium
  - 依存関係: DASH-001

- [ ] カード形式のビジュアル表示
  - ID: DASH-004
  - 説明: LP一覧をカード形式で表示し、ステータスバッジやコンバージョン率などの重要指標を表示
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: DASH-001

- [ ] LP基本情報設定
  - ID: LP-001
  - 説明: プロジェクト名、概要説明文、目標設定（コンバージョン定義）などの基本情報を設定
  - 優先度: high
  - 複雑度: low
  - 依存関係: DASH-003

- [ ] AI対話型LP作成プロセス
  - ID: LP-002
  - 説明: ユーザーとAIの対話を通じてLPを作成するプロセス。参考LPや参考サイトURL、参考デザイン画像のアップロードを含む
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-001

- [ ] マーケティングフレームワーク分析
  - ID: LP-003
  - 説明: AIによるフレームワーク分析、フレームワークに基づいた質問生成、ユーザー回答収集インターフェース
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-002

- [ ] ディレクトリ構造自動生成
  - ID: LP-004
  - 説明: コンポーネント分解、A/Bバリアント用構造設計、コンポーネント間の関連性設定
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-003

- [ ] AIコンテンツ生成機能
  - ID: LP-005
  - 説明: ユーザー回答に基づくコンテンツ自動生成と各コンポーネントごとのA/Bバリアント生成
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-004

- [ ] コード生成機能
  - ID: LP-006
  - 説明: HTML/CSS/JSコードとReactコンポーネントの自動生成
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-005

- [ ] プレビューと修正機能
  - ID: LP-007
  - 説明: リアルタイムプレビュー表示、デスクトップ/モバイル表示切り替え、バリアントA/B切り替え表示、AIへの修正指示機能
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-006

- [ ] テスト期間設定
  - ID: TEST-001
  - 説明: 開始日・終了日の設定と推奨テスト期間の表示
  - 優先度: high
  - 複雑度: medium
  - 依存関係: LP-007

- [ ] コンバージョン目標設定
  - ID: TEST-002
  - 説明: 主要コンバージョン目標の選択（フォーム送信、ボタンクリック等）
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-001

- [ ] テスト対象コンポーネント選択
  - ID: TEST-003
  - 説明: テスト対象コンポーネントの選択とシンプルな配分設定
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-002

- [ ] テスト開始機能
  - ID: TEST-004
  - 説明: テスト設定確認チェックリストとテスト開始ボタン
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-003

- [ ] テスト結果概要表示
  - ID: TEST-005
  - 説明: 総訪問者数、総コンバージョン数、全体コンバージョン率、全体の改善率などの表示
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-004

- [ ] コンポーネント別テスト結果テーブル
  - ID: TEST-006
  - 説明: コンポーネント別のバリアントA/Bのデータ表示、改善率、統計的信頼度、有意差表示、勝者バリアント表示
  - 優先度: high
  - 複雑度: high
  - 依存関係: TEST-005

- [ ] アクションボタン機能
  - ID: TEST-007
  - 説明: 勝者を適用、次のテスト作成、プレビューなどのアクションボタン
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-006

- [ ] デバイス別データ表示
  - ID: TEST-008
  - 説明: デスクトップ/モバイル別の比較データとデバイス別の勝者表示
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: TEST-006

- [ ] AI分析機能
  - ID: TEST-009
  - 説明: 全セクション横断分析と効果的なパターンの抽出・表示
  - 優先度: medium
  - 複雑度: high
  - 依存関係: TEST-006

- [ ] 過去テスト履歴とアーカイブ
  - ID: TEST-010
  - 説明: 過去のテスト結果参照、成功パターンの勝敗実績表示、アーカイブ検索・フィルタリング機能
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: TEST-006

- [ ] AI支援ユーザビリティ
  - ID: UI-001
  - 説明: 自然言語による操作、AIによるガイド付きフロー、コーディング知識不要の完全AIベース編集
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-002, LP-005

- [ ] リアルタイムプレビューとフィードバック
  - ID: UI-002
  - 説明: 変更の即時可視化、AIによる改善提案、バリアント間の比較プレビュー
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-007

- [ ] ユーザー習熟度に応じた支援
  - ID: UI-003
  - 説明: 初心者向け詳細ガイド、上級者向けショートカット、AIによる学習パターン検出と操作最適化
  - 優先度: medium
  - 複雑度: high
  - 依存関係: UI-001

- [ ] ページ読み込み最適化
  - ID: PERF-001
  - 説明: ページ読み込み時間を2秒以内に抑えるための最適化
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: なし

- [ ] レスポンシブデザイン対応
  - ID: PERF-002
  - 説明: スマートフォン、タブレット、デスクトップに対応したレスポンシブデザイン
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし

- [ ] セキュリティ実装
  - ID: SEC-001
  - 説明: パスワードの安全な保存（ハッシュ化）、XSS対策、CSRF対策、データバックアップ
  - 優先度: high
  - 複雑度: high
  - 依存関係: AUTH-001

- [ ] ブラウザ互換性対応
  - ID: COMPAT-001
  - 説明: 主要ブラウザ（Chrome、Firefox、Safari、Edge）およびモバイルブラウザへの対応
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし





このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login




このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login




### スコープ: 要件定義からの抽出 2025-03-06

- ID: scope-1741276088293-35fba579
- 説明: 要件定義から自動抽出された実装項目のスコープ
- 状態: ✅ 実装予定
- 工数見積: 未見積
- 開始日: 2025-03-06

#### 実装項目

- [ ] ユーザー登録機能
  - ID: AUTH-001
  - 説明: 名前、メールアドレス、パスワードを入力して新規ユーザーを登録する機能。
  - 優先度: high
  - 複雑度: low
  - 依存関係: なし

- [ ] ログイン機能
  - ID: AUTH-002
  - 説明: メールアドレスとパスワードによる認証とログイン状態を保持するオプション。
  - 優先度: high
  - 複雑度: low
  - 依存関係: AUTH-001

- [ ] パスワードリセット機能
  - ID: AUTH-003
  - 説明: パスワードを忘れたユーザーがリセットできる機能。
  - 優先度: medium
  - 複雑度: low
  - 依存関係: AUTH-001

- [ ] ダッシュボードLP一覧表示
  - ID: DASH-001
  - 説明: サムネイル画像、タイトル、説明文、ステータス、作成日、コンバージョン率を含むLP一覧を表示する機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: AUTH-002

- [ ] LPフィルタリング機能
  - ID: DASH-002
  - 説明: ステータス別フィルターとタイトル・説明文による検索機能。
  - 優先度: medium
  - 複雑度: low
  - 依存関係: DASH-001

- [ ] LP操作機能
  - ID: DASH-003
  - 説明: 新規LP作成、既存LP編集、LP複製、LP削除などの基本操作機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: DASH-001

- [ ] LP基本情報設定
  - ID: LP-001
  - 説明: プロジェクト名、概要説明文、目標設定（コンバージョン定義）の設定機能。
  - 優先度: high
  - 複雑度: low
  - 依存関係: DASH-003

- [ ] AI対話型LP作成インターフェース
  - ID: LP-002
  - 説明: 参考LP入力/アップロード、URL入力、デザイン画像アップロード機能を含む対話型インターフェース。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-001

- [ ] マーケティングフレームワーク分析
  - ID: LP-003
  - 説明: AIによるフレームワーク分析、質問生成、ユーザー回答収集インターフェース。
  - 優先度: medium
  - 複雑度: high
  - 依存関係: LP-002

- [ ] ディレクトリ構造自動生成
  - ID: LP-004
  - 説明: コンポーネント分解、A/Bバリアント用構造設計、コンポーネント間の関連性設定。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-003

- [ ] AIコンテンツ生成機能
  - ID: CONTENT-001
  - 説明: ユーザー回答に基づくコンテンツ自動生成。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-003, LP-004

- [ ] A/Bバリアント生成
  - ID: CONTENT-002
  - 説明: 各コンポーネントごとのA/Bバリアント生成、差別化ポイントの自動分析と実装。
  - 優先度: high
  - 複雑度: high
  - 依存関係: CONTENT-001

- [ ] コード生成機能
  - ID: CONTENT-003
  - 説明: HTML/CSS/JSコードとReactコンポーネントの自動生成。
  - 優先度: high
  - 複雑度: high
  - 依存関係: CONTENT-002

- [ ] リアルタイムプレビュー機能
  - ID: PREVIEW-001
  - 説明: 生成したLPのリアルタイムプレビュー表示機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: CONTENT-003

- [ ] レスポンシブプレビュー機能
  - ID: PREVIEW-002
  - 説明: デスクトップ/モバイル表示切り替え機能。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: PREVIEW-001

- [ ] バリアント切替表示
  - ID: PREVIEW-003
  - 説明: バリアントA/B切り替え表示機能。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: PREVIEW-001, CONTENT-002

- [ ] AIへの修正指示機能
  - ID: EDIT-001
  - 説明: テキストプロンプトによる修正指示、部分的な再生成指示、コンポーネント単位の調整機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: PREVIEW-001

- [ ] テスト期間設定
  - ID: TEST-001
  - 説明: テストの開始日・終了日を設定する機能。
  - 優先度: high
  - 複雑度: low
  - 依存関係: PREVIEW-001

- [ ] トラフィック配分設定
  - ID: TEST-002
  - 説明: コンポーネント単位での配分比率調整、デバイス別配分設定機能。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: TEST-001

- [ ] コンバージョン目標設定
  - ID: TEST-003
  - 説明: プライマリ目標、セカンダリ目標、マイクロコンバージョン計測の設定機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-001

- [ ] テスト自動実行機能
  - ID: TEST-004
  - 説明: テスト開始/停止/一時停止、リアルタイムステータス監視機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-001, TEST-002, TEST-003

- [ ] 自動トラッキングシステム
  - ID: TRACK-001
  - 説明: ユーザー行動の匿名トラッキング、コンポーネント毎の滞在時間計測、クリックヒートマップ生成機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: TEST-004

- [ ] リアルタイムデータ分析
  - ID: ANALYSIS-001
  - 説明: コンバージョン率グラフ表示、詳細データ表示、コンポーネント間の相関分析、デバイス別分析機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: TRACK-001

- [ ] AIによるインサイト生成
  - ID: ANALYSIS-002
  - 説明: バリアント比較と統計的有意差判定、勝者バリアント自動特定、パフォーマンス要因分析、パターン分析機能。
  - 優先度: medium
  - 複雑度: high
  - 依存関係: ANALYSIS-001

- [ ] 自動最適化機能
  - ID: ANALYSIS-003
  - 説明: テスト結果と過去データに基づく次バリアント自動生成提案、成功パターンの抽出と履歴管理機能。
  - 優先度: low
  - 複雑度: high
  - 依存関係: ANALYSIS-002

- [ ] AI支援ユーザビリティの実装
  - ID: UI-001
  - 説明: 自然言語による操作、AIによるガイド付きフロー、リアルタイムフィードバック機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-002, EDIT-001

- [ ] セキュリティ対策実装
  - ID: SECURITY-001
  - 説明: パスワードのハッシュ化、XSS対策、CSRF対策、データバックアップ機能の実装。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: AUTH-001, AUTH-002

- [ ] パフォーマンス最適化
  - ID: PERF-001
  - 説明: ページ読み込み時間の最適化、レスポンシブデザイン対応、同時ユーザー数対応の実装。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: PREVIEW-001, DASH-001





このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login




このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login




### スコープ: 要件定義からの抽出 2025-03-06

- ID: scope-1741275082028-a7c46e58
- 説明: 要件定義から自動抽出された実装項目のスコープ
- 状態: ✅ 実装予定
- 工数見積: 未見積
- 開始日: 2025-03-06

#### 実装項目

- [ ] ユーザー登録機能
  - ID: AUTH-001
  - 説明: 新規ユーザーを登録するための機能。メールアドレス、パスワード、名前の入力を受け付ける。
  - 優先度: high
  - 複雑度: low
  - 依存関係: なし

- [ ] ログイン機能
  - ID: AUTH-002
  - 説明: メールアドレスとパスワードによる認証およびログイン状態保持オプションの実装。
  - 優先度: high
  - 複雑度: low
  - 依存関係: AUTH-001

- [ ] パスワードリセット機能
  - ID: AUTH-003
  - 説明: ユーザーがパスワードを忘れた場合にリセットする機能。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: AUTH-001

- [ ] LP一覧表示機能
  - ID: DASH-001
  - 説明: ダッシュボードにLPをサムネイル、タイトル、説明文、ステータス、作成日、コンバージョン率と共に一覧表示する。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: AUTH-002

- [ ] LPフィルタリング機能
  - ID: DASH-002
  - 説明: LPをステータス別にフィルタリングし、タイトルや説明文で検索できる機能。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: DASH-001

- [ ] LP操作基本機能
  - ID: DASH-003
  - 説明: 新規LP作成、既存LP編集、LP複製、LP削除などの基本操作機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: DASH-001

- [ ] LP基本情報設定
  - ID: LP-001
  - 説明: プロジェクト名、概要説明、目標設定（コンバージョン定義）などの基本情報を設定する機能。
  - 優先度: high
  - 複雑度: low
  - 依存関係: DASH-003

- [ ] AI対話型LP作成インターフェース
  - ID: LP-002
  - 説明: コンテンツ入力、参考URL入力、参考デザイン画像アップロードなどを通じてAIと対話しながらLPを作成するインターフェース。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-001

- [ ] マーケティングフレームワーク分析
  - ID: LP-003
  - 説明: AIによるフレームワーク（AIDMA, AISASなど）分析および質問生成、回答収集機能。
  - 優先度: medium
  - 複雑度: high
  - 依存関係: LP-002

- [ ] ディレクトリ構造自動生成
  - ID: LP-004
  - 説明: コンポーネント分解、A/Bバリアント用構造設計、コンポーネント間の関連性設定機能。
  - 優先度: medium
  - 複雑度: high
  - 依存関係: LP-003

- [ ] AIコンテンツ生成機能
  - ID: LP-005
  - 説明: ユーザー回答に基づくコンテンツ自動生成と各コンポーネントのA/Bバリアント生成機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-004

- [ ] コード自動生成機能
  - ID: LP-006
  - 説明: HTML/CSS/JSコードおよびReactコンポーネントの自動生成機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-005

- [ ] リアルタイムプレビュー機能
  - ID: LP-007
  - 説明: 作成したLPのリアルタイムプレビュー表示、デスクトップ/モバイル表示切り替え、バリアントA/B切り替え表示機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: LP-006

- [ ] AI修正指示機能
  - ID: LP-008
  - 説明: テキストプロンプトによる修正指示、部分的な再生成指示、コンポーネント単位の調整機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-007

- [ ] テスト基本設定機能
  - ID: TEST-001
  - 説明: テスト期間設定、コンバージョン目標設定などのテスト基本設定を行う機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: LP-007

- [ ] テスト対象選択機能
  - ID: TEST-002
  - 説明: テスト対象コンポーネント選択とシンプルな配分設定（50:50固定）を行う機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-001

- [ ] テスト開始機能
  - ID: TEST-003
  - 説明: テスト設定確認チェックリストの表示とテスト開始を実行する機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-002

- [ ] 自動トラッキングシステム
  - ID: TEST-004
  - 説明: ユーザー行動の匿名トラッキング、コンポーネント毎の滞在時間計測、クリックヒートマップ生成機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: TEST-003

- [ ] テスト結果概要表示
  - ID: ANAL-001
  - 説明: 総訪問者数、総コンバージョン数、全体コンバージョン率、全体の改善率の表示機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-004

- [ ] コンポーネント別テスト結果表示
  - ID: ANAL-002
  - 説明: コンポーネント別にバリアントA/Bのデータ、改善率、統計的信頼度、勝者バリアント表示機能。
  - 優先度: high
  - 複雑度: high
  - 依存関係: ANAL-001

- [ ] テスト結果アクション機能
  - ID: ANAL-003
  - 説明: 勝者バリアントの本番適用、次のテスト作成、バリアント比較表示などのアクション機能。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: ANAL-002

- [ ] デバイス別データ表示機能
  - ID: ANAL-004
  - 説明: デスクトップ/モバイル別の比較データと勝者表示機能。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: ANAL-002

- [ ] AI分析機能
  - ID: ANAL-005
  - 説明: 全セクション横断分析と効果的なパターンの抽出・表示機能。
  - 優先度: medium
  - 複雑度: high
  - 依存関係: ANAL-002

- [ ] 過去テスト履歴管理
  - ID: ANAL-006
  - 説明: 過去のテスト結果参照、成功パターンの勝敗実績表示、アーカイブ検索・フィルタリング機能。
  - 優先度: low
  - 複雑度: medium
  - 依存関係: ANAL-003

- [ ] ログイン・登録画面UI
  - ID: UI-001
  - 説明: メールアドレス入力、パスワード入力、ログインボタン、パスワードリセットリンク、アカウント登録リンクなどのUI実装。
  - 優先度: high
  - 複雑度: low
  - 依存関係: AUTH-001, AUTH-002, AUTH-003

- [ ] ダッシュボード画面UI
  - ID: UI-002
  - 説明: ヘッダー、LP一覧、LP操作メニュー、通知エリアなどのダッシュボード画面UI実装。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: DASH-001, DASH-002, DASH-003

- [ ] LP作成・編集画面UI
  - ID: UI-003
  - 説明: プロジェクト情報セクション、AI対話インターフェース、フレームワーク分析・設計エリア、プレビューエリア、生成コントロールなどのUI実装。
  - 優先度: high
  - 複雑度: high
  - 依存関係: LP-001, LP-002, LP-003, LP-004, LP-005, LP-006, LP-007, LP-008

- [ ] テスト設定画面UI
  - ID: UI-004
  - 説明: テスト基本設定、テスト対象選択、テスト開始機能などのテスト設定画面UI実装。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: TEST-001, TEST-002, TEST-003

- [ ] テスト結果画面UI
  - ID: UI-005
  - 説明: テスト結果概要、コンポーネント別テスト結果テーブル、アクションボタン、オプション表示領域、過去テスト履歴表示などのUI実装。
  - 優先度: high
  - 複雑度: high
  - 依存関係: ANAL-001, ANAL-002, ANAL-003, ANAL-004, ANAL-005, ANAL-006

- [ ] データベース設計と実装
  - ID: DB-001
  - 説明: ユーザー、LPプロジェクト、LPコンポーネント、コンポーネントバリアント、テスト設定、テストセッション、イベントトラッキング、テスト分析結果、テスト履歴、パターン分析のデータモデル設計と実装。
  - 優先度: high
  - 複雑度: high
  - 依存関係: なし

- [ ] インフラ構築
  - ID: INFRA-001
  - 説明: Vercel、Supabase、AWS S3、Cloudflareなどのインフラ構築。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし

- [ ] AI連携基盤実装
  - ID: AI-001
  - 説明: OpenAI API、Anthropic Claude API、Langchain.js、Vercel AI SDK、Vector DBなどのAI連携基盤の実装。
  - 優先度: high
  - 複雑度: high
  - 依存関係: INFRA-001

- [ ] セキュリティ対策実装
  - ID: SEC-001
  - 説明: パスワードのハッシュ化、XSS対策、CSRF対策、データバックアップなどのセキュリティ対策実装。
  - 優先度: high
  - 複雑度: medium
  - 依存関係: AUTH-001, AUTH-002, DB-001

- [ ] パフォーマンス最適化
  - ID: PERF-001
  - 説明: ページ読み込み時間の最適化、レスポンシブデザイン対応、同時ユーザー対応などのパフォーマンス最適化。
  - 優先度: medium
  - 複雑度: medium
  - 依存関係: UI-001, UI-002, UI-003, UI-004, UI-005





このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login




このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login


