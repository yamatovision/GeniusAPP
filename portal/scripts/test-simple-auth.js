/**
 * Simple認証フローのテスト
 * 
 * 使用方法:
 * node scripts/test-simple-auth.js
 */

require('dotenv').config();
const axios = require('axios');

// テスト設定
const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const SIMPLE_API_URL = `${BASE_URL}/simple`;

console.log(`Testing with BASE_URL: ${BASE_URL}`);

// テストユーザー
const TEST_USER = {
  email: 'lisence@mikoto.co.jp',
  password: 'Mikoto@123'
};

// テスト関数
async function testSimpleAuthFlow() {
  console.log('===== Simple認証フローテスト開始 =====');
  console.log(`API URL: ${SIMPLE_API_URL}`);
  
  try {
    // ステップ1: ログイン
    console.log('\n1. ログインテスト...');
    const loginResponse = await axios.post(`${SIMPLE_API_URL}/auth/login`, TEST_USER);
    
    if (!loginResponse.data.success) {
      throw new Error('ログインに失敗しました: ' + JSON.stringify(loginResponse.data));
    }
    
    const { accessToken, refreshToken } = loginResponse.data.data;
    console.log('✅ ログイン成功');
    console.log(`アクセストークン: ${accessToken.substring(0, 15)}...`);
    console.log(`リフレッシュトークン: ${refreshToken.substring(0, 15)}...`);
    
    // ステップ2: 認証チェック
    console.log('\n2. 認証チェックテスト...');
    const checkResponse = await axios.get(
      `${SIMPLE_API_URL}/auth/check`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!checkResponse.data.success) {
      throw new Error('認証チェックに失敗しました: ' + JSON.stringify(checkResponse.data));
    }
    
    console.log('✅ 認証チェック成功');
    console.log(`ユーザー情報: ${JSON.stringify(checkResponse.data.data.user, null, 2)}`);
    
    // ステップ3: トークンリフレッシュ
    console.log('\n3. トークンリフレッシュテスト...');
    const refreshResponse = await axios.post(
      `${SIMPLE_API_URL}/auth/refresh-token`,
      { refreshToken }
    );
    
    if (!refreshResponse.data.success) {
      throw new Error('トークンリフレッシュに失敗しました: ' + JSON.stringify(refreshResponse.data));
    }
    
    const newAccessToken = refreshResponse.data.data.accessToken;
    const newRefreshToken = refreshResponse.data.data.refreshToken;
    
    console.log('✅ トークンリフレッシュ成功');
    console.log(`新しいアクセストークン: ${newAccessToken.substring(0, 15)}...`);
    console.log(`新しいリフレッシュトークン: ${newRefreshToken.substring(0, 15)}...`);
    
    // ステップ4: 組織一覧取得（新しいトークンを使用）
    console.log('\n4. 組織一覧取得テスト...');
    const orgsResponse = await axios.get(
      `${SIMPLE_API_URL}/organizations`,
      { headers: { Authorization: `Bearer ${newAccessToken}` } }
    );
    
    if (!orgsResponse.data.success) {
      throw new Error('組織一覧取得に失敗しました: ' + JSON.stringify(orgsResponse.data));
    }
    
    console.log('✅ 組織一覧取得成功');
    console.log(`組織数: ${orgsResponse.data.data.length}`);
    if (orgsResponse.data.data.length > 0) {
      console.log(`最初の組織: ${JSON.stringify(orgsResponse.data.data[0], null, 2)}`);
    }
    
    // ステップ5: ログアウト
    console.log('\n5. ログアウトテスト...');
    const logoutResponse = await axios.post(
      `${SIMPLE_API_URL}/auth/logout`,
      { refreshToken: newRefreshToken }
    );
    
    if (!logoutResponse.data.success) {
      throw new Error('ログアウトに失敗しました: ' + JSON.stringify(logoutResponse.data));
    }
    
    console.log('✅ ログアウト成功');
    
    console.log('\n===== テスト結果: 全テスト成功 =====');
  } catch (error) {
    console.error('\n❌ テスト失敗:');
    
    if (error.response) {
      console.error(`ステータスコード: ${error.response.status}`);
      console.error(`レスポンスデータ: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message || error);
    }
    
    console.log('\n===== テスト結果: 失敗 =====');
  }
}

// テスト実行
testSimpleAuthFlow();