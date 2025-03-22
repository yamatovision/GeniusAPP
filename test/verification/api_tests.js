// test/verification/api_tests.js
// APIエンドポイント検証スクリプト

const axios = require('axios');
const assert = require('assert');

// テスト設定
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  authToken: process.env.AUTH_TOKEN || '',
  timeout: 5000,
};

// テスト結果格納用
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  failedTests: [],
};

// テスト実行ヘルパー
async function runTest(name, testFn) {
  results.total++;
  try {
    console.log(`Running test: ${name}`);
    await testFn();
    results.passed++;
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    results.failed++;
    results.failedTests.push({ name, error: error.message });
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

// APIリクエストヘルパー
async function apiRequest(method, endpoint, data = null, headers = {}) {
  const url = `${config.baseUrl}${endpoint}`;
  const options = {
    method,
    url,
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (data) {
    options.data = data;
  }

  try {
    const response = await axios(options);
    return response;
  } catch (error) {
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

// 認証ヘルパー
async function getAuthToken(username, password) {
  const response = await apiRequest('post', '/api/auth/signin', {
    username,
    password,
  });
  return response.data.accessToken;
}

// テストケース群
async function runApiTests() {
  // 認証系APIテスト
  await runTest('Auth - Login Success', async () => {
    const response = await apiRequest('post', '/api/auth/signin', {
      username: 'test@example.com',
      password: 'password123',
    });
    assert.strictEqual(response.status, 200);
    assert.ok(response.data.accessToken);
  });

  await runTest('Auth - Login Failure', async () => {
    const response = await apiRequest('post', '/api/auth/signin', {
      username: 'test@example.com',
      password: 'wrongpassword',
    });
    assert.strictEqual(response.status, 401);
  });

  // ユーザーAPI
  const authToken = await getAuthToken('test@example.com', 'password123');
  const authHeader = { Authorization: `Bearer ${authToken}` };

  await runTest('User - Get Profile', async () => {
    const response = await apiRequest('get', '/api/users/me', null, authHeader);
    assert.strictEqual(response.status, 200);
    assert.ok(response.data.id);
    assert.ok(response.data.email);
  });

  // 組織API
  await runTest('Organization - List Organizations', async () => {
    const response = await apiRequest('get', '/api/organizations', null, authHeader);
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.data));
  });

  await runTest('Organization - Create Organization', async () => {
    const testOrg = {
      name: `Test Org ${Date.now()}`,
      description: 'Test organization created by API test',
    };
    const response = await apiRequest('post', '/api/organizations', testOrg, authHeader);
    assert.strictEqual(response.status, 201);
    assert.ok(response.data.id);
    assert.strictEqual(response.data.name, testOrg.name);
  });

  // ワークスペースAPI
  await runTest('Workspace - List Workspaces', async () => {
    const response = await apiRequest('get', '/api/workspaces', null, authHeader);
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.data));
  });

  // 使用量API
  await runTest('Usage - Get Usage Data', async () => {
    const response = await apiRequest('get', '/api/usage/summary', null, authHeader);
    assert.strictEqual(response.status, 200);
    assert.ok(response.data.totalTokens !== undefined);
  });

  // Admin API
  await runTest('Admin - Get System Stats', async () => {
    const response = await apiRequest('get', '/api/admin/stats', null, authHeader);
    // 権限がない場合は403が返ってくるはず
    assert.ok(response.status === 200 || response.status === 403);
  });

  // エラーハンドリングテスト
  await runTest('Error Handling - 404 Not Found', async () => {
    const response = await apiRequest('get', '/api/nonexistent', null, authHeader);
    assert.strictEqual(response.status, 404);
  });

  await runTest('Error Handling - Invalid Request', async () => {
    const response = await apiRequest('post', '/api/organizations', {}, authHeader);
    assert.ok(response.status === 400 || response.status === 422);
  });

  // 結果集計
  const passRate = (results.passed / results.total) * 100;
  
  return {
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    skipped: results.skipped,
    failedTests: results.failedTests,
    passRate: parseFloat(passRate.toFixed(2)),
  };
}

module.exports = { runApiTests };

// スクリプトが直接実行された場合
if (require.main === module) {
  runApiTests()
    .then((results) => {
      console.log('\n==== API Tests Summary ====');
      console.log(`Total: ${results.total}`);
      console.log(`Passed: ${results.passed}`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Skipped: ${results.skipped}`);
      console.log(`Pass Rate: ${results.passRate}%`);
      
      if (results.failedTests.length > 0) {
        console.log('\nFailed Tests:');
        results.failedTests.forEach((test, index) => {
          console.log(`${index + 1}. ${test.name}: ${test.error}`);
        });
      }
      
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Error running API tests:', error);
      process.exit(1);
    });
}