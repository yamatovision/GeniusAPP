/**
 * SimpleAuthService API キー取得テスト
 * このスクリプトはバックエンドからAPIキーを正しく取得できるか確認します
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// アクセストークンの取得
async function readAccessToken() {
  // Claude認証ファイルのパスを取得
  let authFilePath;
  
  const appSupportPath = path.join(os.homedir(), 'Library', 'Application Support', 'appgenius');
  const claudeAuthPath = path.join(appSupportPath, 'claude-auth.json');
  
  if (fs.existsSync(claudeAuthPath)) {
    authFilePath = claudeAuthPath;
  } else {
    // 代替パス
    const altPaths = [
      path.join(os.homedir(), '.appgenius', 'auth.json'),
      path.join(os.tmpdir(), 'appgenius-auth', 'auth.json')
    ];
    
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        authFilePath = altPath;
        break;
      }
    }
  }
  
  if (!authFilePath) {
    console.error('認証ファイルが見つかりません');
    return null;
  }
  
  try {
    // ファイルを読み込み
    const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
    console.log('認証ファイルの内容:', JSON.stringify(authData, null, 2));
    // トークンをそのまま返す（文字列でもオブジェクトでも対応できるように修正済み）
    return authData;
  } catch (error) {
    console.error('認証ファイルの読み込みエラー:', error);
    return null;
  }
}

// API設定
const API_BASE_URL = 'https://geniemon-portal-backend-production.up.railway.app/api/simple';
//const API_BASE_URL = 'http://localhost:5000/api/simple';

// ユーザー情報の取得
async function getUserInfo(accessToken) {
  try {
    // トークンの形式チェック
    if (typeof accessToken === 'string') {
      console.log('アクセストークンの最初の30文字:', accessToken.substring(0, 30) + '...');
    } else if (accessToken && typeof accessToken === 'object' && accessToken.accessToken) {
      // オブジェクト形式の場合は取り出す
      console.log('オブジェクト形式のトークンを検出しました、accessToken属性を使用します');
      accessToken = accessToken.accessToken;
      console.log('アクセストークンの最初の30文字:', accessToken.substring(0, 30) + '...');
    } else {
      console.error('不明な形式のアクセストークンです', typeof accessToken, accessToken);
      return null;
    }
    
    // 認証チェックエンドポイント
    const response = await axios.get(`${API_BASE_URL}/auth/check`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('認証チェックレスポンス:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('認証チェックエラー:');
    if (error.response) {
      console.error('エラーデータ:', error.response.data);
      console.error('エラーステータス:', error.response.status);
    } else {
      console.error(error.message || error);
    }
    return null;
  }
}

// ユーザーのAPIキーを取得
async function getUserApiKey(accessToken) {
  try {
    // トークンの形式チェック
    if (typeof accessToken === 'object' && accessToken.accessToken) {
      // オブジェクト形式の場合は取り出す
      console.log('オブジェクト形式のトークンを検出しました、accessToken属性を使用します');
      accessToken = accessToken.accessToken;
    }
    
    console.log('アクセストークンを使用してAPIキーを取得します...');
    
    // 代替手段: ユーザープロフィールからAPIキーを取得（こちらが最も信頼性が高い）
    console.log('ユーザープロフィールからAPIキーを取得します...');
    
    const profileResponse = await axios.get(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('プロフィールレスポンス:', JSON.stringify(profileResponse.data, null, 2));
    
    // ユーザープロフィールからAPIキーを抽出
    if (profileResponse.data?.success) {
      // ユーザーモデルに直接保存されているAPIキー
      if (profileResponse.data?.data?.user?.apiKeyValue) {
        const apiKey = profileResponse.data.data.user.apiKeyValue;
        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 8);
        console.log('ユーザーデータからAPIキーを取得しました (マスク済み):', maskedKey);
        console.log('APIキーの長さ:', apiKey.length, '文字');
        return {
          success: true,
          data: { key: apiKey }
        };
      }
      
      // 新しいレスポンス形式
      if (profileResponse.data?.data?.apiKey?.key) {
        const apiKey = profileResponse.data.data.apiKey.key;
        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 8);
        console.log('プロフィールからAPIキーを取得しました (マスク済み):', maskedKey);
        console.log('APIキーの長さ:', apiKey.length, '文字');
        return {
          success: true,
          data: { key: apiKey }
        };
      }
    }
    
    // バックアップ手段: /user/apikey エンドポイントを試す
    console.log('バックアップ手段: /user/apikey を試行します...');
    try {
      const response = await axios.get(`${API_BASE_URL}/user/apikey`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('APIキー取得レスポンス:', JSON.stringify(response.data, null, 2));
      
      // APIキーの存在チェック
      if (response.data?.success && response.data?.data?.key) {
        const apiKey = response.data.data.key;
        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 8);
        console.log('取得したAPIキー (マスク済み):', maskedKey);
        console.log('APIキーの長さ:', apiKey.length, '文字');
        return {
          success: true,
          data: { key: apiKey }
        };
      }
    } catch (error) {
      console.log('バックアップエンドポイントからの取得に失敗しました。プロフィールからの取得結果を使用します。');
    }
    
    // どの方法でも取得できなかった場合
    throw new Error('すべての方法でAPIキーの取得に失敗しました');
  } catch (error) {
    console.error('APIキー取得エラー:');
    if (error.response) {
      console.error('エラーデータ:', error.response.data);
      console.error('エラーステータス:', error.response.status);
    } else {
      console.error(error.message || error);
    }
    return null;
  }
}

// Claude CLIパスの検証（実際のフローを模倣）
async function checkClaudeCliPath() {
  console.log('ClaudeCode CLIパスの検証を開始します (実際のフローの模倣)...');
  
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execPromise = promisify(exec);
  
  // 複数のパスで順番に試行
  const claudeCodePaths = [
    'claude',
    `/Users/${require('os').userInfo().username}/.nvm/versions/node/v18.20.6/bin/claude`,
    '/usr/local/bin/claude'
  ];
  
  for (const path of claudeCodePaths) {
    try {
      console.log(`CLIパスを試行中: ${path}`);
      const { stdout } = await execPromise(`${path} --version`);
      console.log(`ClaudeCode CLIが見つかりました: ${path}, バージョン: ${stdout.trim()}`);
      return path;
    } catch (error) {
      console.log(`パス ${path} でのCLI検出に失敗: ${error.message}`);
      // 続行して次のパスを試す
    }
  }
  
  console.log('すべてのパスでClaudeCode CLIの検出に失敗しました');
  return null;
}

// メイン実行関数
async function main() {
  try {
    const accessToken = await readAccessToken();
    
    if (!accessToken) {
      console.error('アクセストークンの取得に失敗しました');
      return;
    }
    
    console.log('アクセストークンの取得に成功しました。認証チェックを行います...');
    
    // ユーザー情報の取得
    const userInfo = await getUserInfo(accessToken);
    
    if (!userInfo || !userInfo.success) {
      console.error('ユーザー情報の取得に失敗しました');
      return;
    }
    
    console.log('ユーザー情報の取得に成功しました。');
    
    // 実際のフローを模倣 - CLIパスの検証
    // この処理により、APIキー取得のタイミングが実際のフローと近くなる
    console.log('実際のフローを模倣: CLI検証と同期処理の前...');
    const claudePath = await checkClaudeCliPath();
    console.log('CLI検証完了、APIキーを取得します...');
    
    // APIキーの取得
    const apiKeyInfo = await getUserApiKey(accessToken);
    
    if (!apiKeyInfo || !apiKeyInfo.success) {
      console.error('APIキーの取得に失敗しました');
      return;
    }
    
    console.log('APIキーの取得に成功しました');
    
    // APIキーを使用したバックエンドへのリクエスト例
    const apiKey = apiKeyInfo.data.key;
    const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 8);
    console.log('テスト完了: APIキーが正常に取得できました (マスク済み):', maskedKey);
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// スクリプトの実行
main();