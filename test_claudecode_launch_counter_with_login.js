/**
 * ログイン認証してからClaudeCode起動カウンターを更新するスクリプト
 */

const axios = require('axios');

// 設定
const BASE_URL = 'https://appgenius-portal-backend-235426778039.asia-northeast1.run.app/api';
const USER_ID = '67e207d18ccc8aab3e3b6a8f'; // シラン.タツヤさんのID
const EMAIL = 'shiraishi.tatsuya@mikoto.co.jp';
const PASSWORD = 'aikakumei';

// 認証してからカウンターを更新する関数
async function loginAndIncrementCounter() {
  try {
    console.log('=== ログイン処理開始 ===');
    // 1. ログイン処理
    const loginResponse = await axios.post(`${BASE_URL}/simple/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      console.error('ログインに失敗しました:', loginResponse.data);
      return false;
    }
    
    console.log('ログイン成功!');
    const token = loginResponse.data.token;
    console.log(`認証トークン取得: ${token.substring(0, 10)}...`);
    
    // 2. 認証ヘッダーを設定
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('\n=== ユーザープロフィール確認 ===');
    // 3. プロフィール情報を取得して確認
    const profileResponse = await axios.get(`${BASE_URL}/simple/users/profile`, { headers });
    const user = profileResponse.data.data.user;
    
    console.log(`ユーザー名: ${user.name}`);
    console.log(`メールアドレス: ${user.email}`);
    console.log(`ロール: ${user.role}`);
    console.log(`現在のClaudeCode起動カウント: ${user.claudeCodeLaunchCount || 0}`);
    
    console.log('\n=== ClaudeCode起動カウンター更新処理 ===');
    // 4. ClaudeCode起動カウンターを更新
    const counterUrl = `${BASE_URL}/simple/users/${USER_ID}/increment-claude-code-launch`;
    console.log(`API呼び出しURL: ${counterUrl}`);
    
    const response = await axios.post(counterUrl, {}, { headers });
    
    // レスポンス分析
    console.log(`API呼び出しステータス: ${response.status}`);
    console.log(`APIレスポンス: ${JSON.stringify(response.data)}`);
    
    if (response.status === 200) {
      const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
      const isSuccess = response.data?.success === true;
      console.log(`\nClaudeCode起動カウンター更新成功: 新しい値=${newCount}, 成功フラグ=${isSuccess}`);
      return true;
    }
    
    console.log(`\nClaudeCode起動カウンター更新：予期しないレスポンス (${response.status})`);
    return false;
  } catch (error) {
    console.error('エラーが発生しました:', error);
    
    // エラーの詳細を分析
    if (error.response) {
      console.error(`APIエラー: ステータス=${error.response.status}, データ=${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error(`APIエラー: リクエストは送信されましたがレスポンスがありません`);
    } else {
      console.error(`APIエラー: リクエスト設定中にエラーが発生しました: ${error.message}`);
    }
    
    return false;
  }
}

// スクリプト実行
loginAndIncrementCounter()
  .then(success => {
    console.log(`\n=== 実行結果 ===`);
    console.log(`APIリクエスト結果: ${success ? '成功' : '失敗'}`);
    
    if (success) {
      console.log('\nカウンターが正常に更新されました。ダッシュボードで確認してください。');
    } else {
      console.log('\n問題が発生しました。エラーメッセージを確認してください。');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('予期しないエラーが発生しました:', err);
    process.exit(1);
  });