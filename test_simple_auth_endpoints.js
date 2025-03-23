/**
 * シンプル認証システムのエンドポイントテストスクリプト
 * 
 * 以下のエンドポイントをテストします:
 * - /api/simple/auth/login
 * - /api/simple/auth/register
 * - /api/simple/auth/check
 * - /api/simple/auth/refresh-token
 * - /api/simple/auth/logout
 * - /api/simple/organizations
 */

const axios = require('axios');

// 設定
const API_URL = process.env.API_URL || 'http://127.0.0.1:3000/api';
const SIMPLE_API_URL = `${API_URL}/simple`;

// テスト用ユーザー情報
const TEST_USER = {
  name: 'テストユーザー_' + Date.now(),
  email: `test_${Date.now()}@example.com`,
  password: 'password123'
};

// 保存された認証情報
let authData = {
  accessToken: null,
  refreshToken: null,
  userId: null
};

// ヘルパー関数: APIリクエスト
async function apiRequest(method, endpoint, data = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await axios({
      method,
      url: `${SIMPLE_API_URL}${endpoint}`,
      data,
      headers
    });
    
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      data: error.response?.data || { message: error.message }
    };
  }
}

// ユーザー登録テスト
async function testRegister() {
  console.log('\n=== ユーザー登録テスト ===');
  
  const response = await apiRequest('post', '/auth/register', TEST_USER);
  
  if (response.success) {
    console.log('✅ 登録成功:', response.status);
    console.log('- ユーザー名:', response.data.data.user.name);
    console.log('- メール:', response.data.data.user.email);
    console.log('- ロール:', response.data.data.user.role);
    console.log('- アクセストークン:', response.data.data.accessToken.substring(0, 15) + '...');
    
    // 認証情報を保存
    authData.accessToken = response.data.data.accessToken;
    authData.refreshToken = response.data.data.refreshToken;
    authData.userId = response.data.data.user.id;
    
    return true;
  } else {
    console.log('❌ 登録失敗:', response.status);
    console.log('- エラー:', response.data.message || JSON.stringify(response.data));
    // すでに登録されている可能性があるので、ログインを試みる
    return false;
  }
}

// ログインテスト
async function testLogin() {
  console.log('\n=== ログインテスト ===');
  
  const credentials = {
    email: TEST_USER.email,
    password: TEST_USER.password
  };
  
  const response = await apiRequest('post', '/auth/login', credentials);
  
  if (response.success) {
    console.log('✅ ログイン成功:', response.status);
    console.log('- ユーザー名:', response.data.data.user.name);
    console.log('- メール:', response.data.data.user.email);
    console.log('- ロール:', response.data.data.user.role);
    console.log('- アクセストークン:', response.data.data.accessToken.substring(0, 15) + '...');
    
    // 認証情報を保存
    authData.accessToken = response.data.data.accessToken;
    authData.refreshToken = response.data.data.refreshToken;
    authData.userId = response.data.data.user.id;
    
    return true;
  } else {
    console.log('❌ ログイン失敗:', response.status);
    console.log('- エラー:', response.data.message || JSON.stringify(response.data));
    return false;
  }
}

// 認証チェックテスト
async function testAuthCheck() {
  console.log('\n=== 認証チェックテスト ===');
  
  if (!authData.accessToken) {
    console.log('❌ アクセストークンがありません。ログインが必要です。');
    return false;
  }
  
  const response = await apiRequest('get', '/auth/check', null, authData.accessToken);
  
  if (response.success) {
    console.log('✅ 認証チェック成功:', response.status);
    console.log('- ユーザー名:', response.data.data.user.name);
    console.log('- メール:', response.data.data.user.email);
    console.log('- ロール:', response.data.data.user.role);
    return true;
  } else {
    console.log('❌ 認証チェック失敗:', response.status);
    console.log('- エラー:', response.data.message || JSON.stringify(response.data));
    return false;
  }
}

