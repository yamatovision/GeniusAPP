/**
 * logger検索テスト - 強化版ラッパーを使用
 */
const { ClaudeToolWrapperEnhanced } = require('./dist/services/claude-tool-wrapper-enhanced');
const chalk = require('chalk');
const { logger } = require('./dist/utils/logger');
const { configManager } = require('./dist/utils/configManager');

// ログレベルを設定
logger.level = 'debug';
const testPrompt = "コード内でloggerって単語が使われている箇所を教えて";

async function testLoggerSearch() {
  console.log(chalk.blue(`強化版ラッパーでlogger検索テスト: "${testPrompt}"\n`));
  
  // 現在のディレクトリをプロジェクトルートに設定
  const projectRoot = process.cwd();
  configManager.setProjectRoot(projectRoot);
  
  // ラッパークラスをインスタンス化 - 強化版を使用
  const claudeEnhanced = new ClaudeToolWrapperEnhanced({
    useRealAPI: false
  });
  
  console.log(chalk.green('強化版ラッパー初期化完了'));
  
  // ストリーミングコールバック
  const streamCallback = (chunk) => {
    process.stdout.write(chalk.gray(chunk));
  };
  
  try {
    // メッセージを処理
    console.log(chalk.yellow('ユーザー入力:'), testPrompt);
    
    // ツール検出・実行
    console.log(chalk.blue('\nツール検出・実行中...\n'));
    const result = await claudeEnhanced.detectAndExecuteTools(testPrompt, streamCallback);
    
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
testLoggerSearch();