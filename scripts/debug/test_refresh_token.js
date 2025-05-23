const axios = require('axios');

// テスト用のリフレッシュトークン（実際のトークンに置き換える）
const REFRESH_TOKEN = process.argv[2];
const API_URL = 'https://bluelamp-235426778039.asia-northeast1.run.app/api/simple/auth/refresh-token';

async function testRefreshToken() {
  if (!REFRESH_TOKEN) {
    console.error('使用方法: node test_refresh_token.js <refresh_token>');
    process.exit(1);
  }

  console.log('リフレッシュトークンテスト開始');
  console.log('API URL:', API_URL);
  console.log('トークン（最初の20文字）:', REFRESH_TOKEN.substring(0, 20) + '...');
  console.log('トークン長:', REFRESH_TOKEN.length);
  console.log('----------------------------------------');

  try {
    const response = await axios.post(API_URL, {
      refreshToken: REFRESH_TOKEN
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ 成功レスポンス:');
    console.log('ステータス:', response.status);
    console.log('データ:', JSON.stringify(response.data, null, 2));
    
    if (response.data.data) {
      console.log('\n新しいトークン:');
      console.log('アクセストークン（最初の20文字）:', response.data.data.accessToken.substring(0, 20) + '...');
      console.log('リフレッシュトークン（最初の20文字）:', response.data.data.refreshToken.substring(0, 20) + '...');
    }
  } catch (error) {
    console.error('❌ エラーレスポンス:');
    if (error.response) {
      console.error('ステータス:', error.response.status);
      console.error('データ:', JSON.stringify(error.response.data, null, 2));
      console.error('ヘッダー:', error.response.headers);
    } else {
      console.error('ネットワークエラー:', error.message);
    }
  }
}

// JWTトークンのデコード（検証なし）
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

// トークンのデコード情報を表示
if (REFRESH_TOKEN && REFRESH_TOKEN.includes('.')) {
  console.log('\nトークンデコード情報:');
  const decoded = decodeJWT(REFRESH_TOKEN);
  if (decoded) {
    console.log('ペイロード:', JSON.stringify(decoded, null, 2));
    
    if (decoded.exp) {
      const expDate = new Date(decoded.exp * 1000);
      const now = new Date();
      console.log('有効期限:', expDate.toISOString());
      console.log('現在時刻:', now.toISOString());
      console.log('期限切れ:', expDate < now ? '✅ はい' : '❌ いいえ');
    }
  }
}

testRefreshToken();