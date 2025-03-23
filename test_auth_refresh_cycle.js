/**
 * シンプル認証のトークンリフレッシュサイクルをテスト
 * ログイン -> 認証チェック -> トークンリフレッシュ -> 認証チェック -> ...
 */
const axios = require('axios');

// APIのベースURL
const API_URL = 'http://localhost:5000/api';
const API_SIMPLE_URL = `${API_URL}/simple`;

// テスト用認証情報
const TEST_EMAIL = 'metavicer@gmail.com';
const TEST_PASSWORD = 'Mikoto@123';

// トークン情報
let accessToken = null;
let refreshToken = null;

// カラーログ
const logSuccess = (message) => console.log(`\x1b[32m✅ ${message}\x1b[0m`);
const logError = (message) => console.log(`\x1b[31m❌ ${message}\x1b[0m`);
const logInfo = (message) => console.log(`\x1b[36mℹ️ ${message}\x1b[0m`);
const logWarning = (message) => console.log(`\x1b[33m⚠️ ${message}\x1b[0m`);

/**
 * ログイン
 */
async function login() {
  try {
    logInfo('ログイン実行中...');
    const response = await axios.post(`${API_SIMPLE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (response.data.success) {
      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;
      logSuccess(`ログイン成功! トークン: ${accessToken.substring(0, 15)}...`);
      return true;
    } else {
      logError('ログイン失敗');
      return false;
    }
  } catch (error) {
    logError('ログインエラー:');
    console.error(error.response?.data || error.message);
    return false;
  }
}

/**
 * 認証チェック
 */
async function checkAuth() {
  try {
    logInfo('認証チェック実行中...');
    const response = await axios.get(`${API_SIMPLE_URL}/auth/check`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.data.success) {
      logSuccess('認証チェック成功');
      logInfo(`ユーザー: ${response.data.data.user.name}`);
      return true;
    } else {
      logError('認証チェック失敗');
      return false;
    }
  } catch (error) {
    logError('認証チェックエラー:');
    if (error.response) {
      logError(`ステータスコード: ${error.response.status}`);
      console.error('エラーレスポンス:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * トークンリフレッシュ
 */
async function refreshTokens() {
  try {
    logInfo('トークンリフレッシュ実行中...');
    const response = await axios.post(`${API_SIMPLE_URL}/auth/refresh-token`, {
      refreshToken: refreshToken
    });
    
    if (response.data.success) {
      const oldAccessToken = accessToken;
      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;
      
      logSuccess('トークンリフレッシュ成功');
      if (oldAccessToken === accessToken) {
        logWarning('警告: アクセストークンが更新されていません');
      } else {
        logSuccess('アクセストークンが正常に更新されました');
      }
      
      return true;
    } else {
      logError('トークンリフレッシュ失敗');
      return false;
    }
  } catch (error) {
    logError('トークンリフレッシュエラー:');
    if (error.response) {
      logError(`ステータスコード: ${error.response.status}`);
      console.error('エラーレスポンス:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * 一連のテストを実行
 */
async function runTests() {
  console.log('=========================================');
  console.log('シンプル認証のトークンリフレッシュテスト開始');
  console.log('=========================================');
  
  // ログイン
  if (!await login()) {
    return;
  }
  
  // サイクルテスト（ログイン -> 認証チェック -> リフレッシュ -> 認証チェック -> ...）
  const cycles = 3;
  for (let i = 0; i < cycles; i++) {
    console.log(`\n----- サイクル ${i+1}/${cycles} -----`);
    
    // 認証チェック
    if (!await checkAuth()) {
      logError(`サイクル ${i+1} で認証チェックに失敗しました`);
      break;
    }
    
    // トークンリフレッシュ
    if (!await refreshTokens()) {
      logError(`サイクル ${i+1} でトークンリフレッシュに失敗しました`);
      break;
    }
    
    // 更新されたトークンで認証チェック
    if (!await checkAuth()) {
      logError(`サイクル ${i+1} でリフレッシュ後の認証チェックに失敗しました`);
      break;
    }
    
    logSuccess(`サイクル ${i+1} 完了`);
    
    // 各サイクルの間に短い遅延を設ける
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=========================================');
  console.log('テスト完了');
  console.log('=========================================');
}

// テスト実行
runTests().catch(err => {
  logError('予期しないエラーが発生:');
  console.error(err);
});