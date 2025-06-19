# BlueLamp CLI

AI-powered development assistant CLI tool with Claude Code features.

## Features

### Phase 1 - Basic Tools (✅ Completed)
- **Read**: Read files from the local filesystem with line numbers
- **Write**: Write files to the local filesystem with automatic directory creation
- **Edit**: Perform exact string replacements in files
- **Bash**: Execute bash commands with security filtering
- **Glob**: Fast file pattern matching (e.g., `**/*.ts`)
- **Grep**: Fast content search using regular expressions
- **LS**: List files and directories with detailed information

## Installation

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Usage

### Basic Commands

```bash
# デフォルトエージェント（汎用開発支援）を起動
bluelamp

# 特定のエージェントを起動
bluelamp agent mockup    # モックアップアナライザー
bluelamp agent test      # テストエンジニア
bluelamp agent api       # API設計

# エイリアスで起動（短縮形）
bluelamp mock           # mockup エージェント
bluelamp req            # requirements エージェント
bluelamp doc            # documentation エージェント

# エージェント一覧を表示
bluelamp list           # すべてのエージェント
bluelamp list -c design # デザイン系のみ表示
```

### Available Agents (16 agents)

#### Development (開発)
- `default` - 汎用的な開発支援
- `datamodel` (data, db) - データベース設計
- `api` (rest, graphql) - API設計
- `deployment` (deploy, cicd) - CI/CD
- `refactor` (clean, improve) - リファクタリング

#### Design (デザイン)
- `mockup` (mock, design) - モックアップ分析
- `uiux` (ui, ux) - UI/UX設計

#### Planning (計画)
- `requirements` (req, spec) - 要件定義
- `architecture` (arch, system) - アーキテクチャ設計
- `project` (pm, manage) - プロジェクト管理

#### Testing (テスト)
- `testing` (test, qa) - テスト支援

#### Analysis (分析)
- `security` (sec, audit) - セキュリティ分析
- `performance` (perf, optimize) - パフォーマンス最適化
- `review` (cr, codereview) - コードレビュー
- `analytics` (data-analysis, bi) - データ分析

#### Documentation (ドキュメント)
- `documentation` (doc, docs) - 技術文書作成

## Available Tools

### File Operations
- `Read`: Read file contents with line numbers
- `Write`: Create or overwrite files
- `Edit`: Replace text in files

### Search Tools
- `Glob`: Find files by pattern
- `Grep`: Search file contents
- `LS`: List directory contents

### System Tools
- `Bash`: Execute shell commands

## Example Usage

Once started, you can interact with the AI assistant:

```
You: Create a new TypeScript file with a hello world function
Assistant: [Creates the file using Write tool]

You: Show me all TypeScript files in the project
Assistant: [Uses Glob tool to find *.ts files]

You: Find all occurrences of "TODO" in the codebase
Assistant: [Uses Grep tool to search for TODO]
```

## Security Features

- Dangerous command blocking in Bash tool
- Path validation for file operations
- Limited command execution timeout
- Automatic HTTPS upgrade for web requests (future)

## Requirements

- Node.js 18 or higher
- npm or yarn
- Anthropic API key (set as ANTHROPIC_API_KEY environment variable)

## Configuration

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

## Directory Structure

```
bluelamp-cli/
├── src/
│   ├── tools/            # Tool implementations
│   │   ├── base.ts       # Base tool class
│   │   ├── read.ts       # Read tool
│   │   ├── write.ts      # Write tool
│   │   ├── edit.ts       # Edit tool
│   │   ├── bash.ts       # Bash tool
│   │   ├── glob.ts       # Glob tool
│   │   ├── grep.ts       # Grep tool
│   │   └── ls.ts         # LS tool
│   ├── tool-manager.ts   # Tool management system
│   └── index.ts          # Main entry point
├── dist/                 # Compiled JavaScript
├── prompts/              # AI prompts
└── config/               # Configuration files
```

## Version History

- **v1.1.0** - Phase 1: Basic 7 tools implementation (Claude Code compatible)
- **v1.0.0** - Initial release with basic functionality

## License

MIT