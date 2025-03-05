#!/usr/bin/env node

/**
 * 強化版ツール使用CLIスクリプト
 * AIに強制的にツールを使用させる
 */
const { ClaudeToolWrapperEnhanced } = require('../dist/services/claude-tool-wrapper-enhanced');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const { logger } = require('../dist/utils/logger');
const { configManager } = require('../dist/utils/configManager');
const path = require('path');

// コマンドライン引数からモードを取得
const args = process.argv.slice(2);
const useRealAPI = !args.includes('--offline');
const verbose = args.includes('--verbose');

// ログレベルを設定
logger.level = verbose ? 'debug' : 'info';

// 現在のディレクトリをプロジェクトルートに設定
const projectRoot = process.cwd();
configManager.setProjectRoot(projectRoot);

console.log(chalk.cyan(`プロジェクトルート: ${projectRoot}`));
console.log(chalk.gray(`API使用: ${useRealAPI ? '有効' : '無効'}, 詳細モード: ${verbose ? '有効' : '無効'}`));

// 強化されたシステムプロンプト
const ENHANCED_SYSTEM_PROMPT = `あなたはファイル検索と分析のエキスパートです。
ユーザーの質問に答えるために、以下のツールを【必ず】かつ【積極的に】使用してください：

- GlobTool: ファイルパターン検索 (例: **/*.md, **/*.js など)
- GrepTool: ファイル内容検索
- View: ファイル内容表示
- LS: ディレクトリ一覧表示
- dispatch_agent: 複雑な検索用のエージェント

重要なガイドライン:
1. 質問に答える前に、必ず関連するツールを使用して情報を収集してください
2. 情報を推測したり、一般的な知識だけで答えず、必ずツールを使って確認してください
3. ファイル検索には必ずGlobToolを使い、検索結果があればViewで内容を確認してください
4. コードやファイル内容を検索する場合はGrepToolを使用してください
5. ツールの結果に基づいて段階的に調査を進めてください

あなたはツールを使わずに質問に答えることは絶対にできません。
質問を受けたら、まず適切なツールで情報を収集し、それから回答してください。`;

/**
 * 対話型CLI実行関数
 */
async function startEnhancedToolSession() {
  console.log(chalk.blue('AppGenius 強化版ツール使用CLI - 起動中...\n'));
  
  // ラッパークラスをインスタンス化
  const claude = new ClaudeToolWrapperEnhanced({
    streaming: true,
    useRealAPI: useRealAPI,
    systemPrompt: ENHANCED_SYSTEM_PROMPT
  });
  
  const spinner = ora('AIアシスタントを準備中...').start();
  
  try {
    // ヘルプコマンドリスト
    const helpText = `
${chalk.bold('利用可能なコマンド:')}
${chalk.green('/quit')} または ${chalk.green('/exit')} - プログラムを終了
${chalk.green('/clear')} - 会話履歴をクリア
${chalk.green('/help')} - このヘルプを表示

${chalk.bold('使用例:')}
- "${chalk.cyan('プロジェクト内のファイルを検索して')}" - 全ファイル検索
- "${chalk.cyan('マークダウンファイルを探して')}" - MDファイル検索
- "${chalk.cyan('package.jsonの内容を表示して')}" - 特定ファイルの内容表示
- "${chalk.cyan('プロジェクト構造を分析して')}" - ディレクトリ構造分析
- "${chalk.cyan('どのファイルにツール実装がありますか')}" - キーワード検索

${chalk.bold('ヒント:')}
- このCLIは強化版で、AIは必ずツールを使用します
- 質問に対して常に実際のファイル検索やコード検索が行われます
`;
    
    spinner.succeed('AIアシスタントの準備完了');
    console.log(chalk.cyan('\nAppGenius 強化版ツール使用CLI - 準備完了\n'));
    console.log('質問を入力するとAIが自動的にツールを使って回答します');
    console.log('コマンド一覧を見るには /help と入力してください\n');
    
    // 対話ループ
    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.green('あなた:'),
          prefix: ''
        }
      ]);
      
      // 特殊コマンド処理
      if (input.trim() === '/quit' || input.trim() === '/exit') {
        console.log(chalk.yellow('プログラムを終了します'));
        break;
      } else if (input.trim() === '/help') {
        console.log(helpText);
        continue;
      } else if (input.trim() === '/clear') {
        claude.clearConversation();
        console.log(chalk.yellow('会話履歴をクリアしました'));
        continue;
      } else if (!input.trim()) {
        continue;
      }
      
      // AIに送信
      spinner.text = '処理中...';
      spinner.start();
      
      try {
        // テキスト部分を保存するバッファ
        let responseBuffer = '';
        
        // ストリーミングコールバック
        const streamCallback = (chunk) => {
          if (spinner.isSpinning) {
            spinner.stop();
            console.log(chalk.blue('\nAI:'));
          }
          responseBuffer += chunk;
          process.stdout.write(chunk);
        };
        
        // ツール検出・実行機能を使ってメッセージを送信
        const result = await claude.detectAndExecuteTools(input, streamCallback);
        
        // ストリーミングが終了していない場合は完了
        if (spinner.isSpinning) {
          spinner.stop();
          console.log(chalk.blue('\nAI:'), result.responseText);
        }
        
        // ツール使用情報を表示
        if (result.toolResults.length > 0) {
          console.log(chalk.gray(`\n[${result.toolResults.length}個のツールが使用されました: ${result.toolResults.map(t => t.toolName).join(', ')}]`));
        } else {
          console.log(chalk.red('\n[警告: ツールが使用されませんでした]'));
        }
        
        console.log(''); // 空行
      } catch (error) {
        spinner.fail('エラーが発生しました');
        console.error(chalk.red(`エラー: ${error.message}`));
      }
    }
  } catch (error) {
    spinner.fail('初期化中にエラーが発生しました');
    console.error(chalk.red(`エラー: ${error.message}`));
  }
}

// CLI実行
startEnhancedToolSession()
  .then(() => {
    console.log('セッション終了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('致命的なエラー:', error);
    process.exit(1);
  });