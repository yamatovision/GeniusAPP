/**
 * ClaudeCode起動カウンターを直接更新するスクリプト
 * 元のデプロイ環境でのテスト用
 */

const axios = require('axios');

// 設定
const BASE_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api'; // 元のバックエンドURL
const USER_ID = '67e207d18ccc8aab3e3b6a8f'; // シラン.タツヤさんのID（固定値）
const EMAIL = 'lisence@mikoto.co.jp'; // デプロイ用テスト認証情報
const PASSWORD = 'Mikoto@123'; // デプロイ用テスト認証情報

// ログイン関数
async function login() {
  console.log('=== ログイン処理開始 ===\n');
  
  try {
    const response = await axios.post(`${BASE_URL}/simple/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (response.status === 200 && response.data && response.data.accessToken) {
      console.log('ログイン成功!');
      console.log(`認証トークン取得: ${response.data.accessToken.substring(0, 20)}...\n`);
      return response.data.accessToken;
    } else if (response.data.data && response.data.data.accessToken) {
      // 新しいレスポンス形式の場合
      console.log('ログイン成功! (新しいレスポンス形式)');
      console.log(`認証トークン取得: ${response.data.data.accessToken.substring(0, 20)}...\n`);
      
      // ユーザー情報も表示
      const user = response.data.data.user;
      if (user) {
        console.log(`ユーザー名: ${user.name || '不明'}`);
        console.log(`メール: ${user.email || '不明'}`);
        console.log(`ID: ${user.id || '不明'}`);
        console.log(`ロール: ${user.role || '不明'}\n`);
      }
      
      return response.data.data.accessToken;
    } else {
      console.log('ログイン応答形式が不正です:', response.data);
      return null;
    }
  } catch (error) {
    console.error('ログイン中にエラーが発生しました:', error.message);
    if (error.response) {
      console.error(`ステータスコード: ${error.response.status}`);
      console.error('レスポンスデータ:', error.response.data);
    }
    return null;
  }
}

// ClaudeCode起動カウンターを直接更新する関数
async function incrementClaudeCodeLaunchCount(accessToken) {
  try {
    console.log(`ClaudeCode起動カウンターを更新します: ユーザーID ${USER_ID}`);
    
    // ヘッダーを設定
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    // APIエンドポイントURL
    const url = `${BASE_URL}/simple/users/${USER_ID}/increment-claude-code-launch`;
    console.log(`API呼び出しURL: ${url}`);
    
    // APIリクエスト送信
    console.log('API呼び出し開始...');
    const response = await axios.post(url, {}, { headers });
    
    // レスポンス分析
    console.log(`API呼び出しステータス: ${response.status}`);
    console.log(`APIレスポンス: ${JSON.stringify(response.data, null, 2)}`);
    
    if (response.status === 200) {
      let newCount = 'N/A';
      let isSuccess = false;
      
      // 古いレスポンス形式
      if (response.data && response.data.claudeCodeLaunchCount) {
        newCount = response.data.claudeCodeLaunchCount;
        isSuccess = true;
      }
      // 新しいレスポンス形式
      else if (response.data && response.data.success && response.data.data) {
        newCount = response.data.data.claudeCodeLaunchCount || 'N/A';
        isSuccess = response.data.success;
      }
      
      console.log(`\n✅ ClaudeCode起動カウンター更新成功: 新しい値=${newCount}, 成功フラグ=${isSuccess}`);
      return true;
    }
    
    console.log(`\n❌ ClaudeCode起動カウンター更新失敗: 予期しないレスポンス (${response.status})`);
    return false;
  } catch (error) {
    console.error('\n❌ ClaudeCode起動カウンター更新エラー:', error.message);
    
    // エラーの詳細を分析
    if (error.response) {
      console.error(`APIエラー: ステータス=${error.response.status}, データ=${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('APIエラー: リクエストは送信されましたがレスポンスがありません');
    } else {
      console.error(`APIエラー: リクエスト設定中にエラーが発生しました: ${error.message}`);
    }
    
    return false;
  }
}

// メイン実行
async function main() {
  console.log('==================================================');
  console.log('  ClaudeCode起動カウンター直接更新テスト');
  console.log('  元のバックエンドURL: ' + BASE_URL);
  console.log('==================================================\n');
  
  // ログイン
  const accessToken = await login();
  if (!accessToken) {
    console.error('\n認証に失敗しました。テストを中止します。');
    return;
  }
  
  // プロフィール取得はスキップ（エンドポイントが見つからないため）
  console.log('プロフィール取得はスキップします（エンドポイントが見つからないため）\n');
  
  // カウンター更新
  console.log('\n=== カウンター更新テスト実行 ===\n');
  const success = await incrementClaudeCodeLaunchCount(accessToken);
  
  console.log('\n==================================================');
  console.log(`=== 実行結果 ===`);
  console.log(`APIリクエスト結果: ${success ? '成功' : '失敗'}`);
  console.log();
  
  if (success) {
    console.log('カウンターが正常に更新されました。ダッシュボードで確認してください。');
  } else {
    console.log('問題が発生しました。エラーメッセージを確認してください。');
  }
  console.log('==================================================');
}

// 実行
main().catch(console.error);