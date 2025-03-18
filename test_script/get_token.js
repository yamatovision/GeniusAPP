/**
 * アクセストークン取得テストスクリプト
 */
const axios = require('axios');

// ログイン情報
const email = 'lisence@mikoto.co.jp';
const password = 'Mikoto@123';
const clientId = 'appgenius_vscode_client_29a7fb3e';
const clientSecret = 'appgenius_refresh_token_secret_key_for_production';

// APIエンドポイント
const apiUrl = 'https://geniemon-portal-backend-production.up.railway.app/api';

async function getToken() {
  try {
    console.log('認証APIにログインリクエストを送信しています...');
    
    // 認証APIを呼び出し
    const response = await axios.post(`${apiUrl}/auth/login`, {
      email,
      password,
      clientId,
      clientSecret
    }, {
      timeout: 10000
    });
    
    if (response.status === 200 && response.data.accessToken) {
      console.log('ログイン成功！');
      console.log('アクセストークン:', response.data.accessToken);
      console.log('リフレッシュトークン:', response.data.refreshToken);
      console.log('有効期限:', response.data.expiresIn || 86400, '秒');
      console.log('ユーザー情報:', response.data.user);
      
      return response.data.accessToken;
    } else {
      console.error('レスポンスが無効です:', response.data);
      return null;
    }
  } catch (error) {
    console.error('ログインエラー:', error.message);
    if (error.response) {
      console.error('ステータスコード:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    }
    return null;
  }
}

// トークンを取得して表示
getToken().then(token => {
  if (token) {
    console.log('\nこのトークンを使用して使用量APIエンドポイントをテストできます。');
  } else {
    console.log('トークンの取得に失敗しました。');
  }
});