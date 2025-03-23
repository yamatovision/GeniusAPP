/**
 * シンプル認証エンドポイントのテストスクリプト
 * 認証の流れ（ログイン→トークン検証→リフレッシュ→ログアウト）を検証します
 */
const axios = require('axios');

// APIのベースURL
const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const API_SIMPLE_URL = `${API_URL}/simple`;

// テスト用認証情報
const TEST_EMAIL = 'metavicer2@gmail.com';
const TEST_PASSWORD = 'Mikoto@123';  // 正しいパスワード

// 保存用変数
let accessToken = null;
let refreshToken = null;
let userId = null;

// 色付きログ出力関数
const logSuccess = (message) => console.log(`\x1b[32m✅ ${message}\x1b[0m`);
const logError = (message) => console.log(`\x1b[31m❌ ${message}\x1b[0m`);
const logInfo = (message) => console.log(`\x1b[36mℹ️ ${message}\x1b[0m`);
const logWarning = (message) => console.log(`\x1b[33m⚠️ ${message}\x1b[0m`);

/**
 * ログインテスト
 */
async function testLogin() {
  logInfo('ログインテスト開始...');
  
  try {
    const response = await axios.post(`${API_SIMPLE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200 && response.data.success) {
      logSuccess('ログイン成功');
      
      // トークンとユーザー情報を保存
      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;
      userId = response.data.data.user.id;
      
      logInfo(`AccessToken: ${accessToken.substring(0, 15)}...`);
      logInfo(`RefreshToken: ${refreshToken.substring(0, 15)}...`);
      logInfo(`User ID: ${userId}`);
      logInfo(`User Name: ${response.data.data.user.name}`);
      logInfo(`User Role: ${response.data.data.user.role}`);
      
      // トークンをデコード
      const tokenParts = accessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        logInfo('トークンペイロード:');
        console.log(payload);
      }
      
      return true;
    } else {
      logError(`ログイン失敗: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logError('ログインエラー:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * 認証チェックテスト
 */
async function testAuthCheck() {
  logInfo('認証チェックテスト開始...');
  
  if (!accessToken) {
    logError('アクセストークンがありません。ログインを先に実行してください。');
    return false;
  }
  
  try {
    const response = await axios.get(`${API_SIMPLE_URL}/auth/check`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 200 && response.data.success) {
      logSuccess('認証チェック成功');
      logInfo(`User ID: ${response.data.data.user.id}`);
      logInfo(`User Name: ${response.data.data.user.name}`);
      return true;
    } else {
      logError(`認証チェック失敗: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logError('認証チェックエラー:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * トークンリフレッシュテスト
 */
async function testTokenRefresh() {
  logInfo('トークンリフレッシュテスト開始...');
  
  if (!refreshToken) {
    logError('リフレッシュトークンがありません。ログインを先に実行してください。');
    return false;
  }
  
  try {
    const response = await axios.post(`${API_SIMPLE_URL}/auth/refresh-token`, {
      refreshToken: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200 && response.data.success) {
      logSuccess('トークンリフレッシュ成功');
      
      // 新しいトークンを保存
      const oldAccessToken = accessToken;
      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken;
      
      logInfo(`新AccessToken: ${accessToken.substring(0, 15)}...`);
      logInfo(`新RefreshToken: ${refreshToken.substring(0, 15)}...`);
      
      // トークンの詳細比較
      logInfo(`古いトークン(最初の20文字): ${oldAccessToken.substring(0, 20)}`);
      logInfo(`新しいトークン(最初の20文字): ${accessToken.substring(0, 20)}`);
      
      // トークンが変更されたことを確認
      if (oldAccessToken === accessToken) {
        logWarning('警告: アクセストークンが更新されていません');
      } else {
        logSuccess('アクセストークンが正常に更新されました');
      }
      
      // トークンデコード
      const tokenParts = accessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        logInfo('新トークンペイロード:');
        console.log(payload);
      }
      
      return true;
    } else {
      logError(`トークンリフレッシュ失敗: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logError('トークンリフレッシュエラー:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * ログアウトテスト
 */
async function testLogout() {
  logInfo('ログアウトテスト開始...');
  
  if (!refreshToken) {
    logError('リフレッシュトークンがありません。ログインを先に実行してください。');
    return false;
  }
  
  try {
    const response = await axios.post(`${API_SIMPLE_URL}/auth/logout`, {
      refreshToken: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 200 && response.data.success) {
      logSuccess('ログアウト成功');
      
      // トークンをクリア
      accessToken = null;
      refreshToken = null;
      
      return true;
    } else {
      logError(`ログアウト失敗: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    logError('ログアウトエラー:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * 不正トークンテスト（意図的に不正なトークンを使用）
 */
async function testInvalidToken() {
  logInfo('不正トークンテスト開始...');
  
  // 意図的に不正なトークンを作成
  const invalidToken = accessToken ? 
    accessToken.slice(0, -5) + 'XXXXX' : 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1IiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature';
  
  try {
    const response = await axios.get(`${API_SIMPLE_URL}/auth/check`, {
      headers: {
        'Authorization': `Bearer ${invalidToken}`
      }
    });
    
    // ここには到達しないはず（エラーが発生するべき）
    logError('テスト失敗: 不正なトークンが受け入れられました');
    console.log(response.data);
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logSuccess('テスト成功: 不正なトークンが適切に拒否されました');
      logInfo(`エラーメッセージ: ${error.response.data.message}`);
      return true;
    } else {
      logError('予期しないエラー:');
      console.error(error.message);
      return false;
    }
  }
}

/**
 * 全テストを実行
 */
async function runAllTests() {
  console.log('=========================================');
  console.log('シンプル認証エンドポイントテスト開始');
  console.log('=========================================');
  
  // サーバー稼働確認
  try {
    await axios.get(`${API_URL}`);
    logInfo(`APIサーバーに接続: ${API_URL}`);
  } catch (error) {
    logWarning(`APIサーバーに接続できません: ${API_URL}`);
    logInfo('サーバーが稼働しているか確認してください。');
    return;
  }
  
  // テスト実行
  let loginSuccess = await testLogin();
  let testResults = [loginSuccess];
  
  if (loginSuccess) {
    // ログイン成功時のみ他のテストを実行
    testResults.push(await testAuthCheck());
    testResults.push(await testInvalidToken());
    testResults.push(await testTokenRefresh());
    
    // リフレッシュ後の認証チェック
    if (testResults[3]) { // トークンリフレッシュ成功の場合
      testResults.push(await testAuthCheck());
    }
    
    testResults.push(await testLogout());
    
    // ログアウト後の認証チェック（失敗するべき）
    try {
      const response = await axios.get(`${API_SIMPLE_URL}/auth/check`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      logError('テスト失敗: ログアウト後もトークンが有効です');
      testResults.push(false);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logSuccess('テスト成功: ログアウト後のトークンが適切に拒否されました');
        testResults.push(true);
      } else {
        logError('予期しないエラー:');
        console.error(error.message);
        testResults.push(false);
      }
    }
  }
  
  // テスト結果サマリー
  console.log('\n=========================================');
  console.log('テスト結果サマリー');
  console.log('=========================================');
  
  const testNames = [
    'ログインテスト',
    'トークン検証テスト',
    '不正トークンテスト',
    'トークンリフレッシュテスト',
    'リフレッシュ後の認証テスト',
    'ログアウトテスト',
    'ログアウト後の認証テスト'
  ];
  
  let passCount = 0;
  testResults.forEach((result, index) => {
    if (index < testNames.length) {
      if (result) {
        logSuccess(`${testNames[index]}: 成功`);
        passCount++;
      } else {
        logError(`${testNames[index]}: 失敗`);
      }
    }
  });
  
  console.log('----------------------------------------');
  console.log(`総合結果: ${testResults.length}テスト中${passCount}個成功`);
  
  if (passCount === testResults.length) {
    logSuccess('すべてのテストに合格しました！');
  } else {
    logError(`${testResults.length - passCount}個のテストが失敗しました`);
  }
}

// テスト実行
runAllTests().catch(err => {
  logError('テスト実行中に予期しないエラーが発生しました:');
  console.error(err);
});