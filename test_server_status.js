// APIサーバーのステータスをチェックするスクリプト
const http = require('http');

// 5000ポートをチェック
function checkApi() {
  console.log('APIサーバーをチェックしています... (ポート 5000)');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api',
    method: 'GET',
    timeout: 2000
  };
  
  const req = http.request(options, (res) => {
    console.log(`ステータスコード: ${res.statusCode}`);
    console.log(`ヘッダー: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`Body: ${data}`);
      checkSimpleEndpoint();
    });
  });
  
  req.on('error', (e) => {
    console.error(`API接続エラー: ${e.message}`);
    console.log('サーバーが起動していないか、ポート5000でリッスンしていない可能性があります。');
  });
  
  req.end();
}

// SimpleAuthデバッグエンドポイントをチェック
function checkSimpleEndpoint() {
  console.log('\nSimple認証APIをチェックしています...');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/simple/auth/check',
    method: 'GET',
    timeout: 2000,
    headers: {
      'Authorization': 'Bearer test-token'
    }
  };
  
  const req = http.request(options, (res) => {
    console.log(`ステータスコード: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`レスポンス: ${data}`);
    });
  });
  
  req.on('error', (e) => {
    console.error(`Simple API接続エラー: ${e.message}`);
  });
  
  req.end();
}

// 実行開始
checkApi();