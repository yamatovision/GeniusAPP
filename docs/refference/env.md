# 環境変数リスト

このファイルはプロジェクトで使用する環境変数を管理します。

## 環境変数ステータスについて

- [✓] - 実際の値で設定され、アプリケーションでの接続/動作テストに成功した変数
- [!] - 値は設定されているが、アプリケーションでの接続/動作テストが完了していない変数
- [ ] - 未設定または設定が必要な変数

**重要**: アプリケーションでの接続テストや動作確認が完了していない限り、環境変数は「設定済み」([✓])とは見なしません。ダミー値や仮の値での設定は [!] としてマークしてください。

## 必須環境変数

### データベース設定
[!] `DATABASE_URL` - Prisma用データベース接続文字列（仮の値で設定済み、接続テスト未実施）

### Supabase認証設定
[!] `NEXT_PUBLIC_SUPABASE_URL` - SupabaseプロジェクトのURL（仮の値で設定済み、接続テスト未実施）
[!] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase匿名キー（仮の値で設定済み、接続テスト未実施）

### サーバー設定
[✓] `PORT` - アプリケーションポート（設定済み、テスト完了）
[✓] `NODE_ENV` - 実行環境（設定済み、テスト完了）

## AI機能設定（スコープ4で使用）
[ ] `OPENAI_API_KEY` - OpenAI APIキー
[ ] `OPENAI_API_MODEL` - 使用するモデル名（例: gpt-4o）

## 追加設定（オプション）
[ ] `JWT_SECRET` - JWT認証用の秘密鍵（Supabase使用時は不要）
[ ] `NEXT_PUBLIC_API_URL` - バックエンドAPIのエンドポイントURL
[ ] `NEXT_PUBLIC_SITE_URL` - サイトのベースURL
[ ] `NEXT_PUBLIC_GA_ID` - Google Analyticsのトラッキングコード
[ ] `NEXT_PUBLIC_APP_VERSION` - アプリケーションのバージョン
[ ] `SMTP_HOST` - メール送信サーバーのホスト名
[ ] `SMTP_PORT` - メール送信サーバーのポート番号

## スコープ別必要環境変数

### スコープ2: ユーザー認証
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...your-actual-key
```

### スコープ3: ダッシュボード・LP管理
```
DATABASE_URL=postgresql://user:password@your-database-host:5432/your-database
```

### スコープ4: AI主導のLP作成機能（未実装）
```
OPENAI_API_KEY=sk-your-actual-openai-key
OPENAI_API_MODEL=gpt-4o
```

## 設定方法

1. プロジェクトルートディレクトリに `.env.local` ファイルを作成
2. 上記の環境変数を適切な値で設定
3. アプリケーションを再起動して変更を反映

詳細な設定例については `docs/env.example` を参照してください。
デプロイ環境別設定の詳細は `docs/deploy.md` を参照してください。