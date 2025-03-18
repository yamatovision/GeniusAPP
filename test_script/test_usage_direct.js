/**
 * 使用量APIエンドポイント直接テスト
 */
const axios = require('axios');

// 取得したトークン
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZDUyNzgwOTM2ZTQ4YzlmYzg1OTdiNyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc0MjI5MjE1MywiZXhwIjoxNzQyMjk1NzUzLCJhdWQiOiJhcHBnZW5pdXMtdXNlcnMiLCJpc3MiOiJhcHBnZW5pdXMtcHJvbXB0LXBvcnRhbCJ9.rixJlxLCs4rNFT5f3nAMmiHj3lz3v1MSTdj0TUtDiZQ';

// APIエンドポイント
const apiUrl = 'https://geniemon-portal-backend-production.up.railway.app/api';

async function testUsageEndpoint() {
  try {
    console.log('使用量APIエンドポイントをテストしています...');
    console.log(`APIエンドポイント: ${apiUrl}/proxy/usage/me`);
    
    // リクエストヘッダー
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('リクエストの詳細:');
    console.log('- ヘッダー:', JSON.stringify(headers, null, 2));
    
    console.log('\nリクエスト送信中...');
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
        headers,
        timeout: 15000
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`\n✅ 成功！（${duration}ms）`);
      console.log('- ステータスコード:', response.status);
      console.log('- ステータステキスト:', response.statusText);
      console.log('- レスポンスデータ:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // レスポンス内容の検証
      if (response.data && response.data.usage && response.data.limits) {
        console.log('\n📊 使用量サマリー:');
        const monthlyUsage = response.data.usage.monthly || {};
        const limits = response.data.limits || {};
        
        console.log(`- 現在の月間使用量: ${monthlyUsage.totalTokens || 0} トークン`);
        console.log(`- 月間使用制限: ${limits.monthly || 0} トークン`);
        if (limits.monthly > 0) {
          const usagePercentage = ((monthlyUsage.totalTokens || 0) / limits.monthly) * 100;
          console.log(`- 使用率: ${usagePercentage.toFixed(2)}%`);
        }
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`\n❌ エラー発生！（${duration}ms）`);
      
      if (error.response) {
        // サーバーからのレスポンスがある場合
        console.error(`- ステータスコード: ${error.response.status}`);
        console.error('- レスポンスヘッダー:', JSON.stringify(error.response.headers, null, 2));
        console.error('- レスポンスデータ:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        // リクエストは送信されたがレスポンスがない場合
        console.error('- レスポンスが受信されませんでした（タイムアウトまたはネットワークエラー）');
      }
      
      console.error('- エラーメッセージ:', error.message);
      
      // エラースタックをより詳細に表示
      if (error.stack) {
        console.error('\nエラースタック:');
        console.error(error.stack);
      }
    }
  } catch (error) {
    console.error('テスト実行中に予期しないエラーが発生しました:', error);
  }
}

// リトライロジックでテスト
async function testWithRetry() {
  const maxRetries = 3;
  const retryDelay = 1000; // 1秒
  
  let retryCount = 0;
  
  console.log(`\nリトライロジックのテスト（最大${maxRetries}回）:`);
  
  while (retryCount < maxRetries) {
    try {
      console.log(`\n試行 ${retryCount + 1}/${maxRetries}...`);
      
      const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      });
      
      console.log(`✅ 成功! (ステータスコード: ${response.status})`);
      console.log('- レスポンスデータ:', JSON.stringify(response.data, null, 2));
      return; // 成功したら終了
    } catch (error) {
      retryCount++;
      
      if (error.response) {
        const statusCode = error.response.status;
        console.error(`❌ エラー: ${error.message} (ステータスコード: ${statusCode})`);
        
        // サーバーエラー（500）の場合のみリトライ
        if (statusCode === 500) {
          if (retryCount < maxRetries) {
            const waitTime = retryDelay * Math.pow(2, retryCount - 1);
            console.log(`⏱ ${waitTime}ms後にリトライします...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        } else {
          console.log(`ステータスコード ${statusCode} はリトライ対象外です`);
          break;
        }
      } else {
        console.error(`❌ 予期しないエラー: ${error.message}`);
        break;
      }
    }
  }
  
  console.log(`\n最大リトライ回数（${maxRetries}回）に達しました。`);
}

// メイン処理
async function main() {
  console.log('===== 使用量API エンドポイント直接テスト =====\n');
  
  // 基本的なエンドポイントテスト
  await testUsageEndpoint();
  
  // リトライロジックのテスト
  await testWithRetry();
  
  console.log('\n===== テスト完了 =====');
}

// スクリプト実行
main();