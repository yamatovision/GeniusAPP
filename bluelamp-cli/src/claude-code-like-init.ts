#!/usr/bin/env node

import { Anthropic } from '@anthropic-ai/sdk';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Claude Codeのような初期化システムの実装
 * 起動時に環境情報を収集し、AIに伝える
 */

interface InitialContext {
  environment: {
    cwd: string;
    isGitRepo: boolean;
    platform: string;
    osVersion: string;
    date: string;
  };
  gitStatus?: {
    currentBranch: string;
    modifiedFiles: string[];
    untrackedFiles: string[];
    recentCommits: string[];
  };
  projectMemory?: string;
  userMemory?: string;
  availableTools: string[];
  modelInfo: string;
}

export class ClaudeCodeLikeInit {
  private context: InitialContext;

  constructor() {
    this.context = {
      environment: {
        cwd: process.cwd(),
        isGitRepo: false,
        platform: process.platform,
        osVersion: '',
        date: new Date().toISOString().split('T')[0]
      },
      availableTools: [],
      modelInfo: 'claude-3-sonnet-20240229'
    };
  }

  /**
   * Claude Codeのような初期化を実行
   */
  async initialize(): Promise<string> {
    console.log(chalk.cyan('🔍 環境情報を収集中...'));

    // 1. OS情報
    await this.collectOSInfo();

    // 2. Git情報
    await this.collectGitInfo();

    // 3. メモリファイル（CLAUDE.md相当）
    await this.loadMemoryFiles();

    // 4. 利用可能なツール
    this.collectAvailableTools();

    // 5. 初期コンテキストを構築
    return this.buildInitialPrompt();
  }

  /**
   * OS情報の収集
   */
  private async collectOSInfo() {
    try {
      const { stdout } = await execAsync('uname -a');
      this.context.environment.osVersion = stdout.trim();
    } catch {
      this.context.environment.osVersion = 'Unknown';
    }
  }

  /**
   * Git情報の収集
   */
  private async collectGitInfo() {
    try {
      // Gitリポジトリかチェック
      await execAsync('git rev-parse --git-dir');
      this.context.environment.isGitRepo = true;

      // 現在のブランチ
      const { stdout: branch } = await execAsync('git branch --show-current');
      
      // 変更されたファイル
      const { stdout: status } = await execAsync('git status --porcelain');
      const lines = status.trim().split('\n').filter(l => l);
      
      // 最近のコミット
      const { stdout: logs } = await execAsync('git log --oneline -5');
      
      this.context.gitStatus = {
        currentBranch: branch.trim(),
        modifiedFiles: lines.filter(l => l.startsWith(' M')).map(l => l.slice(3)),
        untrackedFiles: lines.filter(l => l.startsWith('??')).map(l => l.slice(3)),
        recentCommits: logs.trim().split('\n').filter(l => l)
      };
    } catch {
      // Gitリポジトリでない場合は無視
    }
  }

  /**
   * メモリファイルの読み込み（CLAUDE.md相当）
   */
  private async loadMemoryFiles() {
    // プロジェクトメモリ
    try {
      this.context.projectMemory = await fs.readFile('./BLUELAMP.md', 'utf-8');
    } catch {
      // ファイルがない場合は無視
    }

    // ユーザーメモリ
    const userMemoryPath = path.join(process.env.HOME || '', '.bluelamp', 'BLUELAMP.md');
    try {
      this.context.userMemory = await fs.readFile(userMemoryPath, 'utf-8');
    } catch {
      // ファイルがない場合は無視
    }
  }

  /**
   * 利用可能なツールのリスト
   */
  private collectAvailableTools() {
    this.context.availableTools = [
      'read - ファイルを読む',
      'write - ファイルを書く',
      'edit - ファイルを編集',
      'bash - コマンドを実行',
      'ls - ディレクトリ一覧',
      'grep - ファイル内検索',
      'glob - パターン検索'
    ];
  }

  /**
   * 初期プロンプトの構築
   */
  private buildInitialPrompt(): string {
    const prompt = `
# 初期コンテキスト

## 環境情報
- 作業ディレクトリ: ${this.context.environment.cwd}
- Gitリポジトリ: ${this.context.environment.isGitRepo ? 'Yes' : 'No'}
- プラットフォーム: ${this.context.environment.platform}
- OSバージョン: ${this.context.environment.osVersion}
- 日付: ${this.context.environment.date}

${this.context.gitStatus ? `
## Git状態
- 現在のブランチ: ${this.context.gitStatus.currentBranch}
- 変更されたファイル: ${this.context.gitStatus.modifiedFiles.length}個
- 未追跡ファイル: ${this.context.gitStatus.untrackedFiles.length}個
- 最近のコミット:
${this.context.gitStatus.recentCommits.map(c => '  - ' + c).join('\n')}
` : ''}

${this.context.projectMemory ? `
## プロジェクト固有の指示
${this.context.projectMemory}
` : ''}

## 利用可能なツール
${this.context.availableTools.map(t => '- ' + t).join('\n')}

## あなたの役割
あなたは自律的な開発アシスタントです。上記のコンテキストを理解し、ユーザーのタスクを効率的に達成してください。
`;

    return prompt;
  }

  /**
   * デバッグ用：収集した情報を表示
   */
  displayContext() {
    console.log(chalk.green('\n📋 収集した初期コンテキスト:'));
    console.log(chalk.gray('━'.repeat(50)));
    
    console.log(chalk.yellow('\n🌍 環境情報:'));
    console.log(`  CWD: ${this.context.environment.cwd}`);
    console.log(`  Git: ${this.context.environment.isGitRepo ? '✓' : '✗'}`);
    console.log(`  OS: ${this.context.environment.platform}`);
    
    if (this.context.gitStatus) {
      console.log(chalk.yellow('\n🔀 Git状態:'));
      console.log(`  ブランチ: ${this.context.gitStatus.currentBranch}`);
      console.log(`  変更: ${this.context.gitStatus.modifiedFiles.length}個`);
      console.log(`  未追跡: ${this.context.gitStatus.untrackedFiles.length}個`);
    }
    
    if (this.context.projectMemory) {
      console.log(chalk.yellow('\n📝 プロジェクトメモリ検出'));
    }
    
    console.log(chalk.yellow('\n🔧 ツール:'));
    console.log(`  ${this.context.availableTools.length}個のツールが利用可能`);
    
    console.log(chalk.gray('━'.repeat(50)));
  }
}

// 使用例
async function demo() {
  const init = new ClaudeCodeLikeInit();
  const initialPrompt = await init.initialize();
  
  // デバッグ表示
  init.displayContext();
  
  // このプロンプトをシステムプロンプトに追加
  console.log(chalk.blue('\n生成されたシステムプロンプト:'));
  console.log(initialPrompt);
}

if (require.main === module) {
  demo().catch(console.error);
}