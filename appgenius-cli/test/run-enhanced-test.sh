#!/bin/bash

# 強化版ツール使用テスト実行スクリプト
echo "AppGenius強化版ツール使用テスト実行スクリプト"
echo "----------------------------------------"

# 現在のディレクトリを確認
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
PROJECT_ROOT="$(pwd)"

echo "プロジェクトルート: $PROJECT_ROOT"

# 必要なNodeモジュールがインストールされているか確認
if [ ! -d "node_modules" ]; then
  echo "node_modulesが見つかりません。npm installを実行します..."
  npm install
fi

# ビルドを実行
echo "TypeScriptコードをビルドしています..."
npm run build || npx tsc

# 実行権限を付与
chmod +x "$SCRIPT_DIR/enhanced_tool_cli.js"

# テストコマンドのヘルプを表示
show_help() {
  echo ""
  echo "使用方法: ./run-enhanced-test.sh [オプション] [検索クエリ]"
  echo ""
  echo "オプション:"
  echo "  --test      自動テストを実行 (複数のテストケースを連続実行)"
  echo "  --cli       対話型CLIを起動"
  echo "  --offline   APIを使わないオフラインモードで実行"
  echo "  --verbose   詳細なログを表示"
  echo ""
  echo "例:"
  echo "  ./run-enhanced-test.sh --test                     # 自動テスト実行"
  echo "  ./run-enhanced-test.sh --cli                      # 対話型CLIを起動"
  echo "  ./run-enhanced-test.sh --test \"マークダウンを検索\"   # 特定のクエリでテスト"
  echo "  ./run-enhanced-test.sh --test --offline           # オフラインモードでテスト"
  echo ""
}

# パラメータが指定されていない場合はヘルプを表示
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

# パラメータを解析
RUN_TEST=false
RUN_CLI=false
OFFLINE=""
VERBOSE=""
QUERY=""

for param in "$@"; do
  case $param in
    --help)
      show_help
      exit 0
      ;;
    --test)
      RUN_TEST=true
      ;;
    --cli)
      RUN_CLI=true
      ;;
    --offline)
      OFFLINE="--offline"
      ;;
    --verbose)
      VERBOSE="--verbose"
      ;;
    --*)
      # 不明なオプション
      echo "不明なオプション: $param"
      show_help
      exit 1
      ;;
    *)
      # クエリ文字列と判断
      QUERY="$param"
      ;;
  esac
done

# 実行オプション
if [ "$RUN_TEST" = true ]; then
  echo "自動テストモードで実行します..."
  node "$SCRIPT_DIR/enhanced_tool_test.js" $QUERY $OFFLINE $VERBOSE
elif [ "$RUN_CLI" = true ]; then
  echo "対話型CLIモードで実行します..."
  node "$SCRIPT_DIR/enhanced_tool_cli.js" $OFFLINE $VERBOSE
else
  # デフォルトはCLIモードで実行
  echo "デフォルトの対話型CLIモードで実行します..."
  node "$SCRIPT_DIR/enhanced_tool_cli.js" $OFFLINE $VERBOSE
fi

echo "実行完了"