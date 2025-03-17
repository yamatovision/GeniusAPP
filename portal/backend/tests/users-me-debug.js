/**
 * '/auth/users/me' エンドポイントのデバッグ用スクリプト
 * 500エラーの原因を特定するための詳細なテスト
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// APIエンドポイント
const API_BASE_URL = 'https://geniemon-portal-backend-production.up.railway.app/api';

// 認証情報（テスト用）
const TEST_EMAIL = 'lisence@mikoto.co.jp';
const TEST_PASSWORD = 'Mikoto@123';
const CLIENT_ID = 'appgenius_vscode_client_29a7fb3e';
const CLIENT_SECRET = 'appgenius_refresh_token_secret_key_for_production';

// テスト結果ログのパス
const LOG_FILE = path.join(__dirname, 'users-me-debug.log');

// ログ書き込み関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(LOG_FILE, logMessage);
}

// APIクライアント
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

// トークンの内容を解析して表示する関数
function decodeToken(token) {
  try {
    if (!token) return 'トークンがありません';
    
    // JWTのヘッダーとペイロードはBase64でエンコードされているので、デコードして表示
    const parts = token.split('.');
    if (parts.length < 2) return 'トークン形式が不正です';
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    return {
      header,
      payload,
      expiresAt: new Date(payload.exp * 1000).toISOString()
    };
  } catch (error) {
    return `トークン解析エラー: ${error.message}`;
  }
}

// メインのデバッグ関数
async function debugUsersMe() {
  try {
    // ログファイル初期化
    fs.writeFileSync(LOG_FILE, `=== /auth/users/me エンドポイントデバッグ: ${new Date().toISOString()} ===\n\n`);
    
    // ステップ1: ログイン
    log('=== ステップ1: ログイン ===');
    let accessToken, refreshToken;
    try {
      const loginResponse = await apiClient.post('/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET
      });
      
      accessToken = loginResponse.data.accessToken;
      refreshToken = loginResponse.data.refreshToken;
      
      log('ログイン成功');
      log(`アクセストークン: ${accessToken.substring(0, 20)}...`);
      log(`リフレッシュトークン: ${refreshToken.substring(0, 20)}...`);
      
      // トークンの解析と表示
      log('\nアクセストークン詳細:');
      log(JSON.stringify(decodeToken(accessToken), null, 2));
    } catch (loginError) {
      log(`ログイン失敗: ${loginError.message}`);
      if (loginError.response) {
        log(`ステータス: ${loginError.response.status}`);
        log(`レスポンス: ${JSON.stringify(loginError.response.data)}`);
      }
      throw new Error('ログインに失敗しました。以降のテストは中止します。');
    }
    
    // ステップ2: 詳細デバッグ情報のリクエスト
    log('\n=== ステップ2: /auth/users/me エンドポイントの詳細デバッグ情報リクエスト ===');
    try {
      // デバッグ用ヘッダーを追加（サーバー側でデバッグ情報を返すよう設定、サーバー側でサポートされていれば）
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'X-Debug-Mode': 'true',
        'X-Debug-Level': 'verbose'
      };
      
      // リクエスト開始時間を記録
      const startTime = Date.now();
      
      log(`リクエスト開始: GET ${API_BASE_URL}/auth/users/me`);
      log(`リクエストヘッダー: ${JSON.stringify(headers)}`);
      
      // リクエスト実行
      const response = await apiClient.get('/auth/users/me', { headers });
      
      // レスポンス時間を計算
      const responseTime = Date.now() - startTime;
      
      log(`リクエスト成功 (${responseTime}ms)`);
      log(`レスポンスステータス: ${response.status} ${response.statusText}`);
      log(`レスポンスヘッダー: ${JSON.stringify(response.headers)}`);
      log(`レスポンスデータ: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      // エラー情報の詳細な記録
      const responseTime = Date.now() - startTime;
      
      log(`リクエスト失敗 (${responseTime}ms): ${error.message}`);
      
      if (error.response) {
        log(`エラーステータス: ${error.response.status} ${error.response.statusText}`);
        log(`エラーヘッダー: ${JSON.stringify(error.response.headers)}`);
        log(`エラーデータ: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        log('リクエストは送信されましたが、レスポンスがありませんでした');
        log(`リクエスト情報: ${JSON.stringify(error.request._currentUrl)}`);
      } else {
        log(`リクエスト設定エラー: ${error.message}`);
      }
    }
    
    // ステップ3: 代替パスのテスト
    log('\n=== ステップ3: 代替パスのテスト ===');
    
    // 代替パスでユーザー情報取得（/users/profile）
    try {
      log('代替パス /users/profile のテスト');
      const profileResponse = await apiClient.get('/users/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      log(`プロフィール取得成功: ${JSON.stringify(profileResponse.data, null, 2)}`);
    } catch (profileError) {
      log(`プロフィール取得失敗: ${profileError.message}`);
      if (profileError.response) {
        log(`ステータス: ${profileError.response.status}`);
        log(`レスポンス: ${JSON.stringify(profileError.response.data)}`);
      }
    }
    
    // ステップ4: トークンリフレッシュのテスト
    log('\n=== ステップ4: トークンリフレッシュのテスト ===');
    try {
      log('リフレッシュトークンで新しいアクセストークンを取得');
      const refreshResponse = await apiClient.post('/auth/refresh-token', {
        refreshToken,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET
      });
      
      const newAccessToken = refreshResponse.data.accessToken;
      log(`新しいアクセストークン: ${newAccessToken.substring(0, 20)}...`);
      
      // 新しいトークンで再度/users/meを試行
      log('\n新しいトークンで/auth/users/meを再試行');
      try {
        const newUserInfoResponse = await apiClient.get('/auth/users/me', {
          headers: { 'Authorization': `Bearer ${newAccessToken}` }
        });
        
        log(`成功: ${JSON.stringify(newUserInfoResponse.data, null, 2)}`);
      } catch (retryError) {
        log(`再試行失敗: ${retryError.message}`);
        if (retryError.response) {
          log(`ステータス: ${retryError.response.status}`);
          log(`レスポンス: ${JSON.stringify(retryError.response.data)}`);
        }
      }
    } catch (refreshError) {
      log(`トークンリフレッシュ失敗: ${refreshError.message}`);
      if (refreshError.response) {
        log(`ステータス: ${refreshError.response.status}`);
        log(`レスポンス: ${JSON.stringify(refreshError.response.data)}`);
      }
    }
    
    log('\n=== デバッグ完了 ===');
    log(`詳細ログは ${LOG_FILE} に保存されました`);
  } catch (error) {
    log(`テスト実行中にエラーが発生しました: ${error.message}`);
  }
}

// デバッグ実行
debugUsersMe();