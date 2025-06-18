/**
 * simpleAuth.helperの単体テスト
 */
const authHelper = require('../../utils/simpleAuth.helper');
const jwt = require('jsonwebtoken');

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

async function testAuthHelper() {
  log.info('simpleAuth.helperの単体テストを開始します...\n');
  
  // テスト1: セッションIDなしのアクセストークン生成
  log.info('テスト1: セッションIDなしのアクセストークン生成');
  try {
    const token1 = authHelper.generateAccessToken('user123', 'User', 'active');
    
    if (token1 && typeof token1 === 'string') {
      log.success('アクセストークンが生成されました');
      
      // トークンをデコードして内容を確認
      const decoded1 = jwt.decode(token1);
      if (decoded1.id === 'user123' && decoded1.role === 'User' && decoded1.accountStatus === 'active') {
        log.success('トークンのペイロードが正しく設定されています');
        log.info(`ペイロード: ${JSON.stringify(decoded1, null, 2)}`);
      } else {
        throw new Error('トークンのペイロードが不正です');
      }
      
      if (!decoded1.sessionId) {
        log.success('セッションIDが含まれていません（期待通り）');
      }
    } else {
      throw new Error('トークンの生成に失敗しました');
    }
  } catch (error) {
    log.error(`アクセストークン生成テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  
  // テスト2: セッションIDありのアクセストークン生成
  log.info('テスト2: セッションIDありのアクセストークン生成');
  try {
    const sessionId = 'test-session-123';
    const token2 = authHelper.generateAccessToken('user456', 'Admin', 'active', sessionId);
    
    if (token2 && typeof token2 === 'string') {
      log.success('セッションID付きアクセストークンが生成されました');
      
      // トークンをデコードして内容を確認
      const decoded2 = jwt.decode(token2);
      if (decoded2.sessionId === sessionId) {
        log.success('セッションIDがトークンに含まれています');
        log.info(`セッションID: ${decoded2.sessionId}`);
      } else {
        throw new Error('セッションIDがトークンに含まれていません');
      }
    } else {
      throw new Error('トークンの生成に失敗しました');
    }
  } catch (error) {
    log.error(`セッションID付きトークン生成テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  
  // テスト3: リフレッシュトークン生成
  log.info('テスト3: リフレッシュトークン生成');
  try {
    const refreshToken = authHelper.generateRefreshToken('user789');
    
    if (refreshToken && typeof refreshToken === 'string') {
      log.success('リフレッシュトークンが生成されました');
      
      const decodedRefresh = jwt.decode(refreshToken);
      if (decodedRefresh.id === 'user789') {
        log.success('リフレッシュトークンのペイロードが正しく設定されています');
      } else {
        throw new Error('リフレッシュトークンのペイロードが不正です');
      }
    } else {
      throw new Error('リフレッシュトークンの生成に失敗しました');
    }
  } catch (error) {
    log.error(`リフレッシュトークン生成テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  log.info('simpleAuth.helperの単体テストが完了しました');
}

// テストの実行
if (require.main === module) {
  testAuthHelper().catch(console.error);
}

module.exports = { testAuthHelper };