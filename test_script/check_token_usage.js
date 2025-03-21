/**
 * トークン使用量テストスクリプト
 * このスクリプトはAppGeniusとPortalバックエンド間のトークン使用量記録を検証します
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 認証情報ファイルのパスを特定（AppGenius専用とClaude CLI標準の両方）
const getAuthFilePaths = () => {
  const homeDir = os.homedir();
  let appGeniusAuthPath;
  let claudeStandardAuthPath;
  
  if (process.platform === 'win32') {
    appGeniusAuthPath = path.join(homeDir, 'AppData', 'Roaming', 'appgenius', 'auth.json');
    claudeStandardAuthPath = path.join(homeDir, 'AppData', 'Roaming', 'claude-cli', 'auth.json');
  } else if (process.platform === 'darwin') {
    appGeniusAuthPath = path.join(homeDir, '.appgenius', 'auth.json');
    // 代替パスも確認
    if (!fs.existsSync(appGeniusAuthPath)) {
      appGeniusAuthPath = path.join(homeDir, 'Library', 'Application Support', 'appgenius', 'auth.json');
    }
    claudeStandardAuthPath = path.join(homeDir, 'Library', 'Application Support', 'claude-cli', 'auth.json');
    // 代替パスも確認
    if (!fs.existsSync(claudeStandardAuthPath)) {
      claudeStandardAuthPath = path.join(homeDir, '.claude', 'auth.json');
    }
  } else {
    // Linux
    appGeniusAuthPath = path.join(homeDir, '.appgenius', 'auth.json');
    // 代替パスも確認
    if (!fs.existsSync(appGeniusAuthPath)) {
      appGeniusAuthPath = path.join(homeDir, '.config', 'appgenius', 'auth.json');
    }
    claudeStandardAuthPath = path.join(homeDir, '.config', 'claude-cli', 'auth.json');
    // 代替パスも確認
    if (!fs.existsSync(claudeStandardAuthPath)) {
      claudeStandardAuthPath = path.join(homeDir, '.claude', 'auth.json');
    }
  }
  
  return { appGeniusAuthPath, claudeStandardAuthPath };
};

// 認証情報を読み込む
const loadAuthInfo = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const authData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`✅ 認証情報ファイル検出: ${filePath}`);
      
      // 機密情報を隠す
      const maskedAccessToken = authData.accessToken ? 
        `${authData.accessToken.substring(0, 8)}...${authData.accessToken.substring(authData.accessToken.length - 4)}` : 
        'なし';
      
      console.log(`📄 Source: ${authData.source || 'Unknown'}`);
      console.log(`🔐 AccessToken: ${maskedAccessToken}`);
      console.log(`⏰ ExpiresAt: ${new Date(authData.expiresAt).toLocaleString()}`);
      console.log(`🕒 SyncedAt: ${new Date(authData.syncedAt).toLocaleString()}`);
      console.log(`🔄 IsolatedAuth: ${authData.isolatedAuth ? 'はい' : 'いいえ'}`);
      
      return authData;
    } else {
      console.log(`❌ 認証情報ファイルが存在しません: ${filePath}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 認証情報ファイルの読み込みに失敗: ${filePath}`, error);
    return null;
  }
};

// トークン使用量をテスト記録
const testTokenUsageRecord = async (authData, baseUrl = 'https://geniemon-portal-backend-production.up.railway.app/api') => {
  if (!authData || !authData.accessToken) {
    console.log('❌ 有効な認証情報がありません');
    return false;
  }
  
  try {
    // トークンの有効期限を確認
    const now = Date.now();
    const isExpired = authData.expiresAt && authData.expiresAt < now;
    
    if (isExpired) {
      console.log(`⚠️ トークンの有効期限が切れています: ${new Date(authData.expiresAt).toLocaleString()}`);
      console.log('🔄 このテストスクリプトではトークンの更新は行いません。VSCode拡張でログインし直してください。');
      return false;
    }
    
    // 認証ヘッダーを設定
    const config = {
      headers: {
        'Authorization': `Bearer ${authData.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };
    
    // テスト用のトークン使用量データ
    const testUsageData = {
      tokenCount: 10, // テスト用の小さな値
      modelId: 'test-model',
      context: 'token-usage-test'
    };
    
    console.log('🔄 トークン使用量記録のテストを開始...');
    console.log(`👤 ソース: ${authData.source || '不明'}`);
    console.log(`🔐 分離認証モード: ${authData.isolatedAuth ? 'はい' : 'いいえ'}`);
    
    // 認証ヘッダーのマスク表示（最初と最後の数文字のみ表示）
    const authHeaderValue = config.headers.Authorization;
    const maskedToken = authHeaderValue.substring(0, 15) + '...' + authHeaderValue.substring(authHeaderValue.length - 10);
    console.log(`🔑 認証ヘッダー: ${maskedToken}`);
    
    // 主要APIエンドポイント
    const primaryEndpoint = `${baseUrl}/proxy/usage/record`;
    
    try {
      // 主要エンドポイントでテスト
      console.log(`📡 APIエンドポイント: ${primaryEndpoint}`);
      const response = await axios.post(primaryEndpoint, testUsageData, config);
      
      console.log(`✅ トークン使用量記録成功: Status ${response.status}`);
      console.log('📊 レスポンス:', response.data);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('❌ 主要エンドポイントが見つかりません。フォールバックエンドポイントを試行...');
        
        // フォールバックエンドポイント
        const fallbackEndpoint = `${baseUrl}/proxy/usage/me/record`;
        
        try {
          console.log(`📡 APIエンドポイント(フォールバック): ${fallbackEndpoint}`);
          const fallbackResponse = await axios.post(fallbackEndpoint, testUsageData, config);
          
          console.log(`✅ フォールバックでのトークン使用量記録成功: Status ${fallbackResponse.status}`);
          console.log('📊 レスポンス:', fallbackResponse.data);
          return true;
        } catch (fallbackError) {
          console.log('❌ フォールバックエンドポイントも失敗:', fallbackError.message);
          
          // 最終フォールバックエンドポイント
          const lastResortEndpoint = `${baseUrl}/proxy/claude/usage`;
          
          try {
            console.log(`📡 APIエンドポイント(最終フォールバック): ${lastResortEndpoint}`);
            const lastResortResponse = await axios.post(lastResortEndpoint, testUsageData, config);
            
            console.log(`✅ 最終フォールバックでのトークン使用量記録成功: Status ${lastResortResponse.status}`);
            console.log('📊 レスポンス:', lastResortResponse.data);
            return true;
          } catch (lastError) {
            console.error('❌ 全てのエンドポイントが失敗:', lastError.message);
            if (axios.isAxiosError(lastError) && lastError.response) {
              console.error('📊 エラーレスポンス:', lastError.response.data);
              console.error('🔢 HTTPステータス:', lastError.response.status);
              
              // 認証エラーの場合は特別なメッセージを表示
              if (lastError.response.status === 401) {
                console.log('⚠️ 認証エラー: トークンが無効か期限切れです。VSCode拡張でログインし直してください。');
              }
            }
            return false;
          }
        }
      }
      
      console.error('❌ トークン使用量記録に失敗:', error.message);
      if (axios.isAxiosError(error) && error.response) {
        console.error('📊 エラーレスポンス:', error.response.data);
        console.error('🔢 HTTPステータス:', error.response.status);
        
        // 認証エラーの場合は特別なメッセージを表示
        if (error.response.status === 401) {
          console.log('⚠️ 認証エラー: トークンが無効か期限切れです。VSCode拡張でログインし直してください。');
        }
      }
      return false;
    }
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生:', error);
    return false;
  }
};

// メイン実行関数
const main = async () => {
  console.log('=== AppGenius トークン使用量テスト ===');
  console.log('現在の日時:', new Date().toLocaleString());
  
  // 認証ファイルのパスを取得
  const { appGeniusAuthPath, claudeStandardAuthPath } = getAuthFilePaths();
  
  console.log('\n=== AppGenius専用認証情報 ===');
  const appGeniusAuth = loadAuthInfo(appGeniusAuthPath);
  
  console.log('\n=== Claude CLI標準認証情報 ===');
  const claudeStandardAuth = loadAuthInfo(claudeStandardAuthPath);
  
  if (appGeniusAuth) {
    console.log('\n=== AppGenius専用認証情報でのトークン使用量テスト ===');
    await testTokenUsageRecord(appGeniusAuth);
  }
  
  if (claudeStandardAuth) {
    console.log('\n=== Claude CLI標準認証情報でのトークン使用量テスト ===');
    await testTokenUsageRecord(claudeStandardAuth);
  }
  
  if (!appGeniusAuth && !claudeStandardAuth) {
    console.log('❌ 両方の認証情報が見つかりませんでした。ログイン状態を確認してください。');
  }
  
  console.log('\n=== テスト完了 ===');
};

// スクリプト実行
main().catch(console.error);