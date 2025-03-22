// test/verification/performance_tests.js
// パフォーマンステストスクリプト

const axios = require('axios');
const { performance } = require('perf_hooks');

// テスト設定
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  authToken: process.env.AUTH_TOKEN || '',
  numberOfRequests: 50,
  concurrentRequests: 10,
  endpoints: [
    { name: 'User Profile', method: 'get', path: '/api/users/me' },
    { name: 'Organizations List', method: 'get', path: '/api/organizations' },
    { name: 'Workspaces List', method: 'get', path: '/api/workspaces' },
    { name: 'Usage Summary', method: 'get', path: '/api/usage/summary' }
  ]
};

// テスト結果格納用
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  endpoints: [],
  timings: [],
  avgResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  p95ResponseTime: 0,
  successRate: 0
};

// APIリクエストヘルパー
async function apiRequest(method, endpoint, headers = {}) {
  const url = `${config.baseUrl}${endpoint}`;
  const startTime = performance.now();
  let endTime;
  let status;
  
  try {
    const response = await axios({
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000
    });
    endTime = performance.now();
    status = response.status;
    return { 
      success: true, 
      status, 
      time: endTime - startTime 
    };
  } catch (error) {
    endTime = performance.now();
    status = error.response ? error.response.status : 0;
    return { 
      success: false, 
      status, 
      time: endTime - startTime,
      error: error.message
    };
  }
}

// 複数のリクエストを同時実行する
async function runConcurrentRequests(requestFn, count) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(requestFn());
  }
  return Promise.all(promises);
}

// エンドポイントのパフォーマンスを測定
async function testEndpointPerformance(endpoint) {
  console.log(`Testing endpoint: ${endpoint.name} (${endpoint.method.toUpperCase()} ${endpoint.path})`);
  
  const authHeader = { Authorization: `Bearer ${config.authToken}` };
  const requests = [];
  
  // 指定された回数のリクエストをバッチで実行
  for (let i = 0; i < config.numberOfRequests; i += config.concurrentRequests) {
    const batchSize = Math.min(config.concurrentRequests, config.numberOfRequests - i);
    const batchResults = await runConcurrentRequests(
      () => apiRequest(endpoint.method, endpoint.path, authHeader),
      batchSize
    );
    requests.push(...batchResults);
  }
  
  // 結果の集計
  const successfulRequests = requests.filter(r => r.success);
  const responseTimes = requests.map(r => r.time);
  
  // ソートして各種統計を計算
  responseTimes.sort((a, b) => a - b);
  
  const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
  const avgTime = totalTime / responseTimes.length;
  const minTime = responseTimes[0] || 0;
  const maxTime = responseTimes[responseTimes.length - 1] || 0;
  
  // 95パーセンタイルの計算
  const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
  const p95Time = responseTimes[p95Index] || 0;
  
  const successRate = (successfulRequests.length / requests.length) * 100;
  
  return {
    endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
    name: endpoint.name,
    requests: requests.length,
    successful: successfulRequests.length,
    failed: requests.length - successfulRequests.length,
    avgResponseTime: avgTime,
    minResponseTime: minTime,
    maxResponseTime: maxTime,
    p95ResponseTime: p95Time,
    successRate: parseFloat(successRate.toFixed(2))
  };
}

// パフォーマンステストの実行
async function runPerformanceTests() {
  console.log('Starting performance tests...');
  
  // 認証トークンの取得（もしまだ設定されていない場合）
  if (!config.authToken) {
    try {
      const authResponse = await axios.post(`${config.baseUrl}/api/auth/signin`, {
        username: 'test@example.com',
        password: 'password123'
      });
      config.authToken = authResponse.data.accessToken;
    } catch (error) {
      console.error('Failed to get auth token:', error.message);
      throw new Error('Authentication failed. Cannot proceed with performance tests.');
    }
  }
  
  // 各エンドポイントのテスト実行
  const endpointResults = [];
  for (const endpoint of config.endpoints) {
    const result = await testEndpointPerformance(endpoint);
    endpointResults.push(result);
    
    // 全体の統計に追加
    results.timings.push(...Array(result.requests).fill(result.avgResponseTime));
    results.total += result.requests;
    results.passed += result.successful;
    results.failed += result.failed;
  }
  
  // 全体の結果を計算
  results.endpoints = endpointResults;
  
  // 集計された平均レスポンス時間
  const allTimings = results.timings.sort((a, b) => a - b);
  results.avgResponseTime = allTimings.reduce((sum, time) => sum + time, 0) / allTimings.length;
  results.minResponseTime = allTimings[0] || 0;
  results.maxResponseTime = allTimings[allTimings.length - 1] || 0;
  
  // 95パーセンタイル計算
  const p95Index = Math.ceil(allTimings.length * 0.95) - 1;
  results.p95ResponseTime = allTimings[p95Index] || 0;
  
  results.successRate = (results.passed / results.total) * 100;
  
  // 結果の整形
  return {
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    successRate: parseFloat(results.successRate.toFixed(2)),
    avgResponseTime: parseFloat(results.avgResponseTime.toFixed(2)),
    minResponseTime: parseFloat(results.minResponseTime.toFixed(2)),
    maxResponseTime: parseFloat(results.maxResponseTime.toFixed(2)),
    p95ResponseTime: parseFloat(results.p95ResponseTime.toFixed(2)),
    endpoints: results.endpoints.map(e => ({
      ...e,
      avgResponseTime: parseFloat(e.avgResponseTime.toFixed(2)),
      minResponseTime: parseFloat(e.minResponseTime.toFixed(2)),
      maxResponseTime: parseFloat(e.maxResponseTime.toFixed(2)),
      p95ResponseTime: parseFloat(e.p95ResponseTime.toFixed(2))
    }))
  };
}

module.exports = { runPerformanceTests };

// スクリプトが直接実行された場合
if (require.main === module) {
  runPerformanceTests()
    .then((results) => {
      console.log('\n==== Performance Tests Summary ====');
      console.log(`Total Requests: ${results.total}`);
      console.log(`Successful: ${results.passed} (${results.successRate}%)`);
      console.log(`Failed: ${results.failed}`);
      console.log(`Average Response Time: ${results.avgResponseTime}ms`);
      console.log(`Min Response Time: ${results.minResponseTime}ms`);
      console.log(`Max Response Time: ${results.maxResponseTime}ms`);
      console.log(`95th Percentile: ${results.p95ResponseTime}ms`);
      
      console.log('\nEndpoint Results:');
      results.endpoints.forEach((endpoint, index) => {
        console.log(`\n${index + 1}. ${endpoint.name} (${endpoint.endpoint})`);
        console.log(`   Requests: ${endpoint.requests}`);
        console.log(`   Success Rate: ${endpoint.successRate}%`);
        console.log(`   Avg Response Time: ${endpoint.avgResponseTime}ms`);
        console.log(`   Min/Max: ${endpoint.minResponseTime}ms / ${endpoint.maxResponseTime}ms`);
        console.log(`   95th Percentile: ${endpoint.p95ResponseTime}ms`);
      });
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error running performance tests:', error);
      process.exit(1);
    });
}