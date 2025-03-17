/**
 * AppGenius API テストスクリプト
 * サーバー500エラーが発生する原因を特定するため
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// APIエンドポイント
const API_BASE_URL = 'https://geniemon-portal-backend-production.up.railway.app/api';

// 認証情報（テスト用）
const TEST_EMAIL = 'lisence@mikoto.co.jp';
const TEST_PASSWORD = 'Mikoto@123';
const CLIENT_ID = 'appgenius_vscode_client_29a7fb3e';
const CLIENT_SECRET = 'appgenius_refresh_token_secret_key_for_production';

// テスト結果ログのパス
const LOG_FILE = path.join(__dirname, 'api-test-result.log');

// ログ書き込み関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

// リクエストを詳細にロギングするaxiosインスタンス
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

// リクエスト・レスポンスインターセプター
apiClient.interceptors.request.use(request => {
  log(`[REQUEST] ${request.method.toUpperCase()} ${request.baseURL}${request.url}`);
  if (request.data) {
    log(`[REQUEST DATA] ${JSON.stringify(request.data, null, 2)}`);
  }
  return request;
});

apiClient.interceptors.response.use(
  response => {
    log(`[RESPONSE] Status: ${response.status} ${response.statusText}`);
    log(`[RESPONSE DATA] ${JSON.stringify(response.data, null, 2).slice(0, 1000)}...`);
    return response;
  },
  error => {
    log(`[ERROR] ${error.message}`);
    if (error.response) {
      log(`[ERROR RESPONSE] Status: ${error.response.status} ${error.response.statusText}`);
      log(`[ERROR DATA] ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return Promise.reject(error);
  }
);

// テストを実行する関数
async function runApiTests() {
  try {
    // ログファイル初期化
    fs.writeFileSync(LOG_FILE, `=== AppGenius API テスト開始: ${new Date().toISOString()} ===\n\n`);
    
    // 認証テスト
    log('\n--- 認証テスト（ログイン） ---');
    let loginResponse;
    try {
      loginResponse = await apiClient.post('/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET
      });
      log('★ ログイン成功');
    } catch (loginError) {
      log(`★ ログイン失敗: ${loginError.message}`);
      throw new Error('ログインに失敗しました。以降のテストはスキップします。');
    }

    // アクセストークンを取得
    const accessToken = loginResponse.data.accessToken;
    
    // ユーザー情報取得テスト（/api/auth/users/me）
    log('\n--- ユーザー情報取得テスト (/auth/users/me) ---');
    try {
      const userInfoResponse = await apiClient.get('/auth/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      log('★ ユーザー情報取得成功');
    } catch (userInfoError) {
      log(`★ ユーザー情報取得失敗: ${userInfoError.message}`);
      
      // エラー詳細のデバッグ
      if (userInfoError.response) {
        log(`エラーステータス: ${userInfoError.response.status}`);
        log(`エラーメッセージ: ${JSON.stringify(userInfoError.response.data)}`);
      }
    }
    
    // 認証コントローラー経由でユーザー情報を取得するテスト
    log('\n--- ユーザー情報取得テスト (代替パス /users/profile) ---');
    try {
      const profileResponse = await apiClient.get('/users/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      log('★ プロフィール取得成功');
    } catch (profileError) {
      log(`★ プロフィール取得失敗: ${profileError.message}`);
    }
    
    // サーバーステータスチェック
    log('\n--- サーバーステータスチェック ---');
    try {
      const healthResponse = await apiClient.get('/auth/health');
      log(`★ サーバーステータス: ${healthResponse.data.status}`);
    } catch (healthError) {
      log(`★ サーバーステータスチェック失敗: ${healthError.message}`);
    }
    
    // MongoDB接続テスト（簡易的なユーザーリスト取得）
    log('\n--- データベース接続テスト ---');
    try {
      const usersResponse = await apiClient.get('/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      log(`★ ユーザー一覧取得成功: ${usersResponse.data.users.length} 件のユーザーデータ`);
    } catch (dbError) {
      log(`★ データベース接続テスト失敗: ${dbError.message}`);
    }
    
    log('\n=== テスト完了 ===');
    log(`詳細ログは ${LOG_FILE} に保存されました`);
  } catch (error) {
    log(`テスト実行中にエラーが発生しました: ${error.message}`);
  }
}

// テスト実行
runApiTests();