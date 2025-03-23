/**
 * シンプル認証の/auth/checkエンドポイントを直接テストするスクリプト
 * 401エラーの再現を試みます
 */
const axios = require('axios');

// APIのベースURL
const API_URL = 'http://localhost:5000/api';
const API_SIMPLE_URL = `${API_URL}/simple`;

// テスト用認証情報
const TEST_EMAIL = 'metavicer@gmail.com';
const TEST_PASSWORD = 'Mikoto@123';  // 正しいパスワード

// カラーログ
const logSuccess = (message) => console.log(`\x1b[32m✅ ${message}\x1b[0m`);
const logError = (message) => console.log(`\x1b[31m❌ ${message}\x1b[0m`);
const logInfo = (message) => console.log(`\x1b[36mℹ️ ${message}\x1b[0m`);
const logWarning = (message) => console.log(`\x1b[33m⚠️ ${message}\x1b[0m`);

/**
 * ログインして認証チェックを実行
 */
async function testDirectAuthCheck() {
  let accessToken = null;
  
  // まずログイン
  try {
    logInfo('ログイン実行中...');
    const loginResponse = await axios.post(`${API_SIMPLE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (loginResponse.data.success) {
      accessToken = loginResponse.data.data.accessToken;
      logSuccess(`ログイン成功! トークン: ${accessToken.substring(0, 15)}...`);
      
      // トークンをデコード
      const tokenParts = accessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        logInfo('トークンペイロード:');
        console.log(payload);
      }
    } else {
      logError('ログイン失敗');
      return;
    }
  } catch (error) {
    logError('ログインエラー:');
    console.error(error.response?.data || error.message);
    return;
  }
  
  // 認証チェックを複数回実行
  for (let i = 0; i < 5; i++) {
    try {
      logInfo(`認証チェック実行 (${i+1}/5)...`);
      
      const authCheckResponse = await axios.get(`${API_SIMPLE_URL}/auth/check`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      logSuccess(`認証チェック成功 (${i+1}/5)`);
      logInfo(`ユーザー: ${authCheckResponse.data.data.user.name}`);
    } catch (error) {
      logError(`認証チェックエラー (${i+1}/5):`);
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        logError(`ステータスコード: ${status}`);
        console.error('エラーレスポンス:', data);
        
        if (status === 401) {
          logWarning('401 Unauthorized エラーが発生!');
          break;
        }
      } else {
        console.error(error.message);
      }
    }
    
    // 各リクエストの間に短い遅延を設ける
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// テスト実行
console.log('=========================================');
console.log('シンプル認証の直接テスト開始');
console.log('=========================================');

testDirectAuthCheck().then(() => {
  console.log('=========================================');
  console.log('テスト完了');
  console.log('=========================================');
}).catch(err => {
  logError('予期しないエラーが発生:');
  console.error(err);
});