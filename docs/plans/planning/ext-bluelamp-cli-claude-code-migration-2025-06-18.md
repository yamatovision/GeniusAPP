# BlueLamp CLI → Claude Code 基本機能実装計画

**作成日**: 2025-06-18  
**更新日**: 2025-06-18  
**目標**: BlueLamp CLIにClaude Codeの基本7ツールを実装し、実用的な開発支援CLIツールを2週間で構築する

## エグゼクティブサマリー

### 目標と期待効果
BlueLamp CLIにClaude Codeの最も重要な7つのツールを実装することで、以下の価値を実現します：

- **即座の実用性**: 2週間で動く基本機能の提供
- **シンプルな設計**: 必要最小限のツールに集中
- **高い完成度**: 基本機能を確実に動作させることを優先
- **将来の拡張性**: 後から機能追加が容易な設計

### 実装スケジュール
- **総期間**: 2週間（10営業日）
- **Week 1**: Read, Write, Edit, Bash の実装とテスト
- **Week 2**: Glob, Grep, LS の実装と統合テスト

### 必要リソース
- **開発者**: 1名（TypeScript/Node.js経験者）
- **インフラ**: 既存のBlueLampインフラを活用
- **テスト**: 開発者が兼任（シンプルな機能のため）

## Week 1: ファイル操作とコマンド実行（第1週）

### Day 1-2: Read/Write ツールの実装

#### ReadTool 実装

```typescript
// src/tools/read.ts
interface ReadToolInput {
  file_path: string;  // 読み込むファイルの絶対パス
  limit?: number;     // 読み込む行数（オプション）
  offset?: number;    // 開始行（オプション）
}

class ReadTool {
  async execute(input: ReadToolInput): Promise<string> {
    // fs.readFileを使用
    // 行番号付きで返す（cat -n形式）
    // 大きなファイルの部分読み込み対応
    // エラーハンドリング（ファイルが存在しない場合等）
  }
}
```

**実装手順** (4時間):
1. ファイル読み込みロジック（1時間）
2. 行番号フォーマット（1時間）
3. エラーハンドリング（1時間）
4. 単体テスト（1時間）

#### WriteTool 実装
```typescript
// src/tools/write.ts
interface WriteToolInput {
  file_path: string;  // 書き込むファイルの絶対パス
  content: string;    // ファイルの内容
}

class WriteTool {
  async execute(input: WriteToolInput): Promise<void> {
    // fs.writeFileを使用
    // ディレクトリが存在しない場合は作成
    // 既存ファイルの上書き警告
    // 権限チェック
  }
}
```

**実装手順** (3時間):
1. ファイル書き込みロジック（1時間）
2. ディレクトリ作成処理（1時間）
3. 単体テスト（1時間）

### Day 3-4: Edit/Bash ツールの実装

#### EditTool 実装
```typescript
// src/tools/edit.ts
interface EditToolInput {
  file_path: string;   // 編集するファイルのパス
  old_string: string;  // 置換元の文字列
  new_string: string;  // 置換後の文字列
  replace_all?: boolean; // 全て置換するか（デフォルト: false）
}

class EditTool {
  async execute(input: EditToolInput): Promise<void> {
    // ファイル読み込み → 置換 → 書き込み
    // old_stringが見つからない場合のエラー
    // 置換前後の確認表示
  }
}
```

**実装手順** (4時間):
1. ファイル読み込みと置換ロジック（2時間）
2. エラーハンドリング（1時間）
3. 単体テスト（1時間）

#### BashTool 実装
```typescript
// src/tools/bash.ts
interface BashToolInput {
  command: string;      // 実行するコマンド
  timeout?: number;     // タイムアウト（ミリ秒）
  description?: string; // コマンドの説明
}

class BashTool {
  async execute(input: BashToolInput): Promise<string> {
    // child_process.execを使用
    // セキュリティチェック（危険なコマンドのブロック）
    // タイムアウト処理
    // 出力のストリーミング
  }
}
```

**実装手順** (4時間):
1. コマンド実行ロジック（1時間）
2. セキュリティフィルター（2時間）
3. 単体テスト（1時間）

### Day 5: Week 1 統合テスト
- 4つのツールの連携テスト
- エラーケースの網羅的テスト
- パフォーマンス測定

