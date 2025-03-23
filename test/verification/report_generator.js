// test/verification/report_generator.js
// 検証結果レポート生成スクリプト

const fs = require('fs');
const path = require('path');

// レポート生成用設定
const config = {
  outputDir: path.join(__dirname, '..', '..', 'docs', 'verification'),
  tempDir: path.join(__dirname, '..', 'temp_results'),
  reportTemplate: {
    title: 'AppGenius 品質保証・動作検証レポート',
    date: new Date().toISOString().split('T')[0],
    version: '1.0.0',
    summary: {
      overallScore: 'Poor', // Good, Fair, Poor
      apiTestsPassed: 0,
      securityIssuesFound: 0,
      avgResponseTime: 0,
      unitTestsPassed: 0,
    },
    sections: [],
  },
};

// レポート生成関数
async function generateReport(results = {}) {
  console.log('\n検証レポートを生成しています...');
  
  // 出力ディレクトリの確認と作成
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
  
  if (!fs.existsSync(config.tempDir)) {
    fs.mkdirSync(config.tempDir, { recursive: true });
  }
  
  // レポートデータの構築
  const reportData = { ...config.reportTemplate };
  
  // 各テスト結果の取り込みと処理
  try {
    // 1. ユニットテスト結果
    let unitTestResults;
    try {
      // 保存済み結果からの読み込みを試みる
      const unitTestPath = path.join(config.tempDir, 'unit_tests_results.txt');
      if (fs.existsSync(unitTestPath)) {
        const unitTestContent = fs.readFileSync(unitTestPath, 'utf8');
        // パス率の抓出
        const passRateMatch = unitTestContent.match(/Pass Rate: (\d+)%/);
        if (passRateMatch) {
          unitTestResults = {
            passRate: parseInt(passRateMatch[1], 10),
          };
        }
      }
    } catch (err) {
      console.error('ユニットテスト結果の読み込みに失敗しました:', err.message);
    }
    
    // 結果データからの取り込み
    if (results.unitResults) {
      unitTestResults = results.unitResults;
    }
    
    if (unitTestResults) {
      reportData.summary.unitTestsPassed = unitTestResults.passRate || 0;
      reportData.sections.push({
        title: 'ユニットテスト結果',
        content: `### ユニットテスト結果

- パス率: ${unitTestResults.passRate}%
${unitTestResults.passRate === 100 ? '- すべてのテストが成功しました。' : '- いくつかのテストが失敗しました。'}
${unitTestResults.details ? `- 詳細: ${unitTestResults.details}` : ''}`,
      });
    } else {
      reportData.sections.push({
        title: 'ユニットテスト結果',
        content: `### ユニットテスト結果

ユニットテスト結果が利用できません。テストを実行するか、結果ファイルの取得に失敗しました。`,
      });
    }
    
    // 2. APIテスト結果
    let apiTestResults;
    try {
      // 保存済み結果からの読み込みを試みる
      const apiTestPath = path.join(config.tempDir, 'api_tests_results.txt');
      if (fs.existsSync(apiTestPath)) {
        const apiTestContent = fs.readFileSync(apiTestPath, 'utf8');
        // APIテストが実行されたがエラーが発生した場合
        if (apiTestContent.includes('ECONNREFUSED')) {
          apiTestResults = {
            passRate: 0,
            error: 'APIサーバーに接続できません。起動しているか確認してください。',
          };
        }
      }
    } catch (err) {
      console.error('APIテスト結果の読み込みに失敗しました:', err.message);
    }
    
    // 結果データからの取り込み
    if (results.apiResults) {
      apiTestResults = results.apiResults;
    }
    
    if (apiTestResults) {
      reportData.summary.apiTestsPassed = apiTestResults.passRate || 0;
      reportData.sections.push({
        title: 'APIテスト結果',
        content: `### APIテスト結果

${apiTestResults.error ? `- エラー: ${apiTestResults.error}` : ''}
- パス率: ${apiTestResults.passRate || 0}%
${apiTestResults.failedTests ? `- 失敗したテスト: ${apiTestResults.failedTests.length}` : ''}
${apiTestResults.details ? `- 詳細: ${apiTestResults.details}` : ''}`,
      });
    } else {
      reportData.sections.push({
        title: 'APIテスト結果',
        content: `### APIテスト結果

APIテスト結果が利用できません。テストを実行するか、結果ファイルの取得に失敗しました。`,
      });
    }
    
    // 3. パフォーマンステスト結果
    let performanceResults;
    try {
      // 保存済み結果からの読み込みを試みる
      const perfTestPath = path.join(config.tempDir, 'performance_tests_results.txt');
      if (fs.existsSync(perfTestPath)) {
        const perfTestContent = fs.readFileSync(perfTestPath, 'utf8');
        // 平均レスポンスタイムと成功率の抽出
        const avgRespTimeMatch = perfTestContent.match(/Overall average response time: ([\d.]+)ms/);
        const successRateMatch = perfTestContent.match(/Overall success rate: ([\d.]+)%/);
        
        if (avgRespTimeMatch || successRateMatch) {
          performanceResults = {
            avgResponseTime: avgRespTimeMatch ? parseFloat(avgRespTimeMatch[1]) : 0,
            successRate: successRateMatch ? parseFloat(successRateMatch[1]) : 0,
          };
        } else if (perfTestContent.includes('Authentication failed')) {
          performanceResults = {
            error: '認証エラーのためテストを実行できませんでした。',
            avgResponseTime: 0,
            successRate: 0,
          };
        }
      }
    } catch (err) {
      console.error('パフォーマンステスト結果の読み込みに失敗しました:', err.message);
    }
    
    // 結果データからの取り込み
    if (results.perfResults) {
      performanceResults = results.perfResults;
    }
    
    if (performanceResults) {
      reportData.summary.avgResponseTime = performanceResults.avgResponseTime || 0;
      
      // 詳細なエンドポイント別結果を生成
      let detailedResults = '';
      if (performanceResults.detailedResults && performanceResults.detailedResults.avgResponseTimes) {
        detailedResults = '\n\n#### エンドポイント別詳細\n\n';
        for (const [endpoint, avgTime] of Object.entries(performanceResults.detailedResults.avgResponseTimes)) {
          const successRate = performanceResults.detailedResults.successRates[endpoint]?.rate || 0;
          const minTime = performanceResults.detailedResults.minResponseTimes[endpoint] || 0;
          const maxTime = performanceResults.detailedResults.maxResponseTimes[endpoint] || 0;
          
          detailedResults += `**${endpoint}**:\n`;
          detailedResults += `- 平均レスポンスタイム: ${avgTime.toFixed(2)}ms\n`;
          detailedResults += `- 最小/最大: ${minTime}ms / ${maxTime}ms\n`;
          detailedResults += `- 成功率: ${successRate.toFixed(2)}%\n\n`;
        }
      }
      
      reportData.sections.push({
        title: 'パフォーマンステスト結果',
        content: `### パフォーマンステスト結果

${performanceResults.error ? `- エラー: ${performanceResults.error}` : ''}
- 平均レスポンスタイム: ${performanceResults.avgResponseTime || 0}ms
- 成功率: ${performanceResults.successRate ? `${performanceResults.successRate.toFixed(2)}%` : 'N/A'}
${performanceResults.details ? `- 詳細: ${performanceResults.details}` : ''}${detailedResults}`,
      });
    } else {
      reportData.sections.push({
        title: 'パフォーマンステスト結果',
        content: `### パフォーマンステスト結果

パフォーマンステスト結果が利用できません。テストを実行するか、結果ファイルの取得に失敗しました。`,
      });
    }
    
    // 4. セキュリティテスト結果
    let securityResults;
    try {
      // 保存済み結果からの読み込みを試みる
      const secTestPath = path.join(config.tempDir, 'security_tests_results.txt');
      if (fs.existsSync(secTestPath)) {
        const secTestContent = fs.readFileSync(secTestPath, 'utf8');
        // セキュリティ問題数の抓出
        const issuesMatch = secTestContent.match(/Security Issues Found: (\d+)/);
        if (issuesMatch) {
          securityResults = {
            issuesCount: parseInt(issuesMatch[1], 10),
          };
        } else if (secTestContent.includes('ECONNREFUSED')) {
          securityResults = {
            error: 'APIサーバーに接続できません。起動しているか確認してください。',
            issuesCount: 0,
          };
        }
      }
    } catch (err) {
      console.error('セキュリティテスト結果の読み込みに失敗しました:', err.message);
    }
    
    // 結果データからの取り込み
    if (results.securityResults) {
      securityResults = results.securityResults;
    }
    
    if (securityResults) {
      reportData.summary.securityIssuesFound = securityResults.issuesCount || 0;
      const issuesSection = securityResults.issues && securityResults.issues.length > 0 ? 
        `\n#### セキュリティ問題詳細\n\n${securityResults.issues.map((issue, idx) => 
          `${idx + 1}. **${issue.name}** (重大度: ${issue.severity})\n   - 説明: ${issue.description}\n   - 対策: ${issue.remediation}`
        ).join('\n\n')}` : '';
      
      reportData.sections.push({
        title: 'セキュリティテスト結果',
        content: `### セキュリティテスト結果

${securityResults.error ? `- エラー: ${securityResults.error}` : ''}
- 検出されたセキュリティ問題: ${securityResults.issuesCount || 0}
${securityResults.details ? `- 詳細: ${securityResults.details}` : ''}${issuesSection}`,
      });
    } else {
      reportData.sections.push({
        title: 'セキュリティテスト結果',
        content: `### セキュリティテスト結果

セキュリティテスト結果が利用できません。テストを実行するか、結果ファイルの取得に失敗しました。`,
      });
    }
    
    // 5. 統合テスト結果
    if (results.integrationResults) {
      reportData.sections.push({
        title: '統合テスト結果',
        content: `### 統合テスト結果

- パス率: ${results.integrationResults.passRate || 0}%
${results.integrationResults.details ? `- 詳細: ${results.integrationResults.details}` : ''}`,
      });
    }
    
    // 総合評価の計算
    const overallScore = calculateOverallScore(reportData.summary);
    reportData.summary.overallScore = overallScore;
    
    // 総合評価セクションの追加
    reportData.sections.unshift({
      title: '紹介',
      content: `## 紹介

このレポートはAppGeniusの自動検証システムによって生成されました。このレポートは以下のテスト結果を含みます：

- ユニットテスト
- APIテスト
- パフォーマンステスト
- セキュリティテスト
- 統合テスト

## 概要

- 総合評価: **${overallScore}**
- ユニットテストパス率: ${reportData.summary.unitTestsPassed}%
- APIテストパス率: ${reportData.summary.apiTestsPassed}%
- 平均レスポンスタイム: ${reportData.summary.avgResponseTime}ms
- 検出されたセキュリティ問題: ${reportData.summary.securityIssuesFound}

${overallScore === 'Good' ? 'すべてのテストが正常に完了し、重大な問題は検出されませんでした。' : overallScore === 'Fair' ? 'いくつかのテストに問題がありますが、重大な問題は検出されませんでした。' : '複数の検証項目に問題が検出されました。詳細は各セクションを確認してください。'}`,
    });
    
    // レポートの生成
    const reportContent = generateMarkdownReport(reportData);
    const reportPath = path.join(config.outputDir, 'verification_report.md');
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    
    console.log(`検証レポートが生成されました: ${reportPath}`);
    return reportPath;
  } catch (error) {
    console.error('レポート生成中にエラーが発生しました:', error);
    throw error;
  }
}

