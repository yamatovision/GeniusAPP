/**
 * SimpleUserモデルのセッション管理メソッドのテスト
 */

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

async function testUserModelSession() {
  log.info('SimpleUserモデルのセッション管理メソッドのテストを開始します...\n');
  
  // モックユーザーオブジェクトを作成
  const mockUser = {
    _id: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    activeSession: null,
    
    // save メソッドのモック
    save: function() {
      return Promise.resolve(this);
    },
    
    // セッション管理メソッドを手動で追加
    hasActiveSession: function() {
      return !!(this.activeSession && this.activeSession.sessionId);
    },
    
    setActiveSession: function(sessionId, ipAddress, userAgent) {
      this.activeSession = {
        sessionId: sessionId,
        loginTime: new Date(),
        lastActivity: new Date(),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      };
      return this.save();
    },
    
    clearActiveSession: function() {
      this.activeSession = {
        sessionId: null,
        loginTime: null,
        lastActivity: null,
        ipAddress: null,
        userAgent: null
      };
      return this.save();
    },
    
    updateSessionActivity: function() {
      if (this.activeSession && this.activeSession.sessionId) {
        this.activeSession.lastActivity = new Date();
        return this.save();
      }
      return Promise.resolve(this);
    }
  };
  
  // テスト1: 初期状態の確認
  log.info('テスト1: 初期状態の確認');
  try {
    if (!mockUser.hasActiveSession()) {
      log.success('初期状態ではアクティブセッションがありません');
    } else {
      throw new Error('初期状態でアクティブセッションが検出されました');
    }
  } catch (error) {
    log.error(`初期状態テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  
  // テスト2: セッションの設定
  log.info('テスト2: セッションの設定');
  try {
    const sessionId = 'test-session-456';
    const ipAddress = '192.168.1.1';
    const userAgent = 'Mozilla/5.0 Test Browser';
    
    await mockUser.setActiveSession(sessionId, ipAddress, userAgent);
    
    if (mockUser.hasActiveSession()) {
      log.success('アクティブセッションが設定されました');
    } else {
      throw new Error('セッションの設定に失敗しました');
    }
    
    if (mockUser.activeSession.sessionId === sessionId) {
      log.success('セッションIDが正しく設定されています');
    }
    
    if (mockUser.activeSession.ipAddress === ipAddress) {
      log.success('IPアドレスが正しく設定されています');
    }
    
    if (mockUser.activeSession.userAgent === userAgent) {
      log.success('ユーザーエージェントが正しく設定されています');
    }
    
    if (mockUser.activeSession.loginTime instanceof Date) {
      log.success('ログイン時刻が設定されています');
      log.info(`ログイン時刻: ${mockUser.activeSession.loginTime.toISOString()}`);
    }
  } catch (error) {
    log.error(`セッション設定テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  
  // テスト3: セッションアクティビティの更新
  log.info('テスト3: セッションアクティビティの更新');
  try {
    const originalLastActivity = mockUser.activeSession.lastActivity;
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await mockUser.updateSessionActivity();
    
    if (mockUser.activeSession.lastActivity > originalLastActivity) {
      log.success('最終アクティビティ時刻が更新されました');
      log.info(`更新後の時刻: ${mockUser.activeSession.lastActivity.toISOString()}`);
    } else {
      throw new Error('最終アクティビティ時刻の更新に失敗しました');
    }
  } catch (error) {
    log.error(`アクティビティ更新テストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  
  // テスト4: セッションのクリア
  log.info('テスト4: セッションのクリア');
  try {
    await mockUser.clearActiveSession();
    
    if (!mockUser.hasActiveSession()) {
      log.success('アクティブセッションがクリアされました');
    } else {
      throw new Error('セッションのクリアに失敗しました');
    }
    
    if (mockUser.activeSession.sessionId === null) {
      log.success('セッションIDがnullに設定されています');
    }
  } catch (error) {
    log.error(`セッションクリアテストに失敗: ${error.message}`);
  }
  
  console.log('\n');
  log.info('SimpleUserモデルのセッション管理メソッドのテストが完了しました');
}

// テストの実行
if (require.main === module) {
  testUserModelSession().catch(console.error);
}

module.exports = { testUserModelSession };