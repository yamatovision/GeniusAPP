# BlueLamp CLI 長文処理デバッグ調査報告

## 🔍 問題の特定

### 根本原因
**一時ファイル作成後も元の長文データをそのままAPIに送信している**

### 問題のデータフロー
```
長文入力 → formatLongText() → 一時ファイル作成 + 表示用折りたたみ
                                      ↓
                               しかし送信は元データ
                                      ↓
                            Claude APIに長文を直送
                                      ↓
                           メモリ/接続負荷でRYT切断
```

### 具体的な問題箇所
- **ファイル**: `/bluelamp-cli/src/index.ts`
- **問題行**: 176行目 `await this.sendMessage(userInput);`
- **原因**: `formatLongText()`で一時ファイル作成するが、送信時に利用していない

## 🛠️ 解決策

### ClaudeCode風の実装に修正が必要

1. **長文検出時の処理変更**
   - 一時ファイルパスをClaudeに送信
   - 元データではなくファイル参照を使用

2. **自動ファイル読み込み機能の実装**
   - Claudeが一時ファイルを自動的に読み取る
   - readツールを使った自動処理

3. **メモリ効率の改善**
   - 長文を直接メモリに保持しない
   - ファイルベースの処理に完全移行

## 📋 環境調査結果

### API接続状況
- **ANTHROPIC_API_KEY**: 正常に設定済み
- **RYTプロンプト**: 正常に取得可能（HTTPS対応）
- **Claude API**: 接続OK（要修正は送信内容）

### 実装完了の確認項目
- [x] 一時ファイル作成機能
- [x] 展開コマンド（ctrl+r）
- [ ] **一時ファイル自動送信機能** ← 未実装
- [ ] **長文の自動ファイル参照** ← 未実装

## 🚨 緊急修正必要箇所

**line 176**: `await this.sendMessage(userInput);`
↓
**修正後**: `await this.sendMessage(formatted.tempFile ? \`ファイルから読み込み: \${formatted.tempFile}\` : userInput);`

この修正により、ClaudeCode風の長文処理が正常に動作し、RYT接続切断問題が解決されます。