## Week 2: 検索ツールの実装（第2週）

### Day 6-7: Glob/Grep ツールの実装

#### GlobTool 実装
```typescript
// src/tools/glob.ts
interface GlobToolInput {
  pattern: string;  // "**/*.ts", "src/**/*.js" など
  path?: string;    // 検索開始ディレクトリ（デフォルト: .）
}

class GlobTool {
  async execute(input: GlobToolInput): Promise<string[]> {
    // fast-globを使用
    // 結果を修正時刻でソート
    // .gitignoreを考慮
  }
}
```

**実装手順** (4時間):
1. fast-glob導入と基本実装（2時間）
2. ソートとフィルタリング（1時間）
3. 単体テスト（1時間）

#### GrepTool 実装
```typescript
// src/tools/grep.ts
interface GrepToolInput {
  pattern: string;    // 正規表現パターン
  include?: string;   // ファイルパターン（"*.js"）
  path?: string;      // 検索パス
}

class GrepTool {
  async execute(input: GrepToolInput): Promise<MatchResult[]> {
    // Node.jsの標準機能で実装（シンプルさ優先）
    // ファイル内容を正規表現で検索
    // マッチした行と行番号を返す
  }
}
```

**実装手順** (4時間):
1. ファイル検索ロジック（2時間）
2. 正規表現処理（1時間）
3. 単体テスト（1時間）

### Day 8-9: LS ツールの実装

#### LSTool 実装
```typescript
// src/tools/ls.ts
interface LSToolInput {
  path: string;       // 絶対パス必須
  ignore?: string[];  // 無視パターン
}

class LSTool {
  async execute(input: LSToolInput): Promise<FileInfo[]> {
    // fs.readdirを使用
    // ファイルとディレクトリの情報を取得
    // サイズ、更新日時、権限を含む
  }
}
```

**実装手順** (4時間):
1. ディレクトリ読み込み（2時間）
2. ファイル情報の整形（1時間）
3. 単体テスト（1時間）

### Day 10: 最終統合とリリース準備
- 7つのツールの統合テスト
- CLIインターフェースの実装
- ドキュメント作成
- パッケージング

## 技術的な実装詳細

### 依存関係（最小限）
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.3",
    "chalk": "^5.4.1",
    "dotenv": "^16.4.5",
    "fast-glob": "^3.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### シンプルなアーキテクチャ
```
bluelamp-cli/
├── src/
│   ├── index.ts      # エントリーポイント
│   ├── agent.ts      # メインエージェント
│   └── tools/        # 7つの基本ツール
│       ├── read.ts
│       ├── write.ts
│       ├── edit.ts
│       ├── bash.ts
│       ├── glob.ts
│       ├── grep.ts
│       └── ls.ts
├── tests/            # 各ツールのテスト
└── package.json
```
### メインエージェントの実装
```typescript
// src/agent.ts
import { Anthropic } from '@anthropic-ai/sdk';
import { ToolManager } from './tool-manager';

export class BlueLampAgent {
  private anthropic: Anthropic;
  private toolManager: ToolManager;
  
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.toolManager = new ToolManager();
  }
  
  async chat(message: string): Promise<string> {
    // ツール定義をClaude APIに渡す
    const tools = this.toolManager.getToolDefinitions();
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      messages: [{ role: 'user', content: message }],
      tools: tools
    });
    
    // ツール呼び出しの処理
    return this.processResponse(response);
  }
}
```

### ツール管理システム
```typescript
// src/tool-manager.ts
export class ToolManager {
  private tools = new Map<string, Tool>();
  
  constructor() {
    // 7つの基本ツールを登録
    this.registerTool('read', new ReadTool());
    this.registerTool('write', new WriteTool());
    this.registerTool('edit', new EditTool());
    this.registerTool('bash', new BashTool());
    this.registerTool('glob', new GlobTool());
    this.registerTool('grep', new GrepTool());
    this.registerTool('ls', new LSTool());
  }
  
  getToolDefinitions(): ToolDefinition[] {
    // Claude API用のツール定義を返す
    return Array.from(this.tools.values())
      .map(tool => tool.getDefinition());
  }
  
  async executeTool(name: string, input: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return await tool.execute(input);
  }
}
```

## 期待される成果物

