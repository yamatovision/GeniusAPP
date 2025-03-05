/**
 * Claude API 接続テスト
 * 
 * このテストスクリプトはClaude APIの接続を検証し、エラーの詳細を取得します。
 * API接続の問題を診断するための補助ツールです。
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 設定ファイルのパス
const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.appgenius', 'config.json');

// Claude APIのベースURL
const CLAUDE_API_BASE_URL = 'https://api.anthropic.com/v1/messages';

// モデルの定義
const MODELS = {
  'CLAUDE_3_OPUS': 'claude-3-opus-20240229',
  'CLAUDE_3_SONNET': 'claude-3-sonnet-20240229',
  'CLAUDE_3_HAIKU': 'claude-3-haiku-20240307',
  'CLAUDE_3_SONNET_20250219': 'claude-3-7-sonnet-20250219', // Claude 3.7
  'CLAUDE_3_SONNET_20240229': 'claude-3-sonnet-20240229',   // 標準Claude 3 Sonnet
};

// API設定パターン
const API_CONFIGS = [
  {
    name: 'Current implementation',
    apiVersion: '2023-06-01',
    betaTag: null,
    authHeader: 'x-api-key',
    maxTokens: 32000
  },
  {
    name: 'Updated implementation #1',
    apiVersion: '2023-06-01',
    betaTag: null,
    authHeader: 'x-api-key',
    maxTokens: 4096
  },
  {
    name: 'Updated implementation #2',
    apiVersion: '2023-06-01', 
    betaTag: null,
    authHeader: 'x-api-key',
    maxTokens: 16000
  },
  {
    name: 'Latest implementation',
    apiVersion: '2023-06-01',
    betaTag: null,
    authHeader: 'x-api-key',
    maxTokens: 100000
  }
];

// ロギング関数
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  
  switch (type) {
    case 'error':
      console.error(`[${timestamp}] [ERROR] ${message}`);
      break;
    case 'warn':
      console.warn(`[${timestamp}] [WARN] ${message}`);
      break;
    case 'debug':
      console.log(`[${timestamp}] [DEBUG] ${message}`);
      break;
    default:
      console.log(`[${timestamp}] [INFO] ${message}`);
  }
}

// 設定ファイルを読み込む
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    } else {
      log(`設定ファイルが見つかりません: ${CONFIG_PATH}`, 'error');
      return null;
    }
  } catch (error) {
    log(`設定ファイルの読み込みエラー: ${error.message}`, 'error');
    return null;
  }
}

// APIリクエストを送信
async function sendApiRequest(apiKey, model, config) {
  const systemPrompt = "あなたは簡潔なアシスタントです。";
  const userMessage = "こんにちは";
  
  const requestBody = {
    model: model,
    messages: [
      { role: 'user', content: userMessage }
    ],
    max_tokens: config.maxTokens || 1024,
    temperature: 0.7,
    system: systemPrompt,
    stream: false
  };
  
  // ヘッダーの設定
  const headers = {
    [config.authHeader]: apiKey,
    'anthropic-version': config.apiVersion,
    'content-type': 'application/json',
    'Accept': 'application/json'
  };
  
  // ベータタグがある場合は追加
  if (config.betaTag) {
    headers['anthropic-beta'] = config.betaTag;
  }
  
  try {
    log(`${config.name} - APIリクエスト送信 (${model})`);
    
    // 詳細なリクエスト内容をログに出力
    log(`リクエストヘッダー: ${JSON.stringify(headers, null, 2)}`, 'debug');
    log(`リクエストボディ: ${JSON.stringify(requestBody, null, 2)}`, 'debug');
    
    const response = await axios.post(CLAUDE_API_BASE_URL, requestBody, { headers });
    
    log(`${config.name} - APIリクエスト成功`);
    log(`応答: ${JSON.stringify(response.data, null, 2)}`, 'debug');
    
    return {
      success: true,
      data: response.data,
      status: response.status,
      headers: response.headers
    };
  } catch (error) {
    log(`${config.name} - APIリクエストエラー: ${error.message}`, 'error');
    
    // エラーの詳細情報を取得
    const errorDetails = {
      success: false,
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      } : null,
      request: error.request ? { method: 'POST', url: CLAUDE_API_BASE_URL } : null
    };
    
    log(`エラー詳細: ${JSON.stringify(errorDetails, null, 2)}`, 'error');
    
    return errorDetails;
  }
}

// ユーザー入力取得用のインターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// メイン処理
async function main() {
  try {
    log('Claude API接続テストを開始します');
    
    // 設定を読み込む
    const config = loadConfig();
    if (!config || !config.apiKey) {
      log('APIキーが設定されていません。設定ファイルを確認してください。', 'error');
      return;
    }
    
    log('API設定のロード完了');
    
    // テスト設定の選択
    console.log('\n===== テスト対象モデルの選択 =====');
    Object.entries(MODELS).forEach(([key, value], index) => {
      console.log(`${index + 1}. ${key} (${value})`);
    });
    
    const modelIndexPromise = new Promise(resolve => {
      rl.question('\nテストするモデルの番号を選択してください (1-5): ', answer => {
        const modelIndex = parseInt(answer) - 1;
        if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= Object.keys(MODELS).length) {
          log('無効な選択です。デフォルトのClaude 3.7を使用します。', 'warn');
          resolve(4); // Claude 3.7 のインデックス
        } else {
          resolve(modelIndex);
        }
      });
    });
    
    const modelIndex = await modelIndexPromise;
    const selectedModelKey = Object.keys(MODELS)[modelIndex];
    const selectedModel = MODELS[selectedModelKey];
    
    log(`選択されたモデル: ${selectedModelKey} (${selectedModel})`);
    
    // 各API設定でテスト実行
    log('\n===== API設定パターンごとにテスト実行 =====');
    
    const results = [];
    
    for (const apiConfig of API_CONFIGS) {
      log(`\n--- ${apiConfig.name} ---`);
      log(`API Version: ${apiConfig.apiVersion}`);
      log(`Beta Tag: ${apiConfig.betaTag || '未使用'}`);
      log(`Auth Header: ${apiConfig.authHeader}`);
      
      const result = await sendApiRequest(config.apiKey, selectedModel, apiConfig);
      results.push({
        configName: apiConfig.name,
        result
      });
    }
    
    // 結果のサマリーを表示
    log('\n===== テスト結果サマリー =====');
    
    results.forEach(({configName, result}) => {
      if (result.success) {
        log(`✅ ${configName}: 成功 (Status: ${result.status})`);
      } else {
        log(`❌ ${configName}: 失敗 (${result.response ? `Status: ${result.response.status}` : 'No Response'})`);
      }
    });
    
    // 推奨設定
    const successfulConfigs = results.filter(r => r.result.success);
    if (successfulConfigs.length > 0) {
      log('\n⭐ 推奨API設定:', 'info');
      const recommendedConfig = successfulConfigs[0];
      log(`設定名: ${recommendedConfig.configName}`);
      log(`API Version: ${API_CONFIGS.find(c => c.name === recommendedConfig.configName).apiVersion}`);
      log(`Beta Tag: ${API_CONFIGS.find(c => c.name === recommendedConfig.configName).betaTag || '未使用'}`);
      log(`Auth Header: ${API_CONFIGS.find(c => c.name === recommendedConfig.configName).authHeader}`);
    } else {
      log('\n⚠️ 成功した設定がありません。APIキーやアクセス権限を確認してください。', 'warn');
    }
    
    // 詳細なエラー分析
    const failedResults = results.filter(r => !r.result.success);
    if (failedResults.length > 0) {
      log('\n===== エラー詳細分析 =====');
      
      failedResults.forEach(({configName, result}) => {
        log(`\n--- ${configName} ---`, 'error');
        
        if (result.response) {
          log(`Status: ${result.response.status} ${result.response.statusText}`, 'error');
          
          if (result.response.data) {
            log(`エラーメッセージ: ${JSON.stringify(result.response.data, null, 2)}`, 'error');
            
            // 一般的なエラーパターンの分析
            if (result.response.status === 400) {
              if (result.response.data.error?.type === 'invalid_request_error') {
                log('解析: リクエスト形式が無効です。モデル名やパラメータ形式を確認してください。', 'error');
              }
            } else if (result.response.status === 401) {
              log('解析: 認証エラーです。APIキーが無効または期限切れの可能性があります。', 'error');
            } else if (result.response.status === 403) {
              log('解析: アクセス権限エラーです。このモデルへのアクセス権がない可能性があります。', 'error');
            } else if (result.response.status === 404) {
              log('解析: リソースが見つかりません。APIエンドポイントやモデル名を確認してください。', 'error');
            } else if (result.response.status === 429) {
              log('解析: レート制限に達しました。しばらく待ってから再試行してください。', 'error');
            } else if (result.response.status >= 500) {
              log('解析: サーバーエラーです。Anthropic側の問題の可能性があります。', 'error');
            }
          }
        } else {
          log(`エラーメッセージ: ${result.message}`, 'error');
          log('解析: ネットワークエラーまたはタイムアウトの可能性があります。', 'error');
        }
      });
    }
    
    // 修正提案
    log('\n===== 推奨修正案 =====');
    
    const successConfig = results.find(r => r.result.success);
    if (successConfig) {
      const config = API_CONFIGS.find(c => c.name === successConfig.configName);
      log('✅ 以下の設定で正常に動作することを確認しました:');
      log(`- anthropic-version: "${config.apiVersion}"`);
      if (config.betaTag) {
        log(`- anthropic-beta: "${config.betaTag}"`);
      } else {
        log(`- anthropic-beta ヘッダーは不要`);
      }
      log(`- 認証ヘッダー: "${config.authHeader}"`);
    } else {
      // すべての設定で失敗した場合の推奨
      log('⚠️ すべての設定パターンで失敗しました。以下を確認してください:');
      log('1. APIキーが正しいか確認してください');
      log('2. 選択したモデルへのアクセス権があるか確認してください');
      log('3. Claude 3.7モデルの正確な名前を確認してください（最新のドキュメントを参照）');
      log('4. ネットワーク接続に問題がないか確認してください');
      log('5. Anthropic APIのステータスページを確認してください');
    }
    
  } catch (error) {
    log(`テスト実行中にエラーが発生しました: ${error.message}`, 'error');
    log(error.stack, 'debug');
  } finally {
    rl.close();
  }
}

// スクリプト実行
main().catch(error => {
  log(`予期しないエラー: ${error.message}`, 'error');
  log(error.stack, 'debug');
  process.exit(1);
});