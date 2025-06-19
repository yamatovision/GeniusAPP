#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { UnifiedCLI } from './core/cli';
import { getAllAgents, getAgentsByCategory, findAgent } from './config/agents';

dotenv.config();

// バージョン情報
const VERSION = '1.2.0';

program
  .version(VERSION)
  .description('BlueLamp CLI - Unified AI Development Assistant');

// エージェント実行コマンド
program
  .command('agent <name>')
  .alias('a')
  .description('特定のエージェントを起動')
  .action(async (name: string) => {
    const agent = findAgent(name);
    if (!agent) {
      console.error(chalk.red(`エラー: エージェント '${name}' が見つかりません`));
      console.log(chalk.yellow('利用可能なエージェントを確認するには bluelamp list を実行してください'));
      process.exit(1);
    }
    
    const cli = new UnifiedCLI(agent.id);
    await cli.start();
  });

// エージェント一覧コマンド
program
  .command('list')
  .alias('ls')
  .description('利用可能なエージェント一覧を表示')
  .option('-c, --category <category>', 'カテゴリでフィルタ')
  .action((options: { category?: string }) => {
    const agents = options.category 
      ? getAgentsByCategory(options.category as any)
      : getAllAgents();
    
    if (agents.length === 0) {
      console.log(chalk.yellow(`カテゴリ '${options.category}' のエージェントが見つかりません`));
      return;
    }
    
    console.log(chalk.cyan('\n=== 利用可能なエージェント ===\n'));
    
    // カテゴリごとにグループ化
    const grouped = agents.reduce((acc, agent) => {
      if (!acc[agent.category]) acc[agent.category] = [];
      acc[agent.category].push(agent);
      return acc;
    }, {} as Record<string, typeof agents>);
    
    Object.entries(grouped).forEach(([category, agents]) => {
      console.log(chalk.yellow(`📁 ${category.toUpperCase()}`));
      agents.forEach(agent => {
        const aliases = agent.aliases ? ` (${agent.aliases.join(', ')})` : '';
        console.log(`  ${agent.icon} ${agent.id}${aliases} - ${agent.description}`);
      });
      console.log('');
    });
    
    console.log(chalk.gray('使用方法: bluelamp agent <name> または bluelamp <alias>'));
  });

// デフォルトコマンド（エージェント名を直接指定）
program
  .command('run [agent]', { isDefault: true })
  .description('エージェントを起動（デフォルト: general development assistant）')
  .action(async (agentName?: string) => {
    const cli = new UnifiedCLI(agentName);
    await cli.start();
  });

// エイリアスの直接サポート
const args = process.argv.slice(2);
if (args.length === 1 && !args[0].startsWith('-')) {
  // コマンドではない単一の引数はエージェント名として扱う
  const agent = findAgent(args[0]);
  if (agent) {
    const cli = new UnifiedCLI(agent.id);
    cli.start();
  } else {
    program.parse(process.argv);
  }
} else {
  program.parse(process.argv);
}