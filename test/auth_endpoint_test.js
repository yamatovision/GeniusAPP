/**
 * 認証APIのシンプルなテスト
 * 修正後のエンドポイントURLが正しく機能するかを確認
 */
const axios = require('axios');
const fs = require('fs');

// テスト設定
const API_BASE_URL = 'https://geniemon-portal-backend-production.up.railway.app/api';
const TEST_EMAIL = 'lisence@mikoto.co.jp';
const TEST_PASSWORD = 'Mikoto@123';
const CLIENT_ID = 'appgenius_vscode_client_29a7fb3e';
const CLIENT_SECRET = 'appgenius_refresh_token_secret_key_for_production';

// ロギング関数
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// APIエンドポイントテスト関数
async function testEndpoint(url, options = {}) {
  try {
    log(`エンドポイントテスト開始: ${url}`);
    const response = await axios({
      url,
      ...options,
      timeout: 10000
    });
    
    log(`ステータス: ${response.status} ${response.statusText}`);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    log(`エラー: ${error.message}`);
    if (error.response) {
      log(`エラーステータス: ${error.response.status}`);
      log(`エラーデータ:`, error.response.data);
    }
    return {
      success: false,
      status: error.response?.status,
      error: error.message,
      data: error.response?.data
    };
  }
}

// メイン実行関数
async function main() {
  log('認証APIテスト開始');
  
  // 1. ヘルスチェック
  log('\n=== 1. ヘルスチェック ===');
  const healthResult = await testEndpoint(`${API_BASE_URL}/auth/health`);
  
  // 2. ログインテスト
  log('\n=== 2. ログインテスト ===');
  const loginResult = await testEndpoint(`${API_BASE_URL}/auth/login`, {
    method: 'post',
    data: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    }
  });
  
  if (!loginResult.success) {
    log('ログイン失敗。以降のテストをスキップします。');
    return;
  }
  
  const token = loginResult.data.accessToken;
  log(`アクセストークン: ${token.substring(0, 20)}...`);
  
  // 3. 修正前のエンドポイント（/users/me）テスト
  log('\n=== 3. 修正前のエンドポイント（/users/me）テスト ===');
  const oldEndpointResult = await testEndpoint(`${API_BASE_URL}/users/me`, {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // 4. 修正後のエンドポイント（/auth/users/me）テスト
  log('\n=== 4. 修正後のエンドポイント（/auth/users/me）テスト ===');
  const newEndpointResult = await testEndpoint(`${API_BASE_URL}/auth/users/me`, {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // 5. 結果サマリー
  log('\n=== 5. テスト結果サマリー ===');
  log(`ヘルスチェック: ${healthResult.success ? '成功' : '失敗'}`);
  log(`ログイン: ${loginResult.success ? '成功' : '失敗'}`);
  log(`修正前のエンドポイント: ${oldEndpointResult.success ? '成功' : '失敗'}`);
  log(`修正後のエンドポイント: ${newEndpointResult.success ? '成功' : '失敗'}`);
  
  // 問題の確認
  if (!oldEndpointResult.success && newEndpointResult.success) {
    log('\n問題の診断: 正しいエンドポイントは /auth/users/me です。変更が正しく行われました。');
  } else if (oldEndpointResult.success && newEndpointResult.success) {
    log('\n問題の診断: 両方のエンドポイントが機能しています。どちらのパスでも問題ありません。');
  } else if (!oldEndpointResult.success && !newEndpointResult.success) {
    log('\n問題の診断: 両方のエンドポイントが失敗しています。認証に問題がある可能性があります。');
  } else {
    log('\n問題の診断: 予期しない結果です。詳細な調査が必要です。');
  }
}

// テスト実行
main().catch(error => {
  log(`予期しないエラーが発生しました: ${error.message}`);
});