### 2週間後の状態
1. **7つの基本ツールが完全動作**
   - ファイル操作: Read, Write, Edit
   - コマンド実行: Bash
   - 検索機能: Glob, Grep, LS

2. **シンプルなCLIインターフェース**
   ```bash
   bluelamp "ログイン機能を実装して"
   # → 必要なファイルを読み、編集し、テストまで実行
   ```

3. **単体テストと統合テストの完成**
   - 各ツールの単体テスト
   - ツール間の連携テスト
   - エラーケースのテスト

## リスクと対策

### 識別されたリスク
1. **開発遅延**: 予想以上の技術的課題
   - 対策: シンプルな実装を優先

2. **ツールの互換性**: Claude APIとの統合問題
   - 対策: Claude Codeのツール定義を参考に実装

3. **パフォーマンス**: 大規模ファイルの処理
   - 対策: ストリーミング処理と制限設定

## スケジュール詳細

### Week 1 タイムライン
| 日 | タスク | 時間 |
|---|--------|------|
| Day 1 | Readツール実装 | 4h |
| Day 2 | Writeツール実装 | 3h |
| Day 3 | Editツール実装 | 4h |
| Day 4 | Bashツール実装 | 4h |
| Day 5 | Week 1 統合テスト | 8h |

### Week 2 タイムライン  
| 日 | タスク | 時間 |
|---|--------|------|
| Day 6 | Globツール実装 | 4h |
| Day 7 | Grepツール実装 | 4h |
| Day 8 | LSツール実装 | 4h |
| Day 9 | LSツール完成 | 4h |
| Day 10 | 最終統合・リリース | 8h |

## 成功指標

### 機能完成度
- **Week 1**: 4ツール完成（Read, Write, Edit, Bash）
- **Week 2**: 3ツール完成（Glob, Grep, LS）
- **合計**: 7ツールすべて動作確認

### パフォーマンス指標
- **起動時間**: 1秒以内
- **ツール実行**: 各ツール100ms以内
- **メモリ使用量**: 100MB以下

## 次のステップ（将来の拡張）

### Phase 2 候補機能（オプション）
1. **MultiEdit**: 複数箇所の同時編集
2. **TodoRead/Write**: タスク管理
3. **WebFetch**: Webコンテンツ取得
4. **BLUELAMP.md**: メモリシステム

### 今回のスコープ外
- 並列実行（dispatch_agent）
- Jupyterノートブック対応  
- Web検索機能
- 高度なエラーハンドリング

## Phase 2: 高度な機能実装（第3-5週）

### 2.1 並列実行機能

#### 2.1.1 BatchTool実装
```typescript
// src/tools/advanced/batch.ts
interface BatchToolInput {
  tools: Array<{
    tool: string;
    input: any;
  }>;
}

class BatchTool {
  async execute(input: BatchToolInput): Promise<BatchResult[]> {
    // Promise.allを使用した並列実行
    // エラーハンドリングと部分的成功の処理
    // 実行順序の最適化（依存関係を考慮）
    
    const results = await Promise.allSettled(
      input.tools.map(({ tool, input }) => 
        this.toolManager.execute(tool, input)
      )
    );
    
    return this.formatResults(results);
  }
}
```

**実装手順**:
1. 並列実行エンジンの設計（3時間）
2. エラーハンドリング戦略（2時間）
3. 結果集約ロジック（2時間）
4. パフォーマンス最適化（3時間）

#### 2.1.2 dispatch_agent実装
```typescript
// src/tools/advanced/dispatch-agent.ts
interface DispatchAgentInput {
  task: string;
  prompt: string;
  tools?: string[];  // 利用可能なツール制限
}

class DispatchAgent {
  async execute(input: DispatchAgentInput): Promise<string> {
    // サブエージェントの生成
    const subAgent = new BlueLampAgent({
      systemPrompt: this.buildSubAgentPrompt(input),
      availableTools: input.tools || 'all',
      parentContext: this.context
    });
    
    // 独立したコンテキストで実行
    const result = await subAgent.executeTask(input.task);
    
    // 結果を親エージェントに返す
    return this.formatAgentResult(result);
  }
  
  private buildSubAgentPrompt(input: DispatchAgentInput): string {
    return `
