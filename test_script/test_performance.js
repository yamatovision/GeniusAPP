// test_script/test_performance.js
// パフォーマンステストを単独で実行するスクリプト

const { runPerformanceTests } = require('../test/verification/performance_tests');

console.log('Starting performance tests only...');

runPerformanceTests()
  .then((results) => {
    console.log('Performance tests completed successfully.');
    console.log(`Overall average response time: ${results.avgResponseTime.toFixed(2)}ms`);
    console.log(`Overall success rate: ${results.successRate.toFixed(2)}%`);
    
    // 正常終了
    process.exit(0);
  })
  .catch((error) => {
    console.error('Performance tests failed:', error);
    
    // 異常終了
    process.exit(1);
  });