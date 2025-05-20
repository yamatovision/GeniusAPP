/**
 * 非常に簡単なテストスクリプト - 直接認証トークンを検証
 */
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');

// 接続設定
const MONGODB_URI = 'mongodb://localhost:27017/hinago-test';

// 認証トークン生成関数
function generateTestToken(userId, organizationId) {
  // 固定秘密鍵
  const secret = '8f42a1d5c1e9b8a3f6d7e2c5b9a8d3f6';
  
  const payload = {
    id: userId,
    email: 'test_direct@example.com',
    role: 'user',
    organizationId
  };
  
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

// Mongoに接続
async function connectToMongo() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB接続成功');
    return true;
  } catch (error) {
    console.error('MongoDB接続失敗:', error);
    return false;
  }
}

// テストリクエスト関数
function makeTestRequest(endpoint, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data.length ? JSON.parse(data) : {}
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: { parseError: true, raw: data }
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// メイン処理
async function main() {
  try {
    // MongoDB接続
    const connected = await connectToMongo();
    if (!connected) {
      console.error('テストを中断します - DB接続失敗');
      process.exit(1);
    }
    
    // テスト開始
    console.log('======= 直接テスト開始 =======');
    
    // 1. 認証なしでアクセス
    console.log('\n1. 認証なしのテスト:');
    const noAuthResult = await makeTestRequest('/api/properties/test', null);
    console.log('ステータスコード:', noAuthResult.statusCode);
    console.log('レスポンス:', JSON.stringify(noAuthResult.body, null, 2));
    
    // 2. 認証ありでテストエンドポイントにアクセス
    const testToken = generateTestToken('testuser1', 'testorg1');
    console.log('\n2. テストエンドポイントアクセス:');
    const testEndpointResult = await makeTestRequest('/api/properties/test', testToken);
    console.log('ステータスコード:', testEndpointResult.statusCode);
    console.log('レスポンス:', JSON.stringify(testEndpointResult.body, null, 2));
    
    // 3. 認証ありで物件エンドポイントにアクセス
    console.log('\n3. 物件エンドポイントアクセス:');
    const propertiesResult = await makeTestRequest('/api/properties', testToken);
    console.log('ステータスコード:', propertiesResult.statusCode);
    console.log('レスポンス:', JSON.stringify(propertiesResult.body, null, 2));
    
    console.log('\n======= テスト完了 =======');
  } catch (error) {
    console.error('テスト実行エラー:', error);
  } finally {
    // 接続を閉じる
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB接続を閉じました');
    }
    process.exit(0);
  }
}

main();