あなたは専門的なサブエージェントです。
タスク: ${input.task}
特別な指示: ${input.prompt}

親エージェントのコンテキスト:
${this.parentContext}

このタスクを完了し、結果を報告してください。
`;
  }
}
```

**実装上の課題と解決策**:
- **課題**: APIトークン消費の増大
- **解決策**: タスクの粒度調整、結果キャッシング

**実装手順**:
1. サブエージェント生成システム（4時間）
2. コンテキスト分離機構（3時間）
3. 結果集約と報告（2時間）
4. 再帰的実行の制御（2時間）

### 2.2 セキュリティ強化

#### 2.2.1 コマンドブロックリスト
```typescript
// src/core/security/command-filter.ts
class CommandFilter {
  private blocklist = [
    /rm\s+-rf\s+\//,        // 危険な削除コマンド
    /:(){ :|:& };:/,        // Fork bomb
    /dd\s+if=.*of=\/dev/,   // ディスク破壊
    // その他の危険なパターン
  ];
  
  private allowlist = [
    'npm', 'yarn', 'pnpm',
    'git', 'python', 'node',
    // 安全なコマンドのリスト
  ];
  
  isAllowed(command: string): boolean {
    // ブロックリストチェック
    for (const pattern of this.blocklist) {
      if (pattern.test(command)) {
        return false;
      }
    }
    
    // コマンドの解析と検証
    const parsed = this.parseCommand(command);
    return this.validateCommand(parsed);
  }
}
```

**実装手順**:
1. 危険コマンドパターンの調査（2時間）
2. コマンドパーサーの実装（3時間）
3. ホワイトリスト/ブラックリスト管理（2時間）
4. セキュリティテストスイート（3時間）

#### 2.2.2 ファイルアクセス制御
```typescript
// src/core/security/file-access-control.ts
class FileAccessControl {
  private restrictedPaths = [
    '/etc', '/sys', '/proc',
    '~/.ssh', '~/.aws',
    // システムファイルと機密情報
  ];
  
  canAccess(filePath: string, operation: 'read' | 'write'): boolean {
    const normalized = path.normalize(path.resolve(filePath));
    
    // 制限パスチェック
    for (const restricted of this.restrictedPaths) {
      if (normalized.startsWith(restricted)) {
        return false;
      }
    }
    
    // パストラバーサル防止
    if (normalized.includes('..')) {
      return false;
    }
    
    return true;
  }
}
```

### 2.3 WebツールFamily

#### 2.3.1 WebFetchTool
```typescript
// src/tools/web/web-fetch.ts
interface WebFetchInput {
  url: string;
  prompt: string;  // 取得内容に対する処理指示
}

class WebFetchTool {
  async execute(input: WebFetchInput): Promise<string> {
    // URL検証
    if (!this.isValidUrl(input.url)) {
      throw new Error('Invalid URL');
    }
    
    // HTTPSへの自動アップグレード
    const secureUrl = this.upgradeToHttps(input.url);
    
    // コンテンツ取得
    const response = await fetch(secureUrl);
    const html = await response.text();
    
    // HTML→Markdownへの変換
    const markdown = await this.htmlToMarkdown(html);
    
    // AIによる処理（小型モデル使用）
    return await this.processWithAI(markdown, input.prompt);
  }
  
  private async processWithAI(content: string, prompt: string): Promise<string> {
    // claude-3-5-haikuを使用して高速処理
    const response = await this.aiClient.process({
      model: 'claude-3-5-haiku',
      prompt: `${prompt}\n\nContent:\n${content}`,
      maxTokens: 4000
    });
    
    return response;
  }
}
```

**実装手順**:
1. URL検証とセキュリティ対策（2時間）
2. HTML→Markdown変換器（turndownパッケージ）（2時間）
3. AI処理統合（3時間）
4. キャッシング機構（15分有効）（2時間）

#### 2.3.2 WebSearchTool
```typescript
// src/tools/web/web-search.ts
interface WebSearchInput {
  query: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

class WebSearchTool {
  async execute(input: WebSearchInput): Promise<SearchResult[]> {
    // 検索プロバイダーとの統合
    // DuckDuckGo APIまたはBing Search API
    
    const rawResults = await this.searchProvider.search(input.query);
    
    // ドメインフィルタリング
    const filtered = this.applyDomainFilters(rawResults, input);
    
    // 結果のフォーマット
    return this.formatResults(filtered);
  }
}
```

