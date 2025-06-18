#!/usr/bin/env node

import { Anthropic } from '@anthropic-ai/sdk';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

// 設定
const PROMPT_URL = 'http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb';
const MODEL = 'claude-sonnet-4-20250514';
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ツール定義
const tools = [
  {
    name: 'read',
    description: 'ファイルの内容を読み取る',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string', description: 'ファイルパス' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write', 
    description: 'ファイルに内容を書き込む',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: { type: 'string', description: 'ファイルパス' },
        content: { type: 'string', description: 'ファイル内容' }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'edit',
    description: 'ファイルの一部を編集する',
    input_schema: {
      type: 'object' as const, 
      properties: {
        file_path: { type: 'string', description: 'ファイルパス' },
        old_text: { type: 'string', description: '置き換え対象のテキスト' },
        new_text: { type: 'string', description: '新しいテキスト' }
      },
      required: ['file_path', 'old_text', 'new_text']
    }
  },
  {
    name: 'bash',
    description: 'bashコマンドを実行する',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: '実行するコマンド' }
      },
      required: ['command']
    }
  }
];

class BlueLampCLI {
  private client: Anthropic;
  private messages: Message[] = [];
  private systemPrompt: string = '';
  private tempFiles: string[] = []; // 一時ファイルのパスを管理

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('エラー: ANTHROPIC_API_KEY が設定されていません'));
      process.exit(1);
    }
    this.client = new Anthropic({ apiKey });
    
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
      console.log(chalk.cyan('🎨 BlueLamp モックアップアナライザーを起動中...'));
      
      // HTTPからプロンプトを取得
      await this.fetchPrompt();
      
      console.log(chalk.green('✅ プロンプト読み込み完了'));
      console.log(chalk.yellow('モックアップ分析セッション開始 (20万コンテクスト対応)'));
      console.log(chalk.gray('終了するには "exit" と入力してください\n'));
      
      // REPLループ開始（初期メッセージは送信しない）
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
        console.log(chalk.yellow('BlueLamp モックアップアナライザーを終了します。'));
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
      console.log(chalk.cyan('\n🎨 モックアップを分析中...\n'));
      
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

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 64000,  // 最大出力トークンに設定
        temperature: 0.7,
        system: this.systemPrompt,
        messages: this.messages,
        tools: tools
      });

      // レスポンス処理
      if (response.content[0].type === 'text') {
        const assistantMessage = response.content[0].text;
        console.log(chalk.green('モックアップアナライザー:'));
        console.log(assistantMessage + '\n');
        this.messages.push({ role: 'assistant', content: assistantMessage });
      }

      // ツール実行処理
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'tool_use') {
          await this.executeTool(contentBlock.name, contentBlock.input);
        }
      }

    } catch (error: any) {
      console.error(chalk.red('\nエラーが発生しました:'), error.message);
      console.log(chalk.yellow('もう一度お試しください。\n'));
    }
  }

  private async executeTool(toolName: string, input: any) {
    console.log(chalk.blue(`🔧 ツール実行: ${toolName}`));
    console.log(chalk.gray(`入力パラメータ: ${JSON.stringify(input)}`));
    
    try {
      let result = '';
      
      switch (toolName) {
        case 'read':
          result = await this.readFile(input.file_path);
          break;
        case 'write':
          if (!input.content) {
            result = `❌ エラー: content パラメータが未定義です。受信パラメータ: ${JSON.stringify(input)}`;
            break;
          }
          result = await this.writeFile(input.file_path, input.content);
          break;
        case 'edit':
          result = await this.editFile(input.file_path, input.old_text, input.new_text);
          break;
        case 'bash':
          result = await this.execBash(input.command);
          break;
        default:
          result = `未知のツール: ${toolName}`;
      }
      
      console.log(chalk.gray(`結果: ${result}\n`));
      
    } catch (error: any) {
      console.error(chalk.red(`ツール実行エラー (${toolName}):`, error.message));
    }
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return `✅ ファイル読み込み成功: ${filePath}\n${content}`;
    } catch (error: any) {
      return `❌ ファイル読み込みエラー: ${error.message}`;
    }
  }

  private async writeFile(filePath: string, content: string): Promise<string> {
    try {
      const path = require('path');
      let resolvedPath = filePath;
      
      // 絶対パスで権限が問題になりそうな場合は相対パスに変換
      if (filePath.startsWith('/') && !filePath.startsWith('/Users/') && !filePath.startsWith('/tmp/')) {
        resolvedPath = `.${filePath}`;
        console.log(`権限回避のため相対パスに変換: ${filePath} → ${resolvedPath}`);
      }
      
      const dir = path.dirname(resolvedPath);
      
      // ディレクトリが存在しない場合は再帰的に作成
      await fs.mkdir(dir, { recursive: true });
      
      // ファイル書き込み
      await fs.writeFile(resolvedPath, content, 'utf-8');
      return `✅ ファイル作成成功: ${resolvedPath} (ディレクトリも自動作成)`;
    } catch (error: any) {
      return `❌ ファイル作成エラー: ${error.message}`;
    }
  }

  private async editFile(filePath: string, oldText: string, newText: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const updatedContent = content.replace(oldText, newText);
      await fs.writeFile(filePath, updatedContent, 'utf-8');
      return `✅ ファイル編集成功: ${filePath}`;
    } catch (error: any) {
      return `❌ ファイル編集エラー: ${error.message}`;
    }
  }

  private async execBash(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return `✅ コマンド実行成功:\n${stdout}${stderr ? `\nSTDERR: ${stderr}` : ''}`;
    } catch (error: any) {
      return `❌ コマンド実行エラー: ${error.message}`;
    }
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