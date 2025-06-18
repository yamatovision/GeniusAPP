# ClaudeCode風実装への変更提案

## 現在の問題
- Ctrl+D必須で使いづらい
- readツールへの依存
- Claudeが応答しない場合がある

## ClaudeCode風の実装案

### 1. **リアルタイム入力監視**
```typescript
// キーストローク監視
process.stdin.on('data', (chunk) => {
  const input = chunk.toString();
  
  // 改行数をカウント
  if (input.includes('\n\n')) {
    // 連続改行で長文検出
    processLongText(buffer);
  }
});
```

### 2. **即座の置換表示**
```typescript
// 長文検出時
if (isLongText(input)) {
  // 一時ファイル作成
  const tempFile = createTempFile(input);
  
  // 入力フィールドを置換
  clearLine();
  console.log('[Pasted text - 124 lines]');
  
  // 内部バッファに保持
  messageBuffer = input;
}
```

### 3. **送信時の処理**
```typescript
// Enterキー検出時
if (key === '\r') {
  const message = messageBuffer || currentInput;
  
  // 長文は内容を直接送信（ファイルパス参照ではなく）
  await sendMessage(message);
}
```

## 実装の要点

1. **単一行入力モード** - 通常のEnterで送信
2. **ペースト検出** - 大量テキストの即座検出
3. **内部バッファ** - 表示と実データの分離
4. **直接送信** - readツールを介さない

この方式なら、ClaudeCodeと同じUXを実現できます。