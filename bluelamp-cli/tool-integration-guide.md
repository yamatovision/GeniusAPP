# BlueLamp CLI ツール統合ガイド

## 新しいツールを追加する方法

### 1. ツール定義を追加（src/index.ts）

```typescript
const tools = [
  // 既存のツール...
  
  // 新しいツールを追加
  {
    name: 'ls',
    description: 'ディレクトリの内容を一覧表示',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: { 
          type: 'string', 
          description: 'ディレクトリパス（省略時は現在のディレクトリ）' 
        }
      },
      required: []  // directoryは省略可能
    }
  },
  {
    name: 'glob',
    description: 'パターンにマッチするファイルを検索',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { 
          type: 'string', 
          description: 'グロブパターン（例: **/*.ts）' 
        }
      },
      required: ['pattern']
    }
  }
];
```

### 2. executeTool メソッドに実装を追加

```typescript
private async executeTool(toolName: string, input: any): Promise<string> {
  switch (toolName) {
    // 既存のツール...
    
    case 'ls':
      return await this.listDirectory(input.directory || '.');
      
    case 'glob':
      return await this.globFiles(input.pattern);
      
    case 'grep':
      return await this.grepFile(input.pattern, input.file_path);
  }
}
```

### 3. ツールメソッドを実装

```typescript
private async listDirectory(directory: string): Promise<string> {
  try {
    const files = await fs.readdir(directory, { withFileTypes: true });
    const formatted = files.map(f => 
      `${f.isDirectory() ? '📁' : '📄'} ${f.name}`
    ).join('\n');
    return `✅ ディレクトリ内容:\n${formatted}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}
```

## なぜツール実装は簡単なのか？

### 1. **シンプルな構造**
- 入力を受け取る → 処理する → 結果を返す
- エラーハンドリングのパターンが統一

### 2. **Node.jsの豊富なAPI**
- ファイル操作: `fs/promises`
- プロセス実行: `child_process`
- ネットワーク: `fetch`
- パス操作: `path`

### 3. **npmパッケージの活用**
```json
{
  "dependencies": {
    "glob": "^10.3.10",      // ファイルパターン検索
    "chokidar": "^3.5.3",    // ファイル監視
    "axios": "^1.6.2",       // HTTP通信
    "cheerio": "^1.0.0-rc.12" // HTML解析
  }
}
```

## 実装優先順位の提案

### Phase 1: 基本的な開発ツール（1日で完了可能）
1. **ls** - ディレクトリ表示
2. **glob** - ファイル検索
3. **grep** - 内容検索
4. **mv/cp** - ファイル操作

### Phase 2: 生産性向上ツール（2日目）
1. **batch** - 並列実行
2. **watch** - ファイル監視
3. **webfetch** - API連携

### Phase 3: 高度な機能（3日目以降）
1. **dispatch_agent** - サブタスク
2. **websearch** - Web検索統合

## ツール実装のベストプラクティス

### 1. エラーハンドリング
```typescript
try {
  // メイン処理
  return `✅ 成功: ${result}`;
} catch (error: any) {
  // 統一されたエラー形式
  return `❌ エラー: ${error.message}`;
}
```

### 2. 進捗表示
```typescript
console.log(chalk.gray('処理中...'));
// 長い処理
console.log(chalk.gray(`完了: ${count}件処理`));
```

### 3. セキュリティ考慮
```typescript
// パストラバーサル対策
if (filePath.includes('../')) {
  return '❌ セキュリティエラー: 相対パスは使用できません';
}
```

## まとめ

ツールの実装は**非常に簡単**です：

1. **30分以内**: 基本的なツール（ls, grep, glob）
2. **1時間以内**: 中級ツール（batch, webfetch）
3. **半日**: 全ての基本ツールセット

Claude Codeとの機能差は、主に**ツールの数**だけで、技術的な難易度は高くありません。