// トークンリフレッシュテスト
async function testRefreshToken() {
  console.log('\n=== トークンリフレッシュテスト ===');
  
  if (!authData.refreshToken) {
    console.log('❌ リフレッシュトークンがありません。ログインが必要です。');
    return false;
  }
  
  const response = await apiRequest('post', '/auth/refresh-token', {
    refreshToken: authData.refreshToken
  });
  
  if (response.success) {
    console.log('✅ トークンリフレッシュ成功:', response.status);
    console.log('- 新しいアクセストークン:', response.data.data.accessToken.substring(0, 15) + '...');
    
    // 新しいトークンを保存
    authData.accessToken = response.data.data.accessToken;
    authData.refreshToken = response.data.data.refreshToken;
    
    return true;
  } else {
    console.log('❌ トークンリフレッシュ失敗:', response.status);
    console.log('- エラー:', response.data.message || JSON.stringify(response.data));
    return false;
  }
}

// 組織一覧取得テスト
async function testGetOrganizations() {
  console.log('\n=== 組織一覧取得テスト ===');
  
  if (!authData.accessToken) {
    console.log('❌ アクセストークンがありません。ログインが必要です。');
    return false;
  }
  
  const response = await apiRequest('get', '/organizations', null, authData.accessToken);
  
  if (response.success) {
    console.log('✅ 組織一覧取得成功:', response.status);
    console.log('- 組織数:', response.data.data.length);
    
    if (response.data.data.length > 0) {
      console.log('- 最初の組織名:', response.data.data[0].name);
    } else {
      console.log('- 組織が見つかりません');
    }
    
    return true;
  } else {
    console.log('❌ 組織一覧取得失敗:', response.status);
    console.log('- エラー:', response.data.message || JSON.stringify(response.data));
    return false;
  }
}

// ログアウトテスト
async function testLogout() {
  console.log('\n=== ログアウトテスト ===');
  
  if (!authData.refreshToken) {
    console.log('❌ リフレッシュトークンがありません。ログインが必要です。');
    return false;
  }
  
  const response = await apiRequest('post', '/auth/logout', {
    refreshToken: authData.refreshToken
  });
  
  if (response.success) {
    console.log('✅ ログアウト成功:', response.status);
    
    // 認証情報をクリア
    authData = {
      accessToken: null,
      refreshToken: null,
      userId: null
    };
    
    return true;
  } else {
    console.log('❌ ログアウト失敗:', response.status);
    console.log('- エラー:', response.data.message || JSON.stringify(response.data));
    return false;
  }
}

// メインのテスト実行関数
async function runTests() {
  console.log('=== シンプル認証システム エンドポイントテスト ===');
  console.log('API URL:', SIMPLE_API_URL);
  console.log('テストユーザー:', TEST_USER.email);
  
  // ステップ1: 登録 (既に登録済みならログインへ)
  const registerResult = await testRegister();
  
  // 登録に失敗したらログインを試みる
  if (!registerResult) {
    // ステップ2: ログイン
    if (!await testLogin()) {
      console.log('\n❌ テスト中断: ログインできませんでした');
      return;
    }
  }
  
  // ステップ3: 認証チェック
  await testAuthCheck();
  
  // ステップ4: 組織一覧取得
  await testGetOrganizations();
  
  // ステップ5: トークンリフレッシュ
  if (await testRefreshToken()) {
    // リフレッシュ後に認証チェックをもう一度
    await testAuthCheck();
  }
  
  // ステップ6: ログアウト
  await testLogout();
  
  // ログアウト後に認証チェックをもう一度 (失敗するはず)
  const finalCheck = await testAuthCheck();
  if (!finalCheck) {
    console.log('✅ ログアウト後の認証チェックは期待通り失敗しました');
  } else {
    console.log('❌ 異常: ログアウト後も認証が有効です');
  }
  
  console.log('\n=== テスト完了 ===');
}

// テスト実行
runTests().catch(error => {
  console.error('テスト実行中にエラーが発生しました:', error);
});