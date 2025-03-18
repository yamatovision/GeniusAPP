/**
 * 使用量APIエンドポイントテスト
 * 
 * このスクリプトは、/proxy/usage/me エンドポイントが正常に機能するかテストします。
 */
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// テスト設定
const CONFIG = {
  // APIエンドポイント（本番環境）
  apiUrl: 'https://geniemon-portal-backend-production.up.railway.app/api',
  // ローカル環境のAPIエンドポイント
  localApiUrl: 'http://localhost:3000/api',
  // タイムアウト（ミリ秒）
  timeout: 15000
};

// アクセストークンの入力を求める
function getAccessToken() {
  return new Promise((resolve) => {
    rl.question('アクセストークンを入力してください: ', (token) => {
      resolve(token.trim());
    });
  });
}

// テスト環境の選択
function getEnvironment() {
  return new Promise((resolve) => {
    rl.question('テスト環境を選択してください（1: 本番環境, 2: ローカル環境）[1]: ', (answer) => {
      if (answer === '2') {
        resolve('local');
      } else {
        resolve('production');
      }
    });
  });
}

// 使用量APIエンドポイントをテスト
async function testUsageEndpoint(token, env) {
  try {
    console.log('使用量APIエンドポイントをテストしています...');
    
    // 環境に応じたAPIエンドポイントを設定
    const apiUrl = env === 'local' ? CONFIG.localApiUrl : CONFIG.apiUrl;
    console.log(`使用するAPIエンドポイント: ${apiUrl}`);
    
    // リクエストヘッダーを設定
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('リクエスト送信中...');
    const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
      headers,
      timeout: CONFIG.timeout
    });
    
    console.log('レスポンス受信:');
    console.log('- ステータスコード:', response.status);
    console.log('- ステータステキスト:', response.statusText);
    console.log('- レスポンスデータ:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // レスポンス内容の検証
    if (response.data && response.data.usage && response.data.limits) {
      console.log('\n✅ エンドポイントは正常に機能しています！');
      
      // 使用量情報を抽出して表示
      const monthlyUsage = response.data.usage.monthly || {};
      const limits = response.data.limits || {};
      
      console.log('\n📊 使用量サマリー:');
      console.log(`- 現在の月間使用量: ${monthlyUsage.totalTokens || 0} トークン`);
      console.log(`- 月間使用制限: ${limits.monthly || 0} トークン`);
      if (limits.monthly > 0) {
        const usagePercentage = ((monthlyUsage.totalTokens || 0) / limits.monthly) * 100;
        console.log(`- 使用率: ${usagePercentage.toFixed(2)}%`);
      }
    } else {
      console.log('\n⚠️ エンドポイントからの応答に必要な情報が含まれていません');
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    
    if (axios.isAxiosError(error)) {
      console.error(`- リクエストエラー: ${error.message}`);
      
      if (error.response) {
        // サーバーからのレスポンスがある場合
        console.error(`- ステータスコード: ${error.response.status}`);
        console.error(`- レスポンスデータ:`, error.response.data);
      } else if (error.request) {
        // リクエストは送信されたがレスポンスがない場合
        console.error('- レスポンスが受信されませんでした（タイムアウトまたはネットワークエラー）');
      }
      
      // リトライ対象かどうかを判定
      if (error.response && error.response.status === 500) {
        console.log('\n⚠️ サーバーエラー（500）が発生しました。リトライが必要な状況です。');
      }
    } else {
      console.error(`- 予期しないエラー: ${error}`);
    }
  }
}

// エンドポイントのリトライテスト
async function testEndpointWithRetries(token, env) {
  const maxRetries = 3;
  const retryDelay = 1000; // 1秒
  
  let retryCount = 0;
  
  console.log(`\nリトライロジックのテスト（最大${maxRetries}回）:`);
  
  while (retryCount < maxRetries) {
    try {
      const apiUrl = env === 'local' ? CONFIG.localApiUrl : CONFIG.apiUrl;
      console.log(`\n試行 ${retryCount + 1}/${maxRetries}...`);
      
      const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: CONFIG.timeout
      });
      
      console.log(`✅ 成功! (ステータスコード: ${response.status})`);
      return; // 成功したら終了
    } catch (error) {
      retryCount++;
      
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        console.error(`❌ エラー: ${error.message} (ステータスコード: ${statusCode})`);
        
        // サーバーエラー（500）の場合のみリトライ
        if (error.response?.status === 500) {
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
        console.error(`❌ 予期しないエラー: ${error}`);
        break;
      }
    }
  }
  
  console.log(`\n最大リトライ回数（${maxRetries}回）に達しました。`);
}

// メイン処理
async function main() {
  try {
    console.log('===== 使用量API エンドポイントテスト =====');
    
    // 環境の選択
    const env = await getEnvironment();
    console.log(`選択された環境: ${env === 'local' ? 'ローカル環境' : '本番環境'}`);
    
    // アクセストークンの取得
    const token = await getAccessToken();
    if (!token) {
      console.error('アクセストークンが提供されていません。テストを中止します。');
      rl.close();
      return;
    }
    
    // 基本的なエンドポイントテスト
    await testUsageEndpoint(token, env);
    
    // リトライロジックのテスト
    const testRetry = await new Promise((resolve) => {
      rl.question('\nリトライロジックもテストしますか？ (y/N): ', (answer) => {
        resolve(answer.toLowerCase() === 'y');
      });
    });
    
    if (testRetry) {
      await testEndpointWithRetries(token, env);
    }
    
    console.log('\n===== テスト完了 =====');
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    rl.close();
  }
}

// スクリプト実行
main();