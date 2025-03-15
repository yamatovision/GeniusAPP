/**
 * 認証API実行テスト
 * 指定されたアカウントでのログインをテストします
 */

const axios = require('axios');
const API_URL = 'http://localhost:5000/api/auth';

async function testLogin() {
  console.log('=== ログイン機能テスト ===');
  
  const credentials = {
    email: "lisence@mikoto.co.jp",
    password: "Mikoto@123"
  };
  
  try {
    console.log(`${credentials.email} でログイン試行中...`);
    const response = await axios.post(`${API_URL}/login`, credentials);
    
    console.log('✅ ログイン成功!');
    console.log('--- レスポンス情報 ---');
    console.log(`アクセストークン: ${response.data.accessToken ? '取得済み' : '取得失敗'}`);
    console.log(`リフレッシュトークン: ${response.data.refreshToken ? '取得済み' : '取得失敗'}`);
    
    if (response.data.user) {
      console.log('--- ユーザー情報 ---');
      console.log(`名前: ${response.data.user.name}`);
      console.log(`メール: ${response.data.user.email}`);
      console.log(`権限: ${response.data.user.role}`);
      console.log(`アカウント状態: ${response.data.user.isActive ? 'アクティブ' : '無効'}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ ログイン失敗!');
    
    if (error.response) {
      console.log('--- エラー情報 ---');
      console.log(`ステータス: ${error.response.status}`);
      console.log(`メッセージ: ${error.response.data.error ? error.response.data.error.message : 'エラー詳細なし'}`);
      console.log(`コード: ${error.response.data.error ? error.response.data.error.code : 'エラーコードなし'}`);
      console.log('\n--- 完全なエラーレスポンス ---');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('--- エラー情報 ---');
      console.log(`メッセージ: ${error.message}`);
    }
    
    return false;
  }
}

async function main() {
  console.log('認証API機能テスト開始');
  console.log('サーバー接続先:', API_URL);
  
  // サーバー接続確認
  try {
    await axios.get(API_URL.replace('/auth', '/health-check'));
    console.log('✅ APIサーバー接続成功');
  } catch (error) {
    console.log('❌ APIサーバー接続失敗');
    console.log('エラー:', error.message);
    console.log('テストを中止します。サーバーが起動しているか確認してください。');
    return;
  }
  
  // ログインテスト実行
  await testLogin();
}

main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
});