**実装上の注意**:
- 米国内でのみ利用可能な制限
- APIキーの管理とレート制限
- 検索結果の品質保証

### 2.4 Phase 2のリスクと対策

| リスク | 影響度 | 対策 |
|-------|--------|------|
| dispatch_agentのトークン消費 | 高 | タスク粒度の最適化、キャッシング |
| セキュリティホール | 高 | 徹底的なテストとレビュー |
| 並列実行の複雑性 | 中 | 段階的な実装とデバッグツール |
| Web APIの制限 | 低 | 代替プロバイダーの準備 |

## Phase 3: 最適化と独自機能（第6-8週）

### 3.1 パフォーマンス最適化

#### 3.1.1 ツール実行の最適化
```typescript
// src/core/optimization/tool-optimizer.ts
class ToolOptimizer {
  // ツール実行結果のキャッシング
  private cache = new LRUCache<string, any>({
    max: 100,
    ttl: 1000 * 60 * 5  // 5分
  });
  
  // 依存関係グラフによる実行順序最適化
  optimizeExecutionOrder(tasks: Task[]): Task[] {
    const graph = this.buildDependencyGraph(tasks);
    return this.topologicalSort(graph);
  }
  
  // 類似タスクのバッチング
  batchSimilarTasks(tasks: Task[]): BatchedTask[] {
    // 同じツール、似た入力をグループ化
    // 一度の実行で複数の結果を取得
  }
}
```

**最適化項目**:
1. 実行結果キャッシング（LRU方式）
2. 依存関係解析による並列化
3. 類似タスクのバッチ処理
4. メモリ使用量の削減

#### 3.1.2 コンテキスト管理の効率化
```typescript
// src/core/optimization/context-optimizer.ts  
class ContextOptimizer {
  // 不要なコンテキストの自動削除
  pruneContext(messages: Message[]): Message[] {
    // 古い会話の要約化
    // 重複情報の削除
    // 関連性の低い情報のフィルタリング
  }
  
  // コンテキストウィンドウの動的調整
  adjustContextWindow(usage: number): void {
    // 使用率に応じてコンテキストサイズを調整
    // 重要な情報を優先的に保持
  }
}
```

### 3.2 BlueLamp CLI独自機能（ベストプラクティス実装）

#### 3.2.1 高度なコンテキスト管理
```typescript
// src/core/context-manager.ts
class AdvancedContextManager {
  // 会話履歴の要約機能
  async summarizeHistory(messages: Message[]): Promise<string> {
    // 重要な情報を抽出し、コンテキストを圧縮
    const keyPoints = await this.extractKeyPoints(messages);
    return this.generateSummary(keyPoints);
  }
  
  // 重要度に基づく優先順位付け
  prioritizeContext(context: Context[]): Context[] {
    return context.sort((a, b) => {
      // ファイル変更履歴、エラー情報、ユーザー指示を優先
      return this.calculateRelevance(b) - this.calculateRelevance(a);
    });
  }
  
  // .ai-contextファイルの管理
  async loadProjectContext(): Promise<ProjectContext> {
    const contextFile = await this.readFile('.ai-context');
    return {
      ...contextFile,
      customRules: contextFile.rules,
      ignoredPaths: contextFile.ignore,
      preferredPatterns: contextFile.patterns
    };
  }
}
```

#### 3.2.2 実用的なエラーハンドリング
```typescript
// src/core/error-handler.ts
class PracticalErrorHandler {
  // シンプルな自動リトライメカニズム
  async executeWithRetry(fn: Function, maxRetries = 3): Promise<any> {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // 一般的なリトライ可能なエラーをチェック
        if (this.isRetryableError(error)) {
          await this.wait(1000 * (i + 1)); // 指数バックオフ
          continue;
        }
        
        throw error; // リトライ不可能なエラーは即座に投げる
      }
    }
    
    throw lastError;
  }
  
  // リトライ可能なエラーの判定
  private isRetryableError(error: any): boolean {
    // ネットワークエラー、一時的なファイルロック等
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           error.code === 'EBUSY';
  }
}
```

