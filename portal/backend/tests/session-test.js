/**
 * セッション管理機能のテスト
 */
const axios = require('axios');

// テスト用の設定
const BASE_URL = 'http://localhost:5000/api/simple';
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123'
};

// ヘルパー関数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// カラー出力用のヘルパー
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

async function testSessionManagement() {
  let token1, token2;
  
  try {
    log.info('セッション管理機能のテストを開始します...');
    
    // テスト1: 通常のログイン
    log.info('テスト1: 通常のログイン');
    try {
      const response1 = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
      
      if (response1.data.success && response1.data.data.accessToken) {
        token1 = response1.data.data.accessToken;
        log.success('1回目のログインに成功しました');
        log.info(`セッションID: ${response1.data.data.user.id}`);
      } else {
        throw new Error('ログインレスポンスが不正です');
      }
    } catch (error) {
      log.error(`1回目のログインに失敗: ${error.response?.data?.message || error.message}`);
      return;
    }
    
    await delay(1000);
    
    // テスト2: 同じアカウントで2回目のログイン試行
    log.info('テスト2: 同じアカウントで2回目のログイン試行');
    try {
      const response2 = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
      
      // エラーが返ってくることを期待
      log.error('2回目のログインが成功してしまいました（期待される動作ではありません）');
    } catch (error) {
      if (error.response?.data?.code === 'ACTIVE_SESSION_EXISTS') {
        log.success('期待通り、アクティブセッションエラーが返されました');
        log.info(`エラーメッセージ: ${error.response.data.message}`);
        
        if (error.response.data.sessionInfo) {
          log.info('既存セッション情報:');
          log.info(`  ログイン時刻: ${error.response.data.sessionInfo.loginTime}`);
          log.info(`  最終アクティビティ: ${error.response.data.sessionInfo.lastActivity}`);
          log.info(`  IPアドレス: ${error.response.data.sessionInfo.ipAddress || 'N/A'}`);
        }
      } else {
        log.error(`予期しないエラー: ${error.response?.data?.message || error.message}`);
      }
    }
    
    await delay(1000);
    
    // テスト3: 強制ログイン
    log.info('テスト3: 強制ログイン');
    try {
      const forceLoginData = {
        ...TEST_USER,
        forceLogin: true
      };
      
      const response3 = await axios.post(`${BASE_URL}/auth/force-login`, forceLoginData);
      
      if (response3.data.success && response3.data.data.accessToken) {
        token2 = response3.data.data.accessToken;
        log.success('強制ログインに成功しました');
        log.info(`前のセッションが終了されました: ${response3.data.previousSessionTerminated}`);
      } else {
        throw new Error('強制ログインレスポンスが不正です');
      }
    } catch (error) {
      log.error(`強制ログインに失敗: ${error.response?.data?.message || error.message}`);
    }
    
    await delay(1000);
    
    // テスト4: 古いトークンでのアクセス試行
    if (token1 && token2) {
      log.info('テスト4: 古いトークンでのアクセス試行');
      try {
        const response4 = await axios.get(`${BASE_URL}/auth/check`, {
          headers: {
            'Authorization': `Bearer ${token1}`
          }
        });
        
        log.error('古いトークンでのアクセスが成功してしまいました（期待される動作ではありません）');
      } catch (error) {
        if (error.response?.data?.error?.code === 'SESSION_TERMINATED') {
          log.success('期待通り、セッション終了エラーが返されました');
          log.info(`エラーメッセージ: ${error.response.data.error.message || error.response.data.message}`);
        } else if (error.response?.status === 401) {
          log.success('期待通り、401エラーが返されました');
        } else {
          log.error(`予期しないエラー: ${error.response?.data?.message || error.message}`);
        }
      }
    }
    
    await delay(1000);
    
    // テスト5: 新しいトークンでのアクセス
    if (token2) {
      log.info('テスト5: 新しいトークンでのアクセス');
      try {
        const response5 = await axios.get(`${BASE_URL}/auth/check`, {
          headers: {
            'Authorization': `Bearer ${token2}`
          }
        });
        
        if (response5.data.success) {
          log.success('新しいトークンでのアクセスに成功しました');
          log.info(`ユーザー名: ${response5.data.data.user.name}`);
          log.info(`メール: ${response5.data.data.user.email}`);
        }
      } catch (error) {
        log.error(`新しいトークンでのアクセスに失敗: ${error.response?.data?.message || error.message}`);
      }
    }
    
    log.info('\nセッション管理機能のテストが完了しました');
    
  } catch (error) {
    log.error(`テスト中に予期しないエラーが発生しました: ${error.message}`);
  }
}

// テストの実行
if (require.main === module) {
  testSessionManagement().catch(console.error);
}

module.exports = { testSessionManagement };