const { ClaudeToolWrapper } = require('../dist/services/claude-tool-wrapper');
const { GlobTool, ViewTool, LSTool, GrepTool } = require('../dist/tools/fileTools');
const { configManager } = require('../dist/utils/configManager');
const { logger } = require('../dist/utils/logger');
const path = require('path');

// コマンドライン引数からクエリを取得
const args = process.argv.slice(2);
const searchQuery = args[0] || 'マークダウンファイルを検索して詳細を教えてください';

// ログレベルをinfoに設定
logger.level = 'info';

// 現在のディレクトリをプロジェクトルートに設定
const currentConfig = configManager.getConfig();
currentConfig.projectRoot = process.cwd();
configManager.saveConfig();

console.log(`プロジェクトルート: ${currentConfig.projectRoot}`);

async function testAISearch() {
  console.log(`\n===== AI検索テスト開始: "${searchQuery}" =====\n`);
  
  // ClaudeToolWrapperをインスタンス化 (APIを使わないモード)
  const claude = new ClaudeToolWrapper({
    useRealAPI: false,
    systemPrompt: `あなたはファイル検索のエキスパートです。
マークダウンファイル(.md)やJavaScriptファイル(.js/.ts)など、
ユーザーが求めるファイルを適切なツールを使って探し出します。

特に以下のツールを積極的に活用してください:
- GlobTool: ファイルパターン検索 (例: **/*.md)
- GrepTool: ファイル内容検索
- View: ファイル内容の表示
- LS: ディレクトリ内容の一覧表示
- dispatch_agent: 複雑な検索には、より詳細な検索が可能なエージェントを使用

どのようなファイル検索でも、まず適切なツールを選んで情報を正確に収集します。
特に全てのファイルや詳細な分析が必要な場合は、dispatch_agentを使用してください。`
  });
  
  // ストリーミングコールバック
  const streamCallback = (chunk) => {
    process.stdout.write(chunk);
  };
  
  try {
    console.log('AIアシスタントに問い合わせ中...\n');
    
    // タイマー開始
    const startTime = Date.now();
    
    // ツール検出・実行機能を使ってメッセージを送信
    const result = await claude.detectAndExecuteTools(searchQuery, streamCallback);
    
    // タイマー終了
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`\n\n===== 実行結果 (${executionTime}ms) =====\n`);
    
    if (result.toolResults.length > 0) {
      console.log(`使用されたツール (${result.toolResults.length}個):`);
      
      result.toolResults.forEach((tool, index) => {
        console.log(`\n${index + 1}. ツール: ${tool.toolName} (${tool.success ? '成功' : '失敗'})`);
        
        if (tool.success) {
          // 結果の概要を表示（長すぎる場合は省略）
          const resultStr = JSON.stringify(tool.result);
          const shortResult = resultStr.length > 300 
            ? resultStr.substring(0, 300) + '...' 
            : resultStr;
          console.log(`   結果: ${shortResult}`);
        } else {
          console.log(`   エラー: ${tool.error}`);
        }
      });
    } else {
      console.log('ツールは使用されませんでした');
    }
    
    console.log('\n===== テスト完了 =====\n');
  } catch (error) {
    console.error('エラー発生:', error);
  }
}

// テスト実行
testAISearch();