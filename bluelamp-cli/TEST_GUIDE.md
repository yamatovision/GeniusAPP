# BlueLamp CLI 動作確認ガイド

## 準備

1. **ビルドとインストール**
```bash
cd /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/bluelamp-cli
npm run build
npm link
```

2. **環境変数の確認**
- `.env`ファイルにANTHROPIC_API_KEYが設定されていることを確認

## ★1 要件定義エージェントのテスト

### 1. 新規要件定義の作成（自動モード）
```bash
# テスト用ディレクトリを作成
mkdir -p ~/test-bluelamp
cd ~/test-bluelamp

# 要件定義を自動生成
bluelamp requirements --new "シンプルなタスク管理アプリを作りたい"
```

期待される動作：
- AIが自動的に要件定義を生成
- `docs/requirements.md`にファイルが保存される

### 2. 対話的モードでの要件定義作成
```bash
bluelamp requirements --interactive
```

期待される動作：
- レコンXが挨拶をする
- プロジェクトについて質問される
- 対話を通じて要件定義を作成

### 3. 既存要件定義の更新
```bash
bluelamp requirements --update docs/requirements.md
```

期待される動作：
- 既存の要件定義を読み込む
- どのように変更したいか質問される

## ★2 モックアップエージェントのテスト

### 1. 特定ページのモックアップ作成
```bash
# 要件定義が存在する前提で
bluelamp mockup --page login
```

期待される動作：
- 要件定義書を読み込む
- ログインページのHTMLモックアップを生成
- `mockups/login.html`として保存

### 2. フィードバックによる更新
```bash
bluelamp mockup --update ./mockups/login.html --feedback "ボタンを大きくして、色を青に"
```

期待される動作：
- 既存のモックアップを読み込む
- フィードバックに基づいて更新
- 同じファイルを上書き保存

### 3. 対話的モード
```bash
bluelamp mockup
```

期待される動作：
- どのページのモックアップを作成するか質問される
- Phase#1〜#5を順番に実行

## 差分管理システムのテスト

### 1. 差分プレビュー
```bash
bluelamp diff docs/requirements.md --feedback "ユーザー管理機能を追加したい"
```

期待される動作：
- ファイルの関連部分のみを分析
- 変更内容のプレビューを表示

### 2. 差分適用
```bash
bluelamp update docs/requirements.md --feedback "認証機能を詳細化"
```

期待される動作：
- 元のファイルの10%程度のトークンで更新
- 自動的にバックアップを作成
- 更新後のファイルを保存

## トラブルシューティング

### APIキーエラーが出る場合
```bash
cd /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/bluelamp-cli
cat .env  # APIキーが設定されているか確認
```

### プロンプトファイルが見つからない場合
```bash
ls -la /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/prompts/
# ★1requirements_creator.md と ★2mockup_creatorandanalyzer.md が存在するか確認
```

### ビルドエラーが出る場合
```bash
npm install  # 依存関係の再インストール
npm run build
```

## 動作確認チェックリスト

- [ ] bluelamp --version でバージョンが表示される
- [ ] bluelamp --help でヘルプが表示される
- [ ] ★1 要件定義エージェントが動作する
- [ ] ★2 モックアップエージェントが動作する
- [ ] 差分管理システムが動作する
- [ ] 生成されたファイルが正しい場所に保存される

## 注意事項

- 現在の実装では、対話的モードで入力待ちになる場合があります
- Ctrl+Cで強制終了できます
- 生成されたrequirements.mdやHTMLファイルは手動で確認してください