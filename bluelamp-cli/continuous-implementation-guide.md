# BlueLamp CLI 連続実行実装ガイド

## 現在の問題点

### 1. ツール実行後に終了してしまう理由

現在のコード（src/index.ts）:
```typescript
// ツール実行処理
for (const contentBlock of response.content) {
  if (contentBlock.type === 'tool_use') {
    await this.executeTool(contentBlock.name, contentBlock.input);
  }
}
// → ここで終了してしまう！
```

**問題**: ツールの実行結果をClaudeに戻していないため、Claudeは次のアクションを決定できない。

### 2. Claude APIの正しい使い方

Claude APIは**ツール使用の連鎖**をサポートしています：

```typescript
// 正しい実装パターン
async function continuousExecution() {
  const messages = [];
  
  // ステップ1: 初期リクエスト
  messages.push({ role: 'user', content: 'タスクを実行して' });
  
  // ステップ2: Claudeがツールを使用
  const response1 = await claude.messages.create({
    messages,
    tools: availableTools
  });
  
  // ステップ3: レスポンスをメッセージに追加（重要！）
  messages.push({ role: 'assistant', content: response1.content });
  
  // ステップ4: ツール結果を追加
  if (hasToolUse(response1)) {
    const toolResults = executeTools(response1);
    messages.push({ role: 'user', content: toolResults });
    
    // ステップ5: 再度Claudeを呼び出し（継続）
    const response2 = await claude.messages.create({
      messages,
      tools: availableTools
    });
    // 以降、繰り返し...
  }
}
```

## Claude Codeが実現している機能

1. **ツール使用の認識**
   - 自分が使えるツールを理解している
   - システムプロンプトで明示的に説明

2. **計画立案能力**
   - 目標達成のための複数ステップを計画
   - Chain of Thought的なアプローチ

3. **連続実行**
   - ツール結果を基に次のアクションを決定
   - タスク完了まで自律的に継続

4. **大規模コンテキスト**
   - 64000トークンの出力ウィンドウ
   - 長い処理でもコンテキストを維持

## 実装方法

### 方法1: 単純な連続実行（推奨）

```typescript
class ImprovedBlueLampCLI {
  private async sendMessageWithContinuation(content: string) {
    this.messages.push({ role: 'user', content });
    
    // 最大10回まで連続実行
    for (let i = 0; i < 10; i++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 64000,
        system: this.enhancedSystemPrompt(), // 改良されたプロンプト
        messages: this.messages,
        tools: tools
      });

      // アシスタントの応答を記録
      this.messages.push({ role: 'assistant', content: response.content });

      // ツール使用があった場合
      const toolUses = response.content.filter(c => c.type === 'tool_use');
      if (toolUses.length > 0) {
        const toolResults = [];
        
        for (const toolUse of toolUses) {
          const result = await this.executeTool(toolUse.name, toolUse.input);
          toolResults.push({
            tool_use_id: toolUse.id,
            type: 'tool_result',
            content: result
          });
        }
        
        // ツール結果を追加して継続
        this.messages.push({ role: 'user', content: toolResults });
        continue; // 次のループへ
      }
      
      // ツール使用がない場合は完了
      break;
    }
  }
}
```

### 方法2: 高度な実装（Claude Code風）

```typescript
private enhancedSystemPrompt(): string {
  return `
あなたは自律的な開発アシスタントです。

## 利用可能なツール
${this.describeAvailableTools()}

## 動作原則
1. タスクを理解し、必要なステップを計画してください
2. 各ステップで適切なツールを使用してください
3. ツールの結果を確認し、次のアクションを決定してください
4. エラーが発生した場合は、自動的に解決を試みてください
5. タスクが完了するまで継続してください

## 思考プロセス
タスクを受け取ったら：
1. まず何を達成する必要があるか分析
2. 必要な情報を収集（read, ls等）
3. アクションを実行（write, edit, bash等）
4. 結果を検証
5. 必要に応じて追加アクションを実行
`;
}
```

## 実装の優先順位

1. **Phase 1: 基本的な連続実行（1日）**
   - ツール結果の適切な処理
   - メッセージ履歴の管理
   - 無限ループ防止

2. **Phase 2: システムプロンプトの改良（2日）**
   - ツール説明の追加
   - 思考プロセスの明示
   - エラーハンドリング指示

3. **Phase 3: 高度な機能（1週間）**
   - 並列ツール実行
   - サブタスク管理
   - 進捗表示

## 結論

**はい、Claude APIを使って同じような連続実行は実現可能です！**

必要なのは：
1. ツール実行結果を適切にメッセージに追加
2. Claudeを再度呼び出して継続
3. システムプロンプトで自律的な動作を指示

これにより、Claude Codeのような「計画→実行→評価→継続」のサイクルを実現できます。