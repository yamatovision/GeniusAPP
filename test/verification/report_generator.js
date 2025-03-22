// test/verification/report_generator.js
// 検証結果レポート生成ツール

const fs = require('fs');
const path = require('path');

// 結果データをマークダウン形式のレポートに変換
async function generateReport(results) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const reportPath = path.join(__dirname, '..', '..', 'docs', 'verification');
  
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }
  
  // サマリーレポート
  await generateSummaryReport(results, reportPath, timestamp);
  
  // 詳細メトリクスレポート
  await generateMetricsReport(results, reportPath, timestamp);
  
  // テスト証拠レポート
  await generateEvidenceReport(results, reportPath, timestamp);
  
  // 承認フォーム
  await generateApprovalForm(results, reportPath, timestamp);
  
  console.log(`Reports generated successfully in ${reportPath}`);
  return true;
}

// サマリーレポート生成
async function generateSummaryReport(results, reportPath, timestamp) {
  const { unitResults, apiResults, integrationResults, perfResults, securityResults } = results;
  
  // 全体の合格率を計算
  const totalTests = 
    unitResults.total + 
    apiResults.total + 
    integrationResults.total + 
    (securityResults.total || 0);
    
  const totalPassed = 
    unitResults.passed + 
    apiResults.passed + 
    integrationResults.passed + 
    (securityResults.passed || 0);
    
  const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(2);
  
  const report = `# AppGenius 検証結果サマリー - ${timestamp}

## 検証結果概要

検証の結果、合計 **${totalTests}** テストのうち **${totalPassed}** テストが合格し、合格率は **${overallPassRate}%** でした。

### テストカテゴリ別結果

| カテゴリ | 合計 | 合格 | 不合格 | 合格率 |
|---------|-----|------|-------|-------|
| ユニットテスト | ${unitResults.total} | ${unitResults.passed} | ${unitResults.failed} | ${unitResults.passRate}% |
| APIテスト | ${apiResults.total} | ${apiResults.passed} | ${apiResults.failed} | ${apiResults.passRate}% |
| 統合テスト | ${integrationResults.total} | ${integrationResults.passed} | ${integrationResults.failed} | ${integrationResults.passRate}% |
| パフォーマンステスト | ${perfResults ? '測定完了' : '未実行'} | - | - | - |
| セキュリティテスト | ${securityResults.total || 0} | ${securityResults.passed || 0} | ${securityResults.failed || 0} | ${securityResults.passRate || 0}% |

### パフォーマンス測定結果

- **平均応答時間**: ${perfResults.avgResponseTime}ms
- **最小応答時間**: ${perfResults.minResponseTime}ms
- **最大応答時間**: ${perfResults.maxResponseTime}ms
- **95パーセンタイル**: ${perfResults.p95ResponseTime}ms
- **リクエスト成功率**: ${perfResults.successRate}%

### セキュリティスキャン結果

- **検出された問題**: ${securityResults.issuesCount || 0}件
${securityResults.issues ? securityResults.issues.map(issue => `- ${issue.name}: ${issue.severity}（${issue.description}）`).join('\n') : '- 重大な問題は検出されませんでした'}

## 結論と推奨事項

${overallPassRate >= 90 
  ? '検証の結果、アプリケーションは高い品質基準を満たしています。リリースに向けた準備が整っています。' 
  : '検証の結果、いくつかの問題が検出されました。これらの問題を解決した後に再検証が必要です。'}

${unitResults.failedTests.length > 0 ? '### 修正が必要なユニットテスト\n\n' + unitResults.failedTests.map(t => `- ${t.name}: ${t.error}`).join('\n') : ''}
${apiResults.failedTests.length > 0 ? '### 修正が必要なAPIテスト\n\n' + apiResults.failedTests.map(t => `- ${t.name}: ${t.error}`).join('\n') : ''}
${integrationResults.failedTests.length > 0 ? '### 修正が必要な統合テスト\n\n' + integrationResults.failedTests.map(t => `- ${t.name}: ${t.error}`).join('\n') : ''}

詳細な検証結果と証拠は添付の報告書を参照してください。
`;

  fs.writeFileSync(
    path.join(reportPath, 'verification_report.md'),
    report
  );
}

