/**
 * テストスクリプト: ユーザーデータの取得と表示フローのテスト
 * 
 * 使用方法:
 * 1. ターミナルでディレクトリに移動: cd /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius
 * 2. スクリプトを実行: node test_script/test_user_data_flow.js <email> <password>
 */

const axios = require('axios');

// APIのベースURL (ローカル環境用)
const API_BASE_URL = 'http://localhost:3001'; 
const API_SIMPLE_URL = `${API_BASE_URL}/simple`;

async function testUserDataFlow(email, password) {
  try {
    console.log(`テスト開始: ユーザーデータフロー (${email})`);
    
    // 1. ログインしてトークンを取得
    console.log('1. ログイン中...');
    const loginResponse = await axios.post(`${API_SIMPLE_URL}/auth/login`, {
      email,
      password
    });
    
    const { accessToken } = loginResponse.data;
    if (!accessToken) {
      throw new Error('ログインに失敗しました。トークンが返されませんでした。');
    }
    console.log('ログイン成功: トークン取得完了');
    
    // 2. トークンを使用してユーザー一覧を取得
    console.log('2. ユーザー一覧を取得中...');
    const usersResponse = await axios.get(`${API_SIMPLE_URL}/users`, {
      headers: {
        'x-access-token': accessToken
      }
    });
    
    const { success, data } = usersResponse.data;
    if (!success || !data) {
      throw new Error('ユーザー一覧の取得に失敗しました。');
    }
    
    // 3. ユーザー一覧のフィールドを分析
    console.log('3. 取得したユーザー一覧を分析中...');
    console.log(`取得したユーザー数: ${data.length}`);
    
    if (data.length > 0) {
      const firstUser = data[0];
      console.log('最初のユーザーのフィールド一覧:');
      Object.keys(firstUser).forEach(key => {
        console.log(`- ${key}: ${typeof firstUser[key]}`);
      });
      
      // 4. 機密情報が含まれていないことを確認
      console.log('4. 機密情報チェック...');
      const hasPassword = firstUser.hasOwnProperty('password');
      const hasRefreshToken = firstUser.hasOwnProperty('refreshToken');
      
      if (hasPassword || hasRefreshToken) {
        console.error('警告: レスポンスに機密情報が含まれています!');
      } else {
        console.log('確認: レスポンスに機密情報は含まれていません');
      }
      
      // 5. API Key情報が適切に処理されているか確認
      console.log('5. API Key情報確認...');
      const hasApiKeyId = firstUser.hasOwnProperty('apiKeyId');
      const hasApiKeyValue = firstUser.hasOwnProperty('apiKeyValue');
      
      console.log(`APIキーID含まれているか: ${hasApiKeyId}`);
      console.log(`APIキー値含まれているか: ${hasApiKeyValue}`);
      
      if (hasApiKeyValue && firstUser.apiKeyValue) {
        console.log('注意: APIキー値がレスポンスに含まれています');
      }
    }
    
    console.log('テスト完了: ユーザーデータフロー');
    
  } catch (error) {
    console.error('テストエラー:', error.message);
    if (error.response) {
      console.error('レスポンスエラー詳細:', error.response.data);
    }
  }
}

// コマンドライン引数からメールアドレスとパスワードを取得
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('使用方法: node test_user_data_flow.js <email> <password>');
  process.exit(1);
}

const [email, password] = args;
testUserDataFlow(email, password);