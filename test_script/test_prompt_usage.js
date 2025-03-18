/**
 * プロンプト使用履歴記録エンドポイントのデバッグテストスクリプト
 * 
 * 500エラーの原因を特定するためのテストスクリプト
 * ClaudeCodeApiClient.recordPromptUsageメソッドの問題を調査
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 環境変数とAPIエンドポイント
const ENV = {
  // 本番環境のエンドポイント
  PROD_API_URL: 'https://geniemon-portal-backend-production.up.railway.app/api',
  // テスト環境
  TEST_API_URL: 'https://geniemon-portal-backend-staging.up.railway.app/api',
  // クライアント認証情報
  CLIENT_ID: 'appgenius_vscode_client_29a7fb3e',
  CLIENT_SECRET: 'appgenius_refresh_token_secret_key_for_production'
};

// ログファイルパス
const LOG_FILE = path.join(__dirname, 'test_prompt_usage.log');

// ログ出力関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// エラーログ出力関数
function logError(message, error) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ERROR: ${message}`;
  
  if (error) {
    logMessage += `\n  Message: ${error.message}`;
    
    if (axios.isAxiosError(error)) {
      // Axiosエラーの詳細情報
      logMessage += `\n  Status: ${error.response?.status || 'N/A'}`;
      logMessage += `\n  Status Text: ${error.response?.statusText || 'N/A'}`;
      logMessage += `\n  URL: ${error.config?.url || 'N/A'}`;
      logMessage += `\n  Method: ${error.config?.method || 'N/A'}`;
      
      if (error.response?.data) {
        logMessage += `\n  Response Data: ${JSON.stringify(error.response.data)}`;
      }
    }
  }
  
  console.error(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// トークンファイルからアクセストークンを読み込む
async function loadAccessToken() {
  try {
    const tokenPath = path.join(__dirname, 'auth_token.txt');
    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath, 'utf8').trim();
      log('認証トークンをファイルから読み込みました');
      return token;
    }
  } catch (error) {
    logError('トークン読み込みエラー', error);
  }
  
  log('\n認証トークンが必要です。以下の手順で取得してください:');
  log('1. VSCodeでAppGeniusを開き、ログインしてください');
  log('2. DevToolsを開き、LocalStorageで"geniemon-auth-token"の値をコピーしてください');
  log('3. コピーしたトークンを test_script/auth_token.txt として保存してください');
  
  return null;
}

// ログイン処理
async function login(email, password) {
  try {
    log('認証APIにログインリクエストを送信しています...');
    
    // 認証APIを呼び出し
    const response = await axios.post(`${ENV.PROD_API_URL}/auth/login`, {
      email,
      password,
      clientId: ENV.CLIENT_ID,
      clientSecret: ENV.CLIENT_SECRET
    }, {
      timeout: 10000
    });
    
    if (response.status === 200 && response.data.accessToken) {
      log('ログイン成功！');
      return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn || 86400,
        user: response.data.user
      };
    } else {
      logError('レスポンスが無効です', { message: JSON.stringify(response.data) });
      return null;
    }
  } catch (error) {
    logError('ログインエラー', error);
    return null;
  }
}

// プロンプト使用履歴を記録（ClaudeCodeApiClient.recordPromptUsageメソッドを模倣）
async function recordPromptUsage(token, promptId, versionId, context, options = {}) {
  const {
    apiUrl = ENV.PROD_API_URL,
    timeout = 15000,
    retry = false,
    maxRetries = 3,
    retryDelay = 1000,
    logResponse = false
  } = options;
  
  if (!token) {
    logError('アクセストークンがありません');
    return false;
  }
  
  const authHeader = {
    'Authorization': `Bearer ${token}`
  };
  
  const payload = {
    promptId,
    versionId,
    context: context || 'test-client'
  };
  
  log(`プロンプト使用履歴を記録しています... (API URL: ${apiUrl})`);
  log(`ペイロード: ${JSON.stringify(payload)}`);
  
  // リトライロジックなしバージョン（元の実装に近い）
  if (!retry) {
    try {
      const requestConfig = {
        headers: authHeader,
        timeout
      };
      
      // log(`リクエスト設定: ${JSON.stringify(requestConfig)}`);
      
      const response = await axios.post(`${apiUrl}/sdk/prompts/usage`, payload, requestConfig);
      
      if (response.status === 201) {
        log('プロンプト使用履歴を記録しました');
        if (logResponse) {
          log(`レスポンスデータ: ${JSON.stringify(response.data, null, 2)}`);
        }
        return true;
      } else {
        logError('プロンプト使用履歴の記録レスポンスが無効です', { 
          message: `ステータス: ${response.status}, データ: ${JSON.stringify(response.data)}` 
        });
        return false;
      }
    } catch (error) {
      logError('プロンプト使用履歴の記録中にエラーが発生しました', error);
      return false;
    }
  } 
  // リトライロジック付きバージョン（改良版）
  else {
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const requestConfig = {
          headers: authHeader,
          timeout
        };
        
        if (retryCount > 0) {
          log(`リトライ ${retryCount}/${maxRetries}...`);
        }
        
        const response = await axios.post(`${apiUrl}/sdk/prompts/usage`, payload, requestConfig);
        
        if (response.status === 201) {
          log(`プロンプト使用履歴を記録しました${retryCount > 0 ? ` (${retryCount}回のリトライ後)` : ''}`);
          if (logResponse) {
            log(`レスポンスデータ: ${JSON.stringify(response.data, null, 2)}`);
          }
          return true;
        } else {
          logError('プロンプト使用履歴の記録レスポンスが無効です', { 
            message: `ステータス: ${response.status}, データ: ${JSON.stringify(response.data)}` 
          });
          return false;
        }
      } catch (error) {
        retryCount++;
        
        if (retryCount > maxRetries) {
          logError(`最大リトライ回数(${maxRetries})に達しました`, error);
          return false;
        }
        
        // エラー種別に応じたリトライ判定
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;
          
          // サーバーエラー（500）またはタイムアウトの場合のみリトライ
          if (statusCode === 500 || error.code === 'ECONNABORTED') {
            const waitTime = retryDelay * Math.pow(2, retryCount - 1);
            log(`サーバーエラー(${statusCode || 'タイムアウト'})が発生しました。${waitTime}ms後にリトライします...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else if (statusCode === 401 || statusCode === 403) {
            // 認証エラーの場合はリトライしない
            logError('認証エラーのためリトライを中止します', error);
            return false;
          }
        }
        
        logError('プロンプト使用履歴の記録中にエラーが発生しました', error);
        return false;
      }
    }
  }
}

// デバッグ探偵プロンプトの単一IDを取得する
async function getDebugDetectivePromptId(token, apiUrl = ENV.PROD_API_URL) {
  try {
    const response = await axios.get(`${apiUrl}/sdk/prompts?tags=detective,debug`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 10000
    });
    
    if (response.status === 200 && Array.isArray(response.data.prompts) && response.data.prompts.length > 0) {
      // デバッグ探偵のプロンプトを探す
      const debugPrompt = response.data.prompts.find(p => 
        p.title.toLowerCase().includes('debug') && p.title.toLowerCase().includes('detective')
      );
      
      if (debugPrompt) {
        log(`デバッグ探偵プロンプトを見つけました: ${debugPrompt.id} (${debugPrompt.title})`);
        return debugPrompt.id;
      }
    }
    
    log('デバッグ探偵プロンプトが見つかりませんでした。デフォルトIDを使用します。');
    return '942ec5f5b316b3fb11e2fd2b597bfb09'; // デフォルトID
  } catch (error) {
    logError('プロンプト検索中にエラーが発生しました', error);
    return '942ec5f5b316b3fb11e2fd2b597bfb09'; // エラー時のデフォルトID
  }
}

// 様々な条件でプロンプト使用履歴記録APIをテスト
async function runTests() {
  // ログファイルの初期化
  fs.writeFileSync(LOG_FILE, `=== プロンプト使用履歴記録APIテスト (${new Date().toISOString()}) ===\n\n`);
  
  log('テストを開始します...');
  
  // アクセストークンを取得
  const token = await loadAccessToken();
  if (!token) {
    logError('アクセストークンの取得に失敗しました。テストを中止します。');
    return;
  }
  
  // デバッグ探偵のプロンプトIDを取得
  const debugDetectivePromptId = await getDebugDetectivePromptId(token);
  
  // テストシナリオを定義
  const testScenarios = [
    {
      name: 'テスト1: 基本実装（本番環境URL）',
      params: {
        promptId: 'test-prompt-id',
        versionId: '1',
        context: 'test-scenario-1',
        options: {
          apiUrl: ENV.PROD_API_URL,
          logResponse: true
        }
      }
    },
    {
      name: 'テスト2: 実際のデバッグ探偵プロンプトID（本番環境URL）',
      params: {
        promptId: debugDetectivePromptId,
        versionId: '1',
        context: 'debug-detective-test',
        options: {
          apiUrl: ENV.PROD_API_URL,
          logResponse: true
        }
      }
    },
    {
      name: 'テスト3: リトライロジックあり（本番環境URL）',
      params: {
        promptId: 'test-prompt-id',
        versionId: '1',
        context: 'test-scenario-3',
        options: {
          apiUrl: ENV.PROD_API_URL,
          retry: true,
          maxRetries: 3,
          retryDelay: 1000,
          logResponse: true
        }
      }
    },
    {
      name: 'テスト4: ステージング環境URL',
      params: {
        promptId: 'test-prompt-id',
        versionId: '1',
        context: 'test-scenario-4',
        options: {
          apiUrl: ENV.TEST_API_URL,
          logResponse: true
        }
      }
    },
    {
      name: 'テスト5: 大きなタイムアウト値（30秒）',
      params: {
        promptId: 'test-prompt-id',
        versionId: '1',
        context: 'test-scenario-5',
        options: {
          apiUrl: ENV.PROD_API_URL,
          timeout: 30000,
          logResponse: true
        }
      }
    }
  ];
  
  // 各テストシナリオを実行
  const results = {};
  
  for (const scenario of testScenarios) {
    log(`\n==== ${scenario.name} ====`);
    const { promptId, versionId, context, options } = scenario.params;
    
    const success = await recordPromptUsage(
      token,
      promptId,
      versionId,
      context,
      options
    );
    
    results[scenario.name] = success;
  }
  
  // 結果サマリー
  log('\n==== テスト結果サマリー ====');
  for (const [name, success] of Object.entries(results)) {
    log(`${name}: ${success ? '成功' : '失敗'}`);
  }
  
  // 推奨される実装
  log('\n==== 推奨実装 ====');
  if (results['テスト3: リトライロジックあり（本番環境URL）']) {
    log('推奨: リトライロジックを含む実装（テスト3）が最も信頼性が高いです');
  } else if (results['テスト5: 大きなタイムアウト値（30秒）']) {
    log('推奨: 大きなタイムアウト値を設定する実装（テスト5）が機能しています');
  } else if (results['テスト4: ステージング環境URL']) {
    log('推奨: ステージング環境を使用する実装（テスト4）が機能しています');
  } else if (results['テスト1: 基本実装（本番環境URL）']) {
    log('推奨: 基本実装（テスト1）が機能しています');
  } else {
    log('注意: すべてのテストが失敗しました。サーバー側に問題がある可能性があります');
    log('推奨: エラーハンドリングを強化し、リトライロジックとフォールバックメカニズムを実装してください');
  }
  
  log('\nテストが完了しました。詳細はログファイルを確認してください。');
}

// メイン処理
runTests().catch(error => {
  logError('テスト実行中に予期しないエラーが発生しました', error);
});