#### 3.2.3 高度な並列処理システム
```typescript
// src/core/parallel-executor.ts
class ParallelExecutor {
  // 依存関係グラフに基づく最適化
  async executeTasks(tasks: Task[]): Promise<Results> {
    const graph = this.buildDependencyGraph(tasks);
    const batches = this.topologicalSort(graph);
    
    const results = [];
    for (const batch of batches) {
      // 同一バッチ内のタスクを並列実行
      const batchResults = await Promise.allSettled(
        batch.map(task => this.executeTask(task))
      );
      results.push(...batchResults);
      
      // プログレス表示
      this.updateProgress(results.length, tasks.length);
    }
    
    return this.consolidateResults(results);
  }
  
  // ファイル変更の影響範囲検出
  async analyzeImpact(changedFiles: string[]): Promise<ImpactMap> {
    const dependencies = await this.buildDependencyTree();
    return this.calculateImpactRadius(changedFiles, dependencies);
  }
}
```

#### 3.2.4 基本的な依存関係追跡
```typescript
// src/features/dependency-tracker.ts
class DependencyTracker {
  // インポート文の抽出（シンプルな実装）
  async extractImports(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath);
    const imports = [];
    
    // 基本的な正規表現でインポートを検出
    const importRegex = /import.*from\s+['"](.+?)['"]/g;
    const requireRegex = /require\(['"](.+?)['"]/g;
    
    // マッチした依存関係を収集
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
  
  // ファイル変更の基本的な影響検出
  async findDependents(filePath: string): Promise<string[]> {
    // プロジェクト内のファイルをスキャン
    const allFiles = await this.glob('**/*.{js,ts,jsx,tsx}');
    const dependents = [];
    
    for (const file of allFiles) {
      const imports = await this.extractImports(file);
      if (imports.includes(filePath)) {
        dependents.push(file);
      }
    }
    
    return dependents;
  }
}
```


#### 3.2.5 シンプルなタスク管理システム
```typescript
// src/features/task-manager.ts
interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

class TaskManager {
  private tasks: Task[] = [];
  private taskFile = '.bluelamp-tasks.json';
  
  // タスクの読み込み
  async readTasks(): Promise<Task[]> {
    try {
      const content = await this.readFile(this.taskFile);
      this.tasks = JSON.parse(content);
    } catch (error) {
      this.tasks = [];
    }
    return this.tasks;
  }
  
  // タスクの書き込み
  async writeTasks(tasks: Task[]): Promise<void> {
    this.tasks = tasks;
    await this.writeFile(this.taskFile, JSON.stringify(tasks, null, 2));
  }
  
  // タスクの追加
  async addTask(content: string, priority: Task['priority'] = 'medium'): Promise<Task> {
    const task: Task = {
      id: this.generateId(),
      content,
      status: 'pending',
      priority,
      createdAt: new Date()
    };
    
    this.tasks.push(task);
    await this.writeTasks(this.tasks);
    return task;
  }
  
  // タスクステータスの更新
  async updateTaskStatus(id: string, status: Task['status']): Promise<void> {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = status;
      await this.writeTasks(this.tasks);
    }
  }
  
  // 進行中のタスクは1つのみ
  async startTask(id: string): Promise<void> {
    // 既存の進行中タスクを保留に戻す
    this.tasks.forEach(task => {
      if (task.status === 'in_progress') {
        task.status = 'pending';
      }
    });
    
    // 新しいタスクを開始
    await this.updateTaskStatus(id, 'in_progress');
  }
}
```

