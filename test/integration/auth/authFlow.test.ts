import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import axios from 'axios';
import { AuthenticationService, AuthEventType } from '../../../src/core/auth/AuthenticationService';
import { TokenManager } from '../../../src/core/auth/TokenManager';
import { ClaudeCodeAuthSync } from '../../../src/services/ClaudeCodeAuthSync';

// モック化のためのヘルパー
let mockTokenManager: any;
let mockAxios: any;
let mockVscode: any;
let processEnvBackup: any;
let authService: AuthenticationService;
let authEventBus: AuthEventBus;
let claudeCodeSync: ClaudeCodeAuthSync;

// テスト環境のセットアップ
async function setupTestEnvironment() {
  // 環境変数のバックアップと設定
  processEnvBackup = { ...process.env };
  process.env.PORTAL_API_URL = 'http://test-api.example.com/api';
  process.env.CLIENT_ID = 'test-client-id';
  process.env.CLIENT_SECRET = 'test-client-secret';
  process.env.CHECK_INTERVAL = '30';
  process.env.CLAUDE_INTEGRATION_ENABLED = 'true';
  process.env.CLAUDE_CODE_PATH = '/usr/local/bin/claude';
  
  // TokenManagerのモック
  mockTokenManager = {
    getAccessToken: sinon.stub().resolves('mock-access-token'),
    getRefreshToken: sinon.stub().resolves('mock-refresh-token'),
    setAccessToken: sinon.stub().resolves(),
    setRefreshToken: sinon.stub().resolves(),
    clearTokens: sinon.stub().resolves(),
    hasToken: sinon.stub().resolves(true),
    getInstance: sinon.stub()
  };
  mockTokenManager.getInstance.returns(mockTokenManager);
  
  // Axiosのモック
  mockAxios = {
    post: sinon.stub(),
    get: sinon.stub(),
    put: sinon.stub(),
    isAxiosError: sinon.stub().returns(true)
  };
  
  // 外部依存のモック注入
  sinon.stub(TokenManager, 'getInstance').returns(mockTokenManager);
  sinon.stub(axios, 'post').callsFake(mockAxios.post);
  sinon.stub(axios, 'get').callsFake(mockAxios.get);
  sinon.stub(axios, 'isAxiosError').callsFake(mockAxios.isAxiosError);
  
  // VSCodeのセットアップ
  mockVscode = {
    EventEmitter: sinon.stub().returns({
      event: 'mock-event',
      fire: sinon.stub(),
      dispose: sinon.stub()
    }),
    window: {
      showInformationMessage: sinon.stub(),
      showErrorMessage: sinon.stub(),
      createStatusBarItem: sinon.stub().returns({
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub()
      })
    }
  };
  
  // setIntervalのモック
  const originalSetInterval = global.setInterval;
  sinon.stub(global, 'setInterval').callsFake((callback: any, ms: number) => {
    return originalSetInterval(() => {}, ms) as any;
  });
  
  // インスタンスの初期化
  authService = AuthenticationService.getInstance();
  authEventBus = AuthEventBus.getInstance();
  claudeCodeSync = ClaudeCodeAuthSync.getInstance();
  
  // fs操作のモック
  const fs = require('fs');
  sinon.stub(fs, 'existsSync').returns(true);
  sinon.stub(fs, 'readFileSync').returns('{}');
  sinon.stub(fs, 'writeFileSync').returns(undefined);
  sinon.stub(fs, 'mkdirSync').returns(undefined);
}

// テスト後のクリーンアップ
async function cleanupTestEnvironment() {
  // スタブの復元
  sinon.restore();
  
  // 環境変数の復元
  process.env = processEnvBackup;
}