// 総合評価の計算
function calculateOverallScore(summary) {
  const { unitTestsPassed, apiTestsPassed, avgResponseTime, securityIssuesFound } = summary;
  
  // 単純な重み付け計算
  let score = 0;
  let maxScore = 0;
  
  // ユニットテスト評価 (30%)
  if (unitTestsPassed >= 0) {
    score += (unitTestsPassed / 100) * 30;
    maxScore += 30;
  }
  
  // APIテスト評価 (30%)
  if (apiTestsPassed >= 0) {
    score += (apiTestsPassed / 100) * 30;
    maxScore += 30;
  }
  
  // セキュリティ問題評価 (40%)
  if (securityIssuesFound >= 0) {
    // 問題がないほど高スコア
    const securityScore = securityIssuesFound === 0 ? 40 : 
                         securityIssuesFound <= 2 ? 20 : 
                         securityIssuesFound <= 5 ? 10 : 0;
    score += securityScore;
    maxScore += 40;
  }
  
  // 最終スコア計算 (0-100%)
  const finalScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
  
  // スコアから評価を決定
  if (finalScore >= 80) {
    return 'Good';
  } else if (finalScore >= 50) {
    return 'Fair';
  } else {
    return 'Poor';
  }
}

// Markdownレポートの生成
function generateMarkdownReport(reportData) {
  const { title, date, version, sections } = reportData;
  
  let markdown = `# ${title}\n\n`;
  markdown += `生成日: ${date}\n`;
  markdown += `バージョン: ${version}\n\n`;
  
  // 各セクションの追加
  sections.forEach(section => {
    markdown += `${section.content}\n\n`;
  });
  
  // 証言と付属情報
  markdown += `## 付属情報\n\n`;
  markdown += `このレポートは自動生成されたものです。\n`;
  markdown += `生成日時: ${new Date().toISOString()}\n`;
  
  return markdown;
}

module.exports = { generateReport };

// スクリプトが直接実行された場合
if (require.main === module) {
  generateReport()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}