#### 3.2.6 基本的なテンプレート生成
```typescript
// src/features/template-generator.ts
class BasicTemplateGenerator {
  private templates = {
    'typescript': {
      files: {
        'package.json': this.getTypeScriptPackageJson,
        'tsconfig.json': this.getTypeScriptConfig,
        'src/index.ts': this.getTypeScriptIndex,
        '.gitignore': this.getGitignore
      }
    },
    'python': {
      files: {
        'requirements.txt': this.getPythonRequirements,
        'main.py': this.getPythonMain,
        '.gitignore': this.getGitignore,
        'README.md': this.getReadme
      }
    }
  };
  
  async generateProject(type: ProjectType, name: string): Promise<void> {
    const template = this.templates[type];
    if (!template) {
      throw new Error(`Unknown project type: ${type}`);
    }
    
    // プロジェクトディレクトリ作成
    const projectPath = path.join(process.cwd(), name);
    await this.mkdir(projectPath);
    
    // テンプレートファイルの生成
    for (const [filePath, generator] of Object.entries(template.files)) {
      const content = await generator(name);
      const fullPath = path.join(projectPath, filePath);
      
      // ディレクトリが必要な場合は作成
      const dir = path.dirname(fullPath);
      await this.mkdir(dir, { recursive: true });
      
      // ファイル書き込み
      await this.writeFile(fullPath, content);
    }
    
    console.log(`✅ プロジェクト '${name}' を作成しました: ${projectPath}`);
  }
  
  private getTypeScriptPackageJson(name: string): string {
    return JSON.stringify({
      name,
      version: '1.0.0',
      main: 'dist/index.js',
      scripts: {
        'build': 'tsc',
        'dev': 'ts-node src/index.ts',
        'start': 'node dist/index.js'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'ts-node': '^10.9.0'
      }
    }, null, 2);
  }
}
```

### 3.3 最終的なアーキテクチャ

```
bluelamp-cli/
├── src/
│   ├── index.ts                    # エントリーポイント
│   ├── core/
│   │   ├── agent.ts                # メインエージェント
│   │   ├── context-collector.ts    # コンテキスト収集
│   │   ├── memory-system.ts        # メモリ管理
│   │   ├── prompt-builder.ts       # プロンプト構築
│   │   └── tool-manager.ts         # ツール管理
│   ├── tools/
│   │   ├── file-tools/             # ファイル操作ツール
│   │   ├── search-tools/           # 検索ツール
│   │   ├── system-tools/           # システムツール
│   │   ├── web-tools/              # Webツール
│   │   └── advanced-tools/         # 高度なツール
│   ├── security/
│   │   ├── command-filter.ts       # コマンドフィルター
│   │   └── access-control.ts       # アクセス制御
│   ├── optimization/
│   │   ├── tool-optimizer.ts       # ツール最適化
│   │   └── context-optimizer.ts    # コンテキスト最適化
│   └── features/
│       ├── template-generator.ts    # テンプレート生成
│       ├── prompt-marketplace.ts    # マーケットプレイス
│       └── dev-metrics.ts          # 開発メトリクス
├── tests/
│   ├── unit/                       # 単体テスト
│   ├── integration/                # 統合テスト
│   └── e2e/                        # E2Eテスト
├── docs/
│   ├── api/                        # API仕様
│   ├── guides/                     # ユーザーガイド
│   └── migration/                  # 移行ガイド
└── config/
    ├── default.json                # デフォルト設定
    └── tools.json                  # ツール定義
```

## リスク管理

### 識別されたリスク

1. **技術的リスク**
   - **Claude API コスト増大**: dispatch_agentの多用によるトークン消費
   - **パフォーマンス劣化**: ツール数増加による起動時間の増加
   - **互換性問題**: 既存ユーザーへの影響

2. **セキュリティリスク**
   - **任意コード実行**: bashツールの悪用
   - **情報漏洩**: ファイルアクセスの不適切な制御
   - **DoS攻撃**: 無限ループや過度なリソース消費

3. **ビジネスリスク**
   - **開発遅延**: 予想以上の技術的複雑性
   - **ユーザー離反**: 複雑化による使いづらさ

### 緩和策

1. **技術的対策**
   - トークン使用量のモニタリングと制限
   - 遅延ロードとコード分割
   - 段階的な機能リリース

2. **セキュリティ対策**
   - サンドボックス環境での実行
   - 厳格なアクセス制御
   - レート制限とリソース制限

3. **プロジェクト管理**
   - アジャイル開発手法の採用
   - 定期的なユーザーフィードバック
   - MVPアプローチ

### コンティンジェンシープラン

- **Phase 1が遅延した場合**: 基本ツールのみでリリース
- **セキュリティ問題が発生した場合**: 該当機能の即時無効化
- **パフォーマンスが許容できない場合**: 機能の段階的な有効化

## 成功指標とKPI

### 機能完成度
- **Phase 1**: 7つの基本ツール実装（100%）
- **Phase 2**: 並列実行とWebツール（100%）
- **Phase 3**: 最適化と独自機能（80%以上）

