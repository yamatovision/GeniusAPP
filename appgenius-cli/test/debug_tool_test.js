const { ClaudeService } = require('../dist/services/claudeService');
const { GlobTool, ViewTool, LSTool } = require('../dist/tools/fileTools');
const { logger } = require('../dist/utils/logger');
const { configManager } = require('../dist/utils/configManager');
const fs = require('fs');
const path = require('path');

// ログレベルをdebugに設定
logger.level = 'debug';

// 現在のディレクトリをプロジェクトルートに設定
const currentConfig = configManager.getConfig();
const origProjectRoot = currentConfig.projectRoot;
currentConfig.projectRoot = process.cwd();
configManager.saveConfig();

console.log('デバッグ: ツール実行テスト開始...');
console.log(`APIキー: ${currentConfig.apiKey.substring(0, 10)}...`);
console.log(`プロジェクトルート: ${currentConfig.projectRoot}`);
console.log('');

// 本番APIキーでAPIが機能するかどうかの基本テスト
async function basicApiTest() {
  try {
    console.log('1. 基本的なAPI接続テスト...');
    
    // 極めて単純なテキスト生成だけでAPIが機能するか確認
    const claude = new ClaudeService({
      streaming: false,
      systemPrompt: `あなたは単純明快なアシスタントです。質問に対して「OK、テスト成功」とだけ答えてください。`,
      maxTokens: 20
    });
    
    const response = await claude.sendMessage("APIテストです");
    console.log(`APIレスポンス: "${response.trim()}"`);
    console.log('基本的なAPI接続テスト完了');
    console.log('');
    return true;
  } catch (error) {
    console.error('基本API接続テストエラー:', error);
    return false;
  }
}

// 明示的なツール実行のテスト
async function manualToolTest() {
  try {
    console.log('2. 手動ツール実行テスト...');
    
    // ツールインスタンス作成
    const globTool = new GlobTool();
    const viewTool = new ViewTool();
    
    // 実際にツールを直接実行してみる
    console.log('GlobToolを直接実行: mdファイル検索');
    const globResult = await globTool.execute({ pattern: "**/*.md", path: process.cwd() });
    console.log(`検索結果: ${globResult.length}件のファイルが見つかりました`);
    if (globResult.length > 0) {
      const firstFilePath = globResult[0].filePath;
      console.log(`最初のファイル: ${firstFilePath}`);
      
      console.log('ViewToolを直接実行: ファイル内容表示');
      const viewResult = await viewTool.execute({ file_path: firstFilePath });
      console.log(`ファイル内容先頭部分: ${viewResult.content.substring(0, 100)}...`);
    }
    
    console.log('手動ツール実行テスト完了');
    console.log('');
    return true;
  } catch (error) {
    console.error('手動ツール実行テストエラー:', error);
    return false;
  }
}

// ツールアクセスを含むAPIリクエスト
async function toolApiTest() {
  try {
    console.log('3. ツール付きAPI実行テスト...');
    
    // ClaudeServiceをインスタンス化
    const claude = new ClaudeService({
      streaming: false,
      systemPrompt: `あなたはファイル検索のエキスパートです。GlobToolやViewを積極的に使ってください。以下の形式でツールを使用してください:
<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/*.md</parameter>
</invoke>
</function_calls>`
    });
    
    // ツールを登録
    claude.registerTools([
      new GlobTool(),
      new ViewTool()
    ]);
    
    console.log('リクエスト送信...');
    console.log('プロンプト: "mdファイルを探してください"');
    
    // リクエストとレスポンスを記録する
    const reqsDir = path.join(process.cwd(), 'test', 'debug_logs');
    if (!fs.existsSync(reqsDir)) {
      fs.mkdirSync(reqsDir, { recursive: true });
    }
    
    // ツール検出・実行機能を使ってメッセージを送信
    const result = await claude.detectAndExecuteTools("mdファイルを探してください。必ずGlobToolを使って**/*.mdパターンで検索してください。");
    
    // 結果をログファイルに保存
    const timestamp = Date.now();
    fs.writeFileSync(path.join(reqsDir, `result_${timestamp}.json`), JSON.stringify(result, null, 2));
    
    console.log(`使用されたツール数: ${result.toolResults.length}`);
    console.log(`レスポンス: ${result.responseText.substring(0, 200)}...`);
    
    console.log('ツール付きAPI実行テスト完了');
    console.log('');
    return result.toolResults.length > 0;
  } catch (error) {
    console.error('ツール付きAPI実行テストエラー:', error);
    return false;
  }
}

