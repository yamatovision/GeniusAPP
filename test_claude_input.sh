#!/bin/bash
# ClaudeCode入力方法テスト

echo "--- テスト環境確認 ---"
echo "現在のディレクトリ: $(pwd)"
echo "curl利用可能: $(which curl || echo 'Not found')"
echo "jq利用可能: $(which jq || echo 'Not found')"
echo "claude利用可能: $(which claude || echo 'Not found')"

# テスト用テキスト
TEST_PROMPT="これはテスト用プロンプトです。これが表示されればテストは成功です。"
TEST_ERROR="これはエラー情報のテストです。"

echo -e "\n\n--- テスト1: 一時ファイル経由 ---"
TEMP_FILE=$(mktemp)
echo "$TEST_PROMPT" > "$TEMP_FILE"
echo "一時ファイル作成: $TEMP_FILE"
echo "内容:"
cat "$TEMP_FILE"
echo -e "\n実行コマンド: claude $TEMP_FILE"
echo "テスト1を実行するには: claude $TEMP_FILE"

echo -e "\n\n--- テスト2: パイプ経由 ---"
echo "実行コマンド: echo \"$TEST_PROMPT\" | claude -"
echo "テスト2を実行するには: echo \"$TEST_PROMPT\" | claude -"

echo -e "\n\n--- テスト3: curl + パイプ経由 ---"
# 実際のAPIエンドポイントをダミーURLに置き換えています
DUMMY_URL="http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09"
echo "実行コマンド: curl -s \"$DUMMY_URL\" | claude -"
echo "テスト3を実行するには: curl -s \"$DUMMY_URL\" | claude -"

echo -e "\n\n--- テスト4: 複合情報（プロンプト+エラー情報） ---"
TEMP_ERROR_FILE=$(mktemp)
echo "$TEST_ERROR" > "$TEMP_ERROR_FILE"
echo "エラーファイル作成: $TEMP_ERROR_FILE"
echo "実行コマンド: (echo \"$TEST_PROMPT\" && echo -e \"\n\n# エラー情報\n\n\" && cat \"$TEMP_ERROR_FILE\") | claude -"
echo "テスト4を実行するには: (echo \"$TEST_PROMPT\" && echo -e \"\n\n# エラー情報\n\n\" && cat \"$TEMP_ERROR_FILE\") | claude -"

echo -e "\n\n--- テスト5: 実際のAPI + エラー情報 ---"
echo "実行コマンド: (curl -s \"$DUMMY_URL\" && echo -e \"\n\n# エラー情報\n\n\" && cat \"$TEMP_ERROR_FILE\") | claude -"
echo "テスト5を実行するには: (curl -s \"$DUMMY_URL\" && echo -e \"\n\n# エラー情報\n\n\" && cat \"$TEMP_ERROR_FILE\") | claude -"

echo -e "\n\n上記のテストコマンドをターミナルで実行して、どの方法が正常に動作するか確認してください。"