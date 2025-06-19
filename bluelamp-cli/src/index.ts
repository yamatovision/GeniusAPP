#!/usr/bin/env node

import { Anthropic } from '@anthropic-ai/sdk';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { ToolManager } from './tool-manager';

dotenv.config();

// 設定
const PROMPT_URL = 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39';
const MODEL = 'claude-sonnet-4-20250514';
interface Message {
  role: 'user' | 'assistant';
  content: string | any[]; // ツール結果の配列も含む
}

class BlueLampCLI {
  private client: Anthropic;
  private messages: Message[] = [];
  private systemPrompt: string = '';
  private tempFiles: string[] = []; // 一時ファイルのパスを管理
  private toolManager: ToolManager;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('エラー: ANTHROPIC_API_KEY が設定されていません'));
      process.exit(1);
    }
    this.client = new Anthropic({ apiKey });
    
    // ツール管理システムの初期化
    this.toolManager = new ToolManager();
    
    // プロセス終了時に一時ファイルをクリーンアップ
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nBlueLamp CLI を終了します。'));
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
      console.log(chalk.cyan('🔥 BlueLamp CLI を起動中...'));
      
      // HTTPからプロンプトを取得
      await this.fetchPrompt();
      
      console.log(chalk.green('✅ プロンプト読み込み完了'));
      
      // 利用可能なツールを表示（デバッグモードの場合）
      if (process.env.DEBUG) {
        this.toolManager.printToolInfo();
      }
      
      console.log(chalk.yellow('Claude API セッション開始 (20万コンテクスト対応)'));
      console.log(chalk.gray('終了するには "exit" と入力してください\n'));
      
      // 初期メッセージを送信
      await this.sendMessage('開始してください。');
      
      // REPLループ開始
      await this.startREPL();
      
    } catch (error: any) {
      console.error(chalk.red('エラー:'), error.message);
      process.exit(1);
    }
  }

  private async fetchPrompt() {
    try {
      const response = await fetch(PROMPT_URL);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      this.systemPrompt = await response.text();
    } catch (error) {
      console.error(chalk.red('プロンプト取得に失敗しました:'), error);
      throw error;
    }
  }

  private async startREPL() {
    const readline = require('readline');
    
    while (true) {
      console.log(chalk.cyan('\nあなた: ') + chalk.gray('(Ctrl+D で送信, "exit" で終了)'));
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      let userInput = '';
      
      // 複数行入力を受け付ける
      await new Promise<void>((resolve) => {
        rl.on('line', (line: string) => {
          if (userInput) userInput += '\n';
          userInput += line;
        });
        
        rl.on('close', () => {
          resolve();
        });
      });
      
      // 空入力の場合は続行
      if (!userInput.trim()) {
        continue;
      }

      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === '終了') {
        console.log(chalk.yellow('BlueLamp CLI を終了します。'));
        await this.cleanupTempFiles();
        break;
      }
      
      // 入力内容の概要を表示
      const lines = userInput.split('\n');
      if (lines.length > 3) {
        console.log(chalk.gray(`\n[${lines.length}行を受信]`));
      }
      console.log(chalk.green('✔ 送信完了'));
      
      // ローディング表示
      console.log(chalk.cyan('\n🤔 ただいま思考中...\n'));
      
      await this.sendMessage(userInput);
    }
  }




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

  private async sendMessage(content: string) {
    this.messages.push({ role: 'user', content });

    // 連続実行のループ（最大10回）
    for (let iteration = 0; iteration < 10; iteration++) {
      try {
        console.log(chalk.gray(`\n--- ステップ ${iteration + 1} ---`));
        
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 64000,  // 最大出力トークンに設定
          temperature: 0.7,
          system: this.getEnhancedSystemPrompt(), // 改良されたプロンプト
          messages: this.messages,
          tools: this.toolManager.getToolsForClaude() // ツール管理システムから取得
        });

        // アシスタントの応答全体をメッセージに追加（重要！）
        // response.contentをそのまま配列として保存
        this.messages.push({ role: 'assistant', content: response.content });

        // レスポンス処理とツール使用の確認
        let hasToolUse = false;
        const toolResults: any[] = [];

        for (const contentBlock of response.content) {
          if (contentBlock.type === 'text') {
            console.log(chalk.green('\nClaude:'));
            console.log(contentBlock.text + '\n');
          } else if (contentBlock.type === 'tool_use') {
            hasToolUse = true;
            const result = await this.executeTool(contentBlock.name, contentBlock.input);
            
            // ツール結果を記録
            toolResults.push({
              type: 'tool_result',
              tool_use_id: contentBlock.id,
              content: result
            });
          }
        }

        // ツールを使用した場合、結果を追加して継続
        if (hasToolUse && toolResults.length > 0) {
          this.messages.push({ role: 'user', content: toolResults });
          console.log(chalk.yellow('↻ ツール結果を基に処理を継続...\n'));
          continue; // 次のイテレーションへ
        }

        // ツール使用がない場合は完了
        console.log(chalk.green('✅ タスク完了\n'));
        break;

      } catch (error: any) {
        console.error(chalk.red('\nエラーが発生しました:'), error.message);
        console.log(chalk.yellow('もう一度お試しください。\n'));
        break;
      }
    }
  }

  private async executeTool(toolName: string, input: any): Promise<string> {
    console.log(chalk.blue(`🔧 ツール実行: ${toolName}`));
    console.log(chalk.gray(`入力パラメータ: ${JSON.stringify(input)}`));
    
    try {
      // ツール管理システムに委譲
      const result = await this.toolManager.executeTool(toolName, input);
      console.log(chalk.gray(`結果: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}\n`));
      return result;
    } catch (error: any) {
      console.error(chalk.red(`ツール実行エラー:`, error.message));
      return `❌ エラー: ${error.message}`;
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
1. **現状分析**: read/bashでプロジェクト状態を把握
2. **計画立案**: 必要な手順を特定（内部的に、ユーザーに説明しない）
3. **実行**: ツールを使って実際に作業
4. **検証**: 結果を確認し、問題があれば修正
5. **簡潔な報告**: 完了したことを短く報告

### 思考プロセス
- エラーを見つけたら、説明ではなく修正を実行
- ファイルが必要なら、質問ではなく作成を実行
- 不明な点があれば、推測ではなく調査を実行

### 例
「TypeScriptのエラーを修正して」と言われたら：
1. bash で npm run build → エラー確認
2. read でエラーファイル読み込み
3. edit で修正
4. bash で再ビルド確認
5. 「修正完了」とだけ報告`;

    return basePrompt + enhancedInstructions;
  }
}

// メイン実行
async function main() {
  const cli = new BlueLampCLI();
  await cli.start();
}

if (require.main === module) {
  main();
}