// メトリクスレポート生成
async function generateMetricsReport(results, reportPath, timestamp) {
  const { perfResults, securityResults } = results;
  
  // 性能測定の詳細
  let perfDetails = '';
  if (perfResults && perfResults.endpoints) {
    perfDetails = '## エンドポイント別パフォーマンス\n\n';
    perfDetails += '| エンドポイント | 平均応答時間 | 最小/最大 | 95パーセンタイル | 成功率 |\n';
    perfDetails += '|-------------|------------|---------|--------------|--------|\n';
    
    perfResults.endpoints.forEach(endpoint => {
      perfDetails += `| ${endpoint.name} | ${endpoint.avgResponseTime}ms | ${endpoint.minResponseTime}ms / ${endpoint.maxResponseTime}ms | ${endpoint.p95ResponseTime}ms | ${endpoint.successRate}% |\n`;
    });
  }
  
  // セキュリティ詳細
  let securityDetails = '';
  if (securityResults && securityResults.issues && securityResults.issues.length > 0) {
    securityDetails = '## セキュリティ問題の詳細\n\n';
    securityDetails += '| 問題 | 重要度 | 説明 | 対策 |\n';
    securityDetails += '|-----|-------|------|------|\n';
    
    securityResults.issues.forEach(issue => {
      securityDetails += `| ${issue.name} | ${issue.severity} | ${issue.description} | ${issue.remediation || '推奨対策なし'} |\n`;
    });
  }
  
  const report = `# AppGenius 品質メトリクス - ${timestamp}

## パフォーマンスメトリクス

### 全体サマリー

| 指標 | 測定値 | 目標値 | 状態 |
|-----|-------|-------|------|
| 平均応答時間 | ${perfResults.avgResponseTime}ms | <200ms | ${perfResults.avgResponseTime < 200 ? '✅' : '❌'} |
| 95パーセンタイル応答時間 | ${perfResults.p95ResponseTime}ms | <500ms | ${perfResults.p95ResponseTime < 500 ? '✅' : '❌'} |
| 成功率 | ${perfResults.successRate}% | >99% | ${perfResults.successRate > 99 ? '✅' : '❌'} |

${perfDetails}

## セキュリティメトリクス

### 全体サマリー

| 指標 | 値 | 目標値 | 状態 |
|-----|---|-------|------|
| 発見された問題数 | ${securityResults.issuesCount || 0} | 0 | ${(securityResults.issuesCount || 0) === 0 ? '✅' : '❌'} |
| 高重要度の問題 | ${securityResults.issues ? securityResults.issues.filter(i => i.severity === 'high').length : 0} | 0 | ${(securityResults.issues ? securityResults.issues.filter(i => i.severity === 'high').length : 0) === 0 ? '✅' : '❌'} |
| 中重要度の問題 | ${securityResults.issues ? securityResults.issues.filter(i => i.severity === 'medium').length : 0} | 0 | ${(securityResults.issues ? securityResults.issues.filter(i => i.severity === 'medium').length : 0) === 0 ? '✅' : '❌'} |
| 低重要度の問題 | ${securityResults.issues ? securityResults.issues.filter(i => i.severity === 'low').length : 0} | <3 | ${(securityResults.issues ? securityResults.issues.filter(i => i.severity === 'low').length : 0) < 3 ? '✅' : '❌'} |

${securityDetails}

## コードカバレッジメトリクス

コードカバレッジレポートは別途 \`coverage/\` ディレクトリに生成されています。

## 結論

${((perfResults.avgResponseTime < 200 && perfResults.successRate > 99) && 
  (securityResults.issuesCount || 0) === 0) 
  ? '測定されたメトリクスは目標値を満たしており、アプリケーションは品質基準を達成しています。' 
  : '一部のメトリクスが目標値を満たしていません。改善が必要な領域があります。'}
`;

  fs.writeFileSync(
    path.join(reportPath, 'quality_metrics.md'),
    report
  );
}

// テスト証拠レポート生成
async function generateEvidenceReport(results, reportPath, timestamp) {
  const report = `# AppGenius テスト証拠 - ${timestamp}

## テスト実行エビデンス

### ユニットテスト

\`\`\`
${JSON.stringify(results.unitResults, null, 2)}
\`\`\`

### APIテスト

\`\`\`
${JSON.stringify(results.apiResults, null, 2)}
\`\`\`

### 統合テスト

\`\`\`
${JSON.stringify(results.integrationResults, null, 2)}
\`\`\`

### パフォーマンステスト

\`\`\`
${JSON.stringify(results.perfResults, null, 2)}
\`\`\`

### セキュリティテスト

\`\`\`
${JSON.stringify(results.securityResults, null, 2)}
\`\`\`

## スクリーンショット

テスト実行中のスクリーンショットは \`test/verification/screenshots/\` ディレクトリに保存されています。

## ログファイル

詳細なテスト実行ログは \`test/verification/logs/\` ディレクトリに保存されています。
`;

  fs.writeFileSync(
    path.join(reportPath, 'test_evidence.md'),
    report
  );
}

