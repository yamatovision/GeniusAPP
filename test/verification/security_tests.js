// test/verification/security_tests.js
// セキュリティテストスクリプト

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
  issuesCount: 0,
  issues: [],
};

// テスト実行ヘルパー
async function runTest(name, testFn) {
  results.total++;
  try {
    console.log(`Running security test: ${name}`);
    await testFn();
    results.passed++;
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    results.failed++;
    
    // Issue情報を追加
    const issue = {
      name,
      severity: error.severity || 'medium',
      description: error.message,
      remediation: error.remediation || 'Not specified',
    };
    
    results.issues.push(issue);
    results.issuesCount++;
    
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
    validateStatus: () => true, // すべてのステータスコードを受け入れる
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

// 認証バイパステスト
async function testAuthenticationBypass() {
  await runTest('Auth Bypass - Protected Endpoint Without Token', async () => {
    const response = await apiRequest('get', '/api/users/me');
    assert.strictEqual(response.status, 401, 'Protected endpoint accessible without auth token');
  });
  
  await runTest('Auth Bypass - Invalid Token', async () => {
    const response = await apiRequest('get', '/api/users/me', null, {
      Authorization: 'Bearer invalid.token.here'
    });
    assert.strictEqual(response.status, 401, 'Protected endpoint accessible with invalid token');
  });
}

// SQLインジェクションテスト
async function testSqlInjection() {
  const testPayloads = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "admin' --",
    "1; SELECT * FROM users"
  ];
  
  for (const payload of testPayloads) {
    await runTest(`SQL Injection - Login Endpoint with payload: ${payload.substring(0, 10)}...`, async () => {
      const response = await apiRequest('post', '/api/auth/signin', {
        username: payload,
        password: payload
      });
      
      assert.notStrictEqual(response.status, 500, 'Possible SQL injection vulnerability (server error)');
      assert.notStrictEqual(response.status, 200, 'Possible SQL injection vulnerability (successful login)');
    });
  }
}

// XSSテスト
async function testXssVulnerabilities() {
  const xssPayload = "<script>alert('XSS')</script>";
  
  await runTest('XSS - Organization Name Field', async () => {
    // まず認証を取得
    let authToken = config.authToken;
    if (!authToken) {
      const authResponse = await apiRequest('post', '/api/auth/signin', {
        username: 'test@example.com',
        password: 'password123'
      });
      authToken = authResponse.data.accessToken;
    }
    
    // XSSペイロードを含むOrganizationの作成を試みる
    const response = await apiRequest('post', '/api/organizations', {
      name: xssPayload,
      description: 'XSS test organization'
    }, {
      Authorization: `Bearer ${authToken}`
    });
    
    // 作成に成功した場合はGETでデータを取得
    if (response.status === 201 || response.status === 200) {
      const orgId = response.data.id;
      const getResponse = await apiRequest('get', `/api/organizations/${orgId}`, null, {
        Authorization: `Bearer ${authToken}`
      });
      
      // レスポンスにXSSペイロードが含まれているかチェック
      const orgData = JSON.stringify(getResponse.data);
      assert.ok(!orgData.includes(xssPayload), 'XSS payload not properly sanitized');
    }
  });
}

// JSONインジェクションテスト
async function testJsonInjection() {
  await runTest('JSON Injection - Request Body Tampering', async () => {
    const response = await apiRequest('post', '/api/auth/signin', {
      username: 'test@example.com',
      password: 'password123',
      "__proto__": {
        "admin": true
      }
    });
    
    // レスポンスに管理者権限が含まれていないことを確認
    if (response.status === 200) {
      assert.ok(!response.data.isAdmin, 'Possible prototype pollution vulnerability');
    }
  });
}

// CSRF保護テスト
async function testCsrfProtection() {
  await runTest('CSRF Protection - Token Required', async () => {
    let authToken = config.authToken;
    if (!authToken) {
      const authResponse = await apiRequest('post', '/api/auth/signin', {
        username: 'test@example.com',
        password: 'password123'
      });
      authToken = authResponse.data.accessToken;
    }
    
    // CSRFトークンなしでPOSTリクエストを試みる
    const response = await apiRequest('post', '/api/organizations', {
      name: 'CSRF Test Org',
      description: 'Testing CSRF protection'
    }, {
      Authorization: `Bearer ${authToken}`,
      // CSRFトークンを意図的に省略
    });
    
    // APIがCSRFトークンを要求するかどうかを検証
    // ただし、RESTful APIによってはCSRFトークンが必要ないこともある
    // この場合は具体的な実装に応じてテストを調整する必要がある
    if (response.status === 403) {
      // CSRFトークンが必要な場合
      assert.ok(response.data.message && response.data.message.includes('CSRF'), 'CSRF protection might be missing');
    }
  });
}

// レート制限テスト
async function testRateLimiting() {
  await runTest('Rate Limiting - Rapid Requests', async () => {
    const requests = [];
    // 短時間に多数のリクエストを送信
    for (let i = 0; i < 30; i++) {
      requests.push(apiRequest('post', '/api/auth/signin', {
        username: 'test@example.com',
        password: 'wrong-password'
      }));
    }
    
    const responses = await Promise.all(requests);
    
    // レート制限が適用されたレスポンスがあるか確認
    const rateLimited = responses.some(r => r.status === 429);
    
    // レート制限が有効かどうかをチェック
    if (!rateLimited) {
      const error = new Error('Rate limiting may not be properly implemented');
      error.severity = 'medium';
      error.remediation = 'Implement rate limiting for authentication endpoints to prevent brute force attacks';
      throw error;
    }
  });
}

// 全セキュリティテスト実行
async function runSecurityScans() {
  console.log('Starting security scans...');
  
  await testAuthenticationBypass();
  await testSqlInjection();
  await testXssVulnerabilities();
  await testJsonInjection();
  await testCsrfProtection();
  await testRateLimiting();
  
  // 結果集計
  const passRate = (results.passed / results.total) * 100;
  
  return {
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    skipped: results.skipped,
    issuesCount: results.issuesCount,
    issues: results.issues,
    passRate: parseFloat(passRate.toFixed(2)),
  };
}

module.exports = { runSecurityScans };

// スクリプトが直接実行された場合
if (require.main === module) {
  runSecurityScans()
    .then((results) => {
      console.log('\n==== Security Tests Summary ====');
      console.log(`Total: ${results.total}`);
      console.log(`Passed: ${results.passed}`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Skipped: ${results.skipped}`);
      console.log(`Pass Rate: ${results.passRate}%`);
      console.log(`Security Issues Found: ${results.issuesCount}`);
      
      if (results.issues.length > 0) {
        console.log('\nSecurity Issues:');
        results.issues.forEach((issue, index) => {
          console.log(`\n${index + 1}. ${issue.name} (Severity: ${issue.severity})`);
          console.log(`   Description: ${issue.description}`);
          console.log(`   Remediation: ${issue.remediation}`);
        });
      }
      
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Error running security tests:', error);
      process.exit(1);
    });
}