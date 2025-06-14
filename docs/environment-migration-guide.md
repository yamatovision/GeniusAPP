# 環境分離への移行ガイド

個人開発から企業開発への移行に伴う、環境分離の実装手順を説明します。

## 移行の全体像

```mermaid
graph LR
    A[現状: 単一環境] --> B[STEP1: 環境変数の整理]
    B --> C[STEP2: Gitブランチ戦略]
    C --> D[STEP3: CI/CD設定]
    D --> E[STEP4: 環境別デプロイ]
    E --> F[完成: 3環境分離]
```

## STEP 1: 環境変数の整理（所要時間: 2-3時間）

### 1.1 現在の環境変数を確認

```bash
# 現在の.envファイルをバックアップ
cp .env .env.backup

# 環境変数の一覧を確認
cat .env | grep -v '^#' | grep -v '^$'
```

### 1.2 環境別ファイルの作成

```bash
# テンプレートファイルを作成
cat > .env.example << 'EOF'
# アプリケーション設定
NODE_ENV=development
PORT=8080

# データベース設定
DATABASE_URL=mongodb://localhost:27017/myapp

# 認証設定
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# 外部API
CLAUDE_API_KEY=your-claude-api-key
EOF

# 環境別ファイルを作成
cp .env.example backend/.env.development
cp .env.example backend/.env.staging
cp .env.example backend/.env.production
cp .env.example frontend/.env.development
cp .env.example frontend/.env.staging
cp .env.example frontend/.env.production
```

### 1.3 各環境の値を設定

開発環境から順に設定していきます：

```bash
# 開発環境（ローカル用）
# backend/.env.development
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/myapp-dev
API_URL=http://localhost:8080

# ステージング環境（テスト用）
# backend/.env.staging
NODE_ENV=staging
DATABASE_URL=mongodb+srv://staging-user:password@staging-cluster.mongodb.net/myapp-staging
API_URL=https://staging-api.myapp.com

# 本番環境（実運用）
# backend/.env.production
NODE_ENV=production
DATABASE_URL=mongodb+srv://prod-user:password@production-cluster.mongodb.net/myapp-prod
API_URL=https://api.myapp.com
```

## STEP 2: Gitブランチ戦略の実装（所要時間: 1時間）

### 2.1 ブランチの作成

```bash
# 現在のブランチを確認
git branch

# mainブランチが最新であることを確認
git checkout main
git pull origin main

# stagingブランチを作成
git checkout -b staging
git push -u origin staging

# developブランチを作成（オプション）
git checkout -b develop
git push -u origin develop

# mainに戻る
git checkout main
```

### 2.2 GitHubでブランチ保護を設定

1. GitHubのリポジトリページを開く
2. Settings → Branches をクリック
3. "Add rule" をクリック
4. 以下の設定を行う：

**mainブランチの保護設定：**
- Branch name pattern: `main`
- ✅ Require pull request reviews before merging (2)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Include administrators

**stagingブランチの保護設定：**
- Branch name pattern: `staging`
- ✅ Require pull request reviews before merging (1)
- ✅ Require status checks to pass before merging

## STEP 3: CI/CD設定（所要時間: 2時間）

### 3.1 GitHub Actionsワークフローの作成

```bash
# ディレクトリ作成
mkdir -p .github/workflows

# デプロイワークフローを作成
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Environment

on:
  push:
    branches: [main, staging, develop]

jobs:
  determine-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.setenv.outputs.environment }}
    steps:
      - id: setenv
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
          else
            echo "environment=development" >> $GITHUB_OUTPUT
          fi

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd backend && npm ci && npm test
          cd ../frontend && npm ci && npm test

  deploy:
    needs: [determine-environment, test]
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to ${{ needs.determine-environment.outputs.environment }}
        run: |
          echo "Deploying to ${{ needs.determine-environment.outputs.environment }}"
          ./scripts/deploy-${{ needs.determine-environment.outputs.environment }}.sh
EOF
```

### 3.2 GitHub Secretsの設定

```bash
# GitHub CLIを使用（インストールが必要）
# macOS: brew install gh
# Ubuntu: sudo apt install gh

# ログイン
gh auth login

# Secretsを設定
gh secret set PRODUCTION_DATABASE_URL
gh secret set PRODUCTION_CLAUDE_API_KEY
gh secret set STAGING_DATABASE_URL
gh secret set STAGING_CLAUDE_API_KEY
```

## STEP 4: 環境別デプロイスクリプト（所要時間: 1-2時間）

### 4.1 デプロイスクリプトの作成

