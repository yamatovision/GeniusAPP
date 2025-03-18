/**
 * 使用量APIエンドポイントデバッグスクリプト
 * 
 * このスクリプトは、UsageIndicator.tsのコードを模倣し、
 * 様々な条件でエンドポイントをテストします。
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ログイン情報
const email = 'lisence@mikoto.co.jp';
const password = 'Mikoto@123';

// 環境変数とAPIエンドポイント
const ENV = {
  // デフォルトのエンドポイント（UsageIndicator.tsと同じ）
  DEFAULT_API_URL: 'http://localhost:3000/api',
  // 本番環境のエンドポイント
  PROD_API_URL: 'https://geniemon-portal-backend-production.up.railway.app/api',
  // テスト環境
  TEST_API_URL: 'https://geniemon-portal-backend-staging.up.railway.app/api',
  // クライアント認証情報
  CLIENT_ID: 'appgenius_vscode_client_29a7fb3e',
  CLIENT_SECRET: 'appgenius_refresh_token_secret_key_for_production'
};

// ログファイルパス
const LOG_FILE = path.join(__dirname, 'debug_usage_endpoint.log');

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

// アクセストークンを取得
async function getAccessToken() {
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

// 使用量データを取得（UsageIndicator._fetchUsageData()の実装を模倣）
async function fetchUsageData(token, options = {}) {
  const {
    apiUrl = ENV.PROD_API_URL,
    timeout = null,
    retry = false,
    maxRetries = 3,
    retryDelay = 1000,
    logResponse = false
  } = options;
  
  if (!token) {
    logError('アクセストークンがありません');
    return null;
  }
  
  const authHeader = {
    'Authorization': `Bearer ${token}`
  };
  
  log(`使用量データを取得しています... (API URL: ${apiUrl})`);
  
  // リトライロジックなしバージョン（元の実装に近い）
  if (!retry) {
    try {
      const requestConfig = {
        headers: authHeader
      };
      
      if (timeout) {
        requestConfig.timeout = timeout;
      }
      
      const response = await axios.get(`${apiUrl}/proxy/usage/me`, requestConfig);
      
      if (response.status === 200 && response.data) {
        log('使用量データを取得しました');
        if (logResponse) {
          log(`レスポンスデータ: ${JSON.stringify(response.data, null, 2)}`);
        }
        return response.data;
      } else {
        logError('使用量データのレスポンスが無効です', { message: JSON.stringify(response.data) });
        return null;
      }
    } catch (error) {
      logError('使用量データ取得中にエラーが発生しました', error);
      return null;
    }
  } 
  // リトライロジック付きバージョン（改良版）
  else {
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const requestConfig = {
          headers: authHeader
        };
        
        if (timeout) {
          requestConfig.timeout = timeout;
        }
        
        if (retryCount > 0) {
          log(`リトライ ${retryCount}/${maxRetries}...`);
        }
        
        const response = await axios.get(`${apiUrl}/proxy/usage/me`, requestConfig);
        
        if (response.status === 200 && response.data) {
          log(`使用量データを取得しました${retryCount > 0 ? ` (${retryCount}回のリトライ後)` : ''}`);
          if (logResponse) {
            log(`レスポンスデータ: ${JSON.stringify(response.data, null, 2)}`);
          }
          return response.data;
        } else {
          logError('使用量データのレスポンスが無効です', { message: JSON.stringify(response.data) });
          return null;
        }
      } catch (error) {
        retryCount++;
        
        if (retryCount > maxRetries) {
          logError(`最大リトライ回数(${maxRetries})に達しました`, error);
          return null;
        }
        
        // サーバーエラー（500）の場合のみリトライ
        if (axios.isAxiosError(error) && error.response?.status === 500) {
          const waitTime = retryDelay * Math.pow(2, retryCount - 1);
          log(`サーバーエラー(500)が発生しました。${waitTime}ms後にリトライします...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          logError('使用量データ取得中にエラーが発生しました', error);
          return null;
        }
      }
    }
  }
}

// 様々な条件で使用量APIをテスト
async function runTests() {
  // ログファイルの初期化
  fs.writeFileSync(LOG_FILE, `=== 使用量APIエンドポイントデバッグテスト (${new Date().toISOString()}) ===\n\n`);
  
  log('テストを開始します...');
  
  // アクセストークンを取得
  const authInfo = await getAccessToken();
  if (!authInfo) {
    logError('アクセストークンの取得に失敗しました。テストを中止します。');
    return;
  }
  
  const { accessToken } = authInfo;
  
  // テスト1: デフォルト実装（UsageIndicator.tsと同様）
  log('\n==== テスト1: デフォルト実装 ====');
  const test1Result = await fetchUsageData(accessToken, {
    apiUrl: ENV.DEFAULT_API_URL,
    logResponse: true
  });
  
  // テスト2: 本番環境URLを使用
  log('\n==== テスト2: 本番環境URL ====');
  const test2Result = await fetchUsageData(accessToken, {
    apiUrl: ENV.PROD_API_URL,
    logResponse: true
  });
  
  // テスト3: タイムアウト設定あり
  log('\n==== テスト3: タイムアウト設定あり (15秒) ====');
  const test3Result = await fetchUsageData(accessToken, {
    apiUrl: ENV.PROD_API_URL,
    timeout: 15000,
    logResponse: true
  });
  
  // テスト4: リトライロジックあり
  log('\n==== テスト4: リトライロジックあり ====');
  const test4Result = await fetchUsageData(accessToken, {
    apiUrl: ENV.PROD_API_URL,
    timeout: 15000,
    retry: true,
    maxRetries: 3,
    retryDelay: 1000,
    logResponse: true
  });
  
  // テスト5: 無効なURLで失敗させる
  log('\n==== テスト5: 無効なURL (失敗ケース) ====');
  const test5Result = await fetchUsageData(accessToken, {
    apiUrl: 'https://invalid-domain-that-does-not-exist.example.com/api',
    timeout: 5000
  });
  
  // テスト6: 存在しないエンドポイントで失敗させる
  log('\n==== テスト6: 存在しないエンドポイント (失敗ケース) ====');
  const test6Result = await fetchUsageData(accessToken, {
    apiUrl: ENV.PROD_API_URL,
    invalidEndpoint: true,
    timeout: 5000
  });
  
  // 結果サマリー
  log('\n==== テスト結果サマリー ====');
  log(`テスト1 (デフォルト実装): ${test1Result ? '成功' : '失敗'}`);
  log(`テスト2 (本番環境URL): ${test2Result ? '成功' : '失敗'}`);
  log(`テスト3 (タイムアウト設定): ${test3Result ? '成功' : '失敗'}`);
  log(`テスト4 (リトライロジック): ${test4Result ? '成功' : '失敗'}`);
  log(`テスト5 (無効なURL): ${test5Result ? '予期せぬ成功' : '期待通りの失敗'}`);
  log(`テスト6 (存在しないエンドポイント): ${test6Result ? '予期せぬ成功' : '期待通りの失敗'}`);
  
  // 推奨される実装
  log('\n==== 推奨実装 ====');
  if (test4Result) {
    log('推奨: タイムアウト設定とリトライロジックを含む実装（テスト4）が最も信頼性が高いです');
  } else if (test3Result) {
    log('推奨: タイムアウト設定を含む実装（テスト3）が次に信頼性が高いです');
  } else if (test2Result) {
    log('推奨: 本番環境URLを使用する実装（テスト2）が機能しています');
  } else {
    log('注意: すべてのテストが失敗しました。サーバー側に問題がある可能性があります');
  }
  
  log('\nテストが完了しました。詳細はログファイルを確認してください。');
}

// メイン処理
runTests().catch(error => {
  logError('テスト実行中に予期しないエラーが発生しました', error);
});