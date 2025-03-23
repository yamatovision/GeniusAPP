/**
 * Anthropic API接続テスト用スクリプト
 * ワークスペース作成APIのエンドポイントと認証方法をテストします
 */
const axios = require('axios');
require('dotenv').config();

// テスト用APIキー (環境変数から取得)
const apiKey = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY';
const adminApiKey = process.env.ANTHROPIC_ADMIN_API_KEY || 'YOUR_ADMIN_API_KEY';

// Anthropic APIのベースURL
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';

// 通常APIキーでのテスト
async function testStandardApiKey() {
  console.log('1. 通常APIキーでのテスト中...');
  
  try {
    // 組織とワークスペース情報の取得をテスト
    const response = await axios.get(`${ANTHROPIC_API_BASE}/v1/organizations`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ 通常APIキーでの組織情報取得に成功');
    console.log('データ:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ 通常APIキーでのテスト失敗');
    logError(error);
    return false;
  }
}

// AdminAPIキーでのテスト
async function testAdminApiKey() {
  console.log('\n2. AdminAPIキーでのテスト中...');
  
  if (!adminApiKey || adminApiKey === 'YOUR_ADMIN_API_KEY') {
    console.warn('⚠️ AdminAPIキーが設定されていません');
    return false;
  }
  
  try {
    // 組織とワークスペース情報の取得をテスト
    const response = await axios.get(`${ANTHROPIC_API_BASE}/v1/admin/organizations`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adminApiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ AdminAPIキーでの組織情報取得に成功');
    console.log('データ:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ AdminAPIキーでのテスト失敗');
    logError(error);
    return false;
  }
}

// ワークスペース作成APIのテスト (通常APIキー)
async function testWorkspaceCreationStandard() {
  console.log('\n3. 通常APIキーでのワークスペース作成テスト中...');
  
  const testName = 'テストワークスペース-' + Date.now();
  
  try {
    const response = await axios.post(`${ANTHROPIC_API_BASE}/v1/workspaces`, {
      name: testName,
      description: 'APIテスト用ワークスペース'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ 通常APIキーでのワークスペース作成に成功');
    console.log('データ:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ 通常APIキーでのワークスペース作成テスト失敗');
    logError(error);
    return false;
  }
}

// ワークスペース作成APIのテスト (AdminAPIキー)
async function testWorkspaceCreationAdmin() {
  console.log('\n4. AdminAPIキーでのワークスペース作成テスト中...');
  
  if (!adminApiKey || adminApiKey === 'YOUR_ADMIN_API_KEY') {
    console.warn('⚠️ AdminAPIキーが設定されていません');
    return false;
  }
  
  const testName = 'テストワークスペース-Admin-' + Date.now();
  
  try {
    // 既存のコードで使用されているパスでテスト
    const response = await axios.post(`${ANTHROPIC_API_BASE}/v1/admin/workspaces`, {
      name: testName,
      description: 'AdminAPIテスト用ワークスペース'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adminApiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ AdminAPIキーでのワークスペース作成に成功');
    console.log('データ:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ AdminAPIキーでのワークスペース作成テスト失敗 (既存のパス)');
    logError(error);
    
    // 別のパスでも試す
    console.log('\n4.1 別のパスでAdminAPIキーでのワークスペース作成テスト中...');
    try {
      const response2 = await axios.post(`${ANTHROPIC_API_BASE}/v1/admin/organizations/workspaces`, {
        name: testName,
        description: 'AdminAPIテスト用ワークスペース (別パス)'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': adminApiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      
      console.log('✅ AdminAPIキーでのワークスペース作成に成功 (別のパス)');
      console.log('データ:', JSON.stringify(response2.data, null, 2));
      
      return true;
    } catch (error2) {
      console.error('❌ AdminAPIキーでのワークスペース作成テスト失敗 (別のパス)');
      logError(error2);
      return false;
    }
  }
}

// エラーログの整形
function logError(error) {
  if (error.response) {
    // サーバーからのレスポンスがある場合
    console.error('ステータスコード:', error.response.status);
    console.error('レスポンスヘッダー:', error.response.headers);
    console.error('レスポンスデータ:', error.response.data);
  } else if (error.request) {
    // リクエストは送信されたがレスポンスがない場合
    console.error('リクエストエラー:', error.request);
  } else {
    // リクエスト設定中のエラー
    console.error('エラーメッセージ:', error.message);
  }
  
  if (error.config) {
    console.error('リクエスト設定:', {
      url: error.config.url,
      method: error.config.method,
      headers: error.config.headers
    });
  }
}

// メインテスト実行
async function runTests() {
  console.log('====== Anthropic API接続テスト開始 ======\n');
  
  // APIキーの有無をチェック
  if (!apiKey || apiKey === 'YOUR_API_KEY') {
    console.error('エラー: ANTHROPIC_API_KEYが設定されていません。');
    process.exit(1);
  }
  
  // 各テストを実行
  const results = {
    standardApiAccess: await testStandardApiKey(),
    adminApiAccess: await testAdminApiKey(),
    workspaceCreationStandard: await testWorkspaceCreationStandard(),
    workspaceCreationAdmin: await testWorkspaceCreationAdmin()
  };
  
  // 結果サマリー
  console.log('\n====== テスト結果サマリー ======');
  console.log('1. 通常APIキーでのアクセス:', results.standardApiAccess ? '成功 ✅' : '失敗 ❌');
  console.log('2. AdminAPIキーでのアクセス:', results.adminApiAccess ? '成功 ✅' : '失敗 ❌');
  console.log('3. 通常APIキーでのワークスペース作成:', results.workspaceCreationStandard ? '成功 ✅' : '失敗 ❌');
  console.log('4. AdminAPIキーでのワークスペース作成:', results.workspaceCreationAdmin ? '成功 ✅' : '失敗 ❌');
  
  // 解決策の提案
  console.log('\n====== 解決策の提案 ======');
  if (!results.standardApiAccess && !results.adminApiAccess) {
    console.log('両方のAPIキーでアクセスに失敗しています。APIキーが正しいか確認してください。');
  } else if (results.workspaceCreationAdmin) {
    console.log('AdminAPIキーでのワークスペース作成に成功しました。正しいエンドポイントとヘッダーを使用してください。');
  } else if (results.workspaceCreationStandard) {
    console.log('通常APIキーでのワークスペース作成に成功しました。AdminAPIキーは不要の可能性があります。');
  } else {
    console.log('ワークスペース作成APIへのアクセスに問題があります。Anthropicの最新のAPIドキュメントを確認してください。');
  }
}

// テスト実行
runTests().catch(console.error);