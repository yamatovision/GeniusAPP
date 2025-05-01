/**
 * ClaudeCode起動カウンターのテスト
 * 
 * このスクリプトは、ClaudeCode起動カウンターの動作を検証します。
 * 1. 現在のユーザーの起動カウント値を取得
 * 2. カウンターをインクリメント
 * 3. 更新後のカウント値を取得して変化を確認
 */

const axios = require('axios');
const readline = require('readline');

// ベースURL設定
const BASE_URL = 'http://localhost:3000/api';

// ユーザー入力を受け付ける関数
const getUserInput = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

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
    // アクセストークンの入力を受け付ける
    const token = await getUserInput('アクセストークンを入力してください: ');
    
    // ユーザー情報を取得
    console.log('現在のユーザー情報を取得中...');
    const userResponse = await callApi('get', '/simple/auth/users/me', null, token);
    
    if (!userResponse.success) {
      throw new Error('ユーザー情報の取得に失敗しました');
    }
    
    const user = userResponse.data.user;
    console.log(`ユーザー情報取得成功: ${user.name} (ID: ${user._id})`);
    console.log(`現在のClaudeCode起動カウント: ${user.claudeCodeLaunchCount || 0}`);
    
    // カウンターをインクリメント
    console.log('ClaudeCode起動カウンターをインクリメント中...');
    const incrementResponse = await callApi('post', `/simple/users/${user._id}/increment-claude-code-launch`, {}, token);
    
    if (!incrementResponse.success) {
      throw new Error('カウンターのインクリメントに失敗しました');
    }
    
    console.log(`カウンターインクリメント成功: 新しい値は ${incrementResponse.data.claudeCodeLaunchCount}`);
    
    // 更新後のユーザー情報を再取得
    console.log('更新後のユーザー情報を取得中...');
    const updatedUserResponse = await callApi('get', '/simple/auth/users/me', null, token);
    
    if (!updatedUserResponse.success) {
      throw new Error('更新後のユーザー情報の取得に失敗しました');
    }
    
    const updatedUser = updatedUserResponse.data.user;
    console.log(`更新後のClaudeCode起動カウント: ${updatedUser.claudeCodeLaunchCount || 0}`);
    
    // 変化を確認
    const initialCount = user.claudeCodeLaunchCount || 0;
    const updatedCount = updatedUser.claudeCodeLaunchCount || 0;
    
    console.log(`\n結果: カウンターは ${initialCount} から ${updatedCount} に更新されました (差分: ${updatedCount - initialCount})`);
    
    if (updatedCount > initialCount) {
      console.log('✅ テスト成功: カウンターは正常にインクリメントされました');
    } else {
      console.log('❌ テスト失敗: カウンターの値が更新されていません');
    }
    
  } catch (error) {
    console.error('テスト実行エラー:', error.message);
  }
};

// スクリプト実行
main();