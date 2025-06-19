# BlueLamp CLI インストールガイド

## ローカル開発での使用

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 実行（nodeコマンド経由）
node dist/index.js
node dist/index.js list
node dist/index.js agent mockup
```

## グローバルインストール（推奨）

### 方法1: npm linkを使用（開発中推奨）

```bash
# プロジェクトディレクトリで実行
npm link

# これで以下のコマンドが使えるようになります
bluelamp
bluelamp list
bluelamp agent mockup
bluelamp mock  # エイリアス
```

### 方法2: グローバルインストール

```bash
# プロジェクトディレクトリで実行
npm install -g .

# または
npm pack
npm install -g bluelamp-cli-1.2.0.tgz
```

### アンインストール

```bash
# npm linkの場合
npm unlink -g bluelamp-cli

# グローバルインストールの場合
npm uninstall -g bluelamp-cli
```

## エイリアスの設定（オプション）

bashまたはzshの設定ファイルに追加：

```bash
# ~/.bashrc または ~/.zshrc に追加
alias bluelamp="node /path/to/bluelamp-cli/dist/index.js"
```

## トラブルシューティング

### "permission denied" エラーの場合

```bash
# 実行権限を付与
chmod +x dist/index.js

# それでもダメな場合は node 経由で実行
node dist/index.js agent mockup
```

### "command not found" エラーの場合

```bash
# npm linkが正しく動作しているか確認
npm ls -g bluelamp-cli

# PATHを確認
echo $PATH

# npm のグローバルディレクトリを確認
npm config get prefix
```