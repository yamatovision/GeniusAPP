#!/bin/bash
# AppGenius CLI起動スクリプト
# VSCode拡張からCLIツールを起動するためのブリッジ

# エラーハンドリング
set -e

# デフォルト値
SCOPE_FILE=""
PROJECT_PATH=""
MODEL="claude-3-7-sonnet-20250219"

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
    *)
      echo "Unknown parameter: $1"
      exit 1
      ;;
  esac
done

# 必須パラメータ確認
if [ -z "$SCOPE_FILE" ]; then
  echo "Error: Scope file (--scope) is required"
  exit 1
fi

if [ -z "$PROJECT_PATH" ]; then
  echo "Error: Project path (--project) is required"
  exit 1
fi

# ファイルの存在確認
if [ ! -f "$SCOPE_FILE" ]; then
  echo "Error: Scope file does not exist: $SCOPE_FILE"
  exit 1
fi

if [ ! -d "$PROJECT_PATH" ]; then
  echo "Error: Project directory does not exist: $PROJECT_PATH"
  exit 1
fi

echo "AppGenius CLI starting..."
echo "Scope file: $SCOPE_FILE"
echo "Project path: $PROJECT_PATH"
echo "Model: $MODEL"

# CLIコマンドを探す
CLI_COMMAND=""

# グローバルにインストールされたappgenius-cliを探す
if command -v appgenius &> /dev/null; then
  CLI_COMMAND="appgenius"
elif command -v appgenius-cli &> /dev/null; then
  CLI_COMMAND="appgenius-cli"
else
  # ローカルにインストールされたnpmパッケージを探す
  if [ -f "$PROJECT_PATH/node_modules/.bin/appgenius" ]; then
    CLI_COMMAND="$PROJECT_PATH/node_modules/.bin/appgenius"
  elif [ -f "$PROJECT_PATH/node_modules/.bin/appgenius-cli" ]; then
    CLI_COMMAND="$PROJECT_PATH/node_modules/.bin/appgenius-cli"
  else
    echo "Error: AppGenius CLI executable not found"
    echo "Please install it first with: npm install -g appgenius-cli"
    exit 1
  fi
fi

echo "Using CLI executable: $CLI_COMMAND"

# APIキーの存在確認
if [ -z "$API_KEY" ]; then
  echo "Warning: API_KEY environment variable not set"
  echo "CLI will attempt to use the API key from VSCode settings or config file"
fi

# 環境変数としてAPIキーを設定
export CLAUDE_API_KEY="$API_KEY"

# CLIを起動 - まずパラメータなしで起動
cd "$PROJECT_PATH"
$CLI_COMMAND chat

# チュートリアルメッセージを表示
echo "------------------------------------------------"
echo "スコープとプロジェクトが設定されています:"
echo "スコープファイル: $SCOPE_FILE"
echo "プロジェクトパス: $PROJECT_PATH"
echo "モデル: $MODEL"
echo ""
echo "チャットが起動したら、以下のコマンドを入力してください:"
echo "/load-scope $SCOPE_FILE"
echo "/set-project $PROJECT_PATH"
echo "------------------------------------------------"

exit $?