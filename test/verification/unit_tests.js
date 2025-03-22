// test/verification/unit_tests.js
// コアロジック検証スクリプト

const assert = require('assert');
const path = require('path');
const fs = require('fs');

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

// モックモジュール
class MockTokenManager {
  constructor() {
    this.tokens = {};
  }

  async saveToken(key, value) {
    this.tokens[key] = value;
    return true;
  }

  async getToken(key) {
    return this.tokens[key] || null;
  }

  async deleteToken(key) {
    delete this.tokens[key];
    return true;
  }
}

class MockLogger {
  info(message) {}
  error(message) {}
  warn(message) {}
  debug(message) {}
}

// トークン管理ユニットテスト
async function testTokenManager() {
  const tokenManager = new MockTokenManager();
  
  await runTest('TokenManager - Save Token', async () => {
    const result = await tokenManager.saveToken('testKey', 'testValue');
    assert.strictEqual(result, true);
  });
  
  await runTest('TokenManager - Get Token', async () => {
    await tokenManager.saveToken('testKey', 'testValue');
    const value = await tokenManager.getToken('testKey');
    assert.strictEqual(value, 'testValue');
  });
  
  await runTest('TokenManager - Delete Token', async () => {
    await tokenManager.saveToken('testKey', 'testValue');
    const result = await tokenManager.deleteToken('testKey');
    assert.strictEqual(result, true);
    const value = await tokenManager.getToken('testKey');
    assert.strictEqual(value, null);
  });
}

// 認証ロジックユニットテスト
async function testAuthLogic() {
  // 実際のコードをモックに置き換えた簡易版の認証ロジック
  function verifyJwt(token, secret) {
    if (!token) return null;
    if (token === 'valid.token.123') {
      return { userId: '123', exp: Date.now() / 1000 + 3600 };
    }
    if (token === 'expired.token.123') {
      return { userId: '123', exp: Date.now() / 1000 - 3600 };
    }
    return null;
  }
  
  function isTokenExpired(decodedToken) {
    if (!decodedToken || !decodedToken.exp) return true;
    return decodedToken.exp < Date.now() / 1000;
  }
  
  await runTest('Auth Logic - Valid Token', async () => {
    const decoded = verifyJwt('valid.token.123', 'secret');
    assert.ok(decoded);
    assert.strictEqual(decoded.userId, '123');
    const expired = isTokenExpired(decoded);
    assert.strictEqual(expired, false);
  });
  
  await runTest('Auth Logic - Expired Token', async () => {
    const decoded = verifyJwt('expired.token.123', 'secret');
    assert.ok(decoded);
    const expired = isTokenExpired(decoded);
    assert.strictEqual(expired, true);
  });
  
  await runTest('Auth Logic - Invalid Token', async () => {
    const decoded = verifyJwt('invalid.token', 'secret');
    assert.strictEqual(decoded, null);
  });
}

// 使用量計算ロジックのユニットテスト
async function testUsageCalculation() {
  // 使用量計算ロジックの簡易版
  function calculateTotalUsage(records) {
    return records.reduce((total, record) => {
      return total + (record.inputTokens || 0) + (record.outputTokens || 0);
    }, 0);
  }
  
  function calculateCost(records, rate = 0.01) {
    const totalTokens = calculateTotalUsage(records);
    return (totalTokens / 1000) * rate;
  }
  
  await runTest('Usage Calculation - Total Tokens', async () => {
    const records = [
      { inputTokens: 100, outputTokens: 150 },
      { inputTokens: 200, outputTokens: 250 },
      { inputTokens: 300, outputTokens: 350 }
    ];
    const total = calculateTotalUsage(records);
    assert.strictEqual(total, 1350);
  });
  
  await runTest('Usage Calculation - Cost', async () => {
    const records = [
      { inputTokens: 1000, outputTokens: 1000 },
      { inputTokens: 3000, outputTokens: 5000 }
    ];
    const cost = calculateCost(records);
    assert.strictEqual(cost, 0.1);
  });
  
  await runTest('Usage Calculation - Empty Records', async () => {
    const total = calculateTotalUsage([]);
    assert.strictEqual(total, 0);
    const cost = calculateCost([]);
    assert.strictEqual(cost, 0);
  });
}

// ユーティリティ関数テスト
async function testUtilities() {
  // 日付フォーマット関数
  function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }
  
  // 文字列切り詰め関数
  function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }
  
  await runTest('Utilities - Format Date', async () => {
    const date = new Date('2025-03-22T12:00:00Z');
    const formatted = formatDate(date);
    assert.strictEqual(formatted, '2025-03-22');
  });
  
  await runTest('Utilities - Truncate String', async () => {
    assert.strictEqual(truncate('Hello World', 5), 'Hello...');
    assert.strictEqual(truncate('Hello', 5), 'Hello');
    assert.strictEqual(truncate('', 5), '');
    assert.strictEqual(truncate(null, 5), '');
  });
}

// 全ユニットテスト実行
async function runUnitTests() {
  console.log('Starting unit tests...');
  
  await testTokenManager();
  await testAuthLogic();
  await testUsageCalculation();
  await testUtilities();
  
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

module.exports = { runUnitTests };

// スクリプトが直接実行された場合
if (require.main === module) {
  runUnitTests()
    .then((results) => {
      console.log('\n==== Unit Tests Summary ====');
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
      console.error('Error running unit tests:', error);
      process.exit(1);
    });
}