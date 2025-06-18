# BlueLamp CLI ツール完全テストガイド

## 🧪 4つのツール全機能テスト

### 1. Write Tool テスト

```bash
# 基本的なファイル作成
test-files/hello.txtにHello Worldと書き込んでください

# 深い階層でのディレクトリ自動作成
project/docs/deep/nested/requirements.mdに要件定義テストと書き込んでください

# 権限エラー回避テスト（絶対パス→相対パス変換）
/test-data/sample.txtにサンプルデータと書き込んでください
```

### 2. Read Tool テスト

```bash
# 作成したファイルを読み取り
test-files/hello.txtを読み込んでください

# 深い階層のファイル読み取り
project/docs/deep/nested/requirements.mdを読み込んでください
```

### 3. Edit Tool テスト

```bash
# 文字列置換編集
test-files/hello.txtでHello WorldをHello BlueLampに変更してください

# 部分編集
project/docs/deep/nested/requirements.mdで要件定義テストを詳細な要件定義に変更してください
```

### 4. Bash Tool テスト

```bash
# ディレクトリ一覧表示
ls -la test-files/コマンドを実行してください

# ファイル検索
find . -name "*.txt"コマンドを実行してください

# ファイル情報取得
wc -l test-files/hello.txtコマンドを実行してください

# 複雑なコマンド
tree . || ls -laRコマンドを実行してください
```

## 🎯 期待される結果

### Write Tool
```
🔧 ツール実行: write
入力パラメータ: {"file_path":"test-files/hello.txt","content":"Hello World"}
結果: ✅ ファイル作成成功: test-files/hello.txt (ディレクトリも自動作成)
```

### Read Tool
```
🔧 ツール実行: read
入力パラメータ: {"file_path":"test-files/hello.txt"}
結果: ✅ ファイル読み込み成功: test-files/hello.txt
Hello World
```

### Edit Tool
```
🔧 ツール実行: edit
入力パラメータ: {"file_path":"test-files/hello.txt","old_text":"Hello World","new_text":"Hello BlueLamp"}
結果: ✅ ファイル編集成功: test-files/hello.txt
```

### Bash Tool
```
🔧 ツール実行: bash
入力パラメータ: {"command":"ls -la test-files/"}
結果: ✅ コマンド実行成功:
total 8
drwxr-xr-x  3 user  staff   96 Jun 18 10:30 .
drwxr-xr-x 15 user  staff  480 Jun 18 10:30 ..
-rw-r--r--  1 user  staff   13 Jun 18 10:30 hello.txt
```

## 🚀 実行手順

1. `bluelamp` でCLI起動
2. 上記のテストコマンドを順番に実行
3. 各ツールのデバッグログと結果を確認
4. すべてのツールが正常動作することを検証

## 🔍 デバッグポイント

- **入力パラメータ**: JSON形式で正しく渡されているか
- **ツール実行結果**: エラーなく成功しているか
- **ファイル操作**: 実際にファイルが作成・編集されているか
- **ディレクトリ作成**: 存在しないパスでも自動作成されているか