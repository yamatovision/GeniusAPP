/**
 * ClaudeCodeApiClient テスト
 * 
 * このスクリプトはClaudeCodeApiClientがSimpleAuthServiceと正しく連携できることを検証します。
 * 
 * 実行方法:
 * 1. VSCODEで拡張機能を実行
 * 2. コマンドパレットから「AppGenius: Run Test Script」を選択
 * 3. test_claudecode_api_client.jsを入力
 */

// ClaudeCodeApiClient のインスタンスを取得
const apiClient = require('./out/api/claudeCodeApiClient').ClaudeCodeApiClient.getInstance();

// テスト関数
async function runTests() {
  try {
    console.log('===== ClaudeCodeApiClient テスト開始 =====');
    
    // 1. API接続テスト - 認証状態を検証
    console.log('テスト 1: API接続テスト実行中...');
    const testResult = await apiClient.testApiConnection();
    console.log(`API接続テスト結果: ${testResult ? '成功' : '失敗'}`);
    
    // 2. プロンプト一覧取得 - 認証ヘッダーが正しく設定されるか検証
    console.log('テスト 2: プロンプト一覧取得テスト実行中...');
    const prompts = await apiClient.getPrompts();
    console.log(`プロンプト一覧取得: ${Array.isArray(prompts) ? '成功' : '失敗'} (${prompts.length}件取得)`);
    
    // 3. トークン使用量記録 - 認証リフレッシュが正しく機能するか検証
    console.log('テスト 3: トークン使用量記録テスト実行中...');
    const usageResult = await apiClient.recordTokenUsage(100, 'claude-3-sonnet-20240229', 'api_client_test');
    console.log(`トークン使用量記録: ${usageResult ? '成功' : '失敗'}`);
    
    console.log('===== ClaudeCodeApiClient テスト完了 =====');
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// テスト実行
runTests();