/**
 * シンプル認証・組織API整合性テスト
 * 実際のAPIエンドポイントへの接続をテスト
 */

const axios = require('axios');

// テスト用設定
const BASE_URL = 'http://localhost:3000'; // フロントエンドの開発サーバー
const PRODUCTION_URL = 'https://geniemon-portal-backend-production.up.railway.app/api';
const LOCAL_API_URL = 'http://localhost:5000/api';

// 実際のAPIエンドポイントテスト
async function testRealAPIEndpoints() {
  console.log('=== 実際のAPIエンドポイントテスト ===');
  
  try {
    // 本番環境のAPIルートテスト
    console.log('\n--- 本番環境APIルートテスト ---');
    try {
      const response = await axios.get(PRODUCTION_URL);
      console.log(`- ステータス: ${response.status}`);
      console.log('- レスポンス:', response.data);
    } catch (error) {
      console.log(`- エラー: ${error.message}`);
      if (error.response) {
        console.log(`- ステータス: ${error.response.status}`);
        console.log(`- データ:`, error.response.data);
      }
    }
    
    // 本番環境の認証エンドポイントテスト
    console.log('\n--- 本番環境SimpleAuth認証エンドポイントテスト ---');
    try {
      // OPTIONSメソッドでエンドポイントの可用性を確認
      const authResponse = await axios.options(`${PRODUCTION_URL}/simple/auth/login`);
      console.log(`- ステータス: ${authResponse.status}`);
      console.log('- レスポンス:', authResponse.data);
    } catch (error) {
      console.log(`- エラー: ${error.message}`);
      if (error.response) {
        console.log(`- ステータス: ${error.response.status}`);
        console.log(`- データ:`, error.response.data);
      }
    }
    
    // バックエンドの本番環境で一般的に提供されているエンドポイントをテスト（認証なし）
    console.log('\n--- 本番環境一般的なエンドポイントテスト ---');
    try {
      // バージョン情報など認証なしで取得できる一般的なエンドポイント
      const versionResponse = await axios.get(`${PRODUCTION_URL}/status`);
      console.log(`- ステータス: ${versionResponse.status}`);
      console.log('- レスポンス:', versionResponse.data);
    } catch (error) {
      console.log(`- エラー: ${error.message}`);
      if (error.response) {
        console.log(`- ステータス: ${error.response.status}`);
        console.log(`- データ:`, error.response.data);
      }
    }
    
    // ローカル環境のAPIルートテスト
    console.log('\n--- ローカル環境APIルートテスト ---');
    try {
      const localResponse = await axios.get(LOCAL_API_URL);
      console.log(`- ステータス: ${localResponse.status}`);
      console.log('- レスポンス:', localResponse.data);
    } catch (error) {
      console.log(`- エラー: ${error.message}`);
      if (error.response) {
        console.log(`- ステータス: ${error.response.status}`);
        console.log(`- データ:`, error.response.data);
      }
    }
    
    // ローカル環境のSimpleAuth認証エンドポイントテスト
    console.log('\n--- ローカル環境SimpleAuth認証エンドポイントテスト ---');
    try {
      const localAuthResponse = await axios.options(`${LOCAL_API_URL}/simple/auth/login`);
      console.log(`- ステータス: ${localAuthResponse.status}`);
      console.log('- レスポンス:', localAuthResponse.data);
    } catch (error) {
      console.log(`- エラー: ${error.message}`);
      if (error.response) {
        console.log(`- ステータス: ${error.response.status}`);
        console.log(`- データ:`, error.response.data);
      }
    }
    
    console.log('\nすべてのテストが完了しました');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// シンプル認証エンドポイントのテスト (モックバージョン)
async function testSimpleAuthAPI() {
  console.log('=== シンプル認証 API エンドポイントテスト (モック) ===');
  
  try {
    // 1. リクエストURLの確認
    console.log('リクエストURLをコンソールに出力するためにaxiosをモックします');
    
    // 元のaxios.getをバックアップ
    const originalGet = axios.get;
    
    // リクエストURLをログに出力するためのモック関数
    axios.get = async function(url, config) {
      console.log(`GET リクエスト: ${url}`);
      console.log('実際のリクエストは送信されません（テストモード）');
      return { data: { message: 'テスト成功' } };
    };
    
    // 同様にaxios.postも上書き
    const originalPost = axios.post;
    axios.post = async function(url, data, config) {
      console.log(`POST リクエスト: ${url}`);
      console.log('POST データ:', data);
      console.log('実際のリクエストは送信されません（テストモード）');
      return { data: { message: 'テスト成功' } };
    };
    
    // 2. 組織一覧取得APIのURLテスト
    console.log('\n--- 組織一覧取得 API テスト ---');
    await simulateGetOrganizations();
    
    // 3. ログインAPIのURLテスト
    console.log('\n--- ログイン API テスト ---');
    await simulateLogin('test@example.com', 'password123');
    
    // 4. APIキー取得APIのURLテスト 
    console.log('\n--- APIキー取得 API テスト ---');
    await simulateGetApiKeys('org123');
    
    // 元の関数を復元
    axios.get = originalGet;
    axios.post = originalPost;
    
    console.log('\nすべてのモックテストが完了しました');
    
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// 組織一覧取得シミュレーション
async function simulateGetOrganizations() {
  // simpleOrganization.service.js の getSimpleOrganizations() をシミュレート
  const API_SIMPLE_URL = '/simple';
  
  try {
    const url = `${API_SIMPLE_URL}/organizations`;
    await axios.get(url, { headers: { 'Authorization': 'Bearer test_token' } });
  } catch (error) {
    console.error('組織一覧取得シミュレーションエラー:', error);
  }
}

// ログインシミュレーション
async function simulateLogin(email, password) {
  // simpleAuth.service.js の login() をシミュレート
  const SIMPLE_API_URL = '/simple';
  
  try {
    const url = `${SIMPLE_API_URL}/auth/login`;
    await axios.post(url, { email, password });
  } catch (error) {
    console.error('ログインシミュレーションエラー:', error);
  }
}

// APIキー取得シミュレーション
async function simulateGetApiKeys(organizationId) {
  // simpleApiKey.service.js の getSimpleOrganizationApiKeys() をシミュレート
  const API_SIMPLE_URL = '/simple';
  
  try {
    const url = `${API_SIMPLE_URL}/organizations/${organizationId}/apikeys`;
    await axios.get(url, { headers: { 'Authorization': 'Bearer test_token' } });
  } catch (error) {
    console.error('APIキー取得シミュレーションエラー:', error);
  }
}

// メイン実行関数
async function main() {
  // まず実際のAPIエンドポイントテスト
  await testRealAPIEndpoints();
  
  console.log('\n===============================\n');
  
  // 次にモックテスト
  await testSimpleAuthAPI();
}

// テスト実行
main();