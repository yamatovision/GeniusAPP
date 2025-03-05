const { ClaudeService } = require('../dist/services/claudeService');
const { GlobTool, ViewTool, LSTool } = require('../dist/tools/fileTools');
const { logger } = require('../dist/utils/logger');
const { configManager } = require('../dist/utils/configManager');
const path = require('path');

// ログレベルをdebugに設定
logger.level = 'debug';

// 現在のディレクトリをプロジェクトルートに設定
const currentConfig = configManager.getConfig();
currentConfig.projectRoot = process.cwd();
configManager.saveConfig();

console.log(`APIキー: ${currentConfig.apiKey.substring(0, 10)}...`);
console.log(`プロジェクトルート: ${currentConfig.projectRoot}`);

async function testToolUsage() {
  console.log('ツール使用テストを開始します...');
  
  // 明示的にツールを使用する擬似応答を作成する関数
  function simulateToolResponse(message) {
    return `まずはpackage.jsonファイルを探します。
<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/package.json</parameter>
</invoke>
</function_calls>

次に、見つかったファイルの内容を表示します。
<function_calls>
<invoke name="ViewTool">
<parameter name="file_path">${process.cwd()}/package.json</parameter>
</invoke>
</function_calls>

以上がpackage.jsonの内容です。`;
  }
  
  // 通常のClaudeServiceを使用します
  const claude = new ClaudeService({
    streaming: false
  });
  
  // ツールを登録
  const globTool = new GlobTool();
  const viewTool = new ViewTool(); 
  const lsTool = new LSTool();
  
  // 登録前にツール名をデバッグ出力
  console.log(`GlobTool名: ${globTool.name}`);
  console.log(`ViewTool名: ${viewTool.name}`);
  console.log(`LSTool名: ${lsTool.name}`);
  
  // registerToolsメソッドで登録
  claude.registerTools([globTool, viewTool, lsTool]);
  
  // private propertiesにアクセスできない可能性があるため、この行はコメントアウト
  // console.log(`登録されているツール: ${Array.from(claude.tools || []).map(t => t.name).join(', ')}`);
  
  // Viewの名前を直接simulateToolResponseで使用していた名前と合わせる
  simulateToolResponse = function(message) {
    return `まずはpackage.jsonファイルを探します。
<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/package.json</parameter>
</invoke>
</function_calls>

次に、見つかったファイルの内容を表示します。
<function_calls>
<invoke name="${viewTool.name}">
<parameter name="file_path">${process.cwd()}/package.json</parameter>
</invoke>
</function_calls>

以上がpackage.jsonの内容です。`;
  };
  
  // sendMessageをオーバーライド（モック）
  claude.sendMessage = async function(message) {
    console.log('ClaudeService: sendMessageをオーバーライド');
    // 実際のAPIを呼び出さずに擬似レスポンスを返す
    return simulateToolResponse(message);
  };
  
  console.log('Claudeサービスを初期化し、ツールを登録しました');
  
  // プロンプト
  const prompt = 'package.jsonファイルを検索して内容を表示してください。';
  
  try {
    console.log(`プロンプト: "${prompt}"`);
    console.log('Claudeに送信中...');
    
    // ツール検出・実行機能を使ってメッセージを送信
    const result = await claude.detectAndExecuteTools(prompt);
    
    console.log('\n--- 結果 ---');
    console.log(`使用されたツール数: ${result.toolResults.length}`);
    if (result.toolResults.length > 0) {
      console.log('\nツール使用結果:');
      result.toolResults.forEach((toolResult, index) => {
        console.log(`\nツール ${index + 1}: ${toolResult.toolName}`);
        console.log(`成功: ${toolResult.success ? 'はい' : 'いいえ'}`);
        if (toolResult.error) {
          console.log(`エラー: ${toolResult.error}`);
        } else {
          console.log(`結果: ${JSON.stringify(toolResult.result).substring(0, 100)}...`);
        }
      });
    }
    
    console.log('\nClaudeの応答:');
    console.log(result.responseText);
    
    console.log('\nテスト完了!');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// テストを実行
testToolUsage();