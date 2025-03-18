const axios = require('axios');

// テスト用関数
async function testApiEndpoint() {
  try {
    const apiUrl = 'https://geniemon-portal-backend-production.up.railway.app/api';
    
    // /proxy/usage/me エンドポイントをテスト
    console.log('Testing /proxy/usage/me endpoint...');
    const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
      headers: {
        'Authorization': 'Bearer test_token'
      }
    });
    
    console.log('Response:', response.status);
    console.log('Data structure:', Object.keys(response.data));
    
  } catch (error) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// 実行
testApiEndpoint();
