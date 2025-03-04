# AppGenius CLI

AppGeniusの開発支援AIコマンドラインインターフェース

## 概要

AppGenius CLIは、AIを活用してソフトウェア開発を支援するコマンドラインツールです。Claude AIと連携して、プロジェクト分析、コード生成、デバッグ支援などの機能を提供します。

## 主な機能

- インタラクティブな開発支援チャット
- プロジェクト情報の分析
- ファイル検索と操作（GlobTool、GrepTool、ViewTool、EditTool）
- 実装スコープの管理

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/appgenius-cli.git

# 依存関係のインストール
cd appgenius-cli
npm install

# ビルド
npm run build

# グローバルにリンク（CLI全体へのアクセス用）
npm link
```

## 使用方法

### 基本的なコマンド

```bash
# ヘルプを表示
appgenius --help

# バージョン情報を表示
appgenius --version

# 設定の管理
appgenius config

# AIチャットセッションを開始
appgenius chat

# プロジェクト情報を表示
appgenius project --info

# プロジェクト構造を分析
appgenius project --analyze

# スコープの管理
appgenius scope --list
appgenius scope --create
```

### 設定の構成

初めて使用する場合は、設定コマンドを使用してAPIキーとプロジェクトパスを設定してください：

```bash
appgenius config
```

または、APIキーを環境変数として設定することもできます：

```bash
export CLAUDE_API_KEY=your-api-key-here
```

### AIチャットセッション

開発支援AIとのインタラクティブなチャットセッションを開始：

```bash
# デフォルトのモデル（Sonnet）を使用
appgenius chat

# 特定のモデルを指定
appgenius chat -m opus

# プロジェクトパスを指定
appgenius chat -p /path/to/your/project

# スコープファイルを指定
appgenius chat -s /path/to/scope/file.json
```

### スコープの管理

実装スコープの作成と管理：

```bash
# 新しいスコープを作成
appgenius scope --create

# スコープの一覧を表示
appgenius scope --list

# 特定のスコープを表示
appgenius scope --show <scope-id>

# スコープを削除
appgenius scope --delete <scope-id>
```

## VSCode拡張との連携

AppGeniusのVSCode拡張と連携するには、同梱の起動スクリプトを使用します：

```bash
./launch-appgenius.sh --scope=/path/to/scope.json --project=/path/to/project
```

VSCode拡張は、ユーザーがスコープを選択すると、このスクリプトを使用してCLIを起動します。

## 使用可能なツール

AppGenius CLIに組み込まれているツール：

- **GlobTool**: ファイルパターン検索
- **GrepTool**: ファイル内容検索
- **ViewTool**: ファイル内容表示
- **EditTool**: ファイル編集
- **BashTool**: シェルコマンド実行
- **LSTool**: ディレクトリ一覧表示

## ライセンス

UNLICENSED - このソフトウェアは現在非公開であり、許可なく使用・配布・修正することはできません。