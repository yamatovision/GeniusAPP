/**
 * AuthenticationService を使用したSimpleAuth APIエンドポイントのテスト
 * 認証サービスの実際の動作を検証します
 */
const axios = require('axios');

// 認証サービスのURL
const AUTH_API_URL = 'http://localhost:5000/api';

// 認証情報
const TEST_EMAIL = 'metavicer2@gmail.com';
const TEST_PASSWORD = 'Mikoto@123'; 

// ログ出力関数
const logSuccess = (message) => console.log(`\x1b[32m✅ ${message}\x1b[0m`);
const logError = (message) => console.log(`\x1b[31m❌ ${message}\x1b[0m`);
const logInfo = (message) => console.log(`\x1b[36mℹ️ ${message}\x1b[0m`);

// SimpleAuth APIのテスト - 修正した認証サービス仕様に基づいてテスト
async function runAuthServiceTests() {
  console.log('=========================================');
  console.log('AuthenticationService SimpleAuth APIテスト開始');
  console.log('=========================================');
  
  let accessToken = null;
  let refreshToken = null;
  
  try {
    // 1. ログインテスト
    logInfo('1. SimpleAuth ログインテスト');
    const loginResponse = await axios.post(`${AUTH_API_URL}/simple/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (loginResponse.status === 200 && loginResponse.data.success && loginResponse.data.data.accessToken) {
      logSuccess('ログイン成功');
      
      // トークンを保存
      accessToken = loginResponse.data.data.accessToken;
      refreshToken = loginResponse.data.data.refreshToken;
      
      logInfo(`- アクセストークン: ${accessToken.substring(0, 20)}...`);
      logInfo(`- リフレッシュトークン: ${refreshToken.substring(0, 20)}...`);
      logInfo(`- ユーザー情報:`);
      console.log(loginResponse.data.data.user);
      
      // 2. ユーザー情報取得テスト
      logInfo('\n2. SimpleAuth ユーザー情報取得テスト (/simple/auth/check)');
      const userCheckResponse = await axios.get(`${AUTH_API_URL}/simple/auth/check`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (userCheckResponse.status === 200 && userCheckResponse.data.success) {
        logSuccess('ユーザー情報取得成功');
        logInfo('- ユーザー情報:');
        console.log(userCheckResponse.data.data.user);
      } else {
        logError(`ユーザー情報取得失敗: ${JSON.stringify(userCheckResponse.data)}`);
      }
      
      // 3. トークンリフレッシュテスト
      logInfo('\n3. SimpleAuth トークンリフレッシュテスト');
      const refreshResponse = await axios.post(`${AUTH_API_URL}/simple/auth/refresh-token`, {
        refreshToken
      });
      
      if (refreshResponse.status === 200 && refreshResponse.data.success) {
        logSuccess('トークンリフレッシュ成功');
        
        // 新しいトークンを保存
        const oldAccessToken = accessToken;
        accessToken = refreshResponse.data.data.accessToken;
        refreshToken = refreshResponse.data.data.refreshToken;
        
        logInfo(`- 新しいアクセストークン: ${accessToken.substring(0, 20)}...`);
        logInfo(`- 新しいリフレッシュトークン: ${refreshToken.substring(0, 20)}...`);
        
        // トークンが変更されたことを確認
        if (oldAccessToken === accessToken) {
          logError('アクセストークンが更新されていません');
        } else {
          logSuccess('アクセストークンが正常に更新されました');
        }
        
        // リフレッシュ後のトークンでユーザー情報取得を検証
        logInfo('\n- リフレッシュ後のトークンでユーザー情報取得テスト:');
        const refreshedCheckResponse = await axios.get(`${AUTH_API_URL}/simple/auth/check`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (refreshedCheckResponse.status === 200 && refreshedCheckResponse.data.success) {
          logSuccess('リフレッシュ後のトークンでユーザー情報取得成功');
        } else {
          logError(`リフレッシュ後のユーザー情報取得失敗: ${JSON.stringify(refreshedCheckResponse.data)}`);
        }
      } else {
        logError(`トークンリフレッシュ失敗: ${JSON.stringify(refreshResponse.data)}`);
      }
      
      // 4. ログアウトテスト
      logInfo('\n4. SimpleAuth ログアウトテスト');
      const logoutResponse = await axios.post(`${AUTH_API_URL}/simple/auth/logout`, {
        refreshToken
      });
      
      if (logoutResponse.status === 200 && logoutResponse.data.success) {
        logSuccess('ログアウト成功');
        
        // ログアウト後のトークンでユーザー情報取得を試行（失敗するべき）
        try {
          await axios.get(`${AUTH_API_URL}/simple/auth/check`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          logError('ログアウト後もトークンが有効です（期待と異なる結果）');
        } catch (error) {
          if (error.response && error.response.status === 401) {
            logSuccess('ログアウト後のトークンが適切に無効化されています');
          } else {
            logError(`予期しないエラー: ${error.message}`);
          }
        }
      } else {
        logError(`ログアウト失敗: ${JSON.stringify(logoutResponse.data)}`);
      }
    } else {
      logError(`ログイン失敗: ${JSON.stringify(loginResponse.data)}`);
    }
  } catch (error) {
    logError('テスト実行中にエラーが発生しました:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
  
  console.log('\n=========================================');
  console.log('SimpleAuth APIテストが完了しました');
  console.log('=========================================');
}

// テスト実行
runAuthServiceTests().catch(err => {
  logError('テスト実行中に予期しないエラーが発生しました:');
  console.error(err);
});