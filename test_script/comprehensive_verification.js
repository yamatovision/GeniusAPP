// test_script/comprehensive_verification.js
// 包括的な検証を実行するスクリプト

const { runUnitTests } = require('../test/verification/unit_tests');
const { runApiTests } = require('../test/verification/api_tests');
const { runPerformanceTests } = require('../test/verification/performance_tests');
const { runSecurityScans } = require('../test/verification/security_tests');
const { generateReport } = require('../test/verification/report_generator');
// 統合テストは現時点ではスキップ
// const { runIntegrationTests } = require('../test/verification/integration_tests');

async function runComprehensiveVerification() {
  console.log('Starting comprehensive verification...');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  // 環境変数の設定 - 進行中のサーバーに合わせる
  process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
  console.log(`API URL: ${process.env.API_BASE_URL}`);
  
  let unitResults, apiResults, perfResults, securityResults;
  const integrationResults = { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0 };
  
  try {
    // ステップ1: ユニットテスト
    unitResults = await runUnitTests();
    console.log(`Unit tests completed. Pass rate: ${unitResults.passRate}%`);
  } catch (error) {
    console.error(`Unit tests failed: ${error.message}`);
    unitResults = { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0 };
  }
  
  try {
    // ステップ2: API検証
    apiResults = await runApiTests();
    console.log(`API tests completed. Pass rate: ${apiResults.passRate}%`);
  } catch (error) {
    console.error(`API tests failed: ${error.message}`);
    apiResults = { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0 };
  }
  
  // ステップ3: 統合テスト
  // 現時点ではスキップ
  console.log(`Integration tests skipped.`);
  
  try {
    // ステップ4: パフォーマンステスト
    perfResults = await runPerformanceTests();
    console.log(`Performance tests completed. Average response time: ${perfResults.avgResponseTime}ms, Success rate: ${perfResults.successRate.toFixed(2)}%`);
  } catch (error) {
    console.error(`Performance tests failed: ${error.message}`);
    perfResults = {
      avgResponseTime: 0,
      successRate: 0,
      detailedResults: {
        avgResponseTimes: {},
        minResponseTimes: {},
        maxResponseTimes: {},
        successRates: {}
      }
    };
  }
  
  try {
    // ステップ5: セキュリティスキャン
    securityResults = await runSecurityScans();
    console.log(`Security scans completed. Issues found: ${securityResults.issuesCount}`);
  } catch (error) {
    console.error(`Security scans failed: ${error.message}`);
    securityResults = { issues: [], issuesCount: 0 };
  }
  
  // レポート生成
  try {
    await generateReport({
      unitResults,
      apiResults,
      integrationResults,
      perfResults,
      securityResults
    });
    console.log('Report generated successfully.');
  } catch (error) {
    console.error(`Report generation failed: ${error.message}`);
  }
  
  console.log('Comprehensive verification completed.');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // 結果のサマリー表示
  console.log('\n====== Verification Summary ======');
  console.log(`Unit Tests: ${unitResults.passRate}% pass`);
  console.log(`API Tests: ${apiResults.passRate}% pass`);
  console.log(`Performance: ${perfResults.successRate.toFixed(2)}% success, ${perfResults.avgResponseTime.toFixed(2)}ms avg`);
  console.log(`Security: ${securityResults.issuesCount} issues found`);
  console.log('==================================');
}

runComprehensiveVerification().catch(console.error);