// 強制的にツール使用パターンを注入する
async function forceToolUsageTest() {
  try {
    console.log('4. 強制ツール使用テスト...');
    
    // オリジナルのメソッドを保持
    const originalSendMessage = ClaudeService.prototype.sendMessage;
    
    // ClaudeServiceのsendMessageメソッドをモンキーパッチ
    ClaudeService.prototype.sendMessage = async function(message) {
      console.log('モンキーパッチ: sendMessage実行');
      const originalResponse = await originalSendMessage.call(this, message);
      
      // レスポンスにツール使用パターンを強制的に挿入
      if (!originalResponse.includes("<function_calls>")) {
        console.log('ツール使用パターンが見つからないため、強制的に挿入します');
        return `まずはMarkdownファイルを探してみます。
<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/*.md</parameter>
</invoke>
</function_calls>

次に見つかったファイルを表示します。
${originalResponse}`;
      }
      
      return originalResponse;
    };
    
    // ClaudeServiceをインスタンス化
    const claude = new ClaudeService({
      streaming: false
    });
    
    // ツールを登録
    claude.registerTools([
      new GlobTool(),
      new ViewTool()
    ]);
    
    console.log('強制ツール使用テスト実行...');
    
    // ツール検出・実行機能を使ってメッセージを送信
    const result = await claude.detectAndExecuteTools("mdファイルを探して");
    
    console.log(`使用されたツール数: ${result.toolResults.length}`);
    console.log(`レスポンス: ${result.responseText.substring(0, 200)}...`);
    
    // 元に戻す
    ClaudeService.prototype.sendMessage = originalSendMessage;
    
    console.log('強制ツール使用テスト完了');
    console.log('');
    return result.toolResults.length > 0;
  } catch (error) {
    console.error('強制ツール使用テストエラー:', error);
    return false;
  }
}

// すべてのテストを実行
async function runAllTests() {
  try {
    const apiOk = await basicApiTest();
    if (!apiOk) {
      console.error('基本APIテストが失敗したため、以降のテストをスキップします');
      return;
    }
    
    const toolsOk = await manualToolTest();
    if (!toolsOk) {
      console.error('手動ツールテストが失敗したため、以降のテストをスキップします');
      return;
    }
    
    const toolApiOk = await toolApiTest();
    console.log(`ツール付きAPIテスト結果: ${toolApiOk ? '成功' : '失敗'}`);
    
    if (!toolApiOk) {
      console.log('ツール使用が検出されなかったため、強制的にツール使用パターンを注入してテストします');
      const forceOk = await forceToolUsageTest();
      console.log(`強制ツール使用テスト結果: ${forceOk ? '成功' : '失敗'}`);
      
      if (forceOk) {
        console.log('結論: APIはツール使用パターンを返さないが、detectAndExecuteTools関数は正しく動作しています');
        console.log('解決策: sendMessageをオーバーライドして強制的にツール使用パターンを注入するか、別のプロンプト方法を試してください');
      } else {
        console.log('結論: detectAndExecuteTools関数にも問題がある可能性があります');
      }
    } else {
      console.log('結論: ツール使用が正常に動作しています！');
    }
  } finally {
    // プロジェクトルートを元に戻す
    currentConfig.projectRoot = origProjectRoot;
    configManager.saveConfig();
  }
}

// テストを実行
runAllTests();