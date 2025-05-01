/**
 * 利用可能なAPIエンドポイントをテストするスクリプト
 */

const axios = require('axios');

// 設定
const BASE_URL = 'https://appgenius-portal-backend-235426778039.asia-northeast1.run.app/api';
const EMAIL = 'shiraishi.tatsuya@mikoto.co.jp';
const PASSWORD = 'aikakumei';

// APIエンドポイントをテストする関数
async function testApiEndpoints() {
  try {
    console.log('=== ログイン処理開始 ===');
    // 1. ログイン処理
    const loginResponse = await axios.post(`${BASE_URL}/simple/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (loginResponse.status !== 200 || !loginResponse.data.success) {
      console.error('ログインに失敗しました:', loginResponse.data);
      return false;
    }
    
    console.log('ログイン成功!');
    const accessToken = loginResponse.data.data.accessToken;
    console.log(`認証トークン取得: ${accessToken.substring(0, 10)}...`);
    
    // 2. 認証ヘッダーを設定
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    console.log('\n=== 利用可能なAPIエンドポイントのテスト ===');
    
    // テスト対象のエンドポイント
    const endpoints = [
      { method: 'get', url: '/simple/users/profile', description: 'ユーザープロフィール取得' },
      { method: 'get', url: '/simple/users', description: 'すべてのユーザー取得' },
      { method: 'get', url: '/simple/user/apikey', description: 'ユーザーAPIキー取得' },
      { method: 'get', url: '/simple/organizations', description: '組織一覧取得' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\nテスト: ${endpoint.description} (${endpoint.method.toUpperCase()} ${endpoint.url})`);
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.url}`,
          headers
        });
        
        console.log(`ステータス: ${response.status}`);
        console.log(`レスポンス: ${JSON.stringify(response.data).substring(0, 100)}...`);
        console.log(`結果: ✅ 成功`);
      } catch (error) {
        console.log(`ステータス: ${error.response?.status || 'エラー'}`);
        console.log(`エラー: ${error.message}`);
        console.log(`結果: ❌ 失敗`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// スクリプト実行
testApiEndpoints()
  .then(success => {
    console.log('\n=== テスト完了 ===');
    if (success) {
      console.log('APIアクセスが正常に機能しています。');
      console.log('問題のエンドポイント: /simple/users/:id/increment-claude-code-launch');
      console.log('このエンドポイントが404を返すのは、エンドポイントが存在しないか、ルートが間違っている可能性があります。');
      console.log('ソースコードを確認してください。');
    } else {
      console.log('APIアクセスに問題があります。');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('予期しないエラーが発生しました:', err);
    process.exit(1);
  });