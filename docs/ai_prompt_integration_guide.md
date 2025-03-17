# AppGenius AI プロンプト統合ガイド

## 概要

このドキュメントは、AppGeniusの各種AIアシスタント（デバッグ探偵、スコープマネージャー、スコープインプリメンターなど）に対して、複数プロンプトを組み合わせる際の推奨手法について説明します。特に、プロンプトの組み合わせ方法とファイルアクセス問題の解決方法に焦点を当てています。

## 背景

AppGeniusでは、複数のAIアシスタントが異なる機能を提供しています。これらのアシスタントに対して、機能プロンプトとガイダンスプロンプト（セキュリティ境界など）を組み合わせることで、より高度な機能と制約を実現しています。しかし、この実装においていくつかの課題が見つかりました：

1. **ファイルアクセスの問題**: 「セキュリティ」などの特定の用語や文脈が存在すると、AIが一時ファイルへのアクセスを拒否する場合がある
2. **起動時の指示の影響**: 最初の応答メッセージ（`echo "y\n..."`）の内容がAIの動作に大きく影響する

## 推奨実装方法

### 1. ファイル名とメッセージの中立化

セキュリティに関連する用語を避け、より中立的な表現を使用します：

```typescript
// 変更前
const combinedPromptFileName = `secure_prompt_${Date.now()}.md`;
Logger.info(`セキュリティ境界付きプロンプトファイルを作成しました: ${combinedPromptPath}`);

// 変更後
const combinedPromptFileName = `combined_prompt_${Date.now()}.md`;
Logger.info(`複合プロンプトファイルを作成しました: ${combinedPromptPath}`);
```

### 2. メソッドと引数名の変更

メソッドや引数名に含まれるセキュリティ関連用語を避けます：

```typescript
// 変更前
public async launchWithSecurityBoundary(
  securityPromptUrl: string,
  featurePromptUrl: string,
  ...
)

// 変更後
public async launchWithSecurityBoundary( // メソッド名は後方互換性のために変更なし
  guidancePromptUrl: string,  // 引数名を変更
  featurePromptUrl: string,
  ...
)
```

### 3. 起動コマンドの指示文の最適化

Claude CLIを起動する際のecho指示を、より直接的かつ明示的なものに変更します：

```typescript
// 変更前
terminal.sendText(`echo "y\\n日本語で対応してください。プロンプトに従って解析を進めてください。" | claude ${escapedPromptFilePath}`);

// 変更後
terminal.sendText(`echo "y\\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | claude ${escapedPromptFilePath}`);
```

### 4. ログメッセージの中立化

ログ出力でもセキュリティに関連する用語を避けます：

```typescript
// 変更前
Logger.info(`セキュリティ境界付きでClaudeCodeを起動します: セキュリティ=${securityPromptUrl}, 機能=${debugDetectivePromptUrl}`);

// 変更後
Logger.info(`複合プロンプトでClaudeCodeを起動します: プロンプト1=${guidancePromptUrl}, プロンプト2=${debugDetectivePromptUrl}`);
```

## 各アシスタントへの適用手順

### デバッグ探偵（DebugDetectivePanel）

1. `src/ui/debugDetective/DebugDetectivePanel.ts`内のプロンプト起動部分を修正
2. URLの変数名を`securityPromptUrl`から`guidancePromptUrl`に変更
3. ログメッセージを「複合プロンプト」形式に変更

### スコープマネージャー（ScopeManagerPanel）

1. `src/ui/scopeManager/ScopeManagerPanel.ts`内の類似処理を特定
2. 上記と同様の変更を適用

### スコープインプリメンター

1. `src/modes/implementationMode/scopeSelector.ts`またはその関連ファイル内の処理を特定
2. 上記と同様の変更を適用

## 理論的根拠

1. **AIの文脈感度**: Claude等のAIモデルは、「セキュリティ」「保護」「制約」などの用語に敏感に反応し、より厳格なセキュリティポリシーを適用する傾向があります。

2. **直接的な指示の有効性**: 「プロンプトに従って」のような間接的な指示よりも、「ファイルを読み込む」のような具体的な指示の方が、AIが自律的に判断せずに指示通りに行動する可能性が高まります。

3. **ファイル名の影響**: `secure_prompt_`のようなファイル名はAIに対して「これはセキュリティに関連するファイルだ」という印象を与え、取り扱いに慎重になる可能性があります。

## 注意点

1. この変更はAIの動作に影響しますが、実際のセキュリティ制約には影響しません。セキュリティプロンプトの内容自体は変更せず、それを参照する方法だけを変更します。

2. 今後Claude CLIやAIモデル自体がアップデートされた場合、これらの動作も変わる可能性があります。定期的に動作を確認し、必要に応じて調整してください。

3. 新しいAIアシスタントを追加する際も、ここで説明したパターンを踏襲することをお勧めします。

## 参考リンク

- [Claude CLI ドキュメント](https://github.com/anthropics/anthropic-cookbook/tree/main/examples/claude-cli)
- [Anthropic AI ドキュメント](https://docs.anthropic.com/claude/reference/complete_api)