### パフォーマンス指標
- **起動時間**: 3秒以内（ツール数増加後も）
- **応答時間**: 初回応答2秒以内
- **メモリ使用量**: 200MB以下

### ユーザビリティ指標
- **学習時間**: 10分以内で基本操作習得
- **エラー率**: 5%以下
- **ユーザー満足度**: 4.5/5.0以上

### ビジネス指標
- **アクティブユーザー数**: 現在の2倍
- **タスク完了率**: 90%以上
- **APIコスト効率**: 現在の1.5倍以内

## 実装優先順位とマイルストーン

### Week 1-2 (Phase 1)
- [ ] コアアーキテクチャのリファクタリング
- [ ] Glob, Grep, LSツールの実装
- [ ] 初期コンテキスト収集システム
- [ ] BLUELAMP.mdメモリシステム
- [ ] Phase 1の統合テスト

### Week 3-5 (Phase 2)  
- [ ] BatchToolの実装
- [ ] dispatch_agentの基本実装
- [ ] セキュリティ層の構築
- [ ] WebFetchTool/WebSearchTool
- [ ] Phase 2の統合テスト

### Week 6-8 (Phase 3)
- [ ] パフォーマンス最適化
- [ ] プロジェクトテンプレート機能
- [ ] プロンプトマーケットプレイス統合
- [ ] 開発メトリクス機能
- [ ] 最終テストとドキュメント作成

## 移行計画

### 既存ユーザーへの対応
1. **互換性モード**: 旧コマンドのサポート継続
2. **移行ガイド**: 詳細なドキュメント提供
3. **段階的切り替え**: オプトイン方式での新機能提供

### データ移行
- 既存の設定ファイルの自動変換
- プロンプト履歴の保持
- ユーザー設定の引き継ぎ

## まとめ

BlueLamp CLIのClaude Code化は、技術的に実現可能であり、段階的なアプローチにより低リスクで実装できます。最も重要なのは：

1. **基礎機能の確実な実装**（Phase 1）
2. **ユーザー価値の継続的な提供**
3. **セキュリティとパフォーマンスの維持**
4. **ベストプラクティスの積極的採用**

### ベストプラクティス実装による差別化

BlueLamp CLIは以下の実装可能な機能により、Claude Codeと同等以上の価値を提供します：

1. **コンテキスト管理の基本強化**
   - プロジェクト固有の.ai-contextファイル対応
   - 重要度ベースの情報優先順位付け（シンプルな実装）
   - 基本的な会話履歴管理

2. **実用的なエラーハンドリング**
   - 基本的な自動リトライメカニズム（3回まで）
   - 一般的なエラーパターンへの対処
   - 部分的成功の適切な処理と報告

3. **効率的な並列処理**
   - 独立したタスクの並列実行（BatchTool）
   - シンプルな依存関係チェック
   - リアルタイムプログレス表示

4. **強化されたファイル検索**
   - 高速なパターン検索（Glob/Grep）
   - 基本的な依存関係の追跡
   - ファイル変更履歴の記録

5. **追加の基本機能**
   - プロジェクトタイプ自動検出（package.json、requirements.txt等から判定）
   - 基本的なテンプレート生成（TypeScript、Python等の一般的なプロジェクト）
   - シンプルなタスク管理（TodoRead/Write相当の機能）

この計画に従って実装を進めることで、BlueLamp CLIは単なるClaude Codeのクローンではなく、実用的で効率的な開発支援ツールへと進化します。

### 次世代システムプロンプト

より高度な機能を実現するための次世代システムプロンプトの候補を策定しました：
- **参照**: [/bluelamp-cli/next-gen-system-prompt.md](/bluelamp-cli/next-gen-system-prompt.md)

このプロンプトは以下の革新的機能を定義：
- 先読み実行（ユーザーの次の要求を予測）
- インテリジェント並列処理（依存関係を考慮）
- 学習型最適化（プロジェクト固有パターンの学習）
- トランザクション型実行（原子性保証）
- 意図理解エンジン（簡潔な指示から全タスクを推測）

---

**次のステップ**: 
1. この計画のレビューと承認
2. 開発チームの編成
3. Phase 1の詳細設計開始
4. 次世代システムプロンプトの実装検討