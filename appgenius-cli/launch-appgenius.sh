#!/bin/bash
# AppGenius CLI起動スクリプト
# VSCode拡張からCLIツールを起動するためのブリッジ

# エラーハンドリング
set -e

# デフォルト値
SCOPE_FILE=""
PROJECT_PATH=""
MODEL="claude-3-7-sonnet-20250219"
DEBUG_MODE=false

# ヘルプメッセージ
show_help() {
  echo "使用法: launch-appgenius.sh [オプション]"
  echo ""
  echo "オプション:"
  echo "  --scope=ファイルパス   スコープファイルを指定 (JSONファイル)"
  echo "  --project=パス         プロジェクトのルートディレクトリを指定"
  echo "  --model=モデル名       使用するAIモデルを指定 (デフォルト: ${MODEL})"
  echo "  --debug               デバッグモードを有効化"
  echo "  --help                このヘルプメッセージを表示"
  echo ""
  exit 0
}

# 引数解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --scope=*)
      SCOPE_FILE="${1#*=}"
      shift
      ;;
    --project=*)
      PROJECT_PATH="${1#*=}"
      shift
      ;;
    --model=*)
      MODEL="${1#*=}"
      shift
      ;;
    --debug)
      DEBUG_MODE=true
      shift
      ;;
    --help)
      show_help
      ;;
    *)
      echo "未知のパラメータ: $1"
      echo "ヘルプを表示するには: launch-appgenius.sh --help"
      exit 1
      ;;
  esac
done

# パラメータ確認
if [ -z "$SCOPE_FILE" ]; then
  echo "警告: スコープファイル(--scope)が指定されていません"
  echo "スコープファイルは必須ではありませんが、機能が制限されます"
elif [ ! -f "$SCOPE_FILE" ]; then
  echo "警告: 指定されたスコープファイルが存在しません: $SCOPE_FILE"
  echo "スコープファイルはCLI起動後に手動でロードする必要があります"
fi

if [ -z "$PROJECT_PATH" ]; then
  echo "警告: プロジェクトパス(--project)が指定されていません"
  echo "カレントディレクトリを使用します: $(pwd)"
  PROJECT_PATH=$(pwd)
elif [ ! -d "$PROJECT_PATH" ]; then
  echo "警告: 指定されたプロジェクトディレクトリが存在しません: $PROJECT_PATH"
  echo "カレントディレクトリを使用します: $(pwd)"
  PROJECT_PATH=$(pwd)
fi

echo "AppGenius CLI を起動しています..."
echo "スコープファイル: $SCOPE_FILE"
echo "プロジェクトパス: $PROJECT_PATH"
echo "AIモデル: $MODEL"
if [ "$DEBUG_MODE" = true ]; then
  echo "デバッグモード: 有効"
fi
echo ""

# CLIコマンドを探す
CLI_COMMAND=""
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 検索順序：
# 1. 現在のスクリプトと同じディレクトリ
# 2. グローバルにインストールされたコマンド
# 3. プロジェクトディレクトリのnode_modules

# スクリプトディレクトリのdist/index.jsを確認
if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
  CLI_COMMAND="node $SCRIPT_DIR/dist/index.js"
# グローバルにインストールされたコマンドを確認
elif command -v appgenius &> /dev/null; then
  CLI_COMMAND="appgenius"
elif command -v appgenius-cli &> /dev/null; then
  CLI_COMMAND="appgenius-cli"
# プロジェクトのnode_modulesを確認
elif [ -f "$PROJECT_PATH/node_modules/.bin/appgenius" ]; then
  CLI_COMMAND="$PROJECT_PATH/node_modules/.bin/appgenius"
elif [ -f "$PROJECT_PATH/node_modules/.bin/appgenius-cli" ]; then
  CLI_COMMAND="$PROJECT_PATH/node_modules/.bin/appgenius-cli"
# 現在のスクリプトディレクトリをnode_modulesとして確認
elif [ -f "$SCRIPT_DIR/node_modules/.bin/appgenius" ]; then
  CLI_COMMAND="$SCRIPT_DIR/node_modules/.bin/appgenius"
elif [ -f "$SCRIPT_DIR/node_modules/.bin/appgenius-cli" ]; then
  CLI_COMMAND="$SCRIPT_DIR/node_modules/.bin/appgenius-cli"
else
  echo "エラー: AppGenius CLIの実行ファイルが見つかりません"
  echo "以下のいずれかのコマンドを実行してインストールしてください:"
  echo "npm install -g appgenius-cli"
  echo "cd $SCRIPT_DIR && npm install"
  exit 1
fi

echo "使用するCLI実行ファイル: $CLI_COMMAND"

# APIキーの存在確認
if [ -z "$CLAUDE_API_KEY" ]; then
  echo "警告: CLAUDE_API_KEY環境変数が設定されていません"
  echo "設定ファイルまたはVSCode設定から読み込みを試みます"
else
  echo "Claude APIキー: 設定済み"
fi

# 一時ディレクトリの作成
TEMP_DIR="${SCRIPT_DIR}/temp"
mkdir -p "$TEMP_DIR"

# 自動設定コマンドファイルを作成
AUTO_COMMANDS_FILE="${TEMP_DIR}/auto_commands_$(date +%s).txt"
touch "$AUTO_COMMANDS_FILE"

# プロジェクトパスを自動設定に追加
if [ -n "$PROJECT_PATH" ]; then
  echo "/set-project $PROJECT_PATH" >> "$AUTO_COMMANDS_FILE"
fi

# スコープファイルを自動設定に追加
if [ -n "$SCOPE_FILE" ] && [ -f "$SCOPE_FILE" ]; then
  echo "/load-scope $SCOPE_FILE" >> "$AUTO_COMMANDS_FILE"
fi

# 空行を追加して入力を促す
echo "" >> "$AUTO_COMMANDS_FILE"

# 環境変数を設定
export APPGENIUS_AUTO_COMMANDS="$AUTO_COMMANDS_FILE"
export APPGENIUS_PROJECT_PATH="$PROJECT_PATH"
export APPGENIUS_SCOPE_FILE="$SCOPE_FILE"

# デバッグフラグを設定
if [ "$DEBUG_MODE" = true ]; then
  DEBUG_FLAG="--debug"
else
  DEBUG_FLAG=""
fi

# プロジェクトディレクトリに移動してCLIを起動
cd "$PROJECT_PATH"
echo "スコープとプロジェクトを自動設定しています..."
if [ -n "$SCOPE_FILE" ] && [ -f "$SCOPE_FILE" ]; then
  echo "スコープファイル: $SCOPE_FILE"
fi
echo "プロジェクトパス: $PROJECT_PATH"
echo ""

# CLIを起動 - 自動設定有効モードで起動
$CLI_COMMAND chat --auto-init --model="$MODEL" $DEBUG_FLAG

# セッション終了処理
echo ""
echo "=================================================="
echo "AppGenius CLIセッションが終了しました"
echo "=================================================="

# 一時ファイルを削除
if [ -f "$AUTO_COMMANDS_FILE" ]; then
  rm -f "$AUTO_COMMANDS_FILE"
fi

exit 0