suite('認証フロー統合テスト', () => {
  let clock: sinon.SinonFakeTimers;
  
  // 各テストの前後で実行
  setup(async () => {
    await setupTestEnvironment();
    // 時間を固定して、タイムスタンプが一貫するようにする
    clock = sinon.useFakeTimers(new Date('2025-03-15T12:00:00Z').getTime());
  });
  
  teardown(async () => {
    clock.restore();
    await cleanupTestEnvironment();
  });
  
  test('E2E認証フロー - ログイン→状態同期→ログアウト', async () => {
    // イベント監視用のスパイ
    const loginEventSpy = sinon.spy();
    const logoutEventSpy = sinon.spy();
    const tokenRefreshSpy = sinon.spy();
    const authStateChangeSpy = sinon.spy();
    
    // 認証イベントバスの監視
    authEventBus.on(AuthEventType.LOGIN_SUCCESS, loginEventSpy);
    authEventBus.on(AuthEventType.LOGOUT, logoutEventSpy);
    authEventBus.on(AuthEventType.TOKEN_REFRESHED, tokenRefreshSpy);
    authEventBus.on(AuthEventType.STATE_CHANGED, authStateChangeSpy);
    
    // ログイン成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').resolves({
      status: 200,
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: { id: 'user1', name: 'Test User', email: 'test@example.com' }
      }
    });
    
    // ユーザー情報取得APIをモック
    mockAxios.get.withArgs('http://test-api.example.com/api/users/me').resolves({
      status: 200,
      data: {
        user: { id: 'user1', name: 'Test User', email: 'test@example.com', role: 'user' }
      }
    });
    
    // ClaudeCode同期操作をモック
    sinon.stub(claudeCodeSync, 'syncAuthToClaudeCode').resolves(true);
    
    // ログインの実行
    const loginResult = await authService.login('test@example.com', 'password123');
    
    // ログイン成功の検証
    assert.strictEqual(loginResult, true, 'ログインは成功を返すべき');
    assert.strictEqual(authService.isAuthenticated(), true, '認証状態がtrueになるべき');
    sinon.assert.calledOnce(loginEventSpy);
    sinon.assert.calledWith(mockTokenManager.setAccessToken, 'test-access-token');
    sinon.assert.calledWith(mockTokenManager.setRefreshToken, 'test-refresh-token');
    
    // トークンリフレッシュのモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/refresh-token').resolves({
      status: 200,
      data: {
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token'
      }
    });
    
    // トークンリフレッシュの実行
    const refreshResult = await authService.refreshToken();
    
    // リフレッシュ成功の検証
    assert.strictEqual(refreshResult, true, 'トークンリフレッシュは成功を返すべき');
    sinon.assert.calledOnce(tokenRefreshSpy);
    sinon.assert.calledWith(mockTokenManager.setAccessToken, 'refreshed-access-token');
    
    // ログアウト時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/logout').resolves({
      status: 200,
      data: { success: true }
    });
    
    // ログアウトの実行
    await authService.logout();
    
    // ログアウト成功の検証
    assert.strictEqual(authService.isAuthenticated(), false, 'ログアウト後は認証状態がfalseになるべき');
    sinon.assert.calledOnce(logoutEventSpy);
    sinon.assert.calledOnce(mockTokenManager.clearTokens);
    
    // 状態変更イベントの検証
    assert.ok(authStateChangeSpy.callCount >= 3, '状態変更イベントが複数回発行されるべき');
  });
  
  test('エラー処理と自動リカバリーフロー', async () => {
    // API障害からの自動リトライをテスト
    const errorEventSpy = sinon.spy();
    authEventBus.on(AuthEventType.AUTH_ERROR, errorEventSpy);
    
    // 1回目は失敗、2回目は成功するシナリオ
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify')
      .onFirstCall().rejects({ response: { status: 503 } })
      .onSecondCall().resolves({ status: 200, data: { valid: true } });
    
    // _verifyTokenを直接呼び出す（通常はprivateですがテスト用に呼び出し）
    const result = await (authService as any)._verifyToken('test-token');
    
    // 検証 - 最終的に成功すべき
    assert.strictEqual(result, true, 'リトライ後にトークン検証は成功を返すべき');
    
    // 失敗→成功→失敗のシナリオでトークンリフレッシュをテスト
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify')
      .onThirdCall().rejects({ response: { status: 401 } });
    
    // トークンリフレッシュは成功
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/refresh-token')
      .resolves({ status: 200, data: { accessToken: 'new-token' } });
    
    // 検証失敗→リフレッシュ
    const resultAfterRefresh = await (authService as any)._verifyToken('expired-token');
    
    // 検証 - リフレッシュにより成功すべき
    assert.strictEqual(resultAfterRefresh, true, 'トークンリフレッシュ後に検証は成功を返すべき');
    
    // トークンリフレッシュ失敗のシナリオ
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/refresh-token')
      .onSecondCall().resolves({ status: 401, data: { error: 'Invalid refresh token' } });
    
    // ログイン状態に設定
    (authService as any)._isAuthenticated = true;
    
    // リフレッシュ実行
    await authService.refreshToken();
    
    // エラーイベントが発行されるべき
    sinon.assert.called(errorEventSpy);
  });
  
  test('ClaudeCode連携の動作確認', async () => {
    // ClaudeCode設定を有効化
    process.env.CLAUDE_INTEGRATION_ENABLED = 'true';
    
    // スタブの解除と再設定
    sinon.restore();
    await setupTestEnvironment();
    
    // FS操作の成功をモック
    const fs = require('fs');
    sinon.stub(fs, 'existsSync').returns(true);
    sinon.stub(fs, 'writeFileSync').returns(undefined);
    sinon.stub(fs, 'readFileSync').returns(JSON.stringify({ some: 'data' }));
    
    // ClaudeCode同期設定
    sinon.stub(claudeCodeSync as any, '_getClaudeConfigDir').returns('/mock/config/dir');
    
    // ログイン成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').resolves({
      status: 200,
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: { id: 'user1', name: 'Test User' }
      }
    });
    
    // ユーザー情報取得APIをモック
    mockAxios.get.withArgs('http://test-api.example.com/api/users/me').resolves({
      status: 200,
      data: {
        user: { id: 'user1', name: 'Test User', email: 'test@example.com' }
      }
    });
    
    // イベントリスナーのセットアップ
    const syncEventSpy = sinon.spy(claudeCodeSync, 'syncAuthToClaudeCode');
    
    // ログイン実行
    await authService.login('test@example.com', 'password123');
    
    // ClaudeCode同期が呼ばれたことを検証
    assert.ok(syncEventSpy.called, 'ログイン後にClaudeCode同期が呼ばれるべき');
    
    // ログアウト時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/logout').resolves({
      status: 200,
      data: { success: true }
    });
    
    // ClaudeCode認証クリアのスパイ
    const clearSpy = sinon.spy(claudeCodeSync, 'clearClaudeCodeAuth');
    
    // ログアウト実行
    await authService.logout();
    
    // ClaudeCode認証クリアが呼ばれたことを検証
    assert.ok(clearSpy.called, 'ログアウト後にClaudeCode認証クリアが呼ばれるべき');
  });
  
  test('セキュアな権限チェックフロー', async () => {
    // ログイン成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').resolves({
      status: 200,
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: { 
          id: 'user1', 
          name: 'Test User', 
          email: 'test@example.com',
          role: 'user',
          permissions: ['read', 'write']
        }
      }
    });
    
    // ユーザー情報取得APIをモック
    mockAxios.get.withArgs('http://test-api.example.com/api/users/me').resolves({
      status: 200,
      data: {
        user: { 
          id: 'user1', 
          name: 'Test User', 
          email: 'test@example.com', 
          role: 'user',
          permissions: ['read', 'write'] 
        }
      }
    });
    
    // ログイン実行
    await authService.login('test@example.com', 'password123');
    
    // 権限チェック
    const canRead = authService.hasPermissions(['read']);
    const canWrite = authService.hasPermissions(['write']);
    const canDelete = authService.hasPermissions(['delete']);
    const canReadWrite = authService.hasPermissions(['read', 'write']);
    const canReadWriteDelete = authService.hasPermissions(['read', 'write', 'delete']);
    
    // 検証
    assert.strictEqual(canRead, true, '読み取り権限を持つべき');
    assert.strictEqual(canWrite, true, '書き込み権限を持つべき');
    assert.strictEqual(canDelete, false, '削除権限を持たないべき');
    assert.strictEqual(canReadWrite, true, '読み取りと書き込み権限を持つべき');
    assert.strictEqual(canReadWriteDelete, false, '削除権限がないため失敗すべき');
    
    // 管理者ログインのモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').resolves({
      status: 200,
      data: {
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
        user: { 
          id: 'admin1', 
          name: 'Admin User', 
          email: 'admin@example.com',
          role: 'admin',
          permissions: []
        }
      }
    });
    
    // 管理者情報取得APIをモック
    mockAxios.get.withArgs('http://test-api.example.com/api/users/me').resolves({
      status: 200,
      data: {
        user: { 
          id: 'admin1', 
          name: 'Admin User', 
          email: 'admin@example.com', 
          role: 'admin',
          permissions: []
        }
      }
    });
    
    // 一度ログアウト
    await authService.logout();
    
    // 管理者としてログイン
    await authService.login('admin@example.com', 'adminpass');
    
    // 権限チェック
    const adminCanRead = authService.hasPermissions(['read']);
    const adminCanWrite = authService.hasPermissions(['write']);
    const adminCanDelete = authService.hasPermissions(['delete']);
    const adminCanAll = authService.hasPermissions(['read', 'write', 'delete', 'admin']);
    
    // 検証
    assert.strictEqual(adminCanRead, true, '管理者は読み取り権限を持つべき');
    assert.strictEqual(adminCanWrite, true, '管理者は書き込み権限を持つべき');
    assert.strictEqual(adminCanDelete, true, '管理者は削除権限を持つべき');
    assert.strictEqual(adminCanAll, true, '管理者はすべての権限を持つべき');
  });
  
  test('セキュアなアクセス制御 - 認証ヘッダー生成', async () => {
    // ログイン状態にする
    mockTokenManager.getAccessToken.resolves('secure-token-123');
    (authService as any)._isAuthenticated = true;
    
    // 認証ヘッダーを取得
    const authHeader = await authService.getAuthHeader();
    
    // 検証
    assert.deepStrictEqual(
      authHeader, 
      { 'Authorization': 'Bearer secure-token-123' }, 
      '正しい認証ヘッダーが生成されるべき'
    );
    
    // トークンが変わった場合
    mockTokenManager.getAccessToken.resolves('updated-token-456');
    
    // 認証ヘッダーを再取得
    const updatedHeader = await authService.getAuthHeader();
    
    // 検証
    assert.deepStrictEqual(
      updatedHeader, 
      { 'Authorization': 'Bearer updated-token-456' }, 
      '最新のトークンで認証ヘッダーが生成されるべき'
    );
    
    // トークンが存在しない場合
    mockTokenManager.getAccessToken.resolves(undefined);
    
    // 認証ヘッダーを再取得
    const emptyHeader = await authService.getAuthHeader();
    
    // 検証
    assert.strictEqual(emptyHeader, null, 'トークンがない場合はnullを返すべき');
  });
  
  test('多段リトライと冪等性の検証', async () => {
    // 初回のみ成功するプロファイル更新をモック
    mockAxios.put.withArgs('http://test-api.example.com/api/users/profile')
      .onFirstCall().resolves({
        status: 200,
        data: {
          user: {
            id: 'user1',
            name: 'Updated User',
            email: 'updated@example.com'
          }
        }
      })
      .onSecondCall().resolves({
        status: 200,
        data: {
          user: {
            id: 'user1',
            name: 'Updated User',
            email: 'updated@example.com'
          }
        }
      });
    
    // トークンを設定
    mockTokenManager.getAccessToken.resolves('valid-token');
    (authService as any)._isAuthenticated = true;
    
    // プロファイル更新データ
    const profileData = {
      name: 'Updated User',
      email: 'updated@example.com'
    };
    
    // 1回目の更新
    const result1 = await authService.updateProfile(profileData);
    
    // 2回目の更新（同じデータ）
    const result2 = await authService.updateProfile(profileData);
    
    // 検証
    assert.strictEqual(result1, true, '1回目のプロファイル更新は成功すべき');
    assert.strictEqual(result2, true, '2回目のプロファイル更新も成功すべき（冪等性）');
    assert.strictEqual(mockAxios.put.callCount, 2, 'APIは2回呼び出されるべき');
    
    // ユーザー情報が正しく更新されていることを確認
    assert.deepStrictEqual((authService as any)._currentUser, {
      id: 'user1',
      name: 'Updated User',
      email: 'updated@example.com'
    }, 'ユーザー情報が更新されるべき');
  });
  
  test('認証エラーイベント連携とエラーリカバリー', async () => {
    // エラーイベントのスパイ
    const errorEventSpy = sinon.spy();
    const errorHandlerSpy = sinon.spy();
    
    // エラーイベントリスナーを登録
    authEventBus.on(AuthEventType.AUTH_ERROR, errorEventSpy);
    
    // VSCodeのエラーメッセージ表示をモック
    mockVscode.window.showErrorMessage = errorHandlerSpy;
    
    // 認証エラーのシナリオをセットアップ
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login')
      .rejects({
        response: {
          status: 401,
          data: {
            error: 'invalid_credentials',
            message: '認証情報が無効です'
          }
        }
      });
    
    // ログイン試行
    const result = await authService.login('test@example.com', 'wrong-password');
    
    // 検証
    assert.strictEqual(result, false, 'ログインは失敗を返すべき');
    assert.ok(errorEventSpy.called, 'エラーイベントが発行されるべき');
    assert.ok((authService.getLastError() as any).code === 'invalid_credentials', 'エラーコードが設定されるべき');
    
    // レート制限エラーのシナリオ
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login')
      .onSecondCall().rejects({
        response: {
          status: 429,
          data: {
            error: 'rate_limited',
            message: 'リクエスト回数が多すぎます。しばらく待ってから再試行してください'
          }
        }
      });
    
    // 再度ログイン試行
    const result2 = await authService.login('test@example.com', 'password123');
    
    // 検証
    assert.strictEqual(result2, false, 'ログインは失敗を返すべき');
    const lastError = authService.getLastError();
    assert.ok(lastError, 'エラー情報が設定されるべき');
    assert.strictEqual((lastError as any).code, 'rate_limited', 'レート制限エラーコードが設定されるべき');
    assert.strictEqual((lastError as any).isRetryable, true, 'リトライ可能フラグがtrueに設定されるべき');
    
    // 成功ケースのセットアップ
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login')
      .onThirdCall().resolves({
        status: 200,
        data: {
          accessToken: 'recovery-token',
          refreshToken: 'recovery-refresh-token',
          user: { id: 'user1', name: 'Recovery User' }
        }
      });
    
    // 3回目の試行（成功するはず）
    const result3 = await authService.login('test@example.com', 'correct-password');
    
    // 検証
    assert.strictEqual(result3, true, '3回目のログインは成功を返すべき');
    assert.strictEqual(authService.isAuthenticated(), true, '認証状態がtrueになるべき');
  });
});