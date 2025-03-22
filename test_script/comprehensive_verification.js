// test_script/comprehensive_verification.js
// 包括的な検証を実行するスクリプト

const { runUnitTests } = require('./unit_tests');
const { runApiTests } = require('./api_tests');
const { runIntegrationTests } = require('./integration_tests');
const { runPerformanceTests } = require('./performance_tests');
const { runSecurityScans } = require('./security_tests');
const { generateReport } = require('./report_generator');

async function runComprehensiveVerification() {
  console.log('Starting comprehensive verification...');
  
  // ステップ1: ユニットテスト
  const unitResults = await runUnitTests();
  console.log(`Unit tests completed. Pass rate: ${unitResults.passRate}%`);
  
  // ステップ2: API検証
  const apiResults = await runApiTests();
  console.log(`API tests completed. Pass rate: ${apiResults.passRate}%`);
  
  // ステップ3: 統合テスト
  const integrationResults = await runIntegrationTests();
  console.log(`Integration tests completed. Pass rate: ${integrationResults.passRate}%`);
  
  // ステップ4: パフォーマンステスト
  const perfResults = await runPerformanceTests();
  console.log(`Performance tests completed. Average response time: ${perfResults.avgResponseTime}ms`);
  
  // ステップ5: セキュリティスキャン
  const securityResults = await runSecurityScans();
  console.log(`Security scans completed. Issues found: ${securityResults.issuesCount}`);
  
  // レポート生成
  await generateReport({
    unitResults,
    apiResults,
    integrationResults,
    perfResults,
    securityResults
  });
  
  console.log('Comprehensive verification completed. See report for details.');
}

runComprehensiveVerification().catch(console.error);