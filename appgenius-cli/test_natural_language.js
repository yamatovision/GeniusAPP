/**
 * 日本語自然言語コマンドテスト
 */
const { ClaudeToolWrapper } = require('./dist/services/claude-tool-wrapper');
const chalk = require('chalk');
const { logger } = require('./dist/utils/logger');
const { configManager } = require('./dist/utils/configManager');

// ログレベルを設定
logger.level = 'debug';

// コマンドライン引数を取得
const args = process.argv.slice(2);
const customPrompt = args.length > 0 ? args.join(' ') : "マークダウンファイル探して";

// 実行
async function testNaturalLanguage() {
  console.log(chalk.blue(`日本語自然言語コマンドテスト: "${customPrompt}"\n`));
  
  // 現在のディレクトリをプロジェクトルートに設定
  const projectRoot = process.cwd();
  configManager.setProjectRoot(projectRoot);
  
  try {
    // ラッパークラスをインスタンス化
    const claude = new ClaudeToolWrapper({
      useRealAPI: false, // オフラインモード
      systemPrompt: `あなたはファイル操作に特化した高度なAIアシスタントです。
日本語の自然な指示からユーザーの意図を理解し、適切なツールを選択して実行することが得意です。

ツールを積極的に使用し、必要な情報を収集してください。
結果は簡潔に、重要なポイントを強調して返してください。`
    });
    
    console.log(chalk.green('初期化完了'));
    
    // ストリーミングコールバック
    const streamCallback = (chunk) => {
      process.stdout.write(chunk);
    };
    
    // メッセージを処理
    console.log(chalk.yellow('ユーザー入力:'), customPrompt);
    console.log(chalk.blue('拡張思考処理を実行中...'));
    
    // 拡張思考機能でユーザー入力を解析
    const enhancedMessage = await claude._enhanceUserQuery(customPrompt);
    if (enhancedMessage !== customPrompt) {
      console.log(chalk.cyan('\n拡張されたプロンプト:'), enhancedMessage);
    } else {
      console.log(chalk.red('\n拡張なし: 元のプロンプトを使用'));
    }
    
    console.log(chalk.blue('\nツール検出・実行中...\n'));
    
    // ツール検出・実行
    const result = await claude.detectAndExecuteTools(customPrompt, streamCallback);
    
    // 結果の要約を表示
    console.log(chalk.green('\n\n実行結果:'));
    console.log(`使用されたツール数: ${result.toolResults.length}`);
    
    if (result.toolResults.length > 0) {
      console.log(chalk.cyan('使用されたツール:'));
      result.toolResults.forEach((tool, i) => {
        console.log(`${i+1}. ${tool.toolName} (${tool.success ? '成功' : '失敗'})`);
      });
    }
    
    console.log(chalk.green('\nテスト完了'));
  } catch (error) {
    console.error(chalk.red('テスト中にエラーが発生しました:'), error);
  }
}

// テスト実行
testNaturalLanguage();