```bash
# スクリプトディレクトリを作成
mkdir -p scripts

# 本番環境用デプロイスクリプト
cat > scripts/deploy-production.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 本番環境へのデプロイを開始します..."

# 環境変数を設定
export NODE_ENV=production

# バックエンドのデプロイ
echo "📦 バックエンドをデプロイ中..."
cd backend
npm ci --production
# Google Cloud Runへのデプロイ例
gcloud run deploy backend-prod \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated

# フロントエンドのデプロイ
echo "🎨 フロントエンドをデプロイ中..."
cd ../frontend
npm ci
npm run build
# Firebase Hostingへのデプロイ例
firebase deploy --only hosting:production

echo "✅ 本番環境へのデプロイが完了しました！"
EOF

# ステージング環境用デプロイスクリプト
cat > scripts/deploy-staging.sh << 'EOF'
#!/bin/bash
set -e

echo "🧪 ステージング環境へのデプロイを開始します..."

# 環境変数を設定
export NODE_ENV=staging

# 同様のデプロイ処理...
echo "✅ ステージング環境へのデプロイが完了しました！"
EOF

# 実行権限を付与
chmod +x scripts/*.sh
```

### 4.2 環境切り替えヘルパーの作成

```bash
# 開発者用の環境切り替えスクリプト
cat > scripts/switch-env.sh << 'EOF'
#!/bin/bash

ENV=$1

if [ -z "$ENV" ]; then
  echo "使用方法: ./scripts/switch-env.sh [development|staging|production]"
  echo "現在の環境: $(grep NODE_ENV backend/.env | cut -d'=' -f2)"
  exit 1
fi

echo "🔄 環境を $ENV に切り替えています..."

# バックエンドの環境変数を切り替え
if [ -f "backend/.env.$ENV" ]; then
  cp backend/.env.$ENV backend/.env
  echo "✅ バックエンド: $ENV"
else
  echo "❌ backend/.env.$ENV が見つかりません"
fi

# フロントエンドの環境変数を切り替え
if [ -f "frontend/.env.$ENV" ]; then
  cp frontend/.env.$ENV frontend/.env
  echo "✅ フロントエンド: $ENV"
else
  echo "❌ frontend/.env.$ENV が見つかりません"
fi

echo "🎉 環境切り替えが完了しました！"
EOF

chmod +x scripts/switch-env.sh
```

## 移行後の運用フロー

### 日常的な開発作業

```bash
# 1. 開発環境で作業
./scripts/switch-env.sh development
npm run dev

# 2. 機能ブランチで開発
git checkout -b feature/new-feature
# ... 開発作業 ...
git add .
git commit -m "feat: 新機能の追加"
git push origin feature/new-feature

# 3. Pull Requestを作成（GitHub UI）
# feature/new-feature → develop (または staging)
```

### リリース作業

```bash
# 1. ステージング環境でテスト
# develop → staging のPull Requestを作成・マージ
# 自動的にステージング環境にデプロイされる

# 2. ステージング環境で動作確認
# https://staging.myapp.com でテスト

# 3. 本番リリース
# staging → main のPull Requestを作成
# 2名のレビュー承認後、マージ
# 自動的に本番環境にデプロイされる
```

## トラブルシューティング

### よくある問題と解決方法

1. **環境変数が読み込まれない**
   ```bash
   # 現在の環境を確認
   echo $NODE_ENV
   
   # .envファイルの存在確認
   ls -la backend/.env*
   ```

2. **ブランチがプッシュできない**
   ```bash
   # ブランチ保護ルールを確認
   # Pull Request経由でのみマージ可能
   ```

3. **デプロイが失敗する**
   ```bash
   # GitHub Actionsのログを確認
   # Secretsが正しく設定されているか確認
   gh secret list
   ```

## 完了チェックリスト

移行が完了したら、以下を確認してください：

- [ ] 3つの環境（開発・ステージング・本番）が独立して動作する
- [ ] 環境変数ファイルが適切に分離されている
- [ ] Gitブランチ保護ルールが設定されている
- [ ] CI/CDパイプラインが正常に動作する
- [ ] GitHub Secretsに必要な値が設定されている
- [ ] 開発チーム全員が新しいフローを理解している
- [ ] ドキュメントが最新の状態に更新されている

## まとめ

この移行により、以下のメリットが得られます：

1. **安全性の向上**: 本番環境への直接的な変更を防止
2. **品質の向上**: ステージング環境での十分なテスト
3. **トレーサビリティ**: 全ての変更履歴が追跡可能
4. **チーム開発**: 複数人での同時開発が可能
5. **自動化**: 手動作業の削減とヒューマンエラーの防止

移行作業お疲れさまでした！🎉