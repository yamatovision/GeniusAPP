import { Anthropic } from '@anthropic-ai/sdk';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { ToolManager } from '../tool-manager';
import { AgentConfig, findAgent, AGENTS } from '../config/agents';
import { FinalUIV2 } from './final-ui-v2';

interface Message {
  role: 'user' | 'assistant';
  content: string | any[];
}

export class UnifiedCLI {
  private client: Anthropic;
  private messages: Message[] = [];
  private systemPrompt: string = '';
  private tempFiles: string[] = [];
  private toolManager: ToolManager;
  private agent: AgentConfig;

  constructor(agentId: string = 'default') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('エラー: ANTHROPIC_API_KEY が設定されていません'));
      process.exit(1);
    }
    
    this.client = new Anthropic({ apiKey });
    this.toolManager = new ToolManager();
    
    // エージェントの設定
    this.agent = findAgent(agentId) || AGENTS.default;
    
    // プロセス終了時のクリーンアップ
    process.on('SIGINT', async () => {
      console.log(chalk.yellow(`\n\n${this.agent.name} を終了します。`));
      await this.cleanupTempFiles();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.cleanupTempFiles();
      process.exit(0);
    });
  }

  async start() {
    try {
      console.log(chalk.cyan(`${this.agent.icon} ${this.agent.name} を起動中...`));
      
      // プロンプトを取得
      await this.fetchPrompt();
      
      console.log(chalk.green('✅ プロンプト読み込み完了'));
      
      // デバッグモードでツール情報を表示
      if (process.env.DEBUG) {
        this.toolManager.printToolInfo();
      }
      
      // Final UI V2 を使用
      await this.startFinalUIREPL();
      
    } catch (error: any) {
      console.error(chalk.red('エラー:'), error.message);
      process.exit(1);
    }
  }

  private async fetchPrompt() {
    try {
      const response = await fetch(this.agent.promptUrl);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      this.systemPrompt = await response.text();
    } catch (error) {
      console.error(chalk.red('プロンプト取得に失敗しました:'), error);
      throw error;
    }
  }

  private async startFinalUIREPL() {
    const ui = new FinalUIV2({
      title: `${this.agent.icon} ${this.agent.name} - BlueLamp CLI`
    });

    // 過去の出力を表示
    ui.appendOutput(chalk.cyan(`${this.agent.icon} ${this.agent.name} を起動しました`));
    ui.appendOutput(chalk.yellow(`Claude API セッション (20万コンテキスト対応)`));
    ui.appendOutput(chalk.blue(`エージェント: ${this.agent.name}`));
    ui.appendOutput(chalk.gray(`説明: ${this.agent.description}`));
    ui.newLine();
    
    // 初期メッセージを送信
    const initialMessage = this.agent.initialMessage || '開始してください。';
    ui.appendOutput(chalk.cyan('あなた:'));
    ui.appendOutput(initialMessage);
    ui.appendOutput(chalk.green('✔ 送信完了'));
    ui.appendOutput(chalk.cyan('🤔 ただいま思考中...'));
    ui.newLine();
    
    // 初期メッセージに対する応答を処理
    await this.sendMessageWithUI(initialMessage, ui);

    // 入力イベントハンドラー
    ui.on('input', async (userInput: string) => {
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === '終了') {
        ui.appendOutput(chalk.yellow(`${this.agent.name} を終了します。`));
        await this.cleanupTempFiles();
        ui.destroy();
        process.exit(0);
      }

      // ユーザー入力を表示
      ui.appendOutput(chalk.cyan('あなた:'));
      ui.appendOutput(userInput);
      
      const lines = userInput.split('\n');
      if (lines.length > 3) {
        ui.appendOutput(chalk.gray(`[${lines.length}行を受信]`));
      }
      ui.appendOutput(chalk.green('✔ 送信完了'));
      ui.appendOutput(chalk.cyan('🤔 ただいま思考中...'));
      ui.newLine();

      // メッセージ送信（UIに出力を渡す）
      await this.sendMessageWithUI(userInput, ui);
    });

    // 終了イベントハンドラー
    ui.on('exit', async () => {
      await this.cleanupTempFiles();
      process.exit(0);
    });
  }

  /*
  // 将来の参考のため残しておく
  private async startReadlineREPL() {
    const readline = require('readline');
    
    while (true) {
      console.log(chalk.cyan('\nあなた: ') + chalk.gray('(Ctrl+D で送信, "exit" で終了)'));
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      let userInput = '';
      
      await new Promise<void>((resolve) => {
        rl.on('line', (line: string) => {
          if (userInput) userInput += '\n';
          userInput += line;
        });
        
        rl.on('close', () => {
          resolve();
        });
      });
      
      if (!userInput.trim()) {
        continue;
      }

      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === '終了') {
        console.log(chalk.yellow(`${this.agent.name} を終了します。`));
        await this.cleanupTempFiles();
        break;
      }
      
      const lines = userInput.split('\n');
      if (lines.length > 3) {
        console.log(chalk.gray(`\n[${lines.length}行を受信]`));
      }
      console.log(chalk.green('✔ 送信完了'));
      
      console.log(chalk.cyan('\n🤔 ただいま思考中...\n'));
      
      await this.sendMessage(userInput);
    }
  }
  */

  private async cleanupTempFiles(): Promise<void> {
    for (const filePath of this.tempFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // ファイルが既に削除されている場合は無視
      }
    }
    this.tempFiles = [];
  }

  /*
  private async sendMessage(content: string) {
    this.messages.push({ role: 'user', content });

    for (let iteration = 0; iteration < 10; iteration++) {
      try {
        console.log(chalk.gray(`\n--- ステップ ${iteration + 1} ---`));
        
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 64000,
          temperature: 0.7,
          system: this.getEnhancedSystemPrompt(),
          messages: this.messages,
          tools: this.toolManager.getToolsForClaude()
        });

        this.messages.push({ role: 'assistant', content: response.content });

        let hasToolUse = false;
        const toolResults: any[] = [];

        for (const contentBlock of response.content) {
          if (contentBlock.type === 'text') {
            console.log(chalk.green('\nClaude:'));
            console.log(contentBlock.text + '\n');
          } else if (contentBlock.type === 'tool_use') {
            hasToolUse = true;
            const result = await this.executeTool(contentBlock.name, contentBlock.input);
            
            toolResults.push({
              type: 'tool_result',
              tool_use_id: contentBlock.id,
              content: result
            });
          }
        }

        if (hasToolUse && toolResults.length > 0) {
          this.messages.push({ role: 'user', content: toolResults });
          console.log(chalk.yellow('↻ ツール結果を基に処理を継続...\n'));
          continue;
        }

        console.log(chalk.green('✅ タスク完了\n'));
        break;

      } catch (error: any) {
        console.error(chalk.red('\nエラーが発生しました:'), error.message);
        console.log(chalk.yellow('もう一度お試しください。\n'));
        break;
      }
    }
  }
  */

  private async executeTool(toolName: string, input: any): Promise<string> {
    console.log(chalk.blue(`🔧 ツール実行: ${toolName}`));
    console.log(chalk.gray(`入力パラメータ: ${JSON.stringify(input)}`));
    
    try {
      const result = await this.toolManager.executeTool(toolName, input);
      console.log(chalk.gray(`結果: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}\n`));
      return result;
    } catch (error: any) {
      console.error(chalk.red(`ツール実行エラー:`, error.message));
      return `❌ エラー: ${error.message}`;
    }
  }

  private async sendMessageWithUI(content: string, ui: FinalUIV2) {
    this.messages.push({ role: 'user', content });

    for (let iteration = 0; iteration < 10; iteration++) {
      try {
        ui.appendOutput(chalk.gray(`--- ステップ ${iteration + 1} ---`));
        
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 64000,
          temperature: 0.7,
          system: this.getEnhancedSystemPrompt(),
          messages: this.messages,
          tools: this.toolManager.getToolsForClaude()
        });

        this.messages.push({ role: 'assistant', content: response.content });

        let hasToolUse = false;
        const toolResults: any[] = [];

        for (const contentBlock of response.content) {
          if (contentBlock.type === 'text') {
            ui.appendOutput(chalk.green('Claude:'));
            ui.appendOutput(contentBlock.text);
          } else if (contentBlock.type === 'tool_use') {
            hasToolUse = true;
            ui.appendOutput(chalk.blue(`🔧 ツール実行: ${contentBlock.name}`));
            ui.appendOutput(chalk.gray(`入力パラメータ: ${JSON.stringify(contentBlock.input)}`));
            
            const result = await this.executeTool(contentBlock.name, contentBlock.input);
            
            ui.appendOutput(chalk.gray(`結果: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`));
            ui.newLine();
            
            toolResults.push({
              type: 'tool_result',
              tool_use_id: contentBlock.id,
              content: result
            });
          }
        }

        if (hasToolUse && toolResults.length > 0) {
          this.messages.push({ role: 'user', content: toolResults });
          ui.appendOutput(chalk.yellow('↻ ツール結果を基に処理を継続...'));
          ui.newLine();
          continue;
        }

        ui.appendOutput(chalk.green('✅ タスク完了'));
        ui.newLine();
        break;

      } catch (error: any) {
        ui.appendOutput(chalk.red('エラーが発生しました:'));
        ui.appendOutput(error.message);
        ui.appendOutput(chalk.yellow('もう一度お試しください。'));
        ui.newLine();
        break;
      }
    }
  }

  private getEnhancedSystemPrompt(): string {
    const basePrompt = this.systemPrompt;
    const toolDescriptions = this.toolManager.generateToolDescriptions();
    const enhancedInstructions = `

## 重要な動作指示

あなたは自律的な開発アシスタントです。以下の原則に従って動作してください：

${toolDescriptions}

### 動作原則
1. **簡潔で的確な応答**: ユーザーへの応答は4行以内を基本とし、冗長な説明を避ける
2. **ツールの積極的使用**: 質問に答える前に、利用可能なツールで情報を収集・検証する
3. **自律的なタスク完了**: ユーザーの指示を待たずに、タスクを完了まで実行する
4. **プロジェクトコンテキスト理解**: 現在のディレクトリ、ファイル構造、既存コードを理解して作業する

### タスク実行の流れ
1. **現状分析**: Read/Bashでプロジェクト状態を把握
2. **計画立案**: 必要な手順を特定（内部的に、ユーザーに説明しない）
3. **実行**: ツールを使って実際に作業
4. **検証**: 結果を確認し、問題があれば修正
5. **簡潔な報告**: 完了したことを短く報告

### 思考プロセス
- エラーを見つけたら、説明ではなく修正を実行
- ファイルが必要なら、質問ではなく作成を実行
- 不明な点があれば、推測ではなく調査を実行`;

    return basePrompt + enhancedInstructions;
  }
}