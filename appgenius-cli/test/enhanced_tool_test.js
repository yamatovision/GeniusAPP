/**
 * 強化版ツール使用テスト
 * 
 * AIがツールを積極的に使うように強化したテストスクリプト
 */
const { ClaudeToolWrapper } = require('../dist/services/claude-tool-wrapper');
const { GlobTool, ViewTool, LSTool, GrepTool } = require('../dist/tools/fileTools');
const { configManager } = require('../dist/utils/configManager');
const { logger } = require('../dist/utils/logger');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs');

// コマンドライン引数からクエリとモードを取得
const args = process.argv.slice(2);
const searchQuery = args.find(arg => !arg.startsWith('--')) || 'プロジェクト内のJavaScriptファイルを探して';
const useRealAPI = !args.includes('--offline');
const verbose = args.includes('--verbose');

// ログレベルを設定
logger.level = verbose ? 'debug' : 'info';

// ログやヘルプテキストなどを初期状態で無視しないように設定
const filterOutput = process.env.FILTER_OUTPUT !== 'false';

// 現在のディレクトリをプロジェクトルートに設定
const projectRoot = process.cwd();
configManager.setProjectRoot(projectRoot);

console.log(chalk.cyan(`プロジェクトルート: ${projectRoot}`));
console.log(chalk.gray(`API使用: ${useRealAPI ? '有効' : '無効'}, 詳細モード: ${verbose ? '有効' : '無効'}`));

// AIがツールを積極的に使用するよう強化されたシステムプロンプト
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
5. ツールの結果に基づいて段階的に調査を進めてください (例: 最初にGlobTool、次に見つかったファイルをViewで確認)

ツール使用のパターン例:
- ファイルを探す → GlobTool → 結果を分析 → 必要に応じてView
- 特定のコードパターンを探す → GrepTool → 結果を分析 → 必要に応じてView
- 複雑な調査が必要 → dispatch_agent

あなたはツールを使わずに質問に答えることは絶対にできません。
質問を受けたら、まず適切なツールで情報を収集し、それから回答してください。`;

// テスト実行関数
async function runEnhancedToolTest() {
  console.log(chalk.bgBlue.white('\n強化版ツール使用テスト開始\n'));
  
  // ラッパークラスをインスタンス化
  const claude = new ClaudeToolWrapper({
    useRealAPI: useRealAPI,
    systemPrompt: ENHANCED_SYSTEM_PROMPT
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
  
  // ユーザータイプのプロンプトを模倣するため、複数のプロンプトをテスト
  const testCases = [
    searchQuery,
    "ファイルの内容を検索して",
    "どのファイルにclaude-tool-wrapperの実装がありますか？",
    "package.jsonの内容を教えてください",
    "プロジェクトのディレクトリ構造を表示して"
  ];
  
  // ストリーミングコールバック
  const streamCallback = (chunk, type) => {
    if (verbose || !filterOutput) {
      if (type === 'thinking') {
        process.stdout.write(chalk.gray(chunk));
      } else if (type === 'tool_execution') {
        process.stdout.write(chalk.yellow(chunk));
      } else {
        process.stdout.write(chunk);
      }
    }
  };
  
  // 各テストケースを実行
  for (const [index, prompt] of testCases.entries()) {
    console.log(chalk.bgCyan.black(`\nテストケース ${index + 1}: "${prompt}"`));
    
    try {
      // 実行開始時間
      const startTime = Date.now();
      
      // ツール検出・実行機能を使って質問をAIに送信
      const result = await claude.detectAndExecuteTools(prompt, streamCallback);
      
      // 実行終了時間と結果の分析
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(chalk.yellow(`\n実行時間: ${executionTime}ms`));
      console.log(chalk.green(`使用されたツール数: ${result.toolResults.length}`));
      
      // 使用されたツールの詳細表示
      if (result.toolResults.length > 0) {
        console.log(chalk.cyan('使用されたツール:'));
        result.toolResults.forEach((tool, i) => {
          const statusColor = tool.success ? chalk.green : chalk.red;
          console.log(`${i+1}. ${statusColor(tool.toolName)} (${statusColor(tool.success ? '成功' : '失敗')})`);
          
          if (verbose && tool.success) {
            // 詳細モードの場合は結果の一部も表示
            const resultPreview = typeof tool.result === 'string' 
              ? tool.result.substring(0, 100) 
              : JSON.stringify(tool.result).substring(0, 100);
            console.log(chalk.gray(`   結果: ${resultPreview}...`));
          }
        });
      } else {
        console.log(chalk.red('警告: ツールが一つも使用されませんでした！'));
        console.log(chalk.yellow('システムプロンプトを見直す必要があります。'));
      }
      
      // レスポンスの一部を表示
      if (!verbose && filterOutput) {
        const previewLength = Math.min(150, result.responseText.length);
        console.log(chalk.cyan('\nAIレスポンス (抜粋):'));
        console.log(`"${result.responseText.substring(0, previewLength)}..."`);
      }
      
      // ツール使用状況をログに出力
      const toolUsageSummary = {
        prompt,
        executionTime,
        toolCount: result.toolResults.length,
        toolNames: result.toolResults.map(t => t.toolName)
      };
      
      console.log(chalk.gray('\nツール使用サマリー:'), toolUsageSummary);
      
    } catch (error) {
      console.error(chalk.red(`テストケース ${index + 1} でエラー:`), error);
    }
  }
  
  console.log(chalk.bgGreen.black('\n強化版ツール使用テスト完了\n'));
}

// テスト実行
runEnhancedToolTest().catch(err => {
  console.error('テスト実行中にエラー:', err);
  process.exit(1);
});