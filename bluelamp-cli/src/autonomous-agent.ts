#!/usr/bin/env node

import { Anthropic } from '@anthropic-ai/sdk';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

interface AgentMemory {
  project: string;
  user: string;
  imported: Map<string, string>;
}

interface AgentContext {
  projectType: string;
  recentActions: any[];
  knownFiles: Map<string, any>;
  goals: string[];
}

interface ExecutionPlan {
  mainGoal: string;
  steps: PlanStep[];
}

interface PlanStep {
  id: string;
  action: string;
  dependencies: string[];
  requiresFileSearch?: boolean;
  searchPattern?: string;
  context?: any;
}

/**
 * Claude Code風の自律的エージェントシステム
 * 二段階AI処理とコンテキスト認識型の自律動作を実現
 */
export class AutonomousAgent {
  private client: Anthropic;
  private memory: AgentMemory;
  private context: AgentContext;
  private systemPrompt: string = '';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.memory = {
      project: '',
      user: '',
      imported: new Map()
    };
    this.context = {
      projectType: '',
      recentActions: [],
      knownFiles: new Map(),
      goals: []
    };
  }

  /**
   * エージェントの初期化
   * CLAUDE.md風のメモリシステムを読み込み
   */
  async initialize(): Promise<void> {
    console.log(chalk.cyan('🧠 自律的エージェントを初期化中...'));
    
    // 1. プロジェクト分析
    await this.analyzeProject();
    
    // 2. メモリ読み込み（CLAUDE.md相当）
    await this.loadMemories();
    
    // 3. 動的プロンプト構築
    this.systemPrompt = await this.buildDynamicPrompt();
    
    // 4. 初期メッセージ生成
    const greeting = await this.generateContextualGreeting();
    console.log(chalk.green(greeting));
  }

  /**
   * プロジェクト構造を分析してコンテキストを構築
   */
  private async analyzeProject(): Promise<void> {
    try {
      // package.jsonから情報取得
      const packageJson = await this.readJSON('package.json');
      if (packageJson) {
        this.context.projectType = this.detectProjectType(packageJson);
      }

      // プロジェクトファイルをスキャン
      const files = await glob('**/*.{js,ts,jsx,tsx,md,json}', {
        ignore: ['node_modules/**', 'dist/**', 'build/**']
      });

      // 重要なファイルを記憶
      for (const file of files.slice(0, 100)) { // 最初の100ファイル
        this.context.knownFiles.set(file, { 
          path: file, 
          type: path.extname(file) 
        });
      }
    } catch (error) {
      console.log(chalk.yellow('プロジェクト分析をスキップ'));
    }
  }

  /**
   * CLAUDE.md風のメモリシステムを実装
   */
  private async loadMemories(): Promise<void> {
    // プロジェクトメモリ
    try {
      this.memory.project = await fs.readFile('./BLUELAMP.md', 'utf-8');
    } catch {
      // デフォルトメモリを作成
      this.memory.project = this.getDefaultProjectMemory();
    }

    // ユーザーメモリ
    const userMemoryPath = path.join(process.env.HOME || '', '.bluelamp', 'BLUELAMP.md');
    try {
      this.memory.user = await fs.readFile(userMemoryPath, 'utf-8');
    } catch {
      this.memory.user = '';
    }
  }

  /**
   * 動的にシステムプロンプトを構築
   * Claude Codeの二段階処理を模倣
   */
  private async buildDynamicPrompt(): Promise<string> {
    const projectInfo = this.context.projectType || 'general';
    const fileCount = this.context.knownFiles.size;

    return `
あなたは自律的な開発アシスタントです。

## プロジェクトコンテキスト
- プロジェクトタイプ: ${projectInfo}
- 認識済みファイル数: ${fileCount}

## プロジェクト固有の指示
${this.memory.project}

## ユーザー設定
${this.memory.user}

## 動作原則
1. ユーザーの意図を理解し、必要な情報を自動的に収集する
2. ファイルの検索、読み込み、編集を自律的に実行する
3. 各アクションの前に何をするか簡潔に説明する
4. エラーが発生したら自動的に解決を試みる

## 利用可能なツール
- read: ファイル読み込み
- write: ファイル作成・更新
- edit: ファイル編集
- bash: コマンド実行
- search: ファイル検索（パターンマッチング）

自律的に行動し、ユーザーの目的達成を支援してください。`;
  }

  /**
   * コンテキストに応じた挨拶を生成
   */
  private async generateContextualGreeting(): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 200,
      temperature: 0.7,
      system: this.systemPrompt,
      messages: [{
        role: 'user',
        content: '簡潔で親しみやすい挨拶をしてください。プロジェクトの状況に言及してください。'
      }]
    });

    return response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'こんにちは！開発のお手伝いをします。';
  }

  /**
   * ユーザー入力を処理し、自律的に行動
   */
  async processInput(userInput: string): Promise<void> {
    // 1. 意図を理解し、実行計画を立てる
    const plan = await this.createExecutionPlan(userInput);
    
    console.log(chalk.blue(`\n📋 実行計画: ${plan.mainGoal}`));
    
    // 2. 計画を自律的に実行
    for (const step of plan.steps) {
      await this.executeStep(step);
    }
  }

  /**
   * AIを使って実行計画を作成
   * Claude Codeの自律的な計画立案を模倣
   */
  private async createExecutionPlan(userInput: string): Promise<ExecutionPlan> {
    const planPrompt = `
ユーザー入力: ${userInput}

利用可能なツール:
- read(file_path): ファイルを読む
- write(file_path, content): ファイルを書く
- edit(file_path, old_text, new_text): ファイルを編集
- bash(command): コマンドを実行
- search(pattern): ファイルを検索

この入力に対して、具体的な実行計画をJSON形式で作成してください。
各ステップには、action（ツール名）、必要なパラメータ、依存関係を含めてください。

例:
{
  "mainGoal": "TypeScriptの型エラーを修正する",
  "steps": [
    {
      "id": "1",
      "action": "bash",
      "params": { "command": "npm run build" },
      "dependencies": []
    },
    {
      "id": "2", 
      "action": "read",
      "params": { "file_path": "src/index.ts" },
      "dependencies": ["1"]
    }
  ]
}
`;

    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      temperature: 0.3,
      system: this.systemPrompt,
      messages: [
        { role: 'user', content: planPrompt }
      ]
    });

    // レスポンスからJSONを抽出
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // パースエラーの場合はデフォルトプラン
      }
    }

    return {
      mainGoal: userInput,
      steps: []
    };
  }

  /**
   * 計画のステップを実行
   */
  private async executeStep(step: PlanStep): Promise<void> {
    console.log(chalk.gray(`  → ${step.action}: ${JSON.stringify(step.context?.params || {})}`));
    
    // ここで実際のツール実行を行う
    // 実装は省略（既存のツール実行ロジックを使用）
  }

  // ヘルパーメソッド
  private async readJSON(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private detectProjectType(packageJson: any): string {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) return 'React';
    if (deps.vue) return 'Vue';
    if (deps.angular) return 'Angular';
    if (deps.express) return 'Express';
    if (deps.next) return 'Next.js';
    
    return 'Node.js';
  }

  private getDefaultProjectMemory(): string {
    return `# プロジェクト固有の指示

このファイル（BLUELAMP.md）にプロジェクト固有の指示を記載してください。

例:
- コーディング規約
- 使用するライブラリ
- 避けるべきパターン
- プロジェクト固有の用語

エージェントはこれらの指示に従って動作します。`;
  }
}

// 使用例
if (require.main === module) {
  async function main() {
    const agent = new AutonomousAgent(process.env.ANTHROPIC_API_KEY!);
    await agent.initialize();
    
    // REPLループ（省略）
  }
  
  main().catch(console.error);
}