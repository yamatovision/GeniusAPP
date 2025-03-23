// test_script/summarize_project.js
// プロジェクトの状態や主要データを要約するスクリプト

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 設定
const config = {
  currentStatusPath: path.join(__dirname, '..', 'docs', 'CURRENT_STATUS.md'),
  verificationReportPath: path.join(__dirname, '..', 'docs', 'verification', 'verification_report.md'),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000'
};

async function summarizeProject() {
  console.log('AppGeniusプロジェクト概要');
  console.log('=====================');
  
  // 現在の日時
  console.log(`実行日時: ${new Date().toISOString()}`);
  
  // CURRENT_STATUSからの情報取得
  try {
    if (fs.existsSync(config.currentStatusPath)) {
      const currentStatusContent = fs.readFileSync(config.currentStatusPath, 'utf8');
      
      // 全体進捗の抽出
      const progressMatch = currentStatusContent.match(/進捗率: ([\d.]+)%/);
      if (progressMatch) {
        console.log(`\n全体進捗率: ${progressMatch[1]}%`);
      }
      
      // スコープ状況の抽出
      console.log('\nスコープ状況:');
      const completedScopes = (currentStatusContent.match(/- \[x\] .+/g) || [])
        .map(line => line.replace(/- \[x\] /, ''));
      
      const inProgressScopes = (currentStatusContent.match(/- \[ \] .+\((\d+)%\)/g) || [])
        .map(line => {
          const match = line.match(/- \[ \] (.+) \((\d+)%\)/);
          if (match) {
            return `${match[1]} (${match[2]}%)`;
          }
          return line.replace(/- \[ \] /, '');
        });
      
      console.log('完了済み:');
      completedScopes.forEach(scope => console.log(`- ${scope}`));
      
      console.log('\n進行中:');
      inProgressScopes.forEach(scope => console.log(`- ${scope}`));
    } else {
      console.log('CURRENT_STATUS.mdファイルが見つかりません');
    }
  } catch (error) {
    console.error('CURRENT_STATUS.mdの解析に失敗しました:', error.message);
  }
  
  // 検証レポートからの情報取得
  try {
    if (fs.existsSync(config.verificationReportPath)) {
      const reportContent = fs.readFileSync(config.verificationReportPath, 'utf8');
      
      // テスト結果の抽出
      const unitTestMatch = reportContent.match(/ユニットテストパス率: (\d+)%/);
      const apiTestMatch = reportContent.match(/APIテストパス率: (\d+)%/);
      const respTimeMatch = reportContent.match(/平均レスポンスタイム: ([\d.]+)ms/);
      const securityMatch = reportContent.match(/検出されたセキュリティ問題: (\d+)/);
      
      console.log('\n検証状況:');
      if (unitTestMatch) console.log(`- ユニットテスト: ${unitTestMatch[1]}% パス`);
      if (apiTestMatch) console.log(`- APIテスト: ${apiTestMatch[1]}% パス`);
      if (respTimeMatch) console.log(`- パフォーマンス: ${respTimeMatch[1]}ms 平均レスポンスタイム`);
      if (securityMatch) console.log(`- セキュリティ: ${securityMatch[1]} 問題検出`);
    } else {
      console.log('検証レポートファイルが見つかりません');
    }
  } catch (error) {
    console.error('検証レポートの解析に失敗しました:', error.message);
  }
  
  // API接続状態の確認
  try {
    console.log('\nAPI接続状態の確認:');
    const response = await axios({
      method: 'get',
      url: `${config.apiBaseUrl}/api/proxy/status`,
      timeout: 5000,
      validateStatus: status => true
    });
    
    if (response.status === 200) {
      console.log('✅ APIサーバーが正常に応答しています');
      console.log(`  ステータス: ${response.data.status || 'OK'}`);
      if (response.data.version) console.log(`  バージョン: ${response.data.version}`);
      if (response.data.uptime) console.log(`  稼働時間: ${response.data.uptime}`);
    } else {
      console.log(`❌ APIサーバーが異常応答を返しました (ステータスコード: ${response.status})`);
    }
  } catch (error) {
    console.log('❌ APIサーバーに接続できません');
    console.log(`  エラー: ${error.message}`);
  }
  
  console.log('\n=====================');
}

// スクリプト実行
summarizeProject().catch(console.error);