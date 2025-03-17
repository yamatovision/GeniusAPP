# AppGenius モックアップギャラリー

## モックアップの表示方法

このフォルダには AppGenius UI の参照用モックアップが含まれています。
モックアップは **ブラウザで直接開く** 必要があります。

### 表示方法（おすすめ順）

1. **ブラウザで直接開く**
   - Finderからファイルを右クリック → アプリケーションを選択して開く → Chromeなどのブラウザを選択
   - もしくは直接以下のURLをブラウザにコピペ:
     - `file:///Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/mockups/dashboard-hub-spoke.html`
     - `file:///Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/mockups/dashboard-redesign-mockup.html`

2. **VSCode Live Server プラグインを使う**
   - VSCodeで拡張機能「Live Server」をインストール
   - HTMLファイルを開いた状態で右クリック → 「Open with Live Server」を選択

3. **他の静的ファイルサーバーを使う**
   - Python: `python3 -m http.server`
   - Node.js: `npx serve`

## モックアップがVSCode内で表示されない理由

VSCodeのWebviewはセキュリティ上の理由から、インラインのJavaScriptや特定のスタイルの実行を制限しています。モックアップは独立したHTMLファイルとして設計されており、VSCodeのWebview内では正しく表示されません。

## 含まれるモックアップ

- **dashboard-hub-spoke.html**: 
  - シンプルなグリッドレイアウトのダッシュボード
  - 左側にスコープマネージャー、右側に2x2グリッドで4つのツールカード

- **dashboard-redesign-mockup.html**: 
  - 改良版ダッシュボードデザイン
  - ハブ＆スポークスタイルのUIで、スコープマネージャーを中心に各ツールを配置

これらのモックアップはデザイン参照用であり、実際の機能は実装されていません。