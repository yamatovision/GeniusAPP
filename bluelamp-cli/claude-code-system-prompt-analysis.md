# Claude Codeシステムプロンプト分析と実装指針

## Claude Codeの基本的な動作原則

会話から判明したClaude Codeの重要な特徴：

### 1. 核心的な動作原則
- **簡潔で的確な応答**: 4行以内を基本とし、冗長な説明を避ける
- **ツールの積極的使用**: 利用可能なツールを最大限活用してタスクを遂行
- **自律的なタスク完了**: ユーザーの指示を待たずに、必要な作業を完了まで実行
- **プロジェクトコンテキスト理解**: CLAUDE.md、Git状態、プロジェクト構造を自動的に把握

### 2. ツール定義の仕組み

Claude Codeでは、各ツールがJSONSchema形式で定義されており、以下の情報を含む：

```json
{
  "name": "Read",
  "description": "ファイルを読み込むツールの説明...",
  "parameters": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "読み込むファイルの絶対パス"
      },
      "limit": {
        "type": "number",
        "description": "読み込む行数"
      }
    },
    "required": ["file_path"]
  }
}
```

この形式により、AIは各ツールの：
- 名前と用途
- 必須/オプションパラメータ
- パラメータの型と説明

を理解し、適切に使用できる。

### 3. 利用可能なツール一覧

Claude Codeが持つツール：
- **Task**: 並列検索や調査タスク
- **Bash**: コマンド実行
- **Glob**: ファイルパターン検索（**/*.js など）
- **Grep**: ファイル内容検索
- **LS**: ディレクトリリスト
- **Read**: ファイル読み込み
- **Edit/MultiEdit**: ファイル編集
- **Write**: ファイル書き込み
- **NotebookRead/Edit**: Jupyterノートブック操作
- **WebFetch**: Web取得
- **TodoRead/Write**: タスク管理
- **WebSearch**: Web検索
- **exit_plan_mode**: プランモード終了

## BlueLamp CLIへの実装提案

### 1. システムプロンプトの改良

現在のBlueLamp CLIのシステムプロンプトを以下のように強化：

```typescript
const systemPrompt = `
あなたはBlueLamp CLI、自律的な開発支援ツールです。

## 基本原則
1. **簡潔性**: 応答は4行以内。説明より実行を優先
2. **自律性**: タスクを最後まで完了。途中で質問しない
3. **積極性**: ツールを最大限活用してタスクを遂行
4. **文脈理解**: プロジェクト構造を自動的に把握

## 実行スタイル
- 「できますか？」ではなく「実行しました」
- 「こうすればいいですか？」ではなく「こうしました」
- エラーを見つけたら即修正
- 不明点は調査で解決

## 利用可能なツール
[ここにツールのJSONSchema定義を含める]
`;
```

### 2. ツール定義の標準化

各ツールをJSONSchema形式で定義：

```typescript
const toolDefinitions = [
  {
    name: 'glob',
    description: 'ファイルパターンマッチング。大規模コードベース対応。',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { 
          type: 'string', 
          description: 'glob パターン (例: **/*.ts)' 
        },
        path: { 
          type: 'string', 
          description: '検索開始ディレクトリ' 
        }
      },
      required: ['pattern']
    }
  },
  // 他のツールも同様に定義
];
```

### 3. 初期コンテキスト収集の自動化

起動時に以下を自動収集：

```typescript
class InitialContext {
  async collect() {
    return {
      // 環境情報
      workingDir: process.cwd(),
      platform: process.platform,
      
      // Git情報
      gitStatus: await this.getGitStatus(),
      branch: await this.getCurrentBranch(),
      recentCommits: await this.getRecentCommits(5),
      
      // プロジェクト情報
      projectType: await this.detectProjectType(),
      dependencies: await this.getDependencies(),
      
      // メモリファイル
      bluelampMd: await this.loadMemoryFile()
    };
  }
}
```

### 4. 実装の優先順位

1. **Phase 1（即座に実装可能）**:
   - システムプロンプトの改良
   - 基本的な初期コンテキスト収集
   - 既存ツールのJSONSchema化

2. **Phase 2（1週間程度）**:
   - Glob, Grep, LSツールの追加
   - BLUELAMP.mdメモリシステム
   - より高度なコンテキスト理解

3. **Phase 3（2-3週間）**:
   - BatchTool（並列実行）
   - WebFetch/WebSearch
   - dispatch_agent（サブエージェント）

## まとめ

Claude Codeの本質は「簡潔・自律・積極的」な動作にあります。これらの原則をBlueLamp CLIに実装することで、より強力な開発支援ツールへと進化させることができます。

特に重要なのは：
1. ツール定義の標準化（JSONSchema）
2. 初期コンテキストの自動収集
3. 簡潔で実行重視のシステムプロンプト

これらを実装することで、Claude Codeに近い体験を提供できるようになります。