/**
 * SimpleUserのデータを確認するスクリプト
 * ログイン認証を行い、ユーザーデータ（ClaudeCode起動カウンター含む）を取得します
 */

const axios = require('axios');

// 設定
const BASE_URL = 'http://localhost:3000/api';
const EMAIL = 'shiraishi.tatsuya@mikoto.co.jp';
const PASSWORD = 'aikakumei';

// APIを呼び出す関数
const callApi = async (method, endpoint, data = null, token = null) => {
  try {
    const config = {
      headers: {}
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    if (method === 'get') {
      response = await axios.get(`${BASE_URL}${endpoint}`, config);
    } else if (method === 'post') {
      response = await axios.post(`${BASE_URL}${endpoint}`, data, config);
    }

    return response.data;
  } catch (error) {
    console.error('API呼び出しエラー:', error.response?.data || error.message);
    throw error;
  }
};

// メイン処理
const main = async () => {
  try {
    // 1. ログイン認証を行い、トークンを取得
    console.log('ログイン中...');
    const loginResponse = await callApi('post', '/simple/auth/login', {
      email: EMAIL,
      password: PASSWORD
    });
    
    console.log('ログインレスポンス:', JSON.stringify(loginResponse, null, 2));
    
    // レスポンス構造に応じてトークンを取得
    let token;
    if (loginResponse.token) {
      token = loginResponse.token;
    } else if (loginResponse.data && loginResponse.data.accessToken) {
      token = loginResponse.data.accessToken;
    } else if (loginResponse.accessToken) {
      token = loginResponse.accessToken;
    } else {
      throw new Error('トークンが見つかりません：' + JSON.stringify(loginResponse));
    }
    console.log('ログイン成功: トークンを取得しました');
    
    // 2. ユーザー情報を取得
    console.log('\n現在のユーザー情報を取得中...');
    const userResponse = await callApi('get', '/simple/auth/users/me', null, token);
    
    if (!userResponse.success) {
      throw new Error('ユーザー情報の取得に失敗しました');
    }
    
    const user = userResponse.data.user;
    console.log('===== ユーザー情報 =====');
    console.log(`ID: ${user._id}`);
    console.log(`名前: ${user.name}`);
    console.log(`メール: ${user.email}`);
    console.log(`役割: ${user.role}`);
    console.log(`ClaudeCode起動カウント: ${user.claudeCodeLaunchCount || 0}`);
    console.log(`最終更新: ${user.updatedAt}`);
    
    // 3. 組織情報を取得（存在する場合）
    if (user.organizationId) {
      console.log('\n組織情報を取得中...');
      const orgResponse = await callApi('get', `/simple/organizations/${user.organizationId}`, null, token);
      
      if (orgResponse.success) {
        const org = orgResponse.data;
        console.log('===== 組織情報 =====');
        console.log(`組織名: ${org.name}`);
        console.log(`説明: ${org.description || '説明なし'}`);
      }
    }
    
    // 4. ユーザー一覧を取得してClaudeCode起動カウンターを比較
    console.log('\nユーザー一覧を取得中...');
    const usersResponse = await callApi('get', '/simple/users', null, token);
    
    if (usersResponse.success) {
      console.log('===== ユーザー一覧のClaudeCode起動カウンター =====');
      usersResponse.data.forEach(u => {
        console.log(`${u.name} (${u.email}): ${u.claudeCodeLaunchCount || 0}`);
      });
    }
    
    // 5. カウンターをインクリメントするかどうか尋ねる代わりに、直接インクリメント
    console.log('\nClaudeCode起動カウンターをインクリメント中...');
    const incrementResponse = await callApi('post', `/simple/users/${user._id}/increment-claude-code-launch`, {}, token);
    
    if (incrementResponse.success) {
      console.log(`インクリメント成功: 新しい値は ${incrementResponse.data.claudeCodeLaunchCount}`);
    } else {
      console.log('インクリメントに失敗しました');
    }
    
    // 6. 更新後のユーザー情報を再取得して確認
    console.log('\n更新後のユーザー情報を確認中...');
    const updatedUserResponse = await callApi('get', '/simple/auth/users/me', null, token);
    
    if (updatedUserResponse.success) {
      const updatedUser = updatedUserResponse.data.user;
      console.log('===== 更新後のユーザー情報 =====');
      console.log(`ID: ${updatedUser._id}`);
      console.log(`名前: ${updatedUser.name}`);
      console.log(`ClaudeCode起動カウント: ${updatedUser.claudeCodeLaunchCount || 0}`);
      console.log(`最終更新: ${updatedUser.updatedAt}`);
      
      // 変化を確認
      const initialCount = user.claudeCodeLaunchCount || 0;
      const updatedCount = updatedUser.claudeCodeLaunchCount || 0;
      
      console.log(`\n結果: カウンターは ${initialCount} から ${updatedCount} に更新されました (差分: ${updatedCount - initialCount})`);
      
      if (updatedCount > initialCount) {
        console.log('✅ テスト成功: カウンターは正常にインクリメントされました');
      } else {
        console.log('❌ テスト失敗: カウンターの値が更新されていません');
      }
    }
    
  } catch (error) {
    console.error('\nエラーが発生しました:', error.message);
  }
};

// スクリプト実行
main();