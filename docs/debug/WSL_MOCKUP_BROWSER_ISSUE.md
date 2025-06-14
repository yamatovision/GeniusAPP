# WSL環境でのモックアップギャラリー「ブラウザで開く」ボタン問題

## 問題の概要
WSL環境で「ブラウザで開く」ボタンを押してもブラウザが立ち上がらない

### 原因
WSL環境では通常のファイルパスではなく、特殊な形式のパスが必要：
```
file://wsl.localhost/{ディストリビューション名}/home/...
```

## 関連ファイルと依存関係

### 1. 処理フローマップ
```
[フロントエンド]
mockupGallery.js (行88-99)
  ↓ openInBrowserコマンド送信
[バックエンド]
MockupGalleryPanel.ts
  └─ _handleOpenInBrowser (行378-405)
      ├─ mockupStorageService.getMockups()
      ├─ 一時ファイル作成
      └─ vscode.env.openExternal()
```

### 2. 主要ファイル一覧
| ファイル | 役割 | 修正必要性 |
|---------|------|------------|
| `src/ui/mockupGallery/MockupGalleryPanel.ts` | ブラウザ起動処理の実装 | ★必須 |
| `media/mockupGallery/mockupGallery.js` | ボタンのイベント処理 | 不要 |
| `src/services/mockupStorageService.ts` | モックアップデータ管理 | 不要 |

## 修正ロードマップ

### ステップ1: 環境検出（優先度: 高）
- WSL環境かどうかを検出するロジックの実装
- 検出方法:
  1. `process.platform === 'linux'` かつ
  2. `/proc/version` に "Microsoft" または "WSL" が含まれる
  3. または環境変数 `WSL_DISTRO_NAME` の存在をチェック

### ステップ2: パス変換処理（優先度: 高）
- 通常のパスをWSL用パスに変換する関数の実装
- 変換ロジック:
  ```typescript
  // 通常: /home/user/project/file.html
  // WSL: file://wsl.localhost/{distro}/home/user/project/file.html
  ```

### ステップ3: デバッグログ設置（優先度: 中）
- 環境検出結果のログ
- パス変換前後のログ
- ブラウザ起動成功/失敗のログ

## デバッグポイント
1. WSL環境の検出が正しく行われているか
2. ディストリビューション名の取得が正確か
3. 最終的なURLが正しい形式になっているか
4. `vscode.env.openExternal`がWSLパスを正しく処理できているか

## 実装内容

### 1. WSL環境検出機能 (isWSL メソッド)
```typescript
private isWSL(): boolean {
  // 方法1: 環境変数 WSL_DISTRO_NAME をチェック
  // 方法2: /proc/version ファイルに "Microsoft" または "WSL" が含まれるかチェック
}
```

### 2. WSLファイルURI作成機能 (createWSLFileUri メソッド)
```typescript
private createWSLFileUri(filePath: string): vscode.Uri {
  // ディストリビューション名を取得（WSL_DISTRO_NAME || 'Ubuntu'）
  // パス変換: /home/user/file.html → file://wsl.localhost/{distro}/home/user/file.html
}
```

### 3. デバッグログの設置
- 一時ファイルパス
- プラットフォーム情報
- WSL_DISTRO_NAME環境変数
- WSL環境検出結果
- 最終的なURI

## 動作確認のためのチェックリスト
1. [ ] WSL環境でVSCodeを起動
2. [ ] モックアップギャラリーを開く
3. [ ] 「ブラウザで開く」ボタンをクリック
4. [ ] ログを確認して以下を検証：
   - WSL環境が正しく検出されているか
   - ディストリビューション名が正しいか（例: Ubuntu-24.04）
   - 生成されたURIが期待通りの形式か
5. [ ] ブラウザが正しく開くか確認

## トラブルシューティング
もしブラウザが開かない場合は、以下を確認：
1. ログに出力されたURIをコピーして手動でブラウザのアドレスバーに貼り付けて開けるか
2. ディストリビューション名が実際のものと一致しているか（`wsl -l -v`コマンドで確認）
3. 一時ファイルが正しく作成されているか