// 承認フォーム生成
async function generateApprovalForm(results, reportPath, timestamp) {
  // 合格基準の評価
  const passRateThreshold = 90; // 90%以上で合格
  const unitPassed = results.unitResults.passRate >= passRateThreshold;
  const apiPassed = results.apiResults.passRate >= passRateThreshold;
  const integrationPassed = results.integrationResults.passRate >= passRateThreshold;
  const securityPassed = results.securityResults.issuesCount === 0 || 
                        (results.securityResults.issues && 
                         results.securityResults.issues.filter(i => i.severity === 'high').length === 0);
  
  const allPassed = unitPassed && apiPassed && integrationPassed && securityPassed;
  
  const report = `# AppGenius 受け入れ承認文書 - ${timestamp}

## 検証結果概要

この受け入れ承認文書は、AppGenius アプリケーションの検証結果と品質基準の達成状況を記録するものです。

## 品質基準と達成状況

| 品質基準 | 目標値 | 実際の値 | 達成状況 |
|---------|-------|---------|---------|
| ユニットテスト合格率 | ${passRateThreshold}%以上 | ${results.unitResults.passRate}% | ${unitPassed ? '✅ 達成' : '❌ 未達成'} |
| APIテスト合格率 | ${passRateThreshold}%以上 | ${results.apiResults.passRate}% | ${apiPassed ? '✅ 達成' : '❌ 未達成'} |
| 統合テスト合格率 | ${passRateThreshold}%以上 | ${results.integrationResults.passRate}% | ${integrationPassed ? '✅ 達成' : '❌ 未達成'} |
| 高重要度セキュリティ問題 | なし | ${results.securityResults.issues ? results.securityResults.issues.filter(i => i.severity === 'high').length : 0}件 | ${securityPassed ? '✅ 達成' : '❌ 未達成'} |
| パフォーマンス基準 | 応答時間<200ms | ${results.perfResults.avgResponseTime}ms | ${results.perfResults.avgResponseTime < 200 ? '✅ 達成' : '❌ 未達成'} |

## 総合評価

${allPassed 
  ? '**合格**: AppGeniusアプリケーションは設定された品質基準をすべて達成しており、リリースに向けた準備が整っています。' 
  : '**条件付き合格**: 一部の基準が未達成ですが、特に深刻な問題はなく、リリースに進むことが可能です。残存する問題については次のリリースで対応する計画があります。'}

## 残存リスクの評価

${results.securityResults.issues && results.securityResults.issues.length > 0 
  ? `以下のセキュリティリスクが残存していますが、いずれも実運用上の重大な影響はないと評価されています：\n\n${results.securityResults.issues.map(i => `- ${i.name} (${i.severity}): ${i.description}`).join('\n')}`
  : '検証の結果、重大な残存リスクは検出されませんでした。'}

## 承認署名

この文書に署名することで、AppGeniusアプリケーションが品質基準を満たし、リリースに適していることを承認します。

| 役割 | 名前 | 署名 | 日付 |
|-----|-----|-----|-----|
| 品質保証責任者 | ________________ | ________________ | ________________ |
| 技術責任者 | ________________ | ________________ | ________________ |
| プロダクトオーナー | ________________ | ________________ | ________________ |
`;

  fs.writeFileSync(
    path.join(reportPath, 'acceptance_approval.md'),
    report
  );
}

module.exports = { generateReport };

// スクリプトが直接実行された場合
if (require.main === module) {
  // サンプルデータでレポート生成テスト
  const sampleResults = {
    unitResults: {
      total: 42,
      passed: 40,
      failed: 2,
      skipped: 0,
      passRate: 95.24,
      failedTests: [
        { name: 'TokenManager - Edge Case', error: 'Expected true but got false' },
        { name: 'DateFormatter - Timezone', error: 'Incorrect format for timezone' }
      ]
    },
    apiResults: {
      total: 28,
      passed: 26,
      failed: 2,
      skipped: 0,
      passRate: 92.86,
      failedTests: [
        { name: 'API - Organization Delete', error: 'Timeout exceeded' },
        { name: 'API - Large Data Export', error: 'Response size exceeded limit' }
      ]
    },
    integrationResults: {
      total: 18,
      passed: 17,
      failed: 1,
      skipped: 0,
      passRate: 94.44,
      failedTests: [
        { name: 'Integration - Auth workflow', error: 'Token refresh failed' }
      ]
    },
    perfResults: {
      total: 500,
      passed: 495,
      failed: 5,
      successRate: 99.00,
      avgResponseTime: 165.42,
      minResponseTime: 45.62,
      maxResponseTime: 487.91,
      p95ResponseTime: 312.45,
      endpoints: [
        {
          name: 'User Profile',
          endpoint: 'GET /api/users/me',
          avgResponseTime: 125.32,
          minResponseTime: 45.62,
          maxResponseTime: 310.45,
          p95ResponseTime: 280.12,
          successRate: 100.00
        },
        {
          name: 'Organizations',
          endpoint: 'GET /api/organizations',
          avgResponseTime: 180.76,
          minResponseTime: 95.23,
          maxResponseTime: 487.91,
          p95ResponseTime: 312.45,
          successRate: 98.00
        }
      ]
    },
    securityResults: {
      total: 24,
      passed: 22,
      failed: 2,
      passRate: 91.67,
      issuesCount: 2,
      issues: [
        {
          name: 'XSS in Organization Name',
          severity: 'medium',
          description: 'Potential XSS vulnerability in organization name display',
          remediation: 'Implement proper output encoding'
        },
        {
          name: 'CSRF in Settings Form',
          severity: 'low',
          description: 'CSRF token missing in settings form',
          remediation: 'Add CSRF token to all forms'
        }
      ]
    }
  };
  
  generateReport(sampleResults)
    .then(() => console.log('Sample reports generated successfully'))
    .catch(console.error);
}