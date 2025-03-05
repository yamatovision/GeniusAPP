/**
 * ClaudeToolWrapperのテスト
 * 
 * 特にマークダウンファイル検索機能に焦点を当てたテスト
 */
const path = require('path');
const fs = require('fs');
const { logger } = require('../dist/utils/logger');
const { configManager } = require('../dist/utils/configManager');
const chalk = require('chalk');

// ログレベルを設定
logger.level = 'debug';

// コマンドライン引数を取得
const args = process.argv.slice(2);
const customPrompt = args.find(arg => !arg.startsWith('--'));
const useApi = args.includes('--api');
const verbose = args.includes('--verbose');

// モジュールをビルドして読み込む（distから読み込む）
const { ClaudeToolWrapper } = require('../dist/services/claude-tool-wrapper');
const { GlobTool, ViewTool, LSTool, GrepTool } = require('../dist/tools/fileTools');

// 現在のディレクトリをプロジェクトルートに設定
const projectRoot = process.cwd();
configManager.setProjectRoot(projectRoot);

console.log(chalk.cyan(`プロジェクトルート: ${projectRoot}`));
console.log(chalk.gray(`API使用: ${useApi ? '有効' : '無効'}, 詳細モード: ${verbose ? '有効' : '無効'}`));

// テスト実行
async function testToolWrapper() {
  console.log(chalk.bgBlue.white('\nClaudeToolWrapper テスト開始\n'));
  
  // ラッパークラスをインスタンス化
  const claude = new ClaudeToolWrapper({
    useRealAPI: useApi,
    systemPrompt: `あなたはファイル検索と分析のエキスパートです。
ユーザーの質問に答えるために、以下のツールを積極的に使用してください：

- GlobTool: ファイルパターン検索 (例: **/*.md, **/*.js など)
- GrepTool: ファイル内容検索
- View: ファイル内容表示
- LS: ディレクトリ一覧表示
- dispatch_agent: 複雑な検索用のエージェント (マークダウンファイルの詳細検索など)

特にユーザーがマークダウン(md)ファイルに関する質問をした場合は、
まず**/*.mdパターンでGlobToolを使って検索し、必要に応じてファイル内容をViewで確認してください。

複雑な検索要求や「全ての」「詳細に」といった指示があれば、dispatch_agentを使用してください。

質問に答える前に、必ず適切なツールを使って情報を収集し、
正確で役立つ情報を提供してください。`
  });
  
  // ツールを明示的に登録
  const tools = [
    new GlobTool(),
    new GrepTool(),
    new ViewTool(),
    new LSTool()
  ];
  
  claude.registerTools(tools);
  
  console.log(chalk.green('ラッパー初期化完了'));
  
  // テストケース
  const testCases = customPrompt ? [customPrompt] : [
    "マークダウンファイルを探してください",
    "マークダウンを検索して",
    "mdファイルを探して",
    "README.mdファイルの内容を表示して",
    "マークダウンファイルを詳しく調査して",
    "全てのマークダウンを検索して",
    "package.jsonファイルの内容について教えてください",
    "srcディレクトリのファイル一覧を表示して"
  ];
  
  // ストリーミングコールバック
  const streamCallback = (chunk, type) => {
    if (verbose) {
      if (type === 'thinking') {
        process.stdout.write(chalk.gray(chunk));
      } else if (type === 'tool_execution') {
        process.stdout.write(chalk.yellow(chunk));
      } else {
        process.stdout.write(chunk);
      }
    }
  };
  
  for (const [index, prompt] of testCases.entries()) {
    console.log(chalk.bgCyan.black(`\nテストケース ${index + 1}: "${prompt}"`));
    
    try {
      // 実行開始時間
      const startTime = Date.now();
      
      // detectAndExecuteToolsを使用
      const result = await claude.detectAndExecuteTools(prompt, streamCallback);
      
      // 実行終了時間
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(chalk.yellow(`\n実行時間: ${executionTime}ms`));
      console.log(chalk.green(`使用されたツール数: ${result.toolResults.length}`));
      
      if (result.toolResults.length > 0) {
        console.log(chalk.cyan('使用されたツール:'));
        result.toolResults.forEach((tool, i) => {
          const statusColor = tool.success ? chalk.green : chalk.red;
          console.log(`${i+1}. ${statusColor(tool.toolName)} (${statusColor(tool.success ? '成功' : '失敗')})`);
          
          if (verbose && tool.success) {
            // 詳細モードの場合は結果の一部も表示
            const resultPreview = JSON.stringify(tool.result).substring(0, 100);
            console.log(chalk.gray(`   結果: ${resultPreview}...`));
          }
        });
      } else {
        console.log(chalk.yellow('ツールは使用されませんでした'));
      }
      
      // レスポンスの一部を表示
      if (!verbose) { // 詳細モードでない場合のみ表示（詳細モードではストリーミングで表示済み）
        const previewLength = Math.min(150, result.responseText.length);
        console.log(chalk.cyan('\nAIレスポンス:'));
        console.log(`"${result.responseText.substring(0, previewLength)}..."`);
      }
    } catch (error) {
      console.error(chalk.red(`テストケース ${index + 1} でエラー:`), error);
    }
  }
  
  console.log(chalk.bgGreen.black('\nClaudeToolWrapper テスト完了\n'));
}

// テスト実行
testToolWrapper();