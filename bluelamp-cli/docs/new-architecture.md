# BlueLamp CLI 統合アーキテクチャ提案

## 概要
16個のエージェントを効率的に管理するための統合アーキテクチャです。
基本的にすべて`bluelamp`コマンドで統一し、エージェントの切り替えは引数で行います。

## ディレクトリ構造

```
bluelamp-cli/
├── src/
│   ├── core/                     # コア機能
│   │   ├── agent.ts              # ベースエージェントクラス
│   │   ├── cli.ts                # CLI基盤（共通処理）
│   │   └── prompt-loader.ts      # プロンプト読み込み
│   │
│   ├── config/                   # 設定
│   │   ├── agents.ts             # エージェント定義
│   │   └── constants.ts          # 共通定数
│   │
│   ├── tools/                    # ツール実装（Phase 1完了）
│   │   ├── base.ts
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── edit.ts
│   │   ├── bash.ts
│   │   ├── glob.ts
│   │   ├── grep.ts
│   │   └── ls.ts
│   │
│   ├── agents/                   # エージェント固有の拡張（必要な場合）
│   │   ├── mockup/
│   │   │   └── extensions.ts    # モックアップ専用の追加機能
│   │   ├── testing/
│   │   │   └── test-runner.ts   # テスト実行機能
│   │   └── deployment/
│   │       └── deploy-tools.ts  # デプロイ専用ツール
│   │
│   ├── commands/                 # CLIコマンド
│   │   ├── agent.ts              # bluelamp agent <name> コマンド
│   │   ├── list.ts               # bluelamp list コマンド
│   │   └── run.ts                # bluelamp run（デフォルト）
│   │
│   ├── index.ts                  # エントリーポイント
│   └── tool-manager.ts           # ツール管理
│
├── prompts/                      # ローカルプロンプト（オプション）
│   └── custom/                   # カスタムプロンプト
│
└── config/                       # 設定ファイル
    └── .bluelamp.json            # ユーザー設定
```

## 使用方法

### 1. デフォルトエージェント（現在の動作）
```bash
bluelamp
# または
bluelamp run
```

### 2. 特定のエージェントを起動
```bash
bluelamp agent mockup      # モックアップアナライザー
bluelamp agent test        # テストエンジニア
bluelamp agent api         # API設計
bluelamp agent security    # セキュリティ分析
```

### 3. エージェント一覧表示
```bash
bluelamp list              # 利用可能なエージェント一覧
bluelamp list --category design  # カテゴリでフィルタ
```

### 4. エイリアスサポート
```bash
bluelamp mock             # mockup エージェントのエイリアス
bluelamp req              # requirements エージェントのエイリアス
```

## 実装の要点

### 1. 統一されたCLIクラス
```typescript
// src/core/cli.ts
export class UnifiedCLI {
  private agent: AgentConfig;
  private toolManager: ToolManager;
  
  constructor(agentId: string = 'default') {
    this.agent = findAgent(agentId) || AGENTS.default;
    this.toolManager = new ToolManager();
  }
  
  async start() {
    console.log(chalk.cyan(`${this.agent.icon} ${this.agent.name} を起動中...`));
    // 共通の起動処理
  }
}
```

### 2. コマンドライン引数処理
```typescript
// src/index.ts
import { program } from 'commander';

program
  .version('1.2.0')
  .description('BlueLamp CLI - Unified AI Development Assistant');

program
  .command('agent <name>')
  .alias('a')
  .description('特定のエージェントを起動')
  .action((name) => {
    const cli = new UnifiedCLI(name);
    cli.start();
  });

program
  .command('list')
  .alias('ls')
  .description('利用可能なエージェント一覧')
  .option('-c, --category <category>', 'カテゴリでフィルタ')
  .action((options) => {
    // エージェント一覧表示
  });

// デフォルトコマンド
program
  .command('run', { isDefault: true })
  .description('デフォルトエージェントを起動')
  .action(() => {
    const cli = new UnifiedCLI();
    cli.start();
  });
```

### 3. 設定ファイルサポート
```json
// ~/.bluelamp.json
{
  "defaultAgent": "mockup",
  "apiKey": "process.env.ANTHROPIC_API_KEY",
  "preferences": {
    "theme": "dark",
    "verbosity": "normal"
  },
  "customAgents": [
    {
      "id": "my-custom",
      "name": "My Custom Agent",
      "promptUrl": "http://..."
    }
  ]
}
```

## メリット

1. **統一されたコードベース**: メンテナンスが容易
2. **共通機能の再利用**: ツール、エラーハンドリング、UI
3. **拡張性**: 新しいエージェントの追加が簡単
4. **一貫性**: すべてのエージェントが同じ動作フロー
5. **設定の柔軟性**: ユーザー設定、カスタムエージェント

## 移行計画

1. **Phase 1**: コア実装（1日）
   - UnifiedCLIクラスの作成
   - エージェント設定システム
   - コマンドライン引数処理

2. **Phase 2**: 既存コードの統合（1日）
   - mockup-analyzer.tsの機能を統合
   - テストとデバッグ

3. **Phase 3**: 拡張機能（2-3日）
   - 残りのエージェント追加
   - 設定ファイルサポート
   - ドキュメント更新