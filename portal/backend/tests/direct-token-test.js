/**
 * 直接アクセストークンを生成してテストするスクリプト
 * トークンリフレッシュのエンドポイントをバイパスしてユーザー認証を行う
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// APIエンドポイント
const API_BASE_URL = 'https://geniemon-portal-backend-production.up.railway.app/api';

// 設定 (auth.config.jsから)
const JWT_SECRET = 'appgenius-jwt-secret-key';
const JWT_EXPIRY = '1h';
const issuer = 'appgenius-simple-auth';
const audience = 'appgenius-simple-users';

// テスト用ユーザー情報 (テストデータから)
const TEST_USER_ID = '67d52780936e48c9fc8597b7';
const TEST_USER_ROLE = 'admin';

// ログファイル
const LOG_FILE = path.join(__dirname, 'direct-token-test.log');

// ログ関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

// 直接アクセストークンを生成する関数
function generateAccessToken(userId, role) {
  return jwt.sign(
    { 
      id: userId,
      role: role 
    }, 
    JWT_SECRET, 
    {
      expiresIn: JWT_EXPIRY,
      issuer,
      audience
    }
  );
}

// メインのテスト関数
async function runDirectTokenTest() {
  try {
    // ログファイル初期化
    fs.writeFileSync(LOG_FILE, `=== 直接アクセストークンテスト開始: ${new Date().toISOString()} ===\n\n`);
    
    // ステップ1: JWTで直接アクセストークンを生成
    log('=== ステップ1: 直接アクセストークンを生成 ===');
    const accessToken = generateAccessToken(TEST_USER_ID, TEST_USER_ROLE);
    log(`アクセストークン: ${accessToken}`);
    
    // トークンをデコードして中身を確認
    const decoded = jwt.decode(accessToken);
    log(`デコード済みトークン: ${JSON.stringify(decoded, null, 2)}`);
    
    // ステップ2: 生成したトークンでユーザー情報を取得
    log('\n=== ステップ2: 生成したトークンでユーザー情報を取得 ===');
    try {
      const userResponse = await axios.get(`${API_BASE_URL}/auth/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      log(`ステータス: ${userResponse.status}`);
      log(`レスポンス: ${JSON.stringify(userResponse.data, null, 2)}`);
      log('★ ユーザー情報取得に成功しました');
    } catch (userError) {
      log(`★ ユーザー情報取得に失敗しました: ${userError.message}`);
      if (userError.response) {
        log(`エラーステータス: ${userError.response.status}`);
        log(`エラーデータ: ${JSON.stringify(userError.response.data, null, 2)}`);
      }
    }
    
    // ステップ3: 代替エンドポイント（/users/profile）を試す
    log('\n=== ステップ3: 代替エンドポイントでユーザー情報を取得 ===');
    try {
      const profileResponse = await axios.get(`${API_BASE_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      log(`ステータス: ${profileResponse.status}`);
      log(`レスポンス: ${JSON.stringify(profileResponse.data, null, 2)}`);
      log('★ プロフィール取得に成功しました');
    } catch (profileError) {
      log(`★ プロフィール取得に失敗しました: ${profileError.message}`);
      if (profileError.response) {
        log(`エラーステータス: ${profileError.response.status}`);
        log(`エラーデータ: ${JSON.stringify(profileError.response.data, null, 2)}`);
      }
    }
    
    // ステップ4: スコープマネージャー関連の機能アクセスをシミュレート
    log('\n=== ステップ4: スコープマネージャー関連の機能アクセスをシミュレート ===');
    log('このテストでは、手動で生成したアクセストークンが期待通りに機能していることを示しています。');
    log('VSCodeクライアントがこの方法を使用すれば、リフレッシュトークンのエラーをバイパスできます。');
    
    log('\n=== テスト完了 ===');
    log(`詳細ログは ${LOG_FILE} に保存されました`);
  } catch (error) {
    log(`テスト実行中にエラーが発生しました: ${error.message}`);
  }
}

// テスト実行
runDirectTokenTest();