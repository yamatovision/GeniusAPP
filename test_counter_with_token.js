/**
 * 認証トークンを使用してClaudeCode起動カウンターを直接更新するスクリプト
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 設定
const BASE_URL = 'https://appgenius-portal-backend-235426778039.asia-northeast1.run.app/api';
const USER_ID = '67e207d18ccc8aab3e3b6a8f'; // シラン.タツヤさんのID

// 認証情報を取得する関数
async function getAuthToken() {
  try {
    // まず環境からアクセストークンを取得
    if (process.env.APPGENIUS_ACCESS_TOKEN) {
      console.log('環境変数からアクセストークンを取得しました');
      return process.env.APPGENIUS_ACCESS_TOKEN;
    }
    
    // VSCode拡張機能の認証情報ファイルを読み込む
    const homedir = require('os').homedir();
    const authFilePath = path.join(homedir, '.vscode', 'appgenius', 'auth.json');
    const appgeniusAuthPath = path.join(homedir, '.appgenius', 'auth.json');
    
    // どちらかのファイルが存在すれば読み込む
    let authData;
    if (fs.existsSync(authFilePath)) {
      console.log(`認証情報ファイルを見つけました: ${authFilePath}`);
      const rawData = fs.readFileSync(authFilePath, 'utf8');
      authData = JSON.parse(rawData);
    } else if (fs.existsSync(appgeniusAuthPath)) {
      console.log(`AppGenius認証情報ファイルを見つけました: ${appgeniusAuthPath}`);
      const rawData = fs.readFileSync(appgeniusAuthPath, 'utf8');
      authData = JSON.parse(rawData);
    } else {
      console.log('認証情報ファイルが見つかりません。ログインが必要です。');
      
      // ログイン処理を実行
      console.log('ログインを実行します...');
      const { token } = await login();
      return token;
    }
    
    // トークンまたはAPIキーを返す
    if (authData.token) {
      console.log('ファイルからアクセストークンを取得しました');
      return authData.token;
    } else if (authData.apiKey) {
      console.log('ファイルからAPIキーを取得しました');
      return authData.apiKey;
    }
    
    throw new Error('認証情報ファイルからトークンやAPIキーが見つかりませんでした');
  } catch (error) {
    console.error('認証情報の取得に失敗しました:', error.message);
    return null;
  }
}

// ログイン処理
async function login() {
  try {
    // ログイン情報（実際の値に置き換えてください）
    const loginData = {
      email: 'shiraishi.tatsuya@mikoto.co.jp',
      password: 'aikakumei'
    };
    
    console.log(`ログインを実行: ${loginData.email}`);
    const response = await axios.post(`${BASE_URL}/simple/auth/login`, loginData);
    
    if (response.status === 200 && response.data.success) {
      console.log('ログイン成功!');
      
      // アクセストークンを取得
      const accessToken = response.data.data.accessToken;
      
      // 認証情報を保存（オプション）
      const homedir = require('os').homedir();
      const authDir = path.join(homedir, '.appgenius');
      const authFilePath = path.join(authDir, 'auth.json');
      
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
      
      fs.writeFileSync(authFilePath, JSON.stringify({ token: accessToken }), 'utf8');
      console.log(`認証情報を保存しました: ${authFilePath}`);
      
      return { token: accessToken };
    } else {
      throw new Error('ログイン応答が正常ではありません');
    }
  } catch (error) {
    console.error('ログインに失敗しました:', error.message);
    throw error;
  }
}

// ClaudeCode起動カウンターを更新する関数
async function incrementClaudeCodeLaunchCount(authToken) {
  try {
    console.log(`ClaudeCode起動カウンターを更新します: ユーザーID ${USER_ID}`);
    
    // ヘッダーの設定
    let headers = { 'Content-Type': 'application/json' };
    
    // トークンタイプに応じてヘッダーを設定
    if (authToken.startsWith('sk-')) {
      // APIキーの場合
      headers['x-api-key'] = authToken;
      console.log('APIキー認証を使用します');
    } else {
      // アクセストークンの場合
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('トークン認証を使用します');
    }
    
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
      const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
      const isSuccess = response.data?.success === true;
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
      
      // 認証エラーの場合の詳細情報
      if (error.response.status === 401 || error.response.status === 403) {
        console.error('認証エラーが発生しました。APIキーまたはトークンが無効である可能性があります。');
      }
    } else if (error.request) {
      console.error('APIエラー: リクエストは送信されましたがレスポンスがありません');
    } else {
      console.error(`APIエラー: リクエスト設定中にエラーが発生しました: ${error.message}`);
    }
    
    // リクエスト情報をログ出力
    if (error.config) {
      console.error('リクエスト情報:');
      console.error(`- URL: ${error.config.url}`);
      console.error(`- メソッド: ${error.config.method}`);
      
      // ヘッダー情報（認証情報は一部マスク）
      const headers = {...error.config.headers};
      if (headers.Authorization) {
        headers.Authorization = headers.Authorization.substring(0, 20) + '...';
      }
      if (headers['x-api-key']) {
        headers['x-api-key'] = headers['x-api-key'].substring(0, 10) + '...';
      }
      console.error(`- ヘッダー: ${JSON.stringify(headers)}`);
    }
    
    return false;
  }
}

// メイン実行
async function main() {
  console.log('==================================================');
  console.log('  ClaudeCode起動カウンター直接更新ツール');
  console.log('==================================================\n');
  
  try {
    // 認証情報を取得
    const authToken = await getAuthToken();
    if (!authToken) {
      console.error('認証情報が取得できませんでした。処理を中止します。');
      return;
    }
    
    // カウンターを更新
    await incrementClaudeCodeLaunchCount(authToken);
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
  }
  
  console.log('\n==================================================');
  console.log('処理が完了しました');
  console.log('==================================================');
}

main().catch(console.error);