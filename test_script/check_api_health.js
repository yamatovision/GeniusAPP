/**
 * シンプル認証APIのヘルスチェックスクリプト
 * 主要なAPIエンドポイントにリクエストを送信してステータスを確認します
 */

const axios = require('axios');

// 設定
const API_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const SIMPLE_API_URL = `${API_URL}/api/simple`;

// テスト用ユーザー情報（実際の環境に合わせて変更してください）
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

// テスト実行
async function runTests() {
  let accessToken = null;
  let refreshToken = null;
  
  console.log('===== シンプル認証APIヘルスチェック =====');
  
  try {
    // 1. サーバー疎通確認
    console.log('\n[1] サーバー疎通確認...');
    await axios.get(API_URL);
    console.log('✅ サーバーに接続できました');
    
    // 2. ログインAPI
    console.log('\n[2] ログインAPI確認...');
    try {
      const loginResponse = await axios.post(`${SIMPLE_API_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      
      if (loginResponse.data.success) {
        accessToken = loginResponse.data.data.accessToken;
        refreshToken = loginResponse.data.data.refreshToken;
        console.log('✅ ログインAPI正常に動作中');
        console.log(`📝 ユーザー情報: ${JSON.stringify(loginResponse.data.data.user, null, 2)}`);
      } else {
        console.log('❌ ログインAPI応答異常:', loginResponse.data);
      }
    } catch (error) {
      console.log('❌ ログインAPIエラー:', error.message);
      if (error.response) {
        console.log('📝 エラー詳細:', error.response.data);
      }
      
      // テスト用にダミートークンを設定
      console.log('⚠️ ダミートークンを使用して続行します');
      accessToken = 'dummy_token';
    }
    
    // 3. 認証チェックAPI
    console.log('\n[3] 認証チェックAPI確認...');
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };
      const authCheckResponse = await axios.get(`${SIMPLE_API_URL}/auth/check`, { headers });
      
      if (authCheckResponse.data.success) {
        console.log('✅ 認証チェックAPI正常に動作中');
        console.log(`📝 ユーザー情報: ${JSON.stringify(authCheckResponse.data.data.user, null, 2)}`);
      } else {
        console.log('❌ 認証チェックAPI応答異常:', authCheckResponse.data);
      }
    } catch (error) {
      console.log('❌ 認証チェックAPIエラー:', error.message);
      if (error.response) {
        console.log('📝 エラー詳細:', error.response.data);
        console.log('📝 エラーステータス:', error.response.status);
      }
    }
    
    // 4. 組織一覧取得API
    console.log('\n[4] 組織一覧取得API確認...');
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };
      const organizationsResponse = await axios.get(`${SIMPLE_API_URL}/organizations`, { headers });
      
      if (organizationsResponse.data.success) {
        console.log('✅ 組織一覧取得API正常に動作中');
        console.log(`📝 取得組織数: ${organizationsResponse.data.data.length}`);
      } else {
        console.log('❌ 組織一覧取得API応答異常:', organizationsResponse.data);
      }
    } catch (error) {
      console.log('❌ 組織一覧取得APIエラー:', error.message);
      if (error.response) {
        console.log('📝 エラー詳細:', error.response.data);
        console.log('📝 エラーステータス:', error.response.status);
      }
    }
    
    // 5. APIルートの確認
    console.log('\n[5] 登録済みルート確認...');
    try {
      const appRoutes = await axios.get(`${API_URL}/api/debug/routes`);
      console.log('✅ 登録ルート一覧:');
      console.log(JSON.stringify(appRoutes.data, null, 2));
    } catch (error) {
      console.log('ℹ️ ルート一覧APIは利用できません');
      // サーバーエンドポイントをチェック
      console.log('\n代替チェック - サーバー構成確認中...');
      
      try {
        const response = await axios.get(API_URL);
        console.log(`📝 サーバー応答: ${response.status}`);
      } catch (err) {
        console.log('📝 サーバー応答エラー');
      }
    }
    
    console.log('\n===== テスト完了 =====');
    return true;
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// テスト実行
runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('予期せぬエラー:', error);
    process.exit(1);
  });