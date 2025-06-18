/**
 * SessionServiceの単体テスト
 */
const SessionService = require('../../services/session.service');

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

async function testSessionService() {
  log.info('SessionServiceの単体テストを開始します...\n');
  
  // テスト1: セッションIDの生成
  log.info('テスト1: セッションIDの生成');
  try {
    const sessionId1 = SessionService.generateSessionId();
    const sessionId2 = SessionService.generateSessionId();
    
    if (sessionId1 && typeof sessionId1 === 'string' && sessionId1.length === 64) {
      log.success('セッションIDが正しく生成されました');
      log.info(`生成されたID: ${sessionId1.substring(0, 20)}...`);
    } else {
      throw new Error('セッションIDの形式が不正です');
    }
    
    if (sessionId1 !== sessionId2) {
      log.success('異なるセッションIDが生成されました');
    } else {
      throw new Error('同じセッションIDが生成されました');
    }
  } catch (error) {
    log.error(`セッションID生成テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  
  // テスト2: トークンからセッションIDの抽出
  log.info('テスト2: トークンからセッションIDの抽出');
  try {
    const tokenPayload1 = { id: 'user123', role: 'User', sessionId: 'session123' };
    const tokenPayload2 = { id: 'user123', role: 'User' };
    
    const extractedId1 = SessionService.extractSessionIdFromToken(tokenPayload1);
    const extractedId2 = SessionService.extractSessionIdFromToken(tokenPayload2);
    
    if (extractedId1 === 'session123') {
      log.success('セッションIDが正しく抽出されました');
    } else {
      throw new Error('セッションIDの抽出に失敗しました');
    }
    
    if (extractedId2 === null) {
      log.success('セッションIDがない場合、nullが返されました');
    } else {
      throw new Error('セッションIDがない場合の処理が不正です');
    }
  } catch (error) {
    log.error(`セッションID抽出テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  log.info('SessionServiceの単体テストが完了しました');
}

// テストの実行
if (require.main === module) {
  testSessionService().catch(console.error);
}